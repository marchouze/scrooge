---
policy-id: new-product-approval-policy
title: New Product Approval Policy v2
version: "2"
status: IN FORCE
owner: Saskia (Head of Global Markets, governance)
effective-from: "2026-06-08"
next-review: "2027-06-08"
supersedes: new-product-approval-policy-v1.md
decision: D-NEW-PRODUCT-APPROVAL-POLICY-V2
citations:
  - PA Bank Supervision Manual (product approval governance)
  - FAIS Act 37 of 2002 (product suitability)
  - Banks Act 94 of 1990 (risk management)
  - SARB Guidance Note on new activities and products (2017)
  - D-BA-RETURN-NUMBERING-EXCEL-CANONICAL (FX NOP rides BA 320 market-risk; LCR is BA 300; daily Reg 29(3) NOP form unresolved per D-FX-NOP-SLA-CITATION-D5-MIGRATION)
  - docs/2026-06-08_fx-functionality-domain-review.md (the v2 diagnosis)
  - existing Policies/trading-mandate-v1.md (NPA gate feeds mandate amendments)
  - existing Policies/counterparty-credit-risk-policy-v1.md (model approval gate)
  - existing Policies/market-risk-policy-v1.md (risk model approval gate)
author: Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance)
date: 2026-06-08
summary: New Product Approval Policy v2. Adds to v1 four binding changes from the FX functionality domain review — (A) implementation-attested must cite a GREEN completeness recon (liveness evidence, not assertion); (B) every design-attested dimension auto-creates a tracked gap-register obligation carrying its re-activation trigger, and a PRODUCTION ProductApproved is blocked until every production-required dimension is implementation-attested (design-attested acceptable only for internal-test scope); (C) Item 7 enumerates the specific BA-series returns per product class (FX -> BA 320 market-risk NOP + BA 300 LCR; the daily Reg 29(3) effective-NOP form is unresolved per D-FX-NOP-SLA-CITATION-D5-MIGRATION) against the Excel-canonical SARB schedule (D-BA-RETURN-NUMBERING-EXCEL-CANONICAL); (D) no silent out-of-scope absorption — out-of-scope trades rejected at the Item-9 pre-trade gate, and Item 3 gains a full-scope completeness requirement. CORPORATE-BIND.
decision-required: false
riskTaxonomy:
  - RT-OR
  - RT-GV
---

# New Product Approval Policy v2

> **Authors.** Saskia (Head of Global Markets, governance) — lead; Owen (Company Secretary, governance) — co-author (governance-event-authoring + register perspective).
> **Status.** CORPORATE-BIND. The NPA governance framework is established from incorporation. While the NPA gate fires at the pre-go-live stage before any new product is traded commercially, the policy framework, committee mandate, and approval processes are required from the formation stage. The PA expects to see a functioning NPA framework at the licence-application stage.
> **Authority.** `D-NEW-PRODUCT-APPROVAL-POLICY-V2` (CEO session-delegation, Marc, 2026-06-08). Supersedes v1 (`Policies/new-product-approval-policy-v1.md`).
> **Identity discipline.** Every agent reference pairs name + position on first mention.

---

## 0. What v2 changes (and why)

v1 was sound in structure but allowed three weaknesses that the FX functionality domain review (`docs/2026-06-08_fx-functionality-domain-review.md`) surfaced. The FX-spot NPA gate (`scripts/run-npa-gate-fx-spot.ts`, product `prd:bank:fx:fx-spot-usdzar`, internal-test scope) fired honestly — it recorded several material dimensions as `design-attested` (not `implementation-attested`) with deferral narratives. Yet real gaps remained inside the approved product because the policy and the backing recon (`platform/recon/product-approval-attestation-integrity.ts`) let those design-attested-and-deferred dimensions pass without any forward obligation:

