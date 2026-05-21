// platform/event-store/event-types/ifrs-policy-thresholds.ts
//
// IFRS quantitative-threshold approval events. Two types:
//
//   - SicrThresholdApproved — the act by which the bank ratifies the
//     quantitative + qualitative + DPD-backstop parameters that drive
//     IFRS-9 Stage-2 staging (SICR) per §3.2.2 of the Accounting Policies
//     (IFRS) document (FIN-ACCT-01). Carried over from v1.2 (Owen draft,
//     PR #649); the v1.3 amendment (Bea peer review, PR #656) preserves
//     the event reference and tightens the rule from OR-semantics to
//     AND-semantics with a de-minimis bp floor.
//
//   - MaterialityBenchmarkApproved — the act by which the bank ratifies
//     the three-leg quantitative materiality threshold (total assets /
//     normalised PBT / CET1) per §3.5.2 of FIN-ACCT-01 v1.3. Introduced
//     by Bea's peer-review amendment (v1.3) — the v1.2 two-leg construct
//     collapsed to near-zero in the build phase and was mathematically
//     undefined in loss-making years; the three-leg construct uses the
//     "lowest of defined positive denominators" rule.
//
// Lifecycle. Both types are typed in this PR but no live events are
// emitted yet — the first emission of each is queued for the next
// CFO (Camille, governance) ratification cycle (annually at ICAAP for
// SicrThresholdApproved; annually at close-cycle working-paper review
// for MaterialityBenchmarkApproved). This PR is the substrate gate that
// admits the emission once the ratification fires; until then the
// schemas live in the registry only.
//
// Replay-fold. Both types are `latest-wins-per-key` keyed by
// `policyVersionId` (e.g. `FIN-ACCT-01-v1.3`). At any point in time the
// "in-force threshold" is the latest event for the active policy
// version; back-dated changes form an explicit supersession chain
// (`supersedes` field references the prior event_id).
//
// Authority:
//   - FIN-ACCT-01 v1.3 §3.2.2 (SICR), §3.5.2 (Materiality)
//   - IFRS 9 §§5.5.9–5.5.11 (SICR); IFRS 9 IG B5.5.1–B5.5.6
//   - IAS 1 §§7, 29–31 (materiality); IFRS Practice Statement 2
//   - brief:bea:register-sicrthresholdapproved-materialitybenchm:2026-05-21
//   - 2026-05-21_bea_ifrs-thresholds-peer-review.md
//
// Author: Bea (Accounting & financial reporting engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// SicrThresholdApproved
//
// Ratifies the SICR-staging parameters used by the IFRS-9 ECL engine.
// §3.2.2 of FIN-ACCT-01 v1.3 commits to two-leg quantitative AND-semantics
// plus qualitative-trigger OR-rule plus a DPD backstop. The schema names
// each leg explicitly so the recon pipeline can assert (a) policy values
// match emitted values and (b) the engine reads the latest approved
// values rather than a hard-coded constant.
//
// `decisionRef` is the CFO ratification handle — either a `D-...` event
// ID (Decision event, Camille (CFO, governance) authority) or, during
// the build phase before CFO seat is operational, a CEO session-delegation
// Decision URN. Resolution chain: decisionRef → Decision event →
// authorityRef (agent URN of the ratifying seat).
// ---------------------------------------------------------------------------

