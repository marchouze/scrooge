// platform/forward-obligations/projection.ts
//
// Multi-source Forward Obligations projection.
//
// Folds across existing event types and canonical registers to produce a
// unified view of future obligations. Never maintains its own register —
// it is a query-time projection (Principle 1).
//
// Sources folded:
//   1. Regulatory filings — BA325 (daily), BA700 (monthly), BA610 (quarterly),
//      POPIA annual, CIPC annual. Derived from obligations-register pattern +
//      seeds where the obligations register does not carry schedule metadata.
//   2. Trade settlements — FxTradeExecuted events from the event store.
//      Settlement date derived as near-leg settlementDate (T+2 business days
//      from trade date, as booked in the CDM).
//   3. Manual items — ForwardObligationRegistered events (ad-hoc items only).
//   4. Seed items — policy-review cycle triggers and any supplementary items
//      from seed.ts (bridging until live substrates are wired).
//
// Returns ForwardObligation[] sorted by dueDate ASC, filtered to the horizon.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../event-store/store";
import { addBusinessDays, buildSeedObligations, nextMonthlyDate, nextQuarterEnd } from "./seed";
import type { ForwardObligation, HorizonOpts } from "./types";

// ---------------------------------------------------------------------------
// Horizon window
// ---------------------------------------------------------------------------

export const DEFAULT_HORIZON_DAYS = 90;

