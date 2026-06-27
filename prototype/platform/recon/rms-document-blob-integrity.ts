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
// **Store resolution — model the READ PATH, paired to the event store.**
// The gate audits whatever event store `eventStore` resolved to; its
// document store MUST resolve to the store the SAME read path reads —
// "shared event store ⇒ shared document store" is the pairing invariant
// (D-CROSS-WORKTREE-EVENT-STORE-SYNC). The two stores resolve as:
//   - Event store: `eventStore` from `platform/composition` —
//     env-overridable via `BANK_EVENT_DB`; per-worktree `.local/event.db`
//     in CI; the canonical `$HOME/.local/share/bank/event.db` in the live
//     sweep (the dashboard's read path).
//   - Document store (primary): `readPathDocumentStoreRoot()` — the
//     home-default-ENABLED resolution (`BANK_DOCUMENT_STORE` →
//     `BANK_DOCUMENT_STORE_PATH` → `BANK_HOME_DOCUMENT_STORE` →
//     `$HOME/.local/share/bank/documents`). This mirrors the event
//     store's live posture: when `BANK_EVENT_DB` points at the shared
//     home event store and `BANK_DOCUMENT_STORE` is unset, the document
//     store resolves to the PAIRED `$HOME/.local/share/bank/documents`,
//     not the empty per-worktree singleton. See
//     `platform/document-store/resolve-document-store.ts`.
//
//   THE BLIND SPOT THIS FIXES. The previous version mounted
//   `new LocalFsDocumentStore()` — the `excludeHomeDefault` singleton
//   (`<repo>/prototype/data/documents`). In the live shared-home sweep
//   (`BANK_EVENT_DB=$HOME/...event.db`, `BANK_DOCUMENT_STORE` unset) that
//   audited the SHARED event store against the EMPTY per-worktree
//   document store, reporting EVERY `RecordFiled` as dangling (~3,268
//   false positives) instead of the true ~1,867 the home store carries.
//   A doc-store integrity gate must resolve the store the reader reads
//   (home/shared), NOT the `excludeHomeDefault` singleton — the same fix
//   landed in `agent-memory-doc-resolves.ts` (2026-06-25). CI stays green
//   because there `BANK_DOCUMENT_STORE` is pinned repo-local
//   (`.local/documents`, see pr-ci.yml), so writer + gate both resolve
//   there and every blob is present by construction.
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
//     store, so a miss is a real integrity violation) — UNLESS the exact
//     `(recordId, documentHash)` pair is on the FROZEN historical-loss
//     allowlist (`rms-blob-historical-loss-allowlist.json`), in which case
//     it is downgraded to an explicitly-acknowledged, non-failing `warn`.
//     The allowlist is keyed-exact, finite, committed data — never a
//     predicate. Any NEW dangling record (a pair NOT on the list) still
//     fails. Authority: D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST (CEO-approved
//     2026-06-27, Phase 2 of the remediation); basis Vera census PR #1590.
//
// Authority: D-CROSS-WORKTREE-EVENT-STORE-SYNC (CEO session-delegation
//            2026-05-21) — design precedent, extended to blob roots;
//            D-RMS-PHASE-3 (RecordFiled is the canonical deliverable
//            event).
// Brief: brief:atlas:extend-cross-worktree-sync-to-document-store-blo:2026-06-10.
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eventStore } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
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

/**
 * FROZEN HISTORICAL-LOSS ALLOWLIST (D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST,
 * CEO-approved 2026-06-27; Phase 2 of the RMS blob-integrity remediation).
 *
 * After the read-path fix + 432 byte-exact rescues of PR #1590 (Vera's
 * census), 1,435 dangling `RecordFiled` events (1,381 unique
 * `(recordId, documentHash)` pairs) remained irreducible against the
 * home/shared read-path — blobs genuinely lost (pre-document-store-sync,
 * source stores pruned, not regenerable to the recorded BLAKE3 hash;
 * `rescue:dangling-recordfiled-blobs --dry-run` rescues 0 of them).
 *
 * Marc approved allowlisting EXACTLY that enumerated set. The allowlist
 * downgrades a dangling record to a NON-FAILING, explicitly-acknowledged
 * `warn` class ("acknowledged historical loss") **only** when its precise
 * `(recordId, documentHash)` pair is on the committed frozen list. Every
 * record NOT on the list still fails per the existing date logic — the
 * fail-direction is fully enforcing for any NEW dangling record. The
 * allowlist is DATA: keyed-exact, finite, committed — never a predicate
 * that auto-absorbs new losses. This is a one-time frozen acknowledgement,
 * NOT a standing waiver.
 *
 * Authority: D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST; basis Vera census PR
 * #1590; D-RMS-PHASE-3; Engineering Charter (no green-by-concealment — the
 * fail-direction survives, proven by the synthetic-new-dangling test).
 */
export const ALLOWLIST_FILE = "rms-blob-historical-loss-allowlist.json";

