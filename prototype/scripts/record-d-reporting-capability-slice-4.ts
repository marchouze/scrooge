// scripts/record-d-reporting-capability-slice-4.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-4 —
// the BA 700 (Capital Adequacy Return) end-to-end harness, the second SARB
// return rendered after BA 325 (Slice 3).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-4 sub-authorisation
// so the audit trail names it explicitly. No new CEO approval required
// per CLAUDE.md "Dispatch discipline" no-pause rule.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Atlas (Core
//   banking platform architect, engineering — substrate consult) · Anya
//   (Data / analytics engineer, engineering — reports to Devon COO;
//   semantic-layer integration).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-4",
  action: "approve" as const,
  title:
    "Reporting capability Slice 4 — BA 700 Capital Adequacy Return end-to-end (semantic + projection + JSON render + CLI)",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) + Atlas (Core banking platform architect, engineering — substrate consult; RWA-engine input contract) + Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer integration) ship the second SARB return end-to-end. Eight new capital-classification semantic entries (CommonEquityTier1Capital, AdditionalTier1Capital, Tier2Capital, RegulatoryCapitalDeductions, RiskWeightedAssets, CommonEquityTier1Ratio, Tier1CapitalRatio, TotalCapitalRatio) extend the Slice 1 + Slice 3 registry under the same SemanticEntry shape — each cites Banks Act 94/1990 §70 + Regulations Relating to Banks Reg 38 + BCBS Basel III §50–§90 / §122–§148, and carries one [citation: TBC] marker per pack §9 Q1 default pending Mira's WS-INSTRUMENT-ANALYSES SARB BA 700 published-schema ingestion. New @platform/reporting Slice-4 module lands two pure projections — generateBa700Capital (typed Ba700GeneratorInput → Ba700Output, with per-tier deduction arithmetic CET1/AT1/T2, three-ratio composition CET1/Tier1/Total, BUILD_PHASE_DEFAULT_BUFFER_REQUIREMENTS overlay BCBS 4.5%/6%/8% + 2.5% CCB, computeRequiredMinimums helper for CCB+CCyB+D-SIB+Pillar-2A overlay) + renderBa700ToJson + canonicaliseBa700 (deterministic key-sorted bytes, validated against Ba700RenderSchema Zod schema, hash-store-friendly for downstream ReportGenerated events, ratios encoded as strings to preserve Infinity edge-case). CLI wrapper at scripts/render-ba-700.ts replays the event store, resolves the trial balance from periodAuditChain (Slice 2 substrate) or ad-hoc compute, applies per-account capital classifications + regulatory deductions + RWA decomposition (built-in build-phase fixture defaults — ACC-equity-position-stub → CET1, R30m fixture-rehearsal RWA), and writes canonical BA 700 JSON to stdout or --out. Per-entity isolation enforced — assertBankEntity throws on Hoz Securities (JSE-regulated) AND Hoz Group (consolidated lands at Slice 7) per D-REGULATORY-PERIMETER. Determinism witnessed via classificationsFingerprint + deductionsFingerprint + rwaFingerprint + sortKeys canonicaliser. Tests (28 / 28 passing): semantic-entry registration + co-existence with Slice 1; per-entity isolation triple-rejection (Securities, Group, invalid currency, negative RWA); required-minimum overlay (default + full overlays); end-to-end synthetic event-stream → period-close → BA 700 generation → JSON render with computed ratios (R3m gross CET1, R5k goodwill deduction, R30m RWA → 9.83% CET1 ratio, demonstrating the buffer-overlay is binding even for a well-capitalised bank); three-tier full-stack arithmetic (AT1 + T2 contribute correctly to Tier 1 / Total); net tier amount floored at 0 when deductions exceed gross; divide-by-zero RWA → infinity ratios with 'infinity' render encoding + compliant-by-convention; canonicaliser determinism + lexical-key-sort with $schema first; provenance passthrough via trialBalanceSnapshotEventId + rwaComputationEventId chain; generator boundary errors (duplicate classifications, multi-currency deduction rejection, negative deduction rejection, buffer-ratio bounds, base-ratio ordering). RWA-INPUT DEPENDENCY ON W2 SLICE 3: the generator accepts typed RwaDecomposition at v0 with caller-supplied fixture inputs; the W2 Slice 3 RWA engine (parallel dispatching now per pack §3) produces this exact shape once it lands — no generator API change at the integration boundary. Substrate gaps surfaced: capital-stack projection executable form deferred to Slice 6 (v0 reads trial balance + classifications/deductions directly); threshold-deduction arithmetic per Reg 38(8) 10%/15% buckets deferred to Slice 6 once chart-of-accounts deduction-tier classification lands; multi-currency capital (FX-translation OCI per BCBS §53) deferred to Slice 6; group-consolidated BA 700 (LE-ZA-HOZ-GROUP look-through per Banks Act §60) deferred to Slice 7; D-SIB classification + Pillar-2A SARB calibration deferred to W2 ICAAP cycle; RAS B2 +1.5pp management-buffer ratify-pathway tracked under W2 Slice 2 (separate parallel dispatch); live capital + retained-earnings populate at licence-day capital-call per project_ai_driven_bank. M8 Azure mapping: rendered bytes lift to Azure Blob via the M8 RMS doc-store contract (PR #142 + spec §4.1); SARB-portal XML render (Slice 5) takes the canonical JSON as input contract; capital-classification map migrates onto chart-of-accounts (capitalTier + deductionTier fields) at Slice 6+ once Mira's WS-INSTRUMENT-ANALYSES lands the SARB BA 700 published taxonomy. Forward-link to Slice 5 (BA 350/600 + XML), Slice 6 (capital-stack projection + threshold-deduction arithmetic), and Slice 7 (group-consolidated BA 700 + per-entity deconsolidation). No changes to event-types.ts, registry.ts, period-close.ts, semantic/entries.ts, semantic/liquidity-entries.ts, projections/runtime.ts, dashboard/derive.ts, or BA 325 module (respect parallel work — Reporting Slice 5, W2 Slice 2 RAS B2, W2 Slice 3 RWA, WS-JS-NUMBER-RECONCILIATION). Distinct files (ba-700-*.ts vs ba-325-*.ts) avoid concurrency on shared infrastructure.",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 4; no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_bea-atlas-anya_d-reporting-capability-slice-4-ba-700.md",
  asOf: "2026-05-10T16:00:00.000Z",
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
      recordedVia: "script:record-d-reporting-capability-slice-4",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
