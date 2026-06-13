// v2-core/cross-tenant/csi-blocklist.ts
//
// CSI BLOCKLIST REGISTER — V2 S12 (the competition-law keystone of multi-tenancy).
//
// The CSI (competitively-sensitive-information) blocklist is the typed,
// event-sourced register of the classes of information that MUST NOT cross a
// tenant boundary through any learning flow. It is the named dimension the
// cross-tenant learning gate (`./gate.ts`) screens against.
//
// WHY THIS EXISTS
// ---------------
// BBaaS is a COMMON SUPPLIER to competing banks — the classic competition-law
// hub-and-spoke topology. If one tenant bank's competitively-sensitive
// information reaches another *through the platform*, the banks can be in a
// concerted practice (Competition Act 89 of 1998 s.4(1)) without ever meeting,
// and the platform is the conduit. The blocklist names the information classes
// that can never cross; the gate enforces it fail-closed. (Owen, W7 vendor-
// perimeter note §5.1; Zara, CCO, owns the category content.)
//
// STRUCTURED-FIRST (Principle 1): the blocklist is a projection over a typed,
// replayable event family (`CsiCategoryRegistered` / `CsiCategoryRetired`),
// never a static array. The canonical seed categories below are the founding
// population the seed script emits; the register is the source of truth.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory (`platform/`, `runtime/`, `domains/`, etc.). The only
// permitted external dependencies are bare npm packages (`zod`) and the v2-core
// fil-core primitives. See `recon:v2-no-v1-import`.
//
// Authority: D-W7-VENDOR-ENTITY-STRUCTURE (CSI blocklist gate before C-tier
// go-live); D-V2-TENANCY-ARCHITECTURE; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:v2-s12-cross-tenant-learning-gate-csi-blocklist-:2026-06-13
// Author: Atlas (Substrate Architect, engineering) with Zara (Chief Compliance
// Officer, governance) for the category taxonomy.

import { z } from "zod";
import type { CitationRef, Instant } from "../fil-core/primitives";
import { citationRefSchema, instantSchema } from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// CSI category-class vocabulary (Zara's taxonomy)
// ---------------------------------------------------------------------------

/**
 * The closed set of CSI category classes at S12. Each is a class of
 * competitively-sensitive information that reduces a competitor's uncertainty
 * about another bank's MARKET CONDUCT — exactly the information whose exchange
 * through a common supplier is the Competition Act s.4(1) hazard. The list is
 * Zara's (CCO) and tracks the "never crosses" enumeration in Owen's W7 note §5.1.
 *
 * The closed enum here is the minimum S12 contract; new classes are added by
 * registering a new `CsiCategoryRegistered` event (Principle 1 — the register
 * is extensible without a code change to the gate).
 */
export const CSI_CATEGORY_CLASSES = [
  "positions-exposures", // a tenant's trading positions, exposures, volumes
  "pricing-spreads", // pricing, rate data, margins, spreads
  "client-counterparty-lists", // client / counterparty identities and lists
  "pnl", // profit-and-loss, revenue, margins by book
  "risk-appetite-calibrations", // RAS thresholds — a bank's risk-appetite is strategy
  "model-calibrations", // model calibrations / parameters tuned to a tenant's book
  "trade-level-data", // individual trade records, tickets, granular flow
  "strategy-plans", // funding plans, product-launch plans, capacity, strategy
] as const;

export type CsiCategoryClass = (typeof CSI_CATEGORY_CLASSES)[number];
export const csiCategoryClassSchema = z.enum(CSI_CATEGORY_CLASSES);

// ---------------------------------------------------------------------------
// CSI category event payloads
// ---------------------------------------------------------------------------

/**
 * `CsiCategoryRegistered` — a CSI category enters the blocklist.
 *
 * `categoryId`     — stable slug; convention `csi:<class>:<short-slug>`.
 * `categoryClass`  — class from the closed set.
 * `description`    — human-readable statement of what the category covers.
 * `lawBasis`       — the competition-law basis (free-text statement of the
 *                    statutory hook, e.g. "Competition Act 89 of 1998 s.4(1)
 *                    — concerted practice via a common supplier").
 * `registeredBy`   — who registered the category (the CCO seat owns this).
 * `citations`      — Principle 2 upward citations (at minimum the authorising
 *                    decision + the competition-law section).
 */
export interface CsiCategoryRegisteredPayload {
  readonly categoryId: string;
  readonly categoryClass: CsiCategoryClass;
  readonly description: string;
  readonly lawBasis: string;
  readonly registeredBy: string;
  readonly citations: readonly CitationRef[];
}

