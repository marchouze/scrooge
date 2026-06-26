// v2-core/regulatory-returns/return-of-record-events.ts
//
// BORN-V2 BA-return-of-record + filing-lifecycle event family. The generated
// SARB BA return (the most important regulatory artefact the bank files with
// the Prudential Authority) is currently computed-on-read but NEVER persisted —
// a Principle-1 gap. This family makes the generated return a durable, typed,
// replayable EVENT carrying the key attestable figures plus a BLAKE3 content
// hash of the rendered return, and adds the filing-lifecycle trio
// (ReportDue / ReportFiled / ReportSubmissionAcknowledged).
//
// PACKAGE BOUNDARY (D-V1-REMOVAL-PHASE-1; recon:v2-no-v1-import): this module
// imports ONLY `zod` and the v2-core fil-core primitives. No v1 modules, no
// platform re-export shims. Every type is born V2 (registry v2Status
// "v2-replaced") — there is no v1 ancestor.
//
// ## Event-vs-document-store split (Principle 1 + RMS D-RMS-PHASE-1)
//
// The EVENT is the Principle-1 truth: it carries the attestable figures (capital
// tiers + RWA + ratios for BA 700; generic figure rows for other forms) and a
// BLAKE3 `contentHash` of the rendered return envelope. This is what the GL↔BA
// cross-domain recon reconciles against and what the Finance returns projection
// folds for reporting-period / last-filed / overdue.
//
// The FULL rendered artefact (the SARB XML envelope) is already (a) submitted +
// recorded via `SarbSubmissionAttempted` (the actual portal act), and (b)
// reproducible from the events under Principle 1. The content HASH in this event
// is the integrity anchor; filing the full blob into the RMS content-addressed
// document store (`RecordFiled`) is a tracked follow-on
// (GAP-BA-RETURN-OF-RECORD-DOCUMENT-STORE) — not silently omitted.
//
// ## Money discipline (D-V2-CORE-MONEY-DECIMAL-NATIVE)
//
// All money is decimal-native MAJOR units (`Money` = currency + canonical
// decimal string). NEVER minor units / cents. This matches the FIL / posting
// convention bank-wide.
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-BA-RETURN-DATA-CONTRACT;
//   D-RMS-PHASE-1; D-V1-REMOVAL-PHASE-1; D-ENGINEERING-INTEGRITY-CHARTER.
// Regulatory chain: Banks Act 94/1990 §70 + §73 (regulatory reporting +
//   record-keeping) → Regulations Relating to Banks Reg 38 (capital adequacy) +
//   Reg 26 (return submission) → BA 700 capital-adequacy return.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer); BA-form line-mapping owner).

import { z } from "zod";
import { citationRefSchema, instantSchema, moneySchema } from "../fil-core/primitives";

// ---------------------------------------------------------------------------
// Canonical type literals — exported so the registry rows, the projection, and
// the cross-domain recon all reference one source-of-truth string (no string
// drift across the registration sites).
// ---------------------------------------------------------------------------

export const REPORT_GENERATED = "ReportGenerated" as const;
export const REPORT_DUE = "ReportDue" as const;
export const REPORT_FILED = "ReportFiled" as const;
export const REPORT_SUBMISSION_ACKNOWLEDGED = "ReportSubmissionAcknowledged" as const;

export type ReportOfRecordEventType =
  | typeof REPORT_GENERATED
  | typeof REPORT_DUE
  | typeof REPORT_FILED
  | typeof REPORT_SUBMISSION_ACKNOWLEDGED;

export const RETURN_OF_RECORD_EVENT_TYPES = [
  REPORT_GENERATED,
  REPORT_DUE,
  REPORT_FILED,
  REPORT_SUBMISSION_ACKNOWLEDGED,
] as const;

// ---------------------------------------------------------------------------
// Shared field schemas.
// ---------------------------------------------------------------------------

/**
 * BLAKE3 content hash of the rendered return envelope. Format
 * `blake3:<64-hex-lowercase>` — matches the platform document-store hash
 * grammar (`platform/document-store/hash.ts`) so a `RecordFiled` follow-on can
 * reference the same artefact by hash.
 */
