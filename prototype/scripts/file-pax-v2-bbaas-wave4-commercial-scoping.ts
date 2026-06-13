// scripts/file-pax-v2-bbaas-wave4-commercial-scoping.ts
//
// One-shot RMS Phase 3 filing for PAX's V2 Wave 4 commercial-scoping paper
// (S15 onboarding + the PA approval-file product; S16 K/R/C tier packaging /
// commercial productisation). Emits a RecordFiled event so the Documents
// register holds the canonical paper. The body is embedded inline (Phase 4 —
// D-RMS-PHASE-4 — made the content-addressed document store the canonical
// home; no in-tree root render is created). Idempotent — skips if already
// filed.
//
// This is an ANALYSIS PAPER for CEO review, NOT a build. No engine/substrate
// change ships with it; the PR carries only this filing script + the paper
// content.
//
// Authority: D-V2-BBAAS-TIER-STRUCTURE (K/R/C); D-W7-VENDOR-ENTITY-STRUCTURE
// (vendor entity + CSI gate before C-tier go-live); D-V2-BBAAS-BLUEPRINT-
// SYNTHESIS (incl. the second-provider fallback constraint); D-RMS-PHASE-3
// (active).
// Brief: brief:pax:v2-wave-4-commercial-scoping-paper-s15-onboardin:2026-06-13
// Author: PAX (Role researcher, Research/engineering)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:pax:v2-bbaas-wave4-commercial-scoping:2026-06-13";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(
    `[file-pax-v2-bbaas-wave4-commercial-scoping] ${RECORD_ID} already filed — skipping.`,
  );
  process.exit(0);
}

