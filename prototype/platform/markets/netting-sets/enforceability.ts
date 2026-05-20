// platform/markets/netting-sets/enforceability.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — Netting-enforceability query helpers
// over the netting-set register. Pure functions; reads the projection.
//
// Netting is enforceable iff the latest `ISDACSAAssessmentCompleted`
// for the netting set has `nettingEnforceable: true`. When false, SA-
// CCR must be computed trade-by-trade (no netting benefit) — see
// Credit Risk Policy §3 line 136.
//
// Citations:
//   ISDA Master Agreement (2002) §6 (close-out netting);
//   BCBS d317 §136 (recognition of bilateral netting);
//   Policies/credit-risk-policy-v1.md §3 line 136;
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md.
//
// Author: Imani (Legal-as-code engineer, engineering).

import { getNettingSet } from "./projection";

/**
 * Returns `true` iff the latest assessment for `nettingSetId` declares
 * netting enforceable. Returns `false` when:
 *   - no assessment has been filed for this netting set, OR
 *   - the latest assessment has `nettingEnforceable: false`.
 *
 * The "absence-of-evidence is evidence-of-absence" default is
 * deliberate — Credit Risk Policy §3 line 136 requires a positive
 * enforceability opinion on file before the engine recognises netting.
 */
export function isEnforceable(nettingSetId: string, asOf?: string): boolean {
  const ns = getNettingSet(nettingSetId, asOf);
  if (!ns) return false;
  return ns.nettingEnforceable === true;
}

/**
 * Returns a human-readable reason for the current enforceability
 * status of `nettingSetId`. Stable phrasing — Vera recon + downstream
 * dashboards may parse the returned strings (the prefix segment is
 * stable; trailing detail may vary).
 *
 * Returned phrasing:
 *   "enforceable: opinion on file (<opinionRef>)"
 *   "enforceable: no opinion ref recorded"
 *   "not enforceable: assessment declared netting non-enforceable"
 *   "not enforceable: no assessment on file"
 */
export function getEnforceabilityReason(nettingSetId: string, asOf?: string): string {
  const ns = getNettingSet(nettingSetId, asOf);
  if (!ns) return "not enforceable: no assessment on file";
  if (!ns.nettingEnforceable) {
    return "not enforceable: assessment declared netting non-enforceable";
  }
  if (ns.jurisdictionOpinionRef) {
    return `enforceable: opinion on file (${ns.jurisdictionOpinionRef})`;
  }
  return "enforceable: no opinion ref recorded";
}
