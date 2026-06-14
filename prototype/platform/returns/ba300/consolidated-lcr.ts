// platform/returns/ba300/consolidated-lcr.ts
//
// Consolidated-level BA 300 LCR computation engine — closes the build half of
// `GAP-LCR-CONSOLIDATION-ENGINE` (liquidity-risk-management policy §11.5).
//
// ## What this is
//
// The solo BA 300 LCR substrate (`platform/reporting/ba-300-lcr.ts`, wired to
// period-close by Wave A of WS-RETURNS-SUBMISSION-WIRING, PR #1180) computes
// the LCR for a single bank-licence entity. PA Directive 1 of 2022 §4.1.2
// additionally requires the LCR on a **consolidated** (banking-group) basis.
// The consolidation rules were discharged at the policy layer by
// `Policies/liquidity-risk-management-policy-v1.md` §2.6 (Helena's v1.2,
// PR #1132, finding `F-HELENA-20260608-XF2F` policy half); the computation
// engine was tracked as the explicit substrate follow-on
// `GAP-LCR-CONSOLIDATION-ENGINE`. This module is that engine.
//
// ## The §2.6 / D1/2022 §4.1.2 rules implemented
//
//   1. Inclusion scope (`ORG-PR-LCR-003`, D1/2022 §4.1.2.1–§4.1.2.4):
//      only banking / deposit-taking entities enter the consolidated LCR.
//      Perimeter is resolved from the **versioned legal-entity tree**
//      (Principle 5; `seeds/legal-entity-tree.json`, D-LEGAL-ENTITY-TREE-V0)
//      by `resolveLcrConsolidationPerimeter`: an entity is in scope iff its
//      `regulatoryRegime.primaryRegulator === "PA"` (a Banks Act licence is
//      what makes an entity deposit-taking in the current tree). Hoz
//      Securities (JSE) and Hoz Group (holding company) are excluded.
//   2. Summation + entity-level HQLA cap (`ORG-PR-LCR-004`, D1/2022 §4.1.2.5):
//      individual net cash outflows and HQLA portfolios are summed. A
//      non-home entity's HQLA counts only up to the lower of its
//      jurisdiction's minimum LCR requirement or the home minimum, applied to
//      that entity's post-elimination net cash outflows; **excess** HQLA is
//      included only once Eitan (Treasurer, governance) has assessed it as
//      freely transferable/convertible (`excessHqlaTransferabilityAssessed`).
//      The home consolidating entity's own HQLA is included in full — the
//      cap exists to stop trapped subsidiary liquidity inflating the group
//      ratio, and the parent's stock is by construction available to itself.
//   3. Intragroup elimination (`ORG-PR-LCR-005`, D1/2022 §4.1.2.7):
//      intragroup transactions between in-perimeter entities are eliminated
//      via an explicit, validated `IntragroupElimination[]` schedule
//      (symmetric: the payer's outflow and the receiver's inflow).
//   4. Group-basis inflow cap (`ORG-PR-LCR-006`, D1/2022 §4.1.2.8): inflows
//      are capped at 75% of gross outflows **on a group consolidated basis**,
//      not at entity level — entity-level solo caps are NOT re-used here.
//   5. Rand reporting (`ORG-PR-LCR-007`, D1/2022 §3.1, §4.1.2.10): every solo
//      input must already be expressed in the ZAR reporting currency; the
//      engine rejects anything else.
//   6. Monthly cadence (`ORG-PR-LCR-008`, D1/2022 §4.1.2.11–§4.1.2.12): the
//      output carries `cadence: "monthly"` meta; scheduling is owned by the
//      period-close flow that invokes the engine.
//
// ## Solo-consistency invariant (golden reconciliation)
//
// With a single-entity perimeter and an empty elimination schedule the
// consolidated output reproduces the solo output exactly (same cap function,
// same rounding conventions: `floor` on the 75% inflow cap, `ceil` on the 25%
// net-outflow floor). With N entities:
//
//   consolidated gross flows = Σ solo gross flows − intragroup eliminations
//
// asserted by the golden test in `consolidated-lcr.test.ts`. The current tree
// has exactly ONE banking entity (Hoz Bank), so the multi-entity path is
// exercised by a synthetic-second-entity TEST fixture only — no entity is
// fabricated into production seeds.
//
// ## Principle 5
//
// Multi-entity from day one: the perimeter is a query over the versioned
// legal-entity tree, not a hard-coded list. When a second banking entity is
// registered (`LegalEntityRegistered` with a PA regime), it enters the
// perimeter without an engine change; only its jurisdiction minimum and
// transferability assessment need supplying.
//
// Citations:
//   PA Directive 1 of 2022 §4.1.2 (consolidation rules), §3.1 (Rand);
//   Regulations Relating to Banks Reg 26 (LCR), Reg 36 (consolidated
//     supervision inclusion);
//   BCBS D295 §142 (75% inflow cap), §47 (level caps);
//   Policies/liquidity-risk-management-policy-v1.md §2.6
//     (ORG-PR-LCR-003/004/005/006/007/008);
//   GAP-LCR-CONSOLIDATION-ENGINE (policy §11.5, build half);
//   D-QUEUE-CLOSEOUT-2026-06-10 (CEO-approved 2026-06-10);
//   D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER (perimeter source).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO) + Eitan (Treasurer, governance — transferability
//   assessment owner); methodology per Helena (Chief Risk Officer,
//   governance) policy v1.2 §2.6.

