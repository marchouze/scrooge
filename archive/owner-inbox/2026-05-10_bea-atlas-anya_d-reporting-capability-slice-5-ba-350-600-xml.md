---
title: D-REPORTING-CAPABILITY Slice 5 — BA 350 + BA 600 + generic SARB-XML render layer
author: Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO), Atlas (Core banking platform architect, engineering — reports to Devon COO), Anya (Data / analytics engineer, engineering — reports to Devon COO)
date: 2026-05-10
summary: Two more SARB returns (BA 350 market risk, BA 600 operational risk) shipped end-to-end on the Slice-3 harness, plus a generic XML render layer that complements the Slice-3 JSON renderer for SARB-portal submission compatibility. Per pack §6 Slice 4 (BA 350 + BA 600 sub-scope) consolidated with §6 Slice 5 (XML render) under standing authority D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN.
decision-required: false
---

# D-REPORTING-CAPABILITY Slice 5 — BA 350 + BA 600 + generic SARB-XML render layer

**Authors:** Bea (Accounting & financial reporting engineer, engineering — reports to Camille CFO; BA-form line mapping owner) · Atlas (Core banking platform architect, engineering — reports to Devon COO; render-layer infrastructure) · Anya (Data / analytics engineer, engineering — reports to Devon COO; semantic-layer + projection-runtime curator).

**Methodology citations:** Helena (Chief Risk Officer, governance — reports to CEO; market-risk + op-risk methodology). Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; PA / FSCA portal taxonomies — citation, typed reference; SARB-published-schema ingestion remains downstream).

**Standing authority:** `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (CEO-approved 2026-05-10). Pack §6 Slice 4 (BA 350 + BA 600 sub-scope, alongside the parallel BA 700 dispatch which owns the rate-risk semantic family + IRRBB return) and §6 Slice 5 (XML render layer + regulator-portal handshake). No new CEO decision required.

**Decision id:** `D-REPORTING-CAPABILITY-SLICE-5`. Emitted via `prototype/scripts/record-d-reporting-capability-slice-5.ts`.

**Build-phase posture:** rehearsal-grade. `[citation: TBC]` markers on per-line numbering pending Mira's WS-INSTRUMENT-ANALYSES SARB-published-schema ingestion. Live trading-book positions + audited gross-income inputs populate at commencement-of-trading. Tier-1 LCR / market-risk / op-risk model independent validation per RAS B7 gates production use post-licence-day.

---

## 1. Scope delivered

### 1.1 BA 350 — market-risk return (standardised approach)

`generateBa350MarketRisk(input: Ba350GeneratorInput) → Ba350Output` — pure function over a typed input bundle covering the five Pillar-1 sub-charges per BCBS D352 §718 + Regulations Relating to Banks Reg 28:

| Sub-charge | Algebra | Reg cite |
|---|---|---|
| **IR general risk** | `sum(maturityBand.|long − short|) + verticalDisallowances + horizontalDisallowances` (caller-supplied disallowances; finer maturity decomposition for closed-form algebra is Slice 6+) | Reg 28(3)(a) — maturity-method |
| **IR specific risk** | `sum(grossPosition × specificRiskWeight per issuer/rating)` | Reg 28(3)(b) |
| **Equity** | `8% × |netLongShort| + (4% if liquid+diversified else 8%) × grossLongShort` per market | Reg 28(4) |
| **FX** | `8% × max(sum(netLongs), sum(netShorts))` across non-functional currencies (functional-ccy leg excluded) | Reg 28(5) — net-open-position |
| **Commodity** | `15% × |net| + 3% × gross` per commodity (simplified method) | Reg 28(6) |
| **Aggregate** | `totalCapital = sum(above); RWA = 12.5 × totalCapital` | Reg 28 + Reg 38(3) |

**Per-entity:** bank-licence-bound; throws on non-Hoz-Bank entities per `D-REGULATORY-PERIMETER`.

### 1.2 BA 600 — operational-risk return (BIA + TSA scaffolds)

`generateBa600OpRisk(input: Ba600GeneratorInput) → Ba600Output` — pure function over an annual gross-income table per business line + a selectable `approach: "bia" | "tsa"`:

| Approach | Algebra | Reg cite |
|---|---|---|
| **BIA** (default build-phase) | `α × (sum(gi over y where gi > 0) / nPositive)`, α = 15% | Reg 33(3) — Basic Indicator Approach |
| **TSA** | `(1/3) × sum_y max(0, sum_i β_i × gi_{y,i})`, β ∈ {12%, 15%, 18%} per Reg 33(4) Annex | Reg 33(4) — Standardised Approach |
| **RWA** | `12.5 × selectedApproachCapital` | Reg 33 + Reg 38(3) |

β factor table per `BUSINESS_LINE_BETA`:

| Business line | β |
|---|---|
| corporate-finance | 18% |
| trading-and-sales | 18% |
| payment-and-settlement | 18% |
| commercial-banking | 15% |
| agency-services | 15% |
| retail-banking | 12% |
| retail-brokerage | 12% |
| asset-management | 12% |

**SMA forward-link:** the Basel III Standardised Measurement Approach (BCBS D424, 2017) replaces BIA / TSA / AMA in the latest Reg 33 revision. Build-phase ships BIA + TSA scaffolds (still the workhorse approaches in many jurisdictions during transition); SMA is tracked as a substrate gap and surfaced in the placeholders array per Q1.

### 1.3 Generic SARB-XML render layer

`renderSarbXml(payload: SarbXmlReportPayload, opts: { renderedAt }) → string`. Pure function; deterministic.

- Takes a *typed* payload — recursive tree of named sections + line-items + scalars — so each generator (BA 325 / BA 350 / BA 600 / future BA 700) ships a thin `xxxToXmlPayload` adapter and the renderer is reusable.
- Sorted attributes per element for byte-identical output.
- Escape-correct: `& < >` in text; `& < " \r \n \t` in attribute values.
- Element-name validation via XML NCName regex.
- Sigil-prefixed `_attrs` / `_text` keys cannot collide with real SARB element names (Mira: SARB schemas use camelCase / PascalCase, never `_`-prefixed).