export const contentHashSchema = z
  .string()
  .regex(/^blake3:[0-9a-f]{64}$/, "contentHash must match `blake3:<64-hex-chars>`");

/** Canonical SARB BA form number — e.g. "BA700", "BA320". */
const formIdSchema = z.string().min(1);

/** Legal-entity short-id (the reporting entity), e.g. "LE-ZA-HOZ-BANK". */
const entityRefSchema = z.string().min(1);

/** Reporting period identifier, e.g. "period:hoz-bank:month:2026-05". */
const reportingPeriodSchema = z.string().min(1);

// ---------------------------------------------------------------------------
// ReportGenerated — the return-of-record.
//
// Carries the key attestable figures for the return plus a BLAKE3 content hash
// of the rendered envelope. For BA 700 the figures are the capital stack (CET1 /
// AT1 / Tier 2), RWA, and ratios. For other forms the figures are carried as a
// generic, named decimal-money row set so the family is form-agnostic.
// ---------------------------------------------------------------------------

/**
 * BA 700 capital-adequacy attestable figures — decimal-native major units.
 * Present only for `formId === "BA700"`. The recon reconciles `tier2Capital`
 * against the GL T2 fold; the other figures support the capital-ratio chain.
 */
export const ba700FiguresSchema = z
  .object({
    /** Net Common Equity Tier 1 capital (after deductions). */
    cet1Capital: moneySchema,
    /** Net Additional Tier 1 capital (after deductions). */
    at1Capital: moneySchema,
    /** Net Tier 2 capital (after deductions). Reconciled to the GL T2 fold. */
    tier2Capital: moneySchema,
    /** Total risk-weighted assets (credit + market + operational). */
    totalRwa: moneySchema,
    /** CET1 ratio (dimensionless decimal string; "0.12" = 12%). */
    cet1Ratio: z.string().min(1),
    /** Tier 1 ratio (dimensionless decimal string). */
    tier1Ratio: z.string().min(1),
    /** Total capital ratio (dimensionless decimal string). */
    totalRatio: z.string().min(1),
  })
  .strict();
export type Ba700Figures = z.infer<typeof ba700FiguresSchema>;

/**
 * One named attestable figure for a non-BA700 return (form-agnostic). The
 * `label` is the return-contract cell key; the `amount` is decimal-native.
 */
export const namedFigureSchema = z
  .object({
    label: z.string().min(1),
    amount: moneySchema,
  })
  .strict();
export type NamedFigure = z.infer<typeof namedFigureSchema>;

export const reportGeneratedPayloadSchema = z
  .object({
    /** Reporting legal entity (LE short-id). */
    entity: entityRefSchema,
    /** Canonical SARB BA form number. */
    formId: formIdSchema,
    /** Form version, e.g. "v0.1-rehearsal". */
    formVersion: z.string().min(1),
    /** Reporting period covered by the return. */
    reportingPeriod: reportingPeriodSchema,
    /** ISO 8601 — when the return was generated (= period-close as-of). */
    generatedAt: instantSchema,
    /** ISO-4217 functional / reporting currency. */
    functionalCurrency: z.string().length(3),
    /**
     * BA 700 capital figures — present iff `formId === "BA700"`. The
     * .superRefine below enforces the form↔figures coherence (fail-closed).
     */
    ba700Figures: ba700FiguresSchema.optional(),
    /** Generic named figures for non-BA700 forms (may be empty). */
    figures: z.array(namedFigureSchema).optional(),
    /**
     * BLAKE3 content hash of the rendered return envelope. The integrity anchor
     * a `RecordFiled` follow-on (document store) would reference.
     */
    contentHash: contentHashSchema,
    /**
     * Source event ids contributing to the figures (chain-of-custody,
     * Principle 1) — e.g. the RwaComputed event of record for the RWA figure.
     */
    sourceEventIds: z.array(z.string().min(1)),
    /** Principle 2 citations — at least one regulatory or policy URN. */
    citations: z.array(citationRefSchema).min(1),
  })
  .strict()
  .superRefine((p, ctx) => {
    // Form↔figures coherence: BA 700 MUST carry capital figures; non-BA700
    // forms MUST NOT carry the BA700-specific block (fail-closed — a mismatched
    // shape is a return-of-record integrity defect, not a soft warning).
    if (p.formId === "BA700" && p.ba700Figures === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ReportGenerated{formId:'BA700'} requires `ba700Figures`",
        path: ["ba700Figures"],
      });
    }
    if (p.formId !== "BA700" && p.ba700Figures !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ReportGenerated for a non-BA700 form must not carry `ba700Figures`",
        path: ["ba700Figures"],
      });
    }
  });
