// tests/event-type-retention.test.ts
//
// D-EVENT-STORE-SCALING Slice 1 — exit-criterion test.
//
// Asserts that every row in EVENT_TYPE_REGISTRY carries non-null
// retention metadata, that the structured shape obeys the design-brief
// contract, and that the seven retention classes are coherent.
//
// Authority: D-EVENT-STORE-SCALING (CEO approved 2026-05-10).
// Decision record: Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-event-store-scaling.md
// Source brief: Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md §5
//
// Author: Atlas

import { describe, expect, it } from "bun:test";

import {
  EVENT_TYPE_REGISTRY,
  RETENTION_CONSERVATIVE_DEFAULT,
  type RetentionMetadata,
} from "../platform/event-store/registry";

const VALID_TIERS = ["hot-only", "hot-cool", "hot-cool-archive"] as const;
const VALID_TIER_SET: ReadonlySet<string> = new Set(VALID_TIERS);

function isRetentionMetadata(value: unknown): value is RetentionMetadata {
  if (!value || typeof value !== "object") return false;
  const v = value as Partial<RetentionMetadata>;
  return (
    typeof v.minimumYears === "number" &&
    typeof v.archivalTier === "string" &&
    typeof v.citationRef === "string"
  );
}

describe("D-EVENT-STORE-SCALING Slice 1 — retention metadata", () => {
  it("registry is non-empty (sanity)", () => {
    expect(EVENT_TYPE_REGISTRY.length).toBeGreaterThan(0);
  });

  it("every event-type row carries non-null retention metadata", () => {
    const missing = EVENT_TYPE_REGISTRY.filter((r) => !isRetentionMetadata(r.retention));
    expect(missing.map((r) => r.type)).toEqual([]);
  });

  it("every retention.minimumYears is a positive integer", () => {
    const bad = EVENT_TYPE_REGISTRY.filter(
      (r) => !Number.isInteger(r.retention.minimumYears) || r.retention.minimumYears <= 0,
    );
    expect(bad.map((r) => `${r.type}=${r.retention.minimumYears}`)).toEqual([]);
  });

  it("every retention.archivalTier is one of the three valid tiers", () => {
    const bad = EVENT_TYPE_REGISTRY.filter((r) => !VALID_TIER_SET.has(r.retention.archivalTier));
    expect(bad.map((r) => `${r.type}=${r.retention.archivalTier}`)).toEqual([]);
  });

  it("every retention.citationRef is a non-empty string (URN or routed-to-Mira marker)", () => {
    const bad = EVENT_TYPE_REGISTRY.filter(
      (r) => typeof r.retention.citationRef !== "string" || r.retention.citationRef.length === 0,
    );
    expect(bad.map((r) => r.type)).toEqual([]);
  });

  it("citation references are either a register URN or a registered route-to-Mira marker", () => {
    // Either an obligation-register URN-ish string (no leading bracket
    // marker) OR a "[register: route to Mira — ...]" marker. Both are
    // accepted at Slice 1 exit; the Vera Wave-4 #14 recon will turn
    // markers fail-closed once Mira lands the citation-population work.
    const malformed = EVENT_TYPE_REGISTRY.filter((r) => {
      const c = r.retention.citationRef;
      const isUrn = !c.startsWith("[") && c.length > 0;
      const isRouteMarker = c.startsWith("[register: route to Mira") && c.endsWith("]");
      return !(isUrn || isRouteMarker);
    });
    expect(malformed.map((r) => `${r.type}=${r.retention.citationRef}`)).toEqual([]);
  });

  it("RETENTION_CONSERVATIVE_DEFAULT exists and matches the design-brief shape", () => {
    expect(isRetentionMetadata(RETENTION_CONSERVATIVE_DEFAULT)).toBe(true);
    expect(RETENTION_CONSERVATIVE_DEFAULT.archivalTier).toBe("hot-cool-archive");
    expect(RETENTION_CONSERVATIVE_DEFAULT.minimumYears).toBeGreaterThanOrEqual(5);
  });

  it("registered types include the load-bearing classes (sanity coverage)", () => {
    // Sanity check that the registry actually wires the expected
    // classes — accounting (7y), JSE-trade (route-to-Mira), runtime
    // (1y), governance (route-to-Mira/7y), FIC (5y).
    const tiers = new Set(EVENT_TYPE_REGISTRY.map((r) => r.retention.archivalTier));
    expect(tiers.has("hot-cool-archive")).toBe(true);
    expect(tiers.has("hot-cool")).toBe(true);

    const minYears = new Set(EVENT_TYPE_REGISTRY.map((r) => r.retention.minimumYears));
    expect(minYears.has(1)).toBe(true);
    expect(minYears.has(5)).toBe(true);
    expect(minYears.has(7)).toBe(true);
  });
});
