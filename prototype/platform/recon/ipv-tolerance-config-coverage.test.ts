// platform/recon/ipv-tolerance-config-coverage.test.ts
//
// Unit tests for the ipv-tolerance-config-coverage recon pipeline.
//
// Authority:
//   - D-MR-1-FX-IPV-TOLERANCE-RECAL-2026-05-21 (CEO-approved 2026-05-21)
//   - brief:rohan:ipv-per-pair-tolerance-surface-and-shadow-mode-s:2026-05-21
//
// Author: Rohan (Market risk engineer, engineering)

import { describe, expect, it } from "bun:test";

import type { IpvToleranceConfig } from "../markets/ipv-tolerance";
import {
  assertConfigInvariants,
  assertTradedPairsCoverage,
  run,
} from "./ipv-tolerance-config-coverage";

const VALID_CONFIG: IpvToleranceConfig = {
  pairs: [
    { canonicalPair: "USD/ZAR", bpsThreshold: 0.0055, absoluteZarMinor: 5_000_000 },
    { canonicalPair: "EUR/ZAR", bpsThreshold: 0.004, absoluteZarMinor: 5_000_000 },
  ],
  defaultBpsThreshold: 0.004,
  defaultAbsoluteZarMinor: 5_000_000,
  mode: "shadow",
  cutoverDate: "2026-06-04",
};

describe("assertConfigInvariants", () => {
  it("passes on a valid config", () => {
    const v = assertConfigInvariants(VALID_CONFIG);
    expect(v).toHaveLength(0);
  });

  it("fails when defaultBpsThreshold is zero", () => {
    const v = assertConfigInvariants({ ...VALID_CONFIG, defaultBpsThreshold: 0 });
    expect(v.some((x) => x.subject === "config:defaultBpsThreshold" && x.severity === "fail")).toBe(
      true,
    );
  });

  it("fails when defaultAbsoluteZarMinor is negative", () => {
    const v = assertConfigInvariants({ ...VALID_CONFIG, defaultAbsoluteZarMinor: -1 });
    expect(
      v.some((x) => x.subject === "config:defaultAbsoluteZarMinor" && x.severity === "fail"),
    ).toBe(true);
  });

  it("fails when cutoverDate is not a valid ISO date", () => {
    const v = assertConfigInvariants({ ...VALID_CONFIG, cutoverDate: "soon" });
    expect(v.some((x) => x.subject === "config:cutoverDate" && x.severity === "fail")).toBe(true);
  });

  it("fails when cutoverDate is a real date in the wrong format", () => {
    const v = assertConfigInvariants({ ...VALID_CONFIG, cutoverDate: "04 June 2026" });
    expect(v.some((x) => x.subject === "config:cutoverDate" && x.severity === "fail")).toBe(true);
  });

  it("fails on duplicate per-pair canonical key", () => {
    const v = assertConfigInvariants({
      ...VALID_CONFIG,
      pairs: [
        { canonicalPair: "USD/ZAR", bpsThreshold: 0.0055, absoluteZarMinor: 5_000_000 },
        { canonicalPair: "USD/ZAR", bpsThreshold: 0.0099, absoluteZarMinor: 5_000_000 },
      ],
    });
    expect(
      v.some((x) => x.subject === "config:pairs:USD/ZAR:duplicate" && x.severity === "fail"),
    ).toBe(true);
  });

  it("fails when a per-pair bpsThreshold is zero", () => {
    const v = assertConfigInvariants({
      ...VALID_CONFIG,
      pairs: [{ canonicalPair: "USD/ZAR", bpsThreshold: 0, absoluteZarMinor: 5_000_000 }],
    });
    expect(
      v.some((x) => x.subject === "config:pairs:USD/ZAR:bpsThreshold" && x.severity === "fail"),
    ).toBe(true);
  });
});

