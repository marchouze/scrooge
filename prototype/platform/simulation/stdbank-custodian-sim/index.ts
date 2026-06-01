// platform/simulation/stdbank-custodian-sim/index.ts
//
// Standard Bank Bond Custodian Simulator — 3rd-party simulator module.
//
// Models Standard Bank's role as the bank's STRATE custodian for JSE bond
// settlement. The bank is not a CSDP; Standard Bank handles DvP settlement
// instructions on the bank's behalf.
//
// On an `instruct` fire action:
//   1. Validates the instruction args.
//   2. After `settlement_delay_ms` (default 300ms, representing compressed T+3),
//      emits BondCustodianSettlementConfirmed with a generated custodianRef.
//   3. If failure_rate_pct > 0 and the hash of settlementId falls in the fail
//      bucket, emits BondCustodianSettlementFailed instead.
//
// `force_fail` immediately emits BondCustodianSettlementFailed for a given
// settlementId without waiting for the delay.
//
// Authority:
//   D-NPA-SAGB-BOND-INTERNAL-TEST (CEO-approved 2026-05-26)
//   D-MARKETS-SCHEMA-FOUNDATION
//
// Author: Devon (Chief Operating Officer, engineering)

import { createHash } from "node:crypto";

import { nowUtc } from "../../core/types";
import {
  makeBondCustodianSettlementConfirmed,
  makeBondCustodianSettlementFailed,
} from "../../event-store/event-types/bond-settlement";
import type { EventStore } from "../../event-store/store";
import { hubSimulatedTag } from "../hub/types";
import type { SimConfigField, SimFireAction, SimStatus, SimulatorModule } from "../hub/types";

const SIM_ID = "stdbank-custodian-sim";
const SIM_ACTOR_ID = `third-party-sim-hub:${SIM_ID}`;
const CITATIONS = ["D-NPA-SAGB-BOND-INTERNAL-TEST", "D-TRADE-LIFECYCLE-IFRS-CHAIN"] as const;

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

interface Config {
  settlement_delay_ms: number;
  failure_rate_pct: number;
}

const DEFAULT_CONFIG: Config = {
  settlement_delay_ms: 300,
  failure_rate_pct: 0,
};

// ---------------------------------------------------------------------------
// Deterministic hash-based bucket (same orderId → same outcome; reproducible)
// ---------------------------------------------------------------------------

function shouldFail(settlementId: string, failureRatePct: number): boolean {
  if (failureRatePct <= 0) return false;
  if (failureRatePct >= 100) return true;
  const hash = createHash("sha256").update(settlementId).digest("hex");
  const bucket = Number.parseInt(hash.slice(0, 8), 16) % 100;
  return bucket < failureRatePct;
}

// ---------------------------------------------------------------------------
// Module implementation
// ---------------------------------------------------------------------------

interface InstructArgs {
  settlementId: string;
  tradeId: string;
  isin: string;
  side: "buy" | "sell";
  nominalMinor: number;
  dirtyConsiderationZarMinor: number;
  settlementDate: string;
}

export class StdbankCustodianSim implements SimulatorModule {
  readonly id = SIM_ID;
  readonly label = "Standard Bank — Bond Custodian (STRATE)";
  readonly domain = "custodian" as const;
  readonly description =
    "Simulates Standard Bank acting as STRATE custodian for the bank's JSE bond trades. On instruction, settles securities and cash legs and emits BondCustodianSettlementConfirmed after the configured delay. Replaces real STRATE DvP confirmation during build-phase internal testing (D-NPA-SAGB-BOND-INTERNAL-TEST).";
  readonly mode = "fire" as const;

