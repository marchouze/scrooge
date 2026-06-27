// platform/event-store/event-types/operating-income-statement.ts
//
// Born-V2 operating-income-statement snapshot — the SMA (Standardised
// Measurement Approach) Business Indicator income-statement components for the
// BA 400 (Operational Risk) capital return.
//
// ── WHY THIS EVENT EXISTS ──────────────────────────────────────────────────
// The BA 400 op-risk CAPITAL engine needs the bank's income-statement
// components to compute the Business Indicator (BI) under the SMA (OPE25 /
// Basel III SCO; SARB Reg 33 revised, BA 400 form rows R0050–R0440). Before
// this slice there was NO event stream feeding it — the legacy BIA/TSA engine
// (platform/reporting/ba-400-op-risk.ts) had a `OpRiskGrossIncomeRow[]` input
// with no producer, so op-capital folded to honest-0 and the BA 700 op-RWA leg
// was a hardcoded `operationalRwa: 0` placeholder (GAP-BA700-OPERATIONAL-RWA).
//
// This born-V2 event is the income-statement snapshot the SMA fold reads. Each
// snapshot carries the OPE25 income-statement line items — the same lines the
// current SARB BA 400 form (XSD element BA12000000+, rows R0050–R0180) demands —
// in decimal-native MoneyWire (MAJOR units; never minor-int).
//
// ── DOMAIN TRUTH — SMA, NOT BIA/TSA ─────────────────────────────────────────
// The CURRENT SARB BA 400 form is structured around the SMA: the Business
// Indicator Component (BIC), the three BI sub-components (ILDC / SC / FC), the
// Internal Loss Multiplier (ILM), and Operational Risk Capital / RWA including
// add-on (form rows R0350–R0500). The legacy BIA (α=15%) / TSA (β by business
// line) of bcbs128 §645–§654 is SUPERSEDED at the SARB transition (the engine's
// own forward-link flagged this). This event therefore carries SMA inputs, not
// per-business-line gross income. Authority: OPE25 / BCBS SCO; SARB Reg 33
// revised; SARB PA Directive D5/2025 §2.1.18 (BA 400); CRO op-risk methodology.
//
// ── ILDC CAP INPUT ──────────────────────────────────────────────────────────
// `interestEarningAssets` is carried because the ILDC component caps net
// interest income at 2.25% of interest-earning-assets (OPE25 §25.3 / form
// R0030–R0040). Without it the cap cannot be applied — a consistent-but-wrong
// BI would result.
//
// ── PROVENANCE ──────────────────────────────────────────────────────────────
// Build-phase snapshots are tagged `simulated` (scenario "op-risk-income-sim-v1")
// so the PRODUCTION BA 400 / BA 700 op-RWA read stays 0 pre-licence-day. Real
// audited income statements land at licence-day with a `production` tag.
//
// Authority:
//   - D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26)
//   - D-FX-V2-SIMULATOR-FIRST (the simulator-first principle this extends)
//   - D-CAPITAL-ASSET-CLASS-V1 (the BA 700 capital-ratio capstone this feeds)
//   - D-V1-REMOVAL-PHASE-1 (born-V2; never widen the v1-only estate)
//   - D-MONEY-DECIMAL-REDENOMINATION (decimal-native MoneyWire)
//   - OPE25 / BCBS SCO (SMA Business Indicator); SARB Reg 33 revised
//   - SARB PA Directive D5/2025 §2.1.18 (form BA 400)
//   - Principle 1 (events are truth); Principle 5 (currency at the type level)
//
// Author: Atlas (Core banking platform architect, engineering); op-risk
//   methodology owner Helena (Chief Risk Officer, governance).

import { z } from "zod";

import { moneyWireSchema } from "../../core/money-codec";
import { newEventId } from "../../core/types";
import { type Actor, type Event, type ProvenanceTag, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// OperatingIncomeStatementSnapshotted
//
// The OPE25 SMA Business Indicator income-statement components, as a 3-year-
// average snapshot (the SMA BI is the three-year average of its components —
// OPE25 §25.2). For the build-phase simulator-first rehearsal the snapshot
// carries the already-averaged figures directly (one snapshot = one BI input
// set); the per-year columns (BA 400 C0080–C0100 Year-3..Year-1) are a licence-
// day refinement when three real audited statements exist.
//
// Every monetary field is MoneyWire (decimal-native MAJOR units). All fields
// are the absolute income-statement magnitudes; the SMA fold applies the OPE25
// abs / max / cap arithmetic (it does NOT pre-net here — netting is the SMA
// engine's job, kept as the single derivation site).
// ---------------------------------------------------------------------------

export const operatingIncomeStatementSnapshottedPayloadSchema = z
  .object({
    /** Stable identifier — idempotency + supersession anchor. */
    snapshotId: z.string().min(1),
    /** ISO 8601 — the period-end the income statement covers. */
    periodEnd: z.string().min(1),
    /**
     * The averaging basis: how many fiscal years this snapshot's figures are the
     * average of (OPE25 §25.2 requires a 3-year average; build-phase rehearsal
     * may carry fewer with a tracked gap).
     */
    averagingYears: z.number().int().positive(),

    // ── Interest, Lease and Dividend Component (ILDC) inputs ────────────────
    /** Interest income (incl. finance/operational lease income). Form R0060. */
    interestIncome: moneyWireSchema,
    /** Interest expense (incl. finance/operational lease expense). Form R0080. */
    interestExpense: moneyWireSchema,
    /**
     * Interest-earning assets (incl. lease assets) — the base for the 2.25% NII
     * cap (OPE25 §25.3 / form R0030–R0040). Required for the ILDC cap.
     */
    interestEarningAssets: moneyWireSchema,
    /** Dividend income. Form R0110. */
    dividendIncome: moneyWireSchema,

    // ── Services Component (SC) inputs ──────────────────────────────────────
    /** Fee and commission income. Form R0120. */
    feeIncome: moneyWireSchema,
    /** Fee and commission expense. Form R0130. */
    feeExpense: moneyWireSchema,
    /** Other operating income. Form R0160. */
    otherOperatingIncome: moneyWireSchema,
    /** Other operating expense. Form R0180. */
    otherOperatingExpense: moneyWireSchema,

    // ── Financial Component (FC) inputs ─────────────────────────────────────
    /** Net profit/loss on the trading book (absolute value used). Form R0140. */
    netPnlTradingBook: moneyWireSchema,
    /** Net profit/loss on the banking (non-trading) book (abs). Form R0150. */
    netPnlBankingBook: moneyWireSchema,
  })
  .strict();

export type OperatingIncomeStatementSnapshottedPayload = z.infer<
  typeof operatingIncomeStatementSnapshottedPayloadSchema
>;

export function makeOperatingIncomeStatementSnapshotted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: OperatingIncomeStatementSnapshottedPayload;
  eventId?: string;
  provenance?: ProvenanceTag;
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "OperatingIncomeStatementSnapshotted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: operatingIncomeStatementSnapshottedPayloadSchema.parse(args.payload),
    ...(args.provenance !== undefined ? { provenance: args.provenance } : {}),
  });
}

export const OPERATING_INCOME_STATEMENT_TYPED_EVENT_TYPES = [
  "OperatingIncomeStatementSnapshotted",
] as const;
export type OperatingIncomeStatementEventType =
  (typeof OPERATING_INCOME_STATEMENT_TYPED_EVENT_TYPES)[number];
