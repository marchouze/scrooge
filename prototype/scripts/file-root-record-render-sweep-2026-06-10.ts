// scripts/file-root-record-render-sweep-2026-06-10.ts
//
// One-shot RMS sweep of tracked root-level record renders (Vera, Internal
// audit / continuous-assurance engineer, engineering; functionally to
// Thandiwe, Chief Audit Executive).
// Brief: brief:vera:sweep-tracked-root-level-record-renders-into-rms:2026-06-10.
//
// Three sections, each idempotent:
//   A. BLOB RESCUES — root renders whose RecordFiled event already exists in
//      the shared store with documentHash == the tree copy's hash, but whose
//      blob is absent from the production document store (the #1194
//      dangling-reference failure mode: the filing ran in an ephemeral
//      dispatch worktree whose local document store died with the worktree).
//      The tree copy IS the filed content (hash-proven), so the rescue writes
//      the tree bytes into the store and asserts the resulting hash.
//   B. NEW FILINGS — root renders with no RecordFiled event at all
//      (events-first, Principle 1). Classification follows each render's own
//      frontmatter where present, existing same-author filings otherwise.
//      Includes one binary document (the FX-OTC NPA attestation-evidence
//      PDF), filed via a direct document-store put + makeRecordFiled.
//   C. DRIFT SUPERSEDE — 2026-06-03_helena_b3-fx-market-risk-measure-review.md
//      was filed on 2026-06-03 (blake3:0180…) but the tree copy was then
//      edited by the BA-330 re-attribution sweep (PR #1065,
//      D-BA-330-REATTRIBUTION-IRRBB) and the originally-filed blob is
//      unrecoverable (existed only in an ephemeral worktree store). The
//      current tree version is filed as v2 superseding the original record,
//      so the latest record in the register resolves to a real blob.
//
// Run against the SHARED canonical store and the PRODUCTION document store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_DOCUMENT_STORE_PATH=/Users/marc/code/Bank/prototype/data/documents \
//     bun run scripts/file-root-record-render-sweep-2026-06-10.ts
//
// After this sweep lands, the root renders are removed from the tree
// (D-RMS-PHASE-4: registers + document store are sole canonical). Re-runs
// against the canonical store skip every entry; runs against a fresh store
// with the renders gone report the gap and exit 1 (same posture as the
// #1194 guard in file-bea-irs-tail-closure.ts).
//
// Authority: D-RMS-PHASE-3; D-RMS-PHASE-4; D-QUEUE-CLOSEOUT-2026-06-10
//            residuals; finding class F-BEA-20260610-0NH9 (PR #1194).
// Author: Vera (Internal audit / continuous-assurance engineer, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { type DocumentHash, defaultDocumentStore } from "../platform/document-store";
import { type RecordFiledPayload, makeRecordFiled } from "../platform/event-store/event-types/rms";
import { recordFiled } from "../platform/records";

const SWEEP_BRIEF = "brief:vera:sweep-tracked-root-level-record-renders-into-rms:2026-06-10";
const TAG = "file-root-record-render-sweep-2026-06-10";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`${TAG}: cannot locate repo root (CLAUDE.md not found)`);
}
const REPO_ROOT = findRepoRoot(import.meta.dir);

if (!process.env.BANK_EVENT_DB) {
  console.warn(
    `[${TAG}] WARNING: BANK_EVENT_DB not set — writing to the LOCAL store, not the shared canonical store.`,
  );
}
if (!process.env.BANK_DOCUMENT_STORE_PATH) {
  console.warn(
    `[${TAG}] WARNING: BANK_DOCUMENT_STORE_PATH not set — blobs land in this worktree's local document store, not the production store.`,
  );
}

const RETENTION = {
  citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
  minimumYears: 7,
  archivalTier: "hot" as const,
};

// ---------------------------------------------------------------------------
// Section A — blob rescues (RecordFiled exists, hash == tree copy, blob absent)
// ---------------------------------------------------------------------------

interface Rescue {
  readonly docName: string;
  readonly recordId: string;
  readonly expectedHash: string;
}

