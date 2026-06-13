// v2-core/cross-tenant/cross-tenant.test.ts
//
// Unit tests for the V2 S12 CSI blocklist register + cross-tenant learning gate.
//
// The headline test is the SYNTHETIC LEAK: tenant A's position data flowing to
// tenant B's posture proposal MUST be blocked. The "sabotage" test removes the
// screen (empty / mis-built blocklist) and asserts the gate STILL fails closed —
// a gate that does not block a leak is worthless.
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE.
// Author: Atlas (Substrate Architect, engineering).

import { describe, expect, it } from "bun:test";

import type { CitationRef, Instant } from "../fil-core/primitives";
import {
  CSI_CATEGORY_CLASSES,
  CSI_SEED_CATEGORIES,
  type CsiBlocklistEventPayload,
} from "./csi-blocklist";
import {
  type LearningFlow,
  gateOutcomeEvent,
  screenCrossTenantLearningFlow,
} from "./gate";
import { emptyCsiBlocklist, foldCsiBlocklist } from "./projection";

const NOW = "2026-06-13T00:00:00.000Z" as Instant;

// Build the seeded blocklist (all canonical categories active).
function seededBlocklist() {
  const payloads: CsiBlocklistEventPayload[] = CSI_SEED_CATEGORIES.map((c) => ({
    kind: "CsiCategoryRegistered" as const,
    categoryId: c.categoryId,
    categoryClass: c.categoryClass,
    description: c.description,
    lawBasis: c.lawBasis,
    registeredBy: "Zara",
    citations: ["D-W7-VENDOR-ENTITY-STRUCTURE"] as CitationRef[],
  }));
  return foldCsiBlocklist(payloads);
}

describe("CSI blocklist register", () => {
  it("seed covers every CSI category class", () => {
    const bl = seededBlocklist();
    const activeClasses = bl.activeClasses();
    for (const cls of CSI_CATEGORY_CLASSES) {
      expect(activeClasses.has(cls)).toBe(true);
    }
    expect(bl.violations).toHaveLength(0);
  });

  it("every seed category carries a competition-law basis citing the Competition Act", () => {
    for (const c of CSI_SEED_CATEGORIES) {
      expect(c.lawBasis).toContain("Competition Act 89 of 1998");
    }
  });

  it("retirement folds a category to inactive (latest-wins)", () => {
    const payloads: CsiBlocklistEventPayload[] = [
      {
        kind: "CsiCategoryRegistered",
        categoryId: "csi:pnl:book-level",
        categoryClass: "pnl",
        description: "x",
        lawBasis: "Competition Act 89 of 1998 s.4(1)",
        registeredBy: "Zara",
        citations: ["D-W7-VENDOR-ENTITY-STRUCTURE"] as CitationRef[],
      },
      {
        kind: "CsiCategoryRetired",
        categoryId: "csi:pnl:book-level",
        retiredAt: NOW,
        reason: "counsel reclassified",
        authority: "CCO",
        citations: ["D-W7-VENDOR-ENTITY-STRUCTURE"] as CitationRef[],
      },
    ];
    const bl = foldCsiBlocklist(payloads);
    expect(bl.getCategory("csi:pnl:book-level")?.active).toBe(false);
    expect(bl.activeClasses().has("pnl")).toBe(false);
  });

  it("flags an orphan retirement as a fold violation", () => {
    const bl = foldCsiBlocklist([
      {
        kind: "CsiCategoryRetired",
        categoryId: "csi:ghost",
        retiredAt: NOW,
        reason: "x",
        authority: "CCO",
        citations: ["D-W7"] as CitationRef[],
      },
    ]);
    expect(bl.violations.length).toBeGreaterThan(0);
  });
});

