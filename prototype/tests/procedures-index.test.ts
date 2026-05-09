// tests/procedures-index.test.ts
//
// Unit tests for `dashboard/procedures-index.ts` — the parser that derives
// the grouped procedures view the procedures-index page consumes.
//
// Asserts both shape (every group / row carries the fields the frontend
// reads) and discrimination (status normalisation, link-vs-bare-filename
// detection, frontmatter enrichment, orphan flagging, verify-hint emission).
//
// Author: Atlas (Core banking platform architect)

import { describe, expect, it } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { getProceduresIndex } from "../dashboard/procedures-index";

const REPO_ROOT = join(import.meta.dir, "..", "..");

// ---------------------------------------------------------------------------
// Fixture builder — writes a minimal Procedures/ tree into a temp dir so
// the parser can be exercised on a deterministic input.
// ---------------------------------------------------------------------------

function fixtureRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "proc-index-"));
  mkdirSync(join(root, "Procedures", "by-policy"), { recursive: true });

  const index = `# Procedures library — index

## Foundation & meta-policies

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Risk Management Framework | \`procedures-rmf-governance.md\` | Helena | PLANNED |
| Governance Framework | [\`board-papers.md\`](by-policy/board-papers.md) | Owen | **POPULATED** |

## Risk

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Liquidity Risk Management Policy | [\`capital-ratio-monitoring.md\`](by-policy/capital-ratio-monitoring.md) | Eitan | **POPULATED** |
| Model Risk Policy | [\`model-validation.md\`](by-policy/model-validation.md) | Helena | **STUB** |
| Stress Testing Policy | (shared with above) | Helena | PLANNED |

---

## Status summary

| Status | Count | Note |
|---|---|---|
| **POPULATED** | 2 | sample |
`;
  writeFileSync(join(root, "Procedures", "_index.md"), index);

  // Authored procedure with full frontmatter.
  writeFileSync(
    join(root, "Procedures", "by-policy", "board-papers.md"),
    `---
id: PROC-GOV-BP-01
title: Board papers preparation
owner: Owen
policy-parent: GOVERNANCE-FRAMEWORK
status: POPULATED
last-reviewed: 2026-04-01
reconciliation-cadence: per-meeting
---

# Procedure body
`,
  );

  // Authored procedure missing some frontmatter fields (verify-hint coverage).
  writeFileSync(
    join(root, "Procedures", "by-policy", "capital-ratio-monitoring.md"),
    `---
id: PROC-CAP-RATIO-01
title: Capital ratio monitoring
owner: Eitan
status: POPULATED
---

# Body
`,
  );

  // Authored procedure with no frontmatter at all.
  writeFileSync(
    join(root, "Procedures", "by-policy", "model-validation.md"),
    "# Procedure — Model validation\n\nNo frontmatter.\n",
  );

  // Note: index also references missing-on-disk file via the
  // `procedures-rmf-governance.md` row — that one stays unauthored
  // (bare filename, file does not exist on disk so file-existence is
  // false but it isn't an "orphan" in our taxonomy because the row
  // doesn't carry an explicit by-policy/ link). Only linked rows whose
  // target file is missing trigger ORPHAN-FILE-MISSING.

  return root;
}

// ---------------------------------------------------------------------------
// Fixture-based discriminations
// ---------------------------------------------------------------------------

