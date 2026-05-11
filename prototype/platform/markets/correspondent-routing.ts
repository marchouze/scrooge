// platform/markets/correspondent-routing.ts
//
// Correspondent-routing policy projection — v0.
//
// Resolves a routing intent (`primary` / `backup` / `switch-test-live-traffic`)
// to a named correspondent-bank party identity at instruction time. The
// resolution is what the FX settlement event family records on every
// `FxSettlementInstructed` payload's `correspondent` field — surfaced on
// the event (not in metadata) per Principle 1 (events as truth) and
// Principle 2 (downstream presentations derive from data).
//
// The projection is reproducible from the canonical event log:
//   - The configuration source-of-truth is a typed seed at
//     `prototype/seeds/correspondent-pair.json` (canonical authoring
//     location: `Regulations/_correspondent-pair-registry.md`).
//   - Switch-test windows are typed events
//     (`SwitchTestActivated` / `SwitchTestEnded` / `SwitchTestReport`).
//   - "As-of" replay is the default — given the seed + the switch-test
//     event log up to as-of, the resolved correspondent is deterministic.
//
// Switch-test mechanics:
//   - During an active switch-test window, a configurable fraction
//     (0–100%; quarterly default 5–10% per Devon (COO, governance) +
//     Tomas (Operations & payments engineer) proposal §4) of
//     `primary`-tagged intents is overridden to the `backup`
//     correspondent.
//   - The override decision is deterministic by hash on `correlationId`,
//     so the same correlation always lands on the same leg within a
//     given window — making the routing reproducible and auditable.
//
// Citations:
//   - D-FX-CORRESPONDENT-PAIR-NAMING (CEO approved 2026-05-09; PR #59)
//   - Devon (COO, governance) + Tomas (Operations & payments engineer)
//     named-correspondent-pair proposal (PR #58)
//
// Author: Saskia (Head of Global Markets, governance) + Kai (Trading-systems
//   engineer) + Atlas (Core banking platform architect).

import { z } from "zod";

import type { Party } from "./cdm/primitives";

// ---------------------------------------------------------------------------
// Configuration schema — typed mirror of `Regulations/_correspondent-pair-registry.md`.
// ---------------------------------------------------------------------------

export const correspondentEntrySchema = z.object({
  /** Tag the routing-intent resolves through (e.g. "primary", "backup", "reserve-1"). */
  tag: z.string().min(1),
  /** Display name of the correspondent bank. */
  partyName: z.string().min(1),
  /**
   * GLEIF LEI. May carry a `[citation: TBC ...]` placeholder during v0
   * pending Tomas (Operations & payments engineer) registration.
   */
  lei: z.string().min(1),
  /**
   * Correspondent / BIC code. May carry a `[citation: TBC ...]`
   * placeholder during v0.
   */
  correspondentBankCode: z.string().min(1),
  /** ISO-3166-1 alpha-2. Per Principle 5, jurisdiction is mandatory. */
  jurisdiction: z.string().length(2),
});

export type CorrespondentEntry = z.infer<typeof correspondentEntrySchema>;

export const correspondentPairConfigSchema = z.object({
  /** ISO-8601 — the as-of date the configuration applies from. */
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Source citation — the decision record / register that this snapshot derives from. */
  source: z.string().min(1),
  /** Active primary correspondent. */
  primary: correspondentEntrySchema,
  /** Active backup correspondent. */
  backup: correspondentEntrySchema,
  /** Reserve list — fallback correspondents not currently in the active pair. */
  reserve: z.array(correspondentEntrySchema),
});

export type CorrespondentPairConfig = z.infer<typeof correspondentPairConfigSchema>;

// ---------------------------------------------------------------------------
// Routing intent — the input the projection consumes per FX leg.
// ---------------------------------------------------------------------------

export const routingIntentKindSchema = z.enum(["primary", "backup", "switch-test-live-traffic"]);

export type RoutingIntentKind = z.infer<typeof routingIntentKindSchema>;

