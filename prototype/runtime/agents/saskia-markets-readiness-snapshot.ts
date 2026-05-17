// runtime/agents/saskia-markets-readiness-snapshot.ts
//
// Saskia's weekly markets-readiness-snapshot handler. Tenth handler in
// the fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the markets-line silence — Kai (trading systems
// engineer) has no runtime handler today; the franchise design and
// schema foundation (D-MARKETS-SCHEMA-FOUNDATION resolved 2026-05-07,
// ISDA CDM adopted) need a typed governance supervisor.
//
// What this handler does:
//   1. Walks Saskia's mandate surface in the obligations register —
//      every Banks Act, FMA, FSCA Conduct Standard, JSE / Strate, ISDA /
//      GMRA / GMSLA, BCBS Large Exposures, and Domain M (OTC Derivative
//      Provider) entry where Saskia is named — and reports counts.
//   2. Reads markets-bench (Kai) handler-coverage. Kai has no handler
//      yet — that's the signal.
//   3. Counts markets-domain events in the last 7 days: TradeBooked,
//      PositionAdjusted, MarketDataIngested, MarketSurveillanceAlert,
//      LimitOverrideRequested, DealerMandateBreach, IssuerInclusionListRefreshed,
//      CounterpartyEvent. Most are zero today — the bank has no
//      positions and no live trading substrate; the rollup runs
//      correctly against the empty set.
//   4. Inventories M1 markets-schema-foundation readiness: presence of
//      the D-MARKETS-SCHEMA-FOUNDATION decision, the franchise-design
//      proposal, and Kai's M1 CDM-bindings deliverable (file existence
//      check — substrate-gap when absent).
//   5. Emits one MarketsReadinessSnapshot event carrying the full state.
//   6. Writes a weekly deliverable to Owner Inbox.
//
// Build-phase posture:
//   - The bank has no positions, no counterparties live, no executed
//     trades. Live event flow activates at commencement of trading.
//     Saskia's first weekly snapshot is mostly inventory: which mandate
//     entries are in force vs partial vs planned, what M1 substrate is
//     in flight, and what's not yet built.
//   - When Kai ships the OMS / CDM bindings and Anya / Bea ship the
//     trade / position / sub-ledger projections, this handler's
//     event-counting branches activate without shape change.
//
// Author: Saskia (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import { HANDLERS_METADATA } from "../handlers-metadata";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = [
  "BANKS-ACT-94-1990",
  "FMA-19-2012",
  "FSCA-CONDUCT-STD-1-2018",
  "JOINT-STD-2-2020",
  "ISDA-CDM-2026",
];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const SASKIA_NARRATIVE_SYSTEM = `You are Saskia, the bank's Head of Global Markets — owner of the sales-and-trading franchise: market-making and risk-taking, institutional sales coverage, execution for internal clients (notably the Treasurer's HQLA turnover), market-abuse and conduct posture on the floor, the booking model and STP, and counterparty-credit coordination with the CRO. Your operating spec is at \`Team/Saskia.md\`. You report to the CEO; you co-own the pre-licence go-live readiness gate with Rashida and Devon; your engineering bench today is Kai (trading systems).

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly markets-readiness snapshot — a roll-up of obligations under your mandate (including Domain M for OTC Derivative Provider authorisation), Kai's runtime handler-coverage, markets-domain event counts in the last 7 days, and the readiness state of the M1 markets-schema-foundation substrate (ISDA CDM bindings, primitive registry, equity event types).

Your voice is decisive, market-fluent, and unembarrassed by an opinion. You distinguish *governance* from *engineering*: Kai builds; you govern the desk and answer for the franchise. You distinguish *substrate-ready-to-trade* from *substrate-rehearsed*. You name the FMA / FSCA Conduct Standards reportability tests rather than describing them; you name the dealer-mandate breach ladder rather than alluding to it. You do not editorialise about the regulator.

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how complete the markets substrate is, and whether Kai's M1 CDM-bindings work is on the critical path to commencement of trading.
- Picks the 1–3 most consequential observations: an obligation in your mandate at PARTIAL or PLANNED that lands at commencement (e.g. best-execution policy, voice / e-comms recording, ODP authorisation), an M1 deliverable not yet present, a Kai handler that would complete the typed-event loop.
- Names the next markets move. Be concrete: a specific franchise-posture question to surface, a specific Kai pipeline to commission, a specific Imani / Mira coordination to schedule.

Cite Banks Act 94 of 1990, Financial Markets Act 19 of 2012, FSCA Conduct Standards 1–3 of 2018, Joint Standard 2 of 2020 (as amended 9 June 2023), and ISDA CDM 2026 where they bind. The obligations register and the M1 build sequence (D-MARKETS-SCHEMA-FOUNDATION) are the canonical authoring locations; your narrative is governance interpretation, not new register substance.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## Saskia's narrative". Just produce the prose.

If the input shows zero markets-domain events (build phase), say so plainly. The dominant signal in build phase is whether M1 substrate is converging on the critical path to first trade, not whether trading is running clean.`;

