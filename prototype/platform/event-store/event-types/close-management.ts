// platform/event-store/event-types/close-management.ts
//
// Close-management event family — Slice C of D-EVENT-VIEW-BOUNDARY-WIRE.
//
//   - PeriodClosed — the CFO attestation closing a financial period. Carries
//     every input needed to prove replay determinism: the set of policy-
//     activation event-IDs in force, the monorepo code SHA, and the BLAKE3
//     hashes of every derived statement the CFO attests to.
//
// Split from `AccountingPeriodClosed` (in `accounting.ts`), which will
// continue to exist as the lower-level mechanical close marker during the
// migration window. `PeriodClosed` is the attestation event; the two may
// co-exist in the same run. Subscribers gradually migrate from
// `AccountingPeriodClosed` to `PeriodClosed` as Slice C matures.
//
// Replay-determinism contract:
//
//   A holder of `PeriodClosed(periodId=P)` must be able to reproduce every
//   attested statement byte-for-byte by:
//     1. Replaying the event log up to `uptoSequence` (or `cutoffTs`).
//     2. Resolving each `policyVersionRefs[i]` to the active policy event.
//     3. Checking out `codeSha`.
//     4. Running each named statement generator.
//     5. Hashing outputs with BLAKE3.
//     6. Matching against `derivedStatementHashes` field-by-field.
//   Hash divergence is falsifiable (log tampered, policy chain compromised,
//   code version lied about, or non-deterministic generator) — any such
//   divergence is a Principle 1 violation surfaced by Vera.
//
// Authority:
//   - D-EVENT-VIEW-BOUNDARY-WIRE (CEO-approved 2026-05-20 via session
//     delegation; PR #620 records the decision).
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved); P1-EVENTS-AS-TRUTH.
//   - IFRS IAS 1 §29 (CFO attestation + period-end close obligations).
//   - Companies Act 71 of 2008 §29 (preparation of financial statements).
//   - Source record: 2026-05-20_atlas_event-view-boundary-and-mark-period-
//     events.md §3 (Atlas (Core banking platform architect, engineering)).
//
// Author: Bea (Accounting & financial reporting engineer, engineering)
//         Atlas (Core banking platform architect, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";
import { accountingPeriodKindSchema } from "./accounting";

// ---------------------------------------------------------------------------
// PeriodClosed
//
// The CFO's attestation that a financial period is closed, pinning all
// inputs needed to re-derive published statements deterministically.
// ---------------------------------------------------------------------------

