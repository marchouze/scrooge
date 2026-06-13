// v2-core/fil-models/fx-valuation/fx-pnl-metric.ts
//
// FX TRADING BOOK P&L — the first real `AttributionMetric` (V2 A2).
//
// A1 shipped the attribution kernel with an EMPTY metric registry; A2 binds the
// FIRST production metric: an ADDITIVE FX P&L metric that reads `Valuable.value`
// over a member set, plus the `book:fx-trading` slice definition. This makes the
// A1 `recon:attribution-additivity` gate NON-VACUOUS — it now exercises a real
// FX P&L metric over a real slice.
//
// THE METRIC (spec §2): book P&L = Σ member value over the slice's members.
//   - resultKind `money`; aggregation `additive` (P&L is additive — the parent's
//     P&L equals Σ of a disjoint child partition; sum is a valid optimisation,
//     recon:attribution-additivity verifies sum == joint recompute).
//   - reads the `Valuable` facet only (encapsulation; FIL Framework §1).
//   - stageScope: a member contributes iff it is `active` (an unsettled FX
//     position — pre-settlement) OR `settled` (the post-settlement FCY cash
//     member). The two together are continuous across the settlement boundary
//     (the settlement-continuity invariant): an FX position settling becomes FCY
//     cash carrying the SAME settlement-date value, so the book P&L does not
//     jump.
//
// MEMBER FACET ACCESS: each `SliceMember.facets` carries a `Valuable` handle
// under the `"Valuable"` key (the metric narrows the opaque kernel handle to the
// facet it declared in `readsFacets`). The FX + FCY-cash models supply that
// handle when projecting instances to members (A2 binds the projection; the
// engine never reaches into ad-hoc instrument fields).
//
// NO v1 imports (recon:v2-no-v1-import — ENFORCING).
//
// Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2 build slice);
//   D-METRIC-ATTRIBUTION-DIMENSIONAL; D-FIL-FRAMEWORK-UNIFICATION (encapsulation);
//   Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import type {
  AdditiveSemantics,
  AttributionMetric,
  MetricRegistry,
  SliceMember,
} from "../../fil-attribution";
import type { FilLifecycleStage } from "../../fil-core/lifecycle";
import type { CitationRef } from "../../fil-core/primitives";
import type { MarketDataSlice, RevaluationRecord, Valuable } from "../../fil-facets/facets";
import { FX_REPORTING_CURRENCY } from "./methodology";

// ---------------------------------------------------------------------------
// The metric result — reporting-currency P&L as bigint minor units (exact; no
// float accumulation). Carried with its currency so the `add` can guard a
// cross-currency mix (a book P&L is single-currency: the reporting currency).
// ---------------------------------------------------------------------------

export interface FxPnlResult {
  readonly currency: string;
  readonly minorUnits: bigint;
}

export const FX_PNL_METRIC_ID = "fx-pnl" as const;

/** The reporting-currency zero for the additive fold. */
export const FX_PNL_ZERO: FxPnlResult = { currency: FX_REPORTING_CURRENCY, minorUnits: 0n };

/**
 * Additive combination of two reporting-currency P&L results. A cross-currency
 * mix is a hard error — book P&L is single-currency (the reporting currency);
 * a member valued in a different reporting currency is a projection defect.
 */
function addFxPnl(a: FxPnlResult, b: FxPnlResult): FxPnlResult {
  // Treat the zero element's currency as neutral so `zero + x == x`.
  if (a.minorUnits === 0n && a.currency === FX_REPORTING_CURRENCY) return b;
  if (b.minorUnits === 0n && b.currency === FX_REPORTING_CURRENCY) return a;
  if (a.currency !== b.currency) {
    throw new Error(
      `fx-pnl: cannot add P&L across reporting currencies (${a.currency} + ${b.currency}) — book P&L is single-currency`,
    );
  }
  return { currency: a.currency, minorUnits: a.minorUnits + b.minorUnits };
}

