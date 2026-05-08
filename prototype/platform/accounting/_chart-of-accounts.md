# Chart of accounts — v0

**Owner:** Bea (with Atlas — substrate) · **Status:** v0 — substrate live, content sparse · **Authored:** 2026-05-07

The chart of accounts is the typed, citation-bearing register of every general-ledger account the bank holds postings against. Per Principle 1, balances are queries over the event log; the chart is the *mapping* from event flows to GL accounts that those queries dispatch against. Per Principle 6, every account anchors to an IFRS reference and (where applicable) a BA-return cell so the upward chain `IFRS / Banks Act → Accounting Policies → Posting rule → Account` reconciles.

The canonical typed form is one JSON object per account, validating against [`chart-of-accounts.schema.json`](chart-of-accounts.schema.json). At v0, accounts are co-located in this markdown for readability; once the close engine substrate lands (Bea Substrate Gap §3, target M2), each account migrates to its own typed file with append-only versioning.

## Why this exists

- **Principle 1 (events are truth).** Posting rules dispatch event flows to accounts; the chart is what the dispatch resolves against. Aggregations (trial balance, balance sheet, BA returns) are queries that fold events into accounts via posting rules.
- **Principle 5 (multi-everything from day one).** Every account declares its `currencies` array and `entityScope` array. There is no default currency; a posting rule that does not yield a currency for a posting fails by construction.
- **Principle 6 (single graph, no orphans).** Every account carries citations: an IFRS reference (classification), a regulation ID (where applicable), and a `baReturnLines` array tying postings to the BA forms they roll up to.

## Coverage today

| GL family | In v0 | Gap (target slice) |
|---|---|---|
| Assets — cash & SARB balances | `ACC-1100-001` (Cash and balances at SARB — operational ZAR) | Foreign-currency operational accounts (USD / EUR / GBP); cash-in-transit; nostro per correspondent |
| Assets — investments / loans / derivatives | — | Government bonds (HQLA L1); JSE equities (HQLA L2A); IRD-receivable; loan portfolio (post-revenue) |
| Liabilities — deposits / funding / derivatives | — | Wholesale funding; IRD-payable; sponsor-bank settlement-account liability |
| Equity | — | Share capital; share premium; retained earnings; reserves |
| Income | — | Interest income; trading income; fee income |
| Expenses | — | Anthropic API spend (the largest current cost); cloud spend (post-migration); statutory officer remuneration (licence-day) |

The single populated account below is the worked example. Subsequent population happens in scheduled weekly drift checks (Bea spec §6) and on `PostingRulePublished` events that introduce new event types.

---

## ACC-1100-001 — Cash and balances at SARB (operational, ZAR)

```yaml
id: ACC-1100-001
name: "Cash and balances at SARB — operational, ZAR"
category: asset-cash-equivalents
side: debit
ifrsClassification: amortised-cost
currencies: [ZAR]
entityScope: [LE-ZA-BANKNEWCO]
baReturnLines:
  - form: "BA 100"
    line: "Total qualifying capital and reserve funds — supporting cash element (memo)"
    side: memo
    note: "Operational cash; not a capital component itself, but feeds liquidity-coverage reporting."
  - form: "BA 300"
    line: "Cash and balances at central bank (Item 1)"
    side: positive
    note: "Primary line for SARB operational balance."
  - form: "BA 325"
    line: "HQLA Level 1 — central-bank reserves (LCR)"
    side: positive
    note: "LCR HQLA contribution per BCBS D295 / BA 325."
version: v0.1
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.1.2 — amortised-cost classification (held-to-collect, SPPI cash flows)"
    note: "Operational cash held at SARB satisfies SPPI and is held-to-collect."
  - type: ifrs
    ifrsRef: "IAS 1 §54(i) — separate balance-sheet line for cash and cash equivalents"
  - type: regulation
    regulationId: ORG-AC-01
    note: "IFRS 9 classification at recognition."
  - type: regulation
    regulationId: ORG-PR-06
    note: "LCR HQLA composition — central-bank reserves rank as Level 1."
  - type: regulation
    regulationId: ORG-AC-13
    note: "Account contributes to monthly / quarterly BA-return submissions."
  - type: policy
    policyRef: "Accounting Policies (IFRS) v0.1 (STUB)"
    section: "§2 Cash and equivalents"
    note: "Stub at Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md."
```

### Notes

- **No real balance yet.** The account exists pre-incorporation so synthetic build-phase events carry resolvable account IDs. Real postings begin at licence-day (per CLAUDE.md build-phase rules).
- **Currency declared at the account level.** `currencies: [ZAR]` — explicit, no default. Posting rules that target this account must yield ZAR or fail.
- **Foreign-currency operational accounts.** Each of USD / EUR / GBP gets its own account ID at the next slice (likely `ACC-1100-002 .. -004`), per Principle 5: a single multi-currency account is not allowed; FX exposure must be visible at the account level.

## Authoring notes

Adding or revising an account is a four-step procedure:

1. **Draft** — author the YAML block following [`chart-of-accounts.schema.json`](chart-of-accounts.schema.json).
2. **Cite** — IFRS reference, regulation IDs (where applicable), BA-return-line mapping (where applicable), policy stub (where applicable).
3. **Approve** — Bea approves additions within the standing chart-of-accounts framework. Material reclassifications (e.g., amortised-cost → FVTPL) escalate to Camille per Bea spec §10.
4. **Emit** — `ChartAccountPublished { accountId, version, citationChain }` event lands in the event store; downstream (posting-rule register, BA-return generator, reconciliation harness) re-resolve.

Vera's planned chart-of-accounts recon (Wave-4 candidate) asserts: (a) every account YAML parses and validates; (b) every BA-return line referenced exists in the BA-form schema; (c) every IFRS / regulation citation resolves.
