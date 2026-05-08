// tests/agent-identity.test.ts
//
// Unit tests for A1.2 — agent-identity issuer + permission-policy
// publisher + event-store permission gate.
//
// Asserts:
//   - Issue + rotate idempotency on identical specs.
//   - Verify against valid + invalid tokens.
//   - Permission-policy derivation: round-trip an AgentSpec; assert the
//     policy includes §12 capabilities.
//   - Gate: when feature flag off, no-op; when on, blocks out-of-allow-list
//     event types.
//   - Vera carve-out: Vera reads always succeed; Vera writes outside her
//     allow-list still blocked.
//
// Author: Atlas + Senna (A1.2)

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { LocalAgentIdentityIssuer, type SignedToken } from "../platform/agent-identity/issuer";
import {
  LocalPermissionPolicyPublisher,
  derivePermissionPolicy,
} from "../platform/agent-identity/permission-policy";
import type { AgentSpec } from "../platform/agent-runtime/spec-parser";
import {
  PermissionGateDenied,
  VERA_URN,
  decideAppend,
  gateEventStore,
} from "../platform/event-store/permission-gate";
import { EventStore } from "../platform/event-store/store";
import type { Event } from "../platform/event-store/types";

function fakeSpec(overrides: Partial<AgentSpec> = {}): AgentSpec {
  return {
    personaName: "Sample",
    agentUrn: "agent:sample",
    role: "Test agent",
    reportsTo: "Devon (COO)",
    cadenceMode: "Scheduled.",
    triggerCount: 1,
    decisionsInScopeCount: 1,
    decisionsEscalateCount: 0,
    systemCapabilities: ["@platform/event-store", "@platform/observability"],
    eventsEmitted: ["AgentDecision", "AgentEscalation"],
    proceduresOwned: [],
    specVersion: "v1.0",
    specHash: "a".repeat(64),
    sourcePath: "/tmp/Sample.md",
    ...overrides,
  };
}

let keyDir: string;
beforeEach(() => {
  keyDir = mkdtempSync(join(tmpdir(), "agent-identity-test-"));
});
afterEach(() => {
  // Best-effort cleanup; ignore failures (Bun reuses tmp prefixes).
  try {
    rmSync(keyDir, { recursive: true, force: true });
  } catch {
    /* noop */
  }
  // biome-ignore lint/performance/noDelete: env-var cleanup needs delete to fully unset
  delete process.env.BANK_PERMISSION_GATE_ENABLED;
});

describe("LocalAgentIdentityIssuer — issue / rotate", () => {
  it("issues a fresh keypair on first call (status created, event emitted)", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({
      eventStore: store,
      keyDir,
      now: () => "2026-05-08T00:00:00.000Z",
    });
    const spec = fakeSpec();
    const out = issuer.issue(spec);
    expect(out.status).toBe("created");
    expect(out.eventEmitted).toBe(true);
    expect(out.keyVersion).toBe(1);
    expect(out.publicKey).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(store.count()).toBe(1);
    store.close();
  });

  it("is idempotent on identical spec (no event, status unchanged)", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    const spec = fakeSpec();
    issuer.issue(spec);
    const second = issuer.issue(spec);
    expect(second.status).toBe("unchanged");
    expect(second.eventEmitted).toBe(false);
    expect(second.keyVersion).toBe(1);
    expect(store.count()).toBe(1);
    store.close();
  });

  it("rotates on spec change (new event, new version)", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    const spec = fakeSpec();
    issuer.issue(spec);
    const updated = issuer.issue(fakeSpec({ specHash: "b".repeat(64) }));
    expect(updated.status).toBe("rotated");
    expect(updated.eventEmitted).toBe(true);
    expect(updated.keyVersion).toBe(2);
    expect(store.count()).toBe(2);
    store.close();
  });

  it("explicit rotate() bumps version and emits a scheduled rotation", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    issuer.issue(fakeSpec());
    const rotated = issuer.rotate("agent:sample");
    expect(rotated.keyVersion).toBe(2);
    expect(rotated.eventEmitted).toBe(true);
    expect(store.count()).toBe(2);
    store.close();
  });

  it("rotate() refuses if no key exists for the urn", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    expect(() => issuer.rotate("agent:ghost")).toThrow(/no existing key/);
    store.close();
  });
});

