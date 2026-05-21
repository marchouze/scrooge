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
  LEGACY_PRE_A1_EVENT_TYPES,
  PRIVILEGED_EVENT_TYPES,
  PermissionGateDenied,
  VERA_URN,
  decideAppend,
  gateEventStore,
  isGateEnabled,
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
    triggerSubscriptions: [],
    decisionsInScopeCount: 1,
    decisionsInScope: ["Approve test decision"],
    decisionsEscalateCount: 0,
    escalationClasses: [],
    systemCapabilities: ["@platform/event-store", "@platform/observability"],
    eventsEmitted: ["AgentDecision", "AgentEscalation"],
    proceduresOwned: [],
    procedureSteps: [],
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
  delete process.env.BANK_PERMISSION_GATE_DISABLED;
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

describe("permission gate — env-var defaults (T-01 secure-by-default)", () => {
  it("defaults to enabled when no env-var set", () => {
    // biome-ignore lint/performance/noDelete: env-var cleanup needs delete to fully unset
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
    expect(isGateEnabled()).toBe(true);
  });

  it("disabled when BANK_PERMISSION_GATE_DISABLED=true", () => {
    process.env.BANK_PERMISSION_GATE_DISABLED = "true";
    expect(isGateEnabled()).toBe(false);
    // biome-ignore lint/performance/noDelete: cleanup
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
  });

  it("enabled when BANK_PERMISSION_GATE_DISABLED is any non-true value", () => {
    process.env.BANK_PERMISSION_GATE_DISABLED = "false";
    expect(isGateEnabled()).toBe(true);
    process.env.BANK_PERMISSION_GATE_DISABLED = "1";
    expect(isGateEnabled()).toBe(true);
    // biome-ignore lint/performance/noDelete: cleanup
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
  });

  it("forceEnabled wins over env disable (test override)", () => {
    process.env.BANK_PERMISSION_GATE_DISABLED = "true";
    expect(isGateEnabled(true)).toBe(true);
    // biome-ignore lint/performance/noDelete: cleanup
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
  });

  it("forceDisabled wins over default-on (test override)", () => {
    // biome-ignore lint/performance/noDelete: cleanup
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
    expect(isGateEnabled(false, true)).toBe(false);
  });
});