export function resolveHorizon(
  asOf: string,
  opts?: Partial<HorizonOpts>,
): { from: string; to: string } {
  if (opts?.kind === "range") {
    const from = opts.from ?? asOf.slice(0, 10);
    const to = opts.to ?? addBusinessDays(asOf.slice(0, 10), DEFAULT_HORIZON_DAYS);
    return { from, to };
  }
  const days = opts?.kind === "days" && opts.days !== undefined ? opts.days : DEFAULT_HORIZON_DAYS;
  return {
    from: asOf.slice(0, 10),
    to: addBusinessDays(asOf.slice(0, 10), days),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

/** True if isoDate is within [from, to] inclusive. */
function inWindow(isoDate: string, from: string, to: string): boolean {
  return isoDate >= from && isoDate <= to;
}

/** Generate ISO dates for every business day between from and to inclusive. */
function* businessDaysInRange(from: string, to: string): Generator<string> {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  const cur = new Date(start);
  while (cur <= end) {
    if (!isWeekend(cur)) yield toIsoDate(cur);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

// ---------------------------------------------------------------------------
// Source 1 — Regulatory filings
//
// Derives the next N due dates for each scheduled SARB/PA/regulatory return
// within the horizon. No dependency on the obligations register at runtime
// (the register is prose-authored; the schedule metadata is not yet machine-
// readable). These items use hardcoded cadence rules that match the known
// obligations in the register (ORG-BA325, ORG-BA700, ORG-BA610 etc.).
//
// Substrate gap: when the obligations register gains a `schedule` field, this
// fold should derive from the register rows instead. Queued as a roadmap item.
// ---------------------------------------------------------------------------

interface RegulatoryReturnSpec {
  id: string;
  title: string;
  owner: string;
  relatedRef: string;
  description: string;
  /** "daily" | "monthly:<dayOfMonth>" | "quarterly:<offsetDaysAfterQuarterEnd>" */
  cadence: string;
}

const REGULATORY_RETURN_SPECS: RegulatoryReturnSpec[] = [
  {
    id: "reg:ba325",
    title: "BA325 daily SARB return",
    owner: "Bea (Financial accounting engineer, engineering)",
    relatedRef: "ORG-BA325-001",
    description:
      "Daily statutory return to the SARB Prudential Authority per Regulation 25 (Regulations Relating to Banks). " +
      "Bea generates from the accounting event log; Tomas submits via the PA portal.",
    cadence: "daily",
  },
  {
    id: "reg:ba700",
    title: "BA700 monthly capital adequacy return",
    owner: "Camille (Chief Financial Officer, governance)",
    relatedRef: "ORG-BA700-001",
    description:
      "Monthly capital adequacy and leverage return to the SARB PA per Regulation 38. " +
      "Due by the 20th of the following month. Camille signs off; Bea compiles.",
    cadence: "monthly:20",
  },
  {
    id: "reg:ba610",
    title: "BA610 quarterly large-exposure return",
    owner: "Camille (Chief Financial Officer, governance)",
    relatedRef: "ORG-BA610-001",
    description:
      "Quarterly large-exposure return to the SARB PA per Regulation 37. " +
      "Due 21 days after quarter-end. Rohan (Market risk engineer) provides the exposure data.",
    cadence: "quarterly:21",
  },
  {
    id: "reg:ba300",
    title: "BA300 monthly liquidity return",
    owner: "Camille (Chief Financial Officer, governance)",
    relatedRef: "ORG-BA300-001",
    description:
      "Monthly liquidity-coverage-ratio return to the SARB PA per Regulation 26(12). " +
      "Due by the 15th of the following month.",
    cadence: "monthly:15",
  },
];

function generateRegulatoryFilings(from: string, to: string, asOf: string): ForwardObligation[] {
  const results: ForwardObligation[] = [];

  for (const spec of REGULATORY_RETURN_SPECS) {
    if (spec.cadence === "daily") {
      // Generate one item per business day in the window (capped at 10 to
      // keep the planning view readable; the liquidity view ignores these
      // as they carry no cashflow).
      let count = 0;
      for (const date of businessDaysInRange(from, to)) {
        if (count >= 10) break; // safety cap for display
        results.push({
          id: `${spec.id}:${date}`,
          title: spec.title,
          source: "regulatory-filing",
          dueDate: date,
          certainty: "certain",
          owner: spec.owner,
          relatedRef: spec.relatedRef,
          description: spec.description,
        });
        count++;
      }
    } else if (spec.cadence.startsWith("monthly:")) {
      const dayOfMonth = Number.parseInt(spec.cadence.split(":")[1] ?? "20", 10);
      // Generate up to 3 monthly occurrences within the window.
      let nextDate = nextMonthlyDate(asOf.slice(0, 10), dayOfMonth);
      let iterations = 0;
      while (nextDate <= to && iterations < 3) {
        if (nextDate >= from) {
          results.push({
            id: `${spec.id}:${nextDate}`,
            title: spec.title,
            source: "regulatory-filing",
            dueDate: nextDate,
            certainty: "certain",
            owner: spec.owner,
            relatedRef: spec.relatedRef,
            description: spec.description,
          });
        }
        // Advance to next month
        const d = new Date(`${nextDate}T00:00:00Z`);
        d.setUTCMonth(d.getUTCMonth() + 1);
        nextDate = toIsoDate(d);
        iterations++;
      }
    } else if (spec.cadence.startsWith("quarterly:")) {
      const offsetDays = Number.parseInt(spec.cadence.split(":")[1] ?? "21", 10);
      const qDate = nextQuarterEnd(asOf.slice(0, 10), offsetDays);
      if (inWindow(qDate, from, to)) {
        results.push({
          id: `${spec.id}:${qDate}`,
          title: spec.title,
          source: "regulatory-filing",
          dueDate: qDate,
          certainty: "certain",
          owner: spec.owner,
          relatedRef: spec.relatedRef,
          description: spec.description,
        });
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Source 2 — Trade settlements
//
// Folds FxTradeExecuted events from the event store. For each event:
//   - Extracts the near-leg settlement date directly from the CDM payload
//     (the CDM leg carries `settlementDate.iso`).
//   - Falls back to tradeDate + 2 business days if the leg settlement date
//     is not available.
//   - Creates one obligation per leg (near + far for swaps).
//   - Marks cashflows: near-leg outflow when side === "sell" (bank pays the
//     pay-currency), inflow when side === "buy".
//   - Certainty: "probable" (the trade is booked but settlement can fail).
// ---------------------------------------------------------------------------

interface FxLegRaw {
  legKind?: string;
  payCurrency?: string;
  receiveCurrency?: string;
  notional?: { amountMinor?: number; currency?: string };
  counterNotional?: { amountMinor?: number; currency?: string };
  settlementDate?: { iso?: string };
}

interface FxTradePayloadRaw {
  tradeId?: { value?: string };
  productTaxonomy?: string;
  side?: string;
  legs?: FxLegRaw[];
  tradeDate?: { iso?: string };
  counterparty?: { id?: string };
  trader?: string;
  bookId?: string;
}

function generateTradeSettlements(
  store: Pick<EventStore, "replay">,
  from: string,
  to: string,
  asOf: string,
): ForwardObligation[] {
  const results: ForwardObligation[] = [];

  for (const event of store.replay({ type: "FxTradeExecuted", asOf })) {
    const payload = event.payload as FxTradePayloadRaw;
    const tradeId = payload.tradeId?.value ?? event.event_id;
    const side = payload.side ?? "buy";
    const tradeDate = payload.tradeDate?.iso ?? asOf.slice(0, 10);
    const legs = payload.legs ?? [];

    for (const leg of legs) {
      // Settlement date: use CDM leg settlementDate if present; fallback T+2.
      const settlementDate = leg.settlementDate?.iso ?? addBusinessDays(tradeDate, 2);

      if (!inWindow(settlementDate, from, to)) continue;

      // Cashflow direction: for the near leg, when side is "sell" from the
      // bank's perspective, the bank pays the pay-currency (outflow).
      // When side is "buy", the bank receives (inflow of receiveCurrency).
      // For simplicity, model as one cashflow per leg using the notional.
      const notional = leg.notional;
      const payCurrency = leg.payCurrency ?? "ZAR";
      const legKind = leg.legKind ?? "near";

      const cashflow =
        notional?.amountMinor !== undefined
          ? {
              // Convert from minor units (cents) to major units (rand/dollars)
              amount: Math.abs(notional.amountMinor) / 100,
              currency: payCurrency,
              direction: side === "sell" ? ("outflow" as const) : ("inflow" as const),
            }
          : undefined;

      const counterpartyId = payload.counterparty?.id ?? "unknown-counterparty";
      const title = `FX ${payload.productTaxonomy ?? "spot"} settlement — ${payCurrency} ${legKind} leg`;

      results.push({
        id: `trade-settlement:${tradeId}:${legKind}`,
        title,
        source: "trade-settlement",
        dueDate: settlementDate,
        certainty: "probable",
        owner: "Tomas (Operations & payments engineer, engineering)",
        ...(cashflow !== undefined ? { cashflow } : {}),
        relatedRef: tradeId,
        description: `Settlement of ${payload.productTaxonomy ?? "FX"} trade ${tradeId} (${side} side, ${legKind} leg). Counterparty: ${counterpartyId}. Settlement via correspondent bank per D-FX-CLS-MEMBERSHIP.`,
      });
    }
  }

  // Seed trade settlement: scenario:06-fx-spot-trade ZAR 7.5m outflow
  // Present when the event store is empty / no live trades are in the window.
  const hasLiveTrades = results.length > 0;
  if (!hasLiveTrades) {
    const seedSettleDate = addBusinessDays(asOf.slice(0, 10), 2);
    if (inWindow(seedSettleDate, from, to)) {
      results.push({
        id: "seed:trade-settlement:fx-spot-001",
        title: "FX spot settlement — ZAR near leg (seed)",
        source: "trade-settlement",
        dueDate: seedSettleDate,
        certainty: "probable",
        owner: "Tomas (Operations & payments engineer, engineering)",
        cashflow: {
          amount: 7_500_000,
          currency: "ZAR",
          direction: "outflow",
        },
        relatedRef: "scenario:06-fx-spot-trade",
        description:
          "Seed: ZAR 7.5m spot settlement from scenario:06-fx-spot-trade. " +
          "T+2 physical settlement via correspondent per D-FX-CLS-MEMBERSHIP. " +
          "This seed is suppressed once live FxTradeExecuted events are present.",
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Source 3 — Manual items (ForwardObligationRegistered events)
//
// These are genuine ad-hoc items registered via the manual path. The event
// type is intentionally thin — it is NOT the primary source.
// ---------------------------------------------------------------------------

interface ForwardObligationRegisteredPayload {
  obligationId?: string;
  title?: string;
  dueDate?: string;
  certainty?: string;
  owner?: string;
  cashflow?: {
    amount?: number;
    currency?: string;
    direction?: string;
  };
  relatedRef?: string;
  description?: string;
}

function generateManualItems(
  store: Pick<EventStore, "replay">,
  from: string,
  to: string,
  asOf: string,
): ForwardObligation[] {
  const results: ForwardObligation[] = [];

  for (const event of store.replay({ type: "ForwardObligationRegistered", asOf })) {
    const p = event.payload as ForwardObligationRegisteredPayload;
    if (!p.dueDate || !inWindow(p.dueDate, from, to)) continue;

    const certainty = (p.certainty ?? "estimated") as ForwardObligation["certainty"];
    const cashflow =
      p.cashflow?.amount !== undefined && p.cashflow.currency && p.cashflow.direction
        ? {
            amount: p.cashflow.amount,
            currency: p.cashflow.currency,
            direction: p.cashflow.direction as "inflow" | "outflow",
          }
        : undefined;

    results.push({
      id: `manual:${p.obligationId ?? event.event_id}`,
      title: p.title ?? "Manual obligation",
      source: "manual",
      dueDate: p.dueDate,
      certainty,
      owner: p.owner ?? event.actor.id,
      ...(cashflow !== undefined ? { cashflow } : {}),
      ...(p.relatedRef !== undefined ? { relatedRef: p.relatedRef } : {}),
      ...(p.description !== undefined ? { description: p.description } : {}),
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main projection entrypoint
// ---------------------------------------------------------------------------

export interface ProjectionOpts {
  /** The event store to replay trade and manual events from. */
  store: Pick<EventStore, "replay">;
  /** Business-time of the projection run (ISO datetime or date). */
  asOf: string;
  /** Horizon options — defaults to 90 days from asOf. */
  horizon?: Partial<HorizonOpts>;
}

export interface ForwardObligationsResult {
  asOf: string;
  from: string;
  to: string;
  /** All obligations sorted by dueDate ASC. */
  obligations: ForwardObligation[];
  /** Total count by source. */
  sourceCounts: Record<string, number>;
}

export function buildForwardObligations(opts: ProjectionOpts): ForwardObligationsResult {
  const asOf = opts.asOf.slice(0, 10);
  const { from, to } = resolveHorizon(asOf, opts.horizon);

  const all: ForwardObligation[] = [];

  // Source 1 — regulatory filings (derived from hardcoded cadence rules)
  const regulatoryItems = generateRegulatoryFilings(from, to, asOf);
  all.push(...regulatoryItems);

  // Source 2 — trade settlements (event store fold)
  const tradeItems = generateTradeSettlements(opts.store, from, to, asOf);
  all.push(...tradeItems);

  // Source 3 — manual items (event store fold)
  const manualItems = generateManualItems(opts.store, from, to, asOf);
  all.push(...manualItems);

  // Source 4 — seed obligations (policy-review + supplementary static items)
  const seedItems = buildSeedObligations(asOf).filter((s) => inWindow(s.dueDate, from, to));
  all.push(...seedItems);

  // Sort by dueDate ASC then by id for stable ordering.
  all.sort((a, b) => {
    if (a.dueDate < b.dueDate) return -1;
    if (a.dueDate > b.dueDate) return 1;
    return a.id < b.id ? -1 : 1;
  });

  // Count by source.
  const sourceCounts: Record<string, number> = {};
  for (const item of all) {
    sourceCounts[item.source] = (sourceCounts[item.source] ?? 0) + 1;
  }

  return {
    asOf,
    from,
    to,
    obligations: all,
    sourceCounts,
  };
}

export type { HorizonOpts };
