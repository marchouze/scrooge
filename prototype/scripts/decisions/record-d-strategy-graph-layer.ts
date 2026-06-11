// scripts/decisions/record-d-strategy-graph-layer.ts
//
// ⚠️ WITHDRAWN 2026-06-11: this approval was withdrawn the same day by CEO
// in-session instruction ("keep updated bank strategy but undo additional
// graph layer") before any build occurred. See
// scripts/decisions/withdraw-d-strategy-graph-layer.ts — the `withdrawn`
// phase event is the operative tail of the decision aggregate.
//
// Records D-STRATEGY-GRAPH-LAYER — Marc's in-session approval (2026-06-11)
// of the strategy-layer ontology extension for the regulatory knowledge graph,
// part of the strategy-driven traceability workstream (WS-STRATEGY-TRACEABILITY).
//
// SCOPE:
//   New node types (20th/21st): Strategy, ClientSegment.
//     - ClientSegment is deliberately NOT a reuse of RegulatedEntity:
//       ClientSegment = the bank's commercial segmentation (SEG-* codes,
//       strategy §13.3); RegulatedEntity = regulator-defined entity classes
//       extracted from Plane A. Bridged via MAPS_TO.
//   New edge types:
//     - MANDATES   (Strategy → Activity)            — mandated business activities
//     - PERMITS    (Strategy → ProductInstrument)   — positive product enumeration
//     - TARGETS    (Strategy → ClientSegment)       — target client base
//     - EXCLUDES   (Strategy → Activity|ProductInstrument|ClientSegment)
//                                                   — negative enumeration (EXCL-*)
//     - DENOTES    (Term → Activity|ProductInstrument|ClientSegment)
//                                                   — defined-term resolution (STERM-*)
//     - ADOPTED_FOR (bank Obligation → Activity|ProductInstrument|ClientSegment)
//                                                   — applicability trace, Plane-B side
//   Endpoint extensions to existing edges:
//     - OPERATES_IN += Strategy → Jurisdiction
//     - DEFINES     += Strategy → Term
//     - MAPS_TO     += Term → Term; ClientSegment → RegulatedEntity
//     - SUPERSEDES  += Strategy → Strategy (version chain)
//
// Precedent: D-PRINCIPLE-2-CAPABILITY-LAYER (2026-06-08),
// D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER (2026-06-10).
// Category: engineering build decisions → CEO (build phase) per routing table.
//
// NOTE: D-BANK-STRATEGY-V2 (strategy v2 text approval) is a SEPARATE decision,
// still open — Marc requested changes to the v2 text first. The graph layer is
// approved independently so ontology/register engineering can proceed; the
// StrategyVersionAdopted event waits for D-BANK-STRATEGY-V2.
//
// Session-delegation: Marc (CEO) approved in-session 2026-06-11; Scrooge is
// the recording instrument.
//
// Idempotent: fixed asOf so re-runs dedup on (decisionId, phase, as_of).
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument, on
// behalf of Marc (CEO).

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const REQUESTED_ASOF = "2026-06-11T12:05:00.000Z";
const ASOF = "2026-06-11T12:06:00.000Z";

const TITLE =
  "Strategy graph layer — Strategy + ClientSegment node types; MANDATES/PERMITS/TARGETS/EXCLUDES/DENOTES/ADOPTED_FOR edges; endpoint extensions for OPERATES_IN/DEFINES/MAPS_TO/SUPERSEDES";

const CITATIONS = [
  "D-PRINCIPLE-2-CAPABILITY-LAYER",
  "D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER",
  "Policies/bank-strategy-v2.md",
  "prototype/platform/regulatory/graph/ontology-schema.ts",
  "Principles/2-single-graph-discipline.md",
];

const RECOMMENDATION =
  "Extend the regulatory knowledge-graph ontology with a strategy layer so the " +
  "institutional strategy becomes a first-class queryable node driving regulation " +
  "applicability, NPA scope, and policy coverage: (1) new node types Strategy and " +
  "ClientSegment — ClientSegment carries the bank's commercial segmentation (SEG-* " +
  "codes, strategy v2 §13.3) and is bridged to regulator-defined RegulatedEntity " +
  "classes via MAPS_TO rather than conflated with them; (2) new edge types MANDATES " +
  "(Strategy→Activity), PERMITS (Strategy→ProductInstrument), TARGETS " +
  "(Strategy→ClientSegment), EXCLUDES (Strategy→Activity|ProductInstrument|ClientSegment), " +
  "DENOTES (Term→Activity|ProductInstrument|ClientSegment), and ADOPTED_FOR " +
  "(bank Obligation→Activity|ProductInstrument|ClientSegment); (3) endpoint " +
  "extensions OPERATES_IN += Strategy→Jurisdiction, DEFINES += Strategy→Term, " +
  "MAPS_TO += Term→Term and ClientSegment→RegulatedEntity, SUPERSEDES += " +
  "Strategy→Strategy. One Strategy node per version with SUPERSEDES version " +
  "chaining. Implemented across the WS-STRATEGY-TRACEABILITY dispatch plan " +
  "(typed strategy register + StrategyVersionAdopted event family, graph fold, " +
  "defined-terms bridge, applicability derivation, NPA strategy gate hard at " +
  "approval, policy coverage recon, amendment lifecycle).";

const RATIONALE =
  "The institutional strategy is prose only: no Strategy node, no typed scope, no " +
  "edges linking what the bank intends to do to the regulations it attracts, the " +
  "products it may approve, or the policies it requires. Marc's directive " +
  "(2026-06-11): the business plan should drive regulation applicability, policy " +
  "requirements, and NPA flow, traceable through definitive defined terms, with " +
  "client base and activities defining the scope of regulations, NPAs, policies, " +
  "and procedures. The strategy layer closes the missing top of the Principle-2 " +
  "chain: Strategy → (MANDATES/PERMITS/TARGETS) → Activity/Product/Segment → " +
  "(APPLIES_TO_ACTIVITY/APPLIES_TO via MAPS_TO) → Obligation → Policy → Procedure → " +
  "Capability. The negative enumeration (EXCLUDES) is load-bearing for an " +
  "institutional-only bank and must be queryable. Marc approved the graph layer " +
  "in-session 2026-06-11; the strategy v2 text itself (D-BANK-STRATEGY-V2) remains " +
  "open pending Marc's requested changes.";

requestDecision(
  {
    decisionId: "D-STRATEGY-GRAPH-LAYER",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale:
      "Strategy-driven traceability workstream ontology extension; opens the decision lifecycle.",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: "D-STRATEGY-GRAPH-LAYER",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "engineering",
    recommendation: RECOMMENDATION,
    rationale: RATIONALE,
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(JSON.stringify({ ok: true, result }, null, 2));