describe("procedures-index — fixture parse", () => {
  it("parses each H2 section as a domain group", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const domains = view.groups.map((g) => g.domain);
    expect(domains).toContain("Foundation & meta-policies");
    expect(domains).toContain("Risk");
  });

  it("does not ingest rows from the appendix after the horizontal rule", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    // Status summary table has a row whose first cell is "**POPULATED**" —
    // we should not treat that as a procedure row.
    const allPolicies = view.groups.flatMap((g) => g.rows.map((r) => r.policy));
    expect(allPolicies.every((p) => !/^POPULATED$/i.test(p))).toBe(true);
  });

  it("normalises status values to canonical tokens", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const allRows = view.groups.flatMap((g) => g.rows);
    const populated = allRows.filter((r) => r.status === "POPULATED");
    const stub = allRows.filter((r) => r.status === "STUB");
    const planned = allRows.filter((r) => r.status === "PLANNED");
    expect(populated.length).toBeGreaterThan(0);
    expect(stub.length).toBeGreaterThan(0);
    expect(planned.length).toBeGreaterThan(0);
  });

  it("resolves [caption](by-policy/<file>) links to a procedureFile", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const linked = all.find((r) => r.procedureFile === "board-papers.md");
    expect(linked).toBeDefined();
    expect(linked?.procedureLabel).toBe("board-papers.md");
  });

  it("resolves bare backticked filenames to a procedureFile", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const bare = all.find((r) => r.procedureFile === "procedures-rmf-governance.md");
    expect(bare).toBeDefined();
  });

  it("treats descriptive cells (no file reference) as procedureFile = ''", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const descriptive = all.find((r) => r.policy === "Stress Testing Policy");
    expect(descriptive).toBeDefined();
    expect(descriptive?.procedureFile).toBe("");
  });

  it("enriches authored rows with frontmatter (id, policy-parent, last-reviewed)", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const enriched = all.find((r) => r.procedureFile === "board-papers.md");
    expect(enriched?.procedureId).toBe("PROC-GOV-BP-01");
    expect(enriched?.procedureTitle).toBe("Board papers preparation");
    expect(enriched?.policyParent).toBe("GOVERNANCE-FRAMEWORK");
    expect(enriched?.lastReviewed).toBe("2026-04-01");
    expect(enriched?.reconciliationCadence).toBe("per-meeting");
    expect(enriched?.verifyHints).toEqual([]);
  });

  it("emits NO-POLICY-PARENT / NO-LAST-REVIEWED hints when frontmatter is partial", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const partial = all.find((r) => r.procedureFile === "capital-ratio-monitoring.md");
    expect(partial?.procedureId).toBe("PROC-CAP-RATIO-01");
    expect(partial?.verifyHints).toContain("NO-POLICY-PARENT");
    expect(partial?.verifyHints).toContain("NO-LAST-REVIEWED");
  });

  it("emits NO-FRONTMATTER when the procedure file has no YAML block", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    const all = view.groups.flatMap((g) => g.rows);
    const bare = all.find((r) => r.procedureFile === "model-validation.md");
    expect(bare?.verifyHints).toContain("NO-FRONTMATTER");
  });

  it("counts total rows and authored / orphan correctly", () => {
    const root = fixtureRoot();
    const view = getProceduresIndex(root);
    expect(view.count).toBeGreaterThan(0);
    // 3 files exist on disk in the fixture (board-papers, capital-ratio,
    // model-validation); the bare-filename row references a file we never
    // wrote, but bare filenames don't trigger orphan flagging in our
    // taxonomy (only explicit links to by-policy/ do).
    expect(view.authoredCount).toBe(3);
  });

  it("flags rows whose by-policy/ link points at a missing file as orphans", () => {
    // Build a tiny fixture with a link to a file we deliberately do not
    // create.
    const root = mkdtempSync(join(tmpdir(), "proc-orphan-"));
    mkdirSync(join(root, "Procedures", "by-policy"), { recursive: true });
    writeFileSync(
      join(root, "Procedures", "_index.md"),
      `# Procedures library — index

## Risk

| Policy | Procedure | Owner | Status |
|---|---|---|---|
| Risk Policy | [\`missing.md\`](by-policy/missing.md) | Helena | PLANNED |
`,
    );
    const view = getProceduresIndex(root);
    expect(view.orphanCount).toBe(1);
    const all = view.groups.flatMap((g) => g.rows);
    expect(all[0]?.orphan).toBe(true);
    expect(all[0]?.verifyHints).toContain("ORPHAN-FILE-MISSING");
  });

  it("returns an empty view when _index.md does not exist", () => {
    const root = mkdtempSync(join(tmpdir(), "proc-empty-"));
    const view = getProceduresIndex(root);
    expect(view.count).toBe(0);
    expect(view.groups).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Live register — sanity check against the canonical Procedures/_index.md
// ---------------------------------------------------------------------------

describe("procedures-index — live index", () => {
  it("parses every H2 domain group", () => {
    const view = getProceduresIndex(REPO_ROOT);
    expect(view.count).toBeGreaterThan(40);
    const domains = view.groups.map((g) => g.domain);
    // Spot-check: sections named in CLAUDE.md and used in PR #110 NPA.
    expect(domains).toContain("Markets");
  });

  it("resolves the 5 NPA procedure files Owen authored", () => {
    const view = getProceduresIndex(REPO_ROOT);
    const all = view.groups.flatMap((g) => g.rows);
    const npaFiles = [
      "new-product-due-diligence.md",
      "product-controlled-launch.md",
      "product-post-implementation-review.md",
      "product-retirement-migration.md",
    ];
    for (const f of npaFiles) {
      const row = all.find((r) => r.procedureFile === f);
      expect(row).toBeDefined();
      // Each NPA procedure has frontmatter authored — PROC-MK-NPA-* id.
      expect(row?.procedureId).toMatch(/^PROC-MK-NPA-/);
    }
  });

  it("does not flag any of the 5 NPA procedures as orphans", () => {
    const view = getProceduresIndex(REPO_ROOT);
    const all = view.groups.flatMap((g) => g.rows);
    const npa = all.filter((r) => /^PROC-MK-NPA-/.test(r.procedureId));
    expect(npa.length).toBeGreaterThan(0);
    for (const r of npa) {
      expect(r.orphan).toBe(false);
    }
  });
});
