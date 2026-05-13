// dashboard/kyc-candidates-view.ts
//
// Read-side projection surface for the KYC candidate register.
// Wired as GET /api/kyc/candidates in dashboard/server.ts.
//
// This thin wrapper injects the real `eventStore` singleton (imported from
// `@platform/composition`) and folds the KYC candidate projection. The
// separation keeps the projection pure (no composition-root imports) while
// giving the server a single import point.
//
// Authority chain (Principle 2 upward):
//   D-LIFECYCLE-SLICE-2 (onboarding Slice 2; CEO-approved)
//   AML-CFT-POLICY-V1 (PR #261)
//   FIC-ACT-38-2001 — KYC/CDD/EDD statutory root
//
// Authors: Anya (Data / analytics engineer, engineering)

import type { EventStore } from "../platform/event-store/store";
import { LocalProjector } from "../platform/projections";
import { kycCandidateProjection } from "../platform/projections/kyc";
import type { KycCandidateState } from "../platform/projections/kyc";

export interface KycCandidatesView {
  /** ISO 8601 timestamp of this read. */
  readonly asOf: string;
  /** Flat list of all registered KYC candidates and their current state. */
  readonly candidates: readonly KycCandidateState[];
  /** Counts per status gate for dashboard summary tiles. */
  readonly counts: {
    readonly total: number;
    readonly pending: number;
    readonly screening: number;
    readonly riskRating: number;
    readonly eddPending: number;
    readonly accepted: number;
    readonly rejected: number;
  };
}

/**
 * Build the KYC candidates view from the given event store.
 *
 * @param store  A `Pick<EventStore, "replay">` — the real `eventStore` from
 *               `@platform/composition` at the server layer, or a stub in
 *               tests. The projection itself never imports the composition
 *               root.
 */
export function buildKycCandidatesView(
  store: Pick<EventStore, "replay">,
): KycCandidatesView {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(kycCandidateProjection);

  const candidates = [...stateMap.values()];

  const counts = {
    total: candidates.length,
    pending: candidates.filter((c) => c.status === "pending").length,
    screening: candidates.filter((c) => c.status === "screening").length,
    riskRating: candidates.filter((c) => c.status === "risk-rating").length,
    eddPending: candidates.filter((c) => c.status === "edd-pending").length,
    accepted: candidates.filter((c) => c.status === "accepted").length,
    rejected: candidates.filter((c) => c.status === "rejected").length,
  };

  return {
    asOf: new Date().toISOString(), // wall-clock: read-time snapshot for dashboard tile
    candidates,
    counts,
  };
}
