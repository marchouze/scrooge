// v2-core/desk/roster.ts
//
// The canonical born-V2 desk roster — the three FRTB-compliant desks as typed,
// validated DeskRegistered payloads. This module is the SINGLE SOURCE of the
// desk set: the ci:migrate seed emits these exact payloads as DeskRegistered
// events (events-first; Principle 1), and the FX-trade boundary refinement
// (platform/markets/cdm/fx.ts) resolves a trade's `deskId` → `bookType` against
// this same roster. One source, two consumers — no drift.
//
// Each desk carries the FULL MAR12 desk-definition attribute set. The seat
// fields are SEAT TITLES ONLY (never personal names) per the V2 UI convention.
// The roster Titles are the canonical roster seats:
//   - "Head of Global Markets"  — the markets franchise head (Trading / Hedging
//                                 desk head + reporting line).
//   - "Treasurer"               — funding / liquidity / ALM / IRRBB head
//                                 (Treasury desk head; ALCO chair).
//   - "Chief Risk Officer"      — second-line risk owner for desk limits.
//
// PACKAGE BOUNDARY: inside `v2-core/` — no v1 imports. See `recon:v2-no-v1-import`.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21);
//   D-FX-BOOK-BOUNDARY; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

import type { Instant } from "../fil-core/primitives";
import {
  type DeskBookType,
  type DeskId,
  type DeskRegisteredPayload,
  deskRegisteredPayloadSchema,
  makeDeskId,
} from "./events";

/**
 * The fixed effective-from instant for the seeded desks. A constant (never
 * `new Date()` / `Date.now()`) so the ci:migrate replay is byte-stable
 * (Engineering Charter — replay-safe seeds).
 */
export const DESK_ROSTER_EFFECTIVE_FROM = "2026-06-21T00:00:00.000Z" as Instant;

/** Upward citations every seeded DeskRegistered event carries (Principle 2). */
const DESK_ROSTER_CITATIONS_BASE = [
  "D-FRTB-TRADING-DESK-STRUCTURE",
  "D-FX-BOOK-BOUNDARY",
  "Principles/1-events-are-truth.md",
  "Principles/2-single-graph-discipline.md",
] as const;

/** A fresh mutable copy of the roster citations (one per desk literal). */
function rosterCitations(): string[] {
  return [...DESK_ROSTER_CITATIONS_BASE];
}

/**
 * The three canonical desks. Authored as raw payload objects, then validated
 * through `deskRegisteredPayloadSchema` at module-load (`CANONICAL_DESKS`
 * below) so a malformed roster fails closed at import — the schema's MAR12
 * completeness + (deskKind, bookType) coherence refinement gate the data.
 */
const RAW_DESKS: readonly DeskRegisteredPayload[] = [
  // Trading Desk 1 — FX market-making / proprietary trading-book risk-taking.
  {
    deskId: makeDeskId("trading-desk", "trading-desk-1"),
    deskName: "Trading Desk 1",
    deskKind: "trading-desk",
    bookType: "trading",
    businessStrategy:
      "FX market-making and proprietary trading-book risk-taking. Provides two-way " +
      "ZAR-vs-major-and-EM liquidity to clients and runs the trading-book FX warehouse " +
      "within the market-risk appetite delegated by the CRO. No-prop attribution applies: " +
      "every position is client-flow- or sanctioned-hedge-referenced.",
    deskHeadSeat: "Head of Global Markets",
    reportingLine: "Head of Global Markets",
    riskManagementStructure: {
      riskOwnerSeat: "Chief Risk Officer",
      tradingLimits: [
        {
          limitKind: "net-open-position",
          currency: "ZAR",
          thresholdAmount: "250000000",
          description:
            "Intraday net open FX position limit (ZAR-equivalent) for the trading-book " +
            "FX market-making warehouse, within CRO-delegated market-risk appetite.",
        },
        {
          limitKind: "value-at-risk",
          currency: "ZAR",
          thresholdAmount: "5000000",
          description: "1-day 99% VaR limit (ZAR) for the trading-desk FX warehouse.",
        },
      ],
    },
    status: "active",
    effectiveFrom: DESK_ROSTER_EFFECTIVE_FROM,
    citations: rosterCitations(),
  },
  // Hedging Desk 1 — hedges trading-book market risk (trading book).
  {
    deskId: makeDeskId("hedging-desk", "hedging-desk-1"),
    deskName: "Hedging Desk 1",
    deskKind: "hedging-desk",
    bookType: "trading",
    businessStrategy:
      "Hedges trading-book market risk. Runs FX and rates hedges that offset the " +
      "residual market risk of the trading-book warehouse, keeping the desk-level and " +
      "aggregate trading-book exposures inside the CRO-delegated appetite. A trading-book " +
      "desk: its hedges are themselves trading-book instruments.",
    deskHeadSeat: "Head of Global Markets",
    reportingLine: "Head of Global Markets",
    riskManagementStructure: {
      riskOwnerSeat: "Chief Risk Officer",
      tradingLimits: [
        {
          limitKind: "net-open-position",
          currency: "ZAR",
          thresholdAmount: "100000000",
          description:
            "Net open FX position limit (ZAR-equivalent) for trading-book hedging activity — " +
            "tighter than the market-making desk, as the hedging desk damps rather than takes risk.",
        },
      ],
    },
    status: "active",
    effectiveFrom: DESK_ROSTER_EFFECTIVE_FROM,
    citations: rosterCitations(),
  },
  // Treasury Desk 1 — funding / liquidity / ALM / IRRBB (banking book).
  {
    deskId: makeDeskId("treasury-desk", "treasury-desk-1"),
    deskName: "Treasury Desk 1",
    deskKind: "treasury-desk",
    bookType: "banking-treasury",
    businessStrategy:
      "Banking-book funding, liquidity (LCR/NSFR), asset-liability management and IRRBB. " +
      "Manages the bank's funding plan, HQLA portfolio, FTP curve and interest-rate-risk-in-" +
      "the-banking-book within the RAS, chaired through ALCO. A banking-book desk — its " +
      "positions are NOT trading-book risk-taking.",
    deskHeadSeat: "Treasurer",
    reportingLine: "Treasurer",
    riskManagementStructure: {
      riskOwnerSeat: "Chief Risk Officer",
      tradingLimits: [
        {
          limitKind: "net-open-position",
          currency: "ZAR",
          thresholdAmount: "50000000",
          description:
            "Structural banking-book net open FX position limit (ZAR-equivalent) for the " +
            "treasury desk's residual currency exposure, within the RAS.",
        },
      ],
    },
    status: "active",
    effectiveFrom: DESK_ROSTER_EFFECTIVE_FROM,
    citations: rosterCitations(),
  },
];

