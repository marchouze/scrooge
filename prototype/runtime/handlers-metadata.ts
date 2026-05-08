// runtime/handlers-metadata.ts
//
// A1 — canonical handler-metadata registry.
//
// The single authoring location for the (agent, trigger) pairs the
// runtime knows about, with their kind / cadence / subscription
// metadata. Closes the drift Marc surfaced when asking why fleet
// health was out of date — there were three diverging copies of this
// list:
//
//   - `HANDLERS` map in `runtime/run.ts` (with handler callables)
//   - `RUNTIME_HANDLERS` const in `dashboard/derive.ts` (metadata only)
//   - `knownRuntimeHandlers()` in `runtime/agents/atlas-substrate-state.ts`
//     (metadata only)
//
// They drifted silently when new handlers landed (mira:citation-gate,
// anya:projection-refresh) — the dashboard kept claiming agents were
// stale that were on a different cadence than its hardcoded map said.
//
// After A1: this file is canonical. `runtime/run.ts` owns the map from
// (agent, trigger) → handler callable; the metadata array here is what
// every other consumer reads. The handler-callable map lives in
// run.ts to keep this module free of runtime side-effects (the
// dashboard imports it; the dashboard must NOT pull in composition.ts
// or the EventStore).
//
// Adding a new handler: add a metadata row here AND the handler
// callable in run.ts under the same key. Vera's planned Wave-4 #11
// recon pipeline will assert the two stay in sync.
//
// Author: Atlas

import type { TriggerKind } from "./types";

export interface HandlerMetadata {
  /** Persona name as it appears in /Team/<Name>.md */
  readonly agent: string;
  /** Trigger id — second half of the `agent:trigger` key. */
  readonly trigger: string;
  /** Trigger classification. */
  readonly kind: TriggerKind;
  /**
   * Expected cadence in hours for `scheduled` handlers. Undefined for
   * `event-driven` (fires when subscribed event lands) and `on-request`
   * (fires when something asks). Used by the fleet-health page to set
   * staleness thresholds.
   */
  readonly cadenceHours?: number;
  /**
   * For `event-driven` handlers: the event types this handler
   * subscribes to. The runtime fans out to the handler when a parent
   * run appends an event whose type intersects this set.
   */
  readonly subscribesTo?: readonly string[];
  /** Composite key — `<lowercased-agent>:<trigger>`. Computed for convenience. */
  readonly key: string;
}

function entry(
  agent: string,
  trigger: string,
  kind: TriggerKind,
  extras: { cadenceHours?: number; subscribesTo?: readonly string[] } = {},
): HandlerMetadata {
  return {
    agent,
    trigger,
    kind,
    ...(extras.cadenceHours !== undefined ? { cadenceHours: extras.cadenceHours } : {}),
    ...(extras.subscribesTo !== undefined ? { subscribesTo: extras.subscribesTo } : {}),
    key: `${agent.toLowerCase()}:${trigger}`,
  };
}

/**
 * Canonical handler metadata. Order matches the fleet-health card
 * order (engineering-first, then on-request) but is not load-bearing —
 * consumers sort their own views.
 */
export const HANDLERS_METADATA: readonly HandlerMetadata[] = [
  entry("Vera", "overnight-recon", "scheduled", { cadenceHours: 24 }),
  entry("Atlas", "substrate-state", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Helena", "risk-appetite-watch", "scheduled", { cadenceHours: 24 }),
  entry("Devon", "operational-resilience-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Camille", "financial-position-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Anya", "projection-drift", "scheduled", { cadenceHours: 24 }),
  entry("Anya", "projection-refresh", "event-driven", {
    subscribesTo: [
      "SubstrateStateSnapshot",
      "WorkstreamRegistered",
      "WorkstreamCompleted",
      "CeoDecision",
    ],
  }),
  entry("Scrooge", "inbox-hygiene", "scheduled", { cadenceHours: 24 }),
  entry("Scrooge", "ceo-decision-record", "on-request"),
  entry("Scrooge", "follow-on-router", "event-driven", {
    subscribesTo: ["CeoDecision"],
  }),
  entry("Owen", "governance-cycle-prep", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Rohan", "risk-run", "scheduled", { cadenceHours: 24 }),
  entry("Mira", "obligations-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Mira", "citation-gate", "on-request"),
  entry("Senna", "security-substrate-state", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Zara", "mlro-supervision", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Thandiwe", "audit-committee-prep", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Rashida", "cyber-resilience-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Iris", "popia-controls-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Eitan", "liquidity-snapshot", "scheduled", { cadenceHours: 24 }),
  entry("Saskia", "markets-readiness-snapshot", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Bea", "accounting-readiness", "scheduled", { cadenceHours: 24 }),
  entry("Yael", "tax-readiness", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Tomas", "payments-readiness", "scheduled", { cadenceHours: 24 }),
  entry("Imani", "legal-readiness", "scheduled", { cadenceHours: 24 * 7 }),
  entry("Ravi", "alm-readiness", "scheduled", { cadenceHours: 24 }),
  entry("Sade", "agentops-readiness", "scheduled", { cadenceHours: 24 * 7 }),
];

/** Map from `<lowercased-agent>:<trigger>` to metadata. */
export const HANDLERS_METADATA_BY_KEY: ReadonlyMap<string, HandlerMetadata> = new Map(
  HANDLERS_METADATA.map((h) => [h.key, h]),
);

/** Look up metadata by composite key. */
export function lookupHandler(key: string): HandlerMetadata | undefined {
  return HANDLERS_METADATA_BY_KEY.get(key);
}

/** All registered keys, useful for error messages. */
export function handlerKeys(): readonly string[] {
  return HANDLERS_METADATA.map((h) => h.key);
}
