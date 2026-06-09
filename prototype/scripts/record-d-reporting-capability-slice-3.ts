// scripts/record-d-reporting-capability-slice-3.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-3 —
// the BA 110 (LCR) end-to-end harness, the first SARB return rendered.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-3 sub-authorisation
// so the audit trail names it explicitly. No new CEO approval required
// per CLAUDE.md "Dispatch discipline" no-pause rule.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Eitan
//   (Treasurer, governance — reports to Camille CFO; LCR methodology
//   owner) · Anya (Data / analytics engineer, engineering — reports to
//   Devon COO; semantic-layer integration).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-3",
  action: "approve" as const,
  title:
    "Reporting capability Slice 3 — BA 110 LCR end-to-end (semantic + projection + JSON render + CLI)",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) + Eitan (Treasurer, governance — reports to Camille CFO; LCR methodology owner) + Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer integration) ship the first SARB return end-to-end. Six new liquidity-classification semantic entries (HqlaLevel1, HqlaLevel2A, HqlaLevel2B, LcrCashOutflows30D, LcrCashInflows30D, LiquidityCoverageRatio) extend the Slice 1 registry under the same SemanticEntry shape — each cites Banks Act 94/1990 §70 + Regulations Relating to Banks Reg 26 + BCBS D295, and carries one [citation: TBC] marker per pack §9 Q1 default pending Mira's WS-INSTRUMENT-ANALYSES SARB BA 110 published-schema ingestion. New @platform/reporting package lands two pure projections — generateBa300Lcr (typed Ba300LcrGeneratorInput → Ba300LcrOutput, with applyHqlaCaps closed-form 40%/15% cap arithmetic per BCBS D295 §47, 75% inflow cap per §142, 25% net-outflow floor) + renderBa300LcrToJson + canonicaliseBa300Lcr (deterministic key-sorted bytes, validated against Ba300LcrRenderSchema Zod schema, hash-store-friendly for downstream ReportGenerated events). CLI wrapper at scripts/render-ba-110.ts replays the event store, resolves the trial balance from periodAuditChain (Slice 2 substrate) or ad-hoc compute, applies a per-account liquidity-classification map (built-in default pins ACC-1100-001 → HQLA Level 1 per Slice 1's CashAndBalancesAtSARB worked entry), and writes canonical BA 110 JSON to stdout or --out. Per-entity isolation enforced — assertBankEntity throws on Hoz Securities / Hoz Group per D-REGULATORY-PERIMETER. Determinism witnessed via classificationsFingerprint + sortKeys canonicaliser. Tests: synthetic event-stream → period-close → BA 110 generation → JSON render with computed LCR; per-entity isolation refusal; HQLA cap-arithmetic regimes (no-cap, L2B-binding, L2A-binding); inflow cap binding; provenance passthrough via trialBalanceSnapshotEventId chain. M8 Azure mapping: rendered bytes lift to Azure Blob via the M8 RMS doc-store contract (PR #142 + spec §4.1); SARB-portal XML render (Slice 5) takes the canonical JSON as input contract; classification map migrates onto the chart-of-accounts schema (hqlaLevel + lcrOutflowCategory fields) at Slice 6+ once Mira's WS-INSTRUMENT-ANALYSES lands the SARB BA 110 published taxonomy. Substrate gaps surfaced: liquidity-projection executable form deferred to Slice 6 (v0 reads trial balance + supplied map directly); per-currency LCR per Reg 26(13) deferred to Slice 6 (v0 functional-currency only); BCBS 248 intraday liquidity monitoring is operational lens, not BA 110 input; live customer / wholesale / derivative balances populate at commencement-of-trading per project_rules_bind_at_commencement; Tier-1 LCR-model independent validation per RAS B7 gates production use post-licence-day. Forward-link to Slices 4-5 (BA 100 / BA 350 / BA 600 + regulator-portal handshake) and Slice 6+ (IFRS AFS skeleton + capital-stack + RWA projections). No changes to event-types.ts, registry.ts, period-close.ts, semantic/entries.ts, projections/runtime.ts, or dashboard/derive.ts (respect parallel work — Provenance Slice 3, RMS Slice 5, Phase B scenario script).",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 3; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_bea-eitan-anya_d-reporting-capability-slice-3-ba-110-lcr.md",
  asOf: "2026-05-10T14:00:00.000Z",
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
      recordedVia: "script:record-d-reporting-capability-slice-3",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