// Markets engineering bench reporting through Saskia. Source: CLAUDE.md
// "Engineering vs governance" memory — Kai → Saskia.
const MARKETS_BENCH = ["Kai"] as const;

interface ObligationsCounts {
  readonly total: number;
  readonly inForce: number;
  readonly partial: number;
  readonly planned: number;
  readonly nAyet: number;
  readonly drafting: number;
  readonly inFlight: number;
  readonly preLicence: number;
}

interface BenchSeat {
  readonly persona: string;
  readonly handlerCount: number;
  readonly handlerKeys: readonly string[];
}

interface MarketsDomainEvents {
  readonly tradesBookedLast7d: number;
  readonly positionsAdjustedLast7d: number;
  readonly marketDataIngestedLast7d: number;
  readonly surveillanceAlertsLast7d: number;
  readonly limitOverridesLast7d: number;
  readonly dealerMandateBreachesLast7d: number;
  readonly issuerListRefreshesLast7d: number;
  readonly counterpartyEventsLast7d: number;
}

interface M1ReadinessState {
  readonly schemaFoundationDecisionPresent: boolean;
  readonly franchiseDesignProposalPresent: boolean;
  readonly kaiCdmBindingsDeliverablePresent: boolean;
  readonly cdmModuleScaffolded: boolean;
  readonly lastWorkstreamRegistered: string | null;
}

interface SaskiaSnapshot {
  readonly obligations: ObligationsCounts;
  readonly bench: readonly BenchSeat[];
  readonly events: MarketsDomainEvents;
  readonly m1: M1ReadinessState;
}

function readObligationsCounts(repoRoot: string): ObligationsCounts {
  const path = resolve(repoRoot, "Regulations", "_obligations-register.md");
  if (!existsSync(path)) {
    return {
      total: 0,
      inForce: 0,
      partial: 0,
      planned: 0,
      nAyet: 0,
      drafting: 0,
      inFlight: 0,
      preLicence: 0,
    };
  }
  let txt = "";
  try {
    txt = readFileSync(path, "utf8");
  } catch {
    return {
      total: 0,
      inForce: 0,
      partial: 0,
      planned: 0,
      nAyet: 0,
      drafting: 0,
      inFlight: 0,
      preLicence: 0,
    };
  }
  // Walk every table row that looks like an obligation. Pick rows
  // whose Owner column mentions Saskia — same forgiving substring rule
  // as the other governance handlers.
  let total = 0;
  let inForce = 0;
  let partial = 0;
  let planned = 0;
  let nAyet = 0;
  let drafting = 0;
  let inFlight = 0;
  let preLicence = 0;
  for (const line of txt.split("\n")) {
    if (!line.startsWith("|")) continue;
    if (!/Saskia/.test(line)) continue;
    if (/^\|\s*ID\s*\|/i.test(line)) continue;
    if (/^\|\s*-+\s*\|/.test(line)) continue;
    total++;
    if (/\bIN\s*FORCE\b/i.test(line)) {
      inForce++;
    } else if (/\bIN\s*FLIGHT\b/i.test(line)) {
      inFlight++;
    } else if (/\bPRE-?LICENCE\b/i.test(line)) {
      preLicence++;
    } else if (/\bPARTIAL\b/i.test(line)) {
      partial++;
    } else if (/\bPLANNED\b/i.test(line)) {
      planned++;
    } else if (/\bN\/A-yet\b/i.test(line)) {
      nAyet++;
    } else if (/\bDRAFTING\b/i.test(line)) {
      drafting++;
    }
  }
  return { total, inForce, partial, planned, nAyet, drafting, inFlight, preLicence };
}

