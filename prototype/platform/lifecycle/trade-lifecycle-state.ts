// platform/lifecycle/trade-lifecycle-state.ts
//
// D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR4 — the single, registry-driven
// resolver for "is this trade/position instance live / matured / settled /
// cancelled / failed?". Generalises the hand-built two-pass "cancelled-set" /
// "terminal-set" patterns duplicated across RWA, the dashboard book tiles,
// repricing-gap, daily-P&L, and the FX position folds into one definition keyed
// off TRADE_LIFECYCLE_REGISTRY — so every projection answers the lifecycle
// question the same way.
//
// Instance-id extraction is uniform: the registry declares the opening
// `instanceIdField` (e.g. "tradeId.value" for FX's CDM identifier, "depositId"
// for MMD). `extractInstanceId` resolves the dot-path and accepts BOTH a plain
// string and a CDM `{ value }` object, so the same base field works for an FX
// opening (CDM object) and its terminal events (plain string), and for every
// non-FX product (string at both ends).
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import {
  type LifecycleDefinition,
  TRADE_LIFECYCLE_REGISTRY,
  type TerminalPath,
} from "./trade-lifecycle-registry";

export type InstanceLifecycleState = "live" | "matured" | "settled" | "cancelled" | "failed";

export interface InstanceStatus {
  readonly instanceId: string;
  readonly lifecycleId: string;
  readonly productType: string;
  readonly state: InstanceLifecycleState;
  readonly terminalPath?: TerminalPath;
  /** event_id of the opening event, or "" when only a terminal was observed. */
  readonly openingEventId: string;
}

interface EventLike {
  readonly type: string;
  readonly event_id: string;
  readonly payload: Record<string, unknown>;
}

/** Strip a trailing `.value` so the same base field resolves opening + terminal. */
function baseInstanceField(instanceIdField: string): string {
  return instanceIdField.replace(/\.value$/, "");
}

/**
 * Resolve an instance id from a payload by dot-path. Accepts a plain string OR
 * a CDM identifier object `{ value: string }` at the leaf — so FX (CDM object
 * on the opening, plain string on terminals) and every other product (string
 * throughout) are handled by one extractor.
 */
export function extractInstanceId(
  payload: Record<string, unknown>,
  field: string,
): string | undefined {
  let cur: unknown = payload;
  for (const part of field.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  if (typeof cur === "string") return cur;
  if (cur && typeof cur === "object" && typeof (cur as { value?: unknown }).value === "string") {
    return (cur as { value: string }).value;
  }
  return undefined;
}

/** Map a terminal path + event type to the lifecycle state it produces. */
function terminalState(path: TerminalPath, eventType: string): InstanceLifecycleState {
  if (path === "cancellation") return "cancelled";
  if (path === "failure") return "failed";
  // normal / amendment closures — maturity events vs settlement events.
  if (eventType.includes("Matured")) return "matured";
  return "settled";
}

interface TerminalRef {
  readonly def: LifecycleDefinition;
  readonly path: TerminalPath;
}

let OPENING_INDEX: Map<string, LifecycleDefinition> | null = null;
let TERMINAL_INDEX: Map<string, TerminalRef> | null = null;

function indexes(): {
  opening: Map<string, LifecycleDefinition>;
  terminal: Map<string, TerminalRef>;
} {
  if (!OPENING_INDEX || !TERMINAL_INDEX) {
    OPENING_INDEX = new Map();
    TERMINAL_INDEX = new Map();
    for (const def of TRADE_LIFECYCLE_REGISTRY) {
      OPENING_INDEX.set(def.openingEventType, def);
      for (const t of def.terminalConditions) {
        TERMINAL_INDEX.set(t.eventType, { def, path: t.path });
      }
    }
  }
  return { opening: OPENING_INDEX, terminal: TERMINAL_INDEX };
}

/**
 * Resolve the lifecycle state of every registered instance from a single pass
 * over `events`. Opening events create a `live` instance; terminal events move
 * it to its closed state (terminal-wins; later terminals supersede earlier).
 * Terminals observed without a matching opening (opening outside the filter /
 * window) still record the closed state with an empty `openingEventId`.
 */
export function resolveTradeLifecycle(events: Iterable<EventLike>): Map<string, InstanceStatus> {
  const { opening, terminal } = indexes();
  const result = new Map<string, InstanceStatus>();

  for (const ev of events) {
    const openDef = opening.get(ev.type);
    if (openDef) {
      const id = extractInstanceId(ev.payload, baseInstanceField(openDef.instanceIdField));
      if (id && !result.has(id)) {
        result.set(id, {
          instanceId: id,
          lifecycleId: openDef.lifecycleId,
          productType: openDef.productType,
          state: "live",
          openingEventId: ev.event_id,
        });
      }
      continue;
    }
    const term = terminal.get(ev.type);
    if (term) {
      const id = extractInstanceId(ev.payload, baseInstanceField(term.def.instanceIdField));
      if (!id) continue;
      const state = terminalState(term.path, ev.type);
      const existing = result.get(id);
      result.set(id, {
        instanceId: id,
        lifecycleId: term.def.lifecycleId,
        productType: term.def.productType,
        state,
        terminalPath: term.path,
        openingEventId: existing?.openingEventId ?? "",
      });
    }
  }

  return result;
}

/** True iff the instance is open (not matured / settled / cancelled / failed). */
export function isLiveInstance(status: InstanceStatus | undefined): boolean {
  return status?.state === "live";
}

/**
 * True iff the instance was cancelled (voided before completion). Distinct from
 * `!isLiveInstance`: a settled / matured FX spot is NOT live but is also NOT
 * cancelled — the bank still holds the resulting currency position, so net-FX /
 * sub-ledger folds exclude only cancellations, not settlements.
 */
export function isCancelledInstance(status: InstanceStatus | undefined): boolean {
  return status?.state === "cancelled";
}

/** The set of instance ids that are live in the resolved index. */
export function liveInstanceIds(index: Map<string, InstanceStatus>): Set<string> {
  const live = new Set<string>();
  for (const [id, status] of index) {
    if (status.state === "live") live.add(id);
  }
  return live;
}
