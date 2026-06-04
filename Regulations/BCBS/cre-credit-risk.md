# Basel CRE — Credit Risk

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** CRE

## Citation

- **Title:** Basel Framework — CRE (Calculation of RWA for credit risk).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group CRE.
- **Applicability:** `transposed` — binds via SARB Reg 38 (capital adequacy). Basel is the baseline.

## Scope

CRE sets the denominator of the credit-risk capital ratio: risk weights under the standardised approach (CRE20), the IRB approaches (CRE30–CRE36, deferred locally), and counterparty credit risk including SA-CCR (CRE51–CRE54). The bank's `rwa-engine.ts` implements the standardised approach and SA-CCR; IRB is out of scope until post-commencement.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:cre:20.6` | 20.6 | Sovereign exposures in domestic currency may be 0%-weighted at national discretion. | **0% RW (national discretion)** |
| `urn:reg:bcbs:cre:20.40` | 20.40 | Corporate exposures risk-weighted 20%–150% by external rating; unrated IG corporates 65%. | **20–150% RW** |
| `urn:reg:bcbs:cre:51.1` | 51.1 | Counterparty credit-risk EAD under SA-CCR. | **EAD = 1.4 × (RC + PFE)** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `cre:20.6` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | PA exercises the national discretion to 0%-weight ZAR RSA-sovereign exposures. |
| `cre:20.40` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | Standardised corporate weights adopted. |
| `cre:51.1` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | SA-CCR adopted (Reg 38(10)). |

## Live engine linkage

`prototype/platform/risk/rwa-engine.ts` (CRE20 standardised switch, inline-cited clause-by-clause) and `prototype/platform/risk/sa-ccr/` (CRE51 EAD). The `rwa.instrument-weight.ZA-GOV-BOND` constant (0%) cites `cre:20.6` via `BASEL_PROVISION_LINKAGE`.