export type ReportGeneratedPayload = z.infer<typeof reportGeneratedPayloadSchema>;
/** INPUT shape (pre-transform) — plain strings for the branded instant/citation fields. */
export type ReportGeneratedPayloadInput = z.input<typeof reportGeneratedPayloadSchema>;

// ---------------------------------------------------------------------------
// Filing-lifecycle trio.
//
//   ReportDue                    — a return becomes due for a period (the
//                                  reporting-calendar fact). Carries the due
//                                  date so the projection can compute overdue.
//   ReportFiled                  — the bank has filed the return with the
//                                  regulator (the submission act, references
//                                  the ReportGenerated content hash).
//   ReportSubmissionAcknowledged — the regulator acknowledged the filing
//                                  (accepted / rejected, with reference).
// ---------------------------------------------------------------------------

export const reportDuePayloadSchema = z
  .object({
    entity: entityRefSchema,
    formId: formIdSchema,
    reportingPeriod: reportingPeriodSchema,
    /** ISO 8601 — the regulator-set due date for this return + period. */
    dueDate: instantSchema,
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ReportDuePayload = z.infer<typeof reportDuePayloadSchema>;
export type ReportDuePayloadInput = z.input<typeof reportDuePayloadSchema>;

export const reportFiledPayloadSchema = z
  .object({
    entity: entityRefSchema,
    formId: formIdSchema,
    reportingPeriod: reportingPeriodSchema,
    /** ISO 8601 — when the return was filed with the regulator. */
    filedAt: instantSchema,
    /**
     * Submission mode: "simulator" (local portal simulator, build-phase) or
     * "live" (SARB BankServ prudential portal, post-licence). Build-phase
     * default is "simulator".
     */
    mode: z.enum(["simulator", "live"]),
    /**
     * BLAKE3 content hash of the filed return — links the filing to the
     * `ReportGenerated` return-of-record by hash.
     */
    contentHash: contentHashSchema,
    /** event_id of the `ReportGenerated` this filing covers (chain-of-custody). */
    reportGeneratedEventId: z.string().min(1),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ReportFiledPayload = z.infer<typeof reportFiledPayloadSchema>;
export type ReportFiledPayloadInput = z.input<typeof reportFiledPayloadSchema>;

export const reportSubmissionAcknowledgedPayloadSchema = z
  .object({
    entity: entityRefSchema,
    formId: formIdSchema,
    reportingPeriod: reportingPeriodSchema,
    /** ISO 8601 — when the regulator acknowledged the submission. */
    acknowledgedAt: instantSchema,
    /** Regulator acknowledgement outcome. */
    outcome: z.enum(["accepted", "rejected"]),
    /** Regulator-assigned reference number (present on acceptance). */
    referenceNumber: z.string().min(1).optional(),
    /** Validation errors returned on rejection. */
    errors: z.array(z.string().min(1)).optional(),
    /** event_id of the `ReportFiled` this acknowledgement answers. */
    reportFiledEventId: z.string().min(1),
    citations: z.array(citationRefSchema).min(1),
  })
  .strict();
export type ReportSubmissionAcknowledgedPayload = z.infer<
  typeof reportSubmissionAcknowledgedPayloadSchema
>;
export type ReportSubmissionAcknowledgedPayloadInput = z.input<
  typeof reportSubmissionAcknowledgedPayloadSchema
>;
