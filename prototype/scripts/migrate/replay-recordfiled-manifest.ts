// scripts/migrate/replay-recordfiled-manifest.ts
//
// Canonical replay of RecordFiled(documents) events from the
// `recordfiled-manifest.json` manifest. Wired ONCE into
// `migrate:decisions-backfill` in package.json (D-RMS-RECORDFILED-MANIFEST).
//
// **Why this exists.** Before this script, every new RecordFiled(documents)
// event that needed to survive a fresh-runner replay required a brand-new
// one-shot script (~150 lines of boilerplate) PLUS a new entry in
// `migrate:decisions-backfill` in package.json. Three occurrences in four
// days plus one missed-wiring incident (the atlas policy-next-review script
// was authored without the package.json line) closed the
// three-occurrences pattern.
//
// **What this does.** Reads the manifest at
// `scripts/migrate/recordfiled-manifest.json`, replays each entry as a
// `RecordFiled` event via `recordFiled(...)`. Idempotent on `recordId`:
// entries already present in the event store are skipped. The manifest is
// the single appendable artefact — new RecordFiled events that must hydrate
// on fresh runners add a manifest entry, not a new script.
//
// **Determinism.** `asOf` in the manifest is the canonical event timestamp;
// the document body is read from `sourcePath` at replay time, so the
// document hash is stable iff the file content is stable. Both are required
// for cross-runner reproducibility.
//
// Authority: D-RMS-RECORDFILED-MANIFEST (CEO-approved 2026-05-21);
//            D-RMS-PHASE-3 (active).
// Brief:     brief:atlas:auto-wire-one-shot-recordfiled-scripts-into-the-:2026-05-21
// Author:    Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { eventStore } from "../../platform/composition";
import { recordFiled } from "../../platform/records";
import type { RecordFiledPayload } from "../../platform/records/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ---------------------------------------------------------------------------
// Repo-root resolver (same pattern as platform/recon/rms-documents-parity.ts)
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found walking up)");
}

const REPO_ROOT = findRepoRoot(__dirname);
const MANIFEST_PATH = resolve(__dirname, "recordfiled-manifest.json");

// ---------------------------------------------------------------------------
// Manifest schema (mirrored from recordfiled-manifest.json)
// ---------------------------------------------------------------------------

interface ManifestEntry {
  readonly recordId: string;
  readonly sourcePath: string;
  readonly asOf: string;
  readonly registerKey: RecordFiledPayload["registerKey"];
  readonly classification: RecordFiledPayload["classification"];
  readonly retention: RecordFiledPayload["retention"];
  readonly actor: { readonly type: "service" | "human" | "system"; readonly id: string };
  readonly entity?: string;
  readonly metadata?: RecordFiledPayload["metadata"];
  readonly citations: readonly string[];
  readonly supersedes?: string;
  readonly notes?: string;
}

interface Manifest {
  readonly entries: readonly ManifestEntry[];
}

function loadManifest(): Manifest {
  if (!existsSync(MANIFEST_PATH)) {
    throw new Error(`Manifest not found at ${MANIFEST_PATH}`);
  }
  const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Manifest;
  if (!Array.isArray(raw.entries)) {
    throw new Error(`Manifest at ${MANIFEST_PATH} is missing 'entries' array`);
  }
  // Light schema validation — catch the common authoring mistakes early so
  // the failure mode is a clear error rather than a downstream record-helper
  // assertion miles away from the source.
  for (const e of raw.entries) {
    if (typeof e.recordId !== "string" || e.recordId === "") {
      throw new Error(`Manifest entry missing recordId: ${JSON.stringify(e)}`);
    }
    if (typeof e.sourcePath !== "string" || e.sourcePath === "") {
      throw new Error(`Manifest entry ${e.recordId} missing sourcePath`);
    }
    if (typeof e.asOf !== "string" || !/^\d{4}-\d{2}-\d{2}T/.exec(e.asOf)) {
      throw new Error(`Manifest entry ${e.recordId} asOf must be ISO timestamp`);
    }
    if (!Array.isArray(e.citations) || e.citations.length === 0) {
      throw new Error(`Manifest entry ${e.recordId} must have non-empty citations`);
    }
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Replay
// ---------------------------------------------------------------------------

function main(): void {
  const manifest = loadManifest();

  // Build the set of recordIds already filed for fast idempotency.
  const filed = new Set<string>();
  for (const e of eventStore.replay({ type: "RecordFiled" })) {
    const payload = e.payload as Record<string, unknown>;
    const id = typeof payload.recordId === "string" ? payload.recordId : null;
    if (id) filed.add(id);
  }

  const emitted: Array<{
    recordId: string;
    eventId: string;
    documentHash: string;
    isNewDocument: boolean;
  }> = [];
  const skipped: string[] = [];
  const missing: string[] = [];

  for (const entry of manifest.entries) {
    if (filed.has(entry.recordId)) {
      skipped.push(entry.recordId);
      continue;
    }
    const sourceAbs = resolve(REPO_ROOT, entry.sourcePath);
    if (!existsSync(sourceAbs)) {
      missing.push(`${entry.recordId} :: ${entry.sourcePath}`);
      continue;
    }
    const body = readFileSync(sourceAbs, "utf8");
    if (body.trim() === "") {
      missing.push(`${entry.recordId} :: ${entry.sourcePath} (empty)`);
      continue;
    }

    const result = recordFiled(
      {
        recordId: entry.recordId,
        registerKey: entry.registerKey,
        body,
        classification: entry.classification,
        retention: entry.retention,
        citations: [...entry.citations],
        actor: entry.actor,
        entity: entry.entity ?? "BANK-ZA-001",
        ...(entry.metadata ? { metadata: entry.metadata } : {}),
        ...(entry.supersedes ? { supersedes: entry.supersedes } : {}),
      },
      entry.asOf,
    );

    emitted.push({
      recordId: entry.recordId,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    });
  }

  console.log(
    JSON.stringify(
      {
        level: missing.length > 0 ? "warn" : "info",
        msg:
          emitted.length === 0
            ? `replay-recordfiled-manifest: all ${manifest.entries.length} entries already filed — skip`
            : `replay-recordfiled-manifest: emitted ${emitted.length} RecordFiled event(s); ${skipped.length} skipped (idempotent); ${missing.length} source file(s) missing on disk`,
        emitted,
        skipped,
        missing,
      },
      null,
      2,
    ),
  );

  // Missing source files are NOT a hard fail at replay time — they may be
  // archived after the manifest entry was authored, but a downstream recon
  // (rms-documents-parity, document-registration) will catch the
  // event-without-document case. We do however non-zero-exit so CI surfaces
  // the gap rather than silently swallowing it.
  if (missing.length > 0) {
    process.exit(1);
  }
}

main();
