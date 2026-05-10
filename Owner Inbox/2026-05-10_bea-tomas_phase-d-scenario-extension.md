---
title: First dry-run scenario — Phase D BA returns at period close
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO) + Tomas (Operations & payments engineer, engineering — reports to Devon COO)
date: 2026-05-10
summary: Extends scenarios/03-fx-end-to-end-rehearsal.ts with Phase D — generates BA 325 / BA 700 / BA 350 / BA 600 at period close, hashes each into the BLAKE3 doc store, and emits a typed RecordFiled event per form.
decision-required: false
---

# First dry-run scenario — Phase D BA returns at period close

**Authority:** [`D-FIRST-DRY-RUN-SCENARIO`](actioned/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md) §5 Phase D (CEO-approved 2026-05-10). No new CEO decision required.

**Substrate consumed (all merged on `main` at dispatch time):**

- Phase A scenario (PR #163) — opens accounts + executes one FX trade.
- Phase B scenario (PR #172) — settlement, sub-ledger postings, period-close orchestration.
- BA 325 LCR generator (PR #174 — Reporting Slice 3).
- BA 700 capital-adequacy generator (PR #176 — Reporting Slice 4).
- BA 350 market-risk + BA 600 op-risk + XML render (PR #178 — Reporting Slice 5).
- W2 Slice 3 RWA engine (PR #177).
- Period-close + `TrialBalanceSnapshotted` (PR #170 — Reporting Slice 2).
- Document store + `RecordFiled` (RMS Slice 1: PRs #142, #144).
- Bank-account substrate (PR #164 — `D-BANK-ACCOUNT-SUBSTRATE`).

## What Phase D adds

Per pack §5 Phase D, after Phase B's `AccountingPeriodClosed` fires the runner now:

1. **Generates four SARB BA returns** from the post-close trial balance:
   - **BA 325** (LCR) — `generateBa325Lcr` in `prototype/platform/reporting/ba-325-lcr.ts`
   - **BA 700** (Capital Adequacy) — `generateBa700Capital` in `prototype/platform/reporting/ba-700-capital.ts`
   - **BA 350** (Market Risk) — `generateBa350MarketRisk` in `prototype/platform/reporting/ba-350-market-risk.ts`
   - **BA 600** (Operational Risk) — `generateBa600OpRisk` in `prototype/platform/reporting/ba-600-op-risk.ts`
2. **Renders each BA** as canonical (deterministic) JSON. BA 325 + BA 700 use their typed `renderBa…Canonical` helpers (Slice 3+4). BA 350 + BA 600 ship XML adapters (Slice 5); Phase D adds a sorted-keys JSON canonicaliser for them so all four forms produce a `<form>.json` artefact. The XML side is also produced for BA 350 / BA 600.
3. **Tags each Phase-D event** with provenance:
   ```json
   { "kind": "simulated",
     "scenario": "first-dry-run-2026-Q1",
     "sourceLineage": "scenario-runner:03-fx-end-to-end-rehearsal-phase-d" }
   ```
   The lineage is registered against the existing `scenario-runner:<name>` pattern in `prototype/platform/event-store/provenance-lineage.registry.ts`.
4. **Writes each render** to `.local/dry-run-outputs/<periodId>/<form>.json` (gitignored runtime path). The default well-known path is `.local/dry-run-outputs/2026-Q1-M01/`.
5. **Stores the canonical bytes** in a per-run BLAKE3 document store (`LocalFsDocumentStore`, isolated per scenario invocation).
6. **Emits a typed `RecordFiled` event** per form. The event payload carries `documentHash` matching the rendered bytes' BLAKE3, `registerKey: "documents"`, `classification: "governance-seat"`, retention 5 years (Companies Act 71 of 2008 §24), `archivalTier: "archive"`. The recordId is `record:documents:2026-Q1-M01:<form>`.

## Sample headline metrics from the demo run

Captured from `bun run scenario:dry-run-fx`:

```
ba325: { lcrPercent: "infinity", compliant: true }
ba700: { cet1Ratio: "10.00%", tier1Ratio: "10.00%", totalRatio: "10.00%", compliant: false }
ba350: { capitalMinor: 738_000_000 (R7.38m),  rwaMinor: 9_225_000_000 (R92.25m) }
ba600: { capitalMinor: 150_000_000 (R1.5m),   rwaMinor: 1_875_000_000 (R18.75m) }
```

**Reading the numbers:**

- **LCR = ∞** because the rehearsal classifications produce zero outflows (no liability classifications from Phase A+B's footprint produce LCR-relevant outflows). The renderer encodes the divide-by-zero as `"infinity"` per the canonical JSON contract; the `lcrCompliant` flag is `true` because ∞ ≥ the 100% Reg 26(2) minimum. Real outflow categorisation comes from chart-of-accounts liability classifications at Reporting Slice 6+.
- **Capital ratios = 10.00%** because the fixture R300m CET1 ÷ R3.0bn fixture RWA = 10.00%. `compliant: false` because the all-in CET1 minimum (4.5% base + 2.5% CCB = 7.0%) is met but the all-in **Total** minimum (8% + 2.5% = 10.5%) is not (10.00% < 10.50%). Honest rehearsal result — calibrating the fixture to a "trivially compliant" stack would obscure the headline metric.
- **BA 350 capital R7.38m** because Phase A+B's only open market position is long USD 5m, converted to ZAR at month-end 18.45 = R92.25m net long; FX charge = 8% × R92.25m = R7.38m (per BCBS / Reg 28(3)(d) "8% × max(net longs, net shorts)"; the functional currency is excluded). RWA = 12.5 × R7.38m = R92.25m.
- **BA 600 capital R1.5m** = 15% × the single positive-year fixture (R10m gross income, trading-and-sales business line). RWA = 12.5 × R1.5m = R18.75m. The build-phase has no real 3-year history (per `project_rules_bind_at_commencement`); the fixture exercises the BIA arithmetic without misrepresenting reality (`placeholders` in the render output makes the rehearsal origin obvious).

## Output paths + doc-store hashes

```
.local/dry-run-outputs/2026-Q1-M01/ba-325.json   (BLAKE3 cited in RecordFiled)
.local/dry-run-outputs/2026-Q1-M01/ba-700.json   (BLAKE3 cited in RecordFiled)
.local/dry-run-outputs/2026-Q1-M01/ba-350.json   (BLAKE3 cited in RecordFiled)
.local/dry-run-outputs/2026-Q1-M01/ba-600.json   (BLAKE3 cited in RecordFiled)
.local/dry-run-outputs/2026-Q1-M01/_doc-store/   (per-run LocalFsDocumentStore)
```

`.local/` is gitignored by `prototype/.gitignore` — the bytes never enter the commit graph (cloud target is Azure Blob + Managed-HSM envelope per RMS Phase 1 spec §4.1).

## Sample BA 700 output (excerpt — first ~30 lines of the canonical render)

```json
{
  "$schema": "https://hoz.bank/schemas/ba-700/v0.1-rehearsal.json",
  "bufferRequirements": {
    "baseCet1Ratio": 0.045,
    "baseTier1Ratio": 0.06,
    "baseTotalRatio": 0.08,
    "capitalConservationBufferRatio": 0.025,
    "counterCyclicalBufferRatio": 0,
    "dSibSurchargeRatio": 0,
    "pillar2ASurchargeRatio": 0
  },
  "capitalStack": {
    "cet1": {
      "grossStockMinor": 30000000000,
      "netStockMinor": 30000000000,
      "stockLineItems": [
        {
          "amountMinor": 30000000000,
          "contributingAccounts": ["ACC-equity-paid-up-capital-stub"],
          "currency": "ZAR",
          "lineId": "cet1.ACC-equity-paid-up-capital-stub",
          "lineLabel": "cet1.paid-up-ordinary-shares-fixture",
          "subCategory": "cet1.paid-up-ordinary-shares-fixture",
          "tier": "cet1",
          "totalDeductionsMinor": 0
        }
      ]
    },
    ...
  },
  "ratios": {
    "cet1Compliant": true,
    "cet1Percent": "1000.00%", ...
  }
}
```

(`amountMinor: 30000000000` = 30,000,000,000 cents = R300m = the synthetic CET1 fixture row injected into the trial balance — see substrate gap §1.)

## Substrate gaps surfaced (forward-link)

1. **Real classifications** — BA 325 / BA 350 / BA 600 generators take caller-supplied classification + position inputs. Phase D uses rehearsal-grade fixtures derived from Phase A+B's own footprint; until Mira's `WS-INSTRUMENT-ANALYSES` + Reporting Slice 6 expand the semantic-layer registry with `hqlaLevel` / `lcrOutflowCategory` / `capitalTier` chart-of-accounts fields, the call-site fixture is the only available input. Each render's `placeholders` field surfaces the `[citation: TBC]` marker for the line numbering.
2. **Real RWA inputs** — W2 Slice 3 RWA engine (PR #177 — `computeRwa`) is merged but takes typed `CreditExposure` / `TradingBookPosition` / `BusinessIndicatorInput` inputs that don't yet derive from Phase A+B's footprint (no credit exposures, only one trading-book position, no BIC inputs). Phase D passes a fixture `RwaDecomposition { creditRwaMinor: R1.5bn, marketRwaMinor: R1bn, operationalRwaMinor: R500m }` directly. Wiring the engine into the scenario is a future slice; the typed input shape on `generateBa700Capital` is forward-compatible (no API change at the generator boundary).
3. **No `ReportGenerated` event family yet** — Reporting Slice 5 plans a typed `ReportGenerated` event that hashes the rendered bytes and cites the trial-balance snapshot event_id. Until it lands, Phase D uses RMS Slice 1's `RecordFiled` event (which carries `documentHash` + `registerKey: "documents"`) as the equivalent content-addressed link. When `ReportGenerated` lands the helpers swap to it (mechanical; the document-store hash is the same).
4. **Entity-id alignment** — the BA generators bank-licence-gate on the canonical SARB legal-entity short-id `LE-ZA-HOZ-BANK`; the scenario event store uses the brand-typed alias `BANK-ZA-001` (per `BANK_ZA_001` in `@platform/core/types`). Phase D passes the canonical entity to the generators and the alias to the event store. Alignment lands when the legal-entity-tree register publishes the canonical short-id as the brand value.
5. **Capital-stack from sub-ledger postings** — Phase A's `CapitalContributionRecorded` event posts +R300m to `ACC-ZAR-CAPITAL-001` but that account does **not** appear in the post-close trial balance because `CapitalContributionRecorded` is not yet a sub-ledger-posting event in the M1 stub posting-rules engine (Phase B substrate gap §3). Phase D works around this by augmenting the trial balance with a synthetic R300m equity row before feeding it to the BA 700 generator. The fix lands when Reporting Slice 2.5 (posting-rules engine) ships.

## Files touched

- **Extended:** `prototype/scenarios/03-fx-end-to-end-rehearsal.ts` — adds `runPhaseAandBandD`, `PhaseDResult`, `PhaseDSummary`, `PHASE_D_PROVENANCE`. Top-level invocation now runs Phase A + B + D end-to-end (preserves `runPhaseAandB` for the existing Phase-B test).
- **New helper:** `prototype/scenarios/_phase-d-helpers.ts` — generators, fixtures, renderers, doc-store factory, output writer, RecordFiled emitter.
- **New tests:** `prototype/tests/scenarios-fx-end-to-end-phase-d.test.ts` — 8 tests / 98 expect() calls covering: 4 BA renders, valid JSON parse, BLAKE3 hash-store linkage, RecordFiled payload + provenance, summary metrics, on-disk render shape, Phase A+B count preservation.
- **No changes to:** `prototype/package.json` — the existing `scenario:dry-run-fx` script entry now executes Phase A + B + D via `import.meta.main` in the scenario file.

## CI status

Full `bun run ci` passes:

- typecheck: clean
- lint (biome): 350 files clean
- test: all suites pass (8 new Phase D tests + 22 existing scenario tests preserved)
- citation-gate: 0 violations
- All recons green (the warn-level items in dashboard-derivation, agent-spec-cross-link, decision-recommendation, parallel-dispatch-divergence, retention-citation-coverage are pre-existing and unrelated to this change).