export const routingIntentSchema = z.object({
  /**
   * The intent the originating system declared. The projection resolves
   * this to a named correspondent — possibly overriding `primary` to
   * `backup` if a switch-test window is active.
   */
  kind: routingIntentKindSchema,
  /**
   * Stable correlation id used for the deterministic-by-hash fraction
   * override during switch-test windows. Convention: the
   * `tradeId.value` of the FX trade that produced the leg.
   */
  correlationId: z.string().min(1),
  /** ISO-8601 — when the resolution is happening. Selects the active config. */
  asOf: z.string().min(1),
});

export type RoutingIntent = z.infer<typeof routingIntentSchema>;

// ---------------------------------------------------------------------------
// Switch-test window state — typed reduction over the
// SwitchTestActivated / SwitchTestEnded event family.
// ---------------------------------------------------------------------------

export interface SwitchTestWindow {
  /** Stable id of the switch-test window. */
  readonly windowId: string;
  /** ISO-8601 — when the window opened. */
  readonly openedAt: string;
  /**
   * Fraction of `primary` traffic to route via `backup`, in the
   * inclusive range [0, 1]. The proposal §4 default for the quarterly
   * cycle is 0.05–0.10. 0 is a no-override sanity case; 1 is a full
   * failover (allowed per proposal §4 trigger 1).
   */
  readonly fraction: number;
  /**
   * If set, the window is closed (the `SwitchTestEnded` event has been
   * folded). For the routing decision, only open windows count.
   */
  readonly closedAt?: string;
}

export interface CorrespondentRoutingState {
  /** Configuration snapshot keyed by asOf. */
  readonly config: CorrespondentPairConfig;
  /** All switch-test windows seen so far, latest-wins per windowId. */
  readonly switchTestWindows: ReadonlyMap<string, SwitchTestWindow>;
}

// ---------------------------------------------------------------------------
// Deterministic-by-hash fraction selector. Pure, no PRNG: the same
// correlationId + windowId always lands on the same side, so replay is
// reproducible and audit can re-derive the routing decision from the
// event log alone.
// ---------------------------------------------------------------------------

const FRACTION_BUCKETS = 1000;

/**
 * Compute the fraction-bucket [0, FRACTION_BUCKETS) for a given
 * (windowId, correlationId) pair. Salted by windowId so the same
 * correlation lands on different sides across windows.
 */
