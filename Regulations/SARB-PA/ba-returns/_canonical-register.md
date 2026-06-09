# SARB BA-return form-number canonical register

> **Single source of truth for BA-return form numbering across the bank.**
> Derived from the **actual downloaded forms** in this directory (`ba-*.md`) and the
> verified **D5/2025** schedule. Authority: `D-SARB-RETURN-SCHEDULE-CANONICAL-D5-2025`
> (CEO-approved 2026-06-07) — D5/2025 is canonical and **supersedes** the GG-35950
> (12 Dec 2012) schedule and `D-BA-RETURN-FORM-NUMBERING-RECON`.
> Execution authority for this register + the `recon:ba-form-numbering` gate:
> `D-BA-FORM-NUMBERING-RECONCILIATION-EXECUTION` (CEO session-delegation 2026-06-09).
>
> Every `BA <n>` reference in any policy, procedure, decision record, brief, or code
> identifier MUST resolve to the canonical meaning below. The `recon:ba-form-numbering`
> gate enforces this by failing on known-wrong `(form, meaning)` co-locations.

## 1. Canonical schedule — ground-truth verified (downloaded forms present)

These 13 forms are **downloaded** in `Regulations/SARB-PA/ba-returns/` — their own
titles are authoritative.

| Form | Canonical meaning (D5/2025) | D5/2025 § | GG-2012 number | Reporting module |
|---|---|---|---|---|
| **BA 100** | Capital-adequacy return | §2.1.3 | BA 100 (stable) | `ba-100-capital.ts` |
| **BA 110** | Liquidity Coverage Ratio (LCR) return | §2.1.4 | **was BA 325** | `ba-110-lcr.ts` |
| **BA 120** | Net Stable Funding Ratio (NSFR) return | §2.1.5 | **was BA 326** | `ba-120-nsfr.ts` |
| **BA 200** | Credit-risk capital return | §2.1.8 | BA 200 (stable) | `ba-200-credit-risk.ts` |
| **BA 210** | Counterparty-credit-risk return (SA-CCR) | §2.1.9 | — | (pending) |
| **BA 300** | Operational-risk capital return | §2.1.11 | — | `ba-300-op-risk.ts` |
| **BA 310** | Market-risk capital return (standardised) | §2.1.12 | — | `ba-310-market-risk.ts` |
| **BA 320** | Alternative market-risk capital return | §2.1.13 | — | (pending) |
| **BA 325** | FRTB market-risk capital return | §2.1.14 | — | (pending) |
| **BA 330** | IRRBB repricing-gap return (D2/2023) | §2.1.15 | — | (pending) |
| **BA 400** | Leverage-ratio return | §2.1.18 | — | `ba-400-leverage-ratio.ts` |
| **BA 600** | Balance sheet / statement of financial position | §2.1.21 | — | `ba-600-balance-sheet.ts` |
| **BA 610** | Income statement / statement of profit or loss | §2.1.22 | — | `ba-610-income-statement.ts` |

## 2. Register-asserted (NOT yet downloaded — lower confidence, verify before relying)

These appear in `Regulations/_obligations-register.md` (`ORG-PR-RETURNS-*`, D5/2025
§2.1.x) but the source form is **not yet downloaded** to this directory. Treat as
provisional until the form is downloaded and its title confirmed.

| Form | Register-asserted meaning | Obligation |
|---|---|---|
| BA 099 / 099A | Certification cover (099A = foreign operations) | ORG-PR-RETURNS-001 |
| BA 125 | Additional liquidity monitoring (intraday) | ORG-PR-RETURNS-005 |
| BA 130 | Liquidity stress-testing | ORG-PR-RETURNS-006 |
| BA 220 | Securitisation | ORG-PR-RETURNS-009 |
| BA 340 | Equity risk in the banking book | ORG-PR-RETURNS-015 |
| BA 350 | (contested — see §4; `D-FX-NOP-SLA-CITATION-D5-MIGRATION` notes "D5/2025 has no BA 350") | — |
| BA 410 | Pillar 3 disclosure | ORG-PR-RETURNS-018 |
| BA 500 | Remuneration | ORG-PR-RETURNS-019 |
| BA 700 | Prudent valuation adjustments + additional leverage disclosure | ORG-PR-RETURNS-022 |
| BA 900 / 920 / 930 / 940 | Related-party / concentration / foreign-claims / asset-quality (economic-statistics) | ORG-PR-RETURNS-024..027 |

