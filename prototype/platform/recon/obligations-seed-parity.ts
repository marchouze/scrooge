// platform/recon/obligations-seed-parity.ts
//
// Vera recon: obligations-seed-parity. After PR B of
// D-REGULATORY-ARCHITECTURE-TWO-PLANE, the canonical authored origin of the
// bank-obligation register is Regulations/_obligations.seed.json (folded into
// ObligationAdopted events by backfill:obligations). The legacy
// Regulations/_obligations-register.md is a retained human render. This gate
// asserts the render has not drifted from the seed — same obligation IDs and
// matching key fields — so the markdown cannot silently diverge from the
// authored origin.
//
// Mode: blocking. Wired into ci:recon:domain.
//
// Authority: D-REGULATORY-ARCHITECTURE-TWO-PLANE (CEO session-delegation 2026-06-04).
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligations-seed-parity";

interface SeedRow {
  id: string;
  fulfilmentPolicy?: string;
  owner?: string;
  reviewStatus?: string;
  section?: string;
  domain?: string;
}

/**
 * Assert section -> domain is a function (1:1): every row that shares a section
 * header must carry the same `domain` letter. A register section header is a
 * single-domain grouping; a section spanning multiple domain letters defeats
 * per-domain coverage rollups. (WS-OBLIGATION-CLEANUP Phase-1a,
 * D-OBLIGATIONS-REGISTER-CLEANUP — two such breaks reconciled: the OTC-Derivative
 * "Domain M" and "Thin human layer Domain O" sections were each split per domain.)
 */
function sectionDomainViolations(seed: SeedRow[]): ReconViolation[] {
  const bySection = new Map<string, Set<string>>();
  for (const row of seed) {
    const section = (row.section ?? "").trim();
    if (!section) continue;
    const domain = (row.domain ?? "").trim();
    if (!bySection.has(section)) bySection.set(section, new Set());
    bySection.get(section)?.add(domain);
  }
  const out: ReconViolation[] = [];
  for (const [section, domains] of bySection) {
    if (domains.size > 1) {
      out.push({
        subject: section,
        message: `section spans multiple domains [${[...domains].sort().join(", ")}] — a section header must map to exactly one domain letter; split the section so each row's domain agrees with its header`,
        severity: "fail",
      });
    }
  }
  return out;
}

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

/** Parse the register markdown's ORG-* rows by the canonical 17-column schema. */
function parseMarkdownRows(md: string): Map<string, { fulfilmentPolicy: string; owner: string }> {
  const out = new Map<string, { fulfilmentPolicy: string; owner: string }>();
  for (const line of md.split("\n")) {
    if (!/^\|\s*ORG-/.test(line)) continue;
    const cells = line
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim());
    const id = cells[0] ?? "";
    if (id) out.set(id, { fulfilmentPolicy: cells[4] ?? "", owner: cells[5] ?? "" });
  }
  return out;
}

export interface RunOpts {
  repoRoot?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? findRepoRoot(import.meta.dir);
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const seedPath = resolve(repoRoot, "Regulations/_obligations.seed.json");
  const mdPath = resolve(repoRoot, "Regulations/_obligations-register.md");

  if (!existsSync(seedPath)) {
    violations.push({
      subject: "Regulations/_obligations.seed.json",
      message: "canonical obligations seed missing",
      severity: "fail",
    });
    result.ok = false;
    result.violations = violations;
    return result;
  }

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[];
  result.asserted = seed.length;
  const seedById = new Map(seed.map((r) => [r.id, r]));

  // Section -> domain must be a function (1:1). Asserted against the seed (the
  // authored origin), independent of the markdown render's presence.
  violations.push(...sectionDomainViolations(seed));

  // If the markdown render still exists, assert parity. If it has been removed
  // (full cut), the seed alone is canonical and there is no render to compare —
  // but the seed-only section->domain assertion above still stands.
  if (!existsSync(mdPath)) {
    result.ok = violations.filter((v) => v.severity === "fail").length === 0;
    result.violations = violations;
    return result;
  }

  const mdById = parseMarkdownRows(readFileSync(mdPath, "utf8"));

  // Same ID set.
  for (const id of seedById.keys()) {
    if (!mdById.has(id)) {
      violations.push({
        subject: id,
        message: "obligation in seed but missing from the markdown render",
        severity: "fail",
      });
    }
  }
  for (const id of mdById.keys()) {
    if (!seedById.has(id)) {
      violations.push({
        subject: id,
        message:
          "obligation in the markdown render but missing from the seed (edit the seed, not the render)",
        severity: "fail",
      });
    }
  }

  // Key-field parity for shared IDs.
  for (const [id, s] of seedById) {
    const m = mdById.get(id);
    if (!m) continue;
    if ((s.fulfilmentPolicy ?? "") !== m.fulfilmentPolicy) {
      violations.push({
        subject: id,
        message: `fulfilment-policy drift: seed="${s.fulfilmentPolicy}" vs render="${m.fulfilmentPolicy}"`,
        severity: "fail",
      });
    }
    if ((s.owner ?? "") !== m.owner) {
      violations.push({
        subject: id,
        message: `owner drift: seed="${s.owner}" vs render="${m.owner}"`,
        severity: "fail",
      });
    }
  }

  const failCount = violations.filter((v) => v.severity === "fail").length;
  result.ok = failCount === 0;
  result.violations = violations;
  return result;
}

if (import.meta.main) {
  const result = run();
  const fails = result.violations.filter((v) => v.severity === "fail");
  for (const v of fails.slice(0, 20)) {
    console.error(`  FAIL  [${v.subject}] ${v.message}`);
  }
  if (fails.length === 0) {
    console.log(
      `recon:${PIPELINE} OK — ${result.asserted} obligation(s); seed and markdown render in parity`,
    );
  } else {
    console.error(`\nrecon:${PIPELINE} FAILED — ${fails.length} violation(s)`);
    process.exit(1);
  }
}
