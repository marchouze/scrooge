// tests/policy-register.test.ts
//
// Unit tests for `dashboard/policy-register.ts` — the parser that derives
// the typed Policy[] entries the policies-library page consumes.
//
// Asserts both shape (every parsed entry has the fields the frontend reads)
// and discrimination (MVP flag, status normalisation, source / bind class
// classification, linked-obligation cross-reference).
//
// Author: Anya

import { describe, expect, it } from "bun:test";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyBinds,
  classifySources,
  normaliseStatus,
  parsePolicyRegister,
  policyId,
} from "../dashboard/policy-register";

const REPO_ROOT = join(import.meta.dir, "..", "..");
const REAL_REGISTER = join(REPO_ROOT, "archive", "owner-inbox", "2026-05-06_policy-register.md");
const REAL_OBLIGATIONS = join(REPO_ROOT, "Regulations", "_obligations-register.md");

describe("policy-register — classifiers", () => {
  it("flags external regulator / standard citations as REGULATORY", () => {
    expect(classifySources("Banks Act")).toEqual(["REGULATORY"]);
    expect(classifySources("FIC Act 38/2001 + FATF")).toEqual(["REGULATORY"]);
    expect(classifySources("POPIA 4/2013 s.11")).toEqual(["REGULATORY"]);
    expect(classifySources("IFRS 9 / 7 / 13")).toEqual(["REGULATORY"]);
  });

  it("flags internal-objective citations as OBJECTIVE", () => {
    expect(classifySources("Internal — implements P2")).toEqual(["OBJECTIVE"]);
    expect(classifySources("Implements RAS B2")).toEqual(["OBJECTIVE"]);
  });

  it("returns both labels when a citation mixes regulatory and internal sources", () => {
    const result = classifySources("Banks Act + RAS B2 internal buffer");
    expect(result).toContain("REGULATORY");
    expect(result).toContain("OBJECTIVE");
  });

  it("returns empty when the citation matches neither bucket", () => {
    expect(classifySources("IP statutes")).toEqual([]);
    expect(classifySources("")).toEqual([]);
  });

  it("classifies binds for canonical instruments", () => {
    expect(classifyBinds("Companies Act 71 of 2008")).toContain("CORPORATE-BIND");
    expect(classifyBinds("POPIA 4/2013")).toContain("CORPORATE-BIND");
    expect(classifyBinds("Banks Act + BCBS")).toContain("LICENCE-BIND");
    expect(classifyBinds("FMA Ch. X")).toContain("COMMENCEMENT-BIND");
    expect(classifyBinds("FAIS Act 37 of 2002")).toContain("CONDITIONAL-BIND");
  });

  it("can produce multi-bind classifications", () => {
    const binds = classifyBinds("Banks Act; King IV; Companies Act 71 of 2008");
    expect(binds).toContain("CORPORATE-BIND");
    expect(binds).toContain("LICENCE-BIND");
  });
});

describe("policy-register — status normalisation", () => {
  it("strips backticks, bold markers, and parenthetical context", () => {
    expect(normaliseStatus("`EXISTS` (approved A1)")).toBe("EXISTS");
    expect(normaliseStatus("`IN FORCE` (Round 2 bundle §1)")).toBe("IN FORCE");
    expect(normaliseStatus("**`IN FORCE`** (added 2026-05-06)")).toBe("IN FORCE");
    expect(normaliseStatus("`PLANNED`")).toBe("PLANNED");
    expect(normaliseStatus("`DRAFTING` (in framework §6)")).toBe("DRAFTING");
    expect(normaliseStatus("`BOARD-RES`")).toBe("BOARD-RES");
  });

  it("falls back to OTHER when no canonical keyword matches", () => {
    expect(normaliseStatus("retired")).toBe("OTHER");
    expect(normaliseStatus("")).toBe("OTHER");
  });
});

describe("policy-register — slug + id", () => {
  it("derives a stable id from domain number + slugified name", () => {
    expect(policyId("2", "Credit Risk Policy")).toBe("pol-2-credit-risk-policy");
    expect(policyId("1", "Risk Appetite Statement (RAS)")).toBe(
      "pol-1-risk-appetite-statement-ras",
    );
  });

  it("strips the leading star marker from MVP names", () => {
    expect(policyId("2", "★ Credit Risk Policy")).toBe("pol-2-credit-risk-policy");
  });
});

// ---------------------------------------------------------------------------
// Tiny fixture parser — exercises the table walker, MVP detection, status
// normalisation, source / bind classification, and the linked-obligations
// cross-reference end-to-end without touching the real register.
// ---------------------------------------------------------------------------

