// v2-core/fil-models/fx/shared/fx-positions.ts
//
// Typed position interfaces for Phase 1 FX instruments. These are the minimal
// economic terms each model needs for valuation and performance — v2-native, no
// v1 imports. FxSwapPosition.nearLeg + farLeg mirror FilComposition.legs (the
// composition algebra is structural, not runtime).
//
// remainingDays is always supplied by the caller — no Date.now() calls here
// (wall-clock purity, settlement-continuity invariant).
//
// DECIMAL-NATIVE (D-V2-CORE-MONEY-DECIMAL-NATIVE): notionals are MAJOR-unit
// signed canonical decimal strings, never minor-unit bigints.
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

export interface FxSpotPosition {
  readonly kind: "spot";
  readonly currency: string;
  readonly signedNotional: string; // MAJOR units, SIGNED canonical decimal string (long +, short −)
  readonly bookedSpotRate: number;
  readonly settlementDate: string;
  readonly reporting?: string;
}

export interface FxForwardLegPosition {
  readonly currency: string;
  readonly signedNotional: string; // MAJOR units, SIGNED canonical decimal string (long +, short −)
  readonly bookedForwardRate: number;
  readonly maturityDate: string;
  readonly remainingDays: number;
  readonly reporting?: string;
}

export interface FxForwardPosition extends FxForwardLegPosition {
  readonly kind: "forward";
}

export interface FxSwapPosition {
  readonly kind: "swap";
  readonly nearLeg: FxForwardLegPosition;
  readonly farLeg: FxForwardLegPosition;
  readonly reporting?: string;
}

export interface FxNdfPosition {
  readonly kind: "ndf";
  readonly currency: string;
  readonly signedNotional: string; // MAJOR units, SIGNED canonical decimal string (long +, short −)
  readonly bookedNdfRate: number;
  readonly fixingDate: string;
  readonly settlementDate: string;
  readonly settlementCurrency: string;
  readonly fixingRate?: number; // undefined = pre-fixing; present = post-fixing (crystallised)
  readonly remainingDays: number;
  readonly reporting?: string;
}

export type FxPosition = FxSpotPosition | FxForwardPosition | FxSwapPosition | FxNdfPosition;
