// platform/projections/kyc/kyc-checks-projection.ts
//
// The `kyc-checks` projection — per-candidate map of check results.
//
// Tracks the status of each individual KYC check step for a candidate:
// identity verification, sanctions/PEP screening, UBO resolution,
// risk rating, and EDD (if triggered).
//
// Reduces over: KYCIdentityVerified, KYCIdentityVerificationFailed,
//               KYCSanctionsPEPScreened, KYCUBOResolved,
//               KYCRiskRated, KYCEDDInitiated, KYCEDDCompleted.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Anya (Data / analytics engineer, engineering).

import type { Event } from "@platform/event-store/types";
import type { Projection } from "../types";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** Status of an individual KYC check. */
export type CheckStatus = "pending" | "passed" | "flagged" | "failed";

/** Result of a single KYC check step. */
export interface KYCCheckResult {
  readonly status: CheckStatus;
  readonly result: Record<string, unknown>; // raw payload for audit trail
  readonly checkedAt: string;
}

/** Check types tracked by this projection. */
export type KYCCheckType =
  | "identity-verification"
  | "sanctions-pep-screening"
  | "ubo-resolution"
  | "risk-rating"
  | "edd";

/** Per-candidate check state. */
export interface KYCChecksState {
  readonly candidateId: string;
  readonly checks: Partial<Record<KYCCheckType, KYCCheckResult>>;
  readonly lastUpdatedAt: string;
}

/** Full projection state — Map keyed by candidateId. */
export type KYCChecksProjectionState = Map<string, KYCChecksState>;

// ---------------------------------------------------------------------------
// Accepted event-type list
// ---------------------------------------------------------------------------

const KYC_CHECK_EVENT_TYPES = [
  "KYCIdentityVerified",
  "KYCIdentityVerificationFailed",
  "KYCSanctionsPEPScreened",
  "KYCUBOResolved",
  "KYCRiskRated",
  "KYCEDDInitiated",
  "KYCEDDCompleted",
] as const;

type KYCCheckEventType = (typeof KYC_CHECK_EVENT_TYPES)[number];

function isKYCCheckEvent(e: Event): e is Event & { type: KYCCheckEventType } {
  return (KYC_CHECK_EVENT_TYPES as readonly string[]).includes(e.type);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCandidateId(payload: Record<string, unknown>): string | undefined {
  return typeof payload.candidateId === "string" && payload.candidateId.trim().length > 0
    ? payload.candidateId
    : undefined;
}

function setCheck(
  state: KYCChecksProjectionState,
  candidateId: string,
  checkType: KYCCheckType,
  result: KYCCheckResult,
  asOf: string,
): KYCChecksProjectionState {
  const existing = state.get(candidateId) ?? {
    candidateId,
    checks: {},
    lastUpdatedAt: asOf,
  };
  const next = new Map(state);
  next.set(candidateId, {
    ...existing,
    checks: {
      ...existing.checks,
      [checkType]: result,
    },
    lastUpdatedAt: asOf,
  });
  return next;
}

// ---------------------------------------------------------------------------
// Per-event-type handlers
// ---------------------------------------------------------------------------

function applyKYCIdentityVerified(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  return setCheck(state, candidateId, "identity-verification", {
    status: "passed",
    result: p,
    checkedAt: typeof p.verifiedAt === "string" ? p.verifiedAt : e.as_of,
  }, e.as_of);
}

function applyKYCIdentityVerificationFailed(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  const reason = typeof p.reason === "string" ? p.reason : "";
  const status: CheckStatus =
    reason === "adapter-unavailable" ? "failed" : "failed";

  return setCheck(state, candidateId, "identity-verification", {
    status,
    result: p,
    checkedAt: typeof p.failedAt === "string" ? p.failedAt : e.as_of,
  }, e.as_of);
}

function applyKYCSanctionsPEPScreened(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  const result = typeof p.result === "string" ? p.result : "";
  const checkStatus: CheckStatus =
    result === "clean" ? "passed" : result === "false-positive" ? "flagged" : "flagged";

  return setCheck(state, candidateId, "sanctions-pep-screening", {
    status: checkStatus,
    result: p,
    checkedAt: typeof p.screenedAt === "string" ? p.screenedAt : e.as_of,
  }, e.as_of);
}

function applyKYCUBOResolved(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  const opaqueStructure = p.ubo_opaque_structure === true;
  const checkStatus: CheckStatus = opaqueStructure ? "flagged" : "passed";

  return setCheck(state, candidateId, "ubo-resolution", {
    status: checkStatus,
    result: p,
    checkedAt: typeof p.resolvedAt === "string" ? p.resolvedAt : e.as_of,
  }, e.as_of);
}

function applyKYCRiskRated(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  const band = typeof p.band === "string" ? p.band : "";
  const checkStatus: CheckStatus = band === "high" ? "flagged" : "passed";

  return setCheck(state, candidateId, "risk-rating", {
    status: checkStatus,
    result: p,
    checkedAt: typeof p.ratedAt === "string" ? p.ratedAt : e.as_of,
  }, e.as_of);
}

function applyKYCEDDInitiated(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  return setCheck(state, candidateId, "edd", {
    status: "pending",
    result: p,
    checkedAt: typeof p.initiatedAt === "string" ? p.initiatedAt : e.as_of,
  }, e.as_of);
}

function applyKYCEDDCompleted(
  state: KYCChecksProjectionState,
  e: Event,
): KYCChecksProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = getCandidateId(p);
  if (!candidateId) return state;

  const outcome = typeof p.outcome === "string" ? p.outcome : "";
  const checkStatus: CheckStatus = outcome === "proceed" ? "passed" : "failed";

  return setCheck(state, candidateId, "edd", {
    status: checkStatus,
    result: p,
    checkedAt: typeof p.completedAt === "string" ? p.completedAt : e.as_of,
  }, e.as_of);
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

export const kycChecksProjection: Projection<KYCChecksProjectionState> = {
  name: "kyc-checks",
  initial: new Map<string, KYCChecksState>(),
  accepts: (e): e is Event => isKYCCheckEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "KYCIdentityVerified":
        return applyKYCIdentityVerified(state, event);
      case "KYCIdentityVerificationFailed":
        return applyKYCIdentityVerificationFailed(state, event);
      case "KYCSanctionsPEPScreened":
        return applyKYCSanctionsPEPScreened(state, event);
      case "KYCUBOResolved":
        return applyKYCUBOResolved(state, event);
      case "KYCRiskRated":
        return applyKYCRiskRated(state, event);
      case "KYCEDDInitiated":
        return applyKYCEDDInitiated(state, event);
      case "KYCEDDCompleted":
        return applyKYCEDDCompleted(state, event);
      default:
        return state;
    }
  },
};
