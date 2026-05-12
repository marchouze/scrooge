// platform/forward-obligations/types.ts
//
// Typed schema for the Forward Obligations Register.
//
// The register captures *specific dated future obligations* — concrete
// instances of what the bank must do by a given date. This is distinct from
// the static obligations register (which lists what the bank is *subject to*).
// Examples: "BA325 return due 2026-05-13", "FX spot settlement USD 5m due
// 2026-05-14", "Annual financial statements due 2027-02-28".
//
// Authority chain (Principle 2 upward):
//   D-MARKETS-SCHEMA-FOUNDATION (CEO-approved)
//     — schema-foundation authority for typed market / regulatory events
//   TRADING-MANDATE-V1 (PR #256)
//     — trading obligations, settlement obligations, mandate scope
//   P1-EVENTS-ARE-TRUTH
//     — ForwardObligationRegistered / ForwardObligationFulfilled events are the
//       canonical artefacts; this projection is a query over those events.
//   ORG-MK-10 (obligations register) — BA returns to SARB Prudential Authority
//
// Author: Atlas (Core banking platform architect, engineering)

import { z } from "zod";

export const forwardObligationKindSchema = z.enum([
  "regulatory-filing", // BA returns, SARB submissions, SARS filings
  "trade-settlement", // FX T+2, equity T+3
  "corporate-statutory", // Annual financial statements, AGM, IRP5
  "counterparty-payment", // ISDA coupon, margin call deadline
  "ad-hoc", // one-off obligations
]);
export type ForwardObligationKind = z.infer<typeof forwardObligationKindSchema>;

export const forwardObligationStatusSchema = z.enum([
  "pending", // due in future
  "overdue", // past due date, not yet fulfilled
  "fulfilled", // completed
  "cancelled", // no longer required
]);
export type ForwardObligationStatus = z.infer<typeof forwardObligationStatusSchema>;

export const forwardObligationSchema = z.object({
  id: z.string().min(1), // e.g. "fwd:ba325:2026-05-13"
  kind: forwardObligationKindSchema,
  description: z.string().min(1), // human-readable
  dueDate: z.string().min(1), // ISO-8601 date or datetime
  recurrence: z.string().optional(), // "daily-business", "monthly", "quarterly", "annual", null = one-off
  obligationSourceId: z.string().optional(), // link to obligations register row (e.g. "ORG-MK-01")
  tradeRef: z.string().optional(), // eventId of originating trade event
  responsibleAgent: z.string().min(1), // agent urn or "human:marc@tgv.co.za"
  status: forwardObligationStatusSchema,
  citations: z.array(z.string().min(1)).min(1),
  notes: z.string().optional(),
});
export type ForwardObligation = z.infer<typeof forwardObligationSchema>;

export interface ForwardObligationsBoardView {
  obligations: ForwardObligation[];
  summary: {
    total: number;
    pending: number;
    overdue: number;
    fulfilled: number;
    dueToday: number;
    dueThisWeek: number;
  };
  asOf: string;
}
