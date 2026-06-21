// v2-core/desk/events.ts
//
// FRTB trading-desk register — event types, the DeskBookType / DeskKind
// vocabularies, the typed desk-definition shape (compliance-by-construction),
// and the three event payloads that constitute the desk-register lifecycle.
//
//   DeskRegistered       — a new desk enters the register (founding event).
//   DeskAttributeChanged — a registered desk's mutable attributes are revised.
//   DeskRetired          — a desk is retired (status → "retired").
//
// FRTB COMPLIANCE-BY-CONSTRUCTION (MAR12 qualitative desk-definition
// requirements). The MAR12 desk-definition attributes are ALL REQUIRED on a
// `DeskRegistered` payload — a desk cannot be registered missing any of them:
//   - deskName, deskKind, bookType
//   - businessStrategy (documented mandate, non-empty)
//   - deskHeadSeat (a seat Title only — never a personal name; V2 UI convention)
//   - reportingLine (the senior-management seat Title the desk reports to)
//   - riskManagementStructure (typed, with at least one explicit trading limit)
//   - status + effectiveFrom
// The Zod schema below FAILS CLOSED on any missing attribute. The full FRTB IMA
// quantitative machinery (P&L attribution, backtesting zones, desk-level
// capital) is OUT OF SCOPE here — the bank is on the standardised approach
// (BA-320) pre-licence. That is a tracked deferred gap, not a silent omission.
//
// BOOK-BOUNDARY REUSE (D-FX-BOOK-BOUNDARY). The `bookType` discriminator reuses
// the existing trading/banking value-set — `"trading" | "banking-treasury"` —
// the SAME two literals the v1 `bookTypeSchema`
// (platform/markets/cdm/primitives.ts) carries. The v2 package has a HARD
// no-v1-import boundary (`recon:v2-no-v1-import`), so the value-set is
// re-declared here (never imported from `platform/`), structurally identical so
// a v1 FX trade's `bookType` and a desk's `bookType` compare cleanly across the
// boundary. NO new book discriminator is minted.
//
// PACKAGE BOUNDARY: this file is inside `v2-core/` and MUST NOT import from any
// v1 code-line directory (`platform/`, `runtime/`, `domains/`, …). The only
// external dependencies permitted are bare npm packages (`zod`) and other
// `v2-core/` modules. See `recon:v2-no-v1-import`.
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21);
//   D-FX-BOOK-BOUNDARY (book discriminator); D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:frtb-compliant-trading-desk-structure-simulator-:2026-06-21
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";
import { type Instant, instantSchema } from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// DeskKind vocabulary
// ---------------------------------------------------------------------------

/**
 * The closed set of desk kinds at the FRTB-desk Slice 1 contract.
 *
 *   trading-desk  — a market-making / proprietary trading-book desk.
 *   hedging-desk  — a desk that hedges trading-book market risk.
 *   treasury-desk — a banking-book funding / liquidity / ALM / IRRBB desk.
 *
 * Extensible via new event registration (Principle 1); a closed enum here is
 * the minimum compliance contract.
 */
export const DESK_KINDS = ["trading-desk", "hedging-desk", "treasury-desk"] as const;

export type DeskKind = (typeof DESK_KINDS)[number];
export const deskKindSchema = z.enum(DESK_KINDS);

// ---------------------------------------------------------------------------
// DeskBookType — the trading/banking-book discriminator (D-FX-BOOK-BOUNDARY).
// ---------------------------------------------------------------------------

/**
 * The trading/banking-book discriminator. REUSES the existing
 * `D-FX-BOOK-BOUNDARY` value-set — the SAME two literals the v1
 * `bookTypeSchema` carries (`"trading" | "banking-treasury"`). Re-declared (not
 * imported) only because of the v2 no-v1-import boundary; structurally
 * identical so a v1 FX trade's `bookType` and a desk's `bookType` compare
 * cleanly. This is the FRTB trading/banking-book boundary axis.
 */
