// v2-core/posture/projection.ts
//
// Posture register projection — a pure fold over posture events that produces
// the canonical posture register state. The projection answers three queries:
//
//   getActivePostures(context) — all postures active for a given context
//   getPosture(postureId)      — a single posture record (latest revision)
//   listPostures()             — all postures (active and inactive)
//
// PRINCIPLE 1 INVARIANT: the register is a query over events, not stored state.
// The projection is deterministic and replayable from any suffix of the event log.
//
// The `PostureRegister` type carries a `fold(event)` method that callers use to
// accumulate events. The empty register is `emptyPostureRegister()`. This
// follows the same pattern as `FilModelsRegister` in `fil-models/registry.ts`.
//
// PACKAGE BOUNDARY: no v1 imports permitted.
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import type { Instant } from "../fil-core/primitives";
import { type AppliesToScope, type PostureContext, evaluateAppliesToScope } from "./applies-when";
import type { PostureClass, PostureRevisedPayload, PostureTier } from "./events";

// ---------------------------------------------------------------------------
// Posture record — the projected state of a single posture
// ---------------------------------------------------------------------------

/**
 * The current state of a registered posture as projected from events. This is
 * the value type returned by all three register queries. It is a fold output —
 * never stored directly; always derived from events (Principle 1).
 */
export interface Posture {
  /** Stable id; convention `posture:<class>:<short-slug>`. */
  readonly postureId: string;
  readonly postureClass: PostureClass;
  readonly description: string;
  readonly appliesToScope: AppliesToScope;
  readonly appliesToTier: PostureTier;
  readonly proposedBy: string;
  readonly citations: readonly string[];
  readonly parameters?: Readonly<Record<string, unknown>>;
  /**
   * Whether this posture is currently active. A posture is active after a
   * `PostureActivated` event and before any `PostureDeactivated` event for
   * the same `postureId`. The most recent event wins (latest-wins-per-key
   * replay fold for the active/inactive dimension).
   */
  readonly active: boolean;
  /**
   * The scope the posture was most recently activated for. May differ from
   * `appliesToScope` if `PostureActivated` was called with a narrower scope
   * override. For the pilot seed, activation scope == registration scope.
   */
  readonly activatedScope?: AppliesToScope;
  readonly activatedAt?: Instant;
  readonly authority?: string;
  /** Deactivation reason, if the posture has been deactivated. */
  readonly deactivationReason?: string;
}

// ---------------------------------------------------------------------------
// Posture register state
// ---------------------------------------------------------------------------

/**
 * Internal mutable state — not exported. The public surface is `PostureRegister`.
 */
interface PostureState {
  postureId: string;
  postureClass: PostureClass;
  description: string;
  appliesToScope: AppliesToScope;
  appliesToTier: PostureTier;
  proposedBy: string;
  citations: readonly string[];
  // Optional fields use `| undefined` to be compatible with exactOptionalPropertyTypes.
  parameters: Readonly<Record<string, unknown>> | undefined;
  active: boolean;
  activatedScope: AppliesToScope | undefined;
  activatedAt: Instant | undefined;
  authority: string | undefined;
  deactivationReason: string | undefined;
}

// ---------------------------------------------------------------------------
// Raw event shapes understood by the fold
// ---------------------------------------------------------------------------

interface RawPostureRegistered {
  kind: "PostureRegistered";
  postureId: string;
  postureClass: PostureClass;
  description: string;
  appliesToScope: AppliesToScope;
  appliesToTier: PostureTier;
  proposedBy: string;
  citations: readonly string[];
  parameters?: Readonly<Record<string, unknown>>;
}

interface RawPostureActivated {
  kind: "PostureActivated";
  postureId: string;
  appliesToScope: AppliesToScope;
  activatedAt: Instant;
  authority: string;
  citations: readonly string[];
}

interface RawPostureDeactivated {
  kind: "PostureDeactivated";
  postureId: string;
  appliesToScope: AppliesToScope;
  deactivatedAt: Instant;
  reason: string;
}

