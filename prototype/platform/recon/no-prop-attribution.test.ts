// platform/recon/no-prop-attribution.test.ts
//
// Tests for the no-prop-attribution recon pipeline.
// Author: Vera (Internal audit engineer, governance)

import { describe, expect, it } from "bun:test";

import { classifyAttribution, run } from "./no-prop-attribution";

interface E {
  event_id: string;
  type: string;
  as_of: string;
  payload: Record<string, unknown>;
}

function fxTrade(args: {
  id: string;
  tradeRef?: string;
  asOf?: string;
  clientFlowRef?: string;
  hedgeProgrammeRef?: string;
}): E {
  const payload: Record<string, unknown> = {};
  if (args.tradeRef !== undefined) payload.tradeRef = args.tradeRef;
  if (args.clientFlowRef !== undefined) payload.clientFlowRef = args.clientFlowRef;
  if (args.hedgeProgrammeRef !== undefined) payload.hedgeProgrammeRef = args.hedgeProgrammeRef;
  return {
    event_id: args.id,
    type: "FxTradeExecuted",
    as_of: args.asOf ?? "2026-05-21T10:00:00Z",
    payload,
  };
}

describe("classifyAttribution", () => {
  it("returns ok when only clientFlowRef is present", () => {
    expect(classifyAttribution({ clientFlowRef: "client-trade:NK-1" }).kind).toBe("ok");
  });

  it("returns ok when only hedgeProgrammeRef is present", () => {
    expect(classifyAttribution({ hedgeProgrammeRef: "hedge-programme:zar-q2" }).kind).toBe("ok");
  });

  it("returns neither when both fields are absent", () => {
    expect(classifyAttribution({}).kind).toBe("neither");
  });

  it("returns both when both fields are non-empty strings", () => {
    expect(
      classifyAttribution({
        clientFlowRef: "client-trade:NK-1",
        hedgeProgrammeRef: "hedge-programme:zar-q2",
      }).kind,
    ).toBe("both");
  });

  it("returns empty-client-flow when clientFlowRef is empty string", () => {
    expect(classifyAttribution({ clientFlowRef: "" }).kind).toBe("empty-client-flow");
  });

  it("returns empty-hedge-programme when hedgeProgrammeRef is empty string", () => {
    expect(classifyAttribution({ hedgeProgrammeRef: "" }).kind).toBe("empty-hedge-programme");
  });
});

describe("recon:no-prop-attribution", () => {
  it("passes on a fresh bench (no FxTradeExecuted events)", () => {
    const r = run({ fxTradeEvents: [] });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(0);
    expect(r.violations).toHaveLength(0);
  });

  it("returns ok:false with 3 violations on the 5-event fixture (brief example)", () => {
    const r = run({
      fxTradeEvents: [
        fxTrade({ id: "t1", tradeRef: "NK-1", clientFlowRef: "client-trade:NK-1" }),
        fxTrade({
          id: "t2",
          tradeRef: "NK-2",
          hedgeProgrammeRef: "hedge-programme:zar-q2",
        }),
        // Violation 1: neither
        fxTrade({ id: "t3", tradeRef: "NK-3" }),
        // Violation 2: both
        fxTrade({
          id: "t4",
          tradeRef: "NK-4",
          clientFlowRef: "client-trade:NK-4",
          hedgeProgrammeRef: "hedge-programme:zar-q2",
        }),
        // Violation 3: empty string
        fxTrade({ id: "t5", tradeRef: "NK-5", clientFlowRef: "" }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.asserted).toBe(5);
    expect(r.violations).toHaveLength(3);
    const fails = r.violations.filter((v) => v.severity === "fail");
    expect(fails).toHaveLength(3);
  });

  it("emits a violation that names the offending event_id and tradeRef", () => {
    const r = run({
      fxTradeEvents: [fxTrade({ id: "evt-99", tradeRef: "NK-99" })],
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.subject).toContain("evt-99");
    expect(r.violations[0]?.subject).toContain("NK-99");
    expect(r.violations[0]?.message).toContain("NEITHER");
  });

  it("flags a 'both' violation distinctly from a 'neither' violation", () => {
    const r = run({
      fxTradeEvents: [
        fxTrade({
          id: "tboth",
          tradeRef: "B-1",
          clientFlowRef: "c",
          hedgeProgrammeRef: "h",
        }),
      ],
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.message).toContain("BOTH");
  });

  it("flags an empty-string attribution distinctly", () => {
    const r = run({
      fxTradeEvents: [fxTrade({ id: "tempty", tradeRef: "E-1", hedgeProgrammeRef: "" })],
    });
    expect(r.ok).toBe(false);
    expect(r.violations[0]?.message).toContain("EMPTY hedgeProgrammeRef");
  });

  it("passes when every event has exactly one attribution field set", () => {
    const r = run({
      fxTradeEvents: [
        fxTrade({ id: "t1", tradeRef: "NK-1", clientFlowRef: "client-trade:NK-1" }),
        fxTrade({
          id: "t2",
          tradeRef: "NK-2",
          hedgeProgrammeRef: "hedge-programme:zar-q2",
        }),
      ],
    });
    expect(r.ok).toBe(true);
    expect(r.asserted).toBe(2);
    expect(r.violations).toHaveLength(0);
  });
});
