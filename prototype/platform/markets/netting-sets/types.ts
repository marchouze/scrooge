// platform/markets/netting-sets/types.ts
//
// WS-CREDIT-LIMIT-ENGINE Phase 5 — Netting-set register types. Pure
// shape declarations; the projection in `projection.ts` folds the
// `ISDACSAAssessmentCompleted` event family into these shapes (Principle
// 1 — events-are-truth; the register is a query, not stored state).
//
// One netting set per counterparty per currency at v0 (Credit Risk
// Policy §3 line 132 — cross-product netting is not recognised at v0).
// `NettingSetRegistryEntry` carries the full lifecycle (active /
// superseded / lapsed); the lighter `NettingSet` shape exported here
// is the active-projection view consumed by the SA-CCR engine.
//
// Citations:
//   ISDA Master Agreement (2002) + Credit Support Annex (CSA);
//   GMRA (2011) — repo netting analog;
//   BCBS d317 (SA-CCR) — netting-set granularity;
//   Policies/credit-risk-policy-v1.md §3 line 121 onward (SA-CCR
//     methodology) and §3 line 137 (CSA terms — threshold / MTA);
//   D-CREDIT-LIBL-LIMIT-ENGINE-BUILD Phase 5;
//   D-CREDIT-LIMIT-ENGINE-BUILD;
//   Principles/1-events-are-truth.md;
//   Principles/2-single-graph-discipline.md.
//
// Author: Imani (Legal-as-code engineer, engineering).

import type { Money } from "../../core/money";

// ---------------------------------------------------------------------------
// NettingSet — active-projection shape mirroring the engine-side type in
// `@platform/risk/sa-ccr/types.ts`. Imani's register is the canonical
// authoring source; the SA-CCR engine type is a structural alias for the
// engine's input boundary. Field semantics are identical.
//
// Why a separate type? The SA-CCR `NettingSet` is the engine's input
// contract — bound to the engine's call-site signature. This register
// shape adds the policy-side fields (enforceability + jurisdictional
// opinion ref + last-validated timestamp) that the engine doesn't
// directly consume but a Vera recon, a compliance dashboard, or a
// downstream LEX engine will. Keeping them on the register and threading
// only the engine-needed subset to `computeAndEmit` preserves
// separation-of-concerns between the legal-policy layer (Imani's
// remit) and the quantitative layer (Rohan's remit).
// ---------------------------------------------------------------------------

export interface NettingSet {
  /** Convention: `NS-<counterpartyId>-<ccy>` (mirrors RC event shape). */
  nettingSetId: string;

  /** Party register ID of the counterparty. */
  counterpartyId: string;

  /**
   * `true` when the netting set is governed by a live CSA (or GMRA for
   * repo). Drives the RC branch in `computeReplacementCost`:
   *   margined   : RC = max(V − C, MTA + TH, 0)
   *   unmargined : RC = max(V, 0)
   * Sourced from `ISDACSAAssessmentCompleted.isdaStatus` — when the
   * CSA is executed (status = "executed"), `csaPresent` is `true`.
   */
  csaPresent: boolean;

  /** CSA threshold (TH). Money in `currency`. Only meaningful when
   * `csaPresent = true`; zero-threshold CSAs are common and encoded as
   * a `minor(0)` Money. Credit Risk Policy §3 line 137. */
  threshold: Money;

  /** Minimum transfer amount (MTA). Money in `currency`. Only
   * meaningful when `csaPresent = true`. */
  mta: Money;

  /** ISO 4217 currency of the netting set. */
  currency: string;

  /**
   * `true` when a clean netting-enforceability legal opinion is on file
   * for the counterparty's jurisdiction. Drives whether the engine
   * recognises netting at all — when `false`, SA-CCR must be computed
   * trade-by-trade (no netting benefit). Credit Risk Policy §3 line 136.
   */
  nettingEnforceable: boolean;

  /** RMS document-store ID of the jurisdiction-of-incorporation
   * opinion that supports `nettingEnforceable`. May be `undefined` when
   * `nettingEnforceable = false` (the absence-of-opinion is itself
   * grounds for non-enforceability). */
  jurisdictionOpinionRef?: string;

  /** ISO 8601 — `assessedAt` of the latest `ISDACSAAssessmentCompleted`
   * that materialised this register row. */
  lastValidatedAt?: string;
}

// ---------------------------------------------------------------------------
// NettingSetRegistryEntry — full lifecycle shape. The register stores one
// row per assessment; each new `ISDACSAAssessmentCompleted` for a
// counterparty supersedes the prior row (status: `superseded`), and the
// new row carries `status: 'active'`. `lapsed` is reserved for future use
// — a `NettingAgreementLapsed` event (queued; see header substrate note)
// will mark rows as lapsed without superseding.
// ---------------------------------------------------------------------------

export type NettingSetStatus = "active" | "superseded" | "lapsed";

export interface NettingSetRegistryEntry extends NettingSet {
  /** ISO 8601 — when this entry took effect. Mirrors the source event's
   * `assessedAt`. */
  effectiveFrom: string;

  /** Lifecycle status of this register row. `active` is the latest
   * assessment for the counterparty; `superseded` is a prior assessment
   * displaced by a newer one; `lapsed` is a future-use status for the
   * `NettingAgreementLapsed` event (not yet implemented). */
  status: NettingSetStatus;
}

// ---------------------------------------------------------------------------
// JurisdictionEnforceability — per-jurisdiction legal-opinion shape.
// Imani's register surfaces this so a downstream view (Helena's RAS
// schedule, Owen's governance registers, Vera's enforceability recon)
// can render the bank's jurisdictional netting coverage without
// re-walking events.
//
// v0 derives `opinionStatus` from `nettingEnforceable` (true →
// `positive`, false → `negative`); the `pending` state will be
// emitted from a future `NettingAgreementValidated` event once the
// substrate gap closes.
// ---------------------------------------------------------------------------

export interface JurisdictionEnforceability {
  /** ISO 3166-1 alpha-2 jurisdiction code (e.g. "ZA", "GB"). Sourced
   * from the counterparty's Party register record when available; at
   * v0 we surface the jurisdiction-opinion ref only (the jurisdiction
   * itself is implicit in the opinion). */
  jurisdiction: string;

  /** `positive` — clean opinion on file, netting recognised;
   *  `negative` — opinion expressly adverse or absent;
   *  `pending`  — opinion requested but not yet received.
   *
   * v0: derived from `nettingEnforceable`; `pending` reserved for the
   * future `NettingAgreementValidated` event. */
  opinionStatus: "positive" | "negative" | "pending";

  /** RMS document-store ID of the opinion. */
  opinionRef?: string;

  /** ISO 8601 — when the opinion was filed / assessed. */
  opinionDate?: string;
}
