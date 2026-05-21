// scripts/record-d-regulatory-readiness-w2-slice-3.ts
//
// One-shot: emit a CeoDecision event for D-REGULATORY-READINESS-W2-SLICE-3
// — the standardised-approach RWA engine + risk-weight semantic entries
// landing W2 Slice 3 of the regulatory-readiness gate plan.
//
// Standing authority: D-REGULATORY-READINESS-GATE-PLAN (CEO-approved
// 2026-05-10). This script records the slice-3 sub-authorisation so the
// audit trail names it explicitly. No new policy decision: per the
// no-pause rule (CLAUDE.md "Operating procedures"), downstream slices of
// an approved decision dispatch without per-item CEO confirmation.
//
// Run once; idempotent (skips ids already recorded).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line mapping owner) +
//   Camille (Chief Financial Officer, governance — reports to CEO;
//   capital-management owner, RWA-engine accountable) +
//   Atlas (Core banking platform architect, engineering — substrate consult
//   on projection contract + as-of replay).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

const ENTRY = {
  decisionId: "D-REGULATORY-READINESS-W2-SLICE-3",
  action: "approve" as const,
  title:
    "Regulatory-Readiness W2 Slice 3 — RWA engine (standardised approach) + risk-weight semantic entries",
  outcome:
    "Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) + Camille (Chief Financial Officer, governance — reports to CEO; capital-management owner) + Atlas (Core banking platform architect, engineering — substrate consult) ship the RWA engine producing actual numbers from typed exposure / trading-position / business-indicator inputs under the standardised approach per Reg 38 + BCBS Basel III/IV (CRE20 credit, MAR pre-FRTB market, OPE25 operational). Five new risk-weight + RWA semantic entries (RiskWeight, CreditRwa, MarketRwa, OperationalRwa, TotalRwa) extend the Slice-1 base + Slice-3-liquidity registry under the same SemanticEntry shape — each cites Banks Act 94/1990 §70 + Reg 38 + BCBS Basel III/IV + ORG-PR-01 + ORG-PR-31 (PA G3/2023 Basel implementation dates) + ORG-PR-33 (PA PC 18/2024 FRTB + CVA roadmap), and carries a [citation: TBC] marker per pack §9 Q1 default pending Mira's WS-INSTRUMENT-ANALYSES exact Reg 38 + BCBS sub-clause resolution. New @platform/risk package lands the pure-projection rwa-engine.ts — computeRwa(input): RwaEngineOutput aggregates credit (Σ EAD × standardised RW), market (12.5 × Σ notional × marketRW), operational (12.5 × BIC × ILM with BIC piecewise per BCBS OPE25 €1bn/€30bn thresholds, ILM=1 build-phase per Reg 38(11) optionality), CVA (passthrough zero placeholder for Reporting Slice 4 BA 600 to populate). standardisedRiskWeight(...) implements the BCBS CRE20 lookup (sovereign / MDB / bank / corporate-IG / corporate-non-IG / retail / residential-mortgage with LTV-step / commercial-real-estate / past-due / equity / other) including post-finalised-reforms 65% unrated-IG-corporate weight + LTV-step residential-mortgage table. Per-entity scope guard enforces Hoz Bank only at v0.1 (Hoz Securities is FSCA + JSE Member Rules scoped, distinct capital regime; Hoz Group consolidated reading loops back through Hoz Bank Limited per ORG-BNK-ICAAP-CONS) — assertBankEntity throws on non-bank entities. Per-asset-class isolation verified by tests — credit / market / operational compute independently and sum to total. Reporting Slice 4 (BA 700) integration contract is the documented RwaEngineOutput shape — totalRwaMinor (denominator of CET1 / AT1 / T2 ratios), credit.totalMinor (BA 700 credit-RWA cell), market.totalMinor (BA 700 market-RWA cell), operational.totalMinor (BA 700 operational-RWA cell), cvaMinor (BA 700 CVA-RWA cell), credit.lines + market.lines for per-exposure-class / per-risk-type decompositions consumed by BA 400 / BA 350 generators. Tests: 38 across 8 describes — semantic-entry registration co-existence with Slice-1 + Slice-3-liquidity entries; per-entity isolation refusal of Hoz Securities; CRE20 risk-weight table coverage (sovereign 0% / MDB 0% / bank 20% AAA-AA / corporate-IG 65% unrated / retail 75% / residential-mortgage LTV-step 20%-70% / past-due 150% / equity 250%); BIC piecewise (bucket-1 ≤€1bn / bucket-2 €1bn-€30bn / bucket-3 >€30bn) bind correctly; per-asset-class isolation; end-to-end synthetic fixture (R10m SARB sovereign + R1m bank + R2m IG corp credit; R5m IRD trading position; R150m BI) producing known total RWA R229.55m; CVA passthrough; boundary errors (negative EAD / notional / ILM / cvaRwaMinor; out-of-range marketRiskWeight; non-positive eurToFunctionalRate); Reporting Slice 4 API contract + determinism (same input ⇒ byte-identical output via JSON.stringify equality). 966 / 966 prototype tests pass. Substrate gaps surfaced: IRB foundation / advanced approaches deferred (semantic-entry shape supports parallel version-bumped registration); FRTB-SA full sensitivity-based methodology deferred per ORG-PR-33 PA PC 18/2024 1 July 2025 commencement; CCF tables for off-balance-sheet (CRE52) deferred — caller pre-computes EAD; SA-CCR for derivatives netting + add-ons deferred; Operational-Loss-Event substrate deferred — ILM=1 hard-coded per Reg 38(11); rwa-projection executable form named on semantic entries but engine accepts input directly at v0; optional RwaSnapshot event deferred (compute on demand chosen to avoid event-types.ts collision with Reporting Slice 4 + 5 + W2 Slice 2 parallel work); Tier-1 model validation by Nadia (Independent-validation engineer under Helena CRO) gates production use post-licence-day per RAS B7 model-tier classification. Coordination — single dispatch path per CLAUDE.md no-spawn-task-+-Agent rule; Reporting Slice 4 (BA 700) consumes via documented API contract; Reporting Slice 5 (BA 350 + BA 600) consumes market.lines + populates cvaRwaMinor; W2 Slice 2 (RAS B2 calibration) uses totalRwaMinor as fixture input. No changes to event-types.ts, registry.ts, period-close.ts, semantic/entries.ts, semantic/liquidity-entries.ts, dashboard/derive.ts, handlers-metadata.ts, handler-callables.ts, package.json (respect parallel work). Forward-link to Reporting Slice 4 (BA 700 capital adequacy generator) and Slice 5 (BA 350 + BA 340 + BA 400 per-asset-class returns).",
  comment:
    "downstream dispatch from D-REGULATORY-READINESS-GATE-PLAN (W2 Slice 3); no new policy decision",
  sourceDoc: "Owner Inbox/2026-05-10_bea-camille_w2-slice-3-rwa-engine.md",
  asOf: "2026-05-10T15:00:00.000Z",
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
      recordedVia: "script:record-d-regulatory-readiness-w2-slice-3",
    },
    ENTRY.asOf,
  );
  logger.info({ decisionId: ENTRY.decisionId, action: ENTRY.action }, "CeoDecision event emitted");
  return 0;
}

process.exit(main());
