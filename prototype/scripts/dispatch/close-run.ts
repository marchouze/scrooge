// scripts/dispatch/close-run.ts
//
// RMS Phase 2 Block A — events-first dispatch helper #3 of 3.
// Extended in Block B to file each deliverable as a `RecordFiled` event
// alongside the run-completion event, making the Document register the
// canonical home for every agent deliverable.
//
// Scrooge invokes this CLI when an agent run completes (or is blocked /
// withdrawn). Each `--deliverable <path>` body is put into the content-
// addressed document store; the hashes go into the
// `AgentRunCompleted.deliverableDocumentHashes` payload (RMS-3), and a
// `RecordFiled` event registers each hash in the typed-classification +
// retention envelope (RMS-7).
//
// Usage:
//
//   bun run dispatch:close-run \
//     --run <runId> \
//     --brief <briefId> \
//     --agent-name <name> --agent-position <position> \
//     --outcome <delivered|blocked|withdrawn> \
//     [--deliverable <path>]... \
//     [--classification <ceo-only|governance-seat|engineering-seat|agent-internal|public-disclosure>]... \
//     [--register-key <decisions|correspondence|agent-runs|documents|feedback|briefs|workstreams>]... \
//     [--cite <urn>]... \
//     [--gap <substrate-gap-string>]... \
//     [--follow-on <kind:target:directive>]...
//
// `--cite` defaults to ["D-RMS-PHASE-1"] if none supplied.
// `--follow-on` format: `kind:target:directive` where kind ∈
// {agent, decision, register-update}.
//
// `--classification` and `--register-key` are repeatable, paired with
// `--deliverable` by position. When fewer values are supplied than
// deliverables, the last value broadcasts to the remaining deliverables;
// missing entirely → `agent-internal` / `documents` (Phase 1 spec §6
// defaults). Retention citation is derived from the register-key via
// `defaultRetentionForRegister` (Banks Act 5y for agent-runs / documents
// / workstreams; Companies Act §24 7y for decisions / briefs;
// FIC Act §22 5y for correspondence / feedback).
//
// Authority: D-RMS-PHASE-1; D-RMS-PHASE-2-4-AUTHORSHIP.
// Spec: Owner Inbox/actioned/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md
//
// Author: Atlas (Core banking platform architect, engineering)

// D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21) — MUST be first import.
import "./resolve-event-db-boot";

import { existsSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { clock, eventStore } from "../../platform/composition";
import { HOZ_BANK_ENTITY } from "../../platform/core/types";
import { checkDeciderMayClose } from "../../platform/dispatch";
import type {
  AgentRunCompletedFollowOnRoute,
  AgentRunCompletedPayload,
  RecordFiledPayload,
  RmsAgentRef,
} from "../../platform/event-store/event-types";
import { makeSubstrateAlert } from "../../platform/event-store/event-types/platform";
import {
  defaultRetentionForRegister,
  recordAgentRunCompleted,
  recordFiled,
} from "../../platform/records";
import { die, emitOk, optionalRepeatable, optionalString, parseArgs, requireString } from "./args";

const REPEATABLE = new Set([
  "deliverable",
  "classification",
  "register-key",
  "cite",
  "gap",
  "follow-on",
]);

const CLASSIFICATIONS = [
  "ceo-only",
  "governance-seat",
  "engineering-seat",
  "agent-internal",
  "public-disclosure",
] as const satisfies readonly RecordFiledPayload["classification"][];

const REGISTER_KEYS = [
  "decisions",
  "correspondence",
  "agent-runs",
  "documents",
  "feedback",
  "briefs",
  "workstreams",
] as const satisfies readonly RecordFiledPayload["registerKey"][];

function classificationFrom(value: string): RecordFiledPayload["classification"] {
  if (!(CLASSIFICATIONS as readonly string[]).includes(value)) {
    die(`--classification must be one of ${CLASSIFICATIONS.join("|")}, got: ${value}`);
  }
  return value as RecordFiledPayload["classification"];
}

function registerKeyFrom(value: string): RecordFiledPayload["registerKey"] {
  if (!(REGISTER_KEYS as readonly string[]).includes(value)) {
    die(`--register-key must be one of ${REGISTER_KEYS.join("|")}, got: ${value}`);
  }
  return value as RecordFiledPayload["registerKey"];
}

/**
 * Pair-broadcast a repeatable per-deliverable flag against the deliverable
 * list. If `values` is shorter than `count`, the last supplied value is
 * broadcast to the remaining slots. If `values` is empty, every slot is
 * filled with `fallback`. Longer-than-count is rejected (caller error).
 */
function pairBroadcast<T>(flagName: string, values: readonly T[], count: number, fallback: T): T[] {
  if (values.length > count) {
    die(`--${flagName} supplied ${values.length} times but only ${count} --deliverable(s)`);
  }
  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    out.push(values[i] ?? values[values.length - 1] ?? fallback);
  }
  return out;
}
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
    const kind = (parts[0] ?? "").trim();
    const target = (parts[1] ?? "").trim();
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
  const classificationsRaw = optionalRepeatable(args, "classification");
  const registerKeysRaw = optionalRepeatable(args, "register-key");
  const cites = optionalRepeatable(args, "cite");
  const gaps = optionalRepeatable(args, "gap");
  const followOnsRaw = optionalRepeatable(args, "follow-on");

  if (outcome === "delivered" && deliverablePaths.length === 0) {
    die("--outcome=delivered requires at least one --deliverable <path>");
  }

  // D-DISPATCH-SYNC-PRIMITIVE: when closing a decider-class run as delivered,
  // verify every entry in `brief.blocksOn` has a matching delivered closing
  // run. Bypass via --force-close-bypass-sync (surfaces in substrateGapsSurfaced).
  const forceBypass = optionalString(args, "force-close-bypass-sync") === "true";
  const preCloseAsOf = clock.now();
  if (outcome === "delivered") {
    const syncCheck = checkDeciderMayClose({ briefId, asOf: preCloseAsOf });
    if (!syncCheck.ok) {
      if (!forceBypass) {
        console.error(
          JSON.stringify({
            ok: false,
            error: "dispatch-sync-primitive-violation",
            briefId,
            blockedBy: syncCheck.blockedBy,
            blocksOn: syncCheck.blocksOn,
            hint: "Required reviewer run has not closed delivered. Wait for it or pass --force-close-bypass-sync true.",
            citations: ["D-DISPATCH-SYNC-PRIMITIVE"],
          }),
        );
        process.exit(1);
      }
      // Caller forced the bypass — surface the gap on the resulting event
      // AND emit a high-severity `SubstrateAlert{alertClass:"integrity"}`
      // so Vera's recon can drive the count to zero. Loud-warn to stderr
      // makes the bypass impossible to miss in agent logs.
      // D-CROSS-WORKTREE-EVENT-STORE-SYNC (2026-05-21): cross-worktree
      // visibility now works via shared event store at $HOME/.local/share/
      // bank/event.db; routine bypass should be zero. Each remaining bypass
      // is a true emergency escape.
      const bypassGap =
        `dispatch-sync-bypass: closed delivered while ${syncCheck.blockedBy?.briefId ?? "blocking brief"} ` +
        `was ${syncCheck.blockedBy?.reason ?? "unsatisfied"} (D-DISPATCH-SYNC-PRIMITIVE; D-CROSS-WORKTREE-EVENT-STORE-SYNC)`;
      gaps.push(bypassGap);

      console.error(
        JSON.stringify({
          level: "warn",
          component: "dispatch:close-run",
          msg: "force-close-bypass-sync=true — emergency escape valve fired",
          briefId,
          blockedBy: syncCheck.blockedBy,
          citations: ["D-DISPATCH-SYNC-PRIMITIVE", "D-CROSS-WORKTREE-EVENT-STORE-SYNC"],
          hint: "Cross-worktree visibility is now substrate-supported; bypass should be exceptional, not routine.",
        }),
      );

      // Emit a typed `SubstrateAlert{alertClass:"integrity"}` so Vera's
      // recon can drive the count to zero. Best-effort: never block the
      // close-run on alert-emit failure (the gap on AgentRunCompleted
      // remains the canonical audit record).
      try {
        const alertSlug = briefId
          .replace(/[^a-z0-9-]+/gi, "-")
          .toLowerCase()
          .slice(0, 40)
          .replace(/^-+|-+$/g, "");
        const alert = makeSubstrateAlert({
          asOf: preCloseAsOf,
          entity: HOZ_BANK_ENTITY,
          actor: { type: "service", id: "agent:dispatch-close-run" },
          citations: ["D-DISPATCH-SYNC-PRIMITIVE", "D-CROSS-WORKTREE-EVENT-STORE-SYNC"],
          payload: {
            alertId: `alert:integrity:dispatch-bypass-${alertSlug || "unknown"}`,
            alertClass: "integrity",
            severity: "high",
            details: bypassGap,
          },
        });
        eventStore.append(alert);
      } catch (e) {
        console.error(
          JSON.stringify({
            level: "warn",
            component: "dispatch:close-run",
            msg: "SubstrateAlert emit failed — gap remains on AgentRunCompleted",
            err: (e as Error).message,
          }),
        );
      }
    }
  }

  const deliverableBodies: string[] = [];
  for (const p of deliverablePaths) {
    if (!existsSync(p)) die(`--deliverable path not found: ${p}`);
    const body = readFileSync(p, "utf8");
    if (body.trim() === "") die(`--deliverable file is empty: ${p}`);
    deliverableBodies.push(body);
  }

  // Pair classification + register-key with each deliverable by position;
  // broadcast last value when fewer supplied; default `agent-internal` /
  // `documents` per Phase 1 spec §6.
  const classifications = pairBroadcast<RecordFiledPayload["classification"]>(
    "classification",
    classificationsRaw.map(classificationFrom),
    deliverablePaths.length,
    "agent-internal",
  );
  const registerKeys = pairBroadcast<RecordFiledPayload["registerKey"]>(
    "register-key",
    registerKeysRaw.map(registerKeyFrom),
    deliverablePaths.length,
    "documents",
  );

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
  const deliverableHashes = [...payload.deliverableDocumentHashes];

  // -----------------------------------------------------------------
  // Block B — RecordFiled per deliverable. One event per deliverable;
  // the document body has already been put into the store by
  // `recordAgentRunCompleted`, so `recordFiled` re-puts the same bytes
  // (idempotent at the content-addressed layer) and emits the
  // classification + retention envelope. recordId is derived as
  // `record:<runId>:<index>:<deliverable-basename>` — stable per run +
  // position so re-running close-run for the same outputs produces the
  // same recordId (the event itself is appended once per call; this is
  // a Phase 2 limitation, see substrate gap below).
  // -----------------------------------------------------------------
  const recordEvents: Array<{
    recordId: string;
    documentHash: string;
    classification: RecordFiledPayload["classification"];
    registerKey: RecordFiledPayload["registerKey"];
    eventId: string;
  }> = [];

  for (let i = 0; i < deliverablePaths.length; i++) {
    const deliverablePath = deliverablePaths[i] ?? `deliverable-${i}`;
    const body = deliverableBodies[i] ?? "";
    const classification = classifications[i] ?? "agent-internal";
    const registerKey = registerKeys[i] ?? "documents";
    const retention = defaultRetentionForRegister(registerKey);
    const fileBase = basename(deliverablePath).replace(/[^A-Za-z0-9._-]/g, "-");
    const recordId = `record:${runId}:${i}:${fileBase}`;

    const filed = recordFiled(
      {
        recordId,
        registerKey,
        body,
        classification,
        retention,
        actor: { type: "service", id: agent.agentId ?? `agent:${slugify(agentName)}` },
        citations: deliverableCitations,
        metadata: {
          title: fileBase,
          path: deliverablePath,
          category: registerKey,
          author: agentName,
          date: asOf.slice(0, 10),
        },
      },
      asOf,
    );

    recordEvents.push({
      recordId,
      documentHash: filed.documentHash,
      classification,
      registerKey,
      eventId: filed.eventId,
    });
  }

  emitOk({
    runId,
    briefId,
    eventId: result.eventId,
    outcome,
    deliverableHashes,
    newDeliverableCount: result.newDeliverableCount,
    completedAt: asOf,
    recordEvents,
  });
}

main();
