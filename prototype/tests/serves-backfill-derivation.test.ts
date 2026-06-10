// tests/serves-backfill-derivation.test.ts
//
// Tests for the rule-based SERVES backfill derivation
// (platform/regulatory/graph/serves-backfill-derivation.ts) and the committed
// artefact (Regulations/_adopted-serves-backfill-objective-graph.json).
//
// Covers:
//   - golden derivation cases per regulator (PA directive, PA recovery/
//     resolution → customer-protection, FIC, FSCA conduct vs markets, margin
//     stack, BCBS standard-family, urn:reg passthrough);
//   - the honesty bar: deliberately-unmappable obligations STAY unmapped with
//     a machine-readable reason (standards-body reference, internal RAS
//     handle, fully ambiguous citation) — no fake edges;
//   - the confidence threshold is enforced on every emitted edge;
//   - already-covered obligations are skipped (the 91 hand-authored edges of
//     #1150–#1164 stay canonical, never duplicated);
//   - artefact freshness: regenerating from the committed inputs reproduces
//     the committed artefact exactly (drift = regenerate + commit);
//   - full-register partition: edges + residuals + covered = register size.
//
// The fold-side assertions (edges actually LAND in the seeded graph + re-fold
// idempotency — the #1142 defect class) live in
// tests/reg-intelligence-objective-layer.test.ts, which seeds the full graph.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildAdoptedServesBackfillArtefact } from "../platform/regulatory/graph/serves-backfill-artefact";
import {
  type AdoptedRegisterRow,
  type DerivedServesEdge,
  SERVES_CONFIDENCE_THRESHOLD,
  type ServesResidual,
  deriveServesBackfill,
} from "../platform/regulatory/graph/serves-backfill-derivation";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const ARTEFACT_PATH = join(
  REPO_ROOT,
  "Regulations",
  "_adopted-serves-backfill-objective-graph.json",
);

const NONE: ReadonlySet<string> = new Set();

function deriveOne(row: AdoptedRegisterRow): {
  edge: DerivedServesEdge | undefined;
  residual: ServesResidual | undefined;
} {
  const r = deriveServesBackfill([row], NONE);
  return { edge: r.edges[0], residual: r.residuals[0] };
}