describe("permission gate — feature flag", () => {
  function buildEventFor(actorId: string, type: string): Event {
    return {
      event_id: `evt-${Math.random().toString(36).slice(2)}`,
      type,
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
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

  it("when flag off (forceDisabled), gate is no-op (append succeeds even without policy)", () => {
    // biome-ignore lint/performance/noDelete: env-var cleanup needs delete to fully unset
    delete process.env.BANK_PERMISSION_GATE_DISABLED;
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceDisabled: true },
    });
    expect(() => wrapped.append(buildEventFor("agent:nobody", "AgentDecision"))).not.toThrow();
    store.close();
  });

  it("when flag on, allows a non-privileged type outside the allow-list (Option C allow-by-default)", () => {
    // D-T-01 Option C: internal service agents (agent:*) are allowed to emit
    // non-privileged event types even without an explicit allow-list entry.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentDecision"] }));
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // TradeExecuted is NOT in PRIVILEGED_EVENT_TYPES, so Option C allows it:
    expect(PRIVILEGED_EVENT_TYPES.has("TradeExecuted")).toBe(false);
    expect(() => wrapped.append(buildEventFor("agent:sample", "TradeExecuted"))).not.toThrow();
    store.close();
  });

  it("when flag on, blocks a PRIVILEGED type outside the allow-list (Option C deny-list)", () => {
    // D-T-01 Option C: privileged types (CeoDecision, IdentityPermissionChanged, etc.)
    // always require an explicit allow-list entry regardless of actor class.
    // The policy must be published for the SAME actor that's attempting the emit.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // Publish a policy for agent:scrooge that does NOT include CeoDecision:
    publisher.publish(
      fakeSpec({
        agentUrn: "agent:scrooge",
        personaName: "Scrooge",
        eventsEmitted: ["AgentBriefIssued", "WorkstreamRegistered"],
        specHash: "a1b2c3d4".repeat(8),
      }),
    );
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // CeoDecision is in PRIVILEGED_EVENT_TYPES — must be denied even though
    // agent:scrooge has a published policy (just not for CeoDecision):
    expect(PRIVILEGED_EVENT_TYPES.has("CeoDecision")).toBe(true);
    const ceoEvent: Event = {
      event_id: "evt-ceo-blocked",
      type: "CeoDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:scrooge" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "D-TEST-01",
        action: "approve",
        recordedAt: "2026-05-08T00:00:00.000Z",
        recordedBy: "marc@tgv.co.za",
      },
    };
    expect(() => wrapped.append(ceoEvent)).toThrow(PermissionGateDenied);
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

  it("when flag on, no policy, and event type NOT in legacy backfill and NOT privileged, allows the append (Option C allow-by-default)", () => {
    // D-T-01 Option C: internal service agents are allow-by-default for
    // non-privileged types, even when there's no published policy and the
    // type isn't in the legacy backfill list.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    const newOpType = "OperationalStatusUpdated";
    expect(LEGACY_PRE_A1_EVENT_TYPES.has(newOpType)).toBe(false);
    expect(PRIVILEGED_EVENT_TYPES.has(newOpType)).toBe(false);
    expect(() => wrapped.append(buildEventFor("agent:sample", newOpType))).not.toThrow();
    store.close();
  });

  it("when flag on, no policy, and event type NOT in legacy backfill and IS privileged, blocks the append", () => {
    // D-T-01 Option C: privileged types without a published policy (and not in
    // legacy backfill) are still denied. IdentityPermissionChanged is a good
    // example — it's NOT in the legacy backfill list.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(false);
    expect(PRIVILEGED_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(true);
    expect(() =>
      wrapped.append(buildEventFor("agent:sample", "IdentityPermissionChanged")),
    ).toThrow(PermissionGateDenied);
    store.close();
  });

  it("when flag on, no policy, but event type IS in legacy backfill, append succeeds and emits low-severity SubstrateAlert (T-01 backfill)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // AgentDecision is in LEGACY_PRE_A1_EVENT_TYPES per Atlas T-01 mitigation.
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("AgentDecision")).toBe(true);
    expect(() => wrapped.append(buildEventFor("agent:legacy", "AgentDecision"))).not.toThrow();
    // The default bypass-handler emits a SubstrateAlert per
    // (agentUrn, eventType) pair. Replay confirms it landed.
    const events = [...store.replay()];
    const alerts = events.filter((e) => e.type === "SubstrateAlert");
    expect(alerts).toHaveLength(1);
    const alertPayload = alerts[0]?.payload as Record<string, unknown>;
    expect(alertPayload.alertClass).toBe("integrity");
    expect(alertPayload.severity).toBe("low");
    expect(alertPayload.agentUrn).toBe("agent:legacy");
    store.close();
  });

  it("legacy backfill alert is deduped per (agentUrn, eventType) pair within a process", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    wrapped.append(buildEventFor("agent:legacy2", "AgentDecision"));
    wrapped.append(buildEventFor("agent:legacy2", "AgentDecision"));
    wrapped.append(buildEventFor("agent:legacy2", "AgentDecision"));
    const alerts = [...store.replay()].filter((e) => e.type === "SubstrateAlert");
    expect(alerts).toHaveLength(1);
    store.close();
  });

  it("legacy backfill alert fires once per distinct event type for the same actor", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // AgentDecision and CeoDecision are both in the legacy backfill list
    // and each carry valid payloads via the test fixture's overrides.
    wrapped.append(buildEventFor("agent:legacy3", "AgentDecision"));
    const ceoEvent: Event = {
      event_id: "evt-ceo-legacy",
      type: "CeoDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:legacy3" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "D-T-LEGACY-FIXTURE",
        action: "approve",
        recordedAt: "2026-05-08T00:00:00.000Z",
        recordedBy: "marc@tgv.co.za",
      },
    };
    wrapped.append(ceoEvent);
    const alerts = [...store.replay()].filter((e) => e.type === "SubstrateAlert");
    expect(alerts).toHaveLength(2);
    store.close();
  });

  it("legacy backfill bypass uses onLegacyBypass hook when provided (overrides default alert emission)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const bypasses: Array<{ type: string; agentUrn: string }> = [];
    const wrapped = gateEventStore({
      store,
      config: {
        policy: publisher,
        forceEnabled: true,
        onLegacyBypass: ({ event, agentUrn }) => {
          bypasses.push({ type: event.type, agentUrn });
        },
      },
    });
    wrapped.append(buildEventFor("agent:legacy4", "AgentDecision"));
    expect(bypasses).toHaveLength(1);
    expect(bypasses[0]).toEqual({ type: "AgentDecision", agentUrn: "agent:legacy4" });
    // No SubstrateAlert when hook overrides default behaviour.
    const alerts = [...store.replay()].filter((e) => e.type === "SubstrateAlert");
    expect(alerts).toHaveLength(0);
    store.close();
  });

  it("legacy backfill does NOT bypass when actor HAS a published policy (policy is canonical for privileged types)", () => {
    // D-T-01 Option C: for PRIVILEGED types, having a policy that doesn't
    // list the type is still a hard deny. For NON-PRIVILEGED types the
    // policy's allow-list is no longer the gate (allow-by-default applies).
    // This test verifies that a privileged type (CeoDecision) published in
    // the legacy list remains denied once the actor has a policy.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentEscalation"] }));
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // CeoDecision IS in the legacy list AND is privileged — with a policy
    // that doesn't include it, it must be denied.
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("CeoDecision")).toBe(true);
    expect(PRIVILEGED_EVENT_TYPES.has("CeoDecision")).toBe(true);
    const ceoEvent: Event = {
      event_id: "evt-ceo-policy-deny",
      type: "CeoDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:sample" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        decisionId: "D-LEGACY-TEST",
        action: "approve",
        recordedAt: "2026-05-08T00:00:00.000Z",
        recordedBy: "marc@tgv.co.za",
      },
    };
    expect(() => wrapped.append(ceoEvent)).toThrow(PermissionGateDenied);
    store.close();
  });

  it("legacy backfill does NOT bypass non-privileged type when actor HAS a published policy (allow-by-default)", () => {
    // D-T-01 Option C: once an actor has a policy, non-privileged types not on
    // the allow-list are allowed (no hard deny). This is the key Option C
    // relaxation that unblocks the goal loop.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    publisher.publish(fakeSpec({ eventsEmitted: ["AgentEscalation"] }));
    const wrapped = gateEventStore({
      store,
      config: { policy: publisher, forceEnabled: true },
    });
    // AgentDecision IS in the legacy list but is NOT privileged — with a policy
    // that doesn't include it, Option C allow-by-default means it's allowed.
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("AgentDecision")).toBe(true);
    expect(PRIVILEGED_EVENT_TYPES.has("AgentDecision")).toBe(false);
    expect(() => wrapped.append(buildEventFor("agent:sample", "AgentDecision"))).not.toThrow();
    store.close();
  });

  it("calls onDeny hook with the denied event and reason (privileged type not on allow-list)", () => {
    // Under Option C, non-privileged types are allow-by-default; onDeny only
    // fires for privileged types denied explicitly. Use IdentityPermissionChanged
    // as a representative privileged type.
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
    // IdentityPermissionChanged is a PRIVILEGED type — requires explicit allow-list
    expect(PRIVILEGED_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(true);
    try {
      wrapped.append(buildEventFor("agent:sample", "IdentityPermissionChanged"));
    } catch {
      /* expected */
    }
    expect(denials).toHaveLength(1);
    expect(denials[0]?.type).toBe("IdentityPermissionChanged");
    expect(denials[0]?.reason).toContain("privileged type");
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
      entity: "LE-ZA-HOZ-BANK",
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
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:rohan" },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {
        findingId: "f1",
        severity: "low",
        category: "other",
        addressedTo: "agent:rohan",
        agentId: "rohan",
        raisedBy: "agent:vera",
        summary: "test finding",
        citations: [],
      },
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

  it("Vera writes of PRIVILEGED types outside her allow-list still blocked (asymmetric carve-out)", () => {
    // D-T-01 Option C: the read carve-out for Vera is asymmetric — reads are
    // unconstrained; writes of PRIVILEGED types outside her policy are denied.
    // Non-privileged types are now allow-by-default under Option C (even for Vera),
    // but privileged types (CeoDecision, IdentityPermissionChanged, etc.) remain
    // hard-deny without an explicit allow-list entry.
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
    // IdentityPermissionChanged is privileged — Vera must not emit it without
    // explicit allow-list entry.
    expect(PRIVILEGED_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(true);
    const veraPrivilegedAttempt: Event = {
      event_id: "evt-vera-privileged-1",
      type: "IdentityPermissionChanged",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: VERA_URN },
      citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
      payload: {},
    };
    expect(() => wrapped.append(veraPrivilegedAttempt)).toThrow(PermissionGateDenied);
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
      entity: "LE-ZA-HOZ-BANK",
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
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:sample" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(true);
    store.close();
  });

  it("allows when no policy is published AND event type not in legacy backfill (Option C allow-by-default for non-privileged)", () => {
    // D-T-01 Option C: no policy + not in legacy backfill + not privileged → allowed.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const newOpType = "OperationalStatusUpdated";
    expect(LEGACY_PRE_A1_EVENT_TYPES.has(newOpType)).toBe(false);
    expect(PRIVILEGED_EVENT_TYPES.has(newOpType)).toBe(false);
    const event: Event = {
      event_id: "evt-y",
      type: newOpType,
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:newbie" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(true);
    expect(decision.legacyBypass).toBeUndefined();
    store.close();
  });

  it("denies when no policy is published AND event type not in legacy backfill AND is privileged", () => {
    // D-T-01 Option C: no policy + not in legacy backfill + IS privileged → denied.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(false);
    expect(PRIVILEGED_EVENT_TYPES.has("IdentityPermissionChanged")).toBe(true);
    const event: Event = {
      event_id: "evt-y-priv",
      type: "IdentityPermissionChanged",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:newbie" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("privileged type");
    store.close();
  });

  it("allows with legacyBypass when no policy is published AND event type IS in legacy backfill", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    const event: Event = {
      event_id: "evt-z",
      type: "AgentDecision",
      as_of: "2026-05-08T00:00:00.000Z",
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "service", id: "agent:newbie" },
      citations: ["X"],
      payload: {},
    };
    const decision = decideAppend({ event, policy: publisher });
    expect(decision.allowed).toBe(true);
    expect(decision.legacyBypass).toEqual({
      agentUrn: "agent:newbie",
      eventType: "AgentDecision",
    });
    store.close();
  });

  // D-T-01 Option C: allow-by-default for non-privileged types, no policy
  it("allows non-privileged type with no policy (Option C allow-by-default)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // RiskRaised is not in LEGACY_PRE_A1_EVENT_TYPES and not in PRIVILEGED_EVENT_TYPES
    expect(LEGACY_PRE_A1_EVENT_TYPES.has("RiskRaised")).toBe(true); // it IS in the legacy list
    // This test also verifies the path when NOT in legacy (use a truly new type)
    expect(PRIVILEGED_EVENT_TYPES.has("RiskRaised")).toBe(false);
    const decision = decideAppend({
      event: {
        event_id: "evt-rr",
        type: "RiskRaised",
        as_of: "2026-05-08T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas" },
        citations: ["X"],
        payload: {},
      },
      policy: publisher,
    });
    // RiskRaised is in legacy list, so it gets legacy bypass (also allowed)
    expect(decision.allowed).toBe(true);
    store.close();
  });

  it("allows truly-new non-privileged type with no policy (Option C pure allow-by-default, no legacy)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // A synthetic future type: not in legacy, not privileged
    const newType = "OperationalStatusUpdated";
    expect(LEGACY_PRE_A1_EVENT_TYPES.has(newType)).toBe(false);
    expect(PRIVILEGED_EVENT_TYPES.has(newType)).toBe(false);
    const decision = decideAppend({
      event: {
        event_id: "evt-new-op",
        type: newType,
        as_of: "2026-05-08T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas" },
        citations: ["X"],
        payload: {},
      },
      policy: publisher,
    });
    expect(decision.allowed).toBe(true);
    expect(decision.legacyBypass).toBeUndefined();
    store.close();
  });

  it("denies privileged type (CeoDecision) for agent:scrooge with no policy (Option C deny-list)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // CeoDecision IS in LEGACY_PRE_A1_EVENT_TYPES, so pre-Option-C it would have been allowed
    // via legacy bypass. Under Option C, privileged types still go through the legacy
    // bypass path for backward compatibility, but this tests what happens post-migration
    // (when the actor has a policy).
    // Publish a policy for agent:scrooge that does NOT include CeoDecision:
    publisher.publish(
      fakeSpec({
        agentUrn: "agent:scrooge",
        personaName: "Scrooge",
        eventsEmitted: ["AgentBriefIssued", "WorkstreamRegistered"],
        specHash: "e".repeat(64),
      }),
    );
    const decision = decideAppend({
      event: {
        event_id: "evt-ceo-scrooge",
        type: "CeoDecision",
        as_of: "2026-05-08T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:scrooge" },
        citations: ["GOV-FRAMEWORK-CEO-RESERVED"],
        payload: {
          decisionId: "D-TEST-SCROOGE",
          action: "approve",
          recordedAt: "2026-05-08T00:00:00.000Z",
          recordedBy: "marc@tgv.co.za",
        },
      },
      policy: publisher,
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("privileged type CeoDecision");
    store.close();
  });

  it("goal-loop unblock: agent:atlas can emit RiskRaised with no policy (via legacy bypass)", () => {
    // Pre-condition for the goal-loop unblock: RiskRaised is in LEGACY list.
    // Post-migration (once policy published): non-privileged allow-by-default kicks in.
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    expect(PRIVILEGED_EVENT_TYPES.has("RiskRaised")).toBe(false);
    const decision = decideAppend({
      event: {
        event_id: "evt-rr-atlas",
        type: "RiskRaised",
        as_of: "2026-05-08T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas" },
        citations: ["X"],
        payload: {},
      },
      policy: publisher,
    });
    expect(decision.allowed).toBe(true);
    store.close();
  });

  it("goal-loop unblock: agent:atlas can emit WorkstreamRegistered without explicit allow-list entry (Option C)", () => {
    const store = new EventStore();
    const publisher = new LocalPermissionPolicyPublisher({ eventStore: store });
    // Publish a policy for atlas that does NOT include WorkstreamRegistered
    publisher.publish(
      fakeSpec({
        agentUrn: "agent:atlas",
        personaName: "Atlas",
        eventsEmitted: ["AgentRunStarted", "AgentRunCompleted"],
        specHash: "f".repeat(64),
      }),
    );
    expect(PRIVILEGED_EVENT_TYPES.has("WorkstreamRegistered")).toBe(false);
    const decision = decideAppend({
      event: {
        event_id: "evt-ws-atlas",
        type: "WorkstreamRegistered",
        as_of: "2026-05-08T00:00:00.000Z",
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "service", id: "agent:atlas" },
        citations: ["X"],
        payload: {},
      },
      policy: publisher,
    });
    // Option C: non-privileged type, policy exists but type not listed → allow-by-default
    expect(decision.allowed).toBe(true);
    expect(decision.legacyBypass).toBeUndefined();
    store.close();
  });
});
