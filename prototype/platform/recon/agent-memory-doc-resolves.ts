// platform/recon/agent-memory-doc-resolves.ts
//
// recon:agent-memory-doc-resolves — every `AgentMemoryCommitted`'s
// `bodyDocumentHash` resolves to bytes in the SAME document store the read path
// (`dispatch:recall` / `readMyMemory` / `WorldStateSnapshot.myMemory`) reads.
//
// THE INVARIANT (Principle 1): the event log is canonical; a memory whose body
// bytes are not resolvable by the read path is an unservable memory — it shows
// "(body UNRESOLVED)" at `dispatch:recall`. FAIL on any `bodyDocumentHash` that
// does not resolve in the read-path store.
//
// STORE RESOLUTION — model the READ PATH, not the per-worktree singleton.
//   - Event store: `eventStore` from composition (env-overridable via
//     BANK_EVENT_DB; per-worktree `.local/event.db` in CI; the canonical
//     `$HOME/.local/share/bank/event.db` in the live sweep).
//   - Document store (primary): `readPathDocumentStoreRoot()` — the
//     home-default-ENABLED resolution (`BANK_DOCUMENT_STORE` →
//     `BANK_DOCUMENT_STORE_PATH` → `BANK_HOME_DOCUMENT_STORE` →
//     `$HOME/.local/share/bank/documents`). This is the EXACT root the recall
//     boot shim (`resolve-event-db-boot`) sets, so the gate checks the store
//     recall actually reads. (The previous version used
//     `new LocalFsDocumentStore()` — the `excludeHomeDefault` singleton, i.e.
//     `<repo>/prototype/data/documents` — which is NOT the recall store in the
//     shared-home topology. That blind spot let a backfill writing to the
//     per-worktree store pass this gate while `dispatch:recall` returned
//     UNRESOLVED. This gate now models the read path so that exact divergence
//     FAILS.)
//   - Document store (second tier): the per-worktree in-repo store
//     (`inRepoDocumentStoreRoot()`), looked up ONLY to DIAGNOSE the divergence —
//     a body found here but NOT in the read-path store is the backfill→recall
//     split (the seed/writer wrote per-worktree while recall reads the shared
//     store).
//
// WHY CI IS GREEN: every memory writer — `recordMemoryCommitted` via the
// close-run `--memory` path AND the seed backfill (`backfill:agent-memory-from-
// notes`) — boots the shared store, so the `documentStore.put` and the event
// append target the SAME read-path resolution. In CI `BANK_DOCUMENT_STORE` is
// pinned repo-local (`.local/documents`, see pr-ci.yml), so writer + this gate
// both resolve there and every blob is present by construction. The FAIL
// direction comes live when a writer regresses to the per-worktree store while
// recall reads the shared store.
//
// SEVERITY (fail-closed; Charter cmd 2). The agent-memory family is born this
// slice — there is NO historical migration backlog — so a body that does not
// resolve in the read-path store is always a real, recall-breaking defect:
//   - resolves in the read-path store → OK.
//   - resolves ONLY in the per-worktree in-repo store → `fail` (backfill→recall
//     doc-store divergence; remediation: re-run the seed backfill against the
//     shared store, or `bun run migrate:document-store-blobs`).
//   - resolves nowhere → `fail` (the cited heavy bytes are gone).
//
// EMPTY-STATE CORRECTNESS: zero memories → asserted=0, ok=true.
//
// REPLAY-SAFE: pure over (events, stores); the only filesystem touches are
// `exists` look-ups. No wall-clock, no mutation.
//
// Authority: D-AGENT-MEMORY-PERSISTENCE (CEO-approved 2026-06-25); WS-AGENT-MEMORY
//   Slice 1; D-CROSS-WORKTREE-EVENT-STORE-SYNC (store-resolution precedent).
//   Engineering Charter cmd 2 (fail-closed), cmd 9 (replay-safe & append-only).
//   Principle 1 (events canonical; doc store is the cited heavy bytes).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { AGENT_MEMORY_COMMITTED } from "../event-store/event-types";
import type { Event } from "../event-store/types";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "agent-memory-doc-resolves";

