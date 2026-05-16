// platform/recon/decision-id-hygiene.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — WARN-only.
//
// Asserts slug hygiene on every decisionId in the events-only register:
//   - no placeholder ids (`D-XXX`, `D-IN`, `D-FX-`, bare `D-01..D-99`);
//   - 3–60 chars total;
//   - uppercase only (the payload schema already enforces; this catches
//     legacy CeoDecision ids that were lowercased by emitters);
//   - no prefix-shadow (`D-FX-` shadows any `D-FX-*` — same id used as
//     both root and prefix of another id is a slug collision).
//
// Slice A: warnings only; Slice B's `mintDecisionId` will reject these
// at authoring time.
//
// Spec: `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 4. ID minting".
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
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

const PIPELINE = "decision-id-hygiene";

const PLACEHOLDER_IDS = new Set(["D-XXX", "D-IN", "D-FX-", "D-TBD", "D-TODO"]);
const NUMERIC_ONLY = /^D-\d{1,3}$/;
const VALID_SLUG = /^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/;

export interface RunOpts {
  dbPath?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const dbPath =
    opts.dbPath ?? process.env.BANK_EVENT_DB ?? resolve(repoRoot, "prototype/.local/event.db");
  const result: ReconResult = emptyResult(PIPELINE);
  if (!existsSync(dbPath)) return result;

  const store = new EventStore(dbPath);
  const register = buildDecisionsRegister(decisionsSourceFromStore(store));
  const ids = [...register.byId.keys()];
  const violations: ReconViolation[] = [];

  for (const id of ids) {
    result.asserted++;
    if (PLACEHOLDER_IDS.has(id)) {
      violations.push({
        subject: id,
        message: `decisionId \`${id}\` is a placeholder. Resolve to a canonical slug or remove during Slice C cutover.`,
        severity: "warn",
      });
      continue;
    }
    if (NUMERIC_ONLY.test(id)) {
      violations.push({
        subject: id,
        message: `decisionId \`${id}\` is numeric-only (D-NN). Numeric-only ids collide across batches; Slice C migration maps these to semantic slugs.`,
        severity: "warn",
      });
      continue;
    }
    if (id.length > 60) {
      violations.push({
        subject: id,
        message: `decisionId \`${id}\` exceeds 60-char slug limit (${id.length} chars).`,
        severity: "warn",
      });
      continue;
    }
    if (!VALID_SLUG.test(id)) {
      violations.push({
        subject: id,
        message: `decisionId \`${id}\` violates slug format \`/^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/\` (uppercase, hyphen-separated, no trailing hyphen).`,
        severity: "warn",
      });
    }
  }

  // Prefix-shadow check: `D-FOO` and `D-FOO-BAR` both exist — the bare
  // root shadows the namespace. Slice B's `mintDecisionId` refuses these
  // at authoring; here we flag existing pairs.
  const idSet = new Set(ids);
  for (const id of ids) {
    for (const other of idSet) {
      if (other === id) continue;
      if (other.startsWith(`${id}-`)) {
        violations.push({
          subject: id,
          message: `decisionId \`${id}\` is a prefix-shadow of \`${other}\` (root vs namespaced). Rename one to disambiguate.`,
          severity: "warn",
        });
        break; // one report per shadowing root is sufficient
      }
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
