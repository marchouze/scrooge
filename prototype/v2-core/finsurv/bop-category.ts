// v2-core/finsurv/bop-category.ts
//
// BoP (Balance-of-Payments) category tagging SCAFFOLD for SARB FinSurv
// per-transaction reporting (ORG-FX-FIN-01..14).
//
// WHAT THIS IS (build phase): the data shape an FX settlement / NDF-fixing event
// can carry so that a cross-border flow records its FinSurv economic CLASS at
// settlement time, plus the pure derivation hook the settlement read-path calls.
// This is the build-phase substrate Mira's FinSurv reporting procedure
// (PROC-FINSURV-BOP-01) consumes.
//
// WHAT THIS IS NOT (licence-day): the live per-transaction submission to the
// SARB FinSurv Reporting System (BOPCUS / BOPDIR) is a LICENCE-DAY binding — it
// is NOT built here and is NOT hidden. The precise BOPCUS/BOPDIR numeric
// category CODE is `[citation: TBC — blocked-pending-counsel — Imani
// (Legal-as-code engineer) + external counsel at the licence gate]` for every
// one of ORG-FX-FIN-01..14 (the obligations assert only the economic CLASS, not
// the code). This module therefore tags the ECONOMIC CLASS (which we can source
// from the Currency & Exchanges Manual today) and leaves `bopcusCode`
// deliberately unset (`null`) until counsel ratifies the code map. The
// licence-day gap is tracked as a typed SubstrateAlert, not a TODO — see
// PROC-FINSURV-BOP-01 §Gaps and scripts/file-mira-finsurv-bop-scaffold.ts.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side
// settlement read-path imports FROM here, never vice-versa.
//
// Authority: D-FX-OTC-CLOSURE-BACKLOG (Phase C10 FinSurv gap); D-FX-AD-STATUS
//   (Authorised Dealer → FinSurv reporting is an AD condition); D-M4-FX-SUB-DECISIONS
//   Sub-2 (Wave-2 deferral for ORG-FX-FIN-10..14). Principle 1; Principle 2;
//   Principle 5 (multi-currency cross-border).
// Author: Mira (Compliance / RegTech engineer, engineering).
//   Governance owner: Zara (Chief Compliance Officer, governance).

import { z } from "zod";

// ---------------------------------------------------------------------------
// BoP economic class — the FinSurv economic CLASS each ORG-FX-FIN-* obligation
// asserts. This is the part we can source from the Currency & Exchanges Manual
// for Authorised Dealers (2026-05-15 ed.) TODAY; the precise BOPCUS/BOPDIR
// numeric code is licence-day-deferred (blocked-pending-counsel) and lives in
// `bopcusCode` as `null` until ratified.
//
// One-to-one with ORG-FX-FIN-01..14 (see BOP_CLASS_OBLIGATION below). The enum
// is the canonical, code-free axis; it does NOT assert any BOPCUS code.
// ---------------------------------------------------------------------------

export const bopCategoryClassSchema = z.enum([
  "current-account-trade-payments", // ORG-FX-FIN-01 — merchandise imports/exports
  "current-account-services", // ORG-FX-FIN-02 — cross-border services
  "current-account-investment-income", // ORG-FX-FIN-03 — interest/dividends/income
  "current-account-transfers", // ORG-FX-FIN-04 — remittances/personal transfers
  "capital-account-fdi", // ORG-FX-FIN-05 — foreign direct investment ≥10%
  "capital-account-portfolio-investment", // ORG-FX-FIN-06 — equity <10%/bonds/CIS
  "capital-account-other-investment", // ORG-FX-FIN-07 — loans/deposits/trade credits
  "capital-account-financial-derivatives", // ORG-FX-FIN-08 — derivative cash-flows/MTM legs
  "capital-account-reserve-assets", // ORG-FX-FIN-09 — reserve-asset flows (conditional)
  "gold-accounts", // ORG-FX-FIN-10 — gold custody/loan/leasing (Wave-2)
  "gift-donation-flows", // ORG-FX-FIN-11 — gifts/donations/inheritance (Wave-2)
  "asset-swap-flows", // ORG-FX-FIN-12 — institutional asset swaps (Wave-2)
  "exempt-flow-attestation", // ORG-FX-FIN-13 — travel/personal-effects/diplomatic (Wave-2)
  "no-charge-flows", // ORG-FX-FIN-14 — samples/replacement/nil-value (Wave-2)
]);

export type BopCategoryClass = z.infer<typeof bopCategoryClassSchema>;

