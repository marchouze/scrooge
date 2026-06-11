// scripts/decisions/record-d-pa-source-extract-quality-remediation.ts
//
// Records D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION — Marc's in-session approval
// (2026-06-11) to review the SARB PA source corpus for extract quality and
// recover the best-available full text.
//
// ## Why this exists
//
// The WS-PA-REMEDIATION acquisition (May 24–25) created 87 directive/circular
// skeletons from the C1/2026 effective-list and backfilled only 38 with real
// `pdftotext` extraction. 64 of 121 PA `*-structured.json` artefacts remained
// thin skeletons — the worst carrying synthetic filler in place of operative
// text. The `regulatory-source-coverage` gate could not detect this (it checks
// sourceAcquired / extracted / obligationsLinked, not text quality), so a
// 94-line synthetic skeleton passed identically to a full directive.
//
// ## Scope (approved)
//
// 1. Full re-extract: recover best-available text for every recoverable PA
//    instrument (text-layer re-extraction + raw-txt re-promotion; URL discovery
//    for current directives). Mira (Compliance / RegTech engineer).
// 2. Quality gate: an enforcing `regulatory-source-extract-quality` recon gate
//    over the corpus, with a governed allowlist for genuinely-blocked sources.
// 3. OCR deferred: image-only scanned PDFs recorded as a tracked substrate gap
//    (GAP-PA-SOURCE-OCR), not built now.
//
// ## Session-delegation
//
// Marc (CEO) approved in-session 2026-06-11 (plan approval); Scrooge (Chief of
// Staff) is the recording instrument (recordedVia: scrooge:session-delegation).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION";
const REQUESTED_ASOF = "2026-06-11T17:30:00.000Z";
const ASOF = "2026-06-11T17:31:00.000Z";

const TITLE =
  "SARB PA source-extract quality remediation — re-extract poor-quality directives/guidance + enforcing quality gate";

const CITATIONS = ["D-REGULATORY-LIBRARY-V1", "D-PA-OBLIGATION-ADOPTION"];

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Review the entire PA source corpus for extract quality, recover the best-" +
      "available full text for every recoverable instrument, and add an enforcing " +
      "quality recon gate so thin/synthetic extracts can no longer pass silently.",
    rationale: "Opens the decision lifecycle (2026-06-11).",
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
      "Commission WS-PA-SOURCE-QUALITY: (1) deterministic extract-quality scorer + " +
      "audit register over the PA corpus; (2) re-extract recoverable poor-quality " +
      "sources (text-layer re-extraction, raw-txt re-promotion, URL discovery for " +
      "current directives); (3) enforcing `regulatory-source-extract-quality` recon " +
      "gate with a governed allowlist; (4) defer OCR for image-only scans as a " +
      "tracked substrate gap (GAP-PA-SOURCE-OCR).",
    rationale:
      "Marc approved in-session 2026-06-11. 64 of 121 PA structured artefacts were " +
      "thin skeletons (the worst synthetic boilerplate) and the source-coverage gate " +
      "could not detect it. Recovered 8 instruments to best-available quality " +
      "(d10-2015, d12/d13/d14-2025, gn3-2017, gn4-2016, gn5-2013, c3-2020); the " +
      "residual poor set is image-only scans (OCR-deferred) or has no published URL, " +
      "now governed by an enforcing quality gate. Honest source text is a precondition " +
      "for the Regulation→Provision→Obligation chain to bind on real PA requirements.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify({
    ok: !!result.eventId,
    decisionId: DECISION_ID,
    eventId: result.eventId,
    phase: "approved",
    msg: result.eventId
      ? `${DECISION_ID} recorded (approved)`
      : `${DECISION_ID} record FAILED — no eventId returned`,
  }),
);

if (!result.eventId) process.exit(1);