const RESCUES: readonly Rescue[] = [
  {
    docName: "2026-05-29_helena_model-registry-scope-closure-slice-2-ecl-suite.md",
    recordId: "record:documents:helena:model-registry-scope-closure-slice-2-ecl-suite:2026-05-29",
    expectedHash: "blake3:aa36a6ed6b22df8a2cac27f25c21cd7b23bdf56319324833d34388f307e10ce0",
  },
  {
    docName: "2026-05-29_helena_model-registry-scope-closure-slice-3-irrbb-eve-nii.md",
    recordId:
      "record:documents:helena:model-registry-scope-closure-slice-3-irrbb-eve-nii:2026-05-29",
    expectedHash: "blake3:4d9a44893d55ebb5d190e7d808ba4a6376c66700a73ea063fd0d897b50016d43",
  },
  {
    docName: "2026-05-29_helena_model-registry-scope-closure-slice-4-market-risk.md",
    recordId: "record:documents:helena:model-registry-scope-closure-slice-4-market-risk:2026-05-29",
    expectedHash: "blake3:4ede6c606879575b3d5eec9c066403291058f0d0e3d04c336cda828f876b6e65",
  },
  {
    docName: "2026-05-29_helena_model-registry-scope-closure-slice-5-cva.md",
    recordId: "record:documents:helena:model-registry-scope-closure-slice-5-cva:2026-05-29",
    expectedHash: "blake3:319d3ee1b3ee40aee51ec2d6d21560333d352c870240b1014733effe45609b20",
  },
  {
    docName: "2026-05-31_camille_product-control-best-practice-recommendations.md",
    recordId: "record:documents:camille:product-control-best-practice-recommendations:2026-05-31",
    expectedHash: "blake3:8c1935216aff12e70af27c17d64bb90a46fc377df1a6d72dec3963b8dfa103a1",
  },
  {
    docName: "2026-05-31_vera_spec-gap-staleness-audit-finding.md",
    recordId:
      "record:run:vera:2026-05-31T07-56-01-633Z:0:2026-05-31_vera_spec-gap-staleness-audit-finding.md",
    expectedHash: "blake3:2c7b43fc0ede762e0d0e7e440b9c9cea530cb3c32f546b213e6c59818fcb91e7",
  },
  {
    docName: "2026-06-02_cro_independent-risk-review-canonical-lcr-engine.md",
    recordId: "record:documents:cro:independent-risk-review-canonical-lcr-engine:2026-06-02",
    expectedHash: "blake3:f5154ab8f8ebe1fecd8312259cbd116ada1b36bf1be721ef614274e32ca8dd1a",
  },
  {
    docName: "2026-06-02_ravi_lcr-engine-reconciliation.md",
    recordId: "record:documents:ravi:lcr-engine-reconciliation:2026-06-02",
    expectedHash: "blake3:d40f9958f777b2f139d01327533b80feaa16394e30efe3b0f2c4fc7b14b4fe5e",
  },
  {
    docName: "2026-06-02_treasurer_canonical-lcr-engine-recommendation.md",
    recordId: "record:documents:treasurer:canonical-lcr-engine-recommendation:2026-06-02",
    expectedHash: "blake3:88ce44ac03765d2c9831523b06893128279201a919ced52f46717dd6f564a32e",
  },
  {
    docName: "2026-06-03_helena_b3-measure-calibration-decisions.md",
    recordId: "record:decisions:helena:b3-measure-calibration-decisions:2026-06-03",
    expectedHash: "blake3:a4f3db5407fd1c67330afee874929ad24e7a40d1cd33abc4f3dff744fe279347",
  },
  {
    docName: "2026-06-03_scrooge_data-quality-provenance-architecture-review.md",
    recordId: "record:documents:scrooge:data-quality-provenance-architecture-review:2026-06-03",
    expectedHash: "blake3:cd89c4518173402a3e4b67e59d6706887379a8d5c241b9afe8ccbc180a3f60c2",
  },
  {
    docName: "2026-06-07_scrooge_roadmap-ws-c-reconciliation.md",
    recordId: "record:documents:scrooge:roadmap-ws-c-reconciliation:2026-06-07",
    expectedHash: "blake3:7b8a5f837e863f41560c3ae927c3e5cf09afcd1bd933b7e550a671d7df16b53c",
  },
  {
    docName: "2026-06-09_atlas_ceo-escalation-push-channel-spec.md",
    recordId: "record:documents:atlas:ceo-escalation-push-channel-spec:2026-06-09",
    expectedHash: "blake3:8b235887691d3482ef7762e09e24f9ab84a427168579da12d4d530dad913df54",
  },
  {
    docName: "2026-06-10_atlas_dashboard-consolidation-and-domain-alignment-proposal.md",
    recordId: "record:documents:atlas:dashboard-consolidation-proposal:2026-06-10",
    expectedHash: "blake3:010a59da2487f17b5a07d35d507aecad6d28ca019a08e38aaef3f44fdb99e5a8",
  },
  {
    docName: "2026-06-10_atlas_orphan-run-deliverable-state-classification-spec.md",
    recordId: "record:documents:atlas:orphan-run-deliverable-state-classification-spec:2026-06-10",
    expectedHash: "blake3:c63eb38dc53cb4f2f97f54f1d14326c5e6e03b1af016701825cc4c33de4a09eb",
  },
  {
    docName: "2026-06-10_scrooge_fx-otc-npa-attestation-completion-roadmap.md",
    recordId: "record:documents:scrooge:fx-otc-npa-attestation-completion-roadmap:2026-06-10",
    expectedHash: "blake3:da580e2385545770706af36f59335baecfe9e1c34a152f6cc435c5377d42fd53",
  },
  {
    docName: "2026-06-10_scrooge_fx-otc-npa-dimension-verification.md",
    recordId: "record:documents:scrooge:fx-otc-npa-dimension-verification:2026-06-10",
    expectedHash: "blake3:b5a5394b6d56554190248a2c7de8d155bbeeb069da6a53a3818262413b192980",
  },
  {
    docName: "2026-06-10_scrooge_returns-submission-wiring-workstream-scoping.md",
    recordId: "record:documents:scrooge:returns-submission-wiring-workstream-scoping:2026-06-10",
    expectedHash: "blake3:4c246e84b020a8782e109f9c9b0d83a90867946b0f4316d84fe33c3a89ea045e",
  },
  {
    docName: "2026-06-10_scrooge_sa-ccr-counterparty-class-corrected-scope.md",
    recordId: "record:documents:scrooge:sa-ccr-counterparty-class-corrected-scope:2026-06-10",
    expectedHash: "blake3:3f4007b0369b243f104d7a47d3adacc0de6590956b4b10d9587e811127a03ba5",
  },
];

