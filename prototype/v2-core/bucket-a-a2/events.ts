// v2-core/bucket-a-a2/events.ts
//
// Wave 2 Bucket-A batch-A2 — the v2-native payload SCHEMAS + store-tee CODECS
// for the nine EMITTABLE numeric-money, non-financial event types.
//
// These nine V1 types carry money as a PLAIN numeric field (not `*Minor`), so
// they are NOT blocked by `recon:no-residual-minor-encoding` and stay emittable
// on main. They dual-write via the generic store-tee: every V1 append is
// mirrored into the v2 control-plane store, with the money field LIFTED to the
// decimal-native `MoneyWire` shape by the per-type codec below. The V1 source
// row keeps its legacy numeric shape; the v2 mirror holds the canonical decimal.
// `recon:bucket-a-a2-v2-parity` proves the v2 store payload equals
// `codec(v1 payload)` on the DECODED decimal value.
//
// WHY V2-NATIVE SCHEMAS (not import the V1 schemas): v2-core has a HARD
// no-v1-import boundary (`recon:v2-no-v1-import`). The V1 schemas under
// `platform/event-store/event-types/**` cannot be imported here, so the money-
// bearing fields are re-declared as `MoneyWire` (the rest of each payload is
// re-declared structurally identical to its V1 source). The control-plane store
// validates the MIRRORED (post-codec) payload against these schemas.
//
// ── PER-TYPE MONEY FIELD + CURRENCY SOURCE (Charter cmd 4 — source, don't
//    hardcode; Principle 5 — multi-currency at the type level) ──────────────
//
//   1. ClimateScenarioRun
//        money: portfolioSnapshot.totalExposureZAR, .carbonIntensiveExposureZAR,
//               stressLossZAR (all MAJOR-unit z.number().nonnegative()).
//        currency SOURCE: ZAR by the field-name `*ZAR` suffix — the schema
//               DENOMINATES these fields in ZAR. No payload currency field; this
//               is a declared denomination, not a `?? "ZAR"` fallback.
//   2. FeeDisclosureEvent
//        money: notional, feeAmount (nullable) (MAJOR-unit z.number()).
//        currency SOURCE: payload `currency` (FAIS fee disclosed in the trade
//               currency). feeAmount may be null (fee expressed as spreadBps).
//   3. CorrespondentSettlementInstructionSent
//        money: instructedAmount (MINOR-unit z.number().int().positive()).
//        currency SOURCE: payload `currency` (ISO 4217 on the pacs.008/009).
//   4. NostroStatementReceived
//        money: closingBalance (MINOR-unit z.number().int(); may be negative).
//        currency SOURCE: payload `currency` (the nostro account currency).
//   5. CounterpartyExposureCalculated
//        money: grossExposure, netExposure, collateralHeld, uncoveredExposure
//               (all MINOR-unit ZAR cents z.number().int().nonnegative()).
//        currency SOURCE: ZAR by the schema documentation ("in ZAR minor units").
//               No payload currency field; declared denomination, not a fallback.
//   6. STRCandidate
//        money: amount (MAJOR-unit z.number().positive()).
//        currency SOURCE: payload `currency`.
//   7. RelatedPartyTransactionProposed
//        money: amount (MAJOR-unit z.number().positive()).
//        currency SOURCE: payload `currency`.
//   8. InterEntityTransactionProposed
//        money: amount (MAJOR-unit z.number().positive()).
//        currency SOURCE: payload `currency`.
//   9. PAIARequest
//        money: fee (optional MAJOR-unit z.number().nonnegative()).
//        currency SOURCE: ZAR by the statutory PAIA fee regime (Promotion of
//               Access to Information Act 2 of 2000 — the bank's only PAIA
//               jurisdiction is South Africa; the prescribed fee is a ZAR
//               amount). No payload currency field; sourced from the regime,
//               not a fallback default.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16);
//   D-V2-CORE-MONEY-DECIMAL-NATIVE (MoneyWire MAJOR-unit).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-a-a2-emittable-numeric-money-types:2026-06-16.
// Principle 1 (events are truth); Principle 5 (multi-currency at the type level).
// Author: Atlas (Core banking platform architect, engineering).

import { z } from "zod";

import type { V2TeeCodec } from "../registry/types";
import { moneyWireFromMajorNumber, moneyWireFromMinorNumber, moneyWireSchema } from "./money-wire";

