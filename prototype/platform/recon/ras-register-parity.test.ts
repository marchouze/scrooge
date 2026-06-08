// platform/recon/ras-register-parity.test.ts
//
// Pins the RAS appetite-register parity gate (D-RAS-STRUCTURED-REGISTER).
//
// Author: Atlas (Substrate engineer, engineering).

import { describe, expect, it } from "bun:test";

import { RAS_APPETITE_LINE_IDS } from "../risk/ras-appetite-register";
import { run } from "./ras-register-parity";

const ASOF = "2026-06-08T08:00:00.000Z";

// A synthetic snapshot whose lineStatuses keyset == the register keyset.
function snapshotWithKeys(ids: readonly string[]) {
  const lineStatuses: Record<string, string> = {};
  for (const id of ids) lineStatuses[id] = "green";
  return [{ event_id: "ev:test", as_of: ASOF, payload: { lineStatuses } }];
}

describe("ras-register-parity recon", () => {
  it("passes: clean register, no runtime shadow, matching snapshot keyset", () => {
    const r = run({
      events: snapshotWithKeys(RAS_APPETITE_LINE_IDS),
      runtimeSources: [
        {
          path: "runtime/agents/helena-risk-appetite-watch.ts",
          content: "import { RAS_APPETITE_LINES } from '...';",
        },
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.violations.filter((v) => v.severity === "fail")).toHaveLength(0);
  });

  it("fails (b): a runtime handler re-defines an appetite-line literal", () => {
    const r = run({
      events: snapshotWithKeys(RAS_APPETITE_LINE_IDS),
      runtimeSources: [
        {
          path: "runtime/agents/rogue-handler.ts",
          content: 'const X = [{ id: "appetite:liquidity:lcr", tier: "tier-1" }];',
        },
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("re-defines an appetite line"))).toBe(true);
  });

  it("fails (c): snapshot keyset drifts from the register keyset", () => {
    const r = run({
      events: snapshotWithKeys(RAS_APPETITE_LINE_IDS.slice(0, -1)), // drop one line
      runtimeSources: [],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("absent from the latest snapshot"))).toBe(
      true,
    );
  });

  it("fails (c): snapshot carries an id absent from the register", () => {
    const r = run({
      events: snapshotWithKeys([...RAS_APPETITE_LINE_IDS, "appetite:bogus:line"]),
      runtimeSources: [],
    });
    expect(r.ok).toBe(false);
    expect(r.violations.some((v) => v.message.includes("absent from the register"))).toBe(true);
  });

  it("softens to info when the store has no snapshots (live mode, empty bench)", () => {
    // No `events` override → reads the live store. On a fresh bench with no
    // snapshots this is info, not fail. (a)+(b) still assert against real data.
    const r = run({ runtimeSources: [] });
    // ok must hold regardless — register citations are intact and no shadow
    // is supplied. The snapshot assertion is info-or-pass.
    expect(r.violations.every((v) => v.severity !== "fail")).toBe(true);
  });
});
