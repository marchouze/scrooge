// platform/recon/obligation-urn-coverage.ts
//
// Standing recon gate: obligation-urn-coverage (D-OBLIGATIONS-REGISTER-CLEANUP,
// CEO-approved 2026-06-09; plan Phase 2).
//
// Every bank obligation should carry a deterministic, citation-derived URN
// (`urn:reg:za:<instrument>:<section>`, minted by the same extractor the graph
// seeder uses — see scripts/backfill-obligations.ts + the URN-minting helper).
// This gate fails on any obligation whose URN is still `[TBD]`/empty UNLESS it
// is on a documented allowlist (image-only / unparseable citation prose — a
// framework name with no enumerable section, e.g. "IFRS 9", "King IV", a
// multi-instrument "+"-joined citation, or an internal RAS line).
//
// Mode: ADVISORY to start — `ok: true` regardless, reporting the residual
// `[TBD]` count so the backlog can be drained. Flip to blocking
// (`ADVISORY = false`) once the backlog clears (the allowlist is then the only
// permitted residual).
//
// Source of truth: Regulations/_obligations.seed.json (the single authored
// origin folded into ObligationAdopted events; the markdown register is a
// parity-checked render — recon:obligations-seed-parity).
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP; P1-EVENTS-AS-TRUTH;
// P2-SINGLE-GRAPH-DISCIPLINE.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligation-urn-coverage";

/** Advisory while the backlog drains; flip to false to make the gate blocking. */
const ADVISORY = true;

interface SeedRow {
  id: string;
  urn?: string;
  citation?: string;
}

/**
 * Documented allowlist: obligation IDs whose citation prose carries no
 * enumerable `instrument + section` and so cannot mint a deterministic
 * `urn:reg:za:<instrument>:<section>`. These are image-only / framework-name /
 * multi-instrument / internal-RAS citations. Each stays `[TBD]` by design until
 * a citation with an explicit section is authored. Keep this list in sync with
 * the backfill run report (the residual list).
 *
 * Grouped by reason for auditability.
 */
