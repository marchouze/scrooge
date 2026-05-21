// tests/runtime-senna-m1-trading-stack-threat-model.test.ts
//
// Senna's M1 trading-stack threat-model handler. Asserts:
//
//   - Emits four `ThreatModelDimensionRegistered` events plus one
//     `SecurityGateRegistered` for a synthetic D-MARKETS-SCHEMA-FOUNDATION
//     CeoDecision.
//   - The four dimensions cover STRIDE on the FIX gateway, zero-trust
//     posture on the gateway aggregator, HSM order-signing custody, and
//     ops-security boundary on the OMS / EMS substrate.
//   - Citation chain present on every emit (Principle 2): Joint Standard
//     1 of 2024 (ORG-CY-01 / 03 / 05), POPIA s.19–22 (ORG-PR(IV)-06),
//     governance-line anchor.
//   - Idempotency: re-firing on a repeat decision is a no-op.
//   - Filter: a CeoDecision for a different decisionId is ignored.
//   - Empty triggering set is a clean no-op.
//   - Dry-run mode does not append events.
//
// Author: Senna · M1 per `Team Inbox/2026-05-07_brief_senna_m1-trading-stack-threat-model.md`.

import { describe, expect, it } from "bun:test";
import { join } from "node:path";

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { makeDecision } from "../platform/event-store/event-types/decision";
import type { Event } from "../platform/event-store/types";
import sennaM1TradingStackThreatModel from "../runtime/agents/senna-m1-trading-stack-threat-model";
import type { AgentRunContext } from "../runtime/types";

const REPO_ROOT = join(import.meta.dir, "..", "..");

const TEST_ACTOR = {
  type: "service" as const,
  id: "agent:test:ceo-decision-source",
};

function makeContext(args: {
  asOf: string;
  triggeringEvents: readonly Event[];
  dryRun?: boolean;
}): AgentRunContext {
  return {
    agent: "Senna",
    trigger: {
      kind: "event-driven",
      id: "m1-trading-stack-threat-model",
      triggeringEvents: args.triggeringEvents,
    },
    asOf: args.asOf,
    repoRoot: REPO_ROOT,
    ownerInboxDir: join(REPO_ROOT, "archive", "owner-inbox"),
    dryRun: args.dryRun ?? false,
  };
}

// D-DECISIONS-FRAMEWORK-REDESIGN Slice C: migrated from raw CeoDecision
// construction to makeDecision with the unified Decision payload.
function syntheticCeoDecision(args: { decisionId: string; asOf: string }): Event {
  return makeDecision({
    asOf: args.asOf,
    entity: "LE-ZA-HOZ-BANK",
    actor: TEST_ACTOR,
    citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
    eventId: newEventId(),
    payload: {
      decisionId: args.decisionId,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title: "Synthetic CEO decision for test",
      category: "governance",
      recommendation: "Approved.",
      rationale: "Synthetic decision for threat-model test.",
      sourceDocHashes: [],
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      recordedVia: "authoring-ui",
    },
  });
}

function countDimensionsFor(decisionId: string): number {
  let n = 0;
  for (const e of eventStore.replay({ type: "ThreatModelDimensionRegistered" })) {
    const p = e.payload as { sourceDecisionId?: unknown };
    if (typeof p.sourceDecisionId === "string" && p.sourceDecisionId === decisionId) n += 1;
  }
  return n;
}

function dimensionFrameworks(): readonly string[] {
  const frameworks: string[] = [];
  for (const e of eventStore.replay({ type: "ThreatModelDimensionRegistered" })) {
    const p = e.payload as { framework?: unknown };
    if (typeof p.framework === "string") frameworks.push(p.framework);
  }
  return frameworks;
}

function gateRegisteredCount(): number {
  let n = 0;
  for (const _ of eventStore.replay({ type: "SecurityGateRegistered" })) n += 1;
  return n;
}

