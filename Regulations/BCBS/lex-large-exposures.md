# Basel LEX — Large Exposures

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** LEX

## Citation

- **Title:** Basel Framework — LEX (Large exposures).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group LEX.
- **Applicability:** `transposed` — binds via SARB Reg 38 and BA 330.

## Scope

The large-exposures framework caps concentration to a single counterparty or group of connected counterparties as a percentage of the eligible capital base (Tier 1). The bank's credit-limit engine enforces single-name and connected-counterparty limits and escalates breaches.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:lex:10.8` | 10.8 | Exposure to a single / connected counterparty ≤ a fraction of Tier 1 capital. | **≤ 25% Tier 1** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `lex:10.8` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | 25% single-counterparty ceiling adopted; reported via BA 330. |

## Live engine linkage

`prototype/platform/risk/credit-limit-engine/` (single-name + connected limits) and `prototype/platform/reporting/ba-330` large-exposures return. RAS §B2 concentration appetite sits stricter, above the regulatory ceiling.
