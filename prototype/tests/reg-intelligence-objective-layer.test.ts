// tests/reg-intelligence-objective-layer.test.ts
//
// Tests for the regulatory-intelligence objective/mandate layer
// (D-REGULATORY-INTELLIGENCE-OBJECTIVE-LAYER) — the SARB-PA pilot.
//
// Covers:
//   - graph:seed ingests the 5 RegulatoryObjective nodes + PURSUES/REFINES/
//     SERVES/ALIGNS_TO edges with no FK failures.
//   - traceObjective() returns mandate lineage + regulator + serving obligations
//     + aligned policies.
//   - traceObligationChain() now carries the objectives + alignedPolicies axis.
//   - findObjectiveCoverageGaps() reports the un-aligned objectives.
//   - the three advisory recon gates are GREEN (ok:true) for SARB-PA and emit
//     advisory findings for the not-yet-backfilled regulators/obligations.
//
// The gates seed a FRESH graph into an isolated tmp DB, so this test binds the
// graph DB to a tmp path BEFORE importing the db-backed modules.
//
// Author: Mira (Regulatory-Reporting / Obligations Engineer, regulatory).

import { beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Isolate the graph DB BEFORE importing db-backed modules (BANK_GRAPH_DB is read
// at module init by the lazy singleton).
const tmpGraph = join(mkdtempSync(join(tmpdir(), "obj-layer-")), "graph.db");
process.env.BANK_GRAPH_DB = tmpGraph;

import { getDb } from "../platform/regulatory/graph/db";
import {
  findObjectiveCoverageGaps,
  traceObjective,
  traceObligationChain,
} from "../platform/regulatory/graph/query";
import { runSeed } from "../platform/regulatory/graph/seed-projection";

beforeAll(async () => {
  await runSeed();
});

describe("objective layer — graph ingestion", () => {
  test("seeds the SARB-PA pilot + FSCA + FIC + BCBS RegulatoryObjective nodes with correct levels", () => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, json_extract(metadata, '$.objectiveLevel') AS lvl
           FROM graph_nodes WHERE node_type = 'RegulatoryObjective' ORDER BY id`,
      )
      .all() as Array<{ id: string; lvl: string }>;
    // SARB-PA pilot (5) + FSCA stack (5) + FIC stack (5) + BCBS stack (6) = 21
    // objective nodes (D-FSCA-REGULATORY-INTELLIGENCE-INGESTION;
    // D-FIC-REGULATORY-INTELLIGENCE-INGESTION; D-BCBS-OBJECTIVE-LAYER-INGESTION).
    expect(rows.length).toBe(21);
    const byId = new Map(rows.map((r) => [r.id, r.lvl]));
    // SARB-PA pilot
    expect(byId.get("OBJ-SARB-PA-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-SARB-PA-SAFETY-SOUNDNESS")).toBe("objective");
    expect(byId.get("OBJ-SARB-PA-MI-SOUNDNESS")).toBe("objective");
    expect(byId.get("OBJ-SARB-PA-CUSTOMER-PROTECTION")).toBe("objective");
    expect(byId.get("OBJ-SARB-PA-FINANCIAL-STABILITY")).toBe("objective");
    // FSCA stack
    expect(byId.get("OBJ-FSCA-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-FSCA-FAIR-TREATMENT")).toBe("objective");
    expect(byId.get("OBJ-FSCA-MARKET-INTEGRITY")).toBe("objective");
    expect(byId.get("OBJ-FSCA-FINANCIAL-INCLUSION")).toBe("objective");
    expect(byId.get("OBJ-FSCA-FINANCIAL-EDUCATION")).toBe("objective");
    // FIC stack (combat ML/TF/PF — D-FIC-REGULATORY-INTELLIGENCE-INGESTION)
    expect(byId.get("OBJ-FIC-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-FIC-FINANCIAL-INTELLIGENCE")).toBe("objective");
    expect(byId.get("OBJ-FIC-CDD-INTEGRITY")).toBe("objective");
    expect(byId.get("OBJ-FIC-TARGETED-SANCTIONS")).toBe("objective");
    expect(byId.get("OBJ-FIC-AML-SUPERVISION")).toBe("objective");
    // BCBS stack (Basel Charter mandate — D-BCBS-OBJECTIVE-LAYER-INGESTION)
    expect(byId.get("OBJ-BCBS-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-BCBS-CAPITAL-ADEQUACY")).toBe("objective");
    expect(byId.get("OBJ-BCBS-LIQUIDITY-RESILIENCE")).toBe("objective");
    expect(byId.get("OBJ-BCBS-RISK-CAPTURE")).toBe("objective");
    expect(byId.get("OBJ-BCBS-MARKET-DISCIPLINE")).toBe("objective");
    expect(byId.get("OBJ-BCBS-SUPERVISORY-REVIEW")).toBe("objective");
  });

  test("seeds PURSUES / REFINES / SERVES / ALIGNS_TO edges", () => {
    const db = getDb();
    const count = (edgeType: string): number =>
      (
        db.prepare("SELECT COUNT(*) AS n FROM graph_edges WHERE edge_type = ?").get(edgeType) as {
          n: number;
        }
      ).n;
    // 5 (REG-SARB-PA) + 5 (REG-FSCA) + 5 (REG-FIC) + 6 (REG-BCBS, mandate+5) objectives pursued.
    expect(count("PURSUES")).toBe(21);
    // 4 (PA) + 4 (FSCA) + 4 (FIC) + 5 (BCBS) objectives refine their mandate.
    expect(count("REFINES")).toBe(17);
    // PA prudential (≥9) + FSCA conduct/markets (30) + FIC AML/CFT (19) +
    // BCBS (1,921 in a clean seed — one SERVES per existing OBL-BCBS-* obligation
    // from the 14 obligation-graph JSONs) obligations serve their objective.
    expect(count("SERVES")).toBeGreaterThanOrEqual(9 + 30 + 19 + 1921);
    // PA capital + liquidity policies (≥2) + FSCA conduct/markets policies (8) +
    // FIC AML/sanctions policies (6) + BCBS prudential policies (12).
    expect(count("ALIGNS_TO")).toBeGreaterThanOrEqual(2 + 8 + 6 + 12);
  });

  test("every objective-layer edge resolves to existing endpoint nodes (no orphans)", () => {
    const db = getDb();
    const dangling = db
      .prepare(
        `SELECT e.id FROM graph_edges e
          WHERE e.edge_type IN ('PURSUES','REFINES','SERVES','ALIGNS_TO')
            AND (NOT EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = e.from_id)
              OR NOT EXISTS (SELECT 1 FROM graph_nodes n WHERE n.id = e.to_id))`,
      )
      .all() as Array<{ id: string }>;
    expect(dangling.length).toBe(0);
  });
});

describe("objective layer — queries", () => {
  test("traceObjective returns mandate lineage, regulator, serving obligations, aligned policies", () => {
    const t = traceObjective("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(t).not.toBeNull();
    expect(t?.refinesInto.map((n) => n.id)).toContain("OBJ-SARB-PA-MANDATE");
    expect(t?.regulators.map((n) => n.id)).toContain("REG-SARB-PA");
    expect(t?.servingObligations.length ?? 0).toBeGreaterThanOrEqual(9);
    const aligned = t?.alignedPolicies.map((n) => n.id) ?? [];
    expect(aligned).toContain("POL-capital-management-policy");
    expect(aligned).toContain("POL-liquidity-risk-management-policy");
  });

  test("traceObjective returns null for a non-objective id", () => {
    expect(traceObjective("OBL-ORG-PR-01")).toBeNull();
    expect(traceObjective("OBJ-DOES-NOT-EXIST")).toBeNull();
  });

  test("traceObligationChain carries the objectives + alignedPolicies axis", () => {
    const chain = traceObligationChain("ORG-PR-01");
    expect(chain).not.toBeNull();
    expect(chain?.objectives.map((o) => o.id)).toContain("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(chain?.alignedPolicies.length ?? 0).toBeGreaterThanOrEqual(1);
  });

  test("findObjectiveCoverageGaps reports the un-aligned objectives", () => {
    const gaps = findObjectiveCoverageGaps().map((g) => g.id);
    // safety-soundness + financial-stability ARE aligned (not gaps);
    // mandate + MI-soundness + customer-protection are not.
    expect(gaps).toContain("OBJ-SARB-PA-MANDATE");
    expect(gaps).toContain("OBJ-SARB-PA-MI-SOUNDNESS");
    expect(gaps).toContain("OBJ-SARB-PA-CUSTOMER-PROTECTION");
    expect(gaps).not.toContain("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(gaps).not.toContain("OBJ-SARB-PA-FINANCIAL-STABILITY");
  });
});

describe("objective layer — advisory recon gates", () => {
  test("regulator-mandate-coverage: ok=true, SARB-PA covered, other regulators advisory", async () => {
    const { run } = await import("../platform/recon/regulator-mandate-coverage");
    const result = await run();
    expect(result.ok).toBe(true);
    expect(result.asserted).toBeGreaterThanOrEqual(1);
    // SARB-PA is covered → it must NOT appear in the violations.
    expect(result.violations.map((v) => v.subject)).not.toContain("REG-SARB-PA");
    // Other in-scope regulators are not yet backfilled → advisory findings exist.
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.every((v) => v.severity !== "fail")).toBe(true);
  });

  test("requirement-objective-linkage: ok=true, PA obligations covered, rest advisory", async () => {
    const { run } = await import("../platform/recon/requirement-objective-linkage");
    const result = await run();
    expect(result.ok).toBe(true);
    // The PA prudential obligations carry SERVES → not in the violation set.
    const subjects = result.violations.map((v) => v.subject);
    expect(subjects).not.toContain("OBL-ORG-PR-01");
    expect(subjects).not.toContain("OBL-ORG-PR-06");
    // Other adopted obligations are not yet linked → advisory findings exist.
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.every((v) => v.severity !== "fail")).toBe(true);
  });

  test("objective-policy-alignment: ok=true, aligned objectives green, gaps advisory", async () => {
    const { run } = await import("../platform/recon/objective-policy-alignment");
    const result = await run();
    expect(result.ok).toBe(true);
    // 5 SARB-PA pilot + 5 FSCA + 5 FIC + 6 BCBS objectives asserted.
    expect(result.asserted).toBe(21);
    const subjects = result.violations.map((v) => v.subject);
    // The aligned objectives are NOT flagged.
    expect(subjects).not.toContain("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(subjects).not.toContain("OBJ-SARB-PA-FINANCIAL-STABILITY");
    // FSCA fair-treatment + market-integrity are aligned (conduct + markets policies).
    expect(subjects).not.toContain("OBJ-FSCA-FAIR-TREATMENT");
    expect(subjects).not.toContain("OBJ-FSCA-MARKET-INTEGRITY");
    // FIC cdd-integrity + targeted-sanctions + aml-supervision are aligned (AML/sanctions policies).
    expect(subjects).not.toContain("OBJ-FIC-CDD-INTEGRITY");
    expect(subjects).not.toContain("OBJ-FIC-TARGETED-SANCTIONS");
    expect(subjects).not.toContain("OBJ-FIC-AML-SUPERVISION");
    // BCBS objectives carrying ALIGNS_TO from SA prudential policies are aligned.
    expect(subjects).not.toContain("OBJ-BCBS-CAPITAL-ADEQUACY");
    expect(subjects).not.toContain("OBJ-BCBS-LIQUIDITY-RESILIENCE");
    expect(subjects).not.toContain("OBJ-BCBS-RISK-CAPTURE");
    expect(subjects).not.toContain("OBJ-BCBS-MARKET-DISCIPLINE");
    expect(subjects).not.toContain("OBJ-BCBS-SUPERVISORY-REVIEW");
    // The un-aligned objectives ARE flagged (advisory).
    expect(subjects).toContain("OBJ-SARB-PA-MANDATE");
    expect(result.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
