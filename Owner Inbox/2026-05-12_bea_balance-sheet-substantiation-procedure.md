---
title: "Balance sheet substantiation procedure — authored and wired"
author: Bea (Accounting & financial reporting engineer, engineering)
date: 2026-05-12
decision-required: false
tags: [accounting, procedure, event-type, bss]
---

# Balance sheet substantiation procedure — completion note

**Authored by:** Bea (Accounting & financial reporting engineer, engineering)
**Date:** 2026-05-12
**Procedure ID:** PROC-FIN-BSS-01

---

## What was authored

### 1. Procedure — `Procedures/by-policy/balance-sheet-substantiation.md`

A complete, production-grade balance sheet substantiation procedure (PROC-FIN-BSS-01) covering:

- **Trigger:** `AccountingPeriodClosed` event (primary) or monthly scheduler fallback; also on-demand CEO/CFO request.
- **Six ordered steps:** enumerate active accounts → compute trial balance as-of → per-account substantiation (source-event trace + IFRS classification check + aged-item check + cross-leg zero-balance assertion) → exception triage → Camille (CFO, finance) sign-off → emit `BalanceSheetSubstantiationCompleted`.
- **Account coverage:** all 11 active GL accounts in `_chart-of-accounts.md` v1: ACC-1100-001–005 (SARB cash, nostros, FX suspense) + ACC-2100-001–006 (FX trading receivables/payables, unrealised/realised P&L).
- **Escalation paths:** typed for each failure mode — `timing-difference` (tolerated), `substrate-gap` (substrate alert to Atlas/Anya), `unexplained` (immediate `AgentEscalation` to Camille).
- **Citation chain:** IAS 1 §29–§31; IAS 21 §28; IFRS 9 §4.1–§5.7.1; Companies Act 71/2008 §§28–30; `ORG-AC-13`; Accounting Policies (IFRS) v0.1 (STUB) §§2, 3.4, 5.

### 2. Event type — `BalanceSheetSubstantiationCompleted`

Added to `prototype/platform/event-store/event-types/accounting.ts`:

- Payload schema: `{ periodId, entity, asOf, accountsSubstantiated, accountsWithExceptions, exceptionsOpen[{ accountId, exceptionKind, description }], approvedBy, approvalMode }`.
- `exceptionKind` typed enum: `"timing-difference" | "substrate-gap" | "unexplained"`.
- `approvalMode` typed enum: `"auto" | "human-in-loop"`.
- Factory function `makeBalanceSheetSubstantiationCompleted` following the established accounting event factory pattern.
- Added to `TYPED_EVENT_TYPES` registry in `event-types/index.ts`.

### 3. Bea agent spec — `Team/Bea.md`

- §6 Cadence: added monthly balance sheet substantiation run (triggered by `AccountingPeriodClosed`, fallback scheduler); daily suspense-account monitoring for ACC-1100-004 and ACC-1100-005 (flag if outstanding > 2 business days); updated quarterly BA-return gating on clean `BalanceSheetSubstantiationCompleted`.
- §11 Outputs: added `BalanceSheetSubstantiationCompleted` to events emitted; added monthly substantiation working paper to deliverables.

### 4. Procedures index — `Procedures/_index.md`

- New row under Finance, accounting, tax, treasury: `balance-sheet-substantiation.md` — status **DRAFT v1.0** — owner Bea (Camille sign-off).
- `month-end-close.md` note updated: balance sheet substantiation is now a named step within the broader month-end close orchestration.
- Status summary updated: DRAFT count 1, total ~81.

---

## Substrate gaps identified

The following system capabilities are referenced as `PLANNED` in the procedure and do not yet exist in `prototype/platform/`:

| Capability | Path | Owner | Notes |
|---|---|---|---|
| `computeTrialBalance` | `@platform/accounting/period-close` | Bea + Atlas | Close Engine M2 — folds `SubLedgerPostingEmitted` for a period |
| `tracePostingToSourceEvent` | `@platform/accounting/period-close` | Bea + Anya | Links each posting to its `sourceEventId` from the primary event |
| `verifyIfrsClassification` | `@platform/accounting/period-close` | Bea | Checks chart-of-accounts `ifrsClassification` against period events |
| `checkAgedItems` | `@platform/accounting/period-close` | Bea | Compares balance date vs account clearance horizon |
| `assertZeroBalance` | `@platform/accounting/period-close` | Bea | Zero-balance assertion for suspense accounts at period-end |
| `triageException` | `@platform/accounting/period-close` | Bea | Rule-based exception classification (timing / substrate-gap / unexplained) |
| `requestSubstantiationSignOff` | `@platform/accounting/period-close` | Bea | Routes to Camille auto-approve or human-in-loop based on exception list |
| `BalanceSheetSubstantiationApproved` event | `prototype/platform/event-store/event-types/accounting.ts` | Bea + Atlas | CFO approval event — to be added in Close Engine M2 alongside the above capabilities |

These gaps do not block the procedure authoring or the event-type schema. They are substrate-gap exceptions (not accounting exceptions) in the current build phase.

---

## Vera assurance assertions (planned)

Four Vera assertions defined in PROC-FIN-BSS-01 §12:
1. Every `AccountingPeriodClosed` has a matching `BalanceSheetSubstantiationCompleted` within 2 agent ticks.
2. No `BalanceSheetSubstantiationCompleted` has open `unexplained` exceptions without a resolution event.
3. Human-in-loop completions have a matching `BalanceSheetSubstantiationApproved` from Camille's actor ID.
4. Every `SubLedgerPostingEmitted` has a traceable `sourceEventId` in the working paper.

These are Wave-4 recon candidates for Vera (internal audit engineer, governance).

---

## CI status

`bun run ci` passed with zero `ok:false` and zero TypeScript errors. All warnings are pre-existing (event-type-registry-coverage warns for unregistered subscriber types — build-phase tolerance per `registry.ts` header; none relate to `BalanceSheetSubstantiationCompleted`).
