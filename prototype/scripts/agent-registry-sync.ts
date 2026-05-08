// scripts/agent-registry-sync.ts
//
// One-shot CLI: walks `/Team/*.md`, parses each as an agent operating
// spec, and registers the result with the agent registry. Idempotent —
// re-running with no spec changes emits zero events.
//
// Invocation: `bun run registry:sync` (npm script in `package.json`).
//
// Exit status:
//   - 0 if every persona file parsed and registered cleanly.
//   - 1 if any persona file failed to parse. The script logs every
//     failure rather than aborting on the first; the caller sees the
//     full error list in one pass.
//
// This is the A1.1 vanguard. The runtime handler that calls the registry
// on a schedule is A1's next slice (separate file, parallel agent's
// scope per the build assignment).
//
// Author: Atlas (A1.1)

import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { parseSpecFile } from "../platform/agent-runtime/spec-parser";
import { eventStore, logger } from "../platform/composition";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");
const TEAM_DIR = resolve(REPO_ROOT, "Team");

interface PerFileLog {
  readonly file: string;
  readonly outcome: "registered" | "updated" | "unchanged" | "skipped" | "failed";
  readonly detail: string;
}

function listPersonaFiles(teamDir: string): string[] {
  if (!existsSync(teamDir)) return [];
  // Skip files starting with `_` (template) or `.` (hidden); only `.md`.
  return readdirSync(teamDir)
    .filter((n) => n.endsWith(".md") && !n.startsWith("_") && !n.startsWith("."))
    .sort();
}

async function main(): Promise<number> {
  const files = listPersonaFiles(TEAM_DIR);
  if (files.length === 0) {
    logger.error({ teamDir: TEAM_DIR }, "registry:sync — no persona files found; aborting");
    return 1;
  }

  const registry = new LocalAgentRegistry({ eventStore });
  const log: PerFileLog[] = [];
  let parseFailures = 0;

  for (const file of files) {
    const path = resolve(TEAM_DIR, file);
    const result = parseSpecFile(path);
    if (!result.ok) {
      parseFailures++;
      log.push({ file, outcome: "failed", detail: result.reason });
      logger.error({ file, reason: result.reason }, "registry:sync — parse failure");
      continue;
    }
    const spec = result.spec;
    const reg = registry.register(spec);
    log.push({
      file,
      outcome: reg.status,
      detail: `${spec.agentUrn} ${spec.specVersion} hash=${spec.specHash.slice(0, 12)} caps=${spec.systemCapabilities.length} events=${spec.eventsEmitted.length}`,
    });
    logger.info(
      {
        file,
        agentUrn: spec.agentUrn,
        status: reg.status,
        eventEmitted: reg.eventEmitted,
        specVersion: spec.specVersion,
        triggerCount: spec.triggerCount,
        decisionsInScopeCount: spec.decisionsInScopeCount,
        decisionsEscalateCount: spec.decisionsEscalateCount,
        systemCapabilities: spec.systemCapabilities.length,
        eventsEmitted: spec.eventsEmitted.length,
        proceduresOwned: spec.proceduresOwned.length,
      },
      `registry:sync — ${reg.status}`,
    );
  }

  // Summary line for humans / CI logs.
  const counts = {
    registered: log.filter((l) => l.outcome === "registered").length,
    updated: log.filter((l) => l.outcome === "updated").length,
    unchanged: log.filter((l) => l.outcome === "unchanged").length,
    failed: log.filter((l) => l.outcome === "failed").length,
  };
  logger.info(
    { ...counts, total: files.length },
    `registry:sync — done: registered=${counts.registered} updated=${counts.updated} unchanged=${counts.unchanged} failed=${counts.failed} (total=${files.length})`,
  );

  return parseFailures === 0 ? 0 : 1;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
