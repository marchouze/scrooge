// platform/projections/kyc/kyc-candidate-projection.ts
//
// KYC candidate projection — folds the KYC lifecycle event family into
// per-candidate current state.
//
// Projection pattern:
//   name     — stable key for telemetry + snapshot substrate.
//   initial  — empty Map (no candidates before any events land).
//   accepts  — narrows to the 11 KYC event types.
//   reduce   — pure (state, event) → newState; fully idempotent.
//
// Idempotency contract:
//   - `ClientCandidateRegistered`: first-write-wins on candidateId; a
//     second registration event with the same id is dropped.
//   - `ClientAccepted` / `ClientRejected`: terminal idempotent — a second
//     terminal event for an already-terminal candidate is dropped.
//   - All intermediate events for an already-terminal candidate are dropped.
//   - Re-processing any event that was already applied produces identical
//     state (monotone fold; no counters or accumulators that drift on
//     replay).
//
// Backwards compatibility:
//   - `KycCompleted` (existing counterparty-lifecycle event) is folded for
//     candidates whose candidateId equals the event's counterpartyId. This
//     keeps the projection consistent with legacy events already in the log
//     before the new KYC gateway event types landed.
//   - Existing `SanctionsClearancePassed`, `BeneficialOwnerResolved`, and
//     `PopiaConsentRecorded` events from the Slice-2 onboarding family
//     (counterpartyId-keyed) are folded when a candidate with a matching
//     candidateId is already registered.
//
// Authority: D-LIFECYCLE-SLICE-2 (onboarding Slice 2, CEO-approved);
//            AML-CFT-POLICY-V1; FIC-ACT-38-2001.
//
// Authors: Anya (Data / analytics engineer, engineering)

import type { Event } from "@platform/event-store/types";
import type { Projection } from "../types";
import type { KycCandidateProjectionState, KycCandidateState, KycCandidateStatus } from "./types";

// ---------------------------------------------------------------------------
// Accepted event-type list
// ---------------------------------------------------------------------------

const KYC_EVENT_TYPES = [
  // New KYC gateway events (added by Mira, D-LIFECYCLE-SLICE-2 extension)
  "ClientCandidateRegistered",
  "PEPScreeningCompleted",
  "RiskRatingAssigned",
  "EddInitiated",
  "EddCompleted",
  "ClientAccepted",
  "ClientRejected",
  // Slice-2 onboarding family (counterpartyId-keyed; backwards-compat fold)
  "SanctionsClearancePassed",
  "BeneficialOwnerResolved",
  "PopiaConsentRecorded",
  // Legacy terminal event (counterpartyId-keyed)
  "KycCompleted",
] as const;

type KycEventType = (typeof KYC_EVENT_TYPES)[number];

function isKycEvent(e: Event): e is Event & { type: KycEventType } {
  return (KYC_EVENT_TYPES as readonly string[]).includes(e.type);
}

// ---------------------------------------------------------------------------
// Internal helpers — all pure functions
// ---------------------------------------------------------------------------

/**
 * Resolve the candidate identifier from an event payload. New KYC events
 * carry `candidateId`; Slice-2 and legacy events carry `counterpartyId`.
 * Returns undefined when neither field is present.
 */
function resolveCandidateId(payload: Record<string, unknown>): string | undefined {
  if (typeof payload.candidateId === "string" && payload.candidateId.trim().length > 0) {
    return payload.candidateId;
  }
  if (typeof payload.counterpartyId === "string" && payload.counterpartyId.trim().length > 0) {
    return payload.counterpartyId;
  }
  return undefined;
}

/** True when the candidate is in a terminal state. */
function isTerminal(status: KycCandidateStatus): boolean {
  return status === "accepted" || status === "rejected";
}

/** Derive the new `status` after a screening-step event lands. */
function screeningStatus(current: KycCandidateStatus): KycCandidateStatus {
  // Terminal states are immutable.
  if (isTerminal(current)) return current;
  // Any screening step advances from "pending" to "screening"; already-
  // "screening" or later states are not regressed.
  if (current === "pending") return "screening";
  return current;
}

// ---------------------------------------------------------------------------
// Per-event-type reduce handlers (each returns a new or identical Map)
// ---------------------------------------------------------------------------

function applyClientCandidateRegistered(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state; // malformed payload — drop

  if (state.has(candidateId)) {
    // First-write-wins idempotency: a duplicate registration is dropped.
    return state;
  }

  const row: KycCandidateState = {
    candidateId,
    status: "pending",
    registeredAt: e.as_of,
    lastEventAt: e.as_of,
    ...(typeof p.entityType === "string"
      ? { entityType: p.entityType as KycCandidateState["entityType"] }
      : {}),
  };

  const next = new Map(state);
  next.set(candidateId, row);
  return next;
}

