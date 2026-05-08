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
const REAL_REGISTER = join(REPO_ROOT, "Owner Inbox", "2026-05-06_policy-register.md");
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
      "| ID | Citation | Requirement | Fulfilment policy | Owner | Status |",
      "|---|---|---|---|---|---|",
      "| ORG-PR-01 | Banks Act | Capital adequacy | Credit Risk Policy; RAS | Helena | IN FORCE |",
      "| ORG-FC-01 | FIC Act | RMCP | Credit Risk Policy | Zara | IN FORCE |",
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
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
      expect(p.domain).toBeTruthy();
      expect(p.owner).toBeTruthy();
      expect(p.approval).toBeTruthy();
      expect(p.cadence).toBeTruthy();
      expect(p.citation).toBeTruthy();
      expect(p.statusRaw).toBeTruthy();
      expect(Array.isArray(p.sources)).toBe(true);
      expect(Array.isArray(p.binds)).toBe(true);
      expect(Array.isArray(p.linkedObligations)).toBe(true);
      expect(typeof p.mvp).toBe("boolean");
    }
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
