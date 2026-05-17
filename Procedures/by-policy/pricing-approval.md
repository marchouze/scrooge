---
status: POPULATED
---
# Procedure — Pricing approval (new product / re-pricing)

**Procedure ID:** PROC-CD-01
**Owner:** Niko (sales / CRM) · Helena (risk-aligned pricing) · Eitan (cost of funds via FTP) · Camille (capital cost) · Zara (conduct / TCF)
**Approval:** BRC for material new products / re-pricings; Niko + Eitan + Helena + Camille for in-policy pricing within mandate
**Cadence:** Per product launch / re-pricing event; standing review annually
**Version:** v1.0 — 2026-05-06
**Status:** Approved (post Round 2; system capability `PLANNED`)

## 1. Source policy

`Owner Inbox/2026-05-06_policy-register.md` §10 — Pricing Policy.
`Owner Inbox/2026-05-06_core-policies-finance.md` §6 — FTP Methodology Policy.
`Owner Inbox/2026-05-06_core-policies-compliance-privacy.md` §5 — Conduct of Business / TCF Policy.

## 2. Source regulation(s)

| Citation | Requirement |
|---|---|
| `ORG-CD-01` (FAIS Act + FSCA conduct standards) | TCF outcomes operationalised in pricing. |
| `ORG-CD-06` (FAIS + FSCA) | Fee disclosure transparency. |
| `ORG-PR-04` (RAS B2) | Capital buffer maintained — pricing must respect capital cost. |
| `ORG-PR-19` (BCBS Market Risk) | Trading-book pricing aligned with market-risk discipline (where relevant). |
| Internal | FTP attached to every product event (no products without FTP). |

## 3. Purpose

Every product price (new product or material re-pricing) is set with explicit visibility of cost-of-funds (FTP), capital cost, expected loss, operational cost, and conduct / TCF implications, with cross-functional sign-off and customer-facing transparency.

## 4. Trigger

- **New product launch:** triggered by a `NewProductProposed` event from Niko (or markets via Saskia).
- **Re-pricing:** material re-pricing triggered by a `RePricingProposed` event (driven by funding curve shifts, capital-cost re-baselining, regulatory change, or conduct-driven adjustment).
- **Standing review:** annual review of all in-force prices against current cost stack.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Niko (or Saskia for markets) submits the proposal: target customer segment, product structure, proposed price | `human` (proposer) | `@domains/pricing/proposal` (`PLANNED`) | Event: `PricingProposalSubmitted`. |
| 2 | FTP attribution: cost-of-funds applied per the FTP Methodology Policy (multi-curve: ZARONIA-first, liquidity premium, behavioural adjustments) | `system` | `@domains/treasury/ftp-engine` (`PLANNED`) | Event: `FTPApplied`. Eitan owns the methodology; Niko consumes the result. |
| 3 | Capital cost overlay: RWA × capital-cost rate (calibrated per the Capital Management Policy) | `system` | `@domains/capital/cost-overlay` (`PLANNED`) | Event: `CapitalCostApplied`. Camille owns the rate. |
| 4 | Expected-loss overlay (for credit / counterparty products): IFRS 9 ECL contribution at origination | `system` | `@domains/risk/ecl-overlay` (`PLANNED`) | Event: `ELApplied`. Helena owns. |
| 5 | Operational cost overlay (per-product opex allocation) | `system` | `@domains/finance/opex-allocation` (`PLANNED`) | Event: `OpExApplied`. Camille owns. |
| 6 | Compute "true price" (sum of overlays) and "margin" (proposed price − true price) | `system` | `@domains/pricing/margin-engine` (`PLANNED`) | Event: `MarginComputed`. |
| 7 | Conduct / TCF check: is the price fair and clearly disclosable? Are vulnerable-customer dimensions considered? | `human` (Zara, with Niko) | `@domains/conduct/tcf-checker` (`PLANNED`) | Event: `TCFCheckPassed`. Failure → re-work. |
| 8 | Mandate / policy check: within Pricing Policy thresholds? Within product mandate (markets only)? | `system` | `@domains/pricing/mandate-engine` (`PLANNED`) | Event: `PricingMandateCheckPassed`. Out-of-mandate → BRC. |
| 9 | Cross-functional sign-off: Niko (sales) + Eitan (FTP) + Helena (risk-adjustment) + Camille (capital) + Zara (conduct). For BRC-tier items: BRC awareness step | `human` (signatories) | `@platform/multi-sig` (`PLANNED`) | Event: `PricingApproved` with each signature; missing signature blocks. |
| 10 | Customer-facing disclosure published — fees, APR / yield, T&Cs, comparison of competing products where required | `system` | `@domains/customer/disclosure` (`PLANNED`) | Event: `PricingDisclosurePublished`. Marketing claims validated against this artefact (P6). |
| 11 | Pricing live in product systems; FTP attached to every product event from this point | `system` | `@domains/products/registry` + `@platform/event-store` ✓ | Event: `PricingLive`. |
| 12 | Post-launch monitoring: margin realisation, take-up, complaint patterns, conduct KRIs | `system` | `@domains/pricing/monitor` (`PLANNED`) | Continuous projection. Adverse pattern triggers Step 1 again. |

