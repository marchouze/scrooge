// scripts/record-d-v2-bbaas-analysis-launch.ts
//
// Records D-V2-BBAAS-ANALYSIS-LAUNCH — Marc's in-session approval (2026-06-12)
// of the launch of the multi-session v2 "Bank Backbone as a Service" (BBaaS)
// structural analysis, under workstream WS-V2-BBAAS.
//
// Scope approved:
//   (1) The v2 business proposition: a Bank Backbone as a Service — subscriber
//       banks consume a shared core of regulatory-compliance knowledge and
//       operational functionality; large banks keep some core infrastructure
//       (trading systems, GL) and subscribe to a subset; smaller banks consume
//       the comprehensive stack. The six architectural principles remain.
//   (2) The SA bank-in-formation continues as a live licence track AND becomes
//       anchor tenant / customer #1 of the backbone.
//   (3) Repo strategy (evolve-in-place vs greenfield) is deliberately open —
//       a question the analysis must answer, not an input.
//   (4) Session-1 deliverable is the initial ideas paper only; workstream
//       chartering and analysis dispatches follow after CEO reaction.
//   (5) Eight CEO design directions set this session bound the paper's theses:
//       functional seats over persona names; decision distillation
//       (foundational vs directional); foundational building blocks shared by
//       all tenants; a reusable model/regulatory-concept library (RWA, IRRBB,
//       Leverage, LCR/NSFR, SA-CCR, CVA, ECL); tenant-specific obligation
//       adoption / policy / procedure; cross-tenant agent learning;
//       standards-aligned domain structure (BIAN / FIBO / ISO 20022 / FINOS
//       CDM) with established data stores and ownership; learn from SAP /
//       Salesforce core-vs-customer platform models.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-DECISIONS-FRAMEWORK-REDESIGN.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T07:40:00.000Z";
const APP = "2026-06-12T07:46:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-ANALYSIS-LAUNCH",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Launch the multi-session v2 'Bank Backbone as a Service' structural analysis (WS-V2-BBAAS); session 1 delivers the initial ideas paper",
  category: "governance" as const,
  recommendation:
    "Launch WS-V2-BBAAS: a multi-session analysis of the overall structure of the bank with a view to a v2 of the project, repositioned as Bank Backbone as a Service — one shared core of regulatory knowledge, coded controls, computational models, and an experienced agent workforce serving N subscriber banks (large banks subscribe to a subset against their own core infrastructure; smaller banks take the comprehensive stack). The SA bank-in-formation continues its licence track and becomes anchor tenant / customer #1. Repo strategy (evolve-in-place vs greenfield) is an open question the analysis must answer. Session 1 delivers the initial ideas paper only, authored by the Substrate Architect seat (Atlas, Core banking platform architect, engineering) and filed via RMS; workstream chartering and analysis dispatches follow once the CEO has reacted to the paper. Eight CEO design directions bound the paper: (1) functional seat names replace personas; (2) distill the Decision-event history into foundational vs directional knowledge; (3) foundational building blocks (event model, ontologies, party scheme, projection+recon machinery, dispatch substrate) reused for all tenants; (4) a reusable model and regulatory-concept library (RWA, IRRBB, Leverage, LCR/NSFR, SA-CCR, CVA, ECL) as tenant-agnostic citable models; (5) obligation adoption, policies, procedures, RAS calibration, products, CoA are tenant-specific; (6) agents learn from history and exercise enhanced knowledge across all tenants with tenant-data isolation; (7) standards-aligned domain structure (BIAN service landscape or equivalent) with established key data stores and ownership, strongly bound to ontology elements (graph ontology, FIBO, ISO 20022, FINOS CDM); (8) learn from SAP / Salesforce core-vs-customer platform patterns (clean core, metadata-driven multi-tenancy, configuration-not-fork, editions, extension ecosystem).",
  rationale:
    "v1 has proven the substrate at single-bank scale (~687 event types, 218 recon pipelines, 156 procedures, 1,000+ adopted obligations, a two-plane regulatory knowledge graph) and the learnings are now worth productising: Plane A reference regulation, the model engines, and the recon/dispatch machinery are bank-agnostic, while obligation adoption, policies, procedures, RAS, products, and CoA are tenant-specific — exactly the seam a backbone-as-a-service needs. Structuring v2 around that seam, aligned to industry standards and proven enterprise-platform patterns, converts the build-phase investment into a multi-customer business while the SA bank remains the dogfooding proof. CEO session-delegation approval, in-session 2026-06-12 (plan approved; directions given verbatim in-session).",
  sourceDocHashes: [],
  citations: [
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
    "Principles/6-autonomous-by-default.md",
    "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
    "D-BANK-STRATEGY-V2",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
