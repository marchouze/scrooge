// platform/projections/markets/bond-settlement-register.ts
//
// Bond Settlement Register — pure fold over bond settlement events.
//
// Tracks the lifecycle of each settlement instruction from
// BondSettlementInstructed → BondCustodianSettlementConfirmed
//                           | BondCustodianSettlementFailed
//
// Keyed by settlementId. Each row is a state machine:
//   instructed → confirmed | failed
//
// Authority:
//   D-TRADE-LIFECYCLE-IFRS-CHAIN (CEO-approved 2026-05-18)
//   D-NPA-SAGB-BOND-INTERNAL-TEST (CEO-approved 2026-05-26)
//   JSE Debt Market Rules; STRATE Settlement Rules.
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import type { Event } from "../../event-store/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type BondSettlementStatus = "instructed" | "confirmed" | "failed";

export interface BondSettlementRow {
  readonly settlementId: string;
  readonly tradeId: string;
  readonly isin: string;
  readonly side: "buy" | "sell";
  readonly nominalMinor: number;
  readonly dirtyConsiderationZarMinor: number;
  readonly settlementDate: string;
  readonly status: BondSettlementStatus;
  readonly custodianRef: string | undefined;
  readonly cashLegZarMinor: number | undefined;
  readonly failReason: string | undefined;
  readonly instructedAt: string;
  readonly updatedAt: string;
}

export interface BondSettlementRegisterState {
  readonly rows: ReadonlyMap<string, BondSettlementRow>;
}

export const bondSettlementRegisterInitial: BondSettlementRegisterState = {
  rows: new Map(),
};

// ---------------------------------------------------------------------------
// Fold
// ---------------------------------------------------------------------------

function isBondSettlementEvent(e: Event): e is Event & {
  type:
    | "BondSettlementInstructed"
    | "BondCustodianSettlementConfirmed"
    | "BondCustodianSettlementFailed";
} {
  return (
    e.type === "BondSettlementInstructed" ||
    e.type === "BondCustodianSettlementConfirmed" ||
    e.type === "BondCustodianSettlementFailed"
  );
}

export function reduceBondSettlementRegister(
  state: BondSettlementRegisterState,
  event: Event,
): BondSettlementRegisterState {
  if (!isBondSettlementEvent(event)) return state;

  const next = new Map(state.rows);
  const p = event.payload as Record<string, unknown>;

  switch (event.type) {
    case "BondSettlementInstructed": {
      const row: BondSettlementRow = {
        settlementId: p.settlementId as string,
        tradeId: p.tradeId as string,
        isin: p.isin as string,
        side: p.side as "buy" | "sell",
        nominalMinor: p.nominalMinor as number,
        dirtyConsiderationZarMinor: p.dirtyConsiderationZarMinor as number,
        settlementDate: p.settlementDate as string,
        status: "instructed",
        custodianRef: undefined,
        cashLegZarMinor: undefined,
        failReason: undefined,
        instructedAt: p.instructedAt as string,
        updatedAt: event.as_of,
      };
      next.set(row.settlementId, row);
      return { rows: next };
    }

    case "BondCustodianSettlementConfirmed": {
      const settlementId = p.settlementId as string;
      const existing = next.get(settlementId);
      if (!existing) return state;
      next.set(settlementId, {
        ...existing,
        status: "confirmed",
        custodianRef: p.custodianRef as string,
        cashLegZarMinor: p.cashLegZarMinor as number,
        updatedAt: event.as_of,
      });
      return { rows: next };
    }

    case "BondCustodianSettlementFailed": {
      const settlementId = p.settlementId as string;
      const existing = next.get(settlementId);
      if (!existing) return state;
      next.set(settlementId, {
        ...existing,
        status: "failed",
        custodianRef: (p.custodianRef as string | undefined) ?? existing.custodianRef,
        failReason: p.failReason as string,
        updatedAt: event.as_of,
      });
      return { rows: next };
    }
  }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

/** Build the full register from a replay of all events. */
export function buildBondSettlementRegister(events: Iterable<Event>): BondSettlementRegisterState {
  let state = bondSettlementRegisterInitial;
  for (const e of events) {
    state = reduceBondSettlementRegister(state, e);
  }
  return state;
}

/** Return rows newest-first (by instructedAt). */
export function listBondSettlements(state: BondSettlementRegisterState): BondSettlementRow[] {
  return [...state.rows.values()].sort((a, b) => b.instructedAt.localeCompare(a.instructedAt));
}

/** Find a single settlement row by settlementId. */
export function getBondSettlement(
  state: BondSettlementRegisterState,
  settlementId: string,
): BondSettlementRow | undefined {
  return state.rows.get(settlementId);
}
