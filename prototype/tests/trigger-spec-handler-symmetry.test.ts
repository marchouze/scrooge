// tests/trigger-spec-handler-symmetry.test.ts
//
// Unit + integration tests for D-AGENT-AUTONOMY-OPERATIONAL Slice 2 —
// trigger-spec ↔ handler-metadata symmetry recon.
//
// - Parser unit tests against fixture §7 markdown bodies.
// - Diff unit tests against synthetic spec-trigger + handler lists.
// - Integration smoke against current repo: pipeline runs, returns
//   ok: true, finding count > 0 (build-phase visibility — exact count
//   drifts as Slice 2b remediation lands).
//
// Author: Atlas (Core banking platform architect; substrate)

import { describe, expect, it } from "bun:test";

import type { HandlerMetadata } from "../runtime/handlers-metadata";
import {
  buildBreakdown,
  extractEventTypes,
  parseTriggersSection,
  run as triggerSpecHandlerSymmetry,
  type SpecTrigger,
} from "../platform/recon/trigger-spec-handler-symmetry";

// ---------------------------------------------------------------------
// Fixture: a minimal persona-spec body with §7 + a few §8 lines so the
// parser sees the boundary.
// ---------------------------------------------------------------------

const FIXTURE_VERA_BODY = `# Vera

## 6. Cadence

- Mode: Hybrid

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| PR opened on any tracked repo path | Git substrate | 5 minutes |
| Nightly scheduler 02:00 UTC | Runtime scheduler | 1h |
| Quarter-end | Runtime scheduler | 5 working days |
| \`CeoDecision\` event | Event store | 1h |
| Fail-severity finding from any pipeline | Pipeline event stream | 1h |

## 8. Inputs

Foo.
`;

// Fixture with multiple events in one row and one with a non-event token
// (a handler key) that MUST be ignored by the event extractor.
const FIXTURE_ANYA_BODY = `# Anya

## 7. Triggers

| Trigger | Source | Response SLA |
|---|---|---|
| Scheduled wake-up — daily 06:00 UTC drift sweep (\`anya:projection-drift\`) | Runtime scheduler | 5 minutes |
| \`SubstrateStateSnapshot\` event | Event store | 60 seconds |
| \`WorkstreamRegistered\` / \`WorkstreamCompleted\` events | Event store | 60 seconds |
| Inbound projection request — any governance head | Owner Inbox | 2 working days |

## 8. Inputs

Bar.
`;

describe("§7 table parser", () => {
  it("classifies a typed-event row as event-driven and extracts the event name", () => {
    const triggers = parseTriggersSection("Vera", FIXTURE_VERA_BODY);
    const ceoRow = triggers.find((t) => t.eventTypes.includes("CeoDecision"));
    expect(ceoRow).toBeDefined();
    expect(ceoRow?.kind).toBe("event-driven");
    expect(ceoRow?.eventTypes).toEqual(["CeoDecision"]);
  });

  it("classifies cadence rows as scheduled (Nightly + Quarter-end + 02:00 UTC)", () => {
    const triggers = parseTriggersSection("Vera", FIXTURE_VERA_BODY);
    const scheduled = triggers.filter((t) => t.kind === "scheduled");
    // Nightly scheduler 02:00 UTC, Quarter-end → 2 scheduled rows.
    // (Some rows are "other" — PR opened, fail-severity finding.)
    expect(scheduled.length).toBeGreaterThanOrEqual(2);
  });

  it("classifies prose-only rows (no event, no cadence) as 'other'", () => {
    const triggers = parseTriggersSection("Vera", FIXTURE_VERA_BODY);
    const other = triggers.filter((t) => t.kind === "other");
    expect(other.length).toBeGreaterThan(0);
    expect(other.some((t) => t.rawTrigger.includes("PR opened"))).toBe(true);
  });

  it("extracts multiple events from a `/`-separated row", () => {
    const triggers = parseTriggersSection("Anya", FIXTURE_ANYA_BODY);
    const multi = triggers.find((t) => t.eventTypes.includes("WorkstreamRegistered"));
    expect(multi).toBeDefined();
    expect(multi?.eventTypes.sort()).toEqual(
      ["WorkstreamCompleted", "WorkstreamRegistered"].sort(),
    );
  });

  it("ignores backticked handler keys (kebab-case / colon) — not typed events", () => {
    // The Anya fixture has `anya:projection-drift` in a backtick — it
    // MUST NOT be picked up as an event-type. Only `SubstrateStateSnapshot`
    // and friends qualify.
    const events = extractEventTypes(
      "Scheduled wake-up — daily 06:00 UTC drift sweep (`anya:projection-drift`)",
    );
    expect(events).toEqual([]);
  });

  it("returns empty when §7 section is absent", () => {
    expect(parseTriggersSection("Phantom", "# Persona\n\nNo section 7 here.")).toEqual([]);
  });

  it("tolerates `## 7 Triggers` (no dot) heading variant", () => {
    const body = `# X

## 7 Triggers

| Trigger | Source | SLA |
|---|---|---|
| \`AlphaEvent\` | foo | bar |

## 8. Inputs
`;
    const triggers = parseTriggersSection("X", body);
    expect(triggers.length).toBe(1);
    expect(triggers[0]?.eventTypes).toEqual(["AlphaEvent"]);
  });
});

