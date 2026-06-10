// platform/regulatory/graph/serves-backfill-artefact.ts
//
// Builds the `Regulations/_adopted-serves-backfill-objective-graph.json`
// artefact from the committed inputs (adopted register seed + the sibling
// per-regulator objective-graph artefacts). Shared between the generator
// script (scripts/generate-adopted-serves-backfill.ts) and the freshness test
// (tests/serves-backfill-derivation.test.ts), so "regenerate and compare"
// is byte-exact by construction.
//
// Authority: D-QUEUE-CLOSEOUT-2026-06-10 (CEO, 2026-06-10), continuing
// WS-REG-INTELLIGENCE-OBJECTIVE-LAYER.
// Author: Mira (Compliance / RegTech engineer, engineering).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  type AdoptedRegisterRow,
  SERVES_BACKFILL_EXTRACTED_AT,
  SERVES_BACKFILL_TARGET_OBJECTIVES,
  type ServesBackfillResult,
  deriveServesBackfill,
} from "./serves-backfill-derivation";

/** Repo-relative path of the generated artefact. */
export const SERVES_BACKFILL_OUT_RELPATH =
  "Regulations/_adopted-serves-backfill-objective-graph.json";

/** Repo-relative path of the adopted register seed (single authored source). */
const REGISTER_SEED_RELPATH = "Regulations/_obligations.seed.json";

interface ArtefactEdgeLike {
  readonly fromId?: string;
  readonly toId?: string;
  readonly edgeType?: string;
}

interface ArtefactNodeLike {
  readonly id?: string;
  readonly nodeType?: string;
}

interface ObjectiveArtefactLike {
  readonly nodes?: readonly ArtefactNodeLike[];
  readonly edges?: readonly ArtefactEdgeLike[];
}

/** Recursively collect `*-objective-graph.json` files under Regulations/, except the backfill output itself. */
function listSiblingObjectiveArtefacts(repoRoot: string): string[] {
  const root = join(repoRoot, "Regulations");
  const results: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (
        entry.endsWith("-objective-graph.json") &&
        entry !== "_adopted-serves-backfill-objective-graph.json"
      ) {
        results.push(full);
      }
    }
  };
  walk(root);
  return results.sort();
}

export interface ServesBackfillBuild {
  readonly artefact: Record<string, unknown>;
  readonly result: ServesBackfillResult;
}

/**
 * Derive the backfill from the committed inputs and assemble the artefact.
 * Throws if any target objective id is missing from the sibling artefacts —
 * a typo'd objective id must fail at generation time, not get silently
 * FK-skipped at fold time (the #1142 defect class).
 */
export function buildAdoptedServesBackfillArtefact(repoRoot: string): ServesBackfillBuild {
  const rows = JSON.parse(
    readFileSync(join(repoRoot, REGISTER_SEED_RELPATH), "utf-8"),
  ) as AdoptedRegisterRow[];

  // Hand-authored coverage + the set of objective ids that actually exist.
  const covered = new Set<string>();
  const objectiveIds = new Set<string>();
  for (const file of listSiblingObjectiveArtefacts(repoRoot)) {
    const doc = JSON.parse(readFileSync(file, "utf-8")) as ObjectiveArtefactLike;
    for (const n of doc.nodes ?? []) {
      if (n.nodeType === "RegulatoryObjective" && n.id) objectiveIds.add(n.id);
    }
    for (const e of doc.edges ?? []) {
      if (e.edgeType === "SERVES" && e.fromId?.startsWith("OBL-ORG-")) covered.add(e.fromId);
    }
  }

  const missingTargets = SERVES_BACKFILL_TARGET_OBJECTIVES.filter((id) => !objectiveIds.has(id));
  if (missingTargets.length > 0) {
    throw new Error(
      `serves-backfill: target objective id(s) not found in any committed objective-graph artefact: ${missingTargets.join(", ")}`,
    );
  }

  const result = deriveServesBackfill(rows, covered);

  const artefact: Record<string, unknown> = {
    instrumentId: "ADOPTED-SERVES-BACKFILL",
    standardName:
      "Adopted-obligation SERVES backfill — rule-based Obligation → RegulatoryObjective derivation",
    ontology:
      "platform/regulatory/graph/types.ts (GraphNode/GraphEdge — RegulatoryObjective layer)",
    extractionMethod: "rule-based",
    provenance: {
      extractionMethod: "rule-based",
      extractorId: "mira:adopted-serves-backfill",
      confidenceScore: 1.0,
      extractedAt: SERVES_BACKFILL_EXTRACTED_AT,
    },
    generatedAt: SERVES_BACKFILL_EXTRACTED_AT,
    source:
      "Regulations/_obligations.seed.json citation/urn source provenance, mapped to the six graphed regulators' leaf objectives (SARB-PA, FSCA, FIC, Information Regulator, IASB, BCBS). Authority: D-QUEUE-CLOSEOUT-2026-06-10 (WS-REG-INTELLIGENCE-OBJECTIVE-LAYER).",
    comment:
      "Rule-based SERVES backfill for the adopted obligation register (OBL-ORG-*). Edges-only artefact: every fromId is an OBL-ORG-* node seeded from the register, every toId an existing RegulatoryObjective node from the per-regulator *-objective-graph.json artefacts (#1150-#1164); the hand-authored SERVES edges in those artefacts stay canonical and are never duplicated here. Derivation rules + confidence tiers: platform/regulatory/graph/serves-backfill-derivation.ts. Obligations whose source does not resolve to a graphed regulator stay UNMAPPED in the `residuals` field (ignored by the importer) with a machine-readable reason class - a residual with a reason beats a fake edge (the #1192 honesty bar). This file is GENERATED by prototype/scripts/generate-adopted-serves-backfill.ts; do not hand-edit. Plane-A reference data, re-derivable, NO events (D-REGULATORY-ARCHITECTURE-TWO-PLANE).",
    nodes: [],
    edges: result.edges,
    residuals: result.residuals,
  };

  return { artefact, result };
}
