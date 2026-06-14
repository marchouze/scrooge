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
//   2. Resolve current exposure with a two-tier preference:
//        (a) sum the latest CcrEadComputed event per netting set
//            (BCBS d317 §10 EAD = α × (RC + PFE) — the canonical engine
//            output under D-CREDIT-LIMIT-ENGINE-BUILD Phase 5);
//        (b) fall back to the latest CcrReplacementCostComputed per
//            netting set (RC floor — degraded mode when no EAD events
//            are observed for the counterparty, e.g. seeded fixtures
//            or RC-only emitters).
//      The two-tier preference is per-netting-set: if a netting set has
//      EAD it contributes EAD, otherwise RC; sums are aggregated in the
//      limit currency.
//   3. Degraded-mode fallback: if neither EAD nor RC events exist for the
//      counterparty, we return zero exposure AND log a warning. The
//      fallback is explicit, observable, and intended as a build-phase
//      scaffold — Vera's lex-cap-utilisation recon asserts that any
//      loaded limit with traded notional and zero EAD/RC events is a
//      finding. Notional summation as a stand-in was considered and
//      rejected: it produces a number that looks like an exposure but
//      is methodologically wrong, and the explicit-zero + warning +
//      recon assertion combo is the cleaner path.
//   4. Apply traffic-light per Credit Risk Policy §1.4.
//   5. Block when status != loaded, when headroom <= 0, when limit expired,
//      or when annual review > 13 months stale (Policy §1.3, Banks Act Reg
//      23 annual review obligation).
//
// Pure function up to the degraded-mode `logger.warn` call: no event
// emission, no projection writes.
//
// Authors: Atlas (Core banking platform architect, engineering) — initial
//   implementation; Rohan (Market risk quantitative engineer, engineering)
//   — SA-CCR pivot under D-CREDIT-LIMIT-ENGINE-BUILD Phase 4.

import { eventStore, logger } from "../../composition";
import { type Money, add, minor, sub } from "../../core/money";
import type { Currency } from "../../core/types";
import type {
  CcrEadComputedPayloadV2Type,
  CcrReplacementCostComputedPayload,
} from "../../event-store/event-types/counterparty-credit-risk";
import { minorFromMoneyWire } from "../../core/money-codec";
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
// Per netting set, prefer the latest CcrEadComputed payload (BCBS d317 §10
// — EAD = α × (RC + PFE), the canonical engine output) over the latest
// CcrReplacementCostComputed (RC floor). The two-tier preference is
// applied per netting set: a netting set with an EAD event contributes
// EAD; a netting set with only RC events contributes RC. The sum across
// netting sets is the current exposure, in the limit's reporting
// currency (cross-currency sets are skipped — FX conversion is the
// caller's responsibility).
//
// Degraded-mode fallback: when neither EAD nor RC events are observed for
// the counterparty in the configured currency, the helper returns zero
// AND logs a `degraded:no-rc-events` warning. Callers must treat zero as
// "no SA-CCR run has been observed yet", not "no exposure". Vera's
// lex-cap-utilisation recon asserts that any loaded limit with traded
// notional and zero EAD/RC events is a finding (closes the loop).
//
// SA-CCR engine: `@platform/risk/sa-ccr.computeAndEmit` — landed under
// D-CREDIT-LIMIT-ENGINE-BUILD Phase 4; CcrEadComputed emission added in
// D-CREDIT-LIMIT-ENGINE-BUILD Phase 5 (Credit Risk Policy §3 line 131).
// ---------------------------------------------------------------------------

export function getCurrentExposure(
  counterpartyId: string,
  currency: string,
  asOf?: string,
  store?: Pick<typeof eventStore, "replay">,
): Money {
  const es = store ?? eventStore;
  // Tier 1: latest CcrEadComputed per netting set.
  const latestEadPerNettingSet = new Map<string, CcrEadComputedPayloadV2Type>();
  const eadReplayOpts =
    asOf !== undefined
      ? ({ type: "CcrEadComputed", asOf } as const)
      : ({ type: "CcrEadComputed" } as const);
  for (const event of es.replay(eadReplayOpts)) {
    const p = event.payload as CcrEadComputedPayloadV2Type;
    if (p.counterpartyId !== counterpartyId) continue;
    const prev = latestEadPerNettingSet.get(p.nettingSetId);
    if (!prev || prev.computationDate <= p.computationDate) {
      latestEadPerNettingSet.set(p.nettingSetId, p);
    }
  }

  // Tier 2: latest CcrReplacementCostComputed per netting set (fallback for
  // netting sets without a corresponding EAD event).
  const latestRcPerNettingSet = new Map<string, CcrReplacementCostComputedPayload>();
  const rcReplayOpts =
    asOf !== undefined
      ? ({ type: "CcrReplacementCostComputed", asOf } as const)
      : ({ type: "CcrReplacementCostComputed" } as const);
  for (const event of es.replay(rcReplayOpts)) {
    const p = event.payload as CcrReplacementCostComputedPayload;
    if (p.counterpartyId !== counterpartyId) continue;
    const prev = latestRcPerNettingSet.get(p.nettingSetId);
    if (!prev || prev.computationDate <= p.computationDate) {
      latestRcPerNettingSet.set(p.nettingSetId, p);
    }
  }

  // Union of netting-set IDs across both event types; prefer EAD per set.
  const nettingSetIds = new Set<string>([
    ...latestEadPerNettingSet.keys(),
    ...latestRcPerNettingSet.keys(),
  ]);

  let total: Money = minor(0n, currency as Currency);
  let observedInCurrency = 0;
  for (const nsId of nettingSetIds) {
    const ead = latestEadPerNettingSet.get(nsId);
    if (ead) {
      if (ead.currency !== currency) continue; // skip cross-currency sets
      total = add(total, minor(BigInt(minorFromMoneyWire(ead.ead)), currency as Currency));
      observedInCurrency += 1;
      continue;
    }
    const rc = latestRcPerNettingSet.get(nsId);
    if (rc) {
      if (rc.currency !== currency) continue;
      total = add(total, minor(BigInt(rc.rc), currency as Currency));
      observedInCurrency += 1;
    }
  }
  if (observedInCurrency === 0) {
    logger.warn(
      {
        component: "credit-limit-engine.pre-deal-check",
        counterpartyId,
        currency,
        asOf: asOf ?? null,
        mode: "degraded:no-rc-events",
      },
      "SA-CCR getCurrentExposure: no CcrEadComputed or CcrReplacementCostComputed events observed for counterparty; returning zero exposure. Vera lex-cap-utilisation recon will flag traded notional without EAD/RC coverage.",
    );
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
  store?: Pick<typeof eventStore, "replay">,
): HeadroomCheckResult {
  const nowIso = asOf ?? utcNow();
  const limit = getCreditLimit(counterpartyId, nowIso, store);

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

  const currentExposure = getCurrentExposure(counterpartyId, limit.currency, nowIso, store);
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
