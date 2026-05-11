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
