// prototype/scripts/record-fx-chain-closure-dispatch.ts
//
// One-shot: record CEO session-delegated approval ("continue", 2026-06-11) to
// dispatch Owen (Company Secretary, governance) on the OTC Vanilla FX
// chain-closure sweep — wiring CLOSES policy edges (or recording reasoned
// licence-day deferrals / routed authoring gaps) for the 47 FX-scoped
// obligations that recon:npa-coverage axis (a) flags as having no CLOSES
// policy edge, plus the 2 FSCA objective ALIGNS_TO gaps.
//
// Mechanism (verified): a CLOSES edge (Policy -> Obligation) is folded by
// platform/regulatory/graph/seed-projection.ts from ORG-* obligation IDs that
// appear in a policy's `summary:` frontmatter (policy-parser.ts
// extractObligationIds). IMPLEMENTED_BY coverage is already 417/417; CLOSES is
// the stronger "policy estate fully addresses this obligation" edge these 47
// lack. The 47 cluster as the FSCA OTC-Derivative-Provider (ODP) regime under
// the Financial Markets Act 19 of 2012 (CS3 risk-mitigation, ODP-AUTH, ODP-
// COND, ODP-RPT, FMA authorisation, JN 2/2024 margin reporting) plus 2 IAS21 /
// IFRS9-hedge accounting and 3 markets-conduct obligations.
//
// Triage discipline (NOT mass-authoring, NOT force-mapping):
//   (a) existing policy genuinely closes it -> wire the ORG-* id into that
//       policy's summary frontmatter; reseed the graph.
//   (b) licence-day authorisation / filing act (FSCA ODP authorisation, capital
//       sufficiency demonstration, controlling-body fit-and-proper) -> NOT
//       closeable by a build-phase policy; record a reasoned licence-day
//       deferral, do not fabricate an edge.
//   (c) genuine policy-authoring gap -> route to the owning seat as a named
//       follow-on; do not author thin placeholder policies in this run.
//
// Authority: CEO (Marc), in-session "continue" 2026-06-11.
// Author: Scrooge (Chief of Staff)

import { recordDecision } from "../runtime/decisions/record";

const AS_OF = "2026-06-11T11:00:00.000Z";

const result = recordDecision(
  {
    decisionId: "D-FX-CHAIN-CLOSURE-DISPATCH",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "OTC Vanilla FX — dispatch Owen (CoSec) on the chain-closure sweep: wire CLOSES policy edges / reasoned deferrals for the 47 FX obligations + 2 FSCA objective gaps",
    category: "governance",
    recommendation:
      "Dispatch Owen (Company Secretary, governance) to triage the 47 FX-scoped obligations flagged by recon:npa-coverage axis (a) as having no CLOSES policy edge: wire the ORG-* id into the summary frontmatter of the policy that genuinely closes it (reseed the graph), record reasoned licence-day deferrals for ODP authorisation/filing acts no build-phase policy can close, and route genuine authoring gaps to the owning seat as named follow-ons. Assess the 2 FSCA objective ALIGNS_TO gaps (financial inclusion / education) for applicability to an institutional FX book.",
    rationale:
      "OTC Vanilla FX reached 9/14 dimensions implementation-attested this session, but the single-graph evidence base (recon:npa-coverage) still shows 47/50 FX obligations without a CLOSES policy edge — the FSCA ODP regime under the FMA, plus IAS21/IFRS9-hedge and markets-conduct. IMPLEMENTED_BY is already 417/417; CLOSES is the stronger closure edge. Triage-first (defer licence-day acts, route real authoring gaps) keeps the graph honest rather than fabricating edges or thin policies. Governance-register custodianship is Owen's seat.",
    sourceDocHashes: [],
    citations: [
      "D-FX-NPA-VERIFICATION-PASS-2-DISPATCH",
      "D-FX-OTC-NPA-SCOPE-EXPANSION",
      "Principles/2-single-graph-discipline.md",
    ],
    recordedVia: "scrooge:session-delegation",
    actor: { type: "human", id: "marc@tgv.co.za" },
  },
  AS_OF,
);

console.log(`✓ D-FX-CHAIN-CLOSURE-DISPATCH → approved (eventId: ${result.eventId})`);
