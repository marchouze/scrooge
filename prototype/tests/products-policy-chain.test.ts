// tests/products-policy-chain.test.ts
//
// Resolver-level checks for the products /policy → procedure → function
// chain. Uses the real `/Policies/` + `/Procedures/` trees rather than a
// fixture so the assertions exercise the live frontmatter shape.

import { describe, expect, it } from "bun:test";
import { resolve } from "node:path";

import {
  parseSystemCapability,
  resetPolicyChainCacheForTests,
  resolveDimensionChain,
} from "../dashboard/products-policy-chain";

const REPO_ROOT = resolve(import.meta.dir, "..", "..");

describe("parseSystemCapability", () => {
  it("splits on +, ·, and the word `and`; extracts per-fragment status", () => {
    const parts = parseSystemCapability(
      "@platform/screening · @platform/case-management (PLANNED) and @platform/risk-rating (POPULATED)",
    );
    expect(parts.map((p) => p.name)).toEqual([
      "@platform/screening",
      "@platform/case-management",
      "@platform/risk-rating",
    ]);
    expect(parts.map((p) => p.status)).toEqual(["unknown", "planned", "populated"]);
  });

  it("returns an empty array for blank input", () => {
    expect(parseSystemCapability("")).toEqual([]);
    expect(parseSystemCapability("   ")).toEqual([]);
  });
});

describe("resolveDimensionChain — credit-risk on real Policies + Procedures", () => {
  it("anchors on the hint policy and surfaces in-force status", () => {
    resetPolicyChainCacheForTests();
    const chain = resolveDimensionChain({
      repoRoot: REPO_ROOT,
      policyHints: ["credit-risk-policy-v1.md"],
    });
    expect(chain.policies.length).toBe(1);
    const p = chain.policies[0];
    if (!p) throw new Error("expected at least one resolved policy");
    expect(p.filename).toBe("credit-risk-policy-v1.md");
    expect(p.title.toLowerCase()).toContain("credit risk");
    expect(p.source).toBe("hint");
    expect(p.status).toBe("in-force");
  });
});

describe("resolveDimensionChain — aml-cft anchor pulls KYC / PEP / UBO procedures", () => {
  it("matches procedures whose policy-cited references AML-CFT-POLICY-V1 and parses their functions", () => {
    resetPolicyChainCacheForTests();
    const chain = resolveDimensionChain({
      repoRoot: REPO_ROOT,
      policyHints: ["aml-cft-policy-v1.md"],
    });
    expect(chain.policies.length).toBe(1);
    // KYC, PEP and UBO procedures all cite AML-CFT-POLICY-V1.
    const procFiles = chain.procedures.map((p) => p.filename).sort();
    expect(procFiles).toContain("kyc-continuous.md");
    expect(procFiles).toContain("pep-handling.md");
    expect(procFiles).toContain("ubo-resolution.md");
    // Each matched procedure declares its anchor policy correctly.
    for (const proc of chain.procedures) {
      expect(proc.policiesCited).toContain("aml-cft-policy-v1.md");
    }
    // Events list is present (may be empty when no emits declared for this hint).
    expect(Array.isArray(chain.events)).toBe(true);
  });
});

describe("resolveDimensionChain — empty hints yields empty chain", () => {
  it("returns no policies / procedures / events when no hints are given", () => {
    resetPolicyChainCacheForTests();
    const chain = resolveDimensionChain({ repoRoot: REPO_ROOT, policyHints: [] });
    expect(chain.policies).toEqual([]);
    expect(chain.procedures).toEqual([]);
    expect(chain.events).toEqual([]);
  });
});

describe("listPolicies / listProcedures — register-shaped views", () => {
  it("listPolicies returns rows with status + owner + path", async () => {
    const { listPolicies } = await import("../dashboard/products-policy-chain");
    resetPolicyChainCacheForTests();
    const rows = listPolicies(REPO_ROOT);
    expect(rows.length).toBeGreaterThan(10);
    const creditRisk = rows.find((r) => r.filename === "credit-risk-policy-v1.md");
    expect(creditRisk).toBeDefined();
    expect(creditRisk?.status).toBe("in-force");
    expect(creditRisk?.owner.toLowerCase()).toContain("helena");
    expect(creditRisk?.path).toBe("Policies/credit-risk-policy-v1.md");
  });

  it("listProcedures returns rows with policy-cited + system-capability", async () => {
    const { listProcedures } = await import("../dashboard/products-policy-chain");
    resetPolicyChainCacheForTests();
    const rows = listProcedures(REPO_ROOT);
    expect(rows.length).toBeGreaterThan(5);
    const kyc = rows.find((r) => r.filename === "kyc-continuous.md");
    expect(kyc).toBeDefined();
    expect(kyc?.policyCited).toBe("AML-CFT-POLICY-V1");
    expect(kyc?.systemCapability).toContain("@platform/screening");
  });
});