function fixtureRegister(): { path: string; obligations: string } {
  const dir = mkdtempSync(join(tmpdir(), "policy-register-test-"));
  const policyPath = join(dir, "policy-register.md");
  const obligationsPath = join(dir, "obligations-register.md");

  writeFileSync(
    policyPath,
    [
      "# Policy register",
      "",
      "## How to read",
      "",
      "## 1. Foundation",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| ★ RAS | Helena | Board | Annual | Banks Act + RAS internal | `EXISTS` (approved B1) |",
      "| Governance Framework | Owen | Board | Annual | King IV; Companies Act | `IN FORCE` |",
      "",
      "## 2. Risk policies",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| ★ Credit Risk Policy | Helena | BRC | Annual | Banks Act; BCBS | `PLANNED` |",
      "| FAIS Policy | Zara | BRC | Annual | FAIS Act 37 of 2002 | `PLANNED` |",
      "",
      "## Summary",
      "",
      "| Policy | Owner | Approval | Cadence | Citation | Status |",
      "|---|---|---|---|---|---|",
      "| ★ RAS | Helena | Board | Annual | Banks Act | EXISTS |",
      "",
    ].join("\n"),
  );

  writeFileSync(
    obligationsPath,
    [
      "# Obligations register",
      "",
      "| ID | URN | Citation | Requirement | Fulfilment policy | Owner | Status | Entity scope | Applies-at |",
      "|---|---|---|---|---|---|---|---|---|",
      "| ORG-PR-01 | [TBD] | Banks Act | Capital adequacy | Credit Risk Policy; RAS | Helena | IN FORCE | [TBD] | [TBD] |",
      "| ORG-FC-01 | [TBD] | FIC Act | RMCP | Credit Risk Policy | Zara | IN FORCE | [TBD] | [TBD] |",
      "",
    ].join("\n"),
  );

  return { path: policyPath, obligations: obligationsPath };
}

describe("policy-register — parser fixture", () => {
  it("parses every numbered domain row, skipping the Summary section", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({
      path: f.path,
      obligationsRegister: f.obligations,
    });
    expect(policies).toHaveLength(4);
    expect(policies.map((p) => p.name)).toEqual([
      "RAS",
      "Governance Framework",
      "Credit Risk Policy",
      "FAIS Policy",
    ]);
  });

  it("strips the ★ marker from the name and sets mvp:true", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({ path: f.path });
    const ras = policies.find((p) => p.name === "RAS");
    expect(ras?.mvp).toBe(true);
    expect(ras?.id).toBe("pol-1-ras");
    const gf = policies.find((p) => p.name === "Governance Framework");
    expect(gf?.mvp).toBe(false);
  });

  it("normalises status (strips backticks, parens) but preserves statusRaw", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({ path: f.path });
    const ras = policies.find((p) => p.name === "RAS");
    expect(ras?.status).toBe("EXISTS");
    expect(ras?.statusRaw).toBe("`EXISTS` (approved B1)");
    const gf = policies.find((p) => p.name === "Governance Framework");
    expect(gf?.status).toBe("IN FORCE");
    const credit = policies.find((p) => p.name === "Credit Risk Policy");
    expect(credit?.status).toBe("PLANNED");
  });

  it("classifies sources from the citation cell", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({ path: f.path });
    const ras = policies.find((p) => p.name === "RAS");
    // "Banks Act + RAS internal" hits both REGULATORY (Banks Act) and OBJECTIVE (RAS).
    expect(ras?.sources).toContain("REGULATORY");
    expect(ras?.sources).toContain("OBJECTIVE");
  });

  it("cross-references the obligations register for linkedObligations", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({
      path: f.path,
      obligationsRegister: f.obligations,
    });
    const credit = policies.find((p) => p.name === "Credit Risk Policy");
    expect(credit?.linkedObligations).toContain("ORG-PR-01");
    expect(credit?.linkedObligations).toContain("ORG-FC-01");
    const ras = policies.find((p) => p.name === "RAS");
    expect(ras?.linkedObligations).toEqual(["ORG-PR-01"]);
    const fais = policies.find((p) => p.name === "FAIS Policy");
    expect(fais?.linkedObligations).toEqual([]);
  });

  it("populates every required field for every parsed entry", () => {
    const f = fixtureRegister();
    const policies = parsePolicyRegister({
      path: f.path,
      obligationsRegister: f.obligations,
    });
    for (const p of policies) {
      // F-013: use specific type+content assertions instead of generic toBeTruthy().
      expect(typeof p.id).toBe("string");
      expect(p.id.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe("string");
      expect(p.name.length).toBeGreaterThan(0);
      expect(typeof p.domain).toBe("string");
      expect(p.domain.length).toBeGreaterThan(0);
      expect(typeof p.owner).toBe("string");
      expect(p.owner.length).toBeGreaterThan(0);
      expect(typeof p.approval).toBe("string");
      expect(p.approval.length).toBeGreaterThan(0);
      expect(typeof p.cadence).toBe("string");
      expect(p.cadence.length).toBeGreaterThan(0);
      expect(typeof p.citation).toBe("string");
      expect(p.citation.length).toBeGreaterThan(0);
      expect(typeof p.statusRaw).toBe("string");
      expect(p.statusRaw.length).toBeGreaterThan(0);
      expect(Array.isArray(p.sources)).toBe(true);
      expect(Array.isArray(p.binds)).toBe(true);
      expect(Array.isArray(p.linkedObligations)).toBe(true);
      expect(typeof p.mvp).toBe("boolean");
    }
  });
});

