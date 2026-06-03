// platform/simulation/hub/index.ts
//
// ThirdPartySimHub — the centralised registry + orchestrator for every
// 3rd-party (external) simulator. One place to list, configure, start/stop,
// fire, observe, and read the recently-emitted simulated events from.
//
// Principle 1: the hub holds no business state of its own. Per-module event
// counts and the recent-events feed are projections over the event store,
// derived on demand from the simulated actor ids.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import { bankLifecyclePhase } from "../../event-store/provenance";
import type { EventStore } from "../../event-store/store";
import type { SimConfigField, SimStatus, SimulatorDescriptor, SimulatorModule } from "./types";

/** Actor-id prefixes that identify a simulated emission. */
const SIM_ACTOR_RX = /^(agent:env:|simulator:|third-party-sim-hub:)/;

/** One row of the recently-emitted simulated-events feed. */
export interface SimEventFeedItem {
  readonly eventId: string;
  readonly type: string;
  readonly asOf: string;
  readonly actor: string;
  readonly scenario: string | null;
  readonly kind: string | null;
}

interface ActorStat {
  count: number;
  lastAt: string;
  lastType: string;
}

export class ThirdPartySimHub {
  private readonly modules = new Map<string, SimulatorModule>();
  private readonly eventStore: EventStore;

  constructor(args: { eventStore: EventStore }) {
    this.eventStore = args.eventStore;
  }

  /** Register a module. Throws on duplicate id (deterministic roster). */
  register(mod: SimulatorModule): void {
    if (this.modules.has(mod.id)) {
      throw new Error(`ThirdPartySimHub: duplicate simulator id '${mod.id}'`);
    }
    this.modules.set(mod.id, mod);
  }

  has(id: string): boolean {
    return this.modules.has(id);
  }

  private get(id: string): SimulatorModule {
    const mod = this.modules.get(id);
    if (!mod) throw new Error(`ThirdPartySimHub: unknown simulator id '${id}'`);
    return mod;
  }

  /** Registry projection, grouped by domain (stable order of registration). */
  list(): Array<{ domain: string; simulators: SimulatorDescriptor[] }> {
    const byDomain = new Map<string, SimulatorDescriptor[]>();
    for (const mod of this.modules.values()) {
      const desc: SimulatorDescriptor = {
        id: mod.id,
        label: mod.label,
        domain: mod.domain,
        description: mod.description,
        mode: mod.mode,
        configSchema: mod.configSchema,
        fireActions: mod.fireActions ?? [],
      };
      const arr = byDomain.get(mod.domain) ?? [];
      arr.push(desc);
      byDomain.set(mod.domain, arr);
    }
    return [...byDomain.entries()].map(([domain, simulators]) => ({ domain, simulators }));
  }

