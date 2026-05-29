---
policy-parent: Client Categorisation Policy (planned) · Conduct of Business / TCF Policy (planned)
last-reviewed: 2026-05-16
procedureId: PROC-MK-ODP-08
title: Client / counterparty categorisation (OTC derivative scope)
author: Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer)
date: 2026-05-16
owner: Zara (Chief Compliance Officer, governance) · Niko (CRM engineer — build-phase paused; activates at licence-day)
status: POPULATED
policy-cited: Client Categorisation Policy (planned) · Conduct of Business / TCF Policy (planned)
system-capability: "@conduct/categorisation · @conduct/suitability (PLANNED)"
---

# Procedure — Client / counterparty categorisation (OTC derivative scope)

**Procedure ID:** PROC-MK-ODP-08
**Owner:** Zara (Chief Compliance Officer, governance) · Niko (CRM engineer — build-phase paused; activates at licence-day)
**Approval:** BRC (under Conduct Policy)
**Cadence:** Per-counterparty at onboarding; annual review; review on material change
**Version:** v0.2 — 2026-05-16
**Status:** POPULATED

## 1. Source policy

- Client Categorisation Policy (planned; Zara is the policy owner; to be authored before the FSP-licence application gate).
- Conduct of Business / TCF Policy (planned; Zara co-owns with Mira).
- FAIS General Code of Conduct for Authorised FSPs and Representatives — categorisation rules for FSP-licensed activities.
- CS 1/2018 (Conduct Standard for Banks) — counterparty-eligibility and categorisation requirements for derivative transactions.

The obligation chain:

```
Regulation (FAIS General Code s.2 + CS 1/2018 §3 + FMA s.1 definitions)
  → Client Categorisation Policy (planned)
    → PROC-MK-ODP-08 (this procedure)
      → @conduct/categorisation · @conduct/suitability (PLANNED)
        → Party register (prototype/platform/party/)
```

