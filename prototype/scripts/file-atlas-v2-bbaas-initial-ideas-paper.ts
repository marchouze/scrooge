// scripts/file-atlas-v2-bbaas-initial-ideas-paper.ts
//
// One-shot RMS Phase 3 filing for Atlas's session-1 initial ideas paper for
// the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits a
// RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-ANALYSIS-LAUNCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Atlas (Core banking platform architect, engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-atlas-v2-bbaas-initial-ideas-paper] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 — Bank Backbone as a Service: initial ideas paper (session 1 of the v2 structural analysis)

**Author:** Atlas (Core banking platform architect, engineering)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-ANALYSIS-LAUNCH (CEO-approved 2026-06-12)
**Audience:** Marc (CEO)
**Status:** Initial ideas paper — session 1 of the v2 structural analysis. Nothing in this paper
is a decision; the eight CEO design directions recorded in D-V2-BBAAS-ANALYSIS-LAUNCH are taken
as given, and everything else is framed as analysis to be done.

---

## 1. V2 thesis

V1 set out to build one bank. What it actually built, almost as a by-product, is a general
answer to a much larger question: *what does it take for an institution to prove, continuously
and mechanically, that it is doing what regulation requires?* The answer v1 gives — an
append-only event log as the only source of truth, a single citable graph from regulation down
to running code, and a recon harness that re-derives compliance from first principles on every
run — is not specific to one South African bank-in-formation. It is a **bank backbone**.

The v2 thesis, in one page: reposition the platform as **Bank Backbone as a Service (BBaaS)**.
Subscriber banks consume a shared core of regulatory-compliance knowledge and operational
functionality. Large banks keep parts of their own core infrastructure — trading systems,
general ledger — and subscribe to a subset of the backbone (typically the regulatory-knowledge
plane, the model library, and the recon harness). Smaller banks and new entrants take the
comprehensive stack: events, ledger, products, risk engines, returns, and the agent workforce
that operates them. The six architectural principles (/Principles/) remain binding on the
platform and on every tenant deployment; they are the product's constitution, not a v1
artefact.

The SA bank-in-formation does not stop. It continues its SARB licence track unchanged **and**
becomes the anchor tenant — customer #1 — of the backbone. This is the strongest possible
proof artefact: the platform's first tenant is a real licensed bank whose every regulatory
return, RAS line, and audit finding runs through the shared core. "We run a bank on this" is a
sales argument no compliance-software vendor currently has.

Why is v1's architecture the moat?

- **Events-as-truth (Principle 1)** means tenant state is a pure function of an auditable log.
  Multi-tenancy, migration, replay, audit, and regulator inspection all reduce to operations on
  one durable artefact. Competitors built on mutable databases cannot retrofit this.
- **Single-graph discipline (Principle 2)** means every operational behaviour is citable
  upward to a regulatory provision and every provision traces downward to running code. The
  two-plane structure that emerged in v1 — Plane A (Provision / Obligation /
  RegulatoryObjective, bank-agnostic) and Plane B (adopted policies, procedures, products, RAS,
  tenant-specific) — is precisely the shared/tenant seam BBaaS needs. The bridge edges
  (DERIVES_FROM, IMPLEMENTED_BY, REALISES) *are* the subscription contract.
- **The recon harness** (215+ standing pipelines in v1) is continuous, mechanical assurance.
  For a subscriber, the harness is the product: it answers "are we compliant, right now,
  provably?" every day, with findings as typed events.
- **Scale already exists.** ~687 event types across 90 definition files, 218 recon pipelines,
  32 standing agents, 156 procedures, 87 policies, 155 regulatory instruments, 1,000+ adopted
  obligations, and 14-dimension NPA machinery. This is not a pitch deck; it is a running
  system with three years of regulatory knowledge compounded into it.

The repositioning question this analysis must ultimately answer is structural, not
aspirational: where exactly does the shared core end and the tenant begin, and how do we get
from a single-bank codebase to that split without breaking the anchor tenant's licence track?

## 2. The shared/tenant split

The central design exercise of v2 is classifying every v1 layer into one of four buckets:

- **Foundational core** — infrastructure every tenant runs identically; versioned and upgraded
  by the platform.
- **Shared model library** — tenant-agnostic computational models (regulatory calculations)
  bound to tenant data at subscription time.
