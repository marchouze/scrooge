// v2-core/fil-instances/fx-conversion.ts
//
// BORN-V2 FX REALISATION event family (D-FX-REALISATION-COMPLETION-V1, Item 2).
//
// THE REALISATION POINT (CEO, 2026-06-25 → D-FX-PNL-FCY-EXPOSURE-REVALUATION)
// --------------------------------------------------------------------------
// Settlement (PR-FX-SETTLE-V2) is P&L-NEUTRAL: the FCY exposure stays OPEN, carried
// as FCY cash at its ZAR cost basis and revalued daily. REALISED P&L arises ONLY
// when that FCY cash is converted BACK to ZAR — the position is squared:
//
//   realised P&L = ZAR proceeds − ZAR cost basis of the FCY sold   (IAS 21 §28)
//
// The conversion posting logic (`postFxConversionLegs`, PR-FX-CONVERT-V2) has
// EXISTED since D-FX-PNL-FCY-EXPOSURE-REVALUATION — proven, balanced, IFRS-cited —
// but it was wired to NO lifecycle event: it was exercised only by recon harnesses
// and the leg-structure registry. So realised P&L was never struck end-to-end
// (Nadia's Lane-4b residual: "FxConversionExecuted is not wired"). This event is
// the missing trigger.
//
// `FxConversionExecuted` is the ASSET-CLASS-AGNOSTIC carrier of ONE realisation:
// a held FCY cash position (a `cash` FIL instance) is converted back to the
// reporting currency at a conversion rate, striking realised P&L and CLOSING the
// FCY cash position (the fold emits the position-closing `FilInstrumentTerminated`
// on the cash instance). It carries BOTH the converted FCY amount AND the ZAR
// proceeds AND the ZAR cost basis it draws the cash down at — the (proceeds, cost)
// pair IS the realised result a bare cash-out would drop (IAS 21 §28). It mirrors
// the `TradeSettlementExecuted` design (the uniform single-asset settlement model)
// — a conversion is the realisation analogue of a settlement.
//
// WHY A DISTINCT EVENT (not a TradeSettlementExecuted)
// ----------------------------------------------------
// A settlement is P&L-NEUTRAL (change of FORM); a conversion REALISES P&L (change
// of EXPOSURE — the position is squared). They post DIFFERENT rules
// (PR-FX-SETTLE-V2 vs PR-FX-CONVERT-V2) and reach DIFFERENT accounts (settlement
// never touches realised P&L; conversion strikes ACC-2100-006 and reclassifies the
// cumulative unrealised out of ACC-2100-005). Conflating them would lose that
// distinction — the very error D-FX-PNL-FCY-EXPOSURE-REVALUATION corrected.
//
// PACKAGE BOUNDARY: inside `v2-core/` — NO imports from `platform/`, `runtime/`,
// `domains/` (enforced by `recon:v2-no-v1-import`). The v1-side registry wiring
// imports FROM here, never vice-versa.
//
// Authority: D-FX-REALISATION-COMPLETION-V1 (CEO-approved); refines
//   D-FX-PNL-FCY-EXPOSURE-REVALUATION (the conversion realises the FCY exposure);
//   D-FX-SETTLEMENT-REALISATION-V1; D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-
//   UNIFICATION; D-ENGINEERING-INTEGRITY-CHARTER (root-cause; fail-closed;
//   source-don't-duplicate; replay-safe & append-only). Principle 1; Principle 5.
// Cites: IAS 21 §28 (settlement-date realised FX); IFRS 9 §5.7.1 (reclassify
//   cumulative unrealised → realised on realisation).
// Author: Kai (Trading systems engineer, engineering — Lane 5a).

import { z } from "zod";
import { instantSchema, moneySchema } from "../fil-core/primitives";
import { filInstanceUrnSchema } from "../fil-core/urn";
import { filOriginatingEventRefSchema } from "./events";

// ---------------------------------------------------------------------------
// The FX-conversion (realisation) payload. Every monetary field is decimal-native
// MAJOR-unit Money in its stated currency. The (zarProceeds, zarCostBasis) pair is
// what carries IAS 21 §28 realised P&L — a bare "FCY cash out" would drop it.
// ---------------------------------------------------------------------------

export const fxConversionExecutedPayloadSchema = z.object({
  kind: z.literal("FxConversionExecuted"),
  /**
   * The FIL URN of the FCY CASH holding being converted (the `<tradeId>-cash-
   * <side>` instance materialised at settlement). The fold draws this position
   * down and — on a FULL conversion — emits `FilInstrumentTerminated` against it
   * to close it. Principle 2: the single-graph link from a realisation back to the
   * position it squares is explicit.
   */
  cashInstance: filInstanceUrnSchema,
  /**
   * The FCY (the currency being SOLD back to the reporting currency), ISO-4217.
   * Must equal the cash holding's denomination currency.
   */
  fcyCurrency: z.string().min(1),
  /**
   * The reporting (functional) currency the proceeds are received in (typically
   * ZAR). The realised result is struck in this currency.
   */
  reportingCurrency: z.string().min(1),
  /**
   * The FCY amount converted, POSITIVE major-unit Money in the FCY (its OWN
   * currency). A partial conversion converts less than the full holding; the
   * fold closes the position only on a full conversion.
   */
  fcyAmount: moneySchema,
  /** ZAR (reporting-ccy) proceeds RECEIVED for the FCY, positive major-unit Money. */
  zarProceeds: moneySchema,
  /**
   * ZAR (reporting-ccy) COST BASIS of the FCY sold — the booked ZAR given up to
   * acquire it (read off the cash holding's `zarCostBasis`). The realised result
   * is `zarProceeds − zarCostBasis` (signed), IAS 21 §28.
   */
  zarCostBasis: moneySchema,
  /**
   * Cumulative UNREALISED P&L accrued on this exposure to date, SIGNED major-unit
   * Money in the reporting currency (+ gain sat as a credit in ACC-2100-005).
   * RECLASSIFIED into realised on conversion so total P&L is unchanged (IFRS 9
   * §5.7.1). Pass amount "0" when none has accrued or is un-measured.
   */
  accumulatedUnrealised: moneySchema,
  /** Whether this conversion squares the WHOLE remaining FCY holding (closes it). */
  fullConversion: z.boolean(),
  /** The tenant axis (S2) — anchor tenant for the anchor book. */
  tenant: z.string().min(1),
  /** ISO-8601 instant the conversion takes effect (the realisation as-of). */
  asOf: instantSchema,
  /** The canonical originating event of record this realisation renders (Principle 1). */
  originatingEvent: filOriginatingEventRefSchema,
});

export type FxConversionExecutedPayload = z.infer<typeof fxConversionExecutedPayloadSchema>;

// ---------------------------------------------------------------------------
// The registered event kind list. ONE born-V2 kind in this family today; the set
// is a list so adding a sibling (e.g. a conversion-reversal) later is additive.
// ---------------------------------------------------------------------------

export const FX_CONVERSION_EVENT_KINDS = ["FxConversionExecuted"] as const;

export type FxConversionEventKind = (typeof FX_CONVERSION_EVENT_KINDS)[number];
