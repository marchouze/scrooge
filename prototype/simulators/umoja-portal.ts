// simulators/umoja-portal.ts
//
// Local Umoja portal simulator.
//
// This is a LOCAL TEST STUB — NOT the Azure M8 target.
// At M8 (cloud migration), this file's interface is preserved but the
// implementation is swapped for a real HTTPS call to the Umoja portal API.
// The simulator emits the same `OdpReportSubmissionAttempted` /
// `OdpReportSubmissionAccepted` / `OdpReportSubmissionRejected` events in
// both modes; the `mode` field disambiguates simulator vs live.
//
// The simulator:
//   1. Validates the payload (UTI format, trade ID, bank LEI, XML non-empty).
//   2. Manages a simulated OAuth2 token (emits UmojaPortalTokenRefreshed on
//      init and on expiry; does NOT store any real secret).
//   3. If valid:
//      - Generates a fake portal reference (`UMOJA-SIM-<sessionId>`).
//      - Emits OdpReportSubmissionAccepted with the reference number.
//      - Returns `{ ok: true, portalReferenceNumber }`.
//   4. If invalid:
//      - Emits OdpReportSubmissionRejected with error codes.
//      - Returns `{ ok: false, errorCodes, errorMessages }`.
//
// Principle 1: every submission attempt AND its outcome (accepted/rejected)
// is recorded as typed events in the shared event store.
// Principle 4: no real secret appears in any event payload or log.
// Principle 3: the interface is stable across the build→live swap.
//
// Authority:
//   ORG-ODP-RPT-003 (Umoja portal integration obligation)
//   urn:regulation:odp:cs-3-2018 §4 (T+1/16:00 submission to repository)
//   D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved build-phase pattern)
//   SARB portal simulator pattern (simulators/sarb-prudential.ts)
//
// Author: Devon (COO, operations)

import { randomUUID } from "node:crypto";

import { newEventId } from "../platform/core/types";
import {
  makeOdpReportSubmissionAccepted,
  makeOdpReportSubmissionAttempted,
  makeOdpReportSubmissionRejected,
  makeUmojaPortalTokenRefreshed,
} from "../platform/event-store/event-types/odp-umoja-uti";
import type { EventStore } from "../platform/event-store/store";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * A trade report payload ready for Umoja portal submission.
 */
export interface UmojaSubmissionPayload {
  /** Internal trade identifier. */
  tradeId: string;
  /** Allocated UTI (ISO 23602, max 52 chars). */
  uti: string;
  /** Bank LEI (20 chars, ISO 17442). */
  bankLei: string;
  /** EMIR-style XML string (the serialised trade report). */
  xmlBody: string;
  /**
   * ISO 8601 timestamp when the submission was initiated.
   * Per wall-clock ratchet: caller injects this; DO NOT call new Date() here.
   */
  submittedAt: string;
  /**
   * Whether this submission is within the T+1/16:00 deadline.
   * Computed by the caller using `computeT1SubmissionDeadline()`.
   */
  withinDeadline: boolean;
  /** Report action type. */
  actionType: "new" | "modify" | "cancel" | "error";
  /** Event-ID of the OdpTradeReportPrepared event being submitted. */
  reportEventId: string;
}

/**
 * Result of a Umoja portal submission attempt.
 */
