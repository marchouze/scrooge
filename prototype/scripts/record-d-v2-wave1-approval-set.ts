// scripts/record-d-v2-wave1-approval-set.ts
//
// Records the V2 BBaaS Wave-1 approval set — Marc's in-session approval
// (2026-06-12) of the seven architectural decisions the blueprint synthesis
// surfaced as the "immediate approval set" needed to unlock Wave 1 + the
// spine of Wave 2 under the revised mono-repo-two-packages repo verdict.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-V2-REPO-STRATEGY-REEXAMINATION; D-FIL-FRAMEWORK-UNIFICATION.
//
// Scrooge is the recording instrument (recordedVia: scrooge:session-delegation);
// Marc (marc@tgv.co.za) is the authorizing principal. Idempotent on
// (decisionId, phase, as_of).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

// Two-second request→approve spacing so the approval is strictly after the
// request in the ordered log (as_of-tie avoidance — see decision-triage memo).
const T = (n: number, phase: "req" | "app") => {
  const base = Date.parse("2026-06-12T18:30:00.000Z") + n * 4000;
  const ms = base + (phase === "app" ? 2000 : 0);
  return new Date(ms).toISOString();
};

type Decision = Omit<Parameters<typeof requestDecision>[0], "recordedVia"> & { _n: number };

const COMMON = {
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  sourceDocHashes: [] as string[],
};

