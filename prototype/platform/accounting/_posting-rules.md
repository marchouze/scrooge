# Posting-rule register — v0

**Owner:** Bea (with Atlas — substrate) · **Status:** v0 — substrate live, content sparse · **Authored:** 2026-05-07

The posting-rule register is the typed, citation-bearing catalogue of every rule that maps a postable event to one or more double-entry GL postings. Per Bea spec §9, `PostingRulePublished` is the event Bea emits when a new rule (or a new version) is approved; downstream consumers (close engine, BA-return generator, reconciliation harness, audit working-paper generator) re-resolve.

The canonical typed form is one JSON object per rule, validating against [`posting-rule.schema.json`](posting-rule.schema.json). At v0, rules live in this markdown for readability; once the close-engine substrate lands (Bea Substrate Gap §3, target M2), each rule migrates to its own typed file.

## Why this exists

- **Principle 1 (events are truth).** A balance is `sum over events of (postings produced by the matched rule for that event)`. The rule register is what makes that fold deterministic and replayable as-of any date.
- **Principle 2 (citations).** Every rule cites the IFRS reference, regulation ID, and policy that justify the posting choice.
- **Principle 2 (no orphans).** Every event type that flows postable financial change must have at least one rule. Vera's planned recon asserts no postable event type is silently dropped.

## Coverage today

| Event family | Rules in v0 | Gap (target slice) |
|---|---|---|
| Cash receipt | `PR-CASHIN-001` (inbound cash to SARB operational account) | Inbound across non-ZAR operational accounts; rejected receipts; rollback rules |
| Cash payment | — | Outbound payment debit + sponsor-bank-settlement credit |
| Trade booking | — | Trade-economic + collateral + clearing-fee multi-leg |
| Funding draw / repay | — | Wholesale funding; FTP allocation |
| FX revaluation | — | Daily revaluation per IAS 21 |
| Accrual booking | — | Daily accrual on funded positions |
| ECL booking | — | Stage transitions (Bea + Rohan co-owned) |

---

## PR-CASHIN-001 — Inbound cash receipt to SARB operational account

```yaml
id: PR-CASHIN-001
name: "Inbound cash receipt — credited to SARB operational account, ZAR"
eventType: "CashReceiptConfirmed"
preconditions:
  - "event.amount.ccy == 'ZAR'"
  - "event.destinationAccountId == 'ACC-1100-001'"
  - "event.entityId == 'LE-ZA-BANKNEWCO'"
postings:
  - accountId: ACC-1100-001
    side: debit
    amountExpression: "event.amount.value"
    currencyExpression: "event.amount.ccy"
    entityExpression: "event.entityId"
    narration: "SARB operational receipt"
  - accountId: ACC-2100-001
    side: credit
    amountExpression: "event.amount.value"
    currencyExpression: "event.amount.ccy"
    entityExpression: "event.entityId"
    narration: "Counterparty payable / settlement-account credit (counterpart account stub — to be populated when liability side of CoA is filled)"
version: v0.1
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §3.1.1 — recognise a financial asset when the entity becomes party to the contractual provisions"
    note: "Recognition trigger for cash receipt."
  - type: ifrs
    ifrsRef: "IAS 21 §21 — initial recognition at functional-currency spot rate"
    note: "ZAR receipt for ZAR-functional entity — no FX translation required at recognition."
  - type: regulation
    regulationId: ORG-AC-01
    note: "Classification at recognition (amortised cost)."
  - type: policy
    policyRef: "Accounting Policies (IFRS) v0.1 (STUB)"
    section: "§3 Recognition and double-entry discipline"
    note: "Stub at Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md."
approval:
  approver: PENDING
  approvedOn: ~
  decisionRef: ~
```

### Notes

- **Counterpart account is a stub.** `ACC-2100-001` (counterparty payable / settlement-account credit) is referenced but not yet authored in `_chart-of-accounts.md`. The next chart-of-accounts slice populates it. Until then, this rule does not pass the chart-of-accounts resolvability assertion that Vera's recon enforces — it is a known v0 gap, not a defect.
- **Multi-currency.** The rule is ZAR-only by precondition. Sister rules (`PR-CASHIN-002` USD; `PR-CASHIN-003` EUR; etc.) follow as their accounts are populated. Per Principle 5, one rule per currency keeps the FX exposure visible at the rule level.
- **Idempotency.** The rule is keyed off the event's deterministic ID; replaying the event yields no new postings (handled at the close-engine layer per Bea Substrate Gap §3).

## Authoring notes

