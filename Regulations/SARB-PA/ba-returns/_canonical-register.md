# SARB BA-return form-number canonical register

> **Single source of truth for BA-return form numbering — sourced from the actual
> downloaded SARB Excel forms** in `schemas/` (`BA<n>.zip` → `SARB-Return - BA<n>.xlsx`).
> Each workbook has a tab named with the return number; cell **A1 of that tab is the
> form's official name**. This register transcribes those headers verbatim.
>
> Authority: `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL` (CEO session-delegation 2026-06-09).
> **Supersedes** `D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025` and
> `D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION` — both of which encoded a **fabricated**
> numbering scheme (capital=BA 100, LCR=BA 110, NSFR=BA 120, FRTB=BA 325, op-risk=BA 400)
> invented from the D5/2025 directive's *routing lines* without sight of the forms. The
> actual forms contradict that scheme wholesale.

## 1. Canonical schedule — verbatim from the downloaded Excel form headers (A1)

| Form | **Official name (Excel A1)** |
|---|---|
| **BA 100** | Balance Sheet |
| **BA 110** | Off-Balance-Sheet Activities |
| **BA 120** | Income Statement |
| **BA 125** | Return regarding shareholders |
| **BA 130** | Restriction on investments, loans and advances |
| **BA 200** | Credit Risk (IRB + Standardised approaches; includes counterparty credit risk sub-forms) |
| **BA 210** | Credit Concentration Risk / Large Exposures (LEX); incl. watch-list |
| **BA 220** | Credit Risk: Assets bought-in |
| **BA 300** | Liquidity Risk — **includes the Liquidity Coverage Ratio (LCR)** |
| **BA 310** | Minimum Liquid Reserve Balance and Liquid Assets (HQLA) |
| **BA 320** | Market Risk |
| **BA 325** | Selected Risk Exposure Arising from Trading and Treasury Activities |
| **BA 330** | Interest Rate Risk: Banking Book (IRRBB) |
| **BA 340** | Equity Risk in the Banking Book |
| **BA 350** | Derivatives Instruments |
| **BA 400** | Operational Risk |
| **BA 410** | Operational Risk: Quarterly Losses |
| **BA 420** | 12-Months Rolling Losses |
| **BA 500** | Securitisation Schemes |
| **BA 501** | Special-purpose institutions schemes |
| **BA 600** | Consolidated Return |
| **BA 610** | Foreign Operations of South African Banks |
| **BA 700** | **Capital Adequacy and Leverage and TLAC** |
| **BA 701** | Regulatory vs Economic Capital |
| **BA 900** | Economic statistics — DI returns (BA900_1…7) |
| **BA 920** | Analysis of instalment-sale credit, leasing finance and selected assets |
| **BA 930** | Weighted-average interest rates on loans and deposits |
| **BA 941–944** | Economic statistics (BA94x series) |

Source: `Regulations/SARB-PA/ba-returns/schemas/BA<n>.zip`, sheet `BA<n>`, cell A1
(SARB PA Transformation Programme / Umoja schema set, downloaded 2026-06-08).

## 2. Where the prudential measures actually live (correcting the bank's assumptions)

| Measure | **Real form** | Bank's prior (wrong) assumption |
|---|---|---|
| Capital adequacy (CET1/T1/Total, leverage, TLAC) | **BA 700** | BA 100 ✗ |
| Balance sheet | **BA 100** | BA 600 ✗ |
| Income statement | **BA 120** | BA 610 ✗ |
| Liquidity / **LCR** | **BA 300** (+ BA 310 liquid assets) | BA 110 / BA 325 / BA 900 ✗ |
| NSFR | within the **BA 300 liquidity-risk** series | BA 120 / BA 326 ✗ |
| Market risk | **BA 320** (+ BA 325 trading/treasury) | BA 310 / BA 325-as-"FRTB" ✗ |
| Operational risk | **BA 400** (+ BA 410/420 losses) | BA 300 / BA 100 ✗ |
| IRRBB | **BA 330** | BA 330 ✓ |
| Credit risk | **BA 200** | BA 200 ✓ |
| Large exposures / concentration | **BA 210** | BA 600 / BA 210-as-"SA-CCR" ✗ |
| Equity risk (banking book) | **BA 340** | BA 340 ✓ |

Only **credit (BA 200), IRRBB (BA 330) and equity-risk (BA 340)** were ever numbered
correctly. **`BA 326` does not exist** in the SARB schedule (the real sequence is
BA 325 → BA 330); every "BA 326" reference in the corpus is fabricated.

## 3. Forbidden `(form, meaning)` mappings — enforced by `recon:ba-form-numbering`

The gate FAILS if a policy/procedure line co-locates a fabricated pair below. The
correct form is given.

| Forbidden co-location | Correct form |
|---|---|
| BA 100 ↔ capital-adequacy | BA 700 (BA 100 = balance sheet) |
| BA 110 ↔ LCR / liquidity-coverage / off-balance? | BA 300 (BA 110 = off-balance-sheet activities) |
| BA 120 ↔ NSFR / net-stable-funding | BA 300 series (BA 120 = income statement) |
| BA 300 ↔ operational-risk | BA 400 (BA 300 = liquidity risk) |
| BA 310 ↔ market-risk | BA 320 (BA 310 = liquid-asset reserve) |
| BA 325 ↔ LCR / liquidity-coverage | BA 300 |
| BA 326 ↔ anything | no such form (real: BA 325 → BA 330) |
| BA 400 ↔ leverage-ratio | BA 700 (BA 400 = operational risk) |
| BA 600 ↔ balance-sheet | BA 100 (BA 600 = consolidated return) |
| BA 610 ↔ income-statement | BA 120 (BA 610 = foreign operations) |
| BA 700 ↔ prudent-valuation / PVA | BA 700 = capital adequacy + leverage + TLAC |
| BA 900 ↔ LCR / NSFR / liquidity-coverage | BA 300 (BA 900 = economic statistics) |

## 4. Notes

- **`BA 325` is "Selected Risk Exposure Arising from Trading and Treasury Activities"** —
  it carries trading/treasury risk *and* an LCR summary section, but it is **not** the
  FRTB market-risk return and **not** the LCR return. Market risk proper is **BA 320**.
- The reporting code (`ba-110-lcr.ts`, `ba-120-nsfr.ts`) and the obligations register
  (`ORG-PR-RETURNS-*`) are numbered against the **fabricated** scheme and require a
  replay-safe re-number to the canonical forms above — tracked under
  `D-BA-RETURN-NUMBERING-EXCEL-CANONICAL`.
- The definitive XSD + Excel form set lives in `schemas/` (28 BA returns + CVA + FRTB +
  ReturnTracker), per `schemas/README.md`.
