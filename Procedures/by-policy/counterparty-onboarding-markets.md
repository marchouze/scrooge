---
id: PROC-MK-CO-01
title: Counterparty Onboarding (Markets)
owner: Saskia · Imani · Zara · Eitan
policy-parent: AML/CFT Policy · Market Risk Policy · Credit Risk Policy · FAIS Compliance Policy
status: POPULATED
last-reviewed: 2026-05-13
reconciliation-cadence: per-counterparty (onboarding close); annual re-attestation
---

# Procedure — Counterparty Onboarding (Markets)

**Procedure ID:** PROC-MK-CO-01
**Owner:** Saskia (Head of Global Markets) · Imani (Legal-as-code engineer, legal) · Zara (Chief Compliance Officer, governance) · Eitan (Treasurer)
**Co-actors:** Helena (CRO, governance — credit-limit approval) · Ravi (market risk quant, engineering — exposure calculation) · Mira (compliance engineer, engineering — KYC/sanctions/CDD) · Tomas (payments and settlement engineer, engineering — settlement instructions) · Anya (data platform engineer, engineering — counterparty data) · Rohan (market risk quant, engineering — LEX headroom)
**Approval:** EXCO (standard counterparties); CRO + CCO jointly (enhanced-risk counterparties — PEP-linked, high-risk jurisdiction, or above exposure threshold)
**Cadence:** Event-triggered (per new counterparty proposal); annual re-attestation run on every `CounterpartyEnabled` entity
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **AML / CFT Policy** — `Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §1 (CDD / EDD obligations; counterparty scope).
- **Market Risk Policy** — credit-limit and exposure-management provisions.
- **Credit Risk Policy** — counterparty credit limits; pre-settlement exposure cap; LEX headroom.
- **FAIS Compliance Policy** — counterparty categorisation as Professional Client or Eligible Counterparty under FAIS.
- **New Product Approval Policy v1.0** — §3 (counterparty eligibility matrix cross-referenced at product onboarding).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-FC-02` | Apply CDD to all clients / counterparties before establishing a business relationship (FIC Act s.21). | Gate 1 (KYC/CDD) in this procedure; full CDD package required before `CounterpartyEnabled`. |
| `ORG-FC-05` | Apply EDD for higher-risk counterparties (FIC Act s.21G). | Gate 1 EDD branch — triggered on high-risk-jurisdiction flag, PEP-linkage, or unusual source-of-funds. |
| `ORG-CS3-001` | Written trading-relationship agreement (ISDA Master + ZA Schedule + CSA) before any OTC derivative transaction (FSCA Conduct Standard 3/2018 §5). | Gate 2 (legal documentation) — ISDA Master + Schedule + CSA must be signed before `CounterpartyEnabled` for OTC products. |
| `ORG-CS3-005` | Client / counterparty categorisation and due diligence pre-trade (FSCA Conduct Standard 3/2018 §7). | Gate 3 (counterparty categorisation) — Professional Client or Eligible Counterparty classification required; documented rationale recorded as `CounterpartyClassified`. |
| `ORG-FAIS-RK-SUITABILITY` | Suitability assessment for each advice or intermediary-service interaction. | Gate 3 — where the bank acts as FSP (FAIS-licensed), suitability is assessed against the counterparty's classification; recorded per `fais-advice-record-capture.md`. |
| FIC Act s.21B (via `ORG-FC-02`) | Account-opening and ongoing monitoring — counterparties may not be onboarded if CDD cannot be completed. | Gate 1 fail-closed rule — if CDD cannot be completed, onboarding is blocked; `CounterpartyOnboardingFailed` emitted. |
| Banks Act Reg 39 / `ORG-PR-16` | Counterparty credit exposure limits pre-trade. | Gate 4 — credit limit approved by Helena before `CounterpartyEnabled`; configured as hard system limit in risk engine. |
| SARB Joint Standard 2 of 2020 (via margin obligations) | Initial margin and variation margin documentation for in-scope OTC counterparties. | Gate 7 — if in-scope for JS 2/2020, margin agreement documented per `margin-im.md` / `margin-vm.md` before `CounterpartyEnabled` for margin-required products. |

## 3. Purpose

Enable Hoz Bank Limited to trade OTC derivatives (ISDA-documented), repos / reverse-repos (GMRA-documented), and secondary-market bonds and equities with an institutional counterparty in compliance with FIC Act CDD obligations, FSCA Conduct Standard 3/2018 counterparty-categorisation requirements, credit-limit governance, and legal-documentation standards. The procedure is the seven-gate sequential check that culminates in `CounterpartyEnabled` — the typed event that unlocks the counterparty for trading in explicitly named product types.

