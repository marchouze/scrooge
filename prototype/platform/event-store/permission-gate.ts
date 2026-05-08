// platform/event-store/permission-gate.ts
//
// A1.2 — Event-store permission gate. Hook for the event store's
// `append` path that asserts the actor's agent identity is allowed to
// emit the event type per its published permission policy.
//
// Per Atlas spec §3.1:
//   - The actor's `agent:<urn>` resolves to a registered agent.
//   - The event type is in the agent's `eventEmitAllowList`.
//   - If both pass: append succeeds.
//   - If either fails: append rejects with a typed error AND emits a
//     `SubstrateAlert` (alertClass: integrity).
//
// Vera carve-out: Vera's identity has a hardcoded read-only over every
// stream regardless of permission policy. Vera *cannot* write to streams
// outside her published allow-list — read-only carve-out is asymmetric
// (third-line independence: Vera reads everything to assert; Vera can
// only write what her spec authorises).
//
// Feature-flag posture:
//   - The gate is opt-in via `BANK_PERMISSION_GATE_ENABLED=true`.
//     Default: off. Atlas's spec calls this "the gate is opt-in until
//     A2 is proven; flips on at the M8 cloud lift". Until then, many
//     legacy events were emitted before the gate existed and would fail
//     retroactively if the gate were enabled by default.
//
// Author: Atlas + Senna (A1.2)

import type { PermissionPolicyResolver } from "../agent-identity/permission-policy";
import type { EventStore } from "./store";
import type { Event } from "./types";

/** Vera's URN. Hardcoded — third-line read carve-out is non-configurable. */
export const VERA_URN = "agent:vera";

/** Error thrown when the gate denies an append. */
export class PermissionGateDenied extends Error {
  readonly agentUrn: string | undefined;
  readonly eventType: string;
  readonly reason: string;

  constructor(args: { agentUrn: string | undefined; eventType: string; reason: string }) {
    super(
      `Permission gate denied: actor=${args.agentUrn ?? "<no-agent>"} type=${args.eventType} reason=${args.reason}`,
    );
    this.name = "PermissionGateDenied";
    this.agentUrn = args.agentUrn;
    this.eventType = args.eventType;
    this.reason = args.reason;
  }
}

/** Decision the gate produces — used by the wrapper around append. */
export interface GateDecision {
  readonly allowed: boolean;
  readonly reason?: string;
}

export interface PermissionGateConfig {
  /** Resolver that returns the latest policy for a given agentUrn. */
  readonly policy: PermissionPolicyResolver;
  /**
   * If true, override the env-var feature flag and force-enable. Used by
   * tests that want to assert gate behaviour without setting env vars.
   * Falls through to env-var inspection when false / undefined.
   */
  readonly forceEnabled?: boolean;
  /**
   * Hook invoked when the gate denies an append. Production: emit a
   * `SubstrateAlert` to the event store. Tests: collect into an array
   * for assertion. The hook must not throw — the gate decision is the
   * return value.
   */
  readonly onDeny?: (decision: { event: Event; reason: string }) => void;
}

/**
 * Returns true when the gate should be active for this process. Reads
 * `BANK_PERMISSION_GATE_ENABLED` at call time — production sets this
 * via IaC; tests set it via `process.env`. The flip-on-day is the
 * substrate-state event-stream cleanup that A2's runner emits.
 */
export function isGateEnabled(forceEnabled?: boolean): boolean {
  if (forceEnabled === true) return true;
  return process.env.BANK_PERMISSION_GATE_ENABLED === "true";
}

/**
 * Pure decision function. Doesn't side-effect; callers route the
 * allowed/denied path through `onDeny`. Vera carve-out is enforced
 * here: writes outside the policy allow-list still deny — only *reads*
 * are unconstrained for Vera, and reads don't go through `append`.
 */
export function decideAppend(args: {
  event: Event;
  policy: PermissionPolicyResolver;
}): GateDecision {
  const actor = args.event.actor;
  // Only `service` actors with `agent:<urn>` ids are subject to the
  // permission gate today. Human actors (CEO decisions) and `system`
  // actors are bypassed — they go through the dashboard / runtime
  // authentication paths instead. This keeps the gate scoped to
  // autonomous agent appends.
  if (actor.type !== "service" || !actor.id.startsWith("agent:")) {
    return { allowed: true };
  }
  const urn = actor.id;
  const policy = args.policy.lookup(urn);
  if (!policy) {
    return {
      allowed: false,
      reason: `no permission policy published for ${urn}`,
    };
  }
  if (!policy.eventEmitAllowList.includes(args.event.type)) {
    return {
      allowed: false,
      reason: `${urn} not allowed to emit ${args.event.type} (allow-list: ${policy.eventEmitAllowList.join(", ") || "<empty>"})`,
    };
  }
  return { allowed: true };
}

/**
 * Wrap an existing `EventStore`'s append path with the permission gate.
 * Returns a new object that delegates to the underlying store but runs
 * the gate first when enabled.
 *
 * The wrapper preserves identity for `replay`, `count`, `close`, etc. —
 * Vera's read carve-out flows through naturally because reads are not
 * intercepted.
 */
export function gateEventStore(args: {
  store: EventStore;
  config: PermissionGateConfig;
}): EventStore {
  const { store, config } = args;
  // We expose the same surface as EventStore but intercept append.
  // Bun's class-based EventStore is structurally typed; we use a
  // proxy-style wrapper.
  const wrapped: EventStore = Object.create(store) as EventStore;
  wrapped.append = (raw: Event) => {
    if (!isGateEnabled(config.forceEnabled)) {
      return store.append(raw);
    }
    const decision = decideAppend({ event: raw, policy: config.policy });
    if (!decision.allowed) {
      const reason = decision.reason ?? "denied";
      if (config.onDeny) {
        try {
          config.onDeny({ event: raw, reason });
        } catch {
          // onDeny must not propagate; the gate decision dominates.
        }
      }
      throw new PermissionGateDenied({
        agentUrn: raw.actor.id.startsWith("agent:") ? raw.actor.id : undefined,
        eventType: raw.type,
        reason,
      });
    }
    return store.append(raw);
  };
  // appendAll batches through the same path; each event re-runs the
  // gate so a partial-failure event in the middle still rolls the
  // whole batch back via SQLite's transaction.
  wrapped.appendAll = (events: Event[]) => {
    if (!isGateEnabled(config.forceEnabled)) {
      return store.appendAll(events);
    }
    for (const e of events) {
      const decision = decideAppend({ event: e, policy: config.policy });
      if (!decision.allowed) {
        const reason = decision.reason ?? "denied";
        if (config.onDeny) {
          try {
            config.onDeny({ event: e, reason });
          } catch {
            // swallowed
          }
        }
        throw new PermissionGateDenied({
          agentUrn: e.actor.id.startsWith("agent:") ? e.actor.id : undefined,
          eventType: e.type,
          reason,
        });
      }
    }
    return store.appendAll(events);
  };
  return wrapped;
}
