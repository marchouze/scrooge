// platform/returns/cms/period-close-subscriber.ts
//
// M3 Slice 8 — AccountingPeriodClosed subscriber for CMS (Conduct Management
// System) disclosure generation.
//
// Triggered by `AccountingPeriodClosed` events for CMS-regulated entities.
// Non-regulated entities (e.g. LE-ZA-HOZ-SECURITIES, LE-ZA-HOZ-GROUP) are
// silently skipped (`result.skipped = true`).
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10).
//
// Citations:
//   FSRA §131; FSB Treating Customers Fairly 2012;
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Principles/1-events-are-truth.md;
//   Principles/6-autonomous-by-default.md.
//
// Authors: Atlas (Platform Engineer, engineering) +
//   Devon (Chief Operating Officer, governance — TCF oversight).

import type { AccountingPeriodClosedPayload } from "../../event-store/event-types";
import type { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { generateCmsDisclosure } from "./generator";
import type { CMSDisclosure } from "./types";
import { CMS_REGULATED_ENTITIES } from "./types";

// ---------------------------------------------------------------------------
// Subscriber input / output
// ---------------------------------------------------------------------------

/**
 * Input to the `AccountingPeriodClosed` → CMS subscriber.
 */
export interface CmsPeriodCloseSubscriberInput {
  /** The `AccountingPeriodClosed` event payload that triggered the subscriber. */
  readonly closedPayload: AccountingPeriodClosedPayload;
  /** The entity the period was closed for. Must be in `CMS_REGULATED_ENTITIES`. */
  readonly entity: string;
  /**
   * Event store — provides access to `AlertOpened` and `ConflictDeclared`
   * events for the period.
   */
  readonly eventStore: EventStore;
  /** Actor running the subscriber (typically the Devon agent or the platform scheduler). */
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
 * Result of the `AccountingPeriodClosed` → CMS subscriber.
 */
export interface CmsPeriodCloseSubscriberResult {
  /** The generated CMS disclosure. Caller renders + stores this. */
  readonly disclosure: CMSDisclosure;
  /**
   * True if the entity was not in `CMS_REGULATED_ENTITIES` and the subscriber
   * skipped generation. The caller can route non-regulated-entity closes to
   * other subscribers without raising an error.
   */
  readonly skipped: boolean;
  readonly skipReason?: string;
}

// ---------------------------------------------------------------------------
// Subscriber
// ---------------------------------------------------------------------------

/**
 * `AccountingPeriodClosed` subscriber for CMS disclosure generation.
 *
 * Triggered by `AccountingPeriodClosed` events for CMS-regulated entities.
 * Non-regulated entities are silently skipped (`result.skipped = true`).
 *
 * **Principle 1 compliance**: all conduct metrics are derived from event
 * replay (`AlertOpened`, `ConflictDeclared`). Placeholder zeros are emitted
 * where event feeds are not yet connected; the disclosure carries
 * `status: "rehearsal"` until live feeds land (M3 Slice 9+).
 *
 * **Substrate gap**: the `CMSDisclosure` is returned to the caller for
 * rendering and storage. A `ConductDisclosureEmitted` event type and
 * durable persistence path are deferred to M3 Slice 9+ (RMS integration).
 *
 * Citations:
 *   FSRA §131; FSB TCF 2012; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
 *   Principles/1-events-are-truth.md.
 */
export function cmsPeriodCloseSubscriber(
  input: CmsPeriodCloseSubscriberInput,
): CmsPeriodCloseSubscriberResult {
  // Guard: only CMS-regulated entities generate disclosures.
  if (!CMS_REGULATED_ENTITIES.includes(input.entity)) {
    // Use the generator to produce a typed (but skipped) result.
    const { disclosure, skipped, skipReason } = generateCmsDisclosure({
      entityId: input.entity,
      reportingDate: input.closedPayload.closedAt,
      eventStore: input.eventStore,
      periodStart: input.periodStart,
      ...(input.periodLabel !== undefined ? { periodLabel: input.periodLabel } : {}),
    });
    return skipReason !== undefined ? { disclosure, skipped, skipReason } : { disclosure, skipped };
  }

  const periodLabel = input.periodLabel ?? input.closedPayload.closedAt;
  const { disclosure, skipped, skipReason } = generateCmsDisclosure({
    entityId: input.entity,
    reportingDate: input.closedPayload.closedAt,
    eventStore: input.eventStore,
    periodStart: input.periodStart,
    periodLabel,
  });

  return skipReason !== undefined ? { disclosure, skipped, skipReason } : { disclosure, skipped };
}

// Re-export the entity list so external code can reference it without
// importing from types.ts directly.
export { CMS_REGULATED_ENTITIES };
