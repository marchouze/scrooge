// scripts/file-atlas-v2-bbaas-w8-agent-learning.ts
//
// One-shot RMS Phase 3 filing for Atlas's W8 agent-learning architecture
// paper for the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits
// a RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W8-AGENT-LEARNING (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-w8-agent-learning:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-w8-agent-learning] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W8 agent learning architecture: posture register, applicability assessments, impact sweeps, training mechanisms

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W8-AGENT-LEARNING (CEO-approved 2026-06-12); builds on the session-1
initial ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12, §3.1),
the W2 domain map, and the W3 tenancy architecture
(record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12)
**Audience:** Marc (CEO)
**Status:** Analysis only. Nothing here builds the posture register or any other slice;
§9 names the slices, §11 names the decisions, and both are Marc's to take or refuse.
**Ratified direction taken as given:** structured-first — "weights propose, events dispose."
Event/graph mechanisms are the system of record for everything an agent knows;
LoRA-class parametric training is rejected as system of record (§7) and may only ever be
layered on as proposers trained *from* the corpus.

---

## 1. The two motivating failure cases against the current substrate

### 1.1 Case A — applicability: "this instrument doesn't bind us"

The canonical example: a Prudential Authority instrument concerning the Internal Models
Approach (IMA) for market risk lands in the regulatory pipeline. This bank computes market
risk under the Standardised Approach. A competent human compliance officer glances at the
title and files it as "noted, not applicable." Today's agents cannot make that move
*mechanically and citably* — and worse, cannot be *audited* on having made it.

What the substrate already has, verified in-tree on main 2026-06-12:

