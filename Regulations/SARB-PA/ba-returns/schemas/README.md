# SARB PA BA Return Schemas — Definitive XSD Set

**Source:** SARB Prudential Authority — PA Transformation Programme (Umoja Phase 2)  
**Downloaded:** 2026-06-08  
**URL:** https://www.resbank.co.za/en/home/what-we-do/Prudentialregulation/PA-Transformation-Programme  
**Enabling instrument:** PA Directive 5 of 2025 (D5/2025) — *Returns to be submitted to the Prudential Authority*

Each ZIP contains:
- `<FORM>.xsd` — XML Schema Definition for client-side validation before machine-to-machine API submission (Umoja PA API)
- `SARB-Return - <FORM>.xlsx` — human-readable form template

These are **Plane A reference data** per `D-REGULATORY-ARCHITECTURE-TWO-PLANE`. No events are emitted; the XSDs are the canonical artefacts for submission-layer validation.

---

## Banking Returns (BA)

| Form | Description | Last updated | File |
|---|---|---|---|
| BA 100 | Capital adequacy | Oct 2025 | BA100.zip |
| BA 110 | Liquidity Coverage Ratio (LCR) | Jul 2025 | BA110.zip |
| BA 120 | Net Stable Funding Ratio (NSFR) | Jul 2025 | BA120.zip |
| BA 125 | Intraday liquidity monitoring | Jul 2025 | BA125.zip |
| BA 130 | Liquidity risk (other) | Jul 2025 | BA130.zip |
| BA 200 | Credit risk (standardised approach) | Jan 2026 | BA200.zip |
| BA 210 | Credit risk (IRB approach) | May 2026 | BA210.zip |
| BA 220 | Securitisation | Feb 2026 | BA220.zip |
| BA 300 | Operational risk | Mar 2026 | BA300.zip |
| BA 310 | Market risk — standardised approach (FX NOP; Reg 28 / Annexure 11A) | Oct 2025 | BA310.zip |
| BA 320 | Market risk — alternative/simplified standardised approach (Annexure 12A) | Jul 2025 | BA320.zip |
| BA 325 | Market risk — FRTB (Annexure 13A/13B) | Jul 2025 | BA325.zip |
| BA 330 | Interest rate risk in the banking book (IRRBB) | Oct 2025 | BA330.zip |
| BA 340 | Equity risk in the banking book | Oct 2025 | BA340.zip |
| BA 350 | Counterparty credit risk / derivatives | Jul 2025 | BA350.zip |
| BA 400 | Large exposures | Oct 2025 | BA400.zip |
| BA 410 | Concentration risk | Jul 2025 | BA410.zip |
| BA 420 | Leverage ratio | Jan 2026 | BA420.zip |
| BA 500 | Remuneration | Jul 2025 | BA500.zip |
| BA 501 | Remuneration (supplementary) | Feb 2026 | BA501.zip |
| BA 600 | Pillar 3 disclosure | May 2026 | BA600.zip |
| BA 610 | Pillar 3 disclosure (supplementary) | May 2026 | BA610.zip |
| BA 700 | Capital adequacy and leverage (monthly aggregate) | May 2026 | BA700.zip |
| BA 701 | Capital adequacy and leverage (supplementary) | May 2026 | BA701.zip |
| BA 900 | Statistical / balance-sheet return | May 2026 | BA900.zip |
| BA 920 | Income statement | Oct 2025 | BA920.zip |
| BA 930 | Off-balance-sheet items | Oct 2025 | BA930.zip |
| BA 94x | Related-party / group return family | Nov 2025 | BA94x.zip |

## Market Risk (supplementary)

| Form | Description | Last updated | File |
|---|---|---|---|
| CVA | Credit Valuation Adjustment capital | Nov 2025 | CVA.zip |
| FRTB | Fundamental Review of the Trading Book (full) | Nov 2025 | FRTB.zip |

## Tracker

| File | Description |
|---|---|
| ReturnTracker_v3.xlsx | SARB PA running updates tracker — all return forms, version history, planned changes |

---

## Form-number notes

- **BA 310 / BA 110 = FX NOP** — the FX net open position capital charge flows through BA 310 (standardised market risk, Reg 28(5)) and is also reflected in BA 110 (LCR, Reg 29(3)). See `D-BA-RETURN-FORM-NUMBERING-RECON`.
- **BA 320 ≠ FX NOP** — BA 320 is the *alternative/simplified* standardised market-risk return (Annexure 12A of D5/2025), distinct from the embedded GG-era "Form BA 320" label in Reg 28 verbatim text (which maps to current BA 310). See [`../ba-310.md`](../ba-310.md) provenance section.
- **BA 325 = FRTB SBM + DRC + RRAO** — the FRTB recalibrated standardised approach. See [`../ba-325.md`](../ba-325.md).