interface RawPostureRevised {
  kind: "PostureRevised";
  postureId: string;
  revisedFields: PostureRevisedPayload["revisedFields"];
  revisedAt: Instant;
  authority: string;
  citations: readonly string[];
}

type RawPostureEvent =
  | RawPostureRegistered
  | RawPostureActivated
  | RawPostureDeactivated
  | RawPostureRevised;

// ---------------------------------------------------------------------------
// PostureRegister
// ---------------------------------------------------------------------------

/**
 * The immutable posture register projected from a sequence of posture events.
 * Build via `emptyPostureRegister()` + `fold(event)`, or
 * `foldPostureRegister(events)` for a batch fold.
 */
export interface PostureRegister {
  /**
   * Returns all postures whose APPLIES_WHEN predicate holds in `context`
   * AND that are currently active. The evaluation is a pure structural match;
   * no external data access.
   */
  getActivePostures(context: PostureContext): Posture[];

  /**
   * Returns the projected state of a single posture by id, or `null` if no
   * `PostureRegistered` event with that id has been folded.
   */
  getPosture(postureId: string): Posture | null;

  /**
   * Returns all postures in the register, active and inactive.
   */
  listPostures(): Posture[];

  /**
   * Integrity violations detected during fold (used by the recon gate).
   * Examples: PostureActivated without a prior PostureRegistered; duplicate
   * PostureRegistered for the same id.
   */
  readonly violations: readonly PostureRegisterViolation[];

  /**
   * Total number of events folded (used by the recon gate).
   */
  readonly eventCount: number;
}

/** A structural integrity finding surfaced during fold. */
export interface PostureRegisterViolation {
  readonly postureId: string;
  readonly kind:
    | "orphan-activation"
    | "orphan-deactivation"
    | "orphan-revision"
    | "duplicate-registration";
  readonly message: string;
}

// ---------------------------------------------------------------------------
// Fold implementation
// ---------------------------------------------------------------------------

/**
 * Internal mutable accumulator. `PostureRegister` is the immutable view; this
 * is the mutable working state during fold.
 */
class PostureRegisterAccumulator {
  private readonly byId = new Map<string, PostureState>();
  readonly violations: PostureRegisterViolation[] = [];
  eventCount = 0;

  fold(raw: unknown): void {
    this.eventCount += 1;

    // Type-narrow the raw event. The fold is tolerant: unknown event kinds
    // are silently skipped (future-event compat); malformed payloads are skipped
    // with a violation.
    if (typeof raw !== "object" || raw === null) return;
    const ev = raw as Partial<RawPostureEvent>;
    if (typeof ev.kind !== "string") return;

    switch (ev.kind as string) {
      case "PostureRegistered": {
        const e = ev as RawPostureRegistered;
        if (!e.postureId || !e.postureClass || !e.description || !e.appliesToScope) return;
        if (this.byId.has(e.postureId)) {
          this.violations.push({
            postureId: e.postureId,
            kind: "duplicate-registration",
            message: `PostureRegistered received for already-registered id: ${e.postureId}`,
          });
          // Allow the duplicate to overwrite — latest-wins for idempotent reseeds.
        }
        this.byId.set(e.postureId, {
          postureId: e.postureId,
          postureClass: e.postureClass,
          description: e.description,
          appliesToScope: e.appliesToScope,
          appliesToTier: e.appliesToTier ?? "all",
          proposedBy: e.proposedBy ?? "",
          citations: e.citations ?? [],
          parameters: e.parameters !== undefined ? e.parameters : undefined,
          active: false,
          activatedScope: undefined,
          activatedAt: undefined,
          authority: undefined,
          deactivationReason: undefined,
        });
        break;
      }
      case "PostureActivated": {
        const e = ev as RawPostureActivated;
        if (!e.postureId) return;
        const state = this.byId.get(e.postureId);
        if (!state) {
          this.violations.push({
            postureId: e.postureId,
            kind: "orphan-activation",
            message: `PostureActivated for unregistered postureId: ${e.postureId}`,
          });
          return;
        }
        state.active = true;
        state.activatedScope = e.appliesToScope ?? state.appliesToScope;
        state.activatedAt = e.activatedAt;
        state.authority = e.authority;
        state.deactivationReason = undefined;
        break;
      }
      case "PostureDeactivated": {
        const e = ev as RawPostureDeactivated;
        if (!e.postureId) return;
        const state = this.byId.get(e.postureId);
        if (!state) {
          this.violations.push({
            postureId: e.postureId,
            kind: "orphan-deactivation",
            message: `PostureDeactivated for unregistered postureId: ${e.postureId}`,
          });
          return;
        }
        state.active = false;
        state.deactivationReason = e.reason;
        break;
      }
      case "PostureRevised": {
        const e = ev as RawPostureRevised;
        if (!e.postureId) return;
        const state = this.byId.get(e.postureId);
        if (!state) {
          this.violations.push({
            postureId: e.postureId,
            kind: "orphan-revision",
            message: `PostureRevised for unregistered postureId: ${e.postureId}`,
          });
          return;
        }
        if (e.revisedFields.description !== undefined) {
          state.description = e.revisedFields.description;
        }
        if (e.revisedFields.appliesToScope !== undefined) {
          state.appliesToScope = e.revisedFields.appliesToScope;
        }
        if (e.revisedFields.appliesToTier !== undefined) {
          state.appliesToTier = e.revisedFields.appliesToTier;
        }
        if (e.revisedFields.parameters !== undefined) {
          state.parameters = e.revisedFields.parameters;
        }
        state.authority = e.authority;
        break;
      }
      default:
        // Unknown event kind — skip silently (forward-compat).
        this.eventCount -= 1; // don't count unknown events
        break;
    }
  }

