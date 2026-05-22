---
policy-id: new-product-approval-policy
title: New Product Approval Policy v1
version: "1"
status: IN FORCE
owner: Saskia (Head of Global Markets, governance)
effective-from: "2026-05-22"
next-review: "2027-05-22"
citations:
  - PA Bank Supervision Manual (product approval governance)
  - FAIS Act 37 of 2002 (product suitability)
  - Banks Act 94 of 1990 (risk management)
  - SARB Guidance Note on new activities and products (2017)
  - existing Policies/trading-mandate-v1.md (NPA gate feeds mandate amendments)
  - existing Policies/counterparty-credit-risk-policy-v1.md (model approval gate)
  - existing Policies/market-risk-policy-v1.md (risk model approval gate)
author: Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance)
date: 2026-05-22
summary: New Product Approval Policy covering NPA committee composition, product tier classification (Tier 1/2/3), NPA checklist (legal, systems, GL, risk model, Excon, AML/KYC, regulatory reporting, valuation), NewProductApproved event, controlled-launch requirement, 90-day post-implementation review, and trading mandate amendment linkage. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-GV
---

# New Product Approval Policy v1

> **Authors.** Saskia (Head of Global Markets, governance) — lead; Owen (Company Secretary, governance) — co-author.
> **Status.** CORPORATE-BIND. The NPA governance framework is established from incorporation. While the NPA gate fires at the pre-go-live stage before any new product is traded commercially, the policy framework, committee mandate, and approval processes are required from the formation stage. The PA expects to see a functioning NPA framework at the licence-application stage.
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 1. New Product Approval Policy — Overarching

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Tier 1 products — CEO approval; Tier 2 products — NPA Committee; Tier 3 products — Saskia approval · **Cadence:** Annual policy review; NPA Committee convened on each new product proposal · **Citation:** PA Bank Supervision Manual + FAIS Act 37 of 2002 + Banks Act 94 of 1990 + SARB Guidance Note on new activities + `Policies/trading-mandate-v1.md`

### Purpose

This policy governs how Hoz Bank Limited approves new products, new activities, and material enhancements to existing products before they are traded or offered to clients. Its purpose is to ensure that: (i) every new product receives structured pre-launch review by all material risk, legal, compliance, and operational disciplines before the first trade; (ii) the risk model, GL chart of accounts, regulatory reporting, and system capabilities are in place before trading commences; (iii) the trading mandate (`Policies/trading-mandate-v1.md`) is formally amended where the new product falls outside the existing mandate; and (iv) a post-implementation review confirms that the product operates as anticipated.

