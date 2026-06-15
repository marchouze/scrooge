// tests/product-construction-pr-c.test.ts
//
// PR-C exit-criterion tests: Product Register projection, NPA gate,
// and NPA gate recon.
//
// Authority:
//   - D-PRODUCT-CONSTRUCTION-SUBSTRATE (CEO-approved 2026-05-10)
//   - D-NEW-PRODUCT-APPROVAL-POLICY (CEO-approved 2026-05-10) §5
//
// Author: Atlas (substrate authority)

import { describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  makeProductConceptualised,
  makeProductDimensionAttested,
  makeProductLaunched,
  makeProductVersionPublished,
} from "../platform/event-store/event-types/product";
import { EventStore } from "../platform/event-store/store";
import type { NpaGateResult } from "../platform/markets/products/npa-gate";
import { validateNpaGate } from "../platform/markets/products/npa-gate";
import {
  ALL_NPA_DIMENSION_KEYS,
  buildProductRegisterView,
} from "../platform/projections/products/product-register";
import { run as runNpaGateRecon } from "../platform/recon/npa-gate-integrity";

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "test-actor" };
const ENTITY = "LE-TEST-BANK-ZA";
const CITATIONS = ["D-NEW-PRODUCT-APPROVAL-POLICY"];
const AS_OF = "2026-05-26T10:00:00Z";

function makeProductId(slug: string): string {
  return `prd:bank:test:${slug}`;
}

// ---------------------------------------------------------------------------
// Product Register projection
// ---------------------------------------------------------------------------

