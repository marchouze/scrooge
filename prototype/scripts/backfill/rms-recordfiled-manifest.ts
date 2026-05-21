// scripts/backfill/rms-recordfiled-manifest.ts
//
// Canonical backfill: emits RecordFiled(documents) events for every
// historical Owner Inbox file that lacks a backing event.
//
// Covers:
//   archive/owner-inbox/         — all .md files (Phase 4 archive location)
//   archive/owner-inbox/actioned — all .md files (Phase 4 archive location)
//
// **Design.**
//   Each file gets registerKey "documents" (not "correspondence") so the
//   rms-documents-parity recon gate can find them. The canonical recon path
//   is `metadata.path = "Owner Inbox/<filename>"` — the logical pre-Phase-4
//   path that recon uses for matching.
//
// **Idempotency.**
//   Checks the event store for an existing RecordFiled event with a matching
//   `recordId` (derived deterministically from file path). Safe to re-run.
//
// **How to run (from prototype/):**
//   bun run backfill:rms-recordfiled-manifest
//
// Authority: D-RMS-PHASE-3 (CEO-approved 2026-05-17);
//            D-RMS-RECORDFILED-MANIFEST (CEO-approved 2026-05-21);
//            brief:atlas:rms-recordfiled-manifest-backfill-retire-empty-s:2026-05-21
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

import { eventStore } from "../../platform/composition";
import { BANK_ZA_001 } from "../../platform/core/types";
import { recordFiled } from "../../platform/records/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Repo root resolver
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "CLAUDE.md"))) return dir;
    dir = join(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found walking up from script dir)");
}

const REPO_ROOT = findRepoRoot(__dirname);
const NOW = new Date().toISOString();

// ---------------------------------------------------------------------------
// Actor — this backfill runs as Atlas (system actor)
// ---------------------------------------------------------------------------

const ACTOR = { type: "system" as const, id: "atlas@bank" };

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
  const block = match[1] ?? "";
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
  // Strip leading YYYY-MM-DD_ date prefix (optionally with agent slug)
  name = name.replace(/^\d{4}-\d{2}-\d{2}_/, "");
  // Replace dashes and underscores with spaces
  name = name.replace(/[-_]/g, " ");
  // Titlecase each word
  return name.replace(/\b\w/g, (c) => c.toUpperCase());
}

// ---------------------------------------------------------------------------
// Deterministic recordId from file path
// ---------------------------------------------------------------------------

function makeRecordId(relPath: string): string {
  // Strip leading archive/owner-inbox/ and normalise to a slug.
  // e.g. "archive/owner-inbox/2026-05-17_owen_rms.md" → "record:owner-inbox:2026-05-17_owen_rms"
  const slug = relPath.replace(/^archive\/owner-inbox\/(?:actioned\/)?/, "").replace(/\.md$/i, "");
  return `record:owner-inbox:${slug}`;
}

// ---------------------------------------------------------------------------
// Date prefix extraction for asOf timestamp
// ---------------------------------------------------------------------------

function extractDatePrefix(filename: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(filename);
  return m ? (m[1] ?? null) : null;
}

// ---------------------------------------------------------------------------
// Build set of already-filed recordIds
// ---------------------------------------------------------------------------

function buildFiledSet(): Set<string> {
  const filed = new Set<string>();
  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const payload = e.payload as Record<string, unknown>;
    const id = typeof payload.recordId === "string" ? payload.recordId : null;
    if (id) filed.add(id);
  }
  return filed;
}

// ---------------------------------------------------------------------------
// File scanner — returns .md files from a directory (non-recursive)
// ---------------------------------------------------------------------------