function applySanctionsClearancePassed(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state; // no registration — drop (substrate-integrity violation)
  if (isTerminal(existing.status)) return state; // terminal — idempotent drop

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: screeningStatus(existing.status),
    sanctionsClear: true,
    lastEventAt: e.as_of,
  });
  return next;
}

function applyPEPScreeningCompleted(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: screeningStatus(existing.status),
    pepStatus: p.isPep === true,
    ...(typeof p.pepTier === "number" ? { pepTier: p.pepTier as 1 | 2 | 3 } : {}),
    lastEventAt: e.as_of,
  });
  return next;
}

function applyBeneficialOwnerResolved(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: screeningStatus(existing.status),
    uboResolved: true,
    lastEventAt: e.as_of,
  });
  return next;
}

function applyPopiaConsentRecorded(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  // POPIA consent alone does not advance the status gate; it augments the
  // record. Screening step events (sanctions, PEP, UBO) advance the gate.
  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    lastEventAt: e.as_of,
  });
  return next;
}

function applyRiskRatingAssigned(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  // RiskRatingAssigned transitions any non-terminal state to "risk-rating".
  // (It legitimately fires after EddCompleted to re-enter the final gate.)
  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "risk-rating",
    ...(typeof p.riskRating === "string"
      ? { riskRating: p.riskRating as KycCandidateState["riskRating"] }
      : {}),
    ...(typeof p.kycTier === "string"
      ? { kycTier: p.kycTier as KycCandidateState["kycTier"] }
      : {}),
    lastEventAt: e.as_of,
  });
  return next;
}

function applyEddInitiated(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "edd-pending",
    ...(typeof p.deadlineIso === "string" ? { eddDeadlineIso: p.deadlineIso } : {}),
    lastEventAt: e.as_of,
  });
  return next;
}

function applyEddCompleted(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  // EDD completion re-enters the risk-rating gate for final disposition.
  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "risk-rating",
    ...(typeof p.outcome === "string"
      ? { eddOutcome: p.outcome as KycCandidateState["eddOutcome"] }
      : {}),
    lastEventAt: e.as_of,
  });
  return next;
}

function applyClientAccepted(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state; // idempotent-terminal; first wins

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "accepted",
    acceptedAt: e.as_of,
    lastEventAt: e.as_of,
  });
  return next;
}

function applyClientRejected(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state; // idempotent-terminal; first wins

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "rejected",
    ...(typeof p.reasonCode === "string" ? { rejectionReasonCode: p.reasonCode } : {}),
    rejectedAt: e.as_of,
    lastEventAt: e.as_of,
  });
  return next;
}

function applyKycCompleted(
  state: KycCandidateProjectionState,
  e: Event,
): KycCandidateProjectionState {
  // Legacy KycCompleted — treat as ClientAccepted for backwards compat.
  // KycCompletedPayload uses `counterpartyId`; the candidateId lookup
  // covers both field names via resolveCandidateId.
  const p = e.payload as Record<string, unknown>;
  const candidateId = resolveCandidateId(p);
  if (!candidateId) return state;

  const existing = state.get(candidateId);
  if (!existing) return state;
  if (isTerminal(existing.status)) return state;

  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    status: "accepted",
    ...(typeof p.tier === "string" ? { kycTier: p.tier as KycCandidateState["kycTier"] } : {}),
    ...(typeof p.sanctionsClear === "boolean" ? { sanctionsClear: p.sanctionsClear } : {}),
    ...(typeof p.pep === "boolean" ? { pepStatus: p.pep } : {}),
    acceptedAt: e.as_of,
    lastEventAt: e.as_of,
  });
  return next;
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

export const kycCandidateProjection: Projection<KycCandidateProjectionState> = {
  name: "kyc-candidate",
  initial: new Map<string, KycCandidateState>(),
  accepts: (e): e is Event => isKycEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "ClientCandidateRegistered":
        return applyClientCandidateRegistered(state, event);
      case "SanctionsClearancePassed":
        return applySanctionsClearancePassed(state, event);
      case "PEPScreeningCompleted":
        return applyPEPScreeningCompleted(state, event);
      case "BeneficialOwnerResolved":
        return applyBeneficialOwnerResolved(state, event);
      case "PopiaConsentRecorded":
        return applyPopiaConsentRecorded(state, event);
      case "RiskRatingAssigned":
        return applyRiskRatingAssigned(state, event);
      case "EddInitiated":
        return applyEddInitiated(state, event);
      case "EddCompleted":
        return applyEddCompleted(state, event);
      case "ClientAccepted":
        return applyClientAccepted(state, event);
      case "ClientRejected":
        return applyClientRejected(state, event);
      case "KycCompleted":
        return applyKycCompleted(state, event);
      default:
        return state;
    }
  },
};
