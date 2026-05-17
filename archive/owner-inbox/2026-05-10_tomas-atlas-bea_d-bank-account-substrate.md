---
title: Bank-account event family + master/balance projections (D-BANK-ACCOUNT-SUBSTRATE)
author: Tomas (Operations & payments engineer, engineering — reports to Devon COO; lead) · Atlas (Core banking platform architect, engineering — substrate consult) · Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; chart-of-accounts integration)
date: 2026-05-10
summary: Three new event types — `BankAccountOpened`, `BankAccountConfigured`, `BankAccountClosed` — registered with typed Zod payload schemas + retention metadata. Two new projections under `prototype/platform/projections/accounts/` materialise the per-account current state (`accounts.master`) and the running per-account signed-cash balance (`accounts.balance`). Substrate covers the dry-run choreography Phase A T0–T2 (account-opening events) and unblocks Bea's posting-rules dispatch into per-account balances. Authored under the standing approval of D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10), which adopted D-BANK-ACCOUNT-SUBSTRATE as a sub-decision per pack §6 brief #A1.
decision-required: false
decision-id: D-BANK-ACCOUNT-SUBSTRATE
decision-category: near-term
decision-owner: Tomas (Operations & payments engineer)
---

# Bank-account event family + master/balance projections — D-BANK-ACCOUNT-SUBSTRATE

**Authority.** Standing CEO approval `D-FIRST-DRY-RUN-SCENARIO` (2026-05-10), which adopted `D-BANK-ACCOUNT-SUBSTRATE` as a net-new sub-decision under its umbrella per pack §6 brief #A1. No new CEO approval required; this record documents the substrate built and surfaces the residual gaps for follow-on slices.

**For:** Marc (CEO), as informational record. The CeoDecision event is emitted via `prototype/scripts/record-d-bank-account-substrate.ts` for the dashboard's resolved-decisions derivation.

---

## 1. Scope delivered

Three event types + two projections + tests + registry coverage + CeoDecision-emitter script. CI green at submission.

### 1.1 Event-type catalogue

| Event type | Payload (canonical fields) | Replay rule | Retention |
|---|---|---|---|
| `BankAccountOpened` | `{ accountId, accountType, currency, counterpartyId, chartOfAccounts, openedAt, displayName? }` | `idempotent-terminal` on `accountId` | governance 7y |
| `BankAccountConfigured` | `{ accountId, configKey, configValue, effectiveAt, rationale }` | `cumulative-fold` on `(accountId, configKey)` (latest-wins per key) | governance 7y |
| `BankAccountClosed` | `{ accountId, closedAt, reason, note? }` | `idempotent-terminal` on `accountId` | governance 7y |

Account-type taxonomy (`bankAccountTypeSchema`):

- `nostro` — bank's account at a correspondent bank (asset).
- `vostro` — counterparty's account at the bank (liability; not used in first dry-run, included for symmetry).
- `capital` — equity / share-capital / retained-earnings account.
- `sarb-operational` — operational account at SARB (LCR HQLA Level 1; aligned with chart-of-accounts row `ACC-1100-001`).
- `clearing` — settlement account at a market infrastructure (CLS / Strate / JSE clearing-member).
- `internal-suspense` — bank-internal suspense / clearing-in-transit account.

Closure-reason enum (`reason` on `BankAccountClosed`):

- `counterparty-relationship-ended`
- `consolidation`
- `regulatory-direction`
- `operational-cleanup`
- `incorrectly-opened`

Each event constructor (`makeBankAccountOpened` / `makeBankAccountConfigured` / `makeBankAccountClosed`) takes an optional `provenance` field. Dry-run-scenario callers attach the typed simulated tag:

```typescript
import { simulatedTag } from "@platform/event-store/provenance";

const provenance = simulatedTag({
  scenario: "first-dry-run-2026-Q1",
  sourceLineage: "agent:tomas:bank-account",
});
```

