// platform/event-store/event-types/regulatory-reporting.ts
//
// Regulatory reporting event-payload schemas.
//
// Covers:
//   - TradeReportSubmitted — confirmation that a trade report has been
//     submitted to a regulator (SARB-FinSurv for cross-border FX, or
//     DTCC-SAFE for OTC derivative reporting).
//
// Authority:
//   - D-FX-AD-STATUS (Authorised Dealer status; CEO-approved)
//   - EXCON-SARB-CIRC-3-2020 (FinSurv FX reporting obligations)
//   - D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//
// Authors: Mira (Compliance / RegTech engineer, engineering),
//          Anya (Data / analytics engineer, engineering)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// TradeReportSubmitted
//
// Emitted when a trade report has been submitted to a regulator. In the
// build phase, Mira's FinSurv stub emits status: "pending" on each
// FxTradeExecuted. At licence-day the actual submission pipeline replaces
// the stub and emits "accepted" / "rejected" based on regulator acknowledgement.
//
// Regulatory chain:
//   EXCON-SARB-CIRC-3-2020 → POL-EXCON-001 → PROC-FINSURV-REPORT-01
//   → TradeReportSubmitted
// ---------------------------------------------------------------------------

export const TradeReportSubmittedPayloadSchema = z.object({
  /** Internal trade identifier — links back to the originating FxTradeExecuted. */
  tradeId: z.string().min(1),
  /**
   * Regulatory body receiving the report.
   *   - "SARB-FinSurv" — South African Reserve Bank Financial Surveillance,
   *     mandatory for cross-border FX transactions per EXCON-SARB-CIRC-3-2020.
   *   - "DTCC-SAFE" — DTCC's OTC derivative trade repository, for future OTC
   *     reporting obligations.
   */
  regulator: z.enum(["SARB-FinSurv", "DTCC-SAFE"]),
  /** Report category / form code as recognised by the regulator (e.g. "FinSurv-FX-AD"). */
  reportCategory: z.string().min(1),
  /** ISO 8601 timestamp when the report was submitted. */
  submittedAt: z.string().min(1),
  /** Regulator-assigned reference number. Only present once accepted. */
  referenceNumber: z.string().optional(),
  /**
   * Submission status.
   *   - "pending"  — submitted but not yet acknowledged (build-phase stub).
   *   - "accepted" — regulator acknowledged acceptance.
   *   - "rejected" — regulator returned a rejection; remediation required.
   */
  status: z.enum(["pending", "accepted", "rejected"]),
  /**
   * FinSurv-specific transaction category (e.g. "ODP-001" for own-deal
   * payments). Optional — present only for SARB-FinSurv submissions.
   */
  finsurvCategory: z.string().optional(),
  /**
   * Principle 2 citations — at least one regulatory or policy URN required.
   * Build-phase: cite D-FX-AD-STATUS and EXCON-SARB-CIRC-3-2020.
   */
  citations: z.array(z.string()).min(1),
});

export type TradeReportSubmittedPayload = z.infer<typeof TradeReportSubmittedPayloadSchema>;

export function makeTradeReportSubmitted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TradeReportSubmittedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "TradeReportSubmitted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TradeReportSubmitted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: TradeReportSubmittedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// SarbSubmissionAttempted
//
// Emitted by the SARB portal simulator (`prototype/simulators/sarb-prudential.ts`)
// for every BA-return submission attempt (BA 110, BA 100, etc.).
// Records both successful and failed attempts for the audit trail.
//
// Regulatory chain:
//   Banks Act 94/1990 §70 + §73 → POL-REPORTING-001 → PROC-SARB-SUBMIT-01
//   → SarbSubmissionAttempted
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 5 (local portal simulator).
// Authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved 2026-05-10).
// Authors: Mira (Compliance / RegTech engineer, engineering)
//          + Atlas (Core banking platform architect, engineering — simulator harness)
// ---------------------------------------------------------------------------

