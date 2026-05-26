// platform/event-store/event-types/accounting.ts
//
// Accounting / treasury event-payload schemas.
//
// Covers:
//   - BankAccountOpened, BankAccountConfigured, BankAccountClosed
//   - AccountingPeriodOpened, AccountingPeriodClosed
//   - TrialBalanceSnapshotted
//
// Authority:
//   - BankAccount family: D-BANK-ACCOUNT-SUBSTRATE (under D-FIRST-DRY-RUN-SCENARIO,
//     CEO-approved 2026-05-10)
//   - Period-close family: D-REPORTING-CAPABILITY-SLICE-2 (under
//     D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN, CEO-approved 2026-05-10)
//
// F-020 split from the god-file `../event-types.ts`.
// Authors: Tomas (Operations & payments engineer), Bea (Accounting & financial
//          reporting engineer), Atlas (substrate)

import { z } from "zod";

import { newEventId } from "../../core/types";
import { type Actor, type Event, eventSchema } from "../types";

// ---------------------------------------------------------------------------
// BankAccountOpened / BankAccountConfigured / BankAccountClosed
// ---------------------------------------------------------------------------

export const bankAccountTypeSchema = z.enum([
  "nostro",
  "vostro",
  "capital",
  "sarb-operational",
  "clearing",
  "internal-suspense",
]);

export type BankAccountType = z.infer<typeof bankAccountTypeSchema>;

export const chartOfAccountsRefSchema = z.object({
  leafAccountId: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
    message:
      "ChartOfAccountsRef.leafAccountId must match `ACC-NNNN-NNN` per chart-of-accounts.schema.json",
  }),
  note: z.string().optional(),
});

export type ChartOfAccountsRef = z.infer<typeof chartOfAccountsRefSchema>;

export const bankAccountOpenedPayloadSchema = z.object({
  accountId: z.string().min(1),
  accountType: bankAccountTypeSchema,
  currency: z.string().length(3),
  counterpartyId: z.string().min(1).nullable(),
  chartOfAccounts: chartOfAccountsRefSchema,
  openedAt: z.string().min(1),
  displayName: z.string().min(1).optional(),
});

export type BankAccountOpenedPayload = z.infer<typeof bankAccountOpenedPayloadSchema>;

export function makeBankAccountOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountOpenedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const bankAccountConfiguredPayloadSchema = z.object({
  accountId: z.string().min(1),
  configKey: z.string().min(1),
  configValue: z.unknown(),
  effectiveAt: z.string().min(1),
  rationale: z.string().min(1),
});

export type BankAccountConfiguredPayload = z.infer<typeof bankAccountConfiguredPayloadSchema>;

export function makeBankAccountConfigured(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountConfiguredPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountConfigured",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountConfiguredPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const bankAccountClosedPayloadSchema = z.object({
  accountId: z.string().min(1),
  closedAt: z.string().min(1),
  reason: z.enum([
    "counterparty-relationship-ended",
    "consolidation",
    "regulatory-direction",
    "operational-cleanup",
    "incorrectly-opened",
  ]),
  note: z.string().optional(),
});

export type BankAccountClosedPayload = z.infer<typeof bankAccountClosedPayloadSchema>;

export function makeBankAccountClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BankAccountClosedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BankAccountClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: bankAccountClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// AccountingPeriodOpened / AccountingPeriodClosed / TrialBalanceSnapshotted
// ---------------------------------------------------------------------------

export const accountingPeriodKindSchema = z.enum(["month", "quarter", "half-year", "year"]);

export type AccountingPeriodKind = z.infer<typeof accountingPeriodKindSchema>;

export const trialBalanceSnapshotKindSchema = z.enum(["close", "interim"]);

export type TrialBalanceSnapshotKind = z.infer<typeof trialBalanceSnapshotKindSchema>;

