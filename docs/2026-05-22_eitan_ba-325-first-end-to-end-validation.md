---
title: BA 325 (LCR) — first end-to-end validation report
author: Eitan (Treasurer, governance)
date: 2026-05-22
workstream: WS-REPORTING-CAPABILITY-M2
brief: brief:eitan:ba-325-lcr-first-full-end-to-end-validation-run-:2026-05-22
run: run:eitan:2026-05-22T06-47-35-473Z
status: draft-for-CEO
citations:
  - D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
  - D-PROVENANCE-FILTER-ENFORCEMENT
  - D-REGULATORY-PERIMETER
  - Principles/1-events-are-truth.md
  - Banks Act 94 of 1990 §70
  - Regulations Relating to Banks Reg 26
  - BCBS D295
---

# BA 325 (LCR) — first end-to-end validation report — 2026-05-22

## Headline

**M2 gate is NOT closeable today.** The BA 325 generator runs end-to-end without error and emits a schema-valid return, but the populated content is structurally empty — `totalStockHqlaMinor = 0`, `grossOutflows = 0`, `grossInflows = 0`, `LCR = infinity`. Not a methodology defect in the generator: the upstream event base produces no rows under the production provenance filter, and the canonical-entity / deprecated-entity split keeps the FX settlement events out of the LCR scope entirely. Five categorised gaps below; minimum delta to close M2 is gap **G-1** (event-provenance taxonomy for build-phase rehearsal) plus **G-2** (entity migration backfill).

## Run command

```
BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
bun run scripts/render-ba-325.ts \
  --entity LE-ZA-HOZ-BANK \
  --as-of 2026-05-21T23:59:59.999Z \
  --period-id period:hoz-bank:month:2026-05 \
  --period-start 2026-05-01T00:00:00.000Z \
  --period-end   2026-05-31T23:59:59.999Z \
  --out /tmp/ba-325-output.json
```

Generator: `prototype/platform/reporting/ba-325-lcr.ts` (1,016 lines, Slice 3 of `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN`).
CLI: `prototype/scripts/render-ba-325.ts` (already existed; no scaffold required).
Renderer: `prototype/platform/reporting/ba-325-render.ts` (canonical JSON; XSD/XML render is Slice 5 territory and not yet on this path).

## Populated return — as-emitted

```json
{
  "$schema": "https://hoz.bank/schemas/ba-325/v0.1-rehearsal.json",
  "meta": {
    "asOf": "2026-05-21T23:59:59.999Z",
    "entity": "LE-ZA-HOZ-BANK",
    "form": "BA 325",
    "formVersion": "v0.1-rehearsal",
    "functionalCurrency": "ZAR",
    "periodId": "period:hoz-bank:month:2026-05",
    "generatorVersion": "v0.1",
    "rendererVersion": "v0.1"
  },
  "hqla": {
    "level1":  { "stockMinor": 0, "contributionMinor": 0, "lineItems": [] },
    "level2A": { "stockMinor": 0, "preCapContributionMinor": 0, "contributionMinor": 0,
                 "capBindingIndicator": false, "lineItems": [] },
    "level2B": { "stockMinor": 0, "preCapContributionMinor": 0, "contributionMinor": 0,
                 "capBindingIndicator": false, "lineItems": [] },
    "totalStockHqlaMinor": 0
  },
  "cashFlows": {
    "outflows": { "grossMinor": 0, "lineItems": [] },
    "inflows":  { "grossMinor": 0, "cappedMinor": 0, "capBindingIndicator": false, "lineItems": [] },
    "netCashOutflowsMinor": 0,
    "netCashOutflowFloorBindingIndicator": false
  },
  "lcrCompliant": true,
  "lcrPercent": "infinity",
  "lcrRatio":   "infinity",
  "placeholders": [
    "[citation: TBC — exact SARB BA 325 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]"
  ]
}
```

## Read-out per BA 325 schedule

