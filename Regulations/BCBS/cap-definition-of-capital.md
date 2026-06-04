# Basel CAP — Definition of Capital

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** CAP

## Citation

- **Title:** Basel Framework — CAP (Definition of capital).
- **Issuer:** Basel Committee on Banking Supervision (BCBS), Bank for International Settlements.
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — consolidated framework, standard group CAP.
- **Versioning:** BIS maintains paragraph-level "as of" effective dates; this analysis tracks the consolidated framework in force from 2019-12-15.
- **Applicability:** `transposed` — binds the bank via SARB adoption (Banks Act 94 of 1990 + Regulations Relating to Banks Reg 38), not directly. Basel is the baseline; the SA instrument gives it domestic force.

## Scope

CAP defines the *numerator* of every capital ratio — what qualifies as Common Equity Tier 1 (CET1), Additional Tier 1 (AT1) and Tier 2 (T2), and the regulatory adjustments. The minimum *ratios* themselves, and the capital conservation buffer, are set in the **RBC** standard (Risk-based capital requirements): RBC20.2 and RBC30.2. The adoption registry therefore cites the RBC paragraphs for the quantitative floors. Together they are the spine the bank's capital-adequacy return (BA 700) and the `capital-metrics` projection compute against.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:rbc:20.2` | RBC20.2 | CET1 ≥ 4.5%, Tier 1 ≥ 6.0%, and total capital ≥ 8.0% of RWA at all times (one paragraph states all three minima). | **CET1 4.5% / T1 6% / Total 8%** |
| `urn:reg:bcbs:rbc:30.2` | RBC30.2 | Capital conservation buffer, met with CET1, above the minima; breach constrains distributions. | **2.5% RWA** |

> CAP defines *what counts* as CET1/AT1/T2; RBC sets the *ratios*. Both are in the verbatim BIS extracts (`Regulations/BCBS/source-docs/raw/cap-paragraphs.jsonl`, `rbc-paragraphs.jsonl`).

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `rbc:20.2` | `urn:reg:za:regs-relating-to-banks:reg38` | **ADOPTS** | Verbatim — SA minima equal the Basel floors. |
| `rbc:30.2` | `urn:reg:za:regs-relating-to-banks:reg38` | **MODIFIES** | PA holds the 2.5% conservation buffer but adds bank-specific Pillar 2A add-ons and an SARB-set countercyclical buffer. |

> Resolution: `resolveApplicableRule("za", "urn:reg:bcbs:rbc:20.2", asOf)` → SARB Reg 38 (local). For a jurisdiction with no adoption edge, the resolver returns the Basel baseline (4.5%) — the operating default until that regulator speaks.

## Live engine linkage

The CET1/Tier-1/Total minima are consumed by `prototype/platform/reporting/ba-700-capital.ts` and the `capital-metrics` projection. (These three minima remain inline-cited in the BA 700 engine per the financial-constants "fail-loud, clause-cited switch stays in-engine" rule; this catalogue is their cross-reference.)
