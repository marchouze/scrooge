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
//   2. Computes a BLAKE3 content hash of the ATTESTABLE CONTENT (the sorted-key
//      figures that bind: form, entity, period, currency, capital tiers, RWA,
//      ratios) — NOT the raw rendered XML. It deliberately excludes incidental
//      per-store envelope ids (trial-balance snapshot id, fingerprints) so the
//      hash is a deterministic function of WHAT the return attests, replay-stable
//      across stores. (The rendered XML envelope is filed separately — see
//      `fileBa700ReturnArtefact` — under its OWN document-store hash, which is
//      NOT equal to this content hash. See the hash-linkage note above.)
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
// (`RecordFiled`) is done by `fileBa700ReturnArtefact` (D-BA-RETURN-OF-RECORD-
// DOCUMENT-STORE) — see the hash-linkage note on that function. The content
// hash here is the integrity anchor the filing references; the two hashes hash
// DIFFERENT bytes and are NOT equal (see below).
//
// ## Hash-linkage (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE — the crux)
//
// `ReportGenerated.contentHash` (`ba700ContentHash`) hashes the ATTESTABLE
// CONTENT (sorted-key figures) so it is replay-stable across stores. The RMS
// document-store hash of the RENDERED XML ENVELOPE hashes DIFFERENT bytes (it
// embeds incidental per-store ids — `TrialBalanceSnapshotEventId`,
// `RwaComputationEventId` — and the `renderedAt` envelope attribute). So the
// two hashes are NOT, and must NOT be assumed, equal. The linkage is by
// REFERENCE, not hash-equality: the `RecordFiled` event records the envelope's
// document-store hash as `documentHash`, AND references the `ReportGenerated`
// (by event id in `recordId` + content hash in `citations`). The full chain is
//   figures → contentHash → ReportGenerated → RecordFiled → envelope blob.
// This deliberately does NOT change #1559's `contentHash` semantics.
//
// Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-BA-RETURN-OF-RECORD-DOCUMENT-
//   STORE; D-RMS-PHASE-1; D-V1-REMOVAL-PHASE-1; Banks Act 94/1990 §70 + §73;
//   Principles/1-events-are-truth.md.
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import { moneyFromMinorUnits } from "../../core/decimal-money";
import type { Currency } from "../../core/types";
import { defaultDocumentStore } from "../../document-store";
import { hashContent } from "../../document-store/hash";
import type { DocumentStore } from "../../document-store/types";
import { type RecordFiledPayload, makeRecordFiled } from "../../event-store/event-types";
import {
  makeReportFiled,
  makeReportGenerated,
} from "../../event-store/event-types/return-of-record";
import type { EventStore } from "../../event-store/store";
import { ba100ToXmlPayload } from "../../reporting/ba-700-xml-adapter";
import { renderSarbXml } from "../../reporting/xml-render";
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

// ---------------------------------------------------------------------------
// fileBa700ReturnArtefact — RMS document-store filing of the rendered envelope.
//
// Closes GAP-BA-RETURN-OF-RECORD-DOCUMENT-STORE: the full rendered SARB XML
// envelope is put into the RMS content-addressed document store and a typed
// `RecordFiled{registerKey:"documents"}` event is appended referencing both
// hashes (envelope doc-store hash as `documentHash`; the return-of-record event
// id + attestable `contentHash` in `recordId`/`citations`).
//
// ## Render reuse — NOT a re-derivation
//
// The envelope is rendered from the SAME `Ba700Output` (`output`) the caller
// already computed for `persistBa700ReportGenerated` — figures are mapped to the
// SARB XML payload (`ba100ToXmlPayload`) and rendered (`renderSarbXml`). It does
// NOT re-run the generator, so the filed artefact is provably the rendered form
// of the attested figures (no consistent-but-wrong drift).
//
// ## Determinism / replay-safety
//
//   - `renderedAt` is fixed to `output.meta.asOf` (the period-close instant), a
//     deterministic function of the closed period — NOT the wall clock. So the
//     rendered bytes (and hence the document-store hash) are identical on every
//     replay of the same closed period in the same store. The content-addressed
//     `put` is idempotent (same bytes → same hash → existing file preserved).
//   - The `RecordFiled` EMIT is guarded per (entity, formId, reportingPeriod)
//     via `recordFiledArtefactExists`, so re-running a closed period appends at
//     most one `RecordFiled` for that return. Both layers are idempotent.
//
// Note the document-store hash of the envelope is store-local: the envelope
// embeds incidental per-store ids (`TrialBalanceSnapshotEventId`,
// `RwaComputationEventId`) so it can differ across independent stores even for
// the same attested figures. That is exactly why the linkage is by REFERENCE,
// not hash-equality, and why it must never be conflated with `contentHash`.
// ---------------------------------------------------------------------------

/** Document-store classification + retention for a filed BA 700 return. */
const BA700_RECORD_RETENTION: RecordFiledPayload["retention"] = {
  // Banks Act 94 of 1990 §73 — prudential record-keeping. BA returns are
  // board/management-facing prudential filings; 7-year cool tier.
  citationRef: "Banks Act 94 of 1990 §73",
  minimumYears: 7,
  archivalTier: "cool",
};

/**
 * Stable `recordId` for the filed BA 700 envelope of a closed period — the
 * idempotency key for the `RecordFiled` emit. Embeds entity + form + period so
 * it is unique per return and stable across replays.
 */
export function ba700ArtefactRecordId(entity: string, reportingPeriod: string): string {
  return `record:documents:ba700-return:${entity}:${reportingPeriod}`;
}

