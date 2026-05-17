---
agent: Mira
trigger: ws-instrument-analyses-confirmed-directive-rows
asOf: 2026-05-16T00:00:00.000Z
decision-required: false
tags: [obligations-register, ws-instrument-analyses, new-rows]
---

# WS-INSTRUMENT-ANALYSES Task C — New register rows for 15 confirmed 2014–2020 PA Directives

**Author:** Mira (Compliance / RegTech engineer, engineering — reports to Zara (Chief Compliance Officer, governance))
**Register version:** bumped from v1.27 → v1.28
**Source research:** WS-INSTRUMENT-ANALYSES Task C (PR #445) — confirmed topics for 15 previously-untyped PA Directives via SARB publication pages.

---

## Summary

Of the 15 confirmed directives, **6 warranted new register rows** (ORG-PR-61 through ORG-PR-66). The remaining **9 were assessed as not applicable, superseded by instruments already in the register, or transitional/expired** — see the skip rationale section below.

All 6 new rows carry `[citation: TBC — Survey URL: ...]` markers. The `sarb:pdf-extract` tool was unavailable in-session (not present in `prototype/package.json`). PDF text extraction for precise §-references is routed as a follow-on item to Imani (Legal-as-code engineer, engineering) under the standing `WS-INSTRUMENT-ANALYSES` workstream.

---

## Rows added (6 new rows, Domain A)

### ORG-PR-61 — D7/2015: Restructured credit exposures
- **Instrument:** PA Directive 7 of 2015
- **Rationale:** Applicable — the bank will hold credit exposures (bond inventory, OTC IRD counterparty credit, repos). Restructured credit classification rules bind any bank with credit book. Not superseded by any later directive currently in the register.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2015/6716/D7-2015-Directive-Restructured-credit-exposures.pdf]`
- **Downstream gap:** Policy gap — `restructured-credit-exposures.md` procedure stub needed (route to Helena + Bea).

### ORG-PR-62 — D8/2016: Outsourcing reporting (material and critical third-party service providers)
- **Instrument:** PA Directive 8 of 2016 (supersedes D8/2015)
- **Rationale:** Applicable — the bank uses (and will use) third-party service providers including cloud vendors, market-data vendors, and technology platforms. D8/2016 requires PA notification of material outsourced and critical third-party service providers. This is distinct from the operational resilience obligation (ORG-PR-45 / D4/2023) and the cloud-computing notification obligation (ORG-PR-55 / D3/2016) — D8/2016 covers the *reporting register* of all material and critical third parties, not just cloud.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2016/7602/D8-2016-Reporting-material-outsourced-service-providers.pdf]`
- **Downstream gap:** Third-party register population is a build-phase deliverable for Devon + Senna.

### ORG-PR-63 — D3/2017: Assets lodged or pledged to secure liabilities (encumbered assets)
- **Instrument:** PA Directive 3 of 2017
- **Rationale:** Applicable — the bank pledges collateral for OTC derivative margin (ISDA/CSA), repo transactions (GMRA), and potentially JSE Clear clearing margin. Asset encumbrance reporting is a core prudential obligation for any trading bank. Not superseded.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2017/7959/D3-2017-Assets-lodged-or-pledged-to-secure-liabilities.pdf]`
- **Downstream gap:** Procedure stub `pledged-assets-encumbrance-reporting.md` needed (route to Eitan + Bea).

### ORG-PR-64 — D6/2017: Capital issuances and redemptions
- **Instrument:** PA Directive 6 of 2017 (replaces D3/2014)
- **Rationale:** Applicable at licence-day — the bank will need to issue AT1 and Tier 2 capital instruments to meet capital requirements post-licence. The PA approval/non-objection process is a licence-day obligation. Status = PLANNED, bind-trigger = licence-day.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2017/8101/D6-2017-Capital-issuances-and-redemptions.pdf]`
- **Downstream gap:** Capital Issuance Policy and procedure stub needed (route to Camille + Owen).

