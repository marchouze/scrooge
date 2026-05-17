---
title: New Product Approval Policy v1.0
author: Saskia (Head of Global Markets)
contributors: Helena (CRO), Camille (CFO), Zara (CCO), Mira (compliance citations), Nadia (model-risk gate), Senna (security gate), Imani (legal documentation), Devon (operational readiness), Bea (accounting classification)
date: 2026-05-10
summary: Binding gate that any new product family, instrument type, currency, or material extension must clear before the franchise transacts; 8 lifecycle stages, 14 substantive due-diligence dimensions, BRC primary approval (CEO ratification interim), event-typed throughout.
decision-required: true
decision-id: D-NEW-PRODUCT-APPROVAL-POLICY
decision-category: governance-foundational
decision-owner: Saskia (lead) · Helena · Camille · Zara
decision-for-ceo: Approve the New Product Approval Policy v1.0 for transition from PLANNED → IN FORCE in the policy register. BRC will own ongoing review on the on-product cadence; CEO ratifies first-product attestations until BRC is constituted.
decision-recommendation: Approve as drafted. Policy operationalises BCBS new-product-approval guidance + FSCA Conduct Standards 1–3 of 2018 + the bank's strategic-foundation institutional-only constraint; binds at next product attestation.
riskTaxonomy: [RT-OP, RT-CD.CC, RT-ST.EX]
---

# New Product Approval Policy v1.0

**Owner:** Saskia (Head of Global Markets — franchise & governance)
**Co-curators:** Helena (CRO — risk dimensions); Camille (CFO — capital + accounting dimensions); Zara (CCO — conduct + AML dimensions); Mira (citation curation); Nadia (model-risk gate); Senna (information-security gate); Imani (legal-documentation gate); Devon (operational-readiness gate); Bea (accounting classification gate)
**Approval:** BRC primary; CEO ratification (interim, until BRC constituted per `D-THIN-HUMAN-LAYER-MINIMUM`); Board where the new product crosses a Board-Reserved Matter (§6)
**Cadence:** On-product (every proposal); steady-state annual review per BRC
**Citations (summary):** BCBS Sound Practices for the Management of Operational Risk (rev. 2021) §27 — new product approval; Banks Act 94 of 1990 + Regulations Relating to Banks (Reg 39 — operational risk); FSCA Conduct Standards 1, 2, 3 of 2018; FIC Act 38 of 2001; IFRS 9 / IFRS 13 / IAS 21; POPIA 4 of 2013; CLAUDE.md Principles 1, 2, 4, 5, 6, 7

