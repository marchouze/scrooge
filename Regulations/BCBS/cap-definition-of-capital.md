# Basel CAP — Definition of Capital

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** CAP

## Citation

- **Title:** Basel Framework — CAP (Definition of capital).
- **Issuer:** Basel Committee on Banking Supervision (BCBS), Bank for International Settlements.
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — consolidated framework, standard group CAP.
- **Versioning:** BIS maintains paragraph-level "as of" effective dates; this analysis tracks the consolidated framework in force from 2019-12-15.
- **Applicability:** `transposed` — binds the bank via SARB adoption (Banks Act 94 of 1990 + Regulations Relating to Banks Reg 38), not directly. Basel is the baseline; the SA instrument gives it domestic force.

## Scope

CAP defines the numerator of every capital ratio: what qualifies as Common Equity Tier 1 (CET1), Additional Tier 1 (AT1), and Tier 2 (T2), the regulatory adjustments, and the minimum ratios and buffers that sit above them. It is the spine the bank's capital-adequacy return (BA 700) and the `capital-metrics` projection compute against.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:cap:10.1` | 10.1 | CET1 capital ≥ a floor of risk-weighted assets at all times. | **≥ 4.5% RWA** |
| `urn:reg:bcbs:cap:10.2` | 10.2 | Tier 1 capital (CET1 + AT1) ≥ floor of RWA. | **≥ 6.0% RWA** |
| `urn:reg:bcbs:cap:10.3` | 10.3 | Total capital (Tier 1 + Tier 2) ≥ floor of RWA. | **≥ 8.0% RWA** |
| `urn:reg:bcbs:cap:30.1` | 30.1 | Capital conservation buffer, met with CET1, above the minima; breach constrains distributions. | **2.5% RWA** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `cap:10.1` / `10.2` / `10.3` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | Verbatim — SA minima equal the Basel floors. |
| `cap:30.1` | `urn:reg:za:regs-relating-to-banks:reg38` | **MODIFIES** | PA holds the 2.5% conservation buffer but adds bank-specific Pillar 2A add-ons and an SARB-set countercyclical buffer. |

> Resolution: `resolveApplicableRule("za", "urn:reg:bcbs:cap:10.1", asOf)` → SARB Reg 38 (local). For a jurisdiction with no adoption edge, the resolver returns the Basel baseline (4.5%) — the operating default until that regulator speaks.

## Live engine linkage

The CET1/Tier-1/Total minima are consumed by `prototype/platform/reporting/ba-700-capital.ts` and the `capital-metrics` projection. (These three minima remain inline-cited in the BA 700 engine per the financial-constants "fail-loud, clause-cited switch stays in-engine" rule; this catalogue is their cross-reference.)
