// v2-core/banking/events.ts
//
// V2 S4 — typed event definitions for the anchor-bank's standing data:
//
//   V2ProductRegistered     — a product (FIL type) enters the bank's catalogue
//   V2ProductDeprecated     — a product is retired (superseded or licence-day
//                             deferred); existing instances continue to run
//   V2AccountTypeRegistered — a CoA account type enters the bank's chart
//   V2RiskAppetiteSet       — a RAS appetite line is recorded as a v2 event
//
// Design principles:
//   - Products reference FIL taxonomy scopes (`fil:type:…` patterns) so the
//     same product definition feeds the FIL-Models registry, the NPA gate,
//     and posture-conditioned calculations without re-describing the instrument.
//   - CoA types carry the minimal IFRS-9 / BA-form classification fields that
//     the v2 accounting facet (Accountable) needs; currency is optional because
//     multi-currency accounts share a type key (the currency is a dimension of
//     the INSTANCE, not the type).
//   - RAS thresholds are snapshotted verbatim from the v1 RAS register so the
//     v2 seed never diverges from the CRO-approved source. The `rasLineId`
//     string is a stable link back to `platform/risk/ras-appetite-register.ts`.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` — NO imports from `platform/`,
// `runtime/`, `domains/`, or the v1 alias prefixes. The v1-side registry wiring
// (`platform/event-store/registry/v2-banking.ts`) imports FROM here, not vice-versa.
//
// AppliesToScope note: S3 (posture register) has not yet landed. Per the brief,
// a minimal placeholder `AppliesToScope` is defined inline here; S3 will supersede
// it. A substrate gap is noted below.
//
// Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
// Author: Bea (Financial Controller, accounting).

import { z } from "zod";
import { filScopePatternSchema } from "../fil-core/urn";

// ---------------------------------------------------------------------------
// AppliesToScope — placeholder until S3 (posture register) lands
// ---------------------------------------------------------------------------

/**
 * A scope selector that says which posture dimensions / product families / legal
 * entities a RAS line applies to. S3 will supply the production-grade shape;
 * this placeholder keeps S4 self-contained while maintaining the correct import
 * in the seed script.
 *
 * SUBSTRATE GAP: `AppliesToScope` will be superseded by the S3 posture-register
 * shape when that dispatch merges. Until then consumers should treat this as an
 * opaque tag.
 */
export const appliesToScopeSchema = z.object({
  /** e.g. "fil:type:fx:*", "fil:type:*", etc. */
  filScope: filScopePatternSchema.optional(),
  /** e.g. "LE-BANK-SA" — omit for bank-wide lines */
  legalEntityId: z.string().min(1).optional(),
  /** free-form note */
  note: z.string().optional(),
});

export type AppliesToScope = z.infer<typeof appliesToScopeSchema>;

// ---------------------------------------------------------------------------
// V2ProductRegistered
// ---------------------------------------------------------------------------

/**
 * A product enters the anchor-bank's catalogue as a typed v2 event.
 *
 * `filTypeScopes` is the bridge to the FIL taxonomy: each entry is a
 * `fil:type:…` pattern that scopes the product in the taxonomy graph.
 * E.g. FX OTC Vanilla → `["fil:type:fx:spot:otc-vanilla@1.0"]`; Bond →
 * `["fil:type:ir:bond.govt:sagb@1.0"]`. At minimum one scope is required.
 *
 * `v1ProductId` links back to the v1 NPA-approved product id (e.g.
 * `prd:bank:fx:otc-vanilla`) for the parity recon gate.
 */
export const v2ProductRegisteredSchema = z.object({
  kind: z.literal("V2ProductRegistered"),
  /** Stable product id for v2 — mirrors v1 convention but namespaced v2. */
  productId: z.string().min(1),
  /** Human-readable product name. */
  name: z.string().min(1),
  /** IFRS-9 instrument family for accounting rule dispatch. */
  ifrs9Family: z.enum([
    "fx-spot",
    "fx-forward",
    "equity",
    "bond",
    "ird-swap",
    "repo",
    "money-market",
    "interbank-loan",
  ]),
  /** FIL taxonomy scope pattern(s) this product maps to. */
  filTypeScopes: z.array(filScopePatternSchema).min(1),
  /** v1 product id for parity recon — links back to `prd:bank:…` NPA events. */
  v1ProductId: z.string().min(1).optional(),
  /** ISO 4217 currencies this product trades in (multi-currency — Principle 5). */
  currencies: z.array(z.string().length(3)).min(1),
  /** Legal entity id(s) that may originate this product. */
  legalEntityIds: z.array(z.string().min(1)).min(1),
  /** Jurisdiction codes (ISO 3166-1 alpha-2). */
  jurisdictions: z.array(z.string().length(2)).min(1),
  /** Franchise scope from v1: institutional / retail / treasury-own-book. */
  franchiseScope: z.enum(["institutional", "retail", "treasury-own-book"]),
  /** Citations to NPA decisions, FIL-type URNs, or obligation nodes. */
  citations: z.array(z.string().min(1)).min(1),
});

export type V2ProductRegistered = z.infer<typeof v2ProductRegisteredSchema>;

// ---------------------------------------------------------------------------
// V2ProductDeprecated
// ---------------------------------------------------------------------------

/**
 * A product is retired from the catalogue. Existing instances continue to run
 * under their lifecycle rules; no new instances may be created after the
 * deprecation event.
 */
