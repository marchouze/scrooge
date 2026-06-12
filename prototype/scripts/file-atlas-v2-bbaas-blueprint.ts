// scripts/file-atlas-v2-bbaas-blueprint.ts
//
// One-shot RMS Phase 3 filing for Atlas's CAPSTONE deliverable of the
// WS-V2-BBAAS structural analysis: the V2 Bank-Backbone-as-a-Service
// BLUEPRINT — the synthesis folding all eight completed workstream papers
// (session-1 ideas paper; W1 decision distillation; W2 domain map; W3
// tenancy architecture; W4 model library; W5 platform research; W6
// commercial; W7 vendor perimeter; W8 agent learning) into one executable
// programme: the repo-strategy VERDICT, the sequenced build plan, the
// consolidated open-decision register, commercial milestones, the
// anchor-tenant firewall mechanics, success metrics, and the risks register.
// Emits a RecordFiled event so the Documents register holds the canonical
// paper. The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-blueprint:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-blueprint] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 Bank Backbone as a Service — BLUEPRINT (W1–W8 synthesis, repo verdict, build plan)

**Author:** Atlas (Core banking platform architect, engineering) — Substrate Architect seat
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-BLUEPRINT-SYNTHESIS (CEO-approved 2026-06-12); capstone of the
WS-V2-BBAAS structural analysis chartered under D-V2-BBAAS-ANALYSIS-LAUNCH and completed
across D-V2-BBAAS-W1-DECISION-DISTILLATION, D-V2-BBAAS-W2-W3-DISPATCH,
D-V2-BBAAS-W4-W7-DISPATCH, and D-V2-BBAAS-W8-AGENT-LEARNING (all 2026-06-12).
**Inputs (all filed in the Documents register):**
record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12 (session 1);
the W1 distillation register (\`platform/governance/decision-distillation/\`);
record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12;
record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12;
record:documents:rohan:v2-bbaas-w4-model-library:2026-06-12;
record:documents:pax:v2-bbaas-w5-platform-research:2026-06-12;
record:documents:pax:v2-bbaas-w6-commercial:2026-06-12;
record:documents:owen:v2-bbaas-w7-vendor-perimeter:2026-06-12;
record:documents:atlas:v2-bbaas-w8-agent-learning:2026-06-12.
**Audience:** Marc (CEO)
**Status:** Synthesis and recommendation. This blueprint converts the analysis phase into an
executable programme; every named decision inside it remains the CEO's to take or refuse.
§9 lists the immediate approval set in recommended order.

---

## 1. Executive synthesis

V1 set out to build one bank. The eight workstreams of this analysis examined whether what
it actually built — an append-only event log as the only source of truth, a single citable
graph from regulation to running code, a standing recon harness, and an autonomous agent
workforce — is a **bank backbone** that other institutions can subscribe to. The answer,
now evidence-backed rather than asserted, is yes, and the evidence is specific:

- **W1 (decision distillation)** classified the full approved-decision corpus — at capstone
  authoring, 261 classifications: **94 foundational / 142 directional / 25 obsolete**. The
  foundational set is the backbone's constitution and case law; the directional set is,
  precisely and exhaustively, *one tenant's configuration of it*. The shared/tenant seam is
  not a design aspiration; it is already present in the governance history, enumerated
  decision by decision, with the coverage recon enforcing that every new decision gets
  classified as it lands.
- **W2 (domain map)** decomposed the platform into **25 BIAN-aligned domains** (14 carrying
  exact or near-exact BIAN names, 11 justified bespoke), each with verified v1 modules, owned
  event families, an owning functional seat, ontology bindings (FINOS CDM, ISO 20022, FIBO),
  and a tier letter. Its closing observation is the analysis's structural keystone: in every
  one of the 25 domains the classification decomposes the same way — *machinery =
  foundational core; regulation-derived calculation = shared model library; regulation
  itself = shared reference knowledge; calibration + instances = tenant events*. The seam
  runs through the whole platform in the same place. W2 also flagged the honest gaps
  (G1–G12: lending, deposits at scale, channels, cards…) — none of which block the K or R
  tiers.
- **W3 (tenancy architecture)** stress-tested the three tenancy options against the measured
  substrate (≈181k anchor events across hot store + 17 SHA-sealed cold partitions) and
  recommended **Option C: per-tenant physical stores + a composition-factory-per-tenant +
  a platform control-plane event store**, with the tenant axis in the envelope as an
  additive optional field, **no historical rewrites ever** (sealed partitions are attested,
  not touched), and a four-stage, independently-rollbackable anchor-tenant migration with a
  byte-equivalence rehearsal harness. Critically for §2 below, W3 found the substrate
  *half-built toward Option C already*: the five-tier store-resolution ladder, the XDG
  config store, the Postgres-mirror seam, readonly partition spans, the provenance-style
  flag-gated rollout pattern, and the additive-DDL discipline all generalise per-tenant
  with small, rehearsable steps.
- **W4 (model library)** specified the **model binding contract** — typed input manifests,
  IMPLEMENTED_BY provision citations, events-of-record with lineage, posture-conditioned
  applicability, the methodology/calibration split, registry versioning with exam sets, and
  six-step subscription semantics — and graded all twelve v1 engines for extraction
  readiness (SA-CCR A−; LCR/NSFR B+; credit RWA, IRRBB, ECL, VaR B; CVA, market RWA,
  leverage C; op-RWA D). The pilot pick is **SA-CCR**, argued on the ground that it
  exercises every contract clause in the smallest volume and that its two defects
  (composition-singleton import, hardcoded entity literal) are exactly the seams the
  contract exists to cut.
- **W5 (platform research)** distilled SAP's clean-core scar tissue, Salesforce's
  metadata-driven multi-tenancy, the ecosystem mechanics of both, the failure cases (Lidl's
  USD 580m core-customisation collapse; Revlon and Haribo's unverified go-lives; the
  ECC-2027 upgrade-stranding pattern), and the nearest banking comparator (Thought Machine
  Vault Core) into **ten doctrine statements**. The recurring finding: everything SAP
  retrofitted as policy and Salesforce enforces as mutable metadata, the event-sourced
  substrate can enforce as typed, immutable, recon-gated structure — the clean-core police
  ship *before the first tenant exists*.
- **W6 (commercial)** located the white space: core-banking SaaS sells functionality without
  proof; RegTech (the consolidating Regnology roll-up) sells proof-shaped forms without the
  functionality; **nobody sells provable continuous compliance and operations as one
  substrate**, because no incumbent architecture can retrofit events-as-truth, the citation
  graph, the recon harness, or the agent workforce. It materialised the **K / R / C tiers**
  against W2's 25 domains, recommended a hybrid pricing model (domain-tier base + agent
  seats + metered tokens above allowance, with recon coverage reported as value evidence
  but not priced), and sequenced market entry **anchor (SA) → SA second-tier/mutual/new-
  entrant cohort → UK (FCA AI Live Testing as the named supervisory channel) → UAE →
  Nigeria/Kenya K-tier**, with the kill risks ranked (regulator acceptance and
  model-provider dependency existential-class).
- **W7 (vendor perimeter)** answered the legal question in one paragraph: the vendor needs
  **no licence of its own** on any perimeter checked, but is **regulated through every
  subscriber's contract** — and a full-stack subscription is squarely in the PA's
  **prior-written-approval class** (GN5/2014 §4.4, §5.1(j): core banking IT and the
  financial-reporting IT system), with D3/2018's binding cloud/offshoring conditions
  (including the always-portable data clause that events-as-truth satisfies almost for
  free) riding along. It recommended the **Option 3 entity structure** (vendor outside the
  bank's controlling-company consolidation perimeter, arm's-length anchor contract, the
  anchor's own PA approval file built as a reusable product artefact), specified the
  C1–C14 clause library, and bounded cross-tenant learning under competition law with a
  named **CSI blocklist** amendment to the generalisation gate.
- **W8 (agent learning)** designed the structured-first learning substrate — "weights
  propose, events dispose" — around the **bank-posture register** (PostureDimensionMinted /
  RegulatoryElectionDeclared), APPLIES_WHEN predicate edges, three-valued applicability
  verdicts with a missing-fact work queue, the ProvisionApplicabilityAssessed lifecycle
  with double-sided drift re-opens, decision impact sweeps, and frozen exam sets. Its
  grounded sample produced the **power-law finding**: 16 dimensions discovered across 38
  sampled provisions and all 121 PA Banks-Act instruments, with a handful (entity class,
  consolidation level, the three approach elections, trading-book existence, securitisation
  activity, D-SIB designation, supervisory permissions) doing almost all the conditioning
  work — extrapolating to ~60–120 dimensions at full SA-corpus coverage, comfortably inside
  the ratified 50–200 band. The product consequence is the strongest demo BBaaS has: the
  same provision yields a different cited answer per tenant, mechanically, from a posture
  interview.

The synthesis in one sentence: **the analysis found no blocker, found the seam already cut
in the same place across governance history (W1), architecture (W2), storage (W3), models
(W4), and knowledge (W8), and found the external evidence (W5–W7) prescribing exactly the
disciplines the substrate already practises.** What remains is sequencing — which is §3 —
and one genuinely binary choice, which is §2.

## 2. Repo-strategy VERDICT — evolve-in-place vs greenfield

Session 1 (§9.1) deliberately left this open and named six evaluation criteria. Each is now
answerable from the papers.

**(a) Anchor-tenant continuity — the licence track cannot stall.** Evolve-in-place keeps
the licence track running on the same store, the same recon suite, the same returns, with
every v2 step staged behind flags and aliases (W3 §5: Stage 1 lands the envelope field
*dark*; Stage 2 hides the composition factory behind a delegating alias; every stage is
independently rollbackable; the byte-equivalence harness asserts that GL trial balance,
decisions register, RAS register, and briefs register are identical pre/post). A greenfield
forks attention: every engineering run spent building v2-from-scratch is a run not spent on
the licence track, and the licence track cannot pause while a rewrite catches up to 218+
recon pipelines and ~687 event types. Worse, greenfield creates a *convergence* problem —
the anchor must eventually migrate onto the new repo, which is a second, larger migration
than anything W3 sketched. **Strongly favours evolve-in-place.**

**(b) Seam cost.** W3's measured finding is that the substrate is half-built toward
Option C: the tenant axis is one additive nullable column plus an index (the same in-place
additive-DDL shape every prior store evolution used); the store-resolution ladder already
resolves stores from flag/env/config and needs one new tier; \`composition.ts\` was written
with the factory seam in mind (its own header promises the M8 lift "does not touch
capability code"); the flag-gated append-enforcement rollout reuses the proven provenance
playbook. W4's survey says the model extractions are parameter-threading refactors, not
rewrites (SA-CCR's methodology modules move verbatim). The in-place seam cost is therefore
*known, small, and rehearsable*. The greenfield seam cost is unknown and pretends to be
zero: a new repo still has to make every one of these choices, then re-prove byte-level
behavioural equivalence against three years of accumulated correctness that currently
lives in tests, recon gates, and the log itself. **Favours evolve-in-place.**

**(c) History value.** The event log (≈181k events, 17 SHA-sealed partitions spanning
sequence 1) is not just data — it is the parity oracle W4's pilot acceptance test replays
against, the regression corpus W8's exam sets draw from, the audit trail the licence
application cites, and the demo the W6 go-to-market rests on ("our first customer is a bank
we run"). The 261 distilled decisions are the platform's case law; W2 grounds domain
classifications in them and the control-plane store seeds from the foundational set. A
greenfield either discards this (commercially self-defeating: the proof artefact *is* the
history) or imports it — and importing an append-only, hash-sealed log into a new repo's
new store is precisely the rewrite-history operation W3 §1 showed is dead on arrival.
**Strongly favours evolve-in-place.**

**(d) Clean-core enforceability.** The honest argument *for* greenfield is that in-place
evolution leaves tenant data tangled in the core — and v1 does carry exactly that debt:
products in code fixtures, the CoA as hardcoded JSON, the \`BANK_ZA_001\` entity literal in
SA-CCR, SA market heuristics inside the credit-RWA mapping, hardcoded jurisdiction defaults
in seeds. But the analysis defused this argument twice over. First, W1's directional class
*is* the enumeration of what must move to the tenant layer — 142 decisions, named, with the
coverage recon keeping the enumeration current; the untangling work is a checklist, not an
archaeology project. Second, W5's doctrine #3 makes boundary compliance *computed and
standing*: the released-surface gate and the per-tenant compliance register police the
boundary continuously, in either repo. A greenfield does not get a cleaner core; it gets an
*unpoliced* core that is clean only until its first deadline. The Lidl lesson cuts against
greenfield here: boundary discipline is a governance property, not a repo property.
**Neutral-to-favours evolve-in-place, conditional on the §3 extraction slices actually
shipping with their gates.**

**(e) Team/agent throughput during transition.** The agent workforce's accumulated
competence — playbooks, module knowledge, the recon patterns, the dispatch machinery, CI —
is calibrated to this repo. W8's whole learning architecture (context packs, exam sets,
consolidation ticks) compounds on the existing corpus. A greenfield resets agent context to
zero and doubles every dispatch's surface ("which repo?") for the entire transition. The
three lost-work incidents and the worktree-isolation discipline exist because agent runs
are fragile at the margins; a two-repo world multiplies those margins. **Strongly favours
evolve-in-place.**

**(f) The W1 distillation output as the greenfield requirements doc.** True as stated — the
94 foundational decisions plus the W2 domain map plus the W4 contract *are* a requirements
document a greenfield could build to, and this is genuinely the strongest version of the
greenfield case: build v2 clean to a known spec, no debt. But the requirements doc is also
exactly what makes the in-place extraction *safe*: the same artefact that would govern a
rewrite governs the strangler-style extraction, with the difference that in-place every
extraction step is verified against the running oracle (parity gates against the live log)
rather than against a spec's interpretation. The distillation output is more valuable as a
scalpel than as a blueprint for a second building. **Neutral; removes the last argument
for greenfield rather than adding one for it.**

### The verdict

**Evolve in place, with strangler-style extraction of the shared core — named for decision
as D-V2-REPO-STRATEGY.** Concretely: one repo; the v2 backbone emerges by extracting the
foundational core *out of* the running system behind parity gates (W4's pilot is the
template: move the methodology verbatim, inject the seams, prove byte-equal outputs against
the log, keep the old call sites working through aliases), while the tenant layer is pushed
*out of* the core as events (the §3 fixtures-to-events slices), with W5 doctrine #3's
boundary gate standing over both motions from the first slice. The anchor tenant never
migrates repos; it becomes tenant #1 of the backbone in place, through the same channels
any tenant would use (doctrine #10).

**Confidence: high.** Five of six criteria favour or strongly favour in-place; the sixth is
neutral. No criterion favours greenfield outright. The conclusion the dispatch anticipated
is the conclusion the evidence supports — but it was a live question: criterion (d) was a
genuine greenfield argument until W1 enumerated the debt and W5 showed the boundary is
policed by gates, not by repo hygiene.

**What would reverse it:** (1) the Stage-2/3 rehearsals (W3 §5) failing the byte-equivalence
harness in ways that trace to deep coupling rather than fixable seams — i.e. evidence that
the "half-built toward Option C" finding was wrong; (2) the released-surface gate proving
unenforceable in-place because too much of the core is load-bearingly reachable from tenant
artefacts (the W3 falsifier (c): far more of the corpus tenant-entangled than believed);
(3) a regulatory or commercial requirement for a clean-provenance codebase (e.g. an
acquirer or a critical-third-party regime demanding the platform demonstrate no
tenant-derived IP in the core) that audit trails cannot satisfy. Each is observable early —
(1) and (2) inside the first two waves of §3 — so the verdict is cheap to hold and cheap to
revisit.

## 3. The build plan

Sixteen named slices in four waves. Per slice: scope (grounded in the papers' designs),
owning functional seat (v2 seat name per the session-1 §3 catalogue, current persona in
parentheses), dependencies, the recon gate it ships with (W5 doctrine #3: boundary
compliance computed and standing — no slice ships without its gate), exit criteria, and a
risk flag: **[A]** pure-additive (no change to existing behaviour) or **[M]**
migration-risk (touches live paths; byte-equivalence or parity gate mandatory).

### Wave 1 — the seam, laid dark (everything [A]; all parallelisable)

- **S1 — Control-plane store + tenant registry.** [A] W3 Stage 0: stand up the platform's
  own event store (same EventStore class, same DDL, same append-only recon); emit
  TenantRegistered + TenantStoreBound for tenant:hoz-bank-za pointing at the existing
  shared store; the 17 ArchivePartitionTenantAttested events. Nothing reads it yet.
  Seat: Substrate Architect (Atlas). Deps: D-V2-TENANCY-ARCHITECTURE. Gate:
  recon:event-store-append-only extended over the control plane. Exit: registry queryable;
  rollback = delete the file.
- **S2 — Tenant axis in the envelope, dark.** [A] W3 §3: optional \`tenant\` field +
  additive nullable column + index; enforcement flag OFF; defaulting rule (null = store's
  bound tenant) documented in the schema. Seat: Substrate Architect (Atlas). Deps: S1.
  Gate: recon:tenant-store-coherence (advisory). Exit: schema lands; zero behaviour change
  proven by full CI + byte-equal projections.
- **S3 — Posture register + APPLIES_WHEN + pilot extraction.** [A] W8 Slice 1:
  PostureDimensionMinted / RegulatoryElectionDeclared event family (registered per F-032
  discipline), the posture projection, the predicate edge type, the mechanical three-valued
  join, and the extraction pass over the PA capital-framework + BCBS CRE/MAR pilot family.
  Anchor seed register declared (approach.credit-rwa=SA, approach.market-risk=SA,
  approach.operational-risk=SMA, entity.class, designation.d-sib=false). Seat: Regulatory
  Knowledge Engineer (Mira) for extraction; Substrate Architect (Atlas) for the substrate;
  CRO seat (Helena) declares the elections. Deps: D-W8-POSTURE-REGISTER-SLICE-1. Gate:
  recon:posture-dimension-coverage (advisory → enforcing on the pilot family). Exit:
  Case A (the IMA instrument) answerable with citations.
- **S4 — Products / CoA / RAS as events.** [M for CoA; A for the rest] The fixtures debt:
  products move from \`platform/markets/products/fixtures.ts\` to ProductDefinitionAdopted-
  class events; the chart of accounts moves from hardcoded JSON to CoA adoption events with
  the reference CoA shipped as a platform template; RAS is already events
  (RasLineCalibrated — the proven template) and needs only the parity assertion that the
  register reads nothing but events. Seat: Financial Accounting Engineer (Bea) for CoA;
  Substrate Architect (Atlas) for products machinery; CFO seat (Camille) approves the CoA
  adoption. Deps: none (this is W1's directional layer becoming tenant data). Gate:
  recon:tenant-config-as-events (no production read of fixtures/JSON where an event family
  exists — the recon:rwa-computed-sourcing shape generalised). Exit: byte-identical GL and
  product projections pre/post; fixtures retained only as seed scripts that *emit events*.
- **S5 — Released-surface + clean-core boundary gate.** [A] W5 doctrine #2/#3: declare the
  released surface (event schemas tenants may emit/subscribe; projection contracts they may
  read); ship the static boundary gate (the posting-engine-single-subscriber scan shape:
  no tenant-layer artefact references an unreleased module) plus the per-tenant graded
  compliance register with typed, time-boxed exception events (the ProductDeferredGap
  pattern). Applies to the anchor first (doctrine #10). Seat: Continuous Assurance Engineer
  (Vera) owns the gate; Substrate Architect (Atlas) declares the surface. Deps: none.
  Gate: recon:released-surface-compliance (advisory → enforcing). Exit: anchor's own
  compliance register green or exceptions typed.

### Wave 2 — factory and flagship (gated on Wave 1)

- **S6 — Composition factory behind the alias.** [M] W3 Stage 2: composeTenantRuntime
  reading the control-plane registry; \`composition.ts\` becomes a thin delegating alias for
  the anchor tenant; dispatch CLIs gain --tenant defaulting to anchor; the store-resolution
  ladder gains the tenant tier. Seat: Substrate Architect (Atlas). Deps: S1, S2. Gate: the
  byte-equivalence harness as a standing recon (fixed projection basket identical pre/post;
  verifyArchiveIntegrity 17×ok). Exit: every projection and recon output provably identical;
  rollback = re-inline the old composition body.
- **S7 — Model-library pilot: SA-CCR extraction.** [M] W4 §3 verbatim: models/sa-ccr with
  manifest, methodology moved verbatim, binding.ts with store/entity/tenant injected (no
  composition import, no BANK_ZA_001), cadence declared not registered, exam/ seeded from
  current suites; ModelManifest type; ModelCalibrationDeclared event family; registry
  submission with methodologyHash; Model Validator seat (Nadia) runs the validation
  lifecycle. Seat: Risk Engineer (Rohan); validation Nadia. Deps: D-W4-MODEL-LIBRARY-PILOT,
  D-MODEL-BINDING-CONTRACT-V1; S6 for the injection seam (can start against a hand-built
  binding before S6 lands). Gates: recon:sa-ccr-extraction-parity (replay the anchor's full
  history; byte-equal CcrEadComputed/CcrReplacementCostComputed) +
  recon:model-manifest-coverage. Exit: parity green; tsc + static gate prove no singleton/
  literal; second-store rehearsal clean.
- **S8 — Applicability-assessment lifecycle.** [A] W8 Slice 2: ProvisionApplicabilityAssessed
  + review UI (extending the tick UI) + both drift re-open paths (verbatimHash;
  posture-row supersession) + the labeling-factory recording rule (every seat correction a
  stored labeled example). Seat: Regulatory Knowledge Engineer (Mira); CCO seat (Zara) holds
  verdict-adoption authority. Deps: S3. Gate: recon:applicability-assessment-drift. Exit:
  pilot-family verdicts adopted; re-open drill (flip an election on a scenario store)
  passes.
- **S9 — Decision impact sweeps.** [A] W8 Slice 3: requested-phase reachability walk over
  consequence edges, decision-card surfacing of the unconsidered-impact list,
  DecisionImpactSwept, the retro-sweep of the classified corpus, precedent retrieval over
  the DecisionDistilled register. Seat: Company Secretary seat (Owen) owns the decision
  surface; Substrate Architect (Atlas) the walk. Deps: S3 (posture edges enrich the walk;
  not blocking). Gate: recon:decision-impact-coverage (advisory historical; enforcing for
  new decisions). Exit: Case B closes; retro-sweep queue dispositioned or owned.

### Wave 3 — tenant-ready (gated on Wave 2)

- **S10 — Tenant-axis enforcement + anchor migration rehearsal.** [M] W3 Stages 3–4: flip
  the append-enforcement flag (provenance Slice-1 playbook); run the full migration
  rehearsal on a copied store (Stages 1–3 against the copy; 17×ok integrity; byte-identical
  projection basket); stand up the sandbox second tenant (tenant:rehearsal-bank) exercising
  registry, factory, per-tenant recon fan-out, and offboarding end-to-end. Seat: Substrate
  Architect (Atlas); rehearsal harness co-owned with Continuous Assurance Engineer (Vera).
  Deps: S6. Gate: recon:tenant-store-coherence flips enforcing; the equivalence harness
  becomes the standing gate for every future tenant migration. Exit: second store live in
  rehearsal; offboarding drill (hand over files, verify hashes, delete) documented.
- **S11 — Functional-seat renaming (persona → seat migration).** [M] CEO direction 1: seat
  ids become the durable identity. Scope: the seat catalogue lands in the roster JSON as
  canonical (seatId + current persona as an attribute); event actor ids gain the seat form
  (agent:seat:risk-engineer-class ids) with the persona ids retained as aliases — **no
  historical event rewrites** (the W3 rule applied to identity: old actor ids are attested
  aliases, resolved by a projection, never edited); Team/ specs re-headed to seat names;
  dispatch CLIs accept seat names; the two W2 seat gaps (Operations Engineer, Trading
  Systems Engineer / Regulatory Reporting Engineer split) registered as open seats.
  Seat: AgentOps (Sade, reshaped) owns the migration; Company Secretary seat (Owen) the
  roster. Deps: none hard; sequenced in Wave 3 so cross-tenant memory (S12) is born
  seat-keyed. Gate: recon:seat-identity-coherence (every active actor id resolves to a
  seat; roster/render drift is a finding — the existing roster-drift rule extended). Exit:
  new events carry seat-keyed actors; precedent and memory keyed by seat.
- **S12 — Cross-tenant learning gate + CSI blocklist.** [A] W8 §8 + W7 §5: the
  generalisation gate as a named, reviewable distillation step emitting into the
  control-plane store; shared half = dimension vocabulary, APPLIES_WHEN predicates, exam-set
  definitions, foundational playbooks; tenant half stays in tenant stores; every crossing an
  event with provenance and the **CSI blocklist assertion recorded in the crossing event**
  (D-W7-CSI-GATE-BLOCKLIST), alongside the POPIA no-personal-information and
  confidentiality screens. Seat: Substrate Architect (Atlas) builds; CCO seat (Zara) owns
  the blocklist; CAE-line review (Vera) samples crossings. Deps: S1, S3; D-W7-CSI-GATE-
  BLOCKLIST. Gate: recon:generalisation-gate-integrity (no control-plane knowledge artefact
  without a crossing event carrying all three screens). Exit: first distilled playbook
  crosses with a complete, auditable crossing record.
- **S13 — Exam-set / eval harness.** [A] W8 Slice 4 (+5): per-seat frozen exams drawn from
  the labeling factory; counterfactual posture drills on scenario stores; spec/model-binding
  changes gated on non-regression; consolidation ticks emitting KnowledgeDistilled;
  per-seat context packs built from the store. Exam authorship per D-W8-EXAM-GOVERNANCE
  (recommended: third-line owns content, engineering the harness). Seat: Continuous
  Assurance Engineer (Vera) content; AgentOps (Sade) harness. Deps: S8 (the labeling
  factory feeds it); S11 (exams keyed by seat). Gate: recon:seat-exam-coverage +
  recon:seat-exam-regression. Exit: every active seat has a frozen exam; the
  base-model-upgrade gate demonstrated once.
- **S14 — Fleet, metering, and upgrade ledger.** [A] W5 doctrines #5/#6: TenantStoreMigrated
  events as the fleet-upgrade ledger; the fleet-drift gate ("no tenant store more than one
  version behind"); replay-clone pre-flight (replay every tenant against vNext, ship on
  green); per-tenant agent-token budgets and store quotas as projections over
  AgentRunStarted/Completed with graduated warn→throttle→block SubstrateAlerts.
  Seat: AgentOps (Sade) metering; Substrate Architect (Atlas) fleet. Deps: S10. Gate:
  recon:fleet-version-convergence + recon:tenant-resource-quota. Exit: anchor +
  rehearsal-tenant fleet upgraded once through the full pre-flight path.

### Wave 4 — sellable (gated on Wave 3; commercial calendar per §5)

- **S15 — Onboarding + the PA approval-file product artefact.** [A] W7 made the
  subscriber's regulatory process the product's hardest dependency, so it becomes a built
  artefact: the tenant onboarding flow (posture interview → register populated → mechanical
  join → the tenant's obligation surface materialises with citations — W8's flagship demo)
  ends in the W5 doctrine-#9 rehearsed readiness gate the platform can refuse; the **anchor
  tenant's own GN5/2014 prior-approval application file** (materiality assessment, due
  diligence pack, D3/2018 condition mapping, C1–C14 master-agreement terms, control
  evidence as recon exports) is assembled as a reusable, citation-typed template — the
  reference implementation every subscriber reuses. Depends on the W7 corpus acquisitions
  (JS 1/2023, NPS Act, Competition Act) and D-W7-OUTSOURCING-CLAUSE-LIBRARY for the clause
  library half (Imani, legal counsel). Seat: Company Secretary seat (Owen) owns the file;
  Regulatory Knowledge Engineer (Mira) the acquisitions. Deps: S10, S12. Gate:
  recon:onboarding-readiness (no tenant activation without a green readiness gate + signed
  clause set + residency schedule rendered from control-plane events). Exit: the anchor's
  arm's-length master agreement executed against the file (post D-W7-VENDOR-ENTITY-
  STRUCTURE), proving the artefact end-to-end.
- **S16 — Tier packaging + K-tier productisation.** [A] W6 §2 materialised: the K-tier
  bundle (Plane A + obligation/posture tooling + records + recon patterns) packaged with
  read-access contracts and seat/query metering; R-tier ingestion-seam contract published
  (the Position Keeping event contract + the depth-2 BIAN alignment notes for the three
  seam domains per W2 §8); value-evidence invoice rendering (coverage numbers as
  projections). Seat: Substrate Architect (Atlas) packaging; Research seat (PAX) collateral;
  pricing per D-V2-BBAAS-PRICING-HYPOTHESIS. Deps: S3, S8 (K-tier *is* those slices),
  S15 for contracts. Gate: recon:tier-entitlement-coherence (a tenant's active domains
  match its DomainSubscribed events). Exit: K-tier demonstrable end-to-end on the rehearsal
  tenant.

**Sequencing logic.** Wave 1 is entirely pure-additive and entirely parallelisable — five
dispatches that change no behaviour and lay every seam. Wave 2 contains the two [M] slices
that prove the verdict's load-bearing claims (S6 proves the factory seam; S7 proves the
extraction recipe); S8/S9 ride in parallel because they are anchor-valuable independent of
any BBaaS commitment (W8's own observation: they close real audit holes in the licence
track). Wave 3 is where tenant #2 becomes real (rehearsal), identity goes seat-keyed, and
the learning boundary gets its legal armour. Wave 4 converts the substrate into product.
The [M] slices are exactly four (S4-CoA, S6, S7, S10, S11) and every one ships behind a
byte-equivalence or parity gate — the licence track's insulation is structural, per §6.

## 4. Open-decision register, consolidated

Every named decision from W1–W8 plus this paper. Disposition: **approve-now** (blocks
Wave 1–2), **approve-on-sequence** (blocks a later slice; approve when its wave opens), or
**working-hypothesis** (adopt revisably).

| Decision | What it decides | Recommended disposition | Unblocks |
|---|---|---|---|
| **D-V2-REPO-STRATEGY** (this paper, §2) | Evolve-in-place with strangler-style core extraction; one repo; no greenfield | **Approve now** — everything else assumes it | All slices |
| **D-V2-TENANCY-ARCHITECTURE** (W3) | Option C + envelope tenant axis; no historical rewrites; sealed partitions attested | **Approve now**, folding in D-V2-CONTROL-PLANE-STORE and D-V2-ANCHOR-TENANT-MIGRATION as its first executable slices (W3 offered the fold explicitly) | S1, S2, S6, S10 |
| **D-W8-POSTURE-REGISTER-SLICE-1** (W8) | Posture event family, APPLIES_WHEN, mechanical join, pilot extraction | **Approve now** — anchor-valuable independent of BBaaS | S3 |
| **D-W8-APPLICABILITY-LIFECYCLE** (W8) | ProvisionApplicabilityAssessed lifecycle + labeling factory | Approve-on-sequence (Wave 2) | S8 |
| **D-W8-DECISION-IMPACT-SWEEP** (W8) | Requested-phase sweeps + retro-sweep + coverage gate | **Approve now** — anchor-valuable, cheap, independent | S9 |
| **D-W8-PARAMETRIC-TRAINING-POSITION** (W8) | Records "weights propose, events dispose" as standing position with revisit triggers | **Approve now** — zero build cost; prevents drift | (posture, standing) |
| **D-W8-EXAM-GOVERNANCE** (W8) | Exam authorship: third-line content, engineering harness | Approve-on-sequence (before S13) | S13 |
| **D-W4-MODEL-LIBRARY-PILOT** (W4) | SA-CCR pilot extraction per W4 §3 | **Approve now** — the extraction recipe gates every later model | S7 |
| **D-MODEL-BINDING-CONTRACT-V1** (W4) | W4 §1 as the ratified library-wide contract | Approve with the pilot (same dispatch) | S7 + every later extraction |
| **D-CSA-COLLATERAL-ALLOCATION** (W4/v1) | Per-netting-set CSA collateral allocation | Approve-on-sequence (first post-pilot model change through the new governance path) | post-S7 |
| **D-V2-BBAAS-TIER-STRUCTURE** (W6) | K/R/C tier contents, nesting, upgrade paths | **Approve now** — cheap to adopt, expensive to churn; every artefact references it | S16, §5 |
| **D-V2-BBAAS-PRICING-HYPOTHESIS** (W6) | Hybrid: domain-tier base + agent seats + metered tokens; coverage as evidence not meter | Working-hypothesis — revisable on first-tenant evidence | S16 |
| **D-V2-BBAAS-ENTRY-SEQUENCE** (W6) | SA cohort → UK → UAE → Nigeria/Kenya K-tier; FCA AI Live Testing investigated now | Working-hypothesis; the Live-Testing investigation is a now-action | §5 |
| **D-W7-VENDOR-ENTITY-STRUCTURE** (W7) | Option 3: vendor outside the controlling-company perimeter; arm's-length anchor contract; counsel ratifies topology at licence-application | **Approve the direction now** (IP assignment side matters immediately); execution licence-day-adjacent | S15 |
| **D-W7-OUTSOURCING-CLAUSE-LIBRARY** (W7) | Commission the C1–C14 master-agreement clause library (Imani, legal counsel) | Approve-on-sequence — blocked on the three high-priority corpus acquisitions | S15 |
| **D-W7-CSI-GATE-BLOCKLIST** (W7) | CSI screening as a named dimension of the generalisation gate | **Approve now** — small, converts the legal argument into a coded control | S12 |
| **Corpus acquisitions** (W7 §6.2) | JS 1/2023 (IT governance), NPS Act 78/1998 + TPPP directive, Competition Act 89/1998 (high); JS 1/2024, FSLAA depth (medium); CIPA (low) | **Approve now** — routable to Mira under the standing regulatory-library machinery | S15, clause library |
| **D-V2-SEAT-RENAMING** (this paper, S11) | Seat ids as durable identity; persona ids as attested aliases; no event rewrites; roster canonical | Approve-on-sequence (Wave 3 open) | S11, S12, S13 |
| **W6 ask: second-provider fallback gate** | Tested second-model-provider fallback for assurance-critical seats as a pre-condition to any external C-tier go-live | **Approve now as a standing roadmap constraint** (small standing workstream vs existential scramble) | risk R4 mitigation |
| **W6 ask: commercial-principal timing** | When the first human commercial/regulatory-affairs hire is sequenced | Defer to licence-day cohort planning; PAX role research on request | §5 Stage 1 |

## 5. Commercial milestones tied to build slices (W6)

- **K-tier sellable after Wave 2** (S3 + S8 + the existing RMS/recon substrate, packaged by
  S16). The knowledge tier's content — Plane A, obligation tooling, posture/applicability
  machinery, recon patterns — exists once the posture register and assessment lifecycle are
  live; the onboarding demo (posture interview → cited obligation surface) is W8 §8's
  flagship and needs nothing from the tenancy waves to *show*. Selling it to an external
  party additionally needs S1/S10's per-tenant store for the subscriber's adoptions and
  S15's contract set — so: **demonstrable at Wave 2 exit, contractable at Wave 3 exit,
  first external K logo targeted during Wave 4.**
- **R-tier sellable at Wave 4 exit.** R requires the model library (S7 plus the designated
  second extraction, LCR, validating the constants-registry split and the ingestion seam),
  per-tenant stores with enforcement (S10), metering (S14), the published Position-Keeping
  ingestion contract (S16), and — because an R subscription is material outsourcing on
  factors (a)/(f)/(h) — the 20-working-day notification machinery and clause set from S15.
  The W6 collision with Regnology happens here deliberately; the proof asset is the
  anchor's own returns rendered from events of record.
- **C-tier requires the full anchor proof.** C is sellable only when the anchor is a
  licensed, operating bank on the backbone — licence-day plus the first accepted returns
  cycle (W6 Stage-0 exit) — *and* the **PA prior-approval product artefact (S15) is on the
  C-tier critical path**: GN5/2014 §5.1(j) puts a full-stack subscription in the
  prior-written-approval class, the PA's stated preference runs against it, and W7's
  conclusion is that the first approval is co-designed with the supervisor. The anchor's
  own approval file is therefore both the rehearsal and the template; no external C-tier
  conversation should start before it exists. Early, voluntary PA engagement (W7 open
  question 1) is a now-action owned by the Company Secretary seat (Owen) with the CEO.
- **UK entry preconditions:** Stage-1 first external SA logo (the W6 sequencing rule:
  corpus investment in jurisdiction 2 only after Stage-1 proof), the PRA Rulebook corpus
  build under the proven 2-artefacts-per-regulator pattern, the W7 per-jurisdiction clause
  overlay (UK outsourcing/critical-third-party rules re-run the whole W7 analysis), and the
  exception with a calendar of its own: **investigate FCA AI Live Testing registration
  now** — it is the named supervised channel for demonstrating agent-operated controls, and
  its windows do not wait on our waves.

## 6. Anchor-tenant firewall mechanics (W5 doctrine #10 + W6 kill-risk 1)

The firewall has three faces — product discipline, migration insulation, and legal
structure — and all three are mechanical, not exhortative.

**The front door, from day one.** At S1 the SA bank becomes tenant:hoz-bank-za in the
control-plane registry — a registered tenant like any other. From that point every
bank-specific need flows through tenant channels: calibrations as events
(RasLineCalibrated and the S4 families), products as adoption events, handler activation as
DomainSubscribed/HandlerActivated config events once S6 lands, model consumption through
the W4 binding contract (the SA-CCR pilot literally makes the bank the library's first
subscriber). The Lidl rule is enforced by S5's released-surface gate **applied to the
anchor first**, precisely because the anchor is the only tenant with the standing to demand
exceptions: a bank-urgency that wants a core patch instead shows up as a red
released-surface finding plus a typed, time-boxed exception event that the CEO sees on the
compliance register — visible, owned, and expiring, never silent.

**What recon enforces, by name:** recon:released-surface-compliance (no tenant artefact —
including the anchor's — references an unreleased module); recon:tenant-config-as-events
(no production fixture read where an event family exists);
recon:tenant-store-coherence (no foreign tenant id in the bound store);
recon:generalisation-gate-integrity (nothing of the anchor's crosses to shared memory
except through the gated, CSI-screened distillation step — the anchor's data is as
protected from future tenants as theirs from each other); and the S6/S10 byte-equivalence
harness standing over every migration stage.

**What v1 keeps doing, untouched.** The licence track's load-bearing surfaces do not move
while the waves run: the shared store stays the anchor's bound store (Stage 0 binds the
*existing* path; nothing is copied or moved); the 17 sealed partitions are never rewritten
(attestation events only); the recon suite, BA-return renderers, EOD engines, dispatch
machinery, and dashboard all keep reading the same store through the same composition
interface — S6's alias contract is precisely that capability code never notices. Every [M]
slice carries a one-step rollback (delete the file; revert the schema commit; re-inline the
composition body; flag off). The licence track is insulated not by sequencing promises but
by the property that v2's seams are additive until the moment a rehearsed, gate-proven flip
is taken — and the W7 entity structure (Option 3) adds the legal face: the bank contracts
with the vendor at arm's length under the full GN5/2014 process, so even organisationally
the anchor's demands arrive as a *customer's* demands, assessed against a master agreement,
not as internal pressure on the core.

## 7. Success metrics

**Wave 1.** Technical: 5/5 slices landed with gates standing; recon:posture-dimension-
coverage green on the pilot family; zero behaviour deltas (full CI + projection-basket
byte-equality on S2/S4). Learning: ≥12 posture dimensions minted with owners (the §2.1
sample says the pilot family yields that many); awaiting-fact queue counted and owned;
Case A demonstrably answerable. Commercial: none yet (by design).

**Wave 2.** Technical: SA-CCR parity gate green over the full replayed history; composition
alias byte-equivalence green; recon:model-manifest-coverage green; impact-sweep coverage
enforcing for new decisions. Learning: labeling factory accumulating (first ≥20 stored
corrections); retro-sweep of the classified corpus dispositioned; applicability coverage of
the pilot family 100% resolved/awaiting/unconditional. Commercial: K-tier demo runnable
end-to-end (posture interview → cited obligation surface) for a prospect audience.

**Wave 3.** Technical: rehearsal tenant live (second store; fan-out recon; offboarding
drill passed); enforcement flag on; fleet-convergence gate green at N=2; seat-identity
coherence green. Learning: every active seat has a frozen exam; first base-model-upgrade
gate exercised; first generalisation-gate crossing with full CSI/POPIA/confidentiality
assertions. Commercial: K-tier contractable (clause set + per-tenant store + residency
schedule renderable).

**Wave 4.** Technical: onboarding-readiness gate demonstrated by refusing an incomplete
tenant (the gate must be shown to say no); tier-entitlement coherence green. Learning:
exam-set pass rates stable across one model upgrade; posture coverage extended beyond the
pilot family (≥3 instrument families). Commercial: anchor approval file complete and
executed at arm's length; first external K-tier logo in progress; FCA AI Live Testing
status resolved; R-tier ingestion contract published.

## 8. Risks register — top 10, consolidated

| # | Risk | Source | Owner | Standing mitigation |
|---|---|---|---|---|
| R1 | **Regulators refuse agent-operated controls** — guts Principle 6 and the C-tier | W6 5.1 | CEO + Company Secretary seat (Owen) | Anchor settles it with the PA inside the licence process; humans-oversee-the-residual as typed channels; UK chosen for the named supervised channel (AI Live Testing); K/R tiers deliberately sellable without acceptance — degradation, not death |
| R2 | **Anchor-tenant firewall breach / customisation sprawl** — the Lidl path | W5 §5.1/5.5; W6 kill-risk 1 | Substrate Architect (Atlas) + Continuous Assurance Engineer (Vera) | §6 mechanics: released-surface gate enforcing on the anchor first; typed time-boxed exceptions; arm's-length contract (W7 Option 3) |
| R3 | **Licence-track disruption from v2 migration** | W3 §5; session-1 §9.1(a) | Substrate Architect (Atlas), readiness co-owned with the go-live gate (Saskia) | All [M] slices behind byte-equivalence/parity gates with one-step rollbacks; sealed partitions never rewritten; rehearsal-on-copy before every flip |
| R4 | **Model-provider dependency** — price, capability, terms, or outage transmits into tenant operations | W6 5.3; W7 §2.1 | Substrate Architect (Atlas); contractual face CEO | Second-provider fallback gate as a standing pre-condition to external C-tier go-live (approved ask); token pass-through clauses; cache/batch discipline; provider disclosed as sub-outsourcer with layered assurance (W7 C6) |
| R5 | **Fleet drift at N tenants** — stores on divergent versions producing subtly different projections | W3 risk 1; W5 doctrine #5 | Substrate Architect (Atlas), ops AgentOps (Sade) | TenantStoreMigrated ledger + fleet-convergence gate ("≤1 version behind"); replay-clone pre-flight before every rollout; contractual mandatory currency |
| R6 | **Control-plane trust concentration** — bindings, seat memory, the learning gate as a new SPOF | W3 risk 2 | Substrate Architect (Atlas); governance W7 follow-on | Control plane is itself append-only, permission-gated, recon-covered from S1; what the platform operator may see is contracted (C1 scoping per tenant); integrity gates from day one |
| R7 | **CSI / competition-law leakage through the learning carrier** — hub-and-spoke exposure | W7 §5.1 | CCO seat (Zara); gate build Atlas | Structural separation (per-tenant stores); every crossing an event with provenance; CSI blocklist asserted in the crossing event (S12); counsel ratification of the taxonomy at licence-application |
| R8 | **Agent run-resumption gap** — long [M] dispatches dying mid-flight lose work and can strand half-applied migrations | v1 operational history (three lost-work incidents; the W8-paper dispatch itself died once) | AgentOps (Sade) | Scaffold-commit discipline; idempotent one-shot scripts (every filing/migration script skips-if-done); stage designs where every step is separately committable and resumable; run-lifecycle instrumentation already standing |
| R9 | **Posture-extraction recall bounded by source quality** — skeleton-tier extracts read as "unconditional" | W8 §2.1 caveat; GAP-PA-SOURCE-OCR | Regulatory Knowledge Engineer (Mira) | Coverage gate treats skeleton-tier instruments as awaiting-fact, never unconditional; pilot leans on the gap-free BCBS corpus; extract-quality recon already enforcing with allowlist |
| R10 | **Incumbent consolidation + slow bank procurement** — Regnology roll-up plus 50%-failure-rate conservatism slows logo acquisition | W6 5.2/5.4 | Research seat (PAX) for landscape; CEO for posture | Never compete on template count — compete on proof; target new entrants/mutuals where no incumbent contract exists; K-tier as the low-risk trust-clock starter; exit-portability (D3/2018 §2.2.11) as the procurement answer no incumbent has |

Single-founder key-person risk (W6 5.5) is acknowledged and tracked at CEO level — it is a
financing/procurement compounder rather than a build risk; the records substrate is the
knowledge hedge, and the commercial-principal timing ask (§4) is its first mitigation step.

## 9. Named decisions for the CEO — the immediate approval set

In recommended order (each independent; the order is dependency-then-value):

1. **D-V2-REPO-STRATEGY** — evolve-in-place with strangler-style core extraction (§2).
   Everything else assumes it; approving it first makes the rest coherent.
2. **D-V2-TENANCY-ARCHITECTURE** — Option C + envelope tenant axis, folding in the
   control-plane store and the staged anchor migration (W3's three decisions as one).
   Unblocks S1/S2 immediately (both pure-additive).
3. **D-W8-POSTURE-REGISTER-SLICE-1** and **D-W8-DECISION-IMPACT-SWEEP** — the two
   anchor-valuable-now W8 slices (S3, S9); they close licence-track audit holes regardless
   of any BBaaS outcome.
4. **D-W4-MODEL-LIBRARY-PILOT + D-MODEL-BINDING-CONTRACT-V1** — the SA-CCR extraction and
   the contract it instantiates (S7); the extraction recipe every later model follows.
5. **D-V2-BBAAS-TIER-STRUCTURE** — adopt K/R/C as the standing commercial frame (cheap now,
   expensive to churn).
6. **D-W7-VENDOR-ENTITY-STRUCTURE (direction)** — keep platform IP assignable to the vendor
   side from now; topology ratified by external counsel at licence-application moment.
7. **D-W7-CSI-GATE-BLOCKLIST** — small, converts W7's competition-law argument into a coded
   control before the learning carrier exists.
8. **Corpus acquisitions (W7 §6.2 high-priority three)** — route to Mira (Compliance /
   RegTech engineer, engineering) under the standing regulatory-library machinery; they
   gate the clause library, which gates S15.
9. **The second-provider fallback constraint (W6 ask)** — record as a standing roadmap
   pre-condition to external C-tier go-live.

Deferred by design: D-W8-APPLICABILITY-LIFECYCLE and D-W8-EXAM-GOVERNANCE (approve when
Wave 2/3 open); D-V2-SEAT-RENAMING (Wave 3); D-W7-OUTSOURCING-CLAUSE-LIBRARY (after the
acquisitions); D-V2-BBAAS-PRICING-HYPOTHESIS and D-V2-BBAAS-ENTRY-SEQUENCE (working
hypotheses, revisable on first-tenant evidence — except the FCA AI Live Testing
investigation, which should start on its own calendar).

Approving items 1–4 dispatches Wave 1 in full and the spine of Wave 2 under the no-pause
rule; nothing in them spends money beyond agent runs, and every slice they unblock is
either pure-additive or gated behind byte-equivalence.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). Capstone deliverable of the
v2 structural analysis under D-V2-BBAAS-BLUEPRINT-SYNTHESIS.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-BLUEPRINT-SYNTHESIS"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 Bank Backbone as a Service — blueprint (W1–W8 synthesis, repo verdict, build plan)",
      path: "2026-06-12_atlas_v2-bbaas-blueprint.md",
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
