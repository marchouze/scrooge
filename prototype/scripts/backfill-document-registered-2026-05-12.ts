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

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import { hashContent } from "../platform/document-store/hash";
import { eventStore } from "../platform/composition";
import {
  makeDocumentRegistered,
  type DocumentRegisteredPayload,
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
// Policy manifest — the 10 documents migrated to Policies/ on 2026-05-12
// ---------------------------------------------------------------------------

interface PolicyEntry {
  readonly documentId: string;
  readonly title: string;
  readonly kind: DocumentRegisteredPayload["kind"];
  readonly filePath: string; // repo-relative
  readonly version: string;
  readonly authors: string[];
  readonly registeredAt: string; // ISO 8601 — back-dated to original authoring
}

const POLICIES: readonly PolicyEntry[] = [
  {
    documentId: "policy:liquidity-risk-management:v1",
    title: "Liquidity Risk Management Policy v1",
    kind: "policy",
    filePath: "Policies/liquidity-risk-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:camille", "agent:eitan", "agent:helena"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:risk-management-and-compliance:v1",
    title: "Risk Management & Compliance Programme (RMCP) v1",
    kind: "policy",
    filePath: "Policies/risk-management-and-compliance-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:mira", "agent:zara"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:aml-cft:v1",
    title: "AML / CFT Policy v1",
    kind: "policy",
    filePath: "Policies/aml-cft-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:mira", "agent:zara"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:popia-privacy:v1",
    title: "POPIA Privacy Policy v1",
    kind: "policy",
    filePath: "Policies/popia-privacy-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:iris", "agent:zara"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:capital-management:v1",
    title: "Capital Management Policy v1",
    kind: "policy",
    filePath: "Policies/capital-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:camille", "agent:helena"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:recovery-resolution-planning:v1",
    title: "Recovery & Resolution Planning Policy v1",
    kind: "policy",
    filePath: "Policies/recovery-resolution-planning-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:camille"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:trading-mandate:v1",
    title: "Trading Mandate v1",
    kind: "policy",
    filePath: "Policies/trading-mandate-v1.md",
    version: "1.0.0",
    authors: ["agent:kai", "agent:helena", "agent:devon"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:remuneration:v1",
    title: "Remuneration Policy v1",
    kind: "policy",
    filePath: "Policies/remuneration-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:owen", "agent:sade"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "policy:fit-and-proper:v1",
    title: "Fit and Proper Policy v1",
    kind: "policy",
    filePath: "Policies/fit-and-proper-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:owen", "agent:helena"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
  {
    documentId: "charter:internal-audit:v1",
    title: "Internal Audit Charter v1",
    kind: "charter",
    filePath: "Policies/internal-audit-charter-v1.md",
    version: "1.0.0",
    authors: ["agent:thandiwe", "agent:vera"],
    registeredAt: "2026-05-11T00:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  // Build idempotency set: documentIds already in the store.
  const alreadyRegistered = new Set<string>();
  for (const e of eventStore.replay({ type: "DocumentRegistered" })) {
    const id = (e.payload as Record<string, unknown>).documentId;
    if (typeof id === "string") alreadyRegistered.add(id);
  }

  let emitted = 0;
  let skipped = 0;

  for (const entry of POLICIES) {
    if (alreadyRegistered.has(entry.documentId)) {
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
