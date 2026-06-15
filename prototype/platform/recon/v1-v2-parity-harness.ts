// platform/recon/v1-v2-parity-harness.ts
//
// Generic parity harness for V1→V2 cutover proofs. Each domain that runs
// a V2 path in parallel uses this harness to assert byte-equivalence of
// both paths' outputs before the domain flip is approved.
//
// USAGE:
//   1. Implement a `ParitySpec<S>` for your domain (V1 reader + V2 reader).
//   2. Call `runParityCheck(spec)` — it returns `ReconViolation[]`.
//   3. Wire the gate as a recon pipeline (see recon:v2-saccr-parity for
//      the SA-CCR example and recon:fx-v2-parity for the FX advisory gate).
//
// The harness is deliberately thin: it owns serialisation and comparison;
// the caller owns how to read V1/V2 state. This keeps the harness reusable
// across SA-CCR, FX valuation, VaR/ES, and future domains.
//
// Authority: D-V1-REMOVAL-PHASE-1 (CEO-approved 2026-06-15).
// Author: Atlas (Substrate Architect, engineering).

import type { ReconViolation } from "./types";

// ---------------------------------------------------------------------------
// ParitySpec — the shape callers implement.
// ---------------------------------------------------------------------------

export interface ParitySpec<S> {
  /**
   * Human-readable label for this parity check. Appears in violation messages
   * so operators can identify which domain failed.
   */
  readonly label: string;
  /**
   * Read the V1 (authoritative) side. Called once per check.
   * Must return the same logical state as `readV2` for the gate to pass.
   */
  readV1: () => Promise<S> | S;
  /**
   * Read the V2 (candidate) side. Called once per check.
   */
  readV2: () => Promise<S> | S;
  /**
   * Optional custom serialiser. Defaults to `stableJson` (sorted-key JSON,
   * bigint-safe). Use a custom serialiser only when the default produces
   * false diffs due to non-deterministic field order in nested structures
   * that are semantically equivalent.
   */
  serialise?: (s: S) => string;
  /**
   * Optional field paths to exclude from the comparison. Useful for
   * non-deterministic fields (e.g. wall-clock timestamps, auto-generated
   * UUIDs) that cannot be made deterministic across both paths.
   *
   * Paths use dot-notation: `["envelope.event_id", "meta.runAt"]`.
   * The harness strips matching keys before serialising.
   *
   * NOTE: Do not use `ignore` to hide genuine discrepancies. Each ignored
   * field must be justified; callers that reach for `ignore` broadly are
   * a Vera finding.
   */
  ignore?: ReadonlyArray<string>;
}

// ---------------------------------------------------------------------------
// Stable JSON serialiser (shared default).
// ---------------------------------------------------------------------------

/** Stable key-sorted JSON, bigint-safe. Objects are recursively sorted so
 * insertion-order differences do not produce false diffs. */
export function stableJson(value: unknown): string {
  return JSON.stringify(value, (_k, v) => {
    if (typeof v === "bigint") return v.toString();
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
      );
    }
    return v;
  });
}

// ---------------------------------------------------------------------------
// Field-exclusion helper.
// ---------------------------------------------------------------------------

/** Recursively remove dot-notation paths from a deep clone of `value`. */
function pruneFields(value: unknown, paths: ReadonlyArray<string>): unknown {
  if (!paths.length) return value;
  const clone = JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v)),
  ) as unknown;
  for (const path of paths) {
    const parts = path.split(".");
    let cursor: Record<string, unknown> = clone as Record<string, unknown>;
    for (let i = 0; i < parts.length - 1; i++) {
      const seg = parts[i];
      if (!seg || cursor[seg] === undefined || typeof cursor[seg] !== "object") break;
      cursor = cursor[seg] as Record<string, unknown>;
    }
    const last = parts[parts.length - 1];
    if (last && cursor && typeof cursor === "object") {
      delete (cursor as Record<string, unknown>)[last];
    }
  }
  return clone;
}

// ---------------------------------------------------------------------------
// runParityCheck — the core harness.
// ---------------------------------------------------------------------------

/**
 * Run a parity check between V1 and V2 state for a given domain.
 *
 * Returns a (possibly empty) array of `ReconViolation`s. An empty array
 * means byte-equivalence holds. A non-empty array contains one violation
 * per discrepancy found.
 *
 * The function is synchronous when both readers are synchronous, and
 * returns a Promise when either reader is async.
 */
export function runParityCheck<S>(spec: ParitySpec<S>): ReconViolation[] {
  const v1Result = spec.readV1();
  const v2Result = spec.readV2();

  // If either side is a Promise, throw — the caller should use runParityCheckAsync.
  // This keeps the common synchronous path efficient and avoids accidental
  // async-forgotten patterns.
  if (v1Result instanceof Promise || v2Result instanceof Promise) {
    throw new TypeError(
      `runParityCheck (sync): both readV1 and readV2 must be synchronous for parity check "${spec.label}". Use runParityCheckAsync() when either reader is async.`,
    );
  }

  return _compare(spec, v1Result, v2Result);
}

/**
 * Async variant of `runParityCheck`. Use when either reader involves I/O
 * (e.g. a database query or a file read that returns a Promise).
 */
export async function runParityCheckAsync<S>(spec: ParitySpec<S>): Promise<ReconViolation[]> {
  const [v1Result, v2Result] = await Promise.all([
    Promise.resolve(spec.readV1()),
    Promise.resolve(spec.readV2()),
  ]);
  return _compare(spec, v1Result, v2Result);
}

function _compare<S>(spec: ParitySpec<S>, v1Result: S, v2Result: S): ReconViolation[] {
  const serialise = spec.serialise ?? stableJson;
  const ignore = spec.ignore ?? [];

  const v1Pruned = ignore.length ? pruneFields(v1Result, ignore) : v1Result;
  const v2Pruned = ignore.length ? pruneFields(v2Result, ignore) : v2Result;

  const v1Str = serialise(v1Pruned as S);
  const v2Str = serialise(v2Pruned as S);

  if (v1Str === v2Str) return [];

  return [
    {
      subject: `parity:${spec.label}`,
      message:
        `V1↔V2 parity failure for "${spec.label}": byte-diff detected.\n` +
        `  v1=${v1Str}\n` +
        `  v2=${v2Str}`,
      severity: "fail",
    },
  ];
}