`validateSarbXmlStructural({ xml, formId, namespaceUri, requiredElements })` — pre-XSD recon: declares root present, namespace declared, required attributes (`formVersion`, `xsdUri`, `renderedAt`) present, required elements present, root tag-balance OK. Full XSD validation deferred until Mira's WS-INSTRUMENT-ANALYSES lands the published XSD substrate at `prototype/regulators/xsd/`.

**JSON-first remains canonical** per Marc Q5 (D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN §9). XML is produced *in parallel* from the same projection — the `ReportGenerated` event (Slice 7) will hash both bytes streams.

### 1.4 Files

```
prototype/platform/semantic/
  market-risk-entries.ts     [+]
  op-risk-entries.ts         [+]
  index.ts                   [extended exports]
prototype/platform/reporting/
  ba-350-market-risk.ts      [+]
  ba-350-xml-adapter.ts      [+]
  ba-600-op-risk.ts          [+]
  ba-600-xml-adapter.ts      [+]
  xml-render.ts              [+]
  index.ts                   [extended exports]
prototype/scripts/
  render-ba-350.ts           [+]
  render-ba-600.ts           [+]
  record-d-reporting-capability-slice-5.ts  [+]
prototype/tests/
  ba-350-market-risk.test.ts [+]
  ba-600-op-risk.test.ts     [+]
  xml-render.test.ts         [+]
Owner Inbox/
  2026-05-10_bea-atlas-anya_d-reporting-capability-slice-5-ba-350-600-xml.md  [+]
```

---

## 2. Per-form line definitions (rehearsal-grade)

### 2.1 BA 350 line catalogue

| Section | LineId pattern | Computed from | Citation |
|---|---|---|---|
| `interestRateGeneral.maturityLadder[]` | `ir-general.band.<band>` | `|long − short|` per band | Reg 28(3)(a) |
| `interestRateGeneral.disallowancesMinor` | `ir-general.disallowances` | caller-supplied | Reg 28(3)(a) |
| `interestRateSpecific.issuerLines[]` | `ir-specific.<issuerLabel>` | `gross × specificRiskWeight` | Reg 28(3)(b) |
| `equity.marketLines[]` | `equity.<market>` | general + specific charges | Reg 28(4) |
| `fx.currencyLines[]` | `fx.<currency>` | net position per non-functional ccy | Reg 28(5) |
| `commodity.commodityLines[]` | `commodity.<commodity>` | simplified method | Reg 28(6) |
| `totalMarketRiskCapitalMinor` | (aggregate) | sum of sub-charge capitals | Reg 28 |
| `totalMarketRiskRwaMinor` | (aggregate) | `12.5 × totalCapital` | Reg 38(3) |

