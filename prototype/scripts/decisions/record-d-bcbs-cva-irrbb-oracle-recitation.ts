// scripts/decisions/record-d-bcbs-cva-irrbb-oracle-recitation.ts
//
// Records D-BCBS-CVA-IRRBB-ORACLE-RECITATION — Marc's in-session approval
// (2026-06-26) to RE-CITE (not acquire) the Basel CVA and IRRBB capital
// frameworks against the standards that are ALREADY in the acquired BCBS library
// under their consolidated-Basel-Framework chapter codes.
//
// ## Why this exists
//
// PR #1569 (D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE) §18/§20 of Rohan (Risk
// engineer, engineering) flagged the Basel CVA and IRRBB standards as "tracked
// gaps — no acquired standard / no graph node". That conclusion was DOMAIN-WRONG:
// it was reached by searching for the STANDALONE publication identifiers
// (`urn:reg:bcbs:cva:*`, a standalone `d368` node) and concluding "not acquired".
// But `D-REGULATORY-LIBRARY-V1` acquires from the CONSOLIDATED Basel Framework,
// which files both standards under different chapter codes — and both are already
// present:
//   - CVA capital framework = `urn:reg:bcbs:mar:50.*` (consolidated MAR50, "Credit
//     valuation adjustment framework"): 74 paragraphs in
//     `Regulations/BCBS/chapter-text.json`, structured in
//     `Regulations/BCBS/source-docs/mar-structured.json`, minted in
//     `Regulations/BCBS/obligation-graphs/mar-obligation-graph.json`. Covers
//     BA-CVA (basic 50.13, reduced 50.14–50.16, full 50.17–50.26) and SA-CVA.
//   - IRRBB = `urn:reg:bcbs:srp:31.*` (consolidated SRP31; standalone d368 was
//     consolidated into it): srp:31* Provision nodes in
//     `Regulations/BCBS/obligation-graphs/srp-obligation-graph.json`. Eitan
//     (Treasurer, treasury) already cites `urn:reg:bcbs:srp:31`.
//
// A consistent-but-wrong result is itself a finding (PROC-GOV-ADC-01): the §20
// challenge was internally consistent yet reached the wrong conclusion. Minting
// fresh `cva:*` / standalone-`d368` nodes would have DUPLICATED MAR50/SRP31 under
// invented group codes that do not match the source taxonomy — a direct
// Engineering-Charter command-4 breach (no invented ids / source-don't-hardcode).
//
// ## Scope (no acquisition — re-citation only)
//
// Rohan (Risk engineer, engineering) to, in one PR:
//   - `cva-engine.ts`: cite the reduced-BA-CVA provisions the no-hedge formula
//     implements (`urn:reg:bcbs:mar:50.13`–`.16`), sourced from
//     `mar-structured.json`; note which paras are / are not implemented (the full
//     version 50.17+ and SA-CVA buckets are NOT implemented and NOT cited).
//   - `Team/Rohan.md` §18 + §20 + change log: replace the two CVA/IRRBB "tracked
//     gap" rows with the real oracle citations (CVA → `urn:reg:bcbs:mar:50.*`;
//     IRRBB → `urn:reg:bcbs:srp:31.*` + `urn:risk:bank:RT-IRRBB` + PA Directive
//     8/2023), and record the CORRECTED §20 finding.
//   - `basel-adoption.ts`: add the two Basel→SA transposition edges (MAR50 CVA →
//     Reg 28; SRP31 IRRBB → Reg 30 + PA Directive 8/2023).
//   - This decision-record mirror (committed, not executed — the event is already
//     in the shared store).
//
// No new graph nodes / structured files / INDEX.json / _source-coverage.json
// changes (nothing is being acquired).
//
// ## Session-delegation
//
// Marc (CEO) directed this in-session 2026-06-26; Scrooge (Chief of Staff) is the
// recording instrument (recordedVia: scrooge:session-delegation). Category:
// engineering (build-phase substrate / domain-competence correction; CEO
// authority).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-BCBS-CVA-IRRBB-ORACLE-RECITATION";
const REQUESTED_ASOF = "2026-06-26T09:00:00.000Z";
const ASOF = "2026-06-26T09:01:00.000Z";

const TITLE =
  "Re-cite the CVA + IRRBB oracles that already exist (MAR50 / SRP31) — correct " +
  "the wrong 'tracked gap' premise; no acquisition, no invented ids";

const CITATIONS = [
  "D-REGULATORY-LIBRARY-V1",
  "D-AGENT-DOMAIN-COMPETENCE",
  "D-ADC-RISK-TREASURY-AUDIT-SEAT-UPGRADE",
  "D-ENGINEERING-INTEGRITY-CHARTER",
  "urn:reg:bcbs:mar:50",
  "urn:reg:bcbs:srp:31",
];

const RECOMMENDATION =
  "Re-cite — do NOT acquire. The Basel CVA capital framework is already in the " +
  "acquired BCBS library as MAR50 (`urn:reg:bcbs:mar:50.*`) and IRRBB as SRP31 " +
  "(`urn:reg:bcbs:srp:31.*`, the standard the standalone d368 was consolidated " +
  "into). The PR #1569 §18/§20 'tracked gap — no graph node' flags are " +
  "domain-wrong: they searched standalone publication identifiers " +
  "(`cva:*` / standalone `d368`) instead of the consolidated-framework chapter " +
  "codes. Bind the real oracles in cva-engine.ts (reduced BA-CVA " +
  "`mar:50.13`–`.16`), Team/Rohan.md §18/§20/change-log, and the two Basel→SA " +
  "adoption edges in basel-adoption.ts (MAR50→Reg 28; SRP31→Reg 30 + PA " +
  "Directive 8/2023). No new `cva:*`/`d368` nodes — minting them would duplicate " +
  "MAR50/SRP31 under invented ids (Engineering-Charter command 4).";

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: "Opens the decision lifecycle (2026-06-26).",
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
      "Marc directed this in-session 2026-06-26 after the wrong 'tracked gap' " +
      "premise in PR #1569 §18/§20 was identified. The Basel CVA capital " +
      "framework is the consolidated MAR50 (`urn:reg:bcbs:mar:50.*`, 74 " +
      "paragraphs covering BA-CVA basic/reduced/full and SA-CVA) and IRRBB is " +
      "the consolidated SRP31 (`urn:reg:bcbs:srp:31.*`); both are already " +
      "acquired under D-REGULATORY-LIBRARY-V1 — the standalone-identifier search " +
      "(`cva:*` / `d368`) reached a consistent-but-wrong conclusion, which is " +
      "itself a finding (PROC-GOV-ADC-01). Re-citation binds the existing " +
      "oracles; acquisition is unnecessary and minting `cva:*`/`d368` nodes " +
      "would duplicate the source taxonomy under invented ids (Engineering- " +
      "Charter command 4, source-don't-hardcode). The cva-engine implements the " +
      "reduced BA-CVA (no hedges, `mar:50.13`–`.16`); the full version and " +
      "SA-CVA are not implemented and are not cited.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(`Recorded ${DECISION_ID}: event ${result.eventId}`);