const body = `# V2 BBaaS — Wave 4 commercial scoping: S15 onboarding + the PA approval-file product, S16 K/R/C tier packaging

**Author:** PAX (Role researcher, Research/engineering)
**Date:** 2026-06-13
**Authority:** D-V2-BBAAS-TIER-STRUCTURE (K/R/C tiers, approved); D-W7-VENDOR-ENTITY-STRUCTURE
(assignable vendor entity + CSI blocklist gate before C-tier go-live, approved);
D-V2-BBAAS-BLUEPRINT-SYNTHESIS (the Wave plan + the second-provider fallback constraint,
approved).
**Brief:** brief:pax:v2-wave-4-commercial-scoping-paper-s15-onboardin:2026-06-13
**Audience:** Marc (CEO)
**Status:** ANALYSIS PAPER for CEO sign-off BEFORE any Wave 4 build. Nothing here is a
decision or a commitment — §4 names the decisions this paper tees up. It extends, and does
not repeat, my W6 commercial paper
(record:documents:pax:v2-bbaas-w6-commercial:2026-06-12 — competitors, the three tiers
against W2's 25 domains, the pricing hypotheses, the entry sequence) and W5 platform-model
research (record:documents:pax:v2-bbaas-w5-platform-research:2026-06-12 — SAP clean-core
boundary doctrine, Salesforce metadata multi-tenancy). Where W6 set the *commercial frame*,
this paper sets the *productisation mechanics*: how a tenant is actually onboarded against
the substrate Waves 1–3 built, what the anchor's PA approval evidence becomes as a product,
and exactly what K/R/C grant against the released surface.

**Honesty note up front (build-phase reality).** Per CLAUDE.md's operating model: the bank
is a SARB-licensed-institution-*in-formation*. There are no real second tenants, no real
external customers, no real revenue, and the anchor's own licence is not yet granted. The
substrate Wave 4 productises (S5 released-surface, S10 isolation, S11 seats, S12 CSI gate,
S14 fleet/metering) is real, tested code — but every commercial number, buyer name, and
go-live date in this paper is a *hypothesis to be tested*, not a plan of record. The single
hardest dependency in the entire Wave-4 commercial story — that the anchor's own PA
approval lands and proves the approval-file artefact end-to-end — is **not yet done**. This
paper is honest about that: it scopes the product *assuming* the anchor proof completes, and
flags the dependency at every point where it bites.

---

## 1. S15 — Onboarding + the PA approval-file as a product

### 1.0 What the substrate already gives us (the Wave 1–3 floor)

Wave 4 does not invent onboarding from nothing; it sequences four substrate primitives that
already exist as tested code into a tenant-activation flow. Naming them precisely matters,
because the honest scope of "onboarding as a product" is *exactly* the orchestration over
these, plus the content (the corpus, the clause set, the approval file) — not new isolation
or metering engineering:

- **S10 — per-tenant store + tenant-scoped reads (\`v2-core/control-plane/tenant-store.ts\`).**
  ENFORCED, fail-closed. A \`TenantStoreResolver\` maps a \`tenantId\` to that tenant's own
  event store; an unregistered tenant is rejected (never silently defaulted to the anchor).
  Tenant A's scoped store can never surface tenant B's events; a mismatched row is dropped
  and counted (the invariant \`recon:v2-tenant-isolation\` asserts). Today the default
  resolver resolves ONLY the anchor and rejects every other \`tenantId\` — onboarding's job
  is to make the *second* registration real, behind the same seam, without touching callers.
- **S11 — tenant-scoped functional seats (\`v2-core/control-plane/functional-seats.ts\`).**
  The seat is the functional role, tenant-scoped (\`tenant:za-bank:seat:cro\`); the persona
  (Helena, Rohan…) is the anchor tenant's *occupant*. A second tenant gets its OWN seat keys
  that never collide. Seat provisioning is a derivation from a roster — onboarding populates
  a tenant's seat map.
- **S5 / released-surface (\`v2-core/released-surface.ts\`).** The typed manifest of what
  each tier may import from \`v2-core\`. K = no restriction; R = FIL kernel + facets + models
  registry + control-plane tenant/envelope; C = FIL types + read-only query only. The
  \`recon:v2-released-surface-clean-core\` gate fails CI if a K-only export leaks into R/C.
  Onboarding's surface-grant step records *which* surface a tenant is entitled to.
- **S14 — fleet register / metering / upgrade ledger (\`v2-core/control-plane/fleet.ts\`).**
  Pure projections over the control-plane store: every tenant with tier, surface grant,
  platform version, last-meter activity, derived status (active / suspended / behind-on-
  upgrade). A tenant with NO surface grant derives as \`suspended\` — "operationally dark".
  This is the BILLING BASIS (not billing) and the fleet-ops picture onboarding writes into.
- **S12 — cross-tenant CSI gate (\`v2-core/cross-tenant/gate.ts\`).** Fail-closed
  competition-law keystone; K-only by design (it is anchor-internal — no tenant tier can
  call it). Within-tenant flows pass unscreened; cross-tenant flows are blocked unless they
  screen clean against the active CSI blocklist. Relevant to onboarding because the approval-
  file product (1.2) is the first place tenant-specific evidence could leak between tenants.

The clean-core lesson from W5 governs everything below: **a tenant never deploys into core
code; it composes against the *released* surface.** Onboarding is the act of binding a tenant
to a released surface, a seat map, a per-tenant store, and a metering identity — all of which
are control-plane events, never bespoke per-tenant builds.

### 1.1 R-tier onboarding flow (a regulated bank bringing its own licence)

The R-tier buyer is a *bank that keeps its own banking licence and its own core* and
subscribes to the backbone as a risk-and-reporting overlay (W6 §2.1). It is the most
commercially interesting tier (the OneSumX-class collision, on purpose) and the one whose
onboarding is most clearly scoped, because it does NOT require the platform to run the
tenant's operations — only to ingest its positions and re-derive its compliance.

Proposed flow — each step is a control-plane event, replayable and recon-gated:

1. **Posture interview → register populated.** The tenant declares its jurisdiction(s),
   legal-entity tree, licence conditions, product scope, and which BA/regulatory returns it
   must file. This is W8's flagship demo: the interview drives an applicability assessment
   that *materialises the tenant's obligation surface with citations* from the maintained
   corpus (Plane A). What the **platform provides**: the jurisdictional corpus and the
   applicability machinery. What the **tenant supplies**: its own licence conditions, entity
   tree, and product scope — the tenant-specific facts.
2. **Per-tenant store provisioned (S10).** A new \`tenantId\` is registered in the control
   plane; the resolver is extended to resolve the tenant's own store. From this point the
   isolation invariant holds by construction.
3. **Seat map provisioned (S11).** The tenant's required functional seats (for R-tier:
   assurance + risk + reporting seats — CRO seat, Risk-Engineer seat, Reporting seat, CCO
   seat; *not* the full operational roster) are registered, tenant-scoped. The tenant's own
   agents occupy them. Platform provides the seat *definitions* and playbooks; the tenant's
   substrate (or the platform on its behalf, under contract) provides the occupants.
4. **Surface grant recorded (S5).** The tenant is granted the **R-tier released surface** —
   FIL kernel + facets + models registry + control-plane tenant/envelope. The clean-core
   gate guarantees the grant cannot include K-only exports (the CSI gate, anchor-internal
   tooling). Until the grant is recorded the tenant derives as \`suspended\` in the fleet.
5. **Ingestion seam wired (the R-tier-specific step).** The tenant feeds positions/trades
   into the backbone's Position Keeping event contract (W2 §4.2; W6 §2.1). This is the only
   substantial integration work in R onboarding — the bank keeps its core; the backbone
   re-derives risk/capital/returns from the ingested events. Platform provides the typed
   event contract + the depth-2 BIAN alignment notes for the seam domains; tenant supplies
   the feed adapter from its core.
6. **Readiness gate (\`recon:onboarding-readiness\`).** No tenant activation without a green
   readiness gate — signed clause set, residency schedule rendered from control-plane events,
   surface grant present, seat map populated, ingestion seam emitting. This is W5 doctrine-#9
   ("a rehearsed readiness gate the platform can *refuse*") made mechanical. A bank with an
   incomplete pack is refused activation, not soft-activated.
7. **Metering live (S14).** From activation, the tenant's usage (seat-runs, queries, token
   consumption) meters into the fleet summary — the billing basis.

**Substrate gap (honest):** of the seven steps, S10/S11/S5/S14 exist as tested code; step 1
(posture-interview → cited obligation surface) is the W8 applicability machinery, partially
built (S8 applicability assessment exists); step 5 (the Position Keeping ingestion contract
at depth-2 BIAN alignment) and step 6 (\`recon:onboarding-readiness\`) are **named Wave-4
build items, not yet built**. The onboarding *product* is the orchestration script over
these plus the readiness gate — that is the Wave-4 engineering scope, and it is modest
relative to the substrate already standing.

### 1.2 The PA approval-file as a product artefact

This is the distinctive Wave-4 asset and the one most worth getting right. W7 established
that the subscriber's *own* regulatory-approval process is the product's hardest dependency
(a bank cannot consume an outsourced banking substrate without satisfying its own regulator
about outsourcing, materiality, and control). So the anchor bank's own approval evidence is
built deliberately as a **reusable, citation-typed onboarding accelerator** — the reference
implementation every subscriber reuses.

The anchor's file (per the blueprint S15 spec) comprises: the **GN5/2014 prior-approval
application** (materiality assessment, due-diligence pack), the **D3/2018 condition
mapping**, the **C1–C14 master-agreement terms** (the outsourcing clause library), and
**control evidence as recon exports** (the standing harness's coverage numbers, rendered as
point-in-time attestations). The Company Secretary seat (Owen) owns the file; the Regulatory
Knowledge Engineer (Mira) owns the corpus acquisitions it depends on.

**What is genuinely reusable across tenants** (the product):

- The **structural template** — the *shape* of a compliant prior-approval pack: which
  sections, which obligation citations, which control-evidence categories, in what order. A
  new tenant's regulatory-affairs team starts from a proven skeleton, not a blank page.
- The **obligation-traceability machinery** — the corpus, provision trees, adoption workflow,
  and the IMPLEMENTED_BY chains that turn "we have a control" into "here is the cited,
  replayable evidence that the control runs". This is jurisdiction-shared (every SA bank
  files against the same PA corpus; the W6 §4.2 SA selling asset).
- The **clause library** (C1–C14, D-W7-OUTSOURCING-CLAUSE-LIBRARY) — the master-agreement
  terms a tenant signs to consume the backbone, including the outsourcing-regulation armour.
- The **control-evidence *format*** — recon exports as point-in-time attestations: the
  *mechanism* by which any tenant proves its controls, reusable verbatim.

**What is strictly tenant-specific** (must NOT be productised / must NOT leak):

- The anchor's **own materiality assessment, due-diligence findings, and licence
  conditions** — these are facts about *the anchor bank*, not reusable content. A second
  tenant's pack cites its own facts.
- Any **counterparty, exposure, customer, or position data** in the control evidence —
  tenant-confidential by definition.
- The anchor's **supervisory correspondence** with the PA — relationship-specific.

**The IP and competition-law boundary (the load-bearing distinction).** The reusable
template/machinery/clause-library is platform IP (assigned to the vendor entity per
D-W7-VENDOR-ENTITY-STRUCTURE — the assignable entity exists precisely so this IP sits
cleanly outside the controlling-company perimeter and can be licensed arm's-length). The
tenant-specific evidence is the *tenant's* data and must never cross tenants. This is exactly
the boundary the **S12 CSI gate** enforces: the approval-file product is the first concrete
place where one tenant's specifics could leak into another's onboarding, so the productised
artefact must be built such that *only the structural/jurisdictional layer is shared* and
the tenant-specific layer is per-tenant-store data screened by the CSI gate on any
cross-tenant flow. Concretely: the template is a K-tier/platform asset; a tenant's populated
file lives in that tenant's own store (S10) and never informs another tenant's posture
without passing the fail-closed gate. The competition-law risk (a vendor that serves
competing banks learning one bank's strategy and advantaging another) is structurally
answered by keeping the *populated* file tenant-isolated and only the *empty template*
shared.

**Honest dependency:** the approval-file product is only proven when the **anchor's own
GN5/2014 application is assembled and the arm's-length master agreement is executed against
it** (the blueprint S15 exit criterion). Until then the artefact is a designed template
without a reference instance — and the W6 §5.4 procurement-trust argument ("our first
reference is a regulator-supervised bank") is a promise, not a proof. This is the single
biggest gating fact for the whole Wave-4 commercial story.

### 1.3 C-tier onboarding (lighter — note the differences)

The C-tier buyer is a *non-bank FI consuming the constrained surface* (FIL types +
read-only query only — the most restricted released surface). C onboarding is materially
lighter than R because:

- **No ingestion seam.** C consumes the constrained query surface; it does not feed positions
  for risk re-derivation. The heaviest R step disappears.
- **A smaller seat map** (or none) — C-tier may not provision functional seats at all,
  depending on the constrained-surface scope.
- **No bank-licence approval pack.** A non-bank FI does not file a GN5/2014 prior-approval;
  its onboarding-readiness gate is correspondingly lighter (entitlement + clause set +
  residency, but not the full bank approval file).

**The C-tier hard precondition, however, is heavier:** C-tier go-live is gated on
D-W7-VENDOR-ENTITY-STRUCTURE (the assignable vendor entity executed + CSI blocklist gate
populated and active) AND the second-provider fallback constraint (§3.3). The CSI gate is
K-only and fail-closed *today*, but it only becomes load-bearing when a second tenant's
learning flow appears — which a multi-tenant commercial (C) deployment is exactly what
creates. So the C-tier onboarding flow is lighter per-tenant but the *first* C-tier
activation carries the full weight of the go-live preconditions. R-tier, by contrast, can in
principle go to market before the C-tier preconditions are all green (§2.3, §4 Decision 2).

---

## 2. S16 — Tier packaging / commercial productisation

### 2.1 What K / R / C concretely include (mapped to the S5 released surface)

W6 §2 materialised the three tiers against W2's 25 domains. This section pins them to the
*released-surface manifest* (S5) — the typed, gate-enforced declaration of what each tier may
actually call — so packaging is grounded in code, not prose.

| | K — anchor / self-hosted | R — regulated tenant | C — commercial SaaS |
|---|---|---|---|
| **Released surface (S5)** | No restriction — full \`v2-core\` internal access incl. the K-only \`cross-tenant\` CSI tooling | FIL kernel (primitives, taxonomy, urn, composition, lifecycle, type-definition) + the seven facet interfaces + FIL-models registry + control-plane tenant/envelope | FIL types only — FIL-Core (primitives, taxonomy, urn) + facet interfaces; **read-only query**, no composition/lifecycle builder |
| **W2 domains (W6 §2)** | All 25 + anchor-internal tooling | K's 6 knowledge domains + 11 risk/reporting domains + Position Keeping as the ingestion seam | (constrained — non-bank FI consuming the query surface) |
| **Seats (S11)** | Full roster (the anchor's standing agents) | Assurance/risk/reporting seats only | Minimal / none |
| **Cross-tenant (S12)** | Owns the CSI gate (K-only) | Subject to it; cannot call it | Subject to it; cannot call it |
| **Metering (S14)** | Fleet operator | Metered tenant | Metered tenant |
| **Buyer (W6)** | The bank itself | CRO/CFO office of any bank (OneSumX collision) | Non-bank FI; lighter consumers |

The nesting (C ⊂ R ⊂ K) is *enforced by the surface gate*: the C export list is a subset of
R's, R's is a subset of K's full access, and \`recon:v2-released-surface-clean-core\` fails CI
if a K-only export leaks downward. This is the W5 clean-core doctrine made mechanical — the
tier boundary is a released-surface boundary, not a fork. W6 §2.2's upgrade-paths claim (tiers
nest, so upgrades are subscription events not migrations) is therefore *true at the code
level*: an upgrade is a new surface grant + new \`DomainSubscribed\` events, gated by
\`recon:tier-entitlement-coherence\` (a tenant's active domains must match its subscription
events).

### 2.2 Pricing model OPTIONS (trade-offs — not a single answer)

W6 §3 examined five candidate axes and recommended a hybrid. This paper does not re-derive
that; it presents the three *packaging* models the substrate can actually meter and bill, so
Marc can choose the commercial shape. All three are *enabled by S14 metering* — the
difference is what the invoice attaches to.

**Option A — Per-tenant tiered subscription (annual, by tier × bank-size band).** Flat annual
fee per tier. *For:* maximally legible; reads like a Temenos/OneSumX SaaS line item (the
buyer's benchmark file); predictable revenue; trivial to meter (tier + band are
registration facts). *Against:* under-prices heavy users, over-prices light ones; leaves the
differentiated value (the agent workforce) un-monetised; no expansion axis within a tier.

**Option B — Usage-metered via S14 (consumption).** Bill on measured usage — seat-runs,
queries, token consumption — from the fleet metering summary. *For:* aligns price to value
delivered; matches the cloud-native buyer expectation (Mambu/Finxact consumption pricing);
the meter is a projection so the invoice is itself recon-derivable. *Against:* unpredictable
bills scare bank procurement; exposes the token-cost floor directly to the customer;
incentivises the tenant to under-use (which undercuts the assurance value proposition).

**Option C — Hybrid (W6 §3.2 recommendation): tiered-subscription base + per-active-seat +
metered tokens above a bundled allowance; coverage/returns shown as value evidence, not
priced.** *For:* the subscription base gives procurement the familiar shape; agent seats are
the differentiated, expandable axis (priced against the salary each displaces, not the
software it resembles — the category-defining move nobody else *can* make); the token
allowance protects the cost floor without an unpredictable bill (set so ~80% of tenants never
hit it). *Against:* most complex to explain and to administer; the seat axis runs against
nCino's documented retreat from seat pricing (automation shrinks seat counts) — though our
seat is software not a human, so the dynamic differs.

I do not re-commit the W6 recommendation here; I surface it as Option C and flag that the
*choice between A, B, and C is a Decision* (§4 Decision 1). My standing recommendation
remains Option C, but the honest caveat is that the seat-priced axis is the least
market-validated and should be the part most explicitly framed as a revisable hypothesis to
be tested against the first R-tier conversation.

### 2.3 Market-entry posture and sequencing

W6 §4 set the jurisdiction sequence (anchor → SA second-tier/mutual/new-entrant → UK → UAE →
Nigeria/Kenya K-tier). This paper adds the *tier* sequencing — which tier goes to market
first — because that is a Wave-4 packaging decision distinct from jurisdiction.

**Recommended first-to-market tier: K, then R, then C.** Rationale:

- **K first** is the lowest-risk, lowest-integration first purchase (W6 §5.4): a regulatory-
  knowledge subscription that touches no operations, starts the procurement-trust clock, and
  is sellable *without any agent-operated-controls acceptance* — so it degrades gracefully if
  the existential regulatory risk (W6 §5.1) bites. K is also the only tier *demonstrable at
  Wave 2 exit* per the blueprint, and the corpus is already real (the anchor's 1,000+ adopted
  obligations). First external K logo targeted during Wave 4.
- **R second.** R is sellable at Wave-4 exit (it needs the model library + the ingestion
  seam). It is the commercially richest collision (OneSumX-class scope with proof attached)
  and can go to market *before* the C-tier go-live preconditions (vendor entity, CSI gate,
  second-provider fallback) are all green, because R-tier tenants do not create the
  multi-tenant *learning* flows the CSI gate exists to screen in the same way a commercial
  multi-tenant C deployment does. **Honest caveat:** R still consumes the platform across
  tenant boundaries, so the isolation invariant (S10) and the vendor-entity IP assignment
  must be in place before the *first* external R tenant — R is "lighter on preconditions than
  C", not "no preconditions".
- **C last.** C-tier go-live is gated on the full D-W7 stack + second-provider fallback. It
  is the highest-trust, highest-precondition tier. The first realistic C-tier prospect from
  W6 is a new mutual/co-op (YWBN-class) or the SAIFSC co-operative segment whose economics
  only work near-zero-staff — the purest BBaaS fit, but also the one needing the most
  regulatory acceptance.

**The realistic first R-tier buyer profile (from W6 §4.2):** a small SA bank carrying a full
BA-return burden on a small balance sheet — Finbond Mutual Bank or GBS Mutual Bank class —
where the compliance-cost-to-income argument is sharpest, and where every prospect files the
*same* BA returns the anchor files (the corpus is 100% reusable, the reference 100%
relevant). This is the single strongest SA selling asset and the reason SA-second-tier
precedes any offshore push.

### 2.4 The second-provider fallback constraint (C-tier go-live precondition)

D-V2-BBAAS-BLUEPRINT-SYNTHESIS records (risk R4) the constraint that a **tested
second-model-provider fallback for assurance-critical seat classes** is a standing
pre-condition to any external C-tier go-live. Concretely, what it requires:

- **A second model provider integrated behind the agent substrate's provider-facing seam.**
  W6 §5.3 established the substrate is provider-agnostic by construction (briefs, runs, typed
  events are the narrow provider-facing surface; the seats' prompts/playbooks are the porting
  cost). The constraint requires this to be *tested*, not merely architecturally possible —
  the assurance-critical seat classes (the recon/audit/control seats) must demonstrably run
  on the fallback provider.
- **Scope: assurance-critical seats only**, not the whole roster — the constraint is
  proportionate. The seats that *must* keep running for the platform to remain provably
  compliant (the harness operators, the control seats) are the ones that need the fallback;
  a degraded-but-safe mode for the rest is acceptable.
- **A standing workstream now, not a licence-day scramble.** The blueprint's framing
  (approved): "a small standing workstream now versus an existential scramble later". It is a
  C-tier go-live gate, so it does *not* block K-tier or (arguably) R-tier market entry — but
  it must be green before the first commercial C tenant.
- **Contractual face:** token pass-through / repricing clauses (W6 §3.1) and provider
  disclosed to tenants as a sub-outsourcer with layered assurance (W7 C6) — the residual
  dependency is *disclosed* the way banks disclose cloud concentration, not hidden.

This ties directly to the §4 Decision 4 ask: direct the substrate roadmap (Atlas) to stand
up the tested fallback as a Wave-4-era standing constraint, gated to C-tier go-live.

---

## 3. Risk and readiness — what is real now vs licence-day (do not oversell)

This section is deliberate, because the brief insists on honesty and this paper goes to the
CEO for real decisions. The packaging above is sound *given* the substrate Waves 1–3 built —
which is real. But three facts must not be glossed:

### 3.1 The anchor proof is the gating dependency

Every commercial claim — the approval-file product, the "first reference is a regulator-
supervised bank" trust argument, the C-tier "our first customer is a bank we run" proof —
rests on the anchor's own SARB licence landing and its approval file being assembled and
proven end-to-end. **That has not happened.** Until it does, Wave 4 can build the onboarding
mechanics and the template, but cannot *sell* with a reference. Sequencing the build now is
correct (the substrate and the template are reusable regardless); committing to external
customers or dates is not.

### 3.2 The existential risks from W6 are unchanged and unmitigated by Wave 4

W6 §5 ranked them: regulators refusing agent-operated controls (5.1) and model-provider
dependency (5.3) are existential-class. Wave 4 does not resolve either — it *mitigates* 5.3
via the second-provider fallback constraint (§2.4) and *hedges* 5.1 by making K/R sellable
without agent-operated-controls acceptance (§2.3). The C-tier — the richest revenue — remains
the most exposed to 5.1. This is a structural feature to disclose, not a bug to hide.

### 3.3 Wave 4 is a modest build on a real substrate — the honest scope

The good news, stated plainly: because Waves 1–3 landed the hard substrate (isolation, seats,
surface, fleet, CSI gate, eval harness), Wave 4's *engineering* scope is genuinely modest —
the onboarding orchestration script, the \`recon:onboarding-readiness\` and
\`recon:tier-entitlement-coherence\` gates, the ingestion-seam contract at depth-2 BIAN
alignment, the value-evidence invoice rendering, and the approval-file template assembly. The
heavy lifting in Wave 4 is *commercial and content* (the approval file, the clause library,
the pricing decision, the go-to-market), not substrate. That is the right shape for a
"convert substrate into product" wave — and it is why this is a CEO decision paper, not an
engineering build brief.

---

## 4. The decision menu — what Marc must decide before Wave 4 builds

Each decision has options, my recommendation, and the trade-off. I do NOT pre-commit these;
they are surfaced for the CEO's call. (Decisions are proposed IDs; recording them is Marc's.)

**Decision 1 — Pricing model.** *(proposed D-V2-BBAAS-WAVE4-PRICING-MODEL)*
- **Options:** (A) per-tenant tiered subscription; (B) usage-metered via S14; (C) hybrid —
  subscription base + per-seat + metered tokens above allowance, coverage as value evidence.
- **Recommendation:** **C (hybrid)** — confirms the W6 §3.2 hypothesis as the *working* model
  to test, with the seat-priced axis explicitly flagged as the least-validated part.
- **Trade-off:** C captures the differentiated value (the agent workforce) and gives
  procurement a familiar base, but is the most complex to explain/administer and the seat axis
  is unproven; A is simplest but leaves the differentiator un-monetised; B aligns to value but
  produces unpredictable bills banks dislike.

**Decision 2 — First-to-market tier.** *(proposed D-V2-BBAAS-WAVE4-ENTRY-TIER)*
- **Options:** lead with K / lead with R / lead with C.
- **Recommendation:** **K first, then R, then C.** K is lowest-risk, lowest-integration,
  demonstrable earliest, and sellable even if agent-operated-controls acceptance never comes.
- **Trade-off:** K is the lowest-revenue tier — leading with it is slower to material revenue
  but de-risks the procurement-trust and regulatory-acceptance unknowns before the
  high-precondition C tier. Leading with R reaches revenue faster but needs the ingestion seam
  built and the isolation/vendor-entity preconditions green before the first external tenant.

**Decision 3 — How much of the PA approval-file is productised vs held.** *(proposed
D-V2-BBAAS-WAVE4-APPROVAL-FILE-SCOPE)*
- **Options:** (A) productise only the structural template + clause library + evidence
  *format* (anchor's specific facts held); (B) also productise jurisdiction-shared filled
  sections; (C) hold the approval file entirely as internal IP, sell onboarding without it.
- **Recommendation:** **A** — productise the reusable template/machinery/clause-library and
  the evidence format; hold every anchor-specific fact (materiality, due-diligence findings,
  supervisory correspondence) per-tenant, screened by the S12 CSI gate.
- **Trade-off:** A is the competition-law-safe boundary (only the empty template + shared
  jurisdictional layer crosses tenants; the populated file stays isolated) and is the strongest
  reusable asset without leaking one tenant's specifics; B risks competition-law exposure and
  CSI-gate violations; C forgoes the single most differentiated onboarding accelerator.

**Decision 4 — Second-provider fallback gate (ask, not a new policy).** *(under
D-V2-BBAAS-BLUEPRINT-SYNTHESIS R4 — already approved as a direction; this confirms the
Wave-4 execution)*
- **Options:** stand it up now as a Wave-4 standing constraint gated to C-tier go-live / defer
  to licence-day.
- **Recommendation:** **stand it up now** — direct the substrate roadmap (Atlas, Substrate
  Architect, engineering) to build + test a second-model-provider fallback for
  assurance-critical seat classes as a Wave-4-era standing workstream, gated as a C-tier
  go-live precondition.
- **Trade-off:** a small standing workstream now versus an existential scramble later (the
  approved blueprint framing). Deferring saves near-term effort but converts a managed
  constraint into a launch-blocking emergency.

**Decision 5 — Build-vs-sell gating (the honesty decision).** *(proposed
D-V2-BBAAS-WAVE4-BUILD-SELL-GATE)*
- **Options:** (A) build Wave-4 onboarding + packaging mechanics now, but gate any external
  customer engagement on the anchor's own PA approval landing + approval-file proven
  end-to-end; (B) build and begin external commercial conversations in parallel with the
  anchor proof.
- **Recommendation:** **A** — build the mechanics now (they are reusable regardless), but do
  not commit to external customers, pricing rate cards, or dates until the anchor proof
  completes (§3.1). This keeps the substrate progressing while honouring the build-phase /
  licence-day distinction.
- **Trade-off:** A is honest and protects the company from selling an unproven reference, but
  delays revenue; B reaches the market faster but risks committing to customers before the
  single hardest dependency (the anchor's own approval) is proven — a credibility risk with
  exactly the conservative bank buyers W6 §5.4 describes.

---

## 5. Substrate gaps surfaced (roadmap items, not hidden)

Per CLAUDE.md's steady-state-vs-current-substrate discipline, the gaps this analysis exposes:

1. **\`recon:onboarding-readiness\` and \`recon:tier-entitlement-coherence\` gates** — named in
   the blueprint, **not yet built**. Wave-4 engineering items.
2. **The Position Keeping ingestion seam at depth-2 BIAN alignment** — the R-tier-specific
   onboarding step; **not yet built**.
3. **The PA approval-file template assembly + the arm's-length master-agreement execution
   against the anchor's own file** — the blueprint S15 exit criterion; depends on the W7
   corpus acquisitions (JS 1/2023, NPS Act, Competition Act) and D-W7-OUTSOURCING-CLAUSE-
   LIBRARY; **not yet done**, and gated on the anchor's own PA approval.
4. **The second-provider fallback** for assurance-critical seats — approved as a direction
   (blueprint R4), **not yet built** (Decision 4).
5. **The anchor's own SARB licence + approval file** — the gating dependency for every
   commercial claim (§3.1); a licence-day-class item, not an engineering one.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). Wave-4 commercial-scoping
deliverable of the WS-V2-BBAAS structural analysis. Authority: D-V2-BBAAS-TIER-STRUCTURE,
D-W7-VENDOR-ENTITY-STRUCTURE, D-V2-BBAAS-BLUEPRINT-SYNTHESIS. This is an analysis paper for
CEO review — nothing here is a decision or a commitment.*
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
    citations: [
      "D-RMS-PHASE-3",
      "D-V2-BBAAS-TIER-STRUCTURE",
      "D-W7-VENDOR-ENTITY-STRUCTURE",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    ],
    actor: {
      type: "service",
      id: "agent:pax:research",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — Wave 4 commercial scoping: S15 onboarding + PA approval-file product, S16 K/R/C tier packaging",
      path: "2026-06-13_pax_v2-bbaas-wave4-commercial-scoping.md",
      category: "strategy-analysis",
      author: "PAX (Role researcher)",
      date: "2026-06-13",
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