// ---------------------------------------------------------------------
// Diff tests — synthetic spec triggers vs synthetic handler metadata.
// ---------------------------------------------------------------------

function specRow(
  persona: string,
  rawTrigger: string,
  kind: SpecTrigger["kind"],
  eventTypes: readonly string[] = [],
): SpecTrigger {
  return { persona, rawTrigger, kind, eventTypes };
}

function handler(
  agent: string,
  trigger: string,
  kind: HandlerMetadata["kind"],
  extras: Partial<HandlerMetadata> = {},
): HandlerMetadata {
  return {
    agent,
    trigger,
    kind,
    key: `${agent.toLowerCase()}:${trigger}`,
    ...extras,
  };
}

describe("diff — spec → handler", () => {
  it("flags an event-driven §7 row with no subscribing handler (warn)", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [specRow("Vera", "`CeoDecision` event", "event-driven", ["CeoDecision"])],
      handlersMetadata: [],
    });
    expect(r.ok).toBe(true); // build-phase tolerance
    expect(r.violations.length).toBe(1);
    expect(r.violations[0]?.severity).toBe("warn");
    expect(r.violations[0]?.subject).toBe("Vera:event-driven:CeoDecision");
    expect(r.violations[0]?.message).toContain("CeoDecision");
  });

  it("does NOT flag when a handler subscribes to the declared event", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [specRow("Vera", "`CeoDecision` event", "event-driven", ["CeoDecision"])],
      handlersMetadata: [
        handler("Vera", "decision-recon", "event-driven", { subscribesTo: ["CeoDecision"] }),
      ],
    });
    // The single declared event is satisfied; the spec has no scheduled
    // row so direction-1b is not asserted; the handler has no events
    // *missing* from the spec. Should be clean.
    expect(r.violations.length).toBe(0);
  });

  it("flags scheduled-coverage gap once per persona (not per scheduled row)", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [
        specRow("Eitan", "Scheduled wake-up — daily SAMOS funding review", "scheduled"),
        specRow("Eitan", "Scheduled wake-up — monthly ALCO", "scheduled"),
        specRow("Eitan", "Scheduled wake-up — quarterly ILAAP", "scheduled"),
      ],
      handlersMetadata: [],
    });
    // Three scheduled spec rows → ONE finding (de-duped at persona level).
    const scheduledFindings = r.violations.filter((v) =>
      v.subject.endsWith(":scheduled-coverage"),
    );
    expect(scheduledFindings.length).toBe(1);
    expect(scheduledFindings[0]?.severity).toBe("warn");
  });
});