// ---------------------------------------------------------------------------
// Standalone-pass tests — Policies/*.md files with no matching register row.
// ---------------------------------------------------------------------------

describe("policy-register — standalone Policies/ pass", () => {
  function fixtureWithPoliciesDir() {
    const dir = mkdtempSync(join(tmpdir(), "policy-register-standalone-"));
    const registerPath = join(dir, "policy-register.md");
    const policiesDir = join(dir, "Policies");
    const { mkdirSync } = require("node:fs") as typeof import("node:fs");
    mkdirSync(policiesDir, { recursive: true });

    writeFileSync(
      registerPath,
      [
        "## 1. Foundation",
        "",
        "| Policy | Owner | Approval | Cadence | Citation | Status |",
        "|---|---|---|---|---|---|",
        // Explicitly reference aml-policy-v1.md so it gets claimed.
        "| AML Policy | Zara | Board | Annual | FIC Act | `EXISTS` Policies/aml-policy-v1.md |",
        "",
      ].join("\n"),
    );

    // Claimed file — should NOT produce a standalone entry.
    writeFileSync(
      join(policiesDir, "aml-policy-v1.md"),
      [
        "---",
        'title: "AML/CFT Policy v1"',
        'status: "EXISTS"',
        'owner: "Zara"',
        "---",
        "# AML/CFT Policy v1",
      ].join("\n"),
    );

    // Unclaimed file — SHOULD produce a standalone entry.
    writeFileSync(
      join(policiesDir, "bank-strategy-v1.md"),
      [
        "---",
        'title: "Hoz Bank — Institutional Strategy v1"',
        "status: DRAFT — PENDING CEO APPROVAL",
        'owner: "Marc (CEO)"',
        "---",
        "# Hoz Bank — Institutional Strategy v1",
      ].join("\n"),
    );

    // Unclaimed file with no frontmatter — title falls back to H1.
    writeFileSync(
      join(policiesDir, "data-governance-policy-v1.md"),
      ["# Data Governance Policy", "", "Body text."].join("\n"),
    );

    return { registerPath, policiesDir };
  }

  it("emits a standalone entry for each unclaimed Policies/*.md file", () => {
    const f = fixtureWithPoliciesDir();
    const policies = parsePolicyRegister({ path: f.registerPath, policiesDir: f.policiesDir });
    const names = policies.map((p) => p.name);
    expect(names).toContain("Hoz Bank — Institutional Strategy v1");
    expect(names).toContain("Data Governance Policy");
  });

  it("does not duplicate a file already claimed by a register row", () => {
    const f = fixtureWithPoliciesDir();
    const policies = parsePolicyRegister({ path: f.registerPath, policiesDir: f.policiesDir });
    const amlEntries = policies.filter(
      (p) => p.name === "AML Policy" || p.name === "AML/CFT Policy v1",
    );
    expect(amlEntries).toHaveLength(1);
  });

  it("reads title, owner, and status from frontmatter", () => {
    const f = fixtureWithPoliciesDir();
    const policies = parsePolicyRegister({ path: f.registerPath, policiesDir: f.policiesDir });
    const strat = policies.find((p) => p.name === "Hoz Bank — Institutional Strategy v1");
    expect(strat).toBeDefined();
    expect(strat?.owner).toBe("Marc (CEO)");
    expect(strat?.status).toBe("OTHER");
    expect(strat?.statusRaw).toBe("DRAFT — PENDING CEO APPROVAL");
    expect(strat?.id).toBe("pol-standalone-bank-strategy-v1");
    expect(strat?.domain).toBe("Policy Documents");
    expect(strat?.sourceFiles).toEqual(["Policies/bank-strategy-v1.md"]);
    expect(strat?.mvp).toBe(false);
  });

  it("falls back to H1 title when frontmatter is absent", () => {
    const f = fixtureWithPoliciesDir();
    const policies = parsePolicyRegister({ path: f.registerPath, policiesDir: f.policiesDir });
    const dg = policies.find((p) => p.name === "Data Governance Policy");
    expect(dg).toBeDefined();
    expect(dg?.id).toBe("pol-standalone-data-governance-policy-v1");
  });

  it("skips README.md", () => {
    const f = fixtureWithPoliciesDir();
    const { writeFileSync: wf } = require("node:fs") as typeof import("node:fs");
    wf(join(f.policiesDir, "README.md"), "# Readme\n");
    const policies = parsePolicyRegister({ path: f.registerPath, policiesDir: f.policiesDir });
    expect(policies.find((p) => p.name === "Readme")).toBeUndefined();
  });

  it("includes bank-strategy-v1.md from the live Policies/ dir", () => {
    const REAL_POLICIES_DIR = join(import.meta.dir, "..", "..", "Policies");
    const policies = parsePolicyRegister({ path: REAL_REGISTER, policiesDir: REAL_POLICIES_DIR });
    const strat = policies.find((p) => p.sourceFiles.includes("Policies/bank-strategy-v1.md"));
    expect(strat).toBeDefined();
    expect(strat?.name).toBe("Hoz Bank — Institutional Strategy v1");
    expect(strat?.domain).toBe("Policy Documents");
  });
});

