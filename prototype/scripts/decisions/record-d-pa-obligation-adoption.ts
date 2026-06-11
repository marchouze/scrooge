// scripts/decisions/record-d-pa-obligation-adoption.ts
//
// Records D-PA-OBLIGATION-ADOPTION — Marc's in-session approval (2026-06-11)
// to commission the PA obligation adoption workstream.
//
// ## Why this exists
//
// D-REGULATORY-LIBRARY-V1 (WS-REGULATORY-LIBRARY-V1, 6 slices merged 2026-06-11)
// landed source filing, extraction, backward traceability, and coverage
// infrastructure. Phase 1 of WS-PA-REMEDIATION fixed the applicability
// misclassification and acquired all 141 source artefacts (PR #1235).
//
// Despite all 69 effective PA directives and 18 effective circulars now being
// correctly classified and sourced, the bank has ZERO adopted obligations
// against any PA-issued instrument. `_obligations.seed.json` contains only
// IFRS-based obligations. This is the most material compliance gap currently
// visible in the regulatory library: SA Banks Act, PA Directives D1–D14,
// and PA Circulars are the bank's most directly-binding domestic instruments.
//
// ## Scope
//
// Mira (Compliance / RegTech engineer, engineering) to:
// - Adopt obligations for all 87 currently-effective binding PA instruments
//   (69 effective directives + 18 effective circulars per C1/2026 annual
//   status circular)
// - Run in tranches by directive number
// - Helena (Chief Risk Officer, governance) reviews each tranche for risk
//   appetite intersection
// - Owen (Company Secretary, governance) signs off on provision interpretation
//
// ## Session-delegation
//
// Marc (CEO) approved in-session 2026-06-11 ("yes"); Scrooge (Chief of Staff)
// is the recording instrument (recordedVia: scrooge:session-delegation).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-PA-OBLIGATION-ADOPTION";
const REQUESTED_ASOF = "2026-06-11T11:22:00.000Z";
const ASOF = "2026-06-11T11:23:00.000Z";

const TITLE =
  "PA obligation adoption workstream — adopt obligations for all 87 currently-effective SARB PA binding instruments";

const CITATIONS = ["D-REGULATORY-LIBRARY-V1", "D-REGULATORY-LIBRARY-V1-WS-PA-REMEDIATION-PHASE-1"];

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "governance",
    recommendation:
      "Commission WS-PA-OBLIGATION-ADOPTION to adopt OBL-ORG-* obligations for " +
      "all 87 currently-effective binding PA instruments (69 effective directives + " +
      "18 effective circulars per C1/2026 annual status circular), populating " +
      "EXPRESSES edges in the regulatory graph and closing the zero-PA-obligations gap.",
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
      "Commission WS-PA-OBLIGATION-ADOPTION: Mira adopts OBL-ORG-* obligations " +
      "for all 87 currently-effective binding PA instruments, running in tranches " +
      "by directive number with Helena CRO review per tranche and Owen CoSec " +
      "sign-off on provision interpretation.",
    rationale:
      "Marc approved in-session 2026-06-11. The bank has zero adopted obligations " +
      "against any PA-issued instrument despite 141 sources now filed and all " +
      "direct instruments correctly classified. The 69 effective directives and 18 " +
      "effective circulars are the bank's most directly-binding domestic instruments " +
      "(issued under ss.6(4) and 6(6) of the Banks Act 94 of 1990). Closing this " +
      "gap is a precondition for the regulatory chain Regulation→Provision→Obligation" +
      "→Policy→Procedure→Capability to be complete for SA prudential requirements.",
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
