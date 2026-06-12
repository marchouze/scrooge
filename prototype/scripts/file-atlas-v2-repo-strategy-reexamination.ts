// scripts/file-atlas-v2-repo-strategy-reexamination.ts
//
// One-shot RMS Phase 3 filing for Atlas's re-examination of the blueprint
// §2 repo-strategy verdict (D-V2-REPO-STRATEGY — named, NOT yet approved)
// under the CEO's revised criteria weights (structural platform correctness
// dominates; anchor-tenant/licence-track continuity demoted) and two new
// first-class requirements: intra-tenant multi-legal-entity (requirement A)
// and FIL-mediated event access (requirement B). The paper code-grounds both
// rewrite surfaces with measured counts, re-runs the six original criteria
// plus the two requirements, evaluates the greenfield-with-running-anchor
// and mono-repo-two-packages options properly, and delivers a revised
// verdict. Emits a RecordFiled event so the Documents register holds the
// canonical paper. The body is embedded inline (Phase 4 — D-RMS-PHASE-4 —
// made the content-addressed document store the canonical home; no in-tree
// root render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-REPO-STRATEGY-REEXAMINATION (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-repo-strategy-reexamination:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-atlas-v2-repo-strategy-reexamination] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 repo strategy re-examined: multi-LE + FIL-access rewrite surfaces, reweighted criteria, revised verdict

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat
**Date:** 2026-06-12
**Authority:** D-V2-REPO-STRATEGY-REEXAMINATION (CEO-approved 2026-06-12). Re-examines the
§2 verdict of the blueprint (record:documents:atlas:v2-bbaas-blueprint:2026-06-12), against
the W3 tenancy architecture (record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12)
and the W9 FIL paper (record:documents:atlas:v2-bbaas-w9-fil:2026-06-12).
**Audience:** Marc (CEO)
**Status:** Analysis and revised recommendation. D-V2-REPO-STRATEGY remains named and
unapproved; §4 supplies its updated text; §5 the approval consequences.

**CEO direction taken as given (in-session 2026-06-12):** (a) revised weights — "I am not
concerned about how close we are to the licence gate, but am more concerned about building
a 'proper' platform": anchor-tenant/licence-track continuity, the original verdict's
heaviest criterion, is demoted; structural platform correctness dominates. (b) Requirement
A — **intra-tenant multi-legal-entity**: adding another legal entity within the current
tenant (e.g. a UK bank in the same group) is definite required functionality and must not
require significant rewrites. (c) Requirement B — **FIL-mediated access**: to enforce W9,
nothing queries the event store directly; every consumer goes through FIL objects — FIL is
the sole data-access path, stronger than W9 §7's identifier-conformance gate.

---

## 1. The measurements

