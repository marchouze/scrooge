---
title: CEO decision — D-SAMOS-NON-CLEARING (bank is not a SAMOS clearing participant)
author: Marc · Scrooge (record)
date: 2026-05-07
summary: The bank does not become a direct SAMOS settlement participant. ZAR clearing flows via a SAMOS-sponsor bank under the indirect participant model. Same operating posture as the FX correspondent decision — capital-light, ops-light, sponsor-routed access to critical market-infrastructures. Touches the licence-type question and routes through Mira / Imani / Saskia for confirmation.
decision-required: false
---

# CEO decision — D-SAMOS-NON-CLEARING

**Decided by:** Marc (CEO)
**Date:** 2026-05-07
**Trigger:** Direct CEO directive in conversation with Scrooge.
**Event:** `CeoDecision` appended to the event store with citations `GOV-FRAMEWORK-CEO-RESERVED` and `COMPANIES-ACT-71-2008` (per `Procedures/by-policy/ceo-decision-review.md`).

---

## What was decided

The bank **does not become a direct SAMOS clearing / settlement participant**. ZAR-denominated cash flows clear via a **SAMOS-sponsor bank** under the indirect participant model. The bank instructs ZAR settlement via the sponsor; the sponsor holds the direct SARB settlement account.

## Pattern — emerging operating posture

This is the second decision in two hours that chooses the indirect / sponsor-routed model over direct membership in a critical market-infrastructure:

| Infrastructure | Direct membership | Bank's chosen path |
|---|---|---|
| **CLS (FX)** | Settlement Member or Third-Party-Customer | Correspondent routing (D-FX-CLS-MEMBERSHIP corrected) |
| **SAMOS (ZAR RTGS)** | SAMOS settlement bank | Indirect participant via sponsor (this decision) |

The pattern is coherent: **capital-light, operationally lean, sponsor-routed**. Direct memberships in critical market infrastructures are operationally heavy and capital-intensive at the bank's scale; sponsor / correspondent routing preserves the same end-state operational outcomes for clients while concentrating the bank's third-party-risk on a small number of well-rated sponsor banks rather than scattering it across direct counterparty relationships.

This pattern likely extends to other infrastructures the bank will touch: Strate (CSDP), JSE Clear (CCP for derivatives), BankservAfrica (low-value retail clearing). Each merits its own decision, but the prior is now "indirect via sponsor unless the franchise demonstrates a specific case for direct membership".

## Implications

### 1. Licence-type implications — needs confirmation

The most consequential implication. SARB Section 16 banking licences typically require direct SAMOS participation; indirect participation is more common at a deposit-taking institution / mutual bank / co-operative banking institution / or specialised wholesale arrangement.

**Routed for urgent confirmation:**
- **Mira:** which SA regulatory licence type is consistent with the intended product and operating posture (institutional global-markets trading bank, indirect SAMOS participation, full AD)? Possibilities to investigate: (a) Section 16 banking licence with sponsor-backed indirect SAMOS participation (some precedent exists); (b) a more restricted bank licence that doesn't require direct SAMOS; (c) a non-bank investment-services / dealer licence under FSCA + FAIS rather than SARB; (d) a bespoke wholesale arrangement.
- **Imani:** legal review of the licence-type options against the intended operating model.
- **Saskia:** which licence types preserve full institutional global-markets capability?

This is the single most important consequence of the SAMOS decision and may warrant a follow-up decision card on **D-LICENCE-TYPE** once the options are scoped.

### 2. Sponsor relationship governance

The SAMOS sponsor is a critical operational dependency at the same level as the FX correspondent. Devon's third-party-risk governance treats both alike:

- **Same procedure surface** — `outsourcing-due-diligence.md` and `directive-3-pa-notification.md` (planned).
- **Same legal pattern** — Imani contracts both relationships with operational SLAs, indemnities, exit conditions.
- **Same cyber due diligence** — Senna + Rashida on connectivity, credential isolation, IR cooperation.
- **Same FIC/sanctions surface** — Mira covers AML/CFT exposure to the sponsor's flow.
- **Same concentration discipline** — primary + named contingent backup; Devon + Tomas own the design.
- **Operational question:** is the SAMOS sponsor and the FX correspondent the same entity? They commonly are (a top-4 SA bank or a major international bank with both CLS membership and SAMOS settlement). If so, concentration risk is amplified — Devon should consider whether a single sponsor for both functions is acceptable or whether functions should be split across two sponsors.

### 3. Treasury / ALM impact

The most immediate substantive implication beyond licence-type. Eitan (Treasurer) has historically scoped HQLA / intraday liquidity / SAMOS funding around direct SARB-account access. Without a direct account:

