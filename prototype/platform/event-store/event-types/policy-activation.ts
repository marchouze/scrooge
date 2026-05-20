// platform/event-store/event-types/policy-activation.ts
//
// Policy-version-in-force event family.
//
//   - PolicyVersionActivated — the act by which a named policy version is
//     placed in force at a stated effective date. The event chain answers
//     the question "which policy version governed at time T?" — without
//     it, replay determinism for downstream computations (marks, P&L,
//     close-attestations, BA returns) has no machine-readable answer.
//
// Design choice — generic umbrella, not domain-specific event type.
//
//   The 2026-05-20 source record (`2026-05-20_atlas_event-view-boundary-
//   and-mark-period-events.md` §2.5) sketched the schema as
//   `ValuationPolicyVersionActivated`. On implementation we picked the
//   generic `PolicyVersionActivated` umbrella with a `policyDomain`
//   discriminator covering valuation, accounting-IFRS, and fx-translation
//   today; the §5 slice-ordering recommendation also names the same
//   policy-version-in-force gap across all three domains — codifying a
//   single event type avoids three near-identical schemas + three
//   registry rows + three permission-gate entries as the next two
//   domains activate (Slice C — `PeriodClosed` carries
//   `policyVersionRefs[]` covering valuation, accounting, fx-translation).
//
//   `OfficialMarkAdopted.policyVersionRef` (Slice B) resolves to a
//   `PolicyVersionActivated` event whose `payload.policyDomain ===
//   "valuation"`. The recon assertion in `market-data-provenance-gate.ts`
//   (advisory in this slice; gating in Slice B) carries the
//   domain-equals-valuation check.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; PR #620 records the decision).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//   - Policies/valuation-policy-v1.md (Helena, 2026-05-19) — first
//     policy activated under this event family.
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Domain discriminator
// ---------------------------------------------------------------------------

/**
 * Policy domains that participate in the policy-version-in-force chain.
 *
 * `valuation` is the first domain activated under D-EVENT-VIEW-BOUNDARY-
 * WIRE Slice A. `accounting-ifrs` and `fx-translation` are reserved for
 * follow-on slices when the corresponding policy documents are filed and
 * the close-handler (Slice C) needs to pin them in `policyVersionRefs`.
 *
 * Add new domains by extending this array — every domain extension is a
 * substrate change that adjusts the permission-gate routing (different
 * authority owns activation for each domain: Helena (Chief Risk Officer,
 * governance) for valuation; Camille (CFO, governance) for accounting-
 * IFRS; Ravi (Treasury/ALM engineer) coordinated with Camille for fx-
 * translation).
 */
export const POLICY_DOMAINS = ["valuation", "accounting-ifrs", "fx-translation"] as const;

export type PolicyDomain = (typeof POLICY_DOMAINS)[number];

export const policyDomainSchema = z.enum(POLICY_DOMAINS);

// ---------------------------------------------------------------------------
// PolicyVersionActivated
//
// The deliberate act by which the authorising agent commits to a named
// policy version as the version in force from `effectiveFrom`. Forms a
// linked chain via `supersedes` — every activation cites the prior
// activation event for the same (policyDomain, policyId), or `null` for
// the founding activation.
// ---------------------------------------------------------------------------

export const policyVersionActivatedPayloadSchema = z.object({
  /**
   * Policy domain. Drives downstream routing — valuation marks resolve
   * through `policyDomain === "valuation"` activations; accounting-IFRS
   * close-attestations resolve through `"accounting-ifrs"`, and so on.
   */
  policyDomain: policyDomainSchema,
  /**
   * Stable policy identifier. Canonical form is the upper-case slug from
   * the policy document filename (e.g. `VALUATION-POLICY-V1`,
   * `ACCOUNTING-POLICY-V1`, `FX-TRANSLATION-POLICY-V1`). The version
   * suffix in the filename and the structured `version` field below are
   * intentionally redundant — the slug carries the human-readable form;
   * the structured field is what consumers compare semver-style.
   */
  policyId: z.string().min(1),
  /**
   * Semantic version of the policy version being activated (e.g.
   * `"1.0"`, `"1.1"`, `"2.0"`). Matched against the version recorded
   * inside the policy markdown's frontmatter / change-log.
   */
  version: z.string().min(1),
  /**
   * ISO 8601 — the moment from which this version is in force. May be
   * earlier than the event's own `as_of` (back-dated activation) or
   * later (scheduled activation). Replay queries resolve "policy in
   * force at time T" by walking the supersession chain and selecting
   * the activation whose `[effectiveFrom, supersededAt]` window
   * contains T.
   */
  effectiveFrom: z.string().min(1),
  /**
   * BLAKE3 hash of the canonical policy markdown bytes — pins the exact
   * text that was activated. Carries the `blake3:` prefix per the
   * `platform/document-store/hash.ts` convention (e.g.
   * `"blake3:dfe751d1..."`). Replay determinism for downstream
   * computations requires this: same input ticks under the same policy
   * version (same hash) yield the same mark.
   */
  documentHash: z.string().regex(/^blake3:[0-9a-f]{64}$/),
  /**
   * The `event_id` of the prior `PolicyVersionActivated` event this one
   * supersedes for the same (policyDomain, policyId), or `null` for the
   * founding activation. Forms the per-policy chain — every version
   * traces back to v1.
   */
  supersedes: z.string().min(1).nullable(),
  /**
   * Actor ID of the authorising agent (e.g. `agent:helena:cro` for
   * valuation, `agent:camille:cfo` for accounting-IFRS). The
   * permission-gate's `eventEmitAllowList` is keyed to this URN; an
   * agent that lacks `PolicyVersionActivated` on its allow-list cannot
   * activate a policy under its identity.
   */
  activatedBy: z.string().min(1),
});

export type PolicyVersionActivatedPayload = z.infer<typeof policyVersionActivatedPayloadSchema>;

export function makePolicyVersionActivated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PolicyVersionActivatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PolicyVersionActivated requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PolicyVersionActivated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: policyVersionActivatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Registry array
// ---------------------------------------------------------------------------

export const POLICY_ACTIVATION_TYPED_EVENT_TYPES = ["PolicyVersionActivated"] as const;
export type PolicyActivationEventType = (typeof POLICY_ACTIVATION_TYPED_EVENT_TYPES)[number];
