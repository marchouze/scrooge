// platform/agent-identity/permission-policy.ts
//
// A1.2 — permission-policy derivation. Given an `AgentSpec` (from
// A1.1 registry), compute the policy the substrate should apply when
// the agent acts: which capabilities it can call, which event types it
// can emit, which it can subscribe to, which registers it can write.
//
// Inputs (per Atlas spec §3.1):
//   - §12 system capabilities → capabilityAllowList
//   - §11 events emitted      → eventEmitAllowList
//   - §7 triggers (typed)     → eventSubscribeAllowList
//   - §11 registers maintained → registerWriteAllowList
//
// Outputs:
//   - A `PermissionPolicy` value (in-memory shape).
//   - When wired with the event store, a `PermissionPolicyPublished`
//     event keyed on agentUrn, with idempotency on policyHash.
//
// This module is a *pure* derivation today. The spec change → policy
// change is recomputed on demand; the publisher's job is to gate
// emission of the typed event.
//
// Author: Atlas (A1.2)

import { createHash } from "node:crypto";

import type { AgentUrn } from "../agent-runtime/registry";
import type { AgentSpec } from "../agent-runtime/spec-parser";
import { makePermissionPolicyPublished } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";

/**
 * In-memory shape of a per-agent permission policy. Identical fields to
 * the `PermissionPolicyPublished` payload (sans hashing metadata).
 */
export interface PermissionPolicy {
  readonly agentUrn: AgentUrn;
  readonly capabilityAllowList: readonly string[];
  readonly eventEmitAllowList: readonly string[];
  readonly eventSubscribeAllowList: readonly string[];
  readonly registerWriteAllowList: readonly string[];
  readonly policyHash: string;
  readonly derivedFromSpecHash: string;
}

/** Resolver consumed by the permission gate and by the verifier. */
export interface PermissionPolicyResolver {
  /** Latest published policy for `agentUrn`, or undefined if none yet. */
  lookup(agentUrn: AgentUrn): PermissionPolicy | undefined;
  /** Every published policy, keyed on agentUrn (latest-wins). */
  list(): readonly PermissionPolicy[];
}

/** Result of `publish()`. */
export interface PublishResult {
  readonly status: "published" | "unchanged";
  readonly agentUrn: AgentUrn;
  readonly policyHash: string;
  readonly eventEmitted: boolean;
}

export interface PermissionPolicyPublisher extends PermissionPolicyResolver {
  /**
   * Derive a policy from the spec and emit `PermissionPolicyPublished`
   * if it differs from the latest published policy. Idempotent on
   * policyHash.
   */
  publish(spec: AgentSpec): PublishResult;
}

/**
 * Extract typed event names (backticked tokens) from the trigger rows
 * of an agent's spec. We don't have the raw §7 text here (the parser
 * only counts rows); instead we use the spec's `eventsEmitted` as a
 * proxy when no explicit subscribe list is parsed. This is a known
 * substrate gap: A1.1's parser dropped the trigger details.
 *
 * Mitigation: callers that need the *real* subscribe allow-list should
 * pass the full §7 trigger text. For now we expose a derivation that
 * works against either the AgentSpec alone (returns []) or against an
 * augmented spec with `triggerSubscriptions` filled.
 *
 * Substrate gap surfaced: Wave-4 #11 (event-subscribe coverage) will
 * tighten this when A1.1's parser is extended to capture trigger
 * payload typing.
 */
function deriveEventSubscribeAllowList(spec: AgentSpec): string[] {
  // The parser doesn't yet expose the raw trigger text. The current
  // safe default is the empty list — A2's event-trigger bus will
  // explicitly subscribe via spec, not via inference. The parser
  // upgrade is tracked as a substrate gap.
  void spec;
  return [];
}

/**
 * Best-effort registers-maintained extraction. Today the parser doesn't
 * expose §11 register lines (it only captures `eventsEmitted`). We
 * return an empty list and let A2 widen the parser. Tracked as a
 * substrate gap.
 */
function deriveRegisterWriteAllowList(spec: AgentSpec): string[] {
  void spec;
  return [];
}

/**
 * Compute the canonical SHA-256 hash of a policy. Order-stable JSON of
 * the four allow-lists + agentUrn.
 */
