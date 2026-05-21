// scenarios/_phase-d-helpers.ts
//
// Phase-D helpers — build BA returns at period close for the first dry-run
// scenario (`scenarios/03-fx-end-to-end-rehearsal.ts`).
//
// Authority: D-FIRST-DRY-RUN-SCENARIO §5 Phase D (CEO-approved 2026-05-10).
// Pack: `Owner Inbox/actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-
//   scenario-design.md`.
//
// What Phase D does (per pack §5):
//   - At period-end (immediately after Phase B's `AccountingPeriodClosed`),
//     generate four SARB BA returns from the post-close trial balance:
//       * BA 325 (LCR)              — Reporting Slice 3
//       * BA 700 (Capital Adequacy) — Reporting Slice 4
//       * BA 350 (Market Risk)      — Reporting Slice 5
//       * BA 600 (Operational Risk) — Reporting Slice 5
//   - Render each BA as canonical (deterministic) JSON; for BA 350 / BA 600
//     also produce the SARB-XML (per Reporting Slice 5).
//   - Tag every render with the scenario provenance:
//       { kind: "simulated", scenario: "first-dry-run-2026-Q1",
//         sourceLineage: "scenario:03-fx-end-to-end-rehearsal:phase-d" }
//   - Write each render to `.local/dry-run-outputs/<period>/ba-XXX.json`
//     (gitignored runtime path); also store in the per-run BLAKE3 doc store
//     and emit a typed `RecordFiled` event linking the report-hash to the
//     scenario.
//
// Substrate gaps (forward-link in the decision record):
//   1. **Real classifications.** The BA 325 / BA 350 / BA 600 generators
//      take caller-supplied classification + position inputs. Until Mira's
//      WS-INSTRUMENT-ANALYSES + Reporting Slice 6 expand the semantic-layer
//      registry, the scenario uses rehearsal-grade fixtures derived from
//      Phase A+B's own footprint (USD nostro = HQLA-Level-1 placeholder;
//      ZAR nostro = inflow placeholder; FX revaluation row excluded from
//      LCR; long USD net = BA 350 FX position; etc.). Fixture origin is
//      surfaced in each render's `placeholders` field.
//   2. **Real RWA inputs.** The BA 700 generator takes a typed
//      `RwaDecomposition` directly. The W2 Slice 3 RWA engine (PR #177) is
//      merged but takes its own typed inputs (CreditExposure / TradingBookPosition
//      / BusinessIndicatorInput) — wiring the engine into the scenario is
//      a future slice (forward-link in the decision record). For Phase D
//      we pass a fixture `RwaDecomposition` with `source: "fixture-rehearsal"`
//      so the placeholder origin is obvious in the rendered output.
//   3. **No `ReportGenerated` event family yet.** Reporting Slice 5 plans a
//      typed `ReportGenerated` event that hashes the rendered bytes and
//      cites the trial-balance snapshot event_id. Until it lands, Phase D
//      uses RMS Slice 1's `RecordFiled` event (which carries
//      `documentHash` + `registerKey: "documents"`) as the equivalent
//      content-addressed link. When `ReportGenerated` lands the helpers
//      switch to it (mechanical; the document-store hash is the same).
//
// Authors:
//   - Bea (Accounting & financial reporting engineer, engineering — reports
//     to Camille CFO; BA-form generator inputs + render contract)
//   - Tomas (Operations & payments engineer, engineering — reports to Devon
//     COO; output-path / runtime-write / provenance-stamp leg)

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { ClosePeriodResult } from "@platform/accounting/period-close";
import type { Actor } from "@platform/core/types";
import { LocalFsDocumentStore } from "@platform/document-store";
import type { DocumentStore, PutResult } from "@platform/document-store";
import { makeRecordFiled } from "@platform/event-store/event-types";
import type { ProvenanceTag } from "@platform/event-store/provenance";
import type { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";
import {
  type AccountCapitalClassification,
  type AccountLiquidityClassification,
  type Ba325Output,
  type Ba350Output,
  type Ba600Output,
  type Ba700Output,
  type OpRiskGrossIncomeRow,
  type RegulatoryDeduction,
  type RwaDecomposition,
  ba350ToXmlPayload,
  ba600ToXmlPayload,
  generateBa325Lcr,
  generateBa350MarketRisk,
  generateBa600OpRisk,
  generateBa700Capital,
  generateBa700CapitalFromEvents,
  renderBa325Canonical,
  renderBa700Canonical,
  renderSarbXml,
} from "@platform/reporting";

// ---------------------------------------------------------------------------
// Constants — the four BA forms Phase D produces.
// ---------------------------------------------------------------------------

export const PHASE_D_FORMS = ["ba-325", "ba-700", "ba-350", "ba-600"] as const;
export type PhaseDForm = (typeof PHASE_D_FORMS)[number];

// Matches the registered `scenario-runner:<name>` pattern in
// `prototype/platform/event-store/provenance-lineage.registry.ts` (the
// regex disallows additional colons, so phase-d hangs off the name with a
// dash, not a colon).
export const PHASE_D_SOURCE_LINEAGE = "scenario-runner:03-fx-end-to-end-rehearsal-phase-d";

// Fixed renderedAt timestamp — Phase D uses the period-end + 5min so two
// runs over the same scenario produce byte-identical bytes (deterministic
// rehearsal). Real production renderers stamp the wall-clock.
export const PHASE_D_RENDERED_AT = "2026-01-31T15:05:00.000Z";

// ---------------------------------------------------------------------------
// Shared inputs derived from Phase A+B's footprint.
// ---------------------------------------------------------------------------

export interface PhaseDInputs {
  readonly entity: string;
  readonly asOf: string;
  readonly periodId: string;
  readonly functionalCurrency: string;
  /**
   * Trial-balance rows — used for BA 325 (LCR) and as the fallback for
   * BA 700 capital stock when `eventStore` is not supplied.
   *
   * @deprecated for BA 700 — use `eventStore` + `periodStart`/`periodEnd`
   * for the P1-compliant path (C-3 fix). Authority: Principles/1-events-are-truth.md.
   */
  readonly trialBalance: ClosePeriodResult["trialBalance"]["rows"];
  readonly trialBalanceSnapshotEventId?: string;
  /**
   * Event store — required for all P1-compliant BA return paths (C-1/C-2/C-3):
   * BA 325 folds FxSettlementInstructed/TradeMatured; BA 700 folds
   * SubLedgerPostingEmitted + CapitalContributionRecorded; BA 350 folds
   * FxTradeExecuted. Authority: Principles/1-events-are-truth.md.
   */
  readonly eventStore: EventStore;
  /**
   * ISO 8601 — start of the accounting/stress window for all event folds.
   */
  readonly periodStart: string;
  /**
   * ISO 8601 — end of the window (typically = asOf).
   */
  readonly periodEnd: string;
}

// ---------------------------------------------------------------------------
// BA 325 — LCR fixture inputs.
//
// Phase A+B's footprint at month-end:
//   - USD nostro stub (ACC-usd-nostro-stub) holds USD 5m  — debit (asset).
//     Treat as Level-1 HQLA proxy for the rehearsal (fixture; real
//     classification is "deposit at correspondent bank" which is *not*
//     Level-1 — substrate gap #1 above).
//   - ZAR nostro stub (ACC-zar-nostro-stub) holds ZAR -92.5m — credit.
//     Negative = debt-funded position; treated as no-LCR-relevance.
//   - FX revaluation P&L stub — equity-side; no LCR relevance.
//   - FX position stubs — trading-book; no LCR relevance under simplified
//     rehearsal classification.
//
// Outflows: ZAR 50m fixture (rehearsal-grade — represents an unsecured
//   wholesale outflow scenario per BCBS D295 §111-§115; the 100% run-off
//   rate matches non-operational wholesale deposits). This makes the LCR
//   numerator binding rather than denominator-floor.
// Inflows: ZAR 10m fixture from contractual maturities; capped at 75% of
//   outflows.
// ---------------------------------------------------------------------------

export const BA_325_FIXTURE_CLASSIFICATIONS: readonly AccountLiquidityClassification[] = [
  // USD nostro (asset side) — fixture HQLA Level-1 (real classification:
  // correspondent-bank deposit, not Level-1; rehearsal placeholder).
  {
    leafAccountId: "ACC-usd-nostro-stub",
    hqlaLevel: "level-1",
    subCategory: "level-1.fixture-nostro-rehearsal-only",
  },
  // FX-pending settlement — short-term inflow proxy (rehearsal).
  {
    leafAccountId: "ACC-fx-pending-settlement-stub",
    inflowRate: 1.0,
    subCategory: "inflow.contractual-receivable-fixture",
  },
];

// ---------------------------------------------------------------------------
// BA 700 — Capital classification + RWA fixture.
//
// Phase A's CapitalContributionRecorded posts +R300m to ACC-ZAR-CAPITAL-001
// — but that account does NOT appear in the post-close trial balance because
// `CapitalContributionRecorded` is not (yet) a sub-ledger-posting event in
// the M1 stub posting-rules engine (substrate gap §3 of Phase B). For Phase
// D, classify the balance-sheet equity proxy via a synthetic CET1 stock
// fixture line of R300m so the BA 700 capital-adequacy ratios are
// non-trivially populated.
// ---------------------------------------------------------------------------

export const BA_700_FIXTURE_CLASSIFICATIONS: readonly AccountCapitalClassification[] = [
  // P1-compliant path (C-3 fix): classify the account that actually appears
  // in Phase A's CapitalContributionRecorded event (ACC-ZAR-CAPITAL-001).
  // The events-first adapter (`generateBa700CapitalFromEvents`) folds the
  // CapitalContributionRecorded event with this accountId to derive capital stock.
  // Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
  {
    leafAccountId: "ACC-ZAR-CAPITAL-001",
    capitalTier: "cet1",
    subCategory: "cet1.paid-up-ordinary-shares",
  },
  // Legacy stub account — kept for backward compatibility with the deprecated
  // trial-balance fallback path. The events-first path will yield 0 for this
  // account (no events reference it); the CapitalContributionRecorded events
  // use ACC-ZAR-CAPITAL-001 above.
  {
    leafAccountId: "ACC-equity-paid-up-capital-stub",
    capitalTier: "cet1",
    subCategory: "cet1.paid-up-ordinary-shares-fixture",
  },
];

export const BA_700_FIXTURE_DEDUCTIONS: readonly RegulatoryDeduction[] = [];

/**
 * Fixture RWA — R1.5bn credit + R1.0bn market + R500m operational =
 * R3.0bn total (in minor units: 300_000_000_000). With a synthetic R300m
 * CET1 base (per `BA_700_SYNTHETIC_CET1_ROW` below), the resulting CET1
 * ratio = R300m / R3bn = 10.00% — comfortably above the Reg 38(2) all-in
 * 7% minimum (4.5% base + 2.5% CCB) but below a "trivially compliant"
 * threshold so the rehearsal shows a meaningful headline metric. The
 * source label keeps the placeholder-origin obvious.
 *
 * Forward-link: the W2 Slice 3 RWA engine (PR #177 — `computeRwa`) produces
 * the same shape from typed `CreditExposure` / `TradingBookPosition` /
 * `BusinessIndicatorInput` inputs. Wiring is a future slice; the typed
 * input shape on `generateBa700Capital` is unchanged.
 */
export const BA_700_FIXTURE_RWA: RwaDecomposition = {
  creditRwaMinor: 1_500_000_000_00, // R1.5bn
  marketRwaMinor: 1_000_000_000_00, // R1.0bn
  operationalRwaMinor: 500_000_000_00, // R500m
  source: "fixture-rehearsal:phase-d",
};

/**
 * Synthetic CET1 stock — R300m to mirror Phase A's CapitalContributionRecorded.
 * Inserted into the BA 700 input via a synthetic trial-balance row so the
 * generator's capital-stack projection produces a non-zero CET1 stock.
 * Substrate gap #1 (real classifications come from semantic-layer expansion).
 */
export const BA_700_SYNTHETIC_CET1_ROW = {
  leafAccountId: "ACC-equity-paid-up-capital-stub",
  currency: "ZAR",
  amountMinor: -300_000_000_00, // negative = credit-side (equity)
} as const;

// ---------------------------------------------------------------------------
// BA 350 — Market-risk fixture inputs.
//
// Phase A+B's open USD position at month-end: long USD 5m (settled into USD
// nostro). Converted to ZAR functional ccy at month-end rate 18.45:
//   USD 5m × 18.45 = ZAR 92.25m → 9_225_000_000 minor units.
// All other positions zero (the scenario doesn't trade equity, IR, or
// commodity).
// ---------------------------------------------------------------------------

const PHASE_D_FX_NET_USD_FUNCTIONAL_MINOR = 9_225_000_000; // R92.25m

export const BA_350_FIXTURE_FX_POSITIONS = [
  { currency: "USD", netPositionFunctionalMinor: PHASE_D_FX_NET_USD_FUNCTIONAL_MINOR },
] as const;

// ---------------------------------------------------------------------------
// BA 600 — Operational-risk fixture inputs.
//
// Build-phase has no real 3-year gross-income history (no commencement of
// trading per `project_rules_bind_at_commencement`). The fixture supplies a
// minimal positive-year row so the BIA arithmetic produces a non-zero
// capital figure — exercises the engine end-to-end without misrepresenting
// reality (the `placeholders` field in the output makes the rehearsal
// origin obvious).
// ---------------------------------------------------------------------------

export const BA_600_FIXTURE_GROSS_INCOME: readonly OpRiskGrossIncomeRow[] = [
  // Single positive-year row — BIA capital = 15% × R10m = R1.5m.
  // Satisfies BIA's `nPositiveYears > 0` condition.
  { fiscalYear: "2024", businessLine: "trading-and-sales", grossIncomeMinor: 10_000_000_00 },
];

// ---------------------------------------------------------------------------
// Generator — produces all four BA outputs from PhaseDInputs.
// ---------------------------------------------------------------------------

export interface PhaseDGenerated {
  readonly ba325: Ba325Output;
  readonly ba700: Ba700Output;
  readonly ba350: Ba350Output;
  readonly ba600: Ba600Output;
}

export function generatePhaseDReports(inputs: PhaseDInputs): PhaseDGenerated {
  // P1-compliant: cash flows folded from FxSettlement events in the event
  // store; trial balance used for HQLA stock only.
  // Citation: Principles/1-events-are-truth.md (updated 2026-05-12).
  const ba325 = generateBa325Lcr({
    entity: inputs.entity,
    asOf: inputs.asOf,
    periodId: inputs.periodId,
    functionalCurrency: inputs.functionalCurrency,
    eventStore: inputs.eventStore,
    periodStart: inputs.periodStart,
    periodEnd: inputs.periodEnd,
    trialBalance: inputs.trialBalance,
    classifications: BA_325_FIXTURE_CLASSIFICATIONS,
    ...(inputs.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: inputs.trialBalanceSnapshotEventId }
      : {}),
  });

  // BA 700 — P1-compliant path (C-3 fix): fold SubLedgerPostingEmitted +
  // CapitalContributionRecorded events directly when eventStore is available.
  // Falls back to augmented-trial-balance path (deprecated) when not.
  // Authority: Principles/1-events-are-truth.md, D-MARKETS-CAPITAL-TIME-SHAPE.
  let ba700: Ba700Output;
  if (inputs.eventStore && inputs.periodStart && inputs.periodEnd) {
    ba700 = generateBa700CapitalFromEvents(inputs.eventStore, {
      entity: inputs.entity,
      asOf: inputs.asOf,
      periodId: inputs.periodId,
      functionalCurrency: inputs.functionalCurrency,
      periodStart: inputs.periodStart,
      periodEnd: inputs.periodEnd,
      classifications: BA_700_FIXTURE_CLASSIFICATIONS,
      deductions: BA_700_FIXTURE_DEDUCTIONS,
      rwa: BA_700_FIXTURE_RWA,
    });
  } else {
    // Deprecated fallback: augment the trial balance with a synthetic CET1-equity
    // row so the capital-stack projection is non-trivially populated.
    // Substrate gap §1 above; real CET1 derivation comes from chart-of-accounts
    // capitalTier field at Reporting Slice 6+.
    const augmentedTb = [...inputs.trialBalance, BA_700_SYNTHETIC_CET1_ROW];
    ba700 = generateBa700Capital({
      entity: inputs.entity,
      asOf: inputs.asOf,
      periodId: inputs.periodId,
      functionalCurrency: inputs.functionalCurrency,
      trialBalance: augmentedTb,
      classifications: BA_700_FIXTURE_CLASSIFICATIONS,
      deductions: BA_700_FIXTURE_DEDUCTIONS,
      rwa: BA_700_FIXTURE_RWA,
      ...(inputs.trialBalanceSnapshotEventId
        ? { trialBalanceSnapshotEventId: inputs.trialBalanceSnapshotEventId }
        : {}),
    });
  }

  const ba350 = generateBa350MarketRisk({
    entity: inputs.entity,
    asOf: inputs.asOf,
    periodId: inputs.periodId,
    functionalCurrency: inputs.functionalCurrency,
    irGeneralMaturityLadder: [],
    irSpecificRisk: [],
    equity: [],
    fxPositions: BA_350_FIXTURE_FX_POSITIONS,
    commodity: [],
    ...(inputs.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: inputs.trialBalanceSnapshotEventId }
      : {}),
  });

  const ba600 = generateBa600OpRisk({
    entity: inputs.entity,
    asOf: inputs.asOf,
    periodId: inputs.periodId,
    functionalCurrency: inputs.functionalCurrency,
    grossIncome: BA_600_FIXTURE_GROSS_INCOME,
    approach: "bia",
    ...(inputs.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: inputs.trialBalanceSnapshotEventId }
      : {}),
  });

  return { ba325, ba700, ba350, ba600 };
}

