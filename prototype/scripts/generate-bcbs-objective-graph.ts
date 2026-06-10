// prototype/scripts/generate-bcbs-objective-graph.ts
//
// Generator for `Regulations/BCBS/bcbs-objective-graph.json` — the objective /
// mandate layer over the EXISTING BCBS obligation nodes (`OBL-BCBS-<STD>-s<para>`,
// ~1,927 nodes seeded by importBcbsObligationGraphs). This script does NOT
// re-ingest BCBS instruments or obligations; it only authors:
//   - 1 mandate + 5 objective RegulatoryObjective nodes,
//   - PURSUES (REG-BCBS → each objective), REFINES (objective → mandate),
//   - SERVES (every existing OBL-BCBS-* obligation → its standard's objective),
//   - ALIGNS_TO (SA prudential POL-* policies → the relevant objectives).
//
// The committed `bcbs-objective-graph.json` is the source of truth that
// `graph:seed` (importObjectiveArtefacts) reads. Re-run this script whenever the
// BCBS obligation set changes; it reads the obligation ids straight from the
// seeded graph DB (canonical) so the SERVES set always matches what is in-graph.
//
// Authority: D-BCBS-OBJECTIVE-LAYER-INGESTION (CEO session-delegation 2026-06-10).
// Author: Mira (Compliance / RegTech engineer, regulatory). Accountable
// prudential seat: Helena (Chief Risk Officer, governance).
//
// Usage (from prototype/):  bun run scripts/generate-bcbs-objective-graph.ts

import { Database } from "bun:sqlite";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const NOW = "2026-06-10T00:00:00Z";
const REPO_ROOT = join(import.meta.dir, "..", "..");
const OUT = join(REPO_ROOT, "Regulations", "BCBS", "bcbs-objective-graph.json");

const dbPath =
  process.env.BANK_GRAPH_DB ?? join(process.env.HOME ?? "", ".local", "share", "bank", "graph.db");

// Standard-family → objective partition (exhaustive; D-BCBS-OBJECTIVE-LAYER-INGESTION).
const STANDARD_TO_OBJECTIVE: Record<string, string> = {
  CAP: "OBJ-BCBS-CAPITAL-ADEQUACY",
  RBC: "OBJ-BCBS-CAPITAL-ADEQUACY",
  LEV: "OBJ-BCBS-CAPITAL-ADEQUACY",
  LCR: "OBJ-BCBS-LIQUIDITY-RESILIENCE",
  NSF: "OBJ-BCBS-LIQUIDITY-RESILIENCE",
  CRE: "OBJ-BCBS-RISK-CAPTURE",
  MAR: "OBJ-BCBS-RISK-CAPTURE",
  OPE: "OBJ-BCBS-RISK-CAPTURE",
  MGN: "OBJ-BCBS-RISK-CAPTURE",
  LEX: "OBJ-BCBS-RISK-CAPTURE",
  DIS: "OBJ-BCBS-MARKET-DISCIPLINE",
  SRP: "OBJ-BCBS-SUPERVISORY-REVIEW",
  SCO: "OBJ-BCBS-SUPERVISORY-REVIEW",
  BCP: "OBJ-BCBS-SUPERVISORY-REVIEW",
};

// Short objective code suffix for SERVES edge ids (keeps ids readable + unique).
const OBJ_SUFFIX: Record<string, string> = {
  "OBJ-BCBS-CAPITAL-ADEQUACY": "CA",
  "OBJ-BCBS-LIQUIDITY-RESILIENCE": "LR",
  "OBJ-BCBS-RISK-CAPTURE": "RC",
  "OBJ-BCBS-MARKET-DISCIPLINE": "MD",
  "OBJ-BCBS-SUPERVISORY-REVIEW": "SR",
};

const prov = {
  extractionMethod: "rule-based" as const,
  confidenceScore: 1.0,
  extractedAt: NOW,
};

function objNode(id: string, label: string, text: string, level: string, citation: string) {
  return {
    id,
    nodeType: "RegulatoryObjective",
    label,
    objectiveText: text,
    objectiveLevel: level,
    sourceCitation: citation,
  };
}

function edge(id: string, fromId: string, toId: string, edgeType: string, sourceProvision: string) {
  return { id, fromId, toId, edgeType, ...prov, sourceProvision };
}

const CHARTER = "urn:reg:bcbs:charter";

