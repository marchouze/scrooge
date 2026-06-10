// platform/regulatory/basel-family-seat.ts
//
// Single source of truth for the Basel-family → accountable-seat mapping used
// to assign the `owner` of graph-imported BCBS obligations (ids `^BCBS-<FAM>…`,
// e.g. BCBS-CRE20, BCBS-MAR10, BCBS-LCR10).
//
// Why this module exists (root-cause fix, D-OBLIGATIONS-REGISTER-CLEANUP,
// WS-OBLIGATIONS-CLEANUP):
//   PR #1143 added a one-off remediation script
//   (scripts/assign-bcbs-obligation-owners.ts) that backfilled `owner` on the
//   BCBS `ObligationAdopted` rows by Basel family. But the live emit path for
//   BCBS obligations (the `/api/obligations/adopt` knowledge-base branch in
//   dashboard/server.ts) stamped `owner: ""` at wall-clock-now, so any fresh
//   adopt re-introduced an empty-owner row that won the `as_of` fold and
//   silently reverted the backfill. The fix is to populate `owner` AT EMIT TIME
//   from this shared map, in every code path that mints a BCBS `ObligationAdopted`
//   — and to have the remediation script consume the SAME map, so the two can
//   never drift again. With the emit path corrected, the remediation script is a
//   permanent no-op.
//
// Seat vocabulary is the one PR #1139 established for obligation ownership /
// review (`cco | cfo | cro | company-secretary | operational |
// head-of-global-markets`). No new seats are invented here; a family that is not
// in the map leaves `owner` empty (the caller does not guess).
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP · WS-OBLIGATIONS-CLEANUP.
// Author: Atlas (Core banking platform architect, engineering).

/**
 * Basel family token → accountable seat.
 *
 *   RBC / CAP / CRE / LEV / LEX → cro   (risk-based capital / credit / leverage / large-exp)
 *   MAR                          → cro   (market risk)
 *   LCR / NSF                    → cfo   (liquidity ratios)
 *   DIS  (Pillar 3 disclosure)   → cfo
 *   OPE  (operational risk)      → operational
 *   BCP / SCO (governance / core principles) → company-secretary
 *
 * A family absent from this map is intentionally left unmapped — the caller
 * leaves `owner` empty and reports, rather than guessing a seat.
 */
export const BASEL_FAMILY_TO_SEAT: Record<string, string> = {
  RBC: "cro",
  CAP: "cro",
  CRE: "cro",
  LEV: "cro",
  LEX: "cro",
  MAR: "cro",
  LCR: "cfo",
  NSF: "cfo",
  DIS: "cfo",
  OPE: "operational",
  BCP: "company-secretary",
  SCO: "company-secretary",
};

/**
 * Extract the Basel family token from a BCBS obligation id, e.g.
 * `BCBS-CRE20` → `CRE`, `BCBS-LCR10` → `LCR`. Returns `""` when the id does not
 * match the `^BCBS-<letters>` shape.
 */
export function baselFamilyOf(obligationId: string): string {
  const m = obligationId.match(/^BCBS-([A-Za-z]+)/);
  return m?.[1]?.toUpperCase() ?? "";
}

/**
 * Accountable seat for a graph-imported BCBS obligation id, derived from its
 * Basel family. Returns `""` when the id is not a BCBS id or its family has no
 * mapping — callers MUST treat `""` as "leave owner empty / report", never as a
 * seat.
 */
export function seatForBcbsObligationId(obligationId: string): string {
  const family = baselFamilyOf(obligationId);
  return BASEL_FAMILY_TO_SEAT[family] ?? "";
}