// ---------------------------------------------------------------------------
// Shared MoneyWire Zod schema (re-exported from money-wire.ts — the single
// reusable control-plane money primitive; see V2RiskAppetiteSet.floor too).
// ---------------------------------------------------------------------------

/**
 * Read a required numeric money field from a V1 payload, failing CLOSED if it
 * is missing or not a number (the V1 schema guarantees it, but the codec must
 * not silently coerce a bad value).
 */
function requireNumber(payload: Record<string, unknown>, field: string): number {
  const v = payload[field];
  if (typeof v !== "number") {
    throw new Error(
      `bucket-a-a2 codec: expected numeric money field "${field}" on the V1 payload, got ${typeof v}. The V1 schema requires it; a non-number is a malformed event (fail-closed).`,
    );
  }
  return v;
}

/** Read a required currency string, failing CLOSED if absent. */
function requireCurrency(payload: Record<string, unknown>, field: string): string {
  const v = payload[field];
  if (typeof v !== "string" || v.length === 0) {
    throw new Error(
      `bucket-a-a2 codec: expected a non-empty currency string at "${field}" on the V1 payload, got ${typeof v}. Currency must be sourced from the payload (Charter cmd 4), never defaulted (fail-closed).`,
    );
  }
  return v;
}

// ---------------------------------------------------------------------------
// 1. ClimateScenarioRun — *ZAR field-name denomination; MAJOR units.
// ---------------------------------------------------------------------------

export const climateScenarioRunV2PayloadSchema = z.object({
  scenarioId: z.string().min(1),
  scenarioName: z.string().min(1),
  runDate: z.string().min(1),
  portfolioSnapshot: z.object({
    totalExposureZAR: moneyWireSchema,
    carbonIntensiveExposureZAR: moneyWireSchema,
    carbonIntensivePct: z.number().min(0).max(100),
  }),
  stressLossZAR: moneyWireSchema,
  scenarioHorizonYears: z.number().int().positive(),
  authority: z.literal("D-RAS-CLIMATE-SCENARIO-FRAMEWORK"),
});

const CLIMATE_CCY = "ZAR" as const; // field-name `*ZAR` declared denomination.

export const climateScenarioRunCodec: V2TeeCodec = (p) => {
  const snap = p.portfolioSnapshot as Record<string, unknown>;
  return {
    ...p,
    portfolioSnapshot: {
      ...snap,
      totalExposureZAR: moneyWireFromMajorNumber(
        requireNumber(snap, "totalExposureZAR"),
        CLIMATE_CCY,
      ),
      carbonIntensiveExposureZAR: moneyWireFromMajorNumber(
        requireNumber(snap, "carbonIntensiveExposureZAR"),
        CLIMATE_CCY,
      ),
    },
    stressLossZAR: moneyWireFromMajorNumber(requireNumber(p, "stressLossZAR"), CLIMATE_CCY),
  };
};

// ---------------------------------------------------------------------------
// 2. FeeDisclosureEvent — payload `currency`; MAJOR units; feeAmount nullable.
// ---------------------------------------------------------------------------

export const feeDisclosureEventV2PayloadSchema = z.object({
  counterpartyId: z.string(),
  instrument: z.string(),
  notional: moneyWireSchema,
  currency: z.string(),
  spreadBps: z.number().nullable(),
  feeAmount: moneyWireSchema.nullable(),
  disclosureMethod: z.enum(["pre-trade", "term-sheet", "fee-schedule"]),
  disclosedAt: z.string(),
});

export const feeDisclosureEventCodec: V2TeeCodec = (p) => {
  const ccy = requireCurrency(p, "currency");
  const feeAmount = p.feeAmount;
  return {
    ...p,
    notional: moneyWireFromMajorNumber(requireNumber(p, "notional"), ccy),
    feeAmount:
      feeAmount === null ? null : moneyWireFromMajorNumber(requireNumber(p, "feeAmount"), ccy),
  };
};

// ---------------------------------------------------------------------------
// 3. CorrespondentSettlementInstructionSent — payload `currency`; MINOR units.
// ---------------------------------------------------------------------------

export const correspondentSettlementInstructionSentV2PayloadSchema = z.object({
  msgId: z.string().min(1),
  creditorBIC: z.string().min(8).max(11),
  instructedAmount: moneyWireSchema,
  currency: z.string().length(3),
  settlementDate: z.string(),
  endToEndId: z.string().min(1).max(35),
});

