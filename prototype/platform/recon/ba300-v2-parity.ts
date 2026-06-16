// platform/recon/ba300-v2-parity.ts
//
// recon:ba300-v2-parity — ADVISORY gate (Phase 3b).
//
// Asserts that the BA-300 LCR DENOMINATOR (net cash outflows) computed from the
// V1 money-market lifecycle events agrees with the same denominator computed
// from the V2-parallel money-market lifecycle events (DepositTakenV2,
// FundingLineDrawnV2, RepoTradeOpenedV2, InterbankLoanPlacedV2 families).
//
// V1 path: getALMPositionSnapshot() folds the V1 deposit/funding/repo/IBL events
//          into typed fundingPositions → computeLCR → netCashOutflows.
//          (Wired via `computeLcrDenominatorFromAlmSnapshot` in ba-300-lcr.ts —
//          the single-source denominator the brief asks for.)
// V2 path: fold the V2-parallel lifecycle events (MoneyWire decimal-native,
//          currency-carrying) into the SAME FundingPosition shape → computeLCR.
//
// ADVISORY at Phase 3b (Charter cmd 3 — no green by concealment, but a parallel
// shadow that has no V2 events yet is correctly a PASS, not a fail): the gate
// returns ok:true and WARNS on any denominator gap. It hardens to enforcing when
// the V2 money-market path is the authoritative source (a later phase + Decision).
//
// CURRENCY-AGNOSTIC: both paths value in the entity's functional currency via
// the ALM snapshot's own currency-carrying positions; the V2 fold reads each
// MoneyWire's own currency — no hardcoded ZAR (WS-MULTI-BASE-CURRENCY).
//
// Authority: D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            brief:atlas:v1-removal-phase-3b-alm-liquidity-on-v2-money-ma:2026-06-16.
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import type {
  DepositTakenV2Payload,
  FundingLineDrawnV2Payload,
  InterbankLoanMaturedV2Payload,
  InterbankLoanPlacedV2Payload,
  InterbankLoanRecalledEarlyV2Payload,
} from "../event-store/event-types/repo-mmd-ibl-v2";
import { EVENT_TYPE_REGISTRY } from "../event-store/registry/index";
import type { EventStore } from "../event-store/store";
import { type FundingPosition, type HQLAPosition, computeLCR } from "../liquidity/lcr";
import { computeLcrDenominatorFromAlmSnapshot } from "../reporting/ba-300-lcr";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";
import { runParityCheck } from "./v1-v2-parity-harness";

const PIPELINE = "ba300-v2-parity";

const ANCHOR_ENTITY = "LE-ZA-HOZ-BANK";
// Broad as-of so the build-phase population is captured.
const AS_OF = "2099-12-31";
const HORIZON_DAYS = 30;

/** The 14 V2-parallel money-market lifecycle event types this gate watches. */
const V2_MM_EVENT_TYPES = [
  "RepoTradeOpenedV2",
  "RepoTradeTerminatedV2",
  "RepoTradeTerminatedEarlyV2",
  "DepositTakenV2",
  "DepositInterestAccruedV2",
  "DepositMaturedV2",
  "DepositWithdrawnEarlyV2",
  "DepositRolledOverV2",
  "FundingLineDrawnV2",
  "FundingLineRepaidV2",
  "InterbankLoanPlacedV2",
  "InterbankLoanInterestAccruedV2",
  "InterbankLoanMaturedV2",
  "InterbankLoanRecalledEarlyV2",
] as const;

/**
 * MoneyWire amount (canonical major-unit decimal string) → JS number, to match
 * the V1 ALM projection's `FundingPosition.amountZar` (which is intrinsically a
 * JS number — `computeLCR` operates on number amounts). This is a string→number
 * parse, NOT money arithmetic, so the no-float-money discipline (which targets
 * `Money` multiply/divide) does not apply.
 */
function moneyWireToNumber(wire: { amount: string }): number {
  return Number(wire.amount);
}

/**
 * Fold the V2-parallel money-market lifecycle events into the SAME
 * FundingPosition shape the V1 ALM projection produces, then run the canonical
 * `computeLCR` to get the V2 net-cash-outflow denominator. Mirrors
 * `buildFundingPositions` in alm-positions.ts (V1) but reads V2 MoneyWire
 * (major-unit) amounts instead of V1 minor-unit integers.
 */
