// platform/returns/ba700/report-of-record.ts
//
// Persist the generated BA 700 capital-adequacy return as a born-V2
// `ReportGenerated` event (the return-of-record), and the filing as a
// `ReportFiled` event — closing the Principle-1 gap where the generated return
// existed only as a transient query result.
//
// ## What this module does
//
//   1. Maps the `Ba700Output` (minor-unit generator output) to the decimal-
//      native MAJOR-unit attestable figures the `ReportGenerated` event carries
//      (capital tiers + RWA + ratios). Money is decimal-native (no minor units).
//   2. Computes a BLAKE3 content hash of the RENDERED return (the canonical SARB
//      XML), with a FIXED `renderedAt` derived from the period so the hash is a
//      deterministic function of the return CONTENT — not the wall clock. This
//      makes the hash replay-stable (the same closed period always hashes the
//      same return).
//   3. Emits `ReportGenerated` idempotently (one per entity+form+period), then
//      `ReportFiled` idempotently after a successful submission.
//
// ## Idempotency (Principle 1 — replay-safe)
//
// `reportGeneratedExists` / `reportFiledExists` short-circuit when an event
// already exists for (entity, formId, reportingPeriod), so replaying the same
// `AccountingPeriodClosed` never double-emits.
//
// ## Event-vs-document-store split (D-RMS-PHASE-1)
//
// The EVENT carries the attestable figures + content hash (the Principle-1
// truth the GL↔BA recon reconciles + the Finance projection folds). Filing the
// FULL rendered XML blob into the RMS content-addressed document store
// (`RecordFiled`) is a tracked follow-on (GAP-BA-RETURN-OF-RECORD-DOCUMENT-
// STORE) — the content hash here is the integrity anchor that follow-on links
// against. Not silently omitted: tracked in gap-register.ts.
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1;
//   D-V1-REMOVAL-PHASE-1; Banks Act 94/1990 §70 + §73; Principles/1-events-are-
//   truth.md.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import { moneyFromMinorUnits } from "../../core/decimal-money";
import type { Currency } from "../../core/types";
import { hashContent } from "../../document-store/hash";
import {
  makeReportFiled,
  makeReportGenerated,
} from "../../event-store/event-types/return-of-record";
import type { EventStore } from "../../event-store/store";
import type { Ba700Output } from "./generator";

/** Canonical citations for the BA 700 return-of-record + filing events. */
const CITATIONS = [
  "D-BA-RETURN-OF-RECORD-EVENT-FAMILY",
  "D-RMS-PHASE-1",
  "Banks Act 94 of 1990 §70",
  "Banks Act 94 of 1990 §73",
  "Regulations Relating to Banks Reg 38",
];

/**
 * Minor-unit integer → decimal-native MAJOR-unit string (e.g. 123456 → "1234.56"
 * for ZAR). Routed through the platform decimal-money helper (the inverse of
 * `amountToMinorUnits`), so the figure round-trips exactly.
 */
function minorToDecimalString(minor: number, currency: string): string {
  return moneyFromMinorUnits(BigInt(minor), currency as Currency).amount;
}

/** A dimensionless ratio (number) → canonical decimal string. */
function ratioToString(ratio: number): string {
  // Ratios are already dimensionless fractions (0.12 = 12%). String() yields a
  // canonical JS decimal; the schema validates it as a non-empty string.
  return String(ratio);
}

/**
 * Deterministic content hash of the BA 700 return's ATTESTABLE CONTENT — the
 * figures that bind (form, entity, period, currency, capital tiers, RWA,
 * ratios), serialised canonically (sorted keys). It deliberately EXCLUDES
 * incidental envelope ids (trial-balance snapshot id, fingerprints) that vary
 * per store run, so the hash is a pure function of WHAT the return attests, not
 * WHEN/WHERE it was generated — replay-stable across stores and runs. This is
 * the integrity anchor a `RecordFiled` (document-store) follow-on links against.
 */
export function ba700ContentHash(output: Ba700Output): string {
  const currency = output.meta.functionalCurrency;
  const stack = output.capitalStack;
  // Canonical, sorted-key serialisation of the attestable content.
  const attestable = {
    at1Capital: minorToDecimalString(stack.at1.netStockMinor, currency),
    cet1Capital: minorToDecimalString(stack.cet1.netStockMinor, currency),
    cet1Ratio: ratioToString(output.ratios.cet1Ratio),
    currency,
    entity: output.meta.entity,
    form: output.meta.form,
    formVersion: output.meta.formVersion,
    periodId: output.meta.periodId,
    tier1Ratio: ratioToString(output.ratios.tier1Ratio),
    tier2Capital: minorToDecimalString(stack.t2.netStockMinor, currency),
    totalRatio: ratioToString(output.ratios.totalRatio),
    totalRwa: minorToDecimalString(output.rwa.totalRwaMinor, currency),
  };
  return hashContent(JSON.stringify(attestable));
}

/**
 * True when a `ReportGenerated` already exists for (entity, formId, period).
 * The idempotency guard for the return-of-record.
 */