export function fractionBucket(windowId: string, correlationId: string): number {
  // FNV-1a 32-bit hash. Sufficient for fraction routing; not crypto.
  const input = `${windowId}|${correlationId}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return Math.abs(hash) % FRACTION_BUCKETS;
}

/**
 * Decide whether a `primary` intent should be overridden to `backup`
 * given an open switch-test window's fraction and the leg's
 * correlationId.
 */
export function shouldOverrideToBackup(window: SwitchTestWindow, correlationId: string): boolean {
  if (window.fraction <= 0) return false;
  if (window.fraction >= 1) return true;
  const threshold = Math.floor(FRACTION_BUCKETS * window.fraction);
  return fractionBucket(window.windowId, correlationId) < threshold;
}

// ---------------------------------------------------------------------------
// Resolved-correspondent shape — the projection's output for a single
// routing intent.
// ---------------------------------------------------------------------------

export interface ResolvedCorrespondent {
  /** The named party identity to embed on the FxSettlementInstructed event. */
  readonly party: Party;
  /** The intent the originating system declared. */
  readonly requestedIntent: RoutingIntentKind;
  /** What the projection actually routed to ("primary" / "backup"). */
  readonly resolvedTag: "primary" | "backup";
  /** True iff a switch-test window forced an override of `primary` → `backup`. */
  readonly overriddenBySwitchTest: boolean;
  /** windowId of the active switch-test window, if any was applied. */
  readonly switchTestWindowId: string | undefined;
  /** As-of of the resolution (echoes intent.asOf). */
  readonly asOf: string;
  /** LEI of the resolved correspondent (or `[citation: TBC]` placeholder). */
  readonly lei: string;
  /** BIC / correspondent bank code (or `[citation: TBC]` placeholder). */
  readonly correspondentBankCode: string;
}

// ---------------------------------------------------------------------------
// Resolution function — pure; given a state and an intent, produce a
// resolved correspondent.
// ---------------------------------------------------------------------------

function entryToParty(entry: CorrespondentEntry, role: Party["role"]): Party {
  return {
    partyId: entry.lei,
    name: entry.partyName,
    role,
    jurisdiction: entry.jurisdiction,
  };
}

function activeSwitchTestWindow(state: CorrespondentRoutingState): SwitchTestWindow | undefined {
  for (const window of state.switchTestWindows.values()) {
    if (window.closedAt === undefined) return window;
  }
  return undefined;
}

export function resolveCorrespondent(
  state: CorrespondentRoutingState,
  intent: RoutingIntent,
): ResolvedCorrespondent {
  const { config } = state;
  const window = activeSwitchTestWindow(state);

  // Default — straight resolution.
  let resolvedTag: "primary" | "backup" = intent.kind === "backup" ? "backup" : "primary";
  let overridden = false;
  let appliedWindowId: string | undefined;

  if (intent.kind === "primary" && window) {
    if (shouldOverrideToBackup(window, intent.correlationId)) {
      resolvedTag = "backup";
      overridden = true;
      appliedWindowId = window.windowId;
    }
  }

  if (intent.kind === "switch-test-live-traffic") {
    // Explicit switch-test live-traffic intent: always routes via backup.
    // Per Devon + Tomas's proposal §4, this is the leg the switch-test
    // is exercising; if the window is closed, this is still routed via
    // backup — the originator declared the intent, the projection
    // honours it, and the switch-test report will surface the legs.
    resolvedTag = "backup";
    overridden = window !== undefined;
    appliedWindowId = window?.windowId;
  }

  const entry = resolvedTag === "primary" ? config.primary : config.backup;
  return {
    party: entryToParty(entry, "settlement-agent"),
    requestedIntent: intent.kind,
    resolvedTag,
    overriddenBySwitchTest: overridden,
    switchTestWindowId: appliedWindowId,
    asOf: intent.asOf,
    lei: entry.lei,
    correspondentBankCode: entry.correspondentBankCode,
  };
}

// ---------------------------------------------------------------------------
// State construction & switch-test event reducers.
// ---------------------------------------------------------------------------

export function makeRoutingState(config: CorrespondentPairConfig): CorrespondentRoutingState {
  return {
    config: correspondentPairConfigSchema.parse(config),
    switchTestWindows: new Map(),
  };
}

export function applySwitchTestActivated(
  state: CorrespondentRoutingState,
  payload: { windowId: string; openedAt: string; fraction: number },
): CorrespondentRoutingState {
  if (payload.fraction < 0 || payload.fraction > 1) {
    throw new Error(
      `SwitchTestActivated.fraction must be in [0, 1], got ${payload.fraction}. (Quarterly default 0.05–0.10 per Devon + Tomas proposal §4; full-failover 1.0 allowed per §4 trigger 1.)`,
    );
  }
  const next = new Map(state.switchTestWindows);
  next.set(payload.windowId, {
    windowId: payload.windowId,
    openedAt: payload.openedAt,
    fraction: payload.fraction,
  });
  return { ...state, switchTestWindows: next };
}

export function applySwitchTestEnded(
  state: CorrespondentRoutingState,
  payload: { windowId: string; closedAt: string },
): CorrespondentRoutingState {
  const existing = state.switchTestWindows.get(payload.windowId);
  if (!existing) return state; // ended without an open — surface at recon
  if (existing.closedAt !== undefined) return state; // idempotent
  const next = new Map(state.switchTestWindows);
  next.set(payload.windowId, { ...existing, closedAt: payload.closedAt });
  return { ...state, switchTestWindows: next };
}
