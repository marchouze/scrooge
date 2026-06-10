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
//   - findObjectiveCoverageGaps() reports the un-aligned objectives, with the
//     mandate-level REFINES roll-up (2026-06-10 tail-fill).
//   - the recon gates: regulator-mandate-coverage is ENFORCING (all six
//     in-scope regulators covered); requirement-objective-linkage and
//     objective-policy-alignment remain advisory with their documented
//     residuals.
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
    // SARB-PA pilot (5) + FSCA stack (5) + FIC stack (5) + BCBS stack (6) +
    // IASB stack (4) = 25 objective nodes (D-FSCA-REGULATORY-INTELLIGENCE-INGESTION;
    // D-FIC-REGULATORY-INTELLIGENCE-INGESTION; D-BCBS-OBJECTIVE-LAYER-INGESTION;
    // D-IASB-REGULATORY-INTELLIGENCE-INGESTION) + INFOREG stack (4 —
    // D-INFOREG-REGULATORY-INTELLIGENCE-INGESTION) = 29 objective nodes.
    expect(rows.length).toBe(29);
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
    // IASB stack (IFRS Foundation Constitution mandate — D-IASB-REGULATORY-INTELLIGENCE-INGESTION)
    expect(byId.get("OBJ-IASB-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-IASB-TRANSPARENCY")).toBe("objective");
    expect(byId.get("OBJ-IASB-ACCOUNTABILITY")).toBe("objective");
    expect(byId.get("OBJ-IASB-MARKET-EFFICIENCY")).toBe("objective");
    // INFOREG stack (Information Regulator mandate — POPIA s.39 read with PAIA;
    // D-INFOREG-REGULATORY-INTELLIGENCE-INGESTION)
    expect(byId.get("OBJ-INFOREG-MANDATE")).toBe("mandate");
    expect(byId.get("OBJ-INFOREG-DATA-PROTECTION")).toBe("objective");
    expect(byId.get("OBJ-INFOREG-ACCESS-TO-INFORMATION")).toBe("objective");
    expect(byId.get("OBJ-INFOREG-MONITORING-ENFORCEMENT")).toBe("objective");
  });

  test("seeds PURSUES / REFINES / SERVES / ALIGNS_TO edges", () => {
    const db = getDb();
    const count = (edgeType: string): number =>
      (
        db.prepare("SELECT COUNT(*) AS n FROM graph_edges WHERE edge_type = ?").get(edgeType) as {
          n: number;
        }
      ).n;
    // 5 (REG-SARB-PA) + 5 (REG-FSCA) + 5 (REG-FIC) + 6 (REG-BCBS, mandate+5) +
    // 4 (REG-IASB, mandate+3) + 4 (REG-INFO-REG, mandate+3) objectives pursued.
    expect(count("PURSUES")).toBe(29);
    // 4 (PA) + 4 (FSCA) + 4 (FIC) + 5 (BCBS) + 3 (IASB) + 3 (INFOREG) objectives
    // refine their mandate.
    expect(count("REFINES")).toBe(23);
    // PA prudential (≥9) + FSCA conduct/markets (30) + FIC AML/CFT (19) +
    // BCBS (1,921 in a clean seed — one SERVES per existing OBL-BCBS-* obligation
    // from the 14 obligation-graph JSONs) + IASB accounting (15 — 12 AC obligations
    // to transparency/accountability + IFRS 10 to accountability + IFRS 13/IFRS 7 to
    // market-efficiency) + INFOREG (20 — POPIA processing-condition + EL-03/RM-04 →
    // data-protection, PAIA manual/request → access-to-information, breach/IO/
    // prior-auth → monitoring-enforcement) obligations serve their objective.
    expect(count("SERVES")).toBeGreaterThanOrEqual(9 + 30 + 19 + 1921 + 15 + 20);
    // PA capital + liquidity + RRP + payments policies (≥4) + FSCA conduct/markets
    // policies (8) + FIC AML/sanctions policies (7) + BCBS prudential policies (12)
    // + IASB accounting/disclosure/tax/audit policies (8) + INFOREG privacy/infosec/
    // PAIA/incident-response policies (5) — incl. the 7 tail-fill edges of
    // 2026-06-10 (WS-REG-INTELLIGENCE-OBJECTIVE-LAYER).
    expect(count("ALIGNS_TO")).toBeGreaterThanOrEqual(4 + 8 + 7 + 12 + 8 + 5);
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

  test("findObjectiveCoverageGaps reports only the genuine residual gaps after the tail-fill", () => {
    const gaps = findObjectiveCoverageGaps().map((g) => g.id);
    // Tail-filled 2026-06-10: MI-soundness (payments-settlement policy) and
    // customer-protection (recovery-resolution-planning policy) are now aligned;
    // every mandate-level objective is covered transitively via the REFINES
    // roll-up (each has at least one aligned refining objective).
    expect(gaps).not.toContain("OBJ-SARB-PA-MANDATE");
    expect(gaps).not.toContain("OBJ-SARB-PA-MI-SOUNDNESS");
    expect(gaps).not.toContain("OBJ-SARB-PA-CUSTOMER-PROTECTION");
    expect(gaps).not.toContain("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(gaps).not.toContain("OBJ-SARB-PA-FINANCIAL-STABILITY");
    expect(gaps).not.toContain("OBJ-BCBS-MANDATE");
    expect(gaps).not.toContain("OBJ-FIC-MANDATE");
    expect(gaps).not.toContain("OBJ-FIC-FINANCIAL-INTELLIGENCE");
    expect(gaps).not.toContain("OBJ-IASB-MANDATE");
    expect(gaps).not.toContain("OBJ-IASB-ACCOUNTABILITY");
    expect(gaps).not.toContain("OBJ-INFOREG-MANDATE");
    expect(gaps).not.toContain("OBJ-INFOREG-MONITORING-ENFORCEMENT");
    expect(gaps).not.toContain("OBJ-FSCA-MANDATE");
    // The two genuine residuals: FSCA-directed statutory functions (FSR Act
    // s.57(a)) no build-phase bank policy serves — no customers/products until
    // licence-day; a fabricated edge would be worse than the visible gap.
    expect(gaps).toContain("OBJ-FSCA-FINANCIAL-INCLUSION");
    expect(gaps).toContain("OBJ-FSCA-FINANCIAL-EDUCATION");
    expect(gaps.length).toBe(2);
  });

  test("mandate roll-up: a mandate with NO aligned refining objective is still a gap (synthetic)", () => {
    const db = getDb();
    const now = "2026-06-10T00:00:00Z";
    const insNode = db.prepare(
      `INSERT INTO graph_nodes (id, node_type, label, metadata) VALUES (?, 'RegulatoryObjective', ?, ?)`,
    );
    const insEdge = db.prepare(
      `INSERT INTO graph_edges (id, from_id, to_id, edge_type, extraction_method, confidence_score, extracted_at)
       VALUES (?, ?, ?, 'REFINES', 'rule-based', 1.0, ?)`,
    );
    try {
      // Synthetic mandate whose only refining objective is itself un-aligned:
      // BOTH must surface as gaps (the roll-up never hides a missing leaf).
      insNode.run("OBJ-TEST-MANDATE", "Synthetic mandate", '{"objectiveLevel":"mandate"}');
      insNode.run("OBJ-TEST-CHILD", "Synthetic child", '{"objectiveLevel":"objective"}');
      insEdge.run("E-TEST-REFINES", "OBJ-TEST-CHILD", "OBJ-TEST-MANDATE", now);
      const gaps = findObjectiveCoverageGaps().map((g) => g.id);
      expect(gaps).toContain("OBJ-TEST-MANDATE");
      expect(gaps).toContain("OBJ-TEST-CHILD");
      // Align the child to an existing Policy node → the child leaves the gap
      // set AND the mandate is covered transitively.
      db.prepare(
        `INSERT INTO graph_edges (id, from_id, to_id, edge_type, extraction_method, confidence_score, extracted_at)
         VALUES ('E-TEST-ALIGNS', 'POL-capital-management-policy', 'OBJ-TEST-CHILD', 'ALIGNS_TO', 'rule-based', 1.0, ?)`,
      ).run(now);
      const gapsAfter = findObjectiveCoverageGaps().map((g) => g.id);
      expect(gapsAfter).not.toContain("OBJ-TEST-CHILD");
      expect(gapsAfter).not.toContain("OBJ-TEST-MANDATE");
      // A non-mandate objective never rolls up: the synthetic child being
      // aligned says nothing about OTHER un-aligned plain objectives.
      expect(gapsAfter).toContain("OBJ-FSCA-FINANCIAL-INCLUSION");
    } finally {
      // Clean up the synthetic rows so later tests (incl. the re-seeding recon
      // gates) see the production graph only.
      db.prepare("DELETE FROM graph_edges WHERE id IN ('E-TEST-REFINES','E-TEST-ALIGNS')").run();
      db.prepare("DELETE FROM graph_nodes WHERE id IN ('OBJ-TEST-MANDATE','OBJ-TEST-CHILD')").run();
    }
  });
});

describe("objective layer — recon gates", () => {
  test("regulator-mandate-coverage (ENFORCING): ok=true, all six in-scope regulators covered", async () => {
    const { run } = await import("../platform/recon/regulator-mandate-coverage");
    const result = await run();
    // Promoted to enforcing on the 2026-06-10 tail-fill: ok is now derived
    // from the violation count, so any uncovered in-scope regulator blocks CI.
    expect(result.ok).toBe(true);
    expect(result.asserted).toBeGreaterThanOrEqual(1);
    // SARB-PA is covered → it must NOT appear in the violations.
    expect(result.violations.map((v) => v.subject)).not.toContain("REG-SARB-PA");
    // The Information Regulator was the sixth and last regulator to be backfilled
    // (D-INFOREG-REGULATORY-INTELLIGENCE-INGESTION) → it must NOT appear either.
    expect(result.violations.map((v) => v.subject)).not.toContain("REG-INFO-REG");
    // With all six in-scope regulators mandate-covered there are no findings.
    expect(result.violations.length).toBe(0);
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
    // 5 SARB-PA pilot + 5 FSCA + 5 FIC + 6 BCBS + 4 IASB + 4 INFOREG objectives
    // asserted.
    expect(result.asserted).toBe(29);
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
    // IASB objectives carrying ALIGNS_TO from IFRS accounting/disclosure/tax policies are aligned.
    expect(subjects).not.toContain("OBJ-IASB-TRANSPARENCY");
    expect(subjects).not.toContain("OBJ-IASB-MARKET-EFFICIENCY");
    // INFOREG objectives carrying ALIGNS_TO from privacy/infosec/PAIA policies are aligned.
    expect(subjects).not.toContain("OBJ-INFOREG-DATA-PROTECTION");
    expect(subjects).not.toContain("OBJ-INFOREG-ACCESS-TO-INFORMATION");
    // Tail-fill 2026-06-10: the previously-gapped objectives are now aligned
    // (FIC financial-intelligence via aml-cft-policy; IASB accountability via
    // financial-reporting + external-audit policies; INFOREG monitoring-
    // enforcement via popia-privacy + incident-response policies; SARB-PA
    // customer-protection via RRP policy and MI-soundness via payments-
    // settlement policy), and every mandate is covered transitively via the
    // REFINES roll-up.
    expect(subjects).not.toContain("OBJ-FIC-FINANCIAL-INTELLIGENCE");
    expect(subjects).not.toContain("OBJ-IASB-ACCOUNTABILITY");
    expect(subjects).not.toContain("OBJ-INFOREG-MONITORING-ENFORCEMENT");
    expect(subjects).not.toContain("OBJ-SARB-PA-CUSTOMER-PROTECTION");
    expect(subjects).not.toContain("OBJ-SARB-PA-MI-SOUNDNESS");
    expect(subjects).not.toContain("OBJ-SARB-PA-MANDATE");
    expect(subjects).not.toContain("OBJ-BCBS-MANDATE");
    expect(subjects).not.toContain("OBJ-FIC-MANDATE");
    expect(subjects).not.toContain("OBJ-FSCA-MANDATE");
    expect(subjects).not.toContain("OBJ-IASB-MANDATE");
    expect(subjects).not.toContain("OBJ-INFOREG-MANDATE");
    // The two genuine residuals stay flagged (advisory): FSCA-directed
    // statutory functions no build-phase bank policy serves.
    expect(subjects).toContain("OBJ-FSCA-FINANCIAL-INCLUSION");
    expect(subjects).toContain("OBJ-FSCA-FINANCIAL-EDUCATION");
    expect(result.violations.length).toBe(2);
    expect(result.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
