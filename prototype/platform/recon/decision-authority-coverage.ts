// platform/recon/decision-authority-coverage.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — WARN-only.
//
// Asserts that every governance seat in `Team/_team-roster.json` with a
// non-paused `buildPhaseStatus` has ≥1 `Decision` event under its
// authority OR has a non-empty existing decision history under the
// legacy `CeoDecision` event family (the catch-all transition path).
//
// Slice A: warnings only. Slice D activates governance seats and flips
// this to errors.
//
// Spec: `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 5. Recon gates" and §"6. Non-CEO decisions become
// first-class".
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
import type { DecisionAuthority } from "../event-store/event-types/decision";
import { EventStore } from "../event-store/store";
import { applyBaselineToResult, loadBaseline } from "./decisions-baseline";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const PIPELINE = "decision-authority-coverage";

interface RosterPersona {
  readonly name: string;
  readonly role: string;
  readonly type: string;
  readonly buildPhaseStatus?: string;
}

interface Roster {
  readonly personas: readonly RosterPersona[];
}

// Persona name → DecisionAuthority. Only governance seats with a
// regulator-defined authority are mapped; other roster names default
// to authority `Agent` for the autonomous-decision channel.
const PERSONA_TO_AUTHORITY: Record<string, DecisionAuthority> = {
  Helena: "CRO",
  Zara: "CCO",
  Mira: "CCO", // engineering, but assist authority — Slice A non-strict
  Camille: "CFO",
  Devon: "COO",
  Eitan: "CISO",
  Thandiwe: "CAE",
  Owen: "CoSec",
  Ivana: "IO",
};

function isPaused(p: RosterPersona): boolean {
  return typeof p.buildPhaseStatus === "string" && /paused/i.test(p.buildPhaseStatus);
}

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) return result;

  const rosterPath = resolve(repoRoot, "Team", "_team-roster.json");
  if (!existsSync(rosterPath)) return result;
  const roster = JSON.parse(readFileSync(rosterPath, "utf8")) as Roster;

  const store = new EventStore(dbPath);
  const register = buildDecisionsRegister(decisionsSourceFromStore(store));

  // Count decision events per authority — head row authority is enough
  // since we just want "≥1 event under that authority".
  const byAuthority = new Map<DecisionAuthority, number>();
  for (const history of register.byId.values()) {
    const auth = history.head.authority;
    byAuthority.set(auth, (byAuthority.get(auth) ?? 0) + 1);
  }

  const violations: ReconViolation[] = [];
  for (const persona of roster.personas) {
    if (persona.type !== "governance") continue;
    if (isPaused(persona)) continue;
    const auth = PERSONA_TO_AUTHORITY[persona.name];
    if (!auth) continue; // unmapped governance seat — Slice D will fill in
    result.asserted++;
    const count = byAuthority.get(auth) ?? 0;
    if (count === 0) {
      violations.push({
        subject: `${persona.name} (${auth})`,
        message: `governance seat \`${persona.name}\` (authority \`${auth}\`) has no \`Decision\` events under its authority. Slice D activates non-CEO authorities; until then this is informational. To suppress, mark the persona \`buildPhaseStatus: paused\` in \`Team/_team-roster.json\`.`,
        severity: "warn",
      });
    }
  }

  const baseline = loadBaseline(repoRoot, PIPELINE);
  applyBaselineToResult(result, violations, baseline);
  return result;
}

if (import.meta.main) {
  const result = run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