function hashPolicy(p: {
  agentUrn: string;
  capabilityAllowList: readonly string[];
  eventEmitAllowList: readonly string[];
  eventSubscribeAllowList: readonly string[];
  registerWriteAllowList: readonly string[];
}): string {
  const canonical = JSON.stringify({
    agentUrn: p.agentUrn,
    capabilityAllowList: [...p.capabilityAllowList].sort(),
    eventEmitAllowList: [...p.eventEmitAllowList].sort(),
    eventSubscribeAllowList: [...p.eventSubscribeAllowList].sort(),
    registerWriteAllowList: [...p.registerWriteAllowList].sort(),
  });
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

/**
 * Derive a `PermissionPolicy` from an `AgentSpec`. Pure function: no
 * IO, no event emission. The publisher wraps this and emits the typed
 * event when the hash differs from the latest published policy.
 */
export function derivePermissionPolicy(spec: AgentSpec): PermissionPolicy {
  const capabilityAllowList = [...spec.systemCapabilities];
  const eventEmitAllowList = [...spec.eventsEmitted];
  const eventSubscribeAllowList = deriveEventSubscribeAllowList(spec);
  const registerWriteAllowList = deriveRegisterWriteAllowList(spec);
  const policyHash = hashPolicy({
    agentUrn: spec.agentUrn,
    capabilityAllowList,
    eventEmitAllowList,
    eventSubscribeAllowList,
    registerWriteAllowList,
  });
  return {
    agentUrn: spec.agentUrn,
    capabilityAllowList,
    eventEmitAllowList,
    eventSubscribeAllowList,
    registerWriteAllowList,
    policyHash,
    derivedFromSpecHash: spec.specHash,
  };
}

export interface PermissionPolicyPublisherConfig {
  readonly eventStore: EventStore;
  readonly entity?: string;
  readonly actor?: Actor;
  readonly citations?: readonly string[];
  readonly now?: () => string;
}

const DEFAULT_ENTITY = "BANK-ZA-001";
const DEFAULT_ACTOR: Actor = { type: "service", id: "agent:atlas:permission-policy" };
const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-1-2024",
  "ORG-CY-09",
];

/**
 * Local-first publisher. Authoritative state is the event log
 * (`PermissionPolicyPublished` events keyed on agentUrn,
 * latest-wins-per-key on policyHash); `lookup()` and `list()` fold the
 * stream.
 */
export class LocalPermissionPolicyPublisher implements PermissionPolicyPublisher {
  private readonly eventStore: EventStore;
  private readonly entity: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];
  private readonly now: () => string;

  constructor(config: PermissionPolicyPublisherConfig) {
    this.eventStore = config.eventStore;
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
    this.now = config.now ?? (() => new Date().toISOString());
  }

  publish(spec: AgentSpec): PublishResult {
    const next = derivePermissionPolicy(spec);
    const existing = this.lookup(spec.agentUrn);
    if (existing && existing.policyHash === next.policyHash) {
      return {
        status: "unchanged",
        agentUrn: spec.agentUrn,
        policyHash: next.policyHash,
        eventEmitted: false,
      };
    }
    this.eventStore.append(
      makePermissionPolicyPublished({
        asOf: this.now(),
        entity: this.entity,
        actor: this.actor,
        citations: [...this.citations],
        payload: {
          agentUrn: next.agentUrn,
          capabilityAllowList: [...next.capabilityAllowList],
          eventEmitAllowList: [...next.eventEmitAllowList],
          eventSubscribeAllowList: [...next.eventSubscribeAllowList],
          registerWriteAllowList: [...next.registerWriteAllowList],
          policyHash: next.policyHash,
          derivedFromSpecHash: next.derivedFromSpecHash,
        },
      }),
    );
    return {
      status: "published",
      agentUrn: spec.agentUrn,
      policyHash: next.policyHash,
      eventEmitted: true,
    };
  }

  lookup(agentUrn: AgentUrn): PermissionPolicy | undefined {
    let latest: PermissionPolicy | undefined;
    for (const e of this.eventStore.replay({ type: "PermissionPolicyPublished" })) {
      const p = e.payload as Record<string, unknown>;
      if (p.agentUrn === agentUrn) {
        latest = payloadToPolicy(p);
      }
    }
    return latest;
  }

  list(): readonly PermissionPolicy[] {
    const byUrn = new Map<string, PermissionPolicy>();
    for (const e of this.eventStore.replay({ type: "PermissionPolicyPublished" })) {
      const p = e.payload as Record<string, unknown>;
      const urn = String(p.agentUrn ?? "");
      if (!urn) continue;
      byUrn.set(urn, payloadToPolicy(p));
    }
    return [...byUrn.values()].sort((a, b) => a.agentUrn.localeCompare(b.agentUrn));
  }
}

function payloadToPolicy(p: Record<string, unknown>): PermissionPolicy {
  return {
    agentUrn: String(p.agentUrn ?? ""),
    capabilityAllowList: Array.isArray(p.capabilityAllowList)
      ? (p.capabilityAllowList as string[]).map(String)
      : [],
    eventEmitAllowList: Array.isArray(p.eventEmitAllowList)
      ? (p.eventEmitAllowList as string[]).map(String)
      : [],
    eventSubscribeAllowList: Array.isArray(p.eventSubscribeAllowList)
      ? (p.eventSubscribeAllowList as string[]).map(String)
      : [],
    registerWriteAllowList: Array.isArray(p.registerWriteAllowList)
      ? (p.registerWriteAllowList as string[]).map(String)
      : [],
    policyHash: String(p.policyHash ?? ""),
    derivedFromSpecHash: String(p.derivedFromSpecHash ?? ""),
  };
}
