# Basel MAR — Market Risk

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** MAR

## Citation

- **Title:** Basel Framework — MAR (Minimum capital requirements for market risk, incl. FRTB).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group MAR (d352/d457 lineage).
- **Applicability:** `transposed` — binds via SARB Reg 38; FRTB-SA commencement locally per PA PC 18/2024 (1 July 2025).

## Scope

MAR sets market-risk capital: the standardised approach (sensitivities-based method, default risk charge, residual add-on) and the internal models approach (expected shortfall). The bank runs a build-phase simplified standardised proxy plus a historical-simulation VaR/SVaR/ES suite (`var-engine.ts`); full FRTB-SA lands post-commencement.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:mar:20.1` | 20.1 | Standardised market-risk capital = Σ risk-class charges (SBM + DRC + residual add-on). | — |
| `urn:reg:bcbs:mar:33.1` | 33.1 | Internal-models capital uses expected shortfall at a 97.5% one-tailed confidence level. | **ES @ 97.5%** |
| `urn:reg:bcbs:mar:99.1` | 99.1 | Legacy (Basel 2.5) VaR: 99% one-tailed over ≈250-business-day window. | **VaR @ 99%, 250d** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `mar:20.1` | `urn:reg:za:regs-relating-to-banks:reg38` | **MODIFIES** | Bank applies a simplified instrument-class market-RWA proxy in the build phase, pending FRTB-SA. |
| `mar:99.1` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | Legacy VaR confidence/window adopted for the internal VaR suite. |

## Live engine linkage

`prototype/platform/market-risk/var-engine.ts` (99% VaR / 97.5% ES, 250-day window). The `rwa.instrument-weight.{OTC-IRD,FX-spot,FX-forward,JSE-EQUITY}` constants cite `mar:20.1` via `BASEL_PROVISION_LINKAGE`.
