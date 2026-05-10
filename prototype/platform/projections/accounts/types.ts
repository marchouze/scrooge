// platform/projections/accounts/types.ts
//
// Typed shapes for the bank-account projections. The account-master row is
// the current-state snapshot per accountId; the balance row sums signed cash
// postings per account.
//
// D-BANK-ACCOUNT-SUBSTRATE — under standing authority of D-FIRST-DRY-RUN-
// SCENARIO (CEO-approved 2026-05-10). Pack §6 brief #A1.
//
// P1 — both projections are derived from the bank-account event family + the
//      sub-ledger posting stream; no authoritative state lives here.
// P5 — every row carries entity + currency + chart-of-accounts mapping; no
//      multi-currency aggregation at the row level.
// P6 — the row shape is the typed contract downstream consumers (dashboard
//      account-master register, BA-return generators, AFS skeleton renderer)
//      compose against.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO; chart-of-accounts integration).

import type {
  BankAccountConfiguredPayload,
  BankAccountOpenedPayload,
  ChartOfAccountsRef,
} from "../../event-store/event-types";
import type { BankAccountType } from "../../event-store/event-types";

/**
 * Lifecycle status of an account in the master projection.
 *
 *   - `open`   — `BankAccountOpened` has landed; no `BankAccountClosed` yet.
 *   - `closed` — `BankAccountClosed` has landed. Postings against a closed
 *                account are a substrate-integrity violation (Vera follow-on
 *                recon — substrate gap noted in the decision record).
 */
export type AccountLifecycleStatus = "open" | "closed";

/**
 * One row in the account-master projection. Mirrors the BankAccountOpened
 * payload + the lifecycle status + the most-recent configurations applied.
 *
 * Configurations are stored as a map keyed by `configKey` — latest-wins per
 * key per `BankAccountConfigured` events (audit trail lives in the event log).
 */
export interface AccountMasterRow {
  /** Stable account identifier. */
  readonly accountId: string;
  /** Account-type taxonomy (nostro / vostro / capital / sarb-operational / clearing / internal-suspense). */
  readonly accountType: BankAccountType;
  /** ISO 4217 currency. Single-currency per account (Principle 5). */
  readonly currency: string;
  /** Legal entity that owns the account. Mirrors the source event's envelope `entity`. */
  readonly entity: string;
  /** Counterparty the account is held at, when applicable. */
  readonly counterpartyId: string | null;
  /** Chart-of-accounts mapping. */
  readonly chartOfAccounts: ChartOfAccountsRef;
  /** ISO 8601 — when the account opened. */
  readonly openedAt: string;
  /** Optional human-readable name. */
  readonly displayName?: string;
  /** Lifecycle status. */
  readonly status: AccountLifecycleStatus;
  /** ISO 8601 — when the account closed (only present when status === 'closed'). */
  readonly closedAt?: string;
  /** Reason supplied on closure. */
  readonly closureReason?: BankAccountClosedReason;
  /**
   * Latest-wins configuration map. Keys are free-form `configKey` slugs (e.g.
   * `daily-debit-limit`, `restriction:outbound-suspended`). Values are the
   * most-recent `configValue` from a `BankAccountConfigured` event.
   */
  readonly configurations: Readonly<Record<string, AccountConfigurationEntry>>;
  /** Citations carried forward from the opening event (Principle 2). */
  readonly citations: readonly string[];
}

/**
 * Single configuration entry in the master row's map. Records the value plus
 * the timestamps + the rationale for human reviewers.
 */
export interface AccountConfigurationEntry {
  readonly configKey: string;
  readonly configValue: unknown;
  /** ISO 8601 — `effectiveAt` from the latest BankAccountConfigured. */
  readonly effectiveAt: string;
  /** Rationale recorded with the latest configuration. */
  readonly rationale: string;
}

/**
 * The account-master projection's full state. Map keyed by accountId for
 * O(1) lookup; downstream consumers fold into ordered arrays as needed.
 */
export interface AccountMasterState {
  readonly accounts: ReadonlyMap<string, AccountMasterRow>;
}

export const accountMasterInitial: AccountMasterState = {
  accounts: new Map(),
};

/**
 * Closure reasons mirror the BankAccountClosed payload's `reason` enum.
 * Re-declared here so projection consumers don't need to depend on the
 * event-types module at runtime — the type alias keeps them in sync at
 * compile time.
 */
export type BankAccountClosedReason =
  | "counterparty-relationship-ended"
  | "consolidation"
  | "regulatory-direction"
  | "operational-cleanup"
  | "incorrectly-opened";

/**
 * One row in the account-balance projection. Per accountId aggregate of the
 * signed cash postings folded from the posting stream.
 *
 * Substrate-gap note: at v0 the balance projection accepts any event whose
 * payload contains an explicit `{accountId, cashAmountMinor, currency}`
 * triple. The M1 sub-ledger projection (`prototype/platform/projections/
 * markets/sub-ledger.ts`) emits `SubLedgerRow`s keyed by `(sourceEventId,
 * legKind)` — *not* by accountId, because the M1 cut materialises typed
 * posting candidates whose account dispatch is the M2 GL projection's job
 * (the GL projection is built under D-EVENT-STORE-SCALING Slice 4 / pack
 * §3.1). Until that lands, the balance projection over canonical M1 events
 * yields empty balances; fixture tests below demonstrate the fold over
 * synthetic posting events that carry an explicit accountId. The decision
 * record at `Owner Inbox/2026-05-10_tomas-atlas-bea_d-bank-account-substrate.md`
 * names this gap explicitly and routes the M1-→-account dispatch into the
 * GL projection slice.
 */
export interface AccountBalanceRow {
  readonly accountId: string;
  readonly currency: string;
  readonly entity: string;
  /** Signed sum of all `cashAmountMinor` postings against this account. */
  readonly balanceMinor: number;
  /** ISO 8601 — `as_of` of the most recent posting folded into this balance. */
  readonly asOf: string;
  /** Number of postings folded into this balance. */
  readonly postingCount: number;
}

export interface AccountBalanceState {
  readonly balances: ReadonlyMap<string, AccountBalanceRow>;
}

export const accountBalanceInitial: AccountBalanceState = {
  balances: new Map(),
};

/**
 * Convenience helpers — typed views over the event-types' own payload
 * shapes. Re-exported so projection consumers have a single import point.
 */
export type { BankAccountConfiguredPayload, BankAccountOpenedPayload };