1. **Design-attested-and-deferred was never forward-tracked or re-gated.** The recon blocks only on `result:"failed"`; `design-attested` passes. So a product could be `ProductApproved` with material dimensions merely *designed*, the deferral promises living only in narrative, and nothing carrying them into the gap register or blocking a future PRODUCTION fire until they were live. (→ VaR cadence and FinSurv reporting stayed open.)
2. **Checklist coverage holes.** v1 Item 7 asserted "captured in all relevant BA-series returns," but the gate operationalised only the liquidity subscriber — there was **no** dimension for the FX-NOP market-risk return. Not failed; never a check. (v1's LCR form citation was stale; under the Excel-canonical schedule `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`, the FX NOP rides the **BA 320** market-risk return and LCR is **BA 300**, while the daily Reg 29(3) effective-NOP form remains unresolved per `D-FX-NOP-SLA-CITATION-D5-MIGRATION`.)
3. **Out-of-approved-scope trades were silently absorbed by a fallback.** The NPA approved fx-spot USD/ZAR **only**; EUR/GBP/JPY/CHF/AUD were never in scope, yet the sim booked them and suspense `ACC-2100-007` silently absorbed them instead of the pre-trade gate rejecting the out-of-scope trade.

v2 fixes all three with four binding amendments, summarised here and operationalised in §1 (Principles), §3 (Checklist Items 3, 7, 9), and §3a (the attestation-liveness and forward-tracking rules):

- **Amendment A — `implementation-attested` must cite liveness EVIDENCE, not assertion.** §3a.1.
- **Amendment B — forward-track every deferral + production re-gate.** §3a.2.
- **Amendment C — close the coverage holes (enumerate returns; re-number FX → BA 320 market-risk NOP + BA 300 LCR per the Excel-canonical schedule).** §3, Item 7.
- **Amendment D — no silent out-of-scope absorption.** §1 Principles + §3, Items 3 and 9.

---

## 1. New Product Approval Policy — Overarching

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Tier 1 products — CEO approval; Tier 2 products — NPA Committee; Tier 3 products — Saskia approval · **Cadence:** Annual policy review; NPA Committee convened on each new product proposal · **Citation:** PA Bank Supervision Manual + FAIS Act 37 of 2002 + Banks Act 94 of 1990 + SARB Guidance Note on new activities + `Policies/trading-mandate-v1.md`

### Purpose

This policy governs how Hoz Bank Limited approves new products, new activities, and material enhancements to existing products before they are traded or offered to clients. Its purpose is to ensure that: (i) every new product receives structured pre-launch review by all material risk, legal, compliance, and operational disciplines before the first trade; (ii) the risk model, GL chart of accounts, regulatory reporting, and system capabilities are **in place and proven live across the product's full declared scope** before trading commences; (iii) the trading mandate (`Policies/trading-mandate-v1.md`) is formally amended where the new product falls outside the existing mandate; and (iv) a post-implementation review confirms that the product operates as anticipated.

The NPA framework is a pre-go-live gate, not a build-phase gate (per the Bank's product lifecycle governance, memory `project_product_lifecycle_npa_vs_engineering.md`, 2026-05-09). Engineering builds the substrate for products in parallel; the NPA gate fires when a product approaches commencement-of-trading, not when engineering begins. This avoids blocking build-phase substrate work with NPA ceremony.

The NPA policy sits at the policy layer above the trading mandate. An approved NPA expands the trading mandate's effective product scope; a failed NPA is a bar on trading, not a bar on building.

### Principles

- **NPA before first trade — no exceptions.** No product may be traded with a client or counterparty without a completed, approved NPA record. An attempt to trade a product that has not completed the NPA process is an immediate market risk and conduct risk flag; Saskia (Head of Global Markets, governance) and Zara (Chief Compliance Officer, governance) are notified within 1 hour.
- **Scope is exact; the gate rejects out of scope — no silent absorption.** *(Amendment D.)* An approved NPA approves a **declared scope** — the enumerated set of currencies, tenors, leg-types, counterparty categories, and venues, recorded in the `ProductApproved` event. A trade that falls outside the approved scope MUST be **rejected at the pre-trade gate** (§3, Item 9), never booked-and-absorbed by a GL suspense account, a default routing, or any catch-all. Silent absorption of an out-of-scope trade (e.g. an unapproved currency leg landing in suspense `ACC-2100-007`) is a Principle-1 / Principle-5 control failure and a reportable NPA-gate breach: Saskia, Zara, and Camille (Chief Financial Officer, governance) are notified within 1 hour, and the trade is reversed. Expanding the approved scope (e.g. adding a currency) is itself a fresh NPA cycle (Tier 2 minimum), not a fallback.
- **Product tiers are risk-proportionate.** The NPA process is proportionate to the risk and novelty of the product. Tier 1 (new asset class or material structural change) requires the full NPA checklist and CEO approval. Tier 2 (incremental within existing mandate) requires NPA Committee sign-off. Tier 3 (administrative or operational change) requires Saskia's approval.
- **Attestation binds to liveness, not assertion.** *(Amendment A.)* A production-required checklist dimension may be attested `implementation-attested` **only** if it cites a GREEN completeness recon proving the capability is wired, exercised, and complete across the product's full declared scope (§3a.1). A bare narrative assertion is `design-attested`, not `implementation-attested`. `design-attested` is acceptable **only** for an internal-test-scope `ProductApproved`; it is fatal for a production `ProductApproved` (§3a.2).
- **Every deferral is a tracked forward obligation.** *(Amendment B.)* Each `design-attested` dimension auto-creates a tracked gap-register obligation (`platform/substrate/gap-register.ts`) carrying its re-activation trigger. The production NPA fire for the product is blocked until every production-required dimension is `implementation-attested` and its gap obligation closed (§3a.2). Deferral promises do not live in narrative alone.
- **Events-first NPA.** The `ProductApproved` event (per the canonical `Product*` typed family in `prototype/platform/event-store/event-types/product.ts`, carrying `scope`, `conditions[]`, and `approvedBy`) is the canonical record of each NPA approval, preceded by one `ProductDimensionAttested` per dimension. The trading mandate amendment (if required) is a `TradingMandateAmended { productId, priorScope, newScope, npaRef }` event. No verbal or email approval substitutes for these events.
- **Post-implementation review at 90 days.** Every Tier 1 and Tier 2 NPA requires a formal post-implementation review (PIR) at 90 days from first trade. The PIR assesses whether the product is operating within the approved parameters and whether any assumptions in the NPA checklist proved incorrect.
- **PA notification for material new activities.** Material new product categories (Tier 1) may require PA notification under the SARB Guidance Note on new activities. Owen (Company Secretary, governance) manages the PA communication; Zara confirms the notification obligation.

### Roles

Saskia (Head of Global Markets, governance) chairs the NPA Committee and is the Tier 2 approver. She is responsible for: the first-line NPA assessment; chairing NPA Committee meetings; post-implementation review. Helena (Chief Risk Officer, governance) is the risk and model approval sign-off on the NPA Committee. Zara (Chief Compliance Officer, governance) is the compliance, FAIS, and AML/KYC sign-off on the NPA Committee. Eitan (Treasurer, governance) is the ALM, FTP, and liquidity impact sign-off on the NPA Committee. Imani (Legal-as-code engineer, engineering) provides the ISDA/legal documentation readiness sign-off. Owen (Company Secretary, governance) provides the governance event authoring and PA notification management. The CEO is the Tier 1 approver. Ravi (Treasury/ALM engineer, engineering) and Rohan (Market risk quantitative engineer, engineering) provide the technical model readiness assessments. Vera (Internal audit / continuous-assurance engineer, engineering) owns the `recon:completeness:*` substrate that the gate consumes (§3a) and the standing audit that continuously re-checks it; Mira (Compliance / RegTech engineer, engineering) wires the FX-NOP (BA 320 market-risk) submission-completeness check (Item 7).

---

## 2. Product Tier Classification

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Saskia classifies; NPA Committee may escalate tier · **Cadence:** Per product proposal · **Citation:** PA Bank Supervision Manual — materiality assessment for new products

| Tier | Definition | Approver | NPA checklist |
|---|---|---|---|
| Tier 1 | New asset class not in the current trading mandate; material structural change to an existing product (e.g., introduction of path-dependent exotic structures); new counterparty category (e.g., first retail client type) | CEO (post NPA Committee recommendation) | Full 11-item checklist (§3) |
| Tier 2 | Incremental product within an existing asset class already in the trading mandate (e.g., new IR swap tenor; new bond issuer; new FX pair) | NPA Committee (Saskia chair) | Abbreviated checklist — items 1, 3, 5, 6, 8, 9 required; items 2, 4, 7, 10, 11 only if material delta |
| Tier 3 | Administrative or operational change to an existing product (e.g., new settlement venue for an existing instrument; new template for an existing ISDA agreement) | Saskia (individual approval) | Items 1 and 3 only (legal docs and system readiness) |

Tier escalation: any NPA Committee member may escalate a Tier 2 classification to Tier 1 by raising a formal concern at the NPA Committee meeting. Tier escalation requires majority NPA Committee agreement; escalation to Tier 1 requires CEO approval of the classification change.

> **Note on scope expansion (Amendment D).** Adding a currency, tenor, leg-type, counterparty category, or venue to an **already-approved** product is a scope expansion, not a fallback. It is a fresh NPA cycle — Tier 2 minimum — and produces a new `ProductApproved` event with the widened `scope`. Until that cycle completes, the new scope dimension is **out of scope** and the pre-trade gate (§3, Item 9) rejects trades in it.

---

## 3. NPA Checklist

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Each checklist item has a designated sign-off owner; Saskia confirms all items completed before tabling the NPA for approval · **Cadence:** Per NPA process · **Citation:** Cross-referenced per checklist item

The full NPA checklist (11 items) covers the dimensions below. Each item's attestation posture is governed by §3a: a production-required item may be `implementation-attested` only where it cites the GREEN completeness recon named in §3a.1; otherwise it is `design-attested`, which is acceptable only for internal-test scope and forward-tracked per §3a.2.

### Item 1 — Legal and ISDA Documentation Readiness

**Sign-off owner:** Imani (Legal-as-code engineer, engineering).
Confirmation that: (i) the relevant ISDA Master Agreement provisions (or equivalent legal framework) cover the product; (ii) the ISDA product confirmation template is drafted or adapted; (iii) any jurisdiction-specific legal opinion on enforceability is in place (if the product is traded cross-border); (iv) the product is within the scope of the Bank's ISDA CSA terms.

### Item 2 — System Capability Readiness

**Sign-off owner:** Ravi (Treasury/ALM engineer, engineering) + the engineering owner of the relevant domain.
Confirmation that: (i) the front-office order management system can book and manage the product; (ii) the risk calculation systems (FRTB SA engine, CCR SA-CCR engine, IRRBB model) include the product in their scope; (iii) the position management system can carry and report the product; (iv) the market data feed provides the required rates/prices for valuation **for every currency / instrument in the declared scope** (not a representative subset).

### Item 3 — GL Chart of Accounts

**Sign-off owner:** Bea (Accounting & financial reporting engineer, engineering) + Camille (Chief Financial Officer, governance).
Confirmation that: (i) the required GL accounts for the product exist and are correctly configured in the chart of accounts; (ii) IFRS 9 classification of the product is confirmed; (iii) the posting rules (debit/credit pairs for origination, MTM, settlement, maturity events) are coded and tested; (iv) the GL can produce the IFRS 7 fair value hierarchy disclosure for the product.

**(v) Full-scope completeness — no catch-all *(Amendment D).*** Every currency and every leg in the product's **declared scope** must be provisioned to dedicated GL accounts. No currency or leg in the declared scope may route to a suspense / unresolved / default catch-all account in steady state. Where a suspense account exists as a defence-in-depth backstop, it must be empty in steady state for the approved scope, and any non-empty suspense balance is an exception requiring correction.

**Completeness evidence (production-required).** `implementation-attested` for Item 3 requires a GREEN `recon:fx-supported-currency-no-suspense` (PR #1101) — or the equivalent per-product completeness recon — proving every declared-scope currency has a dedicated CoA pair and none routes to suspense `ACC-2100-007`. Absent that green recon, Item 3 is `design-attested` (§3a).

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

**Sign-off owner:** Camille (Chief Financial Officer, governance) + Zara (Chief Compliance Officer, governance) + Mira (Compliance / RegTech engineer, engineering).

*(Amendment C — coverage hole closed. v1's "all relevant BA-series returns" was an unenumerated assertion that the gate operationalised only as the LCR subscriber. v2 ENUMERATES the specific returns per product class. The form numbers are stated against the **Excel-canonical SARB schedule** (`Regulations/SARB-PA/ba-returns/_canonical-register.md`; authority `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`), which supersedes the earlier `D-BA-RETURN-FORM-NUMBERING-RECON` scheme: the FX net-open-position rides the **BA 320** market-risk return (position risk, Reg 28); liquidity is **BA 300** (LCR/NSFR). **Unresolved:** the specific SARB form carrying the daily Reg 29(3) effective-NOP attestation is not yet pinned to a canonical BA number (the previously-cited off-balance-sheet daily-return form was a mis-attribution); this remains open under `D-FX-NOP-SLA-CITATION-D5-MIGRATION` and must be confirmed against the actual form before the FX daily-NOP dimension is treated as implementation-attested.)*

Confirmation that the product is captured in **each** SARB return it touches, enumerated by product class:

| Product class | Returns the product touches (each a required dimension) |
|---|---|
| **FX (spot / forward / NOP)** | **BA 320** — Market risk; carries the FX net-open-position (position risk, Reg 28). **Daily effective-NOP attestation (Reg 29(3))** — the canonical SARB form is *unresolved* (open under `D-FX-NOP-SLA-CITATION-D5-MIGRATION`; the off-balance-sheet daily-return form previously cited was a mis-attribution). **BA 300** — liquidity-coverage impact of FX settlement flows. **FinSurv** — SARB Currency & Exchanges exchange-control reporting on every cross-border FX flow under Authorised-Dealer status (`D-FX-AD-STATUS`). |
| **Money-market / deposits** | BA 300 (liquidity risk, incl. LCR / NSFR, Reg 26 / Reg 26A). |
| **Derivatives (IRS / OTC)** | BA 350 (derivative instruments, Reg 32); BA 320 (market-risk position); FSCA trade repository OTC reporting (Conduct Standard / FMA). |
| **Bonds / fixed income** | BA 320 (market-risk position); BA 200 (credit risk, Reg 23, where issuer credit applies). |

For each enumerated return, confirm: (i) the product flows into the return's generator and the **runtime subscriber is wired** (not merely built-inert); (ii) OTC derivative reporting obligations to the FSCA trade repository are in place (if applicable); (iii) the product's inclusion in the IFRS 7 risk disclosures is confirmed.

**Completeness evidence (production-required).** `implementation-attested` for Item 7 requires a GREEN **FX-NOP (BA 320 market-risk) submission-completeness check** (Mira is wiring it) — proving the product's positions reach a runtime-wired BA 320 period-close subscriber with an actual SARB submission path, not an inert generator. Absent that green check, Item 7 is `design-attested` (§3a). The FX review (§8 G5.1) records that the BA 320 FX-NOP period-close subscriber is currently **not runtime-wired**; until Mira's check is green, FX-spot Item 7 cannot be `implementation-attested` for production.

### Item 8 — Valuation Methodology Sign-Off

**Sign-off owner:** Helena (Chief Risk Officer, governance) + Camille (Chief Financial Officer, governance).
Confirmation that: (i) the independent price verification (IPV) methodology for the product is approved and operational; (ii) the IFRS 9 and IFRS 13 fair value hierarchy level for the product is assigned; (iii) the valuation frequency (daily for trading book; monthly for banking book) is confirmed; (iv) the product's valuation is included in the daily `MarketRiskMeasureComputed` event scope.

**Completeness evidence (production-required).** `implementation-attested` for Item 8 requires a GREEN VaR / market-risk-measure **freshness watchdog** — `recon:expected-event-watchdog` (Rohan, Risk engineer, PR #1102) — proving the daily `MarketRiskMeasureComputed` event for the product actually fires on cadence (not silently absent). Absent that green watchdog, Item 8 is `design-attested` (§3a). The FX review (§8) records the VaR cadence as a deferred item; until the watchdog is green, valuation cadence cannot be `implementation-attested` for production.

### Item 9 — Conduct Risk and Pre-Trade Gate

**Sign-off owner:** Zara (Chief Compliance Officer, governance) + Saskia (Head of Global Markets, governance).
Confirmation that: (i) the product is included in the surveillance system's alert rule set (§4 of `Policies/conduct-risk-policy-v1.md`); (ii) the pre-trade conduct gate (`Procedures/markets/pre-trade-conduct-gate.md`) covers the product; (iii) client suitability criteria for the product are confirmed (institutional-only for all products per the trading mandate).

**(iv) Scope enforcement — reject out of scope *(Amendment D).*** The pre-trade gate MUST enforce the approved **declared scope**: a trade whose currency, tenor, leg-type, counterparty category, or venue is outside the `ProductApproved.scope` is **rejected before booking**. The gate must not allow an out-of-scope trade to book and route to a suspense / default / catch-all account (e.g. an unapproved currency leg falling into `ACC-2100-007`). Rejection is the only acceptable disposition for an out-of-scope trade. A booked-and-absorbed out-of-scope trade is a reportable NPA-gate breach (§1 Principles) and is reversed.

### Item 10 — FTP and ALM Impact Assessment

**Sign-off owner:** Eitan (Treasurer, governance) + Ravi (Treasury/ALM engineer, engineering).
Confirmation that: (i) the FTP rate methodology for the product is defined and the `FtpAttachedToProduct` event will fire on origination; (ii) the product's IRRBB contribution is assessed and within the IRRBB limit framework; (iii) the product's LCR/NSFR impact is assessed.

### Item 11 — Tier 1 Only: PA Notification Assessment

**Sign-off owner:** Owen (Company Secretary, governance) + Zara (Chief Compliance Officer, governance).
Assessment of whether the new product constitutes a "material new activity" requiring PA notification under the SARB Guidance Note on new activities. Owen files the PA notification if required; Zara confirms the notification obligation `[citation: TBC — SARB Guidance Note precise notification threshold; Imani confirms]`.

---

## 3a. Attestation liveness and deferral forward-tracking

**Owner:** Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) · **Approval:** NPA Committee; the production-fire block is a CI-enforced invariant (Vera) · **Cadence:** Per NPA gate cycle · **Citation:** `D-NEW-PRODUCT-APPROVAL-POLICY-V2`; FX functionality domain review

This section is the heart of v2. It binds attestation to liveness evidence (Amendment A) and turns every deferral into a tracked, re-gated forward obligation (Amendment B). It governs the meaning of the `ProductDimensionAttested.result` values used at §3.

### 3a.1 — `implementation-attested` requires a GREEN completeness recon (Amendment A)

A production-required checklist dimension may carry `result:"implementation-attested"` **only** if its attestation cites a GREEN completeness recon proving the capability is wired, exercised, and complete **across the product's full declared scope**. A narrative assertion that the capability "is built" or "is designed" is `design-attested`, never `implementation-attested`. The recon evidence is the difference.

The point-in-time completeness checks the NPA gate consumes are part of the `recon:completeness:*` substrate that Vera (Internal audit / continuous-assurance engineer, engineering) is concurrently specifying under `WS-COMPLETENESS-AUDIT` / `D-COMPLETENESS-AUDIT-WORKSTREAM`. **The NPA gate is the point-in-time consumer of that completeness substrate; Vera's standing audit is the continuous consumer.** This policy references that substrate — it does not duplicate it. The per-item bindings below are the initial mapping; Vera's backlog maintains the authoritative list.

| Checklist item (production-required) | Completeness recon that evidences `implementation-attested` | Engineer / status |
|---|---|---|
| Item 3 — GL Chart of Accounts (full-scope, no suspense) | `recon:fx-supported-currency-no-suspense` (PR #1101) | Bea (Accounting & financial reporting engineer, engineering) — landed |
| Item 7 — Regulatory reporting wiring (BA 320 FX-NOP runtime-wired) | FX-NOP (BA 320 market-risk) submission-completeness check | Mira (Compliance / RegTech engineer, engineering) — wiring |
| Item 8 — Valuation cadence (`MarketRiskMeasureComputed` fires) | `recon:expected-event-watchdog` (VaR freshness, PR #1102) | Rohan (Market risk quantitative engineer, engineering) — landed |

### 3a.2 — Every deferral is forward-tracked; production fire is blocked until live (Amendment B)

1. **Auto-create a gap obligation per deferral.** Each dimension recorded `design-attested` MUST auto-create a tracked obligation in the gap register (`platform/substrate/gap-register.ts`, a `SubstrateGap` record) carrying the dimension id, the missing completeness recon, and the **re-activation trigger** (e.g. "commencement-of-trading," "BA 320 FX-NOP subscriber runtime-wired," "VaR watchdog green"). The deferral promise no longer lives only in the attestation narrative; it is a register row a continuous audit can read.
2. **Scope tags the acceptable posture.** `design-attested` is acceptable **only** for an internal-test-scope `ProductApproved` (e.g. the FX-spot pre-licence rehearsal). For a **production** `ProductApproved`, every production-required dimension MUST be `implementation-attested`; a single `design-attested` production-required dimension is **fatal** to the production fire.
3. **Production re-gate.** Re-firing the NPA gate for production (or expanding an internal-test approval to production) requires that every production-required dimension is `implementation-attested` (per §3a.1) and its gap obligation closed. This is the production NPA-fire block: the gate cannot emit a production `ProductApproved` while any production-required dimension is `design-attested` or any backing gap obligation is open.
4. **Enforcement.** The production-fire block and the per-deferral gap-backing are CI-enforced by the upgraded `recon:product-approval-attestation-integrity` (Vera; named as an engineering follow-on in §7). The recon currently blocks only on `result:"failed"`; the upgrade adds: (a) for a production-scope `ProductApproved`, any `design-attested` production-required dimension → `fail`; (b) every `design-attested` dimension must have a matching open gap-register obligation.

---

## 4. Controlled Launch

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** Saskia approves controlled-launch parameters; NPA Committee ratifies · **Cadence:** Per NPA approval; controlled launch runs for 90 days from first trade for Tier 1 products; 30 days for Tier 2 products · **Citation:** PA Bank Supervision Manual — phased introduction of new products

All Tier 1 and Tier 2 products are subject to a controlled launch after NPA approval. The controlled launch is a defined period during which:
- **Notional limit:** The aggregate notional position in the new product is capped at a conservative limit set in the NPA approval document (typically 10–20% of the full product limit). Rohan (Market risk quantitative engineer, engineering) monitors this limit daily.
- **Scope confinement:** Trading during controlled launch is confined to the approved declared scope (§3, Item 9). Out-of-scope trades are rejected, not absorbed, throughout (Amendment D).
- **Enhanced monitoring:** The product receives daily enhanced monitoring from both Saskia's trading desk and Helena's risk team during the controlled launch period.
- **Checklist reconciliation:** Any assumption in the NPA checklist (Items 1–11) that proves incorrect in practice is flagged by the relevant sign-off owner within 5 business days of discovery. Significant discrepancies pause the controlled launch pending remediation.

The controlled launch is formally concluded at the post-implementation review (§5). A `ControlledLaunchConcluded { productId, npaRef, launchPeriod, pirOutcome }` event marks the end of the controlled-launch restriction; the full product limit then applies.

---

## 5. Post-Implementation Review at 90 Days

**Owner:** Saskia (Head of Global Markets, governance) · **Approval:** NPA Committee reviews; Helena and Zara must concur for the PIR to pass · **Cadence:** 90 calendar days from the date of the first client trade for Tier 1 products; 30 days for Tier 2 · **Citation:** PA Bank Supervision Manual — post-launch review requirements

The PIR assesses:
1. **Checklist compliance:** Did all NPA checklist items function as assumed? Document any gaps. **Confirm every dimension that was `design-attested` at approval has since been re-gated to `implementation-attested` and its gap obligation closed (§3a.2).**
2. **Risk model performance:** Did the risk model (FRTB SA, SA-CCR) perform as expected on the actual trades booked?
3. **Valuation performance:** Did the IPV process confirm the model valuations? Were there material IPV exceptions? **Was the daily `MarketRiskMeasureComputed` event present on every trading day (VaR freshness watchdog green)?**
4. **Operational performance:** Were there any operational incidents (failed settlements, GL posting errors, surveillance gaps, **out-of-scope trades absorbed into suspense**) attributable to the new product?
5. **Regulatory performance:** Were all regulatory reporting obligations correctly captured **on each enumerated return for the product class (§3, Item 7)** — in particular, did the BA 320 FX-NOP submission path fire for an FX product?
6. **Limit utilisation:** Was the controlled-launch limit used appropriately? Is the full product limit calibration still appropriate?

PIR outcomes: (i) pass — controlled launch concluded, full limit applies; (ii) conditional pass — minor remediation required; controlled launch extended 30 days; (iii) fail — significant deficiencies; trading in the product suspended pending remediation; Helena and Zara co-present to CEO.

A `PostImplementationReviewCompleted { productId, npaRef, outcome, findings[], approverRefs[] }` event is the canonical record.

---

## 6. Linkage to Trading Mandate

**Owner:** Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) · **Approval:** CEO approval required for any amendment to the trading mandate · **Cadence:** Mandate amendment on each Tier 1 NPA approval · **Citation:** `Policies/trading-mandate-v1.md`

When a Tier 1 NPA approval covers a product or product type not currently within the trading mandate's scope, the trading mandate must be formally amended before the first trade. The amendment process:

1. Owen (Company Secretary, governance) prepares a draft `TradingMandateAmended` event citing the NPA approval reference.
2. Helena (Chief Risk Officer, governance) confirms that the mandate amendment is consistent with the RAS.
3. CEO approves the mandate amendment.
4. Owen files the `TradingMandateAmended { productScope, priorVersion, newVersion, npaRef, ceoApprovalRef }` event.
5. The trading mandate document (`Policies/trading-mandate-v1.md`) is updated with a new version section reflecting the amended scope.

No trading mandate amendment proceeds on Saskia's authority alone for Tier 1 products; CEO approval is required.

---

## 7. Substrate Dependencies, Gaps, and Named Engineering Follow-Ons

### Substrate dependencies

- **NPA workflow system (Owen + Ravi).** Automated NPA checklist workflow tracking each item's sign-off status and emitting the `ProductApproved` event on completion. Currently operated by Scrooge-coordinated run against the spec; substrate build formalises the workflow.
- **Post-implementation review tracking (Saskia + Rohan).** Automated 90-day PIR trigger from the first-trade event. Currently manual.

### Named engineering follow-ons (set by Saskia; Scrooge routes — NOT built in this policy run)

1. **Upgrade `platform/recon/product-approval-attestation-integrity.ts` → Vera (Internal audit / continuous-assurance engineer, engineering).** Add to the existing `result:"failed"` block: (a) for a **production-scope** `ProductApproved`, any production-required dimension that is `design-attested` (not `implementation-attested`) is a `fail` (the production NPA-fire block, §3a.2); (b) every `design-attested` dimension must have a matching open gap-register obligation (`platform/substrate/gap-register.ts`) — a `design-attested` dimension with no backing gap is a `fail`. Keep aligned with `WS-COMPLETENESS-AUDIT`.
2. **Per-item completeness-gate bindings → Vera, `WS-COMPLETENESS-AUDIT` backlog.** Maintain the authoritative mapping of which `recon:completeness:*` gate evidences which production-required checklist item (initial map in §3a.1): Item 3 → `recon:fx-supported-currency-no-suspense` (PR #1101, Bea); Item 7 → FX-NOP (BA 320 market-risk) submission-completeness check (Mira, Compliance / RegTech engineer, engineering); Item 8 → `recon:expected-event-watchdog` VaR freshness (PR #1102, Rohan, Market risk quantitative engineer, engineering). The NPA gate (point-in-time consumer) and Vera's standing audit (continuous consumer) read the same substrate.

> These are policy-level *names*, not build instructions. The recon code is owned by Vera's concurrent `WS-COMPLETENESS-AUDIT` work; this policy run deliberately does not edit recon code, to avoid collision.

---

## 8. Change Log

| Version | Date | Author | Change |
|---|---|---|---|
| v1 | 2026-05-22 | Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) | Initial policy authored. Six sections: (1) Overarching — NPA before first trade, tier-proportionate process, events-first, PIR requirement, PA notification; (2) Product Tier Classification — Tier 1/2/3 definition, approver, checklist level, escalation; (3) NPA Checklist — 11 items: legal docs, system readiness, GL, risk model, Excon, AML/KYC, regulatory reporting, valuation, conduct, FTP/ALM, PA notification (Tier 1 only); (4) Controlled Launch — notional cap, enhanced monitoring, checklist reconciliation; (5) PIR at 90 days — six PIR criteria, pass/conditional/fail outcomes; (6) Trading Mandate Linkage — Tier 1 mandate amendment process, CEO approval. CORPORATE-BIND. |
| v2 | 2026-06-08 | Saskia (Head of Global Markets, governance) + Owen (Company Secretary, governance) | Authority: `D-NEW-PRODUCT-APPROVAL-POLICY-V2` (CEO session-delegation 2026-06-08). Diagnosis: FX functionality domain review (`docs/2026-06-08_fx-functionality-domain-review.md`). Four binding amendments. **A — attestation binds to liveness (new §3a.1 + §1 Principles):** a production-required dimension is `implementation-attested` only if it cites a GREEN completeness recon (Item 3 → `recon:fx-supported-currency-no-suspense`; Item 7 → FX-NOP (BA 320 market-risk) submission-completeness check; Item 8 → `recon:expected-event-watchdog`); the NPA gate is the point-in-time consumer of Vera's `recon:completeness:*` / `WS-COMPLETENESS-AUDIT` substrate. **B — forward-track deferrals + production re-gate (new §3a.2):** every `design-attested` dimension auto-creates a tracked gap-register obligation with its re-activation trigger; production `ProductApproved` blocked until all production-required dimensions `implementation-attested` (`design-attested` acceptable only for internal-test scope). **C — close coverage holes (Item 7):** enumerate the specific BA-series returns per product class (FX → BA 320 market-risk NOP + BA 300 LCR + FinSurv; the daily Reg 29(3) effective-NOP form is unresolved per `D-FX-NOP-SLA-CITATION-D5-MIGRATION`) against the Excel-canonical SARB schedule per `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`. **D — no silent out-of-scope absorption (§1 Principles + Items 3, 9):** out-of-scope trades rejected at the pre-trade gate, never absorbed by suspense; Item 3 gains a full-scope completeness requirement (every declared-scope currency/leg to dedicated accounts, none in a catch-all). New §3a; §0 summary; new §7 named engineering follow-ons (recon upgrade → Vera; per-item bindings → `WS-COMPLETENESS-AUDIT`). Supersedes v1. CORPORATE-BIND. |
| v2.1 | 2026-06-09 | Mira (Compliance / RegTech engineer, compliance) under Zara (Chief Compliance Officer, governance) | BA-return form-number remediation only (no substantive policy change). Re-stated the Item 7 FX/product-class return numbering against the Excel-canonical SARB schedule (`_canonical-register.md`, `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`), which supersedes the v2-cited `D-BA-RETURN-FORM-NUMBERING-RECON`: the FX net-open-position rides the **BA 320** market-risk return, and liquidity (LCR / NSFR) is **BA 300** — replacing the earlier off-balance-sheet / foreign-operations / income-statement form attributions. The daily Reg 29(3) effective-NOP form is flagged **unresolved** (open under `D-FX-NOP-SLA-CITATION-D5-MIGRATION`) rather than asserted against the off-balance-sheet daily-return form. |
