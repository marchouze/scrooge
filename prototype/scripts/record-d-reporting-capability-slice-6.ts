// scripts/record-d-reporting-capability-slice-6.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-6 —
// the IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton),
// the M3 deliverable that unlocks Phase C of the dry-run scenario.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-6 sub-authorisation
// so the audit trail names it explicitly. No new CEO approval required
// per CLAUDE.md "Dispatch discipline" no-pause rule.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import { applySharedEventDbResolution } from "../platform/event-store/resolve-event-db";
applySharedEventDbResolution();

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-6",
  action: "approve" as const,
  title:
    "Reporting capability Slice 6 — IFRS statement renderer end-to-end (semantic + 5 statement generators + JSON bundle render + CLI)",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; IFRS line-mapping owner) + Atlas (Core banking platform architect, engineering — substrate consult) ship the first IFRS AFS skeleton end-to-end. Nine new IFRS-statement semantic entries (TotalAssets, TotalLiabilities, TotalEquity, ProfitOrLoss, OtherComprehensiveIncome, TotalComprehensiveIncome, NetCashFromOperating, NetCashFromInvesting, NetCashFromFinancing) extend the Slice 1/3/4 registry — each cites IAS 1 + IAS 7 (and IFRS 7/9/13 where applicable) + Companies Act 71/2008 §§28–30, scoped to urn:legal-entity:hoz:hoz-bank:v1, with one [citation: TBC] marker per pack §9 Q1 default pending Camille's accounting-policy adoption choices per Owner Inbox/2026-05-06_core-policies-finance.md §§1–3. New @platform/reporting Slice-6 modules land five pure projections — generateIfrsBalanceSheet (IAS 1 §54 — assets/liabilities/derived equity with accounting-equation residual surfaced as a typed line, sign-convention warnings per debit/credit class), generateIfrsIncomeStatement (IAS 1 §82 single-statement form per §10A — income/expense/P&L/OCI/TCI), generateIfrsCashFlow (IAS 7 indirect method per §18(b) — P&L starting point + working-capital movements + investing/financing classifications, current-period proxy with placeholder when no comparative supplied), generateIfrsChangesInEquity (IAS 1 §106 — four-component reconciliation share-capital/retained-earnings/oci-reserve/other-reserves, opening-equity caller-supplied with zero default for Hoz Bank build-phase posture, owner-transactions inferred from TB share-capital balance), generateIfrsNotes (IFRS 7 + IAS 1 + IFRS 13 — 13 typed note headings status:skeleton with [citation: TBC] placeholders) + JSON bundle renderer renderIfrsBundle / renderIfrsBundleCanonical (Zod schema validation per statement, deterministic key-sorted bytes via canonicaliseIfrs walker mirroring BA 700 Slice 4 pattern, $schema first per ASCII order, hash-store-friendly for downstream ReportGenerated events, bundle coherence checks reject mismatched entity/asOf/periodId/currency across statements). CLI wrapper at scripts/render-ifrs-statements.ts replays the event store, resolves the trial balance from periodAuditChain (Slice 2 substrate) or ad-hoc compute, applies per-account IFRS classifications (built-in build-phase fixture default — ACC-1100-001 → asset/Cash, ACC-equity-position-stub → equity/share-capital, ACC-retained-earnings-stub → equity/retained-earnings, ACC-pl-revenue-stub → income), generates all five statements, and writes canonical bundle JSON to stdout or --out. Per-entity isolation enforced — assertIfrsBankEntity throws on Hoz Securities (FAIS-related — has its own IFRS-solo set) AND Hoz Group (consolidated AFS lands at downstream slice once consolidation projection is built per D-REGULATORY-PERIMETER). Determinism witnessed via classificationsFingerprint + sortKeys canonicaliser. Comparative-period plumbing in place — comparativeTrialBalance / comparativeAsOf flow through every generator and surface as comparativeAmountMinor per line; first dry-run scenario (Phase C) does not yet supply comparative; placeholders flag the absence cleanly. Tests (28/28 passing): semantic-entry registration + co-existence with Slice 1; per-entity isolation triple-rejection (Securities + Group on every generator, invalid currency, comparativeAsOf ordering); end-to-end synthetic event-stream → period-close → 5 IFRS statements → JSON bundle render with computed totals (R3.0m share-capital injection + R0.5m P&L revenue → assets R3.0m, P&L R0.5m, SoCE closing equity R3.5m, accountingEquationCheck.balanced=true); per-statement Zod schema validation; bundle render coherence checks (entity/asOf/periodId/currency match across all 5 statements); generator boundary errors (duplicate classifications, invalid currency, comparativeAsOf ordering); canonicalisation determinism + lexical-key-sort with $schema first; comparative-period support emits comparative columns when supplied, null when absent. M8 SARB-PORTAL-SIMULATOR DEPENDENCY: the IFRS bundle render is the JSON contract the downstream Slice-7+ SARB-portal simulator consumes; canonical bytes hash into ReportGenerated.documentHash (RMS document store, BLAKE3 per RMS Slice 1 / PR #142); XML render layer (Slice 5) takes the canonical JSON as input contract; PA / SARB external-publishing schemas land at the M8 cloud-lift slice once Mira's WS-INSTRUMENT-ANALYSES finalises the published taxonomy. Substrate gaps surfaced: per-account IFRS classification map externalised at v0 — chart-of-accounts gains ifrsAccountClass field at downstream slice once Mira's WS-INSTRUMENT-ANALYSES finalises taxonomy ([citation: TBC] carried); accounting-policy adoption choices owned by Camille (single vs two-statement P&L per IAS 1 §10A; by-nature vs by-function expense per §99; bank interest/dividend cash-flow per IAS 7 §31–§34; FVOCI vs FVTPL elective) — engine doesn't block; IAS 12 income-tax line is a placeholder pending Yael's tax engine per pack §8.2 (CIT slice activates when revenue starts per buildPhaseStatus); IAS 1 §60 current-vs-non-current gated on chart-of-accounts maturity-bucket field; IFRS 9 ECL Stage 1 placeholder only at v0 per pack §6 Slice 8 — Helena's Tier-1 ECL model is a downstream tranche; IFRS 10 / IFRS 12 group-consolidated AFS deferred to downstream slice once consolidation projection is built per D-REGULATORY-PERIMETER (v0 Hoz Bank only); IAS 21 FX-translation OCI deferred to multi-currency slice; comparative-period arithmetic for cash-flow movements is operating-section only at v0; investing/financing comparatives at downstream slice. Forward-link to build-proposal Slice 7 (prudential-return suite — BA 100/110/120/200/210/300/326/330/350/410/900-series, each thin generator on top of Slice 6 IFRS projections) and Slice 8 (AFS skeleton — recon harnesses for AFS-trial-balance tie + consolidation-elimination tie). No changes to event-types.ts, registry.ts, period-close.ts, semantic/entries.ts, semantic/liquidity-entries.ts, semantic/capital-entries.ts, projections/runtime.ts, dashboard/derive.ts, BA 325 module, or BA 700 module (respect parallel work — Phase D scenario extension in scenarios/03-*.ts; W2 Slice 4 stress engine in distinct code area; WS-JS-NUMBER-RECONCILIATION). Distinct files (ifrs-*.ts vs ba-*.ts) avoid concurrency on shared infrastructure.",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_bea-atlas_d-reporting-capability-slice-6-ifrs-statements.md",
  asOf: "2026-05-10T18:00:00.000Z",
};

function main(): number {
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(ENTRY.decisionId)) {
    logger.info({ decisionId: ENTRY.decisionId }, "skipped (event already exists)");
    return 0;
  }

  recordCeoDecision(
    {
      decisionId: ENTRY.decisionId,
      action: ENTRY.action,
      title: ENTRY.title,
      outcome: ENTRY.outcome,
      actor: "marc@tgv.co.za",
      comment: ENTRY.comment,
      sourceDoc: ENTRY.sourceDoc,
      recordedVia: "script:record-d-reporting-capability-slice-6",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
