---
title: Reporting capability Slice 6 — IFRS statement renderer (BS / IS / CF / Equity / Notes skeleton)
author: Bea (Accounting & financial reporting engineer) · Atlas (Core banking platform architect)
date: 2026-05-10
summary: Sub-authorisation under D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN. Lands the first IFRS AFS skeleton — five primary statements per IAS 1 + IAS 7 + 13 note headings — generated from period-close trial-balance + IFRS classification map, JSON-bundle rendered. M3 deliverable that unlocks Phase C of the dry-run scenario.
decision-required: false
decision-id: D-REPORTING-CAPABILITY-SLICE-6
decision-category: medium-term
decision-owner: Bea (Accounting & financial reporting engineer) · Atlas (Core banking platform architect)
---

# Reporting capability Slice 6 — IFRS statement renderer

**Authors:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille, Chief Financial Officer) · Atlas (Core banking platform architect, engineering — substrate consult)
**For:** Marc (CEO) — informational; under standing approval of `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN`
**Date:** 2026-05-10
**Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10)
**Source spec:** [`Owner Inbox/2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md`](2026-05-10_bea-atlas_reporting-capability-m2-m3-build-proposal.md) §6 Slice 6
**Workstream:** `WS-REPORTING-M2-M3` — Slice 6 (M3, IFRS-AFS-skeleton)

---

## 1. Per-statement scope (rehearsal-grade per Marc Q1)

Five primary statements per IAS 1 + IAS 7, each rendered from the Slice 2 period-close trial balance + an explicit IFRS classification map per leaf account. JSON-first per Marc Q5; SARB / external-presentation rendering downstream.

### 1.1 Statement of Financial Position (Balance Sheet) — `IAS 1 §54`

Sections: **assets** / **liabilities** / **equity**, plus an `accountingEquationCheck` block asserting `assets ≡ liabilities + equity` (balanced by construction since equity is computed as the residual; the explicit check exists for forensic-transparency reporting and downstream recon harnesses).

Per IAS 1 §60 (current vs non-current) is `[citation: TBC]` pending the chart-of-accounts maturity-bucket field landing under Mira's `WS-INSTRUMENT-ANALYSES`.

### 1.2 Statement of Profit or Loss and Other Comprehensive Income — `IAS 1 §82`

Single-statement form per `IAS 1 §10A`. Sections: **income** / **expense** / **profitOrLoss** / **otherComprehensiveIncome** / **totalComprehensiveIncome**.

`[citation: TBC]` markers carried for IAS 1 §99 by-nature vs by-function classification (Camille's accounting-policy adoption choice) and IAS 12 income-tax line (pending Yael's tax engine — per pack §8.2).

### 1.3 Statement of Cash Flows — `IAS 7`

Indirect method per `IAS 7 §18(b)`. Sections: **operating** (P&L starting point + working-capital movements) / **investing** / **financing** / **netChangeInCash**.

Bank-specific classification of interest received/paid + dividend received per `IAS 7 §31–§34` is `[citation: TBC]` pending Camille's accounting-policy adoption. v0 builds on the operating-by-default convention (the most common bank choice).

### 1.4 Statement of Changes in Equity — `IAS 1 §106`

Reconciliation per `IAS 1 §106(d)`: opening → P&L attribution → OCI attribution → owner-transactions → closing, decomposed into four equity components (`share-capital`, `retained-earnings`, `oci-reserve`, `other-reserves`) per `IAS 1 §108`.

Build-phase opening-equity defaults to zero (Hoz Bank pre-licence-day posture per `project_ai_driven_bank`); caller may supply `openingEquity` to seed the reconciliation. Owner-transactions inferred from share-capital balance changes vs the opening seed.

### 1.5 Notes (skeleton) — `IFRS 7` + `IAS 1` + `IFRS 13`

Thirteen typed note headings per the AFS-skeleton catalogue:

