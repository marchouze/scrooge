// platform/risk/credit-limit-engine/pre-deal-check.ts
//
// WS-CREDIT-LIMIT-ENGINE — pre-deal headroom check.
//
// `checkHeadroom` is the API surface called by:
//   - PROC-MK-PCG-01 Check 1(c) — pre-trade conduct gate;
//   - PROC-MK-CO-01 Gate 4       — counterparty onboarding credit-limit gate;
//   - PROC-RISK-CO-01 Step 6     — limit-loaded post-condition.
//
// Computation:
//   1. Resolve current limit via the projection (must be in `loaded` status).
//   2. Resolve current exposure by summing the latest CcrReplacementCostComputed
//      event per netting set for the counterparty (BCBS 279 RC floor).
//   3. Fallback (substrate gap): if no RC events exist for the counterparty,
//      we sum notional from CreditLimit-derived applications. This is a
//      stand-in until @platform/risk/sa-ccr lands its full PFE + RC pipeline;
//      see comment block below.
//   4. Apply traffic-light per Credit Risk Policy §1.4.
//   5. Block when status != loaded, when headroom <= 0, when limit expired,
//      or when annual review > 13 months stale (Policy §1.3, Banks Act Reg
//      23 annual review obligation).
//
// Pure function: no event emission, no side effects.
//
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../../composition";
import { type Money, add, minor, sub } from "../../core/money";
import type { Currency } from "../../core/types";
import type { CcrReplacementCostComputedPayload } from "../../event-store/event-types/counterparty-credit-risk";
import { utcNow } from "../../types/time";
import { getCreditLimit } from "./projection";
import type { CreditLimit, CreditLimitHeadroom } from "./types";

// ---------------------------------------------------------------------------
// Stale-review threshold: Credit Risk Policy §1.3 + Banks Act Reg 23 require
// annual review. We add a one-month grace before treating the limit as
// stale-blocked (13 months ≈ 395 days).
// ---------------------------------------------------------------------------

const STALE_REVIEW_DAYS = 395;

// ---------------------------------------------------------------------------
// Block reasons. `ok: true` means the proposed exposure can be admitted.
// ---------------------------------------------------------------------------

export type HeadroomBlockReason =
  | "CounterpartyNotApproved"
  | "CreditLimitExhausted"
  | "LimitExpired"
  | "AnnualReviewStale";

export type HeadroomCheckResult = CreditLimitHeadroom & {
  ok: boolean;
  blockReason?: HeadroomBlockReason;
};

// ---------------------------------------------------------------------------
// Current-exposure helper.
//
// Sums the latest CcrReplacementCostComputed event per nettingSetId for the
// counterparty. If no RC events exist yet (build phase / pre-SA-CCR), we
// return Money(0) as a substrate-gap fallback.
//
// Substrate gap (queued, follow-on slice): the full SA-CCR engine at
// `@platform/risk/sa-ccr` will land RC + PFE + add-on; once it does, this
// helper should pivot to that engine and remove the build-phase fallback.
// Tracked under D-CREDIT-LIMIT-ENGINE-BUILD Phase 4.
// ---------------------------------------------------------------------------

export function getCurrentExposure(counterpartyId: string, currency: string, asOf?: string): Money {
  const latestPerNettingSet = new Map<string, CcrReplacementCostComputedPayload>();
  const replayOpts =
    asOf !== undefined
      ? ({ type: "CcrReplacementCostComputed", asOf } as const)
      : ({ type: "CcrReplacementCostComputed" } as const);
  for (const event of eventStore.replay(replayOpts)) {
    const p = event.payload as CcrReplacementCostComputedPayload;
    if (p.counterpartyId !== counterpartyId) continue;
    const prev = latestPerNettingSet.get(p.nettingSetId);
    if (!prev || prev.computationDate <= p.computationDate) {
      latestPerNettingSet.set(p.nettingSetId, p);
    }
  }
  let total: Money = minor(0n, currency as Currency);
  for (const p of latestPerNettingSet.values()) {
    if (p.currency !== currency) continue; // skip cross-currency RC sets
    total = add(total, minor(BigInt(p.rc), currency as Currency));
  }
  return total;
}

// ---------------------------------------------------------------------------
// Traffic-light per Credit Risk Policy §1.4.
// ---------------------------------------------------------------------------

