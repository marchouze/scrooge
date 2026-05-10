// platform/scenario-clock/types.ts
//
// Controlled-time substrate for simulated scenarios.
//
// Standing authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10),
// which adopted D-SCENARIO-CLOCK as a net-new sub-decision; see
// `Owner Inbox/2026-05-10_saskia-bea-mira-helena_first-dry-run-scenario-design.md`
// §6 dispatch #A2.
//
// Why: every event carries `as_of` in ISO-8601 UTC. Production callers
// derive that from `Date.now()` (wall-clock); simulated scenarios must
// drive `as_of` deterministically so dry-runs can fast-forward T+2,
// reach month-end, and re-run with byte-identical outputs.
//
// The `ScenarioClock` interface is the *only* time source scenario-aware
// callers should use. The default composition wiring (`platform/composition.ts`)
// resolves to a `WallClock` so production behaviour is unchanged. Scenarios
// that need controlled time construct a `SimulatedClock` and pass it
// through composition (or set `BANK_SCENARIO_CLOCK_MODE=simulated`).
//
// Author: Atlas (Core banking platform architect, engineering)

/**
 * A duration expressed in milliseconds. Brand kept structural so callers
 * can pass plain numbers without ceremony; helper constants below give
 * the common scenario-step granularities.
 */
export type DurationMs = number;

export const ONE_SECOND_MS: DurationMs = 1_000;
export const ONE_MINUTE_MS: DurationMs = 60 * ONE_SECOND_MS;
export const ONE_HOUR_MS: DurationMs = 60 * ONE_MINUTE_MS;
export const ONE_DAY_MS: DurationMs = 24 * ONE_HOUR_MS;
export const T_PLUS_TWO_MS: DurationMs = 2 * ONE_DAY_MS;

/**
 * Minimal time-source contract. Every scenario-aware caller depends on
 * this — never on `Date.now()` / `new Date()` directly.
 *
 * Implementations:
 *   - {@link WallClock} — production default; delegates to `Date.now()`.
 *   - {@link SimulatedClock} — deterministic; advances on demand.
 *
 * Methods that mutate time (`advance`, `setTo`, `freeze`, `unfreeze`) are
 * no-ops on `WallClock` — production cannot be rewound. They throw on
 * `WallClock` only when called explicitly with `requireSimulated: true`
 * via the helper assertions; otherwise the no-op keeps mixed-mode wiring
 * safe.
 */
export interface ScenarioClock {
  /** Mode marker for diagnostics + recon. `"wall"` ⇒ production; `"simulated"` ⇒ scenario. */
  readonly mode: "wall" | "simulated";

  /** ISO-8601 UTC timestamp of the clock's current `now`. */
  now(): string;

  /** Convenience: `now()` as an epoch-ms number. */
  nowMs(): number;

  /**
   * Advance the clock by `duration` milliseconds. No-op on `WallClock`
   * (you cannot push wall-clock forward). Throws on a frozen
   * `SimulatedClock` to surface programmer error early.
   */
  advance(duration: DurationMs): void;

  /**
   * Pin the clock to a specific ISO-8601 UTC instant. No-op on
   * `WallClock`; throws on a frozen `SimulatedClock`.
   *
   * Bounds: `asOf` must be a valid ISO-8601 string; otherwise throws.
   * The bound check is intentionally permissive — past, future, and
   * before-the-baseline are all legal (scenarios sometimes rewind to
   * exercise as-of replay).
   */
  setTo(asOf: string): void;

  /** Freeze the clock — `advance` and `setTo` throw until `unfreeze`. */
  freeze(): void;

  /** Unfreeze a previously-frozen clock. No-op if not frozen. */
  unfreeze(): void;

  /** Diagnostic — true iff `freeze()` is in effect. */
  readonly frozen: boolean;
}

/**
 * Substrate-active env-var contract. Read at composition-root boot.
 *
 *   `BANK_SCENARIO_CLOCK_MODE=wall`        — default; production behaviour.
 *   `BANK_SCENARIO_CLOCK_MODE=simulated`   — composition installs a
 *                                            SimulatedClock initialised to
 *                                            `BANK_SCENARIO_CLOCK_BASELINE`
 *                                            (defaults to `Date.now()` at
 *                                            boot).
 *
 * Unset / unrecognised values fall through to `wall`.
 */
export const SCENARIO_CLOCK_MODE_ENV = "BANK_SCENARIO_CLOCK_MODE" as const;
export const SCENARIO_CLOCK_BASELINE_ENV = "BANK_SCENARIO_CLOCK_BASELINE" as const;

export type ScenarioClockMode = "wall" | "simulated";

export function resolveScenarioClockMode(env = process.env): ScenarioClockMode {
  const raw = env[SCENARIO_CLOCK_MODE_ENV];
  return raw === "simulated" ? "simulated" : "wall";
}
