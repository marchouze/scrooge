// scripts/rms-phase-4-bulk-index.ts
//
// RMS Phase 4 bulk-index migration — one-time idempotent script that walks
// archive/owner-inbox/ and archive/team-inbox/ (including actioned/ subdirs)
// and emits a `RecordFiled` event per historical document.
//
// Per D-RMS-PHASE-4-ARCHIVE-SCOPE (Q-B resolution: all four directories),
// this covers:
//   archive/owner-inbox/          → correspondence, ceo-only,        7 yr
//   archive/owner-inbox/actioned/ → correspondence, ceo-only,        7 yr
//   archive/team-inbox/           → briefs,         agent-internal,  5 yr
//   archive/team-inbox/actioned/  → briefs,         agent-internal,  5 yr
//
// Idempotency: the script checks for existing `RecordFiled` events by
// `documentHash` (content-addressed) and skips files already indexed.
// Safe to re-run; no double-filing.
//
// How to run (from prototype/):
//   bun run scripts/rms-phase-4-bulk-index.ts
//   # or via package.json script:
//   bun run rms:phase-4-bulk-index
//
// Authority: D-RMS-PHASE-4 (CEO-approved 2026-05-17);
//            D-RMS-PHASE-4-ARCHIVE-SCOPE (Q-A: preserve actioned/ subdirs,
//            Q-B: cover all four directories, Q-C: retire rms-overlap-parity).
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { hashContent } from "../platform/document-store/hash";
import type { RecordFiledPayload } from "../platform/event-store/event-types";
import { logger } from "../platform/observability/logger";
import { recordFiled } from "../platform/records/helpers";

// ---------------------------------------------------------------------------
// Repo root resolver
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(join(dir, "CLAUDE.md"))) return dir;
    dir = join(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found walking up from script dir)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);
const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Actor + citation config
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "rms-phase-4-bulk-index@bank" };

const CITATIONS = ["D-RMS-PHASE-4", "D-RMS-PHASE-1"];

// ---------------------------------------------------------------------------
// Directory scan configuration
// ---------------------------------------------------------------------------

interface DirConfig {
  /** Path relative to repo root. */
  readonly relDir: string;
  readonly registerKey: RecordFiledPayload["registerKey"];
  readonly classification: RecordFiledPayload["classification"];
  readonly category: string;
  readonly retentionYears: number;
}

const DIR_CONFIGS: readonly DirConfig[] = [
  {
    relDir: "archive/owner-inbox",
    registerKey: "correspondence",
    classification: "ceo-only",
    category: "historical-inbox-migration",
    retentionYears: 7,
  },
  {
    relDir: "archive/owner-inbox/actioned",
    registerKey: "correspondence",
    classification: "ceo-only",
    category: "historical-inbox-migration",
    retentionYears: 7,
  },
  {
    relDir: "archive/team-inbox",
    registerKey: "briefs",
    classification: "agent-internal",
    category: "historical-inbox-migration",
    retentionYears: 5,
  },
  {
    relDir: "archive/team-inbox/actioned",
    registerKey: "briefs",
    classification: "agent-internal",
    category: "historical-inbox-migration",
    retentionYears: 5,
  },
];

// ---------------------------------------------------------------------------
// Title derivation from filename
// ---------------------------------------------------------------------------