// ---- Objective nodes (1 mandate + 5 objectives) ----
const nodes = [
  objNode(
    "OBJ-BCBS-MANDATE",
    "Mandate of the Basel Committee on Banking Supervision",
    "Strengthen the regulation, supervision and practices of banks worldwide, with the purpose of enhancing financial stability.",
    "mandate",
    CHARTER,
  ),
  objNode(
    "OBJ-BCBS-CAPITAL-ADEQUACY",
    "Capital adequacy",
    "Ensure banks hold sufficient, high-quality regulatory capital — including a non-risk-based leverage backstop — to absorb losses on a going- and gone-concern basis.",
    "objective",
    CHARTER,
  ),
  objNode(
    "OBJ-BCBS-LIQUIDITY-RESILIENCE",
    "Liquidity resilience",
    "Ensure banks maintain an adequate stock of high-quality liquid assets and a stable funding profile to survive short-term liquidity stress and structural funding mismatch.",
    "objective",
    CHARTER,
  ),
  objNode(
    "OBJ-BCBS-RISK-CAPTURE",
    "Comprehensive risk capture",
    "Ensure the regulatory framework comprehensively captures and measures credit, market, operational, counterparty-credit (margin) and large-exposure / concentration risks in banks' risk-weighted assets.",
    "objective",
    CHARTER,
  ),
  objNode(
    "OBJ-BCBS-MARKET-DISCIPLINE",
    "Market discipline through disclosure",
    "Promote market discipline by requiring consistent, comparable public disclosure of banks' risk profile, capital adequacy and risk-management practices (Pillar 3).",
    "objective",
    CHARTER,
  ),
  objNode(
    "OBJ-BCBS-SUPERVISORY-REVIEW",
    "Effective supervisory review and sound practices",
    "Promote effective supervisory review of banks' capital adequacy and internal processes, and consistent cross-jurisdictional application through the scope, core-principles and supervisory-review standards.",
    "objective",
    CHARTER,
  ),
];

const OBJECTIVES = [
  "OBJ-BCBS-CAPITAL-ADEQUACY",
  "OBJ-BCBS-LIQUIDITY-RESILIENCE",
  "OBJ-BCBS-RISK-CAPTURE",
  "OBJ-BCBS-MARKET-DISCIPLINE",
  "OBJ-BCBS-SUPERVISORY-REVIEW",
];

const edges: ReturnType<typeof edge>[] = [];

// PURSUES: REG-BCBS → mandate + each objective.
edges.push(edge("OBJ-BCBS-PURSUES-MANDATE", "REG-BCBS", "OBJ-BCBS-MANDATE", "PURSUES", CHARTER));
for (const o of OBJECTIVES) {
  edges.push(edge(`OBJ-BCBS-PURSUES-${OBJ_SUFFIX[o]}`, "REG-BCBS", o, "PURSUES", CHARTER));
}

// REFINES: each objective → mandate.
for (const o of OBJECTIVES) {
  edges.push(edge(`OBJ-BCBS-REFINES-${OBJ_SUFFIX[o]}`, o, "OBJ-BCBS-MANDATE", "REFINES", CHARTER));
}

// ---- SERVES: every existing OBL-BCBS-* obligation → its standard's objective ----
const db = new Database(dbPath, { readonly: true });
const rows = db
  .query(
    "SELECT id FROM graph_nodes WHERE node_type='Obligation' AND id LIKE 'OBL-BCBS-%' ORDER BY id",
  )
  .all() as { id: string }[];
db.close();

const perObjective: Record<string, number> = {};
const unmapped: string[] = [];
for (const { id } of rows) {
  const m = id.match(/^OBL-BCBS-([A-Z]+)-s/);
  if (!m) {
    unmapped.push(id);
    continue;
  }
  const std = m[1];
  const objective = STANDARD_TO_OBJECTIVE[std];
  if (!objective) {
    unmapped.push(id);
    continue;
  }
  edges.push(
    edge(`OBJ-BCBS-SERVES-${id}-${OBJ_SUFFIX[objective]}`, id, objective, "SERVES", CHARTER),
  );
  perObjective[objective] = (perObjective[objective] ?? 0) + 1;
}

if (unmapped.length > 0) {
  console.error(`ERROR: ${unmapped.length} obligation(s) with no standard mapping:`);
  for (const u of unmapped.slice(0, 20)) console.error(`  ${u}`);
  process.exit(1);
}

