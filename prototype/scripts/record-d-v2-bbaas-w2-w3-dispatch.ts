// scripts/record-d-v2-bbaas-w2-w3-dispatch.ts
//
// Records D-V2-BBAAS-W2-W3-DISPATCH — Marc's in-session approval (2026-06-12,
// "Continue" after the W1 close-out report) of dispatching the structural pair
// of the chartered WS-V2-BBAAS analysis map (D-V2-BBAAS-W1-DECISION-
// DISTILLATION §1):
//   - W2 — domain / BIAN mapping + data-store ownership: a full BIAN-aligned
//     domain map of the v2 backbone — per domain the key data store(s), the
//     owning functional seat, and the ontology bindings (internal graph
//     node/edge types; FIBO, ISO 20022, FINOS CDM) — with a recommendation on
//     BIAN adoption depth. Owning seat: Substrate Architect (Atlas, Core
//     banking platform architect, engineering) + Data seat input.
//   - W3 — tenancy architecture: stress-test the session-1 paper's Options
//     A (envelope tenant axis, shared store) / B (per-tenant stores) /
//     C (per-tenant stores + composition factory) against isolation,
//     residency, ops cost, clean-core discipline, and the cross-tenant
//     learning boundary; deliver a concrete event-envelope schema proposal
//     (tenant + entity as orthogonal axes) and an anchor-tenant migration
//     sketch. Owning seat: Substrate Architect.
// Both deliver analysis documents filed via RecordFiled; W4–W7 remain
// undispatched.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-W1-DECISION-
// DISTILLATION; D-V2-BBAAS-ANALYSIS-LAUNCH.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T09:57:00.000Z";
const APP = "2026-06-12T09:59:00.000Z";

const base = {
  decisionId: "D-V2-BBAAS-W2-W3-DISPATCH",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "WS-V2-BBAAS session 3: dispatch W2 (domain/BIAN map + data-store ownership) and W3 (tenancy architecture) in parallel to the Substrate Architect seat",
  category: "governance" as const,
  recommendation:
    "Dispatch the structural pair of the chartered analysis map in parallel: W2 delivers the BIAN-aligned domain map of the v2 backbone (per domain: key data stores, owning functional seat, ontology bindings to the internal graph ontology plus FIBO / ISO 20022 / FINOS CDM, grounded in actual v1 modules) with a BIAN-adoption-depth recommendation; W3 stress-tests tenancy Options A/B/C from the session-1 ideas paper against isolation, data residency, operating cost, clean-core discipline, and the cross-tenant learning boundary, and delivers a concrete event-envelope schema proposal treating tenant and legal-entity as orthogonal axes plus an anchor-tenant migration sketch. Both run on the Substrate Architect seat (Atlas, Core banking platform architect, engineering), deliver RecordFiled analysis documents landed by PR, and leave W4-W7 undispatched.",
  rationale:
    "The session-1 ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12) identifies W2/W3 as the structural pair everything technical depends on, sequenced immediately after W1. W1 completed 2026-06-12 (257 decisions distilled, 91 foundational; coverage recon enforcing), giving W2/W3 a distilled view of what the shared core actually is. The two workstreams are analysis documents with disjoint scope, safe to parallelise. Marc's 'Continue' adopts the recommended sequencing.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-ANALYSIS-LAUNCH",
    "D-V2-BBAAS-W1-DECISION-DISTILLATION",
    "Principles/2-single-graph-discipline.md",
    "Principles/5-multi-currency-entity-country.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
