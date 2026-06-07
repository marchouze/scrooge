// platform/event-store/event-types/balance-sheet.ts
//
// Balance sheet projected event-payload schemas.
//
// Covers:
//   BalanceSheetProjected — period-end balance-sheet projection emitted by
//     Bea (Accounting and financial reporting engineer) after each period
//     close. Provides the supplemental BA 120 line items that individual
//     trade events do not capture: Tier 2 capital, issued unsecured wholesale
//     funding (GT 1Y), covered bonds, and asset-side RSF inputs (retail loans,
//     encumbered assets, off-balance-sheet commitments).
//
//     The projection supplements — not replaces — the event-driven folds
//     in `platform/projections/alm-positions.ts`. DepositTaken, FundingLine-
//     Drawn, and InterbankLoanPlaced continue to be the primary ASF/RSF
//     sources for their respective line items; BalanceSheetProjected adds
//     the balance-sheet-scope items those trade events do not cover.
//
// Authority: BA 120; BCBS D396; Banks Act Reg 26A (NSFR); D-TREASURY-GAPS-WAVE1.
// Author: Bea (Accounting and financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// BalanceSheetProjected
// ---------------------------------------------------------------------------

export const balanceSheetProjectedPayloadSchema = z.object({
  projectionId: z.string().min(1),
  asOf: z.string().min(1),
  // ASF supplemental items (BA 120 Table 1) — complement individual event folds
  tier2CapitalZar: z.number().int().nonnegative(),
  unsecuredWholesaleFundingGt1yZar: z.number().int().nonnegative(),
  coveredBondsIssuedGt6mZar: z.number().int().nonnegative(),
  // RSF supplemental items (BA 120 Table 2) — complement HQLA + IBL folds
  unencumberedRetailLoansLt1yZar: z.number().int().nonnegative(),
  unencumberedRetailLoansGt1yZar: z.number().int().nonnegative(),
  encumberedAssetsZar: z.number().int().nonnegative(),
  offBalanceSheetCommitmentsZar: z.number().int().nonnegative(),
});

export type BalanceSheetProjectedPayload = z.infer<typeof balanceSheetProjectedPayloadSchema>;

export function makeBalanceSheetProjected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BalanceSheetProjectedPayload;
  eventId?: string;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BalanceSheetProjected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: balanceSheetProjectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Typed event types list
// ---------------------------------------------------------------------------

export const BALANCE_SHEET_TYPED_EVENT_TYPES = ["BalanceSheetProjected"] as const;
