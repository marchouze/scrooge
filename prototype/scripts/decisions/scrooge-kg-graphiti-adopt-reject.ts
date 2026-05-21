// prototype/scripts/decisions/scrooge-kg-graphiti-adopt-reject.ts
//
// CEO decision (Marc, in-session 2026-05-21 via Scrooge session delegation)
// to ABANDON Graphiti adoption. Closes the D-KG-GRAPHITI-ADOPT follow-on
// surfaced by Atlas's outcome card for D-KG-GRAPHITI-SPIKE-FX-SPOT.
//
// The spike (PR #706) is closed without merge. The existing TypeScript /
// SQLite knowledge-graph substrate at prototype/platform/regulatory/graph/
// remains canonical. The five substrate gaps surfaced by the spike
// (logged on the AgentRunCompleted event) stand as Vera findings.
//
// Authority chain: CEO build-phase authority over engineering / substrate
// decisions per CLAUDE.md "Decision authority routing" table.
//
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.

import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-KG-GRAPHITI-ADOPT",
    phase: "rejected",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: "Reject Graphiti adoption; keep existing TS/SQLite knowledge-graph substrate canonical",
    category: "engineering",
    recommendation:
      "Close PR #706 without merge. Do not adopt Graphiti (Zep AI) as the unified knowledge-graph substrate. The existing TypeScript / SQLite substrate at prototype/platform/regulatory/graph/ remains canonical. The Python sidecar code from the spike is not merged. The spike's surfaced findings (the existing substrate is more salvageable than the original plan assumed; missing layers — CodeModule, Capability, ProductInstrument, LLM-extraction — can be added to the TS substrate at a fraction of the Graphiti-adoption cost) are taken on board but no follow-on dispatch is triggered in this iteration; the team revisits when concrete pain re-surfaces.",
    rationale:
      "Atlas's spike outcome card (Owner Inbox/2026-05-21_atlas_kg-spike-fx-spot-outcome.md; RecordFiled 18b27590-7627-4fd0-983b-b54ce06baa5a) reported that the Graphiti value-proposition was never actually exercised: (1) the dispatched .env.local Anthropic key returned 401, so the LLM-extraction tier did not run — only the deterministic frontmatter tier; (2) the spike JSONL store is overwrite-on-ingest, so bitemporal drift behaviour (Graphiti's primary value-add) was not validated. Atlas's surprise finding — that the existing TS substrate is more salvageable than the original plan assumed — combined with the unproven value-add means there is no evidence-backed case for adopting Graphiti now. Native TS extension of the existing substrate avoids the Python-sidecar operational complexity. Citations: D-KG-GRAPHITI-SPIKE-FX-SPOT (the spike authorisation); Principle 2 (single-graph discipline); Principle 3 (cloud-native, lift-compatible).",
    sourceDocHashes: ["blake3:7c4088dbf298bd7e14861132507933e44fce9dd36eef83d0dea9931f4725686c"],
    citations: [
      "urn:decision:bank:D-KG-GRAPHITI-SPIKE-FX-SPOT",
      "P2-SINGLE-GRAPH-DISCIPLINE",
      "P3-CLOUD-NATIVE",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);

console.log(JSON.stringify(result, null, 2));
