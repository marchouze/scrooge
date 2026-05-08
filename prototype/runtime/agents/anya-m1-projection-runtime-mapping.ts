// runtime/agents/anya-m1-projection-runtime-mapping.ts
//
// Anya's M1 projection-runtime-mapping handler.
//
// Authority:
//   - `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07).
//   - Brief: `Team Inbox/2026-05-07_brief_anya_m1-projection-runtime-mapping.md`.
//   - Source proposal: `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md`
//     §7 (projections) and §9 (semantic-layer mapping).
//
// What this handler does (per brief §1–§5):
//
//   1. Subscribes to `CeoDecision` (D-MARKETS-SCHEMA-FOUNDATION) and to
//      `CdmBindingsRegenerated` (Kai's M1 bindings handler).
//   2. On first observation of either trigger event, registers the three
//      M1 markets projections — `markets.trade-record`, `markets.position`,
//      `markets.sub-ledger` — by emitting one `MarketsProjectionRegistered`
//      event per projection. Idempotent: re-runs after registration emit
//      no `…Registered` events; they emit `MarketsProjectionRefreshed`
//      with the materialised row counts so Vera's recon harness has a
//      heartbeat per dispatch.
//   3. Each emit carries the citation chain (Principle 2) — JSE-RULES-EQUITIES
//      / FMA-S5 / ORG-AC-01 (IFRS 9 classification) / ORG-AC-05 (IFRS 13
//      fair value) / ORG-PR-19 (FRTB market risk) / GOV-FRAMEWORK-CEO-RESERVED.
//      One [citation: route to Mira] flag for the missing PRICE-FEED-PROVENANCE
//      anchor — surfaced on the equity-position-mark-to-market entry.
//   4. Builds the projection-replay harness in tests/runtime-anya-m1-projection-runtime-mapping.test.ts:
//      replays equity event streams as-of past timestamps and asserts
//      reducer determinism.
//
// What this handler does NOT do (intentionally):
//   - Bond / repo / IRS / FX projections (M2–M5; same shape).
//   - Cross-currency translation projection (M2 — multi-currency reporting
//     book is its own projection over an FX-rate event stream, not yet
//     in the substrate).
//   - Persisted projection cache (in-memory only at M1; cache lift is M2).
//
// Trigger kind: event-driven. Fan-out from any parent run that appends
// `CeoDecision` or `CdmBindingsRegenerated`. The runtime takes care of
// dispatch; this handler just does the work.
//
// Author: Anya · cc Kai (CDM bindings), Bea (IFRS sub-ledger), Atlas (runtime).

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger, projector } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import type { Event } from "../../platform/event-store/types";
import {
  MARKETS_PROJECTION_NAMES,
  SEMANTIC_LAYER_ENTRIES,
  positionProjection,
  subLedgerProjection,
  tradeRecordProjection,
} from "../../platform/projections/markets";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const DEFAULT_ENTITY = "BANK-ZA-001";

const HANDLER_ACTOR = {
  type: "service" as const,
  id: "agent:anya:m1-projection-runtime-mapping",
};

/**
 * Citation chain for the M1 projection-runtime-mapping emissions
 * (Principle 2). Every event carries this baseline; the
 * MarketsProjectionRegistered event for the sub-ledger projection adds
 * IFRS-classification anchors.
 *
 *   - JSE-RULES-EQUITIES — listed-equity domain.
 *   - FMA-S5 — Financial Markets Act § 5 market integrity.
 *   - ORG-AC-01 — IFRS 9 classification (sub-ledger anchor).
 *   - ORG-AC-05 — IFRS 13 fair-value measurement (mark-to-market anchor).
 *   - ORG-PR-19 — FRTB market-risk obligation (Rohan-side consumer).
 *   - GOV-FRAMEWORK-CEO-RESERVED — D-MARKETS-SCHEMA-FOUNDATION authority.
 *
 * The mark-to-market quantity in the semantic layer carries an explicit
 * `[citation: route to Mira] PRICE-FEED-PROVENANCE` flag inside the
 * SEMANTIC_LAYER_ENTRIES table — the obligations register has no
 * price-feed-provenance entry yet; flagged for Mira to instate before
 * M2 swaps in a separate market-data feed.
 */
const BASE_CITATIONS: readonly string[] = [
  "JSE-RULES-EQUITIES",
  "FMA-S5",
  "ORG-AC-01",
  "ORG-AC-05",
  "ORG-PR-19",
  "GOV-FRAMEWORK-CEO-RESERVED",
];

