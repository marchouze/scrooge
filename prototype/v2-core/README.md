# v2-core — the FIL Framework kernel (V2 S0)

**Author:** Atlas (Core banking platform architect, engineering)
**Workstream:** WS-V2-BBAAS — Slice **S0** (pre-Wave-1 foundation)
**Authority:** `D-V2-REPO-STRATEGY-REEXAMINATION`, `D-FIL-FRAMEWORK-UNIFICATION`,
`D-MODEL-BINDING-CONTRACT-V1`, `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`
**Brief:** `brief:atlas:v2-s0-v2-core-package-fil-kernel-no-v1-import-bo:2026-06-12`

This package is the greenfield **v2 core** — the FIL (Financial Instrument
Language) Framework kernel. It is a **fresh, FIL-first, entity-generic
code-line** with a **hard no-v1-import boundary**. Everything in Wave 1
(control-plane store, tenant axis, posture register, products-as-events,
released-surface gate) and beyond ADDS to this package; v1 (`platform/`,
`runtime/`, …) is the seed tenant and is never imported here.

> **S0 is skeleton + structural gates only.** No facet implementations, no
> SA-CCR or any model logic, no valuation/accounting/risk computation, no tenant
> axis, no control-plane store, no migration of v1 `.replay()` call-sites, no
> live-bus handler registration. Those are later dispatches (S1/S2; S7-FIL
> onward).

---

## 1. Package path / boundary decision

**Path chosen: `prototype/v2-core/`** — a sibling of the v1 code-line
(`platform/`, `runtime/`, `domains/`, …), **not** a folder under `platform/`.

Why a top-level sibling directory rather than a separate workspace package: the
repo verdict (`D-V2-REPO-STRATEGY-REEXAMINATION`) is **mono-repo, two
packages** — one repo, one `bun`/`tsc` toolchain, two package boundaries
enforced *structurally* rather than by separate `package.json`/publish
machinery. A sibling directory wired into the single `tsconfig.json` `include`
gives the v2 line its own boundary while keeping one `bun run ci` typecheck over
the whole tree (the dispatch full-typecheck gate). The boundary is then a
**lint/recon invariant** (`recon:v2-no-v1-import`, §5) rather than a
node-resolution accident — which is stronger: it cannot be defeated by a
relative path, and it is asserted on every CI run.

The package is wired into the build by adding `"v2-core/**/*"` to
`prototype/tsconfig.json` `include`. `bun run ci` (full-project `bunx tsc
--noEmit`, no scope restriction) typechecks it.

### Layout

```
v2-core/
  index.ts                      public surface (barrel)
  README.md                     this design note
  fil-core/                     FIL-Core — the kernel
    primitives.ts               v2-native Instant / Money / CitationRef / MethodologyHash
    taxonomy.ts                 asset class → family → type → instance; containment primitive
    urn.ts                      the fil: URN scheme + version + scope patterns
    composition.ts              composition algebra — legs / components / wrappers
    lifecycle.ts                lifecycle stages + transitions + event SHAPES
    type-definition.ts          FilTypeDefinition (binds family + composition + lifecycle + facets)
    kernel.test.ts              kernel unit tests
  fil-facets/
    facets.ts                   the seven facet INTERFACES
  fil-models/
    declaration.ts              the model-declaration shape (facet-implementation contract)
    registry.ts                 the FIL-Models register projection (pure fold; starts empty)
```

The two structural gates are **v1-side recon infrastructure** (they cannot live
inside the package — they need `node:fs` and the recon `types`, and the package
must not import v1):

```
platform/recon/v2-no-v1-import.ts        + .test.ts   the no-v1-import boundary gate
platform/recon/fil-conformance.ts                     recon:fil-conformance (advisory, S0)
platform/event-store/event-types/fil-models.ts        v1-side event-type (imports v2 schema)
platform/event-store/registry/fil-models.ts           registry row (F-032)
```

---

## 2. URN grammar

