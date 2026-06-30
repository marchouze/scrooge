// scripts/record-d-ba-return-fail-safe-residual-exposure.ts
//
// Records D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE — Marc's in-session steer
// (2026-06-30) correcting the fail-closed-to-BLANK behaviour shipped in #1620
// (the BA 100 foldCashLegs() left settled FX cash unplaced whenever the cash
// instrument lacked cashTerms.counterpartyClass, hiding ~R490m of settled cash on
// the live BA 100 — a headline/detail divergence that reads as a control failure).
// The correct posture is fail-SAFE: expose the resolved amount at the coarsest
// level that can be resolved, and treat the missing granular sub-allocation as
// FLAGGED substrate-development work, never grounds to hide the money. This
// SHARPENS D-BA-RETURN-CAPABILITY-FIRST rather than reversing it — the blank was
// never meant to swallow a resolvable total.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants so the ci:migrate
// replay is byte-stable. Scrooge is the recording instrument (recordedVia:
// scrooge:session-delegation); Marc is the authorizing principal. Engineering
// build decision in the build phase → CEO authority, `engineering` category.
//
// Authority: CLAUDE.md §"Session delegation"; D-BA-RETURN-CAPABILITY-FIRST;
//   D-BA-RETURN-CELL-VALUE-ENGINE; D-ENGINEERING-INTEGRITY-CHARTER (no green by
//   concealment; fail-closed-not-blank); Principle 1.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";
const REQUESTED = "2026-06-30T06:10:00.000Z";
const APPROVED = "2026-06-30T06:15:00.000Z";
const base = {
  decisionId: "D-BA-RETURN-FAIL-SAFE-RESIDUAL-EXPOSURE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "BA returns: fail-SAFE residual exposure (never blank a resolved amount) + reconcile-to-GL parallel derivation + formula/value toggle",
  category: "engineering" as const,
  recommendation:
    "Three binding rules for the BA-return per-cell value engine. (1) PARALLEL DERIVATION, NOT A GL FOLD: a BA return is derived independently from the event log and must RECONCILE to the GL trial balance — the GL is the reconciliation oracle, not the source. (2) FAIL-SAFE RESIDUAL EXPOSURE — money must never disappear from the balance sheet. When a trade has settled and the residual is cash (or any amount that IS resolvable at an aggregate/headline level), populate it at the coarsest level that can be resolved. Only the GRANULAR SUB-ALLOCATION may be withheld when it cannot yet be sourced — and when it is withheld, the resolved headline amount still stands and the missing granularity is FLAGGED IMMEDIATELY for substrate development (a prominent capability-backlog item, not a passive register entry). 'Fail-closed' means never FABRICATE a granular allocation you cannot support; it does NOT license dropping a total you can. Leaving a settled residual unplaced (the #1620 foldCashLegs behaviour) is the dangerous anti-pattern this corrects: it created a ~R490m divergence between the BA 100 headline TOTAL ASSETS and the placed detail rows. (3) DISPLAY TOGGLE — every BA form carries a per-cell toggle that switches the grid between VALUE mode (the numeric figure) and FORMULA/CRITERIA mode (the derivation expression, data requirements, and citation that populate the cell). Start with BA 100. Keep it readable — formula mode must not force wide columns; use a row-oriented / wrapped layout rather than cramming prose into the narrow C0010–C0070 grid.",
  rationale:
    "Marc (CEO) steer 2026-06-30, reviewing the live BA 100 after #1620. The fail-closed-to-blank rule shipped in #1620 makes settled FX cash invisible in the detail rows whenever the legacy cash instrument lacks the new counterpartyClass dimension — ~R490m of real (simulated-provenance) settled cash showed only in the oracle-derived TOTAL ASSETS headline, not in any line item. On a balance sheet that is more dangerous than a coarse presentation: conservation of the balance sheet is paramount; an unexplained headline/detail gap reads as a control failure. The correct posture is fail-SAFE: expose the resolved amount at the level you can (cash is an asset with a ZAR value), and treat the missing banks-vs-customers sub-allocation as flagged substrate-development work, not grounds to hide the money. This sharpens D-BA-RETURN-CAPABILITY-FIRST rather than reversing it — the blank was never meant to swallow a resolvable total. The formula/value toggle makes each cell's derivation auditable in place.",
  sourceDocHashes: [],
  citations: [
    "D-BA-RETURN-CAPABILITY-FIRST",
    "D-BA-RETURN-CELL-VALUE-ENGINE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation",
};
requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