| Schedule line | Generator field | As-emitted | Expected (sanity) | Status |
|---|---|---|---|---|
| Stock of HQLA — Level 1 | `hqla.level1.stockMinor` | 0 minor ZAR | non-zero (founding capital + SARB reserves classified to ACC-1100-001) | EMPTY — see G-1 |
| Stock of HQLA — Level 2A | `hqla.level2A.stockMinor` | 0 | 0 (no Level-2A assets booked yet) | OK by build-phase |
| Stock of HQLA — Level 2B | `hqla.level2B.stockMinor` | 0 | 0 (no Level-2B assets booked yet) | OK by build-phase |
| 40% cap on (2A+2B) | `level2A.capBindingIndicator` | false | n/a (empty input) | n/a |
| 15% cap on 2B | `level2B.capBindingIndicator` | false | n/a (empty input) | n/a |
| Total HQLA post-cap | `totalStockHqlaMinor` | 0 | non-zero | EMPTY — see G-1 |
| Gross outflows (30-day) | `cashFlows.outflows.grossMinor` | 0 | non-zero (28 FxSettlementInstructed events seen in DB) | EMPTY — see G-1, G-2 |
| Gross inflows (30-day) | `cashFlows.inflows.grossMinor` | 0 | non-zero (inverse settlement legs) | EMPTY — see G-1, G-2 |
| Inflows capped at 75% | `inflows.cappedMinor` | 0 | n/a | n/a |
| Net cash outflows (LCR denominator) | `netCashOutflowsMinor` | 0 | non-zero | EMPTY |
| 25%-of-gross floor binding | `netCashOutflowFloorBindingIndicator` | false | true (floor binds when no flows) | INCORRECT — see G-3 |
| LCR ratio (≥1.00 required) | `lcrRatio` | "infinity" | finite ratio | DEGENERATE — see G-3 |
| LCR % | `lcrPercent` | "infinity" | finite % | DEGENERATE — see G-3 |
| Currency split (ZAR / USD / EUR / GBP / other) | n/a | not in shape | required by SARB BA 325 schedule | MISSING — see G-5 |
| Sub-totals by HQLA sub-category | line `subCategory` field | empty | populated per Reg 26(7) | MISSING — see G-5 |
| Citations array | `citations` | 8 entries | populated | OK, but 1 placeholder still in `placeholders[]` |

The eight emitted citations cover the policy chain (Principle 1, D-MARKETS-SCHEMA-FOUNDATION, D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, Banks Act §70, Reg 26, BCBS D295, BCBS 248). The single open placeholder is the SARB BA 325 line-numbering, blocked on Mira's WS-INSTRUMENT-ANALYSES schema ingestion.

## Categorised gaps

### G-1 — Missing inputs: build-phase events excluded by production provenance filter (CRITICAL — blocks M2)

`computeTrialBalance` and the generator's event-fold path both call `defaultProvenanceFilter()` (authority: `D-PROVENANCE-FILTER-ENFORCEMENT`, 2026-05-12), which excludes events tagged `provenance.kind = "simulated"`. Of the 19,992 events in `~/.local/share/bank/event.db`:

| Type | Entity | Provenance | Count |
|---|---|---|---|
| `SubLedgerPostingEmitted` | LE-ZA-HOZ-BANK | simulated | 236 |
| `SubLedgerPostingEmitted` | BANK-ZA-001 | simulated | 122 |
| `FxSettlementInstructed` | BANK-ZA-001 | simulated | 28 |
| `TradeMatured` | * | * | 0 |

Every input the generator looks for is filter-eliminated. The generator's "no rows" output is therefore *correct given the filter* but *inconsistent with the build-phase operating posture* (Marc: "the bank is real, the build phase substitutes simulated data until commencement-of-trading"). Either:

- the build-phase rehearsal needs a provenance class that *is* visible to production projections (e.g. `rehearsal` or `build-phase-canonical`) which the filter passes through; or
- the BA 325 CLI needs a `--include-simulated` flag that opts the run into a relaxed filter and labels the output report-meta accordingly.

