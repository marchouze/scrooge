// v2-core/bucket-c-batch4/index.ts
//
// Bucket C — bulk batch 4 (COMPLETES the non-load-bearing wave): the four
// reference-data-process boundary types.
//
// WHAT THIS IS
// ------------
// The single source of truth for the 4 money-free, NON-load-bearing bucket-C
// substrate types migrated to the v2 control-plane store via the proven
// store-tee verbatim path (D-BANK-WIDE-V2-MIGRATION). The registry rows
// (`v2-core/registry/index.ts`) and the batch parity gate
// (`platform/recon/bucket-c-batch4-v2-parity.ts`) both derive their type set
// from `BUCKET_C_BATCH4_TYPES` here, so the two can never drift. Direct
// continuation of bucket-C batch 1 (#1408), batch 2 (#1409) and batch 3
// (#1410, ratchet 335→306); identical pattern.
//
// AFTER THIS BATCH, the ONLY bucket-C types left `v1-only` are the 14
// load-bearing dispatch / run-lifecycle / RMS types (held for the separate
// CEO checkpoint; the dispatch CLIs stay V1-authoritative). See scope §1.2.
//
// THE SET — why these four, and ONLY these four
// ---------------------------------------------
// After batches 1–3, the registry filtered `v2Status === "v1-only"` leaves
// exactly 19 bucket-C types: the 14 load-bearing dispatch types (out of scope,
// CEO checkpoint) + `ReconciliationBreak` (excluded — see below) + these four
// reference-data-process types. They are the C/B-boundary "reference-data-
// process" set called out in scope §7's appendix footnote: money-free and
// control-plane, so they ride the C verbatim path regardless of which sub-class
// they are filed under:
//   - SanctionsListPublished  (Mira — UNSC/OFAC/EU sanctions list update)
//   - PepListPublished        (Mira — PEP list update)
//   - AdverseMediaPublished   (Mira — adverse-media item about a party)
//   - TaxClassificationPublished (Yael — tax classification for an instrument)
// Money-free confirmed by reading each backing schema in
// `aml-popia-extended.ts` (sanctions/PEP/adverse-media) and
// `ifrs-accounting-extended.ts` (tax-classification): listId/listName/
// publishingAuthority/publishedAt/entryCount/changeKind (sanctions, PEP),
// mediaId/partyRef/headline/source/severity/requiresReview (adverse-media),
// classificationId/instrumentKind/taxTreatment/publishedBy/effectiveDate/
// sarsReference (tax) — no `*Minor`, no `minorUnits`, no `notional`, no money
// field. Verbatim codec applies (no MoneyWire).
//
// EXPLICITLY EXCLUDED — `ReconciliationBreak` (payments-domain, C/B boundary):
// `reconciliationBreakPayloadSchema` (`platform/event-store/event-types/
// payments.ts`, PROC-PAY-RBH-01) carries `tradeAmount`/`paymentAmount` MINOR-
// UNIT money fields. It is money-BEARING and sits on the substrate/financial
// (C/B) boundary, exactly the de-dup / boundary hazard scope §0 flagged and
// batch-3 explicitly held back. Per the dispatch "if ANY doubt, exclude and
// report" discipline, it is NOT forced into this verbatim batch — it belongs to
// a dedicated money-bearing slice (MoneyWire codec) or to the licence-day
// bucket-B financial wave, not to a money-free verbatim sweep.
//
// EXPLICITLY EXCLUDED — the 14 load-bearing dispatch types (held for the
// separate CEO checkpoint; the dispatch CLIs stay V1-authoritative):
//   AgentBriefIssued, AgentRunStarted, AgentRunCompleted, AgentRunFailed,
//   RecordFiled, Decision, DecisionRequested, DocumentRegistered, Feedback,
//   BriefSuperseded, ReconResult, WorkstreamRegistered, WorkstreamStarted,
//   WorkstreamCompleted.
//   Also already done: batch-1, batch-2, batch-3, the agent-performance pilot.
//
// THE SCHEMA CONTRACT — why opaque, not re-declared (Charter cmd 3 + 6)
// --------------------------------------------------------------------
// The store-tee mirrors each V1 append VERBATIM (identity codec) reusing the V1
// event_id. The V1 store is authoritative and ALREADY validated the event's
// concrete payload against its real V1 schema at emit time. The v2 mirror is a
// byte-faithful copy; the parity gate proves byte-equivalence of the
// {event_id, type, payload} tuple. The faithful v2-side schema for a verbatim
// mirror is therefore "an object, validated upstream" — the SHARED opaque
// `bucketCVerbatimSchema` (a `Record<string, unknown>`) reused from batch 1.
// This is NOT a weakened assertion: it is the correct contract for a verbatim
// tee, and the byte-tuple parity gate is the hard backstop that catches any real
// divergence the moment data lands.
//
// PACKAGE BOUNDARY: inside `v2-core/` — MUST NOT import from any v1 code-line
// directory (`recon:v2-no-v1-import`). Only re-exports the batch-1 opaque schema
// (itself a bare-zod construct).
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-batch4-final-non-load-bearing:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

export { bucketCVerbatimSchema } from "../bucket-c-batch1";

/**
 * The 4 reference-data-process bucket-C substrate types migrated in batch 4
 * (the FINAL non-load-bearing batch — completes the wave). The registry rows
 * and the parity gate derive from this single list.
 */
export const BUCKET_C_BATCH4_TYPES = [
  // --- C-boundary reference-data-process (4) ---
  "SanctionsListPublished",
  "PepListPublished",
  "AdverseMediaPublished",
  "TaxClassificationPublished",
] as const;

export type BucketCBatch4Type = (typeof BUCKET_C_BATCH4_TYPES)[number];
