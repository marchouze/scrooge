# Basel LCR — Liquidity Coverage Ratio

**Curator:** Mira · **Status:** POPULATED · **Last reviewed:** 2026-06-04 · **Standard:** LCR

## Citation

- **Title:** Basel Framework — LCR (Liquidity Coverage Ratio).
- **Issuer:** Basel Committee on Banking Supervision (BCBS) — d295 lineage.
- **Source:** [bis.org/basel_framework](https://www.bis.org/basel_framework/) — standard group LCR.
- **Applicability:** `transposed` — binds via SARB Reg 26 and BA 325. Basel is the baseline.

## Scope

LCR requires a stock of high-quality liquid assets (HQLA) sufficient to survive a 30-calendar-day liquidity stress. It defines HQLA tiers and haircuts, stressed outflow run-off rates, inflow rates, and the inflow-recognition cap. The bank's `lcr.ts` engine and the BA 325 return compute against it.

## Key provisions (paragraph-level)

| URN | Para | Requirement | Quantitative |
|---|---|---|---|
| `urn:reg:bcbs:lcr:20.5` | 20.5 | HQLA ≥ total net cash outflows over a 30-day stress. | **LCR ≥ 100%** |
| `urn:reg:bcbs:lcr:30.43` | 30.43 | HQLA haircuts: L1 0%, L2A 15%, L2B 25–50%; L2 ≤ 40% of HQLA, L2B ≤ 15%. | **0% / 15% / 25–50%** |
| `urn:reg:bcbs:lcr:40.1` | 40.1 | Stressed run-off rates: stable retail 3–5%, less-stable 10%, operational wholesale 25%, non-operational up to 100%. | **3%–100%** |
| `urn:reg:bcbs:lcr:40.77` | 40.77 | Total recognised inflows capped at 75% of total outflows. | **inflows ≤ 75% outflows** |

## Basel → South Africa adoption

| Basel provision | SA instrument | Adoption | Delta |
|---|---|---|---|
| `lcr:20.5` | `urn:reg:za:regs-relating-to-banks:reg26` | **ADOPTS** | 100% minimum adopted; reported via BA 325. |
| `lcr:30.43` | `urn:reg:za:regs-relating-to-banks:reg26` | **ADOPTS** | Operationalised in BA 325 Annex 1 haircut schedule. |
| `lcr:40.1` | `urn:reg:za:regs-relating-to-banks:reg26` | **ADOPTS** | BA 325 run-off schedule. |
| `lcr:40.77` | `urn:reg:za:regs-relating-to-banks:reg26` | **ADOPTS** | Inflow cap adopted. |

> The bank's RAS operates a stricter operating buffer (target 120% of the PA minimum) above the Basel floor — a gold-plate at the appetite layer (D-RAS), not in this catalogue.

## Live engine linkage

`prototype/platform/liquidity/lcr.ts` + `prototype/platform/reporting/ba-325-lcr.ts`. The `lcr.runoff.*`, `lcr.haircut.*`, `lcr.cap.*`, `lcr.inflow.*`, and `lcr.minimum-ratio` constants cite these provisions via `BASEL_PROVISION_LINKAGE`.