// ---------------------------------------------------------------------------
// Renderers — produce canonical bytes for each BA. JSON for all four; XML
// for BA 350 / BA 600 (per Reporting Slice 5 design).
// ---------------------------------------------------------------------------

export interface PhaseDRendered {
  readonly ba325Json: string;
  readonly ba700Json: string;
  readonly ba350Json: string;
  readonly ba350Xml: string;
  readonly ba600Json: string;
  readonly ba600Xml: string;
}

export function renderPhaseDReports(generated: PhaseDGenerated): PhaseDRendered {
  // BA 325 + BA 700 have typed canonical-JSON renderers (Slice 3+4).
  const ba325 = renderBa325Canonical(generated.ba325, { renderedAt: PHASE_D_RENDERED_AT });
  const ba700 = renderBa700Canonical(generated.ba700, { renderedAt: PHASE_D_RENDERED_AT });

  // BA 350 + BA 600 ship XML adapters (Slice 5). For JSON we serialise the
  // typed Output directly (deterministic via sorted-keys).
  const ba350Json = canonicaliseAsJson(generated.ba350);
  const ba600Json = canonicaliseAsJson(generated.ba600);

  const ba350XmlPayload = ba350ToXmlPayload(generated.ba350);
  const ba350Xml = renderSarbXml(ba350XmlPayload, { renderedAt: PHASE_D_RENDERED_AT });

  const ba600XmlPayload = ba600ToXmlPayload(generated.ba600);
  const ba600Xml = renderSarbXml(ba600XmlPayload, { renderedAt: PHASE_D_RENDERED_AT });

  return {
    ba325Json: ba325.canonicalJson,
    ba700Json: ba700.canonicalJson,
    ba350Json,
    ba350Xml,
    ba600Json,
    ba600Xml,
  };
}