  readonly configSchema: readonly SimConfigField[] = [
    {
      key: "settlement_delay_ms",
      label: "Settlement delay (ms)",
      type: "number",
      default: 300,
      min: 0,
      max: 30000,
      help: "Milliseconds before custodian confirmation fires (simulates T+3 compressed).",
    },
    {
      key: "failure_rate_pct",
      label: "Failure rate (%)",
      type: "number",
      default: 0,
      min: 0,
      max: 100,
      help: "Percentage of instructions that fail (deterministic by settlementId hash).",
    },
  ];

  readonly fireActions: readonly SimFireAction[] = [
    {
      id: "instruct",
      label: "Instruct settlement",
      argsSchema: [
        { key: "settlementId", label: "Settlement ID", type: "text", default: "" },
        { key: "tradeId", label: "Trade ID", type: "text", default: "" },
        { key: "isin", label: "ISIN", type: "text", default: "" },
        {
          key: "side",
          label: "Side",
          type: "select",
          default: "buy",
          options: ["buy", "sell"],
        },
        { key: "nominalMinor", label: "Nominal (minor units)", type: "number", default: 0 },
        {
          key: "dirtyConsiderationZarMinor",
          label: "Dirty consideration ZAR (minor)",
          type: "number",
          default: 0,
        },
        { key: "settlementDate", label: "Settlement date (YYYY-MM-DD)", type: "text", default: "" },
      ],
    },
    {
      id: "force_fail",
      label: "Force settlement failure",
      argsSchema: [
        { key: "settlementId", label: "Settlement ID", type: "text", default: "" },
        { key: "reason", label: "Fail reason", type: "text", default: "forced-fail" },
      ],
    },
  ];

  readonly eventActorIds: readonly string[] = [SIM_ACTOR_ID];

  private readonly eventStore: EventStore;
  private config: Config = { ...DEFAULT_CONFIG };
  private running = false;
  private startedAt: string | null = null;
  private lastError: string | null = null;

  constructor(eventStore: EventStore) {
    this.eventStore = eventStore;
  }

  start(config?: Record<string, unknown>): void {
    if (config) {
      this.config = {
        settlement_delay_ms:
          typeof config.settlement_delay_ms === "number"
            ? config.settlement_delay_ms
            : DEFAULT_CONFIG.settlement_delay_ms,
        failure_rate_pct:
          typeof config.failure_rate_pct === "number"
            ? config.failure_rate_pct
            : DEFAULT_CONFIG.failure_rate_pct,
      };
    }
    this.running = true;
    this.startedAt = nowUtc();
  }

  stop(): void {
    this.running = false;
  }

  isRunning(): boolean {
    return this.running;
  }

  async fire(
    actionId: string,
    args?: Record<string, unknown>,
  ): Promise<{ ok: boolean; detail?: unknown }> {
    try {
      if (actionId === "instruct") {
        return await this.handleInstruct(args ?? {});
      }
      if (actionId === "force_fail") {
        return this.handleForceFail(args ?? {});
      }
      return { ok: false, detail: `unknown action '${actionId}'` };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      return { ok: false, detail: msg };
    }
  }