The NPA framework is a pre-go-live gate, not a build-phase gate (per the Bank's product lifecycle governance, memory `project_product_lifecycle_npa_vs_engineering.md`, 2026-05-09). Engineering builds the substrate for products in parallel; the NPA gate fires when a product approaches commencement-of-trading, not when engineering begins. This avoids blocking build-phase substrate work with NPA ceremony.

The NPA policy sits at the policy layer above the trading mandate. An approved NPA expands the trading mandate's effective product scope; a failed NPA is a bar on trading, not a bar on building.

### Principles

- **NPA before first trade — no exceptions.** No product may be traded with a client or counterparty without a completed, approved NPA record. An attempt to trade a product that has not completed the NPA process is an immediate market risk and conduct risk flag; Saskia and Zara are notified within 1 hour.
- **Product tiers are risk-proportionate.** The NPA process is proportionate to the risk and novelty of the product. Tier 1 (new asset class or material structural change) requires the full NPA checklist and CEO approval. Tier 2 (incremental within existing mandate) requires NPA Committee sign-off. Tier 3 (administrative or operational change) requires Saskia's approval.
- **Events-first NPA.** The `NewProductApproved { productId, tier, checklistItems[], approverRefs[] }` event is the canonical record of each NPA approval. The trading mandate amendment (if required) is a `TradingMandateAmended { productId, priorScope, newScope, npaRef }` event. No verbal or email approval substitutes for these events.
- **Post-implementation review at 90 days.** Every Tier 1 and Tier 2 NPA requires a formal post-implementation review (PIR) at 90 days from first trade. The PIR assesses whether the product is operating within the approved parameters and whether any assumptions in the NPA checklist proved incorrect.
- **PA notification for material new activities.** Material new product categories (Tier 1) may require PA notification under the SARB Guidance Note on new activities. Owen manages the PA communication; Zara confirms the notification obligation.

### Roles

Saskia (Head of Global Markets, governance) chairs the NPA Committee and is the Tier 2 approver. She is responsible for: the first-line NPA assessment; chairing NPA Committee meetings; post-implementation review. Helena (Chief Risk Officer, governance) is the risk and model approval sign-off on the NPA Committee. Zara (Chief Compliance Officer, governance) is the compliance, FAIS, and AML/KYC sign-off on the NPA Committee. Eitan (Treasurer, governance) is the ALM, FTP, and liquidity impact sign-off on the NPA Committee. Imani (Legal-as-code engineer, engineering) provides the ISDA/legal documentation readiness sign-off. Owen (Company Secretary, governance) provides the governance event authoring and PA notification management. The CEO is the Tier 1 approver. Ravi (Treasury/ALM engineer, engineering) and Rohan (Market risk quantitative engineer, engineering) provide the technical model readiness assessments.

---

## 2. Product Tier Classification

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Saskia classifies; NPA Committee may escalate tier · **Cadence:** Per product proposal · **Citation:** PA Bank Supervision Manual — materiality assessment for new products

| Tier | Definition | Approver | NPA checklist |
|---|---|---|---|
| Tier 1 | New asset class not in the current trading mandate; material structural change to an existing product (e.g., introduction of path-dependent exotic structures); new counterparty category (e.g., first retail client type) | CEO (post NPA Committee recommendation) | Full 11-item checklist (§3) |
| Tier 2 | Incremental product within an existing asset class already in the trading mandate (e.g., new IR swap tenor; new bond issuer; new FX pair) | NPA Committee (Saskia chair) | Abbreviated checklist — items 1, 3, 5, 6, 8, 9 required; items 2, 4, 7, 10, 11 only if material delta |
| Tier 3 | Administrative or operational change to an existing product (e.g., new settlement venue for an existing instrument; new template for an existing ISDA agreement) | Saskia (individual approval) | Items 1 and 3 only (legal docs and system readiness) |

Tier escalation: any NPA Committee member may escalate a Tier 2 classification to Tier 1 by raising a formal concern at the NPA Committee meeting. Tier escalation requires majority NPA Committee agreement; escalation to Tier 1 requires CEO approval of the classification change.

---

## 3. NPA Checklist

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Each checklist item has a designated sign-off owner; Saskia confirms all items completed before tabling the NPA for approval · **Cadence:** Per NPA process · **Citation:** Cross-referenced per checklist item

The full NPA checklist (11 items) covers:

### Item 1 — Legal and ISDA Documentation Readiness

**Sign-off owner:** Imani (Legal-as-code engineer, engineering).
Confirmation that: (i) the relevant ISDA Master Agreement provisions (or equivalent legal framework) cover the product; (ii) the ISDA product confirmation template is drafted or adapted; (iii) any jurisdiction-specific legal opinion on enforceability is in place (if the product is traded cross-border); (iv) the product is within the scope of the Bank's ISDA CSA terms.

### Item 2 — System Capability Readiness

**Sign-off owner:** Ravi (Treasury/ALM engineer, engineering) + the engineering owner of the relevant domain.
Confirmation that: (i) the front-office order management system can book and manage the product; (ii) the risk calculation systems (FRTB SA engine, CCR SA-CCR engine, IRRBB model) include the product in their scope; (iii) the position management system can carry and report the product; (iv) the market data feed provides the required rates/prices for valuation.

### Item 3 — GL Chart of Accounts

**Sign-off owner:** Bea (Accounting & financial reporting engineer, engineering) + Camille (Chief Financial Officer, governance).
Confirmation that: (i) the required GL accounts for the product exist and are correctly configured in the chart of accounts; (ii) IFRS 9 classification of the product is confirmed; (iii) the posting rules (debit/credit pairs for origination, MTM, settlement, maturity events) are coded and tested; (iv) the GL can produce the IFRS 7 fair value hierarchy disclosure for the product.

### Item 4 — Risk Model Approval

**Sign-off owner:** Helena (Chief Risk Officer, governance) + Rohan (Market risk quantitative engineer, engineering).
Confirmation that: (i) the market risk model can price and risk the product (Greeks, sensitivities for FRTB SA); (ii) the CCR model can compute the SA-CCR PFE add-on for the product; (iii) the valuation methodology is approved by Helena; (iv) Nadia (Independent-validation engineer, peer-in-second-line under Helena) has reviewed the model and issued a validation sign-off `[citation: ModelValidationCompleted event]`; (v) the NMRF assessment for the product's risk factors has been completed by Rohan.

### Item 5 — Exchange Control (Excon) Treatment

**Sign-off owner:** Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance).
Confirmation that: (i) the product's Excon treatment (whether an Excon approval or exemption is required) has been assessed; (ii) any required SARB Forex Department approval is in place; (iii) the product's interaction with the Bank's foreign asset limits is assessed.