- **Provision trees.** \`buildProvisionTree\` over per-instrument \`structured.json\`
  extracts (\`platform/regulatory/graph/provision-tree.ts\`), with deterministic provision
  ids and \`computeScopeVerbatimHash\` for any scope node. 155 instruments; the BCBS corpus
  alone carries 123 chapters of paragraph-level text (\`Regulations/BCBS/chapter-text.json\`).
- **Adoption anchored to text.** \`ProvisionScopeAdopted\`
  (\`platform/event-store/event-types/obligation-lifecycle.ts\`) records every tick/untick
  with a SHA-256 \`verbatimHash\` of the text in force at tick time; resolution is
  latest-covering-event-wins; \`recon:provision-tick-drift\`
  (\`platform/recon/provision-tick-drift.ts\`) recomputes hashes against current text and
  surfaces drift as review prompts.
- **Tick-to-obligation distillation.** \`POST /api/regulation-reader/:slug/distill\`
  (\`prototype/dashboard/server.ts\`, the \`DISTILLATION_SYSTEM_PROMPT\` /
  \`DistillationProposal\` machinery) takes the adopted leaves of a scope, asks an LLM to
  cluster them into 1–5 coherent obligation groups, and routes every proposal through human
  review before \`ObligationAdopted\` is emitted — with \`verbatimSourceText\` snapshots
  per contributing provision frozen into the adoption payload.
- **The obligations register as projection** (\`platform/obligations/projection.ts\`) over
  \`ObligationAdopted\` / \`ObligationLifecycleTransitioned\`, with \`derivesFrom\` bridging
  to Plane A.
- **The two-plane graph** with a 19-type node vocabulary and ~30-type edge vocabulary
  (\`platform/regulatory/graph/ontology-schema.ts\`) — including, notably, a
  \`CONDITIONAL_ON\` edge type and a \`Threshold\` node type that already gesture at
  conditionality but are populated ad hoc by extraction, not bound to any bank fact.
- **The DecisionDistilled register**
  (\`platform/governance/decision-distillation/register.ts\`): 259 classified decisions
  exposing the foundational/directional/obsolete seam.

What is missing is exactly one thing, with consequences everywhere: **there is no
machine-readable representation of what kind of bank this is.** "We are a Standardised
Approach bank" exists only as prose in policies and in the heads of sessions. So the
IMA-instrument question cannot even be *posed* to the substrate: applicability is a join
between provision-side conditions and bank-side facts, and the bank-side relation does not
exist. Every adoption tick implicitly *encodes* an applicability judgement (someone decided
to tick or not), but the judgement's *reason* is discarded — unticked scopes are
indistinguishable between "not applicable to our posture", "applicable but not yet
reviewed", and "missed". That indistinguishability is the audit hole.

### 1.2 Case B — impact: "this decision has unconsidered consequences"

Second canonical example: a decision is proposed — say, expanding the FX product scope, or
re-designating a book — and an agent that has read the accounting standards for the product
should notice that the proposal touches hedge-accounting treatment, the trading-book
boundary, and two BA returns that nobody cited. Today the \`Decision\` event carries
\`citations\` (minimum one, enforced by the envelope schema), and the graph knows what those
cited nodes connect to — but **nothing walks the graph at decision time.** The check that
the citation set covers the blast radius is performed, if at all, by whichever agent happens
to be in session, with no record of what was checked. The 2026-06-08 FX review arc is the
empirical case: the redundant-engine retirement initially missed that the engine owned
cancel-time MTM-undo — a consequence that was *in the graph* (the engine REALISED a
procedure citing PR-FX-004) but was found by a human-prompted review, not by a sweep.

Both failures are the same failure. The agents' knowledge is real but *unstructured at the
point of use*: the corpus exists, the graph exists, but neither applicability nor impact is
a mechanical, citable query. The W8 answer is to make both into joins — which requires the
missing relation (§2–§3) and the missing walk (§5).

## 2. Posture-dimension discovery at scale

The naive fix for Case A is to hand-design a schema: an enum for credit approach, an enum
for market-risk approach, a flag for trading book. That fails at scale — the corpus
conditions on hundreds of facts, and a designed schema is always behind the corpus. The
ratified design inverts it: **the schema is discovered from the corpus, dimension by
dimension, through the same extract-review-adopt machinery that already governs
obligations.**

### 2.1 What the corpus actually conditions on — a grounded sample

I sampled 38 substantive provisions across 19 BCBS chapters (CRE20/30/40/51, MAR10/11/20/30,
RBC20/25, OPE10/25, NSF30, LCR30, DIS10, SRP30, CAP30, LEV20, SCO10 — random within
chapter, seeded), and pattern-scanned all 121 PA Banks-Act instruments in
\`Regulations/Banks/source-docs/*-structured.json\`. The conditioning dimensions found:

| # | Dimension (proposed id) | Kind | Sample evidence | PA-corpus frequency |
|---|---|---|---|---|
| 1 | \`approach.credit-rwa\` (SA / F-IRB / A-IRB) | declared election | CRE30.2, CRE30.18 gate whole chapters; banks-d7-2015 splits §5 (IRB) vs §6 (SA) | 289 matches / 17 of 121 instruments |
| 2 | \`approach.market-risk\` (simplified / SA / IMA) | declared election + supervisory approval | MAR11.8 three-way split; MAR30 entirely IMA-gated | 19 / 4 |
| 3 | \`approach.operational-risk\` (SMA; legacy AMA) | declared (now degenerate) | OPE25.1 | 30 / 3 (legacy AMA refs) |
| 4 | \`entity.class\` (bank / controlling company / foreign branch) | derived from legal-entity tree | every PA instrument's \`applicableTo\` block; SCO10.2 | 567 + 227 / **121 of 121** |
| 5 | \`entity.consolidation-level\` (solo / sub-consolidated / consolidated) | derived | SCO10.4, OPE10.5, MAR20.2 | 76 / 23 |
| 6 | \`designation.d-sib\` / internationally-active | regulator-assigned fact | RBC20.1 footnote (D-SIB buffer), SCO10.1 | 227 / 16 |
| 7 | \`jurisdiction.external-ratings-allowed\` (ECRA vs SCRA) | jurisdiction fact | CRE20.15 splits the MDB risk-weight table on it | n/a (SA: allowed) |
| 8 | \`activity.securitisation\` (+ STC, correlation-trading sub-facts) | derived from products | CRE40.26 originator-conditioned; MAR20.5 CTP-conditioned | 298 / 11 |
| 9 | \`activity.trading-book\` (existence; boundary deviations) | derived + permission | RBC25.5 designation duty; RBC25.10 deviation needs explicit approval | 20 / 8 |
| 10 | \`activity.otc-derivatives\` (CVA scope) | derived | MAR10.34; CRE51.11 | 117 / 19 |
| 11 | \`membership.ccp\` (clearing member / client / none) | derived from counterparty events | CRE51.9 three-way split | — |
| 12 | \`permission.supervisory\` (a *register* of specific approvals) | regulator-granted fact | RBC25.10, MAR20.2 quarterly-reporting approval, MAR11.7 simplified-alternative permission | 2 explicit "prior approval" hits in skeleton extracts; dense in full text |
| 13 | \`size.bi-bucket\` (op-risk Business Indicator bucket 1/2/3) | derived from GL | OPE10.5 bucket-2 loss-data duty | 5 / 4 |
| 14 | \`profile.complexity\` (proportionality) | assessed | DIS10.16 "proportionate to a bank's complexity" | — |
| 15 | \`activity.islamic-banking\` | derived | — (PA corpus only) | 20 / 7 |
| 16 | \`accounting.framework\` (IFRS 9 / local GAAP) | declared | CAP30.11/30.15 presuppose fair-value and CFH reserves | — |

Of the 38 sampled provisions, **17 were unconditional** (bind any bank in scope of the
framework — LCR30.17, NSF30.14, SRP30, LEV20, RBC20.1 main text) and **21 carried at least
one conditioning clause**, drawn from just the 16 dimensions above — about 1.3 dimensions
per conditional provision, with heavy reuse. The PA-corpus scan confirms the shape:
\`entity.class\` appears in literally every instrument (121/121 — it is the boilerplate
applicability block), the approach dimensions cluster in the capital-framework instruments
(17/121), and the tail thins fast (custody 2 instruments, Islamic banking 7).

**This is the power-law claim, and the sample supports it.** A handful of dimensions
(entity class, consolidation level, the three approach elections, trading-book existence,
securitisation activity, D-SIB designation, supervisory permissions) do almost all the
conditioning work across thousands of provisions; a long tail of rare dimensions
(correlation-trading portfolio, covered-bond issuance, Islamic windows) each gate a few
provisions. Extrapolating from 16 dimensions in 38 provisions with strong reuse, across the
full 155-instrument corpus plus FIC/FSCA/POPIA conduct dimensions (accountable-institution
class, FAIS licence categories, special-person data processing) and tax/IFRS dimensions,
the working estimate is **~60–120 distinct PostureDimensions at full SA-corpus coverage,
comfortably inside the ratified 50–200 band** — small enough for a controlled vocabulary
with human-gated minting, large enough that hand-designing it up front would fail.

**A recall caveat the sample exposed.** The PA-side scan ran over the structured extracts,
and several pre-2018 PA directives are skeleton-tier (headings present, body text thin —
the known GAP-PA-SOURCE-OCR deferral: SARB serves image-only scans for older instruments,
and \`recon:regulatory-source-extract-quality\` allowlists 48 such extracts). Directive
D7/2015, for instance, *titles* its §5 "IRB approach" and §6 "Standardised approach" but
carries almost no body text, so clause-level extraction there would find the conditioning
only in headings. Posture-dimension extraction recall is therefore bounded by extract
quality, and the §2.6 coverage gate must treat skeleton-tier instruments as
awaiting-fact-class items (extraction pending better source), not as unconditional — a
silent "no conditioning clause found" over a skeleton extract would be exactly the wrong
default. The BCBS corpus has no such gap; the pilot family (§9) deliberately leans on it.

### 2.2 Extraction-driven discovery (schema discovered, not designed)

Mechanism: extend the existing tick-to-obligation distillation pass. The \`/distill\` route
already sends adopted provision texts to an LLM and gets structured proposals back for
human review. The W8 extension adds a second extraction product per provision: the
**conditioning clauses** — "this provision applies when/unless …" — each emitted as a
proposed \`(dimension, predicate)\` pair. The prompt change is small; the review UI change
is the same three-state pattern the tick UI already has. Extraction runs at ingestion for
new instruments and as a backfill sweep over already-adopted scopes (the 38-provision
sample above is, in effect, the manual pilot of that sweep).

### 2.3 Dimension reuse and the minting gate

Extracted conditioning clauses do not mint dimensions freely. Each proposed clause
**entity-resolves against the existing PostureDimension vocabulary** (string-similarity +
LLM-assisted matching against dimension ids, names, and FIBO-aligned synonyms — FIBO
naming where a concept maps cleanly, e.g. entity classes and consolidation, so cross-tenant
and cross-jurisdiction vocabularies converge). A clause that resolves to an existing
dimension just adds an APPLIES_WHEN edge (§3). A clause that resolves to *nothing* becomes
a **dimension-minting proposal routed through human review** — the exact pattern obligation
adoption uses (LLM proposes, seat disposes). The power-law makes this cheap: minting is
front-loaded (the first capital instrument mints \`approach.credit-rwa\`; the next sixteen
reuse it) and asymptotes fast.

### 2.4 Derived vs declared posture

Most posture facts must **not** be declared, because they are already derivable —
Principle 1 says so. The split:

- **Derived (projections over the event store; the large majority):** products held
  (markets product events), trading-book existence and size, OTC-derivative activity,
  securitisation activity (none today), CCP membership (counterparty events),
  BI bucket (GL projection), jurisdictions of operation (legal-entity tree),
  entity class and consolidation level (Party register + legal-entity tree).
  A derived dimension's value carries the projection's citation and is *never stale by
  construction* — it moves when the underlying events move.
- **Declared (genuine elections; the small minority):** the approach elections
  (credit/market/op-risk), accounting-framework choices, opt-ins (simplified alternative),
  and regulator-granted facts that arrive as correspondence (D-SIB designation, specific
  supervisory permissions). These are emitted as \`RegulatoryElectionDeclared\` events (§3)
  by the owning seat, with the supporting document hash where the fact is
  regulator-granted.

The discipline: **a dimension may be declared only if no projection can derive it.** A
recon assertion holds the line (a declared dimension whose value is also derivable, and
disagrees, is a finding).

### 2.5 Three-valued verdicts and the missing-fact work queue

An APPLIES_WHEN predicate referencing a dimension with no value does not silently default.
The applicability verdict is three-valued: **applies / does-not-apply / conditional —
posture fact required.** The third value materialises as a typed work item routed to the
dimension's owning seat (§3.3 routing), prioritised by **provision fan-out** — the
dimension blocking the most provisions gets asked first. This converts schema-incompleteness
from a silent wrong answer into a visible, owned, counted queue.

### 2.6 recon:posture-dimension-coverage

The standing gate: every active provision in every adopted instrument must be in exactly
one of three states — **resolved** (verdict computed from posture, citations attached),
**awaiting-fact** (in the §2.5 queue, owned and counted), or **unconditional** (no
conditioning clause extracted, binds in scope). Anything else — a conditioning clause with
no dimension, a dimension with no owner, a verdict citing a stale posture value — is a
finding. This is the posture analogue of \`recon:provision-tick-drift\`, and like it,
advisory first, enforcing once the pilot instrument family is clean.

## 3. Bank-posture register design

### 3.1 Event family

\`\`\`ts
// platform/event-store/event-types/regulatory-posture.ts — W8 sketch (NOT implemented)

// A dimension is minted into the controlled vocabulary (human-gated, §2.3).
export const postureDimensionMintedPayloadSchema = z.object({
  dimensionId: z.string().min(1),        // "approach.market-risk"
  name: z.string().min(1),               // FIBO-aligned where possible
  kind: z.enum(["declared", "derived", "regulator-granted"]),
  valueSchema: z.unknown(),              // JSON-schema for permissible values
  owningSeat: z.string().min(1),         // routing target for awaiting-fact items
  derivation: z.string().optional(),     // projection ref, required iff kind=derived
  fiboRef: z.string().optional(),
});

// A genuine election / regulator-granted fact is declared (kind != derived only).
export const regulatoryElectionDeclaredPayloadSchema = z.object({
  dimensionId: z.string().min(1),
  value: z.unknown(),                    // validated against the dimension's valueSchema
  declaredBy: z.string().min(1),         // seat
  effectiveFrom: z.string().min(1),
  basis: z.enum(["election", "regulator-granted", "default"]),
  supportingDocHash: z.string().optional(), // approval letter etc. (document store)
  supersedes: z.string().optional(),     // prior declaration event_id
});
\`\`\`

The **posture projection** folds \`PostureDimensionMinted\` + \`RegulatoryElectionDeclared\`
(latest-per-dimension wins, same resolution shape as provision ticks) and joins the derived
dimensions' projections at read time. Its output is the **bank-posture register**: one row
per dimension — value, kind, owner, citation, as-of, staleness anchor. For the anchor
tenant the seed register is small and known: \`approach.credit-rwa = SA\`,
\`approach.market-risk = SA\`, \`approach.operational-risk = SMA\`,
\`entity.class = bank (in formation)\`, \`designation.d-sib = false\`, plus the derived rows.

### 3.2 APPLIES_WHEN edges and predicate shape

Provision-side conditionality lands in the graph as **APPLIES_WHEN edges** from Provision
(or any scope node — chapter-level gating like MAR30 attaches once at the chapter) to
PostureDimension, each carrying a typed predicate:

\`\`\`ts
// Edge payload sketch
{ edgeType: "APPLIES_WHEN",
  from: "bcbs:MAR30",                    // scope node — inherits to descendants
  to: "posture:approach.market-risk",
  predicate: { op: "eq", value: "IMA" }, // eq | neq | in | gte | lte | exists
  polarity: "binds-when-true",           // or "exempt-when-true"
  extractedFrom: "MAR30.1",              // provision carrying the clause
  verbatimHash: "..." }                  // drift anchor on the conditioning text itself
\`\`\`

Predicate expressiveness is deliberately minimal — flat comparisons over one dimension,
conjunction expressed as multiple edges on one scope (all must hold), disjunction as
sibling scopes. No arbitrary boolean trees, no computation inside predicates: anything that
needs arithmetic (BI buckets, thresholds) is computed in the *derived dimension's
projection*, not in the predicate. This keeps every predicate human-readable in review and
mechanically auditable — the §10 open question is whether this survives contact with the
gnarliest provisions, and the pilot (§9) is designed to answer it. The existing
\`CONDITIONAL_ON\` edge type and \`Threshold\` node type in the ontology are subsumed:
APPLIES_WHEN is CONDITIONAL_ON made executable.

Applicability for any provision is then literally a join:
**verdict(provision) = fold of APPLIES_WHEN predicates on the scope chain against the
posture register**, three-valued per §2.5, with the verdict's citation set = the predicate
edges + the posture rows consulted. The IMA instrument from Case A resolves to
does-not-apply citing \`approach.market-risk = SA\` declared by the CRO seat on date X —
exactly the auditable artefact the human compliance officer never writes down.

### 3.3 Seat routing for dimension classes

Following the decision-authority routing table (CLAUDE.md): approach elections and
risk-posture dimensions → **CRO seat** (Helena); accounting-framework dimensions → **CFO
seat**; AML/accountable-institution class → **CCO seat**; funding/liquidity elections
(e.g. RCLF usage) → **Treasurer seat**; entity-class/consolidation (derived) → **CoSec
seat** owns the legal-entity tree they derive from; supervisory permissions register →
**CoSec** (correspondence) with the substantive seat as reviewer. Every dimension row
carries its \`owningSeat\`; the §2.5 queue routes on it.

## 4. ProvisionApplicabilityAssessed lifecycle

Verdicts are not just computed — they are *adopted*, because an applicability call is a
compliance position the bank must stand behind.

\`\`\`ts
export const provisionApplicabilityAssessedPayloadSchema = z.object({
  instrumentSlug: z.string().min(1),
  scopeId: z.string().min(1),
  verdict: z.enum(["applies", "does-not-apply", "conditional"]),
  postureRefs: z.array(z.object({       // exact posture rows the verdict consulted
    dimensionId: z.string(),
    value: z.unknown(),
    sourceEventId: z.string(),          // the declaration / projection anchor
  })),
  predicateEdgeIds: z.array(z.string()),
  verbatimHash: z.string(),             // provision text at assessment time
  assessedBy: z.string(),               // seat (proposals are LLM; adoption is seat)
  basis: z.enum(["mechanical-join", "seat-judgement", "correction"]),
});
\`\`\`

**Lifecycle: proposal → review → event.** The mechanical join (§3.2) produces *proposals*;
the owning seat reviews and adopts — same pattern as distill-to-obligation. Where the seat
*overrides* the mechanical verdict, the event records \`basis: "correction"\` and the
divergence is gold: **every human correction is a stored labeled example** — (provision
text, posture state) → correct verdict — accumulated in the event log with no extra
machinery. This is the labeling factory: the review gates the substrate already runs for
obligations, decisions, and now applicability generate, as a by-product, exactly the
supervised dataset any future parametric proposer (§7) would train on.

**Re-open semantics — the verbatimHash pattern generalised.** An assessment goes stale on
either side of the join:

- *Provision side:* text drift — recomputed hash ≠ \`verbatimHash\`, exactly
  \`recon:provision-tick-drift\` extended to assessments.
- *Posture side:* any posture row in \`postureRefs\` superseded by a later declaration or a
  moved derivation → every assessment citing it mechanically re-opens. The day the bank
  elects IMA, every does-not-apply verdict citing \`approach.market-risk = SA\` re-enters
  the review queue, prioritised by fan-out — the regulatory-change-management process most
  banks run as a spreadsheet, here as a projection.

Both staleness classes surface through one gate, \`recon:applicability-assessment-drift\`
(advisory → enforcing), and re-opened assessments are work items routed like §2.5.

## 5. Decision impact sweeps

Case B's fix is a walk, not a register. At **Decision-requested phase** (the substrate
already has \`requestDecision\` distinct from approval — \`runtime/decisions/record.ts\`),
a sweep runs:

1. Take the decision's \`citations\` (envelope-enforced, min 1).
2. Resolve each citable to graph nodes; walk outward over the typed edges that carry
   consequence — IMPLEMENTED_BY, REALISES/REALISED_BY, DERIVES_FROM, SERVES, GOVERNS,
   REQUIRES_REPORT, APPLIES_WHEN — to a bounded depth (2–3 hops, per-edge-type weights).
3. The reachable set minus the cited set = the **unconsidered-impact list**: obligations,
   policies, procedures, capabilities, returns, and posture dimensions the decision
   plausibly touches but does not cite.
4. Surface the list on the decision card *before* approval; the approving seat either
   extends the citations, annotates why an item is out of scope, or proceeds with the gap
   recorded.

The accounting-standards example runs exactly this way: a product-scope decision cites the
product node; the walk reaches the IFRS-9 obligations DERIVES_FROM-linked to it, the
hedge-accounting policy IMPLEMENTED_BY-linked to those, the BA-return ReportingRequirement
nodes, and — via APPLIES_WHEN — any posture dimension the product's existence would flip
(a first securitisation flips \`activity.securitisation\` and with it dozens of dormant
CRE40 verdicts; the sweep says so before approval, which is Case A and Case B closing into
one mechanism).

**\`recon:decision-impact-coverage\`:** every \`Decision(approved)\` after the gate's
activation date must have a stored sweep result (\`DecisionImpactSwept\` event) with each
unconsidered item dispositioned (cited / annotated / accepted-gap). Advisory over the
historical corpus — retro-sweeping the 259 classified decisions is itself a useful audit —
enforcing for new decisions.

**Precedent retrieval** rides the same moment: the DecisionDistilled register is queried
for past decisions whose citation/impact sets overlap the proposal's ("similar past
decisions also touched X — D-IRS-FAMILY-CONVERGE-ACCOUNTING dispositioned this same
obligation"). Cheap at 259 rows (set-overlap scoring), and the W1 classification gives the
seam for free: foundational precedents travel cross-tenant, directional ones do not.

## 6. Training mechanisms

"Training" here means: mechanisms that make agents *measurably better over time* at using
the structured substrate — all event-recorded, none parametric.

- **Per-seat context packs.** The executable form of agent-spec §8 (Inputs): a versioned,
  projection-derived bundle per seat — the posture register slice the seat owns, its open
  awaiting-fact and re-opened-assessment queues, the playbooks and precedents tagged to its
  mandate, its frozen exam set (below). Packs are *built from the store at session start*,
  not hand-maintained; a pack build is itself loggable, so "what did the agent know when it
  acted" is answerable — the substrate-gap version of this paper's own dispatch.
- **Counterfactual posture drills.** On a scenario store (\`BANK_EVENT_DB\` to a tmpdir —
  the proven harness), flip one election (\`approach.credit-rwa\` SA→F-IRB) and assert the
  derived applicability set changes *exactly* as expected: known IRB chapters flip to
  applies, known SA-only provisions flip off, fan-out counts match. Failures are either
  predicate-extraction defects or genuine corpus surprises; both are findings. These drills
  are regression tests for the knowledge base itself.
- **Adversarial challenge passes.** A reviewer-class run periodically re-litigates a sample
  of past approved assessments and decisions against current knowledge ("find three adopted
  verdicts most likely wrong"). Confirmed misses become labeled examples *and* recon seed
  cases — the PR #610 pattern (the canonical incident the dispatch-sync recon asserts)
  applied to knowledge: every confirmed miss is pinned as a permanent regression assertion.
- **Frozen exam sets gating seat-spec changes.** Per seat, a fixed basket of
  (scenario, question, expected-verdict-with-citations) items — drawn from the labeling
  factory's confirmed examples. Any change to a seat spec, context-pack recipe, or
  underlying model binding must re-run the exam and not regress (\`recon:seat-exam-…\`
  pipelines). This is regression-gated learning: the substrate may evolve, demonstrated
  competence may not degrade silently. Exams are also the **base-model-upgrade gate** — when
  the API model under a seat changes, the exam says whether the seat still passes.
- **Consolidation ticks.** Per K input events (agent-time cadence, per CLAUDE.md), a seat
  runs a consolidation pass over its recent corpus — corrections absorbed, repeated
  patterns distilled — emitting \`KnowledgeDistilled\` playbook entries (the W1
  DecisionDistilled pattern generalised beyond decisions: "when X class of finding, Y
  remediation worked, citing Z precedents"). Playbooks are events, so they expire, supersede,
  and cite like everything else.

## 7. Parametric-training assessment (the recorded position)

The CEO-ratified rejection of LoRA-class fine-tuning as system of record, with the full
argument recorded so the position is revisitable on evidence:

1. **Weights cannot cite.** Every artefact in this bank carries citations upward
   (Principle 2, envelope-enforced min-1). A fine-tuned weight delta is the one artefact
   class that structurally cannot say where it came from. An applicability verdict "from
   the model" with no postureRefs is unusable in front of a regulator — and unusable
   under the bank's own P2 gate.
2. **No selective staleness or expiry.** The substrate's whole drift machinery
   (verbatimHash, posture re-opens, supersedes chains) depends on knowledge being
   addressable. You cannot expire one amended directive out of a LoRA; you can only
   retrain. Structured knowledge goes stale row by row; parametric knowledge goes stale
   all at once and invisibly.
3. **Gradient memorisation leaks across the tenant boundary.** W3 made isolation
   structural — per-tenant stores, a reviewable generalisation gate for anything shared.
   An adapter trained on tenant A's corpus can verbatim-regurgitate tenant A's positions
   to tenant B; extraction attacks on fine-tunes are demonstrated practice. Symbolic
   artefacts pass a review gate item by item; gradients cannot be reviewed item by item
   even in principle. Under W3 this is disqualifying, not merely risky.
4. **Adapter-rot on API base-model upgrades.** The seats run on frontier API models that
   upgrade on the provider's cadence (this project has already lived through model-binding
   churn). Adapters are trained against a specific base; every upgrade orphans them.
   The structured corpus is model-agnostic by construction — the same context pack briefs
   whatever model holds the seat.
5. **In-context retrieval beats small fine-tunes for reasoning at current frontier
   capability.** The motivating cases are *reasoning* failures over *missing structure*,
   not capability failures: given the posture register row, the frontier model gets the
   IMA case right trivially. Fine-tuning adds least exactly where the gap is.
6. **Option-value asymmetry.** Corpus-first preserves the fine-tune option — the labeling
   factory (§4) is accumulating the ideal supervised dataset, with provenance, for free.
   Fine-tune-first destroys the corpus option: the knowledge would live in weights with no
   per-item provenance to extract back out. One ordering is reversible; the other is not.

**Where parametric assists ARE appropriate — "weights propose, events dispose":** ranking
and pre-fill, never disposition. A triage ranker ordering the §2.5 awaiting-fact queue or
flagging likely-wrong assessments for the adversarial pass; a pre-fill proposer drafting
APPLIES_WHEN predicates or distillation clusters for review. In every case the output
enters the same human/recon-gated review the LLM-distill output enters today, and the
event that disposes carries citations. Proposers may be trained from the corpus precisely
*because* the corpus is the system of record; the reverse would not hold.

## 8. Cross-tenant carrier

The W3 split (shared control plane / per-tenant stores) gives W8 its carrier for free:

- **Shared core (control-plane store):** the PostureDimension vocabulary and value schemas,
  APPLIES_WHEN predicate edges (they are facts about *regulation*, Plane A — tenant-free by
  construction), exam-set definitions, foundational playbooks and precedents, drill
  scenario templates.
- **Per tenant (tenant store):** the posture register values (\`RegulatoryElectionDeclared\`
  and derived rows), every \`ProvisionApplicabilityAssessed\` verdict, corrections,
  directional precedents, exam *results*.

The product consequence is the headline: **the same provision yields a different cited
answer per tenant, mechanically.** Tenant A (IMA, D-SIB) and tenant B (SA, not designated)
subscribe the same Plane-A corpus and the same predicate edges; the join against their own
posture registers produces disjoint applicability sets, each citing that tenant's own
elections. Onboarding a subscriber starts with a posture interview — populate the register,
run the join, and the tenant's entire obligation surface materialises with citations — which
is plausibly the strongest demo BBaaS has.

Generalisation of learned items crosses only via the W3 gate: a tenant-side correction
generalises to a shared playbook/exam item only after the reviewable distillation step
strips tenant particulars. Posture-conditioned knowledge makes this *safer* than free-text
playbooks: "for SA-approach banks, X" carries its applicability condition explicitly, so a
shared playbook can never silently mis-fire on a differently-postured tenant.

## 9. Build-slice roadmap (named, not built)

1. **Slice 1 — posture register + APPLIES_WHEN + pilot extraction.** The event family
   (§3.1), the posture projection, the predicate edge type, the mechanical join, and an
   extraction pass over **one instrument family: the PA capital-framework directives plus
   BCBS CRE/MAR chapters** — where SA/IMA/IRB conditioning is densest (17 PA instruments,
   289 IRB matches; the §2.1 sample is the pilot's seed). Exit: Case A answerable with
   citations; \`recon:posture-dimension-coverage\` advisory and green on the pilot family.
2. **Slice 2 — applicability-assessment lifecycle.** \`ProvisionApplicabilityAssessed\` +
   review UI (extending the tick UI) + both drift re-open paths + the labeling factory.
3. **Slice 3 — decision impact sweeps.** The reachability walk at requested-phase,
   decision-card surfacing, \`DecisionImpactSwept\`, \`recon:decision-impact-coverage\`
   advisory + the 259-decision retro-sweep.
4. **Slice 4 — drills + exam harness.** Counterfactual posture drills on scenario stores;
   per-seat frozen exams; \`recon:seat-exam-*\` gating spec changes.
5. **Slice 5 — consolidation ticks + context packs.** \`KnowledgeDistilled\`, pack builder,
   adversarial challenge cadence.
6. **Slice 6 (v2-conditional) — cross-tenant carrier.** Move vocabulary/predicates/exams to
   the control plane per W3; per-tenant posture stores. Gated on D-V2-TENANCY-ARCHITECTURE.

Slices 1–3 are useful to the anchor tenant *now*, independent of any BBaaS decision —
they close real audit holes in the licence track.

## 10. Open questions

1. **Predicate expressiveness vs auditability.** Will flat single-dimension predicates +
   conjunction-by-edges survive the corpus's worst clauses (nested unless-chains,
   cross-references with carve-outs), or does the pilot force a bounded predicate algebra —
   and where is the line past which a "predicate" is unauditable code?
2. **Dimension governance across jurisdictions.** When a second jurisdiction mints a
   near-miss of an existing dimension (PA consolidation vs EBA consolidation), who decides
   merge-vs-sibling, and does FIBO alignment actually carry the weight assumed in §2.3?
3. **Exam-set ownership and gaming.** If the seat that learns also authors its exam, the
   exam is soft; third-line (CAE/Vera) ownership preserves independence but creates a
   bottleneck. Where exactly does exam authorship sit?
4. **How does this meet the NPA gate?** New-product approvals (14-dimension machinery)
   should consume posture: a product that flips a derived dimension (first securitisation)
   should trigger the fan-out re-open *inside* the NPA flow. Does NPA's
   implementation-attested dimension become partially a posture-coverage assertion?
5. **Verdict adoption authority.** Is a mechanical-join verdict self-effective once the
   gate is enforcing, or does every verdict require seat adoption forever? (Cost says
   self-effective with sampling review; conservatism says seat-adopt always.)
6. **Retro-sweep disposition load.** The 259-decision retro-sweep (§5) will surface real
   gaps in bulk; who absorbs that review queue and on what cadence?

## 11. Named decisions for the CEO (recommend, not decide)

- **D-W8-POSTURE-REGISTER-SLICE-1** — authorise Slice 1: the posture event family,
  APPLIES_WHEN predicates, the mechanical join, and the pilot extraction over the PA
  capital-framework + BCBS CRE/MAR family, with \`recon:posture-dimension-coverage\`
  advisory. (The load-bearing one; Case A closes here.)
- **D-W8-APPLICABILITY-LIFECYCLE** — authorise Slice 2: \`ProvisionApplicabilityAssessed\`,
  review gates, drift re-opens, and the labeling-factory recording rule.
- **D-W8-DECISION-IMPACT-SWEEP** — authorise Slice 3: requested-phase reachability sweeps,
  \`DecisionImpactSwept\`, the retro-sweep of the classified corpus, and
  \`recon:decision-impact-coverage\`. (Case B closes here.)
- **D-W8-PARAMETRIC-TRAINING-POSITION** — record the §7 assessment as the standing
  position: parametric training rejected as system of record; "weights propose, events
  dispose" as the binding rule for any future parametric assist; revisit triggers named
  (evidence of frontier-capability shortfall on exam sets; a tenant-isolated training
  substrate with per-item provenance).
- **D-W8-EXAM-GOVERNANCE** — assign frozen-exam authorship and the regression gate
  (recommended: third-line owns exam content; engineering owns the harness), resolving
  open question 3 before Slice 4.

The first and third are independently valuable to the anchor tenant's licence track and do
not depend on any v2/BBaaS commitment; the carrier slice (Slice 6) waits on
D-V2-TENANCY-ARCHITECTURE.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W8 deliverable of the
v2 structural analysis under D-V2-BBAAS-W8-AGENT-LEARNING.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W8-AGENT-LEARNING"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W8 agent learning architecture: posture register, applicability assessments, impact sweeps, training mechanisms",
      path: "2026-06-12_atlas_v2-bbaas-w8-agent-learning.md",
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