**Build-phase posture:** Niko's (CRM engineer) lead-to-client lifecycle is paused during the build phase per the AI-driven-bank reframe (no real clients during build). The substrate is built now; live categorisation events fire at licence-day. Soft-franchise track counterparty negotiations (Saskia + Imani) use this procedure's framework in table-top rehearsals but do not emit production `CounterpartyCategorised` events until licence-day.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CS3-005` (CS 3/2018 §7) | Client / counterparty categorisation policy and due-diligence checks must be in place and documented before any OTC derivative transaction is executed with a new counterparty. |
| `ORG-CS1-001` (CS 1/2018 §3) | Counterparty eligibility requirements for derivative transactions; fit-and-proper equivalents for Eligible Counterparty classification. |
| `ORG-CD-03` (FAIS Act — General Code of Conduct s.2) | FSP must categorise clients as retail, professional, or eligible counterparty before providing any financial service; categorisation determines applicable conduct protections. |
| `ORG-MK-06` (Financial Markets Act 19 of 2012 — definitions) | FMA s.1 definitions for "client" and "professional investor"; OTC derivative market participants are classified under this framework. |
| `ORG-GV-03` (Banks Act s.60B — conduct of business) | Banks must apply fair-conduct principles in dealing with clients; categorisation is the gateway to the appropriate conduct-protection regime. |
| `ORG-CD-04` (POPIA — s.11 lawful basis for processing) | Counterparty personal information collected during categorisation must be processed on a lawful basis; legitimate interest or contractual necessity applies. |

## 3. Purpose

1. Classify each prospective OTC IRD counterparty as one of: Eligible Counterparty (EC), Professional Client (PC), or Retail Client (RC) — based on FAIS General Code + CS 1/2018 §3 criteria.
2. Apply the conduct-protection regime appropriate to the category before any trade is executed (EC: lightest touch; PC: suitability assessment required; RC: full appropriateness and suitability, plus the bank's institutional-only model means RC must be declined).
3. Record the categorisation in the Party register with an immutable typed event so that the OTC pre-trade gateway (Kai's `@trading/pre-trade-gate`) can enforce the trade-eligibility check.
4. Maintain an annual review cycle so that categorisation remains current; re-categorise on material change.
5. Ensure the bank's institutional-only model is enforced — no retail clients — via a hard gate in the categorisation workflow.

## 4. Trigger

- **Primary (onboarding):** `CounterpartyOnboardingInitiated { counterpartyId, entityType, jurisdiction }` — emitted by the counterparty onboarding workflow (PROC-MK-ODP-02); categorisation is a mandatory gate in the onboarding flow.
- **Annual review:** `AnnualCategoryReviewDue { counterpartyId, lastCategorised }` — emitted by the annual review scheduler for every counterparty with an active relationship.
- **Material change trigger:** `CounterpartyMaterialChangeNotified { counterpartyId, changeType }` — emitted when Niko's (CRM engineer) lifecycle detects a material change (e.g., credit-rating downgrade, ownership change, FSCA authorisation lapse, insolvency event) that may affect category eligibility.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | On `CounterpartyOnboardingInitiated`: retrieve counterparty entity profile from the Party register (legal name, LEI, entity type, jurisdiction, FSCA / PA registration status, SARB authorisation if applicable, AUM / net assets if available) | `system` | `@crm/counterparty` (PLANNED) + `prototype/platform/party/` | Entity profile is populated during the KYC step (kyc-onboarding.md); categorisation reads from the same record. |
| 2 | **Eligible Counterparty (EC) eligibility screen.** Mira (regulatory intelligence engineer) runs the EC eligibility screen: is the counterparty a regulated financial institution (bank, insurance, asset manager, pension fund, securities firm), a large corporate (net assets > FAIS threshold), a government body, or a multi-lateral development bank? Apply the FAIS General Code + CS 1/2018 §3 EC definition | `agent` (Mira) | `@conduct/categorisation` (PLANNED) | EC is the expected category for all counterparties given the bank's institutional-only mandate. Counterparties that fail EC must be classified as PC or RC (see step 4). |
| 3 | **EC confirmation.** If EC criteria met: Zara (Chief Compliance Officer, governance) reviews and confirms the EC classification; the basis (regulatory status / financials / MDB status) is documented | `agent` (Mira) + `human` (Zara — governance sign-off) | `@conduct/categorisation` (PLANNED) | Zara's confirmation is a typed governance event. For large-corporate EC classifications, the financial-threshold evidence (net assets, AUM) must be in the document store. |
| 4 | **Professional Client (PC) and Retail Client (RC) pathway.** If counterparty does not meet EC criteria: Mira applies the FAIS General Code Professional Client test (financial sophistication, investment experience, AUM thresholds); if PC criteria met → proceed to step 5; if RC → hard decline per step 6 | `agent` (Mira) | `@conduct/categorisation` (PLANNED) | The bank's institutional-only model means RC is a hard decline at this step. PC categorisation requires a suitability assessment at step 5 before any trade. |
| 5 | **PC suitability and appropriateness assessment.** For PC counterparties (not expected in normal operations): Mira (regulatory intelligence engineer) + Zara (Chief Compliance Officer, governance) run a suitability and appropriateness assessment per FAIS General Code s.8: investment objectives, financial situation, risk tolerance, knowledge and experience with OTC IRD products | `agent` (Mira + Zara) | `@conduct/suitability` (PLANNED) | PC suitability must be re-run annually and on material change. Any trade with a PC counterparty requires pre-trade suitability check gating. |
| 6 | **Retail Client hard decline.** If RC criteria apply: Mira emits `CounterpartyDeclined { counterpartyId, reason: 'RetailClient_InstitutionalOnlyBank' }`; Saskia (Head of Global Markets, governance) is notified; no OTC IRD transactions permitted | `agent` (Mira) | `@conduct/categorisation` (PLANNED) | RC is a hard stop. The bank's licence (when issued) will restrict it to institutional counterparties; any RC request must be referred to Zara and Saskia for a relationship-level decision. |
| 7 | **Party register update.** Emit `CounterpartyCategorised { partyId, category: 'EC' | 'PC', basis, validUntil, categorisedBy, categorisedAt }` and write the category into the Party register record | `system` | `@platform/event-store` + `prototype/platform/party/` | `validUntil` is set to the next annual review date. The category is the gate variable checked by Kai's `@trading/pre-trade-gate`. |
| 8 | **Pre-trade gate activation.** Notify Kai's (trading systems engineer) pre-trade gateway that the counterparty's category is now confirmed; configure gate to enforce: EC → all OTC IRD products permitted per OTC Trading Policy; PC → suitability check required per trade; RC or uncategorised → block | `system` | `@trading/pre-trade-gate` (PLANNED) | The gate reads the latest `CounterpartyCategorised` event from the event store; an expired event (past `validUntil`) is treated as uncategorised and blocks trading. |
| 9 | **Annual review.** On `AnnualCategoryReviewDue { counterpartyId }`: Mira repeats steps 2–3 (or 2–5 for PC); if category unchanged: emit `CounterpartyCategoryReaffirmed { partyId, category, reaffirmedAt, validUntil }`; if category changes: repeat full workflow from step 2 | `agent` (Mira + Zara) | `@conduct/categorisation` (PLANNED) | Annual review must complete before `validUntil`; if the review is not completed by `validUntil`, the pre-trade gate automatically blocks trading with the counterparty. |
| 10 | **Material change re-review.** On `CounterpartyMaterialChangeNotified { counterpartyId, changeType }`: Mira assesses whether the change affects EC / PC eligibility; if yes, repeats steps 2–7 immediately; if no material impact, emits `CategoryMaterialChangeAssessed { partyId, changeType, categoryImpact: false }` | `agent` (Mira) | `@conduct/categorisation` (PLANNED) | Material changes include: regulatory authorisation lapse, credit-rating downgrade to below investment grade, insolvency proceedings, ownership change affecting regulatory status. |

## 6. Reconciliation

- **Events produced:**
  - `CounterpartyCategorised { partyId, category, basis, validUntil, categorisedBy, categorisedAt }`
  - `CounterpartyCategoryReaffirmed { partyId, category, reaffirmedAt, validUntil }` — on annual reaffirmation
  - `CounterpartyDeclined { counterpartyId, reason }` — on RC hard decline
  - `CategoryMaterialChangeAssessed { partyId, changeType, categoryImpact }` — on material-change assessment
- **Reconciliation checks (Vera asserts):**
  - Every counterparty with an active OTC trading relationship has a current `CounterpartyCategorised` or `CounterpartyCategoryReaffirmed` event (not past `validUntil`).
  - Every `CounterpartyOnboardingInitiated` has a downstream `CounterpartyCategorised` or `CounterpartyDeclined` before the first `OtcTradeExecuted` for that counterparty.
  - No `OtcTradeExecuted` events exist for counterparties with expired or missing categorisation events.
  - Every `AnnualCategoryReviewDue` has a downstream `CounterpartyCategoryReaffirmed` or re-categorisation event within 30 calendar days.
- **Failure mode:** `@conduct/categorisation` unavailable → Mira and Zara run the categorisation workflow manually using the documented EC / PC criteria; the result is entered into the Party register manually and a `ManualCategorizationFlag { counterpartyId, reason }` event is emitted.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `CounterpartyCategorised` and review events | Event log (`@platform/event-store`) | Permanent (Principle 1) | Confidential — counterparty commercial + PII |
| EC basis evidence (financial statements, regulatory registration certificates) | Document store (BLAKE3-addressed, referenced by event) | 7 years | Confidential |
| PC suitability assessment records | Document store | 7 years (FAIS records requirement) | Confidential — PII |
| Annual review records | Document store + Party register projection | 7 years | Confidential |
| `CounterpartyDeclined` records | Event log + Party register | Permanent | Restricted |

## 8. Manual steps

1. **EC financial-threshold assessment (step 2):** Where EC classification is based on net assets / AUM (large corporate EC), Mira must obtain and verify financial statements; this is a semi-automated step until a financial-data feed is integrated.
2. **Regulatory registration verification (step 2):** Cross-checking counterparty regulatory status (FSCA authorisation, PA registration, foreign equivalent) currently requires manual query against regulator registers; Mira does this manually until the `@compliance/regulator-register-feed` is built.
3. **PC suitability assessment (step 5):** The suitability questionnaire is a structured form completed by Niko (CRM engineer — build-phase paused) at licence-day; Zara reviews the responses; not fully automatable.
4. **Zara's governance sign-off (step 3):** Human governance approval step; Zara's review of EC basis is irreducibly a judgment call.
5. **Annual review (step 9):** Where counterparty has not proactively updated its profile, Mira must actively chase the counterparty for updated evidence; this is a manual step.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| OTC trade attempted for uncategorised counterparty | Pre-trade gate blocks; `TradeBlocedUncategorised` event | Kai + Tomas; Mira initiates emergency categorisation; no trade until complete |
| Categorisation expired; counterparty fails to provide updated evidence within 30 days | Vera invariant: `CounterpartyCategorised.validUntil` past without reaffirmation | Mira + Zara; trading suspended for that counterparty until renewed |
| Material change results in EC eligibility loss | `CounterpartyMaterialChangeNotified` triggers re-review; category downgrade to PC | Zara + Saskia; PC suitability required on all new trades; existing trades assessed for impact |
| RC classification identified post-onboarding | `CounterpartyCategorised.category: 'RC'` emitted after trading relationship started | Zara + Helena immediately; trading suspended; existing positions assessed |
| Annual review backlog > 30 days past `validUntil` | Vera monthly sweep | Zara; trading suspended for overdue counterparties; Saskia informed |

## 10. Related procedures

- [`counterparty-onboarding-markets.md`](counterparty-onboarding-markets.md) (PROC-MK-ODP-02) — categorisation is a mandatory gate within the onboarding flow; the Party register is populated here.
- [`counterparty-institutional-eligibility-screening.md`](counterparty-institutional-eligibility-screening.md) — institutional eligibility screening is the pre-step before formal categorisation.
- [`otc-confirmation.md`](otc-confirmation.md) (PROC-MK-ODP-06) — confirmation templates include category-appropriate risk disclosures (EC vs PC).
- [`kyc-onboarding.md`](kyc-onboarding.md) — KYC is conducted in parallel with categorisation during onboarding; both outputs are prerequisites for the first trade.
- [`fais-ki-fit-and-proper.md`](fais-ki-fit-and-proper.md) (PROC-FAIS-KI-FAP-01) — the FAIS Key Individual whose designation governs the FSP's categorisation obligations.
- [`fais-advice-record-capture.md`](fais-advice-record-capture.md) (PROC-CRM-FA-01) — for any OTC trades that constitute regulated advice, the categorisation record is a prerequisite.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Zara (Chief Compliance Officer, governance) · Niko (CRM engineer — build-phase paused) | Initial STUB |
| v0.2 | 2026-05-16 | Zara (Chief Compliance Officer, governance) · Mira (regulatory intelligence engineer) | STUB → POPULATED: full 12-section procedure; three-tier EC / PC / RC classification framework; build-phase posture documented; institutional-only hard-decline for RC; pre-trade gate integration; annual review cycle; material-change re-review trigger. |

## 12. Audit / assurance

- **Vera daily:** pre-trade gate check — no `OtcTradeExecuted` events for counterparties with expired or missing categorisation; every new counterparty onboarding has a `CounterpartyCategorised` before the first trade.
- **Vera monthly:** annual-review aging — all `AnnualCategoryReviewDue` events have a downstream reaffirmation or re-categorisation within 30 days; flag overdue items to Zara.
- **Thandiwe (CAE, governance):** annual audit of the client-categorisation framework; sample testing of EC basis evidence; FAIS General Code + CS 3/2018 §7 alignment; opinion reported to Audit Committee.
- **FSCA supervisory:** client categorisation is a primary FSCA conduct-supervision focus; CS 3/2018 §7 findings are reportable; the FAIS KI (Saskia at licence-day) bears personal accountability; Zara manages supervisory engagement.
