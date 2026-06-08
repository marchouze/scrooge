// platform/regulatory/graph/capability-parser.test.ts
//
// Unit tests for the capability slug rule — the single shared derivation used
// by the graph seeder (seed-projection.ts Step 10b) and recon:orphan-capability.
// The slug rule must be deterministic and reversible; these tests pin that.
//
// Authority: D-PRINCIPLE-2-CAPABILITY-LAYER (CEO-approved 2026-06-08).
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, it } from "bun:test";
import { capabilitySlug, capabilityUrn, parseSystemCapabilityValue } from "./capability-parser";

describe("capabilitySlug", () => {
  it("strips the @ namespace sigil and keeps the rest of the path", () => {
    expect(capabilitySlug("@platform/markets/cdm/fx")).toBe("platform/markets/cdm/fx");
  });

  it("strips a leading prototype/ segment and the trailing .ts extension", () => {
    expect(capabilitySlug("prototype/platform/projections/climate-risk-projection.ts")).toBe(
      "platform/projections/climate-risk-projection",
    );
  });

  it("strips a trailing (PLANNED) marker", () => {
    expect(capabilitySlug("@platform/markets/mandate-registry (PLANNED)")).toBe(
      "platform/markets/mandate-registry",
    );
  });

  it("strips a trailing (LIVE — handler) note", () => {
    expect(capabilitySlug("@platform/ilaap (LIVE — atlas:ilaap-run handler)")).toBe(
      "platform/ilaap",
    );
  });

  it("strips a parenthetical with an em-dash and PLANNED", () => {
    expect(capabilitySlug("@domains/onboarding/verify (DHA adapter — PLANNED)")).toBe(
      "domains/onboarding/verify",
    );
  });

  it("is reversible — prepending @ recovers the source reference shape", () => {
    const slug = capabilitySlug("@platform/markets/cdm/fx");
    expect(`@${slug}`).toBe("@platform/markets/cdm/fx");
  });
});

describe("parseSystemCapabilityValue", () => {
  it("splits on · and + and trims", () => {
    const caps = parseSystemCapabilityValue(
      "@platform/markets/cdm/fx + @platform/markets/eod/fx-revaluation · @platform/finance/ifrs9/classifier",
    );
    expect(caps.map((c) => c.slug)).toEqual([
      "platform/markets/cdm/fx",
      "platform/markets/eod/fx-revaluation",
      "platform/finance/ifrs9/classifier",
    ]);
  });

  it("marks a token as planned only when it carries (PLANNED)", () => {
    const caps = parseSystemCapabilityValue(
      "@platform/markets/conduct-gate (PLANNED) · @platform/risk/credit-limit-engine",
    );
    const byslug = new Map(caps.map((c) => [c.slug, c]));
    expect(byslug.get("platform/markets/conduct-gate")?.status).toBe("planned");
    expect(byslug.get("platform/risk/credit-limit-engine")?.status).toBe("live");
  });

  it("strips surrounding quotes the YAML scalar may carry", () => {
    const caps = parseSystemCapabilityValue('"@platform/governance/go-live-gate (PLANNED)"');
    expect(caps).toHaveLength(1);
    expect(caps[0]?.slug).toBe("platform/governance/go-live-gate");
  });

  it("deduplicates by slug; a live sighting upgrades a planned duplicate", () => {
    const caps = parseSystemCapabilityValue("@platform/foo (PLANNED) · @platform/foo");
    expect(caps).toHaveLength(1);
    expect(caps[0]?.status).toBe("live");
  });

  it("builds a valid urn:capability:bank URN", () => {
    expect(capabilityUrn("platform/markets/cdm/fx")).toBe(
      "urn:capability:bank:platform/markets/cdm/fx",
    );
  });

  it("returns empty for an empty value", () => {
    expect(parseSystemCapabilityValue("")).toEqual([]);
    expect(parseSystemCapabilityValue('""')).toEqual([]);
  });

  it("splits on ; (folded YAML block-scalar list separator)", () => {
    const caps = parseSystemCapabilityValue(
      "@platform/markets/repo-oms (PLANNED); @platform/markets/margin-call-engine (PLANNED)",
    );
    expect(caps.map((c) => c.slug)).toEqual([
      "platform/markets/repo-oms",
      "platform/markets/margin-call-engine",
    ]);
  });

  it("drops a trailing decorative marker (e.g. ✓) after the path", () => {
    const caps = parseSystemCapabilityValue("prototype/platform/document-store ✓");
    expect(caps).toHaveLength(1);
    expect(caps[0]?.slug).toBe("platform/document-store");
  });
});
