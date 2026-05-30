// platform/simulation/hub/types.ts
//
// Common module contract for the centralised 3rd-party simulator hub.
//
// A "3rd-party simulator" models what an *external* party does to the bank —
// counterparties requesting trades, correspondents sending advices/statements,
// regulators acknowledging submissions, market-data feeds ticking. It is
// distinct from the bank's *internal* behaviour (e.g. the FX market-maker that
// responds to a counterparty request — that lives in EnvSimEngine and is
// surfaced at /fx-sim).
//
// Every module is self-describing (id/label/domain/config-schema/fire-actions)
// and conforms to the start/stop/isRunning lifecycle the env-sim sub-simulators
// already implement. Observability is events-first (Principle 1): a module
// declares the actor ids its emissions carry, and the hub derives event counts
// from the event store rather than trusting in-memory state.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import { type ProvenanceTag, simulatedTag } from "../../event-store/provenance";

/** Domain axis a simulator belongs to (core-slice set; extensible). */
export type SimDomain =
  | "counterparty"
  | "market-data"
  | "payments"
  | "settlement"
  | "regulatory"
  | "custodian";

/**
 * Lifecycle shape:
 *   "loop"      — continuous emitter controlled by start/stop.
 *   "fire"      — one-shot, request/response (no loop).
 *   "loop+fire" — both (continuous loop plus a manual one-shot trigger).
 */
export type SimMode = "loop" | "fire" | "loop+fire";

/** JSON-schema-ish descriptor of a single config field, for UI auto-generation. */
export interface SimConfigField {
  readonly key: string;
  readonly label: string;
  readonly type: "number" | "text" | "select" | "boolean";
  readonly default: string | number | boolean;
  readonly min?: number;
  readonly max?: number;
  readonly options?: readonly string[];
  readonly help?: string;
}

/** A manual one-shot action a "fire"/"loop+fire" module exposes. */
export interface SimFireAction {
  readonly id: string;
  readonly label: string;
  readonly argsSchema?: readonly SimConfigField[];
}

/** Runtime status snapshot for a single simulator. */
export interface SimStatus {
  readonly id: string;
  readonly running: boolean;
  /** Event-derived count (Principle 1) when the module declares actor ids; else module-reported. */
  readonly eventsEmitted: number;
  readonly lastEventAt: string | null;
  readonly lastEventType: string | null;
  readonly lastError: string | null;
  readonly startedAt: string | null;
  /** Module-specific extras (e.g. FX riskMonitor + last-trade detail). */
  readonly extra?: Record<string, unknown>;
}

/** The function-bearing simulator contract held in the registry. */
export interface SimulatorModule {
  readonly id: string;
  readonly label: string;
  readonly domain: SimDomain;
  readonly description: string;
  readonly mode: SimMode;
  readonly configSchema: readonly SimConfigField[];
  readonly fireActions?: readonly SimFireAction[];
  /**
   * Actor ids this module's emissions carry. The hub derives eventsEmitted /
   * lastEventAt from the event store using these (Principle 1). Empty when the
   * module writes outside the event store (e.g. market-data → MarketDataStore).
   */
  readonly eventActorIds: readonly string[];
  start(config?: Record<string, unknown>): void;
  stop(): void;
  isRunning(): boolean;
  fire?(
    actionId: string,
    args?: Record<string, unknown>,
  ): Promise<{ ok: boolean; detail?: unknown }>;
  getStatus(): SimStatus;
}

/** Function-free projection of a module, returned by /api/sim/registry. */
export interface SimulatorDescriptor {
  readonly id: string;
  readonly label: string;
  readonly domain: SimDomain;
  readonly description: string;
  readonly mode: SimMode;
  readonly configSchema: readonly SimConfigField[];
  readonly fireActions: readonly SimFireAction[];
}

/**
 * Build the provenance tag every hub-initiated emission should carry. `scenario`
 * is required+non-empty for kind:"simulated"; defaults to "third-party-sim".
 */
export function hubSimulatedTag(id: string, scenario?: string): ProvenanceTag {
  const s = scenario && scenario.trim().length > 0 ? scenario.trim() : "third-party-sim";
  return simulatedTag({ scenario: s, sourceLineage: `third-party-sim-hub:${id}` });
}
