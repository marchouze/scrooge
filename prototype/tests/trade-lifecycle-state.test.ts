// tests/trade-lifecycle-state.test.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR4 — the registry-driven lifecycle
// resolver. Asserts uniform live/matured/settled/cancelled resolution across
// products, and the key cross-format case: an FX opening carrying a CDM
// `tradeId.value` object closed by a terminal carrying a plain-string `tradeId`.
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import { describe, expect, it } from "bun:test";

import {
  extractInstanceId,
  isLiveInstance,
  liveInstanceIds,
  resolveTradeLifecycle,
} from "../platform/lifecycle/trade-lifecycle-state";

let seq = 0;
function ev(type: string, payload: Record<string, unknown>) {
  seq += 1;
  return { type, event_id: `e${seq}`, payload };
}

describe("extractInstanceId", () => {
  it("resolves a plain-string field", () => {
    expect(extractInstanceId({ depositId: "D1" }, "depositId")).toBe("D1");
  });
  it("resolves a CDM identifier object via the base field", () => {
    expect(extractInstanceId({ tradeId: { value: "FX1" } }, "tradeId")).toBe("FX1");
  });
  it("returns undefined when absent", () => {
    expect(extractInstanceId({}, "tradeId")).toBeUndefined();
  });
});

describe("resolveTradeLifecycle — per product", () => {
  it("MMD deposit: live until DepositMatured (matured) / DepositWithdrawnEarly (cancelled)", () => {
    const idx = resolveTradeLifecycle([
      ev("DepositTaken", { depositId: "D1" }),
      ev("DepositTaken", { depositId: "D2" }),
      ev("DepositTaken", { depositId: "D3" }),
      ev("DepositMatured", { depositId: "D2" }),
      ev("DepositWithdrawnEarly", { depositId: "D3" }),
    ]);
    expect(idx.get("D1")?.state).toBe("live");
    expect(idx.get("D2")?.state).toBe("matured");
    expect(idx.get("D3")?.state).toBe("cancelled");
    expect([...liveInstanceIds(idx)]).toEqual(["D1"]);
  });

  it("repo: live until RepoEndLegSettled (settled) / RepoTradeTerminatedEarly (cancelled)", () => {
    const idx = resolveTradeLifecycle([
      ev("RepoTradeOpened", { tradeId: "R1" }),
      ev("RepoTradeOpened", { tradeId: "R2" }),
      ev("RepoEndLegSettled", { tradeId: "R1" }),
      ev("RepoTradeTerminatedEarly", { tradeId: "R2" }),
    ]);
    expect(idx.get("R1")?.state).toBe("settled");
    expect(idx.get("R2")?.state).toBe("cancelled");
    expect(liveInstanceIds(idx).size).toBe(0);
  });

  it("IBL: placementId field; live until InterbankLoanMatured / RecalledEarly", () => {
    const idx = resolveTradeLifecycle([
      ev("InterbankLoanPlaced", { placementId: "P1" }),
      ev("InterbankLoanPlaced", { placementId: "P2" }),
      ev("InterbankLoanRecalledEarly", { placementId: "P2" }),
    ]);
    expect(idx.get("P1")?.state).toBe("live");
    expect(idx.get("P2")?.state).toBe("cancelled");
  });
});

describe("resolveTradeLifecycle — FX CDM id vs plain-string terminal", () => {
  it("matches an FX opening's tradeId.value to a terminal's plain-string tradeId", () => {
    const idx = resolveTradeLifecycle([
      ev("FxTradeExecuted", { tradeId: { value: "FX1" } }),
      ev("FxTradeExecuted", { tradeId: { value: "FX2" } }),
      ev("FxTradeExecuted", { tradeId: { value: "FX3" } }),
      ev("SettlementConfirmed", { tradeId: "FX1" }),
      ev("FxTradeCancelled", { tradeId: "FX2" }),
    ]);
    expect(idx.get("FX1")?.state).toBe("settled");
    expect(idx.get("FX2")?.state).toBe("cancelled");
    expect(idx.get("FX3")?.state).toBe("live");
    expect(isLiveInstance(idx.get("FX3"))).toBe(true);
    expect(isLiveInstance(idx.get("FX1"))).toBe(false);
  });
});

describe("resolveTradeLifecycle — edge cases", () => {
  it("terminal observed without an opening still records the closed state", () => {
    const idx = resolveTradeLifecycle([ev("DepositMatured", { depositId: "D9" })]);
    expect(idx.get("D9")?.state).toBe("matured");
    expect(idx.get("D9")?.openingEventId).toBe("");
  });

  it("terminal wins regardless of order; re-opening does not revive a closed instance", () => {
    const idx = resolveTradeLifecycle([
      ev("DepositWithdrawnEarly", { depositId: "D1" }),
      ev("DepositTaken", { depositId: "D1" }),
    ]);
    expect(idx.get("D1")?.state).toBe("cancelled");
  });
});