export const SarbSubmissionAttemptedPayloadSchema = z.object({
  /** Identifier of the BA-return form (e.g. "BA325", "BA700"). */
  formId: z.string().min(1),
  /** Form version (e.g. "v0.1-rehearsal"). */
  formVersion: z.string().min(1),
  /** Institution identifier (entity short-id or BIC). */
  institutionId: z.string().min(1),
  /** Reporting period covered by the return (e.g. "period:hoz-bank:month:2026-05"). */
  reportingPeriod: z.string().min(1),
  /** ISO 8601 timestamp when the submission was attempted. */
  submittedAt: z.string().min(1),
  /** Whether the submission was accepted by the portal. */
  accepted: z.boolean(),
  /**
   * Regulator-assigned reference number on success.
   * Absent when `accepted === false`.
   */
  referenceNumber: z.string().optional(),
  /**
   * Validation errors returned by the portal on failure.
   * Absent when `accepted === true`.
   */
  errors: z.array(z.string()).optional(),
  /**
   * Submission mode: "simulator" (local test stub) or "live" (SARB production portal).
   * Build-phase default is "simulator" — no live submissions until licence-day.
   */
  mode: z.enum(["simulator", "live"]),
});

export type SarbSubmissionAttemptedPayload = z.infer<typeof SarbSubmissionAttemptedPayloadSchema>;

export function makeSarbSubmissionAttempted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: SarbSubmissionAttemptedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "SarbSubmissionAttempted requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "SarbSubmissionAttempted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: SarbSubmissionAttemptedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// RwaComputed
//
// Emitted at period close by the RWA-computed engine (W2 Slice 3 —
// platform/risk/rwa-computed-engine.ts). Carries the Pillar-1 RWA
// decomposition (credit + market + operational) that feeds the BA 700
// capital-adequacy return's RWA denominator under Principle 1.
//
// Provenance (Principle 1 + 2):
//   - creditRwaMinor    is event-sourced — Σ EAD × CRE20 standardised
//                        risk-weight over `readDebtExposures()` (the same
//                        events-first debt-exposure base BA 200 uses:
//                        BondTradeExecuted + InterbankLoanPlaced).
//   - marketRwaMinor    is event-sourced — 12.5 × BA 320 market-risk capital
//                        (the Reg 28(3)(a) maturity-ladder + disallowance
//                        algebra; folded from FxTradeExecuted / bond + IRS
//                        ladders by the BA 320 events adapter). No double-count:
//                        the engine takes the BA 320 `totalMarketRiskRwaMinor`
//                        directly (already × 12.5).
//   - operationalRwaMinor is an EXPLICIT placeholder — operational RWA via the
//                        BIA needs three years of audited gross income, which
//                        is gross-income-blocked until licence-day (no
//                        RevenueRecognitionEmitted feed pre-licence). Zero,
//                        flagged via `source`.
//
// The `source` discriminator makes the partial-real nature legible, e.g.
// "credit+market-event-sourced;op-placeholder-gross-income-blocked".
//
// Regulatory chain:
//   Banks Act 94/1990 §70 → Regulations Relating to Banks Reg 23 (credit) +
//   Reg 28 (market) + Reg 33 (operational) → BCBS CRE20 / MAR / OPE25 →
//   RwaComputed → BA 700 capital-adequacy denominator.
//
// Authority: D-RWA-ENGINE-W2-SLICE-3 (CEO session-delegation 2026-06-09);
//   D-REGULATORY-READINESS-W2-SLICE-3; D-REGULATORY-READINESS-GATE-PLAN.
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; BA-form line-mapping owner)
//   + Camille (Chief Financial Officer, governance — RWA-engine accountable).
// ---------------------------------------------------------------------------

