---
title: TCF substrate plan v0 — six outcomes mapped against the bank's institutional-only posture
author: Zara
date: 2026-05-09
summary: Treating Customers Fairly substrate plan v0. Lists the six TCF outcomes precisely, identifies which apply at the bank's institutional-only / wholesale posture (and which do not, with citation rationale), specifies the substrate footprint TCF imposes on the engineering line (complaint-handling pipeline, advice-record substrate, product-suitability checks intersecting Saskia's NPA policy), and surfaces open questions and substrate gaps.
decision-required: false
maps-to-decision-id: D-THIN-HUMAN-LAYER-MINIMUM
note: TCF binding is COMMENCEMENT-BIND per `project_rules_bind_at_commencement.md`. Build-phase work is substrate planning; commencement-of-trading triggers the binding. This paper is a v0 plan; v1 follows on PAX research output for D-FSP-LICENCE-NECESSITY (intersection at FAIS-record-keeping substrate).
---

# TCF substrate plan v0 — six outcomes mapped against the bank's institutional-only posture

**Author:** Zara (Chief Compliance Officer — governance line; conduct-of-business / TCF accountability per `Team/Zara.md`).
**Reports through:** direct to CEO.
**Contributors / dependencies:** Niko (lead-to-client lifecycle / advice records — paused during build-phase per `CLAUDE.md`; activates at licence-day); Saskia (Head of Global Markets — NPA policy at PR #39 intersects); Mira (FAIS substrate engineering); Devon (COO governance line — engineering line for Niko, Anya); Anya (data / analytics engineer — semantic layer for product-suitability checks).
**Date:** 2026-05-09
**For:** Marc (CEO) — informational; substrate-plan input to engineering planning.
**Status:** Plan v0. Not decision-required. Substrate work begins at engineering line; binding fires at commencement-of-trading.

---

## 1. The six TCF outcomes

The Financial Sector Conduct Authority's Treating Customers Fairly framework defines six outcomes. Cited precisely from the FSCA's TCF Outcomes (originating in the FSB's TCF Roadmap 2011, carried forward under FSCA Conduct Standards) [citation: TBC — pending Mira's obligations-register row hardening on TCF outcomes; FSCA TCF Outcomes published guidance].

| # | Outcome | Plain-language statement |
|---|---|---|
| **TCF 1** | **Culture and governance.** Customers are confident that they are dealing with firms where the fair treatment of customers is central to the firm's culture. | The Board, Exco, and the firm's governance demonstrate TCF as a strategic priority, not a compliance line item. |
| **TCF 2** | **Products and services.** Products and services marketed and sold in the retail market are designed to meet the needs of identified customer groups and are targeted accordingly. | Product-design and target-market identification are explicit; mis-targeted products are caught at design, not at sale. |
| **TCF 3** | **Clear and appropriate information.** Customers are provided with clear information and kept appropriately informed before, during and after the point of sale. | Information disclosure is calibrated to the customer's understanding; ongoing information flow during product life. |
| **TCF 4** | **Suitable advice.** Where advice is given, it is suitable and takes account of customer circumstances. | Advice is conditional ("where given"); when given, it is suitable to circumstances. |
| **TCF 5** | **Performance and service expectations.** Products perform as firms have led customers to expect, and the associated service is of an acceptable standard and as they have been led to expect. | No mis-selling against expectations; service quality matches what was advertised. |
| **TCF 6** | **Switching, redress, and complaints.** Customers do not face unreasonable post-sale barriers to change product, switch provider, submit a claim, or make a complaint. | Switching / redress / complaint pathways are accessible, not weaponised against the customer. |

[citation: FSCA TCF Outcomes; FSB TCF Roadmap 2011; carried forward under FSCA Conduct Standards. Specific Conduct-Standard citation row to be added by Mira to `Regulations/_obligations-register.md` under `ORG-CD-*` series.]

---

## 2. Applicability at the institutional-only / wholesale posture

The bank's posture is institutional-only / wholesale per `project_strategic_foundation.md`. TCF was originally framed in retail-market language ("retail market", "customers"). The applicability question: which outcomes survive translation to a wholesale / institutional-counterparty book?

| Outcome | Applies at wholesale posture? | Rationale |
|---|---|---|
| **TCF 1** (culture and governance) | **Yes — fully.** | TCF 1 is a governance / culture obligation, not a customer-segment obligation. The Board's TCF accountability binds regardless of whether counterparties are retail or institutional. Owen owns Board-level TCF reporting; Zara owns the governance-framework reflection. [citation: TBC — `Owner Inbox/2026-05-06_governance-framework.md` does not yet name TCF as a Board-pack standing item; gap.] |
| **TCF 2** (products and services) | **Yes — but reframed.** | The "identified customer groups" become "identified institutional / professional counterparty types". Product-design discipline applies; target-market identification is the sub-set of institutions the product serves. **Direct intersection with Saskia's NPA policy at PR #39** — the New Product Approval gate is where target-market identification and product-design suitability are tested before go-live. [citation: D-NEW-PRODUCT-APPROVAL-POLICY, PR #39 if it lands; `project_product_lifecycle_npa_vs_engineering.md` for the NPA-as-go-live-gate framing.] |
| **TCF 3** (clear and appropriate information) | **Partial.** | Disclosure obligations to institutional counterparties are calibrated differently — institutional counterparties are presumed to understand product mechanics. But ongoing information flow (post-trade reporting, mark-to-market, corporate-action notices) still applies, calibrated to the institutional counterparty's information needs. The substrate is real (post-trade reporting, statements, corporate-action notices), narrower than retail. |
| **TCF 4** (suitable advice) | **Conditional — depends on D-FSP-LICENCE-NECESSITY.** | If the bank operates under Posture A (FSP licence pursued; Marc-interim KI / Saskia steady-state), advice is given and TCF 4 binds — substrate is the FAIS advice-record-capture pipeline. If Posture B (carve-out), no advice is given; TCF 4 does not bind. **This outcome is gated on the FSP-licence-necessity research dispatch** [citation: `Owner Inbox/2026-05-09_zara_fsp-application-path.md`]. |
| **TCF 5** (performance and service expectations) | **Yes — but reframed.** | Institutional counterparties are entitled to performance against contractual / disclosed expectations. The bank's product disclosures (term sheets, ISDA / GMRA framing, prospectuses where applicable) define expectations; the bank must perform against them. Service-quality expectation is the SLA the bank has committed to in counterparty agreements. |
| **TCF 6** (switching, redress, and complaints) | **Yes — fully on complaints; partial on switching / redress.** | Complaint-handling is universal — institutional counterparties have a right to complain and to be heard. Substrate is the complaint-handling pipeline (see §3.1). Switching / redress is more product-specific (e.g., loan early-settlement, derivative novation); the substrate exists in the contracts (Imani's clause library) and the operations layer (Tomas's settlement). |

**Headline.** All six outcomes apply at the bank's posture, with TCF 4 gated on the FSP-licence decision and TCF 3 / TCF 5 / TCF 6 reframed for the wholesale context.

[citation: Mira's parallel obligations-register update will surface row(s) for TCF outcomes under `ORG-CD-*` series; pending row content. The COMMENCEMENT-BIND classification per `project_rules_bind_at_commencement.md` means substrate is staged for licence-day even though the binding fires at commencement-of-trading.]

---

## 3. Substrate footprint imposed on the engineering line

TCF imposes the following substrate footprint. Each capability is an engineering deliverable; each maps to a procedure under Principle 6.

### 3.1 Complaint-handling pipeline (TCF 6)

**Capability:** ingest complaints from any channel (email, dispute event from settlement, regulator-routed complaint, counterparty escalation), case-manage them, route to the responsible owner, track resolution, generate the regulatory-reporting payload (FSCA complaint statistics where applicable), and feed the AC pack with complaint-MI.

**Engineering owner:** Niko (lead-to-client lifecycle — paused during build-phase, activates at licence-day) on the customer-interaction surface; Anya (data / analytics engineer) on the complaint-MI projection; Devon (COO governance line) holds engineering oversight.

**Procedure footprint:** new procedure `Procedures/by-policy/complaint-handling.md` — to be authored under TCF 6. Owner: triple-hatted compliance lead (MLRO + FIC CO + IO) for complaints with conduct / AML overlap; standalone CCO accountability for pure conduct complaints.

**Status:** `PLANNED` substrate gap S-1.

### 3.2 Advice-record substrate / FAIS-record-keeping (TCF 4)

**Capability:** if Posture A holds (FSP licence pursued), every advice interaction is recorded — counterparty profile, advice given, suitability assessment, fee disclosure — under the FAIS General Code of Conduct + Determination of Fit and Proper 2017.

**Engineering owner:** Niko on the customer-interaction record-capture; Mira on the FAIS-substrate engine (suitability rules, record format, retention).

**Procedure footprint:** existing `Procedures/by-policy/fais-advice-record-capture.md` becomes binding under TCF 4 + Posture A. Conditional under Posture B.

**Status:** `PLANNED` substrate; gating decision is D-FSP-LICENCE-NECESSITY.

### 3.3 Product-suitability checks (TCF 2 + TCF 4)

**Capability:** at product-onboarding (NPA gate) and at counterparty-onboarding (KYC / categorisation gate), test that the product is suitable for the counterparty type and that the counterparty is eligible for the product. Includes target-market identification at product-design and counterparty-categorisation enforcement at sale.

**Engineering owner:** Saskia / Kai on the product-design surface (NPA gate); Niko on the counterparty-onboarding surface; Anya on the semantic-layer reconciliation between counterparty-type and product-eligibility.

**Procedure footprint:**
- Existing `Procedures/by-policy/client-categorisation.md` covers the counterparty side.
- **Direct intersection with Saskia's NPA policy at PR #39** — the New Product Approval gate at PR #39 (D-NEW-PRODUCT-APPROVAL-POLICY) is where target-market identification and product-design suitability are tested before commencement-of-trading. Zara's TCF substrate plan v0 takes a *dependency* on Saskia's NPA policy landing at PR #39; if NPA policy adds a `TargetMarket` and `SuitabilityProfile` field to the product-design schema, TCF 2 + TCF 4 substrate inherits those fields rather than re-deriving them. [citation: `project_product_lifecycle_npa_vs_engineering.md`; PR #39 if it lands.]

**Status:** `PLANNED` — depends on PR #39 landing.

### 3.4 Product-disclosure / information-flow substrate (TCF 3 + TCF 5)

**Capability:** generate counterparty-facing disclosures (term sheets, post-trade confirmations, mark-to-market statements, corporate-action notices) from event log under Principle 6 (presentations derive from data). Track disclosure delivery and acknowledgement as typed events.

**Engineering owner:** Tomas (post-trade confirmations); Bea (statements); Anya (semantic layer for disclosure content); Niko (counterparty-channel delivery).

**Procedure footprint:** subset already in `Procedures/by-policy/otc-confirmation.md` (post-trade confirms); broader counterparty-disclosure procedure to be authored.

**Status:** partially `PLANNED`; substrate exists for OTC confirmations.

### 3.5 Switching / redress substrate (TCF 6 partial)

**Capability:** counterparty-initiated switching events (early settlement, novation, product change) are first-class events with contract-clause backing (Imani's clause library) and settlement effect (Tomas).

**Engineering owner:** Imani (clause library); Tomas (settlement effect); Niko (counterparty interface).

**Procedure footprint:** existing `Procedures/by-policy/otc-dispute-resolution.md` covers dispute redress; switching-specific procedures pending product-set definition.

**Status:** partially `PLANNED`.

### 3.6 TCF-MI for AC / Board (TCF 1)

**Capability:** quarterly AC pack and Board pack include TCF MI — complaint volumes, advice-record sample audits, product-design TCF-2 review outcomes, switching / redress event volumes, customer-disclosure delivery rates.

**Engineering owner:** Anya (semantic layer + MI projection); secretariat through Owen.

**Procedure footprint:** TCF-MI section is a generated subsection of the AC pack, under Principle 6 (presentations derive from data).

**Status:** `PLANNED`.

---

## 4. Open questions and substrate gaps

### 4.1 Open questions

| # | Question | Owner | Resolution path |
|---|---|---|---|
| Q1 | Does TCF 4 (suitable advice) bind at all? | Marc (decision); PAX research | Gated on D-FSP-LICENCE-NECESSITY [citation: `Owner Inbox/2026-05-09_zara_fsp-application-path.md`]. |
| Q2 | What FSCA Conduct Standard citation rows belong in `Regulations/_obligations-register.md` for the six TCF outcomes? | Mira | Mira's parallel obligations-register update under D-THIN-HUMAN-LAYER-MINIMUM follow-on; `ORG-CD-*` series. |
| Q3 | Does Saskia's NPA policy at PR #39 expose `TargetMarket` and `SuitabilityProfile` fields the TCF 2 / TCF 4 substrate can inherit? | Saskia (PR #39) | If PR #39 lands with these fields, TCF substrate inherits; if not, TCF substrate derives them (duplication risk under Principle 6). [citation: PR #39 if it lands.] |
| Q4 | Does the bank's counterparty-categorisation discipline (KYC / institutional / professional) align with the FSCA's expected counterparty-type framework for wholesale TCF reframing? | Mira + Niko | Build-phase: Mira reads FSCA Conduct Standards on wholesale counterparties; cross-checks with `Procedures/by-policy/client-categorisation.md`. |
| Q5 | Is there a complaint-volume threshold below which TCF 6 reporting is statistical-only vs case-by-case to FSCA? | Mira | FSCA published Complaint-Reporting Rules; row to add to obligations register. |

### 4.2 Substrate gaps (Principle 7 discipline — gaps are roadmap items, not hidden)

| Gap ID | Capability | Status | Roadmap notes |
|---|---|---|---|
| TCF-S-1 | Complaint-handling pipeline (§3.1) | `PLANNED` | Activates at licence-day; depends on Niko's customer-interaction substrate landing. |
| TCF-S-2 | FAIS advice-record capture engine (§3.2) | `PLANNED` | Conditional on Posture A. Existing procedure but no engine. |
| TCF-S-3 | Product-suitability check engine (§3.3) | `PLANNED` | Direct dependency on PR #39 (NPA policy). |
| TCF-S-4 | Counterparty-disclosure delivery + acknowledgement substrate (§3.4) | `PARTIAL` | OTC confirmation substrate exists; statements + corporate-action notices `PLANNED`. |
| TCF-S-5 | TCF-MI projection for AC / Board (§3.6) | `PLANNED` | Anya's semantic layer dependency. |
| TCF-S-6 | TCF outcome rows in `Regulations/_obligations-register.md` (`ORG-CD-*` series) | `GAP` | Mira's parallel update closes. |
| TCF-S-7 | Board-pack standing TCF item in governance framework | `GAP` | Owen's parallel governance-framework update may close; flagged. |

---

## 5. Cross-references

- **Mira-Zara conduct-side challenge paper** — Q6 of `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` confirms TCF substrate is COMMENCEMENT-BIND; this plan v0 inherits that classification.
- **D-NEW-PRODUCT-APPROVAL-POLICY (PR #39 if it lands)** — direct dependency for §3.3 product-suitability checks. If PR #39 lands with `TargetMarket` and `SuitabilityProfile` fields, TCF 2 + TCF 4 substrate inherits.
- **D-FSP-LICENCE-NECESSITY** — `Owner Inbox/2026-05-09_zara_fsp-application-path.md` — gates TCF 4 (suitable advice) applicability.
- **D-THIN-HUMAN-LAYER-MINIMUM parent decision** — this plan v0 is a follow-on under the `agent:Zara` route.
- **Mira's parallel obligations-register update** — TCF outcome rows under `ORG-CD-*` series.
- **Owen's parallel governance-framework update** — TCF as a Board-pack standing item (possible).
- **Saskia's parallel FAIS-KI handover note** — Saskia's KI candidacy intersects TCF 4 substrate.
- **Imani's parallel legal-as-code reading** — clause library for switching / redress (TCF 6 partial) is Imani-side.

---

## 6. Authority

- `CLAUDE.md` — Operating model; Principle 6 (single-graph discipline); Principle 7 (autonomous-by-default).
- `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md` — parent decision; this paper is a follow-on under `agent:Zara` route.
- `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` — Q6 (TCF activates at commencement) anchors timing.
- `Owner Inbox/2026-05-09_zara_fsp-application-path.md` — gates TCF 4.
- `project_rules_bind_at_commencement.md` — TCF binding fires at commencement-of-trading.
- `project_product_lifecycle_npa_vs_engineering.md` — NPA gates go-live, not engineering; TCF 2 + TCF 4 substrate inherits NPA fields.
- `project_strategic_foundation.md` — institutional-only / wholesale posture.
- **FSCA TCF Outcomes** — six outcomes (FSB TCF Roadmap 2011, carried forward under FSCA Conduct Standards). Specific Conduct-Standard citation row pending Mira's obligations-register update.
- **FAIS Act 37 of 2002** — General Code of Conduct (TCF 4 / TCF 5); record-keeping (TCF 4); complaint procedures (TCF 6).
- **FSCA Conduct Standards** — wholesale-market counterparty framing (TCF 3 partial; TCF 5 reframed).
- **POPIA Act 4 of 2013** — overlap on data-subject rights and complaint handling (TCF 6 + POPIA s.69 cross-reference); see `Procedures/by-policy/popia-dsar.md`.
- `Team/Zara.md` — TCF accountability under conduct-of-business mandate.
- `Team/Niko.md` — lead-to-client lifecycle (paused build-phase, activates at licence-day).
- `Team/Saskia.md` — Head of Global Markets; NPA policy owner.
- `Team/Anya.md` — semantic layer for product-suitability + TCF MI.
- `Team/Mira.md` — FAIS substrate engineering.
- `Team/Imani.md` — legal-as-code for switching / redress clauses.
- `Regulations/_obligations-register.md` — `ORG-CD-*` series (TCF rows pending Mira's update).

---

## 7. Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-09 | Initial plan v0. Lists six TCF outcomes precisely. Maps each outcome's applicability at the institutional-only / wholesale posture (all six apply, with TCF 4 gated on D-FSP-LICENCE-NECESSITY and TCF 3 / TCF 5 / TCF 6 reframed). Specifies substrate footprint across complaint-handling, advice-record, product-suitability, disclosure, switching-redress, and TCF-MI capabilities. Surfaces 5 open questions and 7 substrate gaps. Cross-references parent decision D-THIN-HUMAN-LAYER-MINIMUM, PR #39 (D-NEW-PRODUCT-APPROVAL-POLICY), and D-FSP-LICENCE-NECESSITY. | Zara |

---

—Zara (Chief Compliance Officer)
