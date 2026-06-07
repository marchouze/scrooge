// scripts/record-d-fx-nop-sla-citation-d5-migration.ts
//
// Records D-FX-NOP-SLA-CITATION-D5-MIGRATION — Marc's in-session approval
// (2026-06-07) of the replay-safe correction of the FX net-open-position (NOP)
// SLA memorandum's return-form attribution.
//
// ─── The finding ────────────────────────────────────────────────────────────
// The FX-NOP SLA memorandum rules (platform/accounting/sla/rules/pr-fx-001-ba.ts,
// pr-fx-001-ba-v2.ts, pr-fx-ba-lifecycle.ts) + COA ACC-9000-001/-002 + the SLA
// resolver labelled the FX NOP as SARB "BA 350". That is a form-number error.
//
// VERIFIED against authoritative in-corpus sources (no guess):
//   - Regulations relating to Banks (RRB), structured source
//     Regulations/SARB-PA/source-docs/rrb-structured.json: Regulation 29 =
//     "Daily return: selected risk exposure arising from trading and treasury
//     activities (Form BA 325)" — this is the daily trading/treasury return that
//     carries the FX effective net-open-position attestation under reg 29(3).
//     Regulation 32 = "Derivative instruments ... (Form BA 350)" — BA 350 is the
//     derivative-instruments return, NOT the NOP.
//   - D5/2025 structured source Regulations/Banks/source-docs/
//     banks-d5-2025-structured.json §2.1.14 lists form BA 325; §2.1.17 lists form
//     BA 350 as the credit-concentration return. (D5/2025 lists forms by number
//     only; it does not itself map reg 29(3) → a form, so the RRB reg-29 title is
//     the authoritative form mapping.)
//   - Regulations/_obligations-register.md v1.40 (D-BA-330-REATTRIBUTION-IRRBB,
//     this author, 2026-06-07): "BA 325 = Daily return: selected risk exposure
//     from trading and treasury activities — carries the FX effective net open
//     position attestation under regulation 29(3); ... The FX net open position
//     return is BA 320 (with the daily NOP attestation on BA 325 / reg 29(3)),
//     NOT BA 350 and NOT BA 330."
// CONCLUSION (high confidence): the FX effective NOP attestation (reg 29(3)) is
// carried on form BA 325. The premise "under D5/2025 there is no BA 350" is
// itself incorrect — BA 350 exists in D5/2025 (§2.1.17), but it is the
// credit-concentration return, not the NOP. Either way the NOP form is BA 325.
//
// ─── Replay-safe scope (Principle 1) ────────────────────────────────────────
// Step 2 (DONE in this PR): corrected human-facing LABELS only — file/inline
//   comments + the SLA resolver row `note` + COA comments — from "BA 350" to
//   "BA 325 (reg 29(3))". Zero replay impact.
// Step 3 (DEFERRED): the opaque citation URN `urn:obligation:sarb:ba350:nop` and
//   the hash-relevant `condition.detail` strings are LEFT UNCHANGED. They are
//   replay-sensitive: the URN is embedded verbatim in already-emitted
//   SlaRuleApproved + Decision events (15 in the production store on 2026-06-07),
//   and the four-eyes interpreter-eligibility hash (approval.ts ruleContentHash)
//   INCLUDES both `cites` and `condition` — so editing either on these in-force,
//   production-active SARB-BA-RETURN rules would change the content hash, break
//   the existing four-eyes approval, and silently DE-ACTIVATE the live SARB-BA-
//   RETURN posting path. The forward-only migration to
//   `urn:obligation:sarb:ba325:nop` is therefore a dedicated supersession +
//   re-approval ceremony (supersede() each rule to a new version with the new
//   URN, retain the old version window-closed so historical reproduce-as-of still
//   resolves the old URN, re-publish (Bea) + re-approve (Camille, four-eyes)),
//   executed under Bea's SLA-engine ownership — not forced in this label pass.
//   NO already-emitted event or URN is rewritten in place; replay is intact.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-07; Scrooge is the
// recording instrument (recordedVia: scrooge:session-delegation). Category
// engineering (decision-authority routing: engineering build decisions =
// CEO/build-phase).
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill) dedup
// on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument; work
//   executed by Mira (Compliance / RegTech engineer) under Zara (Chief Compliance
//   Officer, governance), with domain co-owners Eitan (Treasurer, governance) —
//   reg 29(3) NOP subject-matter — and Bea (Accounting & financial reporting
//   engineer, engineering) under Camille (Chief Financial Officer, finance).