function scanDir(absDir: string): string[] {
  if (!existsSync(absDir)) return [];
  try {
    return readdirSync(absDir)
      .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
      .filter((f) => {
        try {
          return statSync(join(absDir, f)).isFile();
        } catch {
          return false;
        }
      })
      .sort();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): void {
  console.log("rms-recordfiled-manifest backfill — starting…");

  // 1. Build idempotency set from existing RecordFiled events.
  const filed = buildFiledSet();
  console.log(`  Known RecordFiled recordIds in store: ${filed.size}`);

  // 2. Collect candidate files from archive/owner-inbox/ and
  //    archive/owner-inbox/actioned/.
  const archiveDir = join(REPO_ROOT, "archive", "owner-inbox");
  const archiveActionedDir = join(archiveDir, "actioned");

  const dirFiles: Array<{
    filename: string;
    absPath: string;
    relPath: string;
    inActioned: boolean;
  }> = [];

  for (const filename of scanDir(archiveDir)) {
    dirFiles.push({
      filename,
      absPath: join(archiveDir, filename),
      relPath: relative(REPO_ROOT, join(archiveDir, filename)).replace(/\\/g, "/"),
      inActioned: false,
    });
  }
  for (const filename of scanDir(archiveActionedDir)) {
    dirFiles.push({
      filename,
      absPath: join(archiveActionedDir, filename),
      relPath: relative(REPO_ROOT, join(archiveActionedDir, filename)).replace(/\\/g, "/"),
      inActioned: true,
    });
  }

  console.log(`  Files found in archive/owner-inbox: ${dirFiles.length}`);

  let emitted = 0;
  let skipped = 0;
  let errors = 0;

  for (const file of dirFiles) {
    const recordId = makeRecordId(file.relPath);

    // Idempotency check: skip if already filed.
    if (filed.has(recordId)) {
      skipped++;
      continue;
    }

    // Read file content.
    let body: string;
    try {
      body = readFileSync(file.absPath, "utf8");
    } catch (err) {
      console.error(`  ERROR: could not read ${file.relPath}: ${String(err)}`);
      errors++;
      continue;
    }

    if (!body.trim()) {
      console.warn(`  WARN: empty file ${file.relPath}, skipping`);
      skipped++;
      continue;
    }

    // Extract metadata.
    const fm = parseFrontmatter(body);
    const title = fm.title ?? deriveTitle(basename(file.absPath));
    const datePrefix = extractDatePrefix(file.filename);

    // asOf: use date from filename if available, else NOW.
    // Prefer noon UTC to avoid timezone edge cases.
    const asOf = datePrefix ? `${datePrefix}T12:00:00.000Z` : NOW;

    // Logical "Owner Inbox" path (for recon matching).
    const logicalPath = `Owner Inbox/${file.filename}`;

    try {
      recordFiled(
        {
          recordId,
          registerKey: "documents",
          body,
          classification: "ceo-only",
          retention: {
            citationRef: "D-RMS-PHASE-1",
            minimumYears: 7,
            archivalTier: "cool",
          },
          metadata: {
            title,
            path: logicalPath,
            category: file.inActioned ? "Owner Inbox (actioned)" : "Owner Inbox",
            ...(fm.author ? { author: fm.author } : {}),
            ...(fm.date ? { date: fm.date } : {}),
          },
          citations: [
            "D-RMS-PHASE-3",
            "D-RMS-PHASE-1",
            "brief:atlas:rms-recordfiled-manifest-backfill-retire-empty-s:2026-05-21",
          ],
          actor: ACTOR,
          entity: BANK_ZA_001 as string,
        },
        asOf,
      );

      // Add to set so re-runs within this process don't double-emit.
      filed.add(recordId);

      console.log(`  + emitted: ${logicalPath}`);
      emitted++;
    } catch (err) {
      console.error(`  ERROR: emit failed for ${file.relPath}: ${String(err)}`);
      errors++;
    }
  }

  console.log("\nrms-recordfiled-manifest backfill — complete");
  console.log(`  Emitted: ${emitted}`);
  console.log(`  Skipped: ${skipped} (already filed)`);
  console.log(`  Errors:  ${errors}`);
  console.log(`  Total:   ${dirFiles.length} files scanned`);

  if (errors > 0) {
    console.error("\nBackfill completed with errors — some RecordFiled events were not emitted.");
    process.exit(1);
  }
}

main();