import { type Money, amountToMinorUnits } from "../../core/decimal-money";
import type { Currency } from "../../core/types";
import { type Ba300LcrOutput, applyHqlaCaps } from "../../reporting/ba-300-lcr";

// ---------------------------------------------------------------------------
// Cited constants — no magic numbers
// ---------------------------------------------------------------------------

/**
 * Group-basis inflow cap: total inflows count at most 75% of gross outflows,
 * applied on a consolidated basis (NOT per entity).
 * Citation: ORG-PR-LCR-006; D1/2022 §4.1.2.8; BCBS D295 §142; Reg 26(11).
 */
export const GROUP_INFLOW_CAP_RATIO = 0.75;

/**
 * Net-cash-outflow floor: net outflows are floored at 25% of gross outflows
 * (the arithmetic complement of the 75% inflow cap, kept explicit so the
 * floor-binding indicator matches the solo generator).
 * Citation: BCBS D295 §69 (denominator definition); Reg 26(11).
 */
export const NET_CASH_OUTFLOW_FLOOR_RATIO = 0.25;

/**
 * Home-jurisdiction (SA) minimum LCR requirement: 100%.
 * Citation: Reg 26(2); D1/2022 §2.1; BCBS D295 §17 (post-2019 phase-in).
 */
export const HOME_JURISDICTION_MINIMUM_LCR_RATIO = 1.0;

/**
 * Reporting currency for the consolidated LCR: Rand, all components converted.
 * Citation: ORG-PR-LCR-007; D1/2022 §3.1 + §4.1.2.10.
 */
export const CONSOLIDATED_LCR_REPORTING_CURRENCY = "ZAR";

/**
 * Consolidated-calculation cadence: monthly, month-end group position.
 * Citation: ORG-PR-LCR-008; D1/2022 §4.1.2.11–§4.1.2.12.
 */
export const CONSOLIDATED_LCR_CADENCE = "monthly";

/** Citations carried on every consolidated output (Principle 2). */
const CONSOLIDATED_LCR_CITATIONS: readonly string[] = [
  "PA Directive 1 of 2022 §4.1.2",
  "Regulations Relating to Banks Reg 26",
  "Regulations Relating to Banks Reg 36",
  "BCBS D295 §142",
  "Policies/liquidity-risk-management-policy-v1.md §2.6 (ORG-PR-LCR-003/004/005/006/007/008)",
  "GAP-LCR-CONSOLIDATION-ENGINE (build-half closure)",
  "D-QUEUE-CLOSEOUT-2026-06-10",
];

// ---------------------------------------------------------------------------
// Perimeter resolution (ORG-PR-LCR-003) — query over the versioned tree
// ---------------------------------------------------------------------------