export const DESK_BOOK_TYPES = ["trading", "banking-treasury"] as const;

export type DeskBookType = (typeof DESK_BOOK_TYPES)[number];
export const deskBookTypeSchema = z.enum(DESK_BOOK_TYPES);

// ---------------------------------------------------------------------------
// DeskId URN
// ---------------------------------------------------------------------------

/**
 * A desk identifier URN: `urn:desk:<kind>:<slug>` where `<kind>` is a
 * `DeskKind` and `<slug>` is a lowercase-alphanumeric-hyphen slug. The URN is
 * the stable, citable key for a desk in the single graph (Principle 2).
 */
export type DeskId = string & { readonly __brand: "v2.DeskId" };

const DESK_ID_RE = /^urn:desk:(trading-desk|hedging-desk|treasury-desk):[a-z0-9][a-z0-9-]*$/;

export const deskIdSchema = z
  .string()
  .regex(DESK_ID_RE, {
    message:
      "DeskId must be a URN of the form urn:desk:<kind>:<slug> " +
      "(kind ∈ {trading-desk, hedging-desk, treasury-desk}; slug = lowercase alnum/hyphen)",
  })
  .transform((s) => s as DeskId);

/** Construct a DeskId URN from a kind + slug (validated, fail-closed). */
export function makeDeskId(kind: DeskKind, slug: string): DeskId {
  return deskIdSchema.parse(`urn:desk:${kind}:${slug}`);
}

/** Extract the `DeskKind` segment from a well-formed DeskId. */
export function deskKindOf(deskId: string): DeskKind | null {
  const m = DESK_ID_RE.exec(deskId);
  return m ? (m[1] as DeskKind) : null;
}

// ---------------------------------------------------------------------------
// Trading limit — the explicit risk-control MAR12 requires.
// ---------------------------------------------------------------------------

/**
 * A single trading limit on a desk's risk-management structure. MAR12 requires
 * a clear risk-management structure with explicit limits; this is the typed
 * carrier. The `limitKind` names what is constrained; the threshold is a
 * currency-typed amount (decimal-native MAJOR units, never a bare number) per
 * Principle 5.
 */
export const DESK_LIMIT_KINDS = [
  "net-open-position", // FX/overall net open position limit
  "value-at-risk", // VaR limit
  "stop-loss", // cumulative stop-loss limit
  "notional", // gross notional limit
  "sensitivity", // greeks / DV01 sensitivity limit
] as const;

export type DeskLimitKind = (typeof DESK_LIMIT_KINDS)[number];
export const deskLimitKindSchema = z.enum(DESK_LIMIT_KINDS);

export interface DeskTradingLimit {
  readonly limitKind: DeskLimitKind;
  /** ISO-4217 alpha-3 currency the threshold is denominated in. */
  readonly currency: string;
  /** Threshold amount — canonical decimal string in MAJOR units (never a number). */
  readonly thresholdAmount: string;
  /** Human-readable description of what the limit constrains. */
  readonly description: string;
}

const DECIMAL_STRING = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$|^-?0?\.\d+$/;

export const deskTradingLimitSchema: z.ZodType<DeskTradingLimit> = z
  .object({
    limitKind: deskLimitKindSchema,
    currency: z.string().length(3),
    thresholdAmount: z.string().refine((s) => DECIMAL_STRING.test(s.trim()), {
      message: "thresholdAmount must be a canonical decimal string (major units), never a number",
    }),
    description: z.string().min(1),
  })
  .strict();

/**
 * A desk's risk-management structure. MAR12 requires a clear risk-management
 * structure WITH at least one explicit trading limit — so `tradingLimits` is
 * `.min(1)` (fail-closed: a desk with no limit cannot be registered).
 */
