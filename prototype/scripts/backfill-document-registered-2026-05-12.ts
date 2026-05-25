// scripts/backfill-document-registered-2026-05-12.ts
//
// One-time backfill: emit a DocumentRegistered event for each of the 10
// policy documents copied to Policies/ on 2026-05-12 as part of
// D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
//
// Idempotent: checks the event store for a DocumentRegistered event with
// the same documentId before emitting — safe to re-run.
//
// How to run (from prototype/):
//   bun run scripts/backfill-document-registered-2026-05-12.ts
//
// The script writes to the local SQLite event store at .local/event.db
// (or whatever BANK_EVENT_DB resolves to). Run event-store:sync after if
// you need the events in the Postgres mirror.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId } from "../platform/core/types";
import { hashContent } from "../platform/document-store/hash";
import {
  type DocumentRegisteredPayload,
  makeDocumentRegistered,
} from "../platform/event-store/event-types/governance";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Repo-root resolver
// ---------------------------------------------------------------------------

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up from script dir)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

// ---------------------------------------------------------------------------
// Policy manifest — auto-discovered from Policies/*.md
// ---------------------------------------------------------------------------

const SKIP_BASENAMES = new Set(["README.md"]);

interface PolicyEntry {
  readonly documentId: string;
  readonly title: string;
  readonly kind: DocumentRegisteredPayload["kind"];
  readonly filePath: string; // repo-relative
  readonly version: string;
  readonly authors: string[];
  readonly registeredAt: string; // ISO 8601 — back-dated to original authoring
}

function deriveDocumentId(file: string): string {
  const slug = file
    .replace(/-policy-v\d+\.md$/, "")
    .replace(/-v\d+\.md$/, "")
    .replace(/\.md$/, "");
  const kind = file.includes("-charter-") ? "charter" : "policy";
  return `${kind}:${slug}:v1`;
}

function discoverPolicies(): PolicyEntry[] {
  const policiesDir = resolve(REPO_ROOT, "Policies");
  if (!existsSync(policiesDir)) return [];
  return readdirSync(policiesDir)
    .filter(
      (f) =>
        f.endsWith(".md") && !SKIP_BASENAMES.has(f) && statSync(resolve(policiesDir, f)).isFile(),
    )
    .map((file) => {
      const slug = file
        .replace(/-policy-v\d+\.md$/, "")
        .replace(/-v\d+\.md$/, "")
        .replace(/\.md$/, "");
      const kind: DocumentRegisteredPayload["kind"] = file.includes("-charter-")
        ? "charter"
        : "policy";
      return {
        documentId: deriveDocumentId(file),
        title:
          slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) +
          (kind === "charter" ? " Charter v1" : " Policy v1"),
        kind,
        filePath: `Policies/${file}`,
        version: "1.0.0",
        authors: ["agent:scrooge"],
        registeredAt: "2026-05-11T00:00:00.000Z",
      };
    });
}

const POLICIES: readonly PolicyEntry[] = discoverPolicies();

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  // Build idempotency set: filePaths already registered (matches recon check).
  const alreadyRegistered = new Set<string>();
  for (const e of eventStore.replay({ type: "DocumentRegistered" })) {
    const fp = (e.payload as Record<string, unknown>).filePath;
    if (typeof fp === "string") alreadyRegistered.add(fp);
  }

  let emitted = 0;
  let skipped = 0;

  for (const entry of POLICIES) {
    if (alreadyRegistered.has(entry.filePath)) {
      logger.info(
        { documentId: entry.documentId },
        "backfill-document-registered — skipped (event already exists)",
      );
      skipped += 1;
      continue;
    }

    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error(
        { documentId: entry.documentId, path: absPath },
        "backfill-document-registered — SKIPPED (file not found)",
      );
      skipped += 1;
      continue;
    }

    const content = readFileSync(absPath, "utf8");
    const contentHash = hashContent(content);

    const payload: DocumentRegisteredPayload = {
      documentId: entry.documentId,
      title: entry.title,
      kind: entry.kind,
      filePath: entry.filePath,
      contentHash,
      version: entry.version,
      authors: entry.authors,
      registeredAt: entry.registeredAt,
    };

    const event = makeDocumentRegistered({
      asOf: entry.registeredAt,
      entity: BANK_ZA_001 as string,
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-POLICY-DOCUMENT-HOME", "GOV-FRAMEWORK-CEO-RESERVED"],
      payload,
      eventId: newEventId(),
    });

    eventStore.append(event);
    logger.info(
      {
        documentId: entry.documentId,
        contentHash,
        filePath: entry.filePath,
      },
      "backfill-document-registered — DocumentRegistered event emitted",
    );
    emitted += 1;
  }

  logger.info(
    { emitted, skipped, total: POLICIES.length },
    "backfill-document-registered — complete",
  );

  return emitted + skipped === POLICIES.length ? 0 : 1;
}

process.exit(main());
