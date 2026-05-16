// platform/returns/climate/period-close-subscriber.ts
//
// M3 Slice 7 — AccountingPeriodClosed subscriber for climate-risk disclosure.
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10); SARB Guidance Note 5/2023 (Pillar 2 climate-risk add-on).
//
// ## Design
//
// When `AccountingPeriodClosed` fires for `LE-ZA-HOZ-BANK` the subscriber:
//   1. Guards that the entity is in `CLIMATE_RISK_BANK_ENTITIES`.
//   2. Calls `generateClimateRiskDisclosure` with the event store and the
//      period's closing date as `reportingDate`.
//   3. Returns the typed `ClimateRiskDisclosure` for the caller to render/store.
//
// Non-bank entities are silently skipped (`result.skipped = true`).
//
// ## Principle 1 compliance
//
// The disclosure is derived from event replay inside `generateClimateRiskDisclosure`.
// No balances or positions are read from stored state.
//
// Citation: Principles/1-events-are-truth.md; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   SARB GN5/2023; TCFD 2017.
//
// Authors: Rohan (Risk Engineer, engineering) + Helena (Chief Risk Officer,
//   governance).

import type { AccountingPeriodClosedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import {
  CLIMATE_RISK_BANK_ENTITIES,
  type ClimateRiskGeneratorInput,
  generateClimateRiskDisclosure,
} from "./generator";
import type { ClimateRiskDisclosure, ClimateScenario, DisclosureFramework } from "./types";

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → climate-risk subscriber.
 */
export interface ClimateRiskPeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `CLIMATE_RISK_BANK_ENTITIES`. */
  readonly entity: string;
  /** Event store — provides access to TradeBooked + CollateralUpdated events. */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Rohan agent). */
  readonly actor: Actor;
  /**
   * Optional caller-supplied scenarios.
   * Defaults to `SARB_STANDARD_SCENARIOS` (three NGFS pathways).
   */
  readonly scenarios?: readonly ClimateScenario[];
  /**
   * Disclosure framework.
   * Defaults to "SARB-GN5" which covers TCFD as a subset (GN5 §2.1).
   */
  readonly disclosureFramework?: DisclosureFramework;
}

/**
 * Result of the `AccountingPeriodClosed` → climate-risk subscriber.
 */
export interface ClimateRiskPeriodCloseSubscriberResult {
  /** The generated climate-risk disclosure. Caller renders + stores this. */
  readonly disclosure: ClimateRiskDisclosure;
  /**
   * True if the entity was not in `CLIMATE_RISK_BANK_ENTITIES` and the subscriber
   * skipped generation. Non-bank entities route to other subscribers without error.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for climate-risk disclosure generation.
 *
 * Triggered by `AccountingPeriodClosed` events for bank-licence entities.
 * Non-bank entities (e.g. `LE-ZA-HOZ-SECURITIES`, `LE-ZA-HOZ-GROUP`) are
 * silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: disclosure is derived from event replay;
 * no stored state or hand-maintained lists are consulted for exposures.
 *
 * **Future-tranche note**: output `status` will remain `"rehearsal"` until
 * the climate-data-provider feed and SARB GN5 §5 add-on formula are
 * implemented. The scaffold structure is production-grade.
 *
 * Citations:
 *   Principles/1-events-are-truth.md;
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10);
 *   SARB GN5/2023; TCFD 2017.
 */
export function climateRiskPeriodCloseSubscriber(
  input: ClimateRiskPeriodCloseSubscriberInput,
): ClimateRiskPeriodCloseSubscriberResult {
  // Guard: only bank-licence entities generate climate-risk disclosure.
  if (!CLIMATE_RISK_BANK_ENTITIES.includes(input.entity)) {
    return {
      disclosure: null as unknown as ClimateRiskDisclosure,
      skipped: true,
      skipReason:
        `entity '${input.entity}' is not in CLIMATE_RISK_BANK_ENTITIES ` +
        `(${CLIMATE_RISK_BANK_ENTITIES.join(", ")}); climate-risk disclosure not generated`,
    };
  }

  const generatorInput: ClimateRiskGeneratorInput = {
    entityId: input.entity,
    reportingDate: input.closedPayload.closedAt,
    eventStore: input.eventStore,
    ...(input.scenarios !== undefined ? { scenarios: input.scenarios } : {}),
    ...(input.disclosureFramework !== undefined
      ? { disclosureFramework: input.disclosureFramework }
      : {}),
  };

  const disclosure = generateClimateRiskDisclosure(generatorInput);

  return {
    disclosure,
    skipped: false,
  };
}
