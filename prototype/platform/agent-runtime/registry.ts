// platform/agent-runtime/registry.ts
//
// A1.1 — Agent registry. Component #1 of the agent-runtime substrate
// (Atlas spec §3.1, §5; Owner Inbox/2026-05-07_atlas_agent-runtime-substrate-spec.md).
//
// Each `/Team/<Name>.md` operating spec resolves to exactly one agent
// identity. The registry's job is the resolution: validate the parsed
// spec, mint the URN, decide whether this is a fresh registration or a
// version-bump of an existing one, and emit `AgentRegistered` to the
// event log. The event log is the authoritative state (P1 — events are
// the only source of truth); the registry's `list()` and `lookup()`
// are queries that fold the event stream.
//
// What the registry does *not* do (deferred):
//   - Mint signing-key material — Atlas spec §3.1 calls this `AgentIdentityIssuer`;
//     A1.2 work. Today the registry's notion of "identity" is just the URN.
//   - Publish permission policies — A2.
//   - Subscribe to schedule / trigger streams — A2 (scheduler) / A3 (bus).
//
// Idempotency contract:
//   - First registration of `agentUrn` → emit `AgentRegistered`.
//   - Re-registration with identical `specHash` → no event, status
//     `unchanged`.
//   - Re-registration with different `specHash` → emit a new
//     `AgentRegistered` (latest-wins-per-key on `agentUrn`).
//   - Note: the typed payload's `specVersion` is the persona file's
//     own change-log convention, not the registry's monotonic counter.
//     The registry treats `specHash` as the canonical change signal.
//
// Author: Atlas (A1.1)