function v2LcrDenominator(store: EventStore, asOf: string, entity: string): number {
  const positions: FundingPosition[] = [];

  // Deposits — live only (exclude matured / withdrawn-early).
  const closedDeposits = new Set<string>();
  for (const e of store.replay({ type: "DepositMaturedV2", entity, asOf })) {
    closedDeposits.add((e.payload as { depositId: string }).depositId);
  }
  for (const e of store.replay({ type: "DepositWithdrawnEarlyV2", entity, asOf })) {
    closedDeposits.add((e.payload as { depositId: string }).depositId);
  }
  for (const e of store.replay({ type: "DepositTakenV2", entity, asOf })) {
    const p = e.payload as DepositTakenV2Payload;
    if (closedDeposits.has(p.depositId)) continue;
    const amountZar = moneyWireToNumber(p.principal);
    if (amountZar <= 0) continue;
    positions.push({ amountZar, category: p.depositCategory });
  }

  // Funding lines — live only (exclude repaid). Wholesale non-operational (100%).
  const repaidLines = new Set<string>();
  for (const e of store.replay({ type: "FundingLineRepaidV2", entity, asOf })) {
    repaidLines.add((e.payload as { fundingLineId: string }).fundingLineId);
  }
  for (const e of store.replay({ type: "FundingLineDrawnV2", entity, asOf })) {
    const p = e.payload as FundingLineDrawnV2Payload;
    if (repaidLines.has(p.fundingLineId)) continue;
    const amountZar = moneyWireToNumber(p.drawnAmount);
    if (amountZar <= 0) continue;
    positions.push({ amountZar, category: "wholesale-non-operational" });
  }

  // Interbank placements — live only (exclude matured / recalled). Inflow-contractual.
  const closedIbl = new Set<string>();
  for (const e of store.replay({ type: "InterbankLoanMaturedV2", entity, asOf })) {
    closedIbl.add((e.payload as InterbankLoanMaturedV2Payload).placementId);
  }
  for (const e of store.replay({ type: "InterbankLoanRecalledEarlyV2", entity, asOf })) {
    closedIbl.add((e.payload as InterbankLoanRecalledEarlyV2Payload).placementId);
  }
  for (const e of store.replay({ type: "InterbankLoanPlacedV2", entity, asOf })) {
    const p = e.payload as InterbankLoanPlacedV2Payload;
    if (closedIbl.has(p.placementId)) continue;
    const amountZar = moneyWireToNumber(p.principal);
    if (amountZar <= 0) continue;
    positions.push({ amountZar, category: "inflow-contractual" });
  }

  // HQLA numerator is not part of the denominator comparison; pass empty so the
  // computeLCR denominator (net cash outflows) is isolated.
  const hqla: HQLAPosition[] = [];
  return computeLCR(hqla, positions).netCashOutflowsZar;
}

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  // (1) Structural self-test — the vacuous parity harness must still pass.
  const vacuous = runParityCheck({
    label: "ba300-v2-parity:structural-check",
    readV1: () => ({}),
    readV2: () => ({}),
  });
  result.asserted += 1;
  if (vacuous.length > 0) {
    violations.push({
      subject: "ba300-v2-parity:harness-structural-check",
      message:
        "The parity harness structural check failed (vacuous empty==empty did not pass). " +
        "Harness bug, not a domain divergence — inspect v1-v2-parity-harness.ts.",
      severity: "fail",
    });
  }

  // (2) Registry check — the 14 V2 money-market types must be v2-parallel.
  for (const type of V2_MM_EVENT_TYPES) {
    result.asserted += 1;
    const entry = EVENT_TYPE_REGISTRY.find((e) => e.type === type);
    if (!entry) {
      violations.push({
        subject: `ba300-v2-parity:registry-missing:${type}`,
        message: `"${type}" is not in EVENT_TYPE_REGISTRY — three-site F-032 registration defect. Register it with v2Status: "v2-parallel". Authority: D-V1-REMOVAL-PHASE-3B.`,
        severity: "fail",
      });
    } else if (entry.v2Status !== "v2-parallel") {
      violations.push({
        subject: `ba300-v2-parity:unexpected-status:${type}`,
        message: `"${type}" is tagged "${entry.v2Status}" — expected "v2-parallel" at Phase 3b (the V2 money-market path runs parallel to V1). Authority: D-V1-REMOVAL-PHASE-3B.`,
        // Premature promotion to v2-replaced is a fail; v1-only is a warn.
        severity: entry.v2Status === "v2-replaced" ? "fail" : "warn",
      });
    }
  }

  // (3) LCR-denominator parity — V1 (ALM snapshot) vs V2 (V2 lifecycle fold).
  // ADVISORY: a denominator gap is a WARN at Phase 3b (the V2 shadow may have no
  // events yet — a vacuous-V2 / populated-V1 difference is expected and correct).
  result.asserted += 1;
  try {
    const v1 = computeLcrDenominatorFromAlmSnapshot({
      eventStore,
      asOf: AS_OF,
      entity: ANCHOR_ENTITY,
      horizonDays: HORIZON_DAYS,
    });
    const v2Denominator = v2LcrDenominator(eventStore, AS_OF, ANCHOR_ENTITY);

    const diff = Math.abs(v1.netCashOutflowsZar - v2Denominator);
    if (diff > 0.005) {
      const gapNote = v1.gaps.length > 0 ? `V1 ALM gaps: ${v1.gaps.length}. ` : "";
      violations.push({
        subject: "ba300-v2-parity:denominator-gap",
        message: `LCR net-cash-outflow denominator differs between V1 and V2 paths: V1(ALM snapshot)=${v1.netCashOutflowsZar.toFixed(2)}, V2(lifecycle fold)=${v2Denominator.toFixed(2)}, diff=${diff.toFixed(2)}. Expected at Phase 3b while the V2 money-market path is a shadow with no/partial events. Hardens to enforcing when the V2 path is authoritative (later phase + Decision). ${gapNote}Authority: D-V1-REMOVAL-PHASE-3B.`,
        severity: "warn",
      });
    }
  } catch (e) {
    violations.push({
      subject: "ba300-v2-parity:denominator-compute-error",
      message: `Could not compute the LCR denominator parity: ${(e as Error).message}. This is a substrate/wiring defect, not an expected gap. Authority: D-V1-REMOVAL-PHASE-3B.`,
      severity: "fail",
    });
  }

  result.violations = violations;
  // ADVISORY contract: ok unless a fail-severity violation is present.
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "ba300-v2-parity OK (advisory) — no fail-severity violations; warns surface V1↔V2 denominator gaps"
        : "ba300-v2-parity FAILED — fail-severity violation (see above)",
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
