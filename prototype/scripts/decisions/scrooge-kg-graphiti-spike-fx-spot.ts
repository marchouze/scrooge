// prototype/scripts/decisions/scrooge-kg-graphiti-spike-fx-spot.ts
//
// CEO authorisation (Marc, in-session 2026-05-21 via Scrooge session delegation)
// for a spike on Graphiti (Zep AI) as the substrate for a unified knowledge
// graph spanning regulations, policies, procedures, decisions, code, and
// registers — landed end-to-end on the FX-Spot product slice.
//
// Authority chain: CEO build-phase authority over engineering / substrate
// decisions per CLAUDE.md "Decision authority routing" table. Marc's plan
// approval in-session via ExitPlanMode = session delegation per CLAUDE.md
// "Scrooge session delegation" rule.
//
// Spec: /Users/marc/.claude/plans/i-m-not-happy-with-idempotent-tide.md
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-KG-GRAPHITI-SPIKE-FX-SPOT",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Spike Graphiti as unified knowledge-graph substrate on FX-Spot slice",
    category: "engineering",
    recommendation:
      "Atlas (Core banking platform architect, engineering) lands Graphiti (Zep AI) as a Python sidecar at prototype/platform/knowledge-graph/, with Kuzu as the embedded backend, Anthropic Claude as the LLM provider, and a Pydantic ontology covering Regulation, Provision, Obligation, Policy, Procedure, Decision, CodeModule, Capability, Party, RiskCategory, and ProductInstrument entities. Scope is one product slice — FX-Spot — covering every artefact in the regulatory chain from Banks Act §78 / FIC Act ss.28-29 / FAIS / JS-2 / Excon down through policies, procedures, decisions, TS handlers in prototype/markets/fx-spot/ and prototype/handlers/fx-*, and register entries. The spike emits a side-by-side /kg dashboard view (alongside the existing /graph) and an outcome decision card in Owner Inbox answering four questions: cost (Anthropic spend), citation accuracy, drift / re-ingest behaviour, and coverage gain over the existing substrate. CEO decides expand / iterate / abandon on the outcome card. Owen (Company Secretary, governance) consulted on ontology vocabulary at draft stage.",
    rationale:
      "The existing knowledge-graph substrate at prototype/platform/regulatory/graph/ has 16 node types + 23 edge types defined but only 5 of each populated — 11 node types + 18 edge types remain unbuilt, awaiting an LLM extraction pipeline that was never written. Citation styles across the corpus are fragmented (URNs, obligation IDs, prose, paths, markdown links coexist) which Marc identified as the top pain. Code↔procedure↔policy linkage is manual and unverified. Graphify (safishamsi/graphify) was evaluated and ruled out: it is a code-AST tool with a fixed schema and no LLM enrichment — cannot model Regulation/Policy/Procedure/Decision as native entities. Graphiti is purpose-built for AI-agent knowledge graphs with configurable Pydantic ontologies, episode-level citation provenance with bitemporal tracking, and supports Anthropic. SQLite is not a Graphiti backend; Kuzu is the recommended embedded backend for the spike, lift-compatible to Neo4j AuraDB on Azure. Spike-first to bound risk: prove fit on FX-Spot (~80 markdown artefacts + ~40 TS modules), measure Anthropic spend (target < $5 / slice), then decide expansion. Citations: D-PRINCIPLES-P2-P6-MERGE (single-graph discipline); D-RMS-PHASE-1 (records substrate); Principle 2 (single graph); Principle 3 (cloud-native, lift-compatible).",
    sourceDocHashes: [],
    citations: [
      "urn:decision:bank:D-PRINCIPLES-P2-P6-MERGE",
      "urn:decision:bank:D-RMS-PHASE-1",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "P3-CLOUD-NATIVE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(JSON.stringify(result, null, 2));
