# Data-Quality Review & Operating-Book Provenance Architecture

**Author:** Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc (CEO)
**Date:** 2026-06-03
**Classification:** engineering-seat
**Decision:** D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE (CEO-approved, session delegation)
**Status:** Review filed; build roadmap authorised (PR1–PR5), not yet executed.

---

## 1. Why this review

Marc reports recurring defects: the bank handles Active / matured / cancelled transactions
inconsistently; production vs simulated vs seeded data is confused; the same figure is
computed several ways in different modules; and the UI labels pages "prod" while showing
"sim" data. The standing plan — use the `provenance` flag to separate production from
simulated during the build phase — is itself the source of the trouble. Marc invited
alternatives, with one firm requirement: **in build phase the bank must exercise all
functionality, including every measurement and alert, on its operating data — not suppress
it merely for being "simulated."**

These are not many bugs. They are one root defect with many symptoms. The recent PR history
is a list of its recurrences: the LCR two-engine split (PR #1003/#1004), the RWA R7.83tn
blow-up (PR #996), "0 settlement instructions within 30-day horizon" (PR #1000), and a long
tail of one-off fixture-pollution guards.

## 2. Root cause

`provenance.kind` (`production | simulated | build-phase-fixture`) is **overloaded to
answer two orthogonal questions**:

1. **Lineage / audit** — where did this event come from? *(legitimate, permanent)*
2. **Inclusion** — should this event count toward the operating book, its measurements,
   and its alerts? *(the thing that actually varies by consumer)*

Inclusion was wired directly off lineage via a permanent `production-only` default
(`D-PROVENANCE-FILTER-ENFORCEMENT`, 2026-05-12). In build phase there is no `production`
data, so to make reports non-empty a third kind `build-phase-fixture` was added
(`D-PROVENANCE-BUILD-PHASE-CLASS`, 2026-05-22) that `production-only` admits *only during
build phase*. Genuine operating data tagged `simulated` was therefore silently dropped from
measurements — directly contrary to Marc's intent — and ALM's `liveFlowView` Proxy does the
**opposite** (keeps simulated, drops fixture).

The consequence is **four incompatible filtering patterns and no single definition of "the
book":**

| Pattern | Where | Inclusion rule |
|---|---|---|
| `eventMatchesProvenanceFilter(production-only)` | `rwa-from-positions.ts` (+ redundant inline check) | prod + fixture, drop sim |
| inline `provenance?.kind === "build-phase-fixture"` | `gl-projection.ts`, `fx-subledger-trade-reconciliation.ts` | drop fixture only |
| `liveFlowView()` Proxy | `alm-positions.ts` | **keep sim, drop fixture** (inverted) |
| per-module local `isFixture()` ×3 | `dashboard/server.ts`, `alm/repricing-gap.ts` | drop fixture only |

The LCR two-engine divergence is precisely this: the tile and the BA-325 generator apply
different inclusion rules to the same events, so they disagree.

A parallel, smaller defect: **transaction lifecycle (active / matured / cancelled) is
modelled per-product ad hoc.** FX uses a two-pass "cancelled-set" duplicated across five-plus
projections; other products fold product-specific terminal events (`DepositMatured`,
`InterbankLoanMatured`, `RepoEndLegSettled`, …) inline. A registry exists
(`trade-lifecycle-registry.ts`) but most projections do not use it, so "is this trade still
live?" is answered differently in RWA, P&L, ALM, and GL. The RWA blow-up was one projection
forgetting to exclude `FxTradeCancelled`.

## 3. Recommended architecture

Separate the two axes, and make **inclusion** a settable, bank-wide, event-sourced policy
surfaced in the UI.

### A. Keep `provenance.kind` as the audit / lineage axis — unchanged
Immutable, append-time, never lost — the citation axis (Principle 2). We stop using it
directly as an inclusion filter. No event loses its lineage.

### B. Bank-wide prod/sim mode + per-category granularity (event-sourced, settable)
A single **bank-wide mode** (`sim` | `prod`) replaces the scattered env vars
(`BANK_LIFECYCLE_PHASE`, `BANK_PHASE`, `BANK_PROVENANCE_SUBSTRATE_ACTIVE`). Set via an event,
queried by a projection — following the `recordDecision` + projection precedent, not a
file/env flag. The mode drives: (1) default provenance for new events, (2) the operating-book
inclusion filter, (3) whether the sandbox simulator runs.

On top of it, a **category → provenance policy table** sets granularity, hung on the existing
`DecisionCategory` enum and the domain-organised event-type modules. Default under bank-wide
`sim`:

| Category / domain | Provenance | Rationale |
|---|---|---|
| Decisions, governance, briefs, agent runs | **production** (real) | Real architectural commitments — generalises today's `PRODUCTION_CARVE_OUTS` |
| Build / substrate / platform / code | **production** (real) | The engineering is real |
| Trades, GL, counterparties, messages, settlement, market data | **simulated** | Sandbox-simulator output; real-to-the-bank operations but not live |

This turns today's hardcoded three-entry `PRODUCTION_CARVE_OUTS` into data-driven, settable
policy.

### C. One canonical operating-book selector — replaces all four patterns
A single inclusion predicate every projection, GL, ALM, RWA, recon, and dashboard endpoint
must call, keyed off the bank-wide mode + category policy:

- **bank-wide `sim`** → operating book = all categories at their policy provenance (prod
  governance/build + sim operations); **hold out only explicitly-flagged scenario / stress /
  rehearsal "what-if" runs** via a reserved `tags: ["sandbox"]` marker (the provenance schema
  already carries `tags?: string[]`), with a fallback classifier on `scenario`-id prefixes so
  **no re-tagging of legacy data is required**.
- **bank-wide `prod`** → operating book = production only; everything else archival.

Home: extend `filter.ts` with `mode: "operating-book"`, `operatingBookFilter()`,
`eventInOperatingBook(event)`. `eventMatchesProvenanceFilter` gains one branch;
`defaultProvenanceMode()` flips from `production-only` to `operating-book`; `liveFlowView`'s
body becomes `if (!eventInOperatingBook(ev)) continue;` (correcting its inversion). The other
three patterns delete their bespoke checks and call the shared predicate.

The legitimate original concern — "scenario runs must not pollute reporting" — is preserved
exactly: scenario/stress/rehearsal runs carry the `sandbox` marker and are the one thing held
out of the book.

### D. Sandbox gate wired to the bank-wide mode
The 3rd-party simulator is already centralised in `ThirdPartySimHub` (`start`/`stop` per
`SimDomain`). Wire its enablement to the mode: `sim` → simulators run and tag output per the
category policy; `prod` → simulators stopped. One switch, not scattered per-simulator checks.

### E. Unified lifecycle-state resolver — fixes active/matured/cancelled
A single registry-driven resolver `platform/lifecycle/trade-lifecycle-state.ts`, built on
`trade-lifecycle-registry.ts`, answers "is this instance live / matured / cancelled /
settled" uniformly across all products in one pass — generalising the near-canonical fold
that exists today FX-only in `fx-subledger-trade-reconciliation.ts`. Every projection drops
its hand-built terminal `Set`s and asks the resolver. The FX-only `fx-lifecycle-parity.ts`
recon generalises to all products.

### F. UI badge truth + provenance control surface
Endpoints derive `pageProvenance` from the **realized lineage actually folded**, not a global
env default. A `realizedProvenance(events)` reducer drives an honest badge — e.g. "Build-phase
operating book (P+F+sim)" rather than a misleading "prod". A new config page sets and displays
the bank-wide mode + per-category granularity (following `GET/PATCH /api/config` +
`/api/constants`) and shows sandbox status.

### G. Recon gates lock it in
Three harnesses (standard `run(): ReconResult`): `recon:operating-book-selector-coverage`
(no projection folds trade/position/cash events without the shared selector — fails any
surviving inline `kind ===` or local `isFixture`); `recon:trade-lifecycle-parity` (all
products, not just FX); `recon:provenance-badge-lineage` (declared mode matches realized
lineage).

## 4. Build roadmap (authorised; execute after this review)

1. **PR1 — selector + mode value + default flip (no data migration).** Highest-impact fix:
   stops sim data being dropped, corrects the `liveFlowView` inversion, reconciles the LCR
   engines' inclusion rule. Zero re-tagging.
2. **PR2 — bank-wide mode + category policy, event-sourced.** `recordProvenancePolicy`
   wrapper + projection; replace env-var gating; wire `ThirdPartySimHub` to the mode.
3. **PR3 — call-site convergence.** Delete redundant inline checks and the 3× local
   `isFixture`; route all through the shared selector.
4. **PR4 — unified lifecycle resolver** + migrate the two-pass cancelled-set sites.
5. **PR5 — UI badge truth + provenance control page + the three recon gates.**

Optional hygiene backfill (deferred, off critical path): emit explicit `tags:["sandbox"]` on
historical scenario events so the fallback prefix classifier can later be retired.

## 5. Authority & citations

- Principle 1 (events are the only source of truth) — inclusion becomes a query over the
  canonical log, not a parallel state; provenance lineage remains immutable.
- Principle 2 (single-graph discipline) — `provenance.kind` stays the citation/audit axis.
- Supersedes the inclusion-semantics of `D-PROVENANCE-FILTER-ENFORCEMENT` (production-only
  default) and `D-PROVENANCE-BUILD-PHASE-CLASS` (build-phase-fixture as an inclusion device);
  both decisions' lineage/audit content is retained, only the inclusion default changes.
- Decision-authority routing: engineering build decision (substrate/platform/schema) → CEO
  (build phase).