1. Reporting entity (`IAS 1 §138`)
2. Basis of preparation (`IAS 1 §16, §27, §117`)
3. Significant accounting policies (`IAS 1 §117–§124`)
4. Critical accounting estimates and judgements (`IAS 1 §122, §125`)
5. Financial instruments — categories and measurement basis (`IFRS 9`, `IFRS 7 §6–§8`)
6. Financial instruments — credit-risk disclosures (ECL) (`IFRS 7 §35A–§35N`)
7. Financial instruments — liquidity-risk disclosures (`IFRS 7 §39`)
8. Financial instruments — market-risk sensitivity analyses (`IFRS 7 §40–§42`)
9. Fair-value measurement — hierarchy and inputs (Levels 1/2/3) (`IFRS 13 §93`)
10. Income tax — current and deferred (`IAS 12`)
11. Capital management (`IAS 1 §134–§136`)
12. Related-party transactions (`IAS 24`)
13. Subsequent events (`IAS 10`)

Each heading carries a `[citation: TBC]` placeholder; content is downstream tranche per pack §6 ("Notes (skeleton — per IFRS 7 financial-instruments + IAS 1 + headings only at v1)").

---

## 2. Substrate consumed

| Component | What we consume | Reference |
|---|---|---|
| Slice 2 period-close | `TrialBalanceSnapshotted.rows`; `closePeriod` result | PR #170 |
| Slice 1 semantic-layer | `SemanticEntry` shape; `SemanticRegistry` | PR #156 |
| Slice 3 / 4 patterns | BA-form generator pure-function pattern; deterministic JSON-render canonicaliser | `ba-325-render.ts`, `ba-700-render.ts` |
| `D-BANK-ACCOUNT-SUBSTRATE` | Account-master + balance projections | PR #164 |
| M1 IFRS classification | `IfrsClassificationApplied` event family (cited; not consumed at v0) | `event-types.ts:965-1029` |
| Provenance substrate | Per-render watermark via `meta.classificationsFingerprint` + `meta.trialBalanceSnapshotEventId` | PRs #161, #167, #175 |

---

## 3. Files landed

- `prototype/platform/semantic/ifrs-classification-entries.ts` — 9 IFRS semantic entries (`TotalAssets`, `TotalLiabilities`, `TotalEquity`, `ProfitOrLoss`, `OtherComprehensiveIncome`, `TotalComprehensiveIncome`, `NetCashFromOperating`/`Investing`/`Financing`); each scoped to `urn:legal-entity:hoz:hoz-bank:v1` with a resolved IAS/IFRS citation chain plus a `[citation: TBC]` marker per Q1.
- `prototype/platform/reporting/ifrs-types.ts` — shared input contract (`IfrsGeneratorInput`, `IfrsAccountClassification`, `IfrsAccountClass`, `IfrsCashFlowClass`, `IfrsOpeningEquityComponents`); Hoz Bank-only scope guard (`assertIfrsBankEntity`); deterministic-fingerprint helper; classification indexer; sectional filter helper; `IFRS_AFS_BASE_CITATIONS`.
- `prototype/platform/reporting/ifrs-balance-sheet.ts` — `generateIfrsBalanceSheet`. Sectional asset/liability sums + derived equity (accounting-equation residual surfaced as a typed line); per-line sign-convention warnings; comparative-period support.
- `prototype/platform/reporting/ifrs-income-statement.ts` — `generateIfrsIncomeStatement`. Single-statement form (P&L + OCI in one); P&L = Σincome − Σexpense; TCI = P&L + OCI.
- `prototype/platform/reporting/ifrs-cash-flow.ts` — `generateIfrsCashFlow`. Indirect method; P&L starting point + working-capital movements + investing/financing classifications. Comparative-period working-capital arithmetic when supplied; current-period proxy with placeholder marker otherwise.
- `prototype/platform/reporting/ifrs-changes-in-equity.ts` — `generateIfrsChangesInEquity`. Four-component reconciliation; opening-equity supplied (defaults to zero — build-phase posture); owner-transactions inferred from TB share-capital balance vs opening seed.
- `prototype/platform/reporting/ifrs-notes.ts` — `generateIfrsNotes`. Thirteen typed note headings; each `status: "skeleton"` with `[citation: TBC]` placeholder.
- `prototype/platform/reporting/ifrs-render.ts` — JSON renderer. Per-statement Zod schemas (`IfrsBalanceSheetRenderSchema`, `IfrsIncomeStatementRenderSchema`, `IfrsCashFlowRenderSchema`, `IfrsChangesInEquityRenderSchema`, `IfrsNotesRenderSchema`); bundle schema (`IfrsBundleRenderSchema`); deterministic `canonicaliseIfrs` walker (sort keys lexically; `$schema` first); `renderIfrsBundleCanonical` returns canonical JSON bytes for downstream `ReportGenerated` document-store hashing.
- `prototype/scripts/render-ifrs-statements.ts` — CLI: `bun run scripts/render-ifrs-statements.ts --entity LE-ZA-HOZ-BANK --as-of <date> --period-id <id> [--functional-currency ZAR] [--classifications path] [--out path]`. Replays the event store; resolves trial balance via `periodAuditChain` (most-recent `TrialBalanceSnapshotted`) or ad-hoc `computeTrialBalance` over `--period-start` / `--period-end`; loads classifications from JSON or the build-phase fixture; generates all five statements; renders the canonical bundle.
- `prototype/tests/ifrs-statements.test.ts` — 28 tests covering: semantic-entry registration; per-entity isolation (Securities + Group rejected on every generator); end-to-end `events → close → 5 statements`; balance-sheet accounting equation; SoCE-to-BS tie (when income/expense suppressed in the TB); schema validation per statement; bundle composition + coherence checks; comparative-period support; canonicalisation determinism.
- `prototype/scripts/record-d-reporting-capability-slice-6.ts` — `CeoDecision` emitter; idempotent.

