// platform/recon/graph-ontology-coverage.ts
//
// Vera recon: graph-ontology-coverage
//
// Checks that:
//   1. Every GraphNodeType value has at least one example node in the seeded
//      graph OR is flagged as "future" (not yet seeded; expected gap).
//   2. Every GraphEdgeType value has at least one edge in the seeded graph OR
//      is flagged as "future".
//   3. Reports coverage as a percentage per dimension (node types, edge types).
//
// Mode: advisory (non-blocking). The graph seed currently covers only the
// Principle-2 chain from the obligations register — most node types and edge
// types will be populated only once LLM extraction runs at scale. The recon
// surfaces the gap as a roadmap item, not a CI blocker.
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { existsSync } from "node:fs";
import { join } from "node:path";

// ── Constants ─────────────────────────────────────────────────────────────

// import.meta.dir = prototype/platform/recon → ../../.. = repo root
const REPO_ROOT = join(import.meta.dir, "../../..");

// Node types that are not yet seeded (expected during build phase).
// Remove from this list as the graph seed grows.
const FUTURE_NODE_TYPES = new Set<string>([
  "Regulator",
  "Jurisdiction",
  "Framework",
  "Term",
  "RegulatedEntity",
  "Activity",
  "RiskCategory",
  "Control",
  "ReportingRequirement",
  "Threshold",
  "EffectivePeriod",
]);

// Edge types that are not yet seeded (expected during build phase).
const FUTURE_EDGE_TYPES = new Set<string>([
  "ISSUED_BY",
  "OPERATES_IN",
  "COMPRISES",
  "PART_OF",
  "APPLIES_TO",
  "APPLIES_TO_ACTIVITY",
  "REQUIRES",
  "REQUIRES_REPORT",
  "ADDRESSES",
  "SETS",
  "DEFINES",
  "USES",
  "CONDITIONAL_ON",
  "SUPERSEDES",
  "AMENDS",
  "EFFECTIVE_DURING",
  "TRANSPOSES",
  "EQUIVALENT_TO",
  "MAPS_TO",
  "CONFLICTS_WITH",
  "CLOSES",
  "REFERENCES",
]);

type FindingLevel = "info" | "warn" | "fail";

interface Finding {
  level: FindingLevel;
  message: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

async function collectSeedNodeTypes(): Promise<Set<string>> {
  const seedPath = join(REPO_ROOT, "prototype/platform/regulatory/graph/seed-projection.ts");
  if (!existsSync(seedPath)) return new Set();

  const text = await Bun.file(seedPath).text();
  // Extract nodeType: "..." strings from the seed projection source
  const nodeTypeMatches = text.matchAll(/nodeType:\s*["']([A-Za-z]+)["']/g);
  const found = new Set<string>();
  for (const m of nodeTypeMatches) {
    if (m[1]) found.add(m[1]);
  }
  return found;
}

async function collectSeedEdgeTypes(): Promise<Set<string>> {
  const seedPath = join(REPO_ROOT, "prototype/platform/regulatory/graph/seed-projection.ts");
  if (!existsSync(seedPath)) return new Set();

  const text = await Bun.file(seedPath).text();
  // Extract edgeType: "..." strings
  const edgeTypeMatches = text.matchAll(/edgeType:\s*["']([A-Z_]+)["']/g);
  const found = new Set<string>();
  for (const m of edgeTypeMatches) {
    if (m[1]) found.add(m[1]);
  }
  return found;
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const findings: Finding[] = [];

  // Import the ontology to get all node/edge type values
  const { GRAPH_NODE_SCHEMA, GRAPH_EDGE_SCHEMA } = await import(
    "../regulatory/graph/ontology-schema"
  );

  const allNodeTypes: string[] = (GRAPH_NODE_SCHEMA.properties.nodeType.enum as string[]).slice();
  const allEdgeTypes: string[] = (GRAPH_EDGE_SCHEMA.properties.edgeType.enum as string[]).slice();

  // Collect seeded types from seed-projection source scan
  const seededNodeTypes = await collectSeedNodeTypes();
  const seededEdgeTypes = await collectSeedEdgeTypes();

  // ── Node type coverage ─────────────────────────────────────────────────

  let nodeCoveredCount = 0;
  for (const nodeType of allNodeTypes) {
    if (seededNodeTypes.has(nodeType)) {
      nodeCoveredCount++;
    } else if (FUTURE_NODE_TYPES.has(nodeType)) {
      findings.push({
        level: "info",
        message: `NodeType ${nodeType}: not yet seeded — flagged as future (expected gap)`,
      });
      nodeCoveredCount++; // counts as "accounted for"
    } else {
      findings.push({
        level: "warn",
        message: `NodeType ${nodeType}: not seeded and not flagged as future — add to seed-projection.ts or to FUTURE_NODE_TYPES`,
      });
    }
  }

  // ── Edge type coverage ─────────────────────────────────────────────────

  let edgeCoveredCount = 0;
  for (const edgeType of allEdgeTypes) {
    if (seededEdgeTypes.has(edgeType)) {
      edgeCoveredCount++;
    } else if (FUTURE_EDGE_TYPES.has(edgeType)) {
      findings.push({
        level: "info",
        message: `EdgeType ${edgeType}: not yet seeded — flagged as future (expected gap)`,
      });
      edgeCoveredCount++; // counts as "accounted for"
    } else {
      findings.push({
        level: "warn",
        message: `EdgeType ${edgeType}: not seeded and not flagged as future — add to seed-projection.ts or to FUTURE_EDGE_TYPES`,
      });
    }
  }

  // ── Coverage summary ───────────────────────────────────────────────────

  const nodePct = Math.round((nodeCoveredCount / allNodeTypes.length) * 100);
  const edgePct = Math.round((edgeCoveredCount / allEdgeTypes.length) * 100);

  console.log(
    `recon:graph-ontology-coverage — node types ${nodePct}% (${nodeCoveredCount}/${allNodeTypes.length}) | edge types ${edgePct}% (${edgeCoveredCount}/${allEdgeTypes.length})`,
  );

  // ── Output findings ────────────────────────────────────────────────────

  const fails = findings.filter((f) => f.level === "fail");
  const warns = findings.filter((f) => f.level === "warn");
  const infos = findings.filter((f) => f.level === "info");

  for (const f of infos) {
    console.log(`  info  ${f.message}`);
  }
  for (const f of warns) {
    console.warn(`  warn  ${f.message}`);
  }
  for (const f of fails) {
    console.error(`  FAIL  ${f.message}`);
  }

  if (fails.length > 0) {
    console.error(`\nrecon:graph-ontology-coverage FAILED — ${fails.length} failure(s)`);
    process.exit(1);
  }

  if (warns.length > 0) {
    console.warn(
      `\nrecon:graph-ontology-coverage ADVISORY — ${warns.length} warning(s); ${infos.length} info(s). Non-blocking.`,
    );
  } else {
    console.log("\nrecon:graph-ontology-coverage OK — all types accounted for.");
  }
}

main().catch((err) => {
  console.error("recon:graph-ontology-coverage error:", err);
  process.exit(1);
});