- **Intraday liquidity** is provided by the sponsor under a contracted facility. Eitan negotiates the facility size with the sponsor (Imani contracts).
- **SARB Standing Facilities** (Marginal Lending Facility, Supplementary Repo) are accessible only via the sponsor; in stress, the sponsor's willingness to extend its own SARB-borrowing to the bank becomes the binding constraint. This is a real liquidity-stress consideration for ICAAP / ILAAP modelling.
- **HQLA composition rules** may shift — a portion of HQLA that would have sat at SARB now sits with the sponsor (or in marketable-securities with the sponsor as custodian). LCR / NSFR computations need Eitan to confirm the composition is BCBS-compliant under the indirect participant arrangement.
- **Daily ZAR cashflow projection** — Eitan + Ravi re-design around sponsor-account-balance reporting (typically end-of-day reconciliation rather than intraday SARB-account observation).
- **Funding strategy** — bilateral repo and money-market access remains direct; the sponsor only intermediates the actual SAMOS settlement leg.

### 4. Markets settlement chain

JSE Clear and Strate (CSDP) ultimately settle ZAR legs at SAMOS. The bank's settlement chain becomes:

```
Trade → JSE Clear / Strate → bank's settlement instructions to the SAMOS sponsor → SAMOS settlement at SARB
```

Saskia and Kai's market-side operations are unaffected at the trading-system layer — `SettlementInstructed` / `SettlementConfirmed` events (A0 schema-freeze §5 #24) carry a `paymentRail` field that captures "via sponsor" without changing the schema. The sponsor identity is a configuration of the settlement substrate, not a CDM contract field.

### 5. Operational resilience treatment

Devon's BCP / DR programme treats the SAMOS-sponsor relationship as an **Important Business Service** under the Operational Resilience Policy. The IBS impact-tolerance for ZAR settlement is set by Devon + Eitan + Helena; failure of the sponsor's SAMOS access is a tier-1 BCP scenario (similar to a SARB SAMOS outage in the direct-participant case, but with an additional layer of dependency).

### 6. Cyber + secure-SDLC

Senna + Rashida treat the SAMOS-sponsor connectivity as a critical perimeter alongside the FX correspondent. Threat-model gating applies to any change to the sponsor-connectivity stack.

## Owners going forward

| Persona | Role |
|---|---|
| **Mira** | Licence-type confirmation; Exchange Control Manual + Banks Act / FSR Act coverage of indirect-participation arrangements |
| **Imani** | Sponsor-relationship contracting; licence-application legal track |
| **Saskia** | Confirms licence types preserving institutional global-markets capability |
| **Devon** | Third-party-risk governance for the SAMOS sponsor; Directive 3 of 2018 notification; BCP / IBS impact-tolerance design |
| **Tomas** | Operational connectivity to the sponsor (SWIFT messaging, ISO 20022 migration); end-of-day reconciliation; switch-test to backup sponsor |
| **Eitan** | Intraday liquidity facility design with the sponsor; HQLA composition; daily ZAR cashflow projection; ICAAP / ILAAP scenarios |
| **Ravi** | Daily liquidity engineering against sponsor-account-balance feed |
| **Helena** | Sponsor-concentration appetite (joint with Eitan); operational-resilience appetite for sponsor-failure scenarios |
| **Senna + Rashida** | Cyber due diligence on the sponsor; threat-model gate on sponsor-connectivity changes |
| **Bea + Camille** | Financial-statement disclosure of the sponsor relationship under IFRS 7; capital-treatment reporting |
| **Vera** | Continuous-controls assurance over the sponsor relationship (third-party-risk pipeline); expected to flag licence-type-vs-actual-operating-model reconciliation as a finding until D-LICENCE-TYPE resolves |
| **Owen** | Sequence the licence-application + Directive-3 notification milestones; coordinate with Imani |

## Re-evaluation cadence

Reopened if (a) the bank scales such that direct SAMOS participation becomes commercially / capitally attractive (unlikely pre-licence; possible post-licence-bedded), (b) the chosen sponsor's operational quality deteriorates, (c) SARB infrastructure or licence-type reform makes the sponsor path inferior, or (d) the licence-type confirmation in §1 returns a result that requires direct SAMOS participation.

## Cross-cutting follow-ups

The most urgent open item from this decision is **D-LICENCE-TYPE** (the licence-type confirmation in §1). Mira / Imani / Saskia should treat it as a near-term decision deliverable; the SAMOS posture is locked in at this conversation but the licence type that makes it consistent must be named explicitly and approved.

The pattern memory below is also written to capture the emerging operating posture so it informs the next infrastructure decision (Strate, JSE Clear, BankservAfrica) without re-litigation.

---

—Recorded by Scrooge per `Procedures/by-policy/ceo-decision-review.md`. `CeoDecision` event `823ae258-eb2f-44ed-9568-442436795f1d` appended to the event store.
