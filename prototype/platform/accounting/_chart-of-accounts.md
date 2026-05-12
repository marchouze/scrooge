# Chart of accounts — v0

**Owner:** Bea (with Atlas — substrate) · **Status:** v0 — substrate live, content sparse · **Authored:** 2026-05-07

The chart of accounts is the typed, citation-bearing register of every general-ledger account the bank holds postings against. Per Principle 1, balances are queries over the event log; the chart is the *mapping* from event flows to GL accounts that those queries dispatch against. Per Principle 2, every account anchors to an IFRS reference and (where applicable) a BA-return cell so the upward chain `IFRS / Banks Act → Accounting Policies → Posting rule → Account` reconciles.

The canonical typed form is one JSON object per account, validating against [`chart-of-accounts.schema.json`](chart-of-accounts.schema.json). At v0, accounts are co-located in this markdown for readability; once the close engine substrate lands (Bea Substrate Gap §3, target M2), each account migrates to its own typed file with append-only versioning.

## Why this exists

- **Principle 1 (events are truth).** Posting rules dispatch event flows to accounts; the chart is what the dispatch resolves against. Aggregations (trial balance, balance sheet, BA returns) are queries that fold events into accounts via posting rules.
- **Principle 5 (multi-everything from day one).** Every account declares its `currencies` array and `entityScope` array. There is no default currency; a posting rule that does not yield a currency for a posting fails by construction.
- **Principle 2 (single graph, no orphans).** Every account carries citations: an IFRS reference (classification), a regulation ID (where applicable), and a `baReturnLines` array tying postings to the BA forms they roll up to.

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

---

## FX Spot accounts — added 2026-05-12

**Authority:** D-MARKETS-SCHEMA-FOUNDATION + D-MARKETS-CAPITAL-TIME-SHAPE (CEO-approved 2026-05-12)  
**Approved by:** Camille (CFO, finance) · Bea (Accounting & financial reporting engineer, engineering)  
**Spec:** `Owner Inbox/2026-05-12_camille-bea_fx-accounting-spec-v1.md`

### ACC-2100-001 — FX Trading Receivable — ZAR

```yaml
id: ACC-2100-001
name: "FX Trading Receivable — ZAR"
category: asset-trading
side: debit
ifrsClassification: fvtpl
currencies: [ZAR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Trading assets (Item 3)"
    side: positive
    note: "FX Spot trading receivable in ZAR — FVTPL asset. Recognised at trade date per IFRS 9 B3.1.3."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.1.5 — mandatory FVTPL (FX instruments cannot pass SPPI; held-for-trading)"
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — changes in fair value recognised in profit or loss (FVTPL)"
  - type: ifrs
    ifrsRef: "IFRS 9 §B3.1.3 — trade-date recognition of trading assets"
  - type: ifrs
    ifrsRef: "IAS 1 §54 — separate balance-sheet line for trading assets"
  - type: regulation
    regulationId: D-MARKETS-SCHEMA-FOUNDATION
    note: "FX Spot product in scope from M4."
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
    note: "Capital-time shape approval — FX accounting treatment."
  - type: policy
    policyRef: "Accounting Policies (IFRS) v0.1 (STUB)"
    section: "§5 FVTPL trading instruments"
```

### ACC-2100-002 — FX Trading Receivable — USD