/**
 * The document-store root the READ PATH resolves to — the home-default-ENABLED
 * resolution (NOT `excludeHomeDefault`). This is the same root the recall boot
 * shim (`applySharedDocumentStoreResolution`) sets, so the gate checks exactly
 * the store `dispatch:recall` reads:
 *   - `BANK_DOCUMENT_STORE` pinned (CI / local repro) → that repo-local root.
 *   - unset (live shared-home sweep) → `$HOME/.local/share/bank/documents`.
 * Exported so the regression test can assert the gate tracks the read path and
 * never silently reverts to the per-worktree singleton.
 */
export function readPathDocumentStoreRoot(): string {
  return resolveDocumentStoreRoot({}).root;
}

export interface DocResolvesDeps {
  /** Injected events (tests). Default: composition replay of the family. */
  readonly memoryEvents?: readonly Event[];
  /**
   * Injected read-path store (tests). Default: a store mounted on
   * `readPathDocumentStoreRoot()` — the store `dispatch:recall` reads.
   */
  readonly resolvedStore?: DocumentStore;
  /**
   * Injected per-worktree in-repo store (tests) — the second-tier diagnostic
   * store recall does NOT read. Default: the repo-anchored in-repo store when it
   * differs from the read-path root, else `null`. Pass `null` to disable the
   * divergence-diagnosis tier explicitly.
   */
  readonly perWorktreeStore?: DocumentStore | null;
}

function defaultStores(): {
  resolved: LocalFsDocumentStore;
  perWorktree: LocalFsDocumentStore | null;
} {
  const readPathRoot = readPathDocumentStoreRoot();
  const resolved = new LocalFsDocumentStore({ root: readPathRoot });
  const inRepoRoot = inRepoDocumentStoreRoot();
  const perWorktree =
    readPathRoot === inRepoRoot ? null : new LocalFsDocumentStore({ root: inRepoRoot });
  return { resolved, perWorktree };
}

/**
 * Pure assertion core (exercised sabotage-proof in the test). Returns a
 * `fail` violation per memory whose body hash does not resolve in the read-path
 * store — distinguishing the backfill→recall DIVERGENCE (resolves only in the
 * per-worktree store) from total loss (resolves nowhere). Both are fail-closed.
 */
export function assertDocResolves(
  events: readonly Event[],
  resolvedStore: DocumentStore,
  perWorktreeStore: DocumentStore | null,
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

    if (perWorktreeStore?.exists(hash as DocumentHash)) {
      violations.push({
        subject,
        message: `BACKFILL→RECALL DIVERGENCE: AgentMemoryCommitted body for \`${memoryId}\` resolves only in the per-worktree in-repo document store, NOT the shared store \`dispatch:recall\`/\`readMyMemory\` reads — so the seeded memory shows "(body UNRESOLVED)" at recall in the shared-home topology. The writer wrote per-worktree while recall reads the shared store. Remediation: re-run \`bun run backfill:agent-memory-from-notes\` against the shared store (idempotent — it boots the shared store and re-puts the body), or \`bun run migrate:document-store-blobs\`. Citations: D-AGENT-MEMORY-PERSISTENCE, D-CROSS-WORKTREE-EVENT-STORE-SYNC, Principle 1.`,
        severity: "fail",
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
  let perWorktreeStore: DocumentStore | null;
  if (deps.resolvedStore) {
    resolvedStore = deps.resolvedStore;
    perWorktreeStore = deps.perWorktreeStore === undefined ? null : deps.perWorktreeStore;
  } else {
    const stores = defaultStores();
    resolvedStore = stores.resolved;
    perWorktreeStore =
      deps.perWorktreeStore === undefined ? stores.perWorktree : deps.perWorktreeStore;
  }

  const events: Event[] =
    deps.memoryEvents !== undefined
      ? [...deps.memoryEvents]
      : [...eventStore.replay({ type: AGENT_MEMORY_COMMITTED })];

  const { asserted, violations } = assertDocResolves(events, resolvedStore, perWorktreeStore);
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