### ORG-PR-65 — D2/2018: Materiality threshold for foreign jurisdiction exposure in CCyB
- **Instrument:** PA Directive 2 of 2018
- **Rationale:** Applicable — the bank will hold foreign-jurisdiction credit exposures (OTC IRD with non-SA counterparties, bond inventory in non-SA issuers, FX). The CCyB institution-specific rate calculation must correctly apply the D2/2018 materiality threshold to exclude immaterial foreign jurisdictions. Not superseded.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-deposit-takers/banks-directives/2018/8705/D2-2018-Materiality-threshold-CCyB.pdf]`
- **Downstream gap:** Folds into `capital-framework-basel-iii.md` procedure stub (route to Camille + Helena).

### ORG-PR-66 — D7/2020: SA-CCR methodology for derivative exposure in leverage ratio
- **Instrument:** PA Directive 7 of 2020
- **Rationale:** Applicable — the bank transacts OTC IRD and FX derivatives. The leverage ratio must use SA-CCR (not CEM) per D7/2020. Distinct from the broader capital framework (ORG-PR-37 / D5/2021) which covers capital ratios. D7/2020 specifically mandates the SA-CCR methodology for the *leverage ratio* exposure measure.
- **Citation status:** `[citation: TBC — Survey URL: https://www.resbank.co.za/content/dam/sarb/publications/prudential-authority/pa-banks/banks-directives/2020/D7-2020-Calculation-of-derivative-exposure-amount-for-the-purposes-of-determining-the-leverage-ratio.pdf]`
- **Downstream gap:** `leverage-ratio-sa-ccr.md` procedure stub needed (route to Rohan + Camille).

---

## Directives skipped (9 instruments — rationale)

| Directive | Confirmed topic | Skip reason |
|---|---|---|
| D2/2014 | IRB changes for credit risk capital | **NOT_APPLICABLE to bank profile.** Bank uses Standardised Approach (SA) for credit risk, not IRB. IRB requires PA approval and is not in scope for the bank's current or near-term capital strategy. No row added. |
| D6/2014 | Liquidity risk and LCR | **Superseded + already covered.** LCR obligation is in the register via ORG-PR-06 (BCBS D295 / BA 325) and ORG-PR-36 (D6/2015 revised LCR). D6/2014 is the precursor instrument whose requirements were updated by D6/2015. No additional row. |
| D8/2014 | LCR compliance | **Superseded + already covered.** Same basis as D6/2014 — the LCR compliance requirements flow through ORG-PR-06 and ORG-PR-36. D8/2014 set early compliance timelines that are now historical. No row added. |
| D4/2015 | Amendments to the Regulations relating to Banks | **Transitional/procedural — not a free-standing obligation generator.** D4/2015 is an amending instrument that updated the Regulations Relating to Banks text. The substantive obligations flow from the amended Regulations themselves (already captured via ORG-PR-01 to ORG-PR-09 and other Regs-anchored rows). An amending directive is not itself an independent register row. |
| D8/2015 | Outsourcing reporting (material and critical third parties) | **Superseded by D8/2016.** D8/2016 (added as ORG-PR-62) explicitly supersedes D8/2015. No row for the superseded instrument. |
| D10/2015 | AMA operational risk management and measurement | **NOT_APPLICABLE to bank profile.** Bank uses the Standardised Approach (SA) for operational risk, not the Advanced Measurement Approach (AMA). AMA is an opt-in approach requiring PA model approval. |
| D11/2015 | Revised Pillar 3 disclosure requirements | **Superseded — already in register.** D11/2015 is largely superseded by D10/2025 (as noted in the dispatch brief). ORG-PR-28 covers D10/2025; ORG-PR-52 covers D2/2014 (the foundational Pillar 3 instrument). The D11/2015 intermediate revision does not generate a separate obligation distinct from what ORG-PR-28 covers. |
| D3/2016 | Parallel-run process (Basel III) | **Transitional/expired.** D3/2016 governed the parallel-run period for Basel III implementation — banks ran the old and new frameworks simultaneously. This transitional arrangement has expired; Basel III is now fully in force. The substantive obligations are captured in ORG-PR-37 (D5/2021 capital framework) and related rows. No row added. |
| D4/2018 | Sound corporate governance — appointment of directors and executive officers | **Superseded — already in register.** D4/2018 is the predecessor instrument to D7/2022 (Banks CBC Directive on directors and executive officers). ORG-PR-42 already covers D7/2022, which replaces D4/2018 on the same subject matter. The current obligation is discharged through D7/2022 / ORG-PR-42. |

---

## Citation status summary

- **New TBC markers introduced:** 6 (one per new row — all Survey URLs confirmed; §-level citations pending Imani PDF extraction)
- **Existing TBC markers resolved:** 0 (this run adds rows; citation resolution is a separate WS-INSTRUMENT-ANALYSES sub-task)

---

## Downstream policy and procedure gaps flagged

The following procedure stubs are needed (not yet present in `Procedures/by-policy/`):

1. `restructured-credit-exposures.md` — D7/2015 (route to Helena + Bea)
2. `pledged-assets-encumbrance-reporting.md` — D3/2017 (route to Eitan + Bea)
3. `capital-issuances-redemptions.md` — D6/2017 (route to Camille + Owen)
4. `leverage-ratio-sa-ccr.md` — D7/2020 (route to Rohan + Camille)

The following existing planned stubs should absorb new row coverage:

- `capital-framework-basel-iii.md` — extend to cover D2/2018 CCyB materiality threshold (route to Camille + Helena)
- `outsourcing-of-functions.md` — extend to cover D8/2016 PA notification register (route to Devon + Senna)
