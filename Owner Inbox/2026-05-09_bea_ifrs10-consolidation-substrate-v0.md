---
title: IFRS 10 consolidation substrate v0
author: Bea (Accounting & financial reporting engineer)
date: 2026-05-09
summary: v0 specification for the IFRS 10 group-consolidation substrate following D-LEGAL-ENTITY-TREE-V0 (Hoz Group / Hoz Bank / Hoz Securities) and D-REGULATORY-PERIMETER. Defines scope, IFRS 10 control assessment, monthly / quarterly / annual consolidation procedure, reconciliation harness, and the six substrate gaps queued for v1. Pairs with `Procedures/by-policy/ifrs10-consolidation-cycle.md` (PROC-ACC-IFRS10-01, STUB).
decision-required: false
---

# IFRS 10 consolidation substrate v0

**Author:** Bea (Accounting & financial reporting engineer)
**Governance line:** Camille (Chief Financial Officer, governance)
**Date:** 2026-05-09
**Status:** v0 — spec + procedure stub. Substrate gaps named for v1.

## §1 — Scope

IFRS 10 *Consolidated Financial Statements* applies to the Hoz group following CEO resolution of D-LEGAL-ENTITY-TREE-V0 (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md`, PR #82). The group composition is:

- **Hoz Group Limited** — non-operating holding company, parent and reporting entity for the consolidated financial statements.
- **Hoz Bank Limited** — 100%-owned subsidiary, SARB-licensed bank under Banks Act 94 of 1990 [citation: TBC — Banks Act § 12 + § 60].
- **Hoz Securities Limited** — 100%-owned subsidiary, FSCA-authorised FSP / ODP.

Consolidation obligation has two binding sources, per D-REGULATORY-PERIMETER (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md`, PR #85):

1. **Companies Act obligation.** Hoz Group Limited, as the holding company of a group, must prepare consolidated annual financial statements [citation: TBC — Companies Act 71 of 2008 § 28 + § 29 + Regulation 27 + 28] and must do so in accordance with IFRS as endorsed by the Financial Reporting Standards Council [citation: TBC — Companies Regulations Reg 27].
2. **Banks Act prudential-supervision obligation.** SARB Prudential Authority assesses the bank on a group / consolidated basis [citation: TBC — Banks Act § 60 + Regulations Relating to Banks § 36 + § 38]; the consolidated view of capital, liquidity, large-exposures, and concentration risk is required for BA returns at the consolidated level.

The consolidated financial statements are also IFRS 12 (*Disclosure of Interests in Other Entities*) and IAS 24 (*Related Party Disclosures*) load-bearing artefacts.

Per Principle 1, the consolidated financial statements are **queries over the event log**, not stored documents. The consolidation substrate produces, on demand and at any "as-of" point, a reproducible set of consolidated balance-sheet, income-statement, equity-movement, and cash-flow statements, plus the IFRS 12 + IAS 24 disclosures.

## §2 — IFRS 10 control assessment

IFRS 10 paragraph 6 + 7 [citation: TBC — IFRS 10 §6, §7] require, for control to exist, that the parent has (a) power over the investee, (b) exposure / rights to variable returns, and (c) the ability to use power to affect those returns. The assessment for each subsidiary:

### 2.1 Hoz Bank Limited

| IFRS 10 element | Evidence | Conclusion |
|---|---|---|
| Power over the investee | 100% voting equity held by Hoz Group Limited (per D-LEGAL-ENTITY-TREE-V0). All director appointments and removals controlled by the holding company as sole shareholder under Companies Act voting rules [citation: TBC — Companies Act § 66 + MOI provisions]. | Power present. |
| Exposure to variable returns | 100% economic interest in dividends, retained earnings, and capital actions of Hoz Bank Limited. | Exposure present. |
| Ability to use power to affect returns | Holding company appoints / removes directors, approves capital actions, and through that mechanism affects strategic direction and therefore returns. Subject only to SARB PA fit-and-proper and prior-consent gates [citation: TBC — Banks Act § 13 + § 62] — these are regulatory overlays, not third-party control rights. | Ability present. |
| **Conclusion** | Three-element test satisfied per IFRS 10 §6, §7. | **Full consolidation.** |

### 2.2 Hoz Securities Limited

Same analysis as 2.1, with the SARB PA fit-and-proper / prior-consent overlay replaced by FSCA FSP / ODP authorisation overlays [citation: TBC — FAIS Act + FMA / ODP regulations]. Conclusion: **full consolidation.**

### 2.3 Minority interests

Zero at v0. Both subsidiaries are 100%-owned. The substrate is structurally written to allow for partial-shareholding cases at future cadence (the consolidation engine carries a `nonControllingInterest` slot per subsidiary; at v0 every value is zero).

### 2.4 Consolidation conclusion

Hoz Group Limited fully consolidates Hoz Bank Limited and Hoz Securities Limited from inception of the group structure. The consolidation cycle becomes operationally load-bearing at the first reporting period after the group is incorporated; until then the substrate is exercised against rehearsed-readiness data per CLAUDE.md "Steady-state vs current substrate" framing.

## §3 — Consolidation procedure

**Cadence.** Monthly close (management view); quarterly (regulator-aligned review); annual (audited consolidated financial statements per Companies Act + IFRS endorsement). Cadence aligns with both the Companies Act annual filing obligation and the SARB PA BA-returns submission cycle. JSE Listings Requirements impose additional cadence if Hoz Group lists [citation: TBC — JSE Listings Requirements § 8 + § 13]; v0 assumes unlisted.

**Owners.** Bea (engineering substrate) builds and maintains the consolidation engine; Camille (Chief Financial Officer, governance) signs the consolidated financial statements. The procedure file (`PROC-ACC-IFRS10-01`) names the chain end-to-end.

### 3.1 Steps

| # | Step | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Each entity prepares its trial balance from the per-entity event-log view (per Principle 1; per-entity ledgers are queries over the event store filtered by `entityId`) | `system` | `prototype/platform/accounting/per-entity-ledger.ts` (PLANNED) | Output is a typed `EntityTrialBalance` artefact per entity per as-of date |
| 2 | Inter-company transactions identified via `IntraGroupArrangementSigned` events (substrate cross-reference: Atlas (Core banking platform architect) `LegalEntityRegistered` event family on `claude/atlas-legal-entity-event-family-v0`) and matched against in-period transactional events (`JournalPosted`, `PaymentExecuted`, `LoanAdvanced`, etc.) on both entity legs | `system` | `prototype/platform/accounting/intra-group-matching.ts` (PLANNED) | Matched-pair output is `IntraGroupTransactionMatched` events |
| 3 | Inter-company eliminations applied: matching pairs cancel (asset on one entity ↔ liability on the other; income on one ↔ expense on the other; equity-investment ↔ subsidiary equity) | `system` | `prototype/platform/accounting/eliminations.ts` (PLANNED) | Each elimination emits `IntraGroupBalanceEliminated` |
| 4 | Aggregation: line-by-line addition of the remaining (non-eliminated) trial-balance lines across the three entities | `system` | `prototype/platform/accounting/consolidation.ts` (PLANNED) | Output is the consolidated trial balance as of the as-of date |
| 5 | Minority-interest computation: zero at v0 (100% subsidiaries); structurally present for future partial-shareholding cases | `system` | `prototype/platform/accounting/consolidation.ts` (PLANNED) | Each future case emits `MinorityInterestComputed` |
| 6 | IFRS 12 disclosures generated: structured group-tree, control-assessment summary (per §2 above), restrictions on intra-group asset access (per the IntraGroupArrangementSigned register), risks associated with interests | `system` | `prototype/platform/accounting/ifrs12-disclosures.ts` (PLANNED) | Disclosure block is itself a query, not authored |
| 7 | IAS 24 related-party disclosures generated: every `IntraGroupArrangementSigned` event in the period surfaces in the disclosure with terms (consideration, arm's-length pricing reference, settlement) | `system` | `prototype/platform/accounting/ias24-disclosures.ts` (PLANNED) | Disclosure block is itself a query, not authored |
| 8 | Camille (Chief Financial Officer, governance) reviews and signs the consolidated financial statements | `human` (Camille) | `PLANNED` — sign-off captured as typed event `ConsolidatedFinancialStatementsApproved` | Human-judgment step justified under Principle 2 (CFO sign-off is the regulatory expectation for financial-statement authority) |
| 9 | Consolidated statements lodged into the relevant regulatory submission cycles (BA returns at the consolidated level; annual filings under Companies Act) | `system` | `PLANNED` — submission generators per Anya (Data / analytics engineer) reporting-capability spec | Cross-binds to Bea's `ba-return-generation.md` (PLANNED) |

### 3.2 Inter-company elimination taxonomy

Five inter-company elimination classes anticipated at v0 (substrate must accommodate all five from inception):

1. **Equity-investment ↔ subsidiary equity** — Hoz Group's investment in subsidiaries cancels against the subsidiaries' contributed equity; any difference is goodwill or bargain-purchase per IFRS 3 [citation: TBC — IFRS 3 § 32]. At v0, fair-value-equals-book-value at incorporation; goodwill computation lands in v1.
2. **Inter-company loans / receivables ↔ payables** — every `IntraGroupArrangementSigned` recording a loan binds an asset on the lender entity and a liability on the borrower entity that match on principal, interest accrual, and FX (zero at v0; ZAR-functional throughout per Principle 5).
3. **Inter-company services / fees** — Hoz Bank or Hoz Securities providing services to the other (e.g., shared-services arrangements) generate matched income and expense pairs that cancel.
4. **Inter-company dividends** — declared dividends from subsidiary to parent cancel against parent's dividend-income line.
5. **Inter-company unrealised gains / losses on intra-group asset transfers** — IFRS 10 §B86(c) [citation: TBC] requires elimination of unrealised gains on assets transferred within the group until realised externally. Zero at v0; substrate placeholder.

Each elimination class produces a typed `IntraGroupBalanceEliminated` event sub-type at v1; v0 spec names the taxonomy.

## §4 — Reconciliation harness

A new Vera (Internal-audit / continuous-assurance engineer) Wave-4 recon, **`consolidation-recon`**, asserts the consolidation correctness. v0 names it; v1 implements it.

### 4.1 Assertions

1. **Elimination completeness.** Every `IntraGroupArrangementSigned` event in the period has matching transactional events on both entity legs, and the matching produces an `IntraGroupTransactionMatched` event before the period closes. Drift is a finding.
2. **Elimination correctness — no over- or under-elimination.** For every `IntraGroupTransactionMatched` pair, the two legs are quantum-equal (same currency, same amount, opposite sign on the consolidated balance sheet) before elimination. Quantum mismatch is a finding (often signals a posting error, FX rate drift, or a missed accrual on one entity).
3. **Aggregation idempotence.** For every entity's trial balance contributing to the consolidation, the consolidated value of any line equals the sum of the entity values minus the sum of the eliminations on that line. Algebraic identity — reconciles deterministically.
4. **Per-entity ledger isolation.** No event in the per-entity ledger view of any one entity carries a `entityId` that belongs to another. Cross-entity drift is a Principle-1 violation finding.
5. **Companies-Act-vs-Banks-Act consolidated-view parity.** The consolidated balance-sheet line items presented in the Companies Act consolidated annual financial statements equal the consolidated balance-sheet line items presented to SARB PA via the BA returns at the group level (subject to format / aggregation differences which are themselves a typed mapping).

### 4.2 Status

**STUB at v0.** The harness file (`prototype/platform/recon/consolidation-recon.ts`) is named in the substrate-gaps inventory; v1 implementation queued under Vera Wave-4 substrate.

## §5 — Substrate gaps surfaced

Per Principle 7 substrate-gap-naming discipline. v0 substrate deliberately scaffolds without v1 engineering — gaps queued behind named owners.

1. **Per-entity ledger separation in the event store.** Every accounting event (`JournalPosted`, `BalanceProjected`, `PaymentExecuted`, `LoanAdvanced`, `MarginCalled`, etc.) requires an `entityId` field tagging which legal entity the event is bound to. Per-entity ledger views are queries over the event log filtered by `entityId`. Cross-references Atlas (Core banking platform architect)'s `LegalEntityRegistered` event family in flight on `claude/atlas-legal-entity-event-family-v0` — the `entityId` values resolve to the legal-entity register Atlas establishes. **Owner: Atlas + Bea — v1 substrate.**
2. **Inter-company elimination event types.** New typed events: `IntraGroupTransactionMatched`, `IntraGroupBalanceEliminated` (with sub-types per the elimination taxonomy in §3.2), `MinorityInterestComputed`. Need adding to `prototype/platform/event-store/event-types.ts`. **Owner: Atlas + Bea — v1 substrate.**
3. **Consolidated financial statement generator.** TypeScript module at `prototype/platform/accounting/consolidation.ts` that, given an as-of date, queries the per-entity ledgers, runs the elimination engine, aggregates to the consolidated view, and emits the IFRS 10 / IFRS 12 / IAS 24-aligned statement set. Per Principle 1, the statements are queries — not stored documents. **Owner: Bea — v1 substrate.**
4. **IFRS 10 / IFRS 12 + IAS 24 disclosure templates.** Generator-side templates that produce the structured-data disclosure blocks; PDFs are renderings of these queries per Principle 3 ("documents are structured data first; PDFs are renderings, not records"). Sign-off cadence aligned to Camille (CFO governance). **Owner: Bea + Camille — v1 substrate.**
5. **Vera Wave-4 `consolidation-recon`.** Recon harness implementing the five assertions in §4.1. **Owner: Vera (Internal-audit / continuous-assurance engineer) — Wave-4.**
6. **Multi-currency consolidation (IAS 21).** Each entity's functional currency is ZAR at v0 (single-jurisdiction SA group; foreign-jurisdiction subsidiaries deferred per D-LEGAL-ENTITY-TREE-V0). When foreign subsidiaries enter the group, IAS 21 *The Effects of Changes in Foreign Exchange Rates* [citation: TBC — IAS 21 §39 + §44 — translation to presentation currency, equity reserve treatment of translation adjustments] introduces translation rules: balance-sheet items at closing rate, income-statement items at transaction-date rate, translation differences to a separate component of equity (foreign-currency translation reserve). Per Principle 5, the substrate is **anticipated** at v0 and added as configuration when the second entity-currency lands — not a project. **Owner: Bea + Atlas — future cadence after first foreign subsidiary enters group.**

## §6 — Cross-references

- **Decision records:**
  - `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md` (PR #82) — establishes the three-entity group structure.
  - `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` (PR #85) — confirms the Companies-Act + Banks-Act dual binding.
- **Atlas in-flight branch:** `claude/atlas-legal-entity-event-family-v0` — the `LegalEntityRegistered` and `IntraGroupArrangementSigned` event family Bea's substrate cites and consumes.
- **Procedure pair:** `Procedures/by-policy/ifrs10-consolidation-cycle.md` (PROC-ACC-IFRS10-01, STUB) — the procedure-stub partner to this spec.
- **Upstream dependencies (referenced):** `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md` (Accounting Policies (IFRS) v0.1 STUB; Financial Reporting & Disclosure v0.1 STUB — these become the upstream policy that Camille (CFO governance) approves and that this consolidation procedure implements per Principle 6 upward chain).
- **Procedures-index entry** under "Finance, accounting, tax, treasury": new row pointing to `ifrs10-consolidation-cycle.md`.

## §7 — Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0 | 2026-05-09 | Bea (Accounting & financial reporting engineer) | Initial spec + procedure stub. Three-entity group consolidation per D-LEGAL-ENTITY-TREE-V0 + D-REGULATORY-PERIMETER. IFRS 10 control assessment for both 100%-owned subsidiaries; full consolidation. Six substrate gaps named for v1 (per-entity ledger `entityId`; inter-company elimination event types; consolidation generator; IFRS 12 + IAS 24 disclosure templates; Vera `consolidation-recon`; IAS 21 multi-currency anticipation). Camille (CFO governance) signs at sign-off step. |
