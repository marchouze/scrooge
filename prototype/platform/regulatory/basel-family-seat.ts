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
// Seats now DELEGATE to the canonical Agent⟺Domain⟺Obligation map
// (`domain-ownership-map.ts`, D-DOMAIN-OWNERSHIP-MAP, 2026-06-14) — the single
// source of truth — so the two can never drift. The v3 taxonomy reassigned
// several families vs the original PR #1139 vocabulary: capital/leverage →
// cfo (capital framework); liquidity (LCR/NSF) → treasurer; operational risk →
// cro (replacing the non-roster "operational" seat). A family that the map
// cannot classify leaves `owner` empty (the caller does not guess).
//
// Authority: D-DOMAIN-OWNERSHIP-MAP (CEO-approved 2026-06-14);
//            D-OBLIGATIONS-REGISTER-CLEANUP · WS-OBLIGATIONS-CLEANUP.
// Author: Atlas (Core banking platform architect, engineering).

import { type Seat, seatForObligation } from "./domain-ownership-map";

/** Basel families the emit path may stamp (a superset of the obligation families). */
const BASEL_FAMILIES = [
  "RBC",
  "CAP",
  "CRE",
  "LEV",
  "LEX",
  "MAR",
  "LCR",
  "NSF",
  "DIS",
  "OPE",
  "BCP",
  "SCO",
] as const;

/**
 * Basel family token → accountable seat, DERIVED from the canonical map by
 * classifying a representative `BCBS-<FAM>` id. Reconciled to v3:
 *   RBC / CAP / LEV → cfo (capital framework) · CRE / LEX / MAR / OPE → cro ·
 *   LCR / NSF → treasurer · DIS → cfo · BCP / SCO → company-secretary.
 */
export const BASEL_FAMILY_TO_SEAT: Record<string, string> = Object.fromEntries(
  BASEL_FAMILIES.map((fam) => [fam, seatForObligation({ id: `BCBS-${fam}10` }) ?? ""]).filter(
    ([, seat]) => seat !== "",
  ),
);

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
 * Accountable seat for a graph-imported BCBS obligation id, delegated to the
 * canonical map. Returns `""` when the id is not a BCBS id or its family has no
 * mapping — callers MUST treat `""` as "leave owner empty / report", never as a
 * seat.
 */
export function seatForBcbsObligationId(obligationId: string): string {
  const family = baselFamilyOf(obligationId);
  if (!family) return "";
  const seat: Seat | null = seatForObligation({ id: `BCBS-${family}10` });
  return seat ?? "";
}