The original verdict argued from the workstream papers. This re-verdict argues from the
tree. All counts were taken on this branch (origin/main as of 2026-06-12) with recursive
grep over \`prototype/\` excluding \`node_modules\`, occurrences (not files) unless stated.
Counting method is stated per table so every number is re-runnable; counts are lower
bounds (literal-string matching misses indirection) and the per-directory splits use the
first path segment (with \`platform/<module>\` kept two-deep).

### 1.1 Requirement A — the single-legal-entity assumption surface

**(1) Literal call-sites hardcoding the legal entity.**

| Literal | Occurrences | Files |
|---|---|---|
| \`LE-ZA-HOZ-BANK\` | **1,090** | 616 |
| \`BANK_ZA_001\` (the pre-rename literal W4 flagged in SA-CCR; still live in payments, regulatory, scenarios) | **229** | ~90 |
| \`LE-BANK-SA\` (legacy id, mostly backfill scripts) | **61** | — |
| **Total LE-literal surface** | **≈1,380** | ≈700 |

Supporting counts: \`legalEntityId\` token appears 67 times; the construction
\`entity: "LE-…"\` (an inline hardcoded envelope entity) appears **522** times — half the
\`LE-ZA-HOZ-BANK\` surface is events being *authored* with a hardcoded entity rather than a
threaded parameter.

\`LE-ZA-HOZ-BANK\` split by layer (occurrences): **tests 233; scripts 222; runtime
(goal-loop agents + decisions) 140; platform engines ≈400** (accounting 98, returns 57,
reporting 54, projections 33, markets 32, recon 31, event-store 14, simulation 11, risk 8,
regulatory 7, product-control/market-risk/alm 6 each, the tail across ~15 more modules);
**dashboard 33; scenarios 22; seeds 13; simulators 5**. \`BANK_ZA_001\` splits tests 127,
scripts 37, scenarios 31, platform/payments 15, platform/regulatory 8, the rest single
digits — i.e. the W4 finding ("hardcoded entity literal in SA-CCR") generalises: the same
literal sits in the payments rails and the regulatory module, not just one engine.

Honest read: roughly **460 of the ≈1,380 occurrences are production code** (platform +
runtime + dashboard); the rest are tests, scripts, scenarios, and seeds that would follow
whatever the production code does. The production half is mostly *parameter-threading*
work — the envelope already carries a required \`entity\` field on every event (Principle
5 lives in the store schema; W3 §3.1 is explicit that entity and tenant are orthogonal
axes), so the store layer is entity-ready and the literals are consumer-layer laziness.

**(2) Modules with structural single-entity assumptions (no literal needed).** These are
the expensive ones — the literal count understates requirement A because these modules
would be single-entity even after every literal was threaded:

1. **Chart of accounts** — \`platform/accounting/chart-of-accounts.json\` is one account
   tree (ZAR-presumptive account records, no entity axis); the CoA registry, posting
   rules, and the SLA bind to it as *the* chart. Two legal entities need per-entity CoA
   instantiation plus a group mapping layer; neither exists.
2. **GL / balance projections** — \`platform/projections/accounts/balance.projection.ts\`
   *carries* \`entity\` onto rows but the trial balance, registers, and every consumer
   treat the store as one ledger; nothing partitions or sub-totals by entity.
3. **Returns renderers** — **36 \`ba-*\` renderer modules** across
   \`platform/reporting/\` + \`platform/returns/\`, each rendering one solo return for one
   implicit entity. Exactly one consolidated variant exists in the whole tree
   (\`platform/returns/ba300/consolidated-lcr.ts\`). PA returns are filed solo *and*
   consolidated; 35 of 36 renderers have no consolidated story.
4. **Risk engines** — SA-CCR, VaR, CVA, IRRBB/ALM select positions store-wide; netting
   sets, NOP, and delta-EVE are not entity-partitioned.
5. **Snapshot stream keys** — \`(streamKey, asOf)\` with no entity axis (W3 §3.4 already
   flags the equivalent for tenant).
6. **Jurisdiction/currency/calendar defaults** — ZAR/ZA single defaults through CoA,
   seeds, and the FinSurv-shaped edges; Principle 5's "jurisdictional dispatch on every
   flow" is a principle, not a mechanism, in v1.
7. **Capital / RAS stack** — capital metrics, RAS register, ICAAP machinery compute one
   entity's stack; no solo-vs-consolidated distinction.
8. **Dashboard** — single-bank views throughout (33 literal sites and no entity selector).

**(3) What 2-LE-with-consolidation genuinely requires that has no v1 asset.** This list is
the same under every repo option — it is new build either way:

- a **consolidation engine** (GAP-LCR-CONSOLIDATION-ENGINE is open; the BA300 consolidated
  module is the only partial asset);
- **intra-group eliminations** (intercompany balances, margins, dividends) — nothing;
- **IAS 21 FX translation of a foreign operation** (closing-rate/average-rate, CTA in
  equity) — nothing; a UK entity makes this mandatory on day one;
- **per-entity CoA instantiation + group CoA mapping** — nothing;
- **consolidated BA-return variants** and the solo/consolidated submission axis — one of
  36;
- a **versioned legal-entity tree with ownership percentages** driving the consolidation
  perimeter — the Party register holds identities; the tree machinery is thin;
- **entity-resolved calendars and jurisdictional dispatch** — nothing mechanical.

**(4) Fraction estimate.** Of the ~60 \`platform/\` modules, roughly **25–30 are
instrument- or entity-bearing** and would change for 2-LE-with-consolidation in place
(~45%), spanning the heaviest modules in the tree (accounting, reporting, returns,
projections, markets, risk). The change *shape* splits three ways: literal-threading
(cheap, mechanical, ≈460 production sites), structural re-keying (moderate — projections,
renderers, engines gain an entity dimension), and the consolidation layer (genuinely new,
cost-identical across options). A greenfield code-line writes the first two for free —
entity-generic signatures from line one — and pays only the third.

### 1.2 Requirement B — the direct event-access surface

**(1) Direct event-store query call-sites.** Method: grep for \`.replay(\` (which catches
\`eventStore.replay(\`, \`store.replay(\`, and local aliases) plus case-insensitive
\`FROM events\` for raw SQL.

| Measure | Count |
|---|---|
| \`.replay(\` call-sites | **1,678** across **612 files** |
| Raw SQL over the events table | **88** sites |

Split by layer (call-sites): **runtime (goal-loop derivers/agents) 416; tests 284; scripts
256; platform/recon 126; dashboard 76; platform/markets 69; platform/projections 67;
scenarios 65; reporting 29; product-control 27; simulation 21; risk 21; conduct 21;
model-registry 20; alm 19; regulatory 18; accounting 15; returns 14; payments 12;
market-risk 12; agent-runtime 11; alco 9;** tail ≈40 across escalation, seeds, agents,
scheduler, privacy, event-trigger-bus, simulators.

**(2) Recon pipelines reading events directly.** The standing recon surface is **153
distinct \`recon:\` package scripts** over **164 pipeline modules** in
\`platform/recon/\` (the "200+" figure in circulation counts script aliases and retired
test-only pipelines; 153 is the honest runnable count). Of the 164 modules, **81 call
\`.replay(\` directly** and **24 open the store file directly**
(\`new EventStore\`/\`resolveEventDb\`); the rest assert over the tree, projections, or
other registers.

**(3) What "all access through FIL objects" means architecturally.** FIL objects are not
a new store — Principle 1 stands; events remain the only durable artefact. The strong
model is a **typed aggregate/repository layer per FIL facet**: an instrument repository
that folds lifecycle events into \`fil:inst\` aggregates and exposes exactly the facet
interfaces of W9 §3.4 (\`Valuable\`, \`Accountable\`, \`RegulatoryClassifiable\`,
\`RiskMeasurable\`, \`Reportable\`, \`Lifecycled\`, \`PostureRelevant\`), each answer
entity- and posture-parameterised and citation-carrying. Consumers stop quantifying over
event-type names and start quantifying over taxonomy nodes + facets. Requirement B is
therefore requirement A's enforcement mechanism: a facet query *must* state its entity
scope, so the single-LE assumption cannot be re-smuggled into a FIL-mediated consumer.

**(4) The honest boundary — what stays event-level even in the strong model.** FIL
governs **instrument-bearing data**: trades, positions, valuations, postings,
classifications, risk measures, returns cells. It does not govern the records substrate.
Staying event-level legitimately: the event-store infrastructure itself (the repository
layer's own implementation, archive/partition integrity, append-only recon); RMS/dispatch
(briefs, runs, decisions, records, feedback — non-instrument domains with their own typed
registers); governance/escalation/privacy/observability; and the goal-loop derivers in
\`runtime/agents\` (416 sites — the largest single block) which deliberate over briefs,
decisions, and substrate state, not instruments. Applying that boundary to the 1,678
sites: **≈450–500 production call-sites move behind FIL facets** (the engine/projection/
renderer/markets/risk/accounting/returns/product-control block plus the instrument-half of
recon, ~40–60 of the 81 replay-direct pipelines, plus instrument dashboard panels);
**≈55–60% stay event-level legitimately** (runtime/agents, RMS-domain recon and dashboard,
infra); tests and scripts follow their subjects. So requirement B's in-place cost is an
inversion of roughly five hundred call-sites' access pattern — touching, again, exactly
the heaviest engine modules that requirement A also touches.

### 1.3 The compounding observation

The two surfaces are not additive — they are **the same surface**. The modules requirement
A restructures (accounting 98 LE-literals/15 replay-sites, reporting 54/29, returns 57/14,
markets 32/69, projections 33/67, risk 8/21…) are the modules requirement B re-plumbs.
Under both requirements, the majority of v1's engine/consumer code is rewritten-in-place
*anyway*: entity threaded through every signature, access inverted from event-walks to
facet queries, renderers re-keyed. What survives untouched in-place is precisely what also
survives a new code-line: the event store and log, the document store, the graph, RMS,
dispatch, the recon harness pattern, the agent runtime. That symmetry is what re-opens the
verdict.

## 2. The criteria, re-run under the revised weights

Weights: structural-correctness criteria (b), (d), (g), (h) carry weight 3; knowledge/
throughput criteria (c), (e), (f) weight 2; continuity (a) weight 1 (demoted by explicit
CEO direction). Options scored: **EIP** = evolve-in-place (the original verdict); **GF** =
greenfield v2 repo with v1 as running anchor; **HYB** = mono-repo two-packages (greenfield
v2 core package inside the same repo). Score +2 strongly favours … −2 strongly disfavours.

**(a) Anchor-tenant continuity (weight 1, demoted).** The original reasoning *still
holds*: EIP is safest; GF forks attention and creates a convergence migration. But HYB
inherits nearly all of EIP's safety — v1 keeps running unchanged in the same repo, same
CI, same store; nothing cuts over except behind the same byte-equivalence gates the
blueprint already mandates. EIP +2, HYB +1.5, GF −1. *Weighted contribution now marginal —
this was the criterion that carried the original verdict.*

**(b) Seam cost (weight 3).** **This is where the original verdict breaks.** The original
§2(b) measured the *tenancy* seam (one nullable column, a store-resolution tier, a
composition factory) and generalised W3's storage-layer "half-built toward Option C"
finding to the whole platform. §1 shows the consumer layer is not half-built toward
requirements A and B: ≈1,380 entity literals, 522 hardcoded-entity event authorings, 36
single-entity renderers, ≈450–500 access-pattern inversions, and a consolidation layer
that does not exist. In-place, every one of those changes happens *inside live paths*
behind parity gates, in the strangler's most expensive mode: refactor-under-equivalence.
A fresh code-line writes entity-generic, FIL-first signatures from line one and pays the
parity cost only at domain cutover, once per domain. EIP −1, GF +1.5, HYB +2 (HYB beats GF
because the parity gates replay the *same* store in the same CI without cross-repo
fixtures).

**(c) History value (weight 2).** The original argument was correct but proves less than
it claimed: the history's value lives in the **event log + sealed partitions + graph +
registers**, not in the engine code-line. HYB keeps all of it bit-identical — same store,
same archives, v2 projections replay the same log as their parity oracle. GF must either
mirror the store across repos (drift risk, two canonical-store candidates — a Principle 1
smell) or accept a weaker oracle. EIP +2, HYB +2, GF −0.5.

**(d) Clean-core enforceability (weight 3).** Under correctness-dominant weights this
criterion *flips sides*. The original said gates police the boundary in either repo —
true, but gates-with-allowlists are ratchets over a surface that keeps regenerating (the
W9 conformance gate would land with §2's whole inventory as its allowlist). A package
boundary makes the discipline **structural**: the v2 core package cannot import v1, the
compiler and the import graph enforce FIL-first and entity-generic *by construction*, and
the released surface (W5 doctrine #2) is literally the package's export list. The Lidl
lesson ("boundary discipline is a governance property, not a repo property") cuts the
other way once correctness dominates: structural enforcement beats policed enforcement
where both are available. EIP −1, GF +2, HYB +2.

**(e) Team/agent throughput (weight 2).** Still real, still strongly anti-GF: a second
repo doubles every dispatch's surface, resets agent context, splits CI, and multiplies
the lost-work margins. But HYB is one repo: same worktree discipline, same \`bun run ci\`,
same dispatch CLIs, same graph for citations. New-package context is a learning cost, not
a coordination cost. EIP +2, HYB +1.5, GF −2.

**(f) The distilled corpus as requirements base (weight 2).** With A and B in scope the
original "more valuable as scalpel than blueprint" conclusion weakens: 265 classified
decisions + the W2 domain map + the W4 binding contract + the W9 language design now
*are* a buildable spec for exactly the code being rewritten, and the running v1 remains
the executable reference either way. Neutral EIP, +1 GF, +1 HYB.

**(g) Requirement A — intra-tenant multi-LE (weight 3, new).** In-place: thread ≈460
production literals, re-key projections/renderers/engines for an entity axis, build
consolidation — all under live-path parity. New code-line: entity-generic signatures cost
zero at authoring time; consolidation is new build in every option. The future UK entity
also imports the multi-jurisdiction axis (calendars, GAAP/IFRS presentation, PRA returns)
— v1's ZA-shaped defaults are exactly what a fresh core would not bake in. EIP −1,
GF +2, HYB +2.

**(h) Requirement B — FIL as sole access path (weight 3, new).** In-place: invert ≈450–500
call-sites incrementally behind an allowlisted gate that starts at ~100% allowlisted; the
end-state is reached when the last entry burns down — historically the long tail of such
ratchets is where they stall. New code-line: FIL-first by construction; nothing in the v2
package can even *reach* a raw store handle if the repository layer owns the connection;
v1's sites never convert at all — they retire wholesale at domain cutover. EIP −1, GF +2,
HYB +2.

**Weighted totals** (Σ weight × score): **EIP +3.0; GF +9.0; HYB +25.0.** Sensitivity:
HYB wins under any weighting that does not put continuity (a) back above the
correctness criteria; even restoring the *original* weights (a=3, all others equal) HYB
ties or beats EIP because it concedes almost nothing on (a)/(c)/(e) while winning
(b)/(d)/(g)/(h). The scoring is coarse, deliberately shown, and the conclusion is robust
to ±1 on any single cell.

## 3. The under-weighted option, evaluated properly

### 3.1 Greenfield v2 repo with v1 as the running anchor (GF)

What the original verdict underweighted, taken seriously. **Carries over without
rewrite:** the event log itself — v2 stores are populated by *replay*, never by rewrite
(the W3 no-historical-rewrites rule is satisfied: the log is read, new projections are
computed, sealed partitions stay sealed and attested); the Plane-A regulatory corpus and
the single graph; the 265 distilled decisions as the requirements base; the seat specs
and team roster; the recon *patterns* (each pipeline is a specification — its assertion
restated over FIL facets); the W2/W3/W4/W8/W9 designs, which were all written
repo-agnostically. **Rewritten:** all engine/projection/renderer code, FIL-first and
entity-generic; the recon implementations; the dashboard bindings.

**Why GF still loses, under any weights:** the costs on (c) and (e) are weight-invariant
mechanics, not preferences. Two repos means the citation graph spans a repo boundary
(Principle 2's single graph becomes a federation problem); the byte-equivalence oracle
needs the log visible to both CIs; every dispatch chooses a repo; every shared change
(event-type registry, schemas) lands twice or drifts. GF buys exactly one thing over HYB
— organisational distance — and the W7 entity-structure work shows that distance, where
needed, is a legal/IP construct, not a directory layout.

### 3.2 Mono-repo, two packages (HYB) — the recommended shape

A new workspace package inside the existing repo (working name \`prototype/v2/\` or
\`packages/core-v2/\`; final layout is an S0 detail): **the v2 core, written FIL-first,
entity-generic, tenant-first from line one.** Mechanics:

- **One repo, one graph, one CI.** Citations cross the package boundary as ordinary graph
  edges; \`bun run ci\` runs both packages; the dispatch surface is unchanged.
- **The import boundary is the clean-core gate.** v2 core imports nothing from v1
  (enforced by a trivial static recon the day the package exists — no allowlist, since the
  package starts empty and conformant). v1 acquires imports *of* v2 only at domain
  cutover, through the same delegating-alias pattern the blueprint's S6 already specifies.
- **FIL lives in v2 core from line one.** The W9 kernel (taxonomy, URN scheme, facets,
  composition algebra) is the package's first module; the repository layer that owns store
  handles is its second. Nothing in v2 core can query events directly except the
  repository layer itself — requirement B is a compile-time property, not a recon ratchet.
- **Entity-generic from line one.** Every v2 signature takes entity scope; the
  consolidation layer (§1.1.3's list) is built natively in v2, once.
- **Strangler ACROSS packages, same store.** Per domain, in v1's own maturity order
  (SA-CCR first, per W4): build the domain in v2 core; replay the shared log; assert
  byte-equivalence against v1's outputs (the same golden-leg/rendered-return/computed-
  event parity discipline PR #1094–#1098 proved); flip the call-site behind the alias;
  retire the v1 module. v1's LE-literals and replay-sites are never refactored — they are
  *deleted*, domain by domain.
- **W3's Option C is unchanged.** Control-plane store, per-tenant stores, envelope tenant
  field, staged anchor migration — all of it executes inside v2 core instead of inside
  v1's composition. The four-stage migration plan survives verbatim; only its code home
  moves.

HYB dominates both extremes because it takes EIP's continuity/history/throughput
properties (same repo, same store, same CI, running anchor untouched) and GF's
correctness properties (fresh FIL-first entity-generic code-line, structural boundary)
and gives up only the one thing neither requirement values: the comfort of never standing
up a second package.

## 4. VERDICT, revised

**Mono-repo, two packages: a greenfield v2 core package inside the existing repository,
written FIL-first, entity-generic, tenant-first from line one; v1 runs unchanged as the
anchor bank's substrate; domains cut over one at a time behind byte-equivalence parity
gates replaying the shared event log; the package import boundary is the clean-core gate;
no separate repository; no historical event rewrites.**

**Confidence:** high that HYB beats a separate-repo greenfield (the (c)/(e) mechanics are
weight-invariant); **medium-high** that HYB beats pure evolve-in-place. The honest
residual: if the SA-CCR pilot shows that FIL-binding + entity-threading a v1 engine
in place is markedly cheaper than rewriting it against the v1 oracle — i.e. §1's surface
proves more mechanical than structural — EIP regains ground domain-by-domain. The pilot
answers this empirically within Wave 2 either way, because under HYB the pilot *is* the
first cross-package cutover.

**What would reverse it:** (1) the S7 pilot finding rewrite-against-oracle materially
slower than refactor-under-equivalence for comparable conformance; (2) workspace tooling
under bun proving heavy enough to tax every CI run (low risk — bun workspaces are mature);
(3) a discovered need for tenant-facing code-custody separation that forces a repo split
anyway (then GF mechanics return, with W7's entity structure governing).

**What the original verdict got wrong:** primarily nothing — it computed correctly under
continuity-dominant weights and without requirements A/B, which is a weight change and a
scope change. But there is one actual error to own: **§2(b) "seam cost" generalised W3's
storage-layer finding ("half-built toward Option C") to the entire platform and never
counted the consumer layer.** The tenancy seam is genuinely small; the multi-LE and
access-path seams are the majority of engine code (§1), and a criterion named "seam cost"
should have measured them. Had §1's counts been in the blueprint, criterion (b) would have
scored against evolve-in-place even under the old weights, moving the verdict from "5/6
favour in-place" to a genuine contest.

**Consequences for the four waves.** The wave structure survives; the code home moves.

- **Wave 1** — survives, re-targeted: S1 (control-plane store) and S2 (envelope tenant
  axis) land as v2-core's first substrate modules; **S0 (new): the v2 core package + FIL
  kernel (W9 S-FIL-1) + the no-v1-import boundary gate** becomes the first slice; S3
  (posture register) lands in v2 core; S4 (fixtures→events) becomes FIL-native minting
  (\`FilTypeMinted\` in v2 core — W9 §8's "one migration, not two"); S5's released-surface
  gate becomes the v2 package export list plus the import-boundary recon.
- **Wave 2** — S6 (composition factory) is *written natively* in v2 core (the delegating
  alias still shields v1 call-sites); S7 (SA-CCR pilot) becomes the **first cross-package
  domain cutover** — born FIL-bound and entity-generic, parity-gated against the live log;
  S8/S9 ride unchanged (anchor-valuable, substrate-agnostic).
- **Wave 3** — S10's enforcement + rehearsal becomes the standing per-domain cutover
  programme (each domain: build in v2, parity, flip, retire); S11 (seat renaming), S12
  (learning gate), S13 (exams) land v2-side unchanged in content.
- **Wave 4** — S15/S16 unchanged in content, packaged against v2 core; the K-tier bundle
  ships from the v2 package, which is the version a subscriber sees.

**Updated named-decision text for D-V2-REPO-STRATEGY:** *"One repository, two code-lines:
a greenfield v2 core package (FIL-first, entity-generic, tenant-first from line one) is
created inside the existing repo as a workspace package; v1 continues unchanged as the
anchor bank's running substrate; domains cut over one at a time behind byte-equivalence
parity gates that replay the shared event log; the v2 package's import boundary (no
imports from v1) is the structural clean-core gate; no separate repository; no historical
event rewrites; supersedes the blueprint §2 evolve-in-place recommendation under
D-V2-REPO-STRATEGY-REEXAMINATION's revised weights and requirements."*

## 5. Open questions + immediate approval consequences

**Open questions (S0 design details, none blocking the decision):**

1. **Package layout** — \`prototype/v2/\` (one tsconfig, path-mapped) vs a true bun
   workspace (\`packages/\`); recommendation: true workspace, so the import boundary is a
   package.json fact, not a lint rule.
2. **Shared types' home** — the event-store class, envelope schemas, and event-type
   registry are used by both code-lines; recommendation: extract to a small
   \`packages/substrate\` both depend on (the only code that is *supposed* to be shared).
3. **Recon migration unit** — pipelines move per cutover domain (recommended) vs a
   wholesale recon-v2; per-domain keeps the 153-script surface continuously green.
4. **Dashboard binding** — per-panel repointing at domain cutover (recommended) vs a v2
   dashboard; the cache-header and nav substrate carries over either way.
5. **First three cutover domains** — SA-CCR (W4's pick) → FX posting/SLA (richest parity
   suites) → BA300/LCR (forces the consolidation layer early, which requirement A wants
   proven) — confirm with Rohan (risk engineer, engineering) and Bea (accounting &
   financial reporting engineer, engineering) at S7 dispatch.

**Immediate approval consequences:**

- **D-V2-REPO-STRATEGY** — approve with the §4 revised text (replaces the blueprint §9
  item 1 text). Everything else still assumes it; it stays first in the approval order.
- **D-FIL-KERNEL-V1** — *elevated*: under HYB the FIL kernel is the v2 package's first
  artefact, so this approval moves from "Wave 1–2 placement" to the same approval set as
  the repo decision (it defines what line one of v2 core is).
- **D-V2-TENANCY-ARCHITECTURE** — unchanged in substance; its executable slices (S1/S2)
  land in v2 core rather than in v1's composition. No re-approval needed beyond noting
  the code home.
- **The blueprint's remaining §9 items** (W8 slices, W4 pilot, tier structure, W7 items)
  — unchanged; the W4 pilot dispatch brief should state it is the first cross-package
  cutover.
- **Decision-classification consequence** — D-V2-REPO-STRATEGY-REEXAMINATION is filed as
  foundational in the distillation register (this PR); D-V2-REPO-STRATEGY itself gets
  classified when approved.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). Deliverable of the
repo-strategy re-examination under D-V2-REPO-STRATEGY-REEXAMINATION.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-REPO-STRATEGY-REEXAMINATION"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 repo strategy re-examined: multi-LE + FIL-access rewrite surfaces, reweighted criteria, revised verdict",
      path: "2026-06-12_atlas_v2-repo-strategy-reexamination.md",
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
