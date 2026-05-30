// platform/event-store/event-types/odp-umoja-uti.ts
//
// ODP Umoja Portal API + UTI Allocation — typed event-payload schemas.
//
// SCOPE:
//   WS-ODP-UMOJA-UTI (ORG-ODP-RPT-003 + ORG-MK-RPT-002)
//   Regulation: urn:regulation:odp:cs-3-2018 + urn:regulation:odp:jn-2-2024
//
// This module is the LAST of four ODP workstreams. It closes the OTC-derivative
// reporting prerequisite for commencement of trading.
//
// Event types (12 total):
//
//   UTI allocation:
//     1. TradeUtiAllocated            — UTI (ISO 23602) allocated to a reportable trade;
//                                       deterministic SHA-256 path, LEI-prefixed.
//
//   Trade-report serialisation + submission lifecycle:
//     2. OdpTradeReportPrepared       — EMIR-style XML serialisation produced from events.
//     3. OdpReportSubmissionAttempted — T+1/16:00 submission sent to Umoja portal.
//     4. OdpReportSubmissionAccepted  — Umoja portal returned accepted acknowledgement.
//     5. OdpReportSubmissionRejected  — Umoja portal returned rejection + error codes.
//     6. OdpReportAmendmentRequested  — Counterparty or regulator requests a correction.
//     7. OdpReportAmendmentSubmitted  — Correction submitted to Umoja.
//
//   Trade-repository reconciliation:
//     8. OdpRepoReconRun              — Submitted-vs-repository view reconciliation run.
//     9. OdpRepoReconBreakRaised      — Individual trade mismatch between submission
//                                       and repository view.
//    10. OdpRepoReconDisputeOpened    — Formal dispute opened on a repo-recon break.
//    11. OdpRepoReconDisputeResolved  — Dispute resolved or escalated to CCO.
//
//   Umoja portal OAuth token lifecycle:
//    12. UmojaPortalTokenRefreshed    — OAuth2 client-credentials grant refreshed;
//                                       no secret in payload (reference only).
//
// DESIGN DECISIONS:
//   1. Events-first (Principle 1) — every UTI allocation, submission attempt,
//      acknowledgement, reconciliation run, and break is a typed event. XML
//      serialisations are derived renders stored in the document store; not
//      canonical artefacts.
//   2. Deterministic UTI (ISO 23602) — SHA-256(LEI + "|" + tradeId) truncated
//      to 32 hex chars. Same trade → same UTI across all runs. A DTCC/SAFE-API
//      source path is preserved as a design seam (`utiSource` field).
//   3. Injected clock (wall-clock ratchet compliance) — T+1/16:00 deadline logic
//      uses `opts.now ?? new Date()` patterns, NOT raw `new Date()` or `Date.now()`
//      in production capability code. The submission deadline helper is tested
//      via injected clock.
//   4. Umoja portal behind adapter interface (Principle 3) — the simulator mirrors
//      the SARB portal simulator pattern. No live external calls.
//   5. Break/escalation reuse — OdpRepoReconBreakRaised / OdpRepoReconDisputeOpened
//      / OdpRepoReconDisputeResolved reuse the structural pattern from
//      WS-ODP-PORTFOLIO-RECON (#898). No new break-escalation framework.
//   6. Currency at the type level (Principle 5) — all notional fields carry ISO 4217.
//
// Authority:
//   ORG-ODP-RPT-003 (ODP trade reporting obligation — portfolio / UTI)
//   ORG-MK-RPT-002  (Market conduct trade reporting obligation)
//   urn:regulation:odp:cs-3-2018 §§ 4–6 (ODP Conduct Standard 3/2018 — trade reporting)
//   urn:regulation:odp:jn-2-2024 §§ 3–5 (ODP Joint Notice 2/2024 — UTI requirements)
//   ISO 23602:2020 (Unique Trade Identifier standard)
//   EMIR/ESMA SFDR Article 9 (trade reporting reference)
//   Principle 1 — events-are-truth (platform/principles/1-events-are-truth.md)
//   Principle 5 — multi-currency (platform/principles/5-multi-currency-entity-country.md)
//
// Author: Devon (COO, operations)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/**
 * MoneyAmount — ISO 4217 currency + minor-unit amount pair.
 * Per Principle 5 (multi-currency from day one) — no default currency.
 */