const PROJECTION_CITATIONS: Readonly<Record<string, readonly string[]>> = {
  "markets.trade-record": ["JSE-RULES-EQUITIES", "FMA-S5", "GOV-FRAMEWORK-CEO-RESERVED"],
  "markets.position": [
    "JSE-RULES-EQUITIES",
    "FMA-S5",
    "ORG-AC-05",
    "ORG-PR-19",
    "GOV-FRAMEWORK-CEO-RESERVED",
  ],
  "markets.sub-ledger": [
    "JSE-RULES-EQUITIES",
    "ORG-AC-01",
    "ORG-AC-05",
    "GOV-FRAMEWORK-CEO-RESERVED",
  ],
};

const PROJECTIONS = [tradeRecordProjection, positionProjection, subLedgerProjection] as const;

interface ProjectionMaterialisation {
  readonly name: string;
  readonly rowCount: number;
}

function materialiseAll(): ProjectionMaterialisation[] {
  return [
    {
      name: tradeRecordProjection.name,
      rowCount: projector.build(tradeRecordProjection).rows.size,
    },
    {
      name: positionProjection.name,
      rowCount: projector.build(positionProjection).rows.size,
    },
    {
      name: subLedgerProjection.name,
      rowCount: projector.build(subLedgerProjection).rows.length,
    },
  ];
}

/**
 * Idempotency check: walk the event store for existing
 * `MarketsProjectionRegistered` events and collect the names already
 * registered. The handler emits one `…Registered` event per projection,
 * never twice. (The bus / handler dispatch layer also de-dupes, but this
 * is the projection-name-keyed safety net.)
 */
