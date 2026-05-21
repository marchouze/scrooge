// scripts/record-d-rms-documents-fresh-runner-downgrade-retire.ts
//
// One-shot Decision-event emit:
// D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE.
//
// Records the retirement of the fresh-runner empty-store carve-out in
// `recon:rms-documents-parity` (the `if (zero RecordFiled events) →
// downgrade all violations to warn` branch). With the eight historical
// post-Phase-3 RecordFiled(documents) events backfilled in the same PR
// (see `scripts/migrate/backfill-recordfiled-documents-2026-05-17.ts`
// wired into `migrate:decisions-backfill`), the carve-out no longer
// shields any genuine gap — it only masks regressions on fresh runners.
//
// Authority: CoSec — Owen (Company Secretary, governance) per the
// CLAUDE.md decision-authority routing table ("Governance / procedure
// register" → CoSec; the recon gate enforces a register-integrity
// invariant on the Documents register). Recorded via CEO session-
// delegation: Marc approved the backfill + retire in chat with
// Scrooge on 2026-05-21 (per CLAUDE.md "Session delegation",
// `authorityRef` is `marc@tgv.co.za` and `recordedVia` is
// `scrooge:session-delegation`).
//
// Author: Atlas (Core banking platform architect, engineering)
// Brief:  brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21

import { eventStore } from "../platform/composition";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../projections/decisions";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const DECISION_ID = "D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE";

const TITLE =
  "Retire `recon:rms-documents-parity` fresh-runner empty-store downgrade carve-out";
const CATEGORY = "governance" as const;
const RECOMMENDATION =
  "Remove the `if (totalRecordFiledDocumentsEvents === 0) → downgrade all violations to warn` branch in `prototype/platform/recon/rms-documents-parity.ts`. With the 8 historical post-Phase-3 RecordFiled(documents) events backfilled via `scripts/migrate/backfill-recordfiled-documents-2026-05-17.ts` (wired into `migrate:decisions-backfill`), every fresh runner now hydrates a non-empty Documents register before recon runs. Post-Phase-3 files without a matching RecordFiled event remain `fail`; pre-Phase-3 files remain `warn` (historical gap expected). Empty-store posture no longer needs special handling.";
const RATIONALE =
  "The empty-store downgrade was a soft-tagger built when the RecordFiled(documents) event stream was still incomplete (zero events on a fresh runner = 'we have not yet backfilled, do not break CI'). PR #650 exposed the trap: emitting one RecordFiled(documents) event from a per-deliverable `file-*` script flipped the empty-store check off and reclassified 8 pre-existing historical files from `warn` to `fail`. The fix lands the backfill (so the events are present on every runner) and retires the carve-out (so the recon enforces Principle 1 cleanly without depending on store-population accidents). Authority sits with CoSec per CLAUDE.md routing ('Governance / procedure register'); Marc approved the routing in-session 2026-05-21.";
const CITATIONS = [
  "D-RMS-PHASE-3",
  "D-RMS-PHASE-2-3-ACCELERATE",
  "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
] as const;

// Deterministic timestamps so the event store hashes the same on every CI
// run. The `requested` and `approved` events sit at distinct timestamps on
// 2026-05-21 — the brief-issue moment and the in-session approval moment
// per CLAUDE.md "Session delegation".
const REQUESTED_AT = "2026-05-21T07:00:00.000Z";
const APPROVED_AT = "2026-05-21T07:30:00.000Z";

const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
const history = register.byId.get(DECISION_ID);
const alreadyRequested = !!history?.events.some((e) => e.phase === "requested");
const alreadyApproved = !!history?.events.some((e) => e.phase === "approved");

const emitted: { phase: string; eventId: string }[] = [];

if (!alreadyRequested) {
  const r = requestDecision(
    {
      decisionId: DECISION_ID,
      authority: "CoSec",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    REQUESTED_AT,
  );
  emitted.push({ phase: "requested", eventId: r.eventId });
}

if (!alreadyApproved) {
  const a = recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CoSec",
      authorityRef: "marc@tgv.co.za",
      title: TITLE,
      category: CATEGORY,
      recommendation: RECOMMENDATION,
      rationale: RATIONALE,
      sourceDocHashes: [],
      citations: [...CITATIONS],
      recordedVia: "scrooge:session-delegation",
    },
    APPROVED_AT,
  );
  emitted.push({ phase: "approved", eventId: a.eventId });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? `${DECISION_ID}: already requested + approved — skip`
          : `${DECISION_ID}: emitted ${emitted.length} phase event(s)`,
      emitted,
    },
    null,
    2,
  ),
);