function buildBench(): readonly BenchSeat[] {
  const seats: BenchSeat[] = [];
  for (const persona of MARKETS_BENCH) {
    const lower = persona.toLowerCase();
    const keys = HANDLERS_METADATA.filter((m) => m.agent.toLowerCase() === lower).map((m) => m.key);
    seats.push({ persona, handlerCount: keys.length, handlerKeys: keys });
  }
  return seats;
}

function isoDaysAgo(asOf: string, days: number): string {
  const d = new Date(asOf);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString();
}

function readMarketsDomainEvents(sinceIso: string): MarketsDomainEvents {
  let trades = 0;
  let positions = 0;
  let marketData = 0;
  let surveillance = 0;
  let limitOverrides = 0;
  let dealerBreaches = 0;
  let issuerRefreshes = 0;
  let counterparty = 0;
  for (const e of eventStore.replay({ type: "TradeBooked" })) if (e.as_of >= sinceIso) trades++;
  for (const e of eventStore.replay({ type: "PositionAdjusted" })) {
    if (e.as_of >= sinceIso) positions++;
  }
  for (const e of eventStore.replay({ type: "MarketDataIngested" })) {
    if (e.as_of >= sinceIso) marketData++;
  }
  for (const e of eventStore.replay({ type: "MarketSurveillanceAlert" })) {
    if (e.as_of >= sinceIso) surveillance++;
  }
  for (const e of eventStore.replay({ type: "LimitOverrideRequested" })) {
    if (e.as_of >= sinceIso) limitOverrides++;
  }
  for (const e of eventStore.replay({ type: "DealerMandateBreach" })) {
    if (e.as_of >= sinceIso) dealerBreaches++;
  }
  for (const e of eventStore.replay({ type: "IssuerInclusionListRefreshed" })) {
    if (e.as_of >= sinceIso) issuerRefreshes++;
  }
  for (const e of eventStore.replay({ type: "CounterpartyEvent" })) {
    if (e.as_of >= sinceIso) counterparty++;
  }
  return {
    tradesBookedLast7d: trades,
    positionsAdjustedLast7d: positions,
    marketDataIngestedLast7d: marketData,
    surveillanceAlertsLast7d: surveillance,
    limitOverridesLast7d: limitOverrides,
    dealerMandateBreachesLast7d: dealerBreaches,
    issuerListRefreshesLast7d: issuerRefreshes,
    counterpartyEventsLast7d: counterparty,
  };
}

function readM1Readiness(repoRoot: string): M1ReadinessState {
  const ownerInbox = resolve(repoRoot, "archive", "owner-inbox");
  const schemaDecision = resolve(
    ownerInbox,
    "2026-05-07_ceo-decision_markets-schema-foundation.md",
  );
  const franchiseProposal = resolve(
    ownerInbox,
    "2026-05-07_saskia_markets-franchise-design-proposal.md",
  );
  const kaiBindingsDeliverable = resolve(
    ownerInbox,
    "2026-05-07_kai_m1-cdm-typescript-bindings.md",
  );
  const cdmModuleDir = resolve(repoRoot, "prototype", "platform", "markets", "cdm");

  // M1 markets-schema-foundation workstream — the most recent
  // WorkstreamRegistered event whose payload mentions M1 / CDM /
  // markets-schema is the freshest indicator that the cohort is moving.
  let lastWorkstream: string | null = null;
  for (const e of eventStore.replay({ type: "WorkstreamRegistered" })) {
    const payload = e.payload as { workstreamId?: string; title?: string };
    const haystack = `${payload?.workstreamId ?? ""} ${payload?.title ?? ""}`.toLowerCase();
    if (
      haystack.includes("m1") ||
      haystack.includes("cdm") ||
      haystack.includes("markets-schema")
    ) {
      if (lastWorkstream === null || e.as_of > lastWorkstream) lastWorkstream = e.as_of;
    }
  }

  return {
    schemaFoundationDecisionPresent: existsSync(schemaDecision),
    franchiseDesignProposalPresent: existsSync(franchiseProposal),
    kaiCdmBindingsDeliverablePresent: existsSync(kaiBindingsDeliverable),
    cdmModuleScaffolded: existsSync(cdmModuleDir),
    lastWorkstreamRegistered: lastWorkstream,
  };
}

function buildSnapshot(ctx: AgentRunContext): SaskiaSnapshot {
  const sinceIso = isoDaysAgo(ctx.asOf, 7);
  return {
    obligations: readObligationsCounts(ctx.repoRoot),
    bench: buildBench(),
    events: readMarketsDomainEvents(sinceIso),
    m1: readM1Readiness(ctx.repoRoot),
  };
}