const moneyAmountSchema = z.object({
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  amountMinor: z.number().int(),
});
export type UmojaMoneyAmount = z.infer<typeof moneyAmountSchema>;

/**
 * OdpReportableProductType — the OTC derivative product classes covered by
 * the ODP reporting obligation under CS 3/2018.
 *
 *   "fx-spot"         — FX spot (≤ T+2, FX-only)
 *   "fx-forward"      — FX outright forward
 *   "fx-swap"         — FX swap (near + far legs)
 *   "irs"             — Interest Rate Swap (plain vanilla)
 *   "fra"             — Forward Rate Agreement
 *   "swaption"        — Option on IRS
 *   "basis-swap"      — Float-to-float basis swap
 *   "cross-ccy-swap"  — Cross-currency swap
 */
export const odpReportableProductTypeSchema = z.enum([
  "fx-spot",
  "fx-forward",
  "fx-swap",
  "irs",
  "fra",
  "swaption",
  "basis-swap",
  "cross-ccy-swap",
]);
export type OdpReportableProductType = z.infer<typeof odpReportableProductTypeSchema>;

/**
 * UtiSource — the origination path for a UTI.
 *   "sha256-lei-prefixed" — deterministic: SHA-256(LEI + "|" + tradeId), hex, 32 chars.
 *                           This is the default path per JN 2/2024 §4(b).
 *   "dtcc-safe-api"       — UTI issued by DTCC SAFE repository API.
 *                           Available as a design seam; not yet wired (substrate gap).
 *   "counterparty-issued" — UTI was issued by the counterparty and agreed bilaterally.
 */
export const utiSourceSchema = z.enum([
  "sha256-lei-prefixed",
  "dtcc-safe-api",
  "counterparty-issued",
]);
export type UtiSource = z.infer<typeof utiSourceSchema>;

// ---------------------------------------------------------------------------
// 1. TradeUtiAllocated
//
// Emitted once per reportable trade when a UTI has been allocated.
// The UTI is deterministic and idempotent: the same (bankLei, tradeId) pair
// always produces the same UTI. Re-emission of this event with the same
// `uti` value is idempotent by design.
//
// UTI format (ISO 23602 §4.2 "pre-LEI" structure, SHA-256 path):
//   bankLei (20 chars) + hex-SHA-256(bankLei + "|" + tradeId), first 32 chars
//   Total: 20 + 32 = 52 chars — within the 52-character UTI length limit.
//
// DTCC/SAFE-API path: swap `utiSource` to "dtcc-safe-api" and populate `uti`
// from the API response. The event schema is unchanged; the allocator returns
// the SAFE-issued UTI instead of computing the SHA-256 path. The seam is in
// `allocateUti()` (see platform/odp/uti-allocator.ts).
//
// Authority:
//   ORG-ODP-RPT-003 (UTI obligation for all OTC derivative trades)
//   urn:regulation:odp:jn-2-2024 §§ 3–5 (UTI allocation rules)
//   ISO 23602:2020 §4.2 (UTI structure)
// ---------------------------------------------------------------------------

export const tradeUtiAllocatedPayloadSchema = z.object({
  /**
   * Internal trade identifier (links back to the booking event: FxTradeExecuted,
   * IrsTradeBooked, FraTradeBooked, SwaptionTradeBooked, etc.).
   */
  tradeId: z.string().min(1),

  /**
   * The allocated UTI — ISO 23602 format.
   * For the SHA-256 path: `${bankLei}${sha256(bankLei + "|" + tradeId).slice(0, 32)}`.
   */
  uti: z.string().min(1).max(52),

  /**
   * The origination path for this UTI.
   * Default: "sha256-lei-prefixed" (deterministic, no external dependency).
   */
  utiSource: utiSourceSchema,

  /**
   * ISO 8601 date of the originating trade.
   * Used to verify T+1 submission deadline compliance.
   */
  tradeDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * OTC derivative product type — drives the serialisation template.
   */
  productType: odpReportableProductTypeSchema,

  /**
   * Party register URN of the counterparty.
   * Format: `party:<scheme>:<id>`.
   */
  counterpartyId: z.string().min(1),

  /**
   * The bank's LEI used to compute the UTI (for audit verification).
   * ISO 17442 20-character LEI.
   */
  bankLei: z.string().length(20),

  /**
   * Whether the bank is the UTI-generating party (EMIR Article 9: the party
   * that "must ensure" the UTI is allocated — typically the financial
   * counterparty or the reporting counterparty under the bilateral regime).
   * Per JN 2/2024 §4(a): the bank, as an ODP-regulated entity, generates
   * the UTI for all trades with non-regulated counterparties.
   */
  bankIsUtiGenerator: z.boolean(),

  /**
   * Notional in reporting currency (minor units). Optional — absent for
   * products without a single notional (e.g. swaptions before exercise).
   * Per Principle 5 — currency-tagged.
   */
  reportingNotional: moneyAmountSchema.optional(),
});

