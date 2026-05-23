// platform/lifecycle/trade-lifecycle-registry.ts
//
// Formal registry of trade lifecycle definitions — the canonical source of
// truth for which event opens a lifecycle, which events are in-flight, and
// which events close it (and on which path: normal, cancellation, failure,
// amendment).
//
// Design principle (established 2026-05-22 session):
//   - Every trade lifecycle has exactly one opening event type that creates
//     the lifecycle instance for a given tradeId.
//   - The lifecycle remains "open" until one of its terminal condition events
//     is observed. Once closed, no further events are expected or possible
//     for that instance.
//   - The accounting domain uses this registry to distinguish between:
//     (a) open lifecycles — partial accounting coverage is expected
//     (b) closed lifecycles — full accounting coverage is expected
//   This distinction prevents false-positive gaps in recon:gl-ledger-coverage.
//
// Non-trade lifecycles (period-close, book-level, provisions) are a separate
// concern and are not modelled here — those have their own trigger events
// registered directly in the PostingRuleRegistry.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION (CEO-approved).
// Author: Atlas (Core banking platform architect, engineering).

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LifecycleState = "open" | "closed";

export type TerminalPath = "normal" | "cancellation" | "failure" | "amendment";

export interface LifecycleTerminalCondition {
  /** Event type that closes this lifecycle. */
  eventType: string;
  /** Which path this terminal event represents. */
  path: TerminalPath;
  /** Human-readable description of this terminal state. */
  description: string;
}

