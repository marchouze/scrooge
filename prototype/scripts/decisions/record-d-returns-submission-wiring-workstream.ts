// scripts/decisions/record-d-returns-submission-wiring-workstream.ts
//
// Records D-RETURNS-SUBMISSION-WIRING-WORKSTREAM — Marc's in-session approval
// (2026-06-08) to commission the returns-submission-layer wiring workstream
// (WS-RETURNS-SUBMISSION-WIRING).
//
// ## Why this exists
//
// Vera's (Internal audit / continuous-assurance engineer, engineering)
// completeness-audit PoC (PR #1103, recon:completeness:inert-module-detection)
// proved that ALL seven returns period-close subscribers under
// `platform/returns/*/period-close-subscriber.ts` were built + tested but had
// ZERO non-test runtime/dashboard importer — the T1 "built-but-inert" taxon of
// D-COMPLETENESS-AUDIT-WORKSTREAM. Each was held on the
// KNOWN_INERT_PENDING_WIRING allowlist as a tracked finding.
//
// BA-310 (market / position risk — FX NOP) was wired in #1105
// (`runtime/agents/bea-ba310-period-close.ts`). This workstream addresses the
// remaining six (ba100, ba110, ba300, conduct, cms, climate) AND makes the
// inert-module gate self-cleaning so a wired-but-still-allowlisted module
// (the stale ba310 entry left behind by #1105) now FAILs.
//
// ## Disposition (this workstream)
//
// The workstream's governing rule (from the brief): only wire returns that are
// GENUINELY production-ready. A wired-but-hollow return (one whose generator is
// a stub fed by caller-supplied placeholders, or whose disclosure is
// hardcoded `status: "rehearsal"`, or whose correct SARB formId cannot yet be
// determined) is worse than an honest allowlist entry. Per that rule, after
// per-return readiness assessment, NONE of the six remaining returns is wired
// this run; each keeps its allowlist entry with a corrected, accurate blocker
// reason (see the inert-module-detection allowlist). The substantive deliverable
// is therefore: (a) de-allowlist the now-wired ba310 (stale entry), (b) correct
// the six remaining reasons to the true blocker, and (c) make the gate
// self-cleaning (FAIL on allowlisted-but-now-wired).
//
// ## Session-delegation
//
// Marc (CEO) approved in-session 2026-06-08 ("commission the returns-wiring
// workstream"); Scrooge (Chief of Staff) is the recording instrument
// (recordedVia: scrooge:session-delegation). Engineering execution by Mira
// (Compliance / RegTech engineer, engineering) with Bea (Accounting &
// financial reporting engineer, engineering) as period-close support.
//
// Idempotent: fixed asOf so re-runs (home store + CI fresh-store backfill)
// dedup on (decisionId, phase, as_of). NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-RETURNS-SUBMISSION-WIRING-WORKSTREAM";
const REQUESTED_ASOF = "2026-06-08T11:29:00.000Z";
const ASOF = "2026-06-08T11:30:00.000Z";

const TITLE = "Returns-submission-layer wiring workstream (wire the remaining inert SARB returns)";

const CITATIONS = [
  "D-COMPLETENESS-AUDIT-WORKSTREAM",
  "D-BA-RETURN-FORM-NUMBERING-RECON",
  // The completeness-audit spec — defines the T1 built-but-inert taxon and the
  // recon:completeness:* gate family this workstream extends.
  "docs/2026-06-08_vera_completeness-audit-workstream-spec.md",
];

// Open the decision lifecycle with a `requested` phase so the
// recon:decision-symmetry gate sees a symmetric chain (requested -> approved).
requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Commission WS-RETURNS-SUBMISSION-WIRING to wire the genuinely-ready " +
      "returns period-close subscribers into the AccountingPeriodClosed stream " +
      "and make recon:completeness:inert-module-detection self-cleaning.",
    rationale: "Approved in-session 2026-06-08; opens the decision lifecycle.",
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
    category: "governance",
    recommendation:
      "Wire only genuinely production-ready returns period-close subscribers " +
      "(replicating the BA-310 #1105 pattern: event-driven handler on " +
      "AccountingPeriodClosed → subscriber → SARB XML render → " +
      "SarbSubmissionAttempted{mode:'simulator'}, idempotent per form per " +
      "period); de-allowlist every wired return from KNOWN_INERT_PENDING_WIRING " +
      "in the SAME PR; and enhance recon:completeness:inert-module-detection " +
      "(Vera's gate) to be SELF-CLEANING — FAIL when an allowlisted module has " +
      "gained a runtime importer (allowlisted-but-now-wired = stale entry).",
    rationale:
      "Vera's completeness-audit PoC (#1103) proved all seven returns " +
      "period-close subscribers were built-but-inert (T1 taxon, " +
      "D-COMPLETENESS-AUDIT-WORKSTREAM). BA-310 was wired in #1105 but its " +
      "allowlist entry was left behind — a stale entry the un-self-cleaning " +
      "gate could not detect. The governing rule is honesty over coverage: a " +
      "wired-but-hollow return (stub-fed generator, hardcoded rehearsal status, " +
      "or unresolved formId) is worse than an honest allowlist entry, so only " +
      "genuinely-ready returns are wired and the rest keep accurate-reason " +
      "allowlist entries. Making the gate self-cleaning forces every future " +
      "wiring to de-allowlist, keeping the allowlist honest by construction.",
    citations: CITATIONS,
    followOnDispatch: [
      {
        route: "BA 110 daily-return vs LCR form-numbering reconciliation",
        note:
          "BA-110's submission cannot be cleanly formId'd: GG 35950 lists BA 110 " +
          "as the daily return (reg 29(3) FX-NOP attestation) while ba-110-lcr.* " +
          "treats it as LCR, and ba110ToXmlPayload currently emits the retired " +
          "formId 'BA325'. This is the open follow-on of " +
          "D-BA-RETURN-FORM-NUMBERING-RECON; BA-110 stays allowlisted until it " +
          "resolves (correct LCR form likely BA 610 family or BA 110 under " +
          "D5/2025).",
      },
      {
        route: "Stub-fed returns generators (BA-100 RWA, BA-300 gross income)",
        note:
          "BA-100's RWA decomposition is caller-supplied (TODO: wire from a " +
          "RwaComputed event) and BA-300's gross income is caller-supplied and " +
          "explicitly post-commencement-of-trading (3 audited fiscal years). " +
          "Wiring either would generate from placeholder inputs — kept " +
          "allowlisted until their real event feeds land.",
      },
      {
        route: "Rehearsal-status conduct/cms/climate disclosures",
        note:
          "conduct, cms, and climate disclosures are hardcoded " +
          "status:'rehearsal' scaffolding with placeholder feeds and no SARB XML " +
          "submission envelope (no *ToXmlPayload adapter). They are FSCA/TCFD/" +
          "GN5 disclosures, not SARB BA-form prudential returns submittable via " +
          "the SARB simulator. Kept allowlisted until promoted to a real " +
          "submission status with a defined channel.",
      },
    ],
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify({ ok: true, eventId: result.eventId, decisionId: DECISION_ID }, null, 2),
);
