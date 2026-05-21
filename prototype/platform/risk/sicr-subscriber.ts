// platform/risk/sicr-subscriber.ts
//
// SICR subscriber — derives `SicrTriggered` (IFRS 9 §5.5.3) events from the
// upstream credit-deterioration signals.
//
// Why a subscriber (not a posting rule):
//   Posting rules in `platform/accounting/posting-rules/` are pure functions
//   `(payload) => SubLedgerLeg[]` — they produce only GL legs and never
//   mutate state outside their return value. SICR transitions are *not* GL
//   movements (FVTPL is out of ECL scope per IFRS 9 §5.5.1 + IFRS 9 ECL
//   Provisioning Policy v1 §51) — they are a supervisory signal recorded as
//   a memo event. Mixing memo-event emission into the posting-rule
//   signature would muddy the GL contract. The subscriber pattern keeps
//   posting rules pure GL and isolates side-effecting event emission.
//
// What it subscribes to (today — Wave 1, FX-spot only):
//   - `FxSettlementFailed{failureKind: "neither-delivered"}` → SICR signal
//     "settlement-failure-neither-delivered" (Stage 1 → Stage 2). The
//     mutual-fail case is the canonical SICR trigger flagged by Bea's
//     PR #641 IFRS-9 default-recognition rule and reified by Kai's
//     PR #645 end-to-end FX-spot scenario.
//
// What it will subscribe to (follow-on slices, out of scope here):
//   - `FxSettlementFailed{failureKind: "operational-delay"}` after the
//     N-th repeat in a rolling window → "settlement-failure-repeated"
//     (CRC review required; today operational delays do not auto-trigger
//     SICR, per credit-risk-policy-v1 §165 (i)).
//   - External rating-downgrade ingest → "external-rating-downgrade".
//   - `LexUtilisationComputed` with `utilisationRatio >= 0.80` →
//     "lex-utilisation-threshold" (credit-risk-policy-v1 §165 (iii)).
//   - Manual CRC override via dispatch → "manual" / "watchlist-placement".
//
// Idempotency:
//   `deriveSicrTriggered()` is a pure function — same `triggerEvent +
//   counterpartyResolver` always produces the same `SicrTriggered`
//   payload, with a deterministic `eventId` derived from
//   `(triggerEventId, partyId)`. Replay of the trigger event re-runs the
//   subscriber but produces the same `event_id`; the event store's
//   append-only model + the runtime subscriber's per-event idempotency
//   guard (keyed on `event_id`) ensures the SICR event lands exactly
//   once. `appendIfNew()` enforces this explicitly for callers that
//   pass an existing event list (typical: tests + manual replay).
//
// Counterparty resolution:
//   `FxSettlementFailed` carries `tradeRef` but not the counterparty
//   directly. The subscriber accepts a `counterpartyResolver(tradeRef)`
//   callback so the resolution strategy is pluggable — production wiring
//   reads from the trade-store projection; tests pass an in-memory map.
//   When the resolver returns `null` the subscriber emits no SICR event
//   and logs an info-class violation that Vera surfaces. (Missing
//   counterparty is a substrate gap, not a SICR signal.)
//
// Citations:
//   - IFRS 9 §5.5.1 — FVTPL out of ECL scope.
//   - IFRS 9 §5.5.3 — SICR Stage 1 → Stage 2 transition criteria.
//   - IFRS 9 §B5.5.7 — reversal of SICR classification (recovery condition).
//   - Policies/credit-risk-policy-v1.md §165 (SICR triggers) + §168
//     (watchlist exit conditions feeding `recoveryCondition`).
//   - Policies/ifrs9-ecl-provisioning-policy-v1.md §51 — FVTPL out of scope.
//   - PRs #608/#609/#616/#641 — Bea's FX-spot posting-rule pack
//     (PR-FX-001 / PR-FX-002 / PR-FX-PRIN / PR-FX-005); §5.5.13 default
//     branch is one-leg-delivered, this rule covers the mutual-fail
//     §5.5.3 SICR memo branch the pack flagged as a substrate gap.
//   - Kai PR #645 — end-to-end FX-spot scenario (Phase 4 mutual-fail
//     branch that surfaced the missing event flow).
//   - Helena (Chief Risk Officer, governance) 2026-05-20 FX-spot-only
//     market risk scope review.
//   - Principles/1-events-are-truth.md.
//   - Principles/2-single-graph-discipline.md.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import {
  type SicrTriggeredPayload,
  makeSicrTriggered,
} from "../event-store/event-types/counterparty-credit-risk";
import type { FxSettlementFailedPayload } from "../event-store/event-types/fx-accounting";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Deterministic event-id helpers
// ---------------------------------------------------------------------------

