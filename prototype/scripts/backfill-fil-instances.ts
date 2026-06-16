// scripts/backfill-fil-instances.ts
//
// WS-V2-AUTHORITATIVE Slice S1 — FIL-instance + market-data backfill KEYSTONE.
//
// ─── THE GAP (verified on a clean CI store) ────────────────────────────────
//
// A `bun run ci:migrate` store carries ~2010 governance events and ZERO trading
// events — no `FxTradeExecuted`, no `FilInstrumentCreated`, no market data. The
// V1-removal waves purged the FX book. Consequently the V2 valuation consumers
// (daily-pnl-v2.ts, ba320-fx-v2.ts) have NOTHING to value: the V2 FIL-instance
// data path is vacuous, and the corresponding parity gates report no-data.
//
// ─── WHAT S1 EMITS (decimal-native, ratchet-clean) ─────────────────────────
//
// S1 materialises the anchor bank's FX book as NATIVE decimal-native FIL
// INSTANCES in the MAIN event store (`BANK_EVENT_DB`, via composition.eventStore)
// — the store the Phase-2/3 V2 readers consult. (The pre-existing
// `seed:v2-fil-instances-ir-fx` wrote only to the separate v2-anchor.db, which
// daily-pnl-v2 / ba320-fx-v2 never read — so it never moved those gates.) Plus
// production fx-quote market data so `Valuable.value(slice)` has a mark.
//
// FIL economic terms are decimal-native Money (`{ currency, amount }`, MAJOR-unit
// string — D-V2-CORE-MONEY-DECIMAL-NATIVE) and carry NO `*Minor` field, so the
// emission is clean under `recon:no-residual-minor-encoding`.
//
// SOURCE RESOLUTION (idempotent, replay-safe — re-run = 0 new events):
//   - If the main store already holds `FxTradeExecuted` events → derive FIL
//     instances from them (a true backfill of an existing book).
//   - If ZERO (the current CI reality) → derive FIL instances directly from a
//     small DETERMINISTIC anchor FX book descriptor set, WITHOUT persisting any
//     legacy `FxTradeExecuted`/settlement/reval/P&L events.
//
// ─── WHY NO LEGACY FX TRADE EVENTS ARE SEEDED (a load-bearing finding) ──────
//
// The V1 FX trade/settlement/revaluation/daily-P&L event family is still encoded
// in LEGACY integer minor-units (`*Minor` fields: `notional.amountMinor`,
// `unrealisedPnlZarMinor`, `totalUnrealisedPnlZarMinor`, …). The enforcing gate
// `recon:no-residual-minor-encoding` forbids ANY `*Minor` numeric field in ANY
// event payload (D-MONEY-DECIMAL-REDENOMINATION) — with no allowlist. So those
// V1 event types CANNOT be emitted on current main without breaking the ratchet.
//
// CONSEQUENCE for the parity gates (documented, not hidden — Charter cmd 5):
//   - The V1 COMPARISON BASELINES are frozen on legacy encoding:
//       * `var-v2-parity` V1 side: VaR is sourced from the FX NOP, which
//         `deriveNetFxPositionByCurrency` folds from `FxTradeExecuted.legs[]
//         .notional.amountMinor`. No decimal-native NOP path exists.
//       * `ba320-fx-v2-parity` V1 side: `FxTradeExecuted` + `TradeMatured`.
//       * `daily-pnl-v2-parity` V1 side: `DailyPnLReportGenerated`
//         (`*ZarMinor`) + `FxPositionRevalued`.
//   - The V2 SIDES are FIL-sourced (decimal-native) and ARE now non-vacuous
//     after this backfill: daily-pnl-v2 values open FIL FX instruments off the
//     MarketDataStore snapshot; ba320-fx-v2 folds open FIL instances.
//   - FULL byte-comparison of either gate therefore needs the V1 FX trade CDM
//     redenominated to decimal MoneyWire (markets/cdm/primitives.ts `moneySchema`
//     + the NOP fold + the V1 product-control/market-risk emitters). That is a
//     CDM-redenomination workstream BEYOND S1's data-population scope — it is the
//     binding prerequisite for S2 (VaR flip) / S3 (daily-P&L flip), and is logged
//     here as the explicit S1→S2/S3 hand-off (no silent gap).
//
// NO FLIPS. S1 promotes no `v2Status`. The deliverable is non-vacuous V2 FIL
// data + market data, plus the precisely-scoped legacy-encoding finding.
//
// BOUNDARY: this is a SCRIPT (not under v2-core), so it MAY read v1 and import
// platform/. It imports v2-core only for the FIL URN/schema grammar.
//
// Authority: D-V2-AUTHORITATIVE-FLIP-PREREQS (CEO-approved 2026-06-16);
//   D-ENGINEERING-INTEGRITY-CHARTER; D-FIL-FRAMEWORK-UNIFICATION;
//   D-MODEL-BINDING-CONTRACT-V1; D-V1-REMOVAL-PHASE2-GAP-A2; Principle 1; Principle 5.
// brief: brief:atlas:ws-v2-authoritative-s1-fil-instance-market-data-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../platform/event-store/event-types/fil-instances";
import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import { resolveMarketDataDbPath } from "../platform/market-data/resolve-market-data-db";
import { MarketDataStore } from "../platform/market-data/store";
import { MIN_RETURN_OBSERVATIONS } from "../platform/market-risk/var-engine";
import { divD, roundDecimal, toDecimal } from "../v2-core/fil-core/decimal";
import { type Money, moneyFromDecimal } from "../v2-core/fil-core/primitives";
import { formatInstanceUrn, formatTypeUrn } from "../v2-core/fil-core/urn";
import type { FilEconomicTerms } from "../v2-core/fil-instances/events";