Adding or revising a posting rule follows the keystone procedure `Procedures/by-policy/posting-rule-publication.md` (this thread's keystone). Key steps:

1. Confirm the event type exists in the event-store schema (Atlas-owned).
2. Confirm every account ID referenced exists and is `in-force` in `_chart-of-accounts.md`.
3. Confirm balanced postings (sum of debits = sum of credits, per posting and per currency).
4. Confirm preconditions disambiguate the rule from any sibling rule on the same event type.
5. Cite IFRS / regulation / policy.
6. Emit `PostingRulePublished { ruleId, version, eventType, citationChain }`.

Vera's planned posting-rule recon (Wave-4 candidate) asserts: (a) every postable event type has at least one matched rule; (b) every rule's accounts resolve and are in-force; (c) postings balance per currency per entity; (d) every rule's citation chain resolves.

---

## FX Spot posting rules — added 2026-05-12

**Authority:** D-MARKETS-SCHEMA-FOUNDATION + D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)  
**Implementation:** `prototype/platform/accounting/posting-rules/fx-spot.ts`  
**Spec:** `Owner Inbox/2026-05-12_camille-bea_fx-accounting-spec-v1.md §C`

### PR-FX-001 — FX Trade Booking (FxTradeExecuted)

```yaml
id: PR-FX-001
name: "FX Spot trade booking — initial FVTPL recognition"
eventType: "FxTradeExecuted"
preconditions:
  - "event.payload.productTaxonomy == 'FX-spot'"
  - "event.payload.bookType == 'trading'"
postingLogic: "fxTradeBookingJournals(event.payload) — see fx-spot.ts"
postings:
  description: |
    For each near leg:
    - Pay currency: Dr payableAccount(payCcy) / Cr receivableAccount(payCcy)
    - Receive currency: Dr receivableAccount(receiveCcy) / Cr payableAccount(receiveCcy)
    Each sub-entry balances in its currency. Net P&L = 0 at inception (mid-market).
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §3.1.1 — recognise at trade date (entity becomes party to contractual provisions)"
  - type: ifrs
    ifrsRef: "IFRS 9 §B3.1.3 — trade-date accounting"
  - type: ifrs
    ifrsRef: "IFRS 9 §5.1.1 — initial measurement at fair value"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
approval:
  approver: Camille (CFO, finance)
  approvedOn: "2026-05-12"
  decisionRef: D-MARKETS-CAPITAL-TIME-SHAPE
```

### PR-FX-002 — FX Daily Revaluation (FxPositionRevalued)

```yaml
id: PR-FX-002
name: "FX Spot daily FVTPL revaluation — unrealised P&L"
eventType: "FxPositionRevalued"
preconditions:
  - "event.payload.unrealisedPnlZarMinor != 0"
postingLogic: "fxRevaluationJournals(event.payload) — see fx-spot.ts"
postings:
  description: |
    Gain (unrealisedPnlZarMinor > 0):
      Dr ACC-2100-001 FX Trading Receivable — ZAR
      Cr ACC-2100-005 Unrealised FX P&L — FVTPL
    Loss (unrealisedPnlZarMinor < 0):
      Dr ACC-2100-005 Unrealised FX P&L — FVTPL
      Cr ACC-2100-001 FX Trading Receivable — ZAR
    Zero delta: no posting.
    All entries in ZAR (functional currency). FVTPL — no OCI.
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — changes in fair value of FVTPL instruments in P&L"
  - type: ifrs
    ifrsRef: "IAS 21 §28 — retranslate monetary items at closing rate; exchange differences to P&L"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
approval:
  approver: Camille (CFO, finance)
  approvedOn: "2026-05-12"
  decisionRef: D-MARKETS-CAPITAL-TIME-SHAPE
```

### PR-FX-003 — FX Settlement (FxSettlementConfirmed)

```yaml
id: PR-FX-003
name: "FX Spot settlement — derecognition and nostro recognition"
eventType: "FxSettlementConfirmed"
preconditions:
  - "event.payload.legKind == 'near'"
postingLogic: "fxSettlementJournals(event.payload) — see fx-spot.ts"
postings:
  description: |
    (i) Base currency leg: Dr/Cr nostroAccountBase ↔ receivable/payable(baseCcy)
    (ii) Quote currency leg: Dr/Cr nostroAccountQuote ↔ payable/receivable(quoteCcy)
    (iii) Realised P&L residual (if any): Dr/Cr nostroZAR ↔ ACC-2100-006 Realised FX P&L
    Each sub-entry balances in its currency. Derecognises FVTPL asset/liability.
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §3.2.3 — derecognise financial asset when contractual rights expire"
  - type: ifrs
    ifrsRef: "IFRS 9 §3.3.1 — derecognise financial liability when extinguished"
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — any residual fair-value change at settlement to P&L"
  - type: regulation
    regulationId: D-FX-CLS-MEMBERSHIP
    note: "Settlement path is correspondent-bank CLS; confirmation triggers derecognition."
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
approval:
  approver: Camille (CFO, finance)
  approvedOn: "2026-05-12"
  decisionRef: D-MARKETS-CAPITAL-TIME-SHAPE
```
