// simulators/sarb-prudential.ts
//
// Local SARB prudential portal simulator.
//
// This is a LOCAL TEST STUB — NOT the Azure M8 target.
// At M8 (cloud migration), this file's interface is preserved but the
// implementation is swapped for a real HTTPS call to the SARB BankServ
// prudential portal. The simulator emits the same `SarbSubmissionAttempted`
// event in both modes; the `mode` field disambiguates simulator vs live.
//
// The simulator:
//   1. Validates the payload (required fields, period format, institutionId).
//   2. If valid: generates a fake reference (`SARB-${Date.now()}`), emits
//      `SarbSubmissionAttempted{ accepted: true }` to the event store, and
//      returns `{ ok: true, referenceNumber }`.
//   3. If invalid: emits `SarbSubmissionAttempted{ accepted: false, errors }`
//      to the event store, and returns `{ ok: false, errors }`.
//
// Validation rules (build-phase minimal set — Mira's WS-INSTRUMENT-ANALYSES
// will extend these once the SARB XSD and portal taxonomy are ingested):
//   - `payload.formId` must be non-empty and match a known BA-form prefix
//     ("BA325", "BA320", "BA400", "BA700", or "BA" followed by digits).
//   - `payload.body` must be a non-null object.
//   - `body.Meta` must be present (structural gate per the XSD envelope).
//   - `body.Meta.Entity` must be non-empty (institutionId proxy).
//   - `body.Meta.PeriodId` must match the format
//     `period:<slug>:<cadence>:<period>` (basic format check).
//   - `payload.namespaceUri` must be non-empty (XSD namespace present).
//
// Principle 1 compliance: every attempt (success or failure) emits a
// `SarbSubmissionAttempted` event so the audit trail is complete.
//
// Substrate gap: the M8 migration swaps this file's implementation for
// a real HTTPS POST with mutual TLS to the SARB portal. The interface
// (`submitToSarbPortal`) and the event type (`SarbSubmissionAttempted`)
// are stable across the swap — Principle 3 cloud-native design.
//
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Mira (Compliance / RegTech engineer, engineering — PA/FSCA portal
//   taxonomy + submission rules)
//   + Atlas (Core banking platform architect, engineering — simulator harness
//   + event emission substrate).

import { newEventId } from "../platform/core/types";
import { makeSarbSubmissionAttempted } from "../platform/event-store/event-types/regulatory-reporting";
import type { EventStore } from "../platform/event-store/store";
import type { SarbXmlReportPayload } from "../platform/reporting/xml-render";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * The result of a SARB portal submission attempt.
 */
export interface SarbSubmissionResult {
  /** `true` when the portal accepted the submission. */
  readonly ok: boolean;
  /** Present when `ok === true`. */
  readonly referenceNumber?: string;
  /** Present when `ok === false` — list of validation-error messages. */
  readonly errors?: string[];
  /** ISO 8601 timestamp of the submission attempt. */
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** Pattern for valid BA-form identifiers (e.g. "BA325", "BA700"). */
const FORM_ID_RX = /^BA\d+$/;

/** Pattern for valid period identifiers (e.g. "period:hoz-bank:month:2026-05"). */
const PERIOD_ID_RX = /^period:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+:[a-zA-Z0-9_-]+$/;

/**
 * Validate a `SarbXmlReportPayload` for submission.
 *
 * Returns `{ ok: true }` on success, or `{ ok: false; errors: string[] }` on
 * failure. All violations are collected (not short-circuited) so the caller
 * can surface the full list to the operator.
 */
function validatePayload(
  payload: SarbXmlReportPayload,
): { ok: true } | { ok: false; errors: string[] } {
  const errors: string[] = [];

  // 1. formId — must be non-empty and match BA<digits>.
  if (!payload.formId || !FORM_ID_RX.test(payload.formId)) {
    errors.push(
      `formId '${payload.formId}' is not a recognised BA-form identifier (expected /^BA\\d+$/). [citation: TBC — SARB portal form-code taxonomy; Mira WS-INSTRUMENT-ANALYSES]`,
    );
  }

  // 2. namespaceUri — must be non-empty.
  if (!payload.namespaceUri || payload.namespaceUri.trim() === "") {
    errors.push(
      "namespaceUri is empty — the portal requires an XML namespace declaration per the XSD envelope. [citation: TBC — SARB portal XSD; Mira WS-INSTRUMENT-ANALYSES]",
    );
  }

  // 3. body — must be a non-null object.
  if (payload.body === null || typeof payload.body !== "object") {
    errors.push("body is null or not an object — the XML envelope requires a body section.");
  } else {
    // 4. body.Meta — must be present (XSD envelope structural gate).
    const meta = payload.body.Meta;
    if (meta === undefined || meta === null) {
      errors.push(
        "body.Meta is missing — the SARB portal requires a Meta section in the submission envelope.",
      );
    } else if (typeof meta === "object" && !Array.isArray(meta)) {
      // 5. body.Meta.Entity — must be non-empty (institutionId proxy).
      const entity = (meta as Record<string, unknown>).Entity;
      if (!entity || (typeof entity === "string" && entity.trim() === "")) {
        errors.push(
          "body.Meta.Entity is missing or empty — the institution identifier is required for portal routing.",
        );
      }

      // 6. body.Meta.PeriodId — basic format check.
      const periodId = (meta as Record<string, unknown>).PeriodId;
      if (periodId !== undefined && typeof periodId === "string") {
        if (!PERIOD_ID_RX.test(periodId)) {
          errors.push(
            `body.Meta.PeriodId '${periodId}' does not match the expected format 'period:<slug>:<cadence>:<period>' (e.g. 'period:hoz-bank:month:2026-05'). [citation: TBC — SARB portal period taxonomy]`,
          );
        }
      } else if (periodId === undefined) {
        errors.push("body.Meta.PeriodId is missing — the reporting period is required.");
      }
    } else if (typeof meta !== "string" && typeof meta !== "number" && typeof meta !== "boolean") {
      // Meta was set to an array or something unexpected.
      errors.push("body.Meta must be an object section, not an array or scalar.");
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

// ---------------------------------------------------------------------------
// Simulator entry point
// ---------------------------------------------------------------------------

/**
 * Submit a SARB BA-return XML payload to the local portal simulator.
 *
 * The simulator is the build-phase stand-in for the SARB prudential portal.
 * It validates the payload, emits a `SarbSubmissionAttempted` event, and
 * returns a typed `SarbSubmissionResult`. The event carries `mode: "simulator"`
 * so the audit trail is unambiguous.
 *
 * At M8 (cloud migration), replace this implementation with a real HTTPS
 * POST to the SARB portal. The `SarbSubmissionResult` interface and the
 * `SarbSubmissionAttempted` event type are stable.
 *
 * Principle 1: every submission attempt (success or failure) is recorded as
 * a typed event in the shared event store.
 *
 * @param payload - The typed XML report payload from `ba300LcrToXmlPayload()` /
 *   `ba100ToXmlPayload()` (or any other adapter).
 * @param store - The shared event store (receives the `SarbSubmissionAttempted` event).
 * @returns A `SarbSubmissionResult` with `ok`, optional `referenceNumber` /
 *   `errors`, and `submittedAt`.
 */
export async function submitToSarbPortal(
  payload: SarbXmlReportPayload,
  store: EventStore,
): Promise<SarbSubmissionResult> {
  const submittedAt = new Date().toISOString();

  // Derive the entity from body.Meta.Entity for the event envelope.
  // Fall back to "LE-ZA-HOZ-BANK" when the payload is invalid (the event
  // still needs an entity field; the validation error surfaces the real problem).
  let entity = "LE-ZA-HOZ-BANK";
  const meta = payload.body?.Meta;
  if (meta !== null && meta !== undefined && typeof meta === "object" && !Array.isArray(meta)) {
    const entityValue = (meta as Record<string, unknown>).Entity;
    if (typeof entityValue === "string" && entityValue.trim() !== "") {
      entity = entityValue.trim();
    }
  }

  // Derive the periodId for the event.
  let reportingPeriod = "period:hoz-bank:rehearsal:unknown";
  if (meta !== null && meta !== undefined && typeof meta === "object" && !Array.isArray(meta)) {
    const periodValue = (meta as Record<string, unknown>).PeriodId;
    if (typeof periodValue === "string" && periodValue.trim() !== "") {
      reportingPeriod = periodValue.trim();
    }
  }

  const validationResult = validatePayload(payload);

  if (validationResult.ok) {
    // Simulate portal acceptance — generate a fake reference number.
    const referenceNumber = `SARB-${Date.now()}`;

    // Emit the submission-attempt event (success).
    const event = makeSarbSubmissionAttempted({
      asOf: submittedAt,
      entity,
      actor: { type: "service", id: "simulator:sarb-prudential" },
      citations: [
        "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
        "Banks Act 94 of 1990 §70",
        "Regulations Relating to Banks Reg 26",
        "[citation: TBC — SARB portal submission procedure PROC-SARB-SUBMIT-01]",
      ],
      payload: {
        formId: payload.formId,
        formVersion: payload.formVersion,
        institutionId: entity,
        reportingPeriod,
        submittedAt,
        accepted: true,
        referenceNumber,
        mode: "simulator",
      },
      eventId: newEventId(),
    });
    store.append(event);

    return { ok: true, referenceNumber, submittedAt };
  }
  // Emit the submission-attempt event (failure).
  const event = makeSarbSubmissionAttempted({
    asOf: submittedAt,
    entity,
    actor: { type: "service", id: "simulator:sarb-prudential" },
    citations: [
      "D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN",
      "Banks Act 94 of 1990 §70",
      "Regulations Relating to Banks Reg 26",
      "[citation: TBC — SARB portal submission procedure PROC-SARB-SUBMIT-01]",
    ],
    payload: {
      formId: payload.formId,
      formVersion: payload.formVersion,
      institutionId: entity,
      reportingPeriod,
      submittedAt,
      accepted: false,
      errors: validationResult.errors,
      mode: "simulator",
    },
    eventId: newEventId(),
  });
  store.append(event);

  return { ok: false, errors: validationResult.errors, submittedAt };
}
