// platform/projections/accounts/index.ts
//
// Public surface of the bank-account projections (D-BANK-ACCOUNT-SUBSTRATE,
// under standing authority of D-FIRST-DRY-RUN-SCENARIO).

export { accountMasterProjection } from "./master.projection";
export { accountBalanceProjection } from "./balance.projection";
export type { AccountPostingConvention } from "./balance.projection";
export type {
  AccountBalanceRow,
  AccountBalanceState,
  AccountConfigurationEntry,
  AccountLifecycleStatus,
  AccountMasterRow,
  AccountMasterState,
  BankAccountClosedReason,
} from "./types";
export { accountBalanceInitial, accountMasterInitial } from "./types";