interface AllowlistEntry {
  readonly recordId: string;
  readonly documentHash: string;
  readonly asOf: string;
  readonly severity: string;
}

interface AllowlistDoc {
  readonly schema: string;
  readonly authority: string;
  readonly asOf: string;
  readonly entries: readonly AllowlistEntry[];
}

/**
 * Separator between recordId and documentHash in a composite allowlist
 * key. An explicit single ASCII space (0x20), built via `String.fromCharCode`
 * so no invisible / non-ASCII separator can hide in a template literal.
 */
export const ALLOWLIST_KEY_SEP = String.fromCharCode(0x20);

/** Stable composite key for an allowlisted (recordId, documentHash) pair. */
export function allowKey(recordId: string, documentHash: string): string {
  return recordId + ALLOWLIST_KEY_SEP + documentHash;
}

function findReconDir(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    const candidate = resolve(dir, "platform/recon", ALLOWLIST_FILE);
    if (existsSync(candidate)) return resolve(dir, "platform/recon");
    dir = resolve(dir, "..");
  }
  throw new Error(`Cannot locate platform/recon/${ALLOWLIST_FILE} from ${start}`);
}

/**
 * Load the frozen allowlist into a key set. Resolution mirrors
 * `v1-removal-ratchet.json` (committed alongside the recon pipeline,
 * walked up from `import.meta.dir`). Tests inject `allowlistKeys`
 * directly to avoid filesystem coupling.
 */
export function loadAllowlistKeys(allowlistPath?: string): Set<string> {
  const path = allowlistPath ?? resolve(findReconDir(import.meta.dir), ALLOWLIST_FILE);
  const doc = JSON.parse(readFileSync(path, "utf8")) as AllowlistDoc;
  const keys = new Set<string>();
  for (const e of doc.entries) keys.add(allowKey(e.recordId, e.documentHash));
  return keys;
}

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
  /**
   * Injected frozen historical-loss allowlist keys (tests). Each key is
   * `allowKey(recordId, documentHash)`. Default: loaded from the committed
   * `rms-blob-historical-loss-allowlist.json`. Pass an empty `Set` to
   * disable the allowlist explicitly (proves the underlying fail-direction
   * is unchanged). Authority: D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST.
   */
  readonly allowlistKeys?: ReadonlySet<string>;
}

/**
 * The document-store root the READ PATH resolves to — the
 * home-default-ENABLED resolution (NOT `excludeHomeDefault`). This is the
 * store the dashboard / `RecordFiled` consumers read, and it pairs to the
 * event store's live resolution: `BANK_DOCUMENT_STORE` pinned (CI / local
 * repro) → that repo-local root; unset (live shared-home sweep) →
 * `$HOME/.local/share/bank/documents` — the twin of
 * `$HOME/.local/share/bank/event.db` that `eventStore` opens when
 * `BANK_EVENT_DB` points there. Exported so the regression test can pin
 * this read-path behaviour and the `excludeHomeDefault`-singleton blind
 * spot cannot regress.
 */
export function readPathDocumentStoreRoot(): string {
  return resolveDocumentStoreRoot({}).root;
}

function defaultStores(): { resolved: LocalFsDocumentStore; legacy: LocalFsDocumentStore | null } {
  const resolved = new LocalFsDocumentStore({ root: readPathDocumentStoreRoot() });
  const legacyRoot = inRepoDocumentStoreRoot();
  const legacy =
    resolved.rootPath() === legacyRoot ? null : new LocalFsDocumentStore({ root: legacyRoot });
  return { resolved, legacy };
}

export function run(deps: BlobIntegrityDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const enforcementDate = deps.enforcementDate ?? ENFORCEMENT_DATE;
  const allowlistKeys = deps.allowlistKeys ?? loadAllowlistKeys();

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

    // FROZEN HISTORICAL-LOSS ALLOWLIST. Only the EXACT (recordId,
    // documentHash) pair on the committed list is acknowledged — and even
    // then it is downgraded to a non-failing `warn`, never silently
    // dropped. Any dangling record NOT on the list still fails per the
    // date logic below: the fail-direction is fully intact for new losses.
    // Authority: D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST (CEO-approved
    // 2026-06-27); basis Vera census PR #1590; D-RMS-PHASE-3.
    if (postEnforcement && allowlistKeys.has(allowKey(recordId, hash))) {
      violations.push({
        subject,
        message: `Acknowledged historical loss (frozen allowlist): RecordFiled event \`${recordId}\` (as_of ${eventDate}) cites documentHash \`${hash}\` with no blob in any reachable store. This exact (recordId, documentHash) pair is on the committed frozen historical-loss allowlist — an irreducible pre-document-store-sync loss (not regenerable to the recorded hash; verified non-rescuable). One-time acknowledgement, NOT a standing waiver; any NEW dangling record still fails. Citations: D-RMS-BLOB-HISTORICAL-LOSS-ALLOWLIST, Vera census PR #1590, D-RMS-PHASE-3, Principle 1.`,
        severity: "warn",
      });
      continue;
    }

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
