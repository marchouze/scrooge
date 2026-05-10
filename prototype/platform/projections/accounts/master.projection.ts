// platform/projections/accounts/master.projection.ts
//
// Account-master projection — current state per accountId.
//
// Folds the bank-account event family
// (`BankAccountOpened` / `BankAccountConfigured` / `BankAccountClosed`)
// into a per-account current-state map. The projection is deterministic
// over the event log (P1) and produces the typed contract the dashboard's
// account-master register, the BA-return generators, and Bea's posting-
// rules dispatch all consume (P6 — single graph, downward chain).
//
// Replay rules (mirrors the registry):
//   - BankAccountOpened       — idempotent-terminal on accountId. A second
//                               open with the same accountId is dropped
//                               (substrate-integrity violation; Vera follow-on).
//   - BankAccountConfigured   — cumulative-fold on (accountId, configKey);
//                               latest-wins per key.
//   - BankAccountClosed       — idempotent-terminal on accountId. A second
//                               close on an already-closed account is dropped.
//                               A close on an unopened account is dropped
//                               (substrate-integrity violation).
//
// D-BANK-ACCOUNT-SUBSTRATE — under standing authority of D-FIRST-DRY-RUN-
// SCENARIO (CEO-approved 2026-05-10). Pack §6 brief #A1.
//
// Authors: Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; lead) · Atlas (Core banking platform architect, engineering
//   — substrate consult) · Bea (Accounting & financial reporting engineer,
//   engineering — reports to Camille CFO).

import type {
  BankAccountClosedPayload,
  BankAccountConfiguredPayload,
  BankAccountOpenedPayload,
} from "../../event-store/event-types";
import type { Event } from "../../event-store/types";
import type { Projection } from "../types";
import type {
  AccountConfigurationEntry,
  AccountMasterRow,
  AccountMasterState,
} from "./types";
import { accountMasterInitial } from "./types";

/** Narrowed Event type for the bank-account family. */
type BankAccountLifecycleEvent = Event &
  (
    | { readonly type: "BankAccountOpened"; readonly payload: BankAccountOpenedPayload }
    | {
        readonly type: "BankAccountConfigured";
        readonly payload: BankAccountConfiguredPayload;
      }
    | { readonly type: "BankAccountClosed"; readonly payload: BankAccountClosedPayload }
  );

function isBankAccountLifecycle(e: Event): e is BankAccountLifecycleEvent {
  return (
    e.type === "BankAccountOpened" ||
    e.type === "BankAccountConfigured" ||
    e.type === "BankAccountClosed"
  );
}

function applyOpened(
  state: AccountMasterState,
  e: BankAccountLifecycleEvent & { type: "BankAccountOpened" },
): AccountMasterState {
  const p = e.payload;
  if (state.accounts.has(p.accountId)) {
    // Substrate-integrity violation — first-write-wins, audit trail in event log.
    return state;
  }
  const row: AccountMasterRow = {
    accountId: p.accountId,
    accountType: p.accountType,
    currency: p.currency,
    entity: e.entity,
    counterpartyId: p.counterpartyId,
    chartOfAccounts: p.chartOfAccounts,
    openedAt: p.openedAt,
    ...(p.displayName !== undefined ? { displayName: p.displayName } : {}),
    status: "open",
    configurations: {},
    citations: [...e.citations],
  };
  const next = new Map(state.accounts);
  next.set(p.accountId, row);
  return { accounts: next };
}

function applyConfigured(
  state: AccountMasterState,
  e: BankAccountLifecycleEvent & { type: "BankAccountConfigured" },
): AccountMasterState {
  const p = e.payload;
  const existing = state.accounts.get(p.accountId);
  if (!existing) {
    // Configuration before opening is a substrate-integrity violation; drop.
    return state;
  }
  const entry: AccountConfigurationEntry = {
    configKey: p.configKey,
    configValue: p.configValue,
    effectiveAt: p.effectiveAt,
    rationale: p.rationale,
  };
  const nextConfigs = { ...existing.configurations, [p.configKey]: entry };
  const updated: AccountMasterRow = {
    ...existing,
    configurations: nextConfigs,
  };
  const next = new Map(state.accounts);
  next.set(p.accountId, updated);
  return { accounts: next };
}

function applyClosed(
  state: AccountMasterState,
  e: BankAccountLifecycleEvent & { type: "BankAccountClosed" },
): AccountMasterState {
  const p = e.payload;
  const existing = state.accounts.get(p.accountId);
  if (!existing) {
    // Close before open — substrate-integrity violation; drop.
    return state;
  }
  if (existing.status === "closed") {
    // Idempotent-terminal; first close wins.
    return state;
  }
  const updated: AccountMasterRow = {
    ...existing,
    status: "closed",
    closedAt: p.closedAt,
    closureReason: p.reason,
  };
  const next = new Map(state.accounts);
  next.set(p.accountId, updated);
  return { accounts: next };
}

export const accountMasterProjection: Projection<AccountMasterState, BankAccountLifecycleEvent> = {
  name: "accounts.master",
  initial: accountMasterInitial,
  accepts: (e): e is BankAccountLifecycleEvent => isBankAccountLifecycle(e),
  reduce(state, event) {
    switch (event.type) {
      case "BankAccountOpened":
        return applyOpened(state, event);
      case "BankAccountConfigured":
        return applyConfigured(state, event);
      case "BankAccountClosed":
        return applyClosed(state, event);
    }
  },
};
