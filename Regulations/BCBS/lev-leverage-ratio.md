# Basel LEV — Leverage Ratio

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** LEV

## Citation

- **Title:** Basel Framework — LEV (Leverage ratio).
- **Issuer:** Basel Committee on Banking Supervision (BCBS).
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group LEV.
- **Applicability:** `transposed` — binds via SARB Reg 38. The bank's RAS gold-plates the floor.

## Scope

The leverage ratio is a non-risk-based backstop: Tier 1 capital divided by a total exposure measure (on-balance-sheet + derivatives + SFTs + off-balance-sheet). The bank's `ba-400-leverage-ratio.ts` engine computes it; the RAS sets green/amber/red appetite bands above the regulatory minimum.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:lev:20.7` | 20.7 | Tier 1 capital ÷ total exposure measure ≥ minimum. | **≥ 3%** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `lev:20.7` | `urn:reg:za:regs-relating-to-banks:reg38` | **GOLD_PLATES** | PA adopts the 3% Basel minimum; the bank's RAS operates a stricter band — green ≥ 4.5%, amber 4.0–4.5%, red < 3.5% (D-RAS). |

> This is the canonical GOLD_PLATES case: the operating threshold is stricter than the Basel floor. `resolveApplicableRule("za", "urn:reg:bcbs:lev:20.7", asOf)` returns `adoptionType: "GOLD_PLATES", stricter: true` — the baseline (3%) is preserved, the local tightening is the delta.

## Live engine linkage

`prototype/platform/reporting/ba-400-leverage-ratio.ts`. The `leverage.threshold.{green,amber,red}` RAS bands cite `lev:20.7` via `BASEL_PROVISION_LINKAGE`.
