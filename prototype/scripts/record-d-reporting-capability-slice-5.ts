// scripts/record-d-reporting-capability-slice-5.ts
//
// One-shot: emit a CeoDecision event for D-REPORTING-CAPABILITY-SLICE-5 —
// BA 350 (market risk) + BA 600 (operational risk) generators + the
// generic SARB-XML render layer.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-
// approved 2026-05-10). This script records the slice-5 sub-authorisation
// so the audit trail names it explicitly. No new CEO approval required
// per CLAUDE.md "Dispatch discipline" no-pause rule.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) · Atlas (Core
//   banking platform architect, engineering — reports to Devon COO;
//   render-layer infrastructure) · Anya (Data / analytics engineer,
//   engineering — reports to Devon COO; semantic-layer integration).

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REPORTING-CAPABILITY-SLICE-5",
  action: "approve" as const,
  title:
    "Reporting capability Slice 5 — BA 350 (market risk) + BA 600 (operational risk) + generic SARB-XML render layer",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) + Atlas (Core banking platform architect, engineering — reports to Devon COO; render-layer infrastructure) + Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer integration) ship two more SARB returns end-to-end and add the JSON-companion XML render layer per Marc's Q5 (JSON-first canonical; XML in parallel for SARB-portal submission compatibility). Six new market-risk semantic entries (InterestRateGeneralRisk, InterestRateSpecificRisk, EquityPositionRisk, ForeignExchangeRisk, CommodityRisk, MarketRiskRwa — citing Helena CRO methodology + BCBS D352 + Reg 28) and four new op-risk semantic entries (GrossIncomeBusinessLine, OpRiskCapitalBia, OpRiskCapitalTsa, OpRiskRwa — citing BCBS D196 + Reg 33) extend the registry under the Slice-1 SemanticEntry shape; each carries one resolved citation chain plus one [citation: TBC] marker per pack §9 Q1 default pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion. New @platform/reporting package modules: generateBa350MarketRisk (typed Ba350GeneratorInput → Ba350Output covering IR-general maturity-ladder, IR-specific issuer/rating, equity general+specific, FX net-open-position 8% × max(longs,shorts) with functional-ccy excluded, commodity simplified-method 15% net + 3% gross — total capital × 12.5 = market-risk RWA); generateBa600OpRisk (typed Ba600GeneratorInput → Ba600Output covering BIA 15% × 3-year positive-year average and TSA 1/3 × sum_y max(0, sum_i β_i × gi_i) with β factors {12%, 15%, 18%} per Reg 33(4) Annex; selectable approach; SMA forward-link as substrate gap); renderSarbXml (generic deterministic SARB-XML renderer over a typed SarbXmlReportPayload tree — sorted attributes, escape-correct, stable element-order, well-formedness-validated); validateSarbXmlStructural (pre-XSD structural recon — declares root/namespace/required-element checks until Mira lands the XSD substrate); ba350ToXmlPayload + ba600ToXmlPayload (thin adapters from generator output → XML payload). CLI wrappers at scripts/render-ba-350.ts + scripts/render-ba-600.ts replay the engine, accept a JSON inputs fixture (or empty default), and emit canonical XML to stdout or --out-xml. Per-entity isolation enforced — both generators throw on Hoz Securities / Hoz Group per D-REGULATORY-PERIMETER. Determinism witnessed via input-array order preservation + sorted-attribute serialisation. Tests: 50 new assertions across tests/ba-350-market-risk.test.ts + tests/ba-600-op-risk.test.ts + tests/xml-render.test.ts — semantic-entry registration coherence (10 entries, one TBC + one resolved per Q1, Hoz-Bank scope only); per-entity isolation refusal; per-sub-charge arithmetic (IR general maturity-ladder + disallowances; IR specific gross × weight; equity 8% net + (4% liquid|8% else) gross; FX 8% × max-side with functional excluded; commodity simplified 15% + 3%; RWA = 12.5 × capital); BIA positive-year exclusion + business-line aggregation; TSA per-year max(0,_) flooring + 1/3 averaging; XML well-formedness + envelope (xmlns + xsdUri + formVersion + renderedAt); structural validation pass + violation surfacing for missing element / wrong namespace; escape correctness for & < > in text and & < \" \\r \\n \\t in attributes; element-name validation; deterministic byte-identical XML across re-runs. M8 mapping: rendered XML bytes + JSON canonical bytes both hash-stored under the RMS doc-store contract (PR #142); SARB-portal simulator stub at prototype/simulators/sarb-prudential.ts is named by pack §6 Slice 5 + §7.3 as Mira's downstream tranche (not landed in this dispatch — XSD substrate + PA portal taxonomy ingestion is Mira's WS-INSTRUMENT-ANALYSES). Substrate gaps surfaced: liquidity / market-risk / income projection executable forms deferred to Slice 6 (v0 generators read caller-supplied input bundles directly); Mira's SARB-published-schema ingestion remains the [citation: TBC] resolution pathway for line-numbering; SMA (BCBS D424) replaces BIA / TSA op-risk approaches at SARB transition (Reg 33 revision tracked); per-currency LCR / per-currency market-risk deferred to Slice 6+; live trading-book + audited gross-income inputs populate at commencement-of-trading per project_rules_bind_at_commencement; Tier-1 model independent validation per RAS B7 gates production use post-licence-day. Forward-link to parallel Slice 4 dispatch (BA 700 IRRBB + rate-risk semantic family — distinct files, no collision) and to Slice 6 (capital-stack + LCR/NSFR + RWA projections). No changes to event-types.ts, registry.ts, period-close.ts, semantic/types.ts, semantic/registry.ts, projections/runtime.ts, dashboard/derive.ts, handlers-metadata.ts, handler-callables.ts, or package.json (respect parallel work).",
  comment:
    "downstream dispatch from D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (consolidating §6 Slice 4 BA 350+600 + §6 Slice 5 XML render); no new policy decision",
  sourceDoc:
    "Owner Inbox/2026-05-10_bea-atlas-anya_d-reporting-capability-slice-5-ba-350-600-xml.md",
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
      recordedVia: "script:record-d-reporting-capability-slice-5",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