## 3. GG-2012 → D5/2025 crosswalk (the root cause of the collisions)

D5/2025 **re-cut** the form-number schedule. The same number can mean different
things across the two eras — this is the entire source of the bank-wide divergence.

| Subject | GG-2012 number | **D5/2025 canonical** |
|---|---|---|
| LCR | BA 325 | **BA 110** |
| NSFR | BA 326 | **BA 120** |
| FRTB market risk | (n/a) | **BA 325** *(number reused — was LCR under GG-2012)* |
| Market risk (SA) | BA 320 | **BA 310** |
| Operational risk | (GG home varied) | **BA 300** |
| Leverage ratio | BA 700 (leverage home) | **BA 400** |

## 4. Forbidden `(form, meaning)` mappings — enforced by `recon:ba-form-numbering`

The gate FAILS if a policy/procedure line co-locates any pair below. Each is a
known stale-GG-2012 or outright-wrong mapping; the correct form is given.

| Forbidden co-location | Correct form |
|---|---|
| BA 325 ↔ LCR / liquidity-coverage | BA 110 |
| BA 326 ↔ NSFR / net-stable-funding | BA 120 |
| BA 900 ↔ LCR / NSFR / liquidity-coverage | BA 110 (LCR) / BA 120 (NSFR) |
| BA 326 ↔ FRTB / IMA | BA 325 (FRTB; no BA 326 IMA form) |
| BA 325 ↔ SA-CCR / counterparty-credit | BA 210 |
| BA 326 ↔ CCP / central-counterparty | (no such form; CCR = BA 210) |
| BA 300 ↔ market-risk | BA 310 (BA 300 = operational risk) |
| BA 600 ↔ large-exposure | BA 600 = balance sheet (large-exposures ≠ BA 600) |
| BA 700 ↔ leverage-ratio | BA 400 (BA 700 = PVA + leverage *disclosure*) |
| BA 340 ↔ credit-risk-return | BA 200 (BA 340 = equity risk in banking book) |
| BA 110 ↔ FX-NOP / net-open-position (as the *return*) | BA 110 = LCR; FX-NOP rides BA 310 §; daily-NOP form unresolved (`D-FX-NOP-SLA-CITATION-D5-MIGRATION`) |

## 5. Notes

- **FX net-open-position.** FX-NOP is a *section* of the market-risk return **BA 310**
  (Reg 28), not a standalone form. The *daily* effective-NOP attestation (Reg 29(3))
  form is **unresolved / counsel-gated** per `D-FX-NOP-SLA-CITATION-D5-MIGRATION` — it
  is **not** BA 110 (LCR). `new-product-approval-policy-v2` and `npa-gate` currently
  mis-state this as "BA-110 daily-return NOP" and "no BA-320/325"; both are wrong
  against the downloaded forms.
- **BA 330 = IRRBB** holds (D2/2023 / Reg 30); `D-BA-330-REATTRIBUTION-IRRBB` is **not**
  unwound by this register.
- **Reporting code is already canonical.** The LCR engine is `ba-110-lcr.ts` and the
  returns subscriber dir is `ba110/` — the legacy `ba-325-lcr.ts` / `ba325/` no longer
  exist. The divergence is confined to policy/procedure prose (the
  `recon:ba-form-numbering` PENDING_REMEDIATION backlog), not the code layer.