export type TradeUtiAllocatedPayload = z.infer<typeof tradeUtiAllocatedPayloadSchema>;

export function makeTradeUtiAllocated(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeUtiAllocatedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "TradeUtiAllocated requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:jn-2-2024.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeUtiAllocated",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: tradeUtiAllocatedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 2. OdpTradeReportPrepared
//
// Emitted when an EMIR-style XML trade report has been serialised from the
// reportable events and is ready for submission.
//
// The XML body is NOT stored in the event payload (too large; Principle 1:
// the event log must stay lean). The XML is stored in the document store
// (BLAKE3-addressed) and referenced via `documentHash`.
//
// Authority:
//   ORG-ODP-RPT-003 (trade report format obligations)
//   urn:regulation:odp:cs-3-2018 §5 (trade report format: EMIR/ESMA SFDR-aligned)
// ---------------------------------------------------------------------------

export const odpTradeReportPreparedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI from TradeUtiAllocated — must be allocated before report preparation. */
  uti: z.string().min(1).max(52),

  /** ISO 8601 date for which this report is prepared (trade date or amendment date). */
  reportDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /**
   * Report action type.
   *   "new"    — initial report for a new trade (T+1 deadline).
   *   "modify" — modification report (trade terms changed).
   *   "cancel" — cancellation report (trade terminated early).
   *   "error"  — error correction (previous report had an error).
   */
  actionType: z.enum(["new", "modify", "cancel", "error"]),

  /** OTC derivative product type — determines the XML template used. */
  productType: odpReportableProductTypeSchema,

  /**
   * BLAKE3 content hash of the serialised XML document stored in the
   * document store. Allows audit verification of the exact XML submitted.
   */
  documentHash: z.string().min(1),

  /**
   * ISO 8601 timestamp when the report was prepared.
   * Must be before the T+1/16:00 SA time submission deadline.
   */
  preparedAt: z.string().min(1),

  /**
   * The event-ID of the TradeUtiAllocated event for this trade.
   * Required — report preparation cannot proceed without UTI allocation.
   */
  utiEventId: z.string().uuid(),
});

export type OdpTradeReportPreparedPayload = z.infer<typeof odpTradeReportPreparedPayloadSchema>;

export function makeOdpTradeReportPrepared(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpTradeReportPreparedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpTradeReportPrepared requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §5.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpTradeReportPrepared",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpTradeReportPreparedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 3. OdpReportSubmissionAttempted
//
// Emitted when the trade report XML is sent to the Umoja portal.
// Every attempt — success or failure — emits this event (Principle 1).
//
// The T+1/16:00 SA time deadline is enforced by the submission engine.
// Submissions after the deadline are flagged as late; the engine still
// attempts submission and emits this event with `withinDeadline: false`.
//
// Authority:
//   ORG-ODP-RPT-003 (T+1 submission deadline)
//   urn:regulation:odp:cs-3-2018 §4(c) (daily T+1 by 16:00 deadline)
// ---------------------------------------------------------------------------

export const odpReportSubmissionAttemptedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI being reported. */
  uti: z.string().min(1).max(52),

  /** Event-ID of the OdpTradeReportPrepared event being submitted. */
  reportEventId: z.string().uuid(),

  /**
   * ISO 8601 timestamp when the submission was sent.
   * Used to assess T+1/16:00 deadline compliance.
   */
  submittedAt: z.string().min(1),

  /**
   * Whether the submission was within the T+1/16:00 SA time deadline.
   * `false` indicates a late submission — CCO (Zara) must be notified.
   */
  withinDeadline: z.boolean(),

  /**
   * Umoja portal session identifier for this submission attempt.
   * Used to correlate with OdpReportSubmissionAccepted / Rejected.
   */
  portalSessionId: z.string().min(1),

  /**
   * Report action type (mirrors OdpTradeReportPrepared.actionType).
   */
  actionType: z.enum(["new", "modify", "cancel", "error"]),

  /**
   * Whether this is a simulator submission (build phase) or a live
   * submission (post-licence day). Disambiguates in the audit trail.
   */
  mode: z.enum(["simulator", "live"]),
});