export const sicrThresholdApprovedPayloadSchema = z.object({
  /**
   * Policy-version identifier — the canonical slug of the policy
   * document and version that this threshold supports (e.g.
   * `FIN-ACCT-01-v1.3`). Matches the structured version inside the
   * policy markdown's frontmatter / change log.
   */
  policyVersionId: z.string().min(1),

  /**
   * Section anchor inside the policy doc (e.g. `3.2.2`). Lets recon
   * point findings at a precise paragraph rather than the whole policy.
   */
  policySection: z.string().min(1),

  // -- Quantitative leg 1: relative PD multiplier --------------------------
  /**
   * Relative-PD trigger expressed as a multiplier of the initial-recognition
   * lifetime PD. v1.3 draft value: `1.0` (i.e. +100% / doubling). Stored
   * as a non-negative number; `1.0` means "lifetime PD must at least
   * double" before this leg fires.
   */
  relativePdMultiplier: z.number().nonnegative(),

  // -- Quantitative leg 2: absolute bp increase ----------------------------
  /**
   * Absolute-PD trigger expressed in basis points (bp) of increase in
   * lifetime PD since initial recognition. v1.3 draft value: `50`
   * (i.e. +50 bp). Integer; the bp scale is fixed.
   */
  absoluteBpsIncrease: z.number().int().nonnegative(),

  /**
   * Combinator between the two quantitative legs. v1.3 commits to
   * `"and"` (both legs must trigger — Bea peer-review amendment); v1.2
   * had `"or"` ("whichever first"). Enum so the recon can assert the
   * combinator matches the policy text and the ECL engine's
   * implementation.
   */
  quantitativeCombinator: z.enum(["and", "or"]),

  // -- Qualitative triggers ------------------------------------------------
  /**
   * Qualitative SICR triggers — each fires Stage 2 on its own, regardless
   * of the quantitative test. v1.3 inventory: watchlist, adverse business
   * / financial / economic condition change, covenant breach, forbearance.
   * Free-form strings; the recon checks each appears verbatim in the
   * policy text.
   */
  qualitativeTriggers: z.array(z.string().min(1)).min(1),

  // -- DPD backstop --------------------------------------------------------
  /**
   * Days-past-due backstop — any instrument with contractual payments
   * more than `dpdBackstopDays` past due is presumed (rebuttable) to
   * have experienced SICR. v1.3 value: `30`. Integer ≥ 0.
   */
  dpdBackstopDays: z.number().int().nonnegative(),

  // -- Lifecycle bookkeeping ----------------------------------------------
  /**
   * ISO 8601 — the moment from which this threshold set is in force.
   * Replay queries resolve "threshold in force at time T" by walking
   * the supersession chain.
   */
  effectiveFrom: z.string().min(1),

  /**
   * The `event_id` of the prior `SicrThresholdApproved` event this one
   * supersedes for the same `policyVersionId`, or `null` for the
   * founding ratification. Forms the per-policy-version chain — every
   * threshold-set traces back to its first ratification.
   */
  supersedes: z.string().min(1).nullable(),

  /**
   * Ratifying-decision reference. Resolves to a `Decision` event whose
   * authority is the CFO seat (or CEO session-delegation during the
   * build phase). The recon pipeline asserts the referenced decision
   * exists and is in approved phase before the threshold becomes
   * "in force".
   */
  decisionRef: z.string().min(1),

  /**
   * Actor ID of the ratifying agent (e.g. `agent:camille:cfo` once the
   * CFO seat is operational; `agent:marc:ceo` during build-phase
   * delegation). The permission-gate's `eventEmitAllowList` is keyed
   * to this URN.
   */
  ratifiedBy: z.string().min(1),
});

export type SicrThresholdApprovedPayload = z.infer<typeof sicrThresholdApprovedPayloadSchema>;

export function makeSicrThresholdApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SicrThresholdApprovedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SicrThresholdApproved requires at least one citation (Principle 2). Use 'FIN-ACCT-01-v1.3-§3.2.2' as the base citation; add IFRS-9 references as appropriate.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SicrThresholdApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: sicrThresholdApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// MaterialityBenchmarkApproved
//
// Ratifies the three-leg quantitative materiality threshold per §3.5.2
// of FIN-ACCT-01 v1.3. The threshold at any reporting date is the
// lowest of the legs whose denominator is defined and positive.
//
// Bea's v1.3 amendment replaces the v1.2 two-leg "whichever lower"
// (5% PBT or 0.5% total assets) with a three-leg construct that
// (a) has a defined-and-positive primary leg (0.5% total assets) for
// every period, (b) replaces raw PBT with a normalised 3-year trailing
// average over profit-making years, and (c) adds a CET1 floor.
// ---------------------------------------------------------------------------

/**
 * The three legs of the v1.3 materiality threshold. New legs would be
 * additions to this enum (substrate change — every addition is a
 * deliberate policy amendment).
 */
export const MATERIALITY_DENOMINATORS = [
  "total-assets",
  "normalised-pbt",
  "cet1-capital",
] as const;

export type MaterialityDenominator = (typeof MATERIALITY_DENOMINATORS)[number];

export const materialityDenominatorSchema = z.enum(MATERIALITY_DENOMINATORS);

