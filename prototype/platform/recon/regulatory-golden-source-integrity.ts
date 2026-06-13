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
// **ENFORCEMENT MODEL — THIS IS A SHARED-STORE ASSERTION, NOT A CLEAN-CI
// GATE.** (Corrected 2026-06-13 per D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION.)
//
//   Golden-source bytes and the `goldenSourceHash` linkage live in the
//   shared/home store BY DESIGN (Principle 1): the hash is NOT committed to
//   git, it lives on the seeded regulatory graph which is rebuilt from the
//   event + document store, and `data/documents/*` is gitignored (zero blobs
//   git-tracked). On a clean CI checkout the regulatory graph is never seeded
//   (`ci:migrate` does not seed it) and the in-repo store holds no blobs —
//   so this gate reads ZERO golden-source nodes, asserts 0, and WARNS-CLEAN.
//   That clean-CI pass is INTENTIONAL, not accidental: there is nothing to
//   assert against on a clean runner, so `ok:true / asserted:0` is the
//   correct and only honest outcome. The gate is NOT meant to fail in the
//   pipeline, and the in-pipeline result carries no integrity signal. A
//   pin-test (`regulatory-golden-source-integrity-empty-graph.test.ts`)
//   locks this: empty graph → `ok:true`, `asserted:0`, so a future change
//   that makes the gate spuriously fail on a clean runner is caught.
//
//   THE REAL ASSERTION RUNS OFF THE PIPELINE, on a cadence, against the
//   POPULATED shared store — wired by the scheduled tick
//   `scripts/regulatory/golden-source-integrity-tick.ts`
//   (`bun run recon:golden-source-integrity-tick`), driven by the launchd
//   LaunchAgent `com.scrooge.golden-source-integrity-tick.plist` (daily,
//   alongside `com.scrooge.scheduler-tick` / `com.scrooge.event-store-archive`
//   in `scripts/launchd/`). That tick seeds the graph from the shared store,
//   runs this same `run()`, and emits a `SubstrateAlert{alertClass:"integrity"}`
//   for any dangling golden-source hash so a genuinely missing blob in the
//   shared store is escalated, not silent. Manual one-off equivalent:
//
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_DOCUMENT_STORE=$HOME/.local/share/bank/documents \
//   BANK_GRAPH_DB=$HOME/.local/share/bank/graph.db \
//   bun run recon:golden-source-integrity-tick
//
// **Severity rules** (per-node, applied wherever the gate runs — they only
// fire once there ARE golden-source nodes to assert, i.e. on the populated
// shared store via the scheduled tick; the clean pipeline reads zero nodes
// and never reaches them):
//   - Blob missing from the resolved store but present in the legacy in-repo
//     store → `warn` (pending migration). Never a fail: the bytes exist.
//   - Blob missing everywhere, BEFORE the enforcement date → `warn`
//     (advisory window; the linkage is still being populated).
//   - Blob missing everywhere, ON OR AFTER the enforcement date → `fail`.
//   The `ENFORCEMENT_DATE` below dates the warn→fail transition for a
//   dangling-hash node; it is NOT a claim of in-pipeline CI enforcement.
//
// The `regulatory-` prefix is deliberate: `recon-golden-source-*` names are
// already taken by an unrelated golden-source family.
//
// Authority: D-REGULATORY-LIBRARY-V1 (CEO-approved 2026-06-11);
//            D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13).
// Backing brief: brief:mira:golden-source-integrity-re-document-as-shared-st:2026-06-13.
// Design precedent: rms-document-blob-integrity (Atlas, D-CROSS-WORKTREE-EVENT-STORE-SYNC).
// Author: Mira (Chief Obligations & Regulatory Officer, compliance) +
//         Atlas (Core banking platform architect, engineering).

import { clock } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import { inRepoDocumentStoreRoot } from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { getDb } from "../regulatory/graph/db";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulatory-golden-source-integrity";

/**
 * ISO date (YYYY-MM-DD) from which a dangling golden-source node (a blob
 * missing from every reachable store) is graded `fail` rather than `warn`.
 *
 * This dates the per-node warn→fail transition; it is NOT a claim of
 * in-pipeline CI enforcement. On a clean CI runner the gate reads zero nodes
 * and this boundary is never reached — the warn→fail grading only bites on
 * the populated shared store, asserted off-pipeline by the scheduled tick
 * (`scripts/regulatory/golden-source-integrity-tick.ts`). Set to 2026-06-11
 * once all active sources were acquired and the shared document store was
 * populated. See header for the full shared-store enforcement model
 * (D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION).
 */
export const ENFORCEMENT_DATE = "2026-06-11";

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