const decisions: Decision[] = [
  {
    _n: 0,
    decisionId: "D-V2-TENANCY-ARCHITECTURE",
    ...COMMON,
    category: "engineering" as const,
    title:
      "V2 tenancy architecture = Option C — per-tenant event stores + a shared control-plane store",
    recommendation:
      "Adopt Option C from the W3 tenancy analysis: each tenant (anchor ZA bank, future regulated tenants, future commercial tenants) gets its own isolated event store; a single shared control-plane store holds cross-tenant metadata (tenant registry, fleet/metering, upgrade ledger, released-surface manifest). The envelope carries a tenant axis (dark in Wave 1, enforced in Wave 3). This is the structural identity of the Azure target (Principle 3) — separate Cosmos/Postgres instances per tenant + one control-plane instance — so the M8 lift swaps file paths for connection strings without touching capability code. Unlocks S1 (control-plane store) and S2 (tenant axis in envelope, dark).",
    rationale:
      "Option A (shared store + tenant discriminator column) risks cross-legal-entity data bleed and makes per-tenant export / deletion / regulator-segregation expensive — unacceptable for a multi-tenant regulated platform. Option B (schema-per-tenant in one Postgres) couples upgrade blast-radius and Azure cost across tenants. Option C gives hard isolation (each tenant's log is physically separate, the strongest POPIA s.19 and competition-law CSI posture), keeps the control plane thin and explicit, and matches the cross-worktree shared-store model already proven in the dispatch substrate. The W3 paper scores C highest on isolation, regulator-segregation, and cloud-lift fidelity.",
    citations: [
      "D-V2-BBAAS-W2-W3-DISPATCH",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "Principles/3-cloud-native.md",
      "Principles/4-security-designed-in.md",
    ],
  },
  {
    _n: 1,
    decisionId: "D-MODEL-BINDING-CONTRACT-V1",
    ...COMMON,
    category: "engineering" as const,
    title:
      "FIL model-binding contract v1 — facets are the sole data-access path; models declare implements/requires/emits/cites",
    recommendation:
      "Ratify the FIL-Models binding contract as the single data-access discipline for v2: every consumer layer (engines, projections, renderers, risk, accounting, returns, recon) programs against FIL-Facets (Lifecycled, Valuable, Accountable, RegulatoryClassifiable, RiskMeasurable, Reportable, PostureRelevant), never against raw event-store .replay() queries. Each FIL-Model declares: implements [facet] over [taxonomy scope]; requires [facets + data + posture]; emits [event families]; cites [provisions]. Versioning key is (facet, scope, version), methodologyHash-anchored. Conformance gate recon:fil-conformance asserts every facet consumer resolves to a registered implementation. In-scope migration surface is ≈450–500 production .replay() call-sites (of ≈1,678 total); recon pipelines migrate behind facets too. v1 code stays untouched behind the no-v1-import boundary; v2 core is FIL-mediated from line one. Unlocks S7-FIL and every downstream domain cutover.",
    rationale:
      "Requirement B (FIL-mediated access) and Requirement A (intra-tenant multi-legal-entity) restructure the same ≈25–30 platform modules — the binding contract is what makes both tractable at once: a facet call is entity-parameterised and tenant-parameterised by construction, so threading the LE/tenant axis happens once at the facet boundary rather than at 1,380 literal call-sites. Without a sole-access-path discipline the two vocabularies (raw replay vs facet) drift into exactly the multi-vocabulary divergence the W9 gap analysis measured in v1. The contract is declarative and citable, so model-risk validation (Rohan's plane) can audit implements/requires/emits/cites without reading engine internals.",
    citations: [
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-V2-BBAAS-W9-FIL",
      "D-V2-REPO-STRATEGY-REEXAMINATION",
      "Principles/1-events-are-truth.md",
      "Principles/2-single-graph-discipline.md",
    ],
  },
  {
    _n: 2,
    decisionId: "D-W4-MODEL-LIBRARY-PILOT",
    ...COMMON,
    category: "engineering" as const,
    title:
      "W4 model-library pilot = SA-CCR as the first FIL-Model, parity-gated against the live log",
    recommendation:
      "Extract SA-CCR (BCBS d317 counterparty-credit standardised approach) as the first FIL-Model implementing RiskMeasurable over fil:type:ir:* and fil:type:fx:* taxonomy scopes. It declares: requires lifecycle + netting-set + collateral facets; emits the CCR event family; cites BCBS d317. The pilot is the merged S7-FIL slice (S-FIL-2 + S7) and is the first cross-package cutover: build in v2 core, replay the anchor's full IR+FX history through it, assert byte-equivalence against the live CCR events, flip the alias, retire the v1 path. Proves the binding contract works for a real model AND the strangler cutover pattern works at domain scale. Owners: Rohan (Risk Engineer, implementation + validation plane) with Nadia (model validation).",
    rationale:
      "SA-CCR is the right pilot because it is non-trivial (multi-asset-class, netting, collateral, add-on factors) yet fully specified by a single citable standard, already implemented in v1 (so a parity oracle exists), and exercises five of the seven facets. A green parity gate on SA-CCR de-risks every subsequent domain cutover; a red one surfaces binding-contract gaps while the blast radius is one model. Picking a model with an existing live oracle means the cutover is provable, not asserted — consistent with the merged-is-not-canonical discipline.",
    citations: [
      "D-FIL-FRAMEWORK-UNIFICATION",
      "D-V2-BBAAS-W4-W7-DISPATCH",
      "D-MODEL-BINDING-CONTRACT-V1",
      "Principles/2-single-graph-discipline.md",
    ],
  },
  {
    _n: 3,
    decisionId: "D-W8-POSTURE-REGISTER-SLICE-1",
    ...COMMON,
    category: "engineering" as const,
    title:
      "W8 agent-learning Slice 1 — posture register + APPLIES_WHEN seam (structured-first; weights propose, events dispose)",
    recommendation:
      "Stand up the posture register as the Wave-1 W8 slice: a typed, event-sourced register of agent operating postures (risk-appetite stances, procedure variants, jurisdictional toggles) with an APPLIES_WHEN predicate seam binding each posture to the conditions under which it is active. Pilot the extraction on one domain (Helena's risk-appetite postures). The architecture is structured-first: learned weights may PROPOSE a posture change, but only a typed event DISPOSES it — no weight silently mutates behaviour. Owners: Mira (CoRO, register substrate), Atlas (Substrate Architect, APPLIES_WHEN seam), Helena (CRO, pilot postures). Unlocks S3.",
    rationale:
      "The bank's whole control story rests on events being the only source of truth (Principle 1); an agent-learning layer that let model weights change behaviour directly would punch a hole straight through it. Structured-first keeps every behavioural change typed, citable, and replayable — the learning layer becomes a proposal engine over the same event spine, not a parallel uncontrolled one. Starting with risk-appetite postures gives an immediately load-bearing pilot (the RAS already has structured thresholds) and a real APPLIES_WHEN predicate to validate the seam against.",
    citations: [
      "D-V2-BBAAS-W8-AGENT-LEARNING",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "Principles/1-events-are-truth.md",
      "Principles/6-autonomous-by-default.md",
    ],
  },
  {
    _n: 4,
    decisionId: "D-W8-DECISION-IMPACT-SWEEP",
    ...COMMON,
    category: "engineering" as const,
    title:
      "W8 decision-impact sweeps — every Decision event triggers an applicability sweep over affected postures/models",
    recommendation:
      "Build the decision-impact-sweep mechanism: when a Decision event lands, an automated sweep computes which postures, FIL-Models, procedures, and obligations are affected and emits typed impact-assessment events surfacing what must be re-validated or re-distilled. This is the closed-loop counterpart to the posture register — decisions dispose, and the sweep makes the downstream consequences explicit rather than relying on an agent to remember. Owner: Owen (Company Secretary, governance), with Atlas (sweep engine). Wave-2 slice S9.",
    rationale:
      "Today a decision's downstream impact is carried in an agent's working memory and a prose follow-on-routes list — exactly the kind of implicit linkage Principle 2 (single-graph discipline) exists to eliminate. A typed sweep turns 'what does this decision touch?' into a query over the graph, makes orphaned impacts a recon finding, and gives the agent-learning layer a concrete signal (impact events) to propose posture changes against. It is the governance keystone that makes the posture register safe to act on at fleet scale.",
    citations: [
      "D-V2-BBAAS-W8-AGENT-LEARNING",
      "D-W8-POSTURE-REGISTER-SLICE-1",
      "Principles/2-single-graph-discipline.md",
    ],
  },
  {
    _n: 5,
    decisionId: "D-V2-BBAAS-TIER-STRUCTURE",
    ...COMMON,
    category: "product" as const,
    title:
      "V2 BBaaS commercial tier structure = K (anchor/self-hosted) · R (regulated-tenant) · C (commercial SaaS)",
    recommendation:
      "Adopt the three-tier product structure from the W6 commercial analysis: K-tier — the anchor bank itself, self-hosted, full-control, the reference implementation; R-tier — regulated banking tenants (their own licence) running on isolated per-tenant stores with the full control substrate; C-tier — commercial SaaS for non-bank financial institutions consuming a constrained surface. Each tier is a packaging of the same FIL-mediated platform, differentiated by released-surface scope and tenancy isolation, not by code fork. Productisation lands in Wave 4 (S16); the tier identity is fixed now so the released-surface gate (S5) and tenant axis (S2) are built tier-aware from Wave 1.",
    rationale:
      "Fixing the tier identity early is what keeps S5 (released-surface / clean-core boundary) and S2 (tenant axis) from being retrofitted: the clean-core boundary is exactly the K/R/C released-surface line, so the gate must know the tiers exist from the first slice. Three tiers (not a single SaaS product) reflect the real market the W6 analysis found — the highest-value near-term buyers are regulated banks wanting the substrate under their own licence (R), which needs hard per-tenant isolation, while the C surface is a later, more constrained offering. No spend is committed by fixing identity; it only constrains how the Wave-1 seams are shaped.",
    citations: [
      "D-V2-BBAAS-W4-W7-DISPATCH",
      "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
      "D-V2-TENANCY-ARCHITECTURE",
    ],
  },
  {
    _n: 6,
    decisionId: "D-W7-VENDOR-ENTITY-STRUCTURE",
    ...COMMON,
    category: "governance" as const,
    title:
      "W7 vendor entity structure — platform IP in an assignable vendor entity; CSI blocklist gate before C-tier go-live",
    recommendation:
      "Adopt the W7 vendor-perimeter structure: the v2 platform IP (FIL framework, model library, control substrate) is held in a distinct, assignable vendor legal entity — separate from any single banking-licence entity — so the platform can be licensed to R-tier and C-tier tenants without entangling the anchor bank's banking licence. Pair it with a competitively-sensitive-information (CSI) blocklist gate: a typed control that screens cross-tenant data flows against a competition-law blocklist, enforced before any C-tier (and cross-tenant-learning) go-live. Owners: Owen (Company Secretary, entity structure), Imani (legal-entity tree), with Zara (CCO, CSI control). The corpus acquisitions this implies — JS 1/2023, NPS Act, Competition Act — route to Mira.",
    rationale:
      "If platform IP sat inside the licensed bank entity, selling the substrate to another bank would drag the seller's banking licence and prudential consolidation into every deal — commercially and legally unworkable. An assignable vendor entity is the standard BBaaS structure and keeps the platform cleanly licensable. The CSI gate is non-optional once two competing tenants share infrastructure: cross-tenant learning (W8 / S12) is a competition-law hazard unless screened, so the blocklist must exist as a typed enforced control before the first multi-tenant go-live, not as a policy promise. This is the governance precondition that makes the commercial tiers (D-V2-BBAAS-TIER-STRUCTURE) lawful to operate.",
    citations: [
      "D-V2-BBAAS-W4-W7-DISPATCH",
      "D-V2-BBAAS-TIER-STRUCTURE",
      "Principles/4-security-designed-in.md",
      "Principles/5-multi-currency-entity-country.md",
    ],
  },
];

const results: Array<{ decisionId: string; eventId: string }> = [];
for (const d of decisions) {
  const { _n, ...base } = d;
  const input = { ...base, recordedVia: "scrooge:session-delegation" as const };
  requestDecision(input, T(_n, "req"));
  const r = recordDecision({ ...input, phase: "approved" as const }, T(_n, "app"));
  results.push({ decisionId: base.decisionId, eventId: r.eventId });
}

console.log(JSON.stringify({ ok: true, recorded: results.length, decisions: results }, null, 2));
