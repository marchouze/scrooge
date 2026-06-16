// platform/projections/v2-read-window.ts
//
// Shared anchor-entity + period-window constants for V2 read paths.
//
// The V2 projections that fold per-entity over a period window (e.g.
// computeTrialBalanceV2 over GlPostingEmitted) need a fixed (entity, window)
// to read. The V1-removal parity gates (gl-v2-parity, etc.) read the same
// (entity, window) so that what the dashboard surfaces under the useV2Store
// flag is exactly what the parity gate asserts. Keeping these in one module
// is the single source of truth — drift between the route and the gate would
// silently surface a different V2 number than the one being proven.
//
// Authority: D-V1-REMOVAL-PHASE-4 (CEO-approved 2026-06-16).
// Author: Atlas (Core banking platform architect, engineering).

/**
 * The anchor legal entity the V2 FIL instances belong to (Phase 3A onward).
 * Matches ANCHOR_ENTITY in platform/recon/gl-v2-parity.ts.
 */
export const V2_ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";

/**
 * Broad period window that captures the entire build phase. Matches
 * PERIOD_START / PERIOD_END in platform/recon/gl-v2-parity.ts.
 */
export const V2_PERIOD_START = "2026-01-01";
export const V2_PERIOD_END = "2099-12-31";
