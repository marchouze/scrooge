// scripts/file-atlas-fil-framework-unification.ts
//
// One-shot RMS Phase 3 filing for Atlas's consolidation spec merging the W4
// model-library paper and the W9 Financial Instrument Language paper into
// one FIL Framework: facets as interfaces, models as their versioned,
// citable implementations; one boundary spec, one registry, one conformance
// family, two accountability planes. Emits a RecordFiled event so the
// Documents register holds the canonical paper. The body is embedded inline
// (Phase 4 — D-RMS-PHASE-4 — made the content-addressed document store the
// canonical home; no in-tree root render is created). Idempotent — skips if
// already filed.
//
// Authority: D-FIL-FRAMEWORK-UNIFICATION (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:fil-framework-unification:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-fil-framework-unification] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# FIL Framework unification: W4 model library + W9 instrument language as one framework

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat,
covering Risk Engineer scope (Rohan, risk engineer, engineering)
**Date:** 2026-06-12
**Authority:** D-FIL-FRAMEWORK-UNIFICATION (CEO-approved 2026-06-12); consolidates the W4
model library (record:documents:rohan:v2-bbaas-w4-model-library:2026-06-12) and the W9
Financial Instrument Language (record:documents:atlas:v2-bbaas-w9-fil:2026-06-12) under the
revised repo verdict (record:documents:atlas:v2-repo-strategy-reexamination:2026-06-12) and
the 4-wave blueprint (record:documents:atlas:v2-bbaas-blueprint:2026-06-12)
**Audience:** Marc (CEO)
**Status:** Consolidation spec. Nothing here builds; §5 updates the slice map, §6 names the
merged decision D-FIL-FRAMEWORK-V1 for CEO approval. This paper recommends, does not approve.
**CEO rationale taken as given (2026-06-12):** the W4/W9 split was chronological, not
architectural — a facet is an interface, a model is a registered implementation of it; W4's
binding contract and W9's facet interfaces are two specifications of the same boundary and
will drift if kept separate.

---

## 1. One boundary, one spec