export const accountingPeriodOpenedPayloadSchema = z
  .object({
    periodId: z.string().min(1),
    periodKind: accountingPeriodKindSchema,
    periodStart: z.string().min(1),
    periodEnd: z.string().min(1),
    openedAt: z.string().min(1),
    functionalCurrency: z.string().length(3),
    reopenOf: z.string().min(1).optional(),
    reopenReason: z
      .enum([
        "post-close-adjustment",
        "audit-finding",
        "regulator-direction",
        "restatement-prior-period-error",
        "operational-correction",
      ])
      .optional(),
  })
  .superRefine((p, ctx) => {
    const start = Date.parse(p.periodStart);
    const end = Date.parse(p.periodEnd);
    if (!Number.isNaN(start) && !Number.isNaN(end) && end <= start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "AccountingPeriodOpened.periodEnd must be after periodStart",
        path: ["periodEnd"],
      });
    }
    if (p.reopenOf !== undefined && p.reopenReason === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AccountingPeriodOpened.reopenReason is required when reopenOf is set (every reopen needs a typed reason)",
        path: ["reopenReason"],
      });
    }
    if (p.reopenOf === undefined && p.reopenReason !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "AccountingPeriodOpened.reopenReason is forbidden without reopenOf (reason has no referent)",
        path: ["reopenReason"],
      });
    }
  });

export type AccountingPeriodOpenedPayload = z.infer<typeof accountingPeriodOpenedPayloadSchema>;

export function makeAccountingPeriodOpened(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountingPeriodOpenedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountingPeriodOpened",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountingPeriodOpenedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const accountingPeriodClosedPayloadSchema = z.object({
  periodId: z.string().min(1),
  closedAt: z.string().min(1),
  trialBalanceSnapshotEventId: z.string().min(1),
  trialBalanceDocumentHash: z.string().min(1).optional(),
  uptoSequence: z.number().int().nonnegative(),
  /**
   * Append sequence of the event store at the moment the period was closed.
   * Frozen cursor for subscriber convergence — all subscribers must replay
   * events up to (and including) this sequence only, preventing divergence
   * when new events append between the first and last subscriber read.
   * Authority: D-DATA-QUALITY-CROSS-DOMAIN-V1.
   */
  eventSequence: z.number().int().nonnegative().optional(),
});

export type AccountingPeriodClosedPayload = z.infer<typeof accountingPeriodClosedPayloadSchema>;