const FX_PNL_AGGREGATION: AdditiveSemantics<FxPnlResult> = {
  mode: "additive",
  zero: FX_PNL_ZERO,
  add: addFxPnl,
};

// ---------------------------------------------------------------------------
// Reading the Valuable handle off a member (encapsulation — the metric narrows
// the opaque kernel facet handle to the facet it declared in readsFacets).
// ---------------------------------------------------------------------------

function valuableOf(member: SliceMember): Valuable | undefined {
  const handle = member.facets.Valuable;
  if (handle && typeof (handle as Valuable).value === "function") {
    return handle as Valuable;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// stageScope — active (unsettled FX position) ∨ settled (FCY-cash member).
// The two together are the continuous book across the settlement boundary.
// ---------------------------------------------------------------------------

export function fxPnlStageScope(stage: FilLifecycleStage): boolean {
  return stage === "active" || stage === "settled";
}

// ---------------------------------------------------------------------------
// The metric.
// ---------------------------------------------------------------------------

export const fxPnlMetric: AttributionMetric<FxPnlResult> & {
  aggregation: AdditiveSemantics<FxPnlResult>;
} = {
  metricId: FX_PNL_METRIC_ID,
  resultKind: "money",
  readsFacets: ["Valuable"],
  stageScope: fxPnlStageScope,
  aggregation: FX_PNL_AGGREGATION,
  evaluate(members: readonly SliceMember[], marks: MarketDataSlice, asOf): FxPnlResult {
    let acc = FX_PNL_ZERO;
    for (const m of members) {
      const valuable = valuableOf(m);
      if (!valuable) {
        throw new Error(
          `fx-pnl: member "${m.instanceUrn}" exposes no Valuable facet handle — the projection must attach a Valuable for an fx-trading book member`,
        );
      }
      const rec: RevaluationRecord = valuable.value(marks, asOf);
      acc = addFxPnl(acc, { currency: rec.value.currency, minorUnits: rec.value.minorUnits });
    }
    return acc;
  },
};

// ---------------------------------------------------------------------------
// The book:fx-trading slice DEFINITION — a stored predicate (the A1 SliceDefined
// shape). The fx-trading book is all instances tagged book = "fx-trading"; the
// metric's stageScope further gates to active/settled members.
// ---------------------------------------------------------------------------

export const FX_TRADING_BOOK_VALUE = "fx-trading" as const;
export const FX_TRADING_SLICE_ID = "slice:book:fx-trading" as const;

/** The Principle-2 citation for the fx-trading slice definition. */
export const FX_TRADING_SLICE_CITATION = "D-FIL-ATTRIBUTION-A1-BUILD" as CitationRef;

/**
 * The `book:fx-trading` slice as a stored-predicate payload. Tenant-scoped (the
 * caller supplies the tenant when registering / evaluating — tenant is the hard
 * outer partition). `level: "leaf"` — the book is a single roll-up cell of all
 * its members (A3 wires deeper roll-up; A2 needs the flat book P&L).
 */
export function fxTradingSliceDefinition(tenantId: string) {
  return {
    kind: "SliceDefined" as const,
    tenantId,
    sliceId: FX_TRADING_SLICE_ID,
    where: [{ dim: "book" as const, op: "eq" as const, value: FX_TRADING_BOOK_VALUE }],
    level: "leaf" as const,
    citation: FX_TRADING_SLICE_CITATION,
  };
}

// ---------------------------------------------------------------------------
// Registration — bind the FX P&L metric into a metric registry. A2 registers it
// into the process-wide kernel registry (idempotent-guarded: the registry
// rejects a duplicate registration fail-loud, so callers register once).
// ---------------------------------------------------------------------------

export function registerFxPnlMetric(registry: MetricRegistry): void {
  if (!registry.has(FX_PNL_METRIC_ID)) {
    registry.register(fxPnlMetric);
  }
}
