# Principle 1 — Events are the only source of truth

The event log is the single durable artefact of the bank. Nothing else is authoritative.

- Balances, positions, exposures, P&L, capital, liquidity ratios, regulatory-return cells, accounting trial balances — all are **queries** over the event log, computed at a point in time. None is stored as authoritative state.
- Stored projections exist only as caches. They must be reproducible from the event log at any moment, and the events outrank them in every reconciliation.
- "As-of" replay is a first-class capability. Any quantity must be reproducible at any past point in time.
- Off-the-shelf systems that maintain authoritative aggregate state (typical core-banking products that own balance tables) are incompatible with this architecture and may not be adopted as the system of record.
- "Real-time" is the default. Periodic batch is a presentation choice, not a processing model.

---

## What is *not* an event — reference data

Not every real-world datum is an event. An event is a **fact that occurred** or a
**recognition decision the bank made** — something that drives action and has a
lifecycle. Standing reference data the bank *consults* is not an event:

- A market-data **tick** is not an event; the bank's **adoption of a closing rate**
  (`OfficialMarkAdopted`) is.
- A **regulation**, its LLM/script/agent/human **interpretation**, and the
  **derived regulatory graph** are reference data; the bank's **decision to accept
  an obligation** (`ObligationAdopted`) is the event.

Reference data is re-derivable and versioned, held in its own canonical store (a
content-addressed blob, a projection-derived graph), and outranked by events only
where it has been *adopted* into a recognition decision. Modelling reference data
as events would flood the log with non-decisions and couple bank state to external
feeds. See `prototype/platform/regulatory/architecture.md` (two-plane model,
`D-REGULATORY-ARCHITECTURE-TWO-PLANE`) for the regulatory application.

---

## Event taxonomy

### Primary events
Facts that occurred in the world: `FxTradeExecuted`, `FxSettlementInstructed`, `FxSettlementConfirmed`, `OrderApprovedAtGateway`, `CashReceiptConfirmed`, etc. These are the canonical source. No downstream system may bypass them in favour of a derived representation.

### Derived events
Decisions made by a rule engine against primary events: `SubLedgerPostingEmitted`, `IfrsClassificationApplied`, `RiskWeightApplied`, etc. A derived event is legitimate when it records an auditable, point-in-time recognition decision that must be preserved independently of future rule changes (e.g. formal accounting recognition, IFRS classification). Derived events must satisfy:

1. **Single purpose.** Each derived event type serves exactly one downstream domain. It is not a general-purpose data bus.
2. **Re-derivable.** Replaying the same primary events through the same rule version must reproduce identical derived events. If it cannot, the derived event is storing state, not recording a decision.
3. **Non-authoritative for other domains.** A derived event that is authoritative for domain A carries no authority for domain B. Domain B folds its own projection from the relevant primary events.
4. **Irreducible — the decisive test.** A derived event type is legitimate *only* if it carries at least one field that is **not** recoverable by replaying the primary events through the versioned rule in force at the event's effective date. Re-derivability (criterion 2) and irreducibility are complementary: a derived event must be *reproducible* from its inputs, yet must add *something* not already in those inputs — a judgment, an external input adopted as a fact, or a timing/recognition decision. If `derived = f(primaryEvents, classification, rule@version)` with no residual, it carries no information and is a **projection**, not an event; storing it as authoritative is caching a projection into the log, which the rules above forbid. Authority: `D-DERIVED-EVENT-IRREDUCIBILITY-TEST` (CEO-approved 2026-06-16).

### Projections
Pure folds over the event log. Never stored as authoritative state. Each projection declares its source event type(s) explicitly.

---

## Projection routing — which events each domain folds

| Domain | Folds over | Must NOT route through |
|--------|-----------|----------------------|
| GL trial balance / IFRS statements | `SubLedgerPostingEmitted` | — |
| BA-300 (regulatory balance sheet) | trial balance projection | — |
| Risk positions (open FX, delta, DV01) | primary trade events (`FxTradeExecuted`, etc.) | `SubLedgerPostingEmitted` / trial balance |
| BA-325 LCR (liquidity coverage) | cash-flow events (`FxSettlementInstructed`, `FxSettlementConfirmed`) | trial balance |
| BA-350 market risk (open FX position) | primary trade events | trial balance |
| BA-700 RWA / capital adequacy | primary trade events + risk-weight events | trial balance |
| FinSurv reporting | primary trade + settlement events | trial balance |
| Pre-trade limits | position projection (from trade events) | posting events |
| Period-close / `TrialBalanceSnapshotted` | `SubLedgerPostingEmitted` | — |

Routing a non-accounting projection through `SubLedgerPostingEmitted` or the trial balance is an architectural violation of this principle. It couples the projection's availability and correctness to the posting engine, introduces timing lag between trade and risk position, and makes posting-rule changes silently affect non-accounting outputs.

---

## The GL is not a data bus

The general ledger (trial balance derived from `SubLedgerPostingEmitted`) is the accounting view of the bank. It is one of many projections, not the universal intermediary. Systems that in traditional banking read balances from a GL table must instead fold their own projection from the appropriate source events.

`SubLedgerPostingEmitted` → `computeTrialBalance` → IFRS statements / BA-300. That chain stops there. Every other domain has its own projection root in the primary event log.

---

## Postings are a projection, not an event

Applying the irreducibility test (Derived events, criterion 4) to accounting yields a sharp
result: **the double-entry posting itself is a projection, not an event.** A posting is

```
posting = f(primary economic event, classification decision, posting rule @ version)
```

— every input already lives in the log or in versioned reference data, so the posting carries
no residual information. Materialising it as an authoritative event (the historical
`SubLedgerPostingEmitted` shape) is caching a fold into the log; it is the weakest member of the
derived-event family and fails criterion 4. The smell is visible in the substrate: correction
posting-types accreted to neutralise frozen wrong postings (a projection self-heals on
recompute), and parity recon gates exist only to police two copies of one computation.

The genuine accounting **events** are the ones that carry irreducible content:

- **Recognition decisions** — `IfrsClassificationApplied`, official-mark adoptions
  (`OfficialMarkAdopted`), ECL / IFRS-9 staging, hedge designations — judgment not recoverable
  from the trades.
- **`ManualJournalEntry`** — a *primary* authored fact (irreducible `journalId` / `description`
  / `postedBy` intent); no upstream event determines it, so its legs *are* the original fact.
- **The period-close freeze** — `AccountingPeriodClosed` / `TrialBalanceSnapshotted` — the one
  legitimate point at which the fold output is materialised, because *deciding to close* is
  itself a point-in-time recognition act (the `OfficialMarkAdopted` pattern: store the
  adoption, not every tick).

The postings / sub-ledger / trial balance / IFRS statements / BA returns are then a pure
projection of (primary facts × classification decisions × versioned posting rules), with the
close-time snapshot providing as-filed immutability.

The accounting + BA-returns substrate currently still roots on stored `SubLedgerPostingEmitted`;
the migration to the projection model is **deferred and tracked** under
`D-ACCT-POSTING-PROJECTION-MIGRATION` (a sequenced slice plan is required before any build).
Authority: `D-DERIVED-EVENT-IRREDUCIBILITY-TEST` (CEO-approved 2026-06-16).