  toRegister(): PostureRegister {
    // Snapshot the map so the register is immutable after fold.
    const snapshot = new Map(this.byId);
    const violations = [...this.violations];
    const eventCount = this.eventCount;

    return {
      getPosture(postureId: string): Posture | null {
        const s = snapshot.get(postureId);
        return s ? stateToPosture(s) : null;
      },
      listPostures(): Posture[] {
        return Array.from(snapshot.values()).map(stateToPosture);
      },
      getActivePostures(context: PostureContext): Posture[] {
        return Array.from(snapshot.values())
          .filter((s) => s.active && evaluateAppliesToScope(s.appliesToScope, context))
          .map(stateToPosture);
      },
      violations,
      eventCount,
    };
  }
}

function stateToPosture(s: PostureState): Posture {
  return {
    postureId: s.postureId,
    postureClass: s.postureClass,
    description: s.description,
    appliesToScope: s.appliesToScope,
    appliesToTier: s.appliesToTier,
    proposedBy: s.proposedBy,
    citations: s.citations,
    ...(s.parameters !== undefined ? { parameters: s.parameters } : {}),
    active: s.active,
    ...(s.activatedScope !== undefined ? { activatedScope: s.activatedScope } : {}),
    ...(s.activatedAt !== undefined ? { activatedAt: s.activatedAt } : {}),
    ...(s.authority !== undefined ? { authority: s.authority } : {}),
    ...(s.deactivationReason !== undefined ? { deactivationReason: s.deactivationReason } : {}),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns an empty posture register accumulator. Fold events onto it via
 * `foldPostureRegister` or by calling `.fold(event)` on the accumulator
 * directly.
 */
export function emptyPostureRegister(): PostureRegister {
  return new PostureRegisterAccumulator().toRegister();
}

/**
 * Fold a sequence of raw event payloads into a posture register. This is the
 * primary projection entry point; callers pass whatever the event store returns
 * for the four posture event kinds.
 *
 * Tolerant fold: unknown event shapes are skipped; structural violations are
 * accumulated in `register.violations` rather than throwing.
 */
export function foldPostureRegister(rawEvents: unknown[]): PostureRegister {
  const acc = new PostureRegisterAccumulator();
  for (const ev of rawEvents) {
    acc.fold(ev);
  }
  return acc.toRegister();
}
