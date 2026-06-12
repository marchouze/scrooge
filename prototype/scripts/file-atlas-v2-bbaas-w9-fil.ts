// scripts/file-atlas-v2-bbaas-w9-fil.ts
//
// One-shot RMS Phase 3 filing for Atlas's W9 Financial Instrument Language
// (FIL) design paper for the v2 "Bank Backbone as a Service" (BBaaS)
// repositioning. Emits a RecordFiled event so the Documents register holds
// the canonical paper. The body is embedded inline (Phase 4 —
// D-RMS-PHASE-4 — made the content-addressed document store the canonical
// home; no in-tree root render is created). Idempotent — skips if already
// filed.
//
// Authority: D-V2-BBAAS-W9-FIL (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-w9-fil:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-w9-fil] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W9 Financial Instrument Language: kernel, facets, standards stance, conformance, migration

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat,
covering Risk Engineer scope (Rohan, risk engineer, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W9-FIL (CEO-approved 2026-06-12); builds on the W2 domain map
(record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12), the W4 model library
(record:documents:rohan:v2-bbaas-w4-model-library:2026-06-12), the W8 agent-learning
architecture (record:documents:atlas:v2-bbaas-w8-agent-learning:2026-06-12), and the
4-wave blueprint (record:documents:atlas:v2-bbaas-blueprint:2026-06-12)
**Audience:** Marc (CEO)
**Status:** Analysis only. Nothing here builds the language; §9 names the slices,
§10 names the decisions, and both are Marc's to take or refuse.
**CEO direction taken as given (verbatim, in-session 2026-06-12):** "another key structural
component needs to be a comprehensive Financial Instrument Language that is developed that
all aspects of the application will consistently use (like an object-oriented methodology)."

---

## 1. Why a language, not a data model

A data model says what an instrument *record* looks like. A language says what an
instrument *is* — what it is composed of, what it can do, what every part of the system may
assume about it, and how the vocabulary itself evolves without breaking its speakers. The
distinction is exactly the object-oriented one Marc named, and it is worth making precise,
because v1 already has several instrument data models (§2 counts them) and the problem is
not that any one of them is wrong. The problem is that nothing forces them to be the *same
description of the same thing*.

The OO analogy, made precise:

- **The kernel taxonomy is the class hierarchy.** Asset classes are abstract base types;
  families specialise them; concrete instrument types are the instantiable classes; an
  instrument *instance* (a position, a trade, a holding) is an object — event-sourced and
  tenant-owned, while the type is shared core. Composition is first-class, not inheritance
  abuse: a swap is *composed of* two legs; a structured product is composed of components;
  a repo wraps collateral. v1's CDM composition layer
  (\`platform/markets/products/types.ts\`, \`cdmCompositionSchema\`) already gestures at
  this — FIL makes it the only way an instrument exists.
- **Facets are the interfaces an instrument exposes.** \`Valuable\`, \`Accountable\`,
  \`RegulatoryClassifiable\`, \`RiskMeasurable\`, \`PostureRelevant\`, \`Reportable\`,
  \`Lifecycled\` (§3.4). A layer never reaches into ad-hoc instrument fields; it programs
  against the facet it needs. The GL asks an instrument for its \`Accountable\` facet; the
  SA-CCR engine asks for \`RiskMeasurable\`; the BA-return renderer asks for
  \`Reportable\`. Polymorphism does the routing that today is done by string-matching on
  half a dozen home-grown discriminators.
- **Encapsulation is the audit property.** When the only way to learn an instrument's
  HQLA tier is to ask its \`RegulatoryClassifiable\` facet, then there is exactly one
  answer in the system, it carries its citation, and a recon gate can verify that no layer
  computed its own. Today the HQLA answer lives in at least two places (§2.7) and nothing
  reconciles them by construction.
- **Versioned like a language, not migrated like a schema.** FIL 1.0 ships a frozen kernel
  surface. Evolution is additive by rule: new types, new facet *methods with defaults*, new
  enum members in open positions. Breaking changes require a major version and a deprecation
  window in which both readings are projectable from the same events — the event log is
  immutable (Principle 1), so the language version is an interpretation layer, never a
  rewrite. Deprecation policy mirrors the event-type registry's: a deprecated FIL element
  keeps folding forever for historical events, is barred for new authoring by the
  conformance gate (§7), and carries a pointer to its successor. This is the same posture
  the decision-distillation register takes to old decisions: classified, never erased.

Why this must be a *single* language rather than per-layer models reconciled by mapping
tables: the W4 model library makes models tenant-portable by binding contracts; the W8
posture register conditions regulatory applicability on "products held"; the W2 domain map
assigns each domain a data store it owns. All three implicitly quantify over "instrument"
— a model declares the instrument data it consumes, a posture fact says which instrument
types the bank holds, a domain owns instrument-shaped data. If "instrument" means a
different vocabulary in each clause, the three workstreams compose only through hand-built
mapping tables, and every mapping table is an un-cited, silently-drifting artefact of
exactly the kind Principle 2 forbids. FIL is the shared quantification domain that makes
the completed workstreams' contracts real.

## 2. Gap analysis of v1 — the divergent instrument vocabularies

This section is the paper's evidence base. Every vocabulary below is live on main as of
2026-06-12, with file citations. The headline: **v1 carries at least ten distinct
instrument vocabularies**, none of which is derivable from another by code (only by
convention), and the same FX spot trade is described in at least seven of them.

### 2.1 The Product layer — URN + family enum

\`platform/markets/products/types.ts\`: \`productId\` URN of form
\`prd:bank:<asset-class>:<slug>\` plus \`productFamilySchema\`, an 8-member enum
(\`listed-equity\`, \`listed-bond\`, \`repo\`, \`otc-ird\`, \`fx\`, \`structured\`,
\`money-market\`, \`interbank-loan\`). The asset-class segment of the URN is free text
constrained only by regex — \`prd:bank:equity:jse-equity-cash\` vs the family
\`listed-equity\`: two spellings of "equity" in the same record, related by nothing
machine-checkable.

### 2.2 The CDM composition layer

Same file, \`cdmCompositionSchema\`: \`PrimitiveRef { module, symbol, role }\` pointing
into \`platform/markets/cdm/{primitives,equity,bond,repo,ird,fx}\` by *string module path
and string export name*, plus a free-text \`compositionRule\` narrative. The composition
is real and CEO-chartered (D-MARKETS-SCHEMA-FOUNDATION; D-PRODUCT-CONSTRUCTION-SUBSTRATE),
but it is documentation-shaped: \`composeProduct\` consumes it, yet no type system
connects a PrimitiveRef to the schema it names.

### 2.3 The FinancialInstrument master record + ACTUS

\`platform/markets/cdm/instrument.ts\` defines a *second, parallel* instrument identity:
\`FinancialInstrumentDefined\` (master record for "all things the bank trades, holds, or
owes") with an \`actusContractType\` discriminator (PAM, STK, CSH, CLM, ZCB, IRS, FXOUT,
CMP) and \`FinancialInstrumentClassified\` as a separate regulatory/accounting overlay
(HQLA tier, Basel risk-weight, IFRS 9 category, SA-CCR asset class).
\`platform/markets/cdm/dcam-actus-mapping.ts\` bridges to ACTUS semantics. This layer and
the Product layer (§2.1) both claim to be the instrument's identity, with no edge between
\`prd:bank:...\` and a FinancialInstrument id. Note also that
\`FinancialInstrumentClassified\` and \`Product.riskProfile\` /
\`Product.accountingClassification\` answer the *same questions* in different shapes.

### 2.4 Lifecycle event families as free strings

\`Product.lifecycleEventFamily\` is \`z.array(z.string())\` —
\`platform/markets/products/fixtures.ts\` lists \`"EquityTradeBooked"\`,
\`"EquityCorporateActionApplied"\`, etc. as strings with no link to the event-type
registry (~687 registered types). The goal-loop three-way-coherence incidents (deriver
label vs planned event vs actual emit disagreeing, causing silent jams) are the recorded
failure mode of exactly this pattern: stringly-typed event vocabulary diverging from the
registered one.

### 2.5 SLA posting rules — \`instrument_type\` strings

\`platform/accounting/sla/rule.schema.json\` keys every posting rule on
\`applies_to.instrument_type\`, a free string-or-array. The live rules use
\`"FX-spot"\` (\`pr-fx-001.ts\` and nine siblings), \`"BOND"\` (\`pr-bond.ts\`),
\`"EQUITY"\` (\`pr-equity.ts\`), \`"FUNDING"\` (\`pr-funding.ts\`) — different casing
conventions, different granularity (\`FX-spot\` is variant-level; \`BOND\` is
family-level), and none of them is the Product family enum, the URN asset-class segment,
or the ACTUS type. The concrete bug class is on record: when the FX OTC umbrella widened
spot-only approval to forward/swap (D-FX-OTC umbrella, 2026-06-10), three spot-gated FX
rules had to be found *by grep* and widened by hand — the residual of PR #1163. A typed
key would have made the widening a compile-visible change.

### 2.6 The posting-rule registry — keyed by trigger event type

\`platform/accounting/posting-rule-registry.ts\` maps *trigger event types* →
expected postings, a third accounting-side vocabulary (\`FxTradeExecuted\` etc.) distinct
from both \`instrument_type\` and the Product layer. The dual-IRS-event-family incident is
this vocabulary's recorded failure: two parallel families (\`IrdSwap*\` accounting vs
\`Irs*\` markets-CDM) for the same instrument, converged only after the fact by
D-IRS-FAMILY-CONVERGE-ACCOUNTING (PR #1121) — i.e. the same swap had two event dialects
and the engines disagreed about which one was real.

### 2.7 Risk engines — per-engine asset-class enums and hardcoded event names

\`platform/risk/sa-ccr/types.ts\` line 106: \`SaCcrAssetClass = "ir" | "fx" | "credit"
| "equity" | "commodity"\` — a fourth spelling of asset class. \`compute-and-emit.ts\`'s
\`resolveMtm\` hardcodes the event-type names it walks (\`IrsTradeBooked\`,
\`FxTradeExecuted\`, \`IrdSwapPositionRevalued\`, \`FxPositionRevalued\`) — adding a
bond to a netting set means editing the engine, not declaring a fact about bonds. HQLA
classification lives in *two* unreconciled homes: COA-tag-driven
\`coaToHqlaClassifications()\` in \`platform/accounting/coa-registry.ts\` (the live
BA 300 LCR path per D-HQLA-COA-CLASSIFICATION, \`platform/reporting/ba-300-lcr.ts\`)
versus \`Product.riskProfile.liquidityClassification\` (\`hqla-eligible-l1\` …
\`non-hqla\`) on the product record. Nothing asserts they agree.

### 2.8 Returns renderers — hand-wired per-instrument adapters and string cell refs

Each return reaches instruments through a bespoke adapter:
\`platform/reporting/ba-320-fx-adapter.ts\` (bridges the FX position calculator),
\`ba-320-irs-events-adapter.ts\`, \`ba-320-bond-events-adapter.ts\` — instrument
coverage of a return is the *set of adapters someone remembered to write*, which is how
the completeness audit (D-COMPLETENESS-AUDIT-WORKSTREAM) found all seven returns
subscribers inert. Meanwhile \`Product.accountingClassification.baReturnLineMapping\`
carries cell refs as free strings (\`"BA600.line.34"\` in the M1 equity fixture —
written under the BA-numbering scheme later shown to be partly fabricated and corrected by
D-BA-RETURN-NUMBERING-EXCEL-CANONICAL). String-typed return refs are precisely why a
fabricated numbering scheme could survive in fixtures: nothing resolved them.

### 2.9 NPA / product-governance dimensions

\`platform/markets/products/semantic.ts\` (\`PRODUCT_DIMENSION_VALUES\`, the 14 NPA
dimensions) and \`dimension-key-alias.ts\` (alias table patching divergent dimension-key
spellings — the existence of an alias-resolution file is itself evidence). The product
register projection (\`platform/projections/products/product-register.ts\`) folds
attestations by dimension-key string.

### 2.10 Obligations graph and posture facts

Obligations reference products through citation URN strings; the W8 posture register
derives "products held" facts from the product register's lifecycle stages; APPLIES_WHEN
predicates (W8 §3) will condition on those facts. Today the chain product-URN →
family-enum → posture-fact is convention, not type: a posture fact \`products.fx-otc =
held\` and the product \`prd:bank:fx:otc-vanilla\` are connected by a human knowing they
mean the same thing.

### 2.11 The same trade, seven ways

One FX spot trade today is simultaneously: family \`"fx"\` under
\`prd:bank:fx:otc-vanilla\` (§2.1); a CDM composition narrative (§2.2); ACTUS \`FXOUT\`
(§2.3); trigger event \`FxTradeExecuted\` (§2.6); SLA \`instrument_type: "FX-spot"\`
(§2.5); SA-CCR \`assetClass: "fx"\` (§2.7); BA 320 rows via the FX-specific adapter
(§2.8). Every pair of these is connected by convention or by a hand-written bridge. The
recorded incident classes this produces — dual event families (§2.6), spot-gated rules
surviving scope widening (§2.5), fabricated return refs (§2.8), inert return subscribers
(§2.8), duplicate HQLA homes (§2.7), dimension-key aliases (§2.9) — are not ten different
bugs. They are one bug: **no shared instrument language**, surfacing wherever two layers
meet.

## 3. The language design

### 3.1 Kernel taxonomy

Four levels, each a node in the single graph (Principle 2):

- **Asset class** — closed, platform-minted set: \`ir\`, \`fx\`, \`equity\`,
  \`credit\`, \`commodity\`, \`funding\`, \`hybrid\`. Deliberately aligned with the
  SA-CCR/Basel partition (§2.7) because that is the partition regulation quantifies over.
- **Family** — platform-minted specialisations: \`fx.spot\`, \`fx.forward\`,
  \`fx.swap\`, \`ir.swap.vanilla\`, \`equity.cash.listed\`, \`credit.bond.govt\`,
  \`funding.repo\`, \`funding.deposit.money-market\` … Subsumes v1's
  \`productFamilySchema\` at finer, regulation-relevant granularity (the \`"FX-spot"\`
  vs \`"fx"\` granularity mismatch of §2.5 dissolves: both are taxonomy nodes, one the
  parent of the other).
- **Type** — the instantiable class; shared core; minted by the platform through the
  governed process of §6 (the NPA gate is its tenant-facing mouth). A type binds: its
  family, its composition template (§3.2), its lifecycle event family (§3.3), and its
  facet implementations (§3.4). v1's \`prd:bank:fx:otc-vanilla\` becomes a FIL type.
- **Instance** — event-sourced, tenant-owned: a booked trade, an open position, a holding.
  Instances exist only as projections over lifecycle events (Principle 1); FIL specifies
  the projection, the events stay canonical.

**Identifier scheme.** One URN family:
\`fil:type:<asset-class>:<family-path>:<type-slug>@<major.minor>\` for types
(e.g. \`fil:type:fx:spot:otc-vanilla@1.0\`) and
\`fil:inst:<tenant>:<instance-id>\` for instances. External identifiers are *mappings on
the identity facet*, never primary keys: ISIN and FSB UPI where they exist, ISO 10962 CFI
as a derived classification render, ACTUS contract type as the algorithmic discriminator
(retaining §2.3's mapping). The v1 \`prd:\` URN is grandfathered as an alias of its FIL
type during migration (§8).

### 3.2 Composition algebra

Three constructors, CDM-style:

- **Legs** — ordered economic flows: an IRS is \`legs: [fixedLeg, floatLeg]\`; an FX swap
  is \`legs: [nearLeg, farLeg]\`. Each leg is itself FIL-typed (a leg type, not a free
  object), so leg-level engines (DV01 by leg, settlement by leg) bind to typed structure.
- **Components** — containment: a structured product contains components that are
  themselves full FIL types (a capital-protected note = zero-coupon bond component +
  option component). Risk and accounting facets may be computed by composition over
  components — the OO composite pattern, and the reason \`structured\` (reserved but
  empty in v1's family enum) becomes buildable rather than special.
- **Wrappers** — reference without containment: a repo wraps collateral it does not own
  the lifecycle of; a CFD wraps an underlier. Wrapping is an edge to another FIL type or
  instance, carrying the wrap semantics (title transfer vs pledge, delta to underlier).

v1's \`cdmCompositionSchema\` narrative is replaced by this typed algebra; the
\`PrimitiveRef\` string-pointers (§2.2) are retired in favour of direct schema
composition — the FINOS CDM economic-terms shapes remain the vocabulary of the leaves
(§4.1).

### 3.3 Lifecycle event families bound to types

Every FIL type declares its lifecycle as a typed state machine over *registered* event
types: \`trade → settle → (reval)* → (coupon)* → expiry | cancel\`, with each transition
naming the event-type registry entry that realises it. This replaces
\`lifecycleEventFamily: string[]\` (§2.4) with a contract the registry can verify: a FIL
type referencing an unregistered event fails conformance; an event family with no FIL type
is flagged orphan. The dual-IRS incident (§2.6) becomes unrepresentable — one type, one
declared lifecycle, and a second family for the same type is a conformance failure, not a
discovery.

### 3.4 The facet interfaces

TS sketches (design artefacts inside this document; no code change):

\`\`\`ts
interface Lifecycled {
  lifecycle(): LifecycleDeclaration;          // typed state machine of §3.3
  stage(asOf: Instant): LifecycleStage;       // projection over events
}

interface Valuable {
  valuationMethod(): "mark-to-market" | "mark-to-model" | "amortised";
  requiredObservables(): ObservableRef[];     // curves, fixings, prices (provenance-typed)
  value(marks: MarketDataSlice, asOf: Instant): Money;   // emits *Revalued events-of-record
}

interface Accountable {
  ifrs9Category(designation: BookDesignation): "amortised-cost" | "fvtpl" | "fvoci";
  postingKeys(): Array<{ lifecycleEvent: FilEventRef; ruleKey: FilUrn }>; // GL binding (§5)
  fairValueHierarchy(): "level-1" | "level-2" | "level-3";
}

interface RegulatoryClassifiable {
  baselAssetClass(posture: PostureSnapshot): SaCcrAssetClass;   // posture-conditioned
  hqlaTier(posture: PostureSnapshot): "L1" | "L2A" | "L2B" | "non-hqla";
  riskWeightBasis(posture: PostureSnapshot): RiskWeightBasis;   // CRE20 bucket inputs
}

interface RiskMeasurable {
  riskFactors(): RiskFactorRef[];             // delta/vega/curve … typed, not enum-listed
  positionContribution(engine: EngineId): PositionSelector;  // how SA-CCR/IRRBB/VaR select it
}

interface Reportable {
  returnsCells(form: BaFormId, posture: PostureSnapshot): CellBinding[];  // typed, resolvable
}

interface PostureRelevant {
  postureDimensions(): PostureDimensionKey[]; // which W8 products-held dims this type feeds
}
\`\`\`

Two design notes. First, the regulatory facets take a \`PostureSnapshot\` parameter —
classification is approach-conditioned (a bond's risk-weight basis differs under SA vs
IRB), which is the W8 connection CDM does not model (§4.1). Second, facets *emit
events-of-record* rather than returning bare values where the answer is load-bearing
(\`value()\` → \`*Revalued\`; classification changes →
\`FinancialInstrumentClassified\`, which §2.3 shows already exists and becomes the
facet's event vocabulary).

### 3.5 Versioning

FIL itself is versioned (FIL 1.0 = the kernel of §3.1–3.4). Types are versioned
independently (\`@major.minor\` in the URN). Additive rules: new types, new families
under existing classes, new facet methods with total defaults — minor. Removing or
re-typing anything — major, with the deprecation policy of §1. The conformance gate (§7)
pins each consuming layer to the FIL versions it speaks, so a version bump is a visible
contract event, not a drift.

## 4. External-standards stance

Per the W5 doctrine — adopt maps and vocabularies, not middleware — the stance per
standard, each with the verdict up front:

### 4.1 FINOS CDM — **adopt as composition backbone; extend for posture, returns, postings**

v1 already speaks CDM where it matters: the per-asset-class modules under
\`platform/markets/cdm/\` (fx, ird, equity, bond-book, primitives, instrument), the
\`cdmComposition\` field on every Product (§2.2), the W2 domain map's binding of the
Product Directory and trade-booking domains to CDM, and the
\`CdmBindingsRegenerated\` regeneration event. FIL keeps CDM as the vocabulary of
economic terms, payouts, legs, and lifecycle *primitives* — §3.2's algebra is
deliberately isomorphic to CDM's product composition so the kernel can regenerate
bindings from CDM releases. What CDM does not cover, and where FIL extends:
**posture-conditioned regulatory classification** (CDM has no concept of "this bank is an
SA bank", which W8 made load-bearing), **returns-cell mapping** (BA-form bindings are
SARB-specific), **GL posting keys** (CDM stops at economic events; our SLA rules need
typed keys), and **NPA governance attachment** (the 14 dimensions attach to FIL types,
not CDM products). Divergence is confined to these extension facets; the composition core
stays CDM-conformant.

### 4.2 FIBO — **adopt for concept semantics and naming; no runtime binding**

As the W2 map already concluded per domain: FIBO FBC supplies the concept names and
definitional semantics for the taxonomy (asset classes, instrument kinds, party roles),
keeping our family names alignable to a public ontology and giving the obligations graph
a shared semantic anchor for cross-regulator equivalence work. FIBO is consulted at
type-minting time (the governed process of §6 records the FIBO concept a new family maps
to); it never executes.

### 4.3 ISO 20022 — **adopt at the message edge only**

Existing serialisers under \`platform/payments/iso20022/\` and the W2 payments-domain
binding stand. FIL types declare their message bindings (setr/sese for securities
settlement, fxtr for FX, camt for cash) as facet data, so the edge mapping is declared
on the type rather than hand-coded per integration. ISO 20022 concepts never leak inward
of the message boundary.

### 4.4 ISO 10962 CFI, ISIN, FSB UPI — **adopt as external identifier mappings**

Carried on the identity facet (§3.1): ISIN for listed instruments (already a CDM
primitive role in the M1 fixture), UPI for OTC derivatives reporting, CFI as a *derived*
render (a FIL type can emit its CFI code mechanically from taxonomy position + facet
data — a conformance test, not a stored field). External identifiers are never primary
keys; \`fil:\` URNs are.

### 4.5 ACTUS — **retain as algorithmic contract-type discriminator**

v1's \`actusContractType\` (§2.3) and the DCAM-ACTUS mapping stay: ACTUS answers "what
cash-flow algorithm does this contract follow", which is orthogonal to and compatible
with CDM composition. A FIL type carries its ACTUS type where one exists; the §10 open
question on converging the FinancialInstrument master record into FIL settles where the
field lives.

## 5. Integration contracts

How FIL slots into each completed workstream — these are the contracts that make W2/W4/W8
real rather than aspirational:

- **W2 domains.** Each domain's data-store ownership declaration is restated in FIL
  terms: trade-booking owns \`fil:inst\` lifecycle events for families it books;
  reference-data owns \`fil:type\` definitions; valuation owns \`Valuable\`-facet
  events-of-record; the GL owns \`Accountable\`-facet consequences. Domain boundaries
  become facet boundaries — a domain that needs another facet's answer subscribes to its
  events, never recomputes it.
- **W4 model binding contracts.** A model's consumed-instrument-data manifest (W4 §1.1)
  is rewritten as facet requirements over taxonomy nodes: SA-CCR declares "requires
  \`RiskMeasurable\` + \`RegulatoryClassifiable\` over asset classes \`ir\`, \`fx\`".
  Subscription-time resolution then checks: does the tenant hold instances whose types
  implement those facets? The hardcoded event-name walk in \`resolveMtm\` (§2.7) becomes
  a facet query — adding bonds to netting sets becomes a type declaration, not an engine
  edit. This is the single largest payoff of FIL for the model library's portability.
- **W8 posture register.** The products-held dimension family is *derived by folding FIL
  instances*: \`products.<family-path> = held\` when live instances of that taxonomy
  node exist. The \`PostureRelevant\` facet declares which dimensions a type feeds, so
  the posture register and the product register cannot disagree — they are projections of
  the same instances. APPLIES_WHEN predicates (W8 §3) quantify over FIL taxonomy nodes:
  "applies when \`fil:type:ir:swap:*\` held AND approach.market-risk = SA".
- **Obligations graph.** Obligation applicability edges point at taxonomy nodes, not
  product-URN strings. Because taxonomy nodes are graph nodes (Principle 2), the chain
  obligation → taxonomy node → types → instances → posture fact is walkable — which is
  exactly the join W8's applicability assessments need.
- **NPA.** A new product = minting (platform) or configuring/composing (tenant, §6) a FIL
  type behind the NPA gate; the 14 NPA dimensions attach to the *type*, and dimension
  attestations become facet-completeness attestations (the \`Accountable\` dimension is
  attested when the facet's posting keys resolve; the market-risk dimension when
  \`RiskMeasurable\` is implemented). The dimension-key alias table (§2.9) retires.
- **GL.** Posting rules re-key from \`instrument_type\` strings to
  \`(fil:type URN | taxonomy node, lifecycle event)\` pairs — the \`Accountable\`
  facet's \`postingKeys()\`. Rules may key at any taxonomy level (a family-level rule
  covers all child types unless overridden — OO method resolution order, giving the
  spot-vs-family granularity of §2.5 a principled answer instead of a grep).

## 6. Tenant extension rules (clean-core)

The W3 tenancy architecture and W5 clean-core doctrine applied to FIL:

- **Tenants instantiate and configure.** Booking instances, setting parameters
  (calibrations, books, designations, limits) on types — always.
- **Tenants compose.** A tenant may assemble a new product from kernel types via the
  composition algebra (§3.2) behind its NPA gate — a structured note from bond + option
  components is a tenant-level act, producing a tenant-scoped *composed type*
  (\`fil:type:...:~<tenant>\` marked as composed, never shadowing a kernel slug).
- **Tenants never fork the language.** No tenant-defined facets, no new asset classes or
  families, no overriding kernel facet implementations. A tenant need the kernel cannot
  express is a *type-minting request* into the platform's governed process — the same
  shape as W8's posture-dimension minting: proposed → reviewed (does an existing
  type/composition cover it? does CDM/FIBO name it?) → minted with citations → versioned.
- **Cross-tenant:** types are shared core and upgrade with the platform (W5 doctrine —
  one re-validation, every subscriber inherits); instances are tenant-isolated in the
  tenant's store (W3). Composed types are tenant-IP and explicitly inside the W8/W7
  cross-tenant learning blocklist: the platform may learn that a *kernel* type needs
  minting from aggregate demand, never lift a tenant's composition across the boundary.

## 7. FIL-conformance recon

The gate that makes "all aspects consistently use it" mechanical rather than aspirational
— \`recon:fil-conformance\`, asserting over the tree and the store:

1. Every SLA rule's \`applies_to\` resolves to a FIL URN or taxonomy node (no free
   \`instrument_type\` strings).
2. Every returns renderer's instrument selection goes through \`Reportable\` bindings;
   every cell ref resolves against the canonical BA-form schemas (the
   \`recon:ba-form-numbering\` lesson, §2.8, generalised).
3. Every risk-engine position filter is a \`RiskMeasurable\` facet query (no hardcoded
   event-name walks).
4. Every NPA record, posture products-held fact, and obligation-applicability edge
   references taxonomy nodes.
5. Every lifecycle event family on a type names registered event types; no registered
   trade/position event type lacks an owning FIL type (orphan detection both ways).
6. **No string-typed instrument identifiers outside the FIL registry** — a lexical sweep
   for the known legacy vocabularies (§2's list is the seed allowlist).

Rollout follows the decision-distillation-coverage pattern exactly: the gate lands
**advisory** with the full §2 inventory as its initial allowlist, every migration slice
(§8) burns entries down, and the ratchet forbids new entries from day one (new code must
be conformant even while old code migrates). Flip to **enforcing** per check-class as its
allowlist empties.

## 8. Migration path

Strangler doctrine per the blueprint — v1 is the seed tenant, nothing big-bangs:

- **Stage 0 (with S-FIL-1):** mint the kernel taxonomy and register v1's existing
  vocabularies as *aliases* of FIL nodes (the \`prd:\` URNs, the family enum, the SLA
  \`instrument_type\` strings, the SA-CCR asset classes, ACTUS types). Aliases make the
  conformance gate computable before any consumer changes.
- **Fixtures-to-FIL:** the blueprint's S4 (products/CoA/RAS fixtures → events) becomes
  fixtures-to-FIL — the eight seeded products land as \`FilTypeMinted\` events rather
  than a second fixture generation. One migration, not two.
- **Staged per asset class, in v1's own maturity order:** FX spot/forward (richest event
  history, most posting rules, the §2.5 incident class to retire) → bonds → IRS → equity.
  Per asset class: re-key SLA rules, repoint the returns adapter, switch the risk-engine
  selector — each behind a **byte-equivalence parity gate** (golden-leg suites for
  postings, rendered-return diffs for reporting, computed-event diffs for risk), the same
  parity discipline the SLA cutover (PR #1094–#1098) and the blueprint's [M] slices
  already proved.
- **Wave placement (recommendation):** kernel + URN scheme + advisory conformance recon
  in **Wave 1–2** — S-FIL-1 is pure-additive and belongs with Wave 1's seam-laying;
  S-FIL-2 rides Wave 2 alongside S7 (the SA-CCR model-library pilot *should bind through
  FIL facets from the start*, so the flagship model is born conformant). Re-keying
  migrations (S-FIL-3/4) are Wave 3 work with the other [M] slices. FIL is then standing
  before tenant #2 onboards — which is the point: the first external tenant's products
  are FIL-native on day one.

## 9. Build slices (named, NOT built)

| Slice | Content | Owner (seat) | Gate |
|---|---|---|---|
| **S-FIL-1** | Kernel taxonomy + URN scheme + alias registration + \`recon:fil-conformance\` (advisory, §2 allowlist) | Atlas (Core banking platform architect, engineering) | Gate lands advisory; ratchet forbids new allowlist entries |
| **S-FIL-2** | Facet interfaces + CDM alignment (composition algebra typed; CDM regeneration mapping; FinancialInstrument-record convergence per D-FIL-KERNEL-V1 Q1) | Atlas + Kai (trading systems engineer, engineering) | Facet typecheck; CDM mapping tests; SA-CCR pilot (S7) binds via facets |
| **S-FIL-3** | GL/posting re-keying — SLA \`applies_to\` → FIL keys, per asset class FX→bond→IRS→equity | Bea (Accounting & financial reporting engineer, engineering) | Byte-equivalence golden-leg parity per asset class; conformance check #1 enforcing |
| **S-FIL-4** | Returns + risk selector migration — \`Reportable\` cell bindings; \`RiskMeasurable\` selectors replacing hardcoded walks | Bea + Rohan (risk engineer, engineering) | Rendered-return byte parity; SA-CCR/IRRBB computed-event parity; checks #2–#3 enforcing |
| **S-FIL-5** | Governance binding — NPA dimensions attach to FIL types; posture products-held folds instances; obligations APPLIES_WHEN over taxonomy nodes | Saskia (Head of Global Markets, governance) + Atlas | Check #4 enforcing; dimension-key alias table deleted |
| **S-FIL-6** | Ratchet completion — allowlist empty; \`recon:fil-conformance\` fully enforcing; Vera third-line attestation | Vera (internal audit engineer) functional to Thandiwe (CAE) | All six checks enforcing; zero allowlist |

## 10. Open questions + named decisions for the CEO

**Named decisions:**

- **D-FIL-KERNEL-V1** — approve the FIL 1.0 kernel: taxonomy levels, URN scheme,
  composition algebra, facet set, versioning rules (§3), and S-FIL-1/2 dispatch.
  Recommend approve-now (Wave 1–2 placement).
- **D-FIL-CDM-ALIGNMENT-STANCE** — ratify §4: CDM composition backbone
  (adopt/extend/diverge boundaries as drawn), FIBO naming, ISO 20022 edge-only, external
  identifiers as mappings, ACTUS retained. Recommend approve-now (it binds S-FIL-2's
  design).
- **D-FIL-CONFORMANCE-GATE** — charter \`recon:fil-conformance\` with the §2 inventory
  as seed allowlist and the advisory→enforcing ratchet. Recommend approve-now (the gate
  is what makes everything else converge).
- **D-FIL-GL-REKEYING** — approve-on-sequence (Wave 3 open): S-FIL-3/4 migrations under
  parity gates.
- **D-FIL-TENANT-COMPOSITION** — approve-on-sequence (with W3 Stage 2+): tenant composed
  types behind NPA, the §6 rules, and the cross-tenant blocklist entry.

**Open questions:**

1. **Two identity layers → one.** Does the FinancialInstrument master record
   (\`platform/markets/cdm/instrument.ts\`) converge *into* FIL as the instance-side
   event vocabulary (recommended: \`FinancialInstrumentDefined\` becomes the
   instance-registration event; \`FinancialInstrumentClassified\` becomes the
   \`RegulatoryClassifiable\` facet's event-of-record), or stay a parallel register?
   Parallel survival reproduces §2.3's split inside v2.
2. **Granularity of GL keying.** Family-level rules with type-level overrides (§5,
   recommended) or type-level only? Affects how many of the ~25 SLA rules re-key 1:1.
3. **Posture parameter shape.** Do regulatory facets take the full \`PostureSnapshot\`
   or named elections only? Full snapshot is more honest about dependencies; named
   elections give cheaper blast-radius computation when posture changes. W8's re-open
   semantics need the dependency recorded either way.
4. **Where the booking hierarchy lives.** Books/desks/designations are tenant
   configuration on instances; the designated-currency-ledger discipline
   (\`platform/accounting/designated-currency-ledger.ts\`) suggests designation may
   belong on the \`Accountable\` facet's parameters rather than free tenant config.
5. **CFI emission as conformance test.** Worth the mapping effort in 1.0, or defer to
   the first listed-instrument tenant need?

---

*Filed via RecordFiled (RMS Phase 3, D-RMS-PHASE-3). No in-tree render — the
content-addressed document store is canonical (D-RMS-PHASE-4). W9 deliverable of the
v2 structural analysis under D-V2-BBAAS-W9-FIL.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W9-FIL"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W9 Financial Instrument Language: kernel, facets, standards stance, conformance, migration",
      path: "2026-06-12_atlas_v2-bbaas-w9-fil.md",
      category: "strategy-analysis",
      author: "Atlas (Core banking platform architect, engineering)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
