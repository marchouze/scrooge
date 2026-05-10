// platform/projections/accounts/balance.projection.ts
//
// Account-balance projection — sum of signed cash postings per account.
//
// At v0 the projection accepts any event whose payload contains an explicit
// `{accountId, cashAmountMinor, currency}` triple — the substrate-shaped
// minimum that lets the dry-run scenario's `CapitalContributionRecorded` and
// FX settlement-leg events accumulate to a balance without further plumbing.
//
// Substrate gap (named in the decision record at
// `Owner Inbox/2026-05-10_tomas-atlas-bea_d-bank-account-substrate.md`):
// the M1 sub-ledger projection (`prototype/platform/projections/markets/sub-
// ledger.ts`) emits `SubLedgerRow`s keyed by `(sourceEventId, legKind)`,
// *not* by accountId — the M1 cut materialises typed posting candidates whose
// account dispatch is the M2 GL projection's job (built under D-EVENT-STORE-
// SCALING Slice 4 / pack §3.1). Until that lands, the balance projection
// over canonical M1 events yields empty balances; fixture tests demonstrate
// the fold over synthetic posting events that carry an explicit accountId.
// The Q4 follow-on routes the M1-→-account dispatch into the GL projection
// slice; this projection is the typed surface that slice will reduce into.
//
// Replay rule: `cumulative-fold` per accountId — every posting against the
// account is folded into a running signed total. As-of replay is supported
// through the projector's standard `asOf` opt.
//
// Sign convention: positive `cashAmountMinor` = credit (cash in); negative =
// debit (cash out). The natural-balance side of the underlying GL leaf is a
// chart-of-accounts concern; the projection records the signed sum without
// flipping it, so an asset account with debit-side natural balance simply
// shows a positive number when in funds.
//
// D-BANK-ACCOUNT-SUBSTRATE — under standing authority of D-FIRST-DRY-RUN-
// SCENARIO (CEO-approved 2026-05-10). Pack §6 brief #A1.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO; balance semantics) · Atlas (Core
//   banking platform architect, engineering — substrate consult).

import type { Event } from "../../event-store/types";
import type { Projection } from "../types";
import type { AccountBalanceRow, AccountBalanceState } from "./types";
import { accountBalanceInitial } from "./types";

/**
 * The convention shape a posting event must satisfy for the balance
 * projection to fold it. Free-form so M1 sub-ledger rows are not the only
 * source: `CapitalContributionRecorded`, `FXSettlementLegPosted`, and
 * future GL-projection-emitted posting events all dispatch through this
 * projection by satisfying the convention shape.
 *
 * Type-level note: the projection accepts any `Event`; the fold runtime-
 * checks the payload at reduce time and skips events that don't fit. The
 * convention is documented here, not enforced via Zod, so that downstream
 * event types can adopt the projection without coupling back to a single
 * payload schema.
 */
export interface AccountPostingConvention {
  /** Account being posted against. Must match an open `accountId` in the master. */
  readonly accountId: string;
  /** Signed posting in minor currency units (positive = credit). */
  readonly cashAmountMinor: number;
  /** ISO 4217 currency. Must match the account's currency. */
  readonly currency: string;
}

/**
 * Runtime-shape predicate. Returns true iff the payload carries the
 * convention triple with the right value types. Uses defensive typeof
 * checks so non-conforming payloads (e.g. AgentDecision with a `reasoning`
 * string) silently pass through without folding.
 */
function isAccountPosting(
  payload: Record<string, unknown>,
): payload is AccountPostingConvention & Record<string, unknown> {
  const accountId = payload.accountId;
  const cashAmountMinor = payload.cashAmountMinor;
  const currency = payload.currency;
  return (
    typeof accountId === "string" &&
    accountId.length > 0 &&
    typeof cashAmountMinor === "number" &&
    Number.isFinite(cashAmountMinor) &&
    typeof currency === "string" &&
    currency.length === 3
  );
}

/**
 * The balance projection's `accepts` predicate intentionally excludes the
 * bank-account-lifecycle events themselves — opening or closing an account
 * does not move cash. Only events that carry the posting convention shape
 * fold here.
 */
const LIFECYCLE_EVENT_TYPES = new Set<string>([
  "BankAccountOpened",
  "BankAccountConfigured",
  "BankAccountClosed",
]);

function applyPosting(
  state: AccountBalanceState,
  posting: AccountPostingConvention,
  e: Event,
): AccountBalanceState {
  const existing = state.balances.get(posting.accountId);
  // Currency-mismatch protection: if a posting comes in for an account in
  // a different currency than its first-recorded posting, that's a
  // substrate-integrity violation. The projection drops it and the recon
  // pipeline (Vera follow-on) surfaces the mismatch.
  if (existing && existing.currency !== posting.currency) {
    return state;
  }
  const row: AccountBalanceRow = {
    accountId: posting.accountId,
    currency: posting.currency,
    entity: e.entity,
    balanceMinor: (existing?.balanceMinor ?? 0) + posting.cashAmountMinor,
    asOf: e.as_of,
    postingCount: (existing?.postingCount ?? 0) + 1,
  };
  const next = new Map(state.balances);
  next.set(posting.accountId, row);
  return { balances: next };
}

export const accountBalanceProjection: Projection<AccountBalanceState> = {
  name: "accounts.balance",
  initial: accountBalanceInitial,
  accepts: (e): e is Event => {
    if (LIFECYCLE_EVENT_TYPES.has(e.type)) return false;
    return isAccountPosting(e.payload);
  },
  reduce(state, event) {
    if (!isAccountPosting(event.payload)) return state; // defensive
    return applyPosting(state, event.payload, event);
  },
};
