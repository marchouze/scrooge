// scripts/file-pax-v2-bbaas-w5-platform-research.ts
//
// One-shot RMS Phase 3 filing for PAX's W5 platform-model research paper
// for the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits
// a RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: PAX (Role researcher)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:pax:v2-bbaas-w5-platform-research:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-pax-v2-bbaas-w5-platform-research] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W5 platform-model research: SAP clean core, Salesforce multi-tenancy, ecosystem lessons

**Author:** PAX (Role researcher), Research seat
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12); expands the platform-model
benchmark sketched in §6 of the session-1 initial ideas paper
(record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12) and feeds the W3 tenancy
architecture (record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12, Option C
recommended).
**Audience:** Marc (CEO)
**Status:** Research only. Every external finding is mapped to a concrete BBaaS design
implication; §7 distils the implications into a numbered platform doctrine. Nothing here is
a build decision.
**Method:** External-source research (URLs cited inline) against the two reference platform
companies the CEO named — SAP and Salesforce — plus one nearest-domain banking comparator
(Thought Machine Vault Core, chosen over Temenos in §6).

---

## 0. Why these two companies

SAP and Salesforce are the two largest sustained answers to the exact problem v2 faces:
**one product, many tenants, deep per-tenant specificity, and a contractual obligation to
keep every tenant current.** They answered it from opposite ends. SAP began with a
single-tenant, customer-modifiable codebase and spent two decades paying down the
consequences — its "clean core" doctrine is scar tissue codified into governance. Salesforce
began multi-tenant on day one and never let a tenant touch code — its metadata-driven runtime
is the constraint that made three-a-year fleet-wide upgrades possible for over 25 years. BBaaS
gets to choose its position on this spectrum *before* writing v2, with both companies' scar
tissue on the table. The recurring pattern of this paper: **everything SAP retrofitted as
policy, and everything Salesforce enforces as mutable metadata, the event-sourced substrate
can enforce as typed, immutable, recon-gated structure.**

## 1. SAP clean core — boundary doctrine learned the hard way

### 1.1 The doctrine