Two URN families (W9 §3.1, the canonical design):

| Kind | Grammar | Example |
|---|---|---|
| **Type** | `fil:type:<asset-class>:<family-path>:<type-slug>@<major>.<minor>` | `fil:type:fx:spot:otc-vanilla@1.0` |
| **Instance** | `fil:inst:<tenant>:<instance-id>` | `fil:inst:LE-ZA-HOZ-BANK:trade-000123` |
| **Scope pattern** | `fil:type:<class\|*>[:<family\|*>][:<slug\|*>]` | `fil:type:ir:*` |

- **asset-class** ∈ the closed set `{ ir, fx, equity, credit, commodity,
  funding, hybrid }` — deliberately aligned with the SA-CCR/Basel partition
  (the partition regulation quantifies over).
- **family-path** — dot-delimited specialisation below the asset class, each
  segment a lowercase-kebab token (`spot`, `swap.vanilla`, `cash.listed`).
- **type-slug** — the leaf identifier (`otc-vanilla`).
- **version** — `@<major>.<minor>`; additive changes (new types, new families,
  new facet methods with defaults) are minor; removals/re-typings are major.
- External identifiers (ISIN, FSB UPI, ISO 10962 CFI, ACTUS) are **mappings on
  the identity facet, never primary keys** — they do not appear in this grammar.

### Reconciliation: brief sketch vs W9 canonical