function trafficForUtilisation(utilisationPct: number): CreditLimitHeadroom["traffic"] {
  if (utilisationPct >= 100) return "red";
  if (utilisationPct >= 80) return "amber";
  return "green";
}

function utilisationPercent(exposureMinor: bigint, limitMinor: bigint): number {
  if (limitMinor <= 0n) return exposureMinor > 0n ? 1000 : 0;
  // Scale to keep integer arithmetic, then divide for one-dp rounding.
  const scaled = (exposureMinor * 1000n) / limitMinor;
  return Math.round(Number(scaled)) / 10;
}

// ---------------------------------------------------------------------------
// Stale-review check.
// ---------------------------------------------------------------------------

function daysBetween(later: string, earlier: string): number {
  const a = new Date(`${later.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${earlier.slice(0, 10)}T00:00:00Z`).getTime();
  return Math.floor((a - b) / (1000 * 60 * 60 * 24));
}

function isReviewStale(limit: CreditLimit, asOf: string): boolean {
  // Use lastReviewDate when present; otherwise fall back to approvedAt.
  const anchor = limit.lastReviewDate ?? limit.approvedAt;
  if (!anchor) return false;
  return daysBetween(asOf, anchor) > STALE_REVIEW_DAYS;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * `checkHeadroom` — admit-or-block a proposed exposure against the loaded
 * credit limit for `counterpartyId`. Returns the headroom snapshot plus an
 * `ok` flag and (when blocked) the canonical `blockReason`.
 */
export function checkHeadroom(
  counterpartyId: string,
  proposedExposure: Money,
  asOf?: string,
): HeadroomCheckResult {
  const nowIso = asOf ?? utcNow();
  const limit = getCreditLimit(counterpartyId, nowIso);

  if (!limit) {
    const zero = minor(0n, proposedExposure.currency);
    return {
      counterpartyId,
      limit: zero,
      currentExposure: zero,
      headroom: zero,
      utilisationPct: 0,
      traffic: "red",
      ok: false,
      blockReason: "CounterpartyNotApproved",
    };
  }

  // Status gate: only "loaded" is admit-eligible. Anything else is blocked
  // with the canonical reason mapped per limit state.
  if (limit.status === "expired") {
    return blockedResult(
      counterpartyId,
      limit.limit,
      minor(0n, limit.limit.currency),
      "LimitExpired",
    );
  }

  if (limit.status !== "loaded") {
    return blockedResult(
      counterpartyId,
      limit.limit,
      minor(0n, limit.limit.currency),
      "CounterpartyNotApproved",
    );
  }

  if (isReviewStale(limit, nowIso)) {
    return blockedResult(
      counterpartyId,
      limit.limit,
      minor(0n, limit.limit.currency),
      "AnnualReviewStale",
    );
  }

  const currentExposure = getCurrentExposure(counterpartyId, limit.currency, nowIso);
  // Proposed exposure must match limit currency — caller is responsible for
  // any FX conversion before calling. Mismatched currency → treat proposed
  // as zero (and the resulting headroom remains the live cap less existing
  // exposure). This is a defensive path; in practice callers always thread
  // the same currency.
  const proposedForLimit =
    proposedExposure.currency === limit.limit.currency
      ? proposedExposure
      : minor(0n, limit.limit.currency);

  const totalExposure = add(currentExposure, proposedForLimit);
  const headroom = sub(limit.limit, totalExposure);
  const utilisationPct = utilisationPercent(totalExposure.amount, limit.limit.amount);
  const traffic = trafficForUtilisation(utilisationPct);

  const ok = headroom.amount > 0n;
  const out: HeadroomCheckResult = {
    counterpartyId,
    limit: limit.limit,
    currentExposure,
    headroom,
    utilisationPct,
    traffic,
    ok,
  };
  if (!ok) out.blockReason = "CreditLimitExhausted";
  return out;
}

function blockedResult(
  counterpartyId: string,
  limit: Money,
  currentExposure: Money,
  reason: HeadroomBlockReason,
): HeadroomCheckResult {
  const headroom = sub(limit, currentExposure);
  const utilisationPct = utilisationPercent(currentExposure.amount, limit.amount);
  return {
    counterpartyId,
    limit,
    currentExposure,
    headroom,
    utilisationPct,
    traffic: "red",
    ok: false,
    blockReason: reason,
  };
}