/**
 * The slice of a legal-entity-tree node the perimeter resolution needs.
 * Structurally compatible with `seeds/legal-entity-tree.json` entries and
 * with `LegalEntityRegisteredPayload`
 * (`platform/event-store/event-types/legal-entity.ts`) — both carry the
 * versioned `entityId`, `jurisdiction` and `regulatoryRegime`.
 */
export interface LegalEntityTreeNode {
  /** Versioned entity URN, e.g. `urn:legal-entity:hoz:hoz-bank:v1`. */
  readonly entityId: string;
  readonly legalName: string;
  readonly jurisdiction: string;
  readonly parentEntityId: string | null;
  readonly regulatoryRegime: {
    readonly primaryRegulator: string;
    readonly regimeAnchor: readonly string[];
  };
}

/** One in-perimeter entity for the consolidated LCR. */
export interface LcrConsolidationPerimeterEntity {
  /** Versioned entity URN from the tree. */
  readonly entityUrn: string;
  readonly legalName: string;
  readonly jurisdiction: string;
}

/**
 * Resolve the consolidated-LCR inclusion perimeter from the versioned
 * legal-entity tree (ORG-PR-LCR-003; D1/2022 §4.1.2.1–§4.1.2.4).
 *
 * Inclusion test: `regulatoryRegime.primaryRegulator === "PA"` — in the
 * current tree a PA-regulated entity is exactly a Banks Act licence holder,
 * i.e. a banking / deposit-taking entity. Non-deposit-taking entities
 * (Hoz Securities — JSE; Hoz Group — holding, Companies Act only) are
 * excluded even though they sit in the consolidated ILAAP narrative
 * perimeter (policy §2.6 rule 1 makes this distinction explicit).
 *
 * Entities in jurisdictions without an LCR requirement enter per Reg 36;
 * that refinement binds when a non-LCR-jurisdiction subsidiary first exists
 * in the tree (none today) and is tracked in the policy, not silently here.
 */
