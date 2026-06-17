// v2-core/bucket-c-loadbearing/index.ts
//
// Bucket C — FINAL load-bearing batch (CLOSES bucket C): the 14 load-bearing
// dispatch / run-lifecycle / RMS substrate types.
//
// WHAT THIS IS
// ------------
// The single source of truth for the 14 money-free, LOAD-BEARING bucket-C
// substrate types migrated to the v2 control-plane store via the proven
// store-tee verbatim path (D-BANK-WIDE-V2-MIGRATION;
// D-V1-REMOVAL-BUCKET-C-LOAD-BEARING-FLIP). The registry rows
// (`v2-core/registry/index.ts`) and the batch parity gate
// (`platform/recon/bucket-c-loadbearing-v2-parity.ts`) both derive their type
// set from `BUCKET_C_LOADBEARING_TYPES` here, so the two can never drift.
// Direct continuation of bucket-C batches 1–4 (#1408–#1411); identical pattern.
//
// AFTER THIS BATCH bucket C is FULLY CLOSED — no bucket-C type remains
// `v1-only`. These 14 are the LAST.
//
// ★CRITICAL INVARIANT — the dispatch CLIs stay V1-AUTHORITATIVE
// -------------------------------------------------------------
// These types are written by the dispatch CLIs (`open-brief` / `start-run` /
// `close-run`) and the RMS register / run-lifecycle machinery. This flip
// changes ONLY `v2Status` (v1-only → v2-replaced) + the ratchet — it MUST NOT
// change where the CLIs write or read. The CLIs keep emitting to the V1 store;
// the store-tee mirrors V1→v2 (read-side); `open-brief` keeps replaying V1
// `AgentBriefIssued` for dedup. The CLI-read cutover (making dispatch read v2)
// is a SEPARATE, deferred workstream (out of scope here, gated on Scrooge who
// owns the run lifecycle). The RMS / dispatch parity gates
// (`recon:rms-briefs-parity`, `recon:rms-documents-parity`,
// `recon:dispatch-sync-integrity`) continue to read the V1 shape and MUST stay
// green — that is the standing proof the CLIs are unaffected.
//
// THE SET — the 14 load-bearing types (scope §1.2)
// ------------------------------------------------
//   - C-1 RMS registers: AgentBriefIssued, RecordFiled, DecisionRequested,
//     Feedback, BriefSuperseded, Decision, DocumentRegistered.
//   - C-2 run lifecycle: AgentRunStarted, AgentRunCompleted, AgentRunFailed,
//     WorkstreamRegistered, WorkstreamStarted, WorkstreamCompleted, ReconResult.
// Money-free confirmed by reading the backing schemas (`rms.ts`, `decision.ts`,
// `governance-snapshots.ts`, `agent-ops.ts`): no `*Minor`, no `minorUnits`, no
// `notional`, no `MoneyWire`. Verbatim codec applies (no MoneyWire).
//
// ★SELF-REFERENCE HAZARD — `ReconResult` — ANALYSED, NOT A HAZARD (INCLUDED):
// `ReconResult` is the event the standing `vera-overnight-recon` agent run
// appends to the AUTHORITATIVE V1 store once per recon outcome
// (`runtime/agents/vera-overnight-recon.ts`). The parity gate here (and
// `run-recon-suite.ts`) compute `ReconResult` objects only IN MEMORY — they
// never `store.append` a `ReconResult`. So the store-tee mirrors each V1
// `ReconResult` to v2 exactly once (reusing the V1 event_id, `INSERT OR
// IGNORE`, idempotent); a parity gate emitting a `ReconResult` that then gets
// re-mirrored does NOT occur. No recon-feedback loop. `ReconResult` is INCLUDED
// in this batch (14/14 flipped, none excluded).
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
// tee, and the byte-tuple parity gate is the hard backstop.
//
// PACKAGE BOUNDARY: inside `v2-core/` — MUST NOT import from any v1 code-line
// directory (`recon:v2-no-v1-import`). Only re-exports the batch-1 opaque schema.
//
// Authority: D-V1-REMOVAL-BUCKET-C-LOAD-BEARING-FLIP (CEO-approved 2026-06-17,
//   session-delegation); D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//   D-V1-REMOVAL-FLIP-BASIS-RBC (CEO-approved 2026-06-16).
// Engineering Charter: D-ENGINEERING-INTEGRITY-CHARTER.
// Brief: brief:atlas:bucket-c-loadbearing-final:2026-06-17.
// Author: Atlas (Core banking platform architect, engineering).

export { bucketCVerbatimSchema } from "../bucket-c-batch1";

/**
 * The 14 LOAD-BEARING dispatch / run-lifecycle / RMS bucket-C substrate types
 * migrated in this FINAL batch (CLOSES bucket C). The registry rows and the
 * parity gate derive from this single list.
 */
export const BUCKET_C_LOADBEARING_TYPES = [
  // --- C-1 RMS registers (7) ---
  "AgentBriefIssued",
  "RecordFiled",
  "DecisionRequested",
  "Feedback",
  "BriefSuperseded",
  "Decision",
  "DocumentRegistered",
  // --- C-2 run lifecycle (7) ---
  "AgentRunStarted",
  "AgentRunCompleted",
  "AgentRunFailed",
  "WorkstreamRegistered",
  "WorkstreamStarted",
  "WorkstreamCompleted",
  "ReconResult",
] as const;

export type BucketCLoadBearingType = (typeof BUCKET_C_LOADBEARING_TYPES)[number];