export interface DeskRiskManagementStructure {
  /** The senior risk seat (Title only) that owns the desk's risk oversight. */
  readonly riskOwnerSeat: string;
  /** At least one explicit trading limit (MAR12 — non-empty). */
  readonly tradingLimits: readonly DeskTradingLimit[];
}

export const deskRiskManagementStructureSchema: z.ZodType<DeskRiskManagementStructure> = z
  .object({
    riskOwnerSeat: z.string().min(1),
    tradingLimits: z.array(deskTradingLimitSchema).min(1, {
      message:
        "riskManagementStructure must carry at least one explicit trading limit (FRTB MAR12)",
    }),
  })
  .strict();

// ---------------------------------------------------------------------------
// Desk status
// ---------------------------------------------------------------------------

export const DESK_STATUSES = ["active", "retired"] as const;
export type DeskStatus = (typeof DESK_STATUSES)[number];
export const deskStatusSchema = z.enum(DESK_STATUSES);

// ---------------------------------------------------------------------------
// DeskRegistered payload — the founding event (MAR12 desk definition).
// ---------------------------------------------------------------------------

/**
 * `DeskRegistered` — a new desk enters the register. Carries the FULL MAR12
 * desk-definition attribute set, ALL REQUIRED (compliance-by-construction).
 *
 *   deskId                  — the desk URN (encodes deskKind in its 3rd segment).
 *   deskName                — human-readable desk name.
 *   deskKind                — trading-desk | hedging-desk | treasury-desk.
 *   bookType                — trading | banking-treasury (D-FX-BOOK-BOUNDARY).
 *   businessStrategy        — documented mandate (non-empty).
 *   deskHeadSeat            — desk-head SEAT TITLE only (never a personal name).
 *   reportingLine           — senior-management seat Title the desk reports to.
 *   riskManagementStructure — typed, with ≥1 explicit trading limit.
 *   status                  — active | retired.
 *   effectiveFrom           — ISO-8601 instant the desk becomes effective.
 *   citations               — Principle 2 upward citations (≥1).
 *
 * INVARIANT (schema refinement): the deskId's kind segment MUST equal
 * `deskKind`, and `(deskKind, bookType)` must be coherent — a trading-desk or
 * hedging-desk is trading-book; a treasury-desk is banking-treasury-book. This
 * is the FRTB boundary integrity rule expressed at the type level.
 */
export interface DeskRegisteredPayload {
  readonly deskId: DeskId;
  readonly deskName: string;
  readonly deskKind: DeskKind;
  readonly bookType: DeskBookType;
  readonly businessStrategy: string;
  readonly deskHeadSeat: string;
  readonly reportingLine: string;
  readonly riskManagementStructure: DeskRiskManagementStructure;
  readonly status: DeskStatus;
  readonly effectiveFrom: Instant;
  readonly citations: readonly string[];
}

/**
 * The coherent `(deskKind, bookType)` pairing. A trading-desk and a hedging-desk
 * both take trading-book risk; a treasury-desk is a banking-book desk. This map
 * is the single source of the FRTB boundary integrity rule and is reused by the
 * FX-trade refinement (a trading-book trade must book to a trading-book desk).
 */
export const DESK_KIND_BOOK_TYPE: Readonly<Record<DeskKind, DeskBookType>> = {
  "trading-desk": "trading",
  "hedging-desk": "trading",
  "treasury-desk": "banking-treasury",
};

