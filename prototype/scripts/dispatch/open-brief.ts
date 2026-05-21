// scripts/dispatch/open-brief.ts
//
// RMS Phase 2 Block A — events-first dispatch helper #1 of 3.
//
// Scrooge invokes this CLI before every `Agent(...)` call to materialise the
// brief as a typed `AgentBriefIssued` event (Principle 1 — events are the only
// source of truth). The brief body is put into the content-addressed document
// store; the event references it by `directiveDocumentHash`.
//
// Idempotency. Within the last hour, if a brief with the same (title +
// issuedTo + body-hash) has already been emitted, this CLI prints a
// "duplicate" envelope and exits 0 with the prior briefId — protecting against
// accidental double-emit if a dispatch script re-runs.
//
// Usage:
//
//   bun run dispatch:open-brief \
//     --to-name <name> --to-position <position> \
//     --title <title> \
//     --workstream <ws-id> \
//     --priority <now|next-tick|scheduled> \
//     --body <path-to-markdown> \
//     [--issued-by-name <name>] [--issued-by-position <position>] \
//     [--cite <urn>]... \
//     [--expected <kind:description>]... \
//     [--scheduled-for <iso>] [--brief-id <id>]
//
// `--cite` and `--expected` are repeatable; at least one of each is required.
// `--expected` value format: `<kind>:<description>` where `<kind>` is one of
// `decision-card | deliverable-document | register-row | code-pr`.
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09); slice authorisation
//            D-RMS-PHASE-2-4-AUTHORSHIP (Owen + Atlas, 2026-05-16).
// Spec: Owner Inbox/actioned/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//
// Author: Atlas (Core banking platform architect, engineering)

// D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21) — MUST be the first
// import so the shared resolver mutates `BANK_EVENT_DB` BEFORE
// `platform/composition` resolves its dbPath at module-load time.
import "./resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { clock, eventStore } from "../../platform/composition";
import { type LocalFsDocumentStore, defaultDocumentStore } from "../../platform/document-store";
import type { AgentBriefIssuedPayload, RmsAgentRef } from "../../platform/event-store/event-types";
import { mirrorEventToPostgres } from "../../platform/event-store/postgres-mirror";
import { recordBriefIssued } from "../../platform/records";
import {
  die,
  emitOk,
  optionalRepeatable,
  optionalString,
  parseArgs,
  requireRepeatable,
  requireString,
} from "./args";

const REPEATABLE = new Set(["cite", "expected", "blocks-on"]);

const RUN_ROLE_CLASS_VALUES = ["reviewer", "decider", "executor", "observer"] as const;
type RunRoleClass = (typeof RUN_ROLE_CLASS_VALUES)[number];

function runRoleClassFrom(value: string): RunRoleClass {
  if (!(RUN_ROLE_CLASS_VALUES as readonly string[]).includes(value)) {
    die(`--run-role-class must be one of ${RUN_ROLE_CLASS_VALUES.join("|")}, got: ${value}`);
  }
  return value as RunRoleClass;
}

function parseBlocksOn(
  values: readonly string[],
): { briefId: string; runRoleClass: RunRoleClass }[] {
  // Each entry is `<briefId>:<roleClass>` where briefId may itself contain
  // colons (Phase-2 briefIds look like `brief:atlas:...:2026-05-20`). The
  // role-class is always the final segment.
  return values.map((raw) => {
    const lastColon = raw.lastIndexOf(":");
    if (lastColon <= 0 || lastColon === raw.length - 1) {
      die(`--blocks-on must be 'briefId:roleClass', got: ${raw}`);
    }
    const briefId = raw.slice(0, lastColon).trim();
    const roleStr = raw.slice(lastColon + 1).trim();
    if (briefId === "") die(`--blocks-on briefId must be non-empty, got: ${raw}`);
    return { briefId, runRoleClass: runRoleClassFrom(roleStr) };
  });
}

const SCROOGE_REF: RmsAgentRef = {
  name: "Scrooge",
  position: "Chief of Staff / Orchestrator",
  agentId: "agent:scrooge",
};

const PRIORITY_VALUES = ["now", "next-tick", "scheduled"] as const;
type Priority = (typeof PRIORITY_VALUES)[number];

const EXPECTED_KIND_VALUES = [
  "decision-card",
  "deliverable-document",
  "register-row",
  "code-pr",
] as const;
type ExpectedKind = (typeof EXPECTED_KIND_VALUES)[number];

