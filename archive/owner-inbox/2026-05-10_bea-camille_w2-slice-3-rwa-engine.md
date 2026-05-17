---
title: W2 Slice 3 — RWA engine + risk-weight semantic entries (standardised approach)
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO), Camille (Chief Financial Officer, governance — reports to CEO), Atlas (Core banking platform architect, engineering — substrate consult)
date: 2026-05-10
summary: Standardised-approach RWA engine producing credit / market / operational RWAs from typed exposure + trading-position + business-indicator inputs. Five new semantic entries (RiskWeight, CreditRwa, MarketRwa, OperationalRwa, TotalRwa) extend the Slice-1 + Slice-3-liquidity registry. Pure projection; per-entity isolation (Hoz Bank only); IRB approaches deferred.
decision-required: false
---

# W2 Slice 3 — RWA engine + risk-weight semantic entries (standardised approach)

**Authority.** Standing CEO decision **`D-REGULATORY-READINESS-GATE-PLAN`** (CEO-approved 2026-05-10), pack §3 W2 Slice 3. Recorded as `D-REGULATORY-READINESS-W2-SLICE-3` per the no-pause rule (CLAUDE.md "Operating procedures") — downstream slices of an approved decision dispatch without per-item CEO confirmation.

**Pack reference.** [`Owner Inbox/actioned/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md`](actioned/2026-05-10_zara-helena_regulatory-readiness-gate-plan.md) §3 W2 Slice 3.

**Source spec.** [`Owner Inbox/2026-05-06_reporting-capability-spec.md`](2026-05-06_reporting-capability-spec.md) §2.2 (BA returns) + §3.3 (semantic-layer RWA definitions).

## 1. Scope

Build the **RWA engine** — the projection that consumes typed credit exposures + trading-book positions + Business-Indicator inputs and produces risk-weighted assets per asset class (credit, market, operational) under the **standardised approach** per Reg 38 + BCBS Basel III/IV.

The pack §3 Slice 3 names "RWA engine + BA-form generator" jointly. Per the dispatch brief and CLAUDE.md "One dispatch path per scope" rule, **this slice scopes to the RWA engine only**. Reporting Slice 4 (Bea + Atlas + Anya — BA 700) owns the BA-form rendering and consumes this engine via the documented `RwaEngineOutput` API contract.

**In scope at v0.1:**
- Credit RWA — Σ exposures of (EAD × standardised-RW) per BCBS CRE20 + Reg 38.
- Market RWA — pre-FRTB Basel-2.5 standardised; capital charge × 12.5 per MAR.
- Operational RWA — revised standardised approach (BIC × ILM) per BCBS OPE25 + Reg 38(11); ILM=1 build-phase per Reg 38(11) optionality.
- CVA RWA — passthrough (zero placeholder); Reporting Slice 4 BA 600 populates.
- Total RWA — sum of credit + market + operational + CVA.
- Per-entity scope guard (Hoz Bank only at v0.1).

**Out of scope (deferred to later slices, named in the engine module header):**
- IRB foundation / IRB advanced approaches.
- FRTB-SA full sensitivity-based methodology (sequenced per `ORG-PR-33` PA PC 18/2024 — 1 July 2025 commencement).
- CCF tables for off-balance-sheet exposures (CRE52 follow-on).
- SA-CCR (CRE52) for derivatives netting + add-ons.
- Live BA-form rendering (Reporting Slice 4 + 5 territory).
- Live operational-loss-event ILM substrate (5+ years of typed `OperationalLossEvent` data needed).

## 2. Files landed

| Path | Role |
|---|---|
| `prototype/platform/semantic/risk-weight-entries.ts` | Five `SemanticEntry` definitions: `RiskWeight`, `CreditRwa`, `MarketRwa`, `OperationalRwa`, `TotalRwa`. Same shape as Slice-1 + Slice-3-liquidity entries; Bea + Camille + Helena named signers. |
| `prototype/platform/semantic/index.ts` | Re-exports `SLICE_3_RWA_ENTRIES` + each named entry. |
| `prototype/platform/risk/rwa-engine.ts` | Pure projection: `computeRwa(input): RwaEngineOutput` + `standardisedRiskWeight(...)` + `computeBic(...)`. Per-entity guard on Hoz Bank. |
| `prototype/platform/risk/index.ts` | Public surface re-export. |
| `prototype/tests/rwa-engine.test.ts` | 38 tests across 8 describes — semantic-entry registration, per-entity isolation, CRE20 risk-weight table coverage, BIC piecewise, per-asset-class isolation, end-to-end synthetic fixture, boundary errors, Reporting Slice 4 API contract + determinism. |
| `prototype/scripts/record-d-regulatory-readiness-w2-slice-3.ts` | Idempotent `CeoDecision` emitter for `D-REGULATORY-READINESS-W2-SLICE-3`. |