export const deskRegisteredPayloadSchema: z.ZodType<DeskRegisteredPayload> = z
  .object({
    deskId: deskIdSchema,
    deskName: z.string().min(1),
    deskKind: deskKindSchema,
    bookType: deskBookTypeSchema,
    businessStrategy: z.string().min(1),
    deskHeadSeat: z.string().min(1),
    reportingLine: z.string().min(1),
    riskManagementStructure: deskRiskManagementStructureSchema,
    status: deskStatusSchema,
    effectiveFrom: instantSchema,
    citations: z.array(z.string().min(1)).min(1, {
      message: "DeskRegistered requires at least one citation (Principle 2)",
    }),
  })
  .strict()
  .superRefine((data, ctx) => {
    // The deskId's kind segment must equal the declared deskKind.
    const urnKind = deskKindOf(data.deskId);
    if (urnKind !== data.deskKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deskId"],
        message: `deskId kind segment '${urnKind}' must equal deskKind '${data.deskKind}'`,
      });
    }
    // (deskKind, bookType) coherence — the FRTB boundary integrity rule.
    const expectedBook = DESK_KIND_BOOK_TYPE[data.deskKind];
    if (data.bookType !== expectedBook) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bookType"],
        message:
          `deskKind '${data.deskKind}' requires bookType '${expectedBook}', ` +
          `got '${data.bookType}' (FRTB trading/banking-book boundary; D-FX-BOOK-BOUNDARY)`,
      });
    }
  }) as z.ZodType<DeskRegisteredPayload>;

export const DESK_REGISTERED = "DeskRegistered" as const;

// ---------------------------------------------------------------------------
// DeskAttributeChanged payload — revise a registered desk's mutable attributes.
// ---------------------------------------------------------------------------

/**
 * `DeskAttributeChanged` — revise the mutable attributes of a registered desk.
 * Identity attributes (deskId, deskKind, bookType) are IMMUTABLE — they are not
 * present in `revisedFields` (changing a desk's book or kind is a retire +
 * re-register, never an in-place mutation). Each revised field is optional;
 * present fields overwrite, absent fields are unchanged.
 */
export interface DeskAttributeChangedPayload {
  readonly deskId: DeskId;
  readonly revisedFields: {
    readonly deskName?: string;
    readonly businessStrategy?: string;
    readonly deskHeadSeat?: string;
    readonly reportingLine?: string;
    readonly riskManagementStructure?: DeskRiskManagementStructure;
  };
  readonly revisedAt: Instant;
  readonly authority: string;
  readonly citations: readonly string[];
}

export const deskAttributeChangedPayloadSchema: z.ZodType<DeskAttributeChangedPayload> = z
  .object({
    deskId: deskIdSchema,
    revisedFields: z
      .object({
        deskName: z.string().min(1).optional(),
        businessStrategy: z.string().min(1).optional(),
        deskHeadSeat: z.string().min(1).optional(),
        reportingLine: z.string().min(1).optional(),
        riskManagementStructure: deskRiskManagementStructureSchema.optional(),
      })
      .strict(),
    revisedAt: instantSchema,
    authority: z.string().min(1),
    citations: z.array(z.string().min(1)).min(1),
  })
  .strict() as z.ZodType<DeskAttributeChangedPayload>;

export const DESK_ATTRIBUTE_CHANGED = "DeskAttributeChanged" as const;

// ---------------------------------------------------------------------------
// DeskRetired payload — retire a desk (status → "retired").
// ---------------------------------------------------------------------------

export interface DeskRetiredPayload {
  readonly deskId: DeskId;
  readonly retiredAt: Instant;
  readonly reason: string;
  readonly authority: string;
  readonly citations: readonly string[];
}

export const deskRetiredPayloadSchema: z.ZodType<DeskRetiredPayload> = z
  .object({
    deskId: deskIdSchema,
    retiredAt: instantSchema,
    reason: z.string().min(1),
    authority: z.string().min(1),
    citations: z.array(z.string().min(1)).min(1),
  })
  .strict() as z.ZodType<DeskRetiredPayload>;

export const DESK_RETIRED = "DeskRetired" as const;

// ---------------------------------------------------------------------------
// Event type name set
// ---------------------------------------------------------------------------

export const DESK_EVENT_TYPES = [DESK_REGISTERED, DESK_ATTRIBUTE_CHANGED, DESK_RETIRED] as const;

export type DeskEventType = (typeof DESK_EVENT_TYPES)[number];
