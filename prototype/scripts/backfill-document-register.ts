// scripts/backfill-document-register.ts
//
// RMS document-register backfill — scans all .md files in the repo,
// stores them in the BLAKE3 document substrate, and emits `RecordFiled`
// events so the RMS document register is populated.
//
// Idempotent: checks the event store for a `RecordFiled` event with the
// same `documentHash` before emitting. Safe to re-run; already-filed
// documents are skipped.
//
// How to run (from prototype/):
//   bun run scripts/backfill-document-register.ts
//   # or via package.json script:
//   bun run rms:backfill-documents
//
// Directory scan map:
//   Owner Inbox/           → correspondence, ceo-only,         7 yr
//   Owner Inbox/actioned/  → correspondence, ceo-only,         7 yr
//   Team Inbox/            → briefs,         agent-internal,   5 yr
//   Team Inbox/actioned/   → briefs,         agent-internal,   5 yr
//   Policies/              → documents,      governance-seat,  7 yr
//   Principles/            → documents,      governance-seat, 10 yr
//   Regulations/           → documents,      governance-seat, 10 yr
//   Procedures/            → documents,      engineering-seat, 7 yr
//   Finance/               → documents,      governance-seat,  7 yr
//   Team/                  → documents,      agent-internal,   5 yr
//
// Authority: D-RMS-PHASE-1 (CEO-approved 2026-05-09).
// Author: Atlas (Core banking platform architect, engineering)
//         Owen (Company Secretary, governance)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, join, relative } from "node:path";

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
// Actor
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "scrooge@bank" };

// ---------------------------------------------------------------------------
// Directory scan configuration
// ---------------------------------------------------------------------------

interface DirConfig {
  /** Path relative to repo root. */
  readonly relDir: string;
  /**
   * Whether to recurse into sub-directories.
   * NOTE: Owner Inbox/actioned and Team Inbox/actioned are listed as their own
   * separate config entries; the parent configs are non-recursive so those
   * sub-directories are not double-counted.
   */
  readonly recurse: boolean;
  readonly registerKey: RecordFiledPayload["registerKey"];
  readonly classification: RecordFiledPayload["classification"];
  readonly category: string;
  readonly retentionYears: number;
}

const DIR_CONFIGS: readonly DirConfig[] = [
  {
    relDir: "Owner Inbox",
    recurse: false,
    registerKey: "correspondence",
    classification: "ceo-only",
    category: "Correspondence",
    retentionYears: 7,
  },
  {
    relDir: "Owner Inbox/actioned",
    recurse: false,
    registerKey: "correspondence",
    classification: "ceo-only",
    category: "Correspondence (actioned)",
    retentionYears: 7,
  },
  {
    relDir: "Team Inbox",
    recurse: false,
    registerKey: "briefs",
    classification: "agent-internal",
    category: "Brief",
    retentionYears: 5,
  },
  {
    relDir: "Team Inbox/actioned",
    recurse: false,
    registerKey: "briefs",
    classification: "agent-internal",
    category: "Brief (actioned)",
    retentionYears: 5,
  },
  {
    relDir: "Policies",
    recurse: true,
    registerKey: "documents",
    classification: "governance-seat",
    category: "Policy",
    retentionYears: 7,
  },
  {
    relDir: "Principles",
    recurse: true,
    registerKey: "documents",
    classification: "governance-seat",
    category: "Principle",
    retentionYears: 10,
  },
  {
    relDir: "Regulations",
    recurse: true,
    registerKey: "documents",
    classification: "governance-seat",
    category: "Regulation",
    retentionYears: 10,
  },
  {
    relDir: "Procedures",
    recurse: true,
    registerKey: "documents",
    classification: "engineering-seat",
    category: "Procedure",
    retentionYears: 7,
  },
  {
    relDir: "Finance",
    recurse: true,
    registerKey: "documents",
    classification: "governance-seat",
    category: "Finance",
    retentionYears: 7,
  },
  {
    relDir: "Team",
    recurse: false,
    registerKey: "documents",
    classification: "agent-internal",
    category: "Agent spec",
    retentionYears: 5,
  },
];

// ---------------------------------------------------------------------------
// Frontmatter parser
// ---------------------------------------------------------------------------

interface Frontmatter {
  readonly title?: string;
  readonly author?: string;
  readonly date?: string;
}

function parseFrontmatter(content: string): Frontmatter {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const block = match[1];
  const result: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const key = line.slice(0, colon).trim().toLowerCase();
    const value = line
      .slice(colon + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (key && value) result[key] = value;
  }
  return {
    title: result.title,
    author: result.author ?? result.agent,
    date: result.date,
  };
}

// ---------------------------------------------------------------------------
// Title derivation from filename
// ---------------------------------------------------------------------------