export const v2ProductDeprecatedSchema = z.object({
  kind: z.literal("V2ProductDeprecated"),
  productId: z.string().min(1),
  /** Reason for retirement. */
  reason: z.enum(["superseded", "licence-day-deferred", "regulatory-withdrawn", "strategic"]),
  /** Product id that supersedes this one, if any. */
  supersededBy: z.string().optional(),
  citations: z.array(z.string().min(1)).min(1),
});

export type V2ProductDeprecated = z.infer<typeof v2ProductDeprecatedSchema>;

// ---------------------------------------------------------------------------
// V2AccountTypeRegistered
// ---------------------------------------------------------------------------

/**
 * A CoA account TYPE enters the bank's chart of accounts as a v2 event.
 *
 * Currency is optional: multi-currency deployments share a type key per
 * account class (e.g. `fx-trading-receivable`) and differentiate at the
 * instance level via the `designatedCurrency` dimension. Single-currency
 * types (e.g. capital, retained earnings) carry the ISO-4217 code here.
 */
export const v2AccountTypeRegisteredSchema = z.object({
  kind: z.literal("V2AccountTypeRegistered"),
  /** Stable account-type key — e.g. `fx-trading-receivable`, `cet1-share-capital`. */
  accountTypeKey: z.string().min(1),
  /** Human-readable name. */
  name: z.string().min(1),
  /** IFRS-9 / BA-form classification. */
  category: z.enum([
    "asset",
    "liability",
    "equity",
    "income",
    "expense",
    "memorandum",
    "liability-t2-capital",
  ]),
  /** Normal debit/credit side. */
  normalSide: z.enum(["debit", "credit"]),
  /**
   * Designated currency for single-currency account types.
   * Absent for multi-currency types (designation is per-instance).
   */
  currency: z.string().length(3).optional(),
  /**
   * v1 account id(s) that map to this type (e.g. `ACC-2100-001`).
   * May be multiple when a single type spans multiple v1 entries.
   */
  v1AccountIds: z.array(z.string().min(1)).optional(),
  /** FIL taxonomy scopes this account type is used for, if instrument-specific. */
  filTypeScopes: z.array(filScopePatternSchema).optional(),
  citations: z.array(z.string().min(1)).min(1),
});

export type V2AccountTypeRegistered = z.infer<typeof v2AccountTypeRegisteredSchema>;

// ---------------------------------------------------------------------------
// V2RiskAppetiteSet
// ---------------------------------------------------------------------------

/**
 * A RAS appetite line is recorded as a v2 event. The threshold shape is a
 * verbatim snapshot from the v1 RAS register (`ras-appetite-register.ts`):
 * `kind: "ratio"` lines carry the `printed` band string; `kind: "posture"`
 * lines carry the posture statement. This is intentionally non-reprocessed —
 * the v2 event is an anchor, not a re-derivation.
 *
 * `appliesToScope` links the line to the FIL taxonomy / posture dimensions it
 * governs (placeholder shape until S3 lands — see `AppliesToScope` note above).
 */
export const v2RasThresholdSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("ratio"),
    /** Verbatim from `RasThresholds.printed` in ras-appetite-register.ts. */
    printed: z.string().min(1),
  }),
  z.object({
    kind: z.literal("posture"),
    /** Verbatim from `RasThresholds.printed` in ras-appetite-register.ts. */
    printed: z.string().min(1),
  }),
]);

export type V2RasThreshold = z.infer<typeof v2RasThresholdSchema>;

export const v2RiskAppetiteSetSchema = z.object({
  kind: z.literal("V2RiskAppetiteSet"),
  /**
   * Stable id — mirrors the v1 `RasAppetiteLine.id` (e.g.
   * `appetite:liquidity:lcr`). Serves as the v1↔v2 parity key.
   */
  rasLineId: z.string().min(1),
  /** Human-readable label — verbatim from v1 register. */
  label: z.string().min(1),
  /** RAS section (e.g. `RAS §B3`). */
  rasSection: z.string().min(1),
  /** Risk category (mirrors v1 `RasCategory`). */
  category: z.enum([
    "credit",
    "market",
    "liquidity",
    "irrbb",
    "operational",
    "conduct",
    "financial-crime",
    "legal-regulatory",
    "strategic",
    "model",
    "climate",
    "capital",
  ]),
  /** Breach tier per RAS §B9. */
  tier: z.enum(["tier-1", "tier-2", "tier-3", "zero-appetite"]),
  /** Verbatim threshold snapshot from the v1 RAS register. */
  thresholds: v2RasThresholdSchema,
  /**
   * Scope this appetite line applies to. Bank-wide lines omit `filScope`
   * and `legalEntityId`.
   */
  appliesToScope: appliesToScopeSchema,
  /**
   * Monetary floor (ZAR minor units = cents) for lines that carry an
   * absolute buffer floor (e.g. intraday HQLA floor R50m = 5_000_000_000
   * minor units). Absent when the line carries no monetary floor.
   */
  floorZarMinor: z.number().int().nonnegative().optional(),
  citations: z.array(z.string().min(1)).min(1),
});

export type V2RiskAppetiteSet = z.infer<typeof v2RiskAppetiteSetSchema>;

// ---------------------------------------------------------------------------
// Union type — all S4 event payloads
// ---------------------------------------------------------------------------

export type V2BankingEvent =
  | V2ProductRegistered
  | V2ProductDeprecated
  | V2AccountTypeRegistered
  | V2RiskAppetiteSet;

export const V2_BANKING_EVENT_KINDS = [
  "V2ProductRegistered",
  "V2ProductDeprecated",
  "V2AccountTypeRegistered",
  "V2RiskAppetiteSet",
] as const;

export type V2BankingEventKind = (typeof V2_BANKING_EVENT_KINDS)[number];
