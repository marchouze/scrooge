// scripts/decisions/record-d-capital-asset-class.ts
//
// Records D-CAPITAL-ASSET-CLASS-V1 — Marc's in-session approval (2026-06-21)
// to build Capital as a first-class V2-native FIL asset class, with IFRS
// accounting folds and a BA-700 capital-composition regulatory fold spanning
// the differing qualifying-capital tiers (CET1 / AT1 / Tier 2) per the Banks
// Act 94 of 1990 §70, the Regulations Relating to Banks (Regulation 38), BCBS
// Basel III (CAP / RBC), and SARB PA Directive 5 of 2025 (Form BA 100).
//
// ## Why this exists
//
// The platform models Cash (D-CASH-ASSET-CLASS-V1, #1421) and FX as first-class
// FIL asset classes, with accounting expressed as a pure product-composed
// modular fold over FIL events (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD). Capital
// has no V2-native FIL representation: the only capital path today is the V1
// `CapitalEvent` / `SubLedgerPostingEmitted` family (emit-capital-injection-sim.ts),
// and the BA-700 V2 capital numerator folds to ZERO because no V2 capital
// posting rule emits. Building on V1 is forbidden by the standing V1-retirement
// directive (D-V1-REMOVAL-PHASE-1, extended 2026-06-19). Capital must be born V2.
//
// ## Scope
//
// Bea (Accounting & financial reporting engineer, engineering) to:
//   - Add `capital` to the FIL asset-class taxonomy and mint the Capital FIL
//     type family carrying a qualifying-tier dimension (CET1 / AT1 / Tier 2)
//     and tier sub-category (paid-up ordinary shares, share premium, retained
//     earnings, OCI reserves; AT1 hybrid; Tier 2 subordinated debt / qualifying
//     general provisions) sourced from Reg 38 + BCBS CAP, never hardcoded.
//   - Author IFRS accounting posting rules as fold-native pure functions
//     (issuance recognition IAS 32 §23–24, distributions IAS 32 §35,
//     redemption/derecognition IAS 32 §33) + Capital reporting-treatment modules.
//   - Build the BA-700 capital-composition regulatory fold (CET1/AT1/Tier 2
//     breakdown + own-funds total) reading the V2 GL fold, plus a fail-closed
//     recon gate.
//   - Simulate a R300,000,000 CET1 paid-up ordinary share-capital injection as
//     a V2 FIL capital instrument creation event (provenance.kind = "simulated"),
//     and show it flowing through accounting + BA-700 folds.
//   - Camille (Chief Financial Officer, governance) holds the capital-management
//     /BA-100 obligations (ORG-PR-01..05, ORG-PR-13, ORG-PR-RETURNS-002) the
//     regulatory fold must satisfy.
//
// ## Session-delegation
//
// Marc (CEO) directed this build in-session 2026-06-21; Scrooge (Chief of Staff)
// is the recording instrument (recordedVia: scrooge:session-delegation).
// Category: engineering (build-phase substrate decision; CEO authority).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-CAPITAL-ASSET-CLASS-V1";
const REQUESTED_ASOF = "2026-06-21T08:00:00.000Z";
const ASOF = "2026-06-21T08:01:00.000Z";

const TITLE =
  "Capital as a first-class V2-native FIL asset class — IFRS accounting + BA-700 " +
  "capital-composition folds across CET1 / AT1 / Tier 2, plus R300m injection simulation";

const CITATIONS = [
  "D-CASH-ASSET-CLASS-V1",
  "D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD",
  "D-ACCT-SCHEMA-CANONICAL-HOME",
  "D-V1-REMOVAL-PHASE-1",
  "BANKS-ACT-94-1990-S70",
  "SARB-PA-RRB-REG-38",
  "BCBS-CAP-DEFINITION-OF-CAPITAL",
  "SARB-PA-D5-2025-BA-100",
];

const RECOMMENDATION =
  "Build Capital as a first-class V2-native FIL asset class mirroring Cash/FX: " +
  "add `capital` to the FIL taxonomy; mint a Capital FIL type family carrying a " +
  "qualifying-tier dimension (CET1/AT1/Tier 2) and tier sub-category sourced from " +
  "Reg 38 + BCBS CAP; author fold-native IFRS posting rules (IAS 32 §23–24/§33/§35) " +
  "and Capital reporting-treatment modules; build a BA-700 capital-composition " +
  "regulatory fold + fail-closed recon gate; then simulate a R300m CET1 paid-up " +
  "ordinary share-capital injection as a V2 FIL instrument creation event and show " +
  "it flowing through the accounting and BA-700 folds. V2-only: no new V1 dependency.";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-21).",
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
    rationale:
      "Marc directed this build in-session 2026-06-21. Capital has no V2-native FIL " +
      "representation today and the BA-700 V2 capital numerator folds to zero; the " +
      "only existing path is the forbidden V1 CapitalEvent family. The qualifying " +
      "capital tiers (CET1 / AT1 / Tier 2) are defined by Banks Act §70, the " +
      "Regulations Relating to Banks Reg 38, BCBS Basel III CAP/RBC, and SARB PA " +
      "D5/2025 (Form BA 100); modelling them as a typed FIL dimension lets accounting " +
      "and regulatory folds dispatch on tier. Mirrors the proven Cash/FX FIL patterns " +
      "and the product-composed modular accounting fold. Born V2 per the standing " +
      "V1-retirement directive.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
