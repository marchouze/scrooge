// scripts/dispatch/close-run.ts
//
// RMS Phase 2 Block A — events-first dispatch helper #3 of 3.
//
// Scrooge invokes this CLI when an agent run completes (or is blocked /
// withdrawn). Each `--deliverable <path>` body is put into the content-
// addressed document store; the hashes go into the
// `AgentRunCompleted.deliverableDocumentHashes` payload (RMS-3).
//
// Usage:
//
//   bun run dispatch:close-run \
//     --run <runId> \
//     --brief <briefId> \
//     --agent-name <name> --agent-position <position> \
//     --outcome <delivered|blocked|withdrawn> \
//     [--deliverable <path>]... \
//     [--cite <urn>]... \
//     [--gap <substrate-gap-string>]... \
//     [--follow-on <kind:target:directive>]...
//
// `--cite` defaults to ["D-RMS-PHASE-1"] if none supplied.
// `--follow-on` format: `kind:target:directive` where kind ∈
// {agent, decision, register-update}.
//
// Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
// Spec: Owner Inbox/actioned/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { clock } from "../../platform/composition";
import type {
  AgentRunCompletedFollowOnRoute,
  AgentRunCompletedPayload,
  RmsAgentRef,
} from "../../platform/event-store/event-types";
import { recordAgentRunCompleted } from "../../platform/records";
import {
  die,
  emitOk,
  optionalRepeatable,
  parseArgs,
  requireString,
} from "./args";

const REPEATABLE = new Set(["deliverable", "cite", "gap", "follow-on"]);
const OUTCOMES = ["delivered", "blocked", "withdrawn"] as const;
type Outcome = (typeof OUTCOMES)[number];

function outcomeFrom(value: string): Outcome {
  if (!(OUTCOMES as readonly string[]).includes(value)) {
    die(`--outcome must be one of ${OUTCOMES.join("|")}, got: ${value}`);
  }
  return value as Outcome;
}

function parseFollowOns(values: readonly string[]): AgentRunCompletedFollowOnRoute[] {
  return values.map((raw) => {
    const parts = raw.split(":");
    if (parts.length < 3) die(`--follow-on must be 'kind:target:directive', got: ${raw}`);
    const kind = parts[0]!.trim();
    const target = parts[1]!.trim();
    const directive = parts.slice(2).join(":").trim();
    if (!["agent", "decision", "register-update"].includes(kind)) {
      die(`--follow-on kind must be one of agent|decision|register-update, got: ${kind}`);
    }
    if (target === "" || directive === "") {
      die(`--follow-on target/directive must be non-empty, got: ${raw}`);
    }
    return {
      kind: kind as AgentRunCompletedFollowOnRoute["kind"],
      target,
      directive,
    };
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function main(): void {
  const args = parseArgs(process.argv.slice(2), REPEATABLE);

  const runId = requireString(args, "run");
  const briefId = requireString(args, "brief");
  const agentName = requireString(args, "agent-name");
  const agentPosition = requireString(args, "agent-position");
  const outcome = outcomeFrom(requireString(args, "outcome"));

  const deliverablePaths = optionalRepeatable(args, "deliverable");
  const cites = optionalRepeatable(args, "cite");
  const gaps = optionalRepeatable(args, "gap");
  const followOnsRaw = optionalRepeatable(args, "follow-on");

  if (outcome === "delivered" && deliverablePaths.length === 0) {
    die("--outcome=delivered requires at least one --deliverable <path>");
  }

  const deliverableBodies: string[] = [];
  for (const p of deliverablePaths) {
    if (!existsSync(p)) die(`--deliverable path not found: ${p}`);
    const body = readFileSync(p, "utf8");
    if (body.trim() === "") die(`--deliverable file is empty: ${p}`);
    deliverableBodies.push(body);
  }

  const followOnRoutes = parseFollowOns(followOnsRaw);
  const citations = cites.length > 0 ? cites : ["D-RMS-PHASE-1"];
  // Deliverable-level citations mirror envelope citations when caller does not
  // distinguish — keeps Principle 2 satisfied at both layers.
  const deliverableCitations = citations;

  const agent: RmsAgentRef = {
    name: agentName,
    position: agentPosition,
    agentId: `agent:${slugify(agentName)}`,
  };

  const asOf = clock.now();

  const result = recordAgentRunCompleted(
    {
      runId,
      briefId,
      agent,
      completedAt: asOf,
      outcome,
      deliverableBodies,
      substrateGapsSurfaced: gaps,
      deliverableCitations,
      followOnRoutes,
      citations,
      actor: { type: "service", id: agent.agentId ?? `agent:${slugify(agentName)}` },
    },
    asOf,
  );

  const payload: AgentRunCompletedPayload = result.event.payload as AgentRunCompletedPayload;
  emitOk({
    runId,
    briefId,
    eventId: result.eventId,
    outcome,
    deliverableHashes: [...payload.deliverableDocumentHashes],
    newDeliverableCount: result.newDeliverableCount,
    completedAt: asOf,
  });
}

main();
