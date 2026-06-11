// platform/recon/regulatory-golden-source-integrity.ts
//
// Continuous-controls pipeline: regulatory golden-source integrity — the
// dangling-golden-source detector.
//
// **FAIL direction:** a graph Document node carrying
// `metadata.goldenSourceHash` whose hash has no blob in the resolved
// document store. The graph is a derived projection (Principle 1) and the
// hash is injected by the seed-projection from a `RecordFiled` regulatory-
// source filing (D-REGULATORY-LIBRARY-V1) — so a Document node that claims a
// golden source whose bytes are gone is an unservable claim, exactly the
// dangling-record shape `rms-document-blob-integrity` guards for RMS
// deliverables, lifted to the regulatory-library axis.
//
// **Store resolution** mirrors `rms-document-blob-integrity`:
//   - Document store: `new LocalFsDocumentStore()` — the default
//     (composition-posture) ladder `BANK_DOCUMENT_STORE` →
//     `BANK_DOCUMENT_STORE_PATH` → `BANK_HOME_DOCUMENT_STORE` → per-worktree
//     in-repo fallback. See `platform/document-store/resolve-document-store.ts`.
//   - Graph nodes: read out of the resolved graph DB (`getDb()`,
//     `BANK_GRAPH_DB`-overridable). Tests inject `nodes` directly.
//
// **Why CI is green pre-population (mechanism statement).** The
// `goldenSourceHash` is NOT committed to git — it lives on the seeded graph,
// which is rebuilt from the event/document store. On a clean CI checkout the
// store is empty, the seed finds no regulatory-source filing to attach, and
// this gate asserts zero nodes → warns-clean. This is acceptable for an
// ADVISORY Slice-1 gate; the FAIL direction comes live once the shared store
// is populated and the gate is pointed at the shared pair:
//
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_DOCUMENT_STORE=$HOME/.local/share/bank/documents \
//   BANK_GRAPH_DB=$HOME/.local/share/bank/graph.db \
//   bun run recon:regulatory-golden-source-integrity
//
// **Severity rules** (same dated-activation pattern as
// `rms-document-blob-integrity`):
//   - Blob missing from the resolved store but present in the legacy in-repo
//     store → `warn` (pending migration). Never a fail: the bytes exist.
//   - Blob missing everywhere, BEFORE the enforcement date → `warn`
//     (Slice-1 advisory window; the linkage is still being populated).
//   - Blob missing everywhere, ON OR AFTER the enforcement date → `fail`.
//
// SHIP POSTURE: ADVISORY (warn) for Slice 1 — the enforcement date is in the
// future so every miss warns, never fails, while the source-filing primitive
// soaks. The `regulatory-` prefix is deliberate: `recon-golden-source-*`
// names are already taken by an unrelated golden-source family.
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11).
// Backing brief: brief:mira:regulatory-library-slice-1-source-filing-primiti:2026-06-11.
// Design precedent: rms-document-blob-integrity (Atlas, D-CROSS-WORKTREE-EVENT-STORE-SYNC).
// Author: Mira (Compliance / RegTech engineer, engineering) +
//         Atlas (Core banking platform architect, engineering).

import { clock } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import { inRepoDocumentStoreRoot } from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { getDb } from "../regulatory/graph/db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulatory-golden-source-integrity";

/**
 * ISO date (YYYY-MM-DD) from which a golden-source blob missing from every
 * store is a hard `fail`. Set in the future for Slice 1 — the gate ships
 * ADVISORY while the source-filing primitive soaks. Bumping this into the
 * past (a later slice's decision) flips the gate to enforcing.
 */
export const ENFORCEMENT_DATE = "2026-09-01";

/** A graph node, reduced to the fields this gate reads. */
export interface GoldenSourceNode {
  readonly id: string;
  readonly goldenSourceHash: string;
}

