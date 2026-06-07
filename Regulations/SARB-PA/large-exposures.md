# Large exposures (SARB large-exposures regime — instrument analysis)

**Curator:** Mira (Compliance / RegTech engineer) · **Status:** POPULATED · **Last reviewed:** 2026-06-07 · **Governance:** Zara (Chief Compliance Officer)

> **Workstream:** WS-INSTRUMENT-ANALYSES (markets-priority run, instrument 2 of N). **Decision:** `D-ROADMAP-WS-C-RECONCILE` (CEO-approved 2026-06-07). **Re-attribution sweep decision:** `D-BA-330-REATTRIBUTION-IRRBB` (CEO-approved 2026-06-07). **Brief:** `brief:mira:ba-330-re-attribution-sweep-irrbb-vs-large-expos:2026-06-07`. This is REFERENCE data (two-plane Plane A per `D-REGULATORY-ARCHITECTURE-TWO-PLANE`); no events are emitted.

> ⚠️ **PROVENANCE — why this file used to be `ba-returns/ba-330.md`.** This analysis was originally scoped (and filed) under its first brief as *"BA 330 (Large Exposures)"*. On sourcing the actual SARB form-completion directive **and the Regulations relating to Banks form schedule**, the public record shows that **form BA 330 is the Interest-Rate-Risk-in-the-Banking-Book (IRRBB) repricing-gap return** — the Regulations relating to Banks (GG 35950, 12 December 2012) form schedule reads *"Form BA 330 — Interest-rate risk: banking book"*, and the form is completed per **Directive 2 of 2023 (D2/2023)**, issued in terms of **regulation 30**, gazetted 23 December 2022, effective 1 January 2023. It is **not** the large-exposures return. The large-exposures regime is carried by **regulations 24(6)–24(8)** of the Regulations relating to Banks and **Directive 3 of 2022 (D3/2022)**, and is reported on the **credit-risk return family (the BA 200-series)**, not BA 330. The file has accordingly been **renamed to `large-exposures.md`** (the substantive obligation it documents). §7 below preserves the full evidence trail of how the mis-attribution was discovered and the register-corrections it triggered. The IRRBB form (BA 330) is catalogued separately as a `BA 330 — IRRBB repricing-gap return` STUB row in `Regulations/_index.md`. **This analysis documents the large-exposures regime in full** — that is the substantive obligation the markets/trading profile must satisfy.

## Citation

