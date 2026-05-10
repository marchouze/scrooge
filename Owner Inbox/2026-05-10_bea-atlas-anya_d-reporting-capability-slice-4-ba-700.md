---
title: Reporting capability Slice 4 — BA 700 Capital Adequacy Return end-to-end
author: Bea, Atlas, Anya
date: 2026-05-10
summary: Second SARB return rendered end-to-end. Eight capital-classification semantic entries (CET1, AT1, T2, deductions, RWA, three ratios), BA 700 projection with per-tier deduction arithmetic + buffer-overlay required-minimums (CCB / CCyB / D-SIB / Pillar-2A), deterministic JSON renderer with declared schema, CLI wrapper. Per-entity (Hoz Bank only). Rehearsal-grade per Marc's Q1; W2 Slice 3 RWA-engine integration deferred (fixture inputs for now).
decision-required: false
decision-id: D-REPORTING-CAPABILITY-SLICE-4
---

# Reporting capability Slice 4 — BA 700 Capital Adequacy Return end-to-end

**Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10).
**Pack reference:** [`Owner Inbox/actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 4.
**Authors:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) · Atlas (Core banking platform architect, engineering — substrate consult; RWA-engine input contract) · Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer + projection-runtime curator).
**Authority taxonomy:** downstream sub-decision under standing authority; no new CEO decision required (`feedback_no_pause_rule`).

---

## 1 — What landed

The second SARB return rendered end-to-end. The full chain — semantic-layer registry → sub-ledger postings → period-close trial balance → BA 700 projection → JSON render — is now exercised by a single CLI command:

```
bun run scripts/render-ba-700.ts \
    --entity LE-ZA-HOZ-BANK \
    --as-of 2026-05-31T23:59:59.999Z \
    --period-id period:hoz-bank:month:2026-05
```

Output: a canonical, schema-validated JSON document with the BA 700 capital-stack lines (CET1 / AT1 / T2 — gross stock + deductions + net stock per tier), the RWA decomposition (credit / market / operational), the required-minimum overlay (base + CCB + CCyB + D-SIB + Pillar-2A), and the three capital-adequacy ratios (CET1 / Tier 1 / Total).

### Files

| File | Purpose |
|---|---|
| `prototype/platform/semantic/capital-entries.ts` | Eight new semantic entries — `CommonEquityTier1Capital`, `AdditionalTier1Capital`, `Tier2Capital`, `RegulatoryCapitalDeductions`, `RiskWeightedAssets`, `CommonEquityTier1Ratio`, `Tier1CapitalRatio`, `TotalCapitalRatio`. Each cites Banks Act §70 + Reg 38 + BCBS Basel III + one `[citation: TBC]` per pack §9 Q1 default. |
| `prototype/platform/reporting/ba-700-capital.ts` | `generateBa700Capital` projection. Pure function `(trialBalance, classifications, deductions, rwa, [bufferRequirements]) → Ba700Output`. Per-tier deduction arithmetic; three-ratio composition; required-minimum overlay; per-entity isolation. |
| `prototype/platform/reporting/ba-700-render.ts` | `renderBa700ToJson` + `canonicaliseBa700` + Zod `Ba700RenderSchema`. Deterministic key-sorted bytes; ratios encoded as strings to preserve `Infinity`. Hash-store-friendly for downstream `ReportGenerated`. |
| `prototype/platform/reporting/index.ts` | Public surface — extends Slice 3 exports with the BA 700 surface. |
| `prototype/platform/semantic/index.ts` | Public surface — extends Slice 3 exports with the eight capital entries. |
| `prototype/scripts/render-ba-700.ts` | CLI wrapper — replays event store, resolves trial balance from `periodAuditChain` or ad-hoc compute, runs generator + render, writes JSON. |
| `prototype/tests/ba-700-capital.test.ts` | Tests (28 / 28 passing) — semantic-entry registration; per-entity isolation; required-minimum overlay arithmetic; end-to-end synthetic event-stream → close → BA 700 → JSON; full three-tier-stack arithmetic; floored-net-tier; divide-by-zero RWA; canonicaliser determinism; provenance passthrough; generator boundary errors. |
| `prototype/scripts/record-d-reporting-capability-slice-4.ts` | CeoDecision-emitter for `D-REPORTING-CAPABILITY-SLICE-4`. |

---

## 2 — BA 700 line definitions (rehearsal-grade per Q1)

Per Marc's Q1 default — line definitions carry `[citation: TBC]` markers where the SARB BA 700 published schema isn't fully analysed yet. Mira's `WS-INSTRUMENT-ANALYSES` workstream resolves to the published taxonomy.

### Capital-stack section (numerator)

| Tier | Composition | Deductions | Render |
|---|---|---|---|
| CET1 | Paid-up ordinary shares + retained earnings + accumulated OCI + qualifying minority interests | Goodwill + other intangibles + DTAs (future-profitability-dependent) + significant investments above 10% threshold + MSRs above threshold + own-credit-risk gains + DB-pension net assets — per Reg 38(8) / BCBS Basel III §66–§90 | Gross stock + per-line deductions + net stock |
| AT1 | Perpetual non-cumulative preference shares + qualifying AT1 instruments meeting BCBS Basel III §54–§55 | AT1-tier corresponding deductions per Reg 38(8) | Gross stock + per-line deductions + net stock |
| T2 | Subordinated debt + general loan-loss provisions (capped at 1.25% of credit-RWA under standardised) + qualifying T2 instruments per BCBS Basel III §57 | T2-tier corresponding deductions per Reg 38(8) | Gross stock + per-line deductions + net stock |

`netCET1 = grossCET1 − cet1Deductions`, floored at 0.
`netTier1 = netCET1 + netAT1`.
`netTotalCapital = netTier1 + netT2`.

### RWA-denominator section

| Risk type | Source | Generator input |
|---|---|---|
| Credit RWA | BCBS Basel III credit-risk framework (Standardised at v0; IRB at later slice) | `RwaDecomposition.creditRwaMinor` |
| Market RWA | BCBS FRTB | `RwaDecomposition.marketRwaMinor` |
| Operational RWA | BCBS Basel III SMA / Reg 38 BSA | `RwaDecomposition.operationalRwaMinor` |

`totalRWA = creditRWA + marketRWA + operationalRWA`. RWA inputs caller-supplied at v0 — see §5 substrate gaps for W2 Slice 3 integration.

### Required-minimum overlay

Per Reg 38(2)–(7) + BCBS Basel III §50 + §122–§148, the *all-in* required minimum is the BCBS base + buffer overlay:

| Component | Default | Notes |
|---|---|---|
| BCBS base CET1 / Tier 1 / Total | 4.5% / 6% / 8% | BCBS Basel III §50 hard floor |
| Capital Conservation Buffer (CCB) | 2.5% | BCBS §122–§128; conservation-range earnings restriction when breached |
| Counter-cyclical Buffer (CCyB) | 0–2.5% (default 0%) | BCBS §136–§148; SARB-published per-jurisdiction rate |
| D-SIB Surcharge | 1–2.5% if D-SIB (default 0%) | FSB / SARB methodology — Hoz Bank not D-SIB at build-phase |
| Pillar-2A Surcharge | 0% (default) | SARB-set bank-specific add-on; calibration per W2 ICAAP cycle |

The overlay applies uniformly across CET1 / Tier 1 / Total minimums:
`minCET1Required = baseCET1 + CCB + CCyB + DSIB + Pillar2A`.

### Three exit-cell ratios

```
cet1Ratio   = netCET1            / totalRWA      ≥ 4.5% + overlay
tier1Ratio  = netTier1           / totalRWA      ≥ 6%   + overlay
totalRatio  = netTotalCapital    / totalRWA      ≥ 8%   + overlay
```

`[citation: TBC]` markers on every BA 700 sub-line label — Mira's `WS-INSTRUMENT-ANALYSES` will resolve to the published SARB BA 700 cell numbers.

---

## 3 — Projection logic

`generateBa700Capital(input: Ba700GeneratorInput): Ba700Output`. Pure function, deterministic.

```
1. assertBankEntity(input.entity)                — Hoz Bank only; reject Securities + Group.
2. validateBuffers(input.bufferRequirements ?? DEFAULT)  — base ordering + range bounds.
3. classMap = index(input.classifications)        — duplicate detection.
4. for each tb-row in trial-balance (filter: row.currency === functionalCurrency):
     if classMap.has(row.leafAccountId):
        gross[tier] += abs(row.amountMinor)
        flag if amountMinor > 0 (debit on capital — sign-convention warning)
5. for each deduction in input.deductions:
     assert deduction.currency === functionalCurrency
     assert deduction.amountMinor >= 0
     deductTotal[tier] += deduction.amountMinor
6. net[tier] = max(gross[tier] - deductTotal[tier], 0)
7. tier1 = netCET1 + netAT1; total = tier1 + netT2
8. totalRWA = sum(rwa.{credit,market,operational})
9. ratios = { cet1, tier1, total } / totalRWA      (Infinity if totalRWA == 0)
10. minimums = computeRequiredMinimums(buffers)
11. compliant = ratio >= minimum                    (per ratio)
12. fingerprint(classifications) + fingerprint(deductions) + fingerprint(rwa)
13. emit Ba700Output (typed, immutable)
```

Sign convention: capital instruments are credit-side balances on the GL; the generator takes `Math.abs(row.amountMinor)` so stocks render as positive magnitudes. A note flags accounts where the convention appears violated (debit balance on a capital-classified account).

---

## 4 — JSON schema (`Ba700RenderSchema`)

Top-level shape (Zod-validated, key-sorted canonical form):

```jsonc
{
  "$schema": "https://hoz.bank/schemas/ba-700/v0.1-rehearsal.json",
  "meta": {
    "form": "BA 700",
    "formVersion": "v0.1-rehearsal",
    "entity": "LE-ZA-HOZ-BANK",
    "asOf": "2026-05-31T23:59:59.999Z",
    "periodId": "period:hoz-bank:month:2026-05",
    "functionalCurrency": "ZAR",
    "generatorVersion": "v0.1",
    "rendererVersion": "v0.1",
    "trialBalanceSnapshotEventId": "ev-...",
    "classificationsFingerprint": "...",
    "deductionsFingerprint": "...",
    "rwaFingerprint": "...",
    "renderedAt": "2026-05-10T15:00:00.000Z"
  },
  "capitalStack": {
    "cet1": { "tier": "cet1", "grossStockMinor": ..., "totalDeductionsMinor": ..., "netStockMinor": ..., "stockLineItems": [...], "deductionLineItems": [...] },
    "at1":  { ... },
    "t2":   { ... },
    "netTier1Minor": ...,
    "netTotalCapitalMinor": ...
  },
  "rwa": {
    "creditRwaMinor": ..., "marketRwaMinor": ..., "operationalRwaMinor": ...,
    "totalRwaMinor": ..., "source": "fixture-rehearsal", "rwaComputationEventId": "ev-..."
  },
  "bufferRequirements": { "baseCet1Ratio": 0.045, "capitalConservationBufferRatio": 0.025, ... },
  "ratios": {
    "cet1Ratio": "0.0983", "cet1Percent": "9.83%", "cet1RatioRequiredMinimum": "0.0700",
    "cet1RequiredMinimumPercent": "7.00%", "cet1Compliant": true,
    "tier1Ratio": "...", ...,
    "totalRatio": "...", "totalCompliant": false
  },
  "citations": [ "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN", "Banks Act 94 of 1990 §70", ... ],
  "placeholders": [ "[citation: TBC ...]" ]
}
```

Ratios are encoded as strings to preserve `Infinity` (the divide-by-zero edge case for zero RWA). Finite ratios serialise as `"0.1234"` (4 decimals); divide-by-zero as `"infinity"`.

---

## 5 — RWA-input dependency on W2 Slice 3

The BA 700 generator is the *consumer* of the RWA engine. The W2 Slice 3 RWA engine (parallel dispatching now per the W2 pack §3) computes risk-weighted assets per asset class under BCBS Basel III + Reg 38, and emits a `RwaComputed` event whose typed payload exactly matches `RwaDecomposition` in `ba-700-capital.ts`.

**Integration boundary (no API change):**

```typescript
// W2 Slice 3 emits:
type RwaComputed = {
  creditRwaMinor: number;
  marketRwaMinor: number;
  operationalRwaMinor: number;
  // ... breakdown by asset class, per-counterparty exposure, etc.
};

// BA 700 generator consumes:
const out = generateBa700Capital({
  ...
  rwa: {
    creditRwaMinor: rwaComputed.creditRwaMinor,
    marketRwaMinor: rwaComputed.marketRwaMinor,
    operationalRwaMinor: rwaComputed.operationalRwaMinor,
    rwaComputationEventId: rwaComputedEvent.event_id,  // chain-of-custody
    source: "engine:w2-slice-3",
  },
});
```

**v0 fixture-grade rehearsal:** the CLI default `BUILD_PHASE_DEFAULT_RWA` provides R30,000,000 split notionally across credit (R15m) / market (R10m) / operational (R5m). The render's `placeholders` array fires the `[citation: TBC — RWA inputs are fixture-grade ...]` marker when `source === "fixture-rehearsal"` so the placeholder origin is obvious in the rendered output.

When the W2 Slice 3 engine merges, the only change is at the call site — replace the fixture with the engine's typed output. The BA 700 generator's input shape, the renderer's schema, and the CLI's `--rwa` flag are all forward-compatible.

---

## 6 — M8 Azure mapping

Same lift contract as Slice 3 BA 325:

- **Rendered bytes** → Azure Blob via the M8 RMS doc-store contract (PR #142 + spec §4.1). BLAKE3 content-hash is the doc-store key; immutable; per-entity scoped via the `meta.entity` field on the rendered shape.
- **`ReportGenerated` event** (Slice 5) cites the BLAKE3 hash + the schema URL (`https://hoz.bank/schemas/ba-700/v0.1-rehearsal.json`) + the trial-balance snapshot event ID + the RWA computation event ID. Chain-of-custody under Principle 1.
- **SARB-portal XML render** (Slice 5) takes the canonical JSON as the input contract — the BA 700 typed shape never crosses the engine ↔ render boundary in untyped form.
- **Capital-classification map** migrates onto the chart-of-accounts (`capitalTier` + `deductionTier` fields per leaf account) at Slice 6+ once Mira's `WS-INSTRUMENT-ANALYSES` lands the SARB BA 700 published taxonomy. Until then the map lives at the call site (CLI flag `--classifications path/to/classifications.json`).

---

## 7 — Substrate gaps surfaced

Forward-link to follow-on slices:

1. **W2 Slice 3 RWA engine** — v0 BA 700 accepts caller-supplied `RwaDecomposition`. Engine integration when W2 Slice 3 lands (no generator API change).
2. **Capital-stack projection executable form** — Slice 6. v0 reads the trial balance + classifications + deductions directly; Slice 6 introduces a typed `capital-stack` projection on the runtime that the BA 700 generator consumes.
3. **Threshold-deduction arithmetic** — Slice 6+. Reg 38(8) 10%/15% bucket arithmetic for significant investments + DTAs (temporary differences) + MSRs requires the chart-of-accounts deduction-tier classification work. v0 fixtures take pre-computed deduction amounts.
4. **Multi-currency capital** — Slice 6+. FX-translation reserves within OCI count toward CET1 per BCBS Basel III §53; v0 functional-currency only per the strategic-foundation single-branch posture.
5. **Group-consolidated BA 700** — Slice 7. LE-ZA-HOZ-GROUP look-through per Banks Act §60 requires the consolidation projection. v0 solo entity (LE-ZA-HOZ-BANK) only.
6. **D-SIB classification + Pillar-2A SARB calibration** — W2 ICAAP cycle. v0 buffer defaults are BCBS minimums + 2.5% CCB only.
7. **RAS B2 management-buffer ratify-pathway** — W2 Slice 2 (separate parallel dispatch). Sets the +1.5pp CET1 management buffer above regulatory all-in minimum.
8. **AT1 + T2 issuance event family** — Slice 6 / capital-stack projection. v0 AT1 + T2 stocks = 0; the entry shape is structurally complete from day one.
9. **`recon:ba700-capital-coverage`** — Vera Wave-N follow-on. Asserts per-account capital-tier classifications cover every chart-of-accounts equity / capital-instrument leaf.
10. **Live capital + retained-earnings** populate at licence-day capital-call per `project_ai_driven_bank` — build-phase uses synthetic capital fixtures.

---

## 8 — Coordination with parallel work

This slice respects four parallel dispatches landing today (per Scrooge's dispatch brief):

| Workstream | Owner | Code area | Collision risk | Mitigation |
|---|---|---|---|---|
| Reporting Slice 5 (BA 350/600 + XML) | Bea + Atlas + Anya | `prototype/platform/reporting/ba-350-*.ts`, `ba-600-*.ts`, `ba-*-xml.ts` | High — same authors, same `prototype/platform/reporting/` directory | Distinct files (`ba-700-*.ts` vs `ba-350-*.ts` etc.) |
| W2 Slice 2 (RAS B2 calibration) | Helena + Rohan + Bea | `Owner Inbox/2026-05-10_*ras-b2*.md` | Different code area | Bea coordinates via test files only |
| W2 Slice 3 (RWA engine) | Bea + Camille | `prototype/platform/risk/rwa-*.ts` (likely) | Provides this slice's inputs | v0 fixture inputs; switch to engine outputs when it lands (no API change) |
| WS-JS-NUMBER-RECONCILIATION (Mira) | Mira | Register only | None | — |

No changes touched: `prototype/platform/event-store/event-types.ts` (reads only), `prototype/platform/event-store/registry.ts`, `prototype/platform/accounting/period-close.ts`, `prototype/platform/semantic/entries.ts`, `prototype/platform/semantic/liquidity-entries.ts`, `prototype/platform/projections/runtime.ts`, `prototype/dashboard/derive.ts`, BA 325 module. Avoids `handlers-metadata.ts` / `handler-callables.ts` / `package.json` collisions per `feedback_handlers_metadata_three_way_clash`.

---

## 9 — Acceptance evidence

```
$ cd prototype && bun test tests/ba-700-capital.test.ts
 28 pass
  0 fail
 121 expect() calls
Ran 28 tests across 1 file.

$ bun run typecheck
$ bunx tsc --noEmit
(clean)
```

After merge:

```
$ bun run scripts/render-ba-700.ts \
    --entity LE-ZA-HOZ-BANK \
    --as-of 2026-05-31T23:59:59.999Z \
    --period-id period:hoz-bank:month:2026-05 \
    --period-start 2026-05-01T00:00:00.000Z \
    --period-end 2026-05-31T23:59:59.999Z
```

produces JSON BA 700 with the computed three-ratio capital-adequacy chain.

---

## 10 — Citations

- **Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10).
- **Pack:** [`Owner Inbox/actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 4.
- **Statute:** Banks Act 94 of 1990 §70.
- **Regulation:** Regulations Relating to Banks Reg 38 (`ORG-PR-04`).
- **Standards:** BCBS Basel III §50–§90 (capital composition + deductions); BCBS Basel III §122–§148 (buffer framework + counter-cyclical).
- **Upstream slices:** Slice 1 (semantic registry) + Slice 2 (period-close + trial balance) + Slice 3 (BA 325 LCR — pattern mirror).
- **Substrate consumed:** `D-BANK-ACCOUNT-SUBSTRATE` (account-master + balance projections); D-DATA-PROVENANCE-SUBSTRATE (PRs #161, #167, #175 — every output watermarked).
- **TBC markers:** Mira's `WS-INSTRUMENT-ANALYSES` (SARB BA 700 published-schema ingestion); W2 Slice 3 (RWA engine integration).
- **Relevant memory:** `feedback_no_pause_rule`; `feedback_chip_vs_background_agent_duplication`; `feedback_handlers_metadata_three_way_clash`; `project_ai_driven_bank`.

— Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO) · Atlas (Core banking platform architect, engineering) · Anya (Data / analytics engineer, engineering — reports to Devon COO).
