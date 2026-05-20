// platform/risk/credit-limit-engine/types.ts
//
// WS-CREDIT-LIMIT-ENGINE — projected state shapes for the credit-limit
// engine. Pure types; no event emission, no runtime state.
//
// Standing authority: D-CREDIT-LIMIT-ENGINE-BUILD (CEO-approved 2026-05-20;
// Phase 1 PR #611, Phase 2 PR #612). This module is the Phase 3 projection
// + operational APIs layer over the Phase 2 event-type family.
//
// Citations:
//   Banks Act 94 of 1990 §73 (single-counterparty large exposure cap);
//   Regulations Relating to Banks (RRB) Regulation 23 (credit risk LEX);
//   LEX Directive D3/2022 (Large Exposures);
//   BCBS 283 (large exposures framework, 2014);
//   Policies/credit-risk-policy-v1.md §1.4 (traffic-light protocol),
//     §2 (LEX), §3 (sizing), §7 (delegation);
//   Procedures/by-policy/credit-origination.md (PROC-RISK-CO-01);
//   Procedures/risk/credit-risk-limit-management.md (PROC-RISK-CLM-01);
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Atlas (Core banking platform architect, engineering).

import type { Money } from "../../core/money";
import type { CreditApprovalAuthority } from "../../event-store/event-types/credit-limit";

// ---------------------------------------------------------------------------
// CreditLimitStatus — lifecycle states the projection folds events into.
//
//   pending    — application submitted; analysis / ISDA / proposal not yet
//                fully through; not tradeable.
//   approved   — limit approved by an authority but not yet loaded; not
//                tradeable until loaded.
//   loaded     — limit live for pre-deal checks; trades may consume it.
//   breached   — observed exposure has crossed limit threshold per
//                Credit Risk Policy §1.4; trading blocked at red+critical.
//   expired    — limit's expiryDate has passed without annual review; not
//                tradeable.
//   withdrawn  — explicitly withdrawn / decommissioned; not tradeable.
//                Emitted via `CreditLimitWithdrawn { counterpartyId,
//                withdrawnReason, withdrawnAt, withdrawnBy }` per policy §7;
//                withdrawn counterparties are excluded from
//                `listActiveLimits` but remain queryable via
//                `getCreditLimit` / `getLimitHistory`.
// ---------------------------------------------------------------------------

export type CreditLimitStatus =
  | "pending"
  | "approved"
  | "loaded"
  | "breached"
  | "expired"
  | "withdrawn";

// ---------------------------------------------------------------------------
// CreditLimit — projected counterparty-limit state.
//
// One per counterparty (latest-wins fold across the credit-limit event
// family). `limit` is the live cap; `currency` and `tenor` carry the
// approved-instance details. `conditions` is the most-recent set imposed at
// approval (and never thinned by the projection — they remain until a new
// CreditLimitApproved or CreditLimitAnnualReviewCompleted supersedes).
// ---------------------------------------------------------------------------

export interface CreditLimit {
  /** Party register ID of the counterparty under the limit. */
  counterpartyId: string;
  /** Live limit amount; type-level currency tagging per Principle 5. */
  limit: Money;
  /** ISO 4217 redundant with `limit.currency` — preserved for callers that
   * don't yet thread `Money` through. */
  currency: string;
  /** Tenor of the approved facility (e.g., "364D", "5Y"). */
  tenor: string;
  /** Lifecycle status. */
  status: CreditLimitStatus;
  /** ISO 8601 of the CreditLimitApproved that produced the current shape;
   * absent for `pending` rows. */
  approvedAt?: string;
  /** ISO 8601 of the CreditLimitLoaded that flipped status to `loaded`;
   * absent until the limit is loaded. */
  loadedAt?: string;
  /** ISO 8601 expiryDate from the latest approval (if set). */
  expiryDate?: string;
  /** ISO 8601 of the most-recent annual review; absent until reviewed. */
  lastReviewDate?: string;
  /** Conditions imposed at the latest approval (never silently dropped). */
  conditions: string[];
  /** Authority that approved the current limit shape. */
  approvalAuthority: CreditApprovalAuthority;
}

// ---------------------------------------------------------------------------
// CreditLimitHeadroom — pre-deal headroom snapshot.
//
// `headroom = limit - currentExposure` (Money arithmetic, single currency).
// `utilisationPct = (currentExposure / limit) * 100`.
// Traffic-light protocol per Credit Risk Policy §1.4:
//   green    — utilisationPct < 80
//   amber    — utilisationPct ≥ 80 and < 100
//   red      — utilisationPct ≥ 100
//   critical — utilisationPct ≥ 100 AND LEX cap (25%) also breached
// ---------------------------------------------------------------------------

export interface CreditLimitHeadroom {
  counterpartyId: string;
  limit: Money;
  currentExposure: Money;
  headroom: Money;
  /** 0–∞; integer-floored at one decimal (rounded to one dp). */
  utilisationPct: number;
  traffic: "green" | "amber" | "red" | "critical";
}

// ---------------------------------------------------------------------------
// LargeExposureCheck — Banks Act §73 / RRB Reg 23 / LEX D3/2022 cap.
//
// `eligibleCapital` is Tier-1 + eligible Tier-2 capital, sourced from the
// capital-adequacy projection by the caller. The 25% cap is constant per
// RRB Reg 23(7); the only legitimate override is a PA-approved exception
// (cf. LexExceptionApproved with approverAuthority: "PA").
//
//   within — utilisationPct ≤ 20
//   amber  — utilisationPct > 20 and ≤ 25
//   breach — utilisationPct > 25
// ---------------------------------------------------------------------------

export interface LargeExposureCheck {
  counterpartyId: string;
  exposure: Money;
  eligibleCapital: Money;
  /** 0–∞; rounded to one decimal. */
  utilisationPct: number;
  /** Constant 25 per RRB Reg 23(7); carried in the result for caller audit. */
  capPct: 25;
  status: "within" | "amber" | "breach";
}
