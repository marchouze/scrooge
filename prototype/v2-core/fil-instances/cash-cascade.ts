// v2-core/fil-instances/cash-cascade.ts
//
// DERIVED-LIVENESS CASCADE for materialised `cash` FIL instances.
//
// THE GAP THIS CLOSES
// -------------------
// A settled FX FIL instance materialises a SEPARATE `cash` FIL instance carrying
// a FORWARD-ONLY `economicTerms.originatingInstrument` back-ref to the FX that
// produced it (`./cash-materialisation.ts`). The link is one-way: the cash points
// at its parent, but nothing makes the cash's liveness depend on the parent's
// stage. So when the parent FX is CANCELLED (`FilInstrumentTerminated`,
// terminalStage `cancelled`/`terminated`), the derived cash stays `active` in the
// register — a phantom holding whose originating trade no longer exists. A
// consumer would have to KNOW to cancel the child, which is exactly the coupling
// the FIL surface is supposed to remove (plan Q2).
//
// THE FIX (read-model, pure, NO events, NO schema change)
// -------------------------------------------------------
// `effectiveLiveCashInstances(register)` returns the `cash` rows that are BOTH
// live by their own stage (`isLiveStage`) AND whose originating parent is NOT
// terminal. A `cash` row whose `originatingInstrument` parent has
// `stage ∈ {cancelled, terminated}` is dropped — its GL / accounting footprint
// must vanish without the consumer special-casing the cascade.
//
// AS-OF CORRECT: it operates on a register already produced by
// `foldFilInstances(events, asOf)` — the parent's stage AS OF that instant binds
// the cash's effective liveness AS OF that instant. Replay-safe; pure.
//
// PACKAGE BOUNDARY: inside `v2-core/` — no v1 imports.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION;
//   D-ENGINEERING-INTEGRITY-CHARTER (fail-closed; root-cause). Principle 1; Principle 2.
// Author: Atlas (Core banking platform architect, engineering).

import type { FilLifecycleStage } from "../fil-core/lifecycle";
import { type FilInstanceRegister, type FilInstanceRow, isLiveStage } from "./projection";

/**
 * The TERMINAL stages that propagate down the materialisation link: a parent in
 * one of these stages no longer stands, so any `cash` it materialised is no
 * longer effectively live. `settled` / `matured` are NOT terminal in this sense —
 * a settled FX is the very state that PRODUCES the cash (the cash is the
 * settlement's instrument-of-record), so it must keep the cash live.
 */
const PARENT_TERMINAL_STAGES: ReadonlySet<FilLifecycleStage> = new Set<FilLifecycleStage>([
  "cancelled",
  "terminated",
]);

/**
 * `true` iff `stage` is a parent-terminal stage that voids a materialised child's
 * effective liveness (`cancelled` | `terminated`).
 */
export function isParentTerminalStage(stage: FilLifecycleStage): boolean {
  return PARENT_TERMINAL_STAGES.has(stage);
}

/**
 * `true` iff the `cash` row's originating parent is terminal (cancelled /
 * terminated) in `register`. A cash with no `originatingInstrument` back-ref, or
 * whose parent is absent from the register, is NOT considered parent-terminal here
 * (the orphan / completeness checks are `recon:cash-materialisation-integrity`'s
 * concern — this cascade only voids cash whose parent is PRESENT and TERMINAL).
 */
export function isCashParentTerminal(row: FilInstanceRow, register: FilInstanceRegister): boolean {
  const origin = row.economicTerms.originatingInstrument;
  if (!origin || origin.length === 0) return false;
  const parent = register.get(origin);
  if (parent === undefined) return false;
  return isParentTerminalStage(parent.stage);
}

/**
 * `true` iff `row` is a `cash` instance that is EFFECTIVELY LIVE: live by its own
 * stage AND not voided by a terminal originating parent. Non-`cash` rows return
 * `false` (this predicate is cash-specific).
 */
export function isEffectivelyLiveCash(row: FilInstanceRow, register: FilInstanceRegister): boolean {
  if (row.economicTerms.assetClass !== "cash") return false;
  if (!isLiveStage(row.stage)) return false;
  return !isCashParentTerminal(row, register);
}

/**
 * The `cash` rows that are EFFECTIVELY LIVE — live by their own stage and not
 * cascaded out by a terminal (cancelled / terminated) originating parent. This is
 * the surface every cash-recognition consumer reads instead of folding raw cash
 * stage alone, so a cancelled-parent cash contributes nothing without the consumer
 * knowing to cancel the child (D-FIL-CONSUMER-SURFACE-ARCHITECTURE).
 *
 * Iteration follows the register's Map insertion order (creation order), matching
 * `liveInstances` so downstream ordering is stable.
 */
export function effectiveLiveCashInstances(register: FilInstanceRegister): FilInstanceRow[] {
  const out: FilInstanceRow[] = [];
  for (const row of register.values()) {
    if (isEffectivelyLiveCash(row, register)) out.push(row);
  }
  return out;
}