/**
 * Derive a deterministic `event_id` for a SICR event from the source
 * trigger event + party. This keeps the subscriber idempotent under
 * replay — the same trigger event always maps to the same SICR
 * `event_id`, so `appendIfNew()` rejects duplicates without needing a
 * sidecar idempotency table.
 *
 * Format: `sicr:<partyId>:<triggerEventId>`. The colon-separated form is
 * picked up by the event-store registry's event_id pattern (UUIDv4 OR
 * domain-prefixed deterministic IDs).
 */
export function deriveSicrEventId(args: {
  partyId: string;
  triggerEventId: string;
}): string {
  return `sicr:${args.partyId}:${args.triggerEventId}`;
}

// ---------------------------------------------------------------------------
// Counterparty resolver
// ---------------------------------------------------------------------------

/**
 * Resolves `tradeRef` → `partyId` for the failed FX trade's counterparty.
 *
 * In production this is wired to the trade-store projection; in tests
 * callers pass an in-memory map. Returns `null` when the trade cannot be
 * resolved — the subscriber treats this as a substrate gap (no SICR
 * emission, info-class violation for Vera to surface), not a SICR signal.
 */
export type CounterpartyResolver = (tradeRef: string) => string | null;

// ---------------------------------------------------------------------------
// Default recovery-condition text (credit-risk-policy-v1 §168)
// ---------------------------------------------------------------------------

/**
 * Default `recoveryCondition` prose for the mutual-fail SICR branch.
 * Mirrors credit-risk-policy-v1 §168 — the watchlist-exit criterion the
 * CRC applies before reverting a Stage-2 counterparty to Stage-1.
 *
 * Override via the `recoveryConditionOverride` knob on `deriveSicrTriggered`
 * if a counterparty-specific recovery condition is approved by the CRC.
 */
export const DEFAULT_MUTUAL_FAIL_RECOVERY_CONDITION =
  "20 consecutive successful FX settlements without operational fail over a rolling 90 calendar-day window, combined with no external rating downgrade and no further mutual-fail events. CRC reviews the counterparty file on the 91st day; reversal requires a SicrCleared event signed by Helena (CRO) per credit-risk-policy-v1 §168.";

// ---------------------------------------------------------------------------
// Subscriber input + output types
// ---------------------------------------------------------------------------

/**
 * Inputs for the FX-mutual-fail SICR derivation.
 *
 * `event` is the full `FxSettlementFailed` event envelope (we need the
 * `event_id` for provenance + idempotency, plus `as_of` for `triggerDate`
 * defaulting). The payload carries the trade-ref + failure-kind.
 *
 * `resolveCounterparty` returns `partyId | null` for the trade. Pure;
 * the subscriber does not call into the event store itself — it asks the
 * caller (production runtime / test harness) to provide the projection.
 *
 * `recoveryConditionOverride` is optional CRC-approved counterparty-
 * specific recovery prose; default is `DEFAULT_MUTUAL_FAIL_RECOVERY_CONDITION`.
 *
 * `entity` + `actor` are forwarded to the constructed event envelope
 * (the subscriber acts on Bea's identity as the accounting engineer
 * accountable for the IFRS 9 memo; the entity is the booking entity
 * of the failed trade).
 */
export interface DeriveSicrTriggeredFromFxFailInput {
  readonly event: {
    readonly event_id: string;
    readonly as_of: string;
    readonly payload: FxSettlementFailedPayload;
  };
  readonly resolveCounterparty: CounterpartyResolver;
  readonly entity: string;
  readonly actor: Actor;
  readonly recoveryConditionOverride?: string;
}

/**
 * Result envelope. `event` is the constructed `SicrTriggered` event if a
 * SICR signal applies; `null` otherwise (e.g. `operational-delay`
 * failure-kind, or counterparty not resolvable).
 *
 * `reason` is a short machine-readable label for the no-op branch,
 * useful for the recon pipeline's logging.
 */
