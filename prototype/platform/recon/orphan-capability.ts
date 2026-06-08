// platform/recon/orphan-capability.ts
//
// Vera recon: orphan-capability (blocking).
//
// Principle-2 Rule 3 ("no orphan capabilities") made enforceable for code. A
// Capability node must REALISE at least one Procedure (i.e. at least one
// Procedure's `system-capability:` frontmatter names it), OR be on the
// published infrastructure-exemption allowlist (capability-infra.ts) with a
// typed, cited rationale. Any capability that is neither is a FAIL.
//
// The pipeline is a pure filesystem read (same shape as the other graph-axis
// recons: fsca-reg-to-policy, compliance-obligation-tracing). It re-derives the
// REALISES relation from procedure frontmatter using the SAME slug rule the
// graph seeder uses (capability-parser.ts) — so the gate and the seed can never
// drift. It does not require a seeded graph.db.
//
// Mode: blocking (non-zero exit on any FAIL). Wired into `bun run ci:recon:domain`.
//
// Authority: D-PRINCIPLE-2-CAPABILITY-LAYER (CEO-approved 2026-06-08).
// Source finding: record:documents:scrooge:principle-2-capability-to-procedure-review:2026-06-04 (F1/F2).
// Author: Atlas (Core banking platform architect, engineering).

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  INFRA_CAPABILITY_SLUGS,
  isOrphanAllowlisted,
  ORPHAN_CAPABILITY_ALLOWLIST,
} from "../regulatory/graph/capability-infra";
import { parseSystemCapabilityValue } from "../regulatory/graph/capability-parser";
import { parseProcedureFile } from "../regulatory/graph/procedure-parser";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "orphan-capability";

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/** Recursively collect all .md paths under a directory. */
function walkMd(dir: string): string[] {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir, { encoding: "utf-8" });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) out.push(...walkMd(full));
    else if (entry.endsWith(".md")) out.push(full);
  }
  return out;
}

export function run(): ReconResult {
  const repoRoot = findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);

  // 1. Re-derive the set of capability slugs REALISED by at least one procedure
  //    (i.e. named in at least one `system-capability:` frontmatter value).
  const realisedSlugs = new Set<string>();
  const proceduresDir = join(repoRoot, "Procedures");
  for (const filePath of walkMd(proceduresDir)) {
    const basename = filePath.split("/").pop() ?? "";
    if (basename.startsWith("README") || basename.startsWith("_")) continue;
    const fm = parseProcedureFile(filePath);
    if (!fm?.systemCapability) continue;
    for (const cap of parseSystemCapabilityValue(fm.systemCapability)) {
      realisedSlugs.add(cap.slug);
    }
  }

  // 2. The capability node universe = every realised slug + the six F2 infra
  //    capabilities (seeded independently in the graph). Assert each one.
  const universe = new Set<string>([...realisedSlugs, ...INFRA_CAPABILITY_SLUGS]);
  result.asserted = universe.size;

  const violations: ReconViolation[] = [];
  for (const slug of universe) {
    const realised = realisedSlugs.has(slug);
    if (realised) continue; // has ≥1 incoming REALISES — not orphan
    if (isOrphanAllowlisted(slug)) continue; // exempt with cited rationale
    violations.push({
      subject: `CAP-${slug}`,
      message: `Capability "${slug}" has no incoming REALISES edge (no procedure's system-capability: frontmatter names it) and is not on the published infrastructure-exemption allowlist (platform/regulatory/graph/capability-infra.ts). Remediation: bind it to a PROC-* procedure via that procedure's \`system-capability:\` frontmatter, OR add it to ORPHAN_CAPABILITY_ALLOWLIST with a one-line cited rationale. Authority: D-PRINCIPLE-2-CAPABILITY-LAYER (Principle 2, Rule 3 — no orphan capabilities).`,
      severity: "fail",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");

  for (const v of fails) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }

  const allowlistCount = ORPHAN_CAPABILITY_ALLOWLIST.size;
  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} capability node(s) checked, all REALISES-linked or allowlisted (${allowlistCount} on infra-exemption allowlist)`,
    );
  } else {
    console.error(
      `\nrecon:${PIPELINE} FAILED — ${fails.length} orphan capability/-ies of ${result.asserted} checked`,
    );
    process.exit(1);
  }
}