/**
 * The validated canonical desk set. Each raw payload is parsed through
 * `deskRegisteredPayloadSchema` at module load — a malformed or
 * MAR12-incomplete roster fails closed at import time (fail-closed, Charter
 * cmd 2).
 */
export const CANONICAL_DESKS: readonly DeskRegisteredPayload[] = RAW_DESKS.map((d) =>
  deskRegisteredPayloadSchema.parse(d),
);

/** The default desk the FX simulator books to (a trading-book desk). */
export const DEFAULT_SIM_DESK_ID: DeskId = makeDeskId("trading-desk", "trading-desk-1");

/**
 * The trading-book desks the FX simulator is permitted to choose from. The sim
 * generates trading-book positions, so it may only book to trading-book desks.
 */
export const SIM_TRADING_BOOK_DESK_IDS: readonly DeskId[] = CANONICAL_DESKS.filter(
  (d) => d.bookType === "trading",
).map((d) => d.deskId);

/**
 * The banking-book (treasury) desks. Banking-book equity holdings (BA 340, the
 * simple-risk-weight method) and other banking-book positions book HERE — never
 * to a trading-book desk (the FRTB boundary; banking-book equity must NOT enter
 * BA 320 trading-book equity risk). Authority: D-FRTB-TRADING-DESK-STRUCTURE;
 * D-BA-RETURN-SIMULATOR-FIRST Phase 2c.
 */
export const SIM_BANKING_BOOK_DESK_IDS: readonly DeskId[] = CANONICAL_DESKS.filter(
  (d) => d.bookType === "banking-treasury",
).map((d) => d.deskId);

/** The default banking-book desk the simulator books banking-book positions to. */
export const DEFAULT_SIM_BANKING_BOOK_DESK_ID: DeskId =
  SIM_BANKING_BOOK_DESK_IDS[0] ?? makeDeskId("treasury-desk", "treasury-desk-1");

/**
 * Resolve a `deskId` to the canonical desk's `bookType`, or `null` if the id is
 * not a registered canonical desk. This is the store-free resolver the FX-trade
 * schema refinement uses to enforce the trading/banking-book boundary at parse
 * time (the event-sourced register projection is the runtime authority that
 * `recon:frtb-desk-integrity` reads; this static roster is the compile-time
 * canonical set, seeded verbatim, so the two never diverge).
 */
export function canonicalDeskBookType(deskId: string): DeskBookType | null {
  const desk = CANONICAL_DESKS.find((d) => d.deskId === deskId);
  return desk ? desk.bookType : null;
}

/** True iff `deskId` is one of the registered canonical desks. */
export function isCanonicalDesk(deskId: string): boolean {
  return CANONICAL_DESKS.some((d) => d.deskId === deskId);
}
