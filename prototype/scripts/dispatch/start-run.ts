// scripts/dispatch/start-run.ts
//
// RMS Phase 2 Block A — events-first dispatch helper #2 of 3.
//
// Scrooge invokes this CLI when an agent run begins, materialising
// `AgentRunStarted` (RMS-2). No document-store interaction — the run
// lifecycle has no body of its own; the brief body lives on the issuing
// `AgentBriefIssued.directiveDocumentHash`.
//
// Usage:
//
//   bun run dispatch:start-run \
//     --brief <briefId> \
//     --agent-name <name> --agent-position <position> \
//     --substrate <agent-runtime|scrooge-coordinated-in-session> \
//     [--worktree <path>] [--run-id <id>] [--cite <urn>]...
//
// Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
// Spec: Owner Inbox/actioned/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//
// Author: Atlas (Core banking platform architect, engineering)

// D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21) — MUST be the first
// import so the shared resolver mutates `BANK_EVENT_DB` BEFORE
// `platform/composition` resolves its dbPath at module-load time.
import "./resolve-event-db-boot";

import { clock } from "../../platform/composition";
import type { RmsAgentRef } from "../../platform/event-store/event-types";
import { recordAgentRunStarted } from "../../platform/records";
import { die, emitOk, optionalRepeatable, optionalString, parseArgs, requireString } from "./args";

const REPEATABLE = new Set(["cite"]);
const SUBSTRATE_VALUES = ["agent-runtime", "scrooge-coordinated-in-session"] as const;
type Substrate = (typeof SUBSTRATE_VALUES)[number];

function substrateFrom(value: string): Substrate {
  if (!(SUBSTRATE_VALUES as readonly string[]).includes(value)) {
    die(`--substrate must be one of ${SUBSTRATE_VALUES.join("|")}, got: ${value}`);
  }
  return value as Substrate;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2), REPEATABLE);

  const briefId = requireString(args, "brief");
  const agentName = requireString(args, "agent-name");
  const agentPosition = requireString(args, "agent-position");
  const substrate = substrateFrom(requireString(args, "substrate"));
  const worktree = optionalString(args, "worktree");
  const runIdOverride = optionalString(args, "run-id");
  const cites = optionalRepeatable(args, "cite");
  const citations = cites.length > 0 ? cites : ["D-RMS-PHASE-1"];

  const asOf = clock.now();
  const runId = runIdOverride ?? `run:${slugify(agentName)}:${asOf.replace(/[:.]/g, "-")}`;

  const agent: RmsAgentRef = {
    name: agentName,
    position: agentPosition,
    agentId: `agent:${slugify(agentName)}`,
  };

  const result = recordAgentRunStarted(
    {
      runId,
      briefId,
      agent,
      startedAt: asOf,
      substrate,
      ...(worktree ? { worktree } : {}),
      citations,
      actor: { type: "service", id: agent.agentId ?? `agent:${slugify(agentName)}` },
    },
    asOf,
  );

  emitOk({
    runId,
    eventId: result.eventId,
    startedAt: asOf,
    substrate,
  });
}

main();