The dispatch brief sketches the scheme as
`fil:<assetclass>:<family>:<type>[:instance]@<major>.<minor>`. The W9 FIL paper
(`record:documents:atlas:v2-bbaas-w9-fil:2026-06-12`, §3.1) — which the brief
names as the canonical design to implement — refines that into the **two-family**
scheme above: an explicit `type`/`inst` discriminator segment, and a separate
`fil:inst:` family for instances. The refinement is load-bearing: instances are
**tenant-owned and event-sourced** (Principle 1) and must not share an
identifier namespace with shared-core type definitions. The version anchor and
the `(asset-class, family, type)` ordering are common to both sketches; only the
family discriminator is added. **This package implements the W9 canonical
scheme** (per the brief's instruction not to contradict the papers).

---

## 3. The seven FIL-Facets and their contracts

A layer never reaches into ad-hoc instrument fields; it programs against the
**facet** it needs (encapsulation is the audit property — exactly one answer in
the system, carrying its citation). The seven interfaces (`fil-facets/facets.ts`,
W9 §3.4 verbatim):

| Facet | Contract (S0 = interface only) |
|---|---|
| `Lifecycled` | `lifecycle()` → the typed state machine; `stage(asOf)` → projected stage |
| `Valuable` | `valuationMethod()`, `requiredObservables()`, `value(marks, asOf)` → a `*Revalued` event-of-record |
| `Accountable` | `ifrs9Category(designation)`, `postingKeys()` → (lifecycle event → GL rule key) pairs, `fairValueHierarchy()` |
| `RegulatoryClassifiable` | `baselAssetClass(posture)`, `hqlaTier(posture)`, `riskWeightBasis(posture)` — **posture-conditioned** |
| `RiskMeasurable` | `riskFactors()` (typed, not enum-listed), `positionContribution(engine)` → how SA-CCR/IRRBB/VaR select it |
| `Reportable` | `returnsCells(form, posture)` → typed, resolvable BA-form cell bindings |
| `PostureRelevant` | `postureDimensions()` → which W8 products-held dimensions this type feeds |

Two invariants are preserved precisely (W9 §3.4):

1. **Regulatory facets take a `PostureSnapshot`** — classification is
   approach-conditioned (a bond's risk-weight basis differs under SA vs IRB).
2. **Facets emit events-of-record** rather than returning bare values where the
   answer is load-bearing (`value()` → `*Revalued`).

Implementations are **FIL-Models** (§4), registered separately — *a facet is an
interface, a model is a registered implementation of it* (the whole point of
`D-FIL-FRAMEWORK-UNIFICATION`).

---

## 4. The model-declaration shape

A **FIL-Model** is a registered implementation of one or more facets over a
taxonomy scope. The declaration (`fil-models/declaration.ts`) carries five
clauses (FIL Framework §2 — `D-MODEL-BINDING-CONTRACT-V1`, absorbed into
`D-FIL-FRAMEWORK-UNIFICATION`):

```
implements <facet(s)> over <taxonomy scope: fil:type URN patterns>
requires   <other facets + reference data + posture dimensions>
emits      <events-of-record>
cites      <provisions>
with methodology in core (versioned with the framework) and calibration as tenant events
```

Carried on a `FilModelImplementationDeclared` event; the **FIL-Models register**
(`fil-models/registry.ts`) folds those events into rows keyed by
**(facet, taxonomy scope, version)**, methodologyHash-anchored. Overlapping
scope for the same facet+version across different models is a **registry
conflict** (the OO rule: one implementation per interface method). The register
is a query; the events are canonical (Principle 1).

**In S0 the register starts EMPTY** — no model is declared. SA-CCR is the first
entry, landed by S7-FIL (a later, separate dispatch). The event type is
registered in the v1 event-type registry (F-032) via a v1-side adapter that
imports the v2 schema; the package itself registers no live-bus handler.

---

## 5. How the no-v1-import gate is enforced

`recon:v2-no-v1-import` (`platform/recon/v2-no-v1-import.ts`) is a recon pipeline
in `ci:recon:infra`. It:

1. Recursively lists every `.ts` file under `v2-core/`.
2. Extracts every import / re-export / dynamic-import / `require` specifier.
3. **Fails** (severity `fail`, non-zero exit, blocks CI) if any specifier:
   - uses a v1 path alias (`@platform/`, `@domains/`, `@simulators/`), **or**
   - is a relative/absolute path that resolves OUTSIDE `v2-core/` into a v1
     code-line directory (`platform/`, `runtime/`, `domains/`, `dashboard/`,
     `projections/`, `simulators/`, `scenarios/`, `seeds/`, `scripts/`,
     `tests/`), **or**
   - otherwise escapes the package boundary.
   Bare npm/builtin specifiers (`zod`, `node:fs`) and intra-package relative
   imports are permitted.

A regression test (`v2-no-v1-import.test.ts`) **constructs violating import
specifiers** — `../../platform/composition`, `@platform/event-store/store`,
`@domains/markets`, `@simulators/fx`, a package-escape — and asserts the gate
flags each, plus asserts the real `v2-core/` tree currently passes (zero
violations).

The gate is **v1-side infra by necessity**: it needs `node:fs` and the recon
`types`, which the package must not import. The permitted dependency direction is
**v1 → v2** (v1 is the seed tenant; the v2 line never reaches back). The
`recon:fil-conformance` projection and the `fil-models` event-type adapter follow
the same v1→v2 direction.

### `recon:fil-conformance` (advisory in S0, enforcing-ready)

`platform/recon/fil-conformance.ts` (in `ci:recon:domain`) folds the FIL-Models
register from any `FilModelImplementationDeclared` events and asserts:

1. **register integrity** — no two models claim the same facet+scope+version
   (advisory `warn` in S0);
2. **implementation-resolution (check #7)** — every facet *consumer* resolves to
   a registered FIL-Model implementation.

In S0 there are **zero facet consumers and zero declared models**, so it passes
trivially. It is stood up now so it is enforcing-ready when consumers land: when
S7-FIL adds the first consumer (SA-CCR), the consumer enumeration becomes a real
join, and the advisory→enforcing ratchet (with the W9 §2 legacy-vocabulary seed
allowlist) flips per check-class as the allowlist burns down (S-FIL-3…6).

---

## 6. The composition factory behind an alias (S6)

S0 landed the composition **algebra** (`fil-core/composition.ts`: `FilLeg`,
`FilComponent`, `FilWrapper`, and the `legsOf` / `componentsOf` / `wrapping`
constructors). S6 adds the construction **seam** on top of it.

**The factory** (`fil-core/composition-factory.ts`) builds well-formed composite
FIL instruments from **typed, kind-discriminated specs** over that algebra:

| Spec `kind` | Built composition |
|---|---|
| `irs` | `legs: [fixedLeg, floatLeg]` (each a typed `FilLeg`) |
| `fx-swap` | `legs: [nearLeg, farLeg]` |
| `structured` | `components: [...]` (containment) |

It **validates leg/component typing against the taxonomy**: every `legType` /
`componentType` (and the composite's own `compositeType`) must be a valid
`fil:type:…@maj.min` URN (a registered FIL type, never a free object); leg/
component ids must be unique; a structured composite must carry ≥1 component.
Rejections throw a `CompositionFactoryError` carrying a **stable `code`**
(`leg-type-not-a-fil-type-urn`, `empty-components`, `duplicate-leg-id`, …) so
callers and the recon gate can assert *which* rule fired. The factory builds via
the S0 constructors (`legsOf` / `componentsOf`) — never a hand-assembled
`FilComposition` literal — and returns a `BuiltComposite` keyed to the
composite's own `fil:type:` URN. **No valuation / lifecycle / risk** — pure
construction.

**The alias seam** (`fil-core/composition-factory-alias.ts`) is *why this is S6
and not just a helper*. Composite construction is going to **move** (more
instrument kinds, tenant-composed types, CDM-economic-terms leaves). Rather than
have every call-site `import` the concrete factory — a wide coordinated rewrite
each time construction changes — consumers resolve it through a single stable
indirection:

- `COMPOSITION_FACTORY_ALIAS` = `"fil-core:composition-factory"` — the addressable seam identity.
- `buildComposite(spec)` — the one-call construction surface every consumer uses.
- `registerCompositionFactory(impl)` — swap the implementation behind the alias (the cutover primitive); returns a `restore()` handle (rollback / test isolation).
- `resolveCompositionFactory()` — the implementation live *now* (default registered eagerly at module load, so the alias is never dangling).

The implementation behind the alias can be **swapped without touching any
call-site** — the strangler/cutover pattern, the **same seam shape as the
SA-CCR alias-flip** (where v2 became the sole live CCR emitter behind one
resolution boundary; here the boundary is composite *construction* rather than
CCR *emission*). The `composition-factory.test.ts` `"honours a swapped
implementation behind the same alias"` case proves the seam is real: a sentinel
factory registered behind the alias is honoured by `buildComposite`, and the
default is restored on unwind.

`recon:v2-composition-factory` (advisory) asserts (1) the alias resolves to a
live factory, and (2) no `v2-core` module bypasses the seam by importing the
concrete factory's `build` / `defaultCompositionFactory` directly. Advisory
because S6 proves the seam in isolation (not yet wired into the FIL-instance
backfill — that is a later wave), so it never blocks CI on the absence of
consumers while standing ready to catch the first bypass.

Authority: `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`, `D-MODEL-BINDING-CONTRACT-V1`,
`D-FIL-FRAMEWORK-UNIFICATION`.

---

## 7. What lands next (NOT in this package yet)

- **S1/S2** — control-plane store + tenant axis (Wave 1).
- **S7-FIL** — the first FIL-Model: SA-CCR implementing `RiskMeasurable` over
  `fil:type:ir:*` / `fil:type:fx:*`, parity-gated against the live log; the
  facet interfaces finalised + CDM alignment typed.
- **S-FIL-3…6** — GL re-keying, returns/risk selector migration, governance
  binding, ratchet completion (conformance fully enforcing).

*Filed as a RecordFiled event into the Documents register (RMS Phase 3,
`D-RMS-PHASE-3`); the content-addressed document store is canonical
(`D-RMS-PHASE-4`).*
