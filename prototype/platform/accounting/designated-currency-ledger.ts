// platform/accounting/designated-currency-ledger.ts
//
// Shared fold for the account-designated-currency discipline
// (D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK, CEO-approved 2026-06-10).
//
// A Chart-of-Accounts entry with a designated `currency` field
// (coa-registry.ts, D-COA-CURRENCY-DECOUPLING) is a SINGLE-currency account: a
// posted leg whose `SubLedgerLeg.currency` contradicts the designation is a
// booking defect (the default-to-USD currency-resolution defect, live
// 2026-06-01..06, fixed by D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS PR #1101,
// parked GBP/JPY/CHF/EUR/AUD legs in the three USD-designated accounts).
// Accounts whose registry entry OMITS `currency` (genuinely multi-currency:
// FX unresolved-currency suspense ACC-2100-007, NOP memoranda ACC-9000-*,
// build-phase write-off ACC-2105-001) are exempt via the registry field
// itself — never a hardcoded id allowlist.
//
// This module extracts every GL-significant leg from the three leg-bearing
// event types the GL projection folds (`SubLedgerPostingEmitted`,
// `JournalEntryPosted`, `ManualJournalEntry`) and nets them per
// (account, mismatched currency). Both the corrective re-book script
// (scripts/rebook-usd-designated-account-residuals.ts) and the standing
// recon gate (platform/recon/account-designated-currency.ts) consume this
// SAME fold, so the gate can never drift from the remediation: a residual the
// script would re-book is exactly a residual the gate flags, and a residual
// fully compensated by a later corrective entry (re-book posting OR CFO-
// authority manual journal, e.g. the FXRECON-LEGACY-20260607 legacy-account
// reconciliation that already compensated ACC-2100-002/004) nets to zero and
// is NOT a violation — Principle 1: corrections are new events, never edits,
// so "fixed" is a property of the fold, not of the original event.
//
// Authority: D-ACCOUNT-DESIGNATED-CURRENCY-REBOOK (CEO 2026-06-10);
//            D-SLA-FX-PER-CURRENCY-CHART-OF-ACCOUNTS (CEO build-phase 2026-06-08);
//            D-COA-CURRENCY-DECOUPLING (CEO 2026-05-30).
// Citations: Principles/1-events-are-truth.md;
//            Principles/5-multi-currency-entity-country.md.
// Author: Bea (GL engineer, accounting).

import type { Event } from "../event-store/types";
import { COA_BY_ID } from "./coa-registry";

/** One GL-significant leg extracted from any of the three leg-bearing event types. */
export interface ExtractedGlLeg {
  readonly eventId: string;
  readonly eventType: "SubLedgerPostingEmitted" | "JournalEntryPosted" | "ManualJournalEntry";
  /** SubLedgerPostingEmitted postingType; "manual-journal" / "journal-entry" otherwise. */
  readonly postingType: string;
  readonly accountId: string;
  readonly currency: string;
  readonly debitCredit: "debit" | "credit";
  readonly amountMinor: number;
  /** payload.postedAt, falling back to event as_of. */
  readonly postedAt: string;
  /** The carrying event's provenance tag (for plane-preserving corrections). */
  readonly provenance: unknown;
}

/**
 * Extract every GL-significant leg from `events`. Mirrors the leg-normalising
 * fold in gl-projection.ts buildGlView (including the legacy
 * `{debit, credit, amountMinor, currency}` one-object-two-legs shape) so the
 * netting below agrees with the GL trial balance leg-for-leg.
 */