  /**
   * Validate + coerce a raw config object against a schema. Numbers are coerced
   * from strings and bounded; booleans coerced; enum options enforced. Unknown
   * keys are dropped. Throws on a value that cannot be coerced or is out of range.
   */
  validateConfig(
    schema: readonly SimConfigField[],
    raw: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of schema) {
      const v = raw[field.key];
      if (v === undefined || v === null || v === "") continue; // omitted → module default
      switch (field.type) {
        case "number": {
          const n = typeof v === "number" ? v : Number(v);
          if (!Number.isFinite(n)) {
            throw new Error(`config '${field.key}' must be a number (got ${JSON.stringify(v)})`);
          }
          if (field.min !== undefined && n < field.min) {
            throw new Error(`config '${field.key}' must be >= ${field.min}`);
          }
          if (field.max !== undefined && n > field.max) {
            throw new Error(`config '${field.key}' must be <= ${field.max}`);
          }
          out[field.key] = n;
          break;
        }
        case "boolean": {
          out[field.key] = v === true || v === "true" || v === 1 || v === "1";
          break;
        }
        case "select": {
          const s = String(v);
          if (field.options && !field.options.includes(s)) {
            throw new Error(
              `config '${field.key}' must be one of ${field.options.join(", ")} (got '${s}')`,
            );
          }
          out[field.key] = s;
          break;
        }
        default: {
          out[field.key] = String(v);
        }
      }
    }
    return out;
  }

  start(id: string, config?: Record<string, unknown>): SimStatus {
    // Sandbox gate (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2): the 3rd-party
    // simulator runs only under bank-wide `sim` mode (build-phase). At
    // commencement (`prod` mode) the bank operates on production data and the
    // simulator must stay off. `bankLifecyclePhase()` reflects the event-sourced
    // bank-mode policy (synced at boot + on every set).
    if (bankLifecyclePhase() === "commencement") {
      throw new Error(
        `ThirdPartySimHub: refusing to start simulator '${id}' — bank is in prod mode (commencement); the sandbox simulator is sim-mode only`,
      );
    }
    const mod = this.get(id);
    const validated = this.validateConfig(mod.configSchema, config ?? {});
    mod.start(validated);
    return this.status(id);
  }

  stop(id: string): SimStatus {
    const mod = this.get(id);
    mod.stop();
    return this.status(id);
  }

  async fire(
    id: string,
    actionId: string,
    args?: Record<string, unknown>,
  ): Promise<{ ok: boolean; detail?: unknown; status: SimStatus }> {
    const mod = this.get(id);
    if (typeof mod.fire !== "function") {
      throw new Error(`simulator '${id}' does not support fire actions`);
    }
    const action = (mod.fireActions ?? []).find((a) => a.id === actionId);
    if (!action) throw new Error(`simulator '${id}' has no fire action '${actionId}'`);
    const validatedArgs = action.argsSchema
      ? this.validateConfig(action.argsSchema, args ?? {})
      : (args ?? {});
    const result = await mod.fire(actionId, validatedArgs);
    return { ...result, status: this.status(id) };
  }

  /** Single-module status, enriched with event-derived counts. */
  status(id: string): SimStatus {
    const mod = this.get(id);
    return this.enrich(mod, this.deriveActorStats());
  }

  /** All statuses, grouped by domain, computed from one replay pass. */
  statusAll(): Array<{ domain: string; statuses: SimStatus[] }> {
    const stats = this.deriveActorStats();
    const byDomain = new Map<string, SimStatus[]>();
    for (const mod of this.modules.values()) {
      const arr = byDomain.get(mod.domain) ?? [];
      arr.push(this.enrich(mod, stats));
      byDomain.set(mod.domain, arr);
    }
    return [...byDomain.entries()].map(([domain, statuses]) => ({ domain, statuses }));
  }

  /** Recently-emitted simulated events, newest-first, capped at `limit`. */
  recentSimulatedEvents(limit = 50): SimEventFeedItem[] {
    const buf: SimEventFeedItem[] = [];
    for (const evt of this.eventStore.replay()) {
      const actorId = evt.actor?.id ?? "";
      const kind = evt.provenance?.kind ?? null;
      if (kind !== "simulated" && !SIM_ACTOR_RX.test(actorId)) continue;
      buf.push({
        eventId: evt.event_id,
        type: evt.type,
        asOf: evt.as_of,
        actor: actorId,
        scenario: evt.provenance?.scenario ?? null,
        kind,
      });
      if (buf.length > limit) buf.shift(); // ASC replay → keep tail
    }
    return buf.reverse();
  }

  // -------------------------------------------------------------------------

  private deriveActorStats(): Map<string, ActorStat> {
    const map = new Map<string, ActorStat>();
    for (const evt of this.eventStore.replay()) {
      const actorId = evt.actor?.id;
      if (!actorId || !SIM_ACTOR_RX.test(actorId)) continue;
      const cur = map.get(actorId) ?? { count: 0, lastAt: "", lastType: "" };
      cur.count += 1;
      cur.lastAt = evt.as_of; // replay is ASC → ends at latest
      cur.lastType = evt.type;
      map.set(actorId, cur);
    }
    return map;
  }

  private enrich(mod: SimulatorModule, stats: Map<string, ActorStat>): SimStatus {
    const base = mod.getStatus();
    if (mod.eventActorIds.length === 0) return base;
    let count = 0;
    let lastAt: string | null = null;
    let lastType: string | null = null;
    for (const actorId of mod.eventActorIds) {
      const s = stats.get(actorId);
      if (!s) continue;
      count += s.count;
      if (lastAt === null || s.lastAt > lastAt) {
        lastAt = s.lastAt;
        lastType = s.lastType;
      }
    }
    return {
      ...base,
      eventsEmitted: count,
      lastEventAt: lastAt,
      lastEventType: lastType,
    };
  }
}
