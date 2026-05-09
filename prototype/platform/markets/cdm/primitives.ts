// platform/markets/cdm/primitives.ts
//
// CDM primitives — typed building blocks from which every product event
// composes. Hand-curated v1 slice. Full ISDA Common Domain Model upstream
// import (CDM JSON schema → generated TypeScript types) is the next-cycle
// work; v1 anchors the *shape* and the *Zod validation pattern* so the
// downstream consumers (Anya projections, Bea IFRS classifier) can build
// against a stable surface.
//
// Per CLAUDE.md Principle 5 (multi-currency / multi-entity / multi-country
// from day one) — every primitive that carries a monetary value carries
// its currency at the type level; every primitive that carries an entity
// carries the entity ID; every primitive that carries a date carries
// jurisdictional context where relevant.
//
// Author: Kai (trading systems engineer) · M1 build sequence per
// D-MARKETS-SCHEMA-FOUNDATION (CEO approved 2026-05-07).

import { z } from "zod";

// ---------------------------------------------------------------------------
// Identifier — every CDM object carries a stable, citable identifier.
// ---------------------------------------------------------------------------

export const identifierSchema = z.object({
  /** Identifier scheme: ISIN, CUSIP, internal trade-id, etc. */
  scheme: z.string().min(1),
  /** The identifier value within that scheme. */
  value: z.string().min(1),
});

export type Identifier = z.infer<typeof identifierSchema>;

// ---------------------------------------------------------------------------
// Party — counterparty / issuer / agent / clearing-member.
// ---------------------------------------------------------------------------

export const partySchema = z.object({
  /** Stable party identifier (LEI preferred; internal ID otherwise). */
  partyId: z.string().min(1),
  /** Display name. */
  name: z.string().min(1),
  /** Role this party plays in the event. */
  role: z.enum([
    "principal",
    "counterparty",
    "issuer",
    "agent",
    "clearing-member",
    "settlement-agent",
    "custodian",
  ]),
  /** Jurisdiction of the party (ISO-3166-1 alpha-2). */
  jurisdiction: z.string().length(2).optional(),
});

export type Party = z.infer<typeof partySchema>;

// ---------------------------------------------------------------------------
// Money — currency-tagged amount. Per Principle 5, no default currency.
// ---------------------------------------------------------------------------

export const moneySchema = z.object({
  /** ISO 4217 currency code (3-letter, uppercase). */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Amount in the smallest unit of the currency (cents for ZAR, etc.). */
  amountMinor: z.number().int(),
});

export type Money = z.infer<typeof moneySchema>;

// ---------------------------------------------------------------------------
// Quantity — typed unit + amount. Distinct from Money: shares, contracts, etc.
// ---------------------------------------------------------------------------

export const quantitySchema = z.object({
  /** Unit type — share / contract / notional-unit. */
  unit: z.enum(["share", "contract", "notional-unit", "bond-face", "lot"]),
  /** Quantity value. May be fractional for notional-unit. */
  amount: z.number(),
});

export type Quantity = z.infer<typeof quantitySchema>;

// ---------------------------------------------------------------------------
// Price — a value with a currency. Distinct from Money in that price is per-unit.
// ---------------------------------------------------------------------------

export const priceSchema = z.object({
  /** ISO 4217 currency code. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
  /** Price per unit in the major currency unit (e.g. ZAR per share). */
  amount: z.number(),
});

export type Price = z.infer<typeof priceSchema>;

// ---------------------------------------------------------------------------
// CdmDate — calendar-aware date. Per Principle 5, every date carries its
// calendar (jurisdictional holidays). v1 is ISO-8601 + a calendar tag;
// full holiday-calendar resolution lands at M2 with the bond cut-off work.
// ---------------------------------------------------------------------------

export const cdmDateSchema = z.object({
  /** ISO-8601 date (YYYY-MM-DD). */
  iso: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Calendar tag — JIHCAL (JSE holiday calendar) is the build-phase default. */
  calendar: z.enum(["JIHCAL", "TARGET", "NYC", "LDN", "JPY", "CME"]).default("JIHCAL"),
});

export type CdmDate = z.infer<typeof cdmDateSchema>;

// ---------------------------------------------------------------------------
// Instrument — a tradeable thing. Distinct from a trade event in that the
// instrument is the static record; the trade is what happens to it.
// ---------------------------------------------------------------------------

export const instrumentClassSchema = z.enum([
  "listed-equity",
  "listed-bond",
  "otc-irs",
  "fx-spot",
  "fx-forward",
  "fx-swap",
  "fx-ndf",
  "repo",
  "etf",
  "structured-note",
]);

export type InstrumentClass = z.infer<typeof instrumentClassSchema>;

export const instrumentSchema = z.object({
  /** Stable instrument identifier (ISIN preferred for listed). */
  identifier: identifierSchema,
  /** What kind of instrument this is — dispatch for projections. */
  class: instrumentClassSchema,
  /** Issuer (where applicable — equities, bonds, structured notes). */
  issuer: partySchema.optional(),
  /** Trading venue (where applicable). */
  venue: z.string().min(1).optional(),
  /** Native currency of the instrument. */
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/),
});

export type Instrument = z.infer<typeof instrumentSchema>;

// ---------------------------------------------------------------------------
// CurrencyPair — typed pair of ISO 4217 currency codes, expressed as the
// market-convention base/quote ordering. Per Principle 5 (multi-currency
// from day one), every FX trade carries its pair at the type level — there
// is no implicit "ZAR vs other" assumption baked into the substrate.
//
// Citations:
//   - ISDA-1998-FX-DEFINITIONS — base/quote convention.
//   - SARB-EXCON-MANUAL — ZAR as resident currency for FinSurv reporting.
// ---------------------------------------------------------------------------

export const currencyPairSchema = z
  .object({
    /** Base currency (ISO 4217). Convention: the unit currency in the quote. */
    base: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/),
    /** Quote currency (ISO 4217). Convention: the price currency in the quote. */
    quote: z
      .string()
      .length(3)
      .regex(/^[A-Z]{3}$/),
  })
  .refine((p) => p.base !== p.quote, {
    message: "currencyPair base and quote must differ",
  });

export type CurrencyPair = z.infer<typeof currencyPairSchema>;

// ---------------------------------------------------------------------------
// BookType — markets-vs-treasury book discriminator. Per
// `Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md` § D-FX-BOOK-BOUNDARY,
// this discriminator is set at execution time on FX `TradeExecuted` payloads
// from M4 onwards; reclassification across the boundary requires an explicit
// `TradeAmended` event with full audit trail (no post-hoc reclassification).
//
// Citations:
//   - D-FX-BOOK-BOUNDARY — explicit-tag-at-execution discipline.
//   - IFRS-9-CLASSIFICATION — Bea's IFRS dispatch reads `bookType`.
//   - PRINCIPLE-1-EVENTS-AS-TRUTH — no authoritative aggregates outside the
//     event log; the boundary lives on the typed payload, not in a
//     reconciliation-time election.
// ---------------------------------------------------------------------------

export const bookTypeSchema = z.enum(["trading", "banking-treasury"]);

export type BookType = z.infer<typeof bookTypeSchema>;
