// tests/agent-registry.test.ts
//
// Unit tests for A1.1 — the agent registry substrate.
//
// Asserts:
//   - The spec parser extracts the right fields from a canonical
//     17-section operating spec.
//   - The registry is idempotent on identical specHash (no event).
//   - The registry version-bumps on a different specHash (new event,
//     latest-wins-per-key on agentUrn).
//   - lookup() / list() are queries over the event log (P1).
//
// Author: Atlas (A1.1)

import { describe, expect, it } from "bun:test";

import { LocalAgentRegistry } from "../platform/agent-runtime/registry";
import { parseSpecContent } from "../platform/agent-runtime/spec-parser";
import { EventStore } from "../platform/event-store/store";

const SAMPLE_SPEC = `# Sample — Test agent

## 1. Identity

- **Name:** Sample
- **Role:** Test agent for the registry suite
- **Reports to:** Devon (COO)
- **Coordinated by:** Scrooge (Chief of Staff)

## 2. Persona

Tests the parser.

## 3. Mandate

A toy mandate.

## 4. Areas of expertise

- Testing.

## 5. Working style

- Deterministic.

## 6. Cadence

- **Mode:** Scheduled.
- **Schedule:** On every test run.
- **Inactivity SLA:** Nil.

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| Test trigger A | Test runner | 0s |
| Test trigger B | Test runner | 0s |
| Test trigger C | Test runner | 0s |

## 8. Inputs

- **Authoritative:** test event log.

## 9. Decisions in scope

| Decision | Criteria | Output |
|---|---|---|
| Approve A | Pass | \`ApprovedA\` event |
| Approve B | Pass | \`ApprovedB\` event |

## 10. Decisions that escalate

| Decision | Escalation criterion | Target overseer | Channel | Deadline |
|---|---|---|---|---|
| Escalate X | Critical | CEO | \`AgentEscalation\` | 24h |

## 11. Outputs

- **Events emitted:** \`ApprovedA\`, \`ApprovedB\`, \`AgentEscalation\`.
- **Registers maintained:** none.
- **Deliverables:** test report.

## 12. System capabilities called

- \`@platform/event-store\` — read / write.
- \`@platform/observability\` — logs.

## 13. Procedures owned

- \`Procedures/by-policy/test-procedure-a.md\` — owner.

## 14. Data contracts

- **Produces:** events listed in §11.
- **Consumes:** none.

## 15. Independence / conflicts

None.

## 16. Substrate gaps (current state)

- None.

## 17. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-01 | Test | Initial. |
| v1.0 | 2026-05-08 | Test | Operating-spec form. |
`;

describe("spec-parser", () => {
  it("parses the canonical 17-section operating spec", () => {
    const result = parseSpecContent("Sample", SAMPLE_SPEC, "/tmp/Sample.md");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const s = result.spec;
    expect(s.personaName).toBe("Sample");
    expect(s.agentUrn).toBe("agent:sample");
    expect(s.role).toBe("Test agent for the registry suite");
    expect(s.reportsTo).toBe("Devon (COO)");
    expect(s.cadenceMode).toBe("Scheduled.");
    expect(s.triggerCount).toBe(3);
    expect(s.decisionsInScopeCount).toBe(2);
    expect(s.decisionsEscalateCount).toBe(1);
    expect(s.systemCapabilities).toEqual(["@platform/event-store", "@platform/observability"]);
    expect(s.eventsEmitted).toEqual(["ApprovedA", "ApprovedB", "AgentEscalation"]);
    expect(s.proceduresOwned).toEqual(["Procedures/by-policy/test-procedure-a.md"]);
    expect(s.specVersion).toBe("v1.0");
    expect(s.specHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rejects a file missing §1 Identity", () => {
    const result = parseSpecContent(
      "Broken",
      "# Broken — no identity\n\nNothing.",
      "/tmp/Broken.md",
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("§1 Identity");
  });

  it("rejects a character-sheet-only persona (no §6 Cadence)", () => {
    const sheet = `# Sheet — character only

## 1. Identity

- **Name:** Sheet
- **Role:** Character-sheet persona
- **Reports to:** Nobody

## 2. Persona

Character.

## 3. Mandate

Character.
`;
    const result = parseSpecContent("Sheet", sheet, "/tmp/Sheet.md");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain("§6 Cadence");
  });
});

describe("LocalAgentRegistry", () => {
  function setup() {
    const store = new EventStore();
    const registry = new LocalAgentRegistry({
      eventStore: store,
      now: () => "2026-05-08T00:00:00.000Z",
    });
    const result = parseSpecContent("Sample", SAMPLE_SPEC, "/tmp/Sample.md");
    if (!result.ok) throw new Error(`fixture parse failed: ${result.reason}`);
    return { store, registry, spec: result.spec };
  }

  it("registers a fresh agent (emits AgentRegistered)", () => {
    const { store, registry, spec } = setup();
    const out = registry.register(spec);
    expect(out.status).toBe("registered");
    expect(out.eventEmitted).toBe(true);
    expect(out.urn).toBe("agent:sample");
    expect(store.count()).toBe(1);
    store.close();
  });

  it("is idempotent on identical specHash (no event)", () => {
    const { store, registry, spec } = setup();
    registry.register(spec);
    const second = registry.register(spec);
    expect(second.status).toBe("unchanged");
    expect(second.eventEmitted).toBe(false);
    expect(store.count()).toBe(1);
    store.close();
  });

  it("version-bumps on different specHash (new event)", () => {
    const { store, registry, spec } = setup();
    registry.register(spec);
    const updated = { ...spec, specHash: "f".repeat(64), cadenceMode: "Continuous." };
    const out = registry.register(updated);
    expect(out.status).toBe("updated");
    expect(out.eventEmitted).toBe(true);
    expect(store.count()).toBe(2);
    // lookup folds latest-wins.
    const latest = registry.lookup("agent:sample");
    expect(latest?.cadenceMode).toBe("Continuous.");
    expect(latest?.specHash).toBe("f".repeat(64));
    store.close();
  });

  it("list() returns one entry per urn, sorted by personaName", () => {
    const { store, registry, spec } = setup();
    registry.register(spec);
    // Register a second persona with a different name.
    const second = parseSpecContent(
      "Alpha",
      SAMPLE_SPEC.replace(/Sample/g, "Alpha"),
      "/tmp/Alpha.md",
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    registry.register(second.spec);
    const all = registry.list();
    expect(all.length).toBe(2);
    expect(all[0]?.personaName).toBe("Alpha");
    expect(all[1]?.personaName).toBe("Sample");
    store.close();
  });

  it("rejects malformed AgentRegistered payload at the event-store boundary", () => {
    // The EventStore's append path validates the typed payload via the
    // registry. A spec with an empty agentUrn must fail-closed.
    const { store, registry, spec } = setup();
    const bad = { ...spec, agentUrn: "" };
    expect(() => registry.register(bad)).toThrow();
    store.close();
  });
});
