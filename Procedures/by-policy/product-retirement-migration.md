---
id: PROC-MK-NPA-RET-01
title: Product Retirement and Open-Position Migration
owner: Saskia · Imani · Tomas
policy-parent: D-NEW-PRODUCT-APPROVAL-POLICY
status: STUB
last-reviewed: 2026-05-10
reconciliation-cadence: per-retirement (single cycle from `ProductRetirementProposed` to `ProductRetired`)
---

# Procedure — Product Retirement and Open-Position Migration

**Procedure ID:** PROC-MK-NPA-RET-01
**Owner:** Saskia (Head of Global Markets — franchise authority) · Imani (Legal-as-code — counterparty consent flows) · Tomas (Operations — settlement / cutover execution)
**Co-actors:** Bea + Camille (accounting / capital flush) · Eitan + Ravi (FTP / liquidity flush) · Helena (risk-envelope close-out) · Mira (regulatory record retention) · Devon (operational cutover) · BRC (vote / ratification)
**Approval:** BRC primary (vote); CEO ratification (interim, until BRC constituted); CEO direct authority for emergency retirement per parent policy §9
**Cadence:** Per-retirement — single cycle from `ProductRetirementProposed` to `ProductRetired`
**Version:** v0.1 — 2026-05-10
**Status:** **STUB** — authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval; binds at first retirement

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` § 4 (lifecycle stage 8) and § 9 (retirement triggers).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| FSCA Conduct Standard 3 of 2018 §12 | Record-keeping ≥ 5 years; product remains on register at status `retired`. | Substrate retains the product entity with status `retired` indefinitely. |
| BCBS Sound Practices for the Management of Operational Risk (rev. 2021) §27 | Orderly retirement as part of new-product-approval discipline. | This procedure orchestrates the cutover and migration. |
| Banks Act 94 of 1990 + Reg 39 | Operational risk during product retirement. | Tomas-owned cutover plan + Devon attestation. |
| `ORG-CS3-001..009`, `ORG-MK-01..08`, `ORG-PR-02..19` | Markets / prudential / conduct obligations on open positions. | Open-position migration plan addresses each. |
| `ORG-AML-*`, `ORG-SAN-*` | AML / sanctions on counterparty re-papering. | Re-papering routed through Mira + Imani. |

## 3. Purpose

Operationalise stage 8 of the New Product Approval lifecycle — the orderly retirement of a live product with open positions. The procedure governs the migration / closure of open positions, the substrate flush (settlement, accounting, FTP, capital, reporting), counterparty consent flows for any required novation or close-out, and the record-retention obligation that keeps the product on the register at status `retired`.

The procedure does not author the retirement decision (that lives in policy §9 — BRC vote, regulator instruction, operational impossibility, mandate amendment, foundation amendment, or CEO emergency-retirement). It executes once the decision is made.

## 4. Trigger

- A `ProductRetirementProposed { productId, retirementAuthority, retirementReason, asOf }` event arrives, emitted by one of:
  - BRC vote (`retirementAuthority: BRC`),
  - Regulator instruction (`retirementAuthority: regulator-instruction` with regulator + instrument cited),
  - Operational impossibility (`retirementAuthority: operational-impossibility` with citation),
  - Trading-mandate amendment (`retirementAuthority: mandate-amendment`),
  - Strategic-foundation amendment (`retirementAuthority: foundation-amendment`),
  - CEO emergency direction (`retirementAuthority: CEO-emergency`; BRC ratifies at next sitting per parent policy §9).
- A PIR verdict of `retire` (downstream of [`product-post-implementation-review.md`](product-post-implementation-review.md)) auto-emits `ProductRetirementProposed` with `retirementAuthority: BRC` (PIR is the BRC's vote).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Open-position inventory. Anya + Tomas project the open positions in the product as of the proposal asOf timestamp. The inventory is the migration scope. | Anya · Tomas | `@platform/markets/product-register`, `@platform/markets/position-projection` (PLANNED) | Per Principle 1 — query over the event log. |
| 2 | Migration plan authoring. Tomas (operations) + Imani (counterparty consent) + Saskia (franchise) author the migration plan. The plan covers per-position disposition: novation, partial termination, close-out, run-off-to-maturity, in-kind transfer, or settle-and-close. | Tomas · Imani · Saskia | `@platform/markets/migration-plan` (PLANNED) | The plan is itself a typed event payload (`ProductRetirementMigrationPlanRegistered`). |
| 3 | Counterparty consent flows. Imani drives any required novation / amendment / close-out documentation through the clause library; counterparty consents are recorded as typed events on the legal-document ledger. | Imani | `@platform/legal/clause-library`, `@platform/legal/document-ledger` (PLANNED) | ECTA-compliant execution per `Owner Inbox/2026-05-07_imani_clause-library-architecture.md`. |
| 4 | Risk close-out attestation. Helena + Eitan attest that the risk envelopes (market, credit, liquidity, FTP) close-out cleanly per the migration plan; no residual exposure leaks into other products without an explicit re-attestation. | Helena · Eitan | `@platform/risk/*`, `@platform/treasury/lcr-nsfr` (PLANNED) | Cite `ORG-PR-02..19`. |
| 5 | Accounting / capital flush. Bea + Camille drive the IFRS 9 derecognition events, sub-ledger postings, and capital-RWA flush. | Bea · Camille | `@platform/accounting/posting-rules`, `@platform/capital/rwa-engine` (PLANNED) | Cite `ORG-AC-15`, `ORG-PR-02..05`. |
| 6 | Operational cutover. Tomas executes the cutover per the migration plan: novations confirmed, terminations settled, run-off positions tagged, lifecycle handlers retained for in-flight settlement of run-off. | Tomas | `@platform/operations/cutover` (PLANNED) | Per Tomas's settlement procedures; cross-cite [`outbound-payment-sponsor-bank-channel.md`](outbound-payment-sponsor-bank-channel.md) where applicable. |
| 7 | Record-retention attestation. Mira + Owen attest that the product entity remains on the Product Register with status `retired`, all events are retained ≥ 5 years per Conduct Standard 3/2018 §12, and the lawful-processing register reflects the disposition. | Mira · Owen · Iris | `@platform/markets/product-register`, `@platform/privacy/popia-register` (PLANNED) | Cite `ORG-CS3-009`, POPIA s.14 retention. |
| 8 | Emit `ProductRetired`. The substrate emits `ProductRetired { productId, retirementAuthority, retirementReason, openPositionsMigrationPlanId, asOf }` once Steps 1–7 are all attested. | Saskia | `@platform/markets/product-register` (PLANNED) | Closes the retirement event series; product status moves to `retired`. |
| 9 | Ratification (where applicable). For `retirementAuthority: CEO-emergency`, BRC ratifies at the next sitting per parent policy §9; the ratification is recorded as a typed event. | BRC | `@platform/governance/brc-vote` (PLANNED) | If BRC declines ratification, the emergency-retirement decision is reviewed; substrate cannot un-retire a product whose positions have been migrated, but BRC may direct re-introduction through a fresh NPA cycle. |

## 6. Reconciliation

- **Events produced:** `ProductRetirementProposed`, `ProductRetirementMigrationPlanRegistered`, per-position migration events (novation / termination / close-out / settle-and-close), `ProductRetired` (single, terminal).
- **Reconciliation check:** every open position present in the Step 1 inventory has a matching disposition event before `ProductRetired` fires. Any position lacking disposition is a finding; the substrate refuses to emit `ProductRetired` until the inventory is empty (or all residual positions are explicitly tagged `run-off-to-maturity` with a maturity event scheduled).
- **Failure mode:** counterparty consent declined on a novation triggers re-plan (Step 2 re-entry) — the alternative is close-out at market or run-off-to-maturity, both of which are explicit migration-plan options.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ProductRetirementProposed` / `ProductRetired` | Event log (P1) | Indefinite | Internal |
| Migration plan | `@platform/markets/migration-plan` (PLANNED); also Owner Inbox `YYYY-MM-DD_tomas-imani-saskia_retirement-migration_<productId>.md` | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal — counterparty-sensitive |
| Per-position disposition events | Event log | Indefinite | Internal |
| Counterparty consent records | `@platform/legal/document-ledger` (PLANNED) | Indefinite | Confidential — counterparty data |
| Accounting / capital derecognition events | Event log + sub-ledger | Indefinite | Internal |
| BRC ratification (where applicable) | `@platform/governance/brc-vote` (PLANNED) | Indefinite | Internal |

## 8. Manual steps

- Counterparty negotiation on novation / close-out terms involves Imani-led legal work; captured per Principle 2 with citation to the master agreement.
- BRC vote / CEO emergency direction is human governance discretion recorded as a typed event.
- Build-phase: migration plans are filed as Owner Inbox deliverables until `@platform/markets/migration-plan` lands.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Counterparty declines novation | Step 3 | Imani re-plans Step 2 (alternative: close-out at market or run-off-to-maturity); CEO informed if re-plan delays retirement materially |
| Open position lacks disposition | Step 8 reconciliation | Substrate refuses `ProductRetired` emit; Saskia + Tomas address the residual |
| Risk envelope close-out leaks residual exposure | Step 4 | Helena — re-attest after remediation; cannot proceed with `ProductRetired` until clean |
| BRC declines ratification of emergency retirement | Step 9 | Decision reviewed; CEO + BRC determine path; substrate cannot un-retire migrated positions |
| Record-retention break | Step 7 | Mira + Iris + Owen — finding routed to Vera; remediation before `ProductRetired` emit |

## 10. Related procedures

- [`new-product-due-diligence.md`](new-product-due-diligence.md) — stage 3; counterpoint at start of lifecycle.
- [`product-controlled-launch.md`](product-controlled-launch.md) — stage 5.
- [`product-post-implementation-review.md`](product-post-implementation-review.md) — stage 6; PIR `retire` verdict auto-emits `ProductRetirementProposed`.
- [`outbound-payment-sponsor-bank-channel.md`](outbound-payment-sponsor-bank-channel.md) — settlement legs of close-outs.
- [`counterparty-governing-law-clause-adoption.md`](counterparty-governing-law-clause-adoption.md) — clause-library context for Imani's consent flows.
- [`change-management.md`](change-management.md) — substrate changes during cutover.

## 11. Citations

- **[policy: D-NEW-PRODUCT-APPROVAL-POLICY]** — parent policy.
- **[register: ORG-CS3-001..009]** — Conduct Standard 3/2018 (esp. §12 record-keeping).
- **[register: ORG-MK-01..08]** — Markets.
- **[register: ORG-PR-02..19]** — Prudential.
- **[register: ORG-AC-15]** — Accounting (BCBS 239).
- **[register: ORG-AML-*, ORG-SAN-*]** — AML / sanctions [route to Mira].
- **[principle: CLAUDE.md P1, P2, P5, P6, P7]** — events as truth; atomic citation; multi-currency / -entity / -jurisdiction; single-graph; autonomous-by-default.

## 12. Substrate gaps

- `@platform/markets/product-register`, `@platform/markets/migration-plan`, `@platform/markets/position-projection`, `@platform/legal/document-ledger`, `@platform/operations/cutover`, `@platform/governance/brc-vote` are PLANNED. The procedure runs by Scrooge-coordinated cadence until Atlas + Kai + Imani + Tomas land the components per `D-PRODUCT-CONSTRUCTION-SUBSTRATE`.
- Counterparty document-ledger (Imani) is partially scaffolded; ECTA execution pathway specified per Imani's clause-library architecture but not yet wired.

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-10 | Owen (via Scrooge) | Initial draft authored alongside D-NEW-PRODUCT-APPROVAL-POLICY approval. STUB — substrate PLANNED; binds at first retirement. |

## 14. Audit / assurance

Vera consumes the retirement event series — `ProductRetirementProposed` → migration-plan → per-position disposition events → `ProductRetired` — as continuous-controls evidence. Findings: positions without disposition at retire-time, missing migration plan, retention-break against Conduct Standard 3/2018 §12, ratification absent on `CEO-emergency` retirement after the next BRC sitting. Reportable to Owen + Saskia + Imani; structural findings flow to Atlas.
