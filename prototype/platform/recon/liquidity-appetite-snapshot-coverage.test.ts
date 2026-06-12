// platform/recon/liquidity-appetite-snapshot-coverage.test.ts
//
// Unit tests for the liquidity-appetite snapshot coverage recon.
//
// Tests use the synthetic `RunOpts.events` mode to avoid touching the
// global event store. Synthetic empty IS a hard failure (test-author
// asked); live empty is a soft skip handled in run().
//
// Author: Ravi (Treasury and ALM engineer, engineering)

import { describe, expect, it } from "bun:test";

import { run } from "./liquidity-appetite-snapshot-coverage";

const NOW = "2026-05-21T12:00:00.000Z";
const EARLIER = "2026-05-20T12:00:00.000Z";

function snap(
  asOf: string,
  lineStatuses: Record<string, string> | undefined,
): {
  event_id: string;
  type: string;
  as_of: string;
  payload: { lineStatuses?: unknown };
} {
  return {
    event_id: `evt-${asOf}`,
    type: "RiskAppetiteSnapshot",
    as_of: asOf,
    payload: lineStatuses === undefined ? {} : { lineStatuses },
  };
}

// ---------------------------------------------------------------------------
// 1. Latest snapshot carries measured LCR + NSFR → ok.
// ---------------------------------------------------------------------------

describe("recon:liquidity-appetite-snapshot-coverage", () => {
  it("passes when latest snapshot has measured LCR + NSFR", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:lcr": "green",
        "appetite:liquidity:nsfr": "green",
        "appetite:capital:cet1-buffer": "green",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("passes when LCR=amber and NSFR=red (both measured)", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:lcr": "amber",
        "appetite:liquidity:nsfr": "red",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 2. Latest snapshot has unmeasured LCR → fail.
  // -------------------------------------------------------------------------

  it("fails when latest snapshot has unmeasured LCR line", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:lcr": "unmeasured",
        "appetite:liquidity:nsfr": "green",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fail = r.violations.find(
      (v) => v.severity === "fail" && v.subject.includes("appetite:liquidity:lcr"),
    );
    expect(fail).toBeDefined();
  });

  it("fails when latest snapshot has unmeasured NSFR line", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:lcr": "green",
        "appetite:liquidity:nsfr": "unmeasured",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fail = r.violations.find(
      (v) => v.severity === "fail" && v.subject.includes("appetite:liquidity:nsfr"),
    );
    expect(fail).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 3. Latest snapshot lacks LCR/NSFR line entirely → fail.
  // -------------------------------------------------------------------------

  it("fails when LCR line is missing from the snapshot's lineStatuses map", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:nsfr": "green",
        "appetite:capital:cet1-buffer": "green",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fail = r.violations.find(
      (v) => v.severity === "fail" && v.subject.includes("appetite:liquidity:lcr"),
    );
    expect(fail).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // 4. Latest snapshot lacks lineStatuses payload field → fail.
  // -------------------------------------------------------------------------

  it("fails when lineStatuses payload field is missing", () => {
    const events = [snap(NOW, undefined)];
    const r = run({ events });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail" && /lineStatuses/.test(v.message))).toBe(
      true,
    );
  });

  // -------------------------------------------------------------------------
  // 5. Empty synthetic event set → fail (test-author asked the question).
  // -------------------------------------------------------------------------

  it("fails when synthetic event list is empty", () => {
    const r = run({ events: [] });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.severity === "fail")).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 6. Latest-by-asOf semantics: an earlier failing snapshot is ignored if
  //    the latest snapshot is measured.
  // -------------------------------------------------------------------------

  it("evaluates only the latest snapshot (by as_of)", () => {
    const events = [
      snap(EARLIER, {
        "appetite:liquidity:lcr": "unmeasured",
        "appetite:liquidity:nsfr": "unmeasured",
      }),
      snap(NOW, {
        "appetite:liquidity:lcr": "green",
        "appetite:liquidity:nsfr": "green",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 7. n/a-build-phase counts as measured (consistent with Helena's taxonomy).
  // -------------------------------------------------------------------------

  it("accepts n/a-build-phase as a measured status", () => {
    const events = [
      snap(NOW, {
        "appetite:liquidity:lcr": "n/a-build-phase",
        "appetite:liquidity:nsfr": "n/a-build-phase",
      }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
  });

  // -------------------------------------------------------------------------
  // 8. RAS §B4 ΔEVE line (D-IRRBB-DELTA-EVE-OUTLIER-MEASUREMENT, 2026-06-12).
  //    Post-cutover snapshots must report a measured §B4 status; pre-cutover
  //    snapshots soften to info (they predate the wiring).
  // -------------------------------------------------------------------------

  const POST_CUTOVER = "2026-06-13T05:00:00.000Z";
  const MEASURED_B3 = {
    "appetite:liquidity:lcr": "green",
    "appetite:liquidity:nsfr": "green",
  };

  it("passes when a post-cutover snapshot carries a measured §B4 ΔEVE status", () => {
    const events = [
      snap(POST_CUTOVER, { ...MEASURED_B3, "appetite:irrbb:delta-eve-outlier": "green" }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail").length).toBe(0);
  });

  it("fails when a post-cutover snapshot reports §B4 ΔEVE as unmeasured (regression gate)", () => {
    const events = [
      snap(POST_CUTOVER, { ...MEASURED_B3, "appetite:irrbb:delta-eve-outlier": "unmeasured" }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fail = r.violations.find(
      (v) => v.severity === "fail" && v.subject.includes("appetite:irrbb:delta-eve-outlier"),
    );
    expect(fail).toBeDefined();
    expect(fail?.message).toContain("irrbb-delta-eve");
  });

  it("fails when a post-cutover snapshot omits the §B4 ΔEVE line entirely", () => {
    const events = [snap(POST_CUTOVER, { ...MEASURED_B3 })];
    const r = run({ events });
    expect(r.ok).toBe(false);
    const fail = r.violations.find(
      (v) => v.severity === "fail" && v.subject.includes("appetite:irrbb:delta-eve-outlier"),
    );
    expect(fail).toBeDefined();
  });

  it("softens to info (still ok) when the latest snapshot predates the §B4 wiring cutover", () => {
    const events = [
      snap(NOW, { ...MEASURED_B3, "appetite:irrbb:delta-eve-outlier": "unmeasured" }),
    ];
    const r = run({ events });
    expect(r.ok).toBe(true);
    const info = r.violations.find(
      (v) => v.severity === "info" && v.subject.includes("appetite:irrbb:delta-eve-outlier"),
    );
    expect(info).toBeDefined();
  });
});
