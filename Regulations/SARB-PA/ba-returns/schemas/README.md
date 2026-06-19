# SARB PA BA Return Schemas — Definitive XSD Set

**Source:** SARB Prudential Authority — PA Transformation Programme (Umoja Phase 2)  
**Downloaded:** 2026-06-08  
**URL:** https://www.resbank.co.za/en/home/what-we-do/Prudentialregulation/PA-Transformation-Programme  
**Enabling instrument:** PA Directive 5 of 2025 (D5/2025) — *Returns to be submitted to the Prudential Authority*

Each ZIP contains:
- `<FORM>.xsd` — XML Schema Definition for client-side validation before machine-to-machine API submission (Umoja PA API)
- `SARB-Return - <FORM>.xlsx` — human-readable form template

These are **Plane A reference data** per `D-REGULATORY-ARCHITECTURE-TWO-PLANE`. No events are emitted; the XSDs are the canonical artefacts for submission-layer validation.

> **Form numbering — canonical source.** The **Description** column below is transcribed
> from each downloaded SARB Excel workbook's number-tab **cell A1** (the form's official
> name), consolidated in [`../_canonical-register.md`](../_canonical-register.md) under
> `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` (CEO 2026-06-09). A prior version of this file
> carried a **fabricated** numbering scheme invented from the D5/2025 routing lines without
> sight of the forms; the enumeration of those superseded mappings (and the canonical
> correction for each) lives in [`../_canonical-register.md`](../_canonical-register.md)
> §2–§3 and is **not restated here**. This table now matches the Excel A1 headers verbatim
> and is gated by `recon:ba-form-numbering` (`D-BA-RETURN-DATA-CONTRACT` Phase A).
> Correction author: Mira (Compliance / RegTech engineer, engineering — reports to Zara
> (Chief Compliance Officer, governance)).

---

## Banking Returns (BA)

> Description = SARB Excel workbook cell A1 (official form name), verbatim per
> [`../_canonical-register.md`](../_canonical-register.md) §1. "Last updated" is the
> downloaded workbook revision month (provenance metadata; not a numbering claim).

| Form | Description (Excel A1) | Last updated | File |
|---|---|---|---|
| BA 100 | Balance Sheet | Oct 2025 | BA100.zip |
| BA 110 | Off-Balance-Sheet Activities | Jul 2025 | BA110.zip |
| BA 120 | Income Statement | Jul 2025 | BA120.zip |
| BA 125 | Return regarding shareholders | Jul 2025 | BA125.zip |
| BA 130 | Restriction on investments, loans and advances | Jul 2025 | BA130.zip |
| BA 200 | Credit Risk (IRB + Standardised approaches; incl. counterparty credit risk sub-forms) | Jan 2026 | BA200.zip |
| BA 210 | Credit Concentration Risk / Large Exposures (LEX); incl. watch-list | May 2026 | BA210.zip |
| BA 220 | Credit Risk: Assets bought-in | Feb 2026 | BA220.zip |
| BA 300 | Liquidity Risk (incl. the Liquidity Coverage Ratio and NSFR within the liquidity-risk series) | Mar 2026 | BA300.zip |
| BA 310 | Minimum Liquid Reserve Balance and Liquid Assets (HQLA) | Oct 2025 | BA310.zip |
| BA 320 | Market Risk | Jul 2025 | BA320.zip |
| BA 325 | Selected Risk Exposure Arising from Trading and Treasury Activities | Jul 2025 | BA325.zip |
| BA 330 | Interest Rate Risk: Banking Book (IRRBB) | Oct 2025 | BA330.zip |
| BA 340 | Equity Risk in the Banking Book | Oct 2025 | BA340.zip |
| BA 350 | Derivatives Instruments | Jul 2025 | BA350.zip |
| BA 400 | Operational Risk | Oct 2025 | BA400.zip |
| BA 410 | Operational Risk: Quarterly Losses | Jul 2025 | BA410.zip |
| BA 420 | Operational Risk: 12-Months Rolling Losses | Jan 2026 | BA420.zip |
| BA 500 | Securitisation Schemes | Jul 2025 | BA500.zip |
| BA 501 | Special-purpose institutions schemes | Feb 2026 | BA501.zip |
| BA 600 | Consolidated Return | May 2026 | BA600.zip |
| BA 610 | Foreign Operations of South African Banks | May 2026 | BA610.zip |
| BA 700 | Capital Adequacy and Leverage and TLAC | May 2026 | BA700.zip |
| BA 701 | Regulatory vs Economic Capital | May 2026 | BA701.zip |
| BA 900 | Economic statistics — DI returns (balance sheet of deposit-taking institutions, statistical principles; BA900_1…7) | May 2026 | BA900.zip |
| BA 920 | Analysis of instalment-sale credit, leasing finance and selected assets | Oct 2025 | BA920.zip |
| BA 930 | Weighted-average interest rates on loans and deposits | Oct 2025 | BA930.zip |
| BA 94x | Economic statistics (BA94x series — locational banking statistics, BA 941–944) | Nov 2025 | BA94x.zip |

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

All notes below are stated on the **canonical** numbering (Excel A1, per
[`../_canonical-register.md`](../_canonical-register.md)). The prior fabricated FX-NOP /
FRTB notes are superseded; the superseded enumeration is in `../_canonical-register.md`
§2–§3 and is not restated here.

- **Market risk → BA 320** (Excel A1: "Market Risk"). The **FX net-open-position (NOP)**
  capital charge is part of market risk and is reported within BA 320; the related
  liquid-asset / HQLA reserve sits on **BA 310** (Excel A1: "Minimum Liquid Reserve Balance
  and Liquid Assets"). The GG-era Reg 28 verbatim text embeds a legacy "Form BA 320" label
  for the *whole* market-risk return — that legacy label coincidentally matches the current
  BA 320 number; see [`../ba-320.md`](../ba-320.md) and [`../ba-310.md`](../ba-310.md)
  provenance sections (both pending Phase B/C re-author under `D-BA-RETURN-DATA-CONTRACT`).
- **BA 325 = Selected Risk Exposure Arising from Trading and Treasury Activities** (Excel
  A1) — it carries trading/treasury selected-risk exposures and a liquidity summary section,
  but it is **not** the FRTB market-risk return and **not** the liquidity-coverage return.
  The FRTB supplementary workbook is the separate `FRTB.zip`. See
  [`../ba-325.md`](../ba-325.md).
- **Liquidity → BA 300** (Excel A1: "Liquidity Risk", which carries both the
  liquidity-coverage and net-stable-funding measures); liquid-asset reserve / HQLA is
  **BA 310**. **Operational risk → BA 400** (Excel A1; quarterly/rolling losses on
  BA 410/420). **Capital adequacy, leverage and TLAC → BA 700** (Excel A1). The superseded
  placements of these measures are enumerated in `../_canonical-register.md` §2.
