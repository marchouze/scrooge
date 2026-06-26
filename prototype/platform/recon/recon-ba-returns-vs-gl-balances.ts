// platform/recon/recon-ba-returns-vs-gl-balances.ts
//
// Recon gate: BA-returns vs GL balances — tier2Capital reconciliation.
//
// For each AccountingPeriodClosed event, this gate:
//   1. Folds SubLedgerPostingEmitted events on T2-classified GL accounts
//      (ACC-5200-001 Subordinated Debt, ACC-5200-002 General Provisions)
//      bounded by the period's eventSequence frozen cursor (D-DATA-QUALITY-
//      CROSS-DOMAIN-V1) to compute glTier2 = sum(credits) - sum(debits).
//
//   2. Checks whether BA-100 results are available as events (ReportGenerated
//      or similar typed event with a tier2Capital field). In the current
//      substrate BA-100 outputs are not persisted as events — this is a known
//      substrate gap. The gate emits a non-blocking finding message when BA-100
//      outputs are absent and exits 0.  DO NOT fail CI for this substrate gap.
//
//   3. When both GL and BA-100 values are available, asserts:
//        |glTier2 - ba100Tier2| <= TOLERANCE
//      Tolerance: 1 ZAR cent (1 minor unit). Double-entry arithmetic should be
//      exact; the tolerance absorbs rounding in future multi-currency folds.
//
// Substrate gap (D-DATA-QUALITY-CROSS-DOMAIN-V1):
//   BA-100 outputs are not yet stored as events. The full assertion (step 3)
//   is deferred until a ReportGenerated event or equivalent typed event that
//   carries tier2Capital is emitted by the BA-100 subscriber.  This gate will
//   automatically activate once that substrate lands.
//
// T2 account set (canonical per coa-registry.ts):
//   ACC-5200-001 — Subordinated Debt — Tier 2 (≥5yr remaining maturity)
//   ACC-5200-002 — General Provisions — Qualifying Tier 2 (IFRS 9 Stage-1/2)
//
// Sign convention:
//   GL T2 accounts are credit-side liabilities. A credit increases the T2
//   balance; a debit decreases it.  glTier2 = sum(credits) - sum(debits).
//   Positive glTier2 = T2 capital outstanding.
//
// Rounding tolerance rationale:
//   TOLERANCE = 1 minor unit (1 ZAR cent). Double-entry arithmetic within
//   SubLedgerPostingEmitted is integer-exact (enforced by the Zod schema's
//   .superRefine debits-equal-credits check). The tolerance is intentionally
//   tight — any deviation > 1 cent indicates a fold bug, not rounding.
//
// Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
// Citations:
//   Reg 38(8)(b)–(c) — Tier 2 capital definition
//   BCBS Basel III §58–§60 — T2 subordinated debt + general provisions
//   IFRS 9 §5.5.3 — Stage-1 / Stage-2 ECL provisioning (qualifying provisions)
//   Principles/1-events-are-truth.md — fold from events, not stored state
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN — BA 100 generator authority
//
// Author: Atlas (Core banking platform architect, engineering — Gap 3 recon).

import { eventStore } from "../composition";
import { amountToMinorUnits, money } from "../core/decimal-money";
import { legAmountMoney } from "../core/money-codec";
import type { Currency } from "../core/types";
import type { EventStore } from "../event-store/store";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * T2-classified GL account IDs (canonical per coa-registry.ts).
 * Sourced from coaToCapitalClassifications() filtered to capitalTier === "t2".
 * Hard-coded here to avoid a composition-time import of the full COA registry;
 * the coa-registry.ts is the canonical source. Any change there must be
 * reflected here.
 *
 * Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; coa-registry.ts T2 entries.
 */
const T2_ACCOUNT_IDS = new Set<string>(["ACC-5200-001", "ACC-5200-002"]);

/**
 * Rounding tolerance for the GL vs BA-100 assertion.
 *
 * 1 minor unit = 1 ZAR cent. Double-entry arithmetic inside
 * SubLedgerPostingEmitted is integer-exact (the Zod .superRefine check
 * enforces debits = credits per currency at append time). The tolerance
 * absorbs any multi-currency conversion rounding in future Slice 6+ folds.
 *
 * Citation: D-DATA-QUALITY-CROSS-DOMAIN-V1; SubLedgerPostingEmitted schema.
 */
const TOLERANCE_MINOR_UNITS = 1;

