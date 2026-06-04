# Basel NSF — Net Stable Funding Ratio

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** NSF

## Citation

- **Title:** Basel Framework — NSF (Net Stable Funding Ratio).
- **Issuer:** Basel Committee on Banking Supervision (BCBS) — d335 lineage.
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group NSF.
- **Applicability:** `transposed` — binds via SARB Reg 26A and BA 326.

## Scope

NSFR requires available stable funding (ASF) to cover required stable funding (RSF) over a one-year horizon. It assigns ASF factors to funding sources and RSF factors to assets. The bank's `nsfr.ts` / `ba-350-nsfr.ts` engine computes against it.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:nsf:20.1` | 20.1 | ASF ≥ RSF on an ongoing one-year basis. | **NSFR ≥ 100%** |
| `urn:reg:bcbs:nsf:30.1` | 30.1 | ASF factors: capital & >1y 100%; stable retail <1y 95%; less-stable 90%; operational wholesale 50%; non-operational <1y 0%. | **0%–100%** |
| `urn:reg:bcbs:nsf:40.1` | 40.1 | RSF factors: HQLA L1 5%, L2A 15%, L2B 50%; loans by residual maturity 10–85%; net derivative liabilities 100%. | **5%–100%** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `nsf:20.1` | `urn:reg:za:regs-relating-to-banks:reg26a` | **ADOPTS** | 100% minimum adopted; reported via BA 326. |
| `nsf:30.1` | `urn:reg:za:regs-relating-to-banks:reg26a` | **ADOPTS** | ASF factor table adopted. |
| `nsf:40.1` | `urn:reg:za:regs-relating-to-banks:reg26a` | **ADOPTS** | RSF factor table adopted. |

## Live engine linkage

`prototype/platform/liquidity/nsfr.ts` + `prototype/platform/reporting/ba-350-nsfr.ts`. The `nsfr.asf.*`, `nsfr.rsf.*`, and `nsfr.minimum-ratio` constants cite these provisions via `BASEL_PROVISION_LINKAGE`.