export function extractGlLegs(events: Iterable<Event>): ExtractedGlLeg[] {
  const out: ExtractedGlLeg[] = [];
  for (const e of events) {
    const p = e.payload as Record<string, unknown>;
    if (e.type === "SubLedgerPostingEmitted" || e.type === "ManualJournalEntry") {
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : e.as_of;
      const postingType =
        e.type === "ManualJournalEntry"
          ? "manual-journal"
          : typeof p.postingType === "string"
            ? p.postingType
            : "unknown";
      const rawLegs = Array.isArray(p.legs) ? p.legs : [];
      for (const raw of rawLegs) {
        const r = raw as Record<string, unknown>;
        if (typeof r.accountId === "string") {
          out.push({
            eventId: e.event_id,
            eventType: e.type,
            postingType,
            accountId: r.accountId,
            currency: typeof r.currency === "string" ? r.currency : "ZAR",
            debitCredit: r.debitCredit === "credit" ? "credit" : "debit",
            amountMinor: typeof r.amountMinor === "number" ? r.amountMinor : 0,
            postedAt,
            provenance: e.provenance,
          });
        } else if (typeof r.debit === "string" && typeof r.credit === "string") {
          // Legacy one-object shape: expand into the two canonical legs.
          const amountMinor = typeof r.amountMinor === "number" ? r.amountMinor : 0;
          const currency = typeof r.currency === "string" ? r.currency : "ZAR";
          out.push({
            eventId: e.event_id,
            eventType: e.type,
            postingType,
            accountId: r.debit,
            currency,
            debitCredit: "debit",
            amountMinor,
            postedAt,
            provenance: e.provenance,
          });
          out.push({
            eventId: e.event_id,
            eventType: e.type,
            postingType,
            accountId: r.credit,
            currency,
            debitCredit: "credit",
            amountMinor,
            postedAt,
            provenance: e.provenance,
          });
        }
      }
    } else if (e.type === "JournalEntryPosted") {
      const postedAt = typeof p.postedAt === "string" ? p.postedAt : e.as_of;
      const currency = typeof p.currency === "string" ? p.currency : "ZAR";
      const amountMinor = typeof p.amountMinor === "number" ? p.amountMinor : 0;
      for (const [field, debitCredit] of [
        ["accountDebit", "debit"],
        ["accountCredit", "credit"],
      ] as const) {
        const accountId = typeof p[field] === "string" ? (p[field] as string) : "";
        if (!accountId) continue;
        out.push({
          eventId: e.event_id,
          eventType: e.type,
          postingType: "journal-entry",
          accountId,
          currency,
          debitCredit,
          amountMinor,
          postedAt,
          provenance: e.provenance,
        });
      }
    }
  }
  return out;
}

/** The designated currency of `accountId`, or undefined when the account is
 *  registry-exempt (no `currency` field = genuinely multi-currency) or not in
 *  the registry at all (legacy json-only accounts, e.g. ACC-2100-009). */
export function designatedCurrencyOf(accountId: string): string | undefined {
  return COA_BY_ID.get(accountId)?.currency;
}

/** Net residual of one (account, mismatched-currency) pair across the fold. */
export interface MismatchedResidual {
  readonly accountId: string;
  /** The account's designated currency (from coa-registry.ts). */
  readonly designatedCurrency: string;
  /** The contradicting leg currency. */
  readonly currency: string;
  /** Net debit-positive minor-unit balance across ALL folded legs. 0 = fully compensated. */
  readonly netMinor: number;
  readonly legCount: number;
  /** Latest postedAt among the mismatched legs (corrections are stamped here). */
  readonly lastPostedAt: string;
  /** Provenance of the event carrying the latest mismatched leg (plane-preserving). */
  readonly lastProvenance: unknown;
}

/**
 * Net every mismatched (account, currency) pair: legs whose currency
 * contradicts the account's registry-designated currency, netted debit-positive
 * across all three leg-bearing event types. Pairs netting to zero ARE returned
 * (callers decide: the re-book script skips them; the recon gate treats them as
 * compensated history).
 */
export function mismatchedResiduals(legs: Iterable<ExtractedGlLeg>): MismatchedResidual[] {
  const acc = new Map<
    string,
    {
      accountId: string;
      designatedCurrency: string;
      currency: string;
      netMinor: number;
      legCount: number;
      lastPostedAt: string;
      lastProvenance: unknown;
    }
  >();
  for (const leg of legs) {
    const designated = designatedCurrencyOf(leg.accountId);
    if (!designated || designated === leg.currency) continue;
    const key = `${leg.accountId}|${leg.currency}`;
    const cur = acc.get(key) ?? {
      accountId: leg.accountId,
      designatedCurrency: designated,
      currency: leg.currency,
      netMinor: 0,
      legCount: 0,
      lastPostedAt: "",
      lastProvenance: undefined as unknown,
    };
    cur.netMinor += leg.debitCredit === "debit" ? leg.amountMinor : -leg.amountMinor;
    cur.legCount += 1;
    if (leg.postedAt >= cur.lastPostedAt) {
      cur.lastPostedAt = leg.postedAt;
      cur.lastProvenance = leg.provenance;
    }
    acc.set(key, cur);
  }
  return [...acc.values()].sort((a, b) =>
    `${a.accountId}|${a.currency}`.localeCompare(`${b.accountId}|${b.currency}`),
  );
}