// ---------------------------------------------------------------------------
// BoP class → ORG-FX-FIN obligation id + Currency & Exchanges Manual section.
// The single source for the Principle-2 citation each tag carries. The Manual
// section is the build-phase economic-class authority; the BOPCUS code is the
// licence-day-deferred refinement (kept out of this map deliberately).
// ---------------------------------------------------------------------------

export interface BopClassObligation {
  /** The ORG-FX-FIN-* obligation this class reports against. */
  readonly obligationId: string;
  /** Currency & Exchanges Manual (2026-05-15 ed.) section(s) — the economic-class authority. */
  readonly manualSection: string;
  /**
   * Wave-2 deferral flag (ORG-FX-FIN-10..14, authority D-M4-FX-SUB-DECISIONS
   * Sub-2). Wave-2 classes are recognised by the scaffold but are not in the
   * FX-spot/forward/swap settlement scope wired today; they remain unsupported
   * by the derivation hook until their wave activates.
   */
  readonly wave2Deferred: boolean;
}

export const BOP_CLASS_OBLIGATION: Readonly<Record<BopCategoryClass, BopClassObligation>> = {
  "current-account-trade-payments": {
    obligationId: "ORG-FX-FIN-01",
    manualSection: "Currency & Exchanges Manual §B.1 / §B.18",
    wave2Deferred: false,
  },
  "current-account-services": {
    obligationId: "ORG-FX-FIN-02",
    manualSection: "Currency & Exchanges Manual §B.10 / §B.13 / §B.14",
    wave2Deferred: false,
  },
  "current-account-investment-income": {
    obligationId: "ORG-FX-FIN-03",
    manualSection: "Currency & Exchanges Manual §B.3",
    wave2Deferred: false,
  },
  "current-account-transfers": {
    obligationId: "ORG-FX-FIN-04",
    manualSection: "Currency & Exchanges Manual §B.4 / §B.5 / §B.7",
    wave2Deferred: false,
  },
  "capital-account-fdi": {
    obligationId: "ORG-FX-FIN-05",
    manualSection: "Currency & Exchanges Manual §B.2(C)(i) / §B.2(E) / §A.1",
    wave2Deferred: false,
  },
  "capital-account-portfolio-investment": {
    obligationId: "ORG-FX-FIN-06",
    manualSection: "Currency & Exchanges Manual §B.2(H) / §G",
    wave2Deferred: false,
  },
  "capital-account-other-investment": {
    obligationId: "ORG-FX-FIN-07",
    manualSection: "Currency & Exchanges Manual §I / §E",
    wave2Deferred: false,
  },
  "capital-account-financial-derivatives": {
    obligationId: "ORG-FX-FIN-08",
    manualSection: "Currency & Exchanges Manual §D.1 / §D.2",
    wave2Deferred: false,
  },
  "capital-account-reserve-assets": {
    obligationId: "ORG-FX-FIN-09",
    manualSection: "Currency & Exchanges Manual (no dedicated chapter — agent/custodian only)",
    wave2Deferred: false,
  },
  "gold-accounts": {
    obligationId: "ORG-FX-FIN-10",
    manualSection: "Currency & Exchanges Manual §C",
    wave2Deferred: true,
  },
  "gift-donation-flows": {
    obligationId: "ORG-FX-FIN-11",
    manualSection: "Currency & Exchanges Manual §B.17 / §B.7",
    wave2Deferred: true,
  },
  "asset-swap-flows": {
    obligationId: "ORG-FX-FIN-12",
    manualSection: "Currency & Exchanges Manual §B.2(H)",
    wave2Deferred: true,
  },
  "exempt-flow-attestation": {
    obligationId: "ORG-FX-FIN-13",
    manualSection: "Currency & Exchanges Manual §B.4 / §B.6",
    wave2Deferred: true,
  },
  "no-charge-flows": {
    obligationId: "ORG-FX-FIN-14",
    manualSection: "Currency & Exchanges Manual §B.19",
    wave2Deferred: true,
  },
};

// ---------------------------------------------------------------------------
// BoP category TAG — the data shape an FX settlement / NDF-fixing event carries.
// Append-only-safe: the carrying events make this OPTIONAL, so existing events
// (which carry no tag) continue to parse unchanged.
// ---------------------------------------------------------------------------