export function resolveLcrConsolidationPerimeter(
  tree: readonly LegalEntityTreeNode[],
): readonly LcrConsolidationPerimeterEntity[] {
  return tree
    .filter((node) => node.regulatoryRegime.primaryRegulator === "PA")
    .map((node) => ({
      entityUrn: node.entityId,
      legalName: node.legalName,
      jurisdiction: node.jurisdiction,
    }));
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

/**
 * One intragroup transaction schedule line to eliminate from the consolidated
 * calculation (ORG-PR-LCR-005; D1/2022 §4.1.2.7). Symmetric by construction:
 * the same stressed flow is an outflow of the payer and an inflow of the
 * receiver; both legs are removed.
 *
 * Amounts are minor units in the ZAR reporting currency (ORG-PR-LCR-007).
 */
export interface IntragroupElimination {
  /** Paying in-perimeter entity (its gross outflows are reduced). */
  readonly fromEntityId: string;
  /** Receiving in-perimeter entity (its gross inflows are reduced). */
  readonly toEntityId: string;
  /** Stressed 30-day flow amount to eliminate, minor units, ≥ 0. */
  readonly amountMinor: number;
  /** Decimal-native money — source of truth; amountMinor is kept for compat. */
  readonly amount: Money<Currency>;
  /** Provenance: which events / arrangement the schedule line derives from. */
  readonly source: string;
}

/**
 * Per-entity input to the consolidation: the entity's solo BA 300 output plus
 * the consolidation parameters the policy assigns to it.
 */
export interface ConsolidatedLcrEntityInput {
  /** Entity short-id as used by the solo generator (e.g. `LE-ZA-HOZ-BANK`). */
  readonly entityId: string;
  /** Versioned entity URN in the legal-entity tree. */
  readonly entityUrn: string;
  /** ISO 3166-1 alpha-2 jurisdiction. */
  readonly jurisdiction: string;
  /** The entity's solo BA 300 LCR output (Wave A wired path — unchanged). */
  readonly solo: Ba300LcrOutput;
  /**
   * Minimum LCR requirement in the entity's jurisdiction (1.0 = 100%).
   * Defaults to the home minimum when omitted.
   * Citation: ORG-PR-LCR-004; D1/2022 §4.1.2.5.
   */
  readonly jurisdictionMinimumLcrRatio?: number;
  /**
   * True for the home consolidating (parent-licence) entity — its HQLA is
   * included in full; the ORG-PR-LCR-004 entity cap applies to the others.
   * Exactly one entity must carry this flag.
   */
  readonly isHomeConsolidatingEntity: boolean;
  /**
   * Eitan (Treasurer, governance) transferability / convertibility assessment
   * for this entity's EXCESS HQLA (ORG-PR-LCR-004; D1/2022 §4.1.2.5).
   * Absent or `assessedTransferable: false` → excess excluded (conservative
   * default). Ignored for the home consolidating entity.
   */
  readonly excessHqlaTransferabilityAssessed?: {
    readonly assessedTransferable: boolean;
    /** Who performed the assessment (e.g. `agent:eitan:treasurer`). */
    readonly assessedBy: string;
    /** Record backing the assessment (event id / document hash). */
    readonly assessmentRef: string;
  };
}

/** Full input to `consolidateBa300Lcr`. */
export interface ConsolidatedLcrInput {
  /** Reporting as-of (month-end group position; ORG-PR-LCR-008). */
  readonly asOf: string;
  /** Accounting period the consolidation reports on. */
  readonly periodId: string;
  /** In-perimeter entities with their solo outputs. ≥ 1. */
  readonly entities: readonly ConsolidatedLcrEntityInput[];
  /** Intragroup elimination schedule (may be empty). */
  readonly eliminations: readonly IntragroupElimination[];
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Per-entity consolidation working detail, surfaced for recon + audit. */
export interface ConsolidatedLcrEntityDetail {
  readonly entityId: string;
  readonly entityUrn: string;
  readonly jurisdiction: string;
  readonly soloLcrRatio: number;
  readonly soloHqlaMinor: number;
  /** Gross outflows after intragroup elimination. */
  readonly outflowsAfterEliminationMinor: number;
  /** Gross inflows after intragroup elimination. */
  readonly inflowsAfterEliminationMinor: number;
  /** Minimum ratio applied for the entity HQLA cap (lower-of rule). */
  readonly appliedMinimumLcrRatio: number;
  /** HQLA counted toward the consolidated numerator (post entity cap). */
  readonly hqlaCountedMinor: number;
  /** Excess HQLA excluded pending transferability assessment. */
  readonly hqlaExcessExcludedMinor: number;
  /** True when the ORG-PR-LCR-004 entity cap reduced this entity's HQLA. */
  readonly entityHqlaCapBinding: boolean;
}

/** The consolidated BA 300 LCR output. */
export interface Ba300ConsolidatedLcrOutput {
  readonly meta: {
    readonly form: "BA 300";
    readonly basis: "consolidated";
    readonly formVersion: "v0.1-consolidated";
    readonly asOf: string;
    readonly periodId: string;
    readonly reportingCurrency: typeof CONSOLIDATED_LCR_REPORTING_CURRENCY;
    readonly cadence: typeof CONSOLIDATED_LCR_CADENCE;
    readonly generatorVersion: "v0.1";
    /** Entity short-ids included in the perimeter, sorted. */
    readonly perimeterEntityIds: readonly string[];
  };
  readonly entityDetails: readonly ConsolidatedLcrEntityDetail[];
  /** The elimination schedule that was applied (echoed for provenance). */
  readonly eliminationsApplied: readonly IntragroupElimination[];
  readonly hqla: {
    readonly level1Minor: number;
    readonly level2APreCapMinor: number;
    readonly level2BPreCapMinor: number;
    readonly level2ACapBinding: boolean;
    readonly level2BCapBinding: boolean;
    /** Consolidated LCR numerator (post entity caps + post group level caps). */
    readonly totalStockHqlaMinor: number;
  };
  readonly cashFlows: {
    /** Σ solo gross outflows (pre-elimination). */
    readonly sumSoloGrossOutflowsMinor: number;
    /** Σ solo gross inflows (pre-elimination). */
    readonly sumSoloGrossInflowsMinor: number;
    readonly eliminatedOutflowsMinor: number;
    readonly eliminatedInflowsMinor: number;
    /** Consolidated gross outflows = Σ solos − eliminations. */
    readonly grossOutflowsMinor: number;
    /** Consolidated gross inflows = Σ solos − eliminations. */
    readonly grossInflowsMinor: number;
    /** Inflows after the 75% group-basis cap (ORG-PR-LCR-006). */
    readonly cappedInflowsMinor: number;
    readonly inflowCapBindingIndicator: boolean;
    /** Consolidated LCR denominator. */
    readonly netCashOutflowsMinor: number;
    readonly netCashOutflowFloorBindingIndicator: boolean;
  };
  /** Consolidated LCR. 1.0 = 100%. */
  readonly lcrRatio: number;
  /** ≥ home minimum (Reg 26(2)). */
  readonly lcrCompliant: boolean;
  readonly citations: readonly string[];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ConsolidatedLcrError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsolidatedLcrError";
  }
}

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

function validateInput(input: ConsolidatedLcrInput): void {
  if (input.entities.length === 0) {
    throw new ConsolidatedLcrError("consolidation perimeter is empty — at least one entity");
  }
  const ids = new Set(input.entities.map((e) => e.entityId));
  if (ids.size !== input.entities.length) {
    throw new ConsolidatedLcrError("duplicate entityId in consolidation perimeter");
  }
  const homeCount = input.entities.filter((e) => e.isHomeConsolidatingEntity).length;
  if (homeCount !== 1) {
    throw new ConsolidatedLcrError(
      `exactly one home consolidating entity required; got ${homeCount}`,
    );
  }
  for (const e of input.entities) {
    if (e.solo.meta.functionalCurrency !== CONSOLIDATED_LCR_REPORTING_CURRENCY) {
      throw new ConsolidatedLcrError(
        `ORG-PR-LCR-007: entity '${e.entityId}' solo output is in '${e.solo.meta.functionalCurrency}'; all consolidated-LCR components must be expressed in ${CONSOLIDATED_LCR_REPORTING_CURRENCY} (D1/2022 §3.1, §4.1.2.10)`,
      );
    }
    const min = e.jurisdictionMinimumLcrRatio ?? HOME_JURISDICTION_MINIMUM_LCR_RATIO;
    if (!(min > 0)) {
      throw new ConsolidatedLcrError(
        `entity '${e.entityId}' jurisdictionMinimumLcrRatio must be > 0; got ${min}`,
      );
    }
  }
  for (const el of input.eliminations) {
    if (el.fromEntityId === el.toEntityId) {
      throw new ConsolidatedLcrError(
        `ORG-PR-LCR-005: self-elimination on '${el.fromEntityId}' is not an intragroup transaction`,
      );
    }
    if (!ids.has(el.fromEntityId) || !ids.has(el.toEntityId)) {
      throw new ConsolidatedLcrError(
        `ORG-PR-LCR-005: elimination ${el.fromEntityId}→${el.toEntityId} references an entity outside the consolidation perimeter`,
      );
    }
    if (!(el.amountMinor >= 0) || !Number.isFinite(el.amountMinor)) {
      throw new ConsolidatedLcrError(
        `elimination ${el.fromEntityId}→${el.toEntityId} amountMinor must be a finite number ≥ 0; got ${el.amountMinor}`,
      );
    }
  }
}

/**
 * Compute the consolidated BA 300 LCR from per-entity solo outputs plus the
 * intragroup elimination schedule. Pure function — every input is explicit;
 * the solo outputs are themselves queries over the event log (Principle 1),
 * so the consolidated result remains a projection, never stored state.
 *
 * Solo path unchanged: this composes `Ba300LcrOutput`s produced by the
 * existing Wave-A-wired generator; it does not fork or modify it.
 */
export function consolidateBa300Lcr(input: ConsolidatedLcrInput): Ba300ConsolidatedLcrOutput {
  validateInput(input);

  // -------------------------------------------------------------------------
  // Intragroup eliminations (ORG-PR-LCR-005) — symmetric per schedule line.
  // -------------------------------------------------------------------------
  const outflowElimByEntity = new Map<string, number>();
  const inflowElimByEntity = new Map<string, number>();
  for (const el of input.eliminations) {
    // Use amount (decimal-native Money) as source of truth for accumulation.
    const elimMinor = Number(amountToMinorUnits(el.amount));
    outflowElimByEntity.set(
      el.fromEntityId,
      (outflowElimByEntity.get(el.fromEntityId) ?? 0) + elimMinor,
    );
    inflowElimByEntity.set(el.toEntityId, (inflowElimByEntity.get(el.toEntityId) ?? 0) + elimMinor);
  }

  let sumSoloGrossOutflows = 0;
  let sumSoloGrossInflows = 0;
  let grossOutflows = 0;
  let grossInflows = 0;
  let level1Sum = 0;
  let level2APreCapSum = 0;
  let level2BPreCapSum = 0;

  const entityDetails: ConsolidatedLcrEntityDetail[] = [];

  for (const e of input.entities) {
    const soloOut = e.solo.cashFlows.outflows.grossMinor;
    const soloIn = e.solo.cashFlows.inflows.grossMinor;
    const outElim = outflowElimByEntity.get(e.entityId) ?? 0;
    const inElim = inflowElimByEntity.get(e.entityId) ?? 0;
    if (outElim > soloOut) {
      throw new ConsolidatedLcrError(
        `ORG-PR-LCR-005: eliminated outflows (${outElim}) exceed entity '${e.entityId}' gross outflows (${soloOut}) — elimination schedule inconsistent with solo fold`,
      );
    }
    if (inElim > soloIn) {
      throw new ConsolidatedLcrError(
        `ORG-PR-LCR-005: eliminated inflows (${inElim}) exceed entity '${e.entityId}' gross inflows (${soloIn}) — elimination schedule inconsistent with solo fold`,
      );
    }
    const outAfter = soloOut - outElim;
    const inAfter = soloIn - inElim;
    sumSoloGrossOutflows += soloOut;
    sumSoloGrossInflows += soloIn;
    grossOutflows += outAfter;
    grossInflows += inAfter;

    // -----------------------------------------------------------------------
    // Entity-level HQLA cap (ORG-PR-LCR-004; D1/2022 §4.1.2.5).
    //
    // Home consolidating entity: HQLA in full (its stock is by construction
    // available to itself). Other entities: countable HQLA is capped at
    //   min(jurisdiction minimum, home minimum) × entity net cash outflows
    // computed post-elimination WITHOUT an entity-level inflow cap
    // (ORG-PR-LCR-006 applies the 75% cap on a group basis only). Excess
    // above the cap is included only once assessed freely transferable /
    // convertible by Eitan (Treasurer, governance).
    // -----------------------------------------------------------------------
    const soloHqla = e.solo.hqla.totalStockHqlaMinor;
    const appliedMin = Math.min(
      e.jurisdictionMinimumLcrRatio ?? HOME_JURISDICTION_MINIMUM_LCR_RATIO,
      HOME_JURISDICTION_MINIMUM_LCR_RATIO,
    );
    let counted: number;
    let excessExcluded: number;
    if (
      e.isHomeConsolidatingEntity ||
      e.excessHqlaTransferabilityAssessed?.assessedTransferable === true
    ) {
      counted = soloHqla;
      excessExcluded = 0;
    } else {
      const entityNetOutflowsForCap = Math.max(outAfter - inAfter, 0);
      const cap = Math.round(appliedMin * entityNetOutflowsForCap);
      counted = Math.min(soloHqla, cap);
      excessExcluded = soloHqla - counted;
    }
    const capBinding = excessExcluded > 0;

    // Pro-rata the entity's level components down to the counted amount so
    // the group-level 40%/15% caps (BCBS D295 §47) re-apply on a coherent
    // decomposition. scale = 1 whenever no entity cap binds — the
    // single-home-entity case therefore reproduces the solo cap inputs
    // exactly (golden identity).
    const scale = soloHqla > 0 ? counted / soloHqla : 0;
    level1Sum += Math.round(e.solo.hqla.level1.contributionMinor * scale);
    level2APreCapSum += Math.round(e.solo.hqla.level2A.preCapContributionMinor * scale);
    level2BPreCapSum += Math.round(e.solo.hqla.level2B.preCapContributionMinor * scale);

    entityDetails.push({
      entityId: e.entityId,
      entityUrn: e.entityUrn,
      jurisdiction: e.jurisdiction,
      soloLcrRatio: e.solo.lcrRatio,
      soloHqlaMinor: soloHqla,
      outflowsAfterEliminationMinor: outAfter,
      inflowsAfterEliminationMinor: inAfter,
      appliedMinimumLcrRatio: appliedMin,
      hqlaCountedMinor: counted,
      hqlaExcessExcludedMinor: excessExcluded,
      entityHqlaCapBinding: capBinding,
    });
  }

  // -------------------------------------------------------------------------
  // Group-level HQLA composition caps (BCBS D295 §47 / Reg 26(7)) — re-applied
  // at the consolidated level via the SAME closed-form as the solo generator.
  // -------------------------------------------------------------------------
  const caps = applyHqlaCaps({
    level1Minor: level1Sum,
    level2ARawMinor: level2APreCapSum,
    level2BRawMinor: level2BPreCapSum,
  });

  // -------------------------------------------------------------------------
  // Group-basis 75% inflow cap (ORG-PR-LCR-006) + 25% net-outflow floor.
  // Identical rounding conventions to the solo generator (floor on the cap,
  // ceil on the floor) so the single-entity identity is exact.
  // -------------------------------------------------------------------------
  const inflowCap = Math.floor(GROUP_INFLOW_CAP_RATIO * grossOutflows);
  const cappedInflows = Math.min(grossInflows, inflowCap);
  const inflowCapBinding = grossInflows > inflowCap;
  const preFloorNetOutflows = grossOutflows - cappedInflows;
  const floor = Math.ceil(NET_CASH_OUTFLOW_FLOOR_RATIO * grossOutflows);
  const netCashOutflows = Math.max(preFloorNetOutflows, floor);
  const floorBinding = preFloorNetOutflows < floor;

  const eliminatedOutflows = sumSoloGrossOutflows - grossOutflows;
  const eliminatedInflows = sumSoloGrossInflows - grossInflows;

  const lcrRatio =
    netCashOutflows > 0 ? caps.totalStockMinor / netCashOutflows : Number.POSITIVE_INFINITY;

  return {
    meta: {
      form: "BA 300",
      basis: "consolidated",
      formVersion: "v0.1-consolidated",
      asOf: input.asOf,
      periodId: input.periodId,
      reportingCurrency: CONSOLIDATED_LCR_REPORTING_CURRENCY,
      cadence: CONSOLIDATED_LCR_CADENCE,
      generatorVersion: "v0.1",
      perimeterEntityIds: [...input.entities.map((e) => e.entityId)].sort(),
    },
    entityDetails,
    eliminationsApplied: input.eliminations,
    hqla: {
      level1Minor: level1Sum,
      level2APreCapMinor: level2APreCapSum,
      level2BPreCapMinor: level2BPreCapSum,
      level2ACapBinding: caps.level2ACapBinding,
      level2BCapBinding: caps.level2BCapBinding,
      totalStockHqlaMinor: caps.totalStockMinor,
    },
    cashFlows: {
      sumSoloGrossOutflowsMinor: sumSoloGrossOutflows,
      sumSoloGrossInflowsMinor: sumSoloGrossInflows,
      eliminatedOutflowsMinor: eliminatedOutflows,
      eliminatedInflowsMinor: eliminatedInflows,
      grossOutflowsMinor: grossOutflows,
      grossInflowsMinor: grossInflows,
      cappedInflowsMinor: cappedInflows,
      inflowCapBindingIndicator: inflowCapBinding,
      netCashOutflowsMinor: netCashOutflows,
      netCashOutflowFloorBindingIndicator: floorBinding,
    },
    lcrRatio,
    lcrCompliant: lcrRatio >= HOME_JURISDICTION_MINIMUM_LCR_RATIO,
    citations: CONSOLIDATED_LCR_CITATIONS,
  };
}
