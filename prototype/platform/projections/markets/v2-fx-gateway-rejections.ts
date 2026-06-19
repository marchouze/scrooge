// platform/projections/markets/v2-fx-gateway-rejections.ts
//
// V2 FX gateway-rejection projection — reads the V2-NATIVE gateway-rejection
// family from the V2 control-plane store (the V2/FIL world), NOT the V1 store
// (WS-FX-OTC-CLOSURE FU3).
//
// This is the platform-side wiring for the pure fold that lives in v2-core
// (`v2-core/fx-gateway/fold.ts`). It opens the V2 control-plane store, replays
// the gateway-rejection type, folds it into the name-free rejection-feed rows,
// and closes the store. The v2 package itself never imports v1 store code; this
// file is v1-side infra importing the v2 store via the PERMITTED v1→v2 direction
// (`recon:v2-no-v1-import` forbids only the reverse).
//
// HONESTY (Engineering Charter cmd 3): on the clean build-phase store there are
// ZERO V2 gateway-rejection events (no V2 emitter ships yet — the V1 gateway
// still emits `OrderRejectedAtGateway`; the V1→V2 emitter cutover is the tracked
// substrate gap). The fold returns an empty list, and the dashboard surfaces an
// honest `empty` state with that reason — never a silent zero, never a fall-back
// read of the V1 store.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG; D-BANK-WIDE-V2-MIGRATION.
// Author: Atlas (Core banking platform architect, engineering).

import {
  type CpEvent,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../../v2-core/control-plane/store";
import {
  V2_FX_ORDER_REJECTED_AT_GATEWAY_TYPE,
  type V2FxRejectionRow,
  foldV2FxRejections,
} from "../../../v2-core/fx-gateway/fold";

export type { V2FxRejectionRow } from "../../../v2-core/fx-gateway/fold";

/**
 * Read + fold the V2 FX gateway-rejection feed from the V2 control-plane store.
 *
 * @param dbPath  explicit control-plane store path; defaults to
 *                `defaultControlPlanePath()` (BANK_V2_CONTROL_PLANE_DB env, then
 *                the home default). Tests pass an explicit tmpdir path.
 */
export function readV2FxRejections(dbPath?: string): V2FxRejectionRow[] {
  const store = openControlPlaneStore(dbPath ?? defaultControlPlanePath());
  try {
    const events: CpEvent[] = [
      ...store.replay({ type: V2_FX_ORDER_REJECTED_AT_GATEWAY_TYPE }),
    ];
    return foldV2FxRejections(events);
  } finally {
    store.close();
  }
}
