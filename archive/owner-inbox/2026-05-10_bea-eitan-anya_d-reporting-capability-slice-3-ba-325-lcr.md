---
title: Reporting capability Slice 3 — BA 325 LCR end-to-end (first SARB return)
author: Bea, Eitan, Anya
date: 2026-05-10
summary: First SARB return rendered end-to-end. Six liquidity-classification semantic entries, BA 325 LCR projection with full HQLA cap arithmetic + 75% inflow cap + 25% net-outflow floor, deterministic JSON renderer with declared schema, CLI wrapper. Per-entity (Hoz Bank only). Rehearsal-grade per Marc's Q1.
decision-required: false
decision-id: D-REPORTING-CAPABILITY-SLICE-3
---

# Reporting capability Slice 3 — BA 325 LCR end-to-end

**Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10).
**Pack reference:** [`Owner Inbox/actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](actioned/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 3.
**Authors:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) · Eitan (Treasurer, governance — reports to Camille CFO; LCR methodology owner) · Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer + projection-runtime curator).
**Authority taxonomy:** downstream sub-decision under standing authority; no new CEO decision required (`feedback_no_pause_rule`).

---

## 1 — What landed

The first SARB return rendered end-to-end. The full chain — semantic-layer registry → sub-ledger postings → period-close trial balance → BA 325 projection → JSON render — is now exercised by a single CLI command:

```
bun run scripts/render-ba-325.ts \
    --entity LE-ZA-HOZ-BANK \
    --as-of 2026-05-31T23:59:59.999Z \
    --period-id period:hoz-bank:month:2026-05
```

Output: a canonical, schema-validated JSON document with the BA 325 line items, the HQLA stock (post-haircut + post-cap), the cash-flow categories (post-inflow-cap), the net cash outflows (post-floor), and the LCR ratio.

### Files

| File | Purpose |
|---|---|
| `prototype/platform/semantic/liquidity-entries.ts` | Six new semantic entries — `HqlaLevel1`, `HqlaLevel2A`, `HqlaLevel2B`, `LcrCashOutflows30D`, `LcrCashInflows30D`, `LiquidityCoverageRatio`. Each cites Banks Act §70 + Reg 26 + BCBS D295 + one `[citation: TBC]` per pack §9 Q1 default. |
| `prototype/platform/reporting/ba-325-lcr.ts` | `generateBa325Lcr` projection. Pure function `(trialBalance, classifications) → Ba325Output`. Closed-form HQLA cap arithmetic per BCBS D295 §47; 75% inflow cap per §142; 25% net-outflow floor. |
| `prototype/platform/reporting/ba-325-render.ts` | `renderBa325ToJson` + `canonicaliseBa325` + Zod `Ba325RenderSchema`. Deterministic key-sorted bytes; hash-store-friendly for downstream `ReportGenerated`. |
| `prototype/platform/reporting/index.ts` | Public surface. |
| `prototype/scripts/render-ba-325.ts` | CLI wrapper — replays event store, resolves trial balance from `periodAuditChain` or ad-hoc compute, runs generator + render, writes JSON. |
| `prototype/tests/ba-325-lcr.test.ts` | Tests — projection round-trip on synthetic event stream → known LCR; renderer schema validation; per-entity isolation; HQLA cap-regimes; provenance passthrough; determinism. |
| `prototype/scripts/record-d-reporting-capability-slice-3.ts` | CeoDecision-emitter for `D-REPORTING-CAPABILITY-SLICE-3`. |

---

## 2 — BA 325 line definitions (rehearsal-grade per Q1)

Per Marc's Q1 default — line definitions carry `[citation: TBC]` markers where the SARB BA 325 published schema isn't fully analysed yet. Mira's `WS-INSTRUMENT-ANALYSES` workstream resolves to the published taxonomy.

### HQLA section (numerator)

| Section | Sub-line | Stock | Factor | Cap |
|---|---|---|---|---|
| Level 1 | Cash + central-bank reserves + Level-1 sovereign / supranational securities | sum of Level-1-classified accounts | 100% | none (Reg 26(7)(a)) |
| Level 2A | 20%-RW sovereign/PSE/MDB; AA-/higher corporate + covered bonds | sum × 0.85 | 85% | 40% of total HQLA (Reg 26(7)(b)) |
| Level 2B | A+/A/A-/BBB- corporate; equities; qualifying RMBS | sum × asset-specific factor | 50% (default) / 25% RMBS | 15% of total HQLA (Reg 26(7)(c)) |

The cap arithmetic is closed-form (no iteration in the standard regimes — see `applyHqlaCaps`).

### Cash-flow section (denominator)

| Direction | Categories | Rate range | Cap |
|---|---|---|---|
| Outflows | retail deposits; unsecured wholesale funding; secured funding; derivatives; contingent funding | 0–100% (per category, BCBS D295 §69–§141) | none |
| Inflows | secured lending; performing receivables; loans/deposits; derivatives | 0–100% (per category, BCBS D295 §142) | 75% of gross outflows (Reg 26(11)) |

**Net cash outflows** = `max(outflows − min(inflows, 0.75 × outflows), 0.25 × outflows)`.

The 25% floor (`0.25 × outflows`) ensures a bank cannot fully neutralise its outflows with inflows during a stress.

### LCR cell

`LCR = HQLA-stock-post-cap / net-cash-outflows` (dimensionless ratio; ≥ 1.0 = ≥ 100% per Reg 26(2)).

`[citation: TBC]` markers on every BA 325 sub-line label — Mira's `WS-INSTRUMENT-ANALYSES` will resolve to the published SARB BA 325 cell numbers.

---

## 3 — Projection logic

`generateBa325Lcr(input: Ba325GeneratorInput): Ba325Output`

**Inputs:**
- `entity` — short-id (`LE-ZA-HOZ-BANK`); throws on non-bank entities (`Hoz Securities` is JSE-regulated; `Hoz Group` is not separately regulated per `D-REGULATORY-PERIMETER`).
- `asOf`, `periodId`, `functionalCurrency` — from `AccountingPeriodOpened` / `AccountingPeriodClosed`.
- `trialBalance` — `TrialBalanceSnapshotted.rows` from Slice 2 (or ad-hoc `computeTrialBalance` for pre-close rehearsal).
- `classifications` — `AccountLiquidityClassification[]`. Per-account: `hqlaLevel` | `outflowRunOffRate` | `inflowRate`. The classification map is supplied externally for now (substrate gap §6 below).

**Steps:**
1. Bucket trial-balance rows by classification (Level-1 / Level-2A / Level-2B / Outflow / Inflow). Accounts not in the map are ignored.
2. Compute `level1Stock`, `level2AStock × 0.85`, `level2B-factor-weighted`.
3. `applyHqlaCaps` — closed-form 40%/15% cap arithmetic. Three regimes (no-cap / L2B-binding / L2A-binding); converges in O(1).
4. Compute `grossOutflows = Σ(balance × runOffRate)`, `grossInflows = Σ(balance × inflowRate)`.
5. `cappedInflows = min(grossInflows, 0.75 × grossOutflows)`.
6. `netCashOutflows = max(grossOutflows − cappedInflows, 0.25 × grossOutflows)`.
7. `lcrRatio = totalStockHqlaPostCap / netCashOutflows`.

**Output `Ba325Output`** carries: HQLA section (per-level stock + contribution + cap-binding flags + line items) · cash-flow section (gross + capped + floor flags + line items) · `lcrRatio` + `lcrCompliant` · citations · placeholder markers · `meta` (entity, as-of, period, classification fingerprint, optional `trialBalanceSnapshotEventId` chain).

Pure function. Deterministic. No event side-effects. No event-store / document-store reads.

---

## 4 — JSON schema

The rendered JSON validates against `Ba325RenderSchema` (Zod) declared in `ba-325-render.ts`. Schema URL: `https://hoz.bank/schemas/ba-325/v0.1-rehearsal.json`.

Notable shape decisions:
- `lcrRatio` is encoded as a **string** (`"1.4287"` / `"infinity"`) to preserve the divide-by-zero case (no outflows ⇒ trivially compliant). JSON does not represent `Infinity`.
- `lcrPercent` is a render-side helper for the SARB BA 325 cell display (e.g. `"142.87%"`).
- `meta.classificationsFingerprint` is the sorted-stable JSON of the classification map — a forensic reproducibility witness.
- `$schema` field carries the URL, future-proofing schema evolution (`v0.2` lands at Slice 5 once Mira's instrument analyses fill in line numbers).

`canonicaliseBa325` produces deterministic key-sorted UTF-8 bytes — same projection input ⇒ byte-identical bytes ⇒ same BLAKE3 hash. Slice 5's `ReportGenerated` event will cite this hash via the RMS doc store (PR #142 substrate).

---

## 5 — M8 Azure mapping

| Slice 3 component | M8 Azure target |
|---|---|
| `Ba325Output` typed shape | unchanged — pure value types |
| `canonicaliseBa325` JSON bytes | Azure Blob via the M8 RMS doc-store contract (RMS Phase 1 spec §4.1) |
| `Ba325RenderSchema` Zod definition | unchanged — runtime-validation seam mirrors `@platform/event-store` |
| BLAKE3 hash → `ReportGenerated.documentHash` | Azure Blob `Content-MD5` header is auxiliary; BLAKE3 hash is canonical (forensic continuity per RMS spec §4.1) |
| Per-account classification map | migrates onto chart-of-accounts (`hqlaLevel`, `lcrOutflowCategory`, `lcrInflowCategory`) at Slice 6+ once Mira's WS-INSTRUMENT-ANALYSES lands published taxonomy |
| SARB submission (XML over portal) | Slice 5 — transforms canonical JSON to BA 325 XML; canonical JSON is the input contract |

The canonical JSON is the cloud-portable render. Future SARB e-Risk-Bank portal upload (M8) takes either the JSON directly or an XML transform; both are downstream of this slice.

---

## 6 — Substrate gaps remaining

Forward-link to the slices that close each gap.

| Gap | Where | Closing slice |
|---|---|---|
| **Liquidity-classification map external** | `AccountLiquidityClassification` supplied at call site (CLI default + tests pin `ACC-1100-001 → Level 1`). Should live on `chart-of-accounts.schema.json` as `hqlaLevel` + `lcrOutflowCategory` + `lcrInflowCategory` fields. | Slice 6+ once Mira's `WS-INSTRUMENT-ANALYSES` lands SARB BA 325 published taxonomy. |
| **Executable `liquidity-projection`** | Slice-3 semantic entries name `liquidity-projection` but no projection runtime exists yet; v0 reads trial balance + map directly. | Slice 6 (M3) — capital-stack + LCR/NSFR + RWA projections. |
| **Per-currency LCR per Reg 26(13)** | v0 functional-currency only; cross-currency LCR not covered. | Slice 6 — multi-currency LCR projection. |
| **BA 700 / BA 350 / BA 600 generators** | Single-form harness only at Slice 3. | Slices 4-5. |
| **IFRS AFS skeleton (SoFP / P&L / OCI / SCF / SoCE)** | Not in this slice. | Slices 6-8. |
| **Capital-stack + RWA projections** | Not in this slice. | Slice 6. |
| **`ReportGenerated` event family** | Generator + render are pure; event emit + RMS doc-store hash live at Slice 5. | Slice 5 — regulator-portal handshake + SARB XML render. |
| **SARB e-Risk-Bank portal submission** | Render-only; no upload. | Slice 5. |
| **Live BA 325 numbers** | Build-phase posture: bank holds no real customer / wholesale / derivative balances (Niko's lifecycle paused per `buildPhaseStatus`); generator exercised against synthetic fixture. | Commencement-of-trading per `project_rules_bind_at_commencement`. |
| **Tier-1 LCR-model independent validation** | RAS B7 classifies LCR model as Tier-1; rehearsal-grade is build-phase appropriate. | Post-licence-day per Helena CRO + future model-validation function. |
| **Single-writer concurrency** | Generator is pure; no concurrency concern at projection layer. Slice 5 `ReportGenerated` event will need single-writer-per-(entity,period) guard. | Vera follow-on recon. |
| **BCBS 248 intraday liquidity monitoring** | Cited on entries for completeness; separate operational lens, not BA 325 input. | Future intraday-liquidity substrate. |

---

## 7 — Tests

`prototype/tests/ba-325-lcr.test.ts` exercises:

- **End-to-end**: Synthetic `SubLedgerPostingEmitted` events → `closePeriod` → `generateBa325Lcr` → `renderBa325ToJson` → known LCR computed from fixed numerator + denominator.
- **Per-entity isolation**: `LE-ZA-HOZ-SECURITIES` rejected with `Ba325GeneratorError` ("bank-licence-bound").
- **HQLA cap regimes**: synthetic stocks exercising no-cap / L2B-binding / L2A-binding paths in `applyHqlaCaps`.
- **Inflow cap binding**: gross inflows > 75% of outflows → cappedInflows = 75% × outflows; flag set.
- **Net-outflow floor binding**: gross outflows > 0 with very high inflows → net = 25% × outflows; flag set.
- **Provenance passthrough**: `trialBalanceSnapshotEventId` from `closePeriod` flows into `Ba325Output.meta`.
- **Determinism**: two renders of the same generator output produce byte-identical canonical JSON.
- **JSON-schema validation**: rendered output validates against `Ba325RenderSchema`; corrupted output rejected.
- **Divide-by-zero**: zero outflows → `lcrRatio = Infinity`, render encodes as `"infinity"`.

---

## 8 — Coordination with parallel work

Per dispatch brief:

- **Provenance Slice 3** (Anya) — different code areas; no collision.
- **RMS Slice 5** (Anya) — test files only; no collision.
- **Phase B scenario script** (Bea + Tomas) — both consume Slice 2 period-close. No file collision (distinct files); API contract is the `TrialBalanceSnapshotted.rows` shape, which is the Slice 2 event-types schema (already merged on `main`).

No changes to: `event-types.ts`, `registry.ts`, `period-close.ts`, `semantic/entries.ts`, `projections/runtime.ts`, `dashboard/derive.ts`, `handlers-metadata.ts`, `handler-callables.ts`, `package.json` (respecting parallel-dispatch hygiene per `feedback_handlers_metadata_three_way_clash`).

---

## 9 — Acceptance

After merge:

```
$ bun run scripts/render-ba-325.ts \
    --entity LE-ZA-HOZ-BANK \
    --as-of 2026-05-31T23:59:59.999Z \
    --period-id period:hoz-bank:month:2026-05
{
  "$schema": "https://hoz.bank/schemas/ba-325/v0.1-rehearsal.json",
  "cashFlows": { ... },
  "citations": [ ... ],
  "hqla": { ... },
  "lcrCompliant": true,
  "lcrPercent": "infinity",
  "lcrRatio": "infinity",
  "meta": { ... },
  "placeholders": [ ... ]
}
```

`bun run ci` passes — typecheck + lint + test + citation-gate + recon suite all green.

---

— Bea, Eitan, Anya