export const bopCategoryTagSchema = z.object({
  /** The FinSurv economic CLASS (one of ORG-FX-FIN-01..14). Code-free. */
  bopClass: bopCategoryClassSchema,
  /**
   * The ORG-FX-FIN obligation this flow reports against — denormalised onto the
   * tag for a one-hop Principle-2 back-reference (always === the class map).
   */
  obligationId: z.string().min(1),
  /**
   * The precise BOPCUS / BOPDIR category CODE.
   *
   * LICENCE-DAY-DEFERRED — `null` in the build phase. The Currency & Exchanges
   * Manual asserts the economic class; the numeric code per the FinSurv Reporting
   * System Business & Technical Specifications is `[citation: TBC —
   * blocked-pending-counsel — Imani (Legal-as-code engineer) + external counsel
   * at the licence gate]`. The field is present in the shape so that when counsel
   * ratifies the code map, the same tagging hook populates it WITHOUT a schema
   * change. Until then it is `null` (NOT an empty string — the absence is
   * explicit, fail-closed: a non-null code in the build phase is a recon finding).
   */
  bopcusCode: z.string().min(1).nullable(),
  /**
   * Whether the flow crosses the SA-resident ↔ non-resident boundary. FinSurv
   * reporting binds ONLY on cross-border flows; a resident-to-resident leg is
   * out of FinSurv scope (still recorded for completeness, `crossBorder: false`).
   */
  crossBorder: z.boolean(),
  /**
   * Tagging provenance — the Currency & Exchanges Manual section + obligation
   * that justify the class. Principle 2: the tag is self-citing.
   */
  citation: z.string().min(1),
});

export type BopCategoryTag = z.infer<typeof bopCategoryTagSchema>;

// ---------------------------------------------------------------------------
// The derivation HOOK — the pure function the FX settlement read-path calls to
// derive a BoP-category tag from a settlement's economic context.
//
// Build-phase posture: the hook maps an explicitly-supplied economic class to a
// fully-cited tag. It does NOT guess the class from raw cash flows — class
// determination for current/capital-account flows is a counterparty-purpose
// determination (the trade's underlying economic purpose), which the markets /
// payments domain supplies at booking, NOT something the accounting cash legs
// reveal. The hook therefore takes the class as input and is responsible for the
// citation + obligation wiring + the build-phase fail-closed on `bopcusCode`.
// ---------------------------------------------------------------------------

export interface DeriveBopCategoryTagInput {
  /** The FinSurv economic class for this flow (markets/payments-domain determination). */
  readonly bopClass: BopCategoryClass;
  /** Whether the flow crosses the SA-resident ↔ non-resident boundary. */
  readonly crossBorder: boolean;
  /**
   * The precise BOPCUS/BOPDIR code, IF AND ONLY IF counsel has ratified it.
   * Build-phase callers leave this unset → the tag's `bopcusCode` is `null`. A
   * non-null value is admitted ONLY post-counsel (the recon asserts build-phase
   * tags carry `null`).
   */
  readonly bopcusCode?: string;
}

/**
 * The reason a flow cannot be tagged (fail-closed; the read-path surfaces this,
 * never swallows it — Engineering Charter cmd 5).
 */
export type BopTaggingSkipReason = { readonly kind: "wave2-not-active"; readonly bopClass: BopCategoryClass };

export type DeriveBopCategoryTagResult =
  | { readonly tagged: true; readonly tag: BopCategoryTag }
  | { readonly tagged: false; readonly skip: BopTaggingSkipReason };

/**
 * Derive the BoP-category tag for an FX settlement flow.
 *
 * Fail-closed: a Wave-2 class (ORG-FX-FIN-10..14) is recognised but NOT in the
 * settlement scope wired today, so the hook returns a typed skip rather than a
 * silently-defaulted tag. The caller surfaces the skip (it is never an error to
 * swallow).
 */
export function deriveBopCategoryTag(input: DeriveBopCategoryTagInput): DeriveBopCategoryTagResult {
  const obligation = BOP_CLASS_OBLIGATION[input.bopClass];

  if (obligation.wave2Deferred) {
    return { tagged: false, skip: { kind: "wave2-not-active", bopClass: input.bopClass } };
  }

  const tag: BopCategoryTag = {
    bopClass: input.bopClass,
    obligationId: obligation.obligationId,
    // Build-phase: no code is asserted unless counsel has ratified it (then a
    // caller may pass it through). Default = null (fail-closed, explicit absence).
    bopcusCode: input.bopcusCode ?? null,
    crossBorder: input.crossBorder,
    citation: `${obligation.obligationId} (${obligation.manualSection})`,
  };

  return { tagged: true, tag: bopCategoryTagSchema.parse(tag) };
}

/** The full set of BoP classes in scope for the settlement hook today (non-Wave-2). */
export const ACTIVE_BOP_CLASSES: readonly BopCategoryClass[] = (
  Object.keys(BOP_CLASS_OBLIGATION) as BopCategoryClass[]
).filter((c) => !BOP_CLASS_OBLIGATION[c].wave2Deferred);
