// scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts
//
// One-off re-derivation of `seeds/dashboard-state.json` from canonical
// sources after Mira (Compliance / RegTech engineer) landed Domain P
// (FAIS Posture A binding) under CEO decision D-FSP-LICENCE-NECESSITY
// (resolved 2026-05-09 as confirm-A-no-research; PR #62).
//
// Per CLAUDE.md memory `feedback_dashboard_always_derived.md`, the seeds
// file is a cache; it must be re-derived from canonical sources, never
// hand-edited. This script is the canonical re-derivation path used after
// register changes (Domain P closed ORG-FAIS-KI gap row + opened 5 new
// FAIS-record-keeping URNs; obligations metric advances by +6).
//
// Run:  bun run scripts/derive-dashboard-state-2026-05-09-fais-posture-a.ts

import { existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { defaultSourcePaths, deriveState, eventSourceFromStore } from "../dashboard/derive";
import { EventStore } from "../platform/event-store/store";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const REGISTRY_PATH = resolve(REPO_ROOT, "prototype/seeds/dashboard-state.json");
const DB_PATH = process.env.BANK_EVENT_DB ?? resolve(REPO_ROOT, "prototype/.local/event.db");

const sources = defaultSourcePaths(REPO_ROOT);
const events = existsSync(DB_PATH)
  ? eventSourceFromStore(new EventStore(DB_PATH))
  : {
      ceoDecisions: () => [],
      workstreamStarts: () => [],
      workstreamCompletions: () => [],
      workstreamRegistrations: () => [],
      agentEscalations: () => [],
      auditFindings: () => [],
      decisionComments: () => [],
    };

const next = deriveState({ sources, events });
writeFileSync(REGISTRY_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");

// `metrics` lives under bank.metrics.obligations in the schema; access defensively.
const obligationsCount = (next as unknown as { bank?: { metrics?: { obligations?: number } } }).bank
  ?.metrics?.obligations;
console.log(
  `Re-derived dashboard state. Obligations metric: ${obligationsCount ?? "(unavailable)"}`,
);