export const materialityBenchmarkApprovedPayloadSchema = z.object({
  /**
   * Policy-version identifier — e.g. `FIN-ACCT-01-v1.3`.
   */
  policyVersionId: z.string().min(1),

  /**
   * Section anchor inside the policy doc (e.g. `3.5.2`).
   */
  policySection: z.string().min(1),

  // -- Leg 1: total-assets percentage --------------------------------------
  /**
   * Percentage applied to total assets. v1.3 draft value: `0.005`
   * (i.e. 0.5% of total assets). Always defined-and-positive at the
   * reporting date for any going-concern entity; this leg is the
   * primary anchor preventing the threshold from collapsing to zero
   * in build-phase or loss-making years.
   */
  totalAssetsPct: z.number().positive(),

  // -- Leg 2: normalised-PBT percentage ------------------------------------
  /**
   * Percentage applied to normalised PBT. v1.3 draft value: `0.05`
   * (5%). Normalised PBT is defined as the 3-year trailing average of
   * PBT using only profit-making years (years with PBT ≤ 0 excluded);
   * the leg is inactive if fewer than three profit-making years exist
   * in the trailing window (e.g. throughout the build phase) — the
   * recon pipeline applies the "defined-and-positive denominator" rule
   * to drop this leg from the `lowest-of` calculation in such periods.
   */
  normalisedPbtPct: z.number().positive(),

  /**
   * Number of trailing years used to compute the normalised-PBT
   * denominator. v1.3 draft value: `3`. Integer ≥ 1.
   */
  normalisedPbtTrailingYears: z.number().int().positive(),

  // -- Leg 3: CET1 percentage ---------------------------------------------
  /**
   * Percentage applied to CET1 capital. v1.3 draft value: `0.01`
   * (1%). Acts as the equity-based floor introduced in the v1.3
   * amendment; defined-and-positive for any solvent entity post the
   * R300m capital raise at licence-day.
   */
  cet1Pct: z.number().positive(),

  // -- Denominator-rule policy --------------------------------------------
  /**
   * The rule by which the active threshold is selected from the legs.
   * v1.3 commits to `"lowest-of-defined-positive"` — the lowest of
   * the legs whose denominator is defined and positive in the
   * reporting period. Enum so future amendments (e.g. weighted
   * average; arithmetic mean) are explicit substrate changes.
   */
  denominatorRule: z.enum(["lowest-of-defined-positive"]),

  /**
   * Snapshot of the denominators considered active at the time of
   * ratification. The recon pipeline asserts this is a subset of
   * `MATERIALITY_DENOMINATORS` and that the value matches the policy
   * text's enumeration. Empty array would be invalid (`.min(1)`); a
   * normal v1.3 build-phase value is `["total-assets", "cet1-capital"]`
   * (PBT leg inactive); steady-state post-three-profit-years is the
   * full set.
   */
  activeDenominators: z.array(materialityDenominatorSchema).min(1),

  // -- Lifecycle bookkeeping ----------------------------------------------
  /**
   * ISO 8601 — the moment from which this benchmark set is in force.
   */
  effectiveFrom: z.string().min(1),

  /**
   * The `event_id` of the prior `MaterialityBenchmarkApproved` event
   * this one supersedes for the same `policyVersionId`, or `null` for
   * the founding ratification.
   */
  supersedes: z.string().min(1).nullable(),

  /**
   * Ratifying-decision reference. Resolves to a `Decision` event whose
   * authority is the CFO seat (or CEO session-delegation during the
   * build phase).
   */
  decisionRef: z.string().min(1),

  /**
   * Actor ID of the ratifying agent.
   */
  ratifiedBy: z.string().min(1),
});

export type MaterialityBenchmarkApprovedPayload = z.infer<
  typeof materialityBenchmarkApprovedPayloadSchema
>;

export function makeMaterialityBenchmarkApproved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: MaterialityBenchmarkApprovedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "MaterialityBenchmarkApproved requires at least one citation (Principle 2). Use 'FIN-ACCT-01-v1.3-§3.5.2' as the base citation; add IAS-1 / IFRS-PS-2 references as appropriate.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "MaterialityBenchmarkApproved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: materialityBenchmarkApprovedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Registry array
// ---------------------------------------------------------------------------

export const IFRS_POLICY_THRESHOLDS_TYPED_EVENT_TYPES = [
  "SicrThresholdApproved",
  "MaterialityBenchmarkApproved",
] as const;
export type IfrsPolicyThresholdsEventType =
  (typeof IFRS_POLICY_THRESHOLDS_TYPED_EVENT_TYPES)[number];
