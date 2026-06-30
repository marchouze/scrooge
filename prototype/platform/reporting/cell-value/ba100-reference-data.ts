// platform/reporting/cell-value/ba100-reference-data.ts
//
// Concrete implementation of `LeafFoldReferenceData` for the BA 100 leaf fold
// (D-BA-RETURN-CELL-VALUE-ENGINE Phase 3).
//
// WHAT THIS DOES: wraps the party-register projection (`PartyProjection`) and
// the FRTB desk roster (`CANONICAL_DESKS`) behind the three accessor methods
// declared in `LeafFoldReferenceData`, so the BA 100 fold can join against the
// canonical-home data sources without re-folding the party stream per leg.
//
// FAIL-CLOSED (Engineering Charter cmd 2): every accessor returns null (never a
// guessed default) when the key is unmapped. Callers must handle null and, per
// Charter cmd 5, surface a tracked gap — they must NOT silently drop the value
// or fold under an invented default.
//
// WIRING: the caller (`dashboard/v2-finance-returns-view.ts`, the `leafFold(...)`
// invocation) builds a `PartyProjection` and passes it here. `getDeskBookType`
// reads from `CANONICAL_DESKS` directly (no projection needed — the desk roster
// is a compile-time constant in v2-core/desk/roster.ts, exactly as Phase 2
// Approach A resolved).
//
// SCOPE: Phase 3 wires `getCounterpartyResidency` + `getCounterpartySector`.
// `getDeskBookType` was already implemented in Phase 2 (Approach A) and is
// verified here.
//
// Authority: D-BA-RETURN-CELL-VALUE-ENGINE Phase 3; D-FX-BOOK-BOUNDARY;
//   D-FRTB-TRADING-DESK-STRUCTURE; D-ENGINEERING-INTEGRITY-CHARTER (cmd 2
//   fail-closed; cmd 4 source-don't-hardcode; cmd 5 no-silent-deferral);
//   SARB BA 100 R1010–R1090; SARB BA 325 reg-29(3).
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import type { PartyId } from "../../../domains/party";
import { canonicalDeskBookType } from "../../../v2-core/desk/roster";
import type { PartyProjection } from "../../identity/party-projection";
import type { LeafFoldReferenceData } from "./leaf-fold-registry";

/**
 * Build a concrete `LeafFoldReferenceData` from a pre-folded `PartyProjection`.
 *
 * Call once per request and pass the result into `LeafFoldContext.referenceData`.
 * The projection is read-only; this function holds a reference to it — there is
 * no internal copy, so the projection snapshot must remain stable for the
 * lifetime of the returned object (it is; it is the fold result).
 *
 * @param partyProjection - Pre-folded party projection (from `buildPartyProjection`).
 *   Must be the projection built from the SAME event store + provenance lens
 *   as the fold that consumes this reference-data object. Mismatched projections
 *   are a correctness hazard (Charter cmd 7 whole-tree integrity).
 */
export function buildBa100ReferenceData(partyProjection: PartyProjection): LeafFoldReferenceData {
  return {
    /**
     * Look up a counterparty's BA 325 residency bucket from the party register.
     * Returns null when:
     *   - the counterpartyId does not start with "urn:party:" (not a Party URN)
     *   - the Party is not registered in the projection
     *   - the Party has no residency evidence (no jurisdictions / tax-residencies)
     * Fail-closed — never guesses. Callers must emit a gap flag (Charter cmd 5).
     */
    getCounterpartyResidency(
      counterpartyId: string,
    ): "resident" | "non-resident" | "authorised-dealer" | "sarb" | null {
      if (!counterpartyId.startsWith("urn:party:")) return null;
      const record = partyProjection.parties.get(counterpartyId as PartyId);
      return record?.residency ?? null;
    },

    /**
     * Look up a counterparty's SARB BA 100 R1010 sector code from the party register.
     * Returns null when:
     *   - the counterpartyId does not start with "urn:party:"
     *   - the Party is not registered in the projection
     *   - the Party is an `agent` kind (no sector — in-house automation)
     *   - the sector could not be derived (no kindAttributes)
     * Fail-closed — never guesses. Callers must emit a gap flag (Charter cmd 5).
     */
    getCounterpartySector(counterpartyId: string): string | null {
      if (!counterpartyId.startsWith("urn:party:")) return null;
      const record = partyProjection.parties.get(counterpartyId as PartyId);
      return record?.counterpartySector ?? null;
    },

    /**
     * Look up an active FRTB desk's bookType from the canonical desk roster.
     * Returns null when the deskId is not in `CANONICAL_DESKS`. Fail-closed —
     * never defaults to "trading" for an unrecognised deskId (that would be
     * a silent fabrication, Charter cmd 2). Callers must emit a gap flag
     * (Charter cmd 5) for any deskId that resolves null.
     * Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-FX-BOOK-BOUNDARY.
     */
    getDeskBookType(deskId: string): "trading" | "banking-treasury" | null {
      // Delegates to the canonical roster function (v2-core/desk/roster.ts)
      // which already implements the fail-closed null-for-unknown-deskId pattern.
      return canonicalDeskBookType(deskId);
    },
  };
}