describe("assertTradedPairsCoverage", () => {
  it("passes (no findings) when every traded pair has an explicit row", () => {
    const events = [
      { event_id: "e1", payload: { currencyPair: { base: "USD", quote: "ZAR" } } },
      { event_id: "e2", payload: { currencyPair: { base: "ZAR", quote: "USD" } } }, // canonicalises to USD/ZAR
      { event_id: "e3", payload: { currencyPair: { base: "EUR", quote: "ZAR" } } },
    ];
    const r = assertTradedPairsCoverage(events, VALID_CONFIG);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBe(2); // distinct canonical pairs
  });

  it("flags default-fallback canonical pair as info finding", () => {
    const events = [
      { event_id: "e1", payload: { currencyPair: { base: "GBP", quote: "ZAR" } } }, // not in VALID_CONFIG
    ];
    const r = assertTradedPairsCoverage(events, VALID_CONFIG);
    const infoForGbp = r.violations.find(
      (v) => v.subject === "traded-pair:GBP/ZAR:default-fallback",
    );
    expect(infoForGbp).toBeDefined();
    expect(infoForGbp?.severity).toBe("info");
    expect(r.asserted).toBe(1);
  });

  it("deduplicates default-fallback findings across multiple events of the same pair", () => {
    const events = [
      { event_id: "e1", payload: { currencyPair: { base: "GBP", quote: "ZAR" } } },
      { event_id: "e2", payload: { currencyPair: { base: "ZAR", quote: "GBP" } } }, // same canonical
      { event_id: "e3", payload: { currencyPair: { base: "GBP", quote: "ZAR" } } },
    ];
    const r = assertTradedPairsCoverage(events, VALID_CONFIG);
    const fallbackFindings = r.violations.filter(
      (v) => v.subject === "traded-pair:GBP/ZAR:default-fallback",
    );
    expect(fallbackFindings).toHaveLength(1);
    expect(r.asserted).toBe(1);
  });

  it("fails on missing base/quote on FxTradeExecuted", () => {
    const events = [
      { event_id: "broken", payload: { currencyPair: {} } }, // base + quote both absent
    ];
    const r = assertTradedPairsCoverage(events, VALID_CONFIG);
    const violation = r.violations.find((v) => v.subject === "FxTradeExecuted:broken:currencyPair");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("fail");
  });

  it("fails when toCanonicalPair throws (degenerate base=quote)", () => {
    const events = [{ event_id: "id", payload: { currencyPair: { base: "USD", quote: "USD" } } }];
    const r = assertTradedPairsCoverage(events, VALID_CONFIG);
    const violation = r.violations.find((v) => v.subject === "FxTradeExecuted:id:canonicalise");
    expect(violation).toBeDefined();
    expect(violation?.severity).toBe("fail");
  });

  it("is empty-state correct (no events → no findings, asserted=0)", () => {
    const r = assertTradedPairsCoverage([], VALID_CONFIG);
    expect(r.violations).toHaveLength(0);
    expect(r.asserted).toBe(0);
  });
});

describe("run (orchestration)", () => {
  it("returns ok=true when config is valid and traded pairs only produce info findings", () => {
    const events = [
      { event_id: "e1", payload: { currencyPair: { base: "AUD", quote: "ZAR" } } }, // default
    ];
    const r = run({ fxTradeExecutedEvents: events, config: VALID_CONFIG });
    expect(r.ok).toBe(true);
    // The AUD/ZAR default-fallback shows as info.
    expect(r.violations.some((v) => v.severity === "info")).toBe(true);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(false);
  });

  it("returns ok=false on a config-invariant fail", () => {
    const broken: IpvToleranceConfig = { ...VALID_CONFIG, defaultBpsThreshold: 0 };
    const r = run({ fxTradeExecutedEvents: [], config: broken });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  it("returns ok=true with empty events + valid config (empty-state)", () => {
    const r = run({ fxTradeExecutedEvents: [], config: VALID_CONFIG });
    expect(r.ok).toBe(true);
    expect(r.violations).toHaveLength(0);
  });
});