/**
 * True when a `RecordFiled` for this BA 700 return's rendered envelope already
 * exists (matched on the stable `recordId`). The document-filing idempotency
 * guard.
 */
export function recordFiledArtefactExists(
  store: EventStore,
  entity: string,
  reportingPeriod: string,
): boolean {
  const recordId = ba700ArtefactRecordId(entity, reportingPeriod);
  for (const e of store.replay({ entity, type: "RecordFiled" })) {
    const p = e.payload as { recordId?: string; registerKey?: string };
    if (p.registerKey === "documents" && p.recordId === recordId) return true;
  }
  return false;
}

/**
 * Render the BA 700 return to its SARB XML envelope and return the canonical
 * bytes — a pure function of the `Ba700Output` (`renderedAt` fixed to the
 * period-close instant for determinism). Exported so the recon + tests can
 * reproduce the exact filed bytes and assert the doc-store hash resolves.
 */
export function renderBa700Envelope(output: Ba700Output): string {
  const payload = ba100ToXmlPayload(output);
  return renderSarbXml(payload, { renderedAt: output.meta.asOf });
}

export interface FileBa700ArtefactArgs {
  readonly store: EventStore;
  readonly entity: string;
  readonly reportingPeriod: string;
  /** The SAME generator output used for `persistBa700ReportGenerated`. */
  readonly output: Ba700Output;
  /** event_id of the `ReportGenerated` this artefact renders (chain-of-custody). */
  readonly reportGeneratedEventId: string;
  /** The attestable content hash of the return-of-record (recorded for linkage). */
  readonly contentHash: string;
  readonly filedAt: string;
  /** Document store to file into. Defaults to the composition singleton. */
  readonly documentStore?: DocumentStore;
}

export interface FiledBa700Artefact {
  /** Document-store hash of the rendered XML envelope (NOT the contentHash). */
  readonly documentHash: string;
  /** event_id of the emitted (or pre-existing) RecordFiled. */
  readonly recordFiledEventId: string;
  /** Whether a new RecordFiled event was emitted (false = idempotent skip). */
  readonly emitted: boolean;
  /** Whether a new document blob was written (false = content-addressed re-put). */
  readonly isNewDocument: boolean;
}

/**
 * Render the BA 700 return-of-record to its SARB XML envelope, file the blob in
 * the RMS content-addressed document store, and emit a `RecordFiled` referencing
 * the `ReportGenerated` by event id + content hash. Idempotent per (entity,
 * formId, reportingPeriod) at BOTH the blob layer (content-addressing) and the
 * event layer (`recordFiledArtefactExists`).
 */
export function fileBa700ReturnArtefact(args: FileBa700ArtefactArgs): FiledBa700Artefact {
  const { store, entity, reportingPeriod } = args;
  const documentStore = args.documentStore ?? defaultDocumentStore;
  const recordId = ba700ArtefactRecordId(entity, reportingPeriod);

  // Render reuse (NOT re-derivation): the SAME generator output → SARB XML.
  const envelope = renderBa700Envelope(args.output);

  // Content-addressed put — idempotent (same bytes → same hash, existing file
  // preserved). Done BEFORE the idempotency short-circuit so the blob is present
  // even on a replay that already emitted the RecordFiled (e.g. the event landed
  // but a prior run's blob was pruned). `put` is a no-op when the blob exists.
  const put = documentStore.put(envelope);

  // Idempotency: one RecordFiled per (entity, formId, period).
  if (recordFiledArtefactExists(store, entity, reportingPeriod)) {
    for (const e of store.replay({ entity, type: "RecordFiled" })) {
      const p = e.payload as { recordId?: string; registerKey?: string };
      if (p.registerKey === "documents" && p.recordId === recordId) {
        return {
          documentHash: put.hash,
          recordFiledEventId: e.event_id,
          emitted: false,
          isNewDocument: put.isNew,
        };
      }
    }
  }

  // Linkage by REFERENCE (not hash-equality): the RecordFiled records the
  // envelope's document-store hash as `documentHash`; the return-of-record event
  // id is in `recordId`-adjacent metadata + the attestable contentHash is in the
  // citations, so the chain figures → contentHash → ReportGenerated →
  // RecordFiled → envelope blob is fully recoverable from the event log.
  const event = makeRecordFiled({
    asOf: args.filedAt,
    entity,
    actor: { type: "service", id: "bea:ba700-period-close" },
    citations: [
      ...CITATIONS,
      // Chain-of-custody references (Principle 1): the return-of-record event id
      // and its attestable content hash. These make the RecordFiled→ReportGenerated
      // linkage explicit without assuming hash-equality between the two artefacts.
      `reportGeneratedEventId:${args.reportGeneratedEventId}`,
      `attestableContentHash:${args.contentHash}`,
    ],
    payload: {
      recordId,
      registerKey: "documents",
      documentHash: put.hash,
      classification: "governance-seat",
      retention: BA700_RECORD_RETENTION,
      metadata: {
        title: `BA 700 Capital-Adequacy return — ${entity} ${reportingPeriod}`,
        path: `rms://returns/ba700/${entity}/${reportingPeriod}.xml`,
        category: "regulatory-return",
        author: "Bea (Accounting & financial reporting engineer, engineering)",
        date: args.filedAt,
        contentType: "application/xml",
      },
    },
  });
  store.append(event);

  return {
    documentHash: put.hash,
    recordFiledEventId: event.event_id,
    emitted: true,
    isNewDocument: put.isNew,
  };
}