function parseExpected(values: readonly string[]): AgentBriefIssuedPayload["expectedOutputs"] {
  return values.map((raw) => {
    const idx = raw.indexOf(":");
    if (idx <= 0) die(`--expected must be 'kind:description', got: ${raw}`);
    const kind = raw.slice(0, idx).trim();
    const description = raw.slice(idx + 1).trim();
    if (!(EXPECTED_KIND_VALUES as readonly string[]).includes(kind)) {
      die(`--expected kind must be one of ${EXPECTED_KIND_VALUES.join("|")}, got: ${kind}`);
    }
    if (description.length === 0) die(`--expected description is required, got: ${raw}`);
    return { kind: kind as ExpectedKind, description };
  });
}

function priorityFrom(value: string): Priority {
  if (!(PRIORITY_VALUES as readonly string[]).includes(value)) {
    die(`--priority must be one of ${PRIORITY_VALUES.join("|")}, got: ${value}`);
  }
  return value as Priority;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function findRecentDuplicate(
  title: string,
  issuedToName: string,
  bodyHash: string,
  asOf: string,
): string | undefined {
  const cutoffMs = new Date(asOf).getTime() - 60 * 60 * 1000; // 1 hour
  for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
    const t = new Date(e.as_of).getTime();
    if (Number.isNaN(t) || t < cutoffMs) continue;
    const p = e.payload as AgentBriefIssuedPayload;
    if (
      p.title === title &&
      p.directiveDocumentHash === bodyHash &&
      p.issuedTo?.name === issuedToName
    ) {
      return p.briefId;
    }
  }
  return undefined;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2), REPEATABLE);

  const toName = requireString(args, "to-name");
  const toPosition = requireString(args, "to-position");
  const title = requireString(args, "title");
  const workstream = requireString(args, "workstream");
  const priority = priorityFrom(requireString(args, "priority"));
  const bodyPath = requireString(args, "body");
  const cites = requireRepeatable(args, "cite");
  const expected = parseExpected(requireRepeatable(args, "expected"));

  const issuedByName = optionalString(args, "issued-by-name") ?? SCROOGE_REF.name;
  const issuedByPosition = optionalString(args, "issued-by-position") ?? SCROOGE_REF.position;
  const scheduledFor = optionalString(args, "scheduled-for");
  const briefIdOverride = optionalString(args, "brief-id");

  // D-DISPATCH-SYNC-PRIMITIVE: optional reviewer/decider topology.
  const runRoleClassRaw = optionalString(args, "run-role-class");
  const runRoleClass = runRoleClassRaw ? runRoleClassFrom(runRoleClassRaw) : undefined;
  const blocksOnRaw = optionalRepeatable(args, "blocks-on");
  const blocksOn = blocksOnRaw.length > 0 ? parseBlocksOn(blocksOnRaw) : undefined;

  if (!existsSync(bodyPath)) die(`--body path not found: ${bodyPath}`);
  const directiveBody = readFileSync(bodyPath, "utf8");
  if (directiveBody.trim() === "") die(`--body file is empty: ${bodyPath}`);

  // Pre-hash the body via the doc store so we can dedupe before emitting.
  const docStore: LocalFsDocumentStore = defaultDocumentStore;
  const peek = docStore.put(directiveBody); // idempotent; safe to call twice
  const asOf = clock.now();

  const duplicate = findRecentDuplicate(title, toName, peek.hash, asOf);
  if (duplicate) {
    emitOk({
      duplicate: true,
      briefId: duplicate,
      documentHash: peek.hash,
      note: "AgentBriefIssued with identical (title + issuedTo + body-hash) emitted within the last hour — skipped",
    });
    return;
  }

  const briefId =
    briefIdOverride ?? `brief:${slugify(toName)}:${slugify(title)}:${asOf.slice(0, 10)}`;

  const issuedTo: RmsAgentRef = {
    name: toName,
    position: toPosition,
    agentId: `agent:${slugify(toName)}`,
  };
  const issuedBy: RmsAgentRef = {
    name: issuedByName,
    position: issuedByPosition,
  };

  const result = recordBriefIssued(
    {
      briefId,
      issuedTo,
      issuedBy,
      title,
      directiveBody,
      priority,
      expectedOutputs: expected,
      workstreamId: workstream,
      ...(scheduledFor ? { scheduledFor } : {}),
      ...(runRoleClass ? { runRoleClass } : {}),
      ...(blocksOn ? { blocksOn } : {}),
      citations: cites,
      actor: { type: "service", id: "agent:scrooge" },
    },
    asOf,
  );

  // D-DISPATCH-MULTI-HOST-POSTGRES-MIRROR-AUTO-INVOKE — best-effort mirror.
  // Fire-and-forget; never blocks CLI exit or fails CI when mirror is absent.
  mirrorEventToPostgres(result.event).catch(() => {});

  emitOk({
    duplicate: false,
    briefId,
    documentHash: result.documentHash,
    eventId: result.eventId,
    isNewDocument: result.isNewDocument,
  });
}

main();