export function makeAccountingPeriodClosed(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: AccountingPeriodClosedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "AccountingPeriodClosed",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: accountingPeriodClosedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const trialBalanceSnapshotRowSchema = z.object({
  leafAccountId: z.string().regex(/^ACC-[A-Za-z0-9-]+$/, {
    message:
      "TrialBalanceSnapshotted.row.leafAccountId must start with `ACC-` (chart-of-accounts leaf or M1 stub form)",
  }),
  currency: z.string().length(3),
  amountMinor: z.number().int(),
});

export type TrialBalanceSnapshotRow = z.infer<typeof trialBalanceSnapshotRowSchema>;

export const trialBalanceSnapshottedPayloadSchema = z
  .object({
    periodId: z.string().min(1),
    snapshotKind: trialBalanceSnapshotKindSchema,
    snapshotAsOf: z.string().min(1),
    uptoSequence: z.number().int().nonnegative(),
    rows: z.array(trialBalanceSnapshotRowSchema),
    documentHash: z.string().min(1).optional(),
    perCurrencyTotals: z.array(
      z.object({
        currency: z.string().length(3),
        debitMinor: z.number().int().nonnegative(),
        creditMinor: z.number().int().nonnegative(),
      }),
    ),
  })
  .superRefine((p, ctx) => {
    for (const total of p.perCurrencyTotals) {
      if (total.debitMinor !== total.creditMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TrialBalanceSnapshotted.perCurrencyTotals[${total.currency}] unbalanced: debits=${total.debitMinor} credits=${total.creditMinor}`,
          path: ["perCurrencyTotals"],
        });
      }
    }
    const rowTotals = new Map<string, { debit: number; credit: number }>();
    for (const r of p.rows) {
      const t = rowTotals.get(r.currency) ?? { debit: 0, credit: 0 };
      if (r.amountMinor >= 0) t.debit += r.amountMinor;
      else t.credit += -r.amountMinor;
      rowTotals.set(r.currency, t);
    }
    for (const total of p.perCurrencyTotals) {
      const rt = rowTotals.get(total.currency) ?? { debit: 0, credit: 0 };
      if (rt.debit !== total.debitMinor || rt.credit !== total.creditMinor) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `TrialBalanceSnapshotted.rows for currency ${total.currency} (debit=${rt.debit}, credit=${rt.credit}) do not match perCurrencyTotals (debit=${total.debitMinor}, credit=${total.creditMinor})`,
          path: ["rows"],
        });
      }
    }
  });

export type TrialBalanceSnapshottedPayload = z.infer<typeof trialBalanceSnapshottedPayloadSchema>;

export function makeTrialBalanceSnapshotted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: TrialBalanceSnapshottedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "TrialBalanceSnapshotted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: trialBalanceSnapshottedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// BalanceSheetSubstantiationCompleted
// ---------------------------------------------------------------------------
//
// Emitted by Bea (Accounting & financial reporting engineer) at the end of each
// monthly balance sheet substantiation run.  Every AccountingPeriodClosed must
// be followed within 2 agent ticks by this event (Vera-enforced).
//
// Authority: PROC-FIN-BSS-01 (balance-sheet-substantiation.md)
// Source regulations: ORG-AC-13; IAS 1 §29–§31; Companies Act 71/2008 §§28–30
// Authors: Bea (Accounting & financial reporting engineer, engineering)

export const substantiationExceptionKindSchema = z.enum([
  "timing-difference",
  "substrate-gap",
  "unexplained",
]);

export type SubstantiationExceptionKind = z.infer<typeof substantiationExceptionKindSchema>;

export const substantiationExceptionSchema = z.object({
  accountId: z.string().regex(/^ACC-[0-9A-Za-z-]+$/, {
    message: "substantiationException.accountId must match `ACC-...` per chart-of-accounts",
  }),
  exceptionKind: substantiationExceptionKindSchema,
  description: z.string().min(1),
});

export type SubstantiationException = z.infer<typeof substantiationExceptionSchema>;

export const balanceSheetSubstantiationCompletedPayloadSchema = z.object({
  /** e.g. "period:hoz-bank:month:2026-05" */
  periodId: z.string().min(1),
  /** Legal entity identifier — e.g. "LE-ZA-HOZ-BANK" */
  entity: z.string().min(1),
  /** ISO 8601 timestamp at which substantiation was run */
  asOf: z.string().min(1),
  /** Total number of GL accounts substantiated in this run */
  accountsSubstantiated: z.number().int().nonnegative(),
  /** Number of accounts that had at least one open exception */
  accountsWithExceptions: z.number().int().nonnegative(),
  /**
   * Open exceptions at time of completion.
   * A clean run has an empty array.
   * "unexplained" exceptions must be zero for the BA-return submission gate to pass.
   */
  exceptionsOpen: z.array(substantiationExceptionSchema),
  /** Actor ID of the approver — Camille's agent ID, or "system:bea:auto-approve" */
  approvedBy: z.string().min(1),
  /** "auto" = clean run, no material exceptions; "human-in-loop" = CFO reviewed exceptions */
  approvalMode: z.enum(["auto", "human-in-loop"]),
});

export type BalanceSheetSubstantiationCompletedPayload = z.infer<
  typeof balanceSheetSubstantiationCompletedPayloadSchema
>;

export function makeBalanceSheetSubstantiationCompleted(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BalanceSheetSubstantiationCompletedPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BalanceSheetSubstantiationCompleted",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: balanceSheetSubstantiationCompletedPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// BAReturnGenerationTriggered
// ---------------------------------------------------------------------------
//
// Emitted by the month-end close engine at step MC14 of PROC-FIN-MC-01 to
// kick off BA-return generation (PROC-FIN-BA-01). The PeriodClosed event
// must precede this event for the same (period, entity) — enforced by the
// idempotency check in ba-return-trigger.ts.
//
// Authority: PROC-FIN-MC-01 §5 MC14; D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN;
//   Banks Act 94/1990 s90; PA BA return submission requirements.
// Authors: Bea (Accounting & financial reporting engineer, engineering)

export const baReturnGenerationTriggeredPayloadSchema = z.object({
  /** ISO 8601 year-month, e.g. "2026-05". */
  period: z.string().regex(/^\d{4}-\d{2}$/, {
    message: "BAReturnGenerationTriggered.period must be YYYY-MM",
  }),
  /**
   * event_id of the PeriodClosed event that gates this trigger.
   * Must match an existing PeriodClosed for (period, entity).
   */
  triggerEventId: z.string().min(1),
  /** Legal entity for which the BA return is being generated. */
  entity: z.string().min(1),
  /** ISO 8601 timestamp when the trigger was emitted. */
  triggeredAt: z.string().min(1),
});

export type BAReturnGenerationTriggeredPayload = z.infer<
  typeof baReturnGenerationTriggeredPayloadSchema
>;

export function makeBAReturnGenerationTriggered(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: BAReturnGenerationTriggeredPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "BAReturnGenerationTriggered",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: baReturnGenerationTriggeredPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

// ---------------------------------------------------------------------------
// ManualJournalEntry
//
// Emitted when an authorised agent or human posts a manual journal entry
// to the GL. Carries multi-leg double-entry legs (reuses subLedgerLegSchema
// from fx-accounting.ts for the same balanced-legs pattern) and enforces
// debits = credits per currency.
//
// Authority: General-ledger substrate (Devon COO, engineering).
// Authors: Devon (COO, engineering); Bea (Accounting & financial reporting
//   engineer, engineering)
// ---------------------------------------------------------------------------

export const manualJournalEntryPayloadSchema = z
  .object({
    /** Unique journal identifier (use crypto.randomUUID() at emit time). */
    journalId: z.string().min(1),
    /** Human-readable description of the journal entry purpose. */
    description: z.string().min(1),
    /** Agent or user reference who posted this entry. */
    postedBy: z.string().min(1),
    /** ISO 8601 timestamp when the entry was posted. */
    postedAt: z.string().min(1),
    /** Accounting period in YYYY-MM format. */
    period: z.string().regex(/^\d{4}-\d{2}$/, {
      message: "ManualJournalEntry.period must be YYYY-MM",
    }),
    /**
     * Balanced double-entry legs.
     * Minimum 2 legs required; debits must equal credits per currency.
     * Re-uses SubLedgerLeg shape from fx-accounting.ts.
     */
    legs: z
      .array(
        z.object({
          accountId: z.string().regex(/^ACC-[0-9]{4}-[0-9]{3}$/, {
            message: "ManualJournalEntry leg.accountId must match ACC-NNNN-NNN",
          }),
          debitCredit: z.enum(["debit", "credit"]),
          amountMinor: z.number().int().nonnegative(),
          currency: z
            .string()
            .length(3)
            .regex(/^[A-Z]{3}$/),
        }),
      )
      .min(2),
    /** "posted" = live; "reversed" = this entry reverses a prior one. */
    status: z.enum(["posted", "reversed"]),
    /** If this entry reverses another, the journalId of the reversed entry. */
    reversalOf: z.string().optional(),
    /** Principle 2 citations (optional — manual entries may not have regulatory citations). */
    citations: z.array(z.string()).optional(),
  })
  .superRefine((p, ctx) => {
    // Validate: debits = credits per currency (same logic as SubLedgerPostingEmitted).
    const totals = new Map<string, { debit: number; credit: number }>();
    for (const leg of p.legs) {
      const t = totals.get(leg.currency) ?? { debit: 0, credit: 0 };
      if (leg.debitCredit === "debit") t.debit += leg.amountMinor;
      else t.credit += leg.amountMinor;
      totals.set(leg.currency, t);
    }
    for (const [ccy, t] of totals.entries()) {
      if (t.debit !== t.credit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `ManualJournalEntry unbalanced in ${ccy}: debit=${t.debit} credit=${t.credit}`,
          path: ["legs"],
        });
      }
    }
  });

export type ManualJournalEntryPayload = z.infer<typeof manualJournalEntryPayloadSchema>;

export function makeManualJournalEntry(args: {
  asOf: string;
  entity: string;
  actor: Actor;
  citations: string[];
  payload: ManualJournalEntryPayload;
  eventId?: string;
  provenance?: Event["provenance"];
}): Event {
  return eventSchema.parse({
    event_id: args.eventId ?? newEventId(),
    type: "ManualJournalEntry",
    as_of: args.asOf,
    entity: args.entity,
    actor: args.actor,
    citations: args.citations,
    payload: manualJournalEntryPayloadSchema.parse(args.payload),
    ...(args.provenance ? { provenance: args.provenance } : {}),
  });
}

export const ACCOUNTING_TYPED_EVENT_TYPES = [
  "BankAccountOpened",
  "BankAccountConfigured",
  "BankAccountClosed",
  "AccountingPeriodOpened",
  "AccountingPeriodClosed",
  "TrialBalanceSnapshotted",
  "BalanceSheetSubstantiationCompleted",
  "BAReturnGenerationTriggered",
  "ManualJournalEntry",
] as const;
export type AccountingEventType = (typeof ACCOUNTING_TYPED_EVENT_TYPES)[number];