export const periodClosedPayloadSchema = z.object({
  /**
   * Stable period identifier. Canonical form:
   * `"period:<entity>:<kind>:<YYYY-MM>"` e.g.
   * `"period:bank-za-001:month:2026-05"`. Matches the `periodId` field
   * on the corresponding `AccountingPeriodOpened` / `AccountingPeriodClosed`
   * events for the same period.
   */
  periodId: z.string().min(1),
  /**
   * Period kind. Drives downstream gate routing — monthly and quarterly
   * closes gate the same BA-return pipeline; half-year and year-end gate
   * additional Companies Act §29 obligations.
   */
  periodKind: accountingPeriodKindSchema,
  /**
   * ISO 8601 — the cutoff instant. Events before this timestamp count
   * toward the close; events at or after do not. Canonical cutoff for
   * replay: replaying ≤ cutoffTs reproduces the closed books.
   */
  cutoffTs: z.string().min(1),
  /**
   * Belt-and-braces sequence pin. `cutoffTs` is the canonical cutoff;
   * `uptoSequence` is the event-store row-sequence number observed at the
   * moment of close. Included so the close can be replayed without needing
   * the clock+sequence cross-walk (timestamps may not be monotone across
   * concurrent writers).
   */
  uptoSequence: z.number().int().nonnegative(),
  /**
   * Ordered list of `PolicyVersionActivated` event URNs in force at
   * `cutoffTs`. At minimum: the valuation policy (domain "valuation"),
   * the accounting-IFRS policy (domain "accounting-ifrs"), and the
   * FX-translation policy (domain "fx-translation"). Sorted
   * lexicographically by URN for hash stability — a hash over this array
   * is stable as long as the same policies are cited in the same order.
   *
   * Replay determinism requires this: same ticks + same policy set +
   * same `codeSha` → same derived statement hashes.
   */
  policyVersionRefs: z.array(z.string().min(1)).min(1),
  /**
   * Git SHA of the bank's monorepo at close. 7–40 hex chars (matches git
   * short-SHA and full-SHA conventions). Pins the code version that ran
   * the statement generators — a consumer can `git checkout <codeSha>` and
   * reproduce the generator logic byte-for-byte.
   */
  codeSha: z.string().regex(/^[0-9a-f]{7,40}$/),
  /**
   * BLAKE3 hashes of each derived statement the CFO attests to. The
   * payload carries the canonical bytes (canonical JSON or PDF bytes fixed
   * per statement type), hashed with BLAKE3. Replay must reproduce these
   * bytes exactly; divergence is a P1 violation reportable by Vera.
   *
   * `baReturns` is a sub-map keyed by return code (`"BA-325"`, `"BA-700"`
   * etc.) so new returns can be added without changing the top-level
   * schema shape.
   */
  derivedStatementHashes: z.object({
    pnl: z.string().min(1),
    balanceSheet: z.string().min(1),
    cashFlow: z.string().min(1),
    baReturns: z.record(z.string().regex(/^BA-\d{3}$/), z.string().min(1)),
  }),
  /**
   * Back-compat pointer to the trial-balance snapshot event from the same
   * close cycle. Optional: quarterly attestations atop prior monthly closes
   * may not have a discrete TB snapshot of their own.
   */
  trialBalanceSnapshotEventId: z.string().optional(),
  /**
   * The seat that holds attestation authority for this close.
   * - `"CFO"` — Camille (CFO, governance): monthly and quarterly closes.
   * - `"CFO+CEO"` — joint for year-end per Companies Act §29(3).
   * - `"CFO+CEO+AC"` — year-end when an Audit Committee is constituted
   *    and reviews the annual financial statements before approval.
   */
  attestingAuthority: z.enum(["CFO", "CFO+CEO", "CFO+CEO+AC"]),
  /**
   * Actor ID of the agent/human who signed the attestation. For the
   * Camille (CFO, governance) seat this is `"agent:camille:cfo"`. For
   * joint sign-off this is the ID of the primary signer; the countersigning
   * actor is conveyed in the event's `actor` field directly.
   */
  attestedBy: z.string().min(1),
  /**
   * The `event_id` of the preceding `PeriodClosed` event (the prior
   * period's close), or `null` for the bank's founding close. Forms a
   * linked chain — every period-close traces back to the first close.
   */
  priorPeriodRef: z.string().nullable(),
  /**
   * When this `PeriodClosed` reopens and re-closes a prior period (e.g.
   * an audit reopens 2026-05 in 2026-08), this field carries the
   * `event_id` of the original close being superseded. The superseded
   * close event stays in the log (append-only); this field marks the
   * supersession explicitly.
   */
  supersedesClose: z.string().optional(),
});

export type PeriodClosedPayload = z.infer<typeof periodClosedPayloadSchema>;

export function makePeriodClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: PeriodClosedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "PeriodClosed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }

  const parsed = periodClosedPayloadSchema.parse(args.payload);

  if (parsed.policyVersionRefs.length === 0) {
    throw new Error(
      "PeriodClosed requires at least one policyVersionRef — the replay-determinism contract requires pinning the active policy set.",
    );
  }

  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "PeriodClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: parsed,
  });
}

// ---------------------------------------------------------------------------
// Registry array
// ---------------------------------------------------------------------------

export const CLOSE_MANAGEMENT_TYPED_EVENT_TYPES = ["PeriodClosed"] as const;
export type CloseManagementEventType = (typeof CLOSE_MANAGEMENT_TYPED_EVENT_TYPES)[number];