function alreadyRegistered(): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type: "MarketsProjectionRegistered" })) {
    const p = e.payload as { projectionName?: unknown };
    if (typeof p.projectionName === "string") out.add(p.projectionName);
  }
  return out;
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const triggering = ctx.trigger.triggeringEvents ?? [];
  const relevant = triggering.filter(
    (e: Event) => e.type === "CeoDecision" || e.type === "CdmBindingsRegenerated",
  );

  if (relevant.length === 0 && ctx.trigger.kind === "event-driven") {
    return {
      eventsEmitted: 0,
      summary: "no CeoDecision or CdmBindingsRegenerated events in triggering set; nothing to map",
      ok: true,
    };
  }

  const registered = alreadyRegistered();
  const toRegister = MARKETS_PROJECTION_NAMES.filter((n) => !registered.has(n));
  const projectionsAfter = materialiseAll();

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    // 1) Emit MarketsProjectionRegistered for each projection that has
    //    not yet been registered. One event per projection — the registry
    //    semantic mirrors handler-callables: each registration is the
    //    durable record of "this projection's contract is now live".
    for (const projection of PROJECTIONS) {
      if (registered.has(projection.name)) continue;
      const citations = PROJECTION_CITATIONS[projection.name] ?? BASE_CITATIONS;
      const semanticEntries = SEMANTIC_LAYER_ENTRIES.filter((s) =>
        s.projectionRule.startsWith(`${projection.name} —`),
      );
      eventStore.append({
        event_id: newEventId(),
        type: "MarketsProjectionRegistered",
        as_of: ctx.asOf,
        entity: DEFAULT_ENTITY,
        actor: HANDLER_ACTOR,
        citations: [...citations],
        payload: {
          projectionName: projection.name,
          contract: projection.name,
          semanticLayerEntries: semanticEntries.map((s) => ({
            id: s.id,
            name: s.name,
            cdmPrimitive: s.cdmPrimitive,
            projectionRule: s.projectionRule,
            presentationField: s.presentationField,
            citations: s.citations,
            unit: s.unit,
          })),
          consumesEventTypes: [
            "EquityTradeBooked",
            "EquityCorporateActionApplied",
            "EquitySettlementInstructed",
          ],
          idempotencyKey:
            projection.name === "markets.trade-record"
              ? "tradeId"
              : projection.name === "markets.position"
                ? "(entity, instrumentIsin, bookId)"
                : "(sourceEventId, legKind)",
          authority: "D-MARKETS-SCHEMA-FOUNDATION",
          triggerKind: ctx.trigger.kind,
          triggerId: ctx.trigger.id,
        },
      });
      eventsEmitted += 1;
    }

    // 2) Emit one MarketsProjectionRefreshed per projection so Vera's
    //    recon and the dashboard fleet-health page have a heartbeat
    //    record per dispatch — this is the round-trip recon hook from
    //    the brief §Reconciliation: replay-based row counts at as-of=
    //    ctx.asOf, recorded on the event log so a downstream replay
    //    reproduces the same counts.
    for (const m of projectionsAfter) {
      const citations = PROJECTION_CITATIONS[m.name] ?? BASE_CITATIONS;
      eventStore.append({
        event_id: newEventId(),
        type: "MarketsProjectionRefreshed",
        as_of: ctx.asOf,
        entity: DEFAULT_ENTITY,
        actor: HANDLER_ACTOR,
        citations: [...citations],
        payload: {
          projectionName: m.name,
          rowCount: m.rowCount,
          asOf: ctx.asOf,
          triggerKind: ctx.trigger.kind,
          triggerId: ctx.trigger.id,
          triggeringEventIds: relevant.map((e) => e.event_id),
        },
      });
      eventsEmitted += 1;
    }
  }

  // Owner Inbox deliverable — concise summary per the brief §Owner Inbox
  // deliverable. Convention matches other event-driven handlers
  // (kai-pre-trade-gateway-aggregator, rohan-backtest-harness).
  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_anya_m1-projection-runtime-mapping.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildDeliverable(ctx, toRegister, projectionsAfter, relevant),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.info(
    {
      triggering: relevant.length,
      registered: toRegister.length,
      refreshed: projectionsAfter.length,
      eventsEmitted,
      rowCounts: projectionsAfter,
    },
    "anya:m1-projection-runtime-mapping — done",
  );

  const registeredSummary =
    toRegister.length > 0
      ? `${toRegister.length} projection${toRegister.length === 1 ? "" : "s"} registered`
      : "no new registrations (idempotent)";
  const refreshedSummary = projectionsAfter.map((m) => `${m.name}=${m.rowCount}`).join(", ");

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${registeredSummary}; refreshed: ${refreshedSummary}.`,
    ok: true,
  };
};

function buildDeliverable(
  ctx: AgentRunContext,
  toRegister: readonly string[],
  refreshed: readonly ProjectionMaterialisation[],
  triggering: readonly Event[],
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Anya", "m1-projection-runtime-mapping", ctx.asOf));
  lines.push(`# Anya — M1 projection-runtime-mapping, ${date}`);
  lines.push("");
  lines.push(
    "Event-driven run mapping the M1 CDM equity event types to the projection runtime per `D-MARKETS-SCHEMA-FOUNDATION` (CEO approved 2026-05-07). Three projections in scope: `markets.trade-record`, `markets.position`, `markets.sub-ledger`. Sub-ledger contract feeds Bea's IFRS classifier without bespoke plumbing.",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${toRegister.length} new registration${toRegister.length === 1 ? "" : "s"} · refreshed row counts: ${refreshed.map((m) => `${m.name}=${m.rowCount}`).join(" · ")}.`,
  );
  lines.push("");
  if (toRegister.length > 0) {
    lines.push("## Projections registered this run");
    lines.push("");
    for (const n of toRegister) lines.push(`- \`${n}\``);
    lines.push("");
  }
  lines.push("## Semantic-layer entries");
  lines.push("");
  lines.push("| ID | Name | CDM primitive | Projection rule | Presentation | Citations |");
  lines.push("|---|---|---|---|---|---|");
  for (const s of SEMANTIC_LAYER_ENTRIES) {
    lines.push(
      `| \`${s.id}\` | ${s.name} | ${s.cdmPrimitive} | ${s.projectionRule} | ${s.presentationField} | ${s.citations.join(", ")} |`,
    );
  }
  lines.push("");
  lines.push("## Refresh row counts");
  lines.push("");
  lines.push("| Projection | Rows at as-of |");
  lines.push("|---|---|");
  for (const m of refreshed) lines.push(`| \`${m.name}\` | ${m.rowCount} |`);
  lines.push("");
  lines.push("## Provenance");
  lines.push("");
  lines.push(
    `Triggered by ${triggering.length} event${triggering.length === 1 ? "" : "s"} (\`CeoDecision\` / \`CdmBindingsRegenerated\`). Replay-based row counts at as-of=${ctx.asOf}; replay over the same event set reproduces identical counts (asserted in \`tests/runtime-anya-m1-projection-runtime-mapping.test.ts\`).`,
  );
  lines.push("");
  return lines.join("\n");
}

export default handler;