The `provenance-substrate-active` flag is currently `false` (per PR #161 — flips when downstream emitter migration lands), so untagged appends are tolerated; the constructors are forward-compatible for the flag flip.

### 1.2 Projection API

Both projections live under `prototype/platform/projections/accounts/`:

#### `accounts.master` — current-state per accountId

```typescript
import { accountMasterProjection } from "@platform/projections/accounts";
import { LocalProjector } from "@platform/projections";

const projector = new LocalProjector(eventStore);
const state = projector.build(accountMasterProjection);

// state.accounts: ReadonlyMap<accountId, AccountMasterRow>
const row = state.accounts.get("account:hoz-bank:nostro:usd:01");
// row: { accountId, accountType, currency, entity, counterpartyId, chartOfAccounts,
//        openedAt, displayName?, status: 'open' | 'closed', closedAt?, closureReason?,
//        configurations: { [configKey]: { configKey, configValue, effectiveAt, rationale } },
//        citations: readonly string[] }
```

Folding rules:

- Second `BankAccountOpened` with the same `accountId` is dropped (substrate-integrity violation; first-write-wins, audit trail in event log).
- `BankAccountConfigured` before `BankAccountOpened` is dropped (substrate-integrity violation).
- `BankAccountClosed` before `BankAccountOpened` is dropped (substrate-integrity violation).
- Second `BankAccountClosed` on an already-closed account is dropped (idempotent-terminal).

#### `accounts.balance` — running per-account signed-cash balance

```typescript
import { accountBalanceProjection } from "@platform/projections/accounts";

const state = projector.build(accountBalanceProjection);

// state.balances: ReadonlyMap<accountId, AccountBalanceRow>
const row = state.balances.get("account:hoz-bank:nostro:usd:01");
// row: { accountId, currency, entity, balanceMinor, asOf, postingCount }
```

The projection's `accepts` predicate matches any event whose payload satisfies the **`AccountPostingConvention`** triple: `{ accountId: string, cashAmountMinor: number, currency: string }`. Bank-account-lifecycle events themselves are explicitly excluded — opening / closing an account does not move cash.

Sign convention: positive `cashAmountMinor` = credit (cash in); negative = debit (cash out). The natural-balance side (debit / credit) of the underlying GL leaf is a chart-of-accounts concern; the projection records the raw signed sum without flipping it.

### 1.3 Semantic-layer integration

The projections sit at the `PROJECTION RUNTIME` layer in pack §3.1's pipeline (`EVENT LOG → PROJECTION RUNTIME → SEMANTIC LAYER → REPORT GENERATORS → RENDER + STORE`). Anya's semantic-layer registry (PR #156) consumes them via two existing entries:

- **`Balance` (`v0.1`).** Defined as `sum(SubLedgerPostingEmitted.cashAmountMinor where {entity, account, currency, ifrsClassification, asOf <= asOfQuery})`. The `accounts.balance` projection is the natural typed source — once the M2 GL projection lands (D-EVENT-STORE-SCALING Slice 4), the `Balance` semantic entry's `projection` field flips from `gl-projection` to a composition over `accounts.balance`. At v0 the entries' `formula` strings and the projection's row shape align (signed `balanceMinor`, per-currency, per-account), so the substrate is ready for the wire-up without further refactoring.
- **`CashAndBalancesAtSARB` (`v0.1`).** Pinned to `ACC-1100-001`. The `accounts.master` row for the SARB-operational account in Hoz Bank carries that exact `chartOfAccounts.leafAccountId`; the balance projection's row at the same accountId is the typed input to the entry's formula `Balance(account=ACC-1100-001, entity=urn:legal-entity:hoz:hoz-bank:v1, currency=ZAR, asOf=asOfQuery)`.

The `chartOfAccounts.leafAccountId` field on every `BankAccountOpened` is the canonical join key — the master projection's row carries the leaf forward, and downstream BA-return generators (BA 300 cash-and-central-bank, BA 325 LCR HQLA Level 1) traverse from semantic-layer entry → leaf → account-master row → balance row.

---

## 2. Substrate gaps remaining

Each gap below is a follow-on slice, not a defect in this substrate. The decision pack's §6 follow-on briefs (#A4 scenario script, #A2 scenario clock, #A3 FX Slice 2, plus the M2 GL projection slice) will exercise each gap.

1. **Account-opening UI.** Phase A's brief explicitly excludes UI; the scenario script (#A4, Saskia+Kai+Bea) creates accounts programmatically via the `makeBankAccountOpened` constructor. A dashboard register view of `accounts.master` lands under RMS Slice 3 (Anya).

2. **M1-→-account dispatch.** The M1 sub-ledger projection emits `SubLedgerRow`s keyed by `(sourceEventId, legKind)`, not by accountId — the M1 cut materialises typed posting candidates whose account-dispatch is the M2 GL projection's job (under D-EVENT-STORE-SCALING Slice 4 / pack §3.1). Until that lands, the `accounts.balance` projection over canonical M1 events yields empty balances. The dry-run scenario script (#A4) bridges this gap by emitting events that carry the convention triple directly (e.g. `CapitalContributionRecorded`, `FXSettlementLegPosted`).

3. **Closure-cascade rules.** `BankAccountClosed` records the closure fact only. Pre-closure invariants (zero-balance precondition, outstanding-commitment unwind, restriction handling for accounts with active limits) are downstream policy — Bea's accounting policies + Tomas's operations runbook own the rules; this substrate provides the lifecycle event the rules check against.

4. **Posting-against-closed-account guard.** The balance projection at v0 folds postings against any account that satisfies the convention triple, including closed ones. The Vera follow-on recon (substrate-integrity pipeline) cross-references the master projection's `status` field to surface postings against closed accounts as findings. The substrate gap is the recon, not the projection logic — the projection is intentionally permissive so the audit trail captures the violation rather than silently dropping it.

5. **Customer accounts.** This substrate covers bank-owned accounts only (nostro / vostro / capital / SARB-operational / clearing / internal-suspense). Customer accounts activate at licence-day per Niko's lifecycle (CLAUDE.md "Operating model — what is real, deferred, paused"); the schema may need a customer-account variant or a peer event family at that point.

6. **Multi-currency aggregation views.** Per-account, per-currency balances are the projection's typed surface. Cross-account / cross-currency aggregations (e.g. "total USD position across all nostros") are downstream reporting concerns; report generators in pack §3.1 Slice 4+ compose the queries.

---

## 3. Citations

- `D-FIRST-DRY-RUN-SCENARIO` (CEO-approved 2026-05-10) — standing authority. Pack at `Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`.
- `D-DATA-PROVENANCE-SUBSTRATE` Slices 6+1 (PR #161) — provenance envelope shape and the soft-tagger / append-rejection contract.
- `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` Slice 1 (PR #156) — semantic-layer registry that consumes `accounts.master` + `accounts.balance` via the `Balance` and `CashAndBalancesAtSARB` entries.
- `INTERNAL-FINANCE-CHART-OF-ACCOUNTS` — `prototype/platform/accounting/_chart-of-accounts.md`; the `chartOfAccounts.leafAccountId` field's canonical resolution target.
- CLAUDE.md "Dispatch discipline" — worktree isolation, scaffold-commit, push-retry, citation-gate, identity discipline, no-pause rule.
- Principles 1 (events as truth), 2 (citation discipline), 5 (multi-currency / multi-entity), 6 (single-graph), 7 (autonomous-by-default).

---

## 4. Files touched

- `prototype/platform/event-store/event-types.ts` — add three event types + Zod payload schemas + `make…()` constructors + types in the bank-account family. Append `BankAccountOpened` / `BankAccountConfigured` / `BankAccountClosed` to `TYPED_EVENT_TYPES`.
- `prototype/platform/event-store/registry.ts` — register the three event types under a new `BANK_ACCOUNT_EVENT_TYPES` group; class `governance`, retention `RETENTION_GOVERNANCE_7Y`, payload schemas wired.
- `prototype/platform/projections/accounts/types.ts` — new file. Typed shapes for `AccountMasterRow` / `AccountMasterState` / `AccountBalanceRow` / `AccountBalanceState` + the `AccountConfigurationEntry` shape.
- `prototype/platform/projections/accounts/master.projection.ts` — new file. The `accounts.master` projection.
- `prototype/platform/projections/accounts/balance.projection.ts` — new file. The `accounts.balance` projection + the `AccountPostingConvention` interface.
- `prototype/platform/projections/accounts/index.ts` — new file. Public surface of the accounts projections.
- `prototype/tests/bank-account-events.test.ts` — new file. Per-event Zod parse + boundary tests; account-master round-trip; balance projection over a fixture stream.
- `prototype/scripts/record-d-bank-account-substrate.ts` — new file. CeoDecision-emitter script. Idempotent.
- `Owner Inbox/2026-05-10_tomas-atlas-bea_d-bank-account-substrate.md` — this record.