import "../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-07T14:19:00.000Z";
const ASOF = "2026-06-07T14:20:00.000Z";

const DECISION_ID = "D-FX-NOP-SLA-CITATION-D5-MIGRATION";

const TITLE =
  "FX-NOP SLA citation — replay-safe D5/2025 form re-label (BA 350 → BA 325, reg 29(3))";

const CITATIONS = [
  // The canonical return-form schedule decision this one builds on.
  "D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025",
  // Principle 1 — events are the only source of truth (replay-safety basis).
  "Principles/1-events-are-truth.md",
  // Principle 2 — single-graph / citation discipline.
  "Principles/2-single-graph-discipline.md",
];

const RECOMMENDATION =
  "Correct the FX net-open-position (NOP) SLA memorandum's return-form " +
  "attribution from SARB 'BA 350' to 'BA 325' (the daily trading/treasury " +
  "selected-risk return carrying the reg 29(3) effective-NOP attestation, per " +
  "RRB reg 29 and D5/2025 §2.1.14), REPLAY-SAFELY: (Step 2) fix human-facing " +
  "labels/comments only — in pr-fx-001-ba.ts, pr-fx-001-ba-v2.ts, " +
  "pr-fx-ba-lifecycle.ts, coa-registry ACC-9000, and the SLA resolver; (Step 3, " +
  "DEFERRED) the opaque citation URN urn:obligation:sarb:ba350:nop and the " +
  "hash-relevant condition.detail strings are left UNCHANGED and the forward-only " +
  "migration to urn:obligation:sarb:ba325:nop (supersede new versions, retain old " +
  "versions resolvable, re-publish + four-eyes re-approve) is deferred to a " +
  "dedicated supersession run under Bea (Accounting & financial reporting " +
  "engineer)'s SLA-engine ownership + Camille (CFO) re-approval.";

const RATIONALE =
  "VERIFIED, not guessed: RRB structured source (rrb-structured.json) gives " +
  "Regulation 29 = 'Daily return: selected risk exposure arising from trading and " +
  "treasury activities (Form BA 325)' — the form carrying the reg 29(3) FX " +
  "effective-NOP attestation; Regulation 32 = derivative instruments (Form BA 350). " +
  "D5/2025 §2.1.14 lists BA 325 and §2.1.17 lists BA 350 (credit-concentration " +
  "return). The obligations register v1.40 (D-BA-330-REATTRIBUTION-IRRBB) records " +
  "the same determination. Confidence: high. REPLAY-SAFETY (Principle 1): the " +
  "URN urn:obligation:sarb:ba350:nop is embedded in already-emitted SlaRuleApproved " +
  "+ Decision events and is part of the four-eyes content hash (approval.ts " +
  "ruleContentHash includes cites + condition); editing it in place on the in-force " +
  "production-active SARB-BA-RETURN rules would break the four-eyes approval and " +
  "silently de-activate the live SARB posting path. Therefore only zero-replay " +
  "labels are corrected now; the forward-only URN supersession (which retains the " +
  "old URN resolvable for historical reproduce-as-of and never rewrites any emitted " +
  "event) is deferred to its own re-publish + re-approval ceremony. Plan approved " +
  "in-session 2026-06-07.";

// Open the decision lifecycle with a `requested` phase one minute earlier so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Plan approved in-session 2026-06-07; opens the decision lifecycle.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    followOnDispatch: [
      {
        route:
          "FX-NOP SLA forward-only URN supersession (urn:obligation:sarb:ba350:nop → ba325:nop)",
        note:
          "DEFERRED Step 3. supersede() PR-FX-001-BA (and the lifecycle/cancel rules) to a " +
          "NEW version whose cites use urn:obligation:sarb:ba325:nop, abutting the in-force " +
          "window; retain the prior version window-closed so historical reproduce-as-of still " +
          "resolves the old URN; re-publish (Bea) + four-eyes re-approve (Camille) each new " +
          "version so it stays interpreter-eligible. Record the supersession mapping " +
          "ba350:nop → ba325:nop in the citation graph once SARB return-form obligation nodes " +
          "exist (none today). NEVER rewrite an already-emitted event or URN in place.",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      decisionId: DECISION_ID,
    },
    null,
    2,
  ),
);