// ---------------------------------------------------------------------------
// Constants — anchor identity. Reporting currency from the legal-entity tree,
// NEVER hardcoded (Charter cmd 4).
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const REPORTING = anchorFunctionalCurrency();

const BACKFILL_ACTOR = { type: "service" as const, id: "agent:atlas:backfill-fil-instances" };
const FIL_CITATIONS = [
  "D-V2-AUTHORITATIVE-FLIP-PREREQS",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "D-MODEL-BINDING-CONTRACT-V1",
  "P1-EVENTS-AS-TRUTH",
];

const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});
const FX_FORWARD_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "forward",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});

// ---------------------------------------------------------------------------
// Decimal-native Money: source notionals are MAJOR-unit numbers here; the v2 FIL
// economic terms carry decimal-native MAJOR-unit Money. Conversion through the v2
// decimal engine — NO float arithmetic (`recon:no-float-money-arithmetic`).
// ---------------------------------------------------------------------------

function majorNumberToMoney(majorUnits: number, currency: string): Money {
  return moneyFromDecimal(currency, roundDecimal(toDecimal(String(majorUnits)), 2, "HALF_UP"));
}

function minorNumberToMajorMoney(minorUnits: number, currency: string): Money {
  const wholeMinor = roundDecimal(toDecimal(String(minorUnits)), 0, "HALF_UP");
  return moneyFromDecimal(currency, roundDecimal(divD(wholeMinor, toDecimal("100")), 2, "HALF_UP"));
}

// ---------------------------------------------------------------------------
// A FIL economic-terms descriptor — the minimal data a FilInstrumentCreated
// needs. Built either from an existing FxTradeExecuted (true backfill) or from
// the deterministic fixture book (when the store has no trades).
// ---------------------------------------------------------------------------

interface FilDescriptor {
  readonly tradeId: string;
  readonly economicTerms: FilEconomicTerms;
  readonly typeUrn: string;
  readonly createdAsOf: string;
  /** Provenance reference back to the originating record (Principle 1). */
  readonly originatingEventType: string;
  readonly originatingEventId: string;
  /** Terminal stage + asOf if the instrument is closed. */
  readonly terminal?: { stage: "settled" | "matured" | "cancelled"; asOf: string };
}

// ---------------------------------------------------------------------------
// DETERMINISTIC ANCHOR FX BOOK — fixed descriptors. Used ONLY when the store has
// no FxTradeExecuted. Notionals/rates are constants (re-run identical). The book
// has three OPEN positions (USD long, EUR short, GBP long) and one SETTLED USD
// position (→ FilInstrumentTerminated). hedgingSetTag drives the market-data pair.
// ---------------------------------------------------------------------------