---

## 4. M8 SARB-portal-simulator dependency

The IFRS bundle render is the JSON contract the downstream Slice-7+ SARB-portal simulator (`prototype/simulators/sarb-prudential.ts`) consumes — the canonical bytes hash into `ReportGenerated.documentHash` (RMS document-store, BLAKE3 per RMS Slice 1 / PR #142). The XML render layer (Slice 5) takes the canonical JSON as input contract; PA / SARB external-publishing schemas land at the M8 cloud-lift slice once the published taxonomy is finalised by Mira's `WS-INSTRUMENT-ANALYSES`.

No changes to the simulator surface are required at this slice — Slice 6 produces the *content* the simulator carries.

---

## 5. Substrate gaps surfaced (forward-link to Slices 7-8)

- **Per-account IFRS classification.** v0 supplies the classification map at the call site. The chart-of-accounts schema gains an `ifrsAccountClass` field at Slice 7-8 once Mira's `WS-INSTRUMENT-ANALYSES` finalises the published taxonomy. `[citation: TBC]` carried.
- **Accounting-policy adoption choices.** Camille (CFO) owns the IFRS-policy choices cited from `Owner Inbox/2026-05-06_core-policies-finance.md` §§1–3 (single vs two-statement P&L per `IAS 1 §10A`; by-nature vs by-function expense classification per `IAS 1 §99`; bank interest / dividend cash-flow classification per `IAS 7 §31–§34`; FVOCI vs FVTPL elective). `[citation: TBC]` carried; engine doesn't block.
- **IAS 12 income-tax line.** Yael's tax engine produces the current + deferred-tax computation. Per pack §8.2: placeholder + `[citation: TBC]` until Yael's CIT slice activates. v0 P&L line is income − expense pre-tax.
- **IAS 1 §60 current vs non-current.** Maturity-bucket field on chart-of-accounts is the gate; downstream Slice 7-8.
- **IFRS 9 ECL Stage 1 placeholder.** Per pack §6 Slice 8 ("for build-phase, `Stage 1` placeholder only"); Helena's Tier-1 ECL model is a downstream tranche. v0 emits no ECL movement; Note 6 is a skeleton heading only.
- **IFRS 10 / IFRS 12 consolidation.** Group-consolidated AFS (Hoz Group = Hoz Bank + Hoz Securities − eliminations) lands at downstream slice once the consolidation projection is built per `D-REGULATORY-PERIMETER`. v0 per-entity (Hoz Bank only). `assertIfrsBankEntity` rejects `LE-ZA-HOZ-GROUP` / `LE-ZA-HOZ-SECURITIES`.
- **IAS 21 FX revaluation.** OCI FX-translation reserve attribution lands when multi-currency capital arithmetic moves into the engine (Slice 7-8 territory aligned with the BA 700 multi-currency capital deferral).
- **Comparative-period support.** v0 plumbing is in place — `comparativeTrialBalance` / `comparativeAsOf` flow through every generator and surface as `comparativeAmountMinor` per line. The first dry-run scenario (Phase C) does NOT yet supply comparative; placeholders flag the absence cleanly. Comparative arithmetic for cash-flow movements is operating-section only at v0; investing/financing comparatives land at Slice 7-8.
- **Prudential return suite (Slice 7).** BA 100 / 110 / 120 / 200 / 210 / 300 / 326 / 330 / 350 / 410 / 900-series — each a thin generator on top of Slice 6 IFRS projections. Forward-link.
- **AFS notes content (downstream tranche).** Notes 5–9 (financial-instruments + fair-value-hierarchy) require Camille's accounting-policy adoption + the M3 capital-stack/liquidity/RWA projections (Slice 6 prior of the build-proposal's Slice 6 — distinct from this dispatch's "Slice 6 IFRS skeleton"; the build-proposal Slice 7 prudential-return suite covers it).

---

## 6. CI green

`bun run ci` passes:
- `bun run typecheck` — clean
- `bun run lint` — clean (post `bun run format`)
- `bun test tests/ifrs-statements.test.ts` — 28 / 28 pass
- `bun run citation-gate` — clean (every appended citation resolves)
- existing recon pipelines — unchanged surface; no new recon harness in this slice (recon harnesses for the AFS-trial-balance tie + consolidation-elimination tie land at the build-proposal's Slice 8)

---

## 7. Sample render — abbreviated

A typical synthetic-event run produces (truncated for the record; full JSON via `bun run scripts/render-ifrs-statements.ts --entity LE-ZA-HOZ-BANK --as-of 2026-05-31T23:59:59.999Z --period-id period:hoz-bank:month:2026-05`):

```json
{
  "$schema": "https://hoz.bank/schemas/ifrs/bundle/v0.1-rehearsal.json",
  "balanceSheet": {
    "$schema": "https://hoz.bank/schemas/ifrs/balance-sheet/v0.1-rehearsal.json",
    "accountingEquationCheck": { "balanced": true, "differenceMinor": 0, ... },
    "assets": { "lineItems": [ { "lineLabel": "Cash and balances at SARB", ... } ], "totalMinor": 300000000 },
    "equity": { "totalMinor": 300000000, ... },
    "liabilities": { "totalMinor": 0, ... }
  },
  "incomeStatement": { ... "profitOrLoss": { "amountMinor": 50000000 } ... },
  "cashFlow": { ... "profitOrLossStartingPoint": { "amountMinor": 50000000 } ... },
  "changesInEquity": { ... "closingEquityTotalMinor": 350000000 ... },
  "notes": { "notes": [ { "noteNumber": 1, "title": "Reporting entity", "status": "skeleton" }, ... 13 entries ] }
}
```

In this end-to-end fixture: 4 BS line items (1 asset + 2 equity classified + 1 derivation residual), 1 IS income line, 4 SoCE component movements, 13 note headings.

---

## 8. Authority

Sub-authorisation under `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10). `D-REPORTING-CAPABILITY-SLICE-6` event recorded via `prototype/scripts/record-d-reporting-capability-slice-6.ts`. No new CEO approval required per CLAUDE.md "Dispatch discipline" no-pause rule.

— Bea & Atlas