Scope: SA banks, foreign banks, asset managers, pension funds, insurance companies, corporates, government entities, and multilateral institutions. Not retail client onboarding (Niko's domain, `kyc-onboarding.md`).

No trade may be executed with a counterparty before `CounterpartyEnabled` exists in the event store. This is a CI-enforced invariant (see §6).

## 4. Trigger

- A business request arrives from Saskia or a trader: a new institutional counterparty is needed for trading.
- `CounterpartyOnboardingInitiated { counterpartyId, counterpartyName, legalEntityIdentifier, requestedProductTypes: [...], requestingTrader, proposedCreditLimit, initiatedBy: 'saskia' }` is emitted to open the onboarding run.
- Annual re-attestation: on each anniversary of `CounterpartyEnabled`, the system emits `CounterpartyReattestationDue { counterpartyId }`; this triggers a re-run of Gates 1, 3, and 5 (KYC refresh, re-categorisation, and collateral-eligibility review); the credit limit is reviewed by Helena; Gates 2 and 6 are re-checked for continued enforceability and accuracy.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Initiate onboarding. Emit `CounterpartyOnboardingInitiated`. Route onboarding package to all gate owners simultaneously (Gates 1–3 can run in parallel; Gates 4–7 depend on Gate 1 completing). | Saskia | `@platform/markets/counterparty-register` (PLANNED) | `legalEntityIdentifier` must be a valid LEI where the counterparty is in-scope for LEI requirements (all OTC derivative counterparties per Conduct Standard 3/2018). |
| 2 | **Gate 1 — KYC / CDD.** Entity verification: obtain certificate of incorporation (CIPC for SA entities, equivalent for foreign), constitutional documents, proof of registered address. Walk UBO chain to ≥ 25% ownership threshold; identify all controlling parties. Perform sanctions + PEP screen for entity and all UBOs (cross-reference `sanctions-screening.md`). Where higher-risk-jurisdiction flag or PEP-linkage: apply EDD (source of funds, nature of business, enhanced sanctions diligence). | Mira (engineering) · Zara (governance sign-off) | `@platform/compliance/kyc-engine` (PLANNED) · `@platform/screening/api` (PLANNED) | CDD document set: CIPC certificate / foreign equivalent; board resolution or equivalent authority; FICA questionnaire. EDD triggers: FATF high-risk jurisdiction, PEP in UBO chain, complex ownership structure > 4 layers. Cite `ORG-FC-02`, `ORG-FC-05`. |
| 3 | Gate 1 outcome. If CDD complete with no sanctions hits: emit `KYCGatePassed { counterpartyId, cddLevel: standard | enhanced, evidenceRef }`. If sanctions hit confirmed true-positive: emit `CounterpartyOnboardingFailed { counterpartyId, gate: 'kyc', reason: 'sanctions-hit', citationChain }` and halt — no further gates proceed. | Mira | `@platform/event-store` ✓ | A false-positive match is resolved per `sanctions-screening.md` Step 7 before Gate 1 can pass. |
| 4 | **Gate 2 — Legal documentation.** For OTC derivative products: negotiate and execute ISDA 2002 Master Agreement + ZA Schedule; negotiate CSA (ISDA NY Law CSA or English Law CSA for collateralised trades). For repo / reverse-repo: GMRA 2011 + SA Annex. For bond / equity secondary market: no bespoke master agreement unless specifically required. Imani owns the clause library; each agreement type references the approved clause-set from `@platform/legal/clause-library`. | Imani · Saskia | `@platform/legal/clause-library` (PLANNED) | ISDA negotiation SLA: 20 business days from Gate 1 pass. If counterparty insists on non-standard clauses outside the approved clause library, Imani escalates to Helena and Zara before any deviation is agreed. Cite `ORG-CS3-001`, `ORG-MK-06`. |
| 5 | Gate 2 outcome. On execution of each required agreement: emit `LegalDocumentationSigned { counterpartyId, agreementType: 'isda' | 'csa' | 'gmra' | 'gmra-sa-annex', executionDate, documentRef, clauseLibraryVersion }`. Gate 2 passes when all agreements required for the requested product types are executed. | Imani | `@platform/event-store` ✓ | `documentRef` is the BLAKE3 content hash of the executed agreement stored in the document store. |
| 6 | **Gate 3 — Counterparty categorisation (FAIS / FSCA).** Classify the counterparty as Professional Client or Eligible Counterparty under FAIS (Determination under s.1 read with s.8 of FAIS Act) and FSCA Conduct Standard 3 of 2018 §7. Document the classification rationale (financial resources threshold, regulatory authorisation status, or eligible-counterparty criteria). | Zara · Saskia | `@platform/conduct/fais-treatment` (PLANNED) | Classification determines: (a) which product types may be offered; (b) whether suitability assessment is required per interaction; (c) disclosure obligations. Eligible Counterparty classification requires FSCA authorisation as a Category I–IV FSP, registered bank, insurer, or similar regulated entity. Cite `ORG-CS3-005`, `ORG-FAIS-RK-SUITABILITY`. |
| 7 | Gate 3 outcome. Emit `CounterpartyClassified { counterpartyId, category: 'professional-client' | 'eligible-counterparty', basisCode, reviewDate }`. `reviewDate` defaults to 12 months; classification must be re-confirmed annually or on material change. | Zara | `@platform/event-store` ✓ | If the counterparty cannot be classified as Professional Client or Eligible Counterparty for any requested product type, that product type is excluded from the `CounterpartyEnabled` scope. |
| 8 | **Gate 4 — Credit limit approval.** Helena (CRO) reviews: pre-settlement exposure calculation at proposed book size (Rohan runs SA-CCR or simplified approach as applicable); Large Exposure (LEX) headroom check (Banks Act Reg 39 — 25% Tier 1 cap for single counterparty); single-counterparty concentration against approved concentration limits in Market Risk Policy. Helena approves a credit limit (notional cap + pre-settlement exposure cap). | Helena · Rohan | `@platform/risk/credit-limit-engine` | Cite `ORG-PR-09`, `ORG-PR-16`. If proposed credit limit would breach LEX: Camille and Helena escalate to EXCO before proceeding. Enhanced-risk counterparties require joint CRO + CCO approval. |
| 9 | Gate 4 outcome. Emit `CreditLimitApproved { counterpartyId, notionalCap, preSettlementExposureCap, lexHeadroomUsed, approvedBy: 'helena', approvalDate }`. Atlas configures the approved limit as a hard system limit in the risk engine before Gate 7 is cleared. | Helena | `@platform/event-store` ✓ · `@platform/risk/credit-limit-engine` | If Helena withholds credit approval: emit `CounterpartyOnboardingFailed { gate: 'credit-limit', reason }` and halt. |
| 10 | **Gate 5 — Collateral eligibility (where applicable).** Where a CSA or GMRA covers the product types: agree eligible collateral schedule (CSA Paragraph 13 for ISDA CSA; Schedule to GMRA for repo). Eitan and Ravi agree the eligibility matrix with the counterparty; configure in the collateral management system. | Eitan · Ravi · Imani | `@platform/treasury/collateral-mgmt` (PLANNED) | Eligible collateral defaults to the bank's approved schedules; counterparty-specific deviations require Imani sign-off. Not required for uncollateralised product types or plain vanilla bond / equity secondary market trades. |
| 11 | Gate 5 outcome (where applicable). Emit `CollateralEligibilityAgreed { counterpartyId, eligibleCollateralScheduleRef, agreementType, configuredDate }`. | Eitan | `@platform/event-store` ✓ | Where Gate 5 is not applicable (no CSA / no GMRA), emit `CollateralGateNotApplicable { counterpartyId, reason }`. |
| 12 | **Gate 6 — Settlement instructions.** Tomas collects and validates: SWIFT BIC, Strate participant code (for JSE-settled instruments), IBAN / bank account details (for cash legs), correspondent bank details where applicable. Validates each instruction by cross-referencing with Strate / SWIFT directories. | Tomas · Anya | `@platform/settlement/instruction-store` (PLANNED) | Settlement instructions are the counterparty's authoritative standing instructions; used for all trade settlement without per-trade confirmation unless the counterparty specifies otherwise. Cite outbound payment procedure cross-reference: `outbound-payment-sponsor-bank-channel.md`. |
| 13 | Gate 6 outcome. Emit `SettlementInstructionsValidated { counterpartyId, swiftBic, strateParticipantCode, settlementAccountRef, validatedDate }`. | Tomas | `@platform/event-store` ✓ | All settlement instructions are stored in the instruction store; the `settlementAccountRef` is the content-addressed handle. |
| 14 | **Gate 7 — Margin agreement (where applicable).** Determine if the counterparty is in-scope for SARB Joint Standard 2 of 2020 margin requirements (initial margin and/or variation margin). If in-scope: confirm IM documentation per `margin-im.md`; confirm VM documentation per `margin-vm.md`. Configure margin call workflow in the collateral management system. | Imani · Eitan · Ravi | `@platform/treasury/collateral-mgmt` (PLANNED) | Scope determination: average aggregate notional > ZAR equivalent threshold per JS 2/2020 schedule. Where in-scope, IM agreement must be executed before any in-scope trade. |
| 15 | Gate 7 outcome (where applicable). Emit `MarginAgreementConfirmed { counterpartyId, marginType: 'im' | 'vm' | 'both', documentRef, scopeDetermination }`. Where not in-scope: emit `MarginGateNotApplicable { counterpartyId, reason }`. | Imani | `@platform/event-store` ✓ | Scope determination is reviewed annually as aggregate notional changes. |
| 16 | Aggregate all gate outcomes. Verify all required gates have passed (Gate 1 mandatory; Gate 2 mandatory for OTC/repo product types; Gate 3 mandatory; Gate 4 mandatory; Gates 5, 6, 7 mandatory where applicable). If any mandatory gate has not passed or has emitted `CounterpartyOnboardingFailed`: halt; onboarding remains blocked. If all required gates have passed: proceed to Step 17. | system · Saskia | `@platform/markets/counterparty-register` (PLANNED) | The aggregation is deterministic: gate-pass events are counted; the substrate checks the required set against the requested product types. |
| 17 | **Enable counterparty.** Emit `CounterpartyEnabled { counterpartyId, enabledProductTypes: [...], enabledDate, creditLimitRef, legalDocumentationRef, classificationRef }`. The counterparty is now cleared for trading in the named product types only. Product types not covered by the completed gates remain disabled. | Saskia | `@platform/markets/counterparty-register` (PLANNED) | `CounterpartyEnabled` is the gate event. The risk engine, trade capture system, and settlement system all check for this event before accepting a trade instruction referencing this counterparty. |
| 18 | Schedule annual re-attestation. Emit `CounterpartyReattestationScheduled { counterpartyId, reattestationDate }`. Notify Mira (KYC refresh), Zara (re-categorisation), Helena (credit limit review). | system | `@platform/markets/counterparty-register` (PLANNED) | Re-attestation default: 12 months from `CounterpartyEnabled`. High-risk counterparties (EDD-flagged): 6 months. |

## 6. Reconciliation

- **Events produced per onboarding run:**
  - `CounterpartyOnboardingInitiated { counterpartyId, requestedProductTypes }` — one per onboarding.
  - `KYCGatePassed { counterpartyId, cddLevel }` or `CounterpartyOnboardingFailed { gate: 'kyc', ... }`.
  - Per completed gate: `LegalDocumentationSigned`, `CounterpartyClassified`, `CreditLimitApproved`, `CollateralEligibilityAgreed` (or not-applicable), `SettlementInstructionsValidated`, `MarginAgreementConfirmed` (or not-applicable).
  - Exactly one of: `CounterpartyEnabled { counterpartyId, enabledProductTypes }` | `CounterpartyOnboardingFailed { gate, reason }` — per completed run.
  - `CounterpartyReattestationScheduled { counterpartyId, reattestationDate }` — on successful enablement.

- **Reconciliation invariants:**
  1. **No `TradeExecuted` event may reference a `counterpartyId` without a preceding `CounterpartyEnabled` event for that counterparty.** This is the primary counterparty-gate invariant; Vera enforces it continuously via `@platform/recon/counterparty-gate-invariant`.
  2. Every `CounterpartyEnabled` must be preceded by `KYCGatePassed`, `CounterpartyClassified`, and `CreditLimitApproved` (all mandatory) plus the applicable subset of Gates 2, 5, 6, 7.
  3. Every `TradeExecuted` referencing an OTC derivative product must be preceded by `LegalDocumentationSigned { agreementType: 'isda' }` for the same `counterpartyId`.
  4. Every `TradeExecuted` referencing a collateralised product must be preceded by `CollateralEligibilityAgreed` or `CollateralGateNotApplicable` for the same `counterpartyId`.
  5. Every counterparty enabled for > 12 months without a re-attestation `KYCGatePassed` refreshing the CDD is a Vera finding; EDD-flagged counterparties must re-attest within 6 months.

- **Failure mode:** if the counterparty-register substrate is unavailable, `CounterpartyEnabled` cannot be emitted; no trading in new counterparties may proceed. Fail-closed.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CounterpartyOnboardingInitiated` | Event log (P1) | Indefinite | Internal |
| KYC / CDD document set (CIPC certificate, constitutional docs, FICA questionnaire, UBO chain) | Document store (BLAKE3-addressed) + event log | ≥ 5 years post-relationship close (FIC Act s.22) | High (PII + commercial) |
| Sanctions-screen events (`ScreeningPerformed`, `ScreeningHit`) | Event log | Permanent | High |
| `LegalDocumentationSigned` + executed agreement | Event log + document store | ≥ 5 years post-agreement termination (Conduct Standard 3/2018 §12) | Confidential |
| `CounterpartyClassified` | Event log | Indefinite | Internal |
| `CreditLimitApproved` | Event log | Indefinite | Internal |
| `CollateralEligibilityAgreed` | Event log + collateral mgmt config | Duration of relationship + 5 years | Internal |
| `SettlementInstructionsValidated` | Event log + instruction store | Duration of relationship + 5 years | High |
| `MarginAgreementConfirmed` + margin agreement doc | Event log + document store | ≥ 5 years post-relationship close | Confidential |
| `CounterpartyEnabled` | Event log (P1) | Indefinite | Internal |
| Annual re-attestation events | Event log | Indefinite | Internal |

## 8. Manual steps

- **Gate 1 (KYC/CDD):** entity verification and UBO walking are conducted by Mira (engineering) with Zara providing governance sign-off. EDD analysis (source of funds, nature of business review for high-risk counterparties) is human-led; output is recorded as a typed attestation event.
- **Gate 2 (legal documentation):** ISDA / GMRA negotiation is Imani-led. Non-standard clause deviations require human sign-off by Helena and Zara before agreement. The executed document is stored in the document store; the event references the document hash.
- **Gate 3 (categorisation):** Zara makes the classification judgement on the Eligible Counterparty / Professional Client boundary; the rationale is recorded as a `CounterpartyClassified` event with `basisCode` citing the applicable FAIS determination provision.
- **Gate 4 (credit limit):** Helena's credit-limit decision is human judgement, informed by Rohan's SA-CCR calculation. The decision is recorded as `CreditLimitApproved`.
- **Annual re-attestation:** Gates 1, 3, and 5 re-runs are human-led; the system emits `CounterpartyReattestationDue` and routes to Mira and Zara; their re-attestation events close the re-attestation cycle.
- **Build-phase:** counterparty-register and gate substrates are PLANNED; onboarding is operated by Scrooge-coordinated runs against this procedure spec until the substrate components land.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| `TradeExecuted` without preceding `CounterpartyEnabled` | Vera continuous recon (`@platform/recon/counterparty-gate-invariant`) | Auto-halt of the trade execution path; Saskia + Helena + Zara immediately; incident raised under `incident-response.md` |
| Gate 1 sanctions hit (true positive) | `ScreeningHit { action: BLOCK }` | Zara (MLRO) immediately; onboarding blocked; assess STR filing obligation per `str-filing.md` |
| KYC/CDD cannot be completed (counterparty refuses documentation) | Mira unable to pass Gate 1 within 30-day SLA | Zara decision to abort; `CounterpartyOnboardingFailed { reason: 'cdd-incomplete' }` |
| ISDA negotiation stalled beyond SLA (20 business days) | Gate 2 SLA monitor | Imani escalates to Saskia + Helena; if impasse, Saskia decides whether to proceed without OTC products |
| Helena withholds credit limit | Gate 4 fail event | Saskia may propose lower notional scope and resubmit; BRC informed if impasse |
| Re-attestation overdue | `CounterpartyReattestationDue` with no `KYCGatePassed` within SLA | Mira + Zara immediately; if not cured within 5 business days, `CounterpartyEnabled` is suspended pending re-attestation |
| Settlement instruction invalid (SWIFT BIC / Strate code mismatch) | Gate 6 validation failure | Tomas routes to counterparty operations team; instruction must be corrected before enablement |
| Counterparty-register substrate unavailable | Health check | Atlas + Devon; fail-closed; no new counterparty enablements until restored |

## 10. Related procedures

- [`kyc-onboarding.md`](kyc-onboarding.md) — standard retail/SME onboarding (Gate 1 of this procedure borrows the CDD framework; institutional scope applies here).
- [`sanctions-screening.md`](sanctions-screening.md) — called inline at Gate 1, Step 2.
- [`kyc-recurring.md`](kyc-recurring.md) — annual re-attestation cycle (the re-attestation trigger here re-runs the equivalent of kyc-recurring steps for institutional counterparties).
- [`margin-im.md`](margin-im.md) · [`margin-vm.md`](margin-vm.md) — called at Gate 7.
- [`market-risk-monitoring.md`](market-risk-monitoring.md) — credit limit set here feeds live limit monitoring.
- [`npa-gate.md`](npa-gate.md) — product approval gate; products must be approved before a counterparty can be enabled for them.
- [`counterparty-institutional-eligibility-screening.md`](counterparty-institutional-eligibility-screening.md) — pre-screen for institutional eligibility before initiating this onboarding procedure.
- [`client-categorisation.md`](client-categorisation.md) — detailed FSCA categorisation procedure; Gate 3 here applies the output of that procedure.
- [`outbound-payment-sponsor-bank-channel.md`](outbound-payment-sponsor-bank-channel.md) — settlement instructions from Gate 6 feed this procedure's payment routing.

## 11. Citations

- **[policy: AML/CFT Policy]** — CDD / EDD obligations.
- **[policy: Market Risk Policy]** — counterparty credit limits.
- **[policy: Credit Risk Policy]** — LEX headroom; SA-CCR approach.
- **[policy: FAIS Compliance Policy]** — counterparty categorisation.
- **[register: ORG-FC-02, ORG-FC-05]** — FIC Act CDD / EDD obligations.
- **[register: ORG-CS3-001, ORG-CS3-005]** — Conduct Standard 3/2018.
- **[register: ORG-FAIS-RK-SUITABILITY]** — FAIS suitability.
- **[register: ORG-PR-09, ORG-PR-16]** — Prudential credit / LEX.
- **[register: ORG-MK-06]** — Markets legal-documentation obligation.
- **[principle: CLAUDE.md P1]** — `CounterpartyEnabled` is the gate event; event log is the only source of truth.
- **[principle: CLAUDE.md P2]** — single-graph discipline; each gate step cites the regulation that mandates it.
- **[principle: CLAUDE.md P6]** — autonomous-by-default; gate aggregation and scheduling are system-driven.

## 12. Substrate gaps

- `@platform/markets/counterparty-register` (onboarding orchestration, gate aggregation, enablement) — PLANNED; operated by Scrooge-coordinated run until Eitan + Atlas land the substrate.
- `@platform/compliance/kyc-engine` (Gate 1 entity verification) — PLANNED; cross-links to `kyc-onboarding.md` substrate.
- `@platform/conduct/fais-treatment` (Gate 3 categorisation) — PLANNED.
- `@platform/risk/credit-limit-engine` (credit limit configuration at Gate 4) — LIVE; pre-deal headroom check, breach detection, LEX cap check. Shared with `npa-gate.md`.
- `@platform/treasury/collateral-mgmt` (Gates 5 and 7) — PLANNED.
- `@platform/settlement/instruction-store` (Gate 6) — PLANNED; cross-links to `outbound-payment-sponsor-bank-channel.md`.
- `@platform/recon/counterparty-gate-invariant` (Vera CI invariant) — PLANNED; the `TradeExecuted`-without-enabled invariant is the highest-priority recon harness for the markets counterparty domain.

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Saskia · Imani · Zara · Eitan (via Scrooge) | Initial STUB. Covers seven-gate onboarding sequence for institutional OTC / repo / secondary-market counterparties. |
| v0.2 | 2026-05-15 | Saskia (Head of Global Markets) · Imani (Legal-as-code engineer, legal) · Zara (Chief Compliance Officer, governance) · Eitan (Treasurer) | Promoted to POPULATED; owner titles updated; version bumped. |

## 14. Audit / assurance

Vera continuously monitors the `CounterpartyOnboardingInitiated` → `CounterpartyEnabled` event chain and the `TradeExecuted`-counterparty-gate invariant. Re-attestation SLA tracking is a standing Vera check: counterparties > 12 months (or > 6 months for EDD-flagged) since last `KYCGatePassed` are reported to Zara + Owen monthly. Critical findings (trade without enabled counterparty) flow to BRC chair immediately.
