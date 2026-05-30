/**
 * Seed-period orphaned-posting remediation — period 2026-05-SEED.
 *
 * Scrooge-coordinated in-session run attributed to:
 *   Atlas (Core banking platform architect, engineering)
 *
 * Brief: brief:atlas:wire-seed-period-gl-posting-rules-to-canonical-e:2026-05-30
 * Run:   run:atlas:2026-05-30T06-04-10-280Z
 *
 * Authority: PROC-FIN-BSS-01 §3a; FIN-BSS-01; Principles/1-events-are-truth.md;
 *   SubstrateAlert alert:integrity:bss-posting-noncanonical-source-ids (875c84c6).
 *
 * ---------------------------------------------------------------------------
 * Problem
 * ---------------------------------------------------------------------------
 * Balance sheet substantiation (BalanceSheetSubstantiationCompleted 7175ebcb)
 * found SubLedgerPostingEmitted postings whose `sourceEventId` does not resolve
 * to any event in the store. Root cause established by audit:
 *   - The LIVE gl-posting-engine.ts already sets sourceEventId = event.event_id
 *     correctly — the production path is sound.
 *   - The orphans are build-phase-fixture / pre-substrate-backfill postings
 *     whose triggering primary events (sim-trade-* FxTradeExecuted, UUID
 *     FxSettlement*) were RETIRED in prior seed-trade-retirement /
 *     test-run-1-pollution cleanup sessions. Every distinct phantom source id
 *     is truly absent from the store under any type.
 *
 * ---------------------------------------------------------------------------
 * Remediation (append-only — Principle 1; NEVER delete events)
 * ---------------------------------------------------------------------------
 * The underlying trades were retired, so their GL contribution is no longer
 * substantiated and must be reversed out — the consistent state is "retired
 * trade ⇒ reversed GL". Each orphan posting is independently double-entry
 * balanced, so its reversal is also balanced and the trial balance stays
 * balanced after remediation.
 *
 *   1. Emit ONE SubLedgerPostingRemediationRecorded anchor event enumerating
 *      every distinct retired source-event-id (no silent cap) + the tallies.
 *   2. For each orphan posting, emit ONE balanced reversal SubLedgerPostingEmitted
 *      (postingType=duplicate-reversal-correction) that swaps debit/credit on
 *      every leg, with:
 *        - sourceEventId  = the remediation anchor event_id (canonical, resolves)
 *        - correctsEventId = the orphan posting's event_id (names what it reverses)
 *        - reversalOfSourceEventId = the retired phantom source id (audit trail)
 *      tagged provenance build-phase-fixture / sourceLineage seed-orphan-remediation.
 *
 * Idempotency: the script is a no-op if a SubLedgerPostingRemediationRecorded
 * for remediationId already exists.
 */

import { eventStore as _eventStore } from "../platform/composition.ts";
import { makeSubLedgerPostingRemediationRecorded } from "../platform/event-store/event-types/accounting.ts";
import { makeSubLedgerPostingEmitted } from "../platform/event-store/event-types/fx-accounting.ts";
import type { SubLedgerLeg } from "../platform/event-store/event-types/fx-accounting.ts";
import type { EventStore } from "../platform/event-store/store.ts";
import type { Event } from "../platform/event-store/types.ts";

const eventStore = _eventStore as unknown as EventStore;

const REMEDIATION_ID = "remediation:2026-05-SEED:orphan-posting-source-ids:v1";
const PERIOD_ID = "2026-05-SEED";
const ENTITY = "LE-ZA-HOZ-BANK";
const SURFACING_ALERT_EVENT_ID = "875c84c6"; // SubstrateAlert (short ref recorded by Bea)
const ANCHOR_AS_OF = new Date().toISOString();

// ---------------------------------------------------------------------------
// 1. Index the store + collect orphan postings.
// ---------------------------------------------------------------------------

const eventIds = new Set<string>();
for (const e of eventStore.replay({})) eventIds.add(e.event_id);

// Idempotency guard.
for (const e of eventStore.replay({ type: "SubLedgerPostingRemediationRecorded" })) {
  const p = e.payload as { remediationId?: string };
  if (p.remediationId === REMEDIATION_ID) {
    console.log(`Remediation ${REMEDIATION_ID} already recorded (event ${e.event_id}). No-op.`);
    process.exit(0);
  }
}

interface OrphanPosting {
  readonly eventId: string;
  readonly asOf: string;
  readonly entity: string;
  readonly citations: string[];
  readonly sourceEventId: string;
  readonly postingType: string;
  readonly legs: SubLedgerLeg[];
}