I recommend the first form. `simulated` is a strong word reserved for scenarios + fixture-only test data; the events backfilled to drive M2 rehearsals should be tagged something else (proposal: `kind: "build-phase-fixture"` with `sourceLineage: "pre-substrate-backfill"`).

### G-2 — Missing inputs: 150 events tagged to the deprecated `BANK-ZA-001` entity, not `LE-ZA-HOZ-BANK` (CRITICAL — blocks M2)

`prototype/platform/identity/entity-short-ids.ts` declares `BANK-ZA-001` as the **deprecated** short-id; `LE-ZA-HOZ-BANK` is canonical. But 150 of the 386 LCR-relevant events (all 28 `FxSettlementInstructed` plus 122 `SubLedgerPostingEmitted`) live under `BANK-ZA-001`. The BA 325 generator hard-asserts `entity ∈ BA_325_BANK_ENTITIES` and the assertion list contains only the canonical id, so the only valid `--entity` argument cannot see those 150 events.

A backfill that re-emits the `BANK-ZA-001` events under `LE-ZA-HOZ-BANK` (preserving event_id stability via a re-key event, or re-writing the entity column) closes this. Vera's `entity-identity-coherence` recon already exists and is the natural place to gate.

### G-3 — Methodology gap: LCR ratio of `"infinity"` when denominator is zero

`lcrRatio = "infinity"` and `lcrCompliant = true` is the *correct branch of the spec* when `netCashOutflowsMinor = 0` (no outflows means no liquidity stress to cover). It is *not* the *useful* output for a regulator-facing return — it masks the fact that the input is empty. Two compounding issues:

- The 25%-of-gross-outflows floor (BCBS D295 §50, Reg 26(11)) should still apply when gross outflows is zero — but the floor is a percentage of zero, so it remains zero. The `netCashOutflowFloorBindingIndicator: false` is therefore technically correct but semantically misleading.
- The render layer should distinguish "no-data" (input projections empty) from "no-stress" (genuinely zero net outflows). At present the two cases are indistinguishable.

Recommended: generator surfaces `inputCompleteness: "empty"` in `meta` when both HQLA and outflow line-item arrays are empty, and the renderer maps that to an explicit `lcrRatio: "n/a — input projections empty"` so the regulator doesn't see "infinity".

### G-4 — Methodology gap: Level-1 stock derived only from `ACC-1100-001` placeholder classification

The CLI's `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` ships a one-entry fixture (`ACC-1100-001 → level-1.central-bank-reserves`). Real BA 325 Level-1 stock per Reg 26(7)(a) needs at minimum:

- Coins and bank notes
- SARB reserves (statutory + free)
- Marketable securities issued or guaranteed by the SA government (RSA bonds, T-bills)
- Marketable securities issued or guaranteed by qualifying sovereigns / central banks / supranationals

The current single-entry classification map is insufficient even for a single-asset bank; it must be sourced from the chart-of-accounts `hqlaLevel` field (called out as a Slice-6+ substrate gap in the module header) or from a maintained classification register. Vera should pick this up as a coverage finding once Mira's WS-INSTRUMENT-ANALYSES delivers the SARB BA 325 schema.

### G-5 — XSD render gap + currency split absent

The current render is canonical JSON, not the SARB XSD/XML shape. The Slice-5 XSD lift is not on the BA 325 path (`ba-325-render.ts` emits JSON only; XML adapters exist for BA 350 / BA 600 / BA 700 only). Two specific schedule fields are missing from the JSON shape that the SARB BA 325 form requires:

- **Currency split (ZAR + USD + EUR + GBP + other)** — the generator collapses everything to functional currency; per Reg 26 the schedule reports HQLA and flows per currency, with the per-currency LCR also reported.
- **Sub-category line breakdown** within Level 1 / Level 2A / Level 2B — `lineItems[].subCategory` exists in the type but is unpopulated for build-phase classifications.

### Citation gap (minor)

One placeholder remains: `[citation: TBC — exact SARB BA 325 line-numbering pending Mira's WS-INSTRUMENT-ANALYSES schema ingestion]`. This is the right placeholder for the right reason — line-numbering is regulator-XSD-bound. Tracked, not a blocker for rehearsal-grade.