## 6. Reconciliation

- **Events produced:**
  - `PricingProposalSubmitted`, `FTPApplied`, `CapitalCostApplied`, `ELApplied`, `OpExApplied`, `MarginComputed`.
  - `TCFCheckPassed`, `PricingMandateCheckPassed`.
  - `PricingApproved` (with all required signatures).
  - `PricingDisclosurePublished`, `PricingLive`.
  - For markets: `MandateConsistencyConfirmed` (per Trading Mandate B5 when finalised).
- **Reconciliation check:**
  - No `PricingLive` without all of: FTP, Capital Cost, EL (where applicable), OpEx, TCF check, Mandate check, multi-sig approval, Disclosure.
  - Realised margin is reconciled monthly against expected margin; significant drift triggers re-pricing review.
  - Customer-facing marketing claims are validated against `PricingDisclosurePublished` content (P6 — claims derive from data, not authored).
- **Failure mode:** any check failure blocks `PricingLive`; the proposal returns to the proposer with structured findings.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| Pricing proposal + cost stack | Event log + document store | 7 years | High (commercial) |
| Multi-sig approval | Event log (cryptographic) | Permanent | High |
| Customer-facing disclosure | Document store + event hash | 7 years | Medium (public) |
| Realised-margin monitoring | Continuous projection | Permanent (P1) | High |
| Conduct check + reasoning | Event log | Permanent | High |

## 8. Manual steps

- **Step 1** (proposal) — Niko / Saskia commercial judgement.
- **Step 7** (TCF check) — Zara's conduct judgement.
- **Step 9** (sign-off) — human signatures (cross-functional).
- BRC awareness for material items — chair's discretion.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| FTP attribution wrong | Margin reconciliation drift | Eitan + Helena; potentially re-price within 30 days |
| TCF concern post-launch (complaints surge) | Post-launch monitoring | Zara → Niko; re-price or redesign |
| Capital cost mis-calibrated | Camille's monthly review | Camille re-bases; pricing review triggered |
| Marketing claim diverges from disclosure | Marketing-validation gate | Niko + Zara; immediate correction; potential conduct event |
| Out-of-mandate pricing went live | Mandate engine + Vera audit | BRC immediate; remediation event; potential mandate breach |
| Vulnerable-customer harm signal | Complaints + conduct KRIs | Zara → BRC + S&E |

## 10. Related procedures

- `marketing-claim-validation.md` (`PLANNED`) — downstream of `PricingDisclosurePublished`.
- `npa-gate.md` (`PLANNED`) — New Product Approval gate that this pricing procedure feeds.
- `complaints-handling.md` (`PLANNED`) — post-launch complaint signal.
- `ftp-attachment-on-product-event.md` (`PLANNED`) — operational FTP attachment.
- `ecl-staging-cycle.md` (`PLANNED`) — ECL impact on credit pricing.
- `mandate-attestation.md` (`PLANNED`) — markets-side mandate confirmation.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-06 | Niko + Eitan + Helena + Camille + Zara | Initial draft, pre-board reviewed jointly. |

## 12. Audit / assurance

- Vera samples new-product launches and material re-pricings; tests cost-stack integrity, sign-off completeness, disclosure accuracy.
- Annual external review of FTP methodology and capital-cost rates (when external auditor is appointed).
- Continuous-controls projection: % of in-force prices with full cost-stack reconciliation, average time-to-launch, complaint-rate-by-product reported to BRC quarterly.