- **Primary substantive instrument:** the **large-exposures (LEX) regime**, implemented in South Africa through **amended Regulations relating to Banks** (issued under **section 90 of the Banks Act 94 of 1990**) **read with SARB Prudential Authority Directive 3 of 2022 ("D3/2022 — Large exposure requirements")**.
- **Enabling primary law:** Banks Act 94 of 1990 (the Tier-1 parliamentary Act); the Regulations relating to Banks constitute Tier-2 secondary enforceable legislation; Directives (incl. D3/2022) are Tier-3 binding instruments. (Three-tier structure per BCBS RCAP §1.1, April 2023.)
- **Gazette / commencement:** the LEX-incorporating amendments to the Regulations were published in **Government Gazette No 46159 of 31 March 2022** (Government Notice No 943) and **implemented with effect from 1 April 2022**.
- **Core large-exposures regulations:** primarily **regulations 24(6) to 24(8)** of the Regulations relating to Banks, read with **regulations 23(8), 23(9) and 23(18)**.
- **Directive:** **Directive 3 of 2022 — Large exposure requirements** (effective 1 April 2022). Addresses, in particular: treatment of and limits on interbank exposures; application of LEX to other entities within a banking group where a group member is a D-SIB / D-SIFI / G-SIB; application to intragroup exposures; application to a foreign subsidiary of a controlling company required to report on a solo basis; and treatment of breaches of the LEX limit.
- **Basel anchor:** BCBS *Supervisory framework for measuring and controlling large exposures* (April 2014), with the *FAQ on the supervisory framework for measuring and controlling large exposures* (September 2016). Catalogued in this repo at [`Regulations/BCBS/lex-large-exposures.md`](../BCBS/lex-large-exposures.md).
- **Independent compliance opinion:** BCBS Regulatory Consistency Assessment Programme — *Assessment of Basel large exposures regulations — South Africa* (April 2023, BIS, ISBN 978-92-9259-647-7). Overall grade and all three component grades: **Compliant (C)**.
- **Reporting form (large exposures):** large-exposure exposures are reported within the **credit-risk return family (BA 200-series)**, not on form BA 330. (See §7; the precise form number/table and cadence remain counsel-gated — see §6 and citation note in `_obligations-register.md`.)
- **Source:** [resbank.co.za — Prudential Authority / Banks Directives](https://www.resbank.co.za); BCBS RCAP report [bis.org/bcbs/publ/d549.pdf](https://www.bis.org/bcbs/publ/d549.pdf); D2/2023 form-BA330 directive (resbank.co.za, banks-directives/2023/d2).

## Scope and applicability to the bank

The large-exposures regime caps the concentration of a bank's credit exposure to a **single counterparty** or to a **group of connected counterparties**, expressed as a percentage of the bank's **eligible capital base (Tier 1 capital)**. It binds the bank's credit book and, materially for this institution, its **trading book**: single-counterparty and connected-counterparty exposure caps apply to derivative, repo/reverse-repo, securities-financing and settlement exposures generated by the global-markets desks, not only to loan assets.

Key applicability facts for this bank:

- **Uniform application.** Under the South African regulations the LEX framework applies **on a solo and a consolidated basis** to **all** banks and banking groups incorporated in South Africa — it is *not* limited to internationally active banks (this is one of the areas where the SA rule is **stricter** than the Basel minimum, which is scoped to internationally active banks). (RCAP Annex 4.)
- **Bind trigger: COMMENCEMENT-BIND.** LEX measurement and the associated reporting obligation arise once the bank is licensed and carries real counterparty exposures; build-phase synthetic exposures do not trigger a regulatory return. The exposure-limit *engineering* (single-name + connected-counterparty limits, breach escalation) is built and load-bearing now.
- **Trading-book relevance.** The markets profile is the reason this instrument is markets-priority: the desks' counterparty universe (correspondent banks, CLS-member settlement counterparties, repo counterparties, derivative counterparties) is precisely where single-name and connected-counterparty concentration accumulates. The bank's RAS §B2 concentration appetite sits **inside** (stricter than) the regulatory ceiling.

## The large-exposure definition (≥ 10% of eligible capital)

The Basel LEX framework defines a large exposure as **the sum of all exposure values of a bank to a single counterparty or to a group of connected counterparties that is equal to or above 10% of the bank's eligible capital base** (Basel LEX para 14).

The South African regulations **do not contain a stand-alone definition** of a large exposure. However, per the BCBS RCAP (April 2023, §2.3.1 / §2.2.1), **Regulation 24(7)(a) read together with Regulation 24(6)(f)** are assessed as **"equivalent in all material respects to the essential components of the definition of a large exposure set out in the Basel LEX framework"** — so a separate domestic definition is deemed unnecessary. The 10% reporting threshold therefore binds the bank through those sub-regulations.

## Exposure limits (single-counterparty and connected-counterparty caps)

| Bank category → counterparty | Limit (% of eligible Tier-1 capital base) | Basis / notes |
|---|---|---|
| **All banks (general single / connected-counterparty cap)** | **≤ 25%** | Basel LEX para 10.8; SA Reg 24(6)–(8); the headline single- and connected-counterparty ceiling. |
| **D-SIB → other D-SIB / G-SIB exposures** | **≤ 15% monthly average; ≤ 18% daily maximum** | SA imposes **tighter** D-SIB-to-D-SIB / D-SIB-to-G-SIB limits than the 25% Basel minimum (RCAP Annex 4). |
| **G-SIB → G-SIB** | **≤ 15%** | Basel-equivalent tighter G-SIB-to-G-SIB treatment. |

Notes verifiable from the public source:

- **The bank is not a D-SIB or a G-SIB.** On the markets profile, the binding cap is therefore the **general 25%** single- and connected-counterparty ceiling, applied as a maximum on any day. (The 15% / 18% phased D-SIB-to-D-SIB schedule recorded against `ORG-PR-40` in the register is the D3/2022 Annexure-1 phase-in table and applies to D-SIBs; it is retained in the register as the full directive picture but is conditional-bind for this institution.)
- **Eligible capital base = Tier 1.** Consistent with `Regulations/BCBS/lex-large-exposures.md` (≤ 25% Tier 1).
- **Connected counterparties** are aggregated — control relationships and economic-interdependence linkages bring otherwise-separate counterparties into a single exposure group for cap purposes.

## Treatment specifics (verified from the BCBS RCAP, April 2023)

| Topic | SA regulation reference | Substance |
|---|---|---|
| **Definition equivalents** (Basel para 14) | **Reg 24(7)(a) + Reg 24(6)(f)** | Material equivalents of the large-exposure definition (10% threshold). |
| **Exemptions** (Basel para 13) | **Reg 24(8)(a)** | Exempts exposures to sovereigns and their central banks, and PSEs treated as sovereigns. SA adds an enabling clause letting the PA exempt "any other exposure specified in writing" (e.g. interbank exposures in stress) — **never exercised to date**; assessed **not material**. |
| **CRM providers** (Basel para 43) | **Reg 24(6)(d)(v)** | Where a bank reduces exposure to the original counterparty via an eligible CRM technique, it must recognise an exposure to the CRM provider. SA permits a "gross value approach" (not reducing the original-counterparty exposure); the PA confirmed an exposure to the CRM provider is still required. SA's allowance not to recognise CRM as a *mitigant* is treated as **stricter** than Basel. |
| **Look-through for structures** (Basel para 75) | **Reg 24(6)(c)(iii)** | Banks must look through collective-investment / securitisation / other structures to underlying assets where exposure ≥ **0.25%** of the eligible capital base; if unable, the bank must inform the PA, which may direct assignment to an "unknown client". |
| **Implementation date / transition** (Basel para 93) | Government Gazette No 46159, 31 March 2022 | Effective **1 April 2022** (Basel agreed date was January 2019). PA approved a transitional period to **January 2025** for compliance with the LEX limits **relating to interbank exposures only**. |

## Reporting cadence

- The large-exposures **measurement** is continuous: exposures are monitored (and, for the D-SIB schedule, measured on monthly-average and daily-maximum bases). The general single-/connected-counterparty cap binds as a **maximum on any day**.
- The **submission cadence and the precise return / table** on which large exposures are reported to the PA are part of the **credit-risk return family (BA 200-series)** reporting machinery and are **counsel-gated** for this bank (see §6 and the `ORG-PR-40` / `ORG-PR-RETURNS-014` citation notes). The brief's working assumption of a monthly LEX return is consistent with the register's `ACT-REPORT-PRUDENTIAL` classification on `ORG-PR-40`, but the exact form number is **not** BA 330 — see §7.

## Binding obligations on the bank (summary)

1. **Identify and aggregate** all exposures to each single counterparty and each group of connected counterparties, on a solo and consolidated basis (Reg 24(6)–(8)).
2. **Apply the single-/connected-counterparty cap** — ≤ 25% of the eligible Tier-1 capital base on any day (Basel LEX 10.8; Reg 24(6)–(8)).
3. **Recognise exposures to CRM providers** where credit-risk mitigation is applied (Reg 24(6)(d)(v)).
4. **Look through structures** to underlying assets at the 0.25% threshold; notify the PA where look-through is not possible (Reg 24(6)(c)(iii)).
5. **Apply the exempt-exposures schedule** (sovereigns / central banks / qualifying PSEs) (Reg 24(8)(a)).
6. **Report** large exposures to the PA on the prescribed return and cadence (credit-risk return family — form number counsel-gated).
7. **Treat and escalate breaches** of the LEX limit per D3/2022.

## Basel → South Africa transposition

| Basel LEX provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| LEX para 14 (definition, 10%) | Reg 24(7)(a) + Reg 24(6)(f) | **ADOPTS** (material-equivalent) | No stand-alone SA definition; equivalents assessed compliant (RCAP). |
| LEX para 10.8 (25% cap) | Reg 24(6)–(8) | **ADOPTS** | 25% single/connected ceiling; D-SIB-to-D-SIB/G-SIB **GOLD_PLATES** (15%/18%). |
| LEX para 13 (exemptions) | Reg 24(8)(a) | **ADOPTS + GOLD_PLATES** | adds PA discretionary-exemption enabling clause (unexercised). |
| LEX para 43 (CRM providers) | Reg 24(6)(d)(v) | **ADOPTS + GOLD_PLATES** | gross-value approach allowed (stricter — net-of-CRM not required). |
| LEX para 75 (look-through) | Reg 24(6)(c)(iii) | **ADOPTS** | 0.25% look-through threshold; PA-notification on failure. |
| LEX para 93 (implementation) | GG 46159, 31 Mar 2022 | **ADOPTS** | effective 1 Apr 2022; interbank transition to Jan 2025. |
| Scope (internationally active) | Reg 24 (all SA banks) | **GOLD_PLATES** | applies to all 31 SA banks/groups, not only internationally active. |

RCAP overall grade: **Compliant (C)** — scope and definitions (C), minimum requirements and transitional arrangements (C), value of exposures (C). One non-material scope/definitions finding (the unexercised PA discretionary-exemption clause).

## Live engine linkage

- `prototype/platform/risk/credit-limit-engine/` — single-name + connected-counterparty exposure limits, breach detection and escalation. RAS §B2 concentration appetite sits stricter than the regulatory ceiling.
- Cross-reference: [`Regulations/BCBS/lex-large-exposures.md`](../BCBS/lex-large-exposures.md) (the Basel spine this regime implements).

## Cross-references in the obligations register

- `ORG-PR-40` — SARB PA **Directive 3 of 2022 — LEX** (the primary directive obligation). Citation resolved in register v1.39 (Reg 24 correction — see §7).
- `ORG-PR-09` — BCBS Large Exposures / single-name cap (legacy high-level row; `[TBD]` citations).
- `ORG-PR-RETURNS-014` — D5/2025 "form BA 330" returns obligation (carries the BA-330-is-large-exposures defect — see §7).
- `ORG-PR-10` — RAS B8 sector-concentration appetite (internal, stricter overlay).

## §7 — Material finding: BA 330 is the IRRBB return, not the large-exposures return

**Finding.** The brief, the index row, `banks-act.md`, and register row `ORG-PR-RETURNS-014` all assert that **form BA 330 is the large-exposures return**. The public SARB source contradicts this:

- **SARB PA Directive 2 of 2023 (D2/2023)** — *"Directive issued in terms of section 6(6) of the Banks Act 94 of 1990 — Reporting requirements in terms of **regulation 30** of the Regulations relating to Banks"* — its Executive Summary states: *"This Directive sets out, amongst others, **the instructions for completing the form BA 330** and matters related thereto."* §1.3 states: *"The Pillar 2 **Interest rate risk in the banking book (IRRBB)** framework requires banks to assess, and stress test their overall interest rate risk exposure …"*. The form's columns and line-items are repricing time-buckets (overnight, variable-rate, fixed-rate, benchmark-rate, discretionary-rate, non-rate-sensitive; net funding to/from trading book). **Form BA 330 is unambiguously the IRRBB repricing-gap return.**
- The **large-exposures regime** lives in **regulations 24(6)–24(8)** + D3/2022 and is reported within the **credit-risk return family (BA 200-series)**, per the BCBS RCAP (April 2023) and the SARB BA-returns catalogue.

**Authoritative BA-return form schedule (verified from the primary source).** The Regulations relating to Banks (Government Gazette No 35950, 12 December 2012) form schedule, cross-checked against the SARB PA *Proposed Directive — Returns to be submitted to the PA* (2024), maps the BA 3xx family as follows — recorded here so the re-attribution rests on the primary source, not inference:

| Form | Subject (verbatim from the Regulations form schedule) |
|---|---|
| **BA 320** | **Market risk** (market-risk capital / RWA return) |
| **BA 325** | **Daily return: selected risk exposure arising from trading and treasury activities** — carries the FX **effective net open position** attestation (regulation 29(3)) |
| **BA 330** | **Interest-rate risk: banking book** (IRRBB; completed per D2/2023, reg 30) |
| **BA 340** | **Equity risk in the banking book** |
| **BA 350** | **Derivative instruments** |

The FX **net open position** / market-risk return is therefore **BA 320 (Market risk)**, with the daily NOP limit attested on **BA 325** under **regulation 29(3)** — it is **not** BA 350 (derivatives) and **not** BA 330 (IRRBB).

**Why the confusion is endemic in the repo.** Several legacy artefacts pinned "BA 330 = large exposures" (the original brief; `banks-act.md` §Large exposures; `_index.md` BA 330 row label; `ORG-PR-RETURNS-014`) and a separate set of artefacts pinned "BA 330 = FX net open position" (the markets limit-utilisation projection comments). Both are wrong for the same root reason: BA 330 is the IRRBB return.

**Recommendations — ACTIONED by the re-attribution sweep (`D-BA-330-REATTRIBUTION-IRRBB`, CEO-approved 2026-06-07):**
1. ✅ The `_index.md` BA 330 row is relabelled to **BA 330 — IRRBB repricing-gap return** (status STUB — no full IRRBB analysis exists yet) and a separate **POPULATED** large-exposures row (Reg 24 + D3/2022) now points at this renamed file.
2. ✅ `ORG-PR-RETURNS-014` corrected in register v1.39 (BA 330 = IRRBB; LEX = Reg 24(6)–(8), not Reg 25/Reg 28).
3. ✅ The markets FX-NOP comments (`limit-utilisation.ts`, `trading.ts`) corrected from "BA 330" to **BA 320 (market risk) / BA 325 reg 29(3) NOP attestation**; the LEX semantic-registry entries and `basel-adoption.ts` LEX comment corrected to **Reg 24(6)–(8) + D3/2022 / BA 200-series**.
4. Remaining: audit any `prototype/platform/reporting/ba-330` capability path at the licence gate for the same mislabel; confirm the precise large-exposures BA 200-series form number/cadence with external counsel.

This file deliberately **does not silently propagate** the defect: it analyses the large-exposures *regime* (the real obligation) in full and records the form-number correction as the headline finding.

## Open items / counsel-gated

- **Precise large-exposures return form number + submission cadence** — counsel-gated (Imani (Legal-as-code engineer) + external counsel at the licence gate). The public source confirms the regime and the BA 200-series family but not a single canonical LEX form number for this bank's category.
- **D3/2022 covering-directive body clause references** — only Annexure 1 (the limit table) is in the repo's extracted source; the directive body clauses remain counsel-gated (carried on `ORG-PR-40`).
- **Reg 24 precise sub-sub-section indices** beyond those verified by the BCBS RCAP — counsel-gated.
- **A successor directive is in consultation:** SARB issued a *Proposed Directive — Large exposure requirements* (comments to 29 October 2025) to replace D3/2022; track for the next regulatory-change cadence.

## Maintenance

- Update on amendment of regulations 24/23, on replacement of D3/2022 (proposed successor in consultation), and on any change to the BA-return schedule.
- Quarterly review by Mira (Compliance / RegTech engineer); annual sign-off by Zara (Chief Compliance Officer).
- Re-run the LEX BCBS-RCAP cross-check when BIS publishes a refreshed assessment.
