// v2-core/desk/store-read.ts
//
// Read-side helper — replays the desk-register events from a control-plane
// store and folds them into a `DeskRegister` projection. The control-plane
// store (`v2-core/control-plane/store.ts`) is the v2 event host that holds the
// authoritative desk-register events (DeskRegistered / DeskAttributeChanged /
// DeskRetired). This helper is the bridge from stored CpEvents to the typed
// `FoldedDeskEvent` the pure fold consumes.
//
// PACKAGE BOUNDARY: inside `v2-core/` — no v1 imports. See `recon:v2-no-v1-import`.
// Authority: D-FRTB-TRADING-DESK-STRUCTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Atlas (Core banking platform architect, engineering).

import type { ControlPlaneStore } from "../control-plane/store";
import { DESK_ATTRIBUTE_CHANGED, DESK_REGISTERED, DESK_RETIRED } from "./events";
import {
  type DeskRegister,
  type FoldedDeskEvent,
  foldDeskRegister,
} from "./projection";

type RegisteredPayload = Extract<FoldedDeskEvent, { type: "DeskRegistered" }>["payload"];
type ChangedPayload = Extract<FoldedDeskEvent, { type: "DeskAttributeChanged" }>["payload"];
type RetiredPayload = Extract<FoldedDeskEvent, { type: "DeskRetired" }>["payload"];

/**
 * Replay the three desk event types from a control-plane store, in sequence
 * order, and fold them into a `DeskRegister`. Unknown payload shapes are
 * tolerated by the fold (forward-compat); structural violations are surfaced on
 * `register.violations` for the recon gate.
 *
 * The cast from the store's `Record<string, unknown>` payload to the typed
 * fold payload is sound because (a) only registered desk types are folded and
 * (b) the control-plane store validated each payload against the desk Zod
 * schema at append time (fail-closed) — so a stored DeskRegistered payload is
 * structurally a DeskRegisteredPayload.
 */
export function buildDeskRegister(store: ControlPlaneStore): DeskRegister {
  const events: FoldedDeskEvent[] = [];
  for (const ev of store.replay()) {
    switch (ev.type) {
      case DESK_REGISTERED:
        events.push({ type: "DeskRegistered", payload: ev.payload as RegisteredPayload });
        break;
      case DESK_ATTRIBUTE_CHANGED:
        events.push({ type: "DeskAttributeChanged", payload: ev.payload as ChangedPayload });
        break;
      case DESK_RETIRED:
        events.push({ type: "DeskRetired", payload: ev.payload as RetiredPayload });
        break;
      default:
        break;
    }
  }
  return foldDeskRegister(events);
}
