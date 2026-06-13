// scripts/file-atlas-dimensional-metric-attribution-layer-design-spec.ts
//
// RMS Phase 3 filing — Atlas's design spec for the DIMENSIONAL metric-attribution
// layer: every metric attributable at any level and any slice, computed per FIL
// instrument (a facet output) and aggregated by a shared attribution engine along
// any dimension/hierarchy. A book, a trader's portfolio, a consolidation are all
// named slices over one model — NOT bespoke primitives. DESIGN SPEC ONLY — returns
// to the CEO for approval before any production build. Idempotent (skips if already
// filed).
//
// Authority: D-METRIC-ATTRIBUTION-DIMENSIONAL (CEO-approved 2026-06-13) —
//   generalises the earlier book-composite decision; the book aggregate is now a
//   SPECIAL CASE, not the primitive. D-RMS-PHASE-3; D-FIL-FRAMEWORK-UNIFICATION;
//   D-FX-PNL-INSTRUMENT-LEVEL-VALUATION.
// Brief: brief:atlas:dimensional-metric-attribution-layer-design-spec:2026-06-13.
// Author: Atlas (Core banking platform architect, engineering).
//   §4 (Accountable / IFRS + P&L-attribution worked example) co-authored with
//   Bea (Accounting & financial reporting engineer, engineering).

import "../platform/event-store/resolve-event-db-boot";

import { eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID =
  "record:documents:atlas:dimensional-metric-attribution-layer-design-spec:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-dimensional-metric-attribution] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# Dimensional metric-attribution layer — design spec

**Author:** Atlas (Core banking platform architect, engineering)
**Co-author (§4 Accountable/IFRS + P&L-attribution worked example):** Bea (Accounting & financial reporting engineer, engineering)
**Risk-aggregation advisors (§2):** Helena (Chief Risk Officer, governance); Rohan (Risk/Markets engineer, engineering)
**Date:** 2026-06-13
**Authority:** D-METRIC-ATTRIBUTION-DIMENSIONAL (CEO-approved 2026-06-13)
**Brief:** brief:atlas:dimensional-metric-attribution-layer-design-spec:2026-06-13
**Status:** DESIGN SPEC ONLY — returns to the CEO for approval BEFORE any production build. No v2-core models, kernel changes, or v1 cutover code land under this run. Type sketches below are illustrative.
**Audience:** Marc (CEO); Helena (Chief Risk Officer, governance); Rohan (Risk/Markets engineer, engineering); Bea (Accounting engineer, engineering); Nadia (Model validation engineer, engineering); Vera (Internal audit engineer, third line)

---

## 0. Headline — one model, not a zoo of aggregates

Every metric the bank reports — P&L, notional, delta, EAD, RWA, capital, LCR
contribution, VaR, ES, IRRBB ΔEVE — is the answer to one question:

> *"Apply metric M to the set of instrument instances selected by slice S, at
> marks K, as-of T."*

A **book** is not a primitive. A **trader's portfolio** is not a primitive. A
**legal-entity consolidation** is not a primitive. They are all *named slices*
over a single dimensional model. The earlier book-composite proposal made the
book the unit of aggregation; this spec **generalises** it (per
\`D-METRIC-ATTRIBUTION-DIMENSIONAL\`): the book aggregate becomes the *special
case* \`slice = {dimension: book, value: "fx-trading"}\` and the primitive is the
\`(metric, slice, asOf)\` triple evaluated against per-instrument facet outputs.

This sits **ABOVE** \`fil-core/composition.ts\`. Composition builds a single
instrument from legs/components/wrappers (intra-instrument structure). The
attribution layer aggregates *across instances* (inter-instance structure). They
are orthogonal axes and must not be conflated: a composite instrument is still a
single member of a slice; a slice spans many instruments.

Three invariants govern the whole design:

1. **Events are the only source of truth (Principle 1).** Dimension membership
   and metric inputs are projections over the event log at an \`asOf\`. No slice
   stores a balance; a slice stores a *predicate*. A named slice (book, desk,
   consolidation) is a *stored predicate*, never a stored number.
2. **The metric declares its own aggregation semantics (the crux, §2).**
   Summation is an *optimisation for additive measures*, never the definition of
   aggregation. VaR/ES are re-computed over the joint position set at the node.
3. **Encapsulation is the audit property (FIL Framework §1).** A metric reads an
   instrument only through a facet (\`Valuable.value\`, \`RiskMeasurable.position\`​\`Contribution\`, \`Accountable.postingKeys\`). It never reaches into ad-hoc
   instrument fields. Exactly one answer in the system, carrying its citation.

---

## 1. Dimension model

### 1.1 Typed attribution dimensions on every FIL instance

Every FIL **instance** (\`fil:inst:…\`, distinct from the \`fil:type:…\` definition)
carries a typed, versioned set of **attribution dimensions**. These are *not*
free strings: each dimension is a closed key with a typed value space, so a slice
predicate is type-checked, not string-matched.

\`\`\`ts
// ILLUSTRATIVE — not landed. v2-core/fil-attribution/dimensions.ts
export type AttributionDimensionKey =
  | "bookingAgent"      // Principle 6: the "trader" IS an autonomous agent (agent:…)
  | "book"             // BookDesignation (already a branded type in fil-facets)
  | "desk"
  | "legalEntity"      // versioned LE-tree node (Principle 5)
  | "counterparty"     // Party-register id (urn:party:…)
  | "currency"         // ISO-4217 — the instrument's economic currency
  | "productType"      // the instrument's fil:type URN family
  | "strategy"         // a tenant-declared trading/ALM strategy tag
  | "maturityBucket"   // a closed bucket enum (o/n, ≤1m, ≤3m, ≤1y, ≤5y, >5y)
  | "portfolio"        // an arbitrary named grouping (trader portfolio, hedge set)
  | "jurisdiction";    // Principle 5 jurisdictional dispatch axis
// EXTENSIBLE: the key set is open at the registry, closed at the type level per
// release. A new dimension is a registry addition + a recon-gate allowlist bump,
// never an ad-hoc field.

export interface AttributionDimensions {
  readonly bookingAgent: AgentId;
  readonly book: BookDesignation;
  readonly desk?: DeskId;
  readonly legalEntity: LegalEntityNodeRef;   // versioned (nodeId + asOf-resolved)
  readonly counterparty?: PartyRef;
  readonly currency: string;
  readonly productType: FilTypeUrn;
  readonly strategy?: StrategyTag;
  readonly maturityBucket?: MaturityBucket;
  readonly portfolio?: readonly PortfolioTag[];  // an instance can sit in many
  readonly jurisdiction: JurisdictionCode;
}
\`\`\`

Most dimensions are **derived, not stored on the instance**: \`currency\`,
\`productType\`, \`maturityBucket\` are projections of the instrument's own facets
(\`Valuable\` / taxonomy / cash-flow schedule). Only the *organisational*
dimensions that are not implied by the economics — \`bookingAgent\`, \`book\`,
\`desk\`, \`strategy\`, \`portfolio\` — are asserted at booking and are themselves
*event-sourced and re-assignable* (a book transfer is an event, not a mutation):

\`\`\`ts
// ILLUSTRATIVE event — dimension assignment is itself event-sourced (Principle 1)
interface InstrumentDimensionAssigned {
  kind: "InstrumentDimensionAssigned";
  instanceUrn: FilInstUrn;           // fil:inst:fx:spot:<id>
  dimension: AttributionDimensionKey;
  value: string;                     // typed at the handler; serialised here
  effectiveFrom: Instant;            // book transfers / desk moves are time-versioned
  citation: CitationRef;
}
\`\`\`

So "which book/desk/agent did this instrument belong to **as-of T**?" is a
latest-covering-event-wins projection — the same pattern already used for
posture provisions and the LE tree. A back-dated re-book is a new event with an
earlier \`effectiveFrom\`, never a rewrite.

### 1.2 Hierarchy roll-up

Dimensions form **hierarchies**. The load-bearing org hierarchy is:

\`\`\`
bookingAgent (trader-agent)
   └─ book
        └─ desk
             └─ legalEntity            (versioned LE-tree node, Principle 5)
                  └─ consolidatedGroup (LE-tree root / sub-consolidation node)
\`\`\`

A hierarchy is a typed parent-resolution function over an \`asOf\` projection
(it is *not* hard-coded — the LE tree is already versioned and event-sourced;
book→desk→LE membership is the \`InstrumentDimensionAssigned\` + LE-tree join):

\`\`\`ts
// ILLUSTRATIVE
export interface DimensionHierarchy {
  readonly axis: AttributionDimensionKey;       // e.g. "legalEntity"
  parentOf(node: string, asOf: Instant): string | null;   // null at the root
  descendantsOf(node: string, asOf: Instant): readonly string[];
}
\`\`\`

Currency, maturity-bucket, and product-type are *flat* (or shallow: product-type
nests along the FIL taxonomy \`asset-class → family → leaf\`). The engine does not
care — a hierarchy with a single level is just a flat dimension. **Roll-up is a
property of the slice's target level, not of the metric** (§3).

### 1.3 Membership is an asOf projection (Principle 1)

\`members(slice, asOf)\` = the set of \`fil:inst\` URNs whose dimension projection
at \`asOf\` satisfies the slice predicate AND whose lifecycle stage at \`asOf\` makes
them in-scope for the metric (the metric declares which stages it consumes — e.g.
VaR consumes \`live\` + standing-NOP-bearing \`settled\`; see §4). No membership set
is stored. This is the single most important Principle-1 property of the design:
**a "book" is a query, evaluated fresh, never a maintained list.**

---

## 2. Metric + aggregation-semantics interface (THE CRUX)

### 2.1 A metric is a function of a SET of instances

\`\`\`ts
// ILLUSTRATIVE — v2-core/fil-attribution/metric.ts
export interface AttributionMetric<TResult> {
  readonly metricId: string;                 // "pnl" | "notional" | "var" | "ead" | …
  readonly resultKind: "money" | "scalar" | "vector" | "distribution";
  /** The facet(s) this metric reads — encapsulation contract (FIL §1). */
  readonly readsFacets: readonly FilFacetName[];
  /** Which lifecycle stages contribute (e.g. VaR: live + standing-NOP settled). */
  readonly stageScope: (stage: FilLifecycleStage) => boolean;
  /** THE declaration: how this metric aggregates over a member set. */
  readonly aggregation: AggregationSemantics<TResult>;
  /** Compute the metric over a member set at marks K, as-of T. */
  evaluate(members: readonly FilInstance[], marks: MarketDataSlice, asOf: Instant): TResult;
}
\`\`\`

The signature is exactly \`metric(set-of-instances, marks, asOf)\` from the brief.
There is no per-book or per-desk variant — the *same* \`evaluate\` runs at every
level; only the member set differs.

### 2.2 Additivity is NOT assumed — the metric declares its semantics

This is the crux. Aggregation has two structurally different paths, and **the
metric chooses which**:

\`\`\`ts
// ILLUSTRATIVE
export type AggregationSemantics<TResult> =
  | {
      // ADDITIVE: the metric over a parent = Σ of the metric over a disjoint
      // child partition. Sum is a valid OPTIMISATION — a node's value may be
      // cached as the sum of its children's cached values. Property the metric
      // ASSERTS (and a recon gate verifies against a from-scratch recompute).
      mode: "additive";
      zero: TResult;
      add(a: TResult, b: TResult): TResult;
    }
  | {
      // JOINT-RECOMPUTE: the metric over a parent is RE-COMPUTED over the joint
      // member set — it is NOT a function of the children's results. No sum
      // shortcut is legal. Diversification lives here.
      mode: "joint-recompute";
      // (no add/zero — composing children's results is mathematically wrong)
    };
\`\`\`

**Additive metrics** (\`mode: "additive"\`): P&L, notional, delta, gamma, EAD,
DV01-per-bucket, GL balance, accrual. For these the consolidated answer equals
the sum of any disjoint partition's answers. The engine MAY compute a node by
summing pre-computed children (the optimisation), but the *definition* is still
"evaluate over the joint member set" — summation is asserted to equal recompute,
and \`recon:attribution-additivity\` checks a sample of nodes both ways.

**Non-additive metrics** (\`mode: "joint-recompute"\`): **VaR, ES (Expected
Shortfall), stressed VaR, IRRBB ΔEVE at the diversified level, any quantile or
tail measure.** A consolidated VaR is **NOT** \`VaR(deskA) + VaR(deskB)\` — that
ignores diversification (the sub-additivity / correlation benefit) and would
*overstate* risk. Instead the engine selects the **joint position set** at the
consolidation node and feeds it to the risk engine **once**, so the engine's own
covariance/scenario machinery captures cross-position offsets:

> \`VaR(group) = riskEngine.run( ⋃ positionContribution(inst) for inst ∈ members(group) )\`

The attribution layer's job for a non-additive metric is purely **member
selection + handing the joint set to the engine** — it never composes child
results. (Helena, CRO: this is the only correct treatment; summing child VaRs is a
known mis-statement and would fail independent validation. Rohan, Markets: the
existing VaR/SVaR/ES engine already consumes a *position set* — \`derive\`​\`NetFxPositionByCurrency\` produces exactly such a joint NOP fold today — so the
attribution layer feeds it a slice-scoped member set with no engine change.)

### 2.3 Tie to the existing seven facets

The attribution layer reads *only* through facets — it adds no new data-access
path:

| Metric class | Facet read | Aggregation mode |
|---|---|---|
| P&L, fair value, MTM | \`Valuable.value(marks, asOf)\` → \`RevaluationRecord.value\` (Money) | additive (Σ Money, currency-typed) |
| Notional, delta, DV01-bucket | \`RiskMeasurable.riskFactors()\` + the type's economic terms | additive |
| EAD, RC, PFE (SA-CCR) | \`RiskMeasurable.positionContribution(engine)\` → joint hedging-set | additive **across netting sets**, engine-internal within |
| VaR, ES, SVaR, IRRBB ΔEVE (diversified) | \`RiskMeasurable.positionContribution(engine)\` → joint set | **joint-recompute** |
| GL balance, posting roll-up | \`Accountable.postingKeys()\` → posting lines | additive (GL is additive by construction) |
| RWA | \`RegulatoryClassifiable.riskWeightBasis(posture)\` × EAD | additive |
| HQLA / LCR contribution | \`RegulatoryClassifiable.hqlaTier(posture)\` | additive |

Note the nuance on **EAD**: it is additive *across netting sets* (each netting
set is a slice member group), but **within** a netting set the SA-CCR engine's
own netting/hedging-set math is a joint computation — that joint step lives
*inside* \`RiskMeasurable.positionContribution\` + the SA-CCR FIL-Model, not in the
attribution layer. So the attribution layer treats EAD as additive over the
*netting-set partition*, and the netting set is the atomic member group. This is
the general pattern: **the joint-vs-additive boundary is drawn at the level where
the metric's own engine stops nettings** — the attribution layer declares it via
the member-group granularity, not by special-casing.

### 2.4 Currency and the additive path (Principle 5)

\`Valuable.value\` returns \`Money\` (currency + bigint minor units). Additive
roll-up of P&L is \`Σ\` **within a currency**; cross-currency presentation is a
*reporting-currency translation at the slice's asOf closing rate* — a
presentation concern, never stored (Principle 5). The metric result for a
multi-currency slice is therefore a \`Money[]\` (one per economic currency) plus an
optional presentation-currency scalar; the engine never silently sums across
currencies.

---

## 3. Slice / query model

### 3.1 A slice = predicate over dimensions + a target level

\`\`\`ts
// ILLUSTRATIVE — v2-core/fil-attribution/slice.ts
export interface Slice {
  readonly sliceId?: string;            // present iff this is a NAMED/stored slice
  /** Conjunction of typed dimension predicates. */
  readonly where: readonly DimensionPredicate[];
  /** The roll-up target level — controls hierarchy aggregation depth. */
  readonly level: AttributionDimensionKey | "leaf" | "group";
  /** asOf is supplied at evaluation, not stored on the slice. */
}

export type DimensionPredicate =
  | { dim: AttributionDimensionKey; op: "eq"; value: string }
  | { dim: AttributionDimensionKey; op: "in"; values: readonly string[] }
  | { dim: AttributionDimensionKey; op: "under"; node: string };  // hierarchy descendant
\`\`\`

\`evaluate(metric, slice, marks, asOf)\`:
1. \`members = membersOf(slice.where, asOf)\` — the asOf projection (§1.3),
   filtered by \`metric.stageScope\`.
2. If \`slice.level\` requires a roll-up grouping (e.g. "VaR by desk under
   LE-ZA-HOZ-BANK"), partition \`members\` by the target dimension and evaluate
   \`metric\` per partition cell.
3. Apply \`metric.aggregation\`: additive → Σ (or the children-sum optimisation);
   joint-recompute → hand each cell's joint member set to the engine.

### 3.2 Named/persistent slices are STORED PREDICATES (Principle 1)

A book, a trader portfolio, a consolidation view, "the FX trading book", "Desk-EM
under the SA entity" — each is a \`SliceDefined\` event carrying the *predicate*,
never a number:

\`\`\`ts
// ILLUSTRATIVE event
interface SliceDefined {
  kind: "SliceDefined";
  sliceId: string;                 // "slice:book:fx-trading"
  where: DimensionPredicate[];     // [{dim:"book", op:"eq", value:"fx-trading"}]
  level: string;
  citation: CitationRef;
}
\`\`\`

The "trading book" is then \`slice:book:fx-trading\`; "the bank" is
\`slice:legalEntity:under:LE-ZA-HOZ-BANK level=group\`. **No balance is ever stored
against a slice** — the slice is re-evaluated against the live event log every
time. This is the direct generalisation of the withdrawn book-composite: the book
was going to be a composite primitive holding members; instead it is a stored
predicate and membership is a query.

---

## 4. Worked slice — FX P&L + the trading book (proof case)

*This section is co-authored with Bea (Accounting & financial reporting engineer,
engineering); the IFRS treatment and the P&L-attribution worked example are her
contribution.*

### 4.1 Instantiate the dimension/metric model on FX

Three FIL instruments span the FX lifecycle (per
\`D-FX-PNL-INSTRUMENT-LEVEL-VALUATION\`, Bea's diagnosis, PR #1309):

1. **FX spot/forward, pre-settlement — the receivable.** A monetary claim. Its
   \`Valuable.value(marks, asOf)\` retranslates at the closing rate each day
   (IAS 21 §23(a) — monetary items at the closing rate at each reporting date).
   Dimensions: \`{book: fx-trading, currency: <CCY>, productType: fil:type:fx:spot,
   counterparty, bookingAgent, legalEntity}\`.
2. **FCY cash position, post-settlement — the CSH monetary instrument**
   (\`fil:inst:csh:<CCY>:<book>\`). On settlement the receivable is **derecognised
   at its settlement-date carrying amount** and the FCY cash is **recognised at
   that same settlement-date carrying amount** — *not* at contracted cost. (This
   is the correction to the diagnosis wording: post-settlement cash carries the
   receivable's settlement-date CARRYING amount — the value to which it was last
   retranslated up to the settlement date — never the original contracted cost.
   Because both legs of the swap are struck at the *settlement-date closing rate*,
   the swap is fair-value-for-fair-value and no P&L crystallises — see 4.2.) FCY
   cash is a monetary item and is retranslated at the closing rate each reporting
   date (IAS 21 §23(a)).
3. **Reconversion to ZAR — derecognition.** Realised P&L crystallises only on
   close-out = (disposalRate − weighted-avg ZAR carrying cost) × amountClosed —
   the existing \`RealisedPnlRecognised\` event.

### 4.2 The trading-book slice computes P&L = Σ member values

\`P&L(slice:book:fx-trading, asOf)\`:
- \`metric = pnl\` (additive Money; \`readsFacets: [Valuable]\`;
  \`stageScope = live ∨ settled-with-standing-NOP\`).
- \`members\` = unsettled FX trades (receivables) **+** settled FCY cash positions
  in \`book:fx-trading\` at \`asOf\`.
- result = \`Σ Valuable.value(member, marks, asOf)\` per currency.

The settled FCY cash is a member of the slice **exactly because** the standing NOP
is retained for risk (\`deriveNetFxPositionByCurrency\`, \`D-VAR-EXPOSURE-INCLUDES-STANDING-NOP\`). One instrument, one closing rate, two derived views (accounting
carrying value and risk NOP) — they agree by construction (closes the Item-3
contradiction Bea documented).

### 4.3 The settlement-continuity invariant (the governing test)

> **value_pre == value_post** on the settlement date, evaluated at the
> **settlement-date closing rate**.

At the instant of settlement, the receivable (instrument 1) is replaced by the FCY
cash (instrument 2). Both are valued at the settlement-date closing rate; the swap
is an **equal-fair-value member swap**. Therefore the slice's total
\`Valuable\`-derived value is **unchanged across the settlement boundary**. Settlement
extinguishes **settlement (Herstatt) risk** only — the bank no longer faces the
risk of delivering ZAR and not receiving FCY — it does **not** change **market
risk**: the held FCY still moves with spot exactly as the receivable did.

**This is STRUCTURAL, not a posting convention.** The proof is in the facet
signature: \`Valuable.value(marks: MarketDataSlice, asOf: Instant)\` takes **only
marks and asOf** — it has **no lifecycle input**. A metric computed from
\`value()\` therefore *cannot* discontinuously jump on a lifecycle event, because
\`value()\` never sees the lifecycle event. Settlement changes *which instrument
instance* is the member (receivable → cash), but both instances return the same
\`value()\` at the same (marks, asOf). The continuity is a type-level consequence of
the facet contract, not a number we reconcile after the fact.

Standards basis: IAS 21 continuous retranslation (§23(a)); IFRS 9 derecognition at
fair value (a financial asset is derecognised at its carrying = fair value, and the
replacing asset recognised at fair value — no gain on a fair-value-for-fair-value
exchange); Basel settlement-risk vs market-risk separation (settlement risk is a
distinct exposure class that extinguishes at settlement; market risk persists).

### 4.4 Recon gates (this slice)

- **(a) Settlement continuity:** for every \`SettlementConfirmed\`, assert
  \`value_pre == value_post\` at the settlement-date closing rate (the §4.3
  invariant). Any non-zero delta is a defect.
- **(b) GL carrying ⟷ NOP/VaR basis at every slice level:** the additive P&L /
  carrying-value roll-up reconciles to \`deriveNetFxPositionByCurrency\` at leaf,
  book, desk, LE, and group levels (same held-FCY instrument, same closing rate).
- **(c) FIL-sourced parity vs v1 handler during cutover:** the attribution-engine
  FX P&L equals the v1 \`runEodFxRevaluation\` output byte-for-byte while both run
  (the standard FIL cutover parity discipline, as for SA-CCR).

---

## 5. v1 cutover + recon gates + build slice sequence

### 5.1 What cuts over

- v1 FX GL realised/unrealised posting (\`pr-fx-lifecycle-close.ts\` rate-delta
  line; \`pr-fx-002.ts\` unrealised accrual) → **derived projections** of the three
  FX instrument valuations under the attribution engine.
- \`runEodFxRevaluation\` → the engine revalues the *held-FCY cash instrument*
  post-settlement (closing the frozen-FCY drop), feeding the same \`Valuable\`
  outputs the attribution layer reads.
- NOP/VaR basis (\`deriveNetFxPositionByCurrency\`) → reads the held-FCY cash
  instrument members through the attribution engine (one source, two views).
- **Retire** \`pr-fx-lifecycle-close.ts\` (rate-delta realised line) and the
  account-level realised path; \`SettlementConfirmed\` becomes a pure
  derecognition/recognition swap with zero P&L (§4.3).
- **Close the live R1,384,290.55 frozen-FCY gap** (Bea's diagnosis,
  \`D-FX-PNL-INSTRUMENT-LEVEL-VALUATION\`, PR #1309) **by the objects**: once the
  held-FCY cash instrument is retranslated each closing date and the unrealised
  accrual is reversed on derecognition, the stranded R1.38m is no longer frozen —
  it is either retranslated forward (still-held FCY) or realised on close-out
  (\`RealisedPnlRecognised\`, the existing −R471,590.76 net figure, posted by a new
  GL rule). The gap closes as a *consequence of the instrument model*, not a
  one-off correction.

### 5.2 Recon gates (standing, post-cutover)

| Gate | Asserts |
|---|---|
| \`recon:attribution-settlement-continuity\` | §4.3 value_pre == value_post at every \`SettlementConfirmed\` |
| \`recon:attribution-gl-nop-parity\` | GL carrying reconciles to NOP/VaR basis at every slice level |
| \`recon:attribution-fil-v1-parity\` | engine output == v1 handler during cutover (retires when v1 path retires) |
| \`recon:attribution-additivity\` | sampled additive nodes: children-sum == from-scratch joint recompute |
| \`recon:attribution-nonadditive-no-sum\` | non-additive metrics (VaR/ES) are NEVER composed from child results (static + runtime guard) |

### 5.3 Build slice sequence (CEO-approvable, NOT big-bang)

1. **A1 — Kernel dimension + metric model.** \`fil-attribution\` package:
   \`AttributionDimensions\`, \`InstrumentDimensionAssigned\` event,
   \`DimensionHierarchy\`, \`AttributionMetric\` + \`AggregationSemantics\` (additive /
   joint-recompute), \`Slice\` + \`SliceDefined\`. No metrics bound yet; no cutover.
   Recon: \`attribution-additivity\` + \`attribution-nonadditive-no-sum\` on a
   fixture. Hard no-v1-import boundary (as v2-core). *Deliverable: types +
   engine, empty registry.*
2. **A2 — FX \`Valuable\` + the book slice.** Bind the FX three-instrument
   \`Valuable\` model; define \`slice:book:fx-trading\`; implement the \`pnl\` metric
   (additive Money). Prove §4.3 continuity + §4.4(a)/(b) on the anchor book.
   *Still parallel to v1 (read-only); no GL cutover.*
3. **A3 — Trader/agent + consolidation levels.** Add \`bookingAgent\`, \`desk\`,
   \`legalEntity\`, \`group\` roll-ups; prove additive P&L rolls up correctly and the
   **non-additive VaR re-computes** at desk/LE/group (joint-recompute path) vs the
   v1 VaR engine (\`attribution-fil-v1-parity\`).
4. **A4 — FX GL cutover.** Make the attribution engine the GL source of record for
   FX P&L; add the \`RealisedPnlRecognised\` posting rule + unrealised reversal;
   retire \`pr-fx-lifecycle-close\` rate-delta line + \`runEodFxRevaluation\`; close
   the R1.38m gap by the objects. Parity gate flips to enforce, then v1 path
   retires.
5. **A5 — Broader metrics + instruments.** Generalise to notional/delta/EAD/RWA
   (additive) and IRRBB ΔEVE/SVaR/ES (joint-recompute); extend to IR (reusing the
   SA-CCR FIL-Model's \`RiskMeasurable\`) and the bond book. Each metric is a new
   \`AttributionMetric\` registration, not a new aggregate primitive.

Each slice is independently shippable, independently recon-gated, and parallel-to-v1
until its parity gate is green — no big-bang.

---

## 6. Open design questions needing CEO / advisor input

1. **Dimension authority.** Who may emit \`InstrumentDimensionAssigned\` (book
   transfers, desk moves, strategy re-tags)? Proposal: the booking agent for its
   own desk; cross-desk transfers require a second-seat (Helena/Treasurer)
   co-sign via the reviewer→decider primitive. **CEO to confirm the authority
   routing.**
2. **Maturity-bucket boundaries.** The IRRBB/liquidity bucket set must be a single
   canonical enum (re-used by BA-330 ladder, LCR, IRRBB). Proposal: adopt the
   existing IRRBB time-bucket schedule as the canonical \`MaturityBucket\`. **Ravi
   (ALM) / Helena to ratify.**
3. **Non-additive roll-up cost.** Joint-recompute VaR at every node is O(nodes ×
   engine-run). Proposal: memoise per (sliceId, asOf, methodologyHash) — still a
   recompute, just cached by content address, never a stored balance. **Confirm
   the cache is acceptable to Vera as Principle-1-clean (it is a derived cache,
   invalidated by any new event, not a stored aggregate).**
4. **Strategy/portfolio dimension ownership.** Are \`strategy\` and \`portfolio\`
   tenant-defined (BBaaS multi-tenant) or bank-canonical? Proposal: tenant-defined
   tags with a bank-canonical reserved set. **Confirm against the tenancy model.**

---

## 7. Substrate gaps surfaced

- **No \`fil:inst\` materialisation for FX yet** — the FX book is still v1-sourced;
  A2 depends on the FIL-instance materialisation slice (Atlas design note
  2026-06-13) landing the FX \`Valuable\` instances.
- **No GL posting rule for \`RealisedPnlRecognised\`** (carried from Bea's
  diagnosis) — A4 lands it.
- **VaR engine consumes a position fold, not a typed member set** — A3 must adapt
  \`deriveNetFxPositionByCurrency\` to accept an attribution-slice member set
  (mechanical; the fold logic is unchanged).
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: [
      "D-METRIC-ATTRIBUTION-DIMENSIONAL",
      "D-RMS-PHASE-3",
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-FX-PNL-INSTRUMENT-LEVEL-VALUATION",
      "D-VAR-EXPOSURE-INCLUDES-STANDING-NOP",
      "urn:obligation:ifrs:ias21:23",
      "urn:obligation:ifrs:ifrs9:5.7.1",
      "P1-EVENTS-AS-TRUTH",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "P5-MULTI-CURRENCY-ENTITY-COUNTRY",
      "P6-AUTONOMOUS-BY-DEFAULT",
    ],
    actor: {
      type: "service",
      id: "agent:atlas:core-banking-platform-architect",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "Dimensional metric-attribution layer — design spec (every metric attributable at any level and any slice)",
      path: "2026-06-13_atlas_dimensional-metric-attribution-layer-design-spec.md",
      category: "design-spec",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-13",
    },
  },
  "2026-06-13T17:00:00.000Z",
);

console.log(
  JSON.stringify(
    { ok: true, recordId: RECORD_ID, eventId: result.eventId, documentHash: result.documentHash },
    null,
    2,
  ),
);