export interface UmojaSubmissionResult {
  readonly ok: boolean;
  readonly portalReferenceNumber?: string;
  readonly errorCodes?: string[];
  readonly errorMessages?: string[];
  readonly portalSessionId: string;
  readonly submittedAt: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** ISO 23602 UTI format: 20-char LEI prefix + up to 32-char suffix. */
const UTI_RX = /^[A-Z0-9]{20}[A-Z0-9]{1,32}$/;

/** ISO 17442 LEI: 20 alphanumeric characters. */
const LEI_RX = /^[A-Z0-9]{20}$/;

/**
 * Error codes returned by the Umoja portal simulator.
 * These are representative of the Umoja portal's error catalogue.
 * Substrate gap: Mira (Compliance / RegTech engineer, engineering) to
 * ingest the full Umoja error-code catalogue and update this map.
 */
const UMOJA_ERROR_CODES = {
  UTI_INVALID: "UTI-INVALID",
  UTI_TOO_LONG: "UTI-TOO-LONG",
  LEI_UNKNOWN: "LEI-UNKNOWN",
  TRADE_ID_MISSING: "TRADE-ID-MISSING",
  XML_EMPTY: "XML-EMPTY",
  XML_MALFORMED: "XML-MALFORMED",
} as const;

interface ValidationResult {
  ok: true;
}
interface ValidationFailure {
  ok: false;
  errorCodes: string[];
  errorMessages: string[];
}

function validatePayload(payload: UmojaSubmissionPayload): ValidationResult | ValidationFailure {
  const errorCodes: string[] = [];
  const errorMessages: string[] = [];

  // 1. UTI format check
  if (!payload.uti || !UTI_RX.test(payload.uti)) {
    errorCodes.push(UMOJA_ERROR_CODES.UTI_INVALID);
    errorMessages.push(
      `UTI '${payload.uti}' does not match the ISO 23602 format (20-char LEI + 1–32 alphanumeric suffix).`,
    );
  } else if (payload.uti.length > 52) {
    errorCodes.push(UMOJA_ERROR_CODES.UTI_TOO_LONG);
    errorMessages.push(`UTI '${payload.uti}' exceeds 52-character maximum (ISO 23602 §4.2).`);
  }

  // 2. Bank LEI format check
  if (!payload.bankLei || !LEI_RX.test(payload.bankLei)) {
    errorCodes.push(UMOJA_ERROR_CODES.LEI_UNKNOWN);
    errorMessages.push(
      `bankLei '${payload.bankLei}' is not a valid 20-character alphanumeric LEI (ISO 17442).`,
    );
  }

  // 3. Trade ID must be non-empty
  if (!payload.tradeId || payload.tradeId.trim() === "") {
    errorCodes.push(UMOJA_ERROR_CODES.TRADE_ID_MISSING);
    errorMessages.push("tradeId is missing or empty — required for portal routing.");
  }

  // 4. XML body must be non-empty and have a TradeReport root element
  if (!payload.xmlBody || payload.xmlBody.trim() === "") {
    errorCodes.push(UMOJA_ERROR_CODES.XML_EMPTY);
    errorMessages.push("xmlBody is empty — the portal requires a non-empty XML trade report.");
  } else if (!payload.xmlBody.includes("<TradeReport")) {
    errorCodes.push(UMOJA_ERROR_CODES.XML_MALFORMED);
    errorMessages.push(
      "xmlBody does not contain a <TradeReport> root element — malformed EMIR XML envelope.",
    );
  }

  if (errorCodes.length > 0) {
    return { ok: false, errorCodes, errorMessages };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Simulator token management
// ---------------------------------------------------------------------------

interface SimulatorToken {
  ref: string;
  expiresAt: string;
}

let _currentToken: SimulatorToken | null = null;

/**
 * Get or refresh the simulated OAuth2 token.
 *
 * Per wall-clock ratchet compliance: `now` is injected by the caller.
 * The simulator emits `UmojaPortalTokenRefreshed` when a new token is issued.
 */
async function getOrRefreshToken(
  store: EventStore,
  entity: string,
  asOf: string,
  now: Date,
): Promise<SimulatorToken> {
  // Check if current token is still valid (1-hour TTL for simulator)
  if (_currentToken) {
    const expiresAt = Date.parse(_currentToken.expiresAt);
    if (now.getTime() < expiresAt) {
      return _currentToken;
    }
  }

  // Issue a new simulated token
  const tokenRef = `sim-token-${randomUUID()}`;
  const expiresAt = new Date(now.getTime() + 3_600_000).toISOString(); // +1 hour

  _currentToken = { ref: tokenRef, expiresAt };

  // Emit token-refresh event (Principle 1)
  const tokenEvent = makeUmojaPortalTokenRefreshed({
    asOf,
    entity,
    actor: { type: "service" as const, id: "umoja-portal-simulator" },
    citations: ["ORG-ODP-RPT-003"],
    payload: {
      refreshedAt: asOf,
      expiresAt,
      tokenRef,
      mode: "simulator",
    },
    eventId: newEventId(),
  });

  await store.append(tokenEvent);

  return _currentToken;
}

// ---------------------------------------------------------------------------
// Simulator entry point
// ---------------------------------------------------------------------------

/**
 * Submit an OTC derivative trade report to the local Umoja portal simulator.
 *
 * Every attempt emits:
 *   - OdpReportSubmissionAttempted (always)
 *   - OdpReportSubmissionAccepted  (when validation passes)
 *   - OdpReportSubmissionRejected  (when validation fails)
 *
 * At M8 (cloud migration), replace this implementation with a real HTTPS
 * POST to the Umoja portal API. The `UmojaSubmissionResult` interface and
 * the three event types above are stable across the swap.
 *
 * Principle 1: every attempt (success or failure) is recorded as typed events.
 * Principle 4: no real secret stored in events; only `tokenRef` (opaque).
 *
 * @param payload  — the trade report payload for submission
 * @param store    — the shared event store
 * @param entity   — legal entity identifier (e.g. "LE-ZA-HOZ-BANK")
 * @param now      — injected current time (wall-clock ratchet compliance)
 */
export async function submitToUmojaPortal(
  payload: UmojaSubmissionPayload,
  store: EventStore,
  entity: string,
  now: Date,
): Promise<UmojaSubmissionResult> {
  const portalSessionId = `UMOJA-SESSION-${randomUUID().slice(0, 8).toUpperCase()}`;
  const submittedAt = payload.submittedAt;
  const CITATIONS = ["ORG-ODP-RPT-003", "urn:regulation:odp:cs-3-2018"];

  // Ensure OAuth2 token is live (emits UmojaPortalTokenRefreshed if needed)
  await getOrRefreshToken(store, entity, submittedAt, now);

  // Emit the attempt event (Principle 1 — every attempt recorded)
  const attemptEvent = makeOdpReportSubmissionAttempted({
    asOf: submittedAt,
    entity,
    actor: { type: "service" as const, id: "umoja-portal-simulator" },
    citations: CITATIONS,
    payload: {
      tradeId: payload.tradeId,
      uti: payload.uti,
      reportEventId: payload.reportEventId,
      submittedAt,
      withinDeadline: payload.withinDeadline,
      portalSessionId,
      actionType: payload.actionType,
      mode: "simulator",
    },
    eventId: newEventId(),
  });

  await store.append(attemptEvent);

  // Validate the payload
  const validation = validatePayload(payload);

  if (!validation.ok) {
    // Emit rejection event
    const rejectEvent = makeOdpReportSubmissionRejected({
      asOf: submittedAt,
      entity,
      actor: { type: "service" as const, id: "umoja-portal-simulator" },
      citations: CITATIONS,
      payload: {
        tradeId: payload.tradeId,
        uti: payload.uti,
        submissionEventId: attemptEvent.event_id,
        rejectedAt: submittedAt,
        portalSessionId,
        errorCodes: validation.errorCodes,
        errorMessages: validation.errorMessages,
        recoverable: !validation.errorCodes.includes(UMOJA_ERROR_CODES.UTI_TOO_LONG),
      },
      eventId: newEventId(),
    });

    await store.append(rejectEvent);

    return {
      ok: false,
      errorCodes: validation.errorCodes,
      errorMessages: validation.errorMessages,
      portalSessionId,
      submittedAt,
    };
  }

  // Accepted — generate portal reference number
  const portalReferenceNumber = `UMOJA-SIM-${portalSessionId}`;

  const acceptedEvent = makeOdpReportSubmissionAccepted({
    asOf: submittedAt,
    entity,
    actor: { type: "service" as const, id: "umoja-portal-simulator" },
    citations: CITATIONS,
    payload: {
      tradeId: payload.tradeId,
      uti: payload.uti,
      submissionEventId: attemptEvent.event_id,
      portalReferenceNumber,
      acceptedAt: submittedAt,
      portalSessionId,
    },
    eventId: newEventId(),
  });

  await store.append(acceptedEvent);

  return {
    ok: true,
    portalReferenceNumber,
    portalSessionId,
    submittedAt,
  };
}

/**
 * Reset the simulator token state (for test isolation).
 */
export function resetUmojaSimulatorState(): void {
  _currentToken = null;
}