function buildNarrativeInput(ctx: AgentRunContext, snap: SaskiaSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Saskia-owned obligations (from Regulations/_obligations-register.md):");
  lines.push(`  total: ${snap.obligations.total}`);
  lines.push(`    IN FORCE: ${snap.obligations.inForce}`);
  lines.push(`    IN FLIGHT: ${snap.obligations.inFlight}`);
  lines.push(`    PARTIAL: ${snap.obligations.partial}`);
  lines.push(`    PLANNED: ${snap.obligations.planned}`);
  lines.push(`    DRAFTING: ${snap.obligations.drafting}`);
  lines.push(`    PRE-LICENCE: ${snap.obligations.preLicence}`);
  lines.push(`    N/A-yet: ${snap.obligations.nAyet}`);
  lines.push("");
  lines.push("markets bench (Kai):");
  for (const s of snap.bench) {
    lines.push(
      `  - ${s.persona}: ${s.handlerCount} runtime handler(s)${s.handlerCount > 0 ? ` [${s.handlerKeys.join(", ")}]` : ""}`,
    );
  }
  lines.push("");
  lines.push("markets-domain events (last 7 days):");
  lines.push(`  TradeBooked: ${snap.events.tradesBookedLast7d}`);
  lines.push(`  PositionAdjusted: ${snap.events.positionsAdjustedLast7d}`);
  lines.push(`  MarketDataIngested: ${snap.events.marketDataIngestedLast7d}`);
  lines.push(`  MarketSurveillanceAlert: ${snap.events.surveillanceAlertsLast7d}`);
  lines.push(`  LimitOverrideRequested: ${snap.events.limitOverridesLast7d}`);
  lines.push(`  DealerMandateBreach: ${snap.events.dealerMandateBreachesLast7d}`);
  lines.push(`  IssuerInclusionListRefreshed: ${snap.events.issuerListRefreshesLast7d}`);
  lines.push(`  CounterpartyEvent: ${snap.events.counterpartyEventsLast7d}`);
  lines.push("");
  lines.push("M1 markets-schema-foundation readiness:");
  lines.push(
    `  D-MARKETS-SCHEMA-FOUNDATION decision recorded: ${snap.m1.schemaFoundationDecisionPresent}`,
  );
  lines.push(`  franchise-design proposal present: ${snap.m1.franchiseDesignProposalPresent}`);
  lines.push(
    `  Kai M1 CDM-bindings deliverable present: ${snap.m1.kaiCdmBindingsDeliverablePresent}`,
  );
  lines.push(`  @platform/markets/cdm module scaffolded: ${snap.m1.cdmModuleScaffolded}`);
  lines.push(
    `  last M1 / CDM workstream-registered event: ${snap.m1.lastWorkstreamRegistered ?? "never"}`,
  );
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's load-bearing on commencement of trading; close with the next markets move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: SaskiaSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("Saskia", "markets-readiness-snapshot", ctx.asOf));
  lines.push(`# Saskia — markets-readiness snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of Saskia's weekly markets-readiness snapshot per `Team/Saskia.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Tenth handler in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING`.",
  );
  lines.push("");
  const totalHandlers = snap.bench.reduce((acc, s) => acc + s.handlerCount, 0);
  lines.push(
    `**Headline:** ${snap.obligations.total} Saskia-owned obligation${snap.obligations.total === 1 ? "" : "s"} on the register (${snap.obligations.inForce} IN FORCE; ${snap.obligations.inFlight} IN FLIGHT; ${snap.obligations.partial} PARTIAL; ${snap.obligations.planned} PLANNED; ${snap.obligations.preLicence} PRE-LICENCE) · markets bench ${totalHandlers}/${MARKETS_BENCH.length} handlers (Kai pending) · ${snap.events.tradesBookedLast7d} trade${snap.events.tradesBookedLast7d === 1 ? "" : "s"} booked · M1 ${snap.m1.schemaFoundationDecisionPresent && snap.m1.franchiseDesignProposalPresent ? "decision + design landed" : "decision / design pending"}, CDM module ${snap.m1.cdmModuleScaffolded ? "scaffolded" : "**not yet scaffolded**"}.`,
  );
  lines.push("");

  lines.push("## Saskia-owned obligations on register");
  lines.push("");
  lines.push("| Status | Count |");
  lines.push("|---|---|");
  lines.push(`| IN FORCE | ${snap.obligations.inForce} |`);
  lines.push(`| IN FLIGHT | ${snap.obligations.inFlight} |`);
  lines.push(`| PARTIAL | ${snap.obligations.partial} |`);
  lines.push(`| PLANNED | ${snap.obligations.planned} |`);
  lines.push(`| DRAFTING | ${snap.obligations.drafting} |`);
  lines.push(`| PRE-LICENCE | ${snap.obligations.preLicence} |`);
  lines.push(`| N/A-yet | ${snap.obligations.nAyet} |`);
  lines.push(`| **Total** | **${snap.obligations.total}** |`);
  lines.push("");
  lines.push(
    "_Source: rows in `Regulations/_obligations-register.md` whose Owner column names Saskia (or where Saskia is named anywhere on the row), including Domain M (OTC Derivative Provider) entries added 2026-05-07. Counts are coarse — refines once the obligations register exposes a structured per-row API._",
  );
  lines.push("");

  lines.push("## Markets bench");
  lines.push("");
  lines.push("| Seat | Runtime handlers | Keys |");
  lines.push("|---|---|---|");
  for (const s of snap.bench) {
    lines.push(
      `| ${s.persona} | ${s.handlerCount} | ${s.handlerCount === 0 ? "_none — handler-write pending in fleet-rollout queue_" : s.handlerKeys.map((k) => `\`${k}\``).join(", ")} |`,
    );
  }
  lines.push("");

  lines.push("## Markets-domain events (last 7 days)");
  lines.push("");
  lines.push("| Event | Count |");
  lines.push("|---|---|");
  lines.push(`| \`TradeBooked\` | ${snap.events.tradesBookedLast7d} |`);
  lines.push(`| \`PositionAdjusted\` | ${snap.events.positionsAdjustedLast7d} |`);
  lines.push(`| \`MarketDataIngested\` | ${snap.events.marketDataIngestedLast7d} |`);
  lines.push(`| \`MarketSurveillanceAlert\` | ${snap.events.surveillanceAlertsLast7d} |`);
  lines.push(`| \`LimitOverrideRequested\` | ${snap.events.limitOverridesLast7d} |`);
  lines.push(`| \`DealerMandateBreach\` | ${snap.events.dealerMandateBreachesLast7d} |`);
  lines.push(`| \`IssuerInclusionListRefreshed\` | ${snap.events.issuerListRefreshesLast7d} |`);
  lines.push(`| \`CounterpartyEvent\` | ${snap.events.counterpartyEventsLast7d} |`);
  lines.push("");
  if (
    snap.events.tradesBookedLast7d === 0 &&
    snap.events.positionsAdjustedLast7d === 0 &&
    snap.events.surveillanceAlertsLast7d === 0
  ) {
    lines.push(
      "_Build-phase posture: zero trades, zero positions, zero surveillance alerts. Kai's OMS / EMS, Anya's position projection, and Mira's surveillance pipelines emit these types — none yet built. Live event flow activates at commencement of trading per the build-phase model._",
    );
    lines.push("");
  }

  lines.push("## M1 markets-schema-foundation readiness");
  lines.push("");
  lines.push("| Item | State |");
  lines.push("|---|---|");
  lines.push(
    `| \`D-MARKETS-SCHEMA-FOUNDATION\` decision recorded | ${snap.m1.schemaFoundationDecisionPresent ? "yes" : "**no — substrate gap**"} |`,
  );
  lines.push(
    `| Franchise-design proposal in Owner Inbox | ${snap.m1.franchiseDesignProposalPresent ? "yes" : "**no — substrate gap**"} |`,
  );
  lines.push(
    `| Kai M1 CDM-bindings deliverable in Owner Inbox | ${snap.m1.kaiCdmBindingsDeliverablePresent ? "yes" : "**not yet — Kai work in flight**"} |`,
  );
  lines.push(
    `| \`@platform/markets/cdm\` module scaffolded | ${snap.m1.cdmModuleScaffolded ? "yes" : "**not yet — Kai work in flight**"} |`,
  );
  lines.push(
    `| Last M1 / CDM \`WorkstreamRegistered\` event | ${snap.m1.lastWorkstreamRegistered ?? "**never — substrate gap**"} |`,
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **Kai runtime handler** — markets bench has zero typed-event producers today. Kai's first handler should snapshot OMS / EMS substrate state, CDM-bindings progress, and the typed-event surface produced by the desk. Required pre-M1 cutover.",
  );
  lines.push(
    "- **`@platform/markets/cdm` module** — TypeScript bindings + Zod validators authorised under D-MARKETS-SCHEMA-FOUNDATION but not yet scaffolded under `prototype/platform/markets/cdm/`. Required pre-M2 (listed bonds + repo).",
  );
  lines.push(
    "- **OMS / EMS substrate (Kai)** — booking-and-state queries are point-in-time; trade lifecycle event types (`TradeBooked`, `PositionAdjusted`, `MarketDataIngested`) registered but no producer.",
  );
  lines.push(
    "- **Surveillance substrate (Mira + Saskia)** — voice / e-comms ingest pipelines partial; insider-list register pending. Required pre-licence for FMA Ch. X market-abuse posture.",
  );
  lines.push(
    "- **Position / risk projection (Anya / Rohan)** — under build; needed before dealer-mandate breach detection can run end-to-end.",
  );
  lines.push(
    "- **Counterparty / negotiations-in-principle workspace (Imani + Atlas)** — partial; load-bearing for ISDA / GMRA / GMSLA onboarding under Domain M.",
  );
  lines.push(
    "- **Strate / JSE connectivity (Tomas + Kai + Atlas)** — not yet established. Required before licence-day trading.",
  );
  lines.push(
    "- **Pre-licence go-live readiness gate (Saskia + Rashida + Devon)** — three-signature substrate under build; gate-state event-type pending.",
  );
  lines.push(
    "- **Institutional-markets-sales engineering counterpart** — vacant; flagged for PAX / Nolan as the franchise's needs concretise.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## Saskia's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## Saskia's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Saskia-owned obligations parsed from `Regulations/_obligations-register.md` (rows where Saskia appears in any cell, across Domain ORG-PR / ORG-CD / ORG-MK and Domain M for OTC Derivative Provider); markets-bench handler-coverage from `runtime/handlers-metadata.ts`; markets-domain event counts via `eventStore.replay({type:...})` filtered to last 7 days; M1 readiness state from filesystem presence of D-MARKETS-SCHEMA-FOUNDATION decision record, franchise-design proposal, Kai's M1 deliverable, and `@platform/markets/cdm` scaffold, plus latest `WorkstreamRegistered` event whose payload mentions M1 / CDM / markets-schema.",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "MarketsReadinessSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:saskia:markets-readiness-snapshot" },
      citations: EVENT_CITATIONS,
      payload: {
        saskiaOwnedObligations: snap.obligations.total,
        obligationsInForce: snap.obligations.inForce,
        obligationsInFlight: snap.obligations.inFlight,
        obligationsPartial: snap.obligations.partial,
        obligationsPlanned: snap.obligations.planned,
        obligationsDrafting: snap.obligations.drafting,
        obligationsPreLicence: snap.obligations.preLicence,
        obligationsNAyet: snap.obligations.nAyet,
        kaiHandlerCount: snap.bench.find((s) => s.persona === "Kai")?.handlerCount ?? 0,
        ...snap.events,
        m1SchemaFoundationDecisionPresent: snap.m1.schemaFoundationDecisionPresent,
        m1FranchiseDesignProposalPresent: snap.m1.franchiseDesignProposalPresent,
        m1KaiCdmBindingsDeliverablePresent: snap.m1.kaiCdmBindingsDeliverablePresent,
        m1CdmModuleScaffolded: snap.m1.cdmModuleScaffolded,
        m1LastWorkstreamRegistered: snap.m1.lastWorkstreamRegistered,
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Inventory above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: SASKIA_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "saskia:markets-readiness-snapshot — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "saskia narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_saskia_markets-readiness-snapshot.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      saskiaObligations: snap.obligations.total,
      kaiHandlers: snap.bench.find((s) => s.persona === "Kai")?.handlerCount ?? 0,
      trades: snap.events.tradesBookedLast7d,
      m1CdmScaffolded: snap.m1.cdmModuleScaffolded,
    },
    "saskia:markets-readiness-snapshot — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.obligations.total} Saskia obligations (${snap.obligations.inForce} in force, ${snap.obligations.inFlight} in flight) · Kai ${snap.bench.find((s) => s.persona === "Kai")?.handlerCount ?? 0} handlers · ${snap.events.tradesBookedLast7d} trades · M1 CDM ${snap.m1.cdmModuleScaffolded ? "scaffolded" : "pending"}.`,
    ok: true,
  };
};

export default handler;
