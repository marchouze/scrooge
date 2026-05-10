// platform/scenario-clock/wall-clock.ts
//
// Production default. Delegates to `Date.now()` for both `now()` and
// `nowMs()`. Mutators (`advance`, `setTo`, `freeze`, `unfreeze`) are
// intentional no-ops — production cannot be rewound, so callers that
// share code with scenarios can call these methods unconditionally
// without branching on `clock.mode`.
//
// `frozen` is always false on a WallClock.
//
// Author: Atlas (Core banking platform architect, engineering)

import type { DurationMs, ScenarioClock } from "./types";

export class WallClock implements ScenarioClock {
  readonly mode = "wall" as const;

  now(): string {
    return new Date().toISOString();
  }

  nowMs(): number {
    return Date.now();
  }

  advance(_duration: DurationMs): void {
    // no-op: production wall-clock cannot be advanced.
  }

  setTo(_asOf: string): void {
    // no-op: production wall-clock cannot be pinned.
  }

  freeze(): void {
    // no-op: a wall-clock is never frozen — `Date.now()` keeps moving.
  }

  unfreeze(): void {
    // no-op.
  }

  get frozen(): boolean {
    return false;
  }
}