  getStatus(): SimStatus {
    return {
      id: this.id,
      running: this.running,
      eventsEmitted: 0,
      lastEventAt: null,
      lastEventType: null,
      lastError: this.lastError,
      startedAt: this.startedAt,
      extra: {
        settlement_delay_ms: this.config.settlement_delay_ms,
        failure_rate_pct: this.config.failure_rate_pct,
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Internal handlers
  // ---------------------------------------------------------------------------

  private async handleInstruct(
    args: Record<string, unknown>,
  ): Promise<{ ok: boolean; detail?: unknown }> {
    const ia = this.validateInstructArgs(args);

    const willFail = shouldFail(ia.settlementId, this.config.failure_rate_pct);
    const delayMs = this.config.settlement_delay_ms;

    // Fire asynchronously after delay — don't block the caller.
    setTimeout(() => {
      try {
        if (willFail) {
          this.emitFailed(ia.settlementId, ia.tradeId, "STRATE-FAIL: simulated settlement failure");
        } else {
          this.emitConfirmed(ia);
        }
      } catch (err) {
        this.lastError = err instanceof Error ? err.message : String(err);
      }
    }, delayMs);

    return {
      ok: true,
      detail: {
        settlementId: ia.settlementId,
        willFail,
        expectedDelayMs: delayMs,
      },
    };
  }

  private handleForceFail(args: Record<string, unknown>): { ok: boolean; detail?: unknown } {
    const settlementId = typeof args.settlementId === "string" ? args.settlementId.trim() : "";
    if (!settlementId) return { ok: false, detail: "settlementId is required" };
    const reason =
      typeof args.reason === "string" && args.reason.trim() ? args.reason.trim() : "forced-fail";

    try {
      this.emitFailed(settlementId, "", reason);
      return { ok: true, detail: { settlementId, reason } };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.lastError = msg;
      return { ok: false, detail: msg };
    }
  }

  private emitConfirmed(ia: InstructArgs): void {
    const asOf = nowUtc();
    const custodianRef = `SB-STR-${ia.settlementId.slice(-8).toUpperCase()}`;
    const event = makeBondCustodianSettlementConfirmed({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "system", id: SIM_ACTOR_ID },
      citations: [...CITATIONS],
      payload: {
        settlementId: ia.settlementId,
        tradeId: ia.tradeId,
        custodianRef,
        securitiesLegStatus: "delivered",
        cashLegZarMinor: ia.dirtyConsiderationZarMinor,
        confirmedAt: asOf,
      },
    });
    (event as Record<string, unknown>).provenance = hubSimulatedTag(
      SIM_ID,
      "stdbank-custodian-settlement",
    );
    this.eventStore.append(event);
  }

  private emitFailed(settlementId: string, tradeId: string, failReason: string): void {
    const asOf = nowUtc();
    const event = makeBondCustodianSettlementFailed({
      asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: { type: "system", id: SIM_ACTOR_ID },
      citations: [...CITATIONS],
      payload: {
        settlementId,
        tradeId,
        failReason,
        failedAt: asOf,
      },
    });
    (event as Record<string, unknown>).provenance = hubSimulatedTag(
      SIM_ID,
      "stdbank-custodian-settlement",
    );
    this.eventStore.append(event);
  }

  private validateInstructArgs(args: Record<string, unknown>): InstructArgs {
    const settlementId = typeof args.settlementId === "string" ? args.settlementId.trim() : "";
    if (!settlementId) throw new Error("settlementId is required");

    const tradeId = typeof args.tradeId === "string" ? args.tradeId.trim() : "";
    if (!tradeId) throw new Error("tradeId is required");

    const isin = typeof args.isin === "string" ? args.isin.trim() : "";
    if (!isin) throw new Error("isin is required");

    const side = args.side === "buy" || args.side === "sell" ? args.side : null;
    if (!side) throw new Error("side must be 'buy' or 'sell'");

    const nominalMinor =
      typeof args.nominalMinor === "number" ? args.nominalMinor : Number(args.nominalMinor);
    if (!Number.isFinite(nominalMinor) || nominalMinor <= 0)
      throw new Error("nominalMinor must be a positive number");

    const dirtyConsiderationZarMinor =
      typeof args.dirtyConsiderationZarMinor === "number"
        ? args.dirtyConsiderationZarMinor
        : Number(args.dirtyConsiderationZarMinor);
    if (!Number.isFinite(dirtyConsiderationZarMinor) || dirtyConsiderationZarMinor <= 0)
      throw new Error("dirtyConsiderationZarMinor must be a positive number");

    const settlementDate =
      typeof args.settlementDate === "string" ? args.settlementDate.trim() : "";
    if (!settlementDate) throw new Error("settlementDate is required");

    return {
      settlementId,
      tradeId,
      isin,
      side,
      nominalMinor,
      dirtyConsiderationZarMinor,
      settlementDate,
    };
  }
}