/**
 * Deterministic JSON serialisation — walks the value, sorts object keys
 * recursively, then `JSON.stringify`s with two-space indent (mirroring the
 * Slice-3 / Slice-4 BA-render canonicalisation pattern). Used for BA 350 /
 * BA 600 where Slice 5 ships the XML adapter but no typed JSON renderer.
 */
function canonicaliseAsJson(value: unknown): string {
  return JSON.stringify(sortKeys(value), null, 2);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object" && !(value instanceof Date)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const out: Record<string, unknown> = {};
    for (const k of keys) out[k] = sortKeys(obj[k]);
    return out;
  }
  return value;
}

// ---------------------------------------------------------------------------
// Output writer — writes each BA to disk + stores in the BLAKE3 doc store
// + emits a typed `RecordFiled` event linking the report-hash to the
// scenario.
// ---------------------------------------------------------------------------

export interface PhaseDWriteResult {
  readonly form: PhaseDForm;
  readonly outputPath: string;
  readonly documentHash: string;
  readonly recordFiledEvent: Event;
}

export interface PhaseDWriteOptions {
  readonly entity: string;
  readonly periodId: string;
  readonly outputDir: string;
  readonly documentStore: DocumentStore;
  readonly eventStore: EventStore;
  readonly provenance: ProvenanceTag;
  readonly actor: Actor;
  readonly asOf: string;
  /** Citation set for the RecordFiled envelope (Principle 2). */
  readonly citations: readonly string[];
}