describe("cross-tenant learning gate — fail-closed", () => {
  const bl = seededBlocklist();

  it("SYNTHETIC LEAK: tenant A position → tenant B posture is BLOCKED", () => {
    const leak: LearningFlow = {
      flowId: "flow:leak-1",
      sourceTenantId: "tenant:za-bank",
      destinationTenantId: "tenant:rival-bank",
      sinkKind: "posture",
      sinkRef: "posture:risk-appetite:fx-var",
      csiCategoriesPresent: ["positions-exposures"],
    };
    const r = screenCrossTenantLearningFlow(leak, bl);
    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("blocked");
    expect(r.blockedCategories).toContain("positions-exposures");
    // The surfaced event is a Blocked event (structured-first, not a silent redact).
    const ev = gateOutcomeEvent(leak, r, NOW);
    expect(ev.kind).toBe("CrossTenantLearningBlocked");
  });

  it("blocks every individual CSI class on a cross-tenant flow", () => {
    for (const cls of CSI_CATEGORY_CLASSES) {
      const flow: LearningFlow = {
        flowId: `flow:${cls}`,
        sourceTenantId: "tenant:a",
        destinationTenantId: "tenant:b",
        sinkKind: "fil-model",
        sinkRef: "fil:model:sa-ccr",
        csiCategoriesPresent: [cls],
      };
      const r = screenCrossTenantLearningFlow(flow, bl);
      expect(r.allowed).toBe(false);
      expect(r.blockedCategories).toContain(cls);
    }
  });

  it("FAIL-CLOSED on doubt: an unscreened (undefined) cross-tenant flow is BLOCKED", () => {
    const flow: LearningFlow = {
      flowId: "flow:unscreened",
      sourceTenantId: "tenant:a",
      destinationTenantId: "tenant:b",
      sinkKind: "applicability",
      sinkRef: "assessment:1",
      // csiCategoriesPresent intentionally omitted → unscreenable
    };
    const r = screenCrossTenantLearningFlow(flow, bl);
    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("blocked");
  });

  it("within-tenant flow is passed through (not subject to the gate)", () => {
    const flow: LearningFlow = {
      flowId: "flow:within",
      sourceTenantId: "tenant:za-bank",
      destinationTenantId: "tenant:za-bank",
      sinkKind: "posture",
      sinkRef: "posture:risk-appetite:fx-var",
      csiCategoriesPresent: ["positions-exposures"],
    };
    const r = screenCrossTenantLearningFlow(flow, bl);
    expect(r.allowed).toBe(true);
    expect(r.outcome).toBe("within-tenant-pass");
    expect(r.isCrossTenant).toBe(false);
  });

  it("clean cross-tenant flow (no blocklisted category) is CLEARED", () => {
    const flow: LearningFlow = {
      flowId: "flow:clean",
      sourceTenantId: "tenant:a",
      destinationTenantId: "tenant:b",
      sinkKind: "decision-impact",
      sinkRef: "sweep:1",
      csiCategoriesPresent: [], // screened, found nothing blocklisted
    };
    const r = screenCrossTenantLearningFlow(flow, bl);
    expect(r.allowed).toBe(true);
    expect(r.outcome).toBe("cleared");
  });

  // ---- SABOTAGE TEST -------------------------------------------------------
  // Remove the screen (empty blocklist). A correctly fail-closed gate STILL
  // refuses the cross-tenant flow because it cannot positively assert it is
  // clean. If this test ever passes the leak (allowed === true), the gate is
  // worthless and the recon gate must FAIL.
  it("SABOTAGE: with an empty blocklist the gate STILL fails closed", () => {
    const empty = emptyCsiBlocklist();
    const leak: LearningFlow = {
      flowId: "flow:sabotage",
      sourceTenantId: "tenant:a",
      destinationTenantId: "tenant:b",
      sinkKind: "posture",
      sinkRef: "posture:x",
      csiCategoriesPresent: ["positions-exposures"],
    };
    const r = screenCrossTenantLearningFlow(leak, empty);
    expect(r.allowed).toBe(false);
    expect(r.outcome).toBe("blocked");
  });
});
