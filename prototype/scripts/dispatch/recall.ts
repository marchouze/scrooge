// scripts/dispatch/recall.ts
//
// `dispatch:recall` — WS-AGENT-MEMORY Slice 2 read-at-dispatch INSTRUMENT.
//
//   bun run dispatch:recall --agent <name> [--domains a,b] [--json]
//
// Prints the federated agent-memory slice an agent loads at dispatch: the live
// memory heads whose mandate tags intersect the agent's `mandateDomains` ∪
// `{shared}` (roster-sourced, NOT derived) — titles + domains + citations +
// resolved bodies. `--domains a,b` overrides the roster filter with a targeted
// lens (no auto-`shared` in override mode). `--json` emits the raw rows.
//
// WHY IT EXISTS (tracked Principle-6 roadmap gap, not hidden): the autonomous
// agent runtime that would call `WorldStateSnapshot.myMemory` itself on every
// iteration is not yet the live substrate. Until it lands, Scrooge runs
// `dispatch:recall` before a dispatch and pastes the printed slice into the
// brief — a MANUAL read-instrument standing in for the autonomous read. The
// world-state field and this CLI share one code path (`readMyMemory`), so the
// manual and autonomous reads can never drift.
//
// STORE RESOLUTION: identical ladder to the other dispatch CLIs — the
// `resolve-event-db-boot` shim (imported FIRST) resolves the SHARED event store
// AND document store, so this reads the same memories the close-run `--memory`
// path wrote (cross-worktree-sync). Bodies resolve from the same content-addressed
// store; an unresolvable body is surfaced honestly (`(body unresolved …)`), never
// silently dropped.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 2; brief:atlas:ws-agent-memory-slice-2-read-at-dispatch-mandate:2026-06-25.
//   D-CROSS-WORKTREE-EVENT-STORE-SYNC (store-resolution precedent); Principle 6
//   (the manual instrument is the tracked substrate-gap stand-in).
// Author: Atlas (Core banking platform architect, engineering).

// MUST be first — boots the shared event + document store env before composition.
import "./resolve-event-db-boot";

import { tryAgentIdForName } from "../../platform/agent-identity";
import { eventStore } from "../../platform/composition";
import { defaultDocumentStore } from "../../platform/document-store";
import { AGENT_MEMORY_COMMITTED } from "../../platform/event-store/event-types";
import { type AgentMemoryRow, readMyMemory } from "../../platform/agent-runtime/read-my-memory";
import { die, optionalString, parseArgs } from "./args";

const REPEATABLE = new Set<string>([]);

function parseDomains(raw: string | undefined): readonly string[] | undefined {
  if (raw === undefined) return undefined;
  const domains = raw
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0);
  if (domains.length === 0) {
    die("--domains was supplied but parsed to no tags (expected comma-separated, e.g. accounting,shared)");
  }
  return domains;
}

function printHuman(agentName: string, agentId: string, rows: readonly AgentMemoryRow[]): void {
  const header = `agent-memory slice for ${agentName} (${agentId}) — ${rows.length} memor${rows.length === 1 ? "y" : "ies"}`;
  console.log(header);
  console.log("=".repeat(header.length));
  if (rows.length === 0) {
    console.log("(no memories match this agent's mandate ∪ shared filter)");
    return;
  }
  for (const r of rows) {
    console.log("");
    console.log(`• ${r.title}`);
    console.log(`  id:        ${r.memoryId}`);
    console.log(`  domains:   ${r.domains.join(", ")}`);
    console.log(`  citations: ${r.citations.join(", ")}`);
    console.log(`  by:        ${r.producedByAgent.name} (${r.producedByAgent.agentId}) — run ${r.producedByRunId}`);
    if (r.bodyResolved && r.body !== null) {
      const indented = r.body
        .split("\n")
        .map((line) => `    ${line}`)
        .join("\n");
      console.log("  body:");
      console.log(indented);
    } else {
      console.log(`  body:      (UNRESOLVED — bodyDocumentHash ${r.bodyDocumentHash} did not resolve in the doc store)`);
    }
  }
}

function main(): void {
  const args = parseArgs(process.argv.slice(2), REPEATABLE);
  const agentName = optionalString(args, "agent");
  if (!agentName) die("Missing required flag --agent <name>");

  const agentId = tryAgentIdForName(agentName);
  if (!agentId) {
    die(
      `no roster persona named "${agentName}" in Team/_team-roster.json — cannot resolve a stable agentId (Charter cmd 2: fail-closed)`,
    );
  }

  const domains = parseDomains(optionalString(args, "domains"));
  const asJson = optionalString(args, "json") !== undefined || process.argv.includes("--json");

  const events = [...eventStore.replay({ type: AGENT_MEMORY_COMMITTED })];

  let rows: AgentMemoryRow[];
  try {
    rows = readMyMemory(
      agentId,
      { events, documentStore: defaultDocumentStore },
      domains !== undefined ? { domains } : undefined,
    );
  } catch (e) {
    die(`readMyMemory failed: ${(e as Error).message}`);
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: true, agent: agentName, agentId, count: rows.length, memories: rows }, null, 2));
    return;
  }
  printHuman(agentName, agentId, rows);
}

main();
