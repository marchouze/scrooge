// scripts/decisions/record-d-pa-source-extract-recovery-wave-2.ts
//
// Records D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2 — Marc's in-session approval
// (2026-06-12) to re-extract a residual set of poorly-extracted PA instruments
// from their now-confirmed SARB DAM PDFs, and to tighten the extract-quality
// recon gate so the "table-cell-as-heading / thin-form" extraction class can no
// longer pass silently.
//
// ## Why this exists
//
// Wave 1 (PR #1268, 2026-06-12) recovered the 22 instruments that were on the
// POOR_QUALITY_ALLOWLIST (no-public-url) once their PDFs were confirmed live on
// the SARB DAM. A follow-up scan surfaced a second class the quality gate misses:
// instruments whose structured.json is NOT allowlisted and scores just above the
// "poor" threshold, but whose extraction is in fact mangled (annexure/form table
// cells flattened into section-heading fragments — e.g. D2/2014) or thin
// (1–4 KB of body text, generic Introduction/Application/Acknowledgement headings).
// The reader serves the JSON, so these render as broken/empty to the user.
//
// ## Scope (approved)
//
//  Set (8): banks-d2-2014 (mangled rating-system-change form), banks-d2-2015,
//  banks-d5-2011, banks-d5-2016, banks-d7-2016, banks-d8-2016, banks-d9-2021,
//  banks-c2-2018 — all with real PDFs confirmed live on the SARB DAM.
//
//  1. Re-extract all 8 from their DAM PDFs (acquire:source + extract:structured),
//     retaining the raw PDF in source-docs (Wave-1 convention).
//  2. Tighten `regulatory-source-extract-quality`: add a detector for the
//     table-cell-as-heading / thin-form extraction class so it fails CI rather
//     than slipping through above the tier threshold.
//
// ## Session-delegation
//
// Marc (CEO) approved in-session 2026-06-12 (AskUserQuestion: scope = "D2/2014 +
// the ~6-8 poor ones"; gate = "Yes, add the detector"). Scrooge (Chief of Staff)
// is the recording instrument (recordedVia: scrooge:session-delegation).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-PA-SOURCE-EXTRACT-RECOVERY-WAVE-2";
const REQUESTED_ASOF = "2026-06-12T11:00:00.000Z";
const ASOF = "2026-06-12T11:01:00.000Z";

const TITLE =
  "SARB PA source-extract recovery wave 2 — re-extract 8 mangled/thin PA instruments + tighten quality gate";

const CITATIONS = ["D-REGULATORY-LIBRARY-V1", "D-PA-SOURCE-EXTRACT-QUALITY-REMEDIATION"];

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Re-extract the residual set of poorly-extracted PA instruments (mangled " +
      "table/form extractions and thin extracts) from their confirmed SARB DAM " +
      "PDFs, and add a gate detector for the table-cell-as-heading / thin-form class.",
    rationale: "Opens the decision lifecycle (2026-06-12).",
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
      "Re-extract 8 instruments (d2-2014, d2-2015, d5-2011, d5-2016, d7-2016, " +
      "d8-2016, d9-2021, c2-2018) from their confirmed SARB DAM PDFs via " +
      "acquire:source + extract:structured, retaining the raw PDF in source-docs; " +
      "and tighten `regulatory-source-extract-quality` with a detector for the " +
      "table-cell-as-heading / thin-form extraction class so it fails CI rather " +
      "than passing above the tier threshold.",
    rationale:
      "Marc approved in-session 2026-06-12 (scope: D2/2014 + the ~6-8 poor ones; " +
      "gate: add the detector). A post-Wave-1 scan found 8 non-allowlisted " +
      "instruments whose structured.json renders broken/empty: D2/2014's " +
      "rating-system-change form was flattened into heading fragments, and 7 " +
      "others carry only 1–4 KB of thin body text. All 8 have real PDFs on the " +
      "SARB DAM. The quality scorer missed them because a mangled-table extract " +
      "scores above the poor threshold — hence the paired gate-tightening.",
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