function deriveTitle(filename: string): string {
  let name = filename.replace(/\.(md|html|txt)$/i, "");
  name = name.replace(/^\d{4}-\d{2}-\d{2}_/, "");
  name = name.replace(/[-_]/g, " ");
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

function deriveDate(filename: string): string | undefined {
  const m = filename.match(/^(\d{4}-\d{2}-\d{2})_/);
  return m?.[1];
}

// ---------------------------------------------------------------------------
// Build set of already-indexed document hashes from the event store
// ---------------------------------------------------------------------------

function buildIndexedHashes(): Set<string> {
  const indexed = new Set<string>();
  for (const event of eventStore.replay({ type: "RecordFiled" })) {
    const payload = event.payload as { documentHash?: unknown };
    if (typeof payload.documentHash === "string") {
      indexed.add(payload.documentHash);
    }
  }
  return indexed;
}

// ---------------------------------------------------------------------------
// File scanner — non-recursive for each config (subdirs are separate entries)
// ---------------------------------------------------------------------------

interface ScannedFile {
  readonly absPath: string;
  readonly relPath: string;
  readonly filename: string;
  readonly config: DirConfig;
}

function scanDir(config: DirConfig): ScannedFile[] {
  const absDir = join(REPO_ROOT, config.relDir);
  if (!existsSync(absDir)) return [];
  const results: ScannedFile[] = [];
  let entries: string[];
  try {
    entries = readdirSync(absDir);
  } catch {
    return [];
  }
  for (const name of entries) {
    if (name.startsWith(".") || name.startsWith("_")) continue;
    const absPath = join(absDir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(absPath);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue; // skip subdirs — they are separate config entries
    const relPath = relative(REPO_ROOT, absPath);
    results.push({ absPath, relPath, filename: name, config });
  }
  return results;
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

interface Stats {
  total: number;
  skipped: number;
  indexed: number;
  errors: number;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(opts: { dryRun?: boolean } = {}): Stats {
  const { dryRun = false } = opts;
  const stats: Stats = { total: 0, skipped: 0, indexed: 0, errors: 0 };

  // Build set of already-indexed hashes to skip duplicates.
  const alreadyIndexed = buildIndexedHashes();
  logger.info(
    { count: alreadyIndexed.size },
    "rms-phase-4-bulk-index: pre-existing RecordFiled hashes loaded",
  );

  for (const config of DIR_CONFIGS) {
    const files = scanDir(config);
    logger.info(
      { dir: config.relDir, files: files.length },
      "rms-phase-4-bulk-index: scanning directory",
    );

    for (const file of files) {
      stats.total++;
      let body: string;
      try {
        body = readFileSync(file.absPath, "utf8");
      } catch (e) {
        logger.warn(
          { path: file.relPath, err: (e as Error).message },
          "rms-phase-4-bulk-index: read error",
        );
        stats.errors++;
        continue;
      }

      // Idempotency: compute hash and skip if already indexed.
      const hash = hashContent(body);
      if (alreadyIndexed.has(hash)) {
        logger.debug({ path: file.relPath }, "rms-phase-4-bulk-index: skipping — already indexed");
        stats.skipped++;
        continue;
      }

      if (dryRun) {
        logger.info({ path: file.relPath, hash }, "rms-phase-4-bulk-index: dry-run — would index");
        stats.indexed++;
        continue;
      }

      try {
        const recordId = `record:archive-migration:${file.relPath.replace(/\//g, ":")}`;
        const date = deriveDate(file.filename);
        const title = deriveTitle(file.filename);

        recordFiled(
          {
            recordId,
            registerKey: config.registerKey,
            body,
            classification: config.classification,
            retention: {
              citationRef: "D-RMS-PHASE-1",
              minimumYears: config.retentionYears,
              archivalTier: "cool",
            },
            citations: CITATIONS,
            actor: ACTOR,
            entity: BANK_ZA_001,
            metadata: {
              title,
              path: file.relPath,
              category: config.category,
              ...(date ? { date } : {}),
            },
          },
          NOW,
        );

        // Track hash so subsequent iterations in the same run don't double-file.
        alreadyIndexed.add(hash);
        stats.indexed++;
        logger.debug({ path: file.relPath, recordId }, "rms-phase-4-bulk-index: indexed");
      } catch (e) {
        logger.warn(
          { path: file.relPath, err: (e as Error).message },
          "rms-phase-4-bulk-index: index error",
        );
        stats.errors++;
      }
    }
  }

  return stats;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

const dryRun = process.argv.includes("--dry-run");
const stats = run({ dryRun });
logger.info(stats, `rms-phase-4-bulk-index: ${dryRun ? "dry-run " : ""}complete`);
console.log(
  `RMS Phase 4 bulk-index ${dryRun ? "(dry-run) " : ""}complete: ${stats.indexed} indexed, ${stats.skipped} skipped, ${stats.errors} errors (${stats.total} total)`,
);
