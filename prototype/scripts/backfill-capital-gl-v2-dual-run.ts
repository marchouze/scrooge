// scripts/backfill-capital-gl-v2-dual-run.ts
//
// WS-V2-AUTHORITATIVE S7 — capital-GL dual-run emitter backfill.
//
// ## Why
//
// S7 (#this PR) built the V2 capital GL posting engine
// (`platform/accounting/gl-posting-engine-v2-capital.ts`, PR-CAP-001-V2): it
// consumes the V1-primary `CapitalContributionRecorded` event and emits the
// V2-parallel `GlPostingEmitted` to the capital accounts (Dr ACC-1200-001 /
// Cr the contribution's COA capital account), so `platform/projections/ba700-v2.ts`
// can fold a non-zero BA-700 capital numerator. But nothing emits those V2
// postings at the V1 capital recognition site, so the `recon:ba700-v2-parity`
// capital-numerator comparison was VACUOUS.
//
// This script is the dual-run emitter: for every production
// `CapitalContributionRecorded` in the store that has NOT already been mirrored,
// it runs PR-CAP-001-V2 and appends the resulting V2 `GlPostingEmitted` legs.
// V1 stays AUTHORITATIVE throughout; both V1 and V2 co-exist. It does NOT flip
// the V1 capital type to v2-replaced — that is a separate gated CEO Decision
// once the capital numerator parity is byte-clean.
//
// ## Build-phase reality (honest no-op)
//
// Per the CLAUDE.md operating model, the bank is pre-licence: there is NO real
// capital — "No R300m sits anywhere; the figure is a target for licence-day."
// So on the current build store there are ZERO production
// `CapitalContributionRecorded` events, and this backfill is a NO-OP. That is
// the correct, honest state — NOT a concealment. The V2 capital engine + parity
// comparison are wired and proven; they activate automatically the moment a
// production capital contribution lands (a seeded simulation, or licence-day
// real capital). The parity gate PASSES-on-empty (Charter cmd 3) and reports the
// build-phase capital gap as an advisory observation, never a silent zero-fill.
//
// ## Idempotency / replay-safety
//
// Each emitted V2 GlPostingEmitted is tagged with the source V1 event id in a
// `bank:v1-source:<eventId>` provenance tag. Re-running scans for that tag and
// skips already-mirrored contributions. The idempotency key is the source V1
// event id (deterministic, replay-safe — equivalent to INSERT OR IGNORE keyed
// on the source event id), consistent with the S4 credit-limit and posture
// dual-run backfills.
//
// Run via:  bun run backfill:capital-gl-v2-dual-run   (from prototype/)
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-PHASE-3A (GlPostingEmitted; v2-parallel).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Citations:
//   Banks Act 94 of 1990 §70; Regulations Relating to Banks Reg 38;
//   BCBS Basel III §50–§90; IAS 32; IFRS 9 §3.1.1;
//   Principles/1-events-are-truth.md; Principles/2-single-graph-discipline.md.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../platform/composition";
import { isZero } from "../platform/core/decimal-money";
import { decodeMoney, moneyWireFromMinor } from "../platform/core/money-codec";
import { newEventId } from "../platform/core/types";
import { makeGlPostingEmitted } from "../platform/event-store/event-types/fx-accounting";
import type { ProvenanceTag } from "../platform/event-store/provenance";
import type { Actor, Event } from "../platform/event-store/types";
import { eventInOperatingBook } from "../platform/projections/filter";
import { ANCHOR_TENANT_ID } from "../v2-core/control-plane/tenant";
import type { TenantId } from "../v2-core/control-plane/tenant";

// ANCHOR_TENANT_ID is the literal "tenant:za-bank"; the V2 payload schema requires
// the branded TenantId. The value passes tenantIdSchema at runtime; the cast only
// widens the TS type at this boundary (same pattern as the credit-limit dual-run).
const ANCHOR_TENANT = ANCHOR_TENANT_ID as unknown as TenantId;

/** Tag prefix recording the source V1 event id on a backfilled V2 posting. */
const V1_SOURCE_TAG_PREFIX = "bank:v1-source:";

/** Settlement-cash leg of a capital injection (mirrors the V1 capital posting). */
const SETTLEMENT_CASH_ACCOUNT = "ACC-1200-001";

const ACTOR: Actor = {
  type: "service" as const,
  id: "agent:atlas:platform-architect",
};

const CITATIONS = [
  "Banks-Act-94-1990-s70",
  "RRB-Regulation-38",
  "BCBS-Basel-III-§50-§90",
  "IAS-32",
  "IFRS-9-§3.1.1",
  "D-V1-REMOVAL-PHASE-3A",
  "D-BANK-WIDE-V2-MIGRATION",
  "Principles/1-events-are-truth.md",
  "Principles/2-single-graph-discipline.md",
];

interface CapitalContributionRecordedPayload {
  readonly accountId?: string;
  readonly currency?: string;
  readonly amountMinor?: number;
  readonly basis?: string;
}