import { makeAgentRegistered } from "../event-store/event-types";
import type { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";

import type { AgentSpec } from "./spec-parser";

/** URN for an agent. `agent:<lowercased-persona-name>`. */
export type AgentUrn = string;

/**
 * Outcome of `register()`. Distinguishes:
 *   - `registered` — first time this urn appears.
 *   - `updated`    — urn existed but specHash changed; new event emitted.
 *   - `unchanged`  — urn existed with same specHash; no event emitted.
 */
export type RegistrationStatus = "registered" | "updated" | "unchanged";

export interface RegistrationResult {
  readonly status: RegistrationStatus;
  readonly urn: AgentUrn;
  readonly specVersion: string;
  readonly specHash: string;
  /** True if the call appended an `AgentRegistered` event. */
  readonly eventEmitted: boolean;
}

export interface AgentRegistry {
  /**
   * Validate the spec and emit `AgentRegistered` per the idempotency
   * contract. Returns the outcome — callers (the CLI sync, future
   * runtime handlers) log the per-agent status.
   */
  register(spec: AgentSpec): RegistrationResult;

  /** Look up the latest known spec for `urn`. Folds the event stream. */
  lookup(urn: AgentUrn): AgentSpec | undefined;

  /**
   * List the latest known spec for every registered agent, sorted by
   * persona name. Folds the event stream — the registry holds no
   * authoritative in-memory state across processes (P1 discipline).
   */
  list(): readonly AgentSpec[];
}

/**
 * Configuration the registry needs from the composition root. Kept
 * narrow on purpose — the registry is a pure consumer of the event
 * store + an event-emitting authority.
 */
export interface AgentRegistryConfig {
  /**
   * The event store to fold and append to. Production-grade: the cloud
   * event store (M8). Local: the SQLite store from
   * `prototype/platform/composition.ts`.
   */
  readonly eventStore: EventStore;
  /**
   * Legal entity to stamp on emitted events. Defaults to `BANK-ZA-001`
   * (the bank's single SA entity today; P5 multi-entity from day one).
   */
  readonly entity?: string;
  /**
   * Actor to stamp on emitted events. Defaults to the registry's own
   * service identity. The CLI sync uses the default; future runtime
   * handlers may pass their own (e.g. Atlas's spec-review agent).
   */
  readonly actor?: Actor;
  /**
   * Citations to stamp on emitted events (P2). Defaults to the
   * registry's standing citation set: governance authority + Joint
   * Standard 1 of 2024 (cyber resilience — agent identity is part of
   * the zero-trust posture).
   */
  readonly citations?: readonly string[];
  /**
   * Function returning the as-of timestamp for emitted events. Defaults
   * to `() => new Date().toISOString()`. Tests inject deterministic
   * clocks.
   */
  readonly now?: () => string;
}

const DEFAULT_ACTOR: Actor = {
  type: "service",
  id: "agent:atlas:registry",
};

const DEFAULT_CITATIONS: readonly string[] = [
  "GOV-FRAMEWORK-CEO-RESERVED",
  "JOINT-STANDARD-2-2024",
];

const DEFAULT_ENTITY = "BANK-ZA-001";

/**
 * Decode the `AgentRegistered` payload back into an `AgentSpec`. The
 * payload is a structurally-similar projection minus `sourcePath`
 * (the file path is not load-bearing once the spec is registered).
 *
 * The empty `sourcePath` is intentional — `lookup()` and `list()`
 * return derived state from the event log, not file-system state.
 */
function payloadToSpec(payload: Record<string, unknown>): AgentSpec {
  return {
    personaName: String(payload.personaName ?? ""),
    agentUrn: String(payload.agentUrn ?? ""),
    role: "(from event store — role not in payload)",
    reportsTo: String(payload.reportsTo ?? ""),
    cadenceMode: String(payload.cadenceMode ?? ""),
    triggerCount: Number(payload.triggerCount ?? 0),
    decisionsInScopeCount: Number(payload.decisionsInScopeCount ?? 0),
    decisionsEscalateCount: Number(payload.decisionsEscalateCount ?? 0),
    systemCapabilities: Array.isArray(payload.systemCapabilities)
      ? (payload.systemCapabilities as string[]).map(String)
      : [],
    eventsEmitted: Array.isArray(payload.eventsEmitted)
      ? (payload.eventsEmitted as string[]).map(String)
      : [],
    proceduresOwned: Array.isArray(payload.proceduresOwned)
      ? (payload.proceduresOwned as string[]).map(String)
      : [],
    specVersion: String(payload.specVersion ?? "v1.0"),
    specHash: String(payload.specHash ?? ""),
    sourcePath: "",
  };
}

/**
 * Local-first implementation of `AgentRegistry`. Authoritative state is
 * the event store; this class is a thin command + query layer.
 */
export class LocalAgentRegistry implements AgentRegistry {
  private readonly eventStore: EventStore;
  private readonly entity: string;
  private readonly actor: Actor;
  private readonly citations: readonly string[];
  private readonly now: () => string;

  constructor(config: AgentRegistryConfig) {
    this.eventStore = config.eventStore;
    this.entity = config.entity ?? DEFAULT_ENTITY;
    this.actor = config.actor ?? DEFAULT_ACTOR;
    this.citations = config.citations ?? DEFAULT_CITATIONS;
    this.now = config.now ?? (() => new Date().toISOString());
  }

  register(spec: AgentSpec): RegistrationResult {
    const existing = this.lookup(spec.agentUrn);
    if (existing && existing.specHash === spec.specHash) {
      return {
        status: "unchanged",
        urn: spec.agentUrn,
        specVersion: existing.specVersion,
        specHash: existing.specHash,
        eventEmitted: false,
      };
    }
    const status: RegistrationStatus = existing ? "updated" : "registered";
    this.eventStore.append(
      makeAgentRegistered({
        asOf: this.now(),
        entity: this.entity,
        actor: this.actor,
        citations: [...this.citations],
        payload: {
          agentUrn: spec.agentUrn,
          personaName: spec.personaName,
          reportsTo: spec.reportsTo,
          cadenceMode: spec.cadenceMode,
          triggerCount: spec.triggerCount,
          decisionsInScopeCount: spec.decisionsInScopeCount,
          decisionsEscalateCount: spec.decisionsEscalateCount,
          systemCapabilities: [...spec.systemCapabilities],
          eventsEmitted: [...spec.eventsEmitted],
          proceduresOwned: [...spec.proceduresOwned],
          specVersion: spec.specVersion,
          specHash: spec.specHash,
        },
      }),
    );
    return {
      status,
      urn: spec.agentUrn,
      specVersion: spec.specVersion,
      specHash: spec.specHash,
      eventEmitted: true,
    };
  }

  lookup(urn: AgentUrn): AgentSpec | undefined {
    // Fold the AgentRegistered stream; latest-wins-per-key on agentUrn.
    let latest: AgentSpec | undefined;
    for (const e of this.eventStore.replay({ type: "AgentRegistered" })) {
      const payload = e.payload as Record<string, unknown>;
      if (payload.agentUrn === urn) {
        latest = payloadToSpec(payload);
      }
    }
    return latest;
  }

  list(): readonly AgentSpec[] {
    // Fold every AgentRegistered event into a map keyed on agentUrn,
    // taking latest-wins. Sort by personaName for deterministic output.
    const byUrn = new Map<string, AgentSpec>();
    for (const e of this.eventStore.replay({ type: "AgentRegistered" })) {
      const payload = e.payload as Record<string, unknown>;
      const urn = String(payload.agentUrn ?? "");
      if (!urn) continue;
      byUrn.set(urn, payloadToSpec(payload));
    }
    return [...byUrn.values()].sort((a, b) => a.personaName.localeCompare(b.personaName));
  }
}