export const csiCategoryRegisteredPayloadSchema = z
  .object({
    categoryId: z.string().min(1),
    categoryClass: csiCategoryClassSchema,
    description: z.string().min(1),
    lawBasis: z.string().min(1),
    registeredBy: z.string().min(1),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict() as unknown as z.ZodType<CsiCategoryRegisteredPayload>;

/**
 * `CsiCategoryRetired` — a CSI category is retired from the blocklist.
 *
 * Retiring a category is a governance act (a category should only ever be
 * retired if competition counsel confirms it is no longer competitively
 * sensitive). It is recorded as an append-only audit event; the projection
 * folds it as a tombstone.
 */
export interface CsiCategoryRetiredPayload {
  readonly categoryId: string;
  readonly retiredAt: Instant;
  readonly reason: string;
  readonly authority: string;
  readonly citations: readonly CitationRef[];
}

export const csiCategoryRetiredPayloadSchema = z
  .object({
    categoryId: z.string().min(1),
    retiredAt: instantSchema,
    reason: z.string().min(1),
    authority: z.string().min(1),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict() as unknown as z.ZodType<CsiCategoryRetiredPayload>;

// ---------------------------------------------------------------------------
// Discriminated union of CSI blocklist event payloads
// ---------------------------------------------------------------------------

export type CsiBlocklistEventPayload =
  | ({ readonly kind: "CsiCategoryRegistered" } & CsiCategoryRegisteredPayload)
  | ({ readonly kind: "CsiCategoryRetired" } & CsiCategoryRetiredPayload);

export const CSI_BLOCKLIST_EVENT_KINDS = ["CsiCategoryRegistered", "CsiCategoryRetired"] as const;

export type CsiBlocklistEventKind = (typeof CSI_BLOCKLIST_EVENT_KINDS)[number];

// ---------------------------------------------------------------------------
// Canonical seed categories (Zara's taxonomy — the founding population)
// ---------------------------------------------------------------------------

/**
 * The founding CSI category population. The seed script (`scripts/
 * seed-v2-csi-blocklist.ts`) emits one `CsiCategoryRegistered` per entry; the
 * register projection is then the source of truth. The recon gate
 * (`recon:v2-csi-cross-tenant-gate`) asserts every category class in
 * `CSI_CATEGORY_CLASSES` is covered by an active blocklist entry, so this seed
 * cannot silently drop a class.
 *
 * Each entry carries the section-level competition-law basis from Owen's W7
 * note §5.1 ("Where the line is"). Counsel ratifies the taxonomy at the
 * licence-application moment (D-W7-VENDOR-ENTITY-STRUCTURE).
 */
export interface CsiSeedCategory {
  readonly categoryId: string;
  readonly categoryClass: CsiCategoryClass;
  readonly description: string;
  readonly lawBasis: string;
}

export const CSI_SEED_CATEGORIES: readonly CsiSeedCategory[] = [
  {
    categoryId: "csi:positions-exposures:trading-book",
    categoryClass: "positions-exposures",
    description:
      "A tenant's trading positions, exposures and volumes. Reveals market conduct and capacity; the canonical CSI class.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — concerted practice via a common supplier (hub-and-spoke); positions/volumes are the paradigm competitively-sensitive information. Owen W7 note §5.1.",
  },
  {
    categoryId: "csi:pricing-spreads:rates-margins",
    categoryClass: "pricing-spreads",
    description:
      "Pricing, rate data, margins and spreads. Direct price-coordination hazard if exchanged between competitors through the platform.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1)(b)(i) — price-fixing risk via information exchange. The SA forex matters make this no theoretical concern. Owen W7 note §5.1.",
  },
  {
    categoryId: "csi:client-counterparty-lists:identities",
    categoryClass: "client-counterparty-lists",
    description:
      "Client or counterparty identities, lists and data. Customer-allocation hazard; also POPIA personal information for natural-person clients.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1)(b)(ii) — division of markets / customer allocation. POPIA s.20–21 (operator duty, no personal information may generalise). Owen W7 note §5.1, §5.2.",
  },
  {
    categoryId: "csi:pnl:book-level",
    categoryClass: "pnl",
    description:
      "Profit-and-loss, revenue and margins by book. Reveals a competitor's profitability and pricing power.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — concerted practice; P&L reduces uncertainty about a competitor's market conduct. Owen W7 note §5.1.",
  },
  {
    categoryId: "csi:risk-appetite-calibrations:ras-thresholds",
    categoryClass: "risk-appetite-calibrations",
    description:
      "RAS thresholds and risk-appetite calibrations. A bank's risk appetite is strategy — it reveals where the bank will and will not compete.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — RAS calibrations are strategy and must never cross. Owen W7 note §5.1 ('risk-appetite calibrations ... a bank's RAS thresholds are strategy').",
  },
  {
    categoryId: "csi:model-calibrations:tenant-tuned-parameters",
    categoryClass: "model-calibrations",
    description:
      "Model calibrations and parameters tuned to a tenant's own book (as opposed to a published methodology). Reveals positioning and risk stance.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — book-tuned calibrations encode firm-attributable strategy. Distinct from the published FIL-Model methodology, which is not CSI. Owen W7 note §5.1.",
  },
  {
    categoryId: "csi:trade-level-data:tickets",
    categoryClass: "trade-level-data",
    description:
      "Individual trade records, tickets and granular flow. Recent, granular, firm-attributable data is CSI by construction.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — granular firm-attributable flow is the most sensitive class ('anything recent, granular, and firm-attributable'). Owen W7 note §5.1.",
  },
  {
    categoryId: "csi:strategy-plans:funding-product",
    categoryClass: "strategy-plans",
    description:
      "Funding plans, product-launch plans, capacity and forward strategy. Forward-looking strategy is the highest-sensitivity CSI.",
    lawBasis:
      "Competition Act 89 of 1998 s.4(1) — forward strategy / plans reduce a competitor's uncertainty about future conduct. Owen W7 note §5.1.",
  },
];
