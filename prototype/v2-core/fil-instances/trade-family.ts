// v2-core/fil-instances/trade-family.ts
//
// TRADE-FAMILY grouping read-model (D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL, Slice 2).
//
// THE GROUPING ID THAT WAS MISSING
// --------------------------------
// One FIL instrument is correlated by a single id (`fil:inst:<tenant>:<instanceId>`)
// — every lifecycle event of one instrument carries `instance`. But a trade FAMILY
// — the trade + the holdings it throws off (an FX leg + the cash it materialises;
// a swap's legs; a repo's sale + repurchase) — shares NO grouping id today: only a
// pairwise child→parent `economicTerms.originatingInstrument` back-ref + a
// `<tradeId>-cash-<side>` naming convention, with NO forward index. That missing
// grouping id is the booking id (plan Finding 2), and its absence is exactly why the
// cash-cancel cascade had to be a back-ref scan instead of one atomic "cancel
// booking X".
//
// `foldTradeFamilies` builds the FORWARD index — "everything for trade X" — purely
// as a read-model over events that already exist. For a trade instance URN it
// groups:
//   1. the trade's own CREATE  (`FilInstrumentCreated` whose `instance` === trade);
//   2. its SETTLEMENTS         (`TradeSettlementExecuted` whose `tradeInstance` ===
//                               trade — the explicit grouping link Slice 1 added);
//   3. its HOLDINGS            (`FilInstrumentCreated` whose
//                               `economicTerms.originatingInstrument` === trade —
//                               the cash / security instruments it produced).
//
// PURE READ-MODEL — NO new events (plan §110 phase (a), the lightweight grouping the
// CEO scoped for "now"). It follows the explicit links already on the events; it
// does NOT introduce a booking aggregate or any consolidation-level act (that is the
// later phase (c)). A consumer that wants "everything for trade X" reads the family
// without a full scan.
//
// PACKAGE BOUNDARY: inside `v2-core/` — imports only fil-core + fil-instances.
//
// Authority: D-FX-TRADE-SETTLEMENT-PRODUCT-MODEL (CEO-approved 2026-06-23);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER (replay-safe & append-only; no new events).
//   Principle 1; Principle 2 (the single-graph forward index).
// Author: Atlas (Core banking platform architect, engineering).

import type { FilInstrumentCreatedPayload } from "./events";
import type { TradeSettlementExecutedPayload } from "./trade-settlement";

// ---------------------------------------------------------------------------
// The minimal event shapes the fold reads. The grouping needs only the
// correlation keys carried on each payload — `instance`, `tradeInstance`, and
// `economicTerms.originatingInstrument` — plus the `kind` discriminator.
// ---------------------------------------------------------------------------

/** A `FilInstrumentCreated` reduced to the keys the grouping needs. */
export interface CreatedForFamily {
  readonly kind: "FilInstrumentCreated";
  readonly instance: string;
  readonly type: string;
  readonly economicTerms?: {
    readonly originatingInstrument?: string;
    readonly assetClass?: string;
  };
}

/** A `TradeSettlementExecuted` reduced to the keys the grouping needs. */
export interface SettlementForFamily {
  readonly kind: "TradeSettlementExecuted";
  readonly tradeInstance: string;
  readonly holdingInstance: string;
}

/** The union of payload shapes `foldTradeFamilies` admits. */
export type TradeFamilyInputPayload =
  | CreatedForFamily
  | SettlementForFamily
  | FilInstrumentCreatedPayload
  | TradeSettlementExecutedPayload;

/** One trade family — a trade and everything it produced. */
export interface TradeFamily {
  /** The trade instance URN this family is keyed on (the grouping / booking id). */
  readonly trade: string;
  /**
   * The trade's own CREATE instance URN, when present in the input (=== `trade`).
   * `undefined` if only settlements / holdings are visible (a family can be folded
   * from a partial view).
   */
  readonly created?: string;
  /** The settlement HOLDING instance URNs this trade produced (cash / security). */
  readonly holdings: readonly string[];
  /** The `TradeSettlementExecuted` holding-instance URNs that settle this trade. */
  readonly settlements: readonly string[];
}

/** The forward index: trade instance URN → its family. */
export type TradeFamilyRegister = ReadonlyMap<string, TradeFamily>;

interface MutableTradeFamily {
  trade: string;
  created?: string;
  holdings: string[];
  settlements: string[];
}

function emptyFamily(trade: string): MutableTradeFamily {
  return { trade, holdings: [], settlements: [] };
}

/**
 * Build the trade-family forward index from a stream of `FilInstrumentCreated` +
 * `TradeSettlementExecuted` payloads (other kinds are ignored). Deterministic:
 * holdings / settlements preserve first-seen order, de-duplicated by URN.
 *
 * - A `FilInstrumentCreated` whose `economicTerms.originatingInstrument` is set is a
 *   HOLDING of that trade — added to the parent's `holdings` (the parent family is
 *   created on demand).
 * - A `FilInstrumentCreated` with NO `originatingInstrument` is a TRADE create —
 *   it seeds / sets `created` on its own family.
 * - A `TradeSettlementExecuted` adds its `holdingInstance` to its `tradeInstance`
 *   family's `settlements` (the explicit grouping link).
 */
export function foldTradeFamilies(
  payloads: Iterable<TradeFamilyInputPayload>,
): TradeFamilyRegister {
  const families = new Map<string, MutableTradeFamily>();
  const get = (trade: string): MutableTradeFamily => {
    const existing = families.get(trade);
    if (existing !== undefined) return existing;
    const fresh = emptyFamily(trade);
    families.set(trade, fresh);
    return fresh;
  };
  const pushUnique = (arr: string[], v: string): void => {
    if (!arr.includes(v)) arr.push(v);
  };

  for (const p of payloads) {
    if (p.kind === "FilInstrumentCreated") {
      const created = p as CreatedForFamily;
      const parent = created.economicTerms?.originatingInstrument;
      if (parent !== undefined && parent.length > 0) {
        // A holding produced by `parent` (its trade).
        pushUnique(get(parent).holdings, created.instance);
      } else {
        // A trade create — its own family root.
        get(created.instance).created = created.instance;
      }
    } else if (p.kind === "TradeSettlementExecuted") {
      const settle = p as SettlementForFamily;
      pushUnique(get(settle.tradeInstance).settlements, settle.holdingInstance);
    }
  }

  const out = new Map<string, TradeFamily>();
  for (const [trade, fam] of families) {
    out.set(trade, {
      trade: fam.trade,
      ...(fam.created !== undefined ? { created: fam.created } : {}),
      holdings: [...fam.holdings],
      settlements: [...fam.settlements],
    });
  }
  return out;
}

/** Look up one trade's family in a folded register (`undefined` if absent). */
export function tradeFamily(
  register: TradeFamilyRegister,
  tradeInstanceUrn: string,
): TradeFamily | undefined {
  return register.get(tradeInstanceUrn);
}