describe("diff — handler → spec", () => {
  it("flags a handler subscribing to an event the spec doesn't declare (info)", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [
        specRow("Mira", "Quarter-end RMCP attestation", "scheduled"),
      ],
      handlersMetadata: [
        handler("Mira", "obligations-snapshot", "scheduled", { cronExpression: "0 0 * * *" }),
        handler("Mira", "phantom-handler", "event-driven", {
          subscribesTo: ["UndeclaredEvent"],
        }),
      ],
    });
    const handlerWithoutSpec = r.violations.filter((v) => v.severity === "info");
    expect(handlerWithoutSpec.length).toBeGreaterThanOrEqual(1);
    expect(
      handlerWithoutSpec.some((v) => v.message.includes("UndeclaredEvent")),
    ).toBe(true);
  });

  it("flags a scheduled handler with no scheduled §7 row (info, de-duped)", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [
        // Only event-driven row; no scheduled row.
        specRow("Foo", "`AlphaEvent` event", "event-driven", ["AlphaEvent"]),
      ],
      handlersMetadata: [
        handler("Foo", "subscriber", "event-driven", { subscribesTo: ["AlphaEvent"] }),
        handler("Foo", "scheduled-1", "scheduled", { cronExpression: "0 0 * * *" }),
        handler("Foo", "scheduled-2", "scheduled", { cronExpression: "0 1 * * *" }),
      ],
    });
    const scheduled = r.violations.filter(
      (v) => v.subject === "Foo:scheduled-handler-without-spec",
    );
    expect(scheduled.length).toBe(1);
    expect(scheduled[0]?.severity).toBe("info");
  });
});

// ---------------------------------------------------------------------
// Breakdown helper.
// ---------------------------------------------------------------------

describe("buildBreakdown", () => {
  it("aggregates warn / info counts and per-persona spec gaps", () => {
    const r = triggerSpecHandlerSymmetry({
      specTriggers: [
        specRow("Vera", "`CeoDecision` event", "event-driven", ["CeoDecision"]),
        specRow("Vera", "`AuditFinding` event", "event-driven", ["AuditFinding"]),
        specRow("Atlas", "`SubstrateAlert` event", "event-driven", ["SubstrateAlert"]),
      ],
      handlersMetadata: [],
    });
    const breakdown = buildBreakdown(r);
    expect(breakdown.specWithoutHandler).toBe(3);
    expect(breakdown.handlerWithoutSpec).toBe(0);
    expect(breakdown.total).toBe(3);
    expect(breakdown.perPersonaSpecWithoutHandler["Vera"]).toBe(2);
    expect(breakdown.perPersonaSpecWithoutHandler["Atlas"]).toBe(1);
  });
});

// ---------------------------------------------------------------------
// Integration smoke against current repo.
// ---------------------------------------------------------------------

describe("integration — live recon against current repo (build-phase visibility)", () => {
  it("runs against the live /Team and HANDLERS_METADATA, returns ok: true with findings", () => {
    const r = triggerSpecHandlerSymmetry();
    expect(r.pipeline).toBe("trigger-spec-handler-symmetry");
    expect(r.ok).toBe(true); // build-phase tolerance
    // Per Atlas's brief §3 Gap 3: ≈73 spec-without-handler + a handful
    // of handler-without-spec. Don't pin exact numbers — they drift as
    // Slice 2b remediation lands. Just assert >0 to confirm the pipeline
    // is actually doing work.
    expect(r.violations.length).toBeGreaterThan(0);
    expect(r.asserted).toBeGreaterThan(0);

    const breakdown = buildBreakdown(r);
    expect(breakdown.total).toBe(r.violations.length);
    // Surface the count to test output for visibility.
    console.log(
      `[D-AGENT-AUTONOMY-OPERATIONAL Slice 2] trigger-spec-handler-symmetry findings: total=${breakdown.total} (specWithoutHandler=${breakdown.specWithoutHandler}, handlerWithoutSpec=${breakdown.handlerWithoutSpec})`,
    );
  });
});
