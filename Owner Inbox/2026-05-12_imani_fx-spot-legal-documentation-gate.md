---
title: "FX Spot — legal-documentation gate attestation"
author: Imani (legal-as-code engineer, engineering)
date: 2026-05-12
decision-required: false
product: prd:bank:fx:fx-spot-zar-usd
gate: legal-documentation
result: cleared-with-conditions
---

# FX Spot — legal-documentation gate attestation

**From:** Imani (legal-as-code engineer, engineering)
**To:** Marc (CEO) — via Scrooge (Chief of Staff)
**Gate:** legal-documentation (New Product Approval Policy §5, dimension 8)
**Product:** `prd:bank:fx:fx-spot-zar-usd`
**Result:** `cleared-with-conditions`
**Date:** 2026-05-12
**Policy authority:** `D-NEW-PRODUCT-APPROVAL-POLICY` (CEO-approved 2026-05-10)
**Substrate authority:** `D-PRODUCT-CONSTRUCTION-SUBSTRATE` (CEO-approved 2026-05-10)

---

## 1. Attestation summary

The legal-documentation gate for FX Spot (ZAR/USD) is **cleared-with-conditions**. All documentation architecture — templates, clause-library entries, procedure documentation, and citation chains — is ready in build-phase form. Execution of actual signed agreements with real counterparties is appropriately deferred to commencement-of-trading per the bank's build-phase vs licence-day discipline (CLAUDE.md Operating model §2).

Four conditions are registered below. No condition withholds go-live readiness — each reflects work that is deliberately staged to commencement-of-trading by design, not an architecture gap.

---

## 2. Documentation dimension assessments

### 2.1 ISDA Master Agreement (2002 form)

**Requirement.** An executed ISDA Master Agreement (2002 form) with each institutional counterparty is a prerequisite for any OTC FX trade. The ISDA Master is the ceiling document governing payment obligations, events of default, close-out netting, and the SA-bespoke Schedule overlay (Excon transfer-restriction acknowledgement, FinSurv attestation, SA tax gross-up, Banks Act §22 reciprocity, ZARONIA fallback consistency).

**Build-phase status:**

