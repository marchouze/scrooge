// platform/reporting/hqla-overrides.ts
//
// Author: Anya (Data / analytics engineer, engineering)
//   per D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 (CEO-approved 2026-05-22).
//
// Instrument-level HQLA override utility — builds a map of ISIN → HQLA tier
// from the SecurityMaster projection. Used to override COA-level hqlaLevel tags
// in the BA 110 LCR calculation when instrument-level classification exists
// (FinancialInstrumentClassified events).
//
// Design intent:
//   The COA-level hqlaLevel tags are a Phase-0 shortcut: they apply a single
//   HQLA tier to an entire GL account (e.g. ACC-3100-001 = all bonds in the
//   banking book are level-1). This is adequate at build phase when the bank
//   holds only SA government bonds, but breaks down when the portfolio becomes
//   heterogeneous (a mix of 0%-RW and non-0%-RW bonds in the same account).
//
//   FinancialInstrumentClassified events (Slice 1) carry per-instrument
//   classification from the SecurityMaster projection (Slice 3). When
//   instrument-level data exists, it is more precise than the COA tag:
//     - SecurityMaster knows the actual hqlaLevel for a specific ISIN
//       (e.g. R186 is Level-1; a corporate bond in the same account is Level-2A).
//     - The override map lets the BA 110 generator prefer the SecurityMaster
//       classification while still falling back to COA tags for accounts that
//       hold no identifiable instrument (e.g. cash / SARB operational balances).
//
//   This module provides the utility function that builds the override map.
//   The caller (generateBa110Lcr) receives the map via `opts.hqlaOverrides`
//   and resolves the per-account tier at computation time.
//
//   The COA fallback is explicitly preserved: accounts with no ISIN or whose
//   ISIN has no SecurityMaster row continue to use the COA hqlaLevel tag
//   unchanged. The override is ADDITIVE — it never removes HQLA eligibility
//   from accounts that have it via the COA; it only replaces the tier when a
//   more specific instrument-level classification is available.
//
//   D-FINANCIAL-INSTRUMENT-ENTITY Slice 9 bridge note:
//   COA accounts do not currently carry an `isin` field (the COA models
//   GL positions, not individual securities). The bridge from ISIN to GL
//   account is resolved at bond-seed time (Slice 10): bond-booking events
//   will carry both the instrumentId (from SecurityMaster) and the target
//   leafAccountId, enabling the override map to be applied per account.
//   Until Slice 10 lands and bond seeds are populated, the override map
//   will be empty and the COA-tag fallback continues to drive all BA 110
//   HQLA stock calculations. This is the correct behaviour — no regression.
//
// Citations:
//   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22)
//   BA-110-LCR (SARB BA 110 Liquidity Coverage Ratio return)
//   BCBS-LCR-2013 (BCBS D295, Basel III LCR and liquidity risk monitoring tools, Jan 2013)

import type { SecurityMasterState } from "../projections/markets/security-master";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * HQLA tier values from FinancialInstrumentClassified events.
 * Extends the COA-level HqlaLevel type with "non-hqla" to represent
 * instruments explicitly classified as not eligible for HQLA stock.
 *
 * Authority: D-FINANCIAL-INSTRUMENT-ENTITY Slice 9.
 * Citations: D-FINANCIAL-INSTRUMENT-ENTITY; BCBS-LCR-2013 §II.A; BA-110-LCR.
 */
export type HqlaLevelOverride = "level-1" | "level-2a" | "level-2b" | "non-hqla";

// ---------------------------------------------------------------------------
// Override map builder
// ---------------------------------------------------------------------------

/**
 * Build a map of ISIN → HQLA tier from the SecurityMaster projection.
 *
 * Used to override COA-level hqlaLevel tags in the BA 110 LCR calculation
 * when instrument-level classification exists (FinancialInstrumentClassified).
 *
 * Only rows that have BOTH an `isin` AND an `hqlaLevel` set on their
 * SecurityMaster row are included. Instruments without an ISIN (e.g. OTC
 * derivatives defined without an ISIN) and instruments that have not yet been
 * classified (hqlaLevel === undefined) are excluded — the COA-tag fallback
 * will apply for those.
 *
 * D-FINANCIAL-INSTRUMENT-ENTITY Slice 9.
 *
 * @param sm - The current SecurityMaster projection state (folded from
 *   FinancialInstrumentDefined + FinancialInstrumentClassified events).
 * @returns A ReadonlyMap from ISIN string to HqlaLevelOverride tier. Empty
 *   when no instruments with both ISIN and hqlaLevel classification exist
 *   (build-phase default until bond seeds land in Slice 10).
 *
 * Citations:
 *   D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
 *   BA-110-LCR; BCBS-LCR-2013.
 */
export function buildHqlaOverridesFromSecurityMaster(
  sm: SecurityMasterState,
): ReadonlyMap<string, HqlaLevelOverride> {
  const overrides = new Map<string, HqlaLevelOverride>();

  for (const row of sm.instruments.values()) {
    // Both ISIN and hqlaLevel must be set for the override to be meaningful.
    // - No ISIN: instrument is OTC / unidentifiable by ISIN; override map cannot
    //   help the BA 110 generator match it to a GL account.
    // - No hqlaLevel: classification event has not fired yet; defer to COA tag.
    if (!row.isin || !row.hqlaLevel) continue;

    overrides.set(row.isin, row.hqlaLevel as HqlaLevelOverride);
  }

  return overrides;
}