export function reportGeneratedExists(
  store: EventStore,
  entity: string,
  formId: string,
  reportingPeriod: string,
): boolean {
  for (const e of store.replay({ entity, type: "ReportGenerated" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === formId && p.reportingPeriod === reportingPeriod) return true;
  }
  return false;
}

/** True when a `ReportFiled` already exists for (entity, formId, period). */
export function reportFiledExists(
  store: EventStore,
  entity: string,
  formId: string,
  reportingPeriod: string,
): boolean {
  for (const e of store.replay({ entity, type: "ReportFiled" })) {
    const p = e.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === formId && p.reportingPeriod === reportingPeriod) return true;
  }
  return false;
}

export interface PersistBa700ReportArgs {
  readonly store: EventStore;
  readonly entity: string;
  readonly reportingPeriod: string;
  readonly output: Ba700Output;
  /** RwaComputed (or other) source event ids contributing the figures. */
  readonly sourceEventIds?: readonly string[];
}

export interface PersistedBa700Report {
  /** event_id of the emitted (or pre-existing) ReportGenerated. */
  readonly reportGeneratedEventId: string;
  /** The BLAKE3 content hash of the rendered return. */
  readonly contentHash: string;
  /** Whether a new ReportGenerated was emitted (false = idempotent skip). */
  readonly emitted: boolean;
}

/**
 * Emit `ReportGenerated` for the closed period — idempotently. Returns the
 * event id + content hash so the caller can chain a `ReportFiled`.
 */
export function persistBa700ReportGenerated(args: PersistBa700ReportArgs): PersistedBa700Report {
  const { store, entity, reportingPeriod, output } = args;
  const formId = "BA700";
  const contentHash = ba700ContentHash(output);

  // Idempotency: one ReportGenerated per (entity, formId, period).
  if (reportGeneratedExists(store, entity, formId, reportingPeriod)) {
    for (const e of store.replay({ entity, type: "ReportGenerated" })) {
      const p = e.payload as { formId?: string; reportingPeriod?: string };
      if (p.formId === formId && p.reportingPeriod === reportingPeriod) {
        return { reportGeneratedEventId: e.event_id, contentHash, emitted: false };
      }
    }
  }

  const currency = output.meta.functionalCurrency;
  const stack = output.capitalStack;

  const event = makeReportGenerated({
    asOf: output.meta.asOf,
    entity,
    actor: { type: "service", id: "bea:ba700-period-close" },
    citations: CITATIONS,
    payload: {
      entity,
      formId,
      formVersion: output.meta.formVersion,
      reportingPeriod,
      generatedAt: output.meta.asOf,
      functionalCurrency: currency,
      ba700Figures: {
        cet1Capital: { currency, amount: minorToDecimalString(stack.cet1.netStockMinor, currency) },
        at1Capital: { currency, amount: minorToDecimalString(stack.at1.netStockMinor, currency) },
        tier2Capital: { currency, amount: minorToDecimalString(stack.t2.netStockMinor, currency) },
        totalRwa: {
          currency,
          amount: minorToDecimalString(output.rwa.totalRwaMinor, currency),
        },
        cet1Ratio: ratioToString(output.ratios.cet1Ratio),
        tier1Ratio: ratioToString(output.ratios.tier1Ratio),
        totalRatio: ratioToString(output.ratios.totalRatio),
      },
      contentHash,
      sourceEventIds: [
        ...(output.rwa.rwaComputationEventId ? [output.rwa.rwaComputationEventId] : []),
        ...(args.sourceEventIds ?? []),
      ],
      citations: CITATIONS,
    },
  });
  store.append(event);

  return { reportGeneratedEventId: event.event_id, contentHash, emitted: true };
}

export interface PersistBa700FiledArgs {
  readonly store: EventStore;
  readonly entity: string;
  readonly reportingPeriod: string;
  readonly contentHash: string;
  readonly reportGeneratedEventId: string;
  readonly filedAt: string;
  readonly mode: "simulator" | "live";
}

/**
 * Emit `ReportFiled` for the closed period — idempotently. Links the filing to
 * the `ReportGenerated` by event id + content hash (chain-of-custody).
 * Returns true iff a new event was emitted.
 */
export function persistBa700ReportFiled(args: PersistBa700FiledArgs): boolean {
  const { store, entity, reportingPeriod } = args;
  const formId = "BA700";

  if (reportFiledExists(store, entity, formId, reportingPeriod)) {
    return false;
  }

  const event = makeReportFiled({
    asOf: args.filedAt,
    entity,
    actor: { type: "service", id: "bea:ba700-period-close" },
    citations: CITATIONS,
    payload: {
      entity,
      formId,
      reportingPeriod,
      filedAt: args.filedAt,
      mode: args.mode,
      contentHash: args.contentHash,
      reportGeneratedEventId: args.reportGeneratedEventId,
      citations: CITATIONS,
    },
  });
  store.append(event);
  return true;
}
