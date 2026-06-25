// platform/recon/agent-memory-doc-resolves.ts
//
// recon:agent-memory-doc-resolves — every `AgentMemoryCommitted`'s
// `bodyDocumentHash` resolves to bytes in the document store.
//
// THE INVARIANT (mirrors recon:rms-document-blob-integrity for RecordFiled): the
// event log is canonical (Principle 1); a memory whose body bytes are gone is an
// unservable memory. FAIL on any `bodyDocumentHash` that resolves nowhere.
//
// STORE RESOLUTION (identical ladder to rms-document-blob-integrity):
//   - Event store: `eventStore` from composition (env-overridable via
//     BANK_EVENT_DB; per-worktree `.local/event.db` in CI).
//   - Document store: `new LocalFsDocumentStore()` (composition-posture ladder)
//     with the legacy in-repo store as a `warn`-tier second look-up.
//
// WHY CI IS GREEN: the only writer (`recordMemoryCommitted` via the close-run
// `--memory` path) pairs the `documentStore.put` with the event append IN THE
// SAME PROCESS against the SAME resolution — so every memory's blob is present
// by construction. The dangling-FAIL direction comes live only on the shared
// production pair sweep, exactly like rms-document-blob-integrity.
//
// SEVERITY: blob present in resolved store → OK. Present only in legacy in-repo
// store → `warn` (pending migration). Missing everywhere → `fail` (real
// integrity breach — there is no historical backlog: the family is born this
// slice, so every memory was written by the paired-put path).
//
// EMPTY-STATE CORRECTNESS: zero memories → asserted=0, ok=true.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 1; D-CROSS-WORKTREE-EVENT-STORE-SYNC (store-resolution precedent).
//   Principle 1 (events canonical; doc store is the cited heavy bytes).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import { inRepoDocumentStoreRoot } from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { AGENT_MEMORY_COMMITTED } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-doc-resolves";

export interface DocResolvesDeps {
  /** Injected events (tests). Default: composition replay of the family. */
  readonly memoryEvents?: readonly Event[];
  /** Injected resolved store (tests). Default: `new LocalFsDocumentStore()`. */
  readonly resolvedStore?: DocumentStore;
  /**
   * Injected legacy in-repo store (tests). Default: the repo-anchored in-repo
   * store when it differs from the resolved root, else `null`. Pass `null` to
   * disable the legacy tier explicitly.
   */
  readonly legacyStore?: DocumentStore | null;
}

function defaultStores(): { resolved: LocalFsDocumentStore; legacy: LocalFsDocumentStore | null } {
  const resolved = new LocalFsDocumentStore();
  const legacyRoot = inRepoDocumentStoreRoot();
  const legacy =
    resolved.rootPath() === legacyRoot ? null : new LocalFsDocumentStore({ root: legacyRoot });
  return { resolved, legacy };
}

/**
 * Pure assertion core (exercised sabotage-proof in the test). Returns a
 * violation per memory whose body hash does not resolve in the resolved store
 * (severity `warn` if it resolves in the legacy store, `fail` if nowhere).
 */
export function assertDocResolves(
  events: readonly Event[],
  resolvedStore: DocumentStore,
  legacyStore: DocumentStore | null,
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  for (const e of events) {
    if (e.type !== AGENT_MEMORY_COMMITTED) continue;
    const payload = e.payload as Record<string, unknown>;
    const hash = typeof payload.bodyDocumentHash === "string" ? payload.bodyDocumentHash : null;
    if (!hash) continue; // schema requires it; defensive against legacy rows
    const memoryId = typeof payload.memoryId === "string" ? payload.memoryId : "(no memoryId)";

    asserted++;

    if (resolvedStore.exists(hash as DocumentHash)) continue;

    const subject = `${memoryId} → ${hash}`;

    if (legacyStore?.exists(hash as DocumentHash)) {
      violations.push({
        subject,
        message: `AgentMemoryCommitted body for \`${memoryId}\` resolves only in the legacy in-repo document store — pending migration to the shared store. Remediation: \`bun run migrate:document-store-blobs\`. Citations: D-CROSS-WORKTREE-EVENT-STORE-SYNC, D-AGENT-MEMORY-PERSISTENCE.`,
        severity: "warn",
      });
      continue;
    }

    violations.push({
      subject,
      message: `AgentMemoryCommitted body for \`${memoryId}\` (hash ${hash}) resolves in NO document store — the cited heavy bytes are gone (Principle 1: the event is canonical; the body it cites by hash must exist). D-AGENT-MEMORY-PERSISTENCE.`,
      severity: "fail",
    });
  }

  return { asserted, violations };
}

export function run(deps: DocResolvesDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);

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

  const events: Event[] =
    deps.memoryEvents !== undefined
      ? [...deps.memoryEvents]
      : [...eventStore.replay({ type: AGENT_MEMORY_COMMITTED })];

  const { asserted, violations } = assertDocResolves(events, resolvedStore, legacyStore);
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : result.ok ? "ADVISORY" : "FAIL";
  console.log(`recon:agent-memory-doc-resolves [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