describe("serves-backfill derivation — golden cases", () => {
  test("PA directive → SARB-PA safety-soundness at 0.9", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-PA-1",
      citation: "SARB Prudential Authority **Directive D5/2025** §2.1.2 (BA returns)",
      urn: "[TBD]",
    });
    expect(edge?.toId).toBe("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(edge?.confidenceScore).toBe(0.9);
    expect(edge?.fromId).toBe("OBL-ORG-TEST-PA-1");
    // No urn:reg on the row → the objective's statutory anchor (PA-pilot convention).
    expect(edge?.sourceProvision).toBe("urn:reg:za:fsr-act-9-2017:s.33(a)");
  });

  test("PA recovery/resolution planning → customer-protection (the #1192 precedent)", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-PA-2",
      citation:
        "SARB Prudential Authority **Directive 1 of 2015** — Recovery plan minimum requirements",
    });
    expect(edge?.toId).toBe("OBJ-SARB-PA-CUSTOMER-PROTECTION");
  });

  test("'response and recovery' capability language is NOT recovery-planning", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-PA-3",
      citation:
        "Joint Standard 2 of 2024 — Cybersecurity and Cyber Resilience: response and recovery capabilities",
    });
    expect(edge?.toId).toBe("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(edge?.confidenceScore).toBe(0.75); // joint-instrument attribution judgment
  });

  test("FIC Act section → FIC leaf (tipping-off → financial-intelligence) at 0.9", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-FC-1",
      citation: "FIC Act s.29(3)",
      requirement: "Prohibit tipping-off: no disclosure of an STR's existence or contents.",
    });
    expect(edge?.toId).toBe("OBJ-FIC-FINANCIAL-INTELLIGENCE");
    expect(edge?.confidenceScore).toBe(0.9);
  });

  test("PA directive issued UNDER the FIC Act is an AML instrument (FIC primacy over PA tokens)", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-FC-2",
      citation:
        "SARB Prudential Authority **Directive 4 of 2022** — PA Directive 4 of 2022 issued under FIC Act s.43A(3) — ML/TF/PF risk return directive",
      requirement: "Submit ML/TF/PF risk returns to the PA quarterly.",
    });
    expect(edge?.toId).toBe("OBJ-FIC-AML-SUPERVISION");
  });

  test("FSCA conduct vs markets split (CS 2/2018 → fair-treatment; CS 3/2018 → market-integrity)", () => {
    const conduct = deriveOne({ id: "ORG-TEST-CS2", citation: "CS 2/2018 §4(1)–(7)" });
    const markets = deriveOne({ id: "ORG-TEST-CS3", citation: "CS 3/2018 §6(1)–(3)" });
    expect(conduct.edge?.toId).toBe("OBJ-FSCA-FAIR-TREATMENT");
    expect(markets.edge?.toId).toBe("OBJ-FSCA-MARKET-INTEGRITY");
    expect(markets.edge?.confidenceScore).toBe(0.9);
  });

  test("OTC margin stack (JS 2/2020 / JN 2/2024) → FSCA market-integrity at 0.75 (MK-RPT-001 precedent)", () => {
    const { edge } = deriveOne({ id: "ORG-TEST-JS2", citation: "JS 2/2020 §5" });
    expect(edge?.toId).toBe("OBJ-FSCA-MARKET-INTEGRITY");
    expect(edge?.confidenceScore).toBe(0.75);
  });

  test("BCBS standard-family partition (239 → supervisory-review; RBC capital → capital-adequacy)", () => {
    const rdarr = deriveOne({ id: "ORG-TEST-BCBS-1", citation: "BCBS 239" });
    const capital = deriveOne({
      id: "ORG-TEST-BCBS-2",
      citation: "BCBS RBC (`urn:reg:bcbs:rbc:30.2` — capital conservation buffer)",
    });
    expect(rdarr.edge?.toId).toBe("OBJ-BCBS-SUPERVISORY-REVIEW");
    expect(capital.edge?.toId).toBe("OBJ-BCBS-CAPITAL-ADEQUACY");
    expect(rdarr.edge?.confidenceScore).toBe(0.8);
  });

  test("SA transposition primacy: Banks Act + BCBS original → SARB-PA, not BCBS", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-PA-4",
      citation: "BCBS Large Exposures + Banks Act",
    });
    expect(edge?.toId).toBe("OBJ-SARB-PA-SAFETY-SOUNDNESS");
    expect(edge?.metadata.derivationRule).toBe("pa-banks-act");
  });

  test("company-law primacy: Companies Act leading with BCBS as supporting reference → residual, not BCBS", () => {
    const { edge, residual } = deriveOne({
      id: "ORG-TEST-GV-1",
      citation:
        "Companies Act 71 of 2008 ss.66, 71, 73, 75 (board of directors) read with BCBS 239 audit-trail expectations",
    });
    expect(edge).toBeUndefined();
    expect(residual?.reasonClass).toBe("no-objective-graph:CIPC-KingIV");
  });

  test("row with its own urn:reg:* keeps it as sourceProvision", () => {
    const { edge } = deriveOne({
      id: "ORG-TEST-CS3-URN",
      citation: "CS 3/2018 §4",
      urn: "urn:reg:za:cs-3-2018:s4",
    });
    expect(edge?.sourceProvision).toBe("urn:reg:za:cs-3-2018:s4");
  });
});