// ---- ALIGNS_TO: SA prudential POL-* policies → relevant BCBS objectives ----
// Only POL-* ids confirmed present in the seeded graph (0-skipped at ingest).
const ALIGNS: [string, string][] = [
  // Capital adequacy
  ["POL-capital-management-policy", "OBJ-BCBS-CAPITAL-ADEQUACY"],
  // Liquidity resilience
  ["POL-liquidity-risk-management-policy", "OBJ-BCBS-LIQUIDITY-RESILIENCE"],
  // Risk capture
  ["POL-credit-risk-policy", "OBJ-BCBS-RISK-CAPTURE"],
  ["POL-counterparty-credit-risk-policy", "OBJ-BCBS-RISK-CAPTURE"],
  ["POL-market-risk-policy", "OBJ-BCBS-RISK-CAPTURE"],
  ["POL-operational-risk-policy", "OBJ-BCBS-RISK-CAPTURE"],
  ["POL-COLLATERAL-MANAGEMENT-V1", "OBJ-BCBS-RISK-CAPTURE"],
  ["POL-MARGIN-POLICY-V1", "OBJ-BCBS-RISK-CAPTURE"],
  // Market discipline
  ["POL-pillar-3-disclosure-policy", "OBJ-BCBS-MARKET-DISCIPLINE"],
  // Supervisory review and sound practices
  ["POL-operational-resilience-policy", "OBJ-BCBS-SUPERVISORY-REVIEW"],
  ["POL-recovery-resolution-planning-policy", "OBJ-BCBS-SUPERVISORY-REVIEW"],
  ["POL-irrbb-policy", "OBJ-BCBS-SUPERVISORY-REVIEW"],
];
let alignIdx = 0;
for (const [pol, objective] of ALIGNS) {
  alignIdx++;
  edges.push(
    edge(`OBJ-BCBS-ALIGNS_TO-${alignIdx}-${OBJ_SUFFIX[objective]}`, pol, objective, "ALIGNS_TO", CHARTER),
  );
}

const artefact = {
  instrumentId: "BCBS-OBJECTIVES",
  standardName: "Basel Committee on Banking Supervision objective/mandate layer (BCBS Charter)",
  ontology: "platform/regulatory/graph/types.ts (GraphNode/GraphEdge — RegulatoryObjective layer)",
  extractionMethod: "rule-based",
  provenance: {
    extractionMethod: "rule-based",
    extractorId: "mira:bcbs-objective-graph",
    confidenceScore: 1.0,
    extractedAt: NOW,
  },
  generatedAt: NOW,
  source:
    "Basel Committee on Banking Supervision Charter (mandate: 'strengthen the regulation, supervision and practices of banks worldwide, with the purpose of enhancing financial stability'). Authority: D-BCBS-OBJECTIVE-LAYER-INGESTION.",
  comment:
    "Regulatory-intelligence objective/mandate layer over the EXISTING BCBS obligation nodes (OBL-BCBS-<STD>-s<para>, ~1,927, seeded by importBcbsObligationGraphs). Objective-layer-only: NO re-ingestion of BCBS instruments/obligations. The objective nodes (the 'why' a Basel requirement exists) are Plane-A reference data, re-derivable from the Committee's own Charter mandate, NOT events (D-REGULATORY-ARCHITECTURE-TWO-PLANE). PURSUES/REFINES/SERVES/ALIGNS_TO edges target EXISTING graph nodes: Regulator REG-BCBS (seed-projection.ts Step 1); Obligation nodes OBL-BCBS-* (importBcbsObligationGraphs); Policy nodes POL-* (Step 9, from Policies/*.md frontmatter). SERVES partitions the 14 Basel standard families across 5 objectives: capital-adequacy {CAP,RBC,LEV}; liquidity-resilience {LCR,NSF}; risk-capture {CRE,MAR,OPE,MGN,LEX}; market-discipline {DIS}; supervisory-review {SRP,SCO,BCP}. One SERVES edge per existing OBL-BCBS-* obligation, keyed by its standard. ALIGNS_TO wires the SA prudential policies that implement the Basel transpositions to the matching objective. This file is GENERATED by prototype/scripts/generate-bcbs-objective-graph.ts (reads obligation ids straight from the seeded graph DB so SERVES always matches in-graph); do not hand-edit. Every SERVES/ALIGNS_TO target id was confirmed present in the seeded graph.",
  nodes,
  edges,
};

writeFileSync(OUT, `${JSON.stringify(artefact, null, 2)}\n`);

console.log(`Wrote ${OUT}`);
console.log(`  objective nodes: ${nodes.length}`);
console.log(`  edges total:     ${edges.length}`);
console.log(`  SERVES total:    ${rows.length}`);
console.log("  SERVES per objective:");
for (const o of OBJECTIVES) console.log(`    ${o}: ${perObjective[o] ?? 0}`);
console.log(`  ALIGNS_TO:       ${ALIGNS.length}`);