export interface LifecycleDefinition {
  /** Stable identifier for this lifecycle. */
  lifecycleId: string;
  /** Product type this lifecycle belongs to (matches DCAM product family). */
  productType: string;
  /** The single event type that opens the lifecycle for a new instance. */
  openingEventType: string;
  /**
   * Dot-path into the opening event payload to extract the instance
   * identifier (e.g. "tradeId.value" resolves payload.tradeId.value).
   * For non-nested fields, use the field name directly (e.g. "tradeId").
   */
  instanceIdField: string;
  /** Event types that close the lifecycle, with their path classification. */
  terminalConditions: readonly LifecycleTerminalCondition[];
  /**
   * Event types expected between open and terminal — may appear zero or
   * more times. Used for completeness documentation and recon coverage
   * (in-flight events are checked but not mandated).
   */
  inFlightEventTypes: readonly string[];
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

export const TRADE_LIFECYCLE_REGISTRY: readonly LifecycleDefinition[] = [
  // ── FX Spot ──────────────────────────────────────────────────────────────
  {
    lifecycleId: "fx-spot-trade",
    productType: "FX_SPOT",
    openingEventType: "FxTradeExecuted",
    instanceIdField: "tradeId.value",
    terminalConditions: [
      {
        eventType: "SettlementConfirmed",
        path: "normal",
        description: "Full settlement confirmed by correspondent",
      },
      {
        eventType: "FxTradeCancelled",
        path: "cancellation",
        description: "Trade voided before settlement",
      },
      {
        eventType: "FxSettlementFailed",
        path: "failure",
        description: "Settlement failure — BCP path activated",
      },
    ],
    inFlightEventTypes: [
      "ConfirmationMatched",
      "ConfirmationMismatch",
      "FxSettlementInstructed",
      "FxPositionRevalued",
      "PrincipalPayment",
      "MissedExpectedReceipt",
      "SettlementFailureClassified",
      "TradeReportSubmitted",
    ],
  },

  // ── Bond ─────────────────────────────────────────────────────────────────
  {
    lifecycleId: "bond-trade",
    productType: "BOND",
    openingEventType: "BondTradeExecuted",
    instanceIdField: "tradeId",
    terminalConditions: [
      {
        eventType: "BondMatured",
        path: "normal",
        description: "Bond reached maturity and principal repaid",
      },
      {
        eventType: "BondSold",
        path: "normal",
        description: "Bond sold before maturity — derecognition",
      },
    ],
    inFlightEventTypes: ["BondInterestAccrued", "BondPositionRevalued"],
  },

  // ── Equity ───────────────────────────────────────────────────────────────
  {
    lifecycleId: "equity-trade",
    productType: "EQUITY",
    openingEventType: "EquityTradeExecuted",
    instanceIdField: "tradeId",
    terminalConditions: [
      {
        eventType: "EquitySettlementConfirmed",
        path: "normal",
        description: "Equity settlement confirmed — position established",
      },
    ],
    inFlightEventTypes: [
      "EquityTradeBooked",
      "EquitySettlementInstructed",
      "EquityPositionRevalued",
      "EquityCorporateActionApplied",
    ],
  },

  // ── IRD Swap ─────────────────────────────────────────────────────────────
  {
    lifecycleId: "ird-swap-trade",
    productType: "IRD_SWAP",
    openingEventType: "IrsTradeBooked",
    instanceIdField: "tradeId",
    terminalConditions: [
      {
        eventType: "IrsSwapTerminated",
        path: "normal",
        description: "Swap terminated — full derecognition",
      },
    ],
    inFlightEventTypes: [
      "IrsCouponScheduleGenerated",
      "IrsPositionRevalued",
      "IrsCouponPaymentInstructed",
      "IrsCouponSettlementConfirmed",
    ],
  },

  // ── Financial Instrument ─────────────────────────────────────────────────
  {
    lifecycleId: "financial-instrument-registration",
    productType: "INSTRUMENT",
    openingEventType: "FinancialInstrumentDefined",
    instanceIdField: "instrumentId",
    // No terminal condition yet — instruments are persistent register entries
    // without a natural close event. A future FinancialInstrumentRetired event
    // will be added when the retirement workflow is built.
    terminalConditions: [],
    inFlightEventTypes: [
      "FinancialInstrumentClassified",
      "FinancialInstrumentDecomposed",
      "FinancialInstrumentReconstituted",
    ],
  },
  {
    lifecycleId: "financial-instrument-decomposition",
    productType: "INSTRUMENT",
    openingEventType: "FinancialInstrumentDecomposed",
    instanceIdField: "parentInstrumentId",
    terminalConditions: [
      {
        eventType: "FinancialInstrumentReconstituted",
        path: "normal",
        description: "Strips reconstituted into parent bond",
      },
    ],
    inFlightEventTypes: [],
  },

  // ── Repo ─────────────────────────────────────────────────────────────────
  // Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION; IFRS 9 §3.1.1, §3.2.4.
  {
    lifecycleId: "repo-trade",
    productType: "REPO",
    openingEventType: "RepoTradeOpened",
    instanceIdField: "tradeId",
    terminalConditions: [
      {
        eventType: "RepoEndLegSettled",
        path: "normal",
        description: "End leg settled — bank repurchased collateral, lifecycle closed",
      },
      {
        eventType: "RepoTradeTerminatedEarly",
        path: "cancellation",
        description: "Repo unwound before end-leg date — cash returned at par",
      },
    ],
    inFlightEventTypes: ["RepoStartLegSettled", "RepoInterestAccrued", "RepoMarginCallIssued"],
  },

  // ── Money Market Deposit ─────────────────────────────────────────────────
  // Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION; IFRS 9 §4.1.1; BA 325.
  {
    lifecycleId: "mmd-deposit",
    productType: "MMD",
    openingEventType: "DepositTaken",
    instanceIdField: "depositId",
    terminalConditions: [
      {
        eventType: "DepositMatured",
        path: "normal",
        description: "Deposit matured at par — principal and interest repaid",
      },
      {
        eventType: "DepositWithdrawnEarly",
        path: "cancellation",
        description: "Depositor exercises early withdrawal — penalty may apply",
      },
    ],
    inFlightEventTypes: ["DepositRolledOver", "DepositInterestAccrued"],
  },

  // ── Funding Line ─────────────────────────────────────────────────────────
  // Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION; BA 325 Table 2.
  {
    lifecycleId: "funding-line",
    productType: "FUNDING-LINE",
    openingEventType: "FundingLineDrawn",
    instanceIdField: "fundingLineId",
    terminalConditions: [
      {
        eventType: "FundingLineRepaid",
        path: "normal",
        description: "Funding line drawdown fully repaid to facility provider",
      },
    ],
    inFlightEventTypes: [],
  },

  // ── Interbank Loan ───────────────────────────────────────────────────────
  // Authority: WS1-PR1a; D-MARKETS-SCHEMA-FOUNDATION; IFRS 9 §4.1.2; BA 325.
  {
    lifecycleId: "interbank-loan",
    productType: "IBL",
    openingEventType: "InterbankLoanPlaced",
    instanceIdField: "placementId",
    terminalConditions: [
      {
        eventType: "InterbankLoanMatured",
        path: "normal",
        description: "Loan matured — principal and interest received from counterparty",
      },
      {
        eventType: "InterbankLoanRecalledEarly",
        path: "cancellation",
        description: "Bank exercises early recall — principal returned at par",
      },
    ],
    inFlightEventTypes: ["InterbankLoanInterestAccrued"],
  },
];

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

/** Find the lifecycle definition for a given opening event type. */
export function findLifecycleByOpeningEvent(eventType: string): LifecycleDefinition | undefined {
  return TRADE_LIFECYCLE_REGISTRY.find((d) => d.openingEventType === eventType);
}

/** Find the lifecycle definition that owns a given event type (opening, in-flight, or terminal). */
export function findLifecycleForEventType(eventType: string): LifecycleDefinition | undefined {
  return TRADE_LIFECYCLE_REGISTRY.find(
    (d) =>
      d.openingEventType === eventType ||
      d.terminalConditions.some((t) => t.eventType === eventType) ||
      d.inFlightEventTypes.includes(eventType),
  );
}

/** Return the lifecycle stage for a given event type within a lifecycle definition. */
export function getLifecycleStage(
  eventType: string,
  def: LifecycleDefinition,
): "opening" | "in-flight" | "terminal" | undefined {
  if (def.openingEventType === eventType) return "opening";
  if (def.terminalConditions.some((t) => t.eventType === eventType)) return "terminal";
  if (def.inFlightEventTypes.includes(eventType)) return "in-flight";
  return undefined;
}
