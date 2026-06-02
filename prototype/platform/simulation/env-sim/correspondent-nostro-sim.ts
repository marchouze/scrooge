// platform/simulation/env-sim/correspondent-nostro-sim.ts
//
// CorrespondentNostroSimulator — stands in for the correspondent bank's intraday
// SWIFT reporting (and, in production, for Tomas's SWIFT connector that parses it).
//
// The bank is an indirect NPS participant: it holds a ZAR nostro account at a
// correspondent that makes payments on instruction and receives funds on its
// behalf. The bank learns of intraday nostro movements ONLY through the
// correspondent's SWIFT reporting. This simulator emits, on each intraday tick:
//
//   1. An MT942 Interim Transaction Report as an InboundMessageReceived event —
//      the correspondent reporting the entries posted to the nostro since the
//      last report (BCBS 248 intraday liquidity monitoring input).
//   2. A FundingDrawnDown event WHEN the running nostro balance falls below the
//      RAS intraday floor — the correspondent draws on the bank's funding line
//      to cover the shortfall. This is the connector's structured output that
//      the ALM intraday-stress pipeline consumes.
//   3. A paired SettlementInstructionIssued event for the repayment leg of (2):
//      drawing the correspondent intraday line creates a contractual obligation
//      to repay it. This is a non-trade contractual outflow (outside the
//      MMD/IBL/funding-line/trade stream) and is the ONLY path that puts
//      correspondent funding into the LCR 30-day denominator — buildSettlementOutflows
//      (Ravi, Treasury and ALM engineer) folds it; buildFundingPositions does not
//      see FundingDrawnDown, so there is no double-count. Authority: BA 325 §23.
//
// Build-phase vs production: in production Tomas's connector ingests real MT942
// messages and emits the same FundingDrawnDown + SettlementInstructionIssued
// events. Swapping the simulator for the real connector does not change the
// downstream pipeline (production seam). Provenance: emitted events are untagged
// → treated as `simulated` by the projection-runtime provenance filter
// (build-phase posture).
//
// Authority: D-FX-CLS-MEMBERSHIP; BCBS 248 (intraday liquidity monitoring);
//   Banks Act 94 of 1990 Reg 26; BA 325 §23 (LCR contractual outflows).
// Author: Tomas (Operations & payments engineer, engineering)

import { newEventId, nowUtc } from "../../core/types";
import { makeFundingDrawnDown } from "../../event-store/event-types/ifrs-accounting-extended";
import { makeInboundMessageReceived } from "../../event-store/event-types/payments";
import { makeSettlementInstructionIssued } from "../../event-store/event-types/settlement";
import type { EventStore } from "../../event-store/store";
import { type Mt942Entry, generateMt942 } from "../../payments/swift-mt/mt942";
import type { SimConfigField, SimFireAction, SimStatus, SimulatorModule } from "../hub/types";