/**
 * Write a single BA render to disk (output path is created if missing),
 * store the canonical bytes in the BLAKE3 doc store, and emit a
 * `RecordFiled` event linking the report-hash to the scenario. Returns the
 * write-result with the on-disk path + document-hash + emitted event.
 *
 * The `RecordFiled` event carries the scenario provenance tag (assigned via
 * post-construction stamp — `makeRecordFiled` does not yet take a
 * provenance arg).
 */
export function writePhaseDReport(args: {
  readonly form: PhaseDForm;
  readonly canonicalBytes: string;
  readonly options: PhaseDWriteOptions;
}): PhaseDWriteResult {
  const { form, canonicalBytes, options } = args;

  // Ensure output directory exists.
  mkdirSync(options.outputDir, { recursive: true });

  const outputPath = join(options.outputDir, `${form}.json`);
  writeFileSync(outputPath, canonicalBytes, "utf8");

  // Store in the BLAKE3 doc store.
  const put: PutResult = options.documentStore.put(canonicalBytes);

  // Emit RecordFiled event with the report-hash. Per spec §3.8 the
  // registerKey for a filed report is `documents`. Classification is
  // `governance-seat` (BA returns surface to CFO/CRO). Retention 5 years
  // per Companies Act 71 of 2008 §24 + Banks Act 94 of 1990 records-
  // retention regime. The doc-hash on the event matches the doc-store hash.
  const recordId = `record:documents:${options.periodId}:${form}`;
  const recordFiledEvent = makeRecordFiled({
    asOf: options.asOf,
    entity: options.entity,
    actor: options.actor,
    citations: [...options.citations],
    payload: {
      recordId,
      registerKey: "documents",
      documentHash: put.hash,
      classification: "governance-seat",
      retention: {
        citationRef: "COMPANIES-ACT-71-2008-S24",
        minimumYears: 5,
        archivalTier: "archive",
      },
    },
  });

  // Stamp provenance — makeRecordFiled does not take a provenance arg in
  // its current signature; assign post-construction so the scenario tag
  // travels with the event.
  const stamped: Event = { ...recordFiledEvent, provenance: options.provenance };
  options.eventStore.append(stamped);

  return { form, outputPath, documentHash: put.hash, recordFiledEvent: stamped };
}