const FIXTURE_RATES: Readonly<Record<string, number>> = { USD: 18.52, EUR: 20.15, GBP: 23.4 };
const FIXTURE_TRADE_TS = "2026-06-01T09:00:00.000Z";
const FIXTURE_SETTLE_DATE = "2026-06-03";
const FIXTURE_SETTLE_TS = `${FIXTURE_SETTLE_DATE}T09:00:00.000Z`;

interface FixtureLeg {
  readonly tradeId: string;
  readonly counterpartyId: string;
  readonly base: string;
  readonly direction: "long" | "short";
  /** Notional in the REPORTING currency, MAJOR units. */
  readonly reportingNotionalMajor: number;
  readonly settled: boolean;
}

const FIXTURE_BOOK: readonly FixtureLeg[] = [
  {
    tradeId: "S1-FX-FIXTURE-USD-001",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    base: "USD",
    direction: "long",
    reportingNotionalMajor: 9_260_000, // USD 500k × 18.52
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-EUR-001",
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    base: "EUR",
    direction: "short",
    reportingNotionalMajor: 6_045_000, // EUR 300k × 20.15
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-GBP-001",
    counterpartyId: "urn:party:legal-entity:standard-bank-za",
    base: "GBP",
    direction: "long",
    reportingNotionalMajor: 4_680_000, // GBP 200k × 23.40
    settled: false,
  },
  {
    tradeId: "S1-FX-FIXTURE-USD-SETTLED-001",
    counterpartyId: "urn:party:legal-entity:investec-bank-za",
    base: "USD",
    direction: "long",
    reportingNotionalMajor: 1_852_000, // USD 100k × 18.52
    settled: true,
  },
];

function fixtureDescriptors(): FilDescriptor[] {
  return FIXTURE_BOOK.map((ft) => ({
    tradeId: ft.tradeId,
    typeUrn: FX_SPOT_TYPE_URN,
    createdAsOf: FIXTURE_TRADE_TS,
    originatingEventType: "Ws-v2-s1-fixture-book",
    originatingEventId: `s1-fixture:${ft.tradeId}`,
    ...(ft.settled ? { terminal: { stage: "settled" as const, asOf: FIXTURE_SETTLE_TS } } : {}),
    economicTerms: {
      assetClass: "fx",
      notional: majorNumberToMoney(ft.reportingNotionalMajor, REPORTING),
      direction: ft.direction,
      counterpartyId: ft.counterpartyId,
      nettingSetId: `NS-${ft.counterpartyId}-${REPORTING}`,
      currency: REPORTING,
      settlementDate: FIXTURE_SETTLE_DATE,
      hedgingSetTag: `${ft.base}/${REPORTING}`,
    },
  }));
}

// ---------------------------------------------------------------------------
// Backfill descriptors from EXISTING FxTradeExecuted events (true backfill path,
// taken when the store already holds an FX book).
// ---------------------------------------------------------------------------

interface NearLeg {
  legKind?: string;
  notional?: { currency?: string; amountMinor?: number };
  counterNotional?: { currency?: string; amountMinor?: number };
  settlementDate?: { iso?: string };
}

function tradeIdOf(p: Record<string, unknown>): string | undefined {
  const t = p.tradeId;
  if (typeof t === "string") return t;
  if (t && typeof t === "object" && typeof (t as { value?: unknown }).value === "string") {
    return (t as { value: string }).value;
  }
  return undefined;
}

function buildTerminals(): Map<
  string,
  { stage: "settled" | "matured" | "cancelled"; asOf: string }
> {
  const out = new Map<string, { stage: "settled" | "matured" | "cancelled"; asOf: string }>();
  const scan = (type: string, stage: "settled" | "matured" | "cancelled") => {
    for (const e of eventStore.replay({ type })) {
      const id = tradeIdOf(e.payload as Record<string, unknown>);
      if (id) out.set(id, { stage, asOf: e.as_of });
    }
  };
  scan("SettlementConfirmed", "settled");
  scan("TradeMatured", "matured");
  scan("FxTradeCancelled", "cancelled");
  return out;
}

