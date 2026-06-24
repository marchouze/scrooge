// platform/recon/fil-provenance-explicit.ts
//
// D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN — FIL provenance fail-closed harden
// tail (sequenced under D-FX-INSTRUMENT-BUYSELL-QUAD, WS-FX-FIL-INTEGRITY Slice B).
//
// ─── THE RULE THIS GUARDS ───────────────────────────────────────────────────
// Every FIL instrument / settlement event in the local event store
// (FilInstrumentCreated/Amended/Terminated, FilFxSettlementConfirmed,
// FilNdfFixingObserved, TradeSettlementExecuted) MUST carry an EXPLICIT
// provenance tag — a concrete originating-system `sourceLineage`, NOT the
// substrate soft-default.
//
// ─── WHY (root cause) ───────────────────────────────────────────────────────
// FIL event types are POLYMORPHIC carriers: the same type carries real anchor-
// book capital, real build-phase fixtures, AND scenario stimuli. They map to
// category `governance` → `production` under the default policy, so an UNTAGGED
// FIL append soft-defaults to `production` — fail-OPEN. A throwaway fixture
// silently becomes production state (the 2026-06-22 mis-tagged-FX-fixture
// incident). The emit boundary now fails closed (`assertExplicitFilProvenance`
// in the FIL `make*` helpers); this recon gate is the retrospective backstop —
// it catches any FIL event that reached the store WITHOUT an explicit tag
// (a migration bypassing `append()`, an un-migrated emitter, a synced upstream).
//
// ─── SCOPE ──────────────────────────────────────────────────────────────────
// FIL-SCOPED and biting NOW — independent of the global
// `BANK_PROVENANCE_SUBSTRATE_ACTIVE` gate (which stays OFF; the build-phase
// soft-tag default remains the default for every NON-FIL event). The
// "soft-default lineage" predicate (`isSoftDefaultLineage`) is shared with the
// emit-time assertion so the gate and the boundary cannot drift.
//
// Severity: `fail`. A FIL event resting on the fail-open soft-default is a P1
// audit-integrity risk (production vs fixture vs simulated must be unambiguous)
// and must block CI.
//
// Author: Atlas (Core banking platform architect, engineering — substrate).

import { eventStore } from "../composition";
import {
  FIL_PROVENANCE_REQUIRED_EVENT_TYPES,
  isSoftDefaultLineage,
} from "../event-store/provenance";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:fil-provenance-explicit";

export interface FilEventProvenanceRow {
  readonly eventId: string;
  readonly type: string;
  /** The provenance kind, or `null` when the event carries NO tag at all. */
  readonly kind: string | null;
  /** The provenance sourceLineage, or `null` when untagged. */
  readonly sourceLineage: string | null;
}

/**
 * Pure verdict over a set of FIL event provenance rows. Exposed for the
 * regression test (which feeds synthetic rows incl. an UNTAGGED one).
 *
 * A row is a violation iff it is UNTAGGED (no provenance at all) OR its
 * `sourceLineage` is a substrate soft-default (`isSoftDefaultLineage`) — i.e.
 * it rests on the category fail-open instead of an explicit emit.
 */
export function evaluateFilProvenanceRows(rows: readonly FilEventProvenanceRow[]): {
  asserted: number;
  violations: ReconViolation[];
} {
  const violations: ReconViolation[] = [];
  for (const row of rows) {
    if (row.sourceLineage === null || row.kind === null) {
      violations.push({
        subject: `${row.type}:${row.eventId}`,
        message:
          "FIL event carries NO provenance tag — every FIL instrument/settlement event must carry an " +
          "EXPLICIT provenance tag (D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN). Emit via the FIL make* " +
          "helpers, which fail closed at the boundary.",
        severity: "fail",
      });
      continue;
    }
    if (isSoftDefaultLineage(row.sourceLineage)) {
      violations.push({
        subject: `${row.type}:${row.eventId}`,
        message: `FIL event rests on a substrate soft-default provenance lineage ("${row.sourceLineage}") — this is the category fail-open (governance→production) for a polymorphic FIL carrier, not an explicit tag. Resolve via provenanceForEmit(<type>, { sourceLineage: <originating-system> }) at the SUT call-site, or an explicit fixture/simulated tag (scripts / scenarios). Authority: D-FX-FIXTURE-PROVENANCE-CANCEL-AND-HARDEN.`,
        severity: "fail",
      });
    }
  }
  return { asserted: rows.length, violations };
}

/** Collect the FIL event provenance rows from the live event store. */
function collectFilEventRows(): FilEventProvenanceRow[] {
  const rows: FilEventProvenanceRow[] = [];
  for (const type of FIL_PROVENANCE_REQUIRED_EVENT_TYPES) {
    for (const e of eventStore.replay({ type })) {
      const tag = e.provenance;
      rows.push({
        eventId: e.event_id,
        type: e.type,
        kind: tag?.kind ?? null,
        sourceLineage: tag?.sourceLineage ?? null,
      });
    }
  }
  return rows;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const { asserted, violations } = evaluateFilProvenanceRows(collectFilEventRows());
  result.asserted = asserted;
  result.violations = violations;
  result.ok = violations.length === 0;
  return result;
}

if (import.meta.main) {
  const r = run();
  if (r.ok) {
    process.stdout.write(
      `${PIPELINE}: ok — asserted ${r.asserted} FIL event(s) carry an explicit provenance tag\n`,
    );
    process.exit(0);
  }
  process.stderr.write(`${PIPELINE}: FAIL\n`);
  for (const v of r.violations) {
    process.stderr.write(`  [${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.exit(1);
}