describe("LocalAgentIdentityIssuer — verify", () => {
  it("verifies a valid token against its declared capability", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    const spec = fakeSpec();
    issuer.issue(spec);
    const token = issuer.signAs(spec.agentUrn, "@platform/event-store", "2026-05-08T00:00:00.000Z");
    expect(token).toBeDefined();
    if (!token) return;
    const result = issuer.verify(token, "@platform/event-store");
    expect(result.ok).toBe(true);
    expect(result.agentUrn).toBe(spec.agentUrn);
    expect(result.keyVersion).toBe(1);
    store.close();
  });

  it("rejects a token with a tampered signature", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    const spec = fakeSpec();
    issuer.issue(spec);
    const token = issuer.signAs(spec.agentUrn, "@platform/event-store", "2026-05-08T00:00:00.000Z");
    if (!token) throw new Error("test setup");
    const tampered: SignedToken = {
      ...token,
      // Flip a byte in the signature; base64url alphabet preserved.
      signature: token.signature.startsWith("A")
        ? `B${token.signature.slice(1)}`
        : `A${token.signature.slice(1)}`,
    };
    const result = issuer.verify(tampered, "@platform/event-store");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("signature invalid");
    store.close();
  });

  it("rejects a token whose key version was superseded", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    issuer.issue(fakeSpec());
    const oldToken = issuer.signAs(
      "agent:sample",
      "@platform/event-store",
      "2026-05-08T00:00:00.000Z",
    );
    if (!oldToken) throw new Error("test setup");
    issuer.rotate("agent:sample");
    const result = issuer.verify(oldToken, "@platform/event-store");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("key version superseded");
    store.close();
  });

  it("rejects a token whose claimed capability differs from the verify call", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    issuer.issue(fakeSpec());
    const token = issuer.signAs(
      "agent:sample",
      "@platform/event-store",
      "2026-05-08T00:00:00.000Z",
    );
    if (!token) throw new Error("test setup");
    const result = issuer.verify(token, "@platform/different");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("capability mismatch");
    store.close();
  });

  it("rejects when the agent has no key in the keystore", () => {
    const store = new EventStore();
    const issuer = new LocalAgentIdentityIssuer({ eventStore: store, keyDir });
    const fakeToken: SignedToken = {
      agentUrn: "agent:nobody",
      keyVersion: 1,
      capability: "@platform/event-store",
      issuedAt: "2026-05-08T00:00:00.000Z",
      signature: "AAAA",
    };
    const result = issuer.verify(fakeToken, "@platform/event-store");
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("unknown agent");
    store.close();
  });
});

describe("derivePermissionPolicy", () => {
  it("round-trips §12 capabilities and §11 events into the policy", () => {
    const spec = fakeSpec({
      systemCapabilities: ["@platform/event-store", "@platform/recon"],
      eventsEmitted: ["AgentDecision", "AgentEscalation", "ReconResult"],
    });
    const policy = derivePermissionPolicy(spec);
    expect(policy.agentUrn).toBe(spec.agentUrn);
    expect(policy.capabilityAllowList).toEqual(["@platform/event-store", "@platform/recon"]);
    expect(policy.eventEmitAllowList).toEqual(["AgentDecision", "AgentEscalation", "ReconResult"]);
    expect(policy.derivedFromSpecHash).toBe(spec.specHash);
    expect(policy.policyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("produces a stable hash regardless of input order", () => {
    const a = derivePermissionPolicy(fakeSpec({ eventsEmitted: ["A", "B"] }));
    const b = derivePermissionPolicy(fakeSpec({ eventsEmitted: ["B", "A"] }));
    expect(a.policyHash).toBe(b.policyHash);
  });
});

describe("LocalPermissionPolicyPublisher", () => {
  it("emits a PermissionPolicyPublished event on first publish", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({
      eventStore: store,
      now: () => "2026-05-08T00:00:00.000Z",
    });
    const out = publisher.publish(fakeSpec());
    expect(out.status).toBe("published");
    expect(out.eventEmitted).toBe(true);
    expect(store.count()).toBe(1);
    store.close();
  });

  it("is idempotent on identical policy hash", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const spec = fakeSpec();
    publisher.publish(spec);
    const second = publisher.publish(spec);
    expect(second.status).toBe("unchanged");
    expect(second.eventEmitted).toBe(false);
    expect(store.count()).toBe(1);
    store.close();
  });

  it("re-publishes when the spec capabilities change", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec());
    const out = publisher.publish(
      fakeSpec({ systemCapabilities: ["@platform/event-store", "@platform/new-cap"] }),
    );
    expect(out.status).toBe("published");
    expect(store.count()).toBe(2);
    store.close();
  });

  it("lookup() folds the latest-wins policy from the event log", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec());
    publisher.publish(fakeSpec({ specHash: "b".repeat(64), eventsEmitted: ["NewEvent"] }));
    const latest = publisher.lookup("agent:sample");
    expect(latest).toBeDefined();
    expect(latest?.eventEmitAllowList).toEqual(["NewEvent"]);
    store.close();
  });
});