const SIM_ID = "correspondent-nostro-sim";
const ACTOR = { type: "service" as const, id: "agent:env:correspondent-nostro-sim" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-FX-CLS-MEMBERSHIP", "BCBS-248"];
/** Repayment-leg citations — adds the LCR contractual-outflow authority (BA 325 §23 / Reg 26). */
const REPAYMENT_CITATIONS = ["D-FX-CLS-MEMBERSHIP", "BCBS-248", "BANKS-REG-26"];
const CORRESPONDENT_BIC = "SBZAZAJJXXX";
const NOSTRO_IBAN = "ZA00BANK0000000000000";
const NOSTRO_CURRENCY = "ZAR";
const BANK_BIC = "BANKZAJJXXX";

/** RAS intraday liquidity floor (ZAR minor) — mirror of INTRADAY_FLOOR_ZAR (50m) in minor units. */
const INTRADAY_FLOOR_MINOR = 50_000_000_00n;

/** Funding facility the correspondent draws on to cover an intraday shortfall. */
const FUNDING_FACILITY_ID = "CORRESPONDENT-INTRADAY-LINE";

export interface CorrespondentNostroSimDeps {
  readonly store: EventStore;
  /** Seeded PRNG in [0, 1) — deterministic, no wall-clock / Math.random. */
  readonly rng: () => number;
  readonly intervalMs: number;
  /** Opening nostro balance (ZAR minor). Default ~R80m so the floor is reachable under stress. */
  readonly openingBalanceMinor?: bigint;
}

export interface CorrespondentNostroTickResult {
  /** MT942 message id emitted this tick. */
  readonly messageId: string;
  /** Running nostro balance after this tick (ZAR minor). */
  readonly balanceAfterMinor: bigint;
  /** True when a FundingDrawnDown was emitted (balance breached the floor). */
  readonly fundingDrawn: boolean;
  /** Drawdown amount (ZAR minor), 0 when no draw. */
  readonly drawnAmountMinor: bigint;
}

export class CorrespondentNostroSimulator implements SimulatorModule {
  readonly id = SIM_ID;
  readonly label = "Correspondent Bank — Intraday Nostro (MT942)";
  readonly domain = "payments" as const;
  readonly description =
    "Stands in for the correspondent bank's intraday SWIFT reporting (and Tomas's production SWIFT connector). Each tick emits an MT942 Interim Transaction Report as InboundMessageReceived and tracks the running ZAR nostro balance; when the balance breaches the RAS intraday floor it emits FundingDrawnDown (the correspondent draws on the bank's intraday line). Feeds BCBS 248 intraday-stress monitoring.";
  readonly mode = "loop+fire" as const;

  readonly configSchema: readonly SimConfigField[] = [
    {
      key: "interval_ms",
      label: "Interim-report interval (ms)",
      type: "number",
      default: 60000,
      min: 1000,
      max: 3600000,
      help: "Milliseconds between MT942 interim transaction reports.",
    },
  ];

  readonly fireActions: readonly SimFireAction[] = [
    { id: "tick", label: "Emit interim report now" },
  ];

  readonly eventActorIds: readonly string[] = [ACTOR.id];

  private readonly store: EventStore;
  private readonly rng: () => number;
  private intervalMs: number;
  private balanceMinor: bigint;
  private statementSeq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private startedAt: string | null = null;
  private lastError: string | null = null;

  constructor(deps: CorrespondentNostroSimDeps) {
    this.store = deps.store;
    this.rng = deps.rng;
    this.intervalMs = deps.intervalMs;
    this.balanceMinor = deps.openingBalanceMinor ?? 80_000_000_00n;
  }

  start(config?: Record<string, unknown>): void {
    if (config && typeof config.interval_ms === "number" && config.interval_ms > 0) {
      this.intervalMs = config.interval_ms;
    }
    if (this.running) return;
    this.running = true;
    this.startedAt = nowUtc();
    this.timer = setInterval(() => {
      this.tick();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  isRunning(): boolean {
    return this.running;
  }

  async fire(
    actionId: string,
    _args?: Record<string, unknown>,
  ): Promise<{ ok: boolean; detail?: unknown }> {
    if (actionId !== "tick") return { ok: false, detail: `unknown action '${actionId}'` };
    try {
      const r = this.tick();
      return { ok: true, detail: r };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : String(err);
      return { ok: false, detail: this.lastError };
    }
  }

  getStatus(): SimStatus {
    return {
      id: this.id,
      running: this.running,
      // Event-derived by the hub via eventActorIds (Principle 1).
      eventsEmitted: 0,
      lastEventAt: null,
      lastEventType: null,
      lastError: this.lastError,
      startedAt: this.startedAt,
      extra: {
        interval_ms: this.intervalMs,
        balanceZar: Number(this.balanceMinor) / 100,
      },
    };
  }

  /**
   * Emit one intraday MT942 report and, if the resulting balance breaches the
   * intraday floor, a FundingDrawnDown. Returns the tick result. Public so a
   * cadence runner (or a test) can drive a single deterministic tick.
   */
  tick(): CorrespondentNostroTickResult {
    const now = nowUtc();
    const reportDateTime = new Date(now); // derived from nowUtc() — no direct wall-clock read
    this.statementSeq += 1;

    // Derive intraday entries from settled trades observed since boot, plus a
    // seeded payment-outflow draw so the floor is reachable under stress. Each
    // settled trade is a credit (receive leg); the outflow models instructed
    // payments the correspondent debited.
    const entries: Mt942Entry[] = [];

    let settledCount = 0;
    try {
      for (const evt of this.store.replay({ type: "SettlementConfirmed" })) {
        const p = evt.payload as { tradeId?: unknown };
        const tradeId = typeof p.tradeId === "string" ? p.tradeId : `SIM-${settledCount}`;
        // One credit per settled trade (simulated receive amount).
        entries.push({
          valueDate: reportDateTime,
          creditDebitMark: "C",
          amountMinor: 5_000_000_00n, // R5m simulated receive
          currency: NOSTRO_CURRENCY,
          transactionTypeCode: "FXCF",
          customerReference: tradeId.slice(0, 16),
          narrative: `FX receive leg — trade ${tradeId}`,
        });
        settledCount += 1;
        if (settledCount >= 5) break; // cap entries per interim report
      }
    } catch {
      // replay unavailable in some test mocks — emit a balance-only report.
    }

    // Seeded intraday outflow (instructed payments the correspondent debited):
    // R10m–R60m. Modelled as a single debit entry.
    const outflowMinor = BigInt(10 + Math.floor(this.rng() * 50)) * 1_000_000_00n;
    entries.push({
      valueDate: reportDateTime,
      creditDebitMark: "D",
      amountMinor: outflowMinor,
      currency: NOSTRO_CURRENCY,
      transactionTypeCode: "NTRF",
      customerReference: `PMT-${newEventId().slice(0, 8)}`,
      narrative: "Instructed payment debit",
    });

    const openingBalance = this.balanceMinor;
    const mt942 = generateMt942({
      accountId: NOSTRO_IBAN,
      correspondentBic: CORRESPONDENT_BIC,
      reportDateTime,
      floorLimitMinor: INTRADAY_FLOOR_MINOR,
      entries,
      currency: NOSTRO_CURRENCY,
      statementNumber: 1,
      sequenceNumber: this.statementSeq,
      receiverBic: BANK_BIC,
    });

    // Update running balance: opening + credits − debits.
    this.balanceMinor = openingBalance + mt942.creditSumMinor - mt942.debitSumMinor;

    const messageId = `MT942-${reportDateTime.toISOString().slice(0, 10)}-${newEventId().slice(-8)}`;
    this.store.append(
      makeInboundMessageReceived({
        asOf: now,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          tradeId: "NOSTRO-INTRADAY",
          messageId,
          messageStandard: "MT942",
          direction: "inbound",
          serialisedMessage: mt942.serialised,
          senderBic: CORRESPONDENT_BIC,
          receivedAt: now,
          citations: CITATIONS,
        },
      }),
    );

    // Floor breach → the correspondent draws on the bank's intraday funding line
    // to bring the nostro back to the floor. Emit FundingDrawnDown (the connector's
    // structured output the ALM intraday-stress pipeline consumes).
    let fundingDrawn = false;
    let drawnAmountMinor = 0n;
    if (this.balanceMinor < INTRADAY_FLOOR_MINOR) {
      drawnAmountMinor = INTRADAY_FLOOR_MINOR - this.balanceMinor;
      const drawdownId = `DRAW-${newEventId().slice(0, 12)}`;
      this.store.append(
        makeFundingDrawnDown({
          asOf: now,
          entity: ENTITY,
          actor: ACTOR,
          citations: CITATIONS,
          payload: {
            drawdownId,
            facilityId: FUNDING_FACILITY_ID,
            // amount is a major-unit number on this schema (minor→major).
            amount: Number(drawnAmountMinor) / 100,
            currency: NOSTRO_CURRENCY,
            drawnAt: now,
            ftpAttributionRequired: true,
          },
        }),
      );

      // Repayment leg — drawing the intraday line creates a contractual
      // obligation to repay it the next settlement day. Emitted as a non-trade
      // SettlementInstructionIssued so it lands in the LCR 30-day contractual-
      // outflow denominator (BA 325 §23) via buildSettlementOutflows. Settlement
      // date is derived from the drawdown date + 1 calendar day — never a direct
      // wall-clock read (nowUtc()-derived only). outflowAmountZar is in MINOR
      // units (cents); the projection divides by 100. drawnAmountMinor is already
      // minor, so we use it directly (NOT the major-unit FundingDrawnDown.amount).
      const repaymentDate = new Date(reportDateTime);
      repaymentDate.setUTCDate(repaymentDate.getUTCDate() + 1);
      this.store.append(
        makeSettlementInstructionIssued({
          asOf: now,
          entity: ENTITY,
          actor: ACTOR,
          citations: REPAYMENT_CITATIONS,
          payload: {
            settlementInstructionId: `SI-REPAY-${drawdownId}`,
            settlementDate: repaymentDate.toISOString(),
            outflowAmountZar: Number(drawnAmountMinor),
            counterpartyId: CORRESPONDENT_BIC,
            description: `Repayment of correspondent intraday funding drawdown ${drawdownId} on facility ${FUNDING_FACILITY_ID}`,
          },
        }),
      );

      this.balanceMinor += drawnAmountMinor; // line draw restores the floor
      fundingDrawn = true;
    }

    return {
      messageId,
      balanceAfterMinor: this.balanceMinor,
      fundingDrawn,
      drawnAmountMinor,
    };
  }
}
