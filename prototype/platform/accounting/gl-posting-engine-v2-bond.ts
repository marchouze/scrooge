// platform/accounting/gl-posting-engine-v2-bond.ts
//
// Phase 3c — V2 GL posting handlers for the JSE bond instrument family. Runs
// DUAL-PARALLEL to the V1 GL engine, exactly like the FX V2 engine
// (gl-posting-engine-v2.ts) and the Phase 3b money-market V2 engine
// (gl-posting-engine-v2-mm.ts); all three share the GlPostingEmitted output
// shape + provenance convention.
//
// TRIGGERS: the 5 V2-parallel bond lifecycle events (BondTradeExecutedV2,
// BondInterestAccruedV2, BondPositionRevaluedV2, BondMaturedV2, BondSoldV2)
// registered in `event-types/bond-accounting-v2.ts`. Each carries decimal-native
// MoneyWire amounts (currency-carrying) + a tenantId, so the postings are
// currency-agnostic by construction — there is NO hardcoded ZAR
// (WS-MULTI-BASE-CURRENCY).
//
// POSTING RULES (Phase 3c scope) — account codes + leg footprints MIRROR the V1
// SLA bond rules (platform/accounting/sla/rules/pr-bond.ts) so the V1↔V2 parity
// gate byte-matches per account:
//   PR-BOND-001-V2   BondTradeExecutedV2      → IAS 32 initial recognition (FVTPL
//                                               designation); Dr/Cr at dirty price
//   PR-BOND-EIR-V2   BondInterestAccruedV2    → IFRS 9 B5.4.1 EIR interest income
//   PR-BOND-002-V2   BondPositionRevaluedV2   → IFRS 9 §5.7.1 FVTPL fair-value mvmt
//   PR-BOND-MAT-V2   BondMaturedV2            → IFRS 9 §3.2.3 derecognition at par
//   PR-BOND-SALE-V2  BondSoldV2               → IFRS 9 §3.2.3 derecognition, realised
//
// DOUBLE-ENTRY: every handler returns BALANCED legs (Σdebit == Σcredit in the
// instrument currency). The dirty-price booking amount is computed decimal-
// natively (nominal × dirtyPricePercent / 100, rounded HALF-UP at the settlement
// boundary) — never a float `Math.round` (no-float-money gate). Zero-amount
// revaluation / accrual periods emit NO posting (the V1 non-zero-delta skip),
// which is observable, not a silent omission.
//
// PORTFOLIO SELECTION: BondTradeExecutedV2 carries `portfolio`; the asset leg is
// the banking-book account (ACC-3100-001) or the trading-book FVTPL account
// (ACC-3100-002) accordingly. BondMaturedV2 / BondSoldV2 do NOT carry portfolio;
// mirroring the V1 enrichment default, maturity derecognises against the banking-
// book account and a sale against the trading-book account. (A later phase
// resolves the originating trade's portfolio; the parity gate surfaces any
// residual.)
//
// Authority: D-V1-REMOVAL-PHASE-3C (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            IFRS 9 §3.1.1, §3.2.3, §4.1.4, §5.4.1, §5.7.1; IAS 32;
//            brief:atlas:v1-removal-phase-3c-bond-accounting-on-v2-fvtpl-:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import type { TenantId } from "../../v2-core/control-plane/tenant";
import { ROUNDING, divideRounded, isNegative, isZero, mulScalar, neg } from "../core/decimal-money";
import { type MoneyWire, decodeMoney, encodeMoney } from "../core/money-codec";
import { newEventId } from "../core/types";
import type {
  BondInterestAccruedV2Payload,
  BondMaturedV2Payload,
  BondPositionRevaluedV2Payload,
  BondSoldV2Payload,
  BondTradeExecutedV2Payload,
} from "../event-store/event-types/bond-accounting-v2";
import {
  type GlPostingEmittedPayload,
  makeGlPostingEmitted,
} from "../event-store/event-types/fx-accounting";
import type { EventStore } from "../event-store/store";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// COA accounts — MIRROR the V1 bond logical→COA resolution (sla/resolver.ts).
// Currency-agnostic: the leg amount carries its own currency on the MoneyWire.
// ---------------------------------------------------------------------------