const orphans: OrphanPosting[] = [];
for (const e of eventStore.replay({ type: "SubLedgerPostingEmitted" })) {
  const p = e.payload as {
    sourceEventId?: string;
    postingType: string;
    legs: SubLedgerLeg[];
  };
  const src = p.sourceEventId;
  if (!src || eventIds.has(src)) continue;
  // Skip postings already produced by a prior remediation run (defensive).
  if (p.postingType === "duplicate-reversal-correction") continue;
  orphans.push({
    eventId: e.event_id,
    asOf: e.as_of,
    entity: e.entity ?? ENTITY,
    citations: (e.citations as string[]) ?? [],
    sourceEventId: src,
    postingType: p.postingType,
    legs: p.legs,
  });
}

const distinctSourceIds = [...new Set(orphans.map((o) => o.sourceEventId))].sort();

console.log("=== SEED ORPHAN-POSTING REMEDIATION ===");
console.log(`  Orphan postings:           ${orphans.length}`);
console.log(`  Distinct retired src IDs:  ${distinctSourceIds.length}`);

if (orphans.length === 0) {
  console.log("  No orphans found — nothing to remediate.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Emit the remediation anchor event FIRST (so reversals can reference it).
// ---------------------------------------------------------------------------

const REMEDIATION_PROVENANCE: Event["provenance"] = {
  kind: "build-phase-fixture",
  sourceLineage: "seed-orphan-remediation",
};

const anchorEvent = makeSubLedgerPostingRemediationRecorded({
  asOf: ANCHOR_AS_OF,
  entity: ENTITY,
  actor: { type: "system", id: "agent:atlas:seed-orphan-remediation" },
  citations: ["PROC-FIN-BSS-01", "FIN-BSS-01", "IAS-8"],
  provenance: REMEDIATION_PROVENANCE,
  payload: {
    remediationId: REMEDIATION_ID,
    periodId: PERIOD_ID,
    surfacingAlertEventId: SURFACING_ALERT_EVENT_ID,
    remediatedSourceEventIds: distinctSourceIds,
    orphanPostingCount: orphans.length,
    reversalPostingCount: orphans.length,
    rationale:
      "Orphaned SubLedgerPostingEmitted fixtures whose triggering primary events " +
      "(sim-trade-* FxTradeExecuted, UUID FxSettlement*) were retired in prior " +
      "seed-trade-retirement / test-run-1-pollution cleanup sessions. The LIVE " +
      "gl-posting-engine sets sourceEventId = event.event_id correctly; this is a " +
      "historical build-phase-fixture residue, not a production-path bug. Each " +
      "orphan is reversed by a balanced append-only duplicate-reversal-correction " +
      "posting anchored to this record. Retired trade ⇒ reversed GL: the consistent " +
      "state. Trial balance remains double-entry balanced (each reversal is balanced).",
  },
});

eventStore.append(anchorEvent);
console.log(`  Anchor event emitted:      ${anchorEvent.event_id}`);

// ---------------------------------------------------------------------------
// 3. Emit one balanced reversal posting per orphan.
// ---------------------------------------------------------------------------

let reversed = 0;
for (const o of orphans) {
  const reversedLegs: SubLedgerLeg[] = o.legs.map((l) => ({
    ...l,
    debitCredit: l.debitCredit === "debit" ? "credit" : "debit",
  }));

  const reversal = makeSubLedgerPostingEmitted({
    asOf: ANCHOR_AS_OF,
    entity: o.entity,
    actor: { type: "system", id: "agent:atlas:seed-orphan-remediation" },
    citations: o.citations.length > 0 ? o.citations : ["PROC-FIN-BSS-01", "FIN-BSS-01"],
    provenance: REMEDIATION_PROVENANCE,
    payload: {
      // Canonical source: the remediation anchor (resolves in the store).
      sourceEventId: anchorEvent.event_id,
      postingType: "duplicate-reversal-correction",
      legs: reversedLegs,
      postedAt: ANCHOR_AS_OF,
      // Audit-trail passthrough (schema is .passthrough()).
      correctsEventId: o.eventId,
      reversalOfSourceEventId: o.sourceEventId,
      remediationId: REMEDIATION_ID,
    } as unknown as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
  });

  eventStore.append(reversal);
  reversed++;
}

console.log(`  Reversal postings emitted: ${reversed}`);
console.log("\n✓ Seed orphan-posting remediation complete.");
console.log(`  remediationId: ${REMEDIATION_ID}`);
console.log(`  anchor:        ${anchorEvent.event_id}`);
console.log(`  reversed:      ${reversed} orphan postings (balanced; TB unchanged in balance)`);
