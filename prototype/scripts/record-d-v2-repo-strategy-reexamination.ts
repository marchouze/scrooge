// scripts/record-d-v2-repo-strategy-reexamination.ts
//
// Records D-V2-REPO-STRATEGY-REEXAMINATION — Marc's in-session direction
// (2026-06-12) to reconsider the blueprint's evolve-in-place repo verdict
// (D-V2-REPO-STRATEGY, named but NOT yet approved) under revised criteria
// weights and two new definite requirements:
//   (1) Criteria re-weighting: "I am not concerned about how close we are to
//       the licence gate, but am more concerned about building a 'proper'
//       platform." Anchor-tenant/licence-track continuity — the heaviest
//       criterion in the original verdict — is demoted; structural platform
//       correctness dominates.
//   (2) New requirement A — intra-tenant multi-legal-entity: adding another
//       legal entity within the current tenant (e.g. a UK bank in the same
//       group) is definite required functionality and must not require
//       significant rewrites. Principle 5 is honoured in the envelope's
//       entity field but not in engine/fixture/recon code.
//   (3) New requirement B — FIL-mediated access: to enforce W9, nothing
//       queries the event store directly; every consumer goes through FIL
//       objects. This is stronger than the W9 conformance gate (identifier
//       discipline) — it makes FIL the sole data-access path.
// The re-examination is code-grounded: count the actual rewrite surface for
// both requirements under evolve-in-place vs greenfield-core-with-v1-as-
// running-anchor, re-run all §2 criteria with the revised weights, and
// deliver a revised verdict recommendation for D-V2-REPO-STRATEGY.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-V2-BBAAS-BLUEPRINT-SYNTHESIS;
// D-V2-BBAAS-W9-FIL.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-12T15:36:00.000Z";
const APP = "2026-06-12T15:38:00.000Z";

const base = {
  decisionId: "D-V2-REPO-STRATEGY-REEXAMINATION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Re-examine the v2 repo-strategy verdict under revised weights (platform correctness over licence proximity) and two new requirements: intra-tenant multi-legal-entity and FIL-mediated event access",
  category: "governance" as const,
  recommendation:
    "Dispatch a code-grounded re-examination of the blueprint's evolve-in-place verdict: (1) measure the actual rewrite surface of requirement A (intra-tenant multi-LE: enumerate the modules, engines, fixtures, returns renderers, and recon pipelines that assume a single legal entity, including the known consolidation gap) and requirement B (FIL-mediated access: count direct event-store query call-sites across projections, engines, recons, and handlers that would have to move behind FIL objects); (2) re-run the six blueprint §2 criteria with anchor-tenant/licence-track continuity demoted and structural platform correctness dominant; (3) evaluate the candidate the original verdict did not weight — a greenfield v2 core (FIL-first, multi-entity-first, tenant-first from line one) with v1 running unchanged as the anchor tenant until per-domain parity, i.e. the strangler across repos, with data and knowledge (event log replay, Plane-A corpus, 264 distilled decisions, seat specs, recon patterns) carrying over and only code rewritten; (4) deliver a revised verdict recommendation for D-V2-REPO-STRATEGY with explicit reversal of the prior reasoning where applicable.",
  rationale:
    "Marc identified two definite high-impact requirements the original verdict did not weight: another legal entity within the current tenant (e.g. a UK group bank) is required functionality and today would require significant rewrites because Principle 5 lives in the envelope type but not in engine code; and W9 enforcement in its strong form makes FIL the sole access path to events, putting the entire consumer surface — not a seam — in scope for rewrite. Simultaneously he re-weighted the criteria: licence-gate proximity no longer dominates; building a proper platform does. The original verdict's evidence base (5/6 criteria favouring in-place) was computed under the old weights and without these requirements; honesty requires recomputing rather than defending it.",
  sourceDocHashes: [],
  citations: [
    "D-V2-BBAAS-BLUEPRINT-SYNTHESIS",
    "D-V2-BBAAS-W9-FIL",
    "D-V2-BBAAS-W2-W3-DISPATCH",
    "Principles/5-multi-currency-entity-country.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
