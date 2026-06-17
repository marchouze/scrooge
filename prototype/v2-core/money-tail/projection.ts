// v2-core/money-tail/projection.ts
//
// Money-bearing non-financial TAIL — DECODED-DECIMAL parity projection.
//
// The store-tee mirrors each V1 append of a money-tail type into the v2 control-
// plane store, applying the per-type MoneyWire codec (`events.ts`) so the v2 row
// holds decimal-native money where the V1 row holds an optional minor-unit int.
// A BYTE comparison across that unit change is meaningless — so this projection
// folds a register whose V1 side is the codec-APPLIED payload, making it directly
// and exactly comparable to the v2 store's payload.
//
// INVARIANT (the parity gate asserts it): for every money-tail event,
//   v2-store payload  ==  codec(v1 payload)
// reusing the V1 `event_id` as the join key (the tee reuses it). A dropped mirror
// surfaces as a V1-only row, a spurious mirror as a v2-only row, and any codec /
// decimal divergence as a payload byte-diff on the codec-applied shape.
//
// This is structurally identical to the bucket-A2 projection, differing only in
// the codec map (`MONEY_TAIL_CODEC_BY_TYPE`).
//
// PACKAGE BOUNDARY: no v1 imports.
// Authority: D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-FLIP-BASIS-RBC;
//   D-V2-CORE-MONEY-DECIMAL-NATIVE.
// Brief: brief:atlas:money-bearing-non-financial-tail:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

import { MONEY_TAIL_CODEC_BY_TYPE } from "./events";

/** A minimal envelope view sufficient for the event-list fold. */
export interface MoneyTailEventView {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** One row of the comparable register: identity + type + (codec-applied) payload. */
export interface MoneyTailRow {
  readonly event_id: string;
  readonly type: string;
  readonly payload: Record<string, unknown>;
}

/** The folded, deterministic register: sorted rows + a count. */
export interface MoneyTailRegister {
  readonly rows: readonly MoneyTailRow[];
  readonly eventCount: number;
}

/**
 * Fold an event-view stream into the comparable register.
 *
 *   - `applyCodec: true`  (the V1 side) — each payload is run through its
 *     registered MoneyWire codec, yielding the canonical decimal shape the v2
 *     mirror is expected to hold. This is the EXPECTED v2 payload.
 *   - `applyCodec: false` (the v2 side) — payloads are folded as stored (the
 *     ACTUAL mirrored payload, already codec-applied by the tee on append).
 *
 * Only events whose `type` is in `typeSet` are folded. A malformed view (missing
 * event_id) is skipped rather than throwing — a structural anomaly surfaces as a
 * count gap (the intended loud signal), not a fold crash.
 */
export function foldMoneyTailRegister(
  views: Iterable<MoneyTailEventView>,
  typeSet: ReadonlySet<string>,
  applyCodec: boolean,
): MoneyTailRegister {
  const rows: MoneyTailRow[] = [];
  for (const v of views) {
    if (typeof v?.event_id !== "string" || v.event_id.length === 0) continue;
    if (!typeSet.has(v.type)) continue;
    let payload = v.payload;
    if (applyCodec) {
      const codec = MONEY_TAIL_CODEC_BY_TYPE.get(v.type);
      if (!codec) continue; // defensive: typeSet ⊆ codec keys.
      payload = codec(v.payload);
    }
    rows.push({ event_id: v.event_id, type: v.type, payload });
  }
  rows.sort((a, b) => a.event_id.localeCompare(b.event_id));
  return { rows, eventCount: rows.length };
}