const URN_TBD_ALLOWLIST: ReadonlySet<string> = new Set<string>([
  // AC family (16)
  "ORG-AC-01",
  "ORG-AC-02",
  "ORG-AC-03",
  "ORG-AC-04",
  "ORG-AC-05",
  "ORG-AC-06",
  "ORG-AC-07",
  "ORG-AC-08",
  "ORG-AC-09",
  "ORG-AC-10",
  "ORG-AC-11",
  "ORG-AC-12",
  "ORG-AC-13",
  "ORG-AC-14",
  "ORG-AC-15",
  "ORG-AC-16",
  // CD family (10)
  "ORG-CD-01",
  "ORG-CD-02",
  "ORG-CD-03",
  "ORG-CD-04",
  "ORG-CD-05",
  "ORG-CD-06",
  "ORG-CD-07",
  "ORG-CD-08",
  "ORG-CD-09",
  "ORG-CD-10",
  // CS1 family (1)
  "ORG-CS1-001",
  // CS2 family (1)
  "ORG-CS2-001",
  // CS3 family (1)
  "ORG-CS3-001",
  // CY family (15)
  "ORG-CY-01",
  "ORG-CY-02",
  "ORG-CY-02-RECON-CRO-INDEPENDENCE",
  "ORG-CY-03",
  "ORG-CY-04",
  "ORG-CY-05",
  "ORG-CY-06",
  "ORG-CY-07",
  "ORG-CY-08",
  "ORG-CY-09",
  "ORG-CY-10",
  "ORG-CY-11",
  "ORG-CY-12",
  "ORG-CY-13",
  "ORG-CY-14",
  // EL family (3)
  "ORG-EL-01",
  "ORG-EL-02",
  "ORG-EL-03",
  // EXCON family (1)
  "ORG-EXCON-ODP-001",
  // FC family (23)
  "ORG-FC-02",
  "ORG-FC-03",
  "ORG-FC-04",
  "ORG-FC-05",
  "ORG-FC-06",
  "ORG-FC-07",
  "ORG-FC-08",
  "ORG-FC-09",
  "ORG-FC-10",
  "ORG-FC-11",
  "ORG-FC-11-GLOSS-CEO-MLRO-BAR",
  "ORG-FC-12",
  "ORG-FC-13",
  "ORG-FC-14",
  "ORG-FC-15",
  "ORG-FC-16",
  "ORG-FC-17",
  "ORG-FC-18",
  "ORG-FC-19",
  "ORG-FC-20",
  "ORG-FC-21",
  "ORG-FC-22",
  "ORG-FC-MLRO-ALTERNATE",
  // FMA family (2)
  "ORG-FMA-002",
  "ORG-FMA-003",
  // GV family (24)
  "ORG-GV-02",
  "ORG-GV-03",
  "ORG-GV-04",
  "ORG-GV-05",
  "ORG-GV-06",
  "ORG-GV-07",
  "ORG-GV-08",
  "ORG-GV-09",
  "ORG-GV-10",
  "ORG-GV-11",
  "ORG-GV-12",
  "ORG-GV-13",
  "ORG-GV-14",
  "ORG-GV-15",
  "ORG-GV-16",
  "ORG-GV-17",
  "ORG-GV-18",
  "ORG-GV-19",
  "ORG-GV-20",
  "ORG-GV-21",
  "ORG-GV-AC-MINIMUM",
  "ORG-GV-CFO-INDEPENDENCE",
  "ORG-GV-CRO-INDEPENDENCE",
  "ORG-GV-DIRECTORS-MINIMUM",
  // HR family (11)
  "ORG-HR-01",
  "ORG-HR-02",
  "ORG-HR-03",
  "ORG-HR-04",
  "ORG-HR-05",
  "ORG-HR-06",
  "ORG-HR-07",
  "ORG-HR-08",
  "ORG-HR-09",
  "ORG-HR-10",
  "ORG-HR-11",
  // JN2 family (1)
  "ORG-JN2-2024",
  // JS2 family (2)
  "ORG-JS2-001",
  "ORG-JS2-003",
  // MK family (11)
  "ORG-MK-01",
  "ORG-MK-02",
  "ORG-MK-03",
  "ORG-MK-04",
  "ORG-MK-05",
  "ORG-MK-06",
  "ORG-MK-07",
  "ORG-MK-08",
  "ORG-MK-RPT-001",
  "ORG-MK-RPT-002",
  "ORG-MK-RPT-003",
  // ODP family (22)
  "ORG-ODP-AUTH-001",
  "ORG-ODP-AUTH-002",
  "ORG-ODP-AUTH-003",
  "ORG-ODP-AUTH-004",
  "ORG-ODP-AUTH-005",
  "ORG-ODP-AUTH-006",
  "ORG-ODP-COND-001",
  "ORG-ODP-COND-002",
  "ORG-ODP-COND-003",
  "ORG-ODP-COND-004",
  "ORG-ODP-COND-005",
  "ORG-ODP-COND-006",
  "ORG-ODP-COND-007",
  "ORG-ODP-COND-008",
  "ORG-ODP-COND-009",
  "ORG-ODP-COND-010",
  "ORG-ODP-COND-011",
  "ORG-ODP-COND-012",
  "ORG-ODP-RPT-002",
  "ORG-ODP-RPT-003",
  "ORG-ODP-RPT-004",
  "ORG-ODP-RPT-005",
  // PR(IV) family (2)
  "ORG-PR(IV)-16",
  "ORG-PR(IV)-17",
  // PR family (26)
  "ORG-PR-01",
  "ORG-PR-02",
  "ORG-PR-03",
  "ORG-PR-04",
  "ORG-PR-05",
  "ORG-PR-06",
  "ORG-PR-07",
  "ORG-PR-08",
  "ORG-PR-09",
  "ORG-PR-10",
  "ORG-PR-11",
  "ORG-PR-12",
  "ORG-PR-13",
  "ORG-PR-14",
  "ORG-PR-15",
  "ORG-PR-16",
  "ORG-PR-17",
  "ORG-PR-18",
  "ORG-PR-19",
  "ORG-PR-20",
  "ORG-PR-21",
  "ORG-PR-22",
  "ORG-PR-23",
  "ORG-PR-24",
  "ORG-PR-25",
  "ORG-PR-26",
  // TX family (9)
  "ORG-TX-01",
  "ORG-TX-02",
  "ORG-TX-03",
  "ORG-TX-04",
  "ORG-TX-05",
  "ORG-TX-06",
  "ORG-TX-07",
  "ORG-TX-08",
  "ORG-TX-09",
  // WB family (4)
  "ORG-WB-01",
  "ORG-WB-02",
  "ORG-WB-03",
  "ORG-WB-04",
]);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