export const correspondentSettlementInstructionSentCodec: V2TeeCodec = (p) => {
  const ccy = requireCurrency(p, "currency");
  return {
    ...p,
    instructedAmount: moneyWireFromMinorNumber(requireNumber(p, "instructedAmount"), ccy),
  };
};

// ---------------------------------------------------------------------------
// 4. NostroStatementReceived — payload `currency`; MINOR units (may be negative).
// ---------------------------------------------------------------------------

export const nostroStatementReceivedV2PayloadSchema = z.object({
  accountId: z.string().min(1),
  asOf: z.string(),
  closingBalance: moneyWireSchema,
  currency: z.string().length(3),
  entryCount: z.number().int().nonnegative(),
});

export const nostroStatementReceivedCodec: V2TeeCodec = (p) => {
  const ccy = requireCurrency(p, "currency");
  return {
    ...p,
    closingBalance: moneyWireFromMinorNumber(requireNumber(p, "closingBalance"), ccy),
  };
};

// ---------------------------------------------------------------------------
// 5. CounterpartyExposureCalculated — ZAR schema-doc denomination; MINOR units.
// ---------------------------------------------------------------------------

export const counterpartyExposureCalculatedV2PayloadSchema = z.object({
  counterpartyId: z.string().min(1),
  exposureType: z.enum(["pre-settlement", "settlement", "issuer", "replacement-cost"]),
  grossExposure: moneyWireSchema,
  netExposure: moneyWireSchema,
  nettingAgreementId: z.string().min(1).optional(),
  collateralHeld: moneyWireSchema,
  uncoveredExposure: moneyWireSchema,
  limitUtilisationPct: z.number().min(0),
  breached: z.boolean(),
  calculatedAt: z.string().min(1),
});

const COUNTERPARTY_CCY = "ZAR" as const; // schema-documented "ZAR minor units".

export const counterpartyExposureCalculatedCodec: V2TeeCodec = (p) => ({
  ...p,
  grossExposure: moneyWireFromMinorNumber(requireNumber(p, "grossExposure"), COUNTERPARTY_CCY),
  netExposure: moneyWireFromMinorNumber(requireNumber(p, "netExposure"), COUNTERPARTY_CCY),
  collateralHeld: moneyWireFromMinorNumber(requireNumber(p, "collateralHeld"), COUNTERPARTY_CCY),
  uncoveredExposure: moneyWireFromMinorNumber(
    requireNumber(p, "uncoveredExposure"),
    COUNTERPARTY_CCY,
  ),
});

// ---------------------------------------------------------------------------
// 6. STRCandidate — payload `currency`; MAJOR units.
// ---------------------------------------------------------------------------

export const strCandidateV2PayloadSchema = z.object({
  candidateId: z.string().min(1),
  transactionRef: z.string().min(1),
  flaggedBy: z.string().min(1),
  flaggedAt: z.string().min(1),
  amount: moneyWireSchema,
  currency: z.string().min(3).max(3),
  suspicionBasis: z.string().min(1),
  mlroReviewRequired: z.boolean(),
});

export const strCandidateCodec: V2TeeCodec = (p) => ({
  ...p,
  amount: moneyWireFromMajorNumber(requireNumber(p, "amount"), requireCurrency(p, "currency")),
});

// ---------------------------------------------------------------------------
// 7. RelatedPartyTransactionProposed — payload `currency`; MAJOR units.
// ---------------------------------------------------------------------------

export const relatedPartyTransactionProposedV2PayloadSchema = z.object({
  proposalId: z.string().min(1),
  relatedPartyRef: z.string().min(1),
  transactionDescription: z.string().min(1),
  amount: moneyWireSchema,
  currency: z.string().min(3).max(3),
  proposedAt: z.string().min(1),
  companiesActSection: z.string().optional(),
  boardApprovalRequired: z.boolean(),
});

export const relatedPartyTransactionProposedCodec: V2TeeCodec = (p) => ({
  ...p,
  amount: moneyWireFromMajorNumber(requireNumber(p, "amount"), requireCurrency(p, "currency")),
});

// ---------------------------------------------------------------------------
// 8. InterEntityTransactionProposed — payload `currency`; MAJOR units.
// ---------------------------------------------------------------------------

