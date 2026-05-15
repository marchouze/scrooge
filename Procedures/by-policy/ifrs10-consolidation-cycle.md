---
procedureId: PROC-ACC-IFRS10-01
title: IFRS 10 group consolidation cycle
author: Bea (Accounting & financial reporting engineer)
date: 2026-05-09
owner: Bea (Accounting & financial reporting engineer — engineering-substrate seat) · governance line: Camille (Chief Financial Officer, governance)
status: POPULATED
policy-cited: ifrs10-consolidation-policy (planned by Camille — sub-policy under Accounting Policies (IFRS) v0.1 / Financial Reporting & Disclosure v0.1, both STUB at `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`)
system-capability: prototype/platform/accounting/consolidation.ts (planned)
---

# Procedure — IFRS 10 group consolidation cycle

**Procedure ID:** PROC-ACC-IFRS10-01
**Owner:** Bea (Accounting & financial reporting engineer — engineering-substrate seat) · Camille (Chief Financial Officer, governance — sign-off line)
**Approval:** Camille (CFO) under the IFRS 10 consolidation policy (planned, queued under Accounting Policies (IFRS) v0.1 STUB and Financial Reporting & Disclosure v0.1 STUB).
**Cadence:** Monthly close (management view); quarterly (regulator-aligned review); annual (audited consolidated financial statements per Companies Act + IFRS endorsement).
**Version:** v0.1 — 2026-05-09
**Status:** **POPULATED** — all 13 sections complete. Procedure scaffolded under D-LEGAL-ENTITY-TREE-V0 (PR #82) and D-REGULATORY-PERIMETER (PR #85); system capability `PLANNED`; substrate gaps named in §9. Activates live at first reporting period after group is incorporated; runs as Scrooge-coordinated rehearsed-readiness exercises in build-phase.

## 1. Source policy

- IFRS 10 consolidation policy (planned by Camille — sub-policy under Accounting Policies (IFRS) v0.1 STUB and Financial Reporting & Disclosure v0.1 STUB, `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md`).
- Spec partner (authored in parallel): `Owner Inbox/2026-05-09_bea_ifrs10-consolidation-substrate-v0.md` — the substrate spec this procedure implements step-by-step.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| Companies Act 71 of 2008 § 28 + § 29 + Regulation 27 + 28 [citation: TBC — exact section anchors to be ratified by Imani (Legal-as-code engineer) + external counsel at licence-application gate] | Holding company of a group prepares consolidated annual financial statements in accordance with IFRS endorsed by FRSC. | This procedure produces the consolidated financial statements; Step 8 is Camille (CFO governance) sign-off and Step 9 is filing. |
| Banks Act 94 of 1990 § 60 + Regulations Relating to Banks § 36 + § 38 [citation: TBC] | SARB Prudential Authority assesses the bank on a group / consolidated basis; consolidated capital, liquidity, large-exposures reported via BA returns at consolidated level. | Step 9 (regulatory-submission generation) consumes this procedure's consolidated outputs and feeds them into Bea's `ba-return-generation.md` (PLANNED). |
| IFRS 10 *Consolidated Financial Statements* §6, §7, §B86, §19, §22 [citation: TBC] | Three-element control test; uniform accounting policies across the group; line-by-line consolidation with intra-group elimination. | §2 of the spec partner documents the three-element test; Steps 3 + 4 implement line-by-line consolidation with elimination. |
| IFRS 12 *Disclosure of Interests in Other Entities* [citation: TBC] | Disclose composition of group, control assessment summary, restrictions on access to group assets, risks. | Step 6 generates IFRS 12 disclosure block. |
| IAS 24 *Related Party Disclosures* [citation: TBC] | Disclose related-party transactions and balances, including parent-subsidiary and inter-subsidiary. | Step 7 generates IAS 24 disclosure block from `IntraGroupArrangementSigned` events. |
| IAS 21 *The Effects of Changes in Foreign Exchange Rates* §39, §44 [citation: TBC] | Translation of foreign-functional-currency entities to presentation currency; translation differences to FCTR equity reserve. | Anticipated, not load-bearing at v0 (ZAR-functional throughout); substrate placeholder per §6 substrate gap 6. |
| IFRS 3 *Business Combinations* §32 [citation: TBC] | Goodwill computation on acquisition. | Anticipated; v0 has fair-value-equals-book-value at incorporation; substrate placeholder. |

## 3. Purpose

Produce, on demand and at any "as-of" point, a reproducible set of consolidated balance-sheet, income-statement, equity-movement, and cash-flow statements for the Hoz Group Limited group (Hoz Group Limited parent + Hoz Bank Limited 100%-owned + Hoz Securities Limited 100%-owned), plus the IFRS 12 (group composition + control assessment + restrictions + risks) and IAS 24 (related-party transactions and balances) disclosure blocks. Per Principle 1, the consolidated financial statements are **queries over the event log**, not stored documents. The procedure is the operational discipline binding Camille (CFO governance) sign-off to the substrate output.

## 4. Trigger

- **Primary cadence trigger:** Period-end (monthly / quarterly / annual). Each cadence closes its books and runs the consolidation cycle.
- **Ad-hoc trigger:** Regulator request, board paper, audit walk-through, or any "as-of replay" need — the consolidation engine is invocable at any historical point per Principle 1.
- **Group-composition trigger:** Any `LegalEntityRegistered` or `LegalEntityDeregistered` event (Atlas (Core banking platform architect) substrate, in flight on `claude/atlas-legal-entity-event-family-v0`) re-evaluates the IFRS 10 control assessment for the changed entity and updates the consolidation scope.

## 5. Steps

Per the spec partner § 3.1 — re-stated here in procedure form. Each step names the actor and the system capability.

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Each entity's per-entity trial balance produced from the event log filtered by `entityId` | `system` | `prototype/platform/accounting/per-entity-ledger.ts` (PLANNED) | Output: typed `EntityTrialBalance` per entity per as-of date |
| 2 | Inter-company transactions identified via `IntraGroupArrangementSigned` events and matched against in-period transactional events on both entity legs | `system` | `prototype/platform/accounting/intra-group-matching.ts` (PLANNED) | Output: `IntraGroupTransactionMatched` events |
| 3 | Inter-company eliminations applied across the five elimination classes (equity-investment ↔ subsidiary equity; inter-co loans; inter-co services; inter-co dividends; unrealised intra-group gains) | `system` | `prototype/platform/accounting/eliminations.ts` (PLANNED) | Each emits `IntraGroupBalanceEliminated` (sub-typed) |
| 4 | Aggregation: line-by-line addition of remaining (non-eliminated) trial-balance lines across the three entities | `system` | `prototype/platform/accounting/consolidation.ts` (PLANNED) | Output: consolidated trial balance |
| 5 | Minority-interest computation (zero at v0; substrate-present for future partial-shareholding cases) | `system` | `prototype/platform/accounting/consolidation.ts` (PLANNED) | Each future case emits `MinorityInterestComputed` |
| 6 | IFRS 12 disclosures generated: group-tree, control-assessment summary, restrictions on intra-group asset access, risks | `system` | `prototype/platform/accounting/ifrs12-disclosures.ts` (PLANNED) | Disclosure block is a query, not authored |
| 7 | IAS 24 related-party disclosures generated: every `IntraGroupArrangementSigned` event in the period surfaces with terms (consideration, arm's-length pricing reference, settlement) | `system` | `prototype/platform/accounting/ias24-disclosures.ts` (PLANNED) | Disclosure block is a query, not authored |
| 8 | Camille (Chief Financial Officer, governance) reviews and signs the consolidated financial statements | `human` (Camille) | `PLANNED` — sign-off as typed event `ConsolidatedFinancialStatementsApproved` | Human-judgment step justified under Principle 2 (CFO sign-off is the regulatory expectation for financial-statement authority) |
| 9 | Consolidated statements lodged into the relevant regulatory submission cycles (BA returns at consolidated level; annual filings under Companies Act) | `system` | `PLANNED` — submission generators per Anya (Data / analytics engineer) reporting-capability spec | Cross-binds to `ba-return-generation.md` (PLANNED) |

## 6. Reconciliation

Per the spec partner § 4 — the new Vera (Internal-audit / continuous-assurance engineer) Wave-4 **`consolidation-recon`** asserts the consolidation correctness. v0 names it; v1 implements.

### Assertions

1. **Elimination completeness.** Every `IntraGroupArrangementSigned` event in the period has matching transactional events on both entity legs and produces an `IntraGroupTransactionMatched` event before period close. Drift is a finding.
2. **Elimination correctness.** For every matched pair, the two legs are quantum-equal before elimination — no over- or under-elimination. Mismatch is a finding (often a posting error, FX rate drift, or missed accrual).
3. **Aggregation idempotence.** Algebraic identity: consolidated value of any line = sum of entity values – sum of eliminations on that line.
4. **Per-entity ledger isolation.** No event in any per-entity ledger view carries an `entityId` belonging to another entity. Cross-entity drift is a Principle-1 violation.
5. **Companies-Act-vs-Banks-Act parity.** Consolidated balance-sheet line items in the Companies Act consolidated AFS equal those in the BA returns at group level (subject to format mapping).

**Failure mode:** Any `consolidation-recon` finding above blocks Step 8 (Camille sign-off) and triggers escalation to Bea + Camille within the close-cycle SLA.

## 7. Evidence / artefacts produced

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Per-entity trial balances | Event-log query output | Reproducible from event log (Principle 1) | Internal — restricted to finance + governance |
| `IntraGroupTransactionMatched` / `IntraGroupBalanceEliminated` / `MinorityInterestComputed` events | Event store (`prototype/platform/event-store/`; PLANNED) | Permanent (event log immutable) | Internal — restricted |
| Consolidated balance-sheet, income-statement, equity-movement, cash-flow statements | Query output (Principle 1) | Reproducible | Public-facing once filed; restricted internally pre-filing |
| IFRS 12 disclosure block | Query output | Reproducible | Same as statements |
| IAS 24 disclosure block | Query output | Reproducible | Same as statements |
| `ConsolidatedFinancialStatementsApproved` event (Camille sign-off) | Event store | Permanent | Internal — governance-restricted |
| Annual signed consolidated financial statements rendered to PDF | Document store | Statutory retention per Companies Act [citation: TBC] | Public after filing |

## 8. Manual steps

- **Camille (CFO governance) sign-off (Step 8)** is a human-judgment step captured as a typed event. Per Principle 6, the human-actor exception is registered: CFO sign-off of financial statements is a regulatory expectation that cannot be agent-default within the foreseeable build-phase horizon.
- **External-counsel ratification of `[citation: TBC]` section refs** (Companies Act, Banks Act, IFRS / IAS sub-paragraphs) is a manual step routed to Imani (Legal-as-code engineer) at licence-application gate — Principle 2 citation discipline.
- **External auditor walkthrough** of the annual consolidation cycle is a future cadence step at audit-engagement (post-CAE substrate; auditor is appointed at licence-application moment per CLAUDE.md operating model).

## 9. Substrate gaps (named, not built in this PR)

Per Principle 6 substrate-gap-naming discipline. v0 substrate scaffolds without v1 engineering — gaps queued behind named owners. (Mirrors the spec partner § 5.)

1. **Per-entity ledger separation in the event store.** `entityId` field on every accounting event; per-entity ledger views as queries filtered by `entityId`. Cross-references Atlas's `LegalEntityRegistered` family on `claude/atlas-legal-entity-event-family-v0`. **Owner: Atlas + Bea — v1.**
2. **Inter-company elimination event types** (`IntraGroupTransactionMatched`, `IntraGroupBalanceEliminated` with sub-types per the elimination taxonomy, `MinorityInterestComputed`) added to `prototype/platform/event-store/event-types.ts`. **Owner: Atlas + Bea — v1.**
3. **Consolidated financial statement generator** at `prototype/platform/accounting/consolidation.ts`; statements as queries per Principle 1. **Owner: Bea — v1.**
4. **IFRS 10 / IFRS 12 + IAS 24 disclosure templates.** Generator-side; PDFs are renderings. **Owner: Bea + Camille — v1.**
5. **Vera Wave-4 `consolidation-recon`** implementing the five §6 assertions. **Owner: Vera — Wave-4.**
6. **IAS 21 multi-currency consolidation.** Anticipated at v0 (ZAR-functional v0); configuration-add when first foreign subsidiary lands per Principle 5. **Owner: Bea + Atlas — future cadence.**

## 10. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Recon-harness finding (any of the five §6 assertions fails) | `consolidation-recon` query | Bea + Camille within close-cycle SLA; sign-off blocked |
| Camille withholds sign-off (Step 8) | Sign-off event not emitted by sign-off SLA | CEO (Marc, today via Scrooge) — escalation channel per Principle 6 |
| Group composition change not reflected in scope | Atlas `LegalEntityRegistered` / `LegalEntityDeregistered` event without consolidation-scope refresh | Bea + Atlas; consolidation engine re-evaluates IFRS 10 control |
| Citation drift (`[citation: TBC]` persisting past licence-application gate) | Mira (Compliance / RegTech engineer) obligations-register query | Mira + Imani (Legal-as-code engineer); Principle 2 violation |
| BA-return parity mismatch (assertion 5) | Recon-harness finding | Bea + Camille + Eitan (Treasurer, governance) — capital / liquidity reporting consequence |

## 11. Related procedures

- `Owner Inbox/2026-05-09_bea_ifrs10-consolidation-substrate-v0.md` — substrate-spec partner.
- `Procedures/by-policy/posting-rule-publication.md` (POPULATED, Bea · Atlas) — upstream posting-rule discipline; consolidation operates on the trial balances posting-rules produce.
- `Procedures/by-policy/ecl-stage-projection-refresh.md` (POPULATED, Rohan · Bea) — IFRS 9 projections feed into the consolidated balance sheet.
- `Procedures/by-policy/capital-ratio-monitoring.md` (POPULATED, Camille · Bea) — capital-ratio monitoring at consolidated level consumes the consolidated balance sheet this procedure produces.
- `month-end-close.md` (PLANNED) — the close cycle this procedure plugs into at period-end.
- `ba-return-generation.md` (PLANNED) — BA returns at consolidated level (Step 9 downstream).

## 12. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Bea (Accounting & financial reporting engineer) | Initial scaffold — STUB. Procedure created under D-LEGAL-ENTITY-TREE-V0 (PR #82) + D-REGULATORY-PERIMETER (PR #85) to make IFRS 10 consolidation operationally executable for the Hoz Group / Hoz Bank / Hoz Securities three-entity structure. Cadence: monthly + quarterly + annual. Steps 1–9 named; six substrate gaps named for v1; Camille (CFO governance) signs at Step 8. Spec partner at `Owner Inbox/2026-05-09_bea_ifrs10-consolidation-substrate-v0.md`. |
| v0.2 | 2026-05-15 | Atlas (Core banking platform architect, engineering) | Promoted to POPULATED — status updated; all 13 sections verified complete. |

## 13. Audit / assurance

This procedure is consumed by Vera (Internal-audit / continuous-assurance engineer) under the planned Wave-4 `consolidation-recon` (substrate gap §9.5) and by the Wave-4 #10 agent-spec-integrity recon pipeline. Findings classes:

- Elimination drift (assertion 1 / 2 failure).
- Aggregation drift (assertion 3 failure).
- Per-entity ledger isolation breach (assertion 4 failure).
- Companies-Act-vs-Banks-Act parity break (assertion 5 failure).
- Citation `[citation: TBC]` persisting past licence-application gate (Principle 2 violation).
- Group-composition change without consolidation-scope refresh.

Each finding class is a reportable item under the Internal Audit Charter (post-CAE substrate; Vera carries it functionally today through Thandiwe (Chief Audit Executive, governance) until the Audit Committee is constituted).