export interface DeriveSicrTriggeredResult {
  readonly event: Event | null;
  readonly reason:
    | "emitted"
    | "operational-delay-no-sicr"
    | "one-leg-delivered-default-not-sicr"
    | "counterparty-not-resolved";
}

// ---------------------------------------------------------------------------
// deriveSicrTriggered — FX mutual-fail branch
// ---------------------------------------------------------------------------

/**
 * Pure function — given an `FxSettlementFailed` event, returns the
 * `SicrTriggered` event that should be appended (or `null` when no SICR
 * signal applies).
 *
 * Branching:
 *   - `neither-delivered` → emit SICR Stage 1 → Stage 2 (this is the
 *     §5.5.3 trigger Bea's PR #641 IFRS-9 default-recognition rule
 *     flagged).
 *   - `one-leg-delivered` → no SICR emission. This is the Herstatt /
 *     default-event branch covered by PR-FX-005, which is a Stage 3
 *     transition recorded via the GL credit-loss journal (not via this
 *     memo event). A separate `SicrTriggered{previousStage:"stage-1",
 *     newStage:"stage-3", creditImpaired:true}` could be emitted to also
 *     record the §5.5.13 transition as a memo, but the canonical record
 *     of Stage-3 default for an FX trade is the PR-FX-005 GL journal
 *     (ECL allowance + credit-loss expense). Keep this slice tight —
 *     emit nothing here, document the design choice for the follow-on
 *     `SicrEscalated` event type.
 *   - `operational-delay` → no SICR emission (delay alone is not a
 *     §5.5.3 SICR trigger; only repeated delays in a rolling window are,
 *     and the repeat detector is a follow-on slice).
 */
export function deriveSicrTriggered(
  input: DeriveSicrTriggeredFromFxFailInput,
): DeriveSicrTriggeredResult {
  const { event, resolveCounterparty, entity, actor, recoveryConditionOverride } = input;
  const payload = event.payload;

  // Branch guards — only the mutual-fail kind produces a SICR signal here.
  if (payload.failureKind === "operational-delay") {
    return { event: null, reason: "operational-delay-no-sicr" };
  }
  if (payload.failureKind === "one-leg-delivered") {
    return { event: null, reason: "one-leg-delivered-default-not-sicr" };
  }

  // failureKind === "neither-delivered" — proceed with SICR derivation.
  const partyId = resolveCounterparty(payload.tradeRef);
  if (!partyId) {
    return { event: null, reason: "counterparty-not-resolved" };
  }

  const sicrPayload: SicrTriggeredPayload = {
    partyId,
    triggerKind: "settlement-failure-neither-delivered",
    triggerEventId: event.event_id,
    triggerDate: payload.failedAt,
    previousStage: "stage-1",
    newStage: "stage-2",
    evidence: [
      event.event_id,
      `tradeRef:${payload.tradeRef}`,
      `settlementInstructionRef:${payload.settlementInstructionRef}`,
    ],
    recoveryCondition: recoveryConditionOverride ?? DEFAULT_MUTUAL_FAIL_RECOVERY_CONDITION,
    watchlistTier: "watch-tier-2",
  };

  const sicrEvent = makeSicrTriggered({
    asOf: payload.failedAt,
    entity,
    actor,
    citations: [
      "urn:ifrs9:5.5.3",
      "urn:ifrs9:5.5.1",
      "urn:policy:credit-risk-policy-v1#165",
      "urn:policy:ifrs9-ecl-provisioning-policy-v1#51",
    ],
    payload: sicrPayload,
    eventId: deriveSicrEventId({ partyId, triggerEventId: event.event_id }),
  });

  return { event: sicrEvent, reason: "emitted" };
}

// ---------------------------------------------------------------------------
// appendIfNew — replay-safe append helper
// ---------------------------------------------------------------------------

/**
 * Append `candidate` to `existing` iff no event with the same `event_id`
 * is already present. Used by the subscriber's runtime wrapper (and
 * tests) to make replay safe.
 */
export function appendIfNew(existing: readonly Event[], candidate: Event): readonly Event[] {
  for (const e of existing) {
    if (e.event_id === candidate.event_id) return existing;
  }
  return [...existing, candidate];
}
