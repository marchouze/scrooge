// runtime/narrative.ts
//
// Config-selectable agent-narrative provider facade.
//
// The per-agent NARRATIVE path (Vera's overnight recon, the *-readiness /
// *-snapshot agents, Atlas's substrate-state digest, …) used to call the
// Anthropic SDK unconditionally via `runtime/claude.ts`. This facade makes
// the provider a CONFIG choice, not a code choice: every agent imports
// `narrativeAvailable` / `tryGenerateNarrative` from here, and the selected
// backend is resolved at call time from `BANK_NARRATIVE_PROVIDER`.
//
// Default = Gemini (`runtime/gemini.ts`). The `.env.local` ANTHROPIC_API_KEY
// is currently invalid (401); the Gemini key is valid and already drives the
// regulation-distill path. Setting `BANK_NARRATIVE_PROVIDER=anthropic` flips
// the whole fleet back to Claude (`runtime/claude.ts`) with ZERO code change.
//
// This mirrors the existing `BANK_DISTILL_PROVIDER` precedent in
// `dashboard/server.ts` (distill flow), generalised to the agent-narrative
// surface and centralised so no call site names a provider.
//
// Design rules (Engineering Charter command 4 — source, don't hardcode):
//   - No call site names a provider. Agents import this facade only.
//   - The selected backend returns the SAME
//       `{ ok: true; result } | { ok: false; error; retryable }`
//     envelope, so degradation semantics are identical regardless of
//     provider. `runtime/gemini.ts` already conforms; `runtime/claude.ts`'s
//     `tryGenerateNarrative` is the other backend.
//   - Unknown `BANK_NARRATIVE_PROVIDER` values fail closed (typed throw) so a
//     typo can never silently route to a surprise provider.
//
// Authority: D-NARRATIVE-PROVIDER-CONFIG (CEO-approved 2026-06-22,
//   scrooge:session-delegation); D-ENGINEERING-INTEGRITY-CHARTER (esp.
//   command 4 — source, don't hardcode).
// brief: brief:atlas:config-selectable-agent-narrative-provider-defau:2026-06-22
// Author: Atlas (Core banking platform architect, engineering).

import type { NarrativeRequest, NarrativeResponse } from "./claude";
import { claudeAvailable, tryGenerateNarrative as tryGenerateNarrativeClaude } from "./claude";
import { geminiAvailable, tryGenerateNarrativeGemini } from "./gemini";

// Re-export the request/response contract so call sites import their types
// from the facade too — no agent reaches into `../claude` for the shape.
export type { NarrativeRequest, NarrativeResponse } from "./claude";

/**
 * Shared result envelope. Identical to the shape `tryGenerateNarrative` in
 * both `runtime/claude.ts` and `runtime/gemini.ts` already return, so
 * re-pointing a call site only changes its import path.
 */
export type NarrativeResult =
  | { ok: true; result: NarrativeResponse }
  | { ok: false; error: string; retryable: boolean };

/** The provider backends this facade can dispatch to. */
export type NarrativeProvider = "gemini" | "anthropic";

/** Config env var that selects the narrative provider. Default: `gemini`. */
export const NARRATIVE_PROVIDER_ENV = "BANK_NARRATIVE_PROVIDER";

/** Provider used when `BANK_NARRATIVE_PROVIDER` is unset. */
export const DEFAULT_NARRATIVE_PROVIDER: NarrativeProvider = "gemini";

/**
 * Raised when `BANK_NARRATIVE_PROVIDER` carries a value we don't recognise.
 * Fail-closed (Engineering Charter command 2): a typo must never silently
 * route narrative to a surprise provider — it stops the run with a clear,
 * actionable message instead.
 */
export class UnknownNarrativeProviderError extends Error {
  override readonly name = "UnknownNarrativeProviderError";
  readonly configured: string;
  constructor(configured: string) {
    super(
      `Unknown ${NARRATIVE_PROVIDER_ENV}=${JSON.stringify(configured)}; expected one of: gemini, anthropic (aliases: claude). Unset the var to use the default (${DEFAULT_NARRATIVE_PROVIDER}).`,
    );
    this.configured = configured;
  }
}

/**
 * Resolve the configured narrative provider.
 *
 * - unset / empty  → default (`gemini`)
 * - `gemini`       → Gemini
 * - `anthropic` / `claude` → Claude (Anthropic)
 * - anything else  → throws `UnknownNarrativeProviderError` (fail closed)
 *
 * Comparison is case-insensitive and trims surrounding whitespace so a
 * stray `.env.local` space doesn't fail the run.
 */
export function narrativeProvider(): NarrativeProvider {
  const raw = process.env[NARRATIVE_PROVIDER_ENV];
  if (raw === undefined) return DEFAULT_NARRATIVE_PROVIDER;
  const v = raw.trim().toLowerCase();
  if (v === "") return DEFAULT_NARRATIVE_PROVIDER;
  if (v === "gemini") return "gemini";
  // `claude` is accepted as an alias for `anthropic` (the brief permits both).
  if (v === "anthropic" || v === "claude") return "anthropic";
  throw new UnknownNarrativeProviderError(raw);
}

/** Human-readable label for the configured provider (for log / skip notes). */
export function narrativeProviderLabel(): string {
  return narrativeProvider() === "anthropic" ? "Anthropic (Claude)" : "Gemini";
}

/** Env-var name carrying the selected provider's API key (for skip notes). */
function selectedProviderKeyEnv(): string {
  return narrativeProvider() === "anthropic" ? "ANTHROPIC_API_KEY" : "GEMINI_API_KEY";
}

/**
 * True when the SELECTED provider has a usable API key configured.
 *
 * Same role `claudeAvailable()` played at the call sites — agents call this
 * first and degrade gracefully (skip the narrative, complete the run
 * `ok: true`) when it returns false. Dispatches to the per-provider
 * availability check so degradation is keyed off whichever provider is live.
 */
export function narrativeAvailable(): boolean {
  return narrativeProvider() === "anthropic" ? claudeAvailable() : geminiAvailable();
}

/**
 * Provider-generic "narrative skipped" note. Agents previously hard-coded
 * "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. <tail>".
 * This generalises the prefix to whichever provider is selected so the note
 * is accurate under Gemini (or any future provider) — the tail stays the
 * agent's own ("Inventory above stands on its own.", etc.).
 *
 * @param tail agent-specific sentence describing what stands on its own.
 */
export function narrativeSkippedNote(tail: string): string {
  return (
    `Narrative skipped: ${selectedProviderKeyEnv()} not set on this runner ` +
    `(narrative provider: ${narrativeProviderLabel()}). ${tail}`
  );
}

/**
 * Generate a narrative via the configured provider. Catches the backend's
 * failures and returns a structured `{ ok: false, error }` instead of
 * throwing (same contract as the underlying `tryGenerateNarrative`), so a
 * provider failure never fails the whole agent run — the mechanical content
 * stands on its own; the narrative is icing.
 *
 * Optional `deps` lets tests inject the two backends without a live key.
 */
export async function tryGenerateNarrative(
  req: NarrativeRequest,
  deps: {
    readonly anthropic?: (r: NarrativeRequest) => Promise<NarrativeResult>;
    readonly gemini?: (r: NarrativeRequest) => Promise<NarrativeResult>;
  } = {},
): Promise<NarrativeResult> {
  const provider = narrativeProvider();
  if (provider === "anthropic") {
    return (deps.anthropic ?? tryGenerateNarrativeClaude)(req);
  }
  return (deps.gemini ?? ((r) => tryGenerateNarrativeGemini(r)))(req);
}
