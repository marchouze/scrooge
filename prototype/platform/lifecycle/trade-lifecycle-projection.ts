// platform/lifecycle/trade-lifecycle-projection.ts
//
// Folds the event store to derive the current state of every trade lifecycle
// instance (open vs closed, which terminal path was taken).
//
// Design: pure fold over an event array — no side effects, no I/O.
// The caller supplies the event array; the projection returns LifecycleInstance[].
//
// Author: Atlas (Core banking platform architect, engineering).

import type { Event } from "../event-store/types";
import {
  type LifecycleDefinition,
  type LifecycleState,
  TRADE_LIFECYCLE_REGISTRY,
  type TerminalPath,
} from "./trade-lifecycle-registry";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LifecycleInstance {
  /** The instance identifier extracted from the opening event payload. */
  instanceId: string;
  /** References TRADE_LIFECYCLE_REGISTRY[n].lifecycleId. */
  lifecycleId: string;
  /** event_id of the opening event. */
  openingEventId: string;
  /** Event type that opened this lifecycle. */
  openingEventType: string;
  /** as_of of the opening event (ISO 8601). */
  openedAt: string;
  /** "open" if no terminal event has been seen; "closed" otherwise. */
  state: LifecycleState;
  /** event_id of the terminal event (if closed). */
  terminalEventId?: string;
  /** Event type that closed this lifecycle (if closed). */
  terminalEventType?: string;
  /** Path classification of the terminal event (if closed). */
  terminalPath?: TerminalPath;
  /** as_of of the terminal event (ISO 8601, if closed). */
  closedAt?: string;
  /** All event types observed for this instance (opening + in-flight + terminal). */
  seenEventTypes: string[];
}

// ---------------------------------------------------------------------------
// Internal — resolve instance ID from a dot-path into the event payload
// ---------------------------------------------------------------------------

function resolveInstanceId(payload: Record<string, unknown>, dotPath: string): string | undefined {
  const parts = dotPath.split(".");
  // biome-ignore lint/suspicious/noExplicitAny: deliberate dynamic traversal
  let cursor: any = payload;
  for (const part of parts) {
    if (cursor === null || cursor === undefined || typeof cursor !== "object") return undefined;
    cursor = cursor[part];
  }
  return typeof cursor === "string" && cursor.length > 0 ? cursor : undefined;
}

// ---------------------------------------------------------------------------
// Main projection
// ---------------------------------------------------------------------------

/**
 * Build the lifecycle state for every trade lifecycle instance found in
 * the event array. Returns one LifecycleInstance per opened trade.
 *
 * Events whose type is not recognised by any lifecycle definition are
 * silently ignored.
 */
export function buildTradeLifecycleView(events: readonly Event[]): LifecycleInstance[] {
  // Map from instanceId → lifecycle instance state (mutable during fold).
  const instances = new Map<
    string,
    {
      def: LifecycleDefinition;
      instance: LifecycleInstance;
    }
  >();

  // Index terminal condition lookup: eventType → { def, terminalCondition }
  // for fast lookup when we encounter a potential terminal event.
  const terminalIndex = new Map<string, { def: LifecycleDefinition; path: TerminalPath }[]>();
  for (const def of TRADE_LIFECYCLE_REGISTRY) {
    for (const tc of def.terminalConditions) {
      const existing = terminalIndex.get(tc.eventType) ?? [];
      existing.push({ def, path: tc.path });
      terminalIndex.set(tc.eventType, existing);
    }
  }

  // Index in-flight event types: eventType → lifecycleId[] for fast lookup.
  const inFlightIndex = new Map<string, string[]>();
  for (const def of TRADE_LIFECYCLE_REGISTRY) {
    for (const evType of def.inFlightEventTypes) {
      const existing = inFlightIndex.get(evType) ?? [];
      existing.push(def.lifecycleId);
      inFlightIndex.set(evType, existing);
    }
  }

  for (const event of events) {
    const payload = (event.payload ?? {}) as Record<string, unknown>;

    // ── Opening event? ────────────────────────────────────────────────────
    const openingDef = TRADE_LIFECYCLE_REGISTRY.find((d) => d.openingEventType === event.type);
    if (openingDef) {
      const instanceId = resolveInstanceId(payload, openingDef.instanceIdField);
      if (instanceId) {
        const key = `${openingDef.lifecycleId}:${instanceId}`;
        if (!instances.has(key)) {
          instances.set(key, {
            def: openingDef,
            instance: {
              instanceId,
              lifecycleId: openingDef.lifecycleId,
              openingEventId: event.event_id,
              openingEventType: event.type,
              openedAt: event.as_of,
              state: "open",
              seenEventTypes: [event.type],
            },
          });
        }
      }
      continue;
    }

    // ── Terminal event? ───────────────────────────────────────────────────
    const terminalMatches = terminalIndex.get(event.type);
    if (terminalMatches) {
      for (const { def, path } of terminalMatches) {
        const instanceId = resolveInstanceId(payload, def.instanceIdField);
        if (!instanceId) continue;
        const key = `${def.lifecycleId}:${instanceId}`;
        const entry = instances.get(key);
        if (entry && entry.instance.state === "open") {
          entry.instance.state = "closed";
          entry.instance.terminalEventId = event.event_id;
          entry.instance.terminalEventType = event.type;
          entry.instance.terminalPath = path;
          entry.instance.closedAt = event.as_of;
          if (!entry.instance.seenEventTypes.includes(event.type)) {
            entry.instance.seenEventTypes.push(event.type);
          }
        }
      }
      continue;
    }

    // ── In-flight event? ─────────────────────────────────────────────────
    const inFlightLifecycleIds = inFlightIndex.get(event.type);
    if (inFlightLifecycleIds) {
      for (const lifecycleId of inFlightLifecycleIds) {
        const def = TRADE_LIFECYCLE_REGISTRY.find((d) => d.lifecycleId === lifecycleId);
        if (!def) continue;
        const instanceId = resolveInstanceId(payload, def.instanceIdField);
        if (!instanceId) continue;
        const key = `${lifecycleId}:${instanceId}`;
        const entry = instances.get(key);
        if (entry && !entry.instance.seenEventTypes.includes(event.type)) {
          entry.instance.seenEventTypes.push(event.type);
        }
      }
    }
  }

  return Array.from(instances.values()).map((e) => e.instance);
}
