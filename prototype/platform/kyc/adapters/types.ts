// platform/kyc/adapters/types.ts
//
// Common interface contracts for KYC adapters.
//
// All adapters implement `KYCAdapter<TInput, TResult>`. In simulate mode
// (KYC_ADAPTER_MODE=simulate, or when the env var is unset) adapters return
// deterministic results based on input field patterns. In live mode they
// would call real third-party APIs (stubbed with TODO comments for
// licence-day integration).
//
// Fail-closed contract: every adapter must catch its own errors and return
// `{ ok: false, result: <unavailable-shape> }` rather than propagating
// exceptions. This satisfies PROC-FC-01 steps 2–3 (fail-closed screening).
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   PROC-FC-01; AML-CFT-POLICY-V1; FIC-ACT-38-2001.
//
// Author: Atlas (Core banking platform architect, engineering).

/**
 * Standard result envelope for all KYC adapters.
 *
 * `ok` — true if the adapter call completed (even with a negative result);
 *   false only when the adapter itself failed (network error, unavailable, etc.).
 * `simulationScenario` — only set in simulate mode; identifies which
 *   deterministic branch fired for logging/audit.
 */
export interface KYCAdapterResult<T> {
  ok: boolean;
  result: T;
  simulationScenario?: string; // only set in simulate mode
}

/**
 * Generic KYC adapter interface.
 *
 * `TInput` — the domain-specific input fields.
 * `TResult` — the domain-specific result shape.
 */
export interface KYCAdapter<TInput, TResult> {
  check(input: TInput): Promise<KYCAdapterResult<TResult>>;
}

/**
 * Resolve the current adapter mode from the environment.
 * Defaults to "simulate" when the env var is unset.
 */
export function adapterMode(): "simulate" | "live" {
  const mode = process.env.KYC_ADAPTER_MODE;
  if (mode === "live") return "live";
  return "simulate";
}
