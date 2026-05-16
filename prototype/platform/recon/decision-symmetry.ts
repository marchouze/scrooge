// platform/recon/decision-symmetry.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — WARN-only.
//
// Asserts per `DecisionsRegister.byId` entry:
//   - every closed decision has at least one terminal-phase event;
//   - every open decision has at least one `requested` event AND no
//     terminal-phase event.
//
// Slice A: warnings only; exits 0. Slice B promotes to errors.
//
// Spec: `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 5. Recon gates".
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import { DECISION_TERMINAL_PHASES } from "../event-store/event-types/decision";
import { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const PIPELINE = "decision-symmetry";

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) {
    // Fresh worktree without a local event store — nothing to assert.
    return result;
  }
  const store = new EventStore(dbPath);
  const register = buildDecisionsRegister(decisionsSourceFromStore(store));

  const violations: ReconViolation[] = [];
  const terminalSet = new Set<string>(DECISION_TERMINAL_PHASES);

  for (const history of register.byId.values()) {
    result.asserted++;
    const phases = history.events.map((e) => e.phase);
    const hasRequested = phases.includes("requested");
    const hasTerminal = phases.some((p) => terminalSet.has(p));

    if (terminalSet.has(history.head.phase)) {
      // closed — expect a terminal event (it IS one) — also expect an opener.
      if (!hasRequested) {
        violations.push({
          subject: history.decisionId,
          message: `decision \`${history.decisionId}\` is closed but has no \`requested\` event in its phase chain. Phases observed: [${phases.join(", ")}]. Slice C backfill will emit the missing requested phase.`,
          severity: "warn",
        });
      }
    } else {
      // open — expect at least one requested and no terminal.
      if (!hasRequested) {
        violations.push({
          subject: history.decisionId,
          message: `decision \`${history.decisionId}\` is open but never emitted a \`requested\` phase. Phases observed: [${phases.join(", ")}].`,
          severity: "warn",
        });
      }
      if (hasTerminal) {
        violations.push({
          subject: history.decisionId,
          message: `decision \`${history.decisionId}\` head phase is open (\`${history.head.phase}\`) but its history contains a terminal phase. Head-of-chain mismatch.`,
          severity: "warn",
        });
      }
    }
  }

  result.violations = violations;
  // WARN-only this slice — never flip ok=false.
  result.ok = true;
  return result;
}

if (import.meta.main) {
  const result = run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
