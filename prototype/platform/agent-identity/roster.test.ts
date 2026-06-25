// platform/agent-identity/roster.test.ts
//
// Tests for the Slice-0 roster-sourced agentId resolver. Proves agentId is
// load-bearing and sourced from Team/_team-roster.json (not computed ad-hoc).
//
// Authority: D-AGENT-MEMORY-PERSISTENCE; WS-AGENT-MEMORY Slice 0.

import { describe, expect, it } from "bun:test";

import { agentIdForName, rosterAgentIds, slugifyAgentId, tryAgentIdForName } from "./roster";

describe("roster agentId resolver (Slice 0)", () => {
  it("every roster persona resolves to an `agent:<slug>` id", () => {
    const ids = rosterAgentIds();
    expect(ids.size).toBeGreaterThanOrEqual(31);
    for (const [name, id] of ids) {
      expect(id).toMatch(/^agent:[a-z0-9-]+$/);
      // The id is the slug of the name — the stable convention.
      expect(id).toBe(slugifyAgentId(name));
    }
  });

  it("resolves known personas case-insensitively", () => {
    expect(tryAgentIdForName("Atlas")).toBe("agent:atlas");
    expect(tryAgentIdForName("atlas")).toBe("agent:atlas");
    expect(tryAgentIdForName("Scrooge")).toBe("agent:scrooge");
    expect(agentIdForName("Vera")).toBe("agent:vera");
  });

  it("tryAgentIdForName returns undefined for an off-roster name", () => {
    expect(tryAgentIdForName("NotARealAgent")).toBeUndefined();
  });

  it("agentIdForName fails closed on an off-roster name", () => {
    expect(() => agentIdForName("NotARealAgent")).toThrow();
  });
});
