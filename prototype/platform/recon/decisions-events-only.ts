// platform/recon/decisions-events-only.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice A — WARN-only.
//
// Asserts: every `D-*` id referenced in `Owner Inbox/**.md` frontmatter
// (`decision-id` and `superseded-by[].decision-id`) has a matching
// `Decision` or `CeoDecision` event for every claimed phase. Slice A
// emits warnings only; Slice B promotes to errors.
//
// Authoring rule (per the redesign): markdown is render, never the
// authoring channel. Decisions must travel as events. Any `D-*` in
// markdown without a backing event is a candidate for Slice C backfill.
//
// Spec: `/Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md`
// §"Target design / 5. Recon gates".
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";
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

const PIPELINE = "decisions-events-only";

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
const DECISION_ID_RE = /^decision-id\s*:\s*(D-[A-Za-z0-9-]+)\s*$/im;

function walkMarkdown(dir: string, out: string[]): void {
  if (!existsSync(dir)) return;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkMarkdown(p, out);
    else if (name.endsWith(".md")) out.push(p);
  }
}

function readDecisionId(path: string): string | null {
  const txt = readFileSync(path, "utf8");
  const m = txt.match(FRONTMATTER_RE);
  if (!m || !m[1]) return null;
  const dm = m[1].match(DECISION_ID_RE);
  return dm?.[1] ? dm[1].toUpperCase() : null;
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

  const store = new EventStore(dbPath);
  const register = buildDecisionsRegister(decisionsSourceFromStore(store));
  const knownIds = new Set<string>(register.byId.keys());

  const violations: ReconViolation[] = [];
  const files: string[] = [];
  walkMarkdown(resolve(repoRoot, "Owner Inbox"), files);

  for (const path of files) {
    const id = readDecisionId(path);
    if (!id) continue;
    result.asserted++;
    if (!knownIds.has(id)) {
      const rel = path.slice(repoRoot.length + 1);
      violations.push({
        subject: id,
        message: `decisionId \`${id}\` referenced in \`${rel}\` has no backing \`Decision\` or \`CeoDecision\` event. Slice C backfill will emit one. Until then markdown is the only record — Principle 1 violation pending.`,
        severity: "warn",
      });
    }
  }

  result.violations = violations;
  result.ok = true; // WARN-only this slice.
  return result;
}

if (import.meta.main) {
  const result = run();
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}