export type OdpReportSubmissionAttemptedPayload = z.infer<
  typeof odpReportSubmissionAttemptedPayloadSchema
>;

export function makeOdpReportSubmissionAttempted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReportSubmissionAttemptedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReportSubmissionAttempted requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §4.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReportSubmissionAttempted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReportSubmissionAttemptedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 4. OdpReportSubmissionAccepted
//
// Emitted when the Umoja portal returns a positive acknowledgement.
//
// Authority:
//   ORG-ODP-RPT-003 (acknowledgement records obligation)
//   urn:regulation:odp:cs-3-2018 §4(d) (portal acknowledgement record)
// ---------------------------------------------------------------------------

export const odpReportSubmissionAcceptedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI that was accepted. */
  uti: z.string().min(1).max(52),

  /** Event-ID of the OdpReportSubmissionAttempted event. */
  submissionEventId: z.string().uuid(),

  /**
   * Portal-assigned reference number for this accepted submission.
   * Used for subsequent amendments, cancellations, and reconciliation.
   */
  portalReferenceNumber: z.string().min(1),

  /** ISO 8601 timestamp of the portal acknowledgement. */
  acceptedAt: z.string().min(1),

  /** Umoja portal session identifier (mirrors the submission event). */
  portalSessionId: z.string().min(1),
});

export type OdpReportSubmissionAcceptedPayload = z.infer<
  typeof odpReportSubmissionAcceptedPayloadSchema
>;

export function makeOdpReportSubmissionAccepted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReportSubmissionAcceptedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReportSubmissionAccepted requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §4.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReportSubmissionAccepted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReportSubmissionAcceptedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 5. OdpReportSubmissionRejected
//
// Emitted when the Umoja portal returns a rejection.
// Rejection triggers the amendment workflow.
//
// Authority:
//   ORG-ODP-RPT-003 (rejection handling)
//   urn:regulation:odp:cs-3-2018 §4(e) (rejection + remediation)
// ---------------------------------------------------------------------------

export const odpReportSubmissionRejectedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI that was rejected. */
  uti: z.string().min(1).max(52),

  /** Event-ID of the OdpReportSubmissionAttempted event. */
  submissionEventId: z.string().uuid(),

  /** ISO 8601 timestamp of the portal rejection. */
  rejectedAt: z.string().min(1),

  /** Umoja portal session identifier. */
  portalSessionId: z.string().min(1),

  /**
   * Portal error codes returned (one or more).
   * These are the Umoja-defined validation error codes (e.g. "UTI-INVALID",
   * "PRODUCT-TYPE-MISMATCH", "LEI-UNKNOWN"). Build-phase simulator returns
   * well-known codes from the error-code catalogue.
   */
  errorCodes: z.array(z.string().min(1)).min(1),

  /**
   * Human-readable error messages corresponding to `errorCodes`.
   * One message per code.
   */
  errorMessages: z.array(z.string().min(1)).min(1),

  /**
   * Whether the rejection is recoverable (amendment can fix it).
   *   `true`  — portal rejected the report but an amended resubmission is allowed.
   *   `false` — portal permanently rejected (e.g. duplicate UTI, terminal error).
   */
  recoverable: z.boolean(),
});

export type OdpReportSubmissionRejectedPayload = z.infer<
  typeof odpReportSubmissionRejectedPayloadSchema
>;

export function makeOdpReportSubmissionRejected(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReportSubmissionRejectedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReportSubmissionRejected requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §4.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReportSubmissionRejected",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReportSubmissionRejectedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 6. OdpReportAmendmentRequested
//
// Emitted when a counterparty or regulator requests a correction to a
// previously submitted trade report. Triggers the amendment workflow.
//
// Authority:
//   urn:regulation:odp:cs-3-2018 §4(e) (modification obligation)
// ---------------------------------------------------------------------------

export const odpReportAmendmentRequestedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI of the trade requiring amendment. */
  uti: z.string().min(1).max(52),

  /**
   * Portal reference number of the original accepted submission.
   * From OdpReportSubmissionAccepted.portalReferenceNumber.
   */
  originalPortalRef: z.string().min(1),

  /** Who requested the amendment. */
  requestedBy: z.enum(["counterparty", "regulator", "internal"]),

  /** Free-form description of the amendment required. */
  amendmentReason: z.string().min(1),

  /** ISO 8601 timestamp of the amendment request. */
  requestedAt: z.string().min(1),
});

