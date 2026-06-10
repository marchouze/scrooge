// platform/recon/obligation-policy-coverage.ts
//
// Vera recon: obligation-policy-coverage (ADVISORY).
//
// Asserts that every ADOPTED obligation (register-sourced OBL-ORG-* node in
// the regulatory knowledge graph — not the BCBS knowledge-base plane) has at
// least one implementing bank policy via an IMPLEMENTED_BY edge (Obligation →
// Policy) — the Principle-2 chain hop between the adopted-obligation layer and
// the policy layer. Each uncovered obligation surfaces as a `warn` finding;
// coverage % is grouped by register domain.
//
// v2 (WS-OBLIGATION-POLICY-MAPPING) re-sources this gate from the graph's
// IMPLEMENTED_BY fold. The v1 mechanism (policy `closes:` frontmatter arrays +
// inline `review-status:` register markers) had gone vacuous — zero policies
// carry `closes:` frontmatter and the register's review-status column never
// matched the inline-marker regex, so applicable=0 and the gate asserted
// nothing. The IMPLEMENTED_BY edges are derived at seed time from policy
// frontmatter (`obligations:` list, summary "closes ORG-*") and the register's
// Fulfilment-policy column (see graph/obligation-policy-fold.ts), so this gate
// now measures the real mapping.
//
// Mode: ADVISORY (ok:true regardless) on first landing — the gate never blocks
// CI; closure of the surfaced gaps is a governance-seat workstream (Zara /
// Owen), not a CI gate.
//
// Contexts:
//   - CLI / CI (`bun run recon:obligation-policy-coverage`): seeds a FRESH
//     graph into an isolated tmp DB (truncate-and-rebuild projection,
//     Principle 1) so it is deterministic on a clean runner — same harness as
//     recon:objective-policy-alignment.
//   - Dashboard server (`runObligationPolicyCoverageRecon`): reads the
//     server's live graph DB (the same store the /api/graph endpoints serve);
//     an unseeded graph reports zero coverage with zero findings.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP (named next step); workstream
// WS-OBLIGATION-POLICY-MAPPING; D-REGULATORY-ARCHITECTURE-TWO-PLANE (Plane-A
// derivation); P2-SINGLE-GRAPH-DISCIPLINE. v1 authority retained for lineage:
// D-OBLIGATION-REVIEW-SUBSTRATE; D-KG-GRAPHITI-ADOPT.
//
// Authors:
//   - Mira (Compliance / RegTech engineer, engineering) — v2 graph sourcing
//   - Atlas (Core banking platform architect, engineering) — v1
//   - Vera (Internal audit engineer, engineering — third-line) — v1

import { deriveDomainLetter } from "../regulatory/obligation-linker";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "obligation-policy-coverage";

const CITATIONS = [
  "D-OBLIGATIONS-REGISTER-CLEANUP",
  "D-REGULATORY-ARCHITECTURE-TWO-PLANE",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

export interface DomainCoverage {
  readonly domain: string;
  readonly applicable: number;
  readonly covered: number;
  readonly coveragePct: number;
}

export interface ObligationPolicyCoverageResult extends ReconResult {
  readonly coverageByDomain: DomainCoverage[];
  readonly overallCoveragePct: number;
}

interface AdoptedObligationRow {
  id: string;
  label: string;
  obligationId: string | null;
  domain: string | null;
  covered: number;
}

/**
 * Run the coverage scan against the CURRENT graph DB (no reseed). The
 * dashboard server calls this against its live store; the CLI entry below
 * seeds a fresh hermetic store first. `_repoRoot` is retained for call-site
 * compatibility (the v1 register-walking implementation needed it).
 */
export function runObligationPolicyCoverageRecon(
  _repoRoot?: string,
): ObligationPolicyCoverageResult {
  // Lazy import keeps graph-DB initialisation out of module load (the env-var
  // binding in the CLI entry must run first on a hermetic runner).
  const { getDb } = require("../regulatory/graph/db") as typeof import("../regulatory/graph/db");
  const db = getDb();

  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const rows = db
    .prepare(
      `SELECT n.id, n.label,
              json_extract(n.metadata, '$.obligationId') AS obligationId,
              json_extract(n.metadata, '$.domain') AS domain,
              EXISTS (
                SELECT 1 FROM graph_edges e
                JOIN graph_nodes p ON p.id = e.to_id AND p.node_type = 'Policy'
                WHERE e.from_id = n.id AND e.edge_type = 'IMPLEMENTED_BY'
              ) AS covered
         FROM graph_nodes n
        WHERE n.node_type = 'Obligation' AND n.id LIKE 'OBL-ORG-%'
        ORDER BY n.id`,
    )
    .all() as AdoptedObligationRow[];

  const applicablePerDomain = new Map<string, number>();
  const coveredPerDomain = new Map<string, number>();
  let totalCovered = 0;

  for (const row of rows) {
    // Register rows carry no Domain column (domain lives in section headings);
    // fall back to the ID-prefix derivation shared with the review-substrate.
    const domain =
      row.domain?.trim() || deriveDomainLetter(row.obligationId ?? row.id.replace(/^OBL-/, ""));
    applicablePerDomain.set(domain, (applicablePerDomain.get(domain) ?? 0) + 1);
    if (row.covered) {
      totalCovered++;
      coveredPerDomain.set(domain, (coveredPerDomain.get(domain) ?? 0) + 1);
      continue;
    }
    violations.push({
      subject: row.obligationId ?? row.id,
      message: `adopted obligation "${row.label}" has no IMPLEMENTED_BY policy — implementation-coverage gap`,
      severity: "warn",
    });
  }

  const coverageByDomain: DomainCoverage[] = [...applicablePerDomain.keys()]
    .sort()
    .map((domain) => {
      const applicable = applicablePerDomain.get(domain) ?? 0;
      const covered = coveredPerDomain.get(domain) ?? 0;
      return {
        domain,
        applicable,
        covered,
        coveragePct: applicable === 0 ? 0 : Math.round((covered / applicable) * 1000) / 10,
      };
    });

  const overallCoveragePct =
    rows.length === 0 ? 0 : Math.round((totalCovered / rows.length) * 1000) / 10;

  base.asserted = rows.length;
  base.violations = violations;
  base.ok = true; // advisory
  base.asOf = `adopted=${rows.length} covered=${totalCovered} gaps=${violations.length}`;

  return { ...base, coverageByDomain, overallCoveragePct };
}

// ---------------------------------------------------------------------------
// CLI entry point — hermetic fresh-seed harness (CI determinism)
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  if (!process.env.BANK_GRAPH_DB) {
    process.env.BANK_GRAPH_DB = join(mkdtempSync(join(tmpdir(), "recon-obl-pol-")), "graph.db");
  }
  const { runSeed } = await import("../regulatory/graph/seed-projection");
  await runSeed();

  const result = runObligationPolicyCoverageRecon();
  for (const v of result.violations) {
    console.log(`  ${v.severity.toUpperCase()}  [${v.subject}] ${v.message}`);
  }
  const byDomain = result.coverageByDomain
    .map((d) => `${d.domain}=${d.covered}/${d.applicable}`)
    .join(" ");
  console.log(
    `\nrecon:${PIPELINE} OK (advisory) — ${result.asOf} (${result.overallCoveragePct}% covered; ${byDomain}); citations: ${CITATIONS.join(", ")}`,
  );
  process.exit(0);
}