function deriveTitle(filename: string): string {
  // Strip .md extension
  let name = filename.replace(/\.md$/i, "");
  // Strip leading YYYY-MM-DD_ date prefix
  name = name.replace(/^\d{4}-\d{2}-\d{2}_/, "");
  // Replace dashes and underscores with spaces
  name = name.replace(/[-_]/g, " ");
  // Titlecase each word
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// File scanner
// ---------------------------------------------------------------------------

interface ScannedFile {
  readonly absPath: string;
  readonly relPath: string;
  readonly config: DirConfig;
}

function scanDir(config: DirConfig): ScannedFile[] {
  const absDir = join(REPO_ROOT, config.relDir);
  if (!existsSync(absDir)) return [];
  const results: ScannedFile[] = [];

  function walk(dir: string, isRoot: boolean): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      // Skip template/index files (starting with _)
      if (entry.startsWith("_")) continue;
      const absPath = join(dir, entry);
      let stat: ReturnType<typeof statSync>;
      try {
        stat = statSync(absPath);
      } catch {
        continue;
      }
      if (stat.isDirectory()) {
        // For non-recursive configs, skip sub-directories from the root.
        // Sub-directories of sub-directories are walked normally when recurse=true.
        if (!config.recurse && isRoot) continue;
        if (config.recurse) walk(absPath, false);
        continue;
      }
      if (!entry.toLowerCase().endsWith(".md")) continue;
      results.push({
        absPath,
        relPath: relative(REPO_ROOT, absPath).replace(/\\/g, "/"),
        config,
      });
    }
  }

  walk(absDir, true);
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  // Build idempotency set: all documentHashes already present in RecordFiled events.
  const knownHashes = new Set<string>();
  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const hash = (e.payload as Record<string, unknown>).documentHash;
    if (typeof hash === "string") knownHashes.add(hash);
  }
  logger.info(
    { knownCount: knownHashes.size },
    "backfill-document-register — idempotency set built",
  );

  // Collect all candidate files across all configured directories.
  const allFiles: ScannedFile[] = [];
  for (const config of DIR_CONFIGS) {
    allFiles.push(...scanDir(config));
  }
  // Stable sort by relPath for deterministic ordering.
  allFiles.sort((a, b) => (a.relPath < b.relPath ? -1 : a.relPath > b.relPath ? 1 : 0));

  let emitted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of allFiles) {
    let body: string;
    try {
      body = readFileSync(file.absPath, "utf8");
    } catch (err) {
      logger.error(
        { path: file.relPath, err: String(err) },
        "backfill-document-register — read error, skipping",
      );
      errors += 1;
      continue;
    }

    // Check idempotency: skip if hash already filed.
    const hash = hashContent(body);
    if (knownHashes.has(hash)) {
      logger.debug(
        { path: file.relPath, hash },
        "backfill-document-register — skipped (hash already filed)",
      );
      skipped += 1;
      continue;
    }

    // Extract metadata from frontmatter (fallback to filename-derived title).
    const fm = parseFrontmatter(body);
    const title = fm.title ?? deriveTitle(basename(file.absPath));

    // Build a stable, human-readable recordId from the file path.
    const recordId = `rms:doc:${file.relPath}`;

    const archivalTier =
      file.config.retentionYears >= 10
        ? ("archive" as const)
        : file.config.retentionYears >= 7
          ? ("cool" as const)
          : ("hot" as const);

    try {
      recordFiled(
        {
          recordId,
          registerKey: file.config.registerKey,
          body,
          classification: file.config.classification,
          retention: {
            citationRef: "D-RMS-PHASE-1",
            minimumYears: file.config.retentionYears,
            archivalTier,
          },
          metadata: {
            title,
            path: file.relPath,
            category: file.config.category,
            ...(fm.author ? { author: fm.author } : {}),
            ...(fm.date ? { date: fm.date } : {}),
          },
          citations: ["D-RMS-PHASE-1"],
          actor: ACTOR,
          entity: BANK_ZA_001 as string,
        },
        NOW,
      );

      // Add to idempotency set so re-encountered identical content is skipped
      // within the same run (e.g. if the same file is somehow listed twice).
      knownHashes.add(hash);

      logger.info(
        { path: file.relPath, hash, category: file.config.category, title },
        "backfill-document-register — RecordFiled emitted",
      );
      emitted += 1;
    } catch (err) {
      logger.error(
        { path: file.relPath, err: String(err) },
        "backfill-document-register — emit error, skipping",
      );
      errors += 1;
    }
  }

  logger.info(
    { emitted, skipped, errors, total: allFiles.length },
    "backfill-document-register — complete",
  );

  console.log(
    `\nDocument register backfill complete:\n  Filed:   ${emitted}\n  Skipped: ${skipped} (already filed)\n  Errors:  ${errors}\n  Total:   ${allFiles.length} files scanned\n`,
  );

  process.exit(errors > 0 ? 1 : 0);
}

main();