export interface GoldenSourceIntegrityDeps {
  /** Injected nodes (tests). Default: read from the resolved graph DB. */
  readonly nodes?: readonly GoldenSourceNode[];
  /** Injected resolved store (tests). Default: `new LocalFsDocumentStore()`. */
  readonly resolvedStore?: DocumentStore;
  /**
   * Injected legacy in-repo store (tests). Default: the repo-anchored in-repo
   * store when it differs from the resolved root, else `null`. Pass `null` to
   * disable the legacy tier explicitly.
   */
  readonly legacyStore?: DocumentStore | null;
  /** Enforcement boundary override (tests). Default `ENFORCEMENT_DATE`. */
  readonly enforcementDate?: string;
  /** "Now" override (tests). Default `clock.now()`. */
  readonly asOfDate?: string;
}

function defaultStores(): { resolved: LocalFsDocumentStore; legacy: LocalFsDocumentStore | null } {
  const resolved = new LocalFsDocumentStore();
  const legacyRoot = inRepoDocumentStoreRoot();
  const legacy =
    resolved.rootPath() === legacyRoot ? null : new LocalFsDocumentStore({ root: legacyRoot });
  return { resolved, legacy };
}

/** Read every graph node carrying `metadata.goldenSourceHash` from the graph DB. */
function readGoldenSourceNodes(): GoldenSourceNode[] {
  const rows = getDb()
    .prepare("SELECT id, metadata FROM graph_nodes WHERE metadata IS NOT NULL")
    .all() as { id: string; metadata: string }[];
  const out: GoldenSourceNode[] = [];
  for (const row of rows) {
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(row.metadata) as Record<string, unknown>;
    } catch {
      continue;
    }
    const hash = meta.goldenSourceHash;
    if (typeof hash === "string" && hash.length > 0) {
      out.push({ id: row.id, goldenSourceHash: hash });
    }
  }
  return out;
}

export function run(deps: GoldenSourceIntegrityDeps = {}): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const enforcementDate = deps.enforcementDate ?? ENFORCEMENT_DATE;
  const asOfDate = (deps.asOfDate ?? clock.now()).slice(0, 10);
  const postEnforcement = asOfDate >= enforcementDate;

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

  const nodes = deps.nodes ?? readGoldenSourceNodes();

  for (const node of nodes) {
    result.asserted++;
    const hash = node.goldenSourceHash as DocumentHash;

    if (resolvedStore.exists(hash)) continue;

    const subject = `${node.id} → ${node.goldenSourceHash}`;

    if (legacyStore?.exists(hash)) {
      violations.push({
        subject,
        message: `Golden source for Document node \`${node.id}\` resolves only in the legacy in-repo document store — pending migration to the shared store. Remediation: \`bun run migrate:document-store-blobs\`. Citations: D-REGULATORY-LIBRARY-V1, D-CROSS-WORKTREE-EVENT-STORE-SYNC.`,
        severity: "warn",
      });
      continue;
    }

    violations.push({
      subject,
      message: postEnforcement
        ? `DANGLING GOLDEN SOURCE: Document node \`${node.id}\` cites goldenSourceHash \`${node.goldenSourceHash}\` with no blob in the resolved document store NOR the legacy in-repo store. Post-${enforcementDate} this is a real integrity violation. Remediation: re-file the source via \`bun run acquire:source\` against the shared store, then re-seed. Citations: D-REGULATORY-LIBRARY-V1, Principle 1.`
        : `Golden source not yet resolvable (advisory): Document node \`${node.id}\` cites goldenSourceHash \`${node.goldenSourceHash}\` with no blob in any reachable store. Pre-${enforcementDate} Slice-1 advisory window — the source-filing linkage is still being populated. Remediation: \`bun run acquire:source\` against the shared store, then \`bun run graph:seed\`. Citations: D-REGULATORY-LIBRARY-V1.`,
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
        ? "regulatory golden-source integrity passed"
        : "regulatory golden-source integrity FAILED — goldenSourceHash with no resolvable blob (dangling golden source)",
      detail: r.violations,
    }),
  );
  if (!r.ok) process.exit(1);
}