## Recon failures vs dashboard

The dashboard `liquidityMetrics` projection is a separate computation that does not flow through `ba-325-lcr.ts`; the two are not yet wired into a recon pair. Since the BA 325 generator returns empty, the dashboard tile and the BA 325 are trivially "in agreement" (both effectively show no data), but this is coincidental. A `recon:lcr-projection-vs-ba-325` gate is needed once G-1 and G-2 land.

## Workstream proposal — follow-on briefs

One brief per gap category. None of these should land in this PR (per dispatch instruction: "no methodology fixes in this PR").

| Gap | Proposed brief | Who | Scope |
|---|---|---|---|
| G-1 | Provenance-taxonomy build-phase class — introduce `kind: "build-phase-fixture"` distinct from `"simulated"`; default filter passes the new class through | Anya (Data/analytics engineer, engineering) + Atlas (Core banking platform architect) | One-shot taxonomy change + filter-default tweak + recon update; ~150 LoC |
| G-2 | Backfill `BANK-ZA-001` → `LE-ZA-HOZ-BANK` for the 150 unmigrated events; emit `EntityShortIdRekeyed` event so the chain is preserved | Atlas + Vera (recon witness) | Backfill script in `prototype/scripts/backfill/`; assert via `entity-identity-coherence` recon |
| G-3 | Generator + renderer surface `inputCompleteness: "empty" \| "partial" \| "complete"`; map empty-input case to `lcrRatio: "n/a"` not `"infinity"` | Bea (Accounting & financial reporting engineer) + Eitan | ~30 LoC generator change + render change + test |
| G-4 | Chart-of-accounts `hqlaLevel` field (Slice 6 substrate gap already named in the module header); migrate the inline `BUILD_PHASE_DEFAULT_CLASSIFICATIONS` to the COA register | Mira (WS-INSTRUMENT-ANALYSES owner) + Bea | COA schema extension + classification register + generator wire |
| G-5 | BA 325 currency-split + sub-category-breakdown — adds `perCurrency` section to the projection shape + populates `lineItems[].subCategory` from the COA `hqlaLevel` enrichment | Bea + Eitan (after G-4) | ~120 LoC; XSD/XML render is a follow-on (Slice 5 BA-325 add) |

## Recommendation

**M2 gate-closure path (ordered, minimum delta):**

1. **G-1 (provenance class)** — without this no projection that gates on `defaultProvenanceFilter` will ever see build-phase data; this is the broadest unblocker and affects every M2 return, not just BA 325. *CEO-level decision required: do build-phase events get a production-visible class, or does the BA 325 CLI sprout a `--include-simulated` opt-in flag?* I recommend the former (decision card `D-PROVENANCE-BUILD-PHASE-CLASS`).
2. **G-2 (entity-id backfill)** — engineering-only, no decision required. Atlas owns; deliver as a backfill script + `entity-identity-coherence` recon assertion.
3. **G-3 (empty-input semantics)** — engineering-only; Bea + Eitan.

With G-1 + G-2 + G-3 landed, the BA 325 will populate against the live event store with line items, a finite LCR, and meaningful sub-totals. That is the minimum bar to declare the M2 "first end-to-end return" gate closed. G-4 and G-5 are M2.5 polish (chart-of-accounts enrichment + currency split + sub-category lines) — needed for licence-day, not for M2 closure.

**The generator itself is sound.** The Slice-3 architecture (events-first cash-flow fold, GL-only-for-stock, P1-compliant) survives validation. All five gaps are at the boundary — input provisioning, entity-id discipline, edge-case rendering, classification source — not in the LCR mathematics.

## Authority + signature

Eitan (Treasurer, governance — reports to Camille CFO; LCR methodology owner)
Run: `run:eitan:2026-05-22T06-47-35-473Z`
Brief: `brief:eitan:ba-325-lcr-first-full-end-to-end-validation-run-:2026-05-22`
Citations enforced via `citation-gate`.