function descriptorsFromExistingTrades(): FilDescriptor[] {
  const terminals = buildTerminals();
  const out: FilDescriptor[] = [];
  for (const e of eventStore.replay({ type: "FxTradeExecuted" })) {
    const p = e.payload as Record<string, unknown>;
    const tradeId = tradeIdOf(p);
    if (!tradeId) continue;
    const counterparty = p.counterparty as { partyId?: string } | undefined;
    const counterpartyId = counterparty?.partyId;
    if (!counterpartyId) continue;
    const legs = (p.legs as NearLeg[] | undefined) ?? [];
    const near = legs.find((l) => l.legKind === "near") ?? legs[0];
    if (!near || !near.notional || !near.counterNotional) continue;

    let reportingMinor: number | null = null;
    if (near.notional.currency === REPORTING) reportingMinor = near.notional.amountMinor ?? null;
    else if (near.counterNotional.currency === REPORTING)
      reportingMinor = near.counterNotional.amountMinor ?? null;
    if (reportingMinor === null || reportingMinor === 0) continue;

    const pair = p.currencyPair as { base?: string; quote?: string } | undefined;
    const base = pair?.base ?? "";
    const quote = pair?.quote ?? "";
    const side = p.side as string | undefined;
    const taxonomy = String(p.productTaxonomy ?? "FX-spot");
    const typeUrn = taxonomy.toLowerCase().includes("forward")
      ? FX_FORWARD_TYPE_URN
      : FX_SPOT_TYPE_URN;
    const term = terminals.get(tradeId);

    out.push({
      tradeId,
      typeUrn,
      createdAsOf: e.as_of,
      originatingEventType: "FxTradeExecuted",
      originatingEventId: e.event_id,
      ...(term ? { terminal: term } : {}),
      economicTerms: {
        assetClass: "fx",
        notional: minorNumberToMajorMoney(Math.abs(reportingMinor), REPORTING),
        direction: side === "sell" ? "short" : "long",
        counterpartyId,
        nettingSetId: `NS-${counterpartyId}-${REPORTING}`,
        currency: REPORTING,
        settlementDate: near.settlementDate?.iso ?? e.as_of,
        ...(base && quote ? { hedgingSetTag: `${base}/${quote}` } : {}),
      },
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Emit FIL lifecycle events. Idempotent: skip an instance URN already present.
// ---------------------------------------------------------------------------

function existingFilInstances(type: string): Set<string> {
  const out = new Set<string>();
  for (const e of eventStore.replay({ type })) {
    const p = e.payload as { instance?: string };
    if (p.instance) out.add(p.instance);
  }
  return out;
}

function emitFilInstances(descriptors: readonly FilDescriptor[]): {
  created: number;
  terminated: number;
} {
  const haveCreated = existingFilInstances("FilInstrumentCreated");
  const haveTerminated = existingFilInstances("FilInstrumentTerminated");
  let created = 0;
  let terminated = 0;

  for (const d of descriptors) {
    const instance = formatInstanceUrn({ tenant: TENANT, instanceId: d.tradeId });

    if (!haveCreated.has(instance)) {
      eventStore.append(
        makeFilInstrumentCreated({
          asOf: d.createdAsOf,
          entity: ENTITY,
          actor: BACKFILL_ACTOR,
          citations: [...FIL_CITATIONS],
          payload: {
            kind: "FilInstrumentCreated",
            instance,
            type: d.typeUrn,
            tenant: TENANT,
            asOf: d.createdAsOf,
            originatingEvent: { eventType: d.originatingEventType, eventId: d.originatingEventId },
            initialStage: "active",
            economicTerms: d.economicTerms,
          },
        }),
      );
      haveCreated.add(instance);
      created += 1;
    }

    if (d.terminal && !haveTerminated.has(instance)) {
      eventStore.append(
        makeFilInstrumentTerminated({
          asOf: d.terminal.asOf,
          entity: ENTITY,
          actor: BACKFILL_ACTOR,
          citations: [...FIL_CITATIONS],
          payload: {
            kind: "FilInstrumentTerminated",
            instance,
            type: d.typeUrn,
            tenant: TENANT,
            asOf: d.terminal.asOf,
            originatingEvent: { eventType: d.originatingEventType, eventId: d.originatingEventId },
            terminalStage: d.terminal.stage,
          },
        }),
      );
      haveTerminated.add(instance);
      terminated += 1;
    }
  }
  return { created, terminated };
}

// ---------------------------------------------------------------------------
// MARKET-DATA SEED — production fx-quote ticks (mid) for each referenced pair +
// a return history (≥ MIN_RETURN_OBSERVATIONS+1 levels) so a downstream VaR/MTM
// read has enough observations. Gap-only: never overwrites an existing tick
// (deterministic id + INSERT OR IGNORE). The pair is the FIL hedgingSetTag.
// ---------------------------------------------------------------------------

const HISTORY_LEVELS = MIN_RETURN_OBSERVATIONS + 5;
const MARKET_DATA_SOURCE = "ws-v2-s1-fixture";

function seedMarketData(descriptors: readonly FilDescriptor[]): {
  pairs: number;
  ticksSeeded: number;
} {
  const md = new MarketDataStore(resolveMarketDataDbPath().path);
  const pairs = new Map<string, number>(); // pair → base reference rate
  for (const d of descriptors) {
    const tag = d.economicTerms.hedgingSetTag;
    if (!tag) continue;
    const base = tag.split("/")[0];
    if (!base || base === REPORTING) continue;
    const rate = FIXTURE_RATES[base];
    if (rate && rate > 0) pairs.set(tag, rate);
  }

  let ticksSeeded = 0;
  for (const [pair, baseRate] of pairs) {
    for (let i = HISTORY_LEVELS; i >= 0; i--) {
      const day = new Date(Date.parse(`${FIXTURE_SETTLE_DATE}T17:00:00.000Z`));
      day.setUTCDate(day.getUTCDate() - i);
      const asOf = day.toISOString();
      const id = `s1-fixture:${pair}:${asOf.slice(0, 10)}`;
      // ±0.4% deterministic wobble around the reference rate (no RNG — reproducible).
      const mid = baseRate * (1 + 0.004 * Math.sin(i * 0.7));
      const before = md.getLatest(MARKET_DATA_SOURCE, pair, asOf, "production");
      const beforeId = before?.id;
      md.append({
        id,
        source: MARKET_DATA_SOURCE,
        instrument: pair,
        dataType: "fx-quote",
        provenance: "production",
        asOf,
        payload: { mid, bid: mid * 0.9995, ask: mid * 1.0005, pair },
      });
      // Count only genuinely-new rows (INSERT OR IGNORE is keyed on id).
      const after = md.getLatest(MARKET_DATA_SOURCE, pair, asOf, "production");
      if (after && after.id === id && beforeId !== id) ticksSeeded += 1;
    }
  }
  return { pairs: pairs.size, ticksSeeded };
}

// ---------------------------------------------------------------------------
// Run.
// ---------------------------------------------------------------------------

function countType(type: string): number {
  let n = 0;
  for (const _ of eventStore.replay({ type })) n += 1;
  return n;
}

console.log("\n=== WS-V2-AUTHORITATIVE S1 — FIL-instance + market-data backfill ===");
console.log(`store           : ${process.env.BANK_EVENT_DB ?? "(home default)"}`);
console.log(`reporting ccy   : ${REPORTING} (from anchorFunctionalCurrency())`);

const tradesInStore = countType("FxTradeExecuted");
console.log(`FxTradeExecuted in store: ${tradesInStore}`);

const descriptors = tradesInStore > 0 ? descriptorsFromExistingTrades() : fixtureDescriptors();
console.log(
  `source          : ${tradesInStore > 0 ? "existing FX book" : "deterministic fixture book"} (${descriptors.length} instrument descriptors)`,
);

const fil = emitFilInstances(descriptors);
console.log(`FIL instances   : ${fil.created} created, ${fil.terminated} terminated`);

const md = seedMarketData(descriptors);
console.log(`market data     : ${md.pairs} pair(s), ${md.ticksSeeded} new production tick(s)`);

console.log(`\nFilInstrumentCreated in store (after)   : ${countType("FilInstrumentCreated")}`);
console.log(`FilInstrumentTerminated in store (after): ${countType("FilInstrumentTerminated")}`);
console.log("=== S1 backfill complete ===\n");