export const RwaComputedPayloadSchema = z.object({
  /** Legal-entity short-id (`LE-ZA-HOZ-BANK`). Bank-licence-bound. */
  entityId: z.string().min(1),
  /** ISO 8601 — the as-of date the RWA is reported at (= period-end). */
  asOf: z.string().min(1),
  /** Period identifier (`period:hoz-bank:month:2026-05`). */
  periodId: z.string().min(1),
  /** ISO 4217 functional currency. */
  functionalCurrency: z.string().length(3),
  /** Credit RWA in minor units — Σ EAD × CRE20 weight (event-sourced). */
  creditRwaMinor: z.number().int().nonnegative(),
  /** Market RWA in minor units — 12.5 × BA 320 market-risk capital (event-sourced). */
  marketRwaMinor: z.number().int().nonnegative(),
  /** Operational RWA in minor units — explicit placeholder (gross-income-blocked). */
  operationalRwaMinor: z.number().int().nonnegative(),
  /** Total RWA = credit + market + operational. */
  totalRwaMinor: z.number().int().nonnegative(),
  /**
   * Source discriminator — makes the partial-real composition legible.
   * Canonical build-phase value:
   *   "credit+market-event-sourced;op-placeholder-gross-income-blocked"
   */
  source: z.string().min(1),
  /**
   * True iff `operationalRwaMinor` is a placeholder (zero / fixture) rather
   * than a real BIA gross-income computation. Build-phase: always true.
   */
  operationalRwaIsPlaceholder: z.boolean(),
  /**
   * Contributing source event_ids (BondTradeExecuted / InterbankLoanPlaced /
   * FxTradeExecuted / IRS / bond ladder events) for the chain-of-custody.
   */
  sourceEventIds: z.array(z.string()),
  /** Count of credit exposures folded into creditRwaMinor. */
  creditExposureCount: z.number().int().nonnegative(),
  /**
   * Principle 2 citations — at least one regulatory or policy URN required.
   */
  citations: z.array(z.string()).min(1),
});

export type RwaComputedPayload = z.infer<typeof RwaComputedPayloadSchema>;

export function makeRwaComputed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: RwaComputedPayload;
  eventId?: string;
}): Event {
  if (!args.citations || args.citations.length === 0) {
    throw new Error(
      "RwaComputed requires at least one citation (Principle 2). Use '[citation: TBC]' if the URN is not yet curated.",
    );
  }
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "RwaComputed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: RwaComputedPayloadSchema.parse(args.payload),
  });
}

// ---------------------------------------------------------------------------
// DECIMAL-MIGRATION: V2 MoneyWire payload types (slice 2)
//
// Authority: D-MONEY-DECIMAL-BUILD-PROCEED, D-MONEY-DECIMAL-REDENOMINATION.
// ---------------------------------------------------------------------------

import type { Money } from "../../core/decimal-money";
import type { MoneyWire } from "../../core/money-codec";
import { encodeMoney, moneyWireFromMinor } from "../../core/money-codec";

// ── RwaComputed V2 ───────────────────────────────────────────────────────────

/** @deprecated DECIMAL-MIGRATION: superseded by RwaComputedPayloadV2. */
export type RwaComputedPayloadLegacy = RwaComputedPayload;

export interface RwaComputedPayloadV2
  extends Omit<
    RwaComputedPayload,
    "creditRwaMinor" | "marketRwaMinor" | "operationalRwaMinor" | "totalRwaMinor"
  > {
  readonly creditRwa: MoneyWire;
  readonly marketRwa: MoneyWire;
  readonly operationalRwa: MoneyWire;
  readonly totalRwa: MoneyWire;
}

export function encodeRwaComputed(
  base: Omit<
    RwaComputedPayload,
    "creditRwaMinor" | "marketRwaMinor" | "operationalRwaMinor" | "totalRwaMinor"
  >,
  creditRwa: Money,
  marketRwa: Money,
  operationalRwa: Money,
  totalRwa: Money,
): RwaComputedPayloadV2 {
  return {
    ...base,
    creditRwa: encodeMoney(creditRwa),
    marketRwa: encodeMoney(marketRwa),
    operationalRwa: encodeMoney(operationalRwa),
    totalRwa: encodeMoney(totalRwa),
  };
}

export function decodeRwaComputed(raw: RwaComputedPayload): RwaComputedPayloadV2 {
  const { creditRwaMinor, marketRwaMinor, operationalRwaMinor, totalRwaMinor, ...rest } = raw;
  return {
    ...rest,
    creditRwa: moneyWireFromMinor(creditRwaMinor, "ZAR"),
    marketRwa: moneyWireFromMinor(marketRwaMinor, "ZAR"),
    operationalRwa: moneyWireFromMinor(operationalRwaMinor, "ZAR"),
    totalRwa: moneyWireFromMinor(totalRwaMinor, "ZAR"),
  };
}

export const REGULATORY_REPORTING_TYPED_EVENT_TYPES = [
  "TradeReportSubmitted",
  "SarbSubmissionAttempted",
  "RwaComputed",
] as const;