const PIPELINE = "recon:ba-returns-vs-gl-balances";

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

interface PeriodResult {
  periodId: string;
  entityId: string;
  eventSequence: number | undefined;
  glTier2Minor: number;
  ba700Tier2Minor: number | undefined;
  deltaMinor: number | undefined;
  withinTolerance: boolean | undefined;
  substrateGapNote: string | undefined;
}

// ---------------------------------------------------------------------------
// GL T2 fold
// ---------------------------------------------------------------------------

/**
 * Fold SubLedgerPostingEmitted events on T2-classified accounts
 * up to (and including) `untilSequence` if supplied.
 *
 * glTier2 = sum(credits on T2 accounts) - sum(debits on T2 accounts).
 *
 * Sign: T2 liabilities are credit-side; a credit increases T2 capital,
 * a debit decreases it (e.g. redemption of subordinated debt).
 */
function foldGlTier2(
  store: EventStore,
  entity: string,
  asOf: string,
  untilSequence: number | undefined,
): number {
  const provenanceFilter = defaultProvenanceFilter();
  const frozenCursorOpts = untilSequence !== undefined ? { untilSequence } : {};

  let credits = 0;
  let debits = 0;

  for (const ev of store.replay({
    entity,
    type: "SubLedgerPostingEmitted",
    asOf,
    ...frozenCursorOpts,
  })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const payload = ev.payload as {
      legs?: Array<{
        accountId?: string;
        debitCredit?: "debit" | "credit";
        amount?: unknown;
        amountMinor?: number;
        currency?: string;
      }>;
    };
    if (!Array.isArray(payload.legs)) continue;
    for (const leg of payload.legs) {
      if (!leg.accountId || !T2_ACCOUNT_IDS.has(leg.accountId)) continue;
      // ZAR-only for now; Slice 6+ multi-currency fold will extend this.
      if (leg.currency && leg.currency !== "ZAR") continue;
      const amount = Number(amountToMinorUnits(legAmountMoney(leg)));
      if (leg.debitCredit === "credit") credits += amount;
      else debits += amount;
    }
  }

  return credits - debits;
}

// ---------------------------------------------------------------------------
// BA-100 result lookup
// ---------------------------------------------------------------------------

/**
 * Retrieve the BA 700 tier2Capital for a given (entity, periodId) from the
 * persisted `ReportGenerated` return-of-record event (the Principle-1 home of
 * the generated return; D-BA-RETURN-OF-RECORD-EVENT-FAMILY).
 *
 * The event carries `ba700Figures.tier2Capital` as decimal-native MAJOR units
 * (Money). This recon compares against the GL T2 fold in MINOR units, so the
 * figure is converted via `amountToMinorUnits`. Returns `undefined` only when
 * NO `ReportGenerated{formId:"BA700"}` exists for the period (the period
 * pre-dates the return-of-record substrate) — that path stays a non-blocking
 * substrate-gap note rather than a hard finding.
 *
 * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; D-BA-RETURN-OF-RECORD-EVENT-FAMILY.
 */
function lookupBa700Tier2(
  store: EventStore,
  entity: string,
  periodId: string,
  _untilSequence: number | undefined,
): number | undefined {
  const provFilter = defaultProvenanceFilter();
  // Latest ReportGenerated wins per (entity, formId, period) — append-only.
  let latest: number | undefined;
  for (const ev of store.replay({ entity, type: "ReportGenerated" })) {
    if (!eventMatchesProvenanceFilter(ev, provFilter)) continue;
    const p = ev.payload as {
      formId?: string;
      reportingPeriod?: string;
      ba700Figures?: { tier2Capital?: { currency?: string; amount?: string } };
    };
    if (p.formId !== "BA700" || p.reportingPeriod !== periodId) continue;
    const t2 = p.ba700Figures?.tier2Capital;
    if (t2?.amount === undefined || t2.currency === undefined) continue;
    // Decimal-native MAJOR units → minor units for the GL comparison.
    latest = Number(amountToMinorUnits(money(t2.amount, t2.currency as Currency)));
  }
  return latest;
}

// ---------------------------------------------------------------------------
// Recon — testable over an explicit store
// ---------------------------------------------------------------------------

export interface Ba700GlReconResult {
  /** Per-period reconciliation outcomes. */
  readonly periodResults: readonly PeriodResult[];
  /** Periods where both GL + BA 700 figures were available and asserted. */
  readonly assertedCount: number;
  /** Periods where BA 700 figures were not yet persisted (non-blocking). */
  readonly substrateGapCount: number;
  /** Hard reconciliation findings (|glTier2 - ba700Tier2| > tolerance). */
  readonly findings: number;
}