W4 and W9 were authored ten lines apart in the same workstream and already describe each
other. W4 §1.1 says a model declares the instrument data it consumes; W9 §5 says that
manifest "is rewritten as facet requirements over taxonomy nodes". W9 §3.4 defines
\`RiskMeasurable\` with a \`positionContribution(engine)\` method whose only caller is a
W4-style model; W4 §3.2's pilot boundary names a \`manifest.ts\` whose contents are, item
for item, the inputs a facet query would resolve. Each paper is the other's missing half:
W9 defines the **nouns** (taxonomy, composition, lifecycle, facet interfaces) and W4
defines the **verbs** (versioned computations over instruments). Kept as two specs they
must be reconciled by a mapping — and an un-typed mapping between two living specifications
is precisely the divergence class W9 §2 measured in v1: ten instrument vocabularies, the
same trade described seven ways, every pair connected by convention. We would be minting
vocabulary #11 and #12 on day one of v2.

The drift argument, made precise. The following concepts exist **in both papers today,
under different names**, with no machinery forcing them to stay the same concept:

1. **Inputs.** W4 §1.1 "consumed event types and reference data (typed manifest)" vs
   W9 §5 "facet requirements over taxonomy nodes" — the same declaration, one keyed by
   event-type strings, one by facet + taxonomy scope. W9 even names the collision: the
   hardcoded event walk in \`resolveMtm\` is W4's manifest content and W9's facet query.
2. **Citations.** W4 §1.2 "implemented provisions as IMPLEMENTED_BY edges" vs W9's
   \`RegulatoryClassifiable\` facet carrying citation-bearing classification answers — both
   claim the provision→computation edge; left separate, a provision-drift re-open
   (verbatimHash mismatch) would have two non-identical blast radii.
3. **Posture.** W4 §1.4 "posture and election parameters" (\`applicableWhen\`
   predicates, election-conditioned branches) vs W9's \`PostureRelevant\` facet and the
   \`PostureSnapshot\` parameter on every regulatory facet method — two encodings of
   "which W8 posture rows condition this answer".
4. **Outputs.** W4 §1.3 "emitted events-of-record with input lineage" vs W9 §3.4 "facets
   emit events-of-record rather than returning bare values" (\`value()\` →
   \`*Revalued\`; classification → \`FinancialInstrumentClassified\`).
5. **Versioning.** W4 §1.6 (modelId, methodologyHash, manifest hash) in the model
   registry vs FIL's \`@major.minor\` URN versioning with additive-rules semantics —
   two version lattices for artefacts that must upgrade together (a facet interface bump
   re-opens every implementation; nothing in two separate schemes says so).
6. **Validation evidence.** W4 §1.6 "exam-set hooks" (golden cases attached per model
   version, candidate must pass the incumbent's set) vs W8's exam sets referenced by W9's
   conformance story — one labeling factory, two attachment points.
7. **Subscription.** W4 §1.7's six-step tenant binding sequence vs W9 §5's
   subscription-time facet resolution ("does the tenant hold instances whose types
   implement those facets?") — the same onboarding gate, specified twice.
8. **Conformance.** W4 §3.3 \`recon:model-manifest-coverage\` vs W9 §7
   \`recon:fil-conformance\` — two recon families asserting overlapping invariants over
   the same boundary; two allowlists; two ratchets.
9. **Scope vocabulary.** W4's per-engine asset-class enums (graded as a v1 defect in
   W4 §2.7!) vs FIL taxonomy URN patterns — W4's own survey says the model's instrument
   scope should be FIL's taxonomy, then §1 declares it in manifest-local terms.
10. **The declaration artefact itself.** W4's \`ModelManifest\` type vs W9's facet
    interface declarations on a FIL type — both are "the typed statement of what this
    boundary admits", and a tenant would have to read both to know one fact.

Ten duplicated concepts across two papers that are each one week old. That is not a risk
of drift; it is drift already begun, caught before it reached code. The consolidation:
**one FIL Framework** = FIL-Core (taxonomy, composition, lifecycle — W9 §3.1–3.3 unchanged)
+ FIL-Facets (the interfaces — W9 §3.4 unchanged) + **FIL-Models** (the W4 library
re-stated as versioned, citable *implementations* of facets) + one conformance family + one
versioning scheme. W9's language design and standards stance survive verbatim; W4's
engine survey, pilot design, and MRM analysis survive verbatim; what merges is the
*contract layer* both papers specified — and it merges into the facet-implementation
contract of §2.

## 2. The FIL facet-implementation contract

A **FIL-Model** is a registered implementation of one or more facets over a taxonomy scope.
The W4 §1 binding contract survives in full — every clause maps onto a FIL Framework
concept, and after the mapping no concept exists twice. A model declares five things:

> **implements** <facet(s)> over <taxonomy scope: \`fil:type\` URN patterns>;
> **requires** <other facets + reference data + posture dimensions>;
> **emits** <events-of-record>;
> **cites** <provisions>;
> with **methodology** in core (versioned with the framework) and **calibration** as
> tenant events.

The SA-CCR declaration, concretely: *implements* \`RiskMeasurable\` over
\`fil:type:ir:*\` and \`fil:type:fx:*\`; *requires* \`Lifecycled\` + \`Valuable\`
events-of-record from those types, the netting-set and collateral registers, and posture
dimensions \`approach.counterparty-credit = SA-CCR\` + per-netting-set \`csaPresent\`;
*emits* \`CcrReplacementCostComputed\` + \`CcrEadComputed\`; *cites* BCBS d317
§10/§136/§149 and CRE52 §52.5/§52.45–52.52; supervisory factors are methodology, CSA
threshold/MTA are calibration events.

Field-by-field mapping (W4 §1 → FIL Framework concept → surviving form):

| W4 contract field | FIL Framework concept | Surviving form |
|---|---|---|
| §1.1 consumed event types (typed manifest, field-level) | **requires**: facets over taxonomy scope | Facet queries; raw event names appear only in FIL types' lifecycle declarations (§3.3 W9), never in model manifests. Schema blast-radius = facet-method blast-radius |
| §1.1 reference-data inputs | **requires**: named registers, provenance-typed | Unchanged in content; declared in the same requires clause, not a separate manifest section |
| §1.2 implemented provisions (IMPLEMENTED_BY edges) | **cites** | Unchanged mechanics; the edge target is the FIL-Model registry node (one node kind, not Model-vs-Capability ambiguity). Provision drift re-opens implementations via the registry |
| §1.3 emitted events-of-record + lineage | **emits**; facet methods emit | One rule: a facet answer that is load-bearing is an event-of-record (W9 §3.4); models are simply the facet implementations that follow it. Lineage discriminators per RwaComputed template |
| §1.4 posture/election parameters (applicableWhen) | **requires**: posture dimensions; \`PostureSnapshot\` facet params | One encoding: the implementation's applicability predicate quantifies over W8 posture rows; the facet signature already threads the snapshot. Subscription contradiction check = predicate evaluation |
| §1.5 methodology vs calibration split | framework versioning vs tenant events | Unchanged: methodology versions with the model (core); \`ModelCalibrationDeclared\`-class events survive as specified, now keyed by the implementation's registry key |
| §1.6 versioning (modelId, methodologyHash) | FIL \`@major.minor\` + methodologyHash | One lattice: implementation version = (facet, taxonomy scope, \`@maj.min\`), methodologyHash retained as the idempotency/integrity anchor inside it. A facet interface bump is a framework version event that re-opens implementations |
| §1.6 validation + exam-set hooks | W8 exam sets attached to registry entries | One attachment point: the FIL-Models registry row. Validation lifecycle (ModelSubmitted … ValidationApproved/Withheld) carries over unchanged, per version |
| §1.7 subscription semantics (6 steps) | tenant subscription binding in the FIL-Models registry | One sequence (§3): facet/scope resolution replaces step-2 input resolution; posture predicate evaluation replaces step 3; the rest carries over verbatim |
| §3.3 recon:model-manifest-coverage | \`recon:fil-conformance\` check #7 | One recon family (§3); the manifest-coverage assertions become the implementation-resolution check |
| ModelManifest type | the facet-implementation declaration | One artefact: the registry row IS the manifest; no second declaration document exists to drift |

Nothing in W4 §1 is dropped; nothing survives twice. The W4 §2 readiness survey re-reads
cleanly under the merged contract — every grade and coupling stands, with "declare the
manifest" now reading "declare the facet implementation".

## 3. The FIL-Models registry

The registry is a **projection-derived register of model implementations keyed by
(facet, taxonomy scope, version)** — the eighth-register pattern applied to the model
library. Shape:

- **Rows are folded from events** (Principle 1): \`ModelImplementationDeclared\`-class
  events (the existing \`ModelSubmitted\` family extended with the implements/requires/
  emits/cites clauses of §2) plus the validation lifecycle events the v1 model registry
  (\`platform/model-registry/registry.ts\`) already emits. The register is a query;
  the events are canonical.
- **Key**: (facet, taxonomy scope, version). One facet may have many implementations over
  disjoint scopes (an \`ir\`-scoped and an \`equity\`-scoped \`RiskMeasurable\`
  implementation coexist); overlapping scopes for the same facet at the same posture are a
  registry conflict, surfaced at declaration time — the OO rule that a class has one
  implementation of each interface method, enforced at the register.
- **Each row carries**: the full §2 declaration, methodologyHash, validation status,
  open/closed findings, the exam set, and the IMPLEMENTED_BY provision edges — W4 §4's
  "every model version carries its evidence", now with exactly one home.
- **Tenant binding**: \`ModelSubscribed\` { tenantId, registryKey } in the control-plane
  store (W3 Option C), followed by the §2-mapped sequence — facet/scope resolution against
  the tenant's held FIL types, posture predicate evaluation, calibration binding,
  activation via the tenant composition factory, parity gate for migrating tenants. A
  tenant subscribes an *implementation row*, never a code path.
- **Conformance is one family.** The planned \`recon:fil-conformance\` extends with the
  implementation-resolution check: **every facet consumer resolves to a registered
  implementation** — no engine computes a facet answer outside the registry, no
  subscription binds an unregistered or validation-withheld row, no registered
  implementation lacks resolvable requires/cites clauses (absorbing
  \`recon:model-manifest-coverage\` whole). One allowlist, one advisory→enforcing
  ratchet, one gate to keep green — not two families asserting overlapping invariants
  from different vocabularies.

## 4. Governance carve-out — one framework, two accountability planes

Unifying the spec does **not** unify accountability. The framework is one artefact; the
planes over it are two, and the split mirrors the bank's standing engineering-vs-governance
distinction (CLAUDE.md "Team structure": engineering builds coded controls; governance
holds named accountability and oversees the engineers' outputs):

- **Language design + registry substrate — Substrate Architect seat** (Atlas, core banking
  platform architect, engineering). Owns FIL-Core, FIL-Facets, the URN scheme, the
  framework version lattice, the registry projection and its conformance gates. This is
  platform engineering: the seat that owns the event store owns the language the events
  speak.
- **Model-risk management — Risk Engineer seat** (Rohan, risk engineer, engineering),
  with the validation function structurally segregated per the existing registry invariant
  (Nadia, model validator, engineering — builder submits, validator approves; approval
  with open blocking findings throws). Owns independent validation of every FIL-Model,
  exam-set ownership per W8 (content authorship per D-W8-EXAM-GOVERNANCE routes
  third-line), and change approval: a methodology change is a new version, a new
  validation cycle, an explicit migration decision. The MRM story of W4 §4 carries over
  untouched — it was never about the manifest format.
- **Each implementation — its domain seat** (W2 map): SA-CCR and the risk stack to the
  Risk Engineer seat; ECL/IFRS 9 to the Financial Accounting Engineer seat (Bea); LCR/NSFR
  shared Risk/Treasury per the W2 boundary; returns-facing \`Reportable\` bindings to
  the Regulatory Reporting scope. Owning the implementation means owning its citations,
  its calibration defaults, and its parity evidence — not the language it is written in.

The carve-out is why the unification is safe: the CEO-named drift risk was two *specs* of
one boundary, not two *seats*. One spec, two planes, three ownership rings (language /
model-risk / implementation) — the same shape as the bank's posting interpreter (Atlas owns
the interpreter, Bea owns the rules, the CFO seat owns the policy they implement).

## 5. Slice-map update

Against the blueprint §3 slice map as revised by the repo re-examination §4 (S0 = v2 core
package + FIL kernel + no-v1-import gate; S7 = first cross-package cutover). Only the rows
that change:

| Slice | Content (revised) | Owner (seat) | Gate |
|---|---|---|---|
| **S0 (amended)** | v2 core package + FIL kernel (W9 S-FIL-1: taxonomy, URN scheme, composition algebra, alias registration) + facet interface stubs + **FIL-Models registry scaffold** (declaration event family registered per F-032; registry projection; empty register) + no-v1-import boundary gate | Atlas (Core banking platform architect, engineering) | Import-boundary gate; \`recon:fil-conformance\` advisory with the W9 §2 inventory allowlist, now including the implementation-resolution check (#7) dark |
| **S7-FIL (merged: S-FIL-2 + S7)** | **FIL-Facets + first model implementation** — facet interfaces finalised + CDM alignment typed (former S-FIL-2) + SA-CCR re-stated as the first FIL-Model implementing \`RiskMeasurable\` over \`fil:type:ir:*\`/\`fil:type:fx:*\` per the §2 contract, landing in the v2 core package as the **first cross-package cutover**, parity-gated against the live log (former S7, W4 §3 design otherwise verbatim) | Rohan (Risk engineer, engineering) for the model; Atlas + Kai (trading systems engineer, engineering) for facets/CDM; Nadia (Model validator, engineering) runs the validation lifecycle | \`recon:sa-ccr-extraction-parity\` (byte-equal \`CcrEadComputed\`/\`CcrReplacementCostComputed\` over full-history replay) + conformance check #7 enforcing for this row + tsc/static no-singleton-no-literal proof + second-store rehearsal |
| **S-FIL-4 (re-scoped)** | Returns + risk selector migration — unchanged in content, but every risk-engine selector migration is now a *model implementation declaration* into the FIL-Models registry (IRRBB, VaR, the B-grade engines of W4 §2), not a bespoke facet hookup; \`Reportable\` cell bindings as before | Bea (Accounting & financial reporting engineer, engineering) + Rohan (Risk engineer, engineering) | Rendered-return byte parity; computed-event parity per engine; conformance checks #2/#3/#7 enforcing per migrated engine |

Unchanged: S1–S6, S8–S16 as revised by the repo verdict; S-FIL-3 (GL re-keying, Bea),
S-FIL-5 (governance binding, Saskia + Atlas), S-FIL-6 (ratchet completion, Vera). Retired
as separate rows: S-FIL-1 (absorbed into S0 by the repo verdict, now carrying the registry
scaffold too) and S-FIL-2/S7 (merged above). Decision dependencies simplify accordingly:
S7-FIL depends on D-FIL-FRAMEWORK-V1 + D-W4-MODEL-LIBRARY-PILOT instead of three pending
FIL decisions plus D-MODEL-BINDING-CONTRACT-V1. The flagship consequence the blueprint
wanted survives intact and gets sharper: the first model is born FIL-conformant because
the contract it is built against *is* the language.

## 6. D-FIL-FRAMEWORK-V1 — merged named decision (for CEO approval)

> **D-FIL-FRAMEWORK-V1** — Approve FIL Framework 1.0 as one versioned specification:
> (i) **FIL-Core** — the kernel taxonomy (asset class → family → type → instance), the
> \`fil:\` URN scheme with \`@major.minor\` versioning, the composition algebra (legs,
> components, wrappers), and lifecycle event families bound to registered event types;
> (ii) the **external-standards stance** — FINOS CDM adopted as composition backbone with
> divergence confined to the posture, returns-cell, posting-key, and NPA extension facets;
> FIBO for concept naming at type-minting time; ISO 20022 at the message edge only;
> ISIN/UPI/CFI as external identifier mappings; ACTUS retained as the algorithmic
> contract-type discriminator; (iii) **FIL-Facets** — the seven kernel interfaces
> (Lifecycled, Valuable, Accountable, RegulatoryClassifiable, RiskMeasurable, Reportable,
> PostureRelevant) as the only instrument boundary any layer programs against;
> (iv) the **facet-implementation contract** — every model declares *implements*
> facet(s) over a taxonomy scope, *requires* facets + reference data + posture dimensions,
> *emits* events-of-record, *cites* provisions, with methodology versioned in core and
> calibration arriving as tenant events; (v) the **FIL-Models registry** — a
> projection-derived register of implementations keyed by (facet, taxonomy scope,
> version), methodologyHash-anchored, carrying the validation lifecycle and exam sets per
> version, with tenant subscription binding registry rows; and (vi) **one conformance
> family** — \`recon:fil-conformance\`, extended with the implementation-resolution
> check so every facet consumer resolves to a registered implementation, landing advisory
> with the W9 §2 inventory as allowlist and ratcheting to enforcing. The framework
> versions as one artefact: a facet-interface change is a framework version event and
> re-opens every registered implementation against it. This decision **supersedes the
> pending named decisions D-FIL-KERNEL-V1, D-FIL-CDM-ALIGNMENT-STANCE, and
> D-MODEL-BINDING-CONTRACT-V1**, which are withdrawn unput; D-FIL-CONFORMANCE-GATE's
> content is absorbed as clause (vi). Governance planes per the unification decision:
> Substrate Architect seat owns the language and registry substrate; the Risk Engineer
> seat (validator-segregated) owns model-risk management; domain seats own
> implementations.

Approval order consequence: D-FIL-FRAMEWORK-V1 takes the slot the repo re-examination gave
D-FIL-KERNEL-V1 — same approval set as D-V2-REPO-STRATEGY, since it defines what line one
of the v2 core package is.

## 7. Open questions

1. **Does the W8 exam harness version with the framework or with each model?**
   Recommendation: both, split by content — facet-contract exams (does an implementation
   honour the interface semantics?) version with the framework; methodology exams (does
   SA-CCR compute SA-CCR?) version with the implementation. The harness is one; the exam
   sets carry a \`versionsWith\` discriminator. Settle at S13 design.
2. **Facet granularity for non-instrument models.** Op-risk SMA (W4 §2.12) and
   gross-income-based computations consume *entity-level* inputs, not instrument facets —
   does the framework add an entity-facet plane (\`fil:entity\` scopes), or do
   non-instrument models register with a null taxonomy scope and a reference-data-only
   requires clause? Lean: null scope now, entity facets when a second case appears.
3. **Registry key vs scope overlap under posture.** Two implementations of one facet over
   overlapping scopes distinguished only by posture predicate (SA vs IRB credit-RWA) —
   is posture part of the registry key or a resolution-time filter? Lean: filter, keyed
   lookups stay (facet, scope, version); but the conflict rule of §3 must then evaluate
   predicates for disjointness.
4. **Composed-type implementations.** When a tenant composes a type (W9 §6), facet
   implementations may derive by composition over components — are derived implementations
   registry rows (auditable, but rows the platform didn't author) or computed bindings?
   Affects S-FIL-5; defer to first composed-type tenant need.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). Consolidation deliverable
under D-FIL-FRAMEWORK-UNIFICATION.*
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
    citations: ["D-RMS-PHASE-3", "D-FIL-FRAMEWORK-UNIFICATION"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "FIL Framework unification: W4 model library + W9 instrument language as one framework",
      path: "2026-06-12_atlas_fil-framework-unification.md",
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
