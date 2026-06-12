// scripts/file-rohan-v2-bbaas-w4-model-library.ts
//
// One-shot RMS Phase 3 filing for Rohan's W4 deliverable of the WS-V2-BBAAS
// structural analysis: the model-library extraction paper — the binding
// contract every library model satisfies, an extraction-readiness survey of
// every v1 risk/regulatory engine, the pilot extraction design (SA-CCR
// recommended), and the model-risk-management tie-in. Emits a RecordFiled
// event so the Documents register holds the canonical paper. The body is
// embedded inline (Phase 4 — D-RMS-PHASE-4 — made the content-addressed
// document store the canonical home; no in-tree root render is created).
// Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Rohan (Risk engineer, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:rohan:v2-bbaas-w4-model-library:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-rohan-v2-bbaas-w4-model-library] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W4 model library: binding contracts, engine readiness, pilot design

**Author:** Rohan (Risk engineer, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12); expands §2.1 of the
session-1 ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12) and
domains 10/11/13/14 of the W2 domain map
(record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12)
**Audience:** Marc (CEO)
**Status:** W4 analysis deliverable of the WS-V2-BBAAS structural analysis. Design only —
the pilot extraction BUILD is the named follow-on decision D-W4-MODEL-LIBRARY-PILOT (§5).
All v1 module paths verified in-tree under \`prototype/\` at authoring time.

---

## 1. The model binding contract

The session-1 paper named the shared model library the single most commercially distinctive
bucket of the shared/tenant split: tenant-agnostic, citable computational models —
RWA, IRRBB, Leverage, LCR/NSFR, SA-CCR, CVA, ECL — that bind tenant data at subscription
time and carry their regulatory citation chain with them. What turns a v1 engine into a
*library model* is not a rewrite; it is conformance to a **binding contract**. This section
specifies that contract. Every clause is grounded in a pattern v1 already runs somewhere —
the contract is a generalisation exercise, not an invention.

A library model is a versioned artefact declaring eight things:

### 1.1 Consumed event types and reference data (typed)

The model declares, as part of its published artefact, the exact event types it folds and
the reference data it reads — not as documentation but as a typed manifest the platform can
verify mechanically. Two kinds of input:

- **Event inputs** — registered event types with the registry as the schema authority
  (\`platform/event-store/registry/\`, ~687 types). Example: the SA-CCR engine consumes
  \`IrsTradeBooked\`, \`FxTradeExecuted\`, \`IrdSwapPositionRevalued\`,
  \`FxPositionRevalued\` and the netting-set register
  (\`platform/markets/netting-sets/\`). The manifest names each type *and the payload
  fields the model actually reads* (SA-CCR reads \`IrdSwapPositionRevalued.npvClosingMinor\`
  — a field-level contract decision the v1 module header already attributes to Bea
  (Accounting & financial reporting engineer, engineering)). Field-level declaration is what
  lets the platform compute blast radius when an event schema evolves: every model whose
  manifest touches the changed field re-opens (the verbatimHash re-open pattern of W8 §4,
  applied to schemas instead of provision text).
- **Reference-data inputs** — projections and registers the model joins at read time:
  collateral inventory, the counterparty/party register, market-data curves, the netting-set
  register. Each named with the projection module and its provenance class (the
  market-data-provenance gate already types this for curves).

The manifest is the **subscription-time checklist**: a tenant can subscribe a model only
when every declared input resolves against that tenant's store — either natively (the
tenant runs the producing domain) or via the R-tier ingestion seam (W2 §4.2: the tenant
feeds position/trade events into the declared event contract from its own systems). A
missing input is a typed, named gap at subscription time, not a silent zero at computation
time — the no-silent-zeros discipline (D-TRUSTED-FIGURES-PROGRAM-V1 objective 4) promoted
from run time to onboarding time.

### 1.2 Implemented provisions (graph citations)

The model declares the provisions it implements as **IMPLEMENTED_BY edges in the single
graph** (Principle 2): Provision/Obligation nodes → the model's Capability node. V1 already
carries this chain for the surveyed engines — the SA-CCR modules cite BCBS d317 §10/§136/
§149 and CRE52 §52.5/§52.45–52.52 clause-by-clause; the CRE20 risk-weight switch in
\`platform/risk/rwa-engine.ts\` is cited inline per bucket; the EVE engine cites BCBS
d368 §III. The contract makes this *load-bearing for the product*: a subscriber gets, with
every number, the mechanical answer to "under what provision, of what instrument, at what
paragraph?" — the chain runs from BCBS/PA source text (Plane A, shared reference knowledge)
through the model's Capability node to the emitted event. Two consequences:

- **Citation completeness is a recon gate, not a review habit.** A library model with an
  uncited branch (a formula arm tracing to no provision) fails its packaging gate — the
  citation-gate pattern applied at the model boundary.
- **Provision drift re-opens models.** When a cited provision's text drifts
  (\`verbatimHash\` mismatch — the ProvisionScopeAdopted anchor), every model citing it
  re-opens for methodology review. This is how the library stays current with Basel/PA
  amendments *for all tenants at once* — one re-validation, every subscriber inherits it.

### 1.3 Emitted events-of-record

The model's output is an event, never a return value alone. The canonical v1 pattern is
**\`RwaComputed\`** (\`platform/risk/rwa-computed-engine.ts\`, D-RWA-ENGINE-W2-SLICE-3):
the engine folds the event-sourced exposure base and emits a queryable record of
computation; the BA 700 capital-adequacy generator consumes the event (threading
\`rwaComputationEventId\`), and \`recon:rwa-computed-sourcing\` finds any renderer that
ships a fixture while an event-of-record exists. The contract generalises the pattern:

- The emitted payload carries **input lineage** — the as-of, the source event ids or
  projection anchors consulted, and per-component source discriminators (RwaComputed's
  \`source\` discriminator and \`operationalRwaIsPlaceholder: true\` flag are the
  template: a placeholder component is *typed as a placeholder*, never fabricated).
- Downstream consumers (returns, RAS feeders, dashboards) read the event, never call the
  model in-line — so "same number on the return and the dashboard" is true by construction.
- SA-CCR already conforms (\`CcrReplacementCostComputed\` + \`CcrEadComputed\` from the
  single emitting boundary \`compute-and-emit.ts\`); so do the revaluation engines
  (\`IrdSwapPositionRevalued\` with \`dv01ByTenorBucket\`).

### 1.4 Posture and election parameters

Models are **approach-conditioned** — this is the W8 connection and the clause with the
most product consequence. The W8 paper's bank-posture register (PostureDimensionMinted +
RegulatoryElectionDeclared events; APPLIES_WHEN predicates) records which approach
elections a tenant has made: \`approach.credit-rwa = SA\`,
\`approach.market-risk = SA\`, \`approach.operational-risk = SMA\`, accounting-framework
choices, regulator-granted permissions. The binding contract requires every library model
to declare **which posture dimensions condition it, and for which values it is valid**:

- The CRE20 standardised credit-RWA model declares
  \`applicableWhen: approach.credit-rwa = SA\` — subscribing it while the tenant's posture
  says IRB is a *subscription-time contradiction*, surfaced before a single number is
  computed (the model-side mirror of W8's provision-side APPLIES_WHEN verdicts).
- Elections also condition *inside* a model: the SA-CCR replacement-cost formula branches
  on \`csaPresent\` (margined vs unmargined, Credit Risk Policy §3); the v1 VaR engine's
  header records that "the bank elects historical simulation" — in v2 that election is a
  declared posture row, not a code comment, and the model manifest names it.
- The posture rows a computation consulted land in the emitted event's lineage (§1.3), so a
  posture change (the day a tenant elects IMA) mechanically re-opens every figure computed
  under the old election — the same re-open semantics W8 gives applicability assessments.

### 1.5 Methodology vs calibration split

The sharpest line in the contract, and the one v1 has already proven twice:

- **Methodology = shared core.** The formula, the branching, the aggregation, the
  prescribed supervisory schedules that are *regulation facts* (CRE52 supervisory factors,
  CRE20 weight buckets, the d368 six shock scenarios). These ship as versioned model code,
  identical for every tenant, upgraded by the platform. Jurisdiction constants live in the
  semantic registry / financial-constants pattern
  (\`platform/config/financial-constants.ts\` — every calibration number declared once,
  with owning seat and citation; \`recon:financial-constants-coverage\` asserts no inline
  rate tables) — shared reference knowledge, not tenant choices.
- **Calibration = tenant events.** Everything a tenant chooses or a regulator grants that
  tenant: thresholds, appetite bands, PD/LGD estimates, behavioural assumptions, CSA
  threshold/MTA values, FTP curve choices. The v1 template is **\`RasLineCalibrated\`** —
  RAS thresholds are already events folded by a parity-gated register
  (\`platform/risk/ras-appetite-register.ts\`, \`recon:ras-register-parity\`): the
  calibration is auditable, versioned, attributable to the calibrating seat, and replayable.
  The contract requires every tenant-variable parameter of a library model to arrive the
  same way — a typed \`ModelCalibrationDeclared\`-class event (or the existing
  RasLineCalibrated where the parameter *is* a RAS line), never a config file, never a code
  constant.

The W2 closing observation — "machinery = core; regulation-derived calculation = library;
regulation = reference knowledge; calibration + instances = tenant events" — is this clause
restated. Where v1 deviates (LCR run-off rates as code constants rather than tenant
calibration events; CVA PFE add-on fractions as in-engine build-phase constants), §2 grades
the deviation as extraction work.

### 1.6 Versioning and validation/exam-set hooks

The model registry (\`platform/model-registry/registry.ts\`) already holds the versioning
primitive: \`submit\` is **idempotent on \`methodologyHash\`** for a given modelId — a
methodology change is a new hash, a new submission, a new validation cycle. The contract
adopts this wholesale:

- A library model version = (modelId, methodologyHash, manifest hash). Tenants subscribe a
  *version*; platform upgrades are explicit version migrations with both versions' events
  distinguishable in the log.
- Validation lifecycle events (\`ModelSubmitted\`, \`ModelTierClassified\`,
  \`ModelValidationApproved/Withheld\`, \`ValidationFindingRaised/Closed\`) attach per
  version. \`approveValidation\` against open blocking findings throws — the independence
  invariant is enforced in code today and carries over unchanged.
- **Exam sets** (per W8 §4's labeling-factory observation): every seat correction of a
  model output, every validation finding, and every golden-leg parity case accumulates as a
  stored labeled example attached to the model version. A version ships with its exam set;
  a candidate version must pass the incumbent's exam set before promotion. V1's
  interpreter golden-leg suites (114 tests migrated in the SLA cutover) are the
  proof-of-pattern.

### 1.7 Tenant binding semantics at subscription

Subscription is an event sequence, not a deployment:

1. \`ModelSubscribed\` { tenantId, modelId, version } — recorded in the platform
   control-plane store (W3 Option C).
2. **Input resolution** — every manifest input (§1.1) resolves against the tenant store;
   unresolved inputs become typed onboarding work items (the W8 §2.5 missing-fact queue
   shape, applied to data feeds).
3. **Posture check** (§1.4) — declared applicability predicates evaluate against the
   tenant's posture register; contradictions block, conditional dimensions with no value
   enqueue.
4. **Calibration binding** (§1.5) — required tenant parameters either exist as calibration
   events or are defaulted-with-citation (a prescribed regulatory default is a legitimate
   basis; a made-up default is not) — every default visibly typed as such.
5. **Activation** — the tenant composition factory (W3) wires the model's scheduled
   handler + staleness watchdog into the tenant runtime. The SA-CCR EOD handler
   (\`runtime/agents/rohan-sa-ccr-eod.ts\`) + its per-netting-set
   expected-event-watchdog entries (maxAgeBusinessDays 1) are exactly this shape in v1: the
   cadence and the "is it stale?" alarm ship *with* the model.
6. **Parity gate** — for migrating tenants (numbers previously computed elsewhere), a recon
   pipeline asserts the library model reproduces the incumbent figures within tolerance
   before the library becomes the source of record (§3.4).

## 2. Extraction-readiness survey of the v1 engines

Grades: **A** — conforms to most of §1 already; extraction is packaging. **B** — sound
core with localised couplings; days-scale work. **C** — methodology entangled with
tenant/jurisdiction specifics or with another domain's module; needs a seam first.
**D** — placeholder or blocked; no extractable methodology yet.

| # | Engine | Module path(s) | Grade |
|---|---|---|---|
| 1 | SA-CCR (RC + PFE + EAD) | \`platform/risk/sa-ccr/\` | A− |
| 2 | Credit RWA (CRE20 SA) | \`platform/risk/rwa-engine.ts\`, \`rwa-computed-engine.ts\`, \`platform/projections/rwa-from-positions.ts\` | B |
| 3 | LCR | \`platform/liquidity/lcr.ts\` (+ \`projection.ts\`) | B+ |
| 4 | NSFR | \`platform/liquidity/nsfr.ts\` (+ \`projection.ts\`) | B+ |
| 5 | IRRBB EVE / NII / repricing gap | \`platform/alm/eve.ts\`, \`nii.ts\`, \`repricing-gap.ts\` | B |
| 6 | ECL / IFRS 9 staging | \`platform/accounting/ecl-engine.ts\`, \`ifrs9-staging.ts\` | B |
| 7 | VaR / SVaR / ES | \`platform/market-risk/var-engine.ts\` | B |
| 8 | CVA | \`platform/market-risk/cva-engine.ts\` | C |
| 9 | Market RWA (BA 320 × 12.5) | \`platform/risk/rwa-computed-engine.ts\` ← \`platform/returns/ba320\` | C |
| 10 | Leverage ratio | \`platform/projections/leverage-ratio-metrics.ts\`, \`capital-metrics.ts\` | C |
| 11 | Bond / IRS / FX revaluation | \`platform/markets/eod/\` (\`bond-revaluation.ts\`, \`irs-revaluation.ts\`, fx pair) | A (but core, not library — see note) |
| 12 | Operational RWA | placeholder inside \`rwa-computed-engine.ts\` | D |

### 2.1 SA-CCR — A−

The cleanest conformer. The module is already factored as **pure computation + single
emitting boundary**: \`ead.ts\`, \`pfe-addon.ts\`, \`replacement-cost.ts\`,
\`types.ts\` are side-effect-free; \`compute-and-emit.ts\` is the only module that
touches the store, resolving MTM from \`IrdSwapPositionRevalued\` /
\`FxPositionRevalued\` events and collateral from the inventory projection, and emitting
\`CcrReplacementCostComputed\` + \`CcrEadComputed\`. Citations are §-level (BCBS d317
§10/§136/§149, CRE52 §52.5/§52.45–52.52, Credit Risk Policy §3 with line numbers). It is
the most recently event-wired engine: the daily EOD handler + per-netting-set staleness
watchdog landed 2026-06-12 (gap \`fx-sa-ccr-daily-cadence\` closed), so cadence + alarm
already ship with the model (§1.7 step 5). Remaining work to A:

- \`compute-and-emit.ts\` imports the **composition eventStore singleton** directly
  (\`import { eventStore } from "../../composition"\`) — must take the store as a
  parameter (the W3 tenant-composition seam). Mechanical.
- **Entity literal**: emitted envelopes hardcode \`entity: String(BANK_ZA_001)\`
  (\`platform/core/types\`) — the exact anti-pattern the ideas paper's §8 flags; entity
  (and v2's tenant axis) must thread from the caller.
- Collateral is resolved from a **bank-level pool**, not per-netting-set CSA allocation
  (the module's own header tracks this as D-CSA-COLLATERAL-ALLOCATION, future). Honest,
  documented, conservative — but the manifest must declare the approximation.
- Posture clause: \`csaPresent\` branch + the SA-CCR-vs-IMM election need declaring per
  §1.4 (trivial — the inputs already exist as typed fields).

### 2.2 Credit RWA (CRE20) — B

Three-layer composition: the pure CRE20 weight switch (\`rwa-engine.ts\` — exhaustively
cited inline, fails loudly via RwaEngineError rather than defaulting), the event engine
(\`rwa-computed-engine.ts\` — emits RwaComputed, the §1.3 canonical), and the positions
bridge (\`rwa-from-positions.ts\`). Event-driven throughout; counterparty classes arrive
as \`CounterpartyBaselClassAssigned\` events (tenant data, correctly). Couplings to clear:

- The trade→exposure mapping **hardcodes SA market heuristics**: ISIN prefix "ZAG" →
  sovereign-domestic-currency, else corporate-ig. That is tenant/jurisdiction reference
  data masquerading as methodology — it must move to a classification rule the tenant
  configures (or a shared SA reference pack the tenant adopts).
- The market-RWA component is *taken whole from the BA 320 return* (see #9) — the credit
  model is clean, but RwaComputed-the-aggregate inherits #9's coupling.
- Posture clause needed: \`approach.credit-rwa = SA\`.

### 2.3 / 2.4 LCR and NSFR — B+

Pure functions with the **best methodology/calibration hygiene in v1**: zero inline rate
tables — run-off rates, haircuts, caps, ASF/RSF weights, minima and tolerances all live in
\`platform/config/financial-constants.ts\` with owning seat (CFO) and citation, gated by
\`recon:financial-constants-coverage\`. The engines read the registry; the projection layer
(\`projection.ts\`) folds event-store inputs across five horizons. Work to A:

- The constants registry is **code, not events**: per §1.5, jurisdiction facts (Basel/BA
  haircut floors) stay shared reference knowledge, but anything a tenant may calibrate
  differently (behavioural splits of stable vs less-stable retail, operational-deposit
  designations) must become calibration events. The registry needs splitting along exactly
  that line — a useful forcing exercise, since today it conflates the two.
- \`projection.ts\` defaults to the composition store singleton (injectable already —
  tests pass isolated stores — so the seam exists; the default just flips).
- The known **LCR consolidation gap** (GAP-LCR-CONSOLIDATION-ENGINE, open): v1 computes
  solo-entity LCR; the Principle-5 multi-entity consolidation engine is unbuilt. For the
  library this is a declared scope limit, not a blocker — but it bounds what the model can
  promise an R-tier subscriber with a group structure.

### 2.5 IRRBB EVE / NII — B

The d368 six-scenario ΔEVE engine is methodologically clean, **already model-registry
bound** (calcKey \`irrbb-eve\`, model:irrbb-eve-engine-v1, CRO-owned, consuming
model:irrbb-repricing-v1) — the §1.6 hooks exist for it today — and no-silent-zeros
conformant (\`status: "zero-positions"\` is a loud, reasoned absence). Work: the
behavioural/repricing assumptions feeding it are exactly the calibration class §1.5 sends
to tenant events (they are model inputs owned by Eitan (Treasurer, governance) today, not
yet event-declared); shock sizes are Basel-prescribed (shared constants) but SARB-specific
overlays must be flagged as jurisdiction pack content; posture clause for the SA IRRBB
standardised framework election.

### 2.6 ECL / IFRS 9 — B

Well-decomposed in the registry already — **five registered model ids** (staging, PD, LGD,
EAD-read, aggregation, plus a registered no-op macro overlay), which is precisely the §1.6
granularity the library wants. Staging (\`ifrs9-staging.ts\`) is pure with cited
thresholds (D-IFRS9-STAGING-V1, D-IFRS-THRESHOLDS-V13). Work: PD/LGD values are
build-phase placeholders held in code — these are the *most* tenant-specific numbers in the
whole survey (every bank's PD/LGD is its own) and must be calibration events with seat
attribution; Stage-2/3 lifetime ECL is licence-day scope (declared scope limit); posture
clause for the accounting-framework dimension (IFRS 9 vs local GAAP — a real dimension for
non-SA tenants).

### 2.7 VaR / SVaR / ES — B

Deliberately **risk-factor-agnostic** (consumes a position vector + per-factor return
matrix — "adding a factor is data, not code"), which is the right shape for a library
model. The methodology election (historical simulation, 99%/1-day, 250-day window;
ES 97.5% per FRTB MAR33) is documented in the header — in v2 it is a declared posture row
+ manifest parameters. Work: history-sufficiency gating is sound but the return-history
feed is build-phase (FX desk only); SVaR's stress-window identification is an explicit
open item; the engine's outputs feed RAS lines, so the emitted event must carry the §1.3
lineage (today it flows through the calc-binding/CalculationPerformed machinery — close,
but the event-of-record discriminators need the §1.3 shape).

### 2.8 CVA — C

Honest but interim: a standardised accounting-CVA formula (LGD × EAD × PD × discount,
no-hedge no-correlation sum) that the module header itself positions as the build-phase
analogue of BA-CVA (MAR50). The PFE add-ons are **in-engine constants**
(IRS_PFE_ADDON_FRACTION, FX_PFE_ADDON_FRACTION) — flagged build-phase, but they are
methodology-shaped numbers a regulator will examine; under §1.5 they must either trace to
a prescribed schedule (then: shared constants with citation) or be tenant calibration. The
EAD construction partially duplicates SA-CCR's job with a simpler add-on — the natural v2
move is CVA consuming SA-CCR's \`CcrEadComputed\` events-of-record instead of computing
its own exposure (one EAD, two consumers), which is a re-plumb, not a rewrite. Grade C
because extraction *as-is* would ship a model the library's own MRM story (§4) would
flag; the BA-CVA upgrade and the EAD convergence should precede or accompany extraction.

### 2.9 Market RWA — C

The aggregate RwaComputed takes market RWA as **BA 320 return output × 12.5 passthrough**
— correct for the anchor tenant (it avoids double-counting the Reg 28(3) disallowance
algebra, deliberately), but it means the market-risk *methodology* lives inside an
SA-jurisdiction return renderer (\`platform/returns/ba320\` + reporting adapters), not in
a jurisdiction-neutral model. Extraction requires inverting the dependency: a
market-risk-capital model (standardised approach building blocks) that the BA 320 renderer
*consumes*, rather than a return the RWA engine reads. That inversion is the largest
single piece of survey work and touches Mira's reporting scope — sequenced after the
pilot, not before.

### 2.10 Leverage ratio — C

The ratio arithmetic is trivial; the coupling is not: build-phase fallback hardcodes the
anchor tenant's ICAAP v1 Tier-1 envelope (R300m) and the exposure-measure components are
forward-compatible shapes awaiting live reads (the module header says so honestly).
Tier-1 capital must arrive as an event-of-record input (capital-metrics is mid-migration
to live reads), the fallback must become a typed placeholder per §1.3, and the SA-CCR EAD
component should consume \`CcrEadComputed\` (the wiring intent already names
SaCcrEadComputed). Extractable once capital-metrics' live-mode lands.

### 2.11 Revaluation engines — A, but core-not-library

\`bond-revaluation.ts\` / \`irs-revaluation.ts\` (and the FX pair) are deterministic
event-in/event-out, idempotent by (tradeId, revalDate), emit the converged accounting
family (\`IrdSwapPositionRevalued\` with \`dv01ByTenorBucket\` —
D-IRS-FAMILY-CONVERGE-ACCOUNTING), and document their gaps (GAP-BOND-1..3). They satisfy
the contract almost incidentally. W2 classifies Position Keeping as **foundational core**,
not model library — every tenant runs revaluation identically; there is no approach
election on "what is the NPV of this swap". Recommendation: keep them core, but make them
the *reference implementations* of §1.1/§1.3 manifest discipline, since library models
consume their outputs.

### 2.12 Operational RWA — D

An explicit, typed placeholder (\`operationalRwaIsPlaceholder: true\`) — zero until
audited gross income exists (licence-day). The honest course: ship the **SMA methodology**
(BI buckets, marginal coefficients — all prescribed constants, ideal §1.5 shared-core
content) as a library model with a declared activation precondition on the income feed.
The methodology is extractable from the standard *now*; the v1 engine to extract from does
not exist. No pilot candidate.

## 3. Pilot extraction design — SA-CCR

### 3.1 The pick, argued

**SA-CCR over LCR.** Both are credible; the decision criteria are what the pilot must
*prove*, not which model is most valuable (that is the whole library's job):

- **The pilot must exercise every clause of §1 at least once, in the smallest volume.**
  SA-CCR does: typed multi-family event inputs + two reference registers (§1.1); §-level
  BCBS citations to carry into IMPLEMENTED_BY edges (§1.2); two events-of-record already
  emitted from a single boundary (§1.3); a genuine posture/election surface (CSA branch,
  SA-CCR-vs-IMM) (§1.4); a clean methodology/calibration split (supervisory factors =
  prescribed schedule; CSA threshold/MTA/collateral = tenant facts) (§1.5); and a live
  scheduled cadence + staleness watchdog to rehome under tenant composition (§1.7).
- **SA-CCR's defects are the *interesting* ones.** Its two real couplings — composition
  singleton import and the \`BANK_ZA_001\` entity literal — are precisely the seams the
  binding contract exists to cut. Fixing them in the pilot produces the reusable recipe
  ("how to de-singleton an engine") every B-grade engine then follows. LCR's remaining work
  (splitting the constants registry into jurisdiction-pack vs tenant-calibration) is
  valuable but idiosyncratic to the constants pattern.
- **LCR's distinctive test — consolidation — cannot actually run.** The argument for LCR
  is that it exercises Principle-5 multi-entity consolidation; but the consolidation engine
  is an open gap (GAP-LCR-CONSOLIDATION-ENGINE), so the pilot would either build it
  (scope explosion: that is a risk-engine build, not an extraction) or not exercise it
  (forfeiting the argument). SA-CCR is whole today.
- **Recency and ownership.** SA-CCR was event-wired with daily cadence and watchdog this
  week; the module knowledge is fresh, the seat doing the pilot (Risk Engineer) owns it
  end-to-end, and the netting-set register dependency (Imani's slice) is stable.

LCR becomes the **designated second extraction**: it validates the contract against the
constants-registry pattern and the R-tier ingestion seam (deposit/funding positions fed
from a subscriber's own systems), and by then the consolidation-engine decision can be
taken on its own merits.

### 3.2 Target module boundary

\`\`\`
models/sa-ccr/                      ← extracted library model (new home)
  manifest.ts                       ← §1.1/§1.4 typed manifest (inputs, posture,
                                      calibration params, emitted types, citations)
  methodology/                      ← ead.ts, pfe-addon.ts, replacement-cost.ts,
                                      types.ts — moved verbatim (pure already)
  binding.ts                        ← compute-and-emit, refactored: (store, entity/
                                      tenant axis, resolvers) injected — no
                                      composition import, no BANK_ZA_001
  cadence.ts                        ← EOD handler shape + watchdog expectations,
                                      declared (not registered — the tenant
                                      composition factory registers them)
  exam/                             ← golden cases: current test suites + the
                                      replayed anchor-tenant history (§3.4)
\`\`\`

The v1 call sites (\`runtime/agents/rohan-sa-ccr-eod.ts\`, the one-shot script, CVA once
re-plumbed) consume the extracted model through \`binding.ts\` with the anchor tenant's
store/entity injected — the anchor tenant becomes, literally, the first subscriber
(ideas-paper §6's anchor-tenant firewall made concrete: the bank consumes the library
through the same contract any tenant would).

### 3.3 Contract artifacts produced

1. The **manifest type** (\`ModelManifest\`) — first concrete instance of the §1 schema;
   becomes the library-wide type.
2. **Graph nodes/edges**: a Model/Capability node for sa-ccr-v1 with IMPLEMENTED_BY edges
   from the cited CRE52/d317 provisions (Plane A nodes exist); APPLIES_WHEN-style posture
   predicates per W8 §3.2.
3. **Calibration event family**: \`ModelCalibrationDeclared\` (or reuse-with-extension of
   the RasLineCalibrated shape) carrying (modelId, version, parameter, value, seat,
   citation) — CSA threshold/MTA per netting set are the pilot parameters.
4. **Registry submission**: sa-ccr-v1 submitted with methodologyHash; Nadia
   (Model validator, engineering) runs the validation lifecycle against it (§4).
5. **Recon gates**: \`recon:model-manifest-coverage\` (every input/citation/posture
   declaration resolves) and the parity gate below.

### 3.4 What proves success

- **Same numbers.** \`recon:sa-ccr-extraction-parity\` replays the anchor tenant's full
  history through the extracted model and asserts byte-equal \`CcrEadComputed\` /
  \`CcrReplacementCostComputed\` payloads against the events the v1 engine actually
  emitted (the log is the oracle — Principle 1 makes the pilot's acceptance test free).
  Same pattern as the RAS register byte-identical parity gate.
- **No singleton, no literal.** \`tsc\` + a static gate prove \`models/sa-ccr\` imports
  neither \`composition\` nor \`BANK_ZA_001\` (the posting-engine-single-subscriber
  static-scan pattern reused).
- **Existing suites green** — the sa-ccr tests and the EOD-handler idempotency test run
  against the extracted model unchanged.
- **A second-store rehearsal**: the model bound against a scratch tenant store (tmpdir
  \`BANK_EVENT_DB\` — the W8 counterfactual-drill mechanism) with synthetic netting sets,
  proving the binding carries no anchor-tenant residue.

### 3.5 Estimated scope

Agent-cadence estimate: **one to two dispatched runs** for the extraction + parity gate
(the modules are pure; the refactor is parameter-threading), **one run** for manifest type
+ graph edges + calibration event family (new, but small and patterned on existing event
families — registry registration per F-032 discipline), **one validation run** (Nadia)
against the §4 lifecycle. The deliberately-deferred remainder — CSA collateral allocation
(D-CSA-COLLATERAL-ALLOCATION), CVA re-plumb onto CcrEadComputed — are named follow-ons,
not pilot scope.

## 4. Model risk management tie-in

The library is not just compatible with model-risk-management expectations (SR 11-7-class
supervisory guidance; the PA's model-governance expectations under the Banks Act
regulations; RISK-MRP-01, the bank's own Model Risk Policy) — it is a *better* MRM story
than any subscriber bank currently has, and that is a selling point worth leading with:

- **Independent validation is structural.** The registry's Rohan/Nadia segregation
  (builder submits; validator classifies tier, approves, withholds, raises findings) is
  recorded in event actor envelopes and enforced by invariant (approval with open blocking
  findings throws). A subscriber inherits a validation function with mechanical
  independence — most banks attest to this organisationally; the library proves it from
  the log.
- **Every model version carries its evidence.** Submission (methodologyHash), tier
  classification, validation outcome, open/closed findings, the exam set it passed, the
  provisions it implements, and every calibration applied to it — all typed events, all
  replayable. "Show me the validation status of the model that produced this number, as of
  the date it produced it" is a query, not an archaeology project.
- **Exam sets compound across tenants** (W8's labeling factory, model-flavoured): seat
  corrections and validation findings against the *shared* methodology accrue to the
  shared exam set — within the W8 §6 learning boundary (methodology learnings generalise;
  tenant data never crosses). Tenant B's model arrives pre-hardened by tenant A's
  validation history. No single bank can build this asset alone.
- **Change governance per version.** A methodology change is a new version, a new
  validation cycle, an explicit per-tenant migration decision — the SAP clean-core
  translation applied to quant models: tenants never patch a model; they calibrate it
  (events) or adopt the next validated version. Provision-drift re-opens (§1.2) and
  posture re-opens (§1.4) give the regulator the answer to "how do you know your models
  track the rules?" mechanically.
- **The validation gap is honest:** Nadia (Model validator, engineering) is one seat; a
  multi-tenant library needs the validator function scaled and — for some subscribers —
  externally examinable. Validation-as-a-service (the validator seat + exam-set evidence
  pack offered to subscriber model-risk functions) is a W6 commercial question flagged
  there.

## 5. Open questions and named decisions

**Open questions for the analysis to carry:**

1. **Where does the manifest live** — graph nodes only, or a typed artefact in the model
   package mirrored to the graph? (Recommendation embedded above: typed artefact, graph
   render — same dual as events/registers.)
2. **Calibration event granularity** — one \`ModelCalibrationDeclared\` family for all
   models vs per-model families. (Lean: one family + zod-validated per-parameter schemas,
   the posture-register shape.)
3. **Jurisdiction packs** — SA-specific constants (BA haircut overlays, Reg 28
   disallowances) need a packaging unit between "shared core" and "tenant": one pack per
   jurisdiction, adopted by tenants in that jurisdiction. Who owns pack content — the
   Regulatory Knowledge Engineer seat or the Risk Engineer seat? (Both, with the W2 §6.8
   plane split: text and obligations = knowledge; executable constants = risk.)
4. **The market-RWA inversion (§2.9)** — sequencing and ownership across the Risk
   Engineer / Regulatory Reporting Engineer seam; it is the prerequisite for a
   jurisdiction-neutral capital-adequacy aggregate.
5. **CVA convergence (§2.8)** — BA-CVA upgrade before, with, or after extraction.
6. **Validator scaling (§4)** — seat capacity and external-examinability for a
   multi-tenant validation function.

**Named decisions teed up for the CEO:**

- **D-W4-MODEL-LIBRARY-PILOT** — approve the SA-CCR pilot extraction per §3 (boundary,
  artifacts, parity gates, scope). The build dispatches only on this decision.
- **D-MODEL-BINDING-CONTRACT-V1** — adopt §1 as the library-wide contract schema
  (manifest type, calibration event family, subscription semantics), so post-pilot
  extractions conform to a ratified standard rather than the pilot's precedent.
- **D-CSA-COLLATERAL-ALLOCATION** — already named in v1 (sa-ccr module header); becomes
  the first post-pilot model-improvement decision routed through the new change-governance
  path (§4), which is itself a useful rehearsal.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W4 deliverable of the
v2 structural analysis under D-V2-BBAAS-W4-W7-DISPATCH.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W4-W7-DISPATCH"],
    actor: {
      type: "service",
      id: "agent:rohan:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 BBaaS — W4 model library: binding contracts, engine readiness, pilot design",
      path: "2026-06-12_rohan_v2-bbaas-w4-model-library.md",
      category: "strategy-analysis",
      author: "Rohan (Risk engineer, engineering)",
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
