// platform/risk/liquidity-limit-engine/gateway.ts
//
// WS-LIQUIDITY-LIMIT-ENGINE — gateway pre-flight helper.
//
// `checkLiquidityGate` is the API surface called by:
//   - the payment / trade gateway pre-flight (mirrors the credit-limit
//     gateway block at runtime/agents/kai-credit-capital-funding-check.ts).
//
// Block rule: if any tier-1 liquidity line is in red (PA minimum breached
// or hard-ceiling breached), the gateway rejects new outflow-creating
// transactions until the breach is disposed.
//
// Pure function: no event emission, no projection writes.
//
// Standing authority:
//   - D-RAS; LRM Policy v1 §9.1 (Critical breach blocks new flows);
//     brief:ravi:liquidity-limit-engine-mirroring-credit-limit-en:2026-05-21.
//
// Author: Ravi (Treasury and ALM engineer, engineering).

import { type DetectBreachesOpts, tierStatus } from "./breach-detector";

export type LiquidityGateBlockReason =
  | "Tier1LiquidityRed"
  | "Tier1IntradayBreach"
  | "Tier1ConcentrationBreach";

export interface LiquidityGateResult {
  ok: boolean;
  blockReason?: LiquidityGateBlockReason;
  /** Human-readable rejection message for the gateway audit trail. */
  message?: string;
  /** Lines that triggered the block, when any. */
  redLines: { line: string; current: number; threshold: number }[];
}

/**
 * Run the liquidity gate pre-flight. Pass-through args mirror
 * `detectBreaches` so callers can inject fixtures during tests + during
 * the build-phase when the upstream ALM substrate hasn't merged yet.
 */
export function checkLiquidityGate(opts: DetectBreachesOpts = {}): LiquidityGateResult {
  const status = tierStatus(opts);
  if (!status.tier1Red) {
    return { ok: true, redLines: [] };
  }

  const ratioRed = status.tier1RedLines.find(
    (l) => l.line === "lcr-ratio" || l.line === "nsfr-ratio",
  );
  const intradayRed = status.tier1RedLines.find((l) => l.line === "intraday-liquidity-buffer");
  const concentrationRed = status.tier1RedLines.find(
    (l) => l.line.startsWith("funding-concentration") || l.line === "hqla-concentration",
  );

  let blockReason: LiquidityGateBlockReason;
  let detail: string;
  if (ratioRed) {
    blockReason = "Tier1LiquidityRed";
    detail = `${ratioRed.line} current=${ratioRed.current} below tier-1 floor=${ratioRed.threshold}`;
  } else if (intradayRed) {
    blockReason = "Tier1IntradayBreach";
    detail = `intraday-liquidity-buffer current=${intradayRed.current} below tier-1 floor=${intradayRed.threshold}`;
  } else if (concentrationRed) {
    blockReason = "Tier1ConcentrationBreach";
    detail = `${concentrationRed.line} current=${concentrationRed.current} above tier-1 ceiling=${concentrationRed.threshold}`;
  } else {
    blockReason = "Tier1LiquidityRed";
    detail = `tier-1 line in red (lines=${status.tier1RedLines.map((l) => l.line).join(",")})`;
  }

  return {
    ok: false,
    blockReason,
    message: `Liquidity gate block: ${detail}. Authority: D-RAS; LRM Policy v1 §9.1 (PROC-RISK-LLM-01 Step 7 critical-breach handling).`,
    redLines: status.tier1RedLines.map((l) => ({
      line: l.line,
      current: l.current,
      threshold: l.threshold,
    })),
  };
}
