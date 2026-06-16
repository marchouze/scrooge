// platform/recon/v2-store-parity-adapter.ts
//
// V2-store parity adapter — Wave 0 (D-BANK-WIDE-V2-MIGRATION).
//
// PURPOSE
// -------
// The generic parity harness (`v1-v2-parity-harness.ts`, `runParityCheck`) is
// already store-agnostic: a `ParitySpec` carries arbitrary `readV1` / `readV2`
// closures, so the V2 side can read from ANY source. This adapter documents and
// standardises the common case the bank-wide migration needs:
//
//   "compare a V1 projection vs a projection FOLDED FROM the v2 control-plane
//    store (the general event host)".
//
// It opens the control-plane store, folds the caller's projection over its
// replayed events, and returns a `readV2` closure suitable for a `ParitySpec`.
// The caller pairs it with their existing `readV1`. Nothing in the harness
// changes — this is a thin, optional convenience so every Wave 2-4 domain that
// wants to prove "v2-store projection == v1 projection" wires it the same way.
//
// USAGE
// -----
//   import { runParityCheck } from "./v1-v2-parity-harness";
//   import { v2StoreProjectionReader } from "./v2-store-parity-adapter";
//
//   const readV2 = v2StoreProjectionReader({
//     fold: (events) => foldMyProjection(events), // events: readonly CpEvent[]
//   });
//   const violations = runParityCheck({
//     label: "my-domain",
//     readV1: () => readV1Projection(),
//     readV2,
//   });
//
// For an async fold (I/O), pair with `runParityCheckAsync` instead.
//
// ARCHITECTURE NOTE: this file is v1-side recon infra; it imports the v2 store
// via the permitted v1→v2 direction (`recon:v2-no-v1-import` forbids only the
// reverse).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
// D-V1-REMOVAL-PHASE-1 (parity-harness lineage).
// Brief: brief:atlas:wave-0-v2-general-host-foundation-schemaversion-:2026-06-16
// Author: Atlas (Core banking platform architect, engineering).

import {
  type CpEvent,
  type CpReplayOpts,
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../../v2-core/control-plane/store";

/**
 * Options for `v2StoreProjectionReader`.
 *
 * `fold` — the caller's projection fold over the replayed v2-store events. The
 *          returned value `S` is what the parity harness serialises and
 *          compares against the V1 side. Keep `S` a plain serialisable shape
 *          (the harness's `stableJson` sorts keys and stringifies bigints).
 *
 * `dbPath` — explicit store path; defaults to `defaultControlPlanePath()`
 *            (BANK_V2_CONTROL_PLANE_DB env, then the home default). Pass an
 *            explicit path in tests / scenarios.
 *
 * `replay` — optional replay filter (fromSequence / type / entity) forwarded to
 *            the store so a domain can scope its read to its own event types.
 */
export interface V2StoreProjectionReaderOptions<S> {
  readonly fold: (events: readonly CpEvent[]) => S;
  readonly dbPath?: string;
  readonly replay?: CpReplayOpts;
}

/**
 * Build a synchronous `readV2` closure that folds a projection from the v2
 * control-plane store. The store is opened, fully replayed (subject to the
 * optional `replay` filter), folded, and closed on every call — parity checks
 * run rarely (CI / scheduled tick), so the per-call open/close is acceptable
 * and keeps the closure free of lifecycle state.
 */
export function v2StoreProjectionReader<S>(options: V2StoreProjectionReaderOptions<S>): () => S {
  const { fold, dbPath, replay } = options;
  return () => {
    const store = openControlPlaneStore(dbPath ?? defaultControlPlanePath());
    try {
      const events: CpEvent[] = [...store.replay(replay)];
      return fold(events);
    } finally {
      store.close();
    }
  };
}