| Item | Status |
|---|---|
| 2002 ISDA Master template in clause library (SA-bank counterparty variant) | **planned — architecture defined** (see `Owner Inbox/2026-05-07_imani_isda-readiness-deep-dive-priority-a.md` §5, template #1) |
| SA-bespoke Schedule overlay — 12 clause-library entries specified | **specified** (§4 of the ISDA-readiness deep-dive, covering Excon, FinSurv, SA tax gross-up, tax-exempt variant, Banks Act §22, mandate-as-manager, FAIS, ZARONIA fallback, SOE overlay, JSE/Strate overlay, POPIA processing, FIC CDD) |
| FX Spot confirmation template (#12 in bilateral-template inventory) | **planned — architecture defined** (§5, template #12) |
| Execution procedure for counterparty onboarding | **documented** — Niko (Sales, CRM) counterparty-onboarding pipeline; Mira (RegTech compliance engineer) CDD / KYC workflow; Imani legal-side overlay |
| Signed ISDAs with real counterparties | **deferred to commencement-of-trading** — Niko paused per build-phase model; first `MasterAgreementSigned` event fires at licence-day |

**Result:** ✓ Template architecture and clause library ready. **Condition 1 registered** (signed ISDAs deferred — see §3).

**Citation:** ISDA Master Agreement (2002 form); Banks Act 94 of 1990 s.22; `ORG-CS3-001` (written trading-relationship agreement — OTC Derivative Provider Conduct Standard 3 of 2018 §3).

---

### 2.2 2006 ISDA FX and Currency Option Definitions

**Requirement.** The 2006 ISDA FX and Currency Option Definitions govern the contractual terms for FX Spot, Forward, and Swap transactions executed under the ISDA Master Agreement framework. Incorporation by reference into the ISDA template is the standard mechanism.

**Build-phase status:**

| Item | Status |
|---|---|
| 2006 ISDA FX Definitions incorporated by reference in ISDA template | **specified** — each FX Spot confirmation template (#12) and FX Forward/Swap templates (#13, #14) in the bilateral-template inventory carries the standard "This Confirmation supplements and forms part of, and is subject to, the ISDA Master Agreement ... and is subject to the 2006 ISDA FX and Currency Option Definitions" adoption language |
| FX Spot settlement convention (T+2 value date) documented | **specified** in the product conceptualisation (`Owner Inbox/2026-05-07_saskia-kai_fx-product-family.md`; product ID `prd:bank:fx:fx-spot-zar-usd`) |

**Result:** ✓ Incorporated by reference in the ISDA template. No separate condition required — this item clears unconditionally as a template-architecture matter.

**Citation:** 2006 ISDA FX and Currency Option Definitions (ISDA publication); ISDA Master Agreement (2002 form) §1(c) (Interpretation / Definitions).

---

### 2.3 SARB Authorised Dealer mandate letter

**Requirement.** The bank holds Full Authorised Dealer (AD) status under the Currency and Exchanges Act 9 of 1933 and the Currency and Exchanges Manual for Authorised Dealers, as established by `D-FX-AD-STATUS` (CEO-approved 2026-05-07). A current SARB mandate letter confirming the scope of the bank's AD authority must be held before any ZAR/foreign cross-border FX trade is executed.

**Build-phase status:**

| Item | Status |
|---|---|
| AD status decision record | **approved** — `D-FX-AD-STATUS` (CEO-approved 2026-05-07); the bank's AD posture is load-bearing substrate now |
| SARB mandate letter execution | **deferred to pre-commencement** — AD mandate letter is issued by SARB in connection with the licence; obtainable after SARB licence lodgment and before commencement of trading. Timing co-owned with Devon (COO, operational readiness) and the external-counsel panel (pending `D-EXTERNAL-COUNSEL`) |
| FinSurv reporting registration | **deferred** — AD-specific FinSurv reporting obligations activate on commencement; Mira (RegTech compliance engineer) owns the operational onboarding with SARB FinSurv |

**Result:** ✓ AD status is decided; mandate letter execution is a well-defined pre-commencement deliverable. **Condition 2 registered** (mandate letter execution — see §3).

**Citation:** Currency and Exchanges Act 9 of 1933; Currency and Exchanges Manual for Authorised Dealers (FinSurv rolling publication); `D-FX-AD-STATUS`; `ORG-EXCON-ODP-001`.

---

### 2.4 FinSurv per-trade category declaration form

**Requirement.** The Currency and Exchanges Manual (Excon) imposes a per-trade documentation obligation on the bank as Authorised Dealer: for each ZAR-denominated FX trade, the bank must obtain and record the counterparty's stated purpose and FinSurv category. This is not a one-time onboarding step — it is a per-trade obligation that runs for every FX Spot ticket.

**Build-phase status:**

| Item | Status |
|---|---|
| Per-trade FinSurv category declaration procedure | **documented** — the Excon transfer-restriction acknowledgement (Clause 1 of Imani's 12 SA-bespoke clause entries) and the FinSurv reporting attestation overlay (Clause 2) together specify the bilateral and per-trade obligations; procedure references are co-owned with Mira (RegTech compliance engineer) |
| ISDA Schedule — FinSurv attestation overlay | **specified** — Clause 2 (FinSurv attestation overlay) in the bilateral Schedule template; symmetric AD-AD treatment for SA bank counterparties; asymmetric drafting for non-AD corporates |
| Operational execution — per-trade capture in trading platform | **deferred to commencement-of-trading** — FinSurv category declaration is operationalised through the trade-capture workflow (Kai, trading systems engineer); Devon (COO) owns the operational-readiness gate for that workflow |
| Audit-trail and regulatory reporting | **deferred** — FinSurv reporting chain activates on first live trade; Atlas (core banking platform architect) owns the event-sourced FinSurv reporting substrate |

**Result:** ✓ Procedure documented; bilateral clause-library entry specified. **Condition 3 registered** (operational execution and per-trade capture deferred to commencement-of-trading — see §3).

**Citation:** Currency and Exchanges Manual for Authorised Dealers, Section B (FinSurv reporting requirements); Currency and Exchanges Act 9 of 1933; `ORG-EXCON-ODP-001`.

---

### 2.5 CSA (Credit Support Annex)

**Requirement.** A Credit Support Annex is required for FX trades with ongoing MTM exposure. FX Spot T+2 has a minimal two-business-day MTM window; however, a CSA must be in place for the same counterparty where that counterparty is also a counterparty for other OTC products (IRS, FX Forward/Swap) carrying longer MTM windows. The gate clears if: (a) a CSA is in place, or (b) an explicit IM/VM waiver is documented by Helena (CRO) and on the counterparty credit file.

**Build-phase status:**

| Item | Status |
|---|---|
| VM-CSA template (Joint Standard 2 of 2020 compliant, ZAR-collateralised) | **planned — architecture defined** (§5, template #7 in bilateral-template inventory) |
| VM-CSA template (USD-collateralised variant for foreign-bank-branch bilaterals) | **planned — architecture defined** (§5, template #8) |
| IM-CSA template (BCBS-IOSCO Phase-6 / Joint Standard 2 of 2020 compliant) | **planned — architecture defined** (§5, template #9) |
| FX Spot standalone — IM/VM waiver procedure (T+2 MTM window) | **specified** — Helena (CRO) holds the counterparty-credit-risk gate; waiver is a Helena-owned counterparty-credit decision captured in the CCR register |
| Counterparty-specific CSA execution | **deferred to commencement-of-trading** — mirrors ISDA deferral; first CSA execution is part of counterparty-onboarding at licence-day |
| Joint Standard 2 of 2020 compliance | **template-level** — the VM-CSA shell incorporates the SA Joint Standard 2 of 2020 VM-election mechanics; regulatory compliance is binding from commencement-of-trading |

**Result:** ✓ Templates and waiver procedure defined. **Condition 4 registered** (counterparty-specific CSA execution or explicit IM/VM waiver deferred to commencement-of-trading — see §3).

**Citation:** SARB / FSCA Joint Standard 2 of 2020 (Margin requirements for non-centrally cleared OTC derivative transactions); `ORG-CS3-001` (OTC Derivative Provider Conduct Standard 3 of 2018); ISDA 2016 Credit Support Annex for Variation Margin (VM CSA); BCBS-IOSCO Margin Requirements for Non-Centrally Cleared Derivatives (2015, rev. 2020).

---

## 3. Conditions register

The gate result is `cleared-with-conditions`. All four conditions are commencement-of-trading prerequisites; none blocks build-phase product-architecture work.

| # | Condition | Owner | Timing |
|---|---|---|---|
| C1 | Signed ISDA Master (2002 form) with each counterparty — template ready; execution deferred | Imani (legal-as-code engineer) + Niko (Sales, CRM) + Saskia (Head of Global Markets) | Commencement-of-trading prerequisite |
| C2 | SARB AD mandate letter execution — AD status approved; mandate letter obtainable post-licence-lodgment | Devon (COO, operational readiness) + Mira (RegTech compliance engineer) + external-counsel panel | Pre-commencement prerequisite |
| C3 | Per-trade FinSurv category declaration — operational procedure and per-trade trade-capture workflow | Kai (trading systems engineer) + Mira (RegTech compliance engineer) + Devon (COO) | Commencement-of-trading prerequisite |
| C4 | Counterparty-specific CSA execution or explicit IM/VM waiver documented by Helena (CRO) | Imani (legal-as-code engineer) + Helena (CRO) | Commencement-of-trading prerequisite |

---

## 4. Attestation event payload

```typescript
// ProductDimensionAttested — legal-documentation gate
// Emitted under: D-NEW-PRODUCT-APPROVAL-POLICY §4 stage 3 (due diligence)
const LEGAL_DOCUMENTATION_ATTESTATION = {
  dimension: "legal-documentation-gate",
  result: "cleared-with-conditions",
  attestedBy: "Imani (legal-as-code engineer, engineering)",
  attestedAt: "2026-05-12T00:00:00.000Z",
  rationale:
    "All legal-documentation templates, clause-library entries, and procedures for FX Spot ZAR/USD are architecture-ready in build-phase form; execution of signed agreements with real counterparties is appropriately staged to commencement-of-trading per the bank's build-phase discipline.",
  citationChain: [
    "D-NEW-PRODUCT-APPROVAL-POLICY",
    "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    "D-FX-AD-STATUS",
    "ORG-EXCON-ODP-001",
    "ORG-CS3-001",
  ],
  conditions: [
    "Signed ISDA Master (2002) with each counterparty — deferred to commencement-of-trading",
    "SARB AD mandate letter execution — deferred to pre-commencement",
    "Per-trade FinSurv category declaration operational procedure — deferred to commencement-of-trading",
    "Counterparty-specific CSA execution — deferred to commencement-of-trading",
  ],
};
```

---

## 5. Citation chain

| Citation | Role in gate |
|---|---|
| `D-NEW-PRODUCT-APPROVAL-POLICY` | Policy authority for the legal-documentation gate dimension |
| `D-PRODUCT-CONSTRUCTION-SUBSTRATE` | Substrate authority for product attestation seam |
| `D-FX-AD-STATUS` | CEO decision establishing the bank's Full AD status (2026-05-07) |
| ISDA Master Agreement 2002 | Governing framework for OTC FX with institutional counterparties |
| 2006 ISDA FX and Currency Option Definitions | Contractual terms governing FX Spot, Forward, Swap under the ISDA Master |
| Banks Act 94 of 1990 | SA banking licensing framework; s.22 bilateral reciprocity |
| Currency and Exchanges Act 9 of 1933 | Statutory basis for AD regime and Excon |
| Currency and Exchanges Manual (Excon) | Operational AD obligations including per-trade FinSurv category declarations |
| `ORG-EXCON-ODP-001` | Obligations register entry for Excon AD operational obligations |
| `ORG-CS3-001` | Written trading-relationship agreement obligation (OTC Derivative Provider Conduct Standard 3 of 2018 §3) |
| SARB / FSCA Joint Standard 2 of 2020 | Margin requirements — CSA / VM-CSA / IM-CSA gate |

---

*Imani (legal-as-code engineer, engineering) — FX Spot legal-documentation gate attestation, 2026-05-12. Build-phase legal output; not legal advice. No live counterparty contact, no privileged communications. All architecture assessments derive from approved decision records and internal design documents.*