/**
 * Phase-D end-to-end: generate the four BAs, render each, write each to
 * disk + doc-store + emit `RecordFiled` events. Returns one result per
 * form in `PHASE_D_FORMS` order.
 */
export function runPhaseD(args: {
  readonly inputs: PhaseDInputs;
  readonly options: PhaseDWriteOptions;
}): {
  readonly generated: PhaseDGenerated;
  readonly rendered: PhaseDRendered;
  readonly writeResults: readonly PhaseDWriteResult[];
} {
  const generated = generatePhaseDReports(args.inputs);
  const rendered = renderPhaseDReports(generated);

  const writeResults: PhaseDWriteResult[] = [];
  for (const form of PHASE_D_FORMS) {
    const canonical = canonicalForForm(form, rendered);
    writeResults.push(
      writePhaseDReport({ form, canonicalBytes: canonical, options: args.options }),
    );
  }
  return { generated, rendered, writeResults };
}

function canonicalForForm(form: PhaseDForm, rendered: PhaseDRendered): string {
  switch (form) {
    case "ba-325":
      return rendered.ba325Json;
    case "ba-700":
      return rendered.ba700Json;
    case "ba-350":
      return rendered.ba350Json;
    case "ba-600":
      return rendered.ba600Json;
  }
}

// ---------------------------------------------------------------------------
// Per-run document-store factory — keeps Phase D's writes off the singleton
// so each scenario run is self-contained (mirrors the per-run EventStore
// pattern in `runPhaseAandB`).
// ---------------------------------------------------------------------------

export function makePhaseDDocumentStore(rootPath: string): LocalFsDocumentStore {
  return new LocalFsDocumentStore({ root: rootPath });
}