- **Shared reference knowledge (Plane A)** — the regulation itself: provisions, obligations,
  regulatory objectives, source texts. One copy, all tenants.
- **Tenant-specific** — everything a tenant adopts, calibrates, configures, or trades.

The table below grounds each row in the actual v1 module (all paths verified in-tree at
prototype/ unless noted):

| V1 layer | V1 location | Classification | Notes |
|---|---|---|---|
| Event envelope & store | \`platform/event-store/types.ts\`, \`platform/event-store/store.ts\`, \`platform/event-store/partitioned-store.ts\` | Foundational core | Envelope gains a tenant axis in v2 (see §7); today it carries \`entity\` only |
| Event-type registry | \`platform/event-store/registry/\`, \`platform/event-store/event-types.ts\` (+ ~90 definition files, ~687 types) | Foundational core | The shared vocabulary; tenants extend via a governed extension namespace, never by fork |
| Composition root | \`platform/composition.ts\` | Foundational core | Today a single-bank factory; in v2 the natural per-tenant composition point (see §7) |
| Graph substrate & ontology | \`platform/regulatory/graph/\`, graph node/edge type definitions | Foundational core | Node/edge *types* are core; Plane-B *instances* are tenant data |
| Recon machinery | \`platform/recon/\` (215+ pipelines) | Foundational core (engine) + split pipelines | Pipeline *engine* and generic gates are core; gates asserting tenant calibrations are tenant-bound instantiations of shared patterns |
| Dispatch substrate | \`platform/dispatch/\` (briefs, run lifecycle, sync primitive) | Foundational core | Agent-work orchestration is tenant-independent |
| Party / identity scheme | \`platform/identity/\` (party projection, entity short-ids) | Foundational core | The four actor kinds (natural-person, legal-entity, counterparty, agent) generalise directly; tenant adds its own parties as events |
| Records substrate (RMS) | \`platform/records/\`, \`platform/document-store/\` | Foundational core | Typed records + content-addressed store; per-tenant register instances |
| Risk model implementations | \`platform/market-risk/\`, \`platform/alm/\`, SA-CCR / CVA / ECL / IRRBB engines under \`platform/\` | Shared model library | The flagship v2 extraction (see §2.1) |
| Regulatory source plane | \`Regulations/\` instruments + Plane-A graph nodes (Provision, Obligation, RegulatoryObjective; SERVES / ALIGNS_TO edges) | Shared reference knowledge | 155 instruments, provision trees, objective layer — one copy serves every SA tenant; other jurisdictions added once, consumed by all |
| Obligation adoption | ObligationAdopted / ProvisionScopeAdopted events | Tenant-specific | *Which* obligations bind, and how, is each tenant's regulatory posture |
| Policies & procedures | 87 policies / 156 procedures (Plane B) | Tenant-specific | Authored against shared reference knowledge; platform may ship *reference templates* |
| RAS calibration | RasLineCalibrated events, \`platform/risk/ras-appetite-register.ts\` | Tenant-specific | Already event-driven in v1 — the model for how all tenant config should work |
| Product catalogue | \`platform/markets/products/fixtures.ts\` (code fixtures today) | Tenant-specific | Must become events in v2 (see §8); CDM-composed product definitions could be shared library entries tenants *adopt* |
| Chart of accounts | \`platform/accounting/chart-of-accounts.json\` (hardcoded JSON today) | Tenant-specific | Must become events in v2; platform ships a reference CoA as a starting template |
| Handler registry | \`runtime/handlers-metadata.ts\` (global flat list) | Foundational core (mechanism) / tenant (activation) | Which handlers *exist* is core; which are *active* per tenant is subscription config |
| Agent specs | \`Team/_agent-spec-template.md\`, \`Team/_team-roster.json\` | Foundational core (template + seat catalogue) / tenant (calibration) | See §3 |

### 2.1 The model library as the flagship shared asset

The single most commercially distinctive bucket is the **shared model library** (CEO direction
4): RWA, IRRBB (EVE/NII), Leverage, LCR/NSFR, SA-CCR, CVA, ECL, output-floor — each as a
tenant-agnostic, citable computational model. V1 already built these as event-consuming
engines (e.g. the RwaComputed event-of-record pattern, the runEodIrsRevaluation /
dv01ByTenorBucket convergence, the SA-CCR EOD handler). What v2 adds is the *binding
contract*: a model declares the event types and reference data it consumes, the regulatory
provisions it implements (graph citation), and the events it emits; a tenant *subscribes* the
model and binds its own data at subscription time. The model carries its citation chain with
it — a subscriber gets not just a calculation but a provable link from BCBS/PA text to the
number on the return.

## 3. Agent model v2 — functional seats

CEO direction 1: **functional seat names replace persona names. Seat = durable identity.**

In v1, agents carry persona names (Helena, Atlas, Bea…) with positions attached. For a
multi-tenant platform this inverts: the durable, product-meaningful identity is the *seat* —
the bundle of mandate, expertise, decision authority, cadence, and accumulated playbooks. A
subscriber does not buy "Helena"; it subscribes the **Risk Officer seat**. Persona names were
useful scaffolding for a single bank's narrative; they are noise in a product catalogue and an
obstacle to cross-tenant learning (precedent indexed by "Helena" does not transfer; precedent
indexed by "Risk Officer seat, RAS-calibration playbook" does).

Illustrative seat catalogue (mapping ~12 of the 32 current personas from
\`Team/_team-roster.json\`):

| V1 persona | V2 functional seat |
|---|---|
| Atlas (Core banking platform architect, engineering) | Substrate Architect |
| Bea (Accounting & financial reporting engineer, engineering) | Financial Accounting Engineer |
| Rohan (Risk engineer, engineering) | Risk Engineer |
| Mira (Compliance / RegTech engineer, engineering) | Regulatory Knowledge Engineer |
| Helena (Chief Risk Officer, governance) | Chief Risk Officer seat |
| Owen (Company Secretary, governance) | Company Secretary seat |
| Zara (Chief Compliance Officer, governance) | Chief Compliance Officer seat |
| Eitan (Treasurer, governance) | Treasurer seat |
| Vera (Internal audit / continuous-assurance engineer, engineering) | Continuous Assurance Engineer |
| Camille (Chief Financial Officer, governance) | Chief Financial Officer seat |
| Anya (Data / analytics engineer, engineering) | Data Engineer |
| PAX (Role researcher) / Nolan (Recruiter) | Research seat / Seat-provisioning function |

The 17-section spec template (\`Team/_agent-spec-template.md\`) carries over essentially
unchanged — it was always an *operating spec for a standing agent*, and sections 6–17
(cadence, triggers, inputs, decision scope, escalation, outputs, capabilities, procedures,
data contracts, independence, substrate gaps, change log) are exactly what a productised seat
needs. Sections 1–5 (the character data) shrink to seat identity and mandate.

### 3.1 Cross-tenant learning architecture (CEO direction 6)

The compounding asset is **seat expertise**: when the Risk Engineer seat at tenant A learns
that a particular IRRBB recon pattern catches a class of curve-bootstrapping defect, that
playbook should benefit tenant B's Risk Engineer seat immediately. Sketch:

- **What compounds in the shared core:** playbooks (procedure-shaped know-how), precedent
  (anonymised decision patterns: "when X class of finding, the effective remediation was Y"),
  recon patterns (new gate designs), model-validation findings about the *shared* models,
  regulatory-interpretation memos on Plane-A content.
- **What never crosses the boundary:** tenant events, positions, balances, client data,
  counterparty identities, tenant-specific calibrations (RAS numbers, limits), and anything
  from which these could be reconstructed. Learnings generalise; data never leaks.
- **Mechanism:** seat memory splits into a *core memory* (shared, versioned, curated — itself
  event-sourced in the platform's own store) and a *tenant memory* (inside the tenant
  boundary). A distillation step — analogous to the decision-distillation pass in §4 —
  promotes tenant-side learnings to core only through an explicit, reviewable
  generalisation gate that strips tenant particulars. Governance of that gate (consent,
  confidentiality, competition law) is an open question in §9.

## 4. Decision distillation method

The Decision-event history is the densest record of *why the platform is the way it is*. For
v2 it must be classified, because some decisions define the backbone and some define one
tenant.

**Sizing (read-only query against the shared store, 2026-06-12):** 273 distinct decision IDs
exist in the canonical event log; **256 carry an approved phase**. The remainder: 9
superseded, 8 withdrawn, 2 rejected, 5 deferred (phases overlap per decision lifecycle; 244
passed through a requested phase). The classification universe is therefore ~256 approved
decisions, with the 19 superseded/withdrawn/rejected providing the obsolete bucket's seed.

**Proposed classification pass.** Each approved decision is classified:

- **Foundational** — defines the backbone; holds for *any* tenant. Examples: D-RMS-PHASE-1..4
  (records substrate), D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-DISPATCH-SYNC-PRIMITIVE,
  D-PRINCIPLE-2-CAPABILITY-LAYER, the event-store append-only and partitioning decisions.
- **Directional** — this bank's choices: its RAS calibrations, its product approvals (the FX
  OTC umbrella NPA), its CoA write-offs, its BA-return wiring sequence, its obligation
  adoptions.
- **Obsolete / superseded** — explicitly superseded (e.g. the fabricated D5/2025 BA-numbering
  scheme superseded by D-BA-RETURN-NUMBERING-EXCEL-CANONICAL) or overtaken.

Method: a seat-led pass (Company Secretary seat owns the register; Substrate Architect
classifies technical decisions) emitting a typed classification event per decision
(\`DecisionDistilled\` { decisionId, class, rationale, citations }), folding into a
**core-knowledge-base register** — the platform's "constitution + case law", and the seed of
the shared seat memory in §3.1. Borderline cases (a directional decision that *demonstrates* a
foundational pattern) get both: the instance stays directional; the pattern is extracted into
core memory.

**This is the first session-2 workstream** (see §10): it is cheap, read-only, parallelisable,
and its output sharpens every other workstream's understanding of what the core actually is.

## 5. Standards-aligned domain architecture

CEO direction 7: structure v2 around an industry-standard domain landscape, with **domain as
the unit of subscription and of standardisation contract**.

**BIAN as the candidate frame.** The BIAN service landscape decomposes banking into ~320
service domains with defined control records and service operations. We do not need BIAN's
SOA-era interface formalism; we need its *map* — a vendor-neutral, regulator-recognisable
carving of the bank into domains with clear ownership. Illustrative mapping of v1 assets onto
BIAN service domains:

| BIAN service domain | V1 asset today | Key data store(s) | Owning functional seat | Ontology bindings |
|---|---|---|---|---|
| Position Keeping | sub-ledger positions, \`platform/markets/\` EOD revaluations | event store (position events) + position projections | Trading Systems Engineer | FINOS CDM (product/trade), internal Position events |
| Financial Accounting | GL interpreter, \`platform/accounting/\` (CoA, posting interpreter) | event store (SubLedgerPostingEmitted) + GL projection | Financial Accounting Engineer | internal posting ontology; FIBO accounting concepts; CoA-as-events (v2) |
| Regulatory Reporting | BA-return renderers (\`reporting/\`), returns-submission layer | return projections + form schemas (Excel-canonical) | Regulatory Reporting Engineer | Plane-A Obligation nodes → return cells; ISO 20022 where applicable |
| Market Risk Models | VaR, BA320 engines, IRRBB EVE/NII (\`platform/market-risk/\`, \`platform/alm/\`) | RwaComputed / reval events + model registry | Risk Engineer | model-registry nodes; IMPLEMENTED_BY edges to CRE/MAR provisions |
| Credit Risk Models | CRE20 credit RWA, ECL suite, SA-CCR, CVA | RwaComputed events; counterparty class events | Risk Engineer | CounterpartyBaselClassAssigned; EQUIVALENT_TO (SA↔BCBS) edges |
| Party Reference Data | \`platform/identity/\` party projection, Party register | party events + projection | Data Engineer | four actor kinds; FIBO parties; LEI |
| Compliance / Obligation Management | obligation register, adoption events, recon gates | Plane-A graph + ObligationAdopted events | Regulatory Knowledge Engineer + CCO seat | Provision/Obligation/Objective nodes; SERVES, DERIVES_FROM edges |
| Payment Order / Execution | \`platform/payments/\`, nostro accounting | payment + settlement events | Operations Engineer | ISO 20022 payment messages |
| Asset & Liability Management | \`platform/alm/\`, \`platform/ftp/\`, \`platform/liquidity/\` CFP/EWI | LCR/NSFR projections, funding-plan events | Treasurer seat + Treasury Engineer | BCBS 248 metrics; liquidity Obligation bindings |

Per domain, the standardisation contract is: **key data store(s)** (which event types and
projections it owns), **owning functional seat** (who answers for it), and **ontology
bindings** — internal graph node/edge types plus the external standards: **FINOS CDM** for
product and trade composition (already in v1: the CDM event-type layer at
\`platform/event-store/event-types-cdm.ts\`), **ISO 20022** for payments and reporting
messages, **FIBO** for shared financial-concept semantics.

**BIAN vs alternatives, briefly.** ISO 20022 is a message standard, not a domain map — it
binds *within* domains. FIBO is an ontology, not a service decomposition — it labels concepts,
not ownership. ACORD is insurance. A bespoke domain map is tempting (v1's platform/ directory
is already close to one) but forfeits the vendor-neutral vocabulary that makes "subscribe to
the Market Risk Models domain" legible to a subscriber bank's architects and regulators.
Working hypothesis: **BIAN landscape as naming and boundary reference, applied selectively;
CDM/ISO 20022/FIBO as the data-standard bindings inside it** — adopt the map, not the
middleware. Session-2 workstream to validate depth of adoption.

## 6. Platform-model benchmark: SAP and Salesforce

CEO direction 8. Two platform companies solved the problem v2 faces — one product, many
tenants, deep per-tenant specificity — and their scar tissue is as instructive as their
architecture.

**SAP — clean core.** SAP's hard-won doctrine: customer specifics live in *configuration* and
*side-by-side extensions*, never in forks of the core. Decades of modification sprawl made
upgrades multi-year projects; "clean core" is the corrective. BBaaS translation: **tenant
layer = events + config; core = code.** A tenant never patches a model, a projection, or a
recon gate; it configures (adoption events, calibration events) or extends side-by-side
(tenant-namespaced event types, tenant-local handlers behind the same envelope). V1's
events-first rule makes this *structurally enforceable* rather than a policy plea — if tenant
state is only events, there is nothing in the core for a tenant to fork. The recon harness
becomes the clean-core police: a gate can mechanically assert "no tenant-modified code in the
core path".

**Salesforce — metadata-driven multi-tenancy.** One runtime, all tenants; tenant behaviour is
*data*, interpreted at runtime, not deployed code. This is what makes Salesforce upgrades
instant across hundreds of thousands of tenants. BBaaS translation: **per-tenant composition
from event-sourced config.** \`platform/composition.ts\` is today a single-bank factory
wiring stores, engines, and handlers; v2 makes it a *tenant composition factory* that reads
the tenant's subscription and configuration events and assembles that tenant's runtime —
which domains, which models, which handlers active, which CoA, which products. The
configuration *is* an event stream, so it is versioned, auditable, and replayable like
everything else — strictly stronger than Salesforce's metadata, which is mutable.

**Editions / tiers** map to subscription bundles of BIAN-aligned domains (§7), and the
**ISV/extension ecosystem** maps to a future third-party model and playbook marketplace
(consultancies authoring policy template packs, model vendors publishing citable engines) —
noted, not analysed, this session.

**Cautionary lessons.** (1) Customisation sprawl is a boundary-discipline failure: every
"just this once" core patch for a big customer compounds into upgrade paralysis. The anchor
tenant is the first temptation — the SA bank's needs must flow through the same
config/extension channels as any future tenant's, *from the start of v2*. (2) Where the
core/custom boundary was soft, upgrade pain was proportional to the softness; our boundary
must be typed (event schemas), gated (recon), and versioned. (3) Salesforce's governor limits
teach that shared runtimes need explicit per-tenant resource governance — for us, agent-token
budgets and store quotas per tenant, designed in early.

## 7. Tenancy architecture options

Three candidate architectures, deliberately not decided here:

**Option A — tenant axis in the envelope (\`tenantBankId\`), shared store.** One event store;
every envelope carries tenant identity, as it carries \`entity\` today. *For:* cross-tenant
platform analytics and recon trivially; one store to operate; mirrors v1's single-store
simplicity. *Against:* isolation rests on query discipline (every projection must filter);
the blast radius of a filtering bug is data leakage between banks — likely unacceptable to
subscriber banks and regulators; data-residency requirements are hard to honour in one store.

**Option B — per-tenant stores, shared platform code.** Each tenant has its own physical
store (own DB / own Postgres / own region); the platform composes against the tenant's store.
*For:* hard isolation by construction; residency per tenant; matches the existing
resolution-precedence machinery (\`platform/event-store/resolve-event-db.ts\` already resolves
the store from flag/env/path — generalising to per-tenant resolution is small). *Against:*
cross-tenant operations (platform recon, fleet upgrades, seat-memory distillation) become
fan-out jobs; N stores to operate.

**Option C — composition-factory-per-tenant (the Salesforce-shaped synthesis).** Per-tenant
stores (B's isolation) plus a tenant composition factory: \`composition.ts\` evolves from
"the bank's wiring" to a factory keyed by tenant, assembling each tenant's runtime from its
subscription/config events. The platform's *own* control-plane store (tenant registry,
subscriptions, seat core-memory, platform decisions) is itself just another event store.

**Entity vs tenant are orthogonal axes.** Principle 5 already gives multi-entity: a tenant
bank may have many legal entities in a versioned tree (\`entity: "LE-ZA-HOZ-BANK"\` today).
Tenant is the *subscription and isolation* axis; entity is the *legal-structure* axis within
a tenant. Conflating them would break the first multi-entity subscriber. The envelope likely
needs both, even under Option B/C (tenant in the envelope makes events self-describing when
they move — archives, regulator extracts, support).

**Subscription tiers** fall out naturally as sets of BIAN-aligned domains: a comprehensive
tier (full stack — the anchor tenant's profile), a risk-and-reporting tier (model library +
Regulatory Reporting + Compliance domains, consuming position feeds from the bank's own
systems — the large-bank profile), and a knowledge tier (Plane A + obligation tooling + recon
patterns only).

**Recommended direction for the analysis (not a decision):** treat **Option C** as the
working hypothesis — it is the only option that simultaneously satisfies hard isolation,
residency, clean-core discipline, and the cross-tenant learning boundary in §3.1 — and have
the session-2 tenancy workstream stress-test it against Option A's operational simplicity,
with the envelope gaining both axes either way.

## 8. Learnings-from-v1 inventory

**Keep — proven and load-bearing:**

- **Events-first, everywhere.** Three years of replayable history; every remediation,
  backfill, and audit in v1 leaned on it.
- **Recon-gate-everything.** 215+ pipelines; the pattern of "new behaviour ships with the gate
  that would catch its absence" is the platform's immune system, and the BBaaS product's core.
- **Projection-derived registers.** RMS registers, the Party register, the RAS register —
  views, never stored state; D-RMS-PHASE-4 proved markdown can be fully retired.
- **Decision events.** The Decision lifecycle gave the platform an auditable "case law"; §4
  builds directly on it.
- **Dispatch lifecycle.** Brief → run → close with typed events, sync primitives, and recon
  over the topology — this is the agent-workforce substrate any tenant needs.

**Fix — known debts, now seam-blocking:**

- **Fixtures-instead-of-events.** Products live in code
  (\`platform/markets/products/fixtures.ts\`); the CoA is hardcoded JSON
  (\`platform/accounting/chart-of-accounts.json\`). Both are tenant-specific data trapped in
  the core — the exact SAP anti-pattern §6 warns about.
- **Global handler registry.** \`runtime/handlers-metadata.ts\` is a flat all-handlers list;
  v2 needs per-tenant activation, and v1's parallel-dispatch collisions on this file were an
  early symptom that a single global registry doesn't scale even for one tenant.
- **Persona naming.** §3; seat identity should have been the durable key from the start.
- **Source-artifact-first discipline.** The BA-numbering incident class (a fabricated
  numbering scheme propagated through decisions, obligations, and code until the canonical
  Excel forms were consulted) showed that reference knowledge ingested without the
  authoritative source artefact poisons everything downstream. For a platform *selling*
  regulatory knowledge, source-artifact-first with extract-quality gates (already standing
  for PA sources) is a product-integrity requirement.
- **Hardcoded jurisdiction defaults.** ZAR/SARB/LE-BANK-SA baked into fixtures and seeds;
  Principle 5 was honoured in the type system but not in the data.

**Do-differently-day-one in v2:**

- **Tenant axis in the envelope** from the first event, whatever §7 concludes on stores.
- **Products, CoA, RAS, and configuration as events** from the start — RAS already is
  (RasLineCalibrated); it is the template the others follow.
- **Seat-keyed memory and decisions** so cross-tenant distillation never needs a renaming
  migration.
- **Domain boundaries with owners** (§5) before code accumulates, not after.

## 9. Open questions for the analysis

1. **Repo strategy — evolve-in-place vs greenfield.** Deliberately open. Evaluation criteria,
   not a verdict: (a) anchor-tenant continuity — the licence track cannot stall; (b) seam
   cost — how invasive are tenant-axis, store-resolution, and composition-factory changes in
   place vs rebuilt; (c) history value — the event log and decision history are assets a
   greenfield discards or must import; (d) clean-core enforceability — does in-place evolution
   leave un-seamed tenant data in the core; (e) team throughput during transition; (f) the §4
   distillation output, which effectively *is* the greenfield's requirements document if that
   path is chosen.
2. **Commercial model.** Per-domain subscription? Per-seat? Per-recon-coverage? Pricing the
   model library vs the knowledge plane vs the full stack.
3. **Regulatory posture of the vendor.** A compliance-SaaS vendor is not a licensed bank —
   but the anchor tenant is. Where does the platform entity sit relative to outsourcing
   regulation (e.g. PA Directives on material outsourcing, cloud/offshoring guidance) as seen
   from the *subscriber's* regulator?
4. **Jurisdiction expansion order.** SA (PA/SARB/FSCA/FIC) is built. Which next — and what
   does adding a jurisdiction to Plane A cost now that the regulator-mandate pattern is
   proven (2 artefacts, ~0 code)?
5. **Data residency and isolation demands.** What will subscriber banks and their regulators
   actually require — per-tenant stores, per-region, on-prem options? Drives §7 hard.
6. **The six principles re-read for "platform + N tenants".** E.g. Principle 1: is there one
   log per tenant plus a platform control-plane log? Principle 6: whose humans oversee the
   residual — platform seats, tenant seats, or both?
7. **Governance of cross-tenant learning.** Consent and contract terms; confidentiality;
   competition-law limits on pooling precedent among competing banks; auditability of the
   generalisation gate (§3.1).
8. **BIAN adoption depth.** Naming-and-boundaries only, or control-record alignment too (§5)?
9. **Anchor-tenant firewall.** Concretely, how do we prevent the SA bank's urgencies from
   becoming core patches (§6's first temptation)?

## 10. Proposed analysis workstream map (session 2+)

Candidate workstreams, each named with owning functional seats. **None are dispatched this
session** — this map is input to the session-2 planning decision.

| # | Workstream | Owning seats | First deliverable |
|---|---|---|---|
| W1 | Decision distillation (§4) | Company Secretary seat + Substrate Architect | Classification pass over ~256 approved decisions → core-knowledge-base register |
| W2 | Domain / BIAN mapping + data-store ownership (§5) | Substrate Architect + Data seat | Full domain map with per-domain stores, seats, ontology bindings; BIAN-depth recommendation |
| W3 | Tenancy architecture (§7) | Substrate Architect | Option A/B/C stress-test against residency, isolation, ops cost; envelope schema proposal |
| W4 | Model-library extraction (§2.1) | Risk Engineer | Binding-contract spec + one pilot extraction (candidate: SA-CCR or LCR) |
| W5 | SAP / Salesforce platform-model research (§6) | Research seat | Deep-dive on clean-core governance mechanics + metadata-tenancy internals + governor-limit analogues |
| W6 | Commercial / market analysis | Research seat | Tier/pricing hypotheses; competitor landscape (RegTech, core-banking SaaS) |
| W7 | Regulatory perimeter of the vendor (§9.3) | Company Secretary seat + Legal seat | Outsourcing-regulation read; platform-entity structure options |

Sequencing logic: W1 is first (cheap, read-only, sharpens everything); W2/W3 are the
structural pair that everything technical depends on; W4 proves the flagship asset early;
W5–W7 run in parallel as research tracks. The repo-strategy question (§9.1) is answered *by*
W1+W3 outputs, not by a workstream of its own.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). Session-1 deliverable of the
v2 structural analysis under D-V2-BBAAS-ANALYSIS-LAUNCH.*
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
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-ANALYSIS-LAUNCH"],
    actor: {
      type: "service",
      id: "agent:atlas:engineering",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 Bank Backbone as a Service — initial ideas paper (session 1)",
      path: "2026-06-12_atlas_v2-bbaas-initial-ideas-paper.md",
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