describe("permission gate — feature flag", () => {
  function buildEventFor(actorId: string, type: string): Event {
    return {
      event_id: `evt-${Math.random().toString(36).slice(2)}`,
      type,
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: actorId },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "decision:test:x",
        decidedBy: "agent:sample",
        what: "Pick a thing",
        inScopeBy: "spec §9.1",
        options: ["A", "B"],
        chosen: "A",
        rationale: "Test fixture",
      },
    };
  }

  it("when flag off, gate is no-op (append succeeds even without policy)", () => {
    // biome-ignore lint/performance/noDelete: env-var cleanup needs delete to fully unset
    delete process.env.BANK_PERMISSION_GATE_ENABLED;
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: false },
    });
    expect(() => wrapped.append(buildEventFor("agent:nobody", "AgentDecision"))).not.toThrow();
    store.close();
  });

  it("when flag on, blocks an event type outside the allow-list", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentDecision"] }));
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // Out-of-allow-list type:
    expect(() => wrapped.append(buildEventFor("agent:sample", "TradeExecuted"))).toThrow(
      PermissionGateDenied,
    );
    store.close();
  });

  it("when flag on and event type is on allow-list, append succeeds", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentDecision"] }));
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    expect(() => wrapped.append(buildEventFor("agent:sample", "AgentDecision"))).not.toThrow();
    store.close();
  });

  it("when flag on but no policy is published, blocks the append", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    expect(() => wrapped.append(buildEventFor("agent:sample", "AgentDecision"))).toThrow(
      PermissionGateDenied,
    );
    store.close();
  });

  it("calls onDeny hook with the denied event and reason", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentDecision"] }));
    const denials: Array<{ type: string; reason: string }> = [];
    const wrapped = gateEventStore({
      store,
      config: {
        policy: publisher,
        forceEnabled: true,
        onDeny: ({ event, reason }) => {
          denials.push({ type: event.type, reason });
        },
      },
    });
    try {
      wrapped.append(buildEventFor("agent:sample", "TradeExecuted"));
    } catch {
      /* expected */
    }
    expect(denials).toHaveLength(1);
    expect(denials[0]?.type).toBe("TradeExecuted");
    expect(denials[0]?.reason).toContain("not allowed to emit TradeExecuted");
    store.close();
  });

  it("non-agent service actors bypass the gate (system / human paths)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // human actor — bypasses agent gate
    const humanEvent: Event = {
      event_id: "evt-human-1",
      type: "CeoDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: { decisionId: "x", note: "ok" },
    };
    expect(() => wrapped.append(humanEvent)).not.toThrow();
    store.close();
  });
});

describe("permission gate — Vera carve-out", () => {
  it("Vera reads everything regardless of policy (replay is not gated)", () => {
    // Replay is not on the gate's interception path; we assert by
    // appending events under Vera's URN to the underlying store and
    // reading them back through the wrapped store.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // Bypass the wrapper for the seed: we want raw events on the store
    // without going through the gate. The test asserts read access.
    const seedEvent: Event = {
      event_id: "evt-seed-1",
      type: "AuditFinding",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:rohan" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: { findingId: "f1", description: "test" },
    };
    store.append(seedEvent);
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    const events = [...wrapped.replay()];
    expect(events).toHaveLength(1);
    // Vera could replay the same store with the same wrapper; reads
    // are unconstrained.
  });

  it("Vera writes outside her allow-list still blocked (asymmetric carve-out)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(
      fakeSpec({
        agentUrn: VERA_URN,
        personaName: "Vera",
        eventsEmitted: ["ReconResult", "AuditFinding"],
        specHash: "c".repeat(64),
      }),
    );
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    const veraOutOfScope: Event = {
      event_id: "evt-vera-1",
      type: "TradeExecuted",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: VERA_URN },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {},
    };
    expect(() => wrapped.append(veraOutOfScope)).toThrow(PermissionGateDenied);
  });

  it("Vera writes inside her allow-list succeed", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(
      fakeSpec({
        agentUrn: VERA_URN,
        personaName: "Vera",
        eventsEmitted: ["ReconResult", "AuditFinding"],
        specHash: "d".repeat(64),
      }),
    );
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    const veraInScope: Event = {
      event_id: "evt-vera-2",
      type: "ReconResult",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: VERA_URN },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        pipeline: "test",
        passed: true,
        violations: [],
      },
    };
    expect(() => wrapped.append(veraInScope)).not.toThrow();
  });
});

describe("decideAppend — pure decision function", () => {
  it("allows when policy lists the type", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentDecision"] }));
    const event: Event = {
      event_id: "evt-x",
      type: "AgentDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:sample" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(true);
    store.close();
  });

  it("denies when no policy is published", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const event: Event = {
      event_id: "evt-y",
      type: "AgentDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:newbie" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("no permission policy");
    store.close();
  });
});