> **Derivation note (Principle 6 — upward).** This policy implements obligations carried in `Regulations/_obligations-register.md` Domains A (prudential), B (AML), C (conduct, FAIS, TCF), J (markets — `ORG-MK-01..08`), and M (OTC Derivative Provider — `ORG-CS1-001..ORG-CS3-009`). Procedures cited in §10 sit beneath this policy in the upward chain; the system-capability layer (Atlas + Kai's product-construction substrate, parallel slice) executes the gates the policy specifies.

---

## 1. Purpose and authority

This policy specifies the gates a new product must traverse before the bank's global-markets franchise transacts in it, and the lifecycle the product follows once approved. The policy is the WHAT — the binding standard against which every product is attested. The HOW — the typed primitives, composition substrate, and lifecycle event runtime — is owned by the parallel construction-substrate stream (Atlas + Kai + Saskia) and consumed by per-product attestations under this policy.

The bank's authority to operate this policy derives from four sources:

1. **BCBS Sound Practices for the Management of Operational Risk** (rev. 2021), §27, requires that "the bank should have in place a written approval process for new products, services, processes and systems" with the dimensions and approvals enumerated in §5–§6 below.
2. **Banks Act 94 of 1990 + Regulations Relating to Banks** — Reg 39 (operational risk) requires a documented new-product-approval process; the BRC's mandate under the Governance Framework adopts this responsibility.
3. **FSCA Conduct Standards 1, 2, and 3 of 2018** — particularly Conduct Standard 3/2018 §§3–9 — bind the bank as an OTC Derivative Provider once authorised; the gates in §5 cover the dimensions those standards require pre-trade. (Register: `ORG-CS3-001..009`.)
4. **CLAUDE.md Principles 4, 6, 7** — Principle 4 (security designed-in) requires a threat-model gate on every new wire path; Principle 6 (single-graph) requires every gate to carry a citation chain to its regulatory or policy authority; Principle 7 (autonomous-by-default) requires the gates to run as agent-attested events, not as committee theatre.

A new product that has not cleared this policy may not be transacted by the franchise. Attempted transaction without attestation is a Severity-1 operational incident under the Operational Risk Policy.

## 2. Definition of "new product"

The policy applies — and a full attestation cycle (§4) is required — when any of the following is true. Each row is binary; ambiguity is resolved by Saskia in consultation with Helena, with appeal to BRC.

| Trigger | New product? | Reason |
|---|---|---|
| A new product **family** (e.g. listed equities → bonds → IRS → repo → FX) | **Yes** | Crosses primitive boundaries, settlement paths, accounting classifications, master agreements. |
| A new **instrument type** within an existing family (e.g. SAGB inflation-linker added to bond family; swaption added to IRS family) | **Yes** | New cashflow primitives, new pricing model, often new accounting / risk treatment. |
| A new **currency** on an existing product (e.g. USD-leg IRS where only ZAR existed) | **Yes** | New basis curve, new FX exposure, new collateral treatment, new counterparty universe. |
| A new **counterparty jurisdiction** on an existing product | **Material extension** — cleared under §4 short-form; full cycle if jurisdiction crosses sanctions, Excon, FATCA/CRS, or master-agreement boundaries | Risk depends on jurisdiction; CCO and Imani jointly determine short-form vs full cycle. |
| An existing product offered to a new **client class** (e.g. corporate treasury after only-banks before) | **Yes** | Conduct, suitability, and CDD dimensions change. |
| A change in **pricing methodology** within the same product / class | **No** | Governed by Model Risk Policy + Nadia methodology (Tier-classification revision). Triggers a model-validation event, not an NPA event. |
| A change in **operational vendor** (custody, clearing, market-data, FIX gateway) | **No** | Governed by Vendor Management Policy + Outsourcing Policy. Triggers a vendor-change event. |
| A change in **legal documentation form** (e.g. ISDA 2002 → ISDA 2002 with regulatory protocol overlay) | **No** | Governed by Imani's clause-library change-management procedure. |
| **Restructuring an existing trade** (novation, partial termination) | **No** | Lifecycle event under Principle 1; governed by the trading mandate and CDM lifecycle handlers. |
| A new **wrapper** over existing primitives (e.g. structured note composing existing IRS + option primitives) | **Yes** | The composition is itself a new product, even though the primitives are existing. The structured-product flag in §4 governs depth. |

The policy does not govern post-trade lifecycle events; those are owned by the relevant product-team procedures and the trading mandate.

## 3. Scope exclusions

The bank's strategic foundation (`Owner Inbox/2026-05-06_strategic-foundation.md`; memory `project_strategic_foundation.md`) is **institutional-only / wholesale**. Retail and consumer products are out of scope of this policy by construction — they are out of scope of the bank. If the strategic foundation is ever amended to include retail, this policy is amended in the same pass to add retail-specific suitability, advice, and TCF gates.

The policy also excludes:

- **Treasury-balance-sheet hedges that do not constitute a new product family** (e.g. a single FX forward used to hedge a foreign-currency asset under an existing FX product attestation).
- **Internal-only operational tools** (e.g. an internal liquidity-stress dashboard); governed by Change Management Policy.
- **Banking-book lending products** — out of scope for the strategic foundation today; if the foundation is ever amended, a separate retail / SME credit NPA cycle is added.

## 4. The approval lifecycle — stages and gates

A new product traverses eight stages. Each stage names the actors, the artefacts produced, the gate that must clear, and the typed event the bank emits at the stage boundary. The events live in the canonical event log (Principle 1) and are projected into the **Product Register** that BRC reads.

1. **Ideation.** Saskia (or a franchise lead delegated by Saskia) registers a product proposal — one-page: client demand, indicative size, primitives reused, primitives newly required, indicative timing. Light-touch screen; the gate here is "is this consistent with the trading mandate (B5) and the strategic foundation?". Output: `ProductProposalRegistered { productId, family, instrumentType, currency, clientClass, jurisdiction, asOf, citationChain }`.

2. **Conceptualisation.** Saskia + Kai produce a design memo: primitive composition (per `Owner Inbox/2026-05-07_saskia-kai_global-markets-trading-system-architecture.md` §4), target client profile, expected economic profile, indicative trade size, expected lifecycle events, regulatory citation surface. Mira reviews the citation surface for completeness. Output: `ProductConceptualised { productId, primitiveComposition, targetEconomic, citationSurface, asOf }`.

3. **Due diligence.** The substantive stage. Each of the 14 dimensions in §5 is attested independently by its named owner. Each attestation is a typed event: `ProductDimensionAttested { productId, dimension, result, citationChain, evidenceUri, asOf }`. A dimension may return `cleared`, `cleared-with-conditions` (conditions enumerated), or `withheld` (with the failing rule). Stage 3 closes when every dimension is `cleared` or `cleared-with-conditions`. Any dimension `withheld` halts the proposal; Saskia decides whether to redesign and re-enter at stage 2, or abandon. Output: `ProductDueDiligenceCompleted { productId, dimensionResults, conditions, asOf }` or `ProductDueDiligenceWithheld { productId, failedDimension, reason, asOf }`.

4. **BRC review and approval.** Saskia tables a BRC paper summarising the design memo, the dimension attestations, the conditions list, and the proposed controlled-launch limits (§7). Helena, Camille, Zara, and the CEO (interim chair until BRC constituted) review. BRC may approve, approve with additional conditions, defer for further work, or reject. Where the new product crosses a Board-Reserved Matter (§6), the matter is escalated to Board (currently CEO-as-interim-Board) before approval is final. Output: `ProductApproved { productId, conditions, controlledLaunchLimits, approvalAuthority, asOf }` or `ProductWithheld { productId, reason, asOf }`.

5. **Controlled launch.** First trades occur under named limits (§7) for a specified period (default 90 calendar days; BRC may set longer for higher-complexity products). Daily monitoring report to BRC chair + CEO. Operational, conduct, settlement, and risk teams report any breach within the same trading day. Output: `ProductLaunched { productId, launchDate, controlledLaunchLimits, monitoringRecipients, asOf }`; subsequent lifecycle limit events as breaches or amendments occur.

6. **Post-implementation review (PIR).** At end of the controlled-launch period, Saskia + Devon convene the PIR. Dimensions reviewed: did the gates hold (no breaches, or breaches addressed)? Did the operational-readiness assumption hold? Were there incidents? Are the conditions BRC attached still right? Did the economic profile match the conceptualisation? Verdict: continue (limits removed or relaxed); continue-with-amended-conditions; retire. PIR report tabled at BRC. Output: `ProductPostImplementationReviewCompleted { productId, verdict, amendedConditions, asOf }`.

7. **Steady-state operation.** The product moves out of controlled launch and into normal operation, governed by the trading mandate, RAS appetite, and standing procedures. The product is reviewed annually by BRC under the same dimensional structure (§5), with full re-attestation required when a dimension's underlying citation, model, or operational substrate materially changes. Output (annual): `ProductReviewCompleted { productId, dimensionResults, conditionsDelta, asOf }`.

8. **Retirement.** When the franchise drops the product (BRC vote, regulator instruction, operational impossibility, or trading-mandate amendment that removes it). Open positions are migrated per `Procedures/by-policy/product-retirement-migration.md`; settlement, accounting, and reporting events flush through the substrate. Output: `ProductRetired { productId, retirementAuthority, openPositionsMigrationPlanId, asOf }`.

## 5. Due-diligence dimensions — the gates

This is the substantive heart of the policy. Each dimension names the gate, the actor responsible, the artefact required, the rule that fails the gate, and the regulatory citation. A dimension may delegate to a sub-policy (e.g. Model Risk Policy, Sanctions Policy) where that sub-policy governs the substantive test; the NPA cycle records the attestation and the cite to the sub-policy's pass result.

| # | Dimension | Owner | Artefact required | Fail rule | Citation |
|---|---|---|---|---|---|
| 1 | Market risk | Helena (Rohan engineering) | Sensitivity profile (delta, gamma, vega, basis where relevant); RAS § B-market envelope check; pricing-model Tier-classification per Nadia methodology | Pricing model not validated at appropriate Tier; OR sensitivity profile exceeds RAS § B-market envelope at expected book size; OR the product introduces a non-modellable risk factor (FRTB NMRF) without an interim treatment | BCBS d352 / d457 (FRTB); RAS § B-market; obligations register `ORG-PR-19` |
| 2 | Credit risk | Helena (Rohan engineering) | SA-CCR computation for the product class; counterparty-rating coverage check; concentration impact at expected book size against `ORG-PR-09` ceiling | Pre-deal credit engine returns `withhold` at expected book size; OR breach of pre-deal envelope; OR counterparty class lacks rating coverage and no interim treatment | BCBS Large Exposures; Banks Act; `ORG-PR-09`, `ORG-PR-16` |
| 3 | Liquidity / funding | Eitan (Ravi engineering) | LCR / NSFR contribution computation; HQLA classification of any held collateral; FTP attribution methodology | Net LCR or NSFR effect breaches RAS § B-liquidity envelope at expected book size; OR FTP contribution unattributable under the FTP methodology; OR HQLA classification ambiguous | BCBS d295 / d335; `ORG-PR-06`, `ORG-PR-07`, `ORG-PR-08` |
| 4 | Operational risk | Devon (with Helena) | Process-readiness checklist; severe-but-plausible scenario set; vendor-concentration analysis; intersection with Important Business Services per Operational Resilience Policy | Critical operational dependency without backup or rehearsed recovery; OR resilience gap unmitigated at launch; OR process-readiness checklist incomplete | BCBS Operational Risk (rev. 2021); BCBS Operational Resilience (2021); `ORG-PR-17`, `ORG-PR-18` |
| 5 | Operational readiness (substrate) | Tomas (settlement) + Atlas (substrate) + Kai (markets domain) | Substrate-completeness attestation: all required event types registered; settlement path live (or simulator-equivalent in build phase); reconciliation harness covers the new product class; lifecycle handlers complete | Any required substrate component is not yet built; OR reconciliation harness does not cover the product's lifecycle events; OR settlement path absent and no simulator coverage | CLAUDE.md Principles 1, 3; `Owner Inbox/2026-05-07_atlas_substrate-state.md` |
| 6 | Accounting classification | Bea (with Camille) | IFRS 9 SPPI test result + business-model classification (amortised cost / FVOCI / FVTPL); IFRS 13 fair-value-hierarchy assignment (Level 1 / 2 / 3); IAS 21 FX treatment; sub-ledger posting map; BA-return cell mapping | Classification ambiguous between IFRS 9 categories; OR fair-value level cannot be determined from the pricing model; OR sub-ledger postings undefined for any lifecycle event | IFRS 9 / 13; IAS 21; `ORG-AC-15` (BCBS 239) |
| 7 | Capital impact | Camille (with Helena) | Pre-deal RWA delta engine output for the product class at expected book size; capital-headroom check against RAS § B-capital; Pillar 2A add-on consideration | Estimated capital headroom breach at expected book size; OR RWA model uncalibrated for the product class (i.e. methodology runs but has no regulator-aligned anchor); OR Pillar 2A add-on indicated and not provisioned | Banks Act + Reg 39; BCBS Basel III/IV; `ORG-PR-02`, `ORG-PR-03`, `ORG-PR-05` |
| 8 | Conduct / suitability | Zara (with Saskia) | FAIS conduct treatment determination (institutional-only — FAIS exempt for §44 financial-product transactions between FSPs / banks; FSP-licence trigger if any retail / non-FSP counterparty class enters scope); FSCA Conduct Standard 1–3 of 2018 mapping; TCF posture (institutional-only is light-touch but TCF-attested) | Client class outside institutional-only without the strategic-foundation amendment cycle in §3; OR conduct posture inconsistent with FSCA Conduct Standard 3/2018; OR FAIS-exemption assumption invalid for any counterparty class targeted | FAIS Act 37/2002; FSCA Conduct Standards 1, 2, 3 of 2018; `ORG-CD-01..07`, `ORG-CS1-001..ORG-CS3-009` |
| 9 | AML / sanctions / PEP | Mira (with Zara) | Counterparty CDD pathway extension; sanctions-screening service coverage for any new counterparty class or jurisdiction; PEP-detection gate; STR / CTR pathway for any new transaction shape | CDD pathway absent for any in-scope counterparty class; OR sanctions service does not extend to the new product's counterparty universe or jurisdictions; OR transaction-monitoring rule set has no coverage for the new product's transaction shape | FIC Act 38/2001 ss.21–21H, ss.28–29; UN/OFAC/EU/UK HMT/POCDATARA; `ORG-AML-*`; sanctions register `ORG-SAN-*` |
| 10 | Model risk | Nadia | Tier-classification of every new pricing, risk, or classification model under the Nadia methodology library; deferral pointer to RAS § B7 examples until Helena's Model Risk Policy lands | Model not validated at appropriate Tier (Tier-1 fully validated; Tier-2 limited; Tier-3 challenger / shadow); OR Tier-classification disagreement between first line and Nadia unresolved | SR 11-7 / SS 1/23 idiom; BCBS CG-Principles; RAS § B7; `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` |
| 11 | Legal documentation | Imani | Master-agreement coverage attestation (ISDA Master + ZA Schedule + CSA for OTC IRD; GMRA + SA Schedule for repo; GMSLA for sec-lend; trading agreement for listed cash); ECTA execution path; dispute-resolution procedure; jurisdiction matrix | Master agreement absent for any in-scope counterparty class; OR ECTA execution path unverified; OR dispute-resolution procedure not in place pre-trade per Conduct Standard 3/2018 §6 | ECTA 25/2002; ISDA Master; GMRA; GMSLA; `ORG-MK-06`, `ORG-CS3-001`, `ORG-CS3-004` |
| 12 | Information security | Senna (with Rashida) | Threat model covering the new product's wire path (FIX, RFQ, confirmation, settlement instruction); HSM key custody where the product introduces signing; zero-trust posture for any new external integration; impact on Important Business Services per Cyber Resilience Policy | Threat-model gate not closed; OR new external integration introduced without zero-trust pattern; OR HSM key custody not specified for any product-signing path | Joint Standard 1 of 2024; POPIA ss.19–22; CLAUDE.md Principle 4; `ORG-CY-*` |
| 13 | Privacy | Iris | POPIA classification of any personal data the product touches (typically minimal in institutional-wholesale — counterparty contacts, KYC documents); cross-border transfer determination; retention-schedule mapping | POPIA classification missing for any personal-data field; OR cross-border transfer pathway not assessed against POPIA s.72 | POPIA 4 of 2013; SARB Directive 3 of 2018; `ORG-PR-PRIV-*` |
| 14 | Tax | Yael | VAT classification (financial-services exemption coverage); STT classification where listed-equity transfers involved; FATCA / CRS classification of new counterparty class / jurisdiction; transfer-pricing implications for any inter-entity flow at licence-day; section-24J implications for debt instruments | Tax classification ambiguous for any cashflow type; OR FATCA/CRS classification not determinable for any counterparty class targeted; OR transfer-pricing methodology absent for inter-entity flows | Income Tax Act; VAT Act; STT Act; FATCA IGA; CRS; OECD TP Guidelines; `ORG-TAX-*` [register: route to Mira if `ORG-TAX-*` codes not yet populated] |

Two further dimensions are noted but governed by parent policies and consumed as references rather than re-attested:

- **Trading-mandate consistency** (Saskia + Helena) — the new product must sit inside the Trading Mandate (B5; under refinement). The NPA cycle does not re-author mandate scope; it cites the mandate version that authorises the product class.
- **Strategic-foundation consistency** (Saskia, with CEO concurrence) — the new product must be consistent with `project_strategic_foundation.md`. If not, the foundation is amended first; the NPA cycle re-enters at stage 1 against the amended foundation.

## 6. Approval authority

- **BRC** is the primary approval authority for each new product, on the cadence and quorum specified in the Governance Framework. BRC reads the dimension attestations, the conditions list, and the controlled-launch limits, and votes.
- **CEO** approves first-product attestations during the interim period (until BRC is constituted post-licence-day per `D-THIN-HUMAN-LAYER-MINIMUM`), and ratifies any conditions BRC attaches in steady state. The CEO is also the emergency-retirement decision-maker (see §9).
- **Board** is a Board-Reserved Matter where the new product:
  - opens a new asset class outside the strategic-foundation scope;
  - involves entry into a new jurisdiction;
  - constitutes the bank's first FAIS-licensed activity;
  - constitutes the bank's first Cat II / IIA discretionary mandate; or
  - in BRC's judgement, materially changes the risk profile of the franchise.

  Board-route items are challenged by peers before approval per `feedback_ceo_vs_board_approval.md` (Marc currently wears both CEO and Board hats interim).

The `approvalAuthority` payload field on `ProductApproved` records which authority cleared the product (`BRC`, `CEO-interim`, `Board`).

## 7. Controlled-launch limits

Every approved product enters service under a controlled-launch envelope that is more restrictive than steady-state appetite. Default shape:

- **Period** — 90 calendar days from `ProductLaunched` event. BRC may extend at approval (e.g. 180 days for higher-complexity products); BRC may shorten at PIR.
- **Volume cap** — gross notional limit set at a fraction (default 25%) of the steady-state RAS envelope for the product's risk type.
- **Counterparty-count cap** — first N distinct counterparties (default 5) before any extension; broadens stepwise as PIR-style milestones close.
- **Single-trade size cap** — maximum notional per trade (default 25% of the volume cap).
- **Risk envelope reduction** — market-risk and credit-risk envelopes set to 50% of the eventual steady-state envelope for the product class, with breach immediately escalating.
- **Daily monitoring report** — to BRC chair, CEO, Helena, Camille, Saskia, Devon. Reports the day's flow, the cap-utilisation, any incidents, any conditions-tracking deltas. Generated as a query over the Product Register (Principle 1, Principle 6).
- **Breach-trigger escalation** — any cap breach triggers an escalation event to BRC chair within the same trading day; two breaches in the controlled-launch window halt new transactions in the product pending BRC review.
- **Mandatory PIR** — the post-implementation review at 90 days (or extended period) is mandatory; no product exits controlled launch without a tabled PIR.

BRC may set bespoke limits at approval where the default shape does not fit the product (e.g. illiquid bond inventory may need a different cap structure). Any departure from default is recorded in the `controlledLaunchLimits` payload of `ProductApproved`.

## 8. Post-implementation review

The PIR is the gate that ends controlled launch. It is convened by Saskia + Devon at end of the controlled-launch period (or earlier on BRC instruction) and produces a tabled report.

PIR coverage:

- **Did the gates hold?** Each of the 14 dimensions is re-checked: the dimension owner attests whether the original `cleared` / `cleared-with-conditions` verdict still stands. Where it does not, a re-attestation event fires (`ProductDimensionAttested`).
- **Did operational readiness hold?** Devon attests the operational substrate — settlement, reconciliation, lifecycle handling — performed as expected; cites incident records.
- **Were there incidents?** Senna (security), Tomas (settlement), and the relevant first-line attest the incident record over the controlled-launch window. Severity-1 / Severity-2 incidents must be addressed in the verdict.
- **Are the conditions still right?** Saskia tables proposed condition deltas (additions, removals, amendments).
- **Did the economic profile match conceptualisation?** Camille (with Bea) attests P&L, capital usage, and FTP attribution against the conceptualisation expectations. Material divergence is itself a finding.

PIR verdict (`ProductPostImplementationReviewCompleted.verdict`):

- `continue` — limits removed or relaxed to steady-state; product moves to stage 7.
- `continue-with-amended-conditions` — limits adjusted, conditions amended; product moves to stage 7 under the amended envelope.
- `retire` — product is retired (stage 8); open positions migrate per `Procedures/by-policy/product-retirement-migration.md`.

The PIR is itself an attestation gate — a `withheld` PIR halts the product at controlled-launch limits until BRC reviews.

## 9. Retirement

Triggers for retirement:

- **BRC vote** — BRC determines the product no longer fits the franchise.
- **Regulator instruction** — PA, FSCA, or another regulator with jurisdiction directs retirement.
- **Operational impossibility** — substrate, vendor, or counterparty path is no longer available and cannot be restored at acceptable cost.
- **Trading-mandate amendment** — Board-approved mandate change removes the product class.
- **Strategic-foundation amendment** — CEO + Board amendment removes the product family.
- **Emergency retirement** — CEO may direct emergency retirement where continued operation poses immediate risk (security, reputational, regulatory); BRC ratifies at the next sitting.

Retirement output: `ProductRetired { productId, retirementAuthority, retirementReason, openPositionsMigrationPlanId, asOf }`. Open positions are migrated per the named migration procedure; settlement, accounting, FTP, capital, and reporting events flush through the substrate. The product remains in the Product Register with status `retired` for record-keeping purposes (Conduct Standard 3/2018 §12 — record-keeping ≥ 5 years).

## 10. Procedure binding (Principle 6)

The policy is operationalised through the procedures listed below. Each procedure cites this policy as its parent. Procedures are owned per the line shown; each owner's mandate covers the procedure (Principle 6: no orphan procedures).

| Procedure | Owner | Status | Function |
|---|---|---|---|
| `Procedures/by-policy/new-product-due-diligence.md` | Saskia + Devon | PLANNED | Stage-3 substantive cycle; orchestrates the 14 dimensional attestations |
| `Procedures/by-policy/product-controlled-launch.md` | Saskia | PLANNED | Stage-5 controlled-launch limit administration; daily monitoring report; breach escalation |
| `Procedures/by-policy/product-post-implementation-review.md` | Saskia + Devon | PLANNED | Stage-6 PIR convening, evidence collection, BRC paper |
| `Procedures/by-policy/product-retirement-migration.md` | Saskia | PLANNED | Stage-8 open-position migration; substrate flush; record-keeping |
| `Procedures/by-policy/product-annual-review.md` | Saskia | PLANNED | Stage-7 annual re-attestation cycle |

Cross-referenced procedures (consumed as gates by the cycle, not authored under this policy):

- `Procedures/by-policy/pre-trade-conduct-gate.md` — Zara — first-trade conduct check on new product
- `Procedures/by-policy/dealer-mandate-issuance.md` — Saskia — dealer authorisation extension to new product
- `Procedures/by-policy/model-validation.md` — Nadia — Tier-classification + validation cycle (dimension 10)
- `Procedures/by-policy/sanctions-screening.md` — Mira — sanctions-coverage extension (dimension 9)
- `Procedures/by-policy/counterparty-onboarding-markets.md` — Saskia + Imani — master-agreement coverage (dimension 11)
- `Procedures/by-policy/threat-modelling-gate.md` — Senna — threat-model attestation (dimension 12)
- `Procedures/by-policy/ifrs-classification-gate.md` — Bea — IFRS 9 / 13 / IAS 21 classification (dimension 6)

## 11. Typed-event surface

The policy creates and consumes the following typed events. Atlas owns the formal schema in a follow-on substrate slice; the parallel construction-substrate brief (`Owner Inbox/2026-05-10_*_product-construction-substrate.md`) covers the primitive composition layer that produces the typed Product these events reference.

**Stage-boundary events:**

- `ProductProposalRegistered` — stage 1
- `ProductConceptualised` — stage 2
- `ProductDueDiligenceCompleted` / `ProductDueDiligenceWithheld` — stage 3
- `ProductApproved` / `ProductWithheld` — stage 4
- `ProductLaunched` — stage 5
- `ProductPostImplementationReviewCompleted` — stage 6
- `ProductReviewCompleted` — stage 7 (annual)
- `ProductRetired` — stage 8

**Per-dimension attestation events (one per gate cleared, fired during stage 3 and re-fired at PIR, annual review, or material change):**

- `ProductDimensionAttested { productId, dimension, result, citationChain, evidenceUri, asOf }` — where `dimension` enumerates the §5 gates: `market-risk`, `credit-risk`, `liquidity-funding`, `operational-risk`, `operational-readiness`, `accounting`, `capital`, `conduct-suitability`, `aml-sanctions-pep`, `model-risk`, `legal-documentation`, `information-security`, `privacy`, `tax`.

**Lifecycle limit events (during controlled launch):**

- `ProductControlledLaunchBreach { productId, capName, observedValue, capValue, asOf }`
- `ProductControlledLaunchHalt { productId, reason, asOf }`
- `ProductControlledLaunchAmended { productId, amendedLimits, authority, asOf }`

The Product Register projection (Anya) is a query over the above (Principle 1). BRC, CEO, Helena, Camille, Saskia, and Devon read the projection.

## 12. Authority block + citation chain

This policy implements:

- **BCBS Sound Practices for the Management of Operational Risk** (rev. 2021), §27 — new product approval.
- **Banks Act 94 of 1990** + **Regulations Relating to Banks** (Reg 39 — operational risk).
- **FSCA Conduct Standards 1, 2, 3 of 2018** — particularly Conduct Standard 3/2018 §§3–9 — pre-trade dimensional coverage for OTC derivative providers.
- **FIC Act 38 of 2001** — counterparty CDD on first transaction in any new product; sanctions screening; transaction-monitoring rule extension.
- **IFRS 9 / IFRS 13 / IAS 21** — accounting-classification gate (dimension 6).
- **POPIA 4 of 2013** — privacy gate (dimension 13).
- **CLAUDE.md** — Principle 1 (events as truth — every gate emits typed events); Principle 2 (every gate carries a citation); Principle 4 (security designed-in — dimension 12 mandatory); Principle 5 (multi-currency / -entity / -jurisdiction — dimensions 1–14 all carry these axes); Principle 6 (single-graph — policy → procedure → system capability chain enforced); Principle 7 (autonomous-by-default — gates are agent-attested, not committee theatre).

Internal-decision authorities:

- `D-MARKETS-SCHEMA-FOUNDATION` (CEO authority for the markets stack — Saskia + Kai).
- `D-S7-TARGETED-3-5` (CEO authority for current critical path — gateway, dispatcher, validation).
- `D-THIN-HUMAN-LAYER-MINIMUM` (governance authority routing during the build phase).
- `D-NEW-PRODUCT-APPROVAL-POLICY` (this decision — CEO approval to transition PLANNED → IN FORCE).

Obligations register cross-references (Domain J — markets; Domain M — OTC Derivative Provider; Domain A — prudential; Domain B — AML; Domain C — conduct):

- `ORG-MK-01..08` — markets / FMA / ISDA / GMRA / Excon
- `ORG-CS1-001..006` — Conduct Standard 1/2018
- `ORG-CS2-001` — Conduct Standard 2/2018 (trade reporting)
- `ORG-CS3-001..009` — Conduct Standard 3/2018 (pre-trade conduct)
- `ORG-PR-02..19` — prudential (capital, liquidity, large exposures, op risk, op resilience, market risk)
- `ORG-AML-*`, `ORG-SAN-*` — AML / sanctions [register: route to Mira for any newly-required codes]
- `ORG-CD-01..07` — conduct / FAIS / TCF
- `ORG-CY-*` — cybersecurity / Joint Standard 1 of 2024

## 13. Change log

| Version | Date | Author | Change |
|---|---|---|---|
| v1.0 | 2026-05-10 | Saskia (lead); Helena, Camille, Zara, Mira, Nadia, Senna, Imani, Devon, Bea (contributors) | Initial issue. Eight stages, fourteen due-diligence dimensions, BRC primary approval (CEO interim), event-typed throughout. Transitions PLANNED → IN FORCE on CEO approval `D-NEW-PRODUCT-APPROVAL-POLICY`. |

—Saskia (Head of Global Markets — franchise & governance)