export type OdpReportAmendmentRequestedPayload = z.infer<
  typeof odpReportAmendmentRequestedPayloadSchema
>;

export function makeOdpReportAmendmentRequested(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReportAmendmentRequestedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReportAmendmentRequested requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §4.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReportAmendmentRequested",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReportAmendmentRequestedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 7. OdpReportAmendmentSubmitted
//
// Emitted when a correction to a previously accepted report is submitted.
//
// Authority:
//   ORG-ODP-RPT-003 (amendment submission)
//   urn:regulation:odp:cs-3-2018 §4(e) (modification obligation)
// ---------------------------------------------------------------------------

export const odpReportAmendmentSubmittedPayloadSchema = z.object({
  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI of the trade being amended. */
  uti: z.string().min(1).max(52),

  /** Event-ID of the OdpReportAmendmentRequested event this addresses. */
  amendmentRequestEventId: z.string().uuid(),

  /**
   * Portal reference number of the original accepted submission being amended.
   */
  originalPortalRef: z.string().min(1),

  /** Event-ID of the OdpTradeReportPrepared event for the amended report. */
  amendedReportEventId: z.string().uuid(),

  /** ISO 8601 timestamp when the amendment was submitted. */
  submittedAt: z.string().min(1),

  /** Umoja portal session identifier for the amendment submission. */
  portalSessionId: z.string().min(1),
});

export type OdpReportAmendmentSubmittedPayload = z.infer<
  typeof odpReportAmendmentSubmittedPayloadSchema
>;

export function makeOdpReportAmendmentSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpReportAmendmentSubmittedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpReportAmendmentSubmitted requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §4.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpReportAmendmentSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpReportAmendmentSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 8. OdpRepoReconRun
//
// Records a completed reconciliation run comparing submitted trade reports
// against the Umoja portal / trade repository view.
//
// Reuses the structural pattern from WS-ODP-PORTFOLIO-RECON (#898):
//   - Same reconRunOutcome enum ("clean" | "breaks-found" | "inconclusive")
//   - Same break/dispute lifecycle pattern
//   - No new framework invented
//
// Cadence: daily T+1, triggered after submission window closes at 16:00.
//
// Authority:
//   ORG-ODP-RPT-003 (submission vs repository reconciliation obligation)
//   urn:regulation:odp:cs-3-2018 §6 (trade repository reconciliation)
// ---------------------------------------------------------------------------

const repoReconOutcomeSchema = z.enum(["clean", "breaks-found", "inconclusive"]);
export type OdpRepoReconOutcome = z.infer<typeof repoReconOutcomeSchema>;

export const odpRepoReconRunPayloadSchema = z.object({
  /** ISO 8601 business date this reconciliation run covers. */
  reconDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

  /** Number of trades submitted (accepted) for `reconDate`. */
  submittedTradeCount: z.number().int().nonnegative(),

  /** Number of trades confirmed in the Umoja repository view for `reconDate`. */
  repositoryTradeCount: z.number().int().nonnegative(),

  /** Overall run outcome. */
  outcome: repoReconOutcomeSchema,

  /**
   * Number of trades where submitted report matches repository view exactly.
   */
  matchedCount: z.number().int().nonnegative(),

  /**
   * Number of trades with a mismatch between submission and repository view.
   * Each break is separately recorded in OdpRepoReconBreakRaised.
   */
  breakCount: z.number().int().nonnegative(),

  /**
   * Number of trades submitted but not yet visible in the repository view
   * (timing lag — expected to clear within 1 business day).
   */
  pendingCount: z.number().int().nonnegative(),

  /** IDs of OdpRepoReconBreakRaised events for breaks found in this run. */
  breakEventIds: z.array(z.string().uuid()).default([]),
});

export type OdpRepoReconRunPayload = z.infer<typeof odpRepoReconRunPayloadSchema>;

export function makeOdpRepoReconRun(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpRepoReconRunPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpRepoReconRun requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §6.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpRepoReconRun",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpRepoReconRunPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 9. OdpRepoReconBreakRaised
//
// Emitted once per trade mismatch detected between the submission and the
// Umoja repository view. Reuses the structural pattern from OdpReconBreakRaised
// (WS-ODP-PORTFOLIO-RECON).
//
// Authority:
//   ORG-ODP-RPT-003 (break handling)
//   urn:regulation:odp:cs-3-2018 §6 (reconciliation break resolution)
// ---------------------------------------------------------------------------

const repoBreakTypeSchema = z.enum([
  "missing-in-repo",       // Submitted but not visible in repository
  "missing-in-submission", // In repository but no matching submission found
  "uti-mismatch",          // UTI in submission ≠ UTI in repository
  "field-mismatch",        // One or more reportable fields differ
  "status-mismatch",       // Report status (new/modified/cancelled) differs
]);
export type OdpRepoBreakType = z.infer<typeof repoBreakTypeSchema>;

export const odpRepoReconBreakRaisedPayloadSchema = z.object({
  /**
   * Unique break identifier.
   * Format: `REPO-BREAK-<YYYYMMDD>-<tradeId>-<seq>`.
   */
  breakId: z.string().min(1),

  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI involved in the break (may be absent for "missing-in-repo" with UTI unresolved). */
  uti: z.string().max(52).optional(),

  /** Event-ID of the OdpRepoReconRun event that raised this break. */
  sourceRunEventId: z.string().uuid(),

  /** The type of mismatch detected. */
  breakType: repoBreakTypeSchema,

  /** Human-readable description of the break. */
  description: z.string().min(1),

  /**
   * ISO 8601 deadline by which this break must be resolved.
   * CS 3/2018 §6: repo-recon breaks must be investigated within 2 business days.
   * (Calendar-day approximation: 4 calendar days.)
   */
  resolutionDeadline: z.string().min(1),
});

export type OdpRepoReconBreakRaisedPayload = z.infer<typeof odpRepoReconBreakRaisedPayloadSchema>;

export function makeOdpRepoReconBreakRaised(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpRepoReconBreakRaisedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpRepoReconBreakRaised requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §6.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpRepoReconBreakRaised",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpRepoReconBreakRaisedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 10. OdpRepoReconDisputeOpened
//
// Emitted when a repo-recon break escalates to a formal dispute with the
// counterparty or the Umoja portal operator. Mirrors OdpReconDisputeOpened
// from WS-ODP-PORTFOLIO-RECON.
//
// Authority:
//   urn:regulation:odp:cs-3-2018 §6 (dispute escalation)
// ---------------------------------------------------------------------------

export const odpRepoReconDisputeOpenedPayloadSchema = z.object({
  /** Correlation to the OdpRepoReconBreakRaised event. */
  breakId: z.string().min(1),

  /** Event-ID of the OdpRepoReconBreakRaised event this dispute relates to. */
  breakEventId: z.string().uuid(),

  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** UTI involved. */
  uti: z.string().max(52).optional(),

  /**
   * ISO 8601 timestamp when the dispute was formally opened.
   * The dispute clock starts here.
   */
  openedAt: z.string().min(1),

  /**
   * ISO 8601 resolution deadline (4 calendar-day approximation of 2 business days).
   * CS 3/2018 §6 deadline.
   */
  resolutionDeadline: z.string().min(1),

  /**
   * Identity of the person/agent who opened the dispute.
   * Per identity discipline: name + position on first mention.
   */
  openedBy: z.string().min(1),

  /** Free-form note on the dispute context. */
  note: z.string().optional(),
});

export type OdpRepoReconDisputeOpenedPayload = z.infer<
  typeof odpRepoReconDisputeOpenedPayloadSchema
>;

export function makeOdpRepoReconDisputeOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpRepoReconDisputeOpenedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpRepoReconDisputeOpened requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §6.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpRepoReconDisputeOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpRepoReconDisputeOpenedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 11. OdpRepoReconDisputeResolved
//
// Emitted when a repo-recon dispute is resolved or escalated to the CCO.
// Mirrors OdpReconDisputeResolved from WS-ODP-PORTFOLIO-RECON.
//
// Authority:
//   urn:regulation:odp:cs-3-2018 §6 (escalation to compliance officer)
// ---------------------------------------------------------------------------

const repoDisputeResolutionOutcomeSchema = z.enum([
  "resubmitted-accepted",  // Corrected report was submitted and accepted
  "repository-corrected",  // Umoja portal corrected the repository view
  "no-action-required",    // Investigation showed no actual mismatch
  "escalated-to-cco",      // Deadline breached; escalated to CCO (Zara)
]);
export type OdpRepoDisputeResolutionOutcome = z.infer<typeof repoDisputeResolutionOutcomeSchema>;

export const odpRepoReconDisputeResolvedPayloadSchema = z.object({
  /** Correlation to the OdpRepoReconBreakRaised event. */
  breakId: z.string().min(1),

  /** Event-ID of the OdpRepoReconDisputeOpened event this resolves. */
  disputeEventId: z.string().uuid(),

  /** Internal trade identifier. */
  tradeId: z.string().min(1),

  /** Resolution outcome. */
  outcome: repoDisputeResolutionOutcomeSchema,

  /**
   * ISO 8601 timestamp when the dispute was resolved.
   * Must be before the resolutionDeadline from OdpRepoReconDisputeOpened,
   * unless outcome === "escalated-to-cco".
   */
  resolvedAt: z.string().min(1),

  /**
   * Whether the resolution was within the CS 3/2018 §6 deadline.
   * `false` when escalated after deadline breach.
   */
  withinDeadline: z.boolean(),

  /**
   * When outcome === "escalated-to-cco": identity of the CCO escalated to.
   * CS 3/2018 §6 requires escalation to the compliance officer on deadline breach.
   */
  escalatedTo: z.string().optional(),

  /** Free-form resolution notes. */
  note: z.string().optional(),
});

export type OdpRepoReconDisputeResolvedPayload = z.infer<
  typeof odpRepoReconDisputeResolvedPayloadSchema
>;

export function makeOdpRepoReconDisputeResolved(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OdpRepoReconDisputeResolvedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "OdpRepoReconDisputeResolved requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003 and urn:regulation:odp:cs-3-2018 §6.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OdpRepoReconDisputeResolved",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: odpRepoReconDisputeResolvedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// 12. UmojaPortalTokenRefreshed
//
// Emitted when the OAuth2 client-credentials token is refreshed for the
// Umoja portal. No secret appears in the event payload — only the
// reference / expiry metadata (Principle 4: security designed in).
//
// Authority:
//   Principle 4 (security designed in)
//   ORG-ODP-RPT-003 (portal authentication obligation)
// ---------------------------------------------------------------------------

export const umojaPortalTokenRefreshedPayloadSchema = z.object({
  /**
   * ISO 8601 timestamp when the token was refreshed.
   */
  refreshedAt: z.string().min(1),

  /**
   * ISO 8601 expiry time of the new token.
   */
  expiresAt: z.string().min(1),

  /**
   * Token reference (opaque non-secret identifier — NOT the token itself).
   * Used for correlation in the audit trail. The actual token lives in
   * Azure Key Vault (Key Vault Managed HSM at M8).
   */
  tokenRef: z.string().min(1),

  /**
   * Whether this is a simulator token (build phase) or a live credential.
   */
  mode: z.enum(["simulator", "live"]),
});

export type UmojaPortalTokenRefreshedPayload = z.infer<
  typeof umojaPortalTokenRefreshedPayloadSchema
>;

export function makeUmojaPortalTokenRefreshed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: UmojaPortalTokenRefreshedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "UmojaPortalTokenRefreshed requires at least one citation (Principle 2). " +
        "Cite ORG-ODP-RPT-003.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "UmojaPortalTokenRefreshed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: umojaPortalTokenRefreshedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// Type registry
// ---------------------------------------------------------------------------

export const ODP_UMOJA_UTI_TYPED_EVENT_TYPES = [
  "TradeUtiAllocated",
  "OdpTradeReportPrepared",
  "OdpReportSubmissionAttempted",
  "OdpReportSubmissionAccepted",
  "OdpReportSubmissionRejected",
  "OdpReportAmendmentRequested",
  "OdpReportAmendmentSubmitted",
  "OdpRepoReconRun",
  "OdpRepoReconBreakRaised",
  "OdpRepoReconDisputeOpened",
  "OdpRepoReconDisputeResolved",
  "UmojaPortalTokenRefreshed",
] as const;

export type OdpUmojaUtiEventType = (typeof ODP_UMOJA_UTI_TYPED_EVENT_TYPES)[number];

// Re-export sub-types for consumers
export type { OdpRepoReconOutcome };