**Files explicitly NOT touched** (respect parallel work per dispatch brief):
- `prototype/platform/event-store/event-types.ts` — no `RwaSnapshot` event needed for v0.1; engine is on-demand. The brief identified this as optional ("Optional `RwaSnapshot` event for snapshot-based replay (otherwise compute on demand)") and we chose compute-on-demand to avoid colliding with Reporting Slice 4 + Slice 5 + W2 Slice 2 parallel work.
- `prototype/scripts/handlers-metadata.ts` / `handler-callables.ts` / `package.json` — known three-way collision (per `feedback_handlers_metadata_three_way_clash`).
- `prototype/platform/accounting/period-close.ts` — Slice-2 substrate (PR #170).
- `prototype/platform/semantic/entries.ts`, `liquidity-entries.ts` — Slice-1 + Slice-3-liquidity authoring.

## 3. RWA engine API

```typescript
import { rwaEngine, type RwaEngineInput, type RwaEngineOutput } from "@platform/risk";

const out: RwaEngineOutput = rwaEngine.compute({
  entityId: "LE-ZA-HOZ-BANK",
  asOf: "2026-05-31T23:59:59.999Z",
  functionalCurrency: "ZAR",
  creditExposures: [/* CreditExposure[] */],
  tradingBookPositions: [/* TradingBookPosition[] */],
  businessIndicator: { ildcMinor, scMinor, fcMinor, eurToFunctionalRate, ilm? },
  cvaRwaMinor: 0, // optional; defaults to 0 placeholder
  sourceEventIds: ["evt-..."], // optional; for Principle 1 chain-back
});

// Reporting Slice 4 (BA 700) reads:
out.totalRwaMinor;           // denominator of CET1 / AT1 / T2 ratios
out.credit.totalMinor;       // BA 700 credit-RWA cell
out.market.totalMinor;       // BA 700 market-RWA cell
out.market.capitalChargeMinor; // pre-12.5 charge for Reporting Slice 5 (BA 350)
out.operational.totalMinor;  // BA 700 operational-RWA cell
out.cvaMinor;                // BA 700 CVA-RWA cell
out.credit.lines;            // per-(counterpartyType, rating, ...) decomposition for BA 400
out.market.lines;            // per-(riskType, currency) decomposition for BA 350
```

## 4. Asset-class classifications + risk-weight table

The engine's `standardisedRiskWeight(...)` lookup covers the BCBS CRE20 standardised approach:

| Counterparty type | Risk weight |
|---|---|
| `sovereign-domestic-currency` | 0% (SARB ZAR) |
| `sovereign-foreign-currency` | 0%–150% by rating |
| `mdb-zero-weight` | 0% |
| `bank` | 20%–150% by rating + maturity |
| `pse` | 50% (default; national discretion) |
| `corporate-ig` | 20%–100% by rating; 65% unrated (post-finalised reforms) |
| `corporate-non-ig` | 100%–150% |
| `retail` | 75% |
| `residential-mortgage` | 20%–70% by LTV bucket |
| `commercial-real-estate` | 100% (general non-IPRE default) |
| `past-due` | 150% (conservative default) |
| `equity` | 250% |
| `other` | 100% (catch-all) |

SA-specific overlays (e.g. SARB-published treatment for SA municipal debt) carry `[citation: TBC]` against Mira's WS-INSTRUMENT-ANALYSES — exact resolution pending.

## 5. Fixture inputs (build-phase synthetic posture)

The end-to-end test exercises a build-phase synthetic fixture:

| Input | Value | Contribution |
|---|---|---|
| SARB sovereign exposure | R10m | 0% × R10m = 0 |
| SA bank long-term unrated | R1m | 75% × R1m = R0.75m |
| IG corporate unrated | R2m | 65% × R2m = R1.3m |
| **Credit RWA** | | **R2.05m** |
| Trading-book IRD position | R5m notional × 4% RW | R0.2m capital charge → R2.5m market RWA |
| **Market RWA** | | **R2.5m** |
| Business Indicator (ILDC R100m + SC R50m) | R150m → bucket-1 | BIC = 12% × R150m = R18m → R225m op RWA |
| **Operational RWA** | | **R225m** |
| CVA RWA | R0 (placeholder) | R0 |
| **Total RWA** | | **R229.55m** |

**Build-phase posture per `project_rules_bind_at_commencement`:** the bank holds no real customer exposures (Niko's lifecycle paused), no real trading positions, no real revenue. The engine exercises against the synthetic fixture; live numbers populate at commencement-of-trading. The substrate is production-grade by licence-day.

## 6. IRB-advanced deferral note

IRB foundation + IRB advanced approaches are **explicitly deferred** per the dispatch brief. The semantic-entry shape supports parallel registration:

- v0.1 standardised entries: `CreditRwa@v0.1`, `RiskWeight@v0.1`, etc., scoped to `rwaApproach: standardised`.
- Future IRB entries: `CreditRwa@v1.0-irb-foundation`, `CreditRwa@v1.0-irb-advanced` register under the same `id` (the registry's `version` discriminator allows multiple in-force-capable versions per id once the older is `superseded`); the `rwaApproach` dimension lets downstream consumers select.

The v0.1 standardised engine remains in-force after IRB lands — IRB applies only to portfolios under PA-approved IRB authorisation; standardised remains the default for the rest. The output-floor (72.5% of standardised RWAs) becomes load-bearing once IRB lands; v0.1's `outputFloorBinding: false` reflects this is a no-op today.

## 7. Reporting Slice 4 (BA 700) integration contract

**Contract owner:** Bea + Camille for the engine side; Reporting Slice 4 (Bea + Atlas + Anya) for the BA 700 generator side.

**Contract surface:**

```typescript
// Reporting Slice 4 BA 700 generator does:
import { rwaEngine } from "@platform/risk";

const rwa = rwaEngine.compute({ entityId, asOf, functionalCurrency, creditExposures, tradingBookPositions, businessIndicator });

const ba700 = generateBa700CapitalAdequacy({
  rwa,                  // <-- this engine's output
  capitalStack: { cet1Minor, at1Minor, t2Minor, regulatoryDeductionsMinor },
  asOf, periodId, entity,
});

// BA 700 cells derived from rwa:
//   cell "Total RWA"               ⟵ rwa.totalRwaMinor
//   cell "Credit RWA — std"        ⟵ rwa.credit.totalMinor
//   cell "Market RWA — std"        ⟵ rwa.market.totalMinor
//   cell "Operational RWA — SA"    ⟵ rwa.operational.totalMinor
//   cell "CVA RWA"                 ⟵ rwa.cvaMinor (Slice 4 also computes via BA 600)
//   cell "CET1 ratio"              ⟵ capitalStack.cet1Minor / rwa.totalRwaMinor
//   cell "Total capital ratio"     ⟵ totalCapital / rwa.totalRwaMinor
```

**Reporting Slice 5 (BA 350)** consumes `rwa.market.lines` for per-risk-type decomposition. **Reporting Slice 5 (BA 340)** consumes `rwa.operational.{biMinor, bicMinor, ilm, bicBucket}`. **Reporting Slice 4 (BA 400)** consumes `rwa.credit.lines` for per-exposure-class decomposition.

**Stability commitment:** the `RwaEngineOutput` shape is stable across v0.1 → v0.x patch versions; only additive extensions (new optional fields, new sections). Breaking changes bump engine version to `v1.0` and register a new `CreditRwa@v1.0-irb-*` semantic-entry version.

## 8. Coordination with parallel work

Per CLAUDE.md "Concurrency on shared files" + "One dispatch path per scope" + dispatch brief:

- **Reporting Slice 4 (BA 700) — Bea + Atlas + Anya.** Tight integration. API contract above is the integration point. Their PR consumes `rwaEngine.compute(...)`; if the sequencing lands BA 700 first, that PR uses a temporary stub that this PR then satisfies. Daily Atlas-led rebase if needed.
- **Reporting Slice 5 (BA 350 + BA 600 + XML) — Bea + Atlas + Anya.** BA 350 reads `rwa.market.lines`; BA 600 populates `cvaRwaMinor` for the next engine call.
- **W2 Slice 2 (RAS B2 calibration) — Helena + Rohan + Bea.** Different files (RAS substrate); uses `rwa.totalRwaMinor` as a fixture input for the +1.5pp CET1 management buffer calibration.
- **WS-JS-NUMBER-RECONCILIATION — Mira.** No file collision.

**No dual dispatch path:** this dispatch is the single owner of `prototype/platform/risk/rwa-engine.ts` + `prototype/platform/semantic/risk-weight-entries.ts`. No `spawn_task` chip + background `Agent` duplication per `feedback_chip_vs_background_agent_duplication`.

## 9. Substrate gaps surfaced

Forward-link these to the substrate roadmap:

1. **IRB foundation / advanced approaches** — deferred; semantic entries support parallel `version`-bumped registration.
2. **FRTB-SA full sensitivity-based methodology** — pre-FRTB Basel-2.5 standardised at v0.1; FRTB-SA migration sequenced per `ORG-PR-33` PA PC 18/2024 (1 July 2025 commencement). Build-phase rehearsal acceptable per `project_rules_bind_at_commencement`.
3. **CCF tables** for off-balance-sheet exposures (CRE52). Caller pre-computes EAD at v0.1.
4. **SA-CCR (CRE52)** for derivatives netting + add-ons. v0.1 treats derivatives as funded EADs supplied by caller.
5. **Operational-Loss-Event substrate** for live ILM. Hard-coded `ilm = 1` per Reg 38(11) optionality at v0.1.
6. **`rwa-projection`** executable form — semantic entries name it; v0.1 accepts engine input directly. Slice-4-or-later promotion.
7. **Optional `RwaSnapshot` event** for replay — deferred. Per dispatch brief: "(otherwise compute on demand)" — chose on-demand to avoid `event-types.ts` collision with parallel work.
8. **Tier-1 model validation** — RWA engine is Tier-1 per RAS B7 model-tier classification. Independent validation by Nadia (Independent-validation engineer under Helena CRO) gates production use post-licence-day. Build-phase rehearsal does not require validation per `project_ai_driven_bank` build-phase posture.

## 10. Citations

**Standing authority (Principle 2):**
- `D-REGULATORY-READINESS-GATE-PLAN` (CEO-approved 2026-05-10).
- `D-REGULATORY-READINESS-W2-SLICE-3` (this slice — emitted by `record-d-regulatory-readiness-w2-slice-3.ts`).

**Regulatory anchors:**
- Banks Act 94 of 1990 §70 (capital-adequacy prudential requirements — empowering provision).
- Regulations Relating to Banks Reg 38 (capital adequacy + RWA computation). Reg 38(11) operational-risk capital. `[citation: TBC — exact sub-clause indices for RW table; Mira's WS-INSTRUMENT-ANALYSES]`.
- BCBS Basel III/IV finalised reforms (CRE20 standardised credit risk, MAR market risk, OPE25 operational risk standardised approach).
- `ORG-PR-01` (Banks Act + Regs Relating to Banks — capital-adequacy minima sit on top of RWA).
- `ORG-PR-31` (SARB PA Guidance Note 3/2023 — Basel III/IV implementation dates).
- `ORG-PR-33` (SARB PA Prudential Communication 18/2024 — FRTB + revised CVA implementation roadmap; 1 July 2025 commencement).
- `ORG-PR-17` (BCBS Operational Risk rev. 2021 — operational-risk identification + control framework).

**Operational discipline:**
- CLAUDE.md "Operating procedures" — events-first authoring + dispatch discipline (no-pause rule; worktree isolation; scaffold-commit early; identity discipline; one dispatch path per scope).
- `D-REGULATORY-PERIMETER` (per-entity isolation — Hoz Bank licence-bound on the standardised approach; Hoz Securities is FSCA + JSE Member Rules scoped; Hoz Group consolidated reading per `ORG-BNK-ICAAP-CONS`).

## 11. Tests + recons

- `prototype/tests/rwa-engine.test.ts` — 38 tests, 105 expects, all passing.
- Full prototype suite: 966 / 966 pass after this slice lands.
- `bun run citation-gate` — 0 violations.
- `bun run typecheck` — pre-existing baseline only (bun-types + baseUrl deprecation warning); no new errors.
- `bun run lint` — biome clean on all new files.

## 12. Forward links

- **Reporting Slice 4 (BA 700)** — consumes `rwaEngine.compute(...)`; produces capital-adequacy summary form.
- **Reporting Slice 5 (BA 350 / BA 340 / BA 400)** — per-asset-class decomposition forms.
- **W2 Slice 2 (RAS B2 CET1 management buffer)** — consumes `totalRwaMinor` as fixture input.
- **W2 Slice 4 (first BA-form dry-run)** — uses this engine end-to-end against the synthetic fixture.
- **Slice 6+ IFRS AFS skeleton** — RWA does not feed AFS directly; capital-stack does.
- **Future `D-REGULATORY-READINESS-W2-SLICE-3-IRB`** — adds IRB foundation / advanced approaches; supersedes v0.1 entries with v1.0-irb-* under the registry's append-only-versioned semantics.