### Item 6 — AML/KYC Counterparty Profile

**Sign-off owner:** Zara (Chief Compliance Officer, governance).
Confirmation that: (i) the counterparty type for the new product has an approved AML/KYC risk profile in the Bank's counterparty onboarding policy; (ii) any new counterparty type that the product introduces has completed the full AML/KYC onboarding process per `Policies/counterparty-onboarding-policy-v1.md`; (iii) the product's transaction monitoring rules in the AML system have been updated to include the new product type.

### Item 7 — Regulatory Reporting Wiring

**Sign-off owner:** Camille (Chief Financial Officer, governance) + Zara (Chief Compliance Officer, governance).
Confirmation that: (i) the product is captured in all relevant SARB regulatory returns (BA-series); (ii) OTC derivative reporting obligations to the FSCA trade repository are in place (if applicable); (iii) the product's inclusion in the IFRS 7 risk disclosures is confirmed.

### Item 8 — Valuation Methodology Sign-Off

**Sign-off owner:** Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance).
Confirmation that: (i) the independent price verification (IPV) methodology for the product is approved and operational; (ii) the IFRS 9 and IFRS 13 fair value hierarchy level for the product is assigned; (iii) the valuation frequency (daily for trading book; monthly for banking book) is confirmed; (iv) the product's valuation is included in the daily `MarketRiskMeasureComputed` event scope.

### Item 9 — Conduct Risk and Pre-Trade Gate

**Sign-off owner:** Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets, governance).
Confirmation that: (i) the product is included in the surveillance system's alert rule set (§4 of `Policies/conduct-risk-policy-v1.md`); (ii) the pre-trade conduct gate (`Procedures/markets/pre-trade-conduct-gate.md`) covers the product; (iii) client suitability criteria for the product are confirmed (institutional-only for all products per the trading mandate).

### Item 10 — FTP and ALM Impact Assessment

**Sign-off owner:** Eitan (Treasurer, governance) + Ravi (Treasury/ALM engineer, engineering).
Confirmation that: (i) the FTP rate methodology for the product is defined and the `FtpAttachedToProduct` event will fire on origination; (ii) the product's IRRBB contribution is assessed and within the IRRBB limit framework; (iii) the product's LCR/NSFR impact is assessed.

### Item 11 — Tier 1 Only: PA Notification Assessment

**Sign-off owner:** Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance).
Assessment of whether the new product constitutes a "material new activity" requiring PA notification under the SARB Guidance Note on new activities. Owen files the PA notification if required; Zara confirms the notification obligation `[citation: TBC — SARB Guidance Note precise notification threshold; Imani confirms]`.

---

## 4. Controlled Launch

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Saskia approves controlled-launch parameters; NPA Committee ratifies · **Cadence:** Per NPA approval; controlled launch runs for 90 days from first trade for Tier 1 products; 30 days for Tier 2 products · **Citation:** PA Bank Supervision Manual — phased introduction of new products

