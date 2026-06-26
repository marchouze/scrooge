// platform/recon/recon-ba700-document-store-completeness.ts
//
// recon:ba700-document-store-completeness — every BA 700 return-of-record
// (`ReportGenerated{formId:"BA700"}`) for a closed bank-licence period has its
// FULL rendered SARB XML envelope filed into the RMS document store, and the
// filed blob RESOLVES in the store the read path (regulator-facing reproduction /
// dashboard) actually reads.
//
// ## What it asserts (per in-scope ReportGenerated)
//
//   1. A `RecordFiled{registerKey:"documents"}` exists whose `recordId` matches
//      the stable BA 700 artefact key (`ba700ArtefactRecordId`) for the same
//      (entity, reportingPeriod). Missing → the document-store filing path did
//      not fire for this return (a completeness gap, Principle 1).
//   2. The filed `documentHash` RESOLVES to bytes in the READ-PATH document store
//      (home-default-ENABLED resolution — NOT the `excludeHomeDefault` singleton).
//      A hash that resolves only in the per-worktree in-repo store is the
//      writer→reader divergence the `rms-document-blob-integrity` gate is BLIND to
//      (documented read-path blind spot) — this gate FAILS on it instead.
//
// ## STORE RESOLUTION — model the READ PATH (the documented blind spot)
//
// The document store is resolved via `readPathDocumentStoreRoot()` — the same
// home-default-ENABLED ladder the dashboard / regulator-reproduction read path
// uses (`BANK_DOCUMENT_STORE` → `BANK_DOCUMENT_STORE_PATH` →
// `BANK_HOME_DOCUMENT_STORE` → `$HOME/.local/share/bank/documents`). It does
// NOT use `new LocalFsDocumentStore()` (the `excludeHomeDefault` per-worktree
// singleton): that is the exact blind spot that lets a writer file into the
// per-worktree store while the reader reads the shared home store, passing a
// naive gate while the live artefact dangles. A second-tier per-worktree store
// is consulted ONLY to DIAGNOSE that divergence. (Mirrors the read-path model in
// `recon:agent-memory-doc-resolves`.)
//
// ## CI / empty-state posture
//
//   - Fresh CI store with no closed periods → 0 ReportGenerated → asserted 0,
//     ok=true (cannot false-positive before any return is generated).
//   - In CI, `BANK_DOCUMENT_STORE` is pinned repo-local (`.local/documents`, see
//     pr-ci.yml) and the period-close handler's `documentStore.put` resolves the
//     SAME root, so any generated return's blob is present by construction.
//   - It BITES the moment a real (production/simulated) BA 700 return-of-record
//     exists without its rendered artefact filed + resolvable in the read-path
//     store.
//
// Build-phase-fixture closes are excluded via the default provenance filter
// (seeded rehearsal returns are not real). Only production / simulated returns
// are asserted.
//
// REPLAY-SAFE: pure over (events, stores); the only filesystem touches are
// `exists` look-ups. No wall-clock, no mutation (Charter cmd 9).
//
// Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; D-BA-RETURN-OF-RECORD-EVENT-
//   FAMILY; D-RMS-PHASE-1; D-CROSS-WORKTREE-EVENT-STORE-SYNC (store-resolution
//   precedent); Banks Act 94/1990 §70 + §73; Principles/1-events-are-truth.md;
//   Engineering Charter cmd 2 (fail-closed), cmd 9 (replay-safe).
// Author: Bea (Accounting & financial reporting engineer, engineering — reports
//   to Camille (Chief Financial Officer)).

import { eventStore } from "../composition";
import { LocalFsDocumentStore } from "../document-store/local-fs";
import {
  inRepoDocumentStoreRoot,
  resolveDocumentStoreRoot,
} from "../document-store/resolve-document-store";
import type { DocumentHash, DocumentStore } from "../document-store/types";
import { defaultProvenanceFilter, eventMatchesProvenanceFilter } from "../projections/filter";
import { BA_700_SUBSCRIBER_ENTITIES } from "../returns/ba700/period-close-subscriber";
import { ba700ArtefactRecordId } from "../returns/ba700/report-of-record";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "ba700-document-store-completeness";

/**
 * The document-store root the READ PATH resolves to — home-default-ENABLED
 * (NOT `excludeHomeDefault`). Exported so the regression test can assert the
 * gate tracks the read path and never silently reverts to the per-worktree
 * singleton.
 */
export function readPathDocumentStoreRoot(): string {
  return resolveDocumentStoreRoot({}).root;
}

/** A filed BA 700 document record: its recordId + the blob hash it cites. */
interface FiledArtefact {
  readonly recordId: string;
  readonly documentHash: string;
}

/** A BA 700 return-of-record awaiting its filed rendered artefact. */
export interface Ba700ReturnRow {
  readonly entity: string;
  readonly reportingPeriod: string;
}

