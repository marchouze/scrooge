// dashboard/bank-obligations-view.test.ts
//
// Tests for footnote separation on the obligation detail view
// (D-OBLIGATION-FOOTNOTE-REPRESENTATION, CEO-approved 2026-06-08).
// Author: Mira (Compliance / RegTech engineer, engineering)

import { Database } from "bun:sqlite";
import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  type ObligationSeedRow,
  parseFootnotes,
  provisionGroupsForObligation,
} from "./bank-obligations-view";

// Repo root = parent of prototype/ — where Regulations/BCBS/chapter-text.json lives.
const REPO_ROOT = resolve(import.meta.dir, "..", "..");

/** A tiny in-memory graph matching schema.sql, seeded by helper insert fns, so
 * provisionGroupsForObligation can be exercised without the real graph.db. */
function makeGraph(): Database {
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE graph_nodes (id TEXT PRIMARY KEY, node_type TEXT NOT NULL,
      label TEXT NOT NULL, effective_from TEXT, effective_to TEXT, metadata TEXT);
    CREATE TABLE graph_edges (id TEXT PRIMARY KEY, from_id TEXT NOT NULL,
      to_id TEXT NOT NULL, edge_type TEXT NOT NULL, effective_from TEXT,
      effective_to TEXT, source_provision TEXT, extraction_method TEXT,
      confidence_score REAL, extracted_at TEXT, metadata TEXT,
      UNIQUE(from_id, to_id, edge_type));
  `);
  return db;
}
function addProvision(db: Database, id: string, metadata: Record<string, unknown>): void {
  db.prepare("INSERT INTO graph_nodes (id, node_type, label, metadata) VALUES (?,?,?,?)").run(
    id,
    "Provision",
    id,
    JSON.stringify(metadata),
  );
}
function addObligation(db: Database, oblNodeId: string): void {
  db.prepare("INSERT INTO graph_nodes (id, node_type, label) VALUES (?,?,?)").run(
    oblNodeId,
    "Obligation",
    oblNodeId,
  );
}
function addExpresses(db: Database, provId: string, oblNodeId: string): void {
  db.prepare(
    "INSERT INTO graph_edges (id, from_id, to_id, edge_type) VALUES (?,?,?,'EXPRESSES')",
  ).run(`E-${provId}-${oblNodeId}`, provId, oblNodeId);
}
const seedRow = (over: Partial<ObligationSeedRow> = {}): ObligationSeedRow => ({
  id: over.id ?? "ORG-PR-18",
  ...over,
});

describe("parseFootnotes", () => {
  it("returns the body unchanged and no footnotes when there is no apparatus", () => {
    const { body, footnotes } = parseFootnotes("Banks must hold capital.");
    expect(body).toBe("Banks must hold capital.");
    expect(footnotes).toEqual([]);
  });

  it("separates a single trailing footnote, keeping the inline marker in the body (CRE40.95)", () => {
    const raw =
      "At the portfolio cut-off date, the aggregated value of all exposures to a single obligor shall not exceed 1%25 of the aggregated outstanding exposure value of all exposures in the portfolio. Footnotes 25 In jurisdictions with structurally concentrated corporate loan markets the threshold could be increased to 2%.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body.endsWith("in the portfolio.")).toBe(true);
    expect(body).toContain("1%25"); // inline superscript marker retained
    expect(body).not.toContain("Footnotes");
    expect(footnotes).toHaveLength(1);
    expect(footnotes[0].marker).toBe("25");
    expect(footnotes[0].text.startsWith("In jurisdictions")).toBe(true);
  });

  it("splits sequential footnotes in one apparatus block without splitting on digits inside footnote bodies (CRE30.20)", () => {
    const raw =
      "Small business loans extended through or guaranteed by an individual are subject to the same exposure threshold. Footnotes 1 Loans that meet the conditions set out in the second footnote to CRE20. 71 of the standardised approach are eligible to be included in the IRB retail residential mortgage sub-class. 2 At national discretion, supervisors may exclude certain loans.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body).not.toContain("Footnotes");
    expect(footnotes.map((f) => f.marker)).toEqual(["1", "2"]);
    // the "71" inside footnote 1's body must NOT have started a new footnote
    expect(footnotes[0].text).toContain("CRE20. 71");
    expect(footnotes[1].text.startsWith("At national discretion")).toBe(true);
  });

  it("handles interleaved Footnotes blocks without duplicating markers (CRE30.36)", () => {
    const raw =
      "The other risk components are LGD, EAD and M.5 Footnotes 5 As noted in CRE32.44, some supervisors may require banks to calculate M. Under the advanced approach, banks must calculate the effective maturity (M)6 and provide their own estimates. Footnotes 6 At the discretion of the national supervisor, certain domestic exposures may be exempt.";
    const { body, footnotes } = parseFootnotes(raw);
    expect(body).not.toContain("Footnotes");
    // markers 5 and 6, each introduced by its own Footnotes token — no dup 6
    expect(footnotes.map((f) => f.marker)).toEqual(["5", "6"]);
    expect(footnotes[1].text.startsWith("At the discretion")).toBe(true);
  });
});

describe("provisionGroupsForObligation", () => {
  it("resolves a BCBS chapter from chapter-text.json (unchanged) and reports extracted", () => {
    // BCBS path reads the committed PDF text sidecar, not the graph; pass an
    // empty graph to prove the graph is not consulted when the sidecar covers it.
    const db = makeGraph();
    const { groups, status } = provisionGroupsForObligation("BCBS-MAR11", REPO_ROOT, null, db);
    expect(status).toBe("extracted");
    expect(groups.length).toBeGreaterThan(0);
    const allParas = groups.flatMap((g) => g.paragraphs);
    expect(allParas.length).toBeGreaterThan(0);
    // every MAR11 paragraph carries real source text and a MAR11.* number
    expect(allParas.every((p) => p.text.trim().length > 0)).toBe(true);
    expect(allParas[0].paragraph.startsWith("11.")).toBe(true);
  });

  it("BCBS-MAR11 heading groups are byte-identical to the pre-helper algorithm (regression guard)", () => {
    // Independent reconstruction of the original inline BCBS algorithm
    // (chapter-text.json → minor-number sort → parseFootnotes → push). If the
    // generalised helper drifts for BCBS, this comparison fails.
    const doc = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "Regulations/BCBS/chapter-text.json"), "utf8"),
    ) as {
      chapters: Record<string, Array<{ paragraph: string; heading: string | null; text: string }>>;
    };
    const rows = doc.chapters.MAR11;
    const minorOf = (p: string) => Number(p.split(".")[1] ?? 0);
    type Para = { id: string; paragraph: string; text: string; footnotes?: unknown };
    type Group = { heading: string | null; fromPara: string; toPara: string; paragraphs: Para[] };
    const expected: Group[] = [];
    for (const row of [...rows].sort((a, b) => minorOf(a.paragraph) - minorOf(b.paragraph))) {
      const nodeId = `urn:reg:bcbs:mar:11.${row.paragraph.split(".")[1]}`;
      const { body, footnotes } = parseFootnotes(row.text);
      const p: Para = {
        id: nodeId,
        paragraph: row.paragraph,
        text: body,
        ...(footnotes.length ? { footnotes } : {}),
      };
      let g = expected[expected.length - 1];
      if (!g || g.heading !== row.heading) {
        g = { heading: row.heading, fromPara: p.paragraph, toPara: p.paragraph, paragraphs: [] };
        expected.push(g);
      }
      g.paragraphs.push(p);
      g.toPara = p.paragraph;
    }

    const { groups } = provisionGroupsForObligation("BCBS-MAR11", REPO_ROOT, null, makeGraph());
    expect(JSON.stringify(groups)).toBe(JSON.stringify(expected));
  });

  it("resolves an SA obligation with extracted text via the EXPRESSES edge", () => {
    const db = makeGraph();
    addObligation(db, "OBL-ORG-PR-18");
    addProvision(db, "PROV-BANKS-ACT-s70", {
      sectionId: "BANKS-ACT-94-1990:s70",
      section: "70",
      heading: "Minimum capital and reserve funds",
      paragraph: "70.1",
      text: "A bank shall at all times maintain capital and reserve funds of not less than the prescribed amount.",
    });
    addExpresses(db, "PROV-BANKS-ACT-s70", "OBL-ORG-PR-18");

    const { groups, status } = provisionGroupsForObligation(
      "ORG-PR-18",
      REPO_ROOT,
      seedRow({ id: "ORG-PR-18" }),
      db,
    );
    expect(status).toBe("extracted");
    expect(groups).toHaveLength(1);
    expect(groups[0].heading).toBe("Minimum capital and reserve funds");
    expect(groups[0].paragraphs[0].text.startsWith("A bank shall")).toBe(true);
  });

  it("reports image-only when an SA obligation's provision exists but carries no text", () => {
    const db = makeGraph();
    addObligation(db, "OBL-ORG-PR-35");
    // citation stub provision (image-only PDF, e.g. SARB D1/2015): no text.
    addProvision(db, "PROV-BANKS-ACT-s60", {
      sectionId: "BANKS-ACT-94-1990:s60",
      instrumentId: "BANKS-ACT-94-1990",
      text: "",
    });
    addExpresses(db, "PROV-BANKS-ACT-s60", "OBL-ORG-PR-35");

    const { groups, status } = provisionGroupsForObligation(
      "ORG-PR-35",
      REPO_ROOT,
      seedRow({ id: "ORG-PR-35" }),
      db,
    );
    expect(status).toBe("image-only");
    // the provision resolved (so we know which instrument), but rendered no body
    expect(groups.flatMap((g) => g.paragraphs).every((p) => p.text === "")).toBe(true);
  });

  it("reports missing when no provision resolves for an SA obligation", () => {
    const db = makeGraph();
    addObligation(db, "OBL-ORG-PR-99"); // obligation node but no EXPRESSES edge
    const { groups, status } = provisionGroupsForObligation(
      "ORG-PR-99",
      REPO_ROOT,
      seedRow({ id: "ORG-PR-99", citation: "[TBD]" }),
      db,
    );
    expect(status).toBe("missing");
    expect(groups).toHaveLength(0);
  });

  it("falls back to explicit sourceProvisions[] when no EXPRESSES edge resolves", () => {
    const db = makeGraph();
    addProvision(db, "PROV-EXPLICIT-1", {
      section: "12",
      text: "Explicitly pointed-to provision body.",
    });
    const { groups, status } = provisionGroupsForObligation(
      "ORG-PR-77",
      REPO_ROOT,
      seedRow({ id: "ORG-PR-77", sourceProvisions: ["PROV-EXPLICIT-1"] }),
      db,
    );
    expect(status).toBe("extracted");
    expect(groups[0].paragraphs[0].text).toBe("Explicitly pointed-to provision body.");
  });

  it("falls back to read-time citation parse when neither edge nor sourceProvisions resolve", () => {
    const db = makeGraph();
    // provision keyed by the slug-normalised sectionId the citation parser yields
    addProvision(db, "PROV-FAIS-s7", {
      sectionId: "FAIS-ACT-37-2002:s7",
      section: "7",
      text: "An authorised financial services provider must comply with the requirements.",
    });
    const { groups, status } = provisionGroupsForObligation(
      "ORG-FA-07",
      REPO_ROOT,
      seedRow({ id: "ORG-FA-07", citation: "FAIS Act 37/2002 s.7" }),
      db,
    );
    expect(status).toBe("extracted");
    expect(groups[0].paragraphs[0].text.startsWith("An authorised")).toBe(true);
  });
});
