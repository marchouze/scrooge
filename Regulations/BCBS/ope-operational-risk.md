# Basel OPE — Operational Risk

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** OPE

## Citation

- **Title:** Basel Framework — OPE (Calculation of RWA for operational risk).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group OPE.
- **Applicability:** `transposed` — binds via SARB Reg 33. (The new Standardised Approach, OPE25 SMA, supersedes BIA/TSA at the Basel level from 2023; SA build-phase engine uses the BIA formula until 3 audited fiscal years of gross income exist.)

## Scope

OPE sets operational-risk capital. The **consolidated framework uses the Standardised Approach (SMA)**: the Business Indicator Component (BI × marginal coefficients) scaled by the Internal Loss Multiplier — it replaced the retired Basic Indicator Approach (BIA) and TSA from 2023. The bank's `ba-600-op-risk.ts` engine currently computes a build-phase BIA/TSA figure; the SMA loss-component activates once a typed `OperationalLossEvent` stream accrues 5+ years of history post-licence. (The bank engine is therefore a build-phase simplification of the Basel SMA baseline catalogued here.)

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:ope:25.7` | OPE25.7 | SMA: the Business Indicator is multiplied by marginal coefficients across BI buckets to form the Business Indicator Component, scaled by the Internal Loss Multiplier. | **marginal coefficients 12% / 15% / 18%** |

> The 15% middle-bucket coefficient is the SMA analogue of the old BIA alpha. The bank engine's BIA/TSA betas remain inline per the financial-constants "fail-loud, clause-cited switch stays in-engine" rule.

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `ope:25.7` | `urn:reg:za:regs-relating-to-banks:reg33` | **ADOPTS** | SMA adopted; live numbers populate post-licence + sufficient loss history. |

## Live engine linkage

`prototype/platform/reporting/ba-600-op-risk.ts` (entity-scoped to `LE-ZA-HOZ-BANK`).