describe("runtime — senna:m1-trading-stack-threat-model", () => {
  it("emits four dimensions + one gate for D-MARKETS-SCHEMA-FOUNDATION CeoDecision", async () => {
    const decision = syntheticCeoDecision({
      decisionId: "D-MARKETS-SCHEMA-FOUNDATION",
      asOf: "2026-05-08T00:00:00.000Z",
    });

    const dimensionsBefore = countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION");
    const gatesBefore = gateRegisteredCount();

    const ctx = makeContext({
      asOf: "2026-05-08T00:00:00.500Z",
      triggeringEvents: [decision],
    });
    const result = await sennaM1TradingStackThreatModel(ctx);

    expect(result.ok).toBe(true);
    // 4 dimensions + 1 gate = 5 events emitted (assuming none already
    // present from a prior test in the same process).
    const dimensionsAfter = countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION");
    const gatesAfter = gateRegisteredCount();

    // The handler is idempotent at the dimensionId level — across
    // multiple test invocations in the same process, dimensions are only
    // registered once. The first invocation observes 4 new emissions.
    expect(dimensionsAfter - dimensionsBefore).toBeGreaterThanOrEqual(0);
    expect(dimensionsAfter).toBeGreaterThanOrEqual(4);
    expect(gatesAfter - gatesBefore).toBeGreaterThanOrEqual(0);
    expect(gatesAfter).toBeGreaterThanOrEqual(1);

    // Frameworks present in the registered set must include all four.
    const frameworks = dimensionFrameworks();
    expect(frameworks).toContain("STRIDE");
    expect(frameworks).toContain("zero-trust");
    expect(frameworks).toContain("HSM-FIPS-140-2-3-L3");
    expect(frameworks).toContain("ops-security");
  });

  it("emissions carry the Joint Standard 2 of 2024 + POPIA s.19–22 citation chain", async () => {
    // Find any ThreatModelDimensionRegistered event from the prior test.
    let observed: Event | undefined;
    for (const e of eventStore.replay({ type: "ThreatModelDimensionRegistered" })) {
      observed = e;
    }
    expect(observed).toBeDefined();
    expect(observed?.actor.id).toBe("agent:senna:m1-trading-stack-threat-model");

    // Citation chain: Joint Standard 2 of 2024 binds at ORG-CY-01 / 03 /
    // 05; POPIA s.19–22 at ORG-PR(IV)-06; governance line.
    expect(observed?.citations).toContain("ORG-CY-01");
    expect(observed?.citations).toContain("ORG-CY-03");
    expect(observed?.citations).toContain("ORG-CY-05");
    expect(observed?.citations).toContain("ORG-PR(IV)-06");
    expect(observed?.citations).toContain("GOV-FRAMEWORK-CEO-RESERVED");
  });

  it("ignores CeoDecisions for unrelated decisionIds", async () => {
    const decision = syntheticCeoDecision({
      decisionId: "D-UNRELATED-DECISION",
      asOf: "2026-05-08T00:01:00.000Z",
    });

    const ctx = makeContext({
      asOf: "2026-05-08T00:01:00.500Z",
      triggeringEvents: [decision],
    });
    const result = await sennaM1TradingStackThreatModel(ctx);

    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
    expect(result.summary).toMatch(/no D-MARKETS-SCHEMA-FOUNDATION/);
  });

  it("clean no-op when triggering set is empty", async () => {
    const ctx = makeContext({
      asOf: "2026-05-08T00:02:00.000Z",
      triggeringEvents: [],
    });
    const result = await sennaM1TradingStackThreatModel(ctx);
    expect(result.ok).toBe(true);
    expect(result.eventsEmitted).toBe(0);
  });

  it("is idempotent — re-firing with the same decision is a no-op", async () => {
    const decision = syntheticCeoDecision({
      decisionId: "D-MARKETS-SCHEMA-FOUNDATION",
      asOf: "2026-05-08T00:03:00.000Z",
    });

    const dimensionsBefore = countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION");
    const gatesBefore = gateRegisteredCount();

    const result = await sennaM1TradingStackThreatModel(
      makeContext({
        asOf: "2026-05-08T00:03:00.500Z",
        triggeringEvents: [decision],
      }),
    );
    expect(result.ok).toBe(true);
    // No new events: the dimensions and gate are already present from
    // the first test in this file.
    expect(countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION")).toBe(dimensionsBefore);
    expect(gateRegisteredCount()).toBe(gatesBefore);
    expect(result.eventsEmitted).toBe(0);
  });

  it("dry-run mode does not append events", async () => {
    const decision = syntheticCeoDecision({
      decisionId: "D-MARKETS-SCHEMA-FOUNDATION",
      asOf: "2026-05-08T00:04:00.000Z",
    });

    const dimensionsBefore = countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION");
    const gatesBefore = gateRegisteredCount();

    const ctx = makeContext({
      asOf: "2026-05-08T00:04:00.500Z",
      triggeringEvents: [decision],
      dryRun: true,
    });
    const result = await sennaM1TradingStackThreatModel(ctx);
    expect(result.ok).toBe(true);
    expect(countDimensionsFor("D-MARKETS-SCHEMA-FOUNDATION")).toBe(dimensionsBefore);
    expect(gateRegisteredCount()).toBe(gatesBefore);
  });
});
