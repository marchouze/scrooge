# Basel OPE — Operational Risk

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** OPE

## Citation

- **Title:** Basel Framework — OPE (Calculation of RWA for operational risk).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group OPE.
- **Applicability:** `transposed` — binds via SARB Reg 33. (The new Standardised Approach, OPE25 SMA, supersedes BIA/TSA at the Basel level from 2023; SA build-phase engine uses the BIA formula until 3 audited fiscal years of gross income exist.)

## Scope

OPE sets operational-risk capital. The bank's `ba-600-op-risk.ts` engine implements the Basic Indicator Approach (BIA) and the Standardised Approach (TSA) business-line betas; the SMA loss-component activates once a typed `OperationalLossEvent` stream accrues 5+ years of history post-licence.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:ope:25.1` | 25.1 | BIA: op-risk capital = alpha × average positive annual gross income (prior 3 years). | **alpha = 15%** |

> TSA business-line betas (12% / 15% / 18%) are implemented inline in `ba-600-op-risk.ts`, exhaustively cited against OPE; they remain in-engine per the financial-constants "fail-loud, clause-cited switch stays in-engine" rule.

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `ope:25.1` | `urn:reg:za:regs-relating-to-banks:reg33` | **ADOPTS** | BIA alpha adopted; live numbers populate post-licence + 3 audited fiscal years. |

## Live engine linkage

`prototype/platform/reporting/ba-600-op-risk.ts` (entity-scoped to `LE-ZA-HOZ-BANK`).