```yaml
id: ACC-2100-002
name: "FX Trading Receivable — USD"
category: asset-trading
side: debit
ifrsClassification: fvtpl
currencies: [USD]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Trading assets (Item 3)"
    side: positive
    note: "FX Spot trading receivable in USD — FVTPL asset. USD amounts translated to ZAR at closing rate for BA 300."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.1.5 — mandatory FVTPL"
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — FVTPL P&L"
  - type: ifrs
    ifrsRef: "IAS 21 §28 — monetary items retranslated at closing rate"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-2100-003 — FX Trading Payable — ZAR

```yaml
id: ACC-2100-003
name: "FX Trading Payable — ZAR"
category: liability-trading
side: credit
ifrsClassification: fvtpl
currencies: [ZAR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Trading liabilities (Item 18)"
    side: positive
    note: "FX Spot trading payable in ZAR — FVTPL liability. Obligation to deliver ZAR at settlement."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.2.1 — financial liability at FVTPL (held-for-trading)"
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — FVTPL P&L"
  - type: ifrs
    ifrsRef: "IAS 1 §54 — separate balance-sheet line for trading liabilities"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-2100-004 — FX Trading Payable — USD

```yaml
id: ACC-2100-004
name: "FX Trading Payable — USD"
category: liability-trading
side: credit
ifrsClassification: fvtpl
currencies: [USD]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Trading liabilities (Item 18)"
    side: positive
    note: "FX Spot trading payable in USD — FVTPL liability. Obligation to deliver USD at settlement."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.2.1 — financial liability at FVTPL"
  - type: ifrs
    ifrsRef: "IAS 21 §28 — monetary items retranslated at closing rate"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-2100-005 — Unrealised FX P&L — FVTPL

```yaml
id: ACC-2100-005
name: "Unrealised FX P&L — FVTPL"
category: income-trading
side: credit
ifrsClassification: fvtpl
currencies: [ZAR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Net trading income (Item 22)"
    side: positive
    note: "Unrealised FX mark-to-market P&L. Included in net trading income for BA 300."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §5.7.1 — changes in FVTPL fair value in profit or loss"
  - type: ifrs
    ifrsRef: "IAS 1 §85 — net trading income presentation"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
  - type: policy
    policyRef: "Accounting Policies (IFRS) v0.1 (STUB)"
    section: "§5.3 FVTPL income presentation — no OCI for trading book"
```

### ACC-2100-006 — Realised FX P&L

```yaml
id: ACC-2100-006
name: "Realised FX P&L"
category: income-trading
side: credit
ifrsClassification: fvtpl
currencies: [ZAR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Net trading income (Item 22)"
    side: positive
    note: "Realised FX P&L crystallised on settlement. Includes bid/offer spread and intraday rate residual."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §3.2.3 — derecognition on settlement (contractual rights expire)"
  - type: ifrs
    ifrsRef: "IAS 1 §85 — net trading income presentation"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-1100-002 — Nostro — USD (Correspondent)

```yaml
id: ACC-1100-002
name: "Nostro — USD (correspondent bank)"
category: asset-cash-equivalents
side: debit
ifrsClassification: amortised-cost
currencies: [USD]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Cash and balances at banks (Item 1 / Item 2)"
    side: positive
    note: "USD nostro at correspondent bank. Foreign-currency cash equivalent."
  - form: "BA 325"
    line: "Highly Liquid Assets — foreign-currency central-bank reserves or nostro (LCR)"
    side: positive
    note: "Eligible for HQLA classification subject to haircut and operational requirements per BA 325."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.1.2 — amortised-cost classification (held-to-collect; SPPI cash flows: principal and interest on demand/overnight)"
  - type: ifrs
    ifrsRef: "IAS 21 §21 — initial recognition at spot rate"
  - type: ifrs
    ifrsRef: "IAS 21 §28 — retranslate monetary item at closing rate; exchange difference to P&L"
  - type: regulation
    regulationId: D-FX-CLS-MEMBERSHIP
    note: "Correspondent-bank settlement account; primary USD nostro per D-FX-CLS-MEMBERSHIP routing."
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-1100-003 — Nostro — EUR (Correspondent)

```yaml
id: ACC-1100-003
name: "Nostro — EUR (correspondent bank)"
category: asset-cash-equivalents
side: debit
ifrsClassification: amortised-cost
currencies: [EUR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Cash and balances at banks (Item 1 / Item 2)"
    side: positive
    note: "EUR nostro at correspondent bank."
  - form: "BA 325"
    line: "Highly Liquid Assets — foreign-currency nostro (LCR)"
    side: positive
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §4.1.2 — amortised-cost classification"
  - type: ifrs
    ifrsRef: "IAS 21 §28 — retranslate at closing rate"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

### ACC-1100-004 — FX Settlement Suspense — ZAR

```yaml
id: ACC-1100-004
name: "FX Settlement Suspense — ZAR"
category: asset-suspense
side: debit
ifrsClassification: amortised-cost
currencies: [ZAR]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Other assets / suspense (Item 30 or similar)"
    side: positive
    note: "ZAR suspense account for FX settlement in-transit. Cleared same-day on SAMOS confirmation. Should net to zero at period-end."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §B3.1.3 — trade-date settlement mechanics; suspense accounts bridge trade-date and settlement-date entries"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
  - type: policy
    policyRef: "Accounting Policies (IFRS) v0.1 (STUB)"
    section: "§3.4 Suspense accounts — must clear within 2 business days"
```

### ACC-1100-005 — FX Settlement Suspense — USD

```yaml
id: ACC-1100-005
name: "FX Settlement Suspense — USD"
category: asset-suspense
side: debit
ifrsClassification: amortised-cost
currencies: [USD]
entityScope: [LE-ZA-HOZ-BANK]
baReturnLines:
  - form: "BA 300"
    line: "Other assets / suspense"
    side: positive
    note: "USD suspense account for FX settlement in-transit. Cleared on correspondent confirmation. Should net to zero at period-end."
version: v1.0
status: draft
citations:
  - type: ifrs
    ifrsRef: "IFRS 9 §B3.1.3 — settlement suspense mechanics"
  - type: regulation
    regulationId: D-MARKETS-CAPITAL-TIME-SHAPE
```

---

## Coverage update (post-FX-Spot slice)

| GL family | In v1 | Gap (target slice) |
|---|---|---|
| Assets — cash & SARB balances | `ACC-1100-001` (ZAR SARB), `ACC-1100-002` (USD nostro), `ACC-1100-003` (EUR nostro), `ACC-1100-004/005` (settlement suspense) | GBP/JPY/CHF nostros; cash-in-transit |
| Assets — trading (FX FVTPL) | `ACC-2100-001` (ZAR receivable), `ACC-2100-002` (USD receivable) | EUR/GBP/JPY receivables; IRD receivables |
| Liabilities — trading (FX FVTPL) | `ACC-2100-003` (ZAR payable), `ACC-2100-004` (USD payable) | EUR/GBP/JPY payables; IRD payables |
| Income | `ACC-2100-005` (Unrealised FX P&L), `ACC-2100-006` (Realised FX P&L) | Interest income; fee income; other trading income |
| Assets — investments / bonds | — | Government bonds (HQLA L1); JSE equities |
| Liabilities — deposits / funding | — | Wholesale funding; sponsor-bank settlement |
| Equity | — | Share capital; retained earnings |
| Expenses | — | Anthropic API spend; cloud spend |
