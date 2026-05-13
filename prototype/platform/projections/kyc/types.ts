// platform/projections/kyc/types.ts
//
// State shape for the KYC candidate projection.
//
// P1 — projection is a pure cache derived from the KYC event log;
//      authoritative state lives only in the events.
// P2 — every state field maps to an emitting event; foreign-key integrity
//      is asserted via the event's own citation chain (upward to
//      FIC-ACT-38-2001, AML-CFT-POLICY-V1).
// P6 — downstream consumers (dashboard `/api/kyc/candidates`, Mira's
//      gateway agent, Zara's MLRO oversight view) depend on this typed
//      contract; the projection runtime supplies state without coupling
//      consumers to each other.
//
// Authority: D-LIFECYCLE-SLICE-2 (onboarding Slice 2); AML-CFT-POLICY-V1;
//            FIC-ACT-38-2001 (CDD/EDD obligations).
//
// Authors: Anya (Data / analytics engineer, engineering)

/**
 * Lifecycle status of a KYC candidate.
 *
 * State machine (forward only; terminal states are idempotent):
 *
 *   pending
 *     └─ SanctionsClearancePassed / PEPScreeningCompleted / BeneficialOwnerResolved
 *          → screening
 *     └─ ClientRejected (fast-fail) → rejected  (terminal)
 *   screening
 *     └─ RiskRatingAssigned → risk-rating
 *     └─ EddInitiated → edd-pending
 *     └─ ClientRejected → rejected  (terminal)
 *   risk-rating
 *     └─ EddInitiated → edd-pending  (HIGH/PEP cases)
 *     └─ ClientAccepted → accepted   (terminal)
 *     └─ ClientRejected → rejected   (terminal)
 *   edd-pending
 *     └─ EddCompleted → risk-rating  (re-enters for final gate)
 *     └─ ClientRejected → rejected   (terminal)
 *     └─ ClientAccepted → accepted   (terminal)
 *   accepted   (terminal)
 *   rejected   (terminal)
 */
export type KycCandidateStatus =
  | "pending" //    registered; screening not yet started
  | "screening" //  at least one screening step has landed
  | "risk-rating" // screened; awaiting risk rating assignment
  | "edd-pending" // EDD initiated; awaiting EDD completion
  | "accepted" //   ClientAccepted terminal
  | "rejected"; //  ClientRejected terminal

/**
 * Per-candidate current state folded from the KYC event family.
 *
 * Fields are optional when the corresponding event has not yet landed;
 * the `status` field is the single authoritative lifecycle gate.
 */
export interface KycCandidateState {
  /** Stable candidate identifier; primary key. */
  readonly candidateId: string;
  /** Current lifecycle gate. */
  readonly status: KycCandidateStatus;
  /** Entity classification supplied at registration. */
  readonly entityType?: "natural-person" | "legal-entity" | "trust";
  /** Risk tier assigned by RiskRatingAssigned. */
  readonly riskRating?: "STANDARD" | "HIGH" | "PEP" | "PROHIBITED";
  /** KYC tier (Tier-1 / Tier-2) — from RiskRatingAssigned or KycCompleted. */
  readonly kycTier?: "Tier-1" | "Tier-2";
  /** True after SanctionsClearancePassed lands. */
  readonly sanctionsClear?: boolean;
  /** True if the candidate is a Politically Exposed Person. */
  readonly pepStatus?: boolean;
  /** PEP tier (1 = direct; 2 = close associate; 3 = family member). */
  readonly pepTier?: 1 | 2 | 3;
  /** True after BeneficialOwnerResolved lands. */
  readonly uboResolved?: boolean;
  /** ISO 8601 EDD deadline; set by EddInitiated. */
  readonly eddDeadlineIso?: string;
  /** EDD outcome once EddCompleted lands. */
  readonly eddOutcome?: "PROCEED" | "REJECT";
  /** Rejection reason code from ClientRejected. */
  readonly rejectionReasonCode?: string;
  /** ISO 8601 — when ClientAccepted landed. */
  readonly acceptedAt?: string;
  /** ISO 8601 — when ClientRejected landed. */
  readonly rejectedAt?: string;
  /** ISO 8601 — as_of of the ClientCandidateRegistered event. */
  readonly registeredAt: string;
  /** ISO 8601 — as_of of the most recent accepted event. */
  readonly lastEventAt: string;
}

/** Full projection state — a Map keyed by candidateId. */
export type KycCandidateProjectionState = Map<string, KycCandidateState>;
