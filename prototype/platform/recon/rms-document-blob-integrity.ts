// platform/recon/rms-document-blob-integrity.ts
//
// Continuous-controls pipeline: RMS document-blob integrity — the
// dangling-record detector.
//
// **FAIL direction:** a `RecordFiled` event in the resolved event store
// whose `documentHash` has no blob in the resolved document store. The
// event log is canonical (Principle 1); a record whose heavy bytes are
// gone is an unservable record — the seed incident is Vera (Internal
// audit engineer, third line)'s PR #1194 hand-rescue of blob
// `blake3:8cb3a86e…`, which dangled because an ephemeral worktree wrote
// the blob locally while the event went to the shared store, and the
// worktree was pruned.
//
// **Store resolution.** Both stores resolve exactly like every other
// recon pipeline's inputs:
//   - Event store: `eventStore` from `platform/composition` —
//     env-overridable via `BANK_EVENT_DB`; per-worktree `.local/event.db`
//     in CI.
//   - Document store: `new LocalFsDocumentStore()` — the default
//     (composition-posture) ladder `BANK_DOCUMENT_STORE` →
//     `BANK_DOCUMENT_STORE_PATH` → `BANK_HOME_DOCUMENT_STORE` →
//     per-worktree in-repo fallback (`prototype/data/documents`). See
//     `platform/document-store/resolve-document-store.ts`.
//
// **Why CI is green pre-migration (mechanism statement).** Every
// `RecordFiled` writer (`recordFiled` in `platform/records/helpers.ts`,
// the manifest replay, the dispatch CLIs) pairs the `documentStore.put`
// with the event append IN THE SAME PROCESS against the SAME resolution.
// In CI both stores are per-worktree (composition posture), so every
// event's blob is present by construction — no allowlist, no seed marker.
// The dangling-FAIL direction comes live when the gate is pointed at the
// shared pair (the production sweep):
//
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_DOCUMENT_STORE=$HOME/.local/share/bank/documents \
//   bun run recon:rms-document-blob-integrity
//
// which is expected to pass only AFTER
// `bun run migrate:document-store-blobs` has copied the in-repo blobs
// into the shared store.
//
// **Severity rules** (same dated-activation pattern as
// `rms-documents-parity.ts`):
//   - Blob missing from the resolved store but present in the legacy
//     in-repo store → `warn` ("pending migration", remediation = run the
//     migration script). Never a fail: the bytes exist and are
//     mechanically recoverable.
//   - Blob missing everywhere, event `as_of` BEFORE the enforcement date
//     (2026-06-11) → `warn` (historical pre-sync gap; remediation is a
//     Vera-style hand-rescue, not a new violation).
//   - Blob missing everywhere, event `as_of` ON OR AFTER 2026-06-11 →
//     `fail` (post-sync the boot shims keep blobs and events in the same
//     store, so a miss is a real integrity violation).
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation
//            2026-05-21) — design precedent, extended to blob roots;
//            D-RMS-PHASE-3 (RecordFiled is the canonical deliverable
//            event).
// Brief: brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import { eventStore } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import { inRepoDocumentStoreRoot } from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "rms-document-blob-integrity";

/**
 * ISO date (YYYY-MM-DD) from which a blob missing from every store is a
 * hard `fail`. Events earlier than this predate the document-store sync
 * (the boot shims landed 2026-06-10) and are historical `warn`s.
 */
export const ENFORCEMENT_DATE = "2026-06-11";

export interface BlobIntegrityDeps {
  /** Injected `RecordFiled` events (tests). Default: composition replay. */
  readonly recordFiledEvents?: readonly Event[];
  /** Injected resolved store (tests). Default: `new LocalFsDocumentStore()`. */
  readonly resolvedStore?: DocumentStore;
  /**
   * Injected legacy in-repo store (tests). Default: the repo-anchored
   * in-repo store when it differs from the resolved root, else `null`
   * (no second look-up when they are the same directory). Pass `null`
   * to disable the legacy tier explicitly.
   */
  readonly legacyStore?: DocumentStore | null;
  /** Enforcement boundary override (tests). Default `ENFORCEMENT_DATE`. */
  readonly enforcementDate?: string;
}

function defaultStores(): { resolved: LocalFsDocumentStore; legacy: LocalFsDocumentStore | null } {
  const resolved = new LocalFsDocumentStore();
  const legacyRoot = inRepoDocumentStoreRoot();
  const legacy = resolved.rootPath() === legacyRoot
    ? null
    : new LocalFsDocumentStore({ root: legacyRoot });
  return { resolved, legacy };
}

export function run(deps: BlobIntegrityDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const enforcementDate = deps.enforcementDate ?? ENFORCEMENT_DATE;

  let resolvedStore: DocumentStore;
  let legacyStore: DocumentStore | null;
  if (deps.resolvedStore) {
    resolvedStore = deps.resolvedStore;
    legacyStore = deps.legacyStore === undefined ? null : deps.legacyStore;
  } else {
    const stores = defaultStores();
    resolvedStore = stores.resolved;
    legacyStore = deps.legacyStore === undefined ? stores.legacy : deps.legacyStore;
  }

  const events: Iterable<Event> =
    deps.recordFiledEvents ?? eventStore.replay({ type: "RecordFiled" });

  for (const e of events) {
    const payload = e.payload as Record<string, unknown>;
    const hash = typeof payload.documentHash === "string" ? payload.documentHash : null;
    if (!hash) continue; // schema requires it; defensive against legacy rows
    const recordId = typeof payload.recordId === "string" ? payload.recordId : "(no recordId)";

    result.asserted++;

    if (resolvedStore.exists(hash as DocumentHash)) continue;

    const subject = `${recordId} → ${hash}`;

    if (legacyStore?.exists(hash as DocumentHash)) {
      violations.push({
        subject,
        message: `RecordFiled blob for \`${recordId}\` resolves only in the legacy in-repo document store — pending migration to the shared store. Remediation: \`bun run migrate:document-store-blobs\` (idempotent, source-preserving). Citations: D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-RMS-PHASE-3.`,
        severity: "warn",
      });
      continue;
    }

    const eventDate = (e.as_of ?? "").slice(0, 10);
    const postEnforcement = eventDate >= enforcementDate;

    violations.push({
      subject,
      message: postEnforcement
        ? `DANGLING RECORD: RecordFiled event \`${recordId}\` (as_of ${eventDate}) cites documentHash \`${hash}\` with no blob in the resolved document store NOR the legacy in-repo store. Post-${enforcementDate} the boot shims pair blob and event in the same store — this is a real integrity violation. Citations: D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-RMS-PHASE-3, Principle 1.`
        : `Dangling record (historical): RecordFiled event \`${recordId}\` (as_of ${eventDate}, pre-${enforcementDate}) cites documentHash \`${hash}\` with no blob in any reachable store. Pre-sync gap — remediation is blob rescue (cf. Vera's PR #1194 hand-rescue), then migration. Citations: D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-RMS-PHASE-3.`,
      severity: postEnforcement ? "fail" : "warn",
    });
  }

  result.violations = violations;
  result.ok = violations.every((v) => v.severity !== "fail");
  return result;
}

if (import.meta.main) {
  const r = run();
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.ok
        ? "RMS document-blob integrity passed"
        : "RMS document-blob integrity FAILED — RecordFiled documentHash with no resolvable blob (dangling record)",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