export interface Ba700DocStoreDeps {
  /** Injected ReportGenerated rows (tests). Default: provenance-filtered replay. */
  readonly returns?: readonly Ba700ReturnRow[];
  /** Injected filed-document records (tests). Default: replay of RecordFiled documents. */
  readonly filed?: readonly FiledArtefact[];
  /** Injected read-path store (tests). Default: a store on `readPathDocumentStoreRoot()`. */
  readonly resolvedStore?: DocumentStore;
  /**
   * Injected per-worktree diagnostic store (tests). Default: the repo-anchored
   * in-repo store when it differs from the read-path root, else `null`.
   */
  readonly perWorktreeStore?: DocumentStore | null;
}

/** Collect in-scope BA 700 return-of-record rows from the live event store. */
function collectReturns(): Ba700ReturnRow[] {
  const provenanceFilter = defaultProvenanceFilter();
  const rows: Ba700ReturnRow[] = [];
  for (const ev of eventStore.replay({ type: "ReportGenerated" })) {
    if (!BA_700_SUBSCRIBER_ENTITIES.includes(ev.entity)) continue;
    if (!eventMatchesProvenanceFilter(ev, provenanceFilter)) continue;
    const p = ev.payload as { formId?: string; reportingPeriod?: string };
    if (p.formId === "BA700" && typeof p.reportingPeriod === "string") {
      rows.push({ entity: ev.entity, reportingPeriod: p.reportingPeriod });
    }
  }
  return rows;
}

/** Collect filed BA 700 document records (RecordFiled{registerKey:documents}). */
function collectFiled(): FiledArtefact[] {
  const filed: FiledArtefact[] = [];
  for (const ev of eventStore.replay({ type: "RecordFiled" })) {
    const p = ev.payload as {
      recordId?: string;
      registerKey?: string;
      documentHash?: string;
    };
    if (
      p.registerKey === "documents" &&
      typeof p.recordId === "string" &&
      typeof p.documentHash === "string"
    ) {
      filed.push({ recordId: p.recordId, documentHash: p.documentHash });
    }
  }
  return filed;
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
 * Pure assertion core (sabotage-proof in the test). For each BA 700
 * return-of-record, assert a filed document record exists for the stable
 * artefact recordId AND its blob resolves in the read-path store. Distinguishes
 * the writer→reader DIVERGENCE (resolves only in the per-worktree store) from
 * a missing filing / total blob loss. All are fail-closed.
 */
export function assertBa700ArtefactsFiled(
  returns: readonly Ba700ReturnRow[],
  filed: readonly FiledArtefact[],
  resolvedStore: DocumentStore,
  perWorktreeStore: DocumentStore | null,
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const filedByRecordId = new Map<string, FiledArtefact>();
  for (const f of filed) filedByRecordId.set(f.recordId, f);

  for (const r of returns) {
    asserted++;
    const recordId = ba700ArtefactRecordId(r.entity, r.reportingPeriod);
    const subject = `${r.entity}::${r.reportingPeriod}`;

    const record = filedByRecordId.get(recordId);
    if (!record) {
      violations.push({
        subject,
        message: `BA 700 return-of-record for closed period ${r.reportingPeriod} (entity ${r.entity}) has NO filed rendered artefact — no RecordFiled{registerKey:"documents", recordId:"${recordId}"}. The document-store filing path (fileBa700ReturnArtefact) did not fire for this return; the regulator-facing envelope is not in the RMS document store. Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; Principle 1.`,
        severity: "fail",
      });
      continue;
    }

    const hash = record.documentHash as DocumentHash;
    if (resolvedStore.exists(hash)) continue;

    if (perWorktreeStore?.exists(hash)) {
      violations.push({
        subject,
        message: `WRITER→READER DIVERGENCE: BA 700 rendered artefact for ${r.reportingPeriod} (entity ${r.entity}, hash ${record.documentHash}) resolves ONLY in the per-worktree in-repo document store, NOT the shared store the regulator-reproduction / dashboard read path reads — so the filed envelope dangles at read time in the shared-home topology. The period-close handler filed into the per-worktree store while the reader reads the shared store. Remediation: re-file against the shared store (boot the shared document store before the period-close run), or run \`bun run migrate:document-store-blobs\`. Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; D-CROSS-WORKTREE-EVENT-STORE-SYNC; Principle 1.`,
        severity: "fail",
      });
      continue;
    }

    violations.push({
      subject,
      message: `BA 700 rendered artefact for ${r.reportingPeriod} (entity ${r.entity}, hash ${record.documentHash}) resolves in NO document store — the cited heavy bytes are gone (Principle 1: the RecordFiled event is canonical; the envelope it cites by hash must exist). Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE.`,
      severity: "fail",
    });
  }

  return { asserted, violations };
}

export function run(deps: Ba700DocStoreDeps = {}): ReconResult {
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

  const returns = deps.returns !== undefined ? [...deps.returns] : collectReturns();
  const filed = deps.filed !== undefined ? [...deps.filed] : collectFiled();

  const { asserted, violations } = assertBa700ArtefactsFiled(
    returns,
    filed,
    resolvedStore,
    perWorktreeStore,
  );
  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : result.ok ? "ADVISORY" : "FAIL";
  console.log(`recon:ba700-document-store-completeness [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
