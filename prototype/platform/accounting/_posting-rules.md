# Posting-rule register — v0

**Owner:** Bea (with Atlas — substrate) · **Status:** v0 — substrate live, content sparse · **Authored:** 2026-05-07

The posting-rule register is the typed, citation-bearing catalogue of every rule that maps a postable event to one or more double-entry GL postings. Per Bea spec §9, `PostingRulePublished` is the event Bea emits when a new rule (or a new version) is approved; downstream consumers (close engine, BA-return generator, reconciliation harness, audit working-paper generator) re-resolve.

The canonical typed form is one JSON object per rule, validating against [`posting-rule.schema.json`](posting-rule.schema.json). At v0, rules live in this markdown for readability; once the close-engine substrate lands (Bea Substrate Gap §3, target M2), each rule migrates to its own typed file.

## Why this exists

- **Principle 1 (events are truth).** A balance is `sum over events of (postings produced by the matched rule for that event)`. The rule register is what makes that fold deterministic and replayable as-of any date.
- **Principle 2 (citations).** Every rule cites the IFRS reference, regulation ID, and policy that justify the posting choice.
- **Principle 6 (no orphans).** Every event type that flows postable financial change must have at least one rule. Vera's planned recon asserts no postable event type is silently dropped.

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