"Clean core" is SAP's name for a simple rule arrived at expensively: **customer-specific
behaviour lives in configuration and decoupled extensions; the vendor core is never
modified.** An extension is clean-core compliant when it is built exclusively against
*released* SAP APIs and extension points — a published, versioned, stability-contracted
surface — whether the extension runs on-stack or side-by-side
([SAP Learning](https://learning.sap.com/courses/practicing-clean-core-extensibility-for-sap-s-4hana-cloud/explaining-extensibility-model-best-practices_e290f382-800e-40ef-a203-85a13115f487);
[SAP Press](https://blog.sap-press.com/sap-s4hana-clean-core-principles-benefits-and-best-practices)).

Three extension channels, in order of preference:

1. **In-app (key-user) extensibility** — declarative configuration inside the product:
   custom fields, custom business logic at predefined enhancement points, UI adaptation.
   No code deployed into the core; upgrade-safe by construction.
2. **On-stack developer extensibility (ABAP Cloud)** — code that runs on the same stack but
   in a restricted language variant that *can only call released APIs*; the compiler and the
   ABAP Test Cockpit (ATC) make unreleased-object access a build failure, not a code-review
   plea ([SAP Community — on-stack clean core](https://community.sap.com/t5/technology-blog-posts-by-members/on-stack-clean-core-extensibility-plain-and-simple/ba-p/13942916)).
3. **Side-by-side extensibility (SAP BTP)** — separate applications on the Business
   Technology Platform, integrating with the core only through released APIs and events.
   The strongest decoupling; SAP's recommendation for anything substantial
   ([ABAP Extensibility Guide, Aug 2025](https://community.sap.com/t5/technology-blog-posts-by-sap/abap-extensibility-guide-clean-core-for-sap-s-4hana-cloud-august-2025/ba-p/14175399)).

### 1.2 The traffic light: compliance is graded, not binary

SAP's original three-tier extensibility model (Tier 1 ABAP Cloud / Tier 2 wrapped
not-yet-released APIs / Tier 3 classic ABAP) has been superseded by a four-level A–D
compliance rating ([AvoTechs — the A–D model](https://avotechs.com/blog/what-is-clean-core-a-d-extensibility-model/)):

- **Level A** — released APIs only; fully upgrade-safe; recommended.
- **Level B** — classic-but-supported APIs; tolerated under governance.
- **Level C** — internal SAP objects accessed; elevated upgrade risk; remediation roadmap
  expected.
- **Level D** — core modifications, implicit enhancements, direct table writes; prohibited.

Two design facts matter more than the letters. First, **the grade is computed, not
self-declared**: ATC check variants (ABAP_CLEAN_CORE_DEVELOPMENT and the native S/4HANA 2025
checks) scan every custom object and classify it mechanically
([ATC governance recommendations](https://community.sap.com/t5/technology-blog-posts-by-sap/abap-test-cockpit-atc-recommendations-for-governance-of-clean-core-abap/ba-p/14186130)).
Second, **the grade is governed as a standing KPI**: ATC results upload to the RISE with SAP
Methodology Dashboard in Cloud ALM, with custom-object counts by level, an exception log,
and a quarterly clean-core health review tracking the Level C/D remediation roadmap
([Cloud ALM dashboard activation](https://community.sap.com/t5/enterprise-resource-planning-blog-posts-by-sap/clean-core-part-1-activation-of-rise-with-sap-methodology-dashboard-on/ba-p/14328522);
[Project Kernseife — measuring clean core](https://community.sap.com/t5/technology-blog-posts-by-sap/project-kernseife-improving-the-measurement-of-clean-core-in-abap/ba-p/14099819)).
Compliance drift is a dashboard line that trends, with named exceptions — structurally the
same shape as a recon finding register.

### 1.3 The scar tissue that produced the doctrine

The doctrine exists because its absence cost SAP's customers decades. Typical ECC estates
carry "years, and often decades, of accumulated ABAP enhancements, Z programs, user exits,
interfaces, and modifications," and the ECC→S/4HANA conversion — average duration around
1.5 years, frequently multi-year — is dominated not by the new product but by untangling
that web: every custom object must be individually triaged into adapt / replace-with-standard
/ retire / rebuild-clean
([Kellton — migration challenges](https://www.kellton.com/kellton-tech-blog/sap-ecc-s4hana-migration-challenges);
[Lupus Consulting — custom code adaptation](https://lupusconsulting.com/blog/insights-into-custom-code-adaptation-from-sap-ecc-to-s4hana);
[smartShift — conversion findings](https://smartshift.com/blog/8-critical-findings-about-s/4hana-conversions)).
The mechanism of the debt is worth stating precisely, because it is the mechanism BBaaS must
make impossible: **each individual modification was locally rational and globally invisible.**
Nothing at modification time recorded what the change depended on inside the vendor core, so
every vendor upgrade required rediscovering every dependency by hand. The cost was deferred,
compounding, and landed as a single balloon payment at migration.

### 1.4 BBaaS implications

- **Released APIs ≙ typed event schemas + published projections.** The platform's "released
  surface" for a tenant is the set of event types a tenant may emit/subscribe to and the
  projection/register contracts it may read. Everything else — engine internals, recon
  internals, posting interpreters — is unreleased by default. Versioning the released surface
  is something the envelope schema machinery already does for free.
- **In-app extensibility ≙ the tenant config-event layer.** Adoption events, calibration
  events, CoA selection, product-scope events — the W3 paper's "tenant layer = events +
  config" *is* SAP's key-user extensibility, with one structural upgrade: SAP configuration
  is mutable state; BBaaS configuration is an append-only, replayable, citable event stream.
- **Side-by-side ≙ tenant-namespaced event types + tenant-local handlers behind the same
  envelope.** A tenant extension never deploys into core code; it composes against the
  tenant's own store through released contracts — exactly the BTP shape, but with the
  integration contract being the event log itself.
- **The traffic light ≙ a recon gate, and we can do strictly better.** SAP *measures*
  compliance after the fact with ATC scans and governs drift on a quarterly dashboard. The
  recon harness can do both ends: an enforcing gate ("no tenant artefact references an
  unreleased module" — the same static-scan shape as recon:posting-engine-single-subscriber)
  plus a standing compliance register per tenant. Where SAP needed two decades to retrofit
  measurement, BBaaS ships the clean-core police *before the first tenant exists*.
- **Levels B/C as governed exceptions, not silence.** SAP's most transferable governance
  insight is that a graded scale with a tracked exception log beats a binary rule that gets
  silently violated. The BBaaS analogue: a tenant extension that needs a not-yet-released
  contract gets a typed, time-boxed exception event (the ProductDeferredGap /
  tracked-deferred-gap pattern already in production for NPAs), never an undocumented reach
  into core.

## 2. Salesforce multi-tenant internals — behaviour as data, resources as quotas

### 2.1 Metadata-driven runtime and the Universal Data Dictionary

Salesforce runs every tenant on one shared, compiled runtime kernel. Tenants own **no
schema and no deployed code**: objects, fields, triggers, validation rules, page layouts —
all of it exists only as rows in a small set of shared tables called the Universal Data
Dictionary (UDD), keyed by OrgID, and is *interpreted* by the kernel at request time
([Salesforce Architects — platform multitenant architecture](https://architect.salesforce.com/fundamentals/platform-multitenant-architecture);
[developer.force.com — multi-tenant architecture](https://developer.salesforce.com/wiki/multi_tenant_architecture);
[Cirra — database architecture deep dive](https://cirra.ai/articles/salesforce-database-architecture-explained)).
The architecture cleanly separates three things: the kernel (vendor code), tenant data, and
tenant metadata describing each tenant's application. Because tenant behaviour is data, a
kernel upgrade upgrades every tenant's application *without touching any tenant's artefacts*
— this single property is what the entire release model (§2.3) stands on.

### 2.2 Governor limits — why and how

A shared runtime means a tenant's runaway code is every tenant's outage. Salesforce's answer
is governor limits: hard, per-transaction and per-org caps on CPU time (10s synchronous /
60s asynchronous), SOQL queries, DML statements, heap, and API calls, enforced by the runtime
itself — exceed the cap and the transaction is killed, uncatchably
([Salesforce large-data-volumes guide — multitenancy and metadata](https://developer.salesforce.com/docs/atlas.en-us.salesforce_large_data_volumes_bp.meta/salesforce_large_data_volumes_bp/ldv_deployments_concepts_multitenancy_and_metadata.htm);
[Salesforce Ben — Apex CPU time limit](https://www.salesforceben.com/what-is-apex-cpu-time-limit-exceeded-how-do-you-solve-it/)).
Two lessons hide in the details. First, limits are *designed in*, not bolted on — every API
and language construct is metered from birth, so there is no unmetered legacy surface.
Second, limits create real developer friction (§5.4) precisely where they are blunt: the cap
is per-transaction regardless of business criticality, and third-party managed packages spend
*your* budget ([LeanData — eliminating CPU timeouts](https://www.leandata.com/blog/eliminating-apex-cpu-time-limit-exceeded-errors-in-salesforce/)).

### 2.3 Three seasonal releases, every tenant simultaneously

Salesforce ships three major releases a year — Spring, Summer, Winter — and upgrades **every
tenant on the same schedule, mandatorily**; customers cannot pin a version
([Salesforce release schedule FAQ](https://help.salesforce.com/s/articleView?id=005224913&language=en_US&type=1);
[Trailhead — release process](https://trailhead.salesforce.com/content/learn/modules/sf_releases/sf_releases_start)).
The shock absorber is the sandbox system: full or partial copies of a tenant's org, with
*preview* sandbox instances upgraded 4–5 weeks before production so tenants can regression-test
their own configuration against the new version before it lands
([sandbox preview instructions](https://help.salesforce.com/s/articleView?id=000391927&language=en_US&type=1)).
The deal Salesforce offers is explicit: you give up version choice; in exchange the vendor
carries the entire upgrade burden and there is exactly one version in the fleet, ever. No
tenant is ever stranded; no skew accumulates; vendor engineering never back-ports.

### 2.4 BBaaS implications

- **Per-tenant composition from event-sourced config — strictly stronger than mutable
  metadata.** W3's Option C tenant composition factory is the UDD pattern: a tenant's
  runtime is *assembled at composition time from data* (subscription and configuration
  events), not deployed. The argument that events beat metadata is threefold. (1)
  **Auditability**: the UDD answers "what is the config?"; an event stream answers "what is
  it, what was it on any past date, who changed it, citing what" — for a regulated bank
  tenant the second question is the statutory one. (2) **Replayability**: a misconfigured
  tenant rolls back by replay to a sequence number; Salesforce restores from backup. (3)
  **Drift-resistance**: mutable metadata can be edited out from under its own history;
  append-only config cannot — the same property that makes recon gates trustworthy makes
  tenant config trustworthy.
- **Governor limits ≙ per-tenant agent-token budgets and store quotas.** BBaaS's scarce
  shared resources are not CPU-in-a-shared-JVM (per-tenant stores remove that class) but
  **agent tokens (real Anthropic spend), platform-recon compute, and store growth**. The
  Salesforce lesson is to meter from birth: every agent run already lands as
  AgentRunStarted/Completed events, so per-tenant token accounting is a projection, quota
  breach is a typed SubstrateAlert, and enforcement is a dispatch-gate check — designed in
  at tenant #1, not retrofitted at tenant #20. The friction lesson (§5.4) adds: make quotas
  *graduated and visible* (warn → throttle → block, with the meter queryable by the tenant),
  not a silent hard kill.
- **Fleet upgrades ≙ one platform version, N stores, evented rollout.** With per-tenant
  stores (W3 Option C), the Salesforce single-version property must be *reconstructed*: the
  platform ships one code version; an upgrade is a fan-out job across N stores; the
  control-plane store records per-tenant upgrade events (the W3 fleet-upgrade ledger), and a
  fleet-drift recon gate asserts "no tenant store more than one version behind" — directly
  answering W3's named risk #1 (fleet drift producing subtly different projections from
  identical events). Mandatory currency should be contractual, as Salesforce's is.
- **Sandboxes ≙ replay-clones.** Salesforce needs an elaborate sandbox-copy machinery
  because org state is mutable. An event-sourced tenant gets sandboxes almost for free:
  replay the tenant's log into a scratch store against the *candidate* platform version, run
  the tenant's recon suite, diff projections against production. "Preview window before
  fleet upgrade" becomes a mechanical pre-flight: replay every tenant against vNext, ship
  only on green.

## 3. Editions and tiers — packaging economics

### 3.1 How the two companies package

**Salesforce** sells per-seat editions — Starter/Pro Suite, Professional, Enterprise
(~$150–175/user/mo), Unlimited (~$300–350/user/mo) — where each step up unlocks
*capability classes*, not just capacity. The canonical upsell hinge is **API access**:
included from Enterprise up, an add-on or absent below, so any customer that needs real
integrations must cross the Enterprise line; sandbox entitlements, automation depth, and
support tiers ratchet the same way
([GRAX — editions comparison](https://www.grax.com/blog/salesforce-editions-differences/);
[Salesforce help — editions with API access](https://help.salesforce.com/s/articleView?id=000385436&language=en_US&type=1);
[salesforcenegotiations.com — pricing fundamentals](https://salesforcenegotiations.com/cost-comparison-salesforce-editions/)).
**SAP** packages differently — by module/line-of-business and deployment shape (public cloud
vs private edition under RISE), with the extensibility surface itself tiered: public cloud
permits only clean-core channels, private edition tolerates graded legacy
([SAP clean core extensibility in private edition](https://static.rainfocus.com/sap/te24/sess/1721792860413001V4Ea/presentationpdf/DT200_1727441706239001K3jZ.pdf)).

Three generalisable mechanics: (1) the tier boundary sits on a **structural capability**
(API access, deployment shape) that serious customers *must* cross — not on a feature a
customer can shrug off; (2) usage meters (API calls/24h, storage) are per-tier, so growth
inside a tier eventually presses against the ceiling and converts to upsell
([Salesforce API limits reference](https://developer.salesforce.com/docs/atlas.en-us.salesforce_app_limits_cheatsheet.meta/salesforce_app_limits_cheatsheet/salesforce_app_limits_platform_api.htm));
(3) the highest tier bundles assurance (support, sandboxes, uptime), monetising risk
aversion rather than features.

### 3.2 Mapping to the three BBaaS tiers

The session-1 paper's three tiers already have the right shape; the platform-economics
findings sharpen what each boundary should be made of:

- **Knowledge tier** (Plane A + obligation tooling + recon patterns): the entry product;
  buyer may be an auditor or consultancy, not a bank. Boundary asset: read access to the
  regulatory graph and registers. Meter: seats/queries.
- **Risk-and-reporting tier** (model library + Regulatory Reporting + Compliance domains,
  consuming the bank's own position feeds): the structural-capability boundary, BBaaS's
  "API-access line" — crossing it means *emitting events into a tenant store*, with
  per-tenant recon, model runs, and agent-token metering switching on. This is where the
  Salesforce lesson predicts most upsell will happen, because a bank that starts by
  feeding positions for one return will keep finding adjacent returns.
- **Comprehensive tier** (full stack — the anchor tenant's profile): the assurance bundle —
  full domain set, full agent labour force, replay-clone sandboxes, strongest SLOs.
- **Cross-tier meters from day one:** agent-token budget, store size, recon-run frequency,
  distillation/LLM calls. These are BBaaS's per-24h API meter — the within-tier growth
  pressure that funds the platform. Because every meterable action is already an event,
  metering is a projection, not new instrumentation.

## 4. ISV and ecosystem mechanics — certification as productised trust

### 4.1 AppExchange

Salesforce ISVs distribute **managed packages**: namespaced, vendor-upgradeable bundles whose
internals the customer cannot modify, installed *as data* into a customer org. Every paid
listing must pass the **AppExchange security review** — $999 per submission, 4–8 weeks,
roughly half of first submissions fail — before it may be sold
([Salesforce — how the security review works](https://developer.salesforce.com/docs/atlas.en-us.packagingGuide.meta/packagingGuide/security_review_how_it_works.htm);
[Invisory — security review guide](https://invisory.co/resources/blog/salesforce-appexchange-security-review-guide-for-isvs/);
[appnigma — 2026 listing guide](https://appnigma.ai/blogs/salesforce-appexchange-listing-guide-2026/)).
Revenue share is tiered by partnership model: ISVforce partners pay Salesforce 15% of net
subscription revenue (10% above $20M cumulative); OEM partners 25% (15% above $20M); free
apps pay nothing ([MagicFuse — AppExchange monetisation](https://magicfuse.co/blog/appexchange-pricing-and-monetisation)).

### 4.2 SAP partner certification

SAP runs a graded trust ladder: **SAP Certified** (technical interoperability against
published guidelines, via the Integration and Application Readiness checks) → **SAP
Endorsed** (security testing + performance benchmarking, invitation only) → **SAP Solution
Extension** (SAP itself tests, markets, and sells the partner product, invitation only)
([EPI-USE — certification levels explained](https://www.epiuselabs.com/lets-talk-hcm/what-is-the-difference-sap-certified-partner-sap-store-listing-and-sap-certified-solution);
[SAP News — integration certification updates](https://news.sap.com/2026/01/updates-sap-integration-certification-program-partner-built-solutions/)).
SAP Store revenue shares run roughly 15% for integration solutions up to ~25% for
BTP-platform solutions ([Enterprise Nerds — SAP Store](https://enterprisenerds.com/sap-store-marketplace-partners/)).

### 4.3 BBaaS implications — the future model/playbook marketplace

The session-1 paper named the third-party ecosystem (consultancies authoring policy template
packs, model vendors publishing citable engines) as future work. The mechanics above give it
a playbook:

- **The managed-package analogue is an event-and-artefact bundle**: a policy template pack,
  a model engine, or a procedure playbook ships as a signed bundle of typed artefacts —
  content-addressed documents, graph nodes with citations, optionally tenant-namespaced
  handlers against released contracts — installed into a tenant store *as events*, with the
  vendor retaining upgrade rights through versioned re-issue events. Namespacing (the
  managed-package innovation that prevents collisions and protects IP) maps directly to
  event-type and node-ID namespaces per publisher.
- **Certification when artifacts are citable events is mechanically checkable.** Both
  incumbents' reviews are point-in-time, human-mediated, and expensive precisely because the
  artefact under review is opaque code. A BBaaS third-party pack is *inspectable structure*:
  certification = the platform's own recon suite run against the pack — citation-gate (every
  node cites upward, no orphans: Principle 2), released-surface gate (§1.4), posting-engine
  single-subscriber, provision-tick drift. The certificate itself should be an event
  (PackCertified, citing the gate runs), making certification *continuous*: a pack that
  drifts red loses its certificate by projection, not by re-audit. Point-in-time review
  survives only for what recon cannot see (model methodology soundness — a Helena/CRO-class
  human gate).
- **Security review matters more, not less, in banking.** Half of AppExchange first
  submissions failing is the right prior for third-party quality. A pack that ships handlers
  (not just config/knowledge artefacts) needs the full Principle 4 treatment — threat model,
  least-privilege contracts — before touching any tenant store.
- **Revenue share at 15–25% with volume step-downs and free-tier exemption** is the settled
  industry corridor twice over; adopt it rather than re-derive it.
- **Sequencing caution:** both ecosystems work because the platform was big enough to be
  worth certifying against. The marketplace is a post-traction motion; what is *not*
  deferrable is the namespacing and released-surface discipline (§1.4, §2.4) that makes a
  marketplace possible later without re-architecture.

## 5. Cautionary cases — how platforms fail their tenants

### 5.1 Customisation sprawl: Lidl ($580M)

Lidl spent 2011–2018 and ~$580M failing to implement SAP, the central wound being a single
boundary concession: Lidl valued inventory at purchase price where SAP's standard assumed
retail price; rather than adapt the process, the core was customised, and the customisation
cascaded until the system was unmaintainable
([CIO — famous ERP disasters](https://www.cio.com/article/278677/enterprise-resource-planning-10-famous-erp-disasters-dustups-and-disappointments.html);
[Third Stage — Lidl's $600M failure](https://www.thirdstage-consulting.com/blog/lidls-600-million-sap-disaster/)).
The lesson is not "never accommodate a tenant" — it is that **accommodation through the wrong
channel is fatal**. A purchase-price valuation model in a *configuration layer* (a different
valuation engine selected per tenant, behind the same released contract) would have been a
product feature; the same logic patched *into the core* was a death sentence.

### 5.2 Go-live without verified process mapping: Revlon and Haribo

Revlon's 2018 SAP rollout left it unable to fulfil ~$64M of shipments and triggered a
shareholder suit ([Henrico Dolfing — Revlon case study](https://www.henricodolfing.com/2019/08/case-study-revlon-sued-because-sap-implementation.html));
Haribo's S/4HANA move broke raw-material and inventory tracking across 16 factories, with a
25% sales decline in its flagship product
([Onfinity — S/4HANA failures](https://onfinity.io/blog/technologies/top-5-sap-s-4-hana-failures-and-lessons-learned/)).
Both are *verification* failures: the platform was fine; the tenant's processes were mapped
onto it wrongly, and nothing mechanical checked the mapping before live traffic. The BBaaS
counter is already in the substrate's DNA: tenant onboarding must end in a **rehearsed
readiness gate** — replay-verified projections, green tenant recon suite, parallel-run
evidence — before any cutover. The platform should *refuse* a go-live the gates cannot
prove, because (as Revlon shows) a tenant-bank's failed cutover becomes the platform's
existential lawsuit.

### 5.3 Upgrade paralysis as ecosystem-level debt

Beyond single failures, the systemic SAP pattern: thousands of customers still on ECC near
the 2027 support deadline because decades of Level C/D customisation made upgrading a
multi-year, eight-figure project — effectively *negative* lock-in, where customers are stuck
on the old version rather than attached to the new one
([Kellton — 2027 deadline guide](https://www.kellton.com/kellton-tech-blog/sap-ecc-s4hana-migration-2027-deadline);
[Pathlock — ECC to S/4HANA](https://pathlock.com/blog/sap-ecc-to-sap-s4hana-migration/)).
Salesforce proves the alternative exists: zero customers have ever been stranded on an old
version, *because there is nothing tenant-owned in the upgrade path*. The BBaaS rule follows:
**nothing a tenant owns may sit in the upgrade path.** Tenant artefacts are events and
config; platform upgrades replay them. Any design that lets a tenant artefact block a
platform upgrade is Level D and prohibited.

### 5.4 Governor-limit friction and lock-in complaints

Salesforce's limits keep the fleet safe but generate chronic developer friction — CPU
timeouts on legitimate workloads, managed packages silently consuming the customer's own
budget, whole consulting practices devoted to limit workarounds
([Salesforce Ben](https://www.salesforceben.com/what-is-apex-cpu-time-limit-exceeded-how-do-you-solve-it/);
[LeanData](https://www.leandata.com/blog/eliminating-apex-cpu-time-limit-exceeded-errors-in-salesforce/)).
And both ecosystems draw lock-in complaints: proprietary languages (Apex/ABAP), data
gravity, and certification/revenue-share regimes that bind ISVs to the platform's terms.
BBaaS inherits a structural advantage here worth stating as positioning: **a tenant's entire
state is a portable, replayable event log in the tenant's own store** — exit is a database
copy, not a data-extraction project. Counter-intuitively, cheap exit is a *selling point* to
bank boards and regulators (resolution planning, vendor-risk clauses) that neither incumbent
can offer.

### 5.5 The anchor-tenant firewall, restated with evidence

W3 and session-1 both flag the anchor tenant (the SA bank) as the first boundary temptation.
The cases above turn that flag into a rule with named precedents: Lidl is what happens when
the biggest customer's "just this once" lands in the core; ECC 2027 is what it compounds
into. **The anchor tenant's needs flow through the same config/extension channels as any
future tenant's, from the first day of v2, with zero exceptions** — and the clean-core recon
gate (§1.4) applies to the anchor *first*, precisely because it is the only tenant with the
standing to demand exceptions.

## 6. Nearest-domain comparator: Thought Machine Vault Core

Chosen over Temenos: Temenos Transact is the *cautionary* shape — a feature-rich core whose
customisation depth historically made upgrades painful, now retrofitting an "Extensibility
Framework" to pull banks back toward out-of-the-box behaviour
([Luxoft — why upgrade Temenos](https://www.luxoft.com/blog/temenos-core-banking-system-upgrade-partner);
[Accutive — Transact overview](https://accutivefintech.com/partners/temenos-coe/temenos-transact-core-banking/))
— i.e., SAP's §1 story replayed in banking, adding little new. Thought Machine is the
*architectural* comparator: a cloud-native core that chose the Salesforce-shaped answer for
banking from day one.

**The model.** Vault Core draws one hard line: a universal real-time **ledger** (the
platform, never modified) below a **configuration layer owned by the bank**, where every
financial product is a *smart contract* — Python product logic defining interest, fees,
schedules, eligibility — deployed as configuration, not as platform code. Banks build, test,
and launch any product with no Thought Machine involvement and no platform-layer change; a
global Product Library ships pre-written contracts banks customise before launch
([Thought Machine — Vault Core](https://www.thoughtmachine.net/vault-core);
[Thought Machine — product development vs closed-box](https://www.thoughtmachine.net/blog/product-development);
[Core Banking Radar — hyper-configurable neo-core](https://cc-bei.news/en/core-banking-radar-vault-core-a-hyper-configurable-neo-core-banking-system-from-thought-machine/)).
Production proof exists at real banks (e.g. Shawbrook's SME-lending core
([press release](https://www.thoughtmachine.net/press-releases/shawbrook))).

**What to copy.**
1. **The single hard line, drawn at the ledger.** Vault's strict separation between smart
   contracts and the underlying ledger is exactly the BBaaS event-store/config split — the
   tenant may define *what products mean*; it may never touch *how the ledger works*. BBaaS
   already has the stronger version of the lower layer (an event log rather than a mutable
   ledger), and its posting-rules-as-data direction (D-SLA-ENGINE-RULES-AS-DATA) is the same
   move as smart contracts.
2. **Product Library as starter config.** Pre-written, customisable product templates are
   the right onboarding shape for the comprehensive tier — and in BBaaS they arrive as
   citable template packs (§4.3), each carrying its regulatory citations from birth.
3. **"No dependency on the vendor for product change"** as an explicit sales promise — it is
   the same promise the config-event layer makes, and it demonstrably wins deals in banking.

**What to avoid / where BBaaS goes further.**
1. Smart contracts are **arbitrary Python** — expressive, but the platform cannot statically
   verify what a contract does, so safety rests on testing discipline. The BBaaS tenant
   layer should stay *declarative* (typed config events interpreted by platform engines) as
   far as it possibly can, reserving Turing-complete extension for the side-by-side channel
   behind released contracts — verifiable beats expressive in a regulated core.
2. Vault's scope stops at the ledger and products. It has no answer for the layers above —
   obligations, policies, returns, recon, the agent labour force — which is precisely the
   BBaaS differentiated surface: Vault sells a configurable *ledger*; BBaaS sells a
   configurable *bank*, with the regulatory chain (Principle 2) attached to every
   configured artefact.
3. Bank-owned configuration without a compliance grade invites quiet sprawl *inside* the
   config layer (a thousand-contract estate is ECC-in-Python). The §1.2 lesson applies to
   the tenant layer too: config complexity needs its own measured, governed register.

## 7. Synthesis — the BBaaS platform doctrine

Ten doctrine statements, each with its source finding.

1. **The core is code; the tenant is events.** No tenant artefact is ever deployed into
   platform code; all tenant specificity lives in append-only config/adoption events and
   side-by-side extensions behind released contracts. *(SAP clean core §1.1; Vault's
   ledger/contract line §6; Lidl §5.1.)*
2. **The released surface is typed and versioned, and everything else is closed.** Tenants
   and third parties touch only published event schemas and projection contracts; access to
   anything unreleased is a build failure, not a review comment. *(SAP released-API
   doctrine + ABAP Cloud enforcement §1.1–1.2.)*
3. **Boundary compliance is computed, graded, and standing — recon is the clean-core
   police.** An enforcing gate blocks unreleased-surface access; a per-tenant compliance
   register tracks graded exceptions as typed, time-boxed events. We ship the police before
   the first tenant, inverting SAP's twenty-year retrofit. *(ATC + A–D levels + Cloud ALM
   dashboard §1.2–1.4.)*
4. **Tenant runtimes are composed from event-sourced config — auditable, replayable,
   drift-proof — which is strictly stronger than mutable metadata.** The composition factory
   is BBaaS's Universal Data Dictionary, with history and citations the UDD lacks.
   *(Salesforce metadata runtime §2.1; W3 Option C.)*
5. **One platform version across the fleet, contractually mandatory, with replay-clone
   pre-flight.** Upgrades fan out across N tenant stores under an evented fleet-upgrade
   ledger and a fleet-drift recon gate; every tenant is replayed against vNext before
   rollout. Nothing a tenant owns may sit in the upgrade path. *(Salesforce releases +
   sandboxes §2.3–2.4; ECC stranding §5.3; W3 fleet-drift risk.)*
6. **Per-tenant resource governance is designed in at tenant #1: agent-token budgets, store
   quotas, recon-compute metering — graduated and visible, never a silent kill.**
   *(Governor limits §2.2; friction findings §5.4.)*
7. **Tier boundaries sit on structural capabilities, with usage meters inside each tier.**
   Knowledge tier = read the graph; risk-and-reporting tier = emit events into a tenant
   store (the "API-access line" where upsell concentrates); comprehensive tier = the
   assurance bundle. Meters are projections over events already emitted. *(Editions
   economics §3; session-1 tier sketch.)*
8. **Third-party artefacts ship as namespaced, signed event-and-artefact packs;
   certification is the platform's own recon suite, re-asserted continuously, with the
   certificate itself an event.** Human review survives only where recon cannot see.
   Revenue share lands in the proven 15–25% corridor. *(Managed packages + security review
   + SAP certification ladder §4.)*
9. **Tenant onboarding ends in a rehearsed, gate-proven go-live the platform can refuse.**
   Replay-verified projections, green tenant recon, parallel-run evidence — because a
   tenant-bank's failed cutover is the platform's lawsuit. *(Revlon, Haribo §5.2.)*
10. **The anchor tenant goes through the front door, first and always.** The SA bank's needs
    flow through the same channels as any tenant's, and the boundary gates apply to it
    first — the biggest customer's exception is the documented first step to Lidl. *(§5.1,
    §5.5; W3 anchor-tenant firewall.)*

Two supporting positions, short of doctrine: **declarative beats Turing-complete in the
tenant layer** (prefer typed config events to embedded scripting; push expressiveness to
side-by-side — §6); and **cheap exit is a feature** — the tenant's store is a portable event
log, a vendor-risk answer neither incumbent can give (§5.4).

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W5 deliverable of the
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
      id: "agent:pax:research",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W5 platform-model research: SAP clean core, Salesforce multi-tenancy, ecosystem lessons",
      path: "2026-06-12_pax_v2-bbaas-w5-platform-research.md",
      category: "strategy-analysis",
      author: "PAX (Role researcher)",
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