/** Collect the set of source-V1 event ids already mirrored to a V2 posting. */
function alreadyMirroredV1SourceIds(): Set<string> {
  const ids = new Set<string>();
  for (const e of eventStore.replay({ type: "GlPostingEmitted" })) {
    for (const tag of e.provenance?.tags ?? []) {
      if (tag.startsWith(V1_SOURCE_TAG_PREFIX)) {
        ids.add(tag.slice(V1_SOURCE_TAG_PREFIX.length));
      }
    }
  }
  return ids;
}

/**
 * Build the provenance tag for a backfilled V2 posting: clone the source V1
 * event's provenance and append the `bank:v1-source:<id>` idempotency tag.
 * Reusing the source tag keeps the V2 posting in the same provenance scope as
 * its V1 sibling, so the parity gate compares like-for-like.
 */
function v2ProvenanceFromSource(source: Event): ProvenanceTag {
  const base = source.provenance;
  if (base === undefined) {
    throw new Error(
      `backfill-capital-gl-v2-dual-run: source V1 event ${source.event_id} (${source.type}) has no provenance tag — cannot mirror to V2. The canonical store should have soft-tagged all rows. Inspect the store.`,
    );
  }
  const sourceTag = `${V1_SOURCE_TAG_PREFIX}${source.event_id}`;
  const tags = base.tags ? [...base.tags, sourceTag] : [sourceTag];
  return { ...base, tags };
}

interface BackfillEntry {
  readonly sourceV1EventId: string;
  readonly accountId: string;
  readonly status: "emitted" | "skipped-already-mirrored" | "skipped-malformed" | "skipped-zero";
}

function main(): void {
  const mirrored = alreadyMirroredV1SourceIds();
  const log: BackfillEntry[] = [];

  for (const e of eventStore.replay({ type: "CapitalContributionRecorded" })) {
    // Operating-book only — exclude scenario / simulated rehearsal events from the
    // production dual-run (defaultProvenanceFilter parity with the V1/V2 folds).
    if (!eventInOperatingBook(e)) continue;

    const p = e.payload as CapitalContributionRecordedPayload;
    const accountId = p.accountId ?? "(none)";

    if (mirrored.has(e.event_id)) {
      log.push({ sourceV1EventId: e.event_id, accountId, status: "skipped-already-mirrored" });
      continue;
    }
    if (!p.accountId || !p.currency || p.amountMinor === undefined) {
      log.push({ sourceV1EventId: e.event_id, accountId, status: "skipped-malformed" });
      continue;
    }

    const amount = moneyWireFromMinor(p.amountMinor, p.currency);
    if (isZero(decodeMoney(amount))) {
      log.push({ sourceV1EventId: e.event_id, accountId, status: "skipped-zero" });
      continue;
    }

    const postingDate = e.as_of.substring(0, 10);
    const provenance = v2ProvenanceFromSource(e);
    const iasRule =
      "IAS 32 / IFRS 9 §3.1.1 — recognition of a regulatory-capital contribution " +
      "(equity / qualifying-instrument credit; funded against settlement cash)";
    const description = `Capital contribution recognition ${p.currency}${p.basis ? ` (${p.basis})` : ""} (V2 dual-run)`;

    // Dr settlement cash (asset ↑) / Cr the contribution's COA capital account
    // (equity ↑) — the SAME account V1's fold credits, so the capital balance
    // byte-matches. The BA-700 capital fold (V1 and V2 alike) restricts to the
    // capital-classified subset, so an off-capital contribution still posts a
    // balanced pair (visible, never silently dropped) but moves no numerator.
    const debit = makeGlPostingEmitted({
      asOf: postingDate,
      entity: e.entity,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        creditDebit: "debit",
        accountCode: SETTLEMENT_CASH_ACCOUNT,
        amount,
        postingDate,
        tenantId: ANCHOR_TENANT,
        sourceEventId: e.event_id,
        iasRule,
        postingRuleId: "PR-CAP-001-V2",
        description,
      },
      eventId: newEventId(),
    });
    const credit = makeGlPostingEmitted({
      asOf: postingDate,
      entity: e.entity,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        creditDebit: "credit",
        accountCode: p.accountId,
        amount,
        postingDate,
        tenantId: ANCHOR_TENANT,
        sourceEventId: e.event_id,
        iasRule,
        postingRuleId: "PR-CAP-001-V2",
        description,
      },
      eventId: newEventId(),
    });
    eventStore.append({ ...debit, provenance });
    eventStore.append({ ...credit, provenance });
    log.push({
      sourceV1EventId: e.event_id,
      accountId: p.accountId,
      status: "emitted",
    });
  }

  const emitted = log.filter((l) => l.status === "emitted").length;
  const skipped = log.length - emitted;
  console.log(
    JSON.stringify(
      {
        ok: true,
        script: "backfill-capital-gl-v2-dual-run",
        contributionsMirrored: emitted,
        skipped,
        log,
        note:
          emitted === 0
            ? "No production CapitalContributionRecorded events — build-phase no-op (the bank holds no real capital pre-licence). The V2 capital engine + parity comparison activate automatically when a production contribution lands."
            : `Mirrored ${emitted} production capital contribution(s) into V2 GlPostingEmitted.`,
      },
      null,
      2,
    ),
  );
}

if (import.meta.main) {
  main();
}

export { main, V1_SOURCE_TAG_PREFIX };
