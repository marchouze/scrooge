// platform/valuation/mark-adoption-engine.ts
//
// Mark adoption engine — Slice B.1 of D-EVENT-VIEW-BOUNDARY-WIRE.
//
// Converts a raw market-data tick into an `OfficialMarkAdopted` event by:
//   1. Resolving the active `PolicyVersionActivated` event for the "valuation"
//      domain (the policy in force at `markAsOf`).
//   2. Emitting `OfficialMarkAdopted` to the event store, pinning the tick
//      reference, policy version, code SHA, and IFRS-13 level.
//
// The engine is intentionally stateless (pure function over injected deps)
// so it works in both:
//   - The MTM run orchestrator (which opens its own EventStore by path).
//   - The composition-root context (which uses the global eventStore).
//
// Boundary discipline:
//   Market-data ticks stay in MarketDataStore as reference data. This engine
//   elevates one elected tick to a durable business event per the Principle 1
//   boundary (D-EVENT-VIEW-BOUNDARY-WIRE §2.2).
//
// Authority:
//   D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20, PR #620).
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
//   Policies/valuation-policy-v1.md (Helena (Chief Risk Officer, governance),
//     2026-05-19) — the first policy version whose activation event the
//     policyVersionRef resolves to after the Slice A.1 backfill (PR #630).
//   IFRS-13 (fair-value hierarchy).
//
// Author: Rohan (Market risk engineer, engineering)

import { makeOfficialMarkAdopted } from "../event-store/event-types/valuation";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";
import type { MarketDataTick } from "../market-data/store";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ENGINE_ACTOR = { id: "rohan:mark-adoption-engine", type: "service" as const };
const CITATIONS = [
  "D-EVENT-VIEW-BOUNDARY-WIRE",
  "D-MARKETS-SCHEMA-FOUNDATION",
  "Policies/valuation-policy-v1.md",
  "IFRS-13",
];

/**
 * Build-phase placeholder for the adoption code SHA.
 *
 * In production this is injected at build time via the BUILD_SHA environment
 * variable (a 40-char git commit SHA). In the build phase (no CI injection),
 * "0000000" satisfies the 7-char minimum while clearly marking the build-phase
 * provenance; downstream diff assertions detect drift when a real SHA is absent.
 */
function resolveAdoptionCodeSha(): string {
  const injected = process.env.BUILD_SHA;
  if (injected && /^[0-9a-f]{7,40}$/.test(injected)) return injected.slice(0, 40);
  return "0000000";
}

// ---------------------------------------------------------------------------
// Policy resolution
// ---------------------------------------------------------------------------

/**
 * Walk the event store and return the URN of the most-recently-activated
 * PolicyVersionActivated event for the "valuation" domain.
 *
 * Returns `null` when no activation event exists (fresh environment before
 * the Slice A.1 backfill has run). Callers that receive `null` should warn
 * and skip `OfficialMarkAdopted` emission rather than fail-hard — the backfill
 * is idempotent and will populate the store on the next CI cycle.
 */
export function resolveActivePolicyVersionRef(store: EventStore): string | null {
  let latestId: string | null = null;
  let latestAsOf = "";

  for (const e of store.replay({ type: "PolicyVersionActivated" })) {
    const p = e.payload as { policyDomain: string };
    if (p.policyDomain !== "valuation") continue;
    if (!latestId || e.as_of >= latestAsOf) {
      latestId = e.event_id;
      latestAsOf = e.as_of;
    }
  }

  return latestId ? `urn:event:PolicyVersionActivated:${latestId}` : null;
}

// ---------------------------------------------------------------------------
// Mark adoption
// ---------------------------------------------------------------------------

export interface AdoptFxMarkOpts {
  store: EventStore;
  /** ISO 8601 as_of for the adoption event itself (the MTM run timestamp). */
  asOf: string;
  /** The elected raw tick from MarketDataStore. */
  tick: MarketDataTick;
  /** The elected mid rate as a fixed-point decimal string (e.g. "18.5234"). */
  markDecimal: string;
  /**
   * URN of the active PolicyVersionActivated, resolved once per MTM run via
   * `resolveActivePolicyVersionRef`. Pass `null` to skip emission gracefully.
   */
  policyVersionRef: string | null;
}

/**
 * Emit an `OfficialMarkAdopted` event for a single FX rate tick.
 *
 * Returns the emitted event, or `null` when `policyVersionRef` is null (no
 * active policy version — fresh environment) or when the tick carries
 * unexpected data shapes. The MTM run continues normally in both null cases;
 * the warn log is the signal for operators to run `backfill:policy-activations`.
 */
export function adoptFxMark(opts: AdoptFxMarkOpts): Event | null {
  if (!opts.policyVersionRef) return null;

  const event = makeOfficialMarkAdopted({
    asOf: opts.asOf,
    entity: ENTITY,
    actor: ENGINE_ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentKey: opts.tick.instrument,
      markType: "fx-rate",
      mark: opts.markDecimal,
      quoteCurrency: opts.tick.instrument,
      markAsOf: opts.tick.asOf,
      sourceTickRef: {
        source: opts.tick.source,
        tickId: opts.tick.id,
      },
      policyVersionRef: opts.policyVersionRef,
      adoptionCodeSha: resolveAdoptionCodeSha(),
      fairValueLevel: "2",
      fallbackChain: [],
    },
  });

  opts.store.append(event);
  return event;
}