// ---------------------------------------------------------------------------
// Live-register smoke test. Asserts the parser produces the order-of-magnitude
// numbers the dashboard expects against the real `Owner Inbox/2026-05-06_*`
// file. Pinned to ranges (rather than exact counts) so register edits do
// not break the test on every word change.
// ---------------------------------------------------------------------------

describe("policy-register — live register", () => {
  it("parses ≥ 100 policies with all required fields populated", () => {
    const policies = parsePolicyRegister({
      path: REAL_REGISTER,
      obligationsRegister: REAL_OBLIGATIONS,
    });
    expect(policies.length).toBeGreaterThanOrEqual(100);
    for (const p of policies) {
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.domain).toBeTruthy();
      expect(p.owner).toBeTruthy();
      expect(p.statusRaw).toBeTruthy();
    }
  });

  it("identifies at least one MVP-flagged policy", () => {
    const policies = parsePolicyRegister({ path: REAL_REGISTER });
    expect(policies.some((p) => p.mvp)).toBe(true);
  });

  it("identifies at least one IN FORCE and one PLANNED policy", () => {
    const policies = parsePolicyRegister({ path: REAL_REGISTER });
    expect(policies.some((p) => p.status === "IN FORCE")).toBe(true);
    expect(policies.some((p) => p.status === "PLANNED")).toBe(true);
  });

  it("populates linkedObligations for at least 25% of policies", () => {
    const policies = parsePolicyRegister({
      path: REAL_REGISTER,
      obligationsRegister: REAL_OBLIGATIONS,
    });
    const linked = policies.filter((p) => p.linkedObligations.length > 0);
    expect(linked.length).toBeGreaterThan(policies.length / 4);
  });
});

// ---------------------------------------------------------------------------
// /api/obligations endpoint contract — the policies-drilldown fetches each
// obligation's citation / requirement / source / bind / status from this
// endpoint to populate the per-policy obligation table.
// ---------------------------------------------------------------------------

import { getObligationsView } from "../dashboard/obligations-view";

describe("obligations-view — live register", () => {
  it("parses every ORG-* row and returns it keyed by id", () => {
    const view = getObligationsView(REPO_ROOT);
    expect(view.count).toBeGreaterThan(150); // ~181 today
    const sample = view.byId["ORG-PR-01"];
    expect(sample).toBeDefined();
    expect(sample?.citation).toContain("Banks Act");
    expect(sample?.requirement).toBeTruthy();
    expect(sample?.fulfilment).toBeTruthy();
  });

  it("derives source and bind classification from the citation", () => {
    const view = getObligationsView(REPO_ROOT);
    const cap = view.byId["ORG-PR-01"];
    expect(cap?.source).toBe("REGULATORY");
    expect(cap?.bind).toBe("LICENCE-BIND");
  });
});