describe("Product Register projection", () => {
  it("empty input → empty map", () => {
    const register = buildProductRegisterView([]);
    expect(register.size).toBe(0);
  });

  it("ProductConceptualised → row with lifecycleStage 'conceptualised' and pendingDimensions.length === 15", () => {
    const productId = makeProductId("irs-01");
    const ev = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const register = buildProductRegisterView([ev]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    expect(row?.lifecycleStage).toBe("conceptualised");
    expect(row?.version).toBe("1.0.0");
    expect(row?.pendingDimensions.length).toBe(15);
    expect(row?.attestedDimensions.size).toBe(0);
  });

  it("ProductDimensionAttested → dimension appears in attestedDimensions", () => {
    const productId = makeProductId("irs-02");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const attested = makeProductDimensionAttested({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        dimension: "market-risk",
        result: "design-attested",
        citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
      },
    });
    const register = buildProductRegisterView([conceptualised, attested]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    expect(row?.attestedDimensions.has("market-risk")).toBe(true);
    expect(row?.pendingDimensions).not.toContain("market-risk");
    expect(row?.pendingDimensions.length).toBe(14);
  });

  it("ProductLaunched → lifecycleStage 'controlled-launch'", () => {
    const productId = makeProductId("irs-03");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const launched = makeProductLaunched({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        controlledLaunchLimits: {},
        launchedAt: AS_OF,
      },
    });
    const register = buildProductRegisterView([conceptualised, launched]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    expect(row?.lifecycleStage).toBe("controlled-launch");
  });

  it("ProductVersionPublished → version updated", () => {
    const productId = makeProductId("irs-04");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const versionPublished = makeProductVersionPublished({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        oldVersion: "1.0.0",
        newVersion: "1.1.0",
        materialChanges: ["Updated risk profile"],
      },
    });
    const register = buildProductRegisterView([conceptualised, versionPublished]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    expect(row?.version).toBe("1.1.0");
    // Stage is unchanged from conceptualised
    expect(row?.lifecycleStage).toBe("conceptualised");
  });
});

// ---------------------------------------------------------------------------
// NPA gate
// ---------------------------------------------------------------------------

describe("NPA gate", () => {
  it("no attestations → ready: false, missing.length === 15", () => {
    const productId = makeProductId("gate-01");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const register = buildProductRegisterView([conceptualised]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result = validateNpaGate(row as NonNullable<typeof row>);
    expect(result.ready).toBe(false);
    expect(result.missing.length).toBe(15);
  });

  it("all 15 attested → ready: true, missing: []", () => {
    const productId = makeProductId("gate-02");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const attestations = ALL_NPA_DIMENSION_KEYS.map((dimension) =>
      makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result: "implementation-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    );
    const register = buildProductRegisterView([conceptualised, ...attestations]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result = validateNpaGate(row as NonNullable<typeof row>);
    expect(result.ready).toBe(true);
    expect(result.missing.length).toBe(0);
  });

  it("13 attested → ready: false, missing.length === 2", () => {
    const productId = makeProductId("gate-03");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    // Attest 13 of the 15 dimensions (all except the last two).
    const dimensionsToAttest = ALL_NPA_DIMENSION_KEYS.slice(0, 13);
    const attestations = dimensionsToAttest.map((dimension) =>
      makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result: "implementation-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    );
    const register = buildProductRegisterView([conceptualised, ...attestations]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result = validateNpaGate(row as NonNullable<typeof row>);
    expect(result.ready).toBe(false);
    expect(result.missing.length).toBe(2);
  });

  // -------------------------------------------------------------------------
  // D-NPA-GATE-POLICY-REDESIGN tests
  // -------------------------------------------------------------------------

  it("design-attested with NO deferred gaps → ready: false (D-NPA-GATE-POLICY-REDESIGN)", () => {
    const productId = makeProductId("gate-04");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    // All 15 dimensions design-attested, NO deferredGaps.
    const attestations = ALL_NPA_DIMENSION_KEYS.map((dimension) =>
      makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result: "design-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
          // deferredGaps intentionally absent
        },
      }),
    );
    const register = buildProductRegisterView([conceptualised, ...attestations]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result: NpaGateResult = validateNpaGate(row as NonNullable<typeof row>);
    // design-attested with no gaps → blocked
    expect(result.ready).toBe(false);
    expect(result.missing.length).toBe(15);
    expect(result.openConditions.length).toBe(0);
  });

  it("design-attested WITH deferred gaps → ready: true, openConditions populated (D-NPA-GATE-POLICY-REDESIGN)", () => {
    const productId = makeProductId("gate-05");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const attestations = ALL_NPA_DIMENSION_KEYS.map((dimension) =>
      makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result: "design-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
          deferredGaps: [
            {
              gapId: "test-gap",
              title: "Test gap",
              owner: "agent:atlas:substrate",
              targetTrigger: "go-live",
              citations: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
            },
          ],
        },
      }),
    );
    const register = buildProductRegisterView([conceptualised, ...attestations]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result: NpaGateResult = validateNpaGate(row as NonNullable<typeof row>);
    // design-attested with gaps → allowed but conditioned
    expect(result.ready).toBe(true);
    expect(result.missing.length).toBe(0);
    expect(result.openConditions.length).toBe(15);
  });

  it("failed dimension → ready: false, dimension appears in missing (D-NPA-GATE-POLICY-REDESIGN)", () => {
    const productId = makeProductId("gate-06");
    const conceptualised = makeProductConceptualised({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        productId,
        version: "1.0.0",
        cdmComposition: {},
        lifecycleEventFamily: [],
      },
    });
    const attestations = ALL_NPA_DIMENSION_KEYS.map((dimension) =>
      makeProductDimensionAttested({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          dimension,
          result: dimension === "market-risk" ? "failed" : "implementation-attested",
          citationChain: ["D-NEW-PRODUCT-APPROVAL-POLICY"],
        },
      }),
    );
    const register = buildProductRegisterView([conceptualised, ...attestations]);
    const row = register.get(productId);
    expect(row).toBeDefined();
    const result: NpaGateResult = validateNpaGate(row as NonNullable<typeof row>);
    expect(result.ready).toBe(false);
    expect(result.missing).toContain("market-risk");
    expect(result.missing.length).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// NPA gate recon
// ---------------------------------------------------------------------------

describe("NPA gate recon", () => {
  it("no controlled-launch products → ok: true, violations with severity 'fail': 0", () => {
    // Use a temp file-backed store (the recon skips :memory: path that doesn't exist on disk).
    const tmpDir = mkdtempSync(join(tmpdir(), "bank-test-"));
    const dbPath = join(tmpDir, "event.db");
    try {
      const store = new EventStore(dbPath);
      // No product events → ok.
      void store; // store created, nothing appended
      const result = runNpaGateRecon({ dbPath });
      expect(result.ok).toBe(true);
      const failViolations = result.violations.filter((v) => v.severity === "fail");
      expect(failViolations.length).toBe(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("controlled-launch product missing attestations → ok: false, violations > 0", () => {
    const tmpDir = mkdtempSync(join(tmpdir(), "bank-test-"));
    const dbPath = join(tmpDir, "event.db");
    try {
      const store = new EventStore(dbPath);
      const productId = makeProductId("recon-01");

      // Emit: conceptualised then launched — but NO dimension attestations.
      const conceptualised = makeProductConceptualised({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          version: "1.0.0",
          cdmComposition: {},
          lifecycleEventFamily: [],
        },
      });
      const launched = makeProductLaunched({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          productId,
          version: "1.0.0",
          controlledLaunchLimits: {},
          launchedAt: AS_OF,
        },
      });

      store.append(conceptualised);
      store.append(launched);

      const result = runNpaGateRecon({ dbPath });
      expect(result.ok).toBe(false);
      const failViolations = result.violations.filter((v) => v.severity === "fail");
      expect(failViolations.length).toBeGreaterThan(0);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
