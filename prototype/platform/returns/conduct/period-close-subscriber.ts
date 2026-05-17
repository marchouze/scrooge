// platform/returns/conduct/period-close-subscriber.ts
//
// M3 Slice 9 — AccountingPeriodClosed subscriber for conduct events reporting.
//
// Triggered by `AccountingPeriodClosed` events for FSCA-conduct-regulated
// entities. Non-regulated entities are silently skipped (`result.skipped = true`).
//
// Unlike CMS Slice 8 (which used placeholder AlertOpened proxies), this
// subscriber replays fully typed conduct events:
//   - ConductComplaintFiled / ConductComplaintResolved
//   - ConductIncidentLogged
//   - BestExecutionAnalysisCompleted
//
// Standing authority: D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN
//   (CEO-approved 2026-05-10).
//
// Citations:
//   FSRA §131; FSB TCF 2012; FAIS Act 37/2002 §§16–17;
//   D-MARKET-CONDUCT; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md; Principles/6-autonomous-by-default.md.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Mira (Compliance / RegTech engineer, engineering — conduct obligation chain).

import type { AccountingPeriodClosedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { generateConductDisclosure } from "./generator";
import type { ConductPeriodDisclosure } from "./types";
import { CONDUCT_REGULATED_ENTITIES } from "./types";

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → conduct subscriber.
 */
export interface ConductPeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `CONDUCT_REGULATED_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to:
   *   `ConductComplaintFiled`, `ConductComplaintResolved`,
   *   `ConductIncidentLogged`, `BestExecutionAnalysisCompleted`.
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically Mira or the platform scheduler). */
  readonly actor: Actor;
  /**
   * ISO 8601 — start of the period window for event folding.
   * Convention: `AccountingPeriodOpened.periodStart`.
   */
  readonly periodStart: string;
  /**
   * Optional period label (e.g. "2026-Q2"). Defaults to `closedPayload.closedAt`.
   */
  readonly periodLabel?: string;
}

/**
 * Result of the `AccountingPeriodClosed` → conduct subscriber.
 */
export interface ConductPeriodCloseSubscriberResult {
  /** The generated conduct period disclosure. Caller renders + stores this. */
  readonly disclosure: ConductPeriodDisclosure;
  /**
   * True if the entity was not in `CONDUCT_REGULATED_ENTITIES` and the
   * subscriber skipped generation.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for conduct events reporting.
 *
 * Triggered by `AccountingPeriodClosed` events for FSCA-conduct-regulated
 * entities. Non-regulated entities are silently skipped.
 *
 * **Principle 1 compliance**: all conduct metrics are derived from event
 * replay of typed `ConductComplaintFiled`, `ConductComplaintResolved`,
 * `ConductIncidentLogged`, and `BestExecutionAnalysisCompleted` events.
 * No stored aggregates are read.
 *
 * **Substrate gap**: the `ConductPeriodDisclosure` is returned to the
 * caller for rendering and storage. Durable persistence via
 * `ConductDisclosureEmitted` event + RMS document store is a follow-on
 * step (call `makeConductDisclosureEmitted` on the returned disclosure to
 * close this gap in subsequent tooling).
 *
 * Citations:
 *   FSRA §131; FSB TCF 2012; D-MARKET-CONDUCT;
 *   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   Principles/1-events-are-truth.md.
 */
export function conductPeriodCloseSubscriber(
  input: ConductPeriodCloseSubscriberInput,
): ConductPeriodCloseSubscriberResult {
  const periodLabel = input.periodLabel ?? input.closedPayload.closedAt;

  const { disclosure, skipped, skipReason } = generateConductDisclosure({
    entityId: input.entity,
    reportingDate: input.closedPayload.closedAt,
    eventStore: input.eventStore,
    periodStart: input.periodStart,
    periodLabel,
  });

  return skipReason !== undefined ? { disclosure, skipped, skipReason } : { disclosure, skipped };
}

// Re-export entity list for external code.
export { CONDUCT_REGULATED_ENTITIES };