`[citation: TBC]` carries the SARB BA 350 published-schema line numbering; resolved by Mira's WS-INSTRUMENT-ANALYSES.

### 2.2 BA 600 line catalogue

| Section | LineId pattern | Computed from | Citation |
|---|---|---|---|
| `bia.perYearGrossIncome[]` | `bia.year.<fy>` | aggregated GI per year | Reg 33(3) |
| `bia.averagePositiveMinor` | (aggregate) | sum-positive / n-positive | Reg 33(3) |
| `bia.capitalMinor` | (aggregate) | `15% × average` | Reg 33(3) |
| `tsa.perYearWeighted[]` | `tsa.year.<fy>` | `max(0, sum_i β_i × gi)` | Reg 33(4) |
| `tsa.capitalMinor` | (aggregate) | `1/3 × sum-years` | Reg 33(4) |
| `opRiskCapitalMinor` | (aggregate) | selected approach | Reg 33 |
| `opRiskRwaMinor` | (aggregate) | `12.5 × capital` | Reg 38(3) |

---

## 3. XML render API — surface contract

```ts
// payload shape — recursive tree
type SarbXmlValue = string | number | boolean | null | SarbXmlSection | readonly SarbXmlSection[];
interface SarbXmlSection {
  _attrs?: Readonly<Record<string, string | number | boolean>>;
  _text?: string;
  [k: string]: SarbXmlValue | undefined;
}

interface SarbXmlReportPayload {
  formId: string;          // e.g. "BA325", "BA350", "BA600"
  formVersion: string;     // e.g. "v0.1-rehearsal"
  xsdUri: string;          // [citation: TBC] — XSD URI; placeholder OK per Q1
  namespaceUri: string;    // XML namespace
  body: SarbXmlSection;    // root payload tree
}

// renderer
function renderSarbXml(payload: SarbXmlReportPayload, opts: { renderedAt: string; indent?: string }): string;

// pre-XSD structural validator
function validateSarbXmlStructural(args: {
  xml: string;
  formId: string;
  namespaceUri: string;
  requiredElements: readonly string[];
}): { ok: true } | { ok: false; violations: readonly string[] };
```

**Reusable across BA forms:** the BA 325 JSON-first renderer can also produce XML by adding a `ba325ToXmlPayload` adapter — left out of this slice to avoid touching the parallel-dispatch surface area; trivial follow-on.

---

## 4. M8 SARB-portal-simulator dependency

Pack §6 Slice 5 names `prototype/simulators/sarb-prudential.ts` as the regulator-portal handshake substrate. **Not landed in this dispatch.** Owner: Mira (Compliance / RegTech engineer). Rationale: the simulator surface is a typed mock of the SARB submission endpoint shape (XSD URI, submission envelope, ack/nack contract) and depends on Mira's SARB-published-schema ingestion which is itself the resolution path for the `[citation: TBC]` markers in this slice.

This slice ships the *render half* (XML output that conforms to a placeholder envelope); the *transport half* (signed POST against the simulator, `ReportSubmitted` event with submitter identity + portal-payload hash) is a thin downstream tranche that consumes the XML without further engine work.

---

## 5. Tests + acceptance

`bun test --isolate tests/ba-350-market-risk.test.ts tests/ba-600-op-risk.test.ts tests/xml-render.test.ts` — **50 assertions across three files, all green.**

| Coverage area | Tests |
|---|---|
| Semantic-entry registration | 8 (5 BA 350, 3 BA 600) — registry resolves all 10 entries; one TBC + one resolved citation per Q1; Hoz-Bank scope only; named exports cohere with array |
| TSA β factor table | 3 — 18% / 15% / 12% bands per Reg 33(4) Annex |
| Per-entity isolation | 4 — both generators throw on Hoz Securities; reject invalid functional currency |
| BA 350 sub-charge arithmetic | 9 — zero positions; IR general maturity-ladder + disallowances; IR specific gross × weight; equity general + specific (liquid vs non-liquid); FX max-side with functional excluded; commodity simplified; RWA = 12.5×; out-of-range rejections; placeholder presence |
| BA 600 BIA arithmetic | 4 — zero years; 3 positive years 15% × average; non-positive exclusion; cross-business-line aggregation per year |
| BA 600 TSA arithmetic | 3 — single year; year flooring; RWA factor |
| XML render mechanics | 7 — XML declaration; sorted attributes; escape correctness (text + attributes); array-element repetition; self-closing empties; scalar children; element-name rejection |
| XML determinism | 3 — byte-identical across runs (BA 350 + BA 600 + generic) |
| Structural validation | 5 — root + namespace + required elements ok; missing-element flagged; wrong-namespace flagged |