const ACC = {
  /** Nostro / settlement cash leg of every bond flow. */
  nostro: "ACC-1200-001",
  /** Bond asset — banking book (amortised cost). */
  assetBanking: "ACC-3100-001",
  /** Bond asset — trading book (FVTPL). */
  assetTrading: "ACC-3100-002",
  /** Accrued interest receivable. */
  accruedInterestReceivable: "ACC-3100-003",
  /** Unrealised P&L — bonds (FVTPL). */
  unrealisedPnl: "ACC-3100-005",
  /** Realised P&L — bonds. */
  realisedPnl: "ACC-3100-006",
  /** Interest income (EIR). */
  interestIncomeEir: "ACC-4101-001",
} as const;

const CITATIONS = [
  "IFRS-9-§3.1.1",
  "IFRS-9-§3.2.3",
  "IFRS-9-§5.4.1",
  "IFRS-9-§5.7.1",
  "IAS-32",
  "D-V1-REMOVAL-PHASE-3C",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

// ---------------------------------------------------------------------------
// Leg factory — one balanced DR or CR GlPostingEmitted event.
// ---------------------------------------------------------------------------

interface LegArgs {
  readonly creditDebit: "debit" | "credit";
  readonly accountCode: string;
  readonly amount: MoneyWire;
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  readonly actor: Actor;
  readonly entity: string;
}

function makeLeg(a: LegArgs): Event {
  const payload: GlPostingEmittedPayload = {
    creditDebit: a.creditDebit,
    accountCode: a.accountCode,
    amount: a.amount,
    postingDate: a.postingDate,
    tenantId: a.tenantId,
    sourceEventId: a.sourceEventId,
    iasRule: a.iasRule,
    postingRuleId: a.postingRuleId,
    description: a.description,
  };
  return makeGlPostingEmitted({
    asOf: a.postingDate,
    entity: a.entity,
    actor: a.actor,
    citations: CITATIONS,
    payload,
    eventId: newEventId(),
  });
}

interface PostingContext {
  readonly postingDate: string;
  readonly tenantId: TenantId;
  readonly sourceEventId: string;
  readonly iasRule: string;
  readonly postingRuleId: string;
  readonly description: string;
  readonly actor: Actor;
  readonly entity: string;
}

/** Build a balanced DR/CR pair on a shared amount + posting context. */
function balancedPair(
  debitAccount: string,
  creditAccount: string,
  amount: MoneyWire,
  ctx: PostingContext,
): Event[] {
  const common = { amount, ...ctx };
  return [
    makeLeg({ ...common, creditDebit: "debit", accountCode: debitAccount }),
    makeLeg({ ...common, creditDebit: "credit", accountCode: creditAccount }),
  ];
}

function isoDate(asOf: string): string {
  return asOf.substring(0, 10);
}

/** The absolute MoneyWire of a possibly-signed MoneyWire (decimal-native). */
function absMoneyWire(wire: MoneyWire): MoneyWire {
  const m = decodeMoney(wire);
  return encodeMoney(isNegative(m) ? neg(m) : m);
}

// ---------------------------------------------------------------------------
// PR-BOND-001-V2 — BondTradeExecutedV2 → initial recognition at dirty price.
//   buy:  Dr Bond Asset[portfolio] / Cr Nostro
//   sell: Dr Nostro / Cr Bond Asset[portfolio]
// dirty price = nominal × dirtyPricePercent / 100, decimal-exact (no float).
// ---------------------------------------------------------------------------

function postBondTradeExecuted(
  p: BondTradeExecutedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  const nominal = decodeMoney(p.nominal);
  // dirty = nominal × dirtyPricePercent ÷ 100, HALF-UP at the settlement boundary.
  const dirty = divideRounded(
    mulScalar(nominal, String(p.dirtyPricePercent)),
    "100",
    ROUNDING.SETTLEMENT,
  );
  const dirtyWire = encodeMoney(dirty);
  const assetAccount = p.portfolio === "trading-book" ? ACC.assetTrading : ACC.assetBanking;
  const ctx: PostingContext = {
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule:
      "IAS 32 / IFRS 9 §3.1.1 — recognition on trade date at dirty price (FVTPL designation)",
    postingRuleId: "PR-BOND-001-V2",
    description: `Bond ${p.side} initial recognition ${dirty.currency} (${p.portfolio}) (V2)`,
    actor,
    entity,
  };
  // buy → Dr asset / Cr nostro; sell → Dr nostro / Cr asset.
  return p.side === "buy"
    ? balancedPair(assetAccount, ACC.nostro, dirtyWire, ctx)
    : balancedPair(ACC.nostro, assetAccount, dirtyWire, ctx);
}

// ---------------------------------------------------------------------------
// PR-BOND-EIR-V2 — BondInterestAccruedV2 → EIR interest income.
//   Dr Accrued Interest Receivable / Cr Interest Income (EIR).
// Zero-amount accrual periods emit no posting (V1 non-zero-delta skip).
// ---------------------------------------------------------------------------

function postBondInterestAccrued(
  p: BondInterestAccruedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  if (isZero(decodeMoney(p.accruedInterest))) return [];
  const amount = absMoneyWire(p.accruedInterest);
  return balancedPair(ACC.accruedInterestReceivable, ACC.interestIncomeEir, amount, {
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IFRS 9 B5.4.1 — EIR interest income accrual",
    postingRuleId: "PR-BOND-EIR-V2",
    description: `Bond EIR interest income ${decodeMoney(amount).currency} (V2)`,
    actor,
    entity,
  });
}

// ---------------------------------------------------------------------------
// PR-BOND-002-V2 — BondPositionRevaluedV2 → FVTPL fair-value movement.
//   gain (pnl>0): Dr Bond Asset Trading / Cr Unrealised P&L
//   loss (pnl<0): Dr Unrealised P&L / Cr Bond Asset Trading
// Zero delta emits no posting (V1 non-zero-delta skip).
// ---------------------------------------------------------------------------

function postBondPositionRevalued(
  p: BondPositionRevaluedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  const pnl = decodeMoney(p.unrealisedPnl);
  if (isZero(pnl)) return [];
  const amount = absMoneyWire(p.unrealisedPnl);
  const ctx: PostingContext = {
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IFRS 9 §5.7.1 — FVTPL mark-to-market fair-value movement",
    postingRuleId: "PR-BOND-002-V2",
    description: `Bond FVTPL revaluation ${pnl.currency} (V2)`,
    actor,
    entity,
  };
  // gain → Dr asset trading / Cr unrealised P&L; loss → the reverse.
  return isNegative(pnl)
    ? balancedPair(ACC.unrealisedPnl, ACC.assetTrading, amount, ctx)
    : balancedPair(ACC.assetTrading, ACC.unrealisedPnl, amount, ctx);
}

// ---------------------------------------------------------------------------
// PR-BOND-MAT-V2 — BondMaturedV2 → derecognition at maturity.
//   Dr Nostro (nominal + final coupon)
//   Cr Accrued Interest Receivable (final coupon, only when > 0)
//   Cr Bond Asset Banking (nominal)
// Each side balances to the cash inflow leg; the nominal + coupon are distinct
// derecognition legs (mirrors the V1 maturity footprint, banking-book default).
// ---------------------------------------------------------------------------

function postBondMatured(
  p: BondMaturedV2Payload,
  actor: Actor,
  entity: string,
  asOf: string,
): Event[] {
  const ctxBase = {
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    actor,
    entity,
  };
  const nominal = absMoneyWire(p.nominalRepaid);
  const principalPair = balancedPair(ACC.nostro, ACC.assetBanking, nominal, {
    ...ctxBase,
    iasRule: "IFRS 9 §3.2.3 — derecognition on principal repayment at maturity",
    postingRuleId: "PR-BOND-MAT-V2",
    description: `Bond maturity principal repayment ${decodeMoney(nominal).currency} (V2)`,
  });
  // Final coupon leg only when > 0 (V1 finalCoupon > 0 gate).
  if (isZero(decodeMoney(p.finalCoupon))) return principalPair;
  const coupon = absMoneyWire(p.finalCoupon);
  const couponPair = balancedPair(ACC.nostro, ACC.accruedInterestReceivable, coupon, {
    ...ctxBase,
    iasRule: "IFRS 9 §3.2.3 — settlement of final coupon at maturity",
    postingRuleId: "PR-BOND-MAT-V2",
    description: `Bond maturity final coupon ${decodeMoney(coupon).currency} (V2)`,
  });
  return [...principalPair, ...couponPair];
}

// ---------------------------------------------------------------------------
// PR-BOND-SALE-V2 — BondSoldV2 → derecognition on sale, realised gain/loss.
//   Dr Nostro (sale proceeds)
//   Cr Bond Asset Trading (carrying amount)
//   +/- Realised P&L: gain → Cr Realised P&L; loss → Dr Realised P&L
// The proceeds = carrying ± realised, so the legs balance. Trading-book default
// (V1 sale enrichment default).
// ---------------------------------------------------------------------------

function postBondSold(p: BondSoldV2Payload, actor: Actor, entity: string, asOf: string): Event[] {
  const ctxBase = {
    postingDate: isoDate(asOf),
    tenantId: p.tenantId,
    sourceEventId: p.tradeId,
    iasRule: "IFRS 9 §3.2.3 — derecognition on disposal; realised P&L = proceeds − carrying",
    postingRuleId: "PR-BOND-SALE-V2",
    actor,
    entity,
  };
  const proceeds = absMoneyWire(p.saleProceeds);
  const carrying = absMoneyWire(p.carryingAmountAtSale);
  const pnl = decodeMoney(p.realisedPnl);
  const legs: Event[] = [];
  // 1. Dr Nostro — sale proceeds.
  legs.push(
    makeLeg({
      ...ctxBase,
      creditDebit: "debit",
      accountCode: ACC.nostro,
      amount: proceeds,
      description: `Bond sale proceeds ${decodeMoney(proceeds).currency} (V2)`,
    }),
  );
  // 2. Cr Bond Asset Trading — carrying amount derecognised.
  legs.push(
    makeLeg({
      ...ctxBase,
      creditDebit: "credit",
      accountCode: ACC.assetTrading,
      amount: carrying,
      description: `Bond sale carrying derecognition ${decodeMoney(carrying).currency} (V2)`,
    }),
  );
  // 3. Realised P&L — gain (Cr) or loss (Dr); skip when exactly zero.
  if (!isZero(pnl)) {
    const realised = absMoneyWire(p.realisedPnl);
    legs.push(
      makeLeg({
        ...ctxBase,
        creditDebit: isNegative(pnl) ? "debit" : "credit",
        accountCode: ACC.realisedPnl,
        amount: realised,
        description: `Bond sale realised ${isNegative(pnl) ? "loss" : "gain"} ${decodeMoney(realised).currency} (V2)`,
      }),
    );
  }
  return legs;
}

// ---------------------------------------------------------------------------
// Engine — process V2 bond lifecycle events, emit GlPostingEmitted.
// ---------------------------------------------------------------------------

export interface GlV2BondEngineArgs {
  /** Event store: read V2 bond lifecycle events from + emit postings into. */
  readonly eventStore: EventStore;
  /** Actor to attribute postings to. */
  readonly actor: Actor;
  /** Legal entity the postings belong to. */
  readonly entity: string;
  /** ISO-8601 as-of bound — only process events at or before this date. */
  readonly asOf?: string;
}

export interface GlV2BondEngineResult {
  readonly emitted: number;
  readonly processed: number;
}

/**
 * Process the V2-parallel bond lifecycle events and emit balanced
 * GlPostingEmitted legs. DUAL-RUN parallel to V1 (distinct trigger event types;
 * GlPostingEmitted co-exists with V1 SubLedgerPostingEmitted). The handler
 * dispatch is exhaustive over the 5 V2 event types; no bond V2 event is silently
 * dropped (fail-closed visibility, Charter cmd 2 + cmd 5).
 */
export function runGlV2BondEngine(args: GlV2BondEngineArgs): GlV2BondEngineResult {
  const { eventStore, actor, entity, asOf } = args;
  let emitted = 0;
  let processed = 0;

  for (const event of eventStore.replay(asOf ? { entity, asOf } : { entity })) {
    let legs: Event[] = [];
    switch (event.type) {
      case "BondTradeExecutedV2":
        legs = postBondTradeExecuted(
          event.payload as BondTradeExecutedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed++;
        break;
      case "BondInterestAccruedV2":
        legs = postBondInterestAccrued(
          event.payload as BondInterestAccruedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed++;
        break;
      case "BondPositionRevaluedV2":
        legs = postBondPositionRevalued(
          event.payload as BondPositionRevaluedV2Payload,
          actor,
          entity,
          event.as_of,
        );
        processed++;
        break;
      case "BondMaturedV2":
        legs = postBondMatured(event.payload as BondMaturedV2Payload, actor, entity, event.as_of);
        processed++;
        break;
      case "BondSoldV2":
        legs = postBondSold(event.payload as BondSoldV2Payload, actor, entity, event.as_of);
        processed++;
        break;
      default:
        // Not a V2 bond lifecycle event — skip.
        continue;
    }

    for (const leg of legs) {
      eventStore.append(leg);
      emitted++;
    }
  }

  return { emitted, processed };
}