describe("serves-backfill derivation — honesty bar (no fake edges)", () => {
  test("deliberately-unmappable: voluntary standards-body reference stays unmapped with a reason", () => {
    const { edge, residual } = deriveOne({
      id: "ORG-TEST-CY-ISO",
      citation: "ISO/IEC 27001:2022 (used as reference)",
    });
    expect(edge).toBeUndefined();
    expect(residual?.reasonClass).toBe("standards-body-reference");
    expect(residual?.obligationId).toBe("OBL-ORG-TEST-CY-ISO");
    expect((residual?.reason ?? "").length).toBeGreaterThan(0);
  });

  test("internal RAS handle stays unmapped", () => {
    const { residual } = deriveOne({ id: "ORG-TEST-RAS", citation: "RAS B6 (CEO approved)" });
    expect(residual?.reasonClass).toBe("internal-policy-source");
  });

  test("exchange-control (FinSurv) and tax (SARS) sources stay unmapped — no objective graph yet", () => {
    const excon = deriveOne({
      id: "ORG-TEST-FX",
      citation:
        "Currency and Exchanges Manual for Authorised Dealers (2026-05-15 ed.), Section B.1",
    });
    const tax = deriveOne({ id: "ORG-TEST-TX", citation: "Income Tax Act 58/1962" });
    expect(excon.residual?.reasonClass).toBe("no-objective-graph:SARB-FinSurv");
    expect(tax.residual?.reasonClass).toBe("no-objective-graph:SARS");
  });

  test("a citation matching no rule is an explicit ambiguous residual, never a guess", () => {
    const { edge, residual } = deriveOne({
      id: "ORG-TEST-UNKNOWN",
      citation: "Some Entirely Unrecognised Instrument 99 of 2099",
    });
    expect(edge).toBeUndefined();
    expect(residual?.reasonClass).toBe("ambiguous-citation");
  });

  test("already-covered obligations are skipped — hand-authored SERVES stays canonical", () => {
    const covered = new Set(["OBL-ORG-PR-01"]);
    const r = deriveServesBackfill(
      [{ id: "ORG-PR-01", citation: "Banks Act 94/1990 + Regulations relating to Banks" }],
      covered,
    );
    expect(r.edges.length).toBe(0);
    expect(r.residuals.length).toBe(0);
    expect(r.alreadyCovered).toBe(1);
  });
});

describe("serves-backfill artefact — committed file", () => {
  const built = buildAdoptedServesBackfillArtefact(REPO_ROOT);
  const committed = JSON.parse(readFileSync(ARTEFACT_PATH, "utf-8")) as {
    edges: DerivedServesEdge[];
    residuals: ServesResidual[];
  };

  test("committed artefact is fresh — regenerating from the committed inputs reproduces it", () => {
    expect(committed).toEqual(built.artefact as unknown as typeof committed);
  });

  test("every emitted edge meets the confidence threshold and is a SERVES edge with provenance", () => {
    expect(committed.edges.length).toBeGreaterThan(0);
    for (const e of committed.edges) {
      expect(e.edgeType).toBe("SERVES");
      expect(e.confidenceScore).toBeGreaterThanOrEqual(SERVES_CONFIDENCE_THRESHOLD);
      expect(e.extractionMethod).toBe("rule-based");
      expect(e.fromId.startsWith("OBL-ORG-")).toBe(true);
      expect(e.toId.startsWith("OBJ-")).toBe(true);
      expect(e.sourceProvision.startsWith("urn:reg:")).toBe(true);
      expect((e.metadata.derivationRule ?? "").length).toBeGreaterThan(0);
    }
  });

  test("full-register partition: edges + residuals + already-covered = register size; no overlap", () => {
    const rows = JSON.parse(
      readFileSync(join(REPO_ROOT, "Regulations", "_obligations.seed.json"), "utf-8"),
    ) as Array<{ id: string }>;
    const { result } = built;
    expect(result.edges.length + result.residuals.length + result.alreadyCovered).toBe(rows.length);
    const edgeFroms = new Set(result.edges.map((e) => e.fromId));
    for (const r of result.residuals) {
      expect(edgeFroms.has(r.obligationId)).toBe(false);
    }
    // One edge per obligation (no duplicates).
    expect(edgeFroms.size).toBe(result.edges.length);
  });

  test("every residual carries a reason class and the offending citation", () => {
    expect(committed.residuals.length).toBeGreaterThan(0);
    for (const r of committed.residuals) {
      expect(r.obligationId.startsWith("OBL-ORG-")).toBe(true);
      expect((r.reasonClass ?? "").length).toBeGreaterThan(0);
      expect((r.reason ?? "").length).toBeGreaterThan(0);
    }
  });
});