export const interEntityTransactionProposedV2PayloadSchema = z.object({
  proposalId: z.string().min(1),
  fromEntity: z.string().min(1),
  toEntity: z.string().min(1),
  transactionKind: z.string().min(1),
  amount: moneyWireSchema,
  currency: z.string().min(3).max(3),
  proposedAt: z.string().min(1),
  transferPricingRequired: z.boolean(),
  approvalRequired: z.boolean(),
});

export const interEntityTransactionProposedCodec: V2TeeCodec = (p) => ({
  ...p,
  amount: moneyWireFromMajorNumber(requireNumber(p, "amount"), requireCurrency(p, "currency")),
});

// ---------------------------------------------------------------------------
// 9. PAIARequest — statutory ZAR PAIA fee; MAJOR units; fee optional.
// ---------------------------------------------------------------------------

export const paiaRequestV2PayloadSchema = z.object({
  requestId: z.string().min(1),
  requesterRef: z.string().min(1),
  receivedAt: z.string().min(1),
  informationDescription: z.string().min(1),
  responseDeadline: z.string().min(1),
  assignedTo: z.string().optional(),
  fee: moneyWireSchema.optional(),
});

const PAIA_CCY = "ZAR" as const; // statutory PAIA fee regime (PAIA 2 of 2000), ZA.

export const paiaRequestCodec: V2TeeCodec = (p) => {
  if (p.fee === undefined) return { ...p };
  return {
    ...p,
    fee: moneyWireFromMajorNumber(requireNumber(p, "fee"), PAIA_CCY),
  };
};

// ---------------------------------------------------------------------------
// Batch manifest — the nine types + their (schema, codec) pairs. Consumed by the
// registry rows and the parity gate so there is ONE source of truth for the set.
// ---------------------------------------------------------------------------

export interface BucketAA2TypeSpec {
  readonly type: string;
  readonly cls: "runtime" | "markets" | "governance" | "audit";
  readonly schema: z.ZodTypeAny;
  readonly codec: V2TeeCodec;
}

export const BUCKET_A_A2_SPECS: readonly BucketAA2TypeSpec[] = [
  {
    type: "ClimateScenarioRun",
    cls: "governance",
    schema: climateScenarioRunV2PayloadSchema,
    codec: climateScenarioRunCodec,
  },
  {
    type: "FeeDisclosureEvent",
    cls: "governance",
    schema: feeDisclosureEventV2PayloadSchema,
    codec: feeDisclosureEventCodec,
  },
  {
    type: "CorrespondentSettlementInstructionSent",
    cls: "markets",
    schema: correspondentSettlementInstructionSentV2PayloadSchema,
    codec: correspondentSettlementInstructionSentCodec,
  },
  {
    type: "NostroStatementReceived",
    cls: "markets",
    schema: nostroStatementReceivedV2PayloadSchema,
    codec: nostroStatementReceivedCodec,
  },
  {
    type: "CounterpartyExposureCalculated",
    cls: "markets",
    schema: counterpartyExposureCalculatedV2PayloadSchema,
    codec: counterpartyExposureCalculatedCodec,
  },
  {
    type: "STRCandidate",
    cls: "audit",
    schema: strCandidateV2PayloadSchema,
    codec: strCandidateCodec,
  },
  {
    type: "RelatedPartyTransactionProposed",
    cls: "governance",
    schema: relatedPartyTransactionProposedV2PayloadSchema,
    codec: relatedPartyTransactionProposedCodec,
  },
  {
    type: "InterEntityTransactionProposed",
    cls: "governance",
    schema: interEntityTransactionProposedV2PayloadSchema,
    codec: interEntityTransactionProposedCodec,
  },
  {
    type: "PAIARequest",
    cls: "governance",
    schema: paiaRequestV2PayloadSchema,
    codec: paiaRequestCodec,
  },
] as const;

/** The nine batch-A2 type names (sorted). */
export const BUCKET_A_A2_TYPES: readonly string[] = BUCKET_A_A2_SPECS.map((s) => s.type)
  .slice()
  .sort();

/** Map type → codec, for the parity gate's "v2 payload == codec(v1 payload)" check. */
export const BUCKET_A_A2_CODEC_BY_TYPE: ReadonlyMap<string, V2TeeCodec> = new Map(
  BUCKET_A_A2_SPECS.map((s) => [s.type, s.codec]),
);
