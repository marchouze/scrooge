// v2-core/fil-models/fx/shared/fx-observables.ts
//
// Observable catalog + curve key convention for FX instruments.
// Key format:
//   spot:        "<CCY>/<RPT>"                        e.g. "USD/ZAR"
//   fwd points:  "<CCY>/<RPT>:fwd-points:<N>d"       e.g. "USD/ZAR:fwd-points:90d"
//   NDF fwd:     "<CCY>/<RPT>:ndf-fwd:<N>d"          e.g. "USD/ZAR:ndf-fwd:90d"
//   NDF fixing:  "<CCY>/<RPT>:ndf-fixing"             e.g. "USD/ZAR:ndf-fixing"
//
// Authority: D-ENGINEERING-INTEGRITY-CHARTER; brief:atlas:fil-fx-language-phase-1-linear-otc-models:2026-06-15
// Author: Atlas (Core banking platform architect, engineering).

import type { ObservableRef } from "../../../fil-facets/facets.ts";
import type { FxPosition } from "./fx-positions.ts";

export const DEFAULT_REPORTING = "ZAR";

// ---------------------------------------------------------------------------
// Key builders
// ---------------------------------------------------------------------------

export function spotKey(currency: string, reporting = DEFAULT_REPORTING): string {
  return `${currency}/${reporting}`;
}

export function fwdPointsKey(
  currency: string,
  tenorDays: number,
  reporting = DEFAULT_REPORTING,
): string {
  return `${currency}/${reporting}:fwd-points:${tenorDays}d`;
}

export function fwdCurvePrefix(currency: string, reporting = DEFAULT_REPORTING): string {
  return `${currency}/${reporting}:fwd-points:`;
}

export function ndfForwardKey(
  currency: string,
  tenorDays: number,
  reporting = DEFAULT_REPORTING,
): string {
  return `${currency}/${reporting}:ndf-fwd:${tenorDays}d`;
}

export function ndfCurvePrefix(currency: string, reporting = DEFAULT_REPORTING): string {
  return `${currency}/${reporting}:ndf-fwd:`;
}

export function ndfFixingKey(currency: string, reporting = DEFAULT_REPORTING): string {
  return `${currency}/${reporting}:ndf-fixing`;
}

// ---------------------------------------------------------------------------
// ObservableRef constructors
// ---------------------------------------------------------------------------

export function spotObservableRef(
  currency: string,
  reporting?: string,
): ObservableRef {
  return { observableId: spotKey(currency, reporting), kind: "price" };
}

export function fwdCurveObservableRef(
  currency: string,
  reporting?: string,
): ObservableRef {
  return { observableId: fwdCurvePrefix(currency, reporting) + "*", kind: "curve" };
}

export function ndfCurveObservableRef(
  currency: string,
  reporting?: string,
): ObservableRef {
  return { observableId: ndfCurvePrefix(currency, reporting) + "*", kind: "curve" };
}

// ---------------------------------------------------------------------------
// Required-observable resolver by position kind
// ---------------------------------------------------------------------------

export function requiredObservablesForPosition(
  pos: FxPosition,
): readonly ObservableRef[] {
  switch (pos.kind) {
    case "spot":
      return [spotObservableRef(pos.currency, pos.reporting)];
    case "forward":
      return [
        spotObservableRef(pos.currency, pos.reporting),
        fwdCurveObservableRef(pos.currency, pos.reporting),
      ];
    case "swap":
      return [
        spotObservableRef(pos.nearLeg.currency, pos.reporting),
        fwdCurveObservableRef(pos.nearLeg.currency, pos.reporting),
      ];
    case "ndf":
      return [
        spotObservableRef(pos.currency, pos.reporting),
        ndfCurveObservableRef(pos.currency, pos.reporting),
      ];
  }
}