function isMissingUrn(urn: string | undefined): boolean {
  const u = (urn ?? "").trim();
  return u === "" || u === "[TBD]";
}

export interface RunOpts {
  repoRoot?: string;
}

export function run(opts: RunOpts = {}): ReconResult {
  const repoRoot = opts.repoRoot ?? REPO_ROOT;
  const result: ReconResult = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const seedPath = resolve(repoRoot, "Regulations/_obligations.seed.json");
  if (!existsSync(seedPath)) {
    result.ok = ADVISORY; // advisory: never block on a missing seed
    result.violations = [
      {
        subject: "Regulations/_obligations.seed.json",
        message: "canonical obligations seed missing",
        severity: "fail",
      },
    ];
    return result;
  }

  const seed = JSON.parse(readFileSync(seedPath, "utf8")) as SeedRow[];
  result.asserted = seed.length;

  let allowlisted = 0;
  for (const row of seed) {
    if (!isMissingUrn(row.urn)) continue;
    if (URN_TBD_ALLOWLIST.has(row.id)) {
      allowlisted++;
      continue;
    }
    violations.push({
      subject: row.id,
      message: `URN is '${(row.urn ?? "").trim() || "(empty)"}' — mint urn:reg:za:<instrument>:<section> from the citation, or add to the documented allowlist if unparseable. Citation: ${(row.citation ?? "").slice(0, 80)}`,
      severity: ADVISORY ? "warn" : "fail",
    });
  }

  const residualTbd = violations.length;
  const populated = seed.length - residualTbd - allowlisted;

  // Advisory: ok regardless, so the backlog can drain without blocking CI.
  // When ADVISORY is flipped to false, a non-empty residual fails the gate.
  result.ok = ADVISORY || residualTbd === 0;
  result.violations = violations;

  // Stash the summary on the result via console at CLI time (below).
  (result as ReconResult & { summary?: unknown }).summary = {
    total: seed.length,
    populated,
    allowlisted,
    residualTbd,
    mode: ADVISORY ? "advisory" : "blocking",
  };

  return result;
}

if (import.meta.main) {
  const result = run() as ReconResult & {
    summary?: {
      total: number;
      populated: number;
      allowlisted: number;
      residualTbd: number;
      mode: string;
    };
  };
  const s = result.summary;
  if (s) {
    console.log(
      `recon:${PIPELINE} (${s.mode}) — ${s.total} obligation(s): ${s.populated} URN populated, ${s.allowlisted} allowlisted (image-only/unparseable), ${s.residualTbd} residual [TBD] needing mint.`,
    );
  }
  for (const v of result.violations.slice(0, 30)) {
    console.error(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  if (result.violations.length > 30) {
    console.error(`  … and ${result.violations.length - 30} more`);
  }
  // Advisory: always exit 0. When ADVISORY is flipped to false, non-empty
  // residual fails CI.
  process.exit(result.ok ? 0 : 1);
}