/**
 * Reconcile, for every closed period, the GL T2 fold against the persisted
 * BA 700 `ReportGenerated.ba700Figures.tier2Capital` (within tolerance).
 * Pure over `store` — the CLI passes the composition singleton; tests inject a
 * fixture store.
 */
export function run(store: EventStore = eventStore): Ba700GlReconResult {
  const provenanceFilter = defaultProvenanceFilter();
  const periodResults: PeriodResult[] = [];

  for (const ev of store.replay({ type: "AccountingPeriodClosed" })) {
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;

    const payload = ev.payload as {
      periodId?: string;
      closedAt?: string;
      eventSequence?: number;
    };

    const periodId = payload.periodId;
    const closedAt = payload.closedAt ?? ev.as_of;
    const eventSequence =
      typeof payload.eventSequence === "number" ? payload.eventSequence : undefined;
    const entity = ev.entity;

    if (!periodId) continue;

    // Step 1: fold GL T2 balance bounded by the frozen cursor.
    const glTier2Minor = foldGlTier2(store, entity, closedAt, eventSequence);

    // Step 2: read the persisted BA 700 tier2Capital (return-of-record).
    const ba700Tier2Minor = lookupBa700Tier2(store, entity, periodId, eventSequence);

    // Step 3: assert if both values available.
    let deltaMinor: number | undefined;
    let withinTolerance: boolean | undefined;
    let substrateGapNote: string | undefined;

    if (ba700Tier2Minor === undefined) {
      substrateGapNote = `BA 700 tier2Capital not available as an event for period ${periodId} (entity=${entity}). Substrate gap: no ReportGenerated{formId:"BA700"} for this period (it pre-dates the return-of-record substrate). Full GL↔BA 700 assertion deferred until the return-of-record lands. Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; D-BA-RETURN-OF-RECORD-EVENT-FAMILY.`;
    } else {
      deltaMinor = Math.abs(glTier2Minor - ba700Tier2Minor);
      withinTolerance = deltaMinor <= TOLERANCE_MINOR_UNITS;
    }

    periodResults.push({
      periodId,
      entityId: entity,
      eventSequence,
      glTier2Minor,
      ba700Tier2Minor,
      deltaMinor,
      withinTolerance,
      substrateGapNote,
    });
  }

  let findings = 0;
  let substrateGapCount = 0;
  let assertedCount = 0;
  for (const r of periodResults) {
    if (r.substrateGapNote) substrateGapCount++;
    else if (r.withinTolerance === false) {
      findings++;
      assertedCount++;
    } else if (r.withinTolerance === true) assertedCount++;
  }

  return { periodResults, assertedCount, substrateGapCount, findings };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  for (const r of result.periodResults) {
    if (r.substrateGapNote) {
      console.log(
        `[substrate-gap] period=${r.periodId} entity=${r.entityId} glTier2=${r.glTier2Minor} ba700Tier2=<not-available> note: ${r.substrateGapNote}`,
      );
    } else if (r.withinTolerance === false) {
      console.error(
        `[FINDING] period=${r.periodId} entity=${r.entityId} glTier2=${r.glTier2Minor} ba700Tier2=${r.ba700Tier2Minor} delta=${r.deltaMinor} > tolerance=${TOLERANCE_MINOR_UNITS}. GL T2 balance does not reconcile to BA 700 tier2Capital. Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1; Reg 38(8)(b)–(c); BCBS §58–§60.`,
      );
    } else if (r.withinTolerance === true) {
      console.log(
        `[ok] period=${r.periodId} entity=${r.entityId} glTier2=${r.glTier2Minor} ba700Tier2=${r.ba700Tier2Minor} delta=${r.deltaMinor} within tolerance=${TOLERANCE_MINOR_UNITS}`,
      );
    }
  }

  console.log(
    `${PIPELINE}: ${result.periodResults.length} periods checked, ${result.assertedCount} asserted (full GL↔BA 700), ${result.substrateGapCount} substrate-gap (BA 700 output not yet persisted), ${result.findings} findings`,
  );

  // Non-blocking on substrate gaps; only hard reconciliation failures exit non-zero.
  process.exit(result.findings > 0 ? 1 : 0);
}