**Round-trip per form:** `generateBaXxx → xxxToXmlPayload → renderSarbXml → validateSarbXmlStructural` — ok for both BA 350 and BA 600.

**XML schema validation against fixture XSDs:** deferred — pack §6 Slice 5 + §7.3 name `prototype/regulators/xsd/` as Mira's downstream tranche. `[citation: TBC]` per Marc Q1 default. Structural recon is the build-phase substitute.

`bun run ci` — full pipeline green (typecheck + lint + 50 new tests on top of existing suite + all recons + citation-gate).

---

## 6. Substrate gaps surfaced

| Gap | Owner | Resolution path |
|---|---|---|
| SARB BA 350 / BA 600 published-schema ingestion (line numbering, XSD substrate) | Mira (Compliance / RegTech engineer) | WS-INSTRUMENT-ANALYSES — resolves the `[citation: TBC]` markers + populates `prototype/regulators/xsd/` |
| `prototype/simulators/sarb-prudential.ts` regulator-portal mock | Mira | Slice 5 follow-on tranche — typed mock of SARB submission endpoint; consumes XML render output |
| `prototype/regulators/xsd/` XSD substrate | Mira | Same WS-INSTRUMENT-ANALYSES; full XSD validator replaces `validateSarbXmlStructural` |
| Market-risk + op-risk projection executable form (deferred from semantic `projection: "market-risk-projection" / "income-projection"`) | Anya | Slice 6 — capital-stack + LCR/NSFR + RWA projections |
| IR-general vertical/horizontal disallowances closed-form algebra | Bea + Helena | Slice 6+ — requires finer maturity decomposition than v0 carries |
| SMA (BCBS D424) op-risk approach (replaces BIA / TSA at SARB transition) | Helena + Bea + Mira | Tracked in placeholders; Reg 33 revision ingestion is Mira |
| Per-currency LCR / per-currency market-risk | Eitan + Helena | Slice 6+ |
| Independent Tier-1 model validation pipeline (LCR / market-risk / op-risk / IFRS 9 ECL) | Helena + future model-validation function | Post-licence-day; rehearsal-grade in build phase per RAS B7 |

---

## 7. Forward-links

- Parallel **Slice 4 dispatch** — BA 700 (IRRBB) + rate-risk semantic family. Distinct files (`ba-700-*.ts`); no collision with this dispatch.
- **Slice 6** — capital-stack + LCR/NSFR + RWA projections. The market-risk + op-risk RWA aggregates from this slice are inputs to the capital-stack projection; the v0 generators consume caller-supplied input bundles, Slice 6 wires the projection layer.
- **Slice 7** — full prudential return suite (BA 100 / 110 / 120 / 200 / 210 / 300 / 326 / 330 / 410 / 900); each is a thin generator on top of Slice 6 projections + the XML render layer landed here.
- **Mira tranche** — XSD substrate + `prototype/simulators/sarb-prudential.ts` + `ReportSubmitted` event chain.

---

## 8. Coordination notes

- **No collision** with the parallel BA-700 dispatch (which touches `ba-700-*.ts` + rate-risk semantic family). This dispatch touches `ba-350-*.ts`, `ba-600-*.ts`, `xml-render.ts`, and the market-risk + op-risk semantic entries.
- **No changes** to `event-types.ts`, `registry.ts`, `period-close.ts`, `semantic/types.ts`, `semantic/registry.ts`, `projections/runtime.ts`, `dashboard/derive.ts`, `handlers-metadata.ts`, `handler-callables.ts`, or `package.json`.
- The `@platform/reporting` package surface (`prototype/platform/reporting/index.ts`) is extended with new exports; existing BA 325 exports unchanged.