All Tier 1 and Tier 2 products are subject to a controlled launch after NPA approval. The controlled launch is a defined period during which:
- **Notional limit:** The aggregate notional position in the new product is capped at a conservative limit set in the NPA approval document (typically 10–20% of the full product limit). Rohan monitors this limit daily.
- **Enhanced monitoring:** The product receives daily enhanced monitoring from both Saskia's trading desk and Helena's risk team during the controlled launch period.
- **Checklist reconciliation:** Any assumption in the NPA checklist (Items 1–11) that proves incorrect in practice is flagged by the relevant sign-off owner within 5 business days of discovery. Significant discrepancies pause the controlled launch pending remediation.

The controlled launch is formally concluded at the post-implementation review (§5). A `ControlledLaunchConcluded { productId, npaRef, launchPeriod, pirOutcome }` event marks the end of the controlled-launch restriction; the full product limit then applies.

---

## 5. Post-Implementation Review at 90 Days

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** NPA Committee reviews; Helena and Zara must concur for the PIR to pass · **Cadence:** 90 calendar days from the date of the first client trade for Tier 1 products; 30 days for Tier 2 · **Citation:** PA Bank Supervision Manual — post-launch review requirements

The PIR assesses:
1. **Checklist compliance:** Did all NPA checklist items function as assumed? Document any gaps.
2. **Risk model performance:** Did the risk model (FRTB SA, SA-CCR) perform as expected on the actual trades booked?
3. **Valuation performance:** Did the IPV process confirm the model valuations? Were there material IPV exceptions?
4. **Operational performance:** Were there any operational incidents (failed settlements, GL posting errors, surveillance gaps) attributable to the new product?
5. **Regulatory performance:** Were all regulatory reporting obligations correctly captured?
6. **Limit utilisation:** Was the controlled-launch limit used appropriately? Is the full product limit calibration still appropriate?

PIR outcomes: (i) pass — controlled launch concluded, full limit applies; (ii) conditional pass — minor remediation required; controlled launch extended 30 days; (iii) fail — significant deficiencies; trading in the product suspended pending remediation; Helena and Zara co-present to CEO.

A `PostImplementationReviewCompleted { productId, npaRef, outcome, findings[], approverRefs[] }` event is the canonical record.

---

## 6. Linkage to Trading Mandate

**Owner:** Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) · **Approval:** CEO approval required for any amendment to the trading mandate · **Cadence:** Mandate amendment on each Tier 1 NPA approval · **Citation:** `Policies/trading-mandate-v1.md`

When a Tier 1 NPA approval covers a product or product type not currently within the trading mandate's scope, the trading mandate must be formally amended before the first trade. The amendment process:

1. Owen prepares a draft `TradingMandateAmended` event citing the NPA approval reference.
2. Helena confirms that the mandate amendment is consistent with the RAS.
3. CEO approves the mandate amendment.
4. Owen files the `TradingMandateAmended { productScope, priorVersion, newVersion, npaRef, ceoApprovalRef }` event.
5. The trading mandate document (`Policies/trading-mandate-v1.md`) is updated with a new version section reflecting the amended scope.

No trading mandate amendment proceeds on Saskia's authority alone for Tier 1 products; CEO approval is required.

---

## 7. Substrate Dependencies and Gaps

- **NPA workflow system (Owen + Ravi).** Automated NPA checklist workflow tracking each item's sign-off status and emitting the `NewProductApproved` event on completion. Currently manual (document-based); substrate build formalises the workflow.
- **Post-implementation review tracking (Saskia + Rohan).** Automated 90-day PIR trigger from the first-trade event. Currently manual.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) | Initial policy authored. Six sections: (1) Overarching — NPA before first trade, tier-proportionate process, events-first, PIR requirement, PA notification; (2) Product Tier Classification — Tier 1/2/3 definition, approver, checklist level, escalation; (3) NPA Checklist — 11 items: legal docs, system readiness, GL, risk model, Excon, AML/KYC, regulatory reporting, valuation, conduct, FTP/ALM, PA notification (Tier 1 only); (4) Controlled Launch — notional cap, enhanced monitoring, checklist reconciliation; (5) PIR at 90 days — six PIR criteria, pass/conditional/fail outcomes; (6) Trading Mandate Linkage — Tier 1 mandate amendment process, CEO approval. CORPORATE-BIND. |