// ---------------------------------------------------------------------------
// Section B + C — new filings (and the drift supersede)
// ---------------------------------------------------------------------------

interface Filing {
  readonly docName: string;
  readonly recordId: string;
  readonly registerKey: RecordFiledPayload["registerKey"];
  readonly classification: RecordFiledPayload["classification"];
  readonly title: string;
  readonly category: string;
  readonly author: string;
  readonly date: string;
  readonly citations: readonly string[];
  readonly supersedes?: string;
  readonly binary?: boolean;
}

const FILINGS: readonly Filing[] = [
  {
    docName: "2026-05-20_owen_brief-imani_source-bowmans-isda-sa-netting-opinion-for-rms.md",
    recordId:
      "record:documents:owen:brief-imani-source-bowmans-isda-sa-netting-opinion-for-rms:2026-05-20",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "Brief to Imani — source Bowmans 2024-04-15 ISDA SA netting opinion + file into RMS document store",
    category: "brief-render",
    author: "Owen (Company Secretary, governance)",
    date: "2026-05-20",
    citations: [
      "D-RMS-PHASE-3",
      "2026-05-20_owen_brief-imani_source-bowmans-isda-sa-netting-opinion-for-rms.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-21_helena_mr-1-fx-ipv-tolerance-recalibration.md",
    recordId: "record:documents:helena:mr-1-fx-ipv-tolerance-recalibration:2026-05-21",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "MR-1-FX IPV tolerance recalibration after PR #694 (inverse-pair direction sanity-check)",
    category: "governance-deliverable",
    author: "Helena (Chief Risk Officer, governance)",
    date: "2026-05-21",
    citations: [
      "D-RMS-PHASE-3",
      "D-BRC-INTERIM-MR-1-FX",
      "2026-05-21_helena_mr-1-fx-ipv-tolerance-recalibration.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-21_owen_d-brc-interim-mr-1-fx_decision-card.md",
    recordId: "record:decisions:owen:d-brc-interim-mr-1-fx-decision-card:2026-05-21",
    registerKey: "decisions",
    classification: "ceo-only",
    title:
      "D-BRC-INTERIM-MR-1-FX — CEO interim-authority approval of Helena's MR-1-FX controlled-launch limit framework (BRC substitute, build-phase)",
    category: "decision-card",
    author: "Owen (Company Secretary, governance)",
    date: "2026-05-21",
    citations: [
      "D-RMS-PHASE-3",
      "D-BRC-INTERIM-MR-1-FX",
      "2026-05-21_owen_d-brc-interim-mr-1-fx_decision-card.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-21_owen_d-oprisk-engineer-role-licence-day_decision-card.md",
    recordId: "record:decisions:owen:d-oprisk-engineer-role-licence-day-decision-card:2026-05-21",
    registerKey: "decisions",
    classification: "ceo-only",
    title:
      "D-OPRISK-ENGINEER-ROLE-LICENCE-DAY — re-examine operational-risk-engineer staffing at the pre-licence go-live readiness gate",
    category: "decision-card",
    author: "Owen (Company Secretary, governance)",
    date: "2026-05-21",
    citations: [
      "D-RMS-PHASE-3",
      "D-OPRISK-ENGINEER-ROLE",
      "2026-05-21_owen_d-oprisk-engineer-role-licence-day_decision-card.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-21_owen_d-oprisk-engineer-role_decision-card.md",
    recordId: "record:decisions:owen:d-oprisk-engineer-role-decision-card:2026-05-21",
    registerKey: "decisions",
    classification: "ceo-only",
    title:
      "D-OPRISK-ENGINEER-ROLE — operational-risk engineering: dedicated seat, subsume, or defer?",
    category: "decision-card",
    author: "Owen (Company Secretary, governance)",
    date: "2026-05-21",
    citations: [
      "D-RMS-PHASE-3",
      "D-OPRISK-ENGINEER-ROLE",
      "2026-05-21_owen_d-oprisk-engineer-role_decision-card.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-21_saskia-kai_d-fx-quoting-convention-decision-card.md",
    recordId: "record:decisions:saskia-kai:d-fx-quoting-convention-decision-card:2026-05-21",
    registerKey: "decisions",
    classification: "ceo-only",
    title: "D-FX-QUOTING-CONVENTION — single codebase-wide FX quoting convention for fxLegSchema",
    category: "decision-card",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Kai (Trading systems engineer, engineering)",
    date: "2026-05-21",
    citations: [
      "D-RMS-PHASE-3",
      "D-FX-QUOTING-CONVENTION",
      "2026-05-21_saskia-kai_d-fx-quoting-convention-decision-card.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-22_atlas_d-provenance-build-phase-class_decision-card.md",
    recordId: "record:decisions:atlas:d-provenance-build-phase-class-decision-card:2026-05-22",
    registerKey: "decisions",
    classification: "ceo-only",
    title:
      "D-PROVENANCE-BUILD-PHASE-CLASS — establish a third provenance class for real build-phase data that flows through production projections",
    category: "decision-card",
    author: "Atlas (Core banking platform architect, engineering)",
    date: "2026-05-22",
    citations: [
      "D-RMS-PHASE-3",
      "D-PROVENANCE-BUILD-PHASE-CLASS",
      "2026-05-22_atlas_d-provenance-build-phase-class_decision-card.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-26_saskia-owen_proc-npa-gate-01-fx-swap-walk.md",
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-fx-swap-walk:2026-05-26",
    registerKey: "documents",
    classification: "ceo-only",
    title: "PROC-NPA-GATE-01 first activation — FX swap USD/ZAR (internal pre-licence test)",
    category: "npa-gate-walk",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen (Company Secretary, governance)",
    date: "2026-05-26",
    citations: [
      "D-RMS-PHASE-3",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "2026-05-26_saskia-owen_proc-npa-gate-01-fx-swap-walk.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-26_saskia-owen_proc-npa-gate-01-irs-zaronia-walk.md",
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-irs-zaronia-walk:2026-05-26",
    registerKey: "documents",
    classification: "ceo-only",
    title:
      "PROC-NPA-GATE-01 first activation — vanilla ZAR IRS fixed-vs-ZARONIA (internal pre-licence test)",
    category: "npa-gate-walk",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen (Company Secretary, governance)",
    date: "2026-05-26",
    citations: [
      "D-RMS-PHASE-3",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "2026-05-26_saskia-owen_proc-npa-gate-01-irs-zaronia-walk.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-26_saskia-owen_proc-npa-gate-01-jse-equity-walk.md",
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-jse-equity-walk:2026-05-26",
    registerKey: "documents",
    classification: "ceo-only",
    title: "PROC-NPA-GATE-01 first activation — JSE equity cash (internal pre-licence test)",
    category: "npa-gate-walk",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen (Company Secretary, governance)",
    date: "2026-05-26",
    citations: [
      "D-RMS-PHASE-3",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "2026-05-26_saskia-owen_proc-npa-gate-01-jse-equity-walk.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-26_saskia-owen_proc-npa-gate-01-repo-gmra-walk.md",
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-repo-gmra-walk:2026-05-26",
    registerKey: "documents",
    classification: "ceo-only",
    title: "PROC-NPA-GATE-01 first activation — open repo / GMRA (internal pre-licence test)",
    category: "npa-gate-walk",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen (Company Secretary, governance)",
    date: "2026-05-26",
    citations: [
      "D-RMS-PHASE-3",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "2026-05-26_saskia-owen_proc-npa-gate-01-repo-gmra-walk.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-05-26_saskia-owen_proc-npa-gate-01-sagb-bond-walk.md",
    recordId: "record:documents:saskia-owen:proc-npa-gate-01-sagb-bond-walk:2026-05-26",
    registerKey: "documents",
    classification: "ceo-only",
    title: "PROC-NPA-GATE-01 first activation — SAGB fixed-coupon bond (internal pre-licence test)",
    category: "npa-gate-walk",
    author:
      "Saskia (Head of Global Markets / Chief Markets Officer, governance) + Owen (Company Secretary, governance)",
    date: "2026-05-26",
    citations: [
      "D-RMS-PHASE-3",
      "D-NPA-FX-SPOT-INTERNAL-TEST",
      "2026-05-26_saskia-owen_proc-npa-gate-01-sagb-bond-walk.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-06-03_helena-rohan_b3-nop-reconciliation-brief.md",
    recordId: "record:documents:helena-rohan:b3-nop-reconciliation-brief:2026-06-03",
    registerKey: "documents",
    classification: "governance-seat",
    title: "B3 FX measure — NOP-redesign reconciliation + sub-limit substrate",
    category: "brief-render",
    author: "Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering)",
    date: "2026-06-03",
    citations: [
      "D-RMS-PHASE-3",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "2026-06-03_helena-rohan_b3-nop-reconciliation-brief.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-06-03_helena-rohan_r8-var-measure-wiring-brief.md",
    recordId: "record:documents:helena-rohan:r8-var-measure-wiring-brief:2026-06-03",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "R8 — wire the existing VaR engine into a market-risk measure line (close vera:mr-1-fx-var-projection-gap)",
    category: "brief-render",
    author: "Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering)",
    date: "2026-06-03",
    citations: [
      "D-RMS-PHASE-3",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "2026-06-03_helena-rohan_r8-var-measure-wiring-brief.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-06-07_scrooge_brief-mira_ws-instrument-analyses-markets-priority.md",
    recordId:
      "record:documents:scrooge:brief-mira-ws-instrument-analyses-markets-priority:2026-06-07",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "Brief to Mira — WS-INSTRUMENT-ANALYSES: drive markets-profile-priority STUB instruments to POPULATED",
    category: "brief-render",
    author: "Scrooge (Chief of Staff / orchestrator)",
    date: "2026-06-07",
    citations: [
      "D-RMS-PHASE-3",
      "D-ROADMAP-WS-C-RECONCILE",
      "2026-06-07_scrooge_brief-mira_ws-instrument-analyses-markets-priority.md",
      SWEEP_BRIEF,
    ],
  },
  {
    docName: "2026-06-10_prd-bank-fx-otc-vanilla_attestation-evidence-report.pdf",
    recordId:
      "record:documents:saskia:prd-bank-fx-otc-vanilla-attestation-evidence-report:2026-06-10",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "FX OTC vanilla umbrella NPA (prd:bank:fx:otc-vanilla) — attestation evidence report (PDF)",
    category: "attestation-evidence",
    author: "Saskia (Head of Global Markets / Chief Markets Officer, governance)",
    date: "2026-06-10",
    citations: [
      "D-RMS-PHASE-3",
      "2026-06-10_prd-bank-fx-otc-vanilla_attestation-evidence-report.pdf",
      SWEEP_BRIEF,
    ],
    binary: true,
  },
  // Section C — drift supersede (original blob blake3:0180… unrecoverable;
  // tree copy edited post-filing by PR #1065, D-BA-330-REATTRIBUTION-IRRBB).
  {
    docName: "2026-06-03_helena_b3-fx-market-risk-measure-review.md",
    recordId: "record:documents:helena:b3-fx-market-risk-measure-review:v2:2026-06-10",
    registerKey: "documents",
    classification: "governance-seat",
    title:
      "B3 FX Market-Risk Measure — Basis & Best-Practice Review (v2 — post BA-330 re-attribution)",
    category: "cro-measure-review",
    author: "Helena (Chief Risk Officer, governance)",
    date: "2026-06-03",
    citations: [
      "D-RMS-PHASE-3",
      "D-BA-330-REATTRIBUTION-IRRBB",
      "D-BRC-INTERIM-MR-1-FX",
      "2026-06-03_helena_b3-fx-market-risk-measure-review.md",
      SWEEP_BRIEF,
    ],
    supersedes: "record:documents:helena:b3-fx-market-risk-measure-review:2026-06-03",
  },
];

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

function main(): void {
  const asOf = clock.now();
  const filedIds = new Set<string>();
  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const id = (e.payload as { recordId?: string }).recordId;
    if (id) filedIds.add(id);
  }

  const report = {
    rescued: [] as string[],
    rescueSkipped: [] as string[],
    filed: [] as string[],
    filingSkipped: [] as string[],
    missing: [] as string[],
  };

  // Section A — blob rescues.
  for (const r of RESCUES) {
    if (defaultDocumentStore.exists(r.expectedHash as DocumentHash)) {
      report.rescueSkipped.push(`${r.docName} (blob present)`);
      continue;
    }
    const docPath = resolve(REPO_ROOT, r.docName);
    if (!existsSync(docPath)) {
      report.missing.push(
        `${r.docName} (rescue: tree copy gone AND blob absent — dangling RecordFiled ${r.recordId})`,
      );
      continue;
    }
    const put = defaultDocumentStore.put(new Uint8Array(readFileSync(docPath)));
    if (put.hash !== r.expectedHash) {
      throw new Error(
        `${TAG}: rescue hash mismatch for ${r.docName}: tree=${put.hash} filed=${r.expectedHash}`,
      );
    }
    report.rescued.push(`${r.docName} -> ${put.hash}`);
  }

  // Sections B + C — new filings.
  for (const f of FILINGS) {
    if (filedIds.has(f.recordId)) {
      report.filingSkipped.push(f.recordId);
      continue;
    }
    const docPath = resolve(REPO_ROOT, f.docName);
    if (!existsSync(docPath)) {
      report.missing.push(`${f.docName} (filing: tree copy gone before ${f.recordId} was filed)`);
      continue;
    }

    const metadata = {
      title: f.title,
      path: f.docName,
      category: f.category,
      author: f.author,
      date: f.date,
    };

    if (f.binary) {
      // Binary document: put bytes directly, then emit the event by hand —
      // recordFiled() only accepts string bodies.
      const put = defaultDocumentStore.put(new Uint8Array(readFileSync(docPath)));
      const event = makeRecordFiled({
        asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:vera:engineering" },
        citations: [...f.citations],
        payload: {
          recordId: f.recordId,
          registerKey: f.registerKey,
          documentHash: put.hash,
          classification: f.classification,
          retention: RETENTION,
          metadata,
        },
      });
      eventStore.append(event);
      report.filed.push(`${f.recordId} -> ${put.hash} (binary)`);
    } else {
      const result = recordFiled(
        {
          recordId: f.recordId,
          registerKey: f.registerKey,
          body: readFileSync(docPath, "utf8"),
          classification: f.classification,
          retention: RETENTION,
          citations: [...f.citations],
          actor: { type: "service", id: "agent:vera:engineering" },
          entity: "LE-ZA-HOZ-BANK",
          metadata,
          ...(f.supersedes ? { supersedes: f.supersedes } : {}),
        },
        asOf,
      );
      report.filed.push(`${f.recordId} -> ${result.documentHash}`);
    }
  }

  console.log(JSON.stringify({ ok: report.missing.length === 0, asOf, ...report }, null, 2));
  if (report.missing.length > 0) process.exit(1);
}

main();
