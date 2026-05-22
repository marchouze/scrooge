// scripts/backfill-document-registered-2026-05-22b.ts
//
// Backfill: emit a DocumentRegistered event for each of the 8 operations
// policies authored on 2026-05-22 as part of the agent brief
// brief:devon:write-recommended-operations-policies-8-policies:2026-05-22.
//
// Policies covered:
//   1. payments-settlement-policy-v1.md
//   2. trade-confirmation-affirmation-policy-v1.md
//   3. nostro-correspondent-banking-policy-v1.md
//   4. reconciliation-break-management-policy-v1.md
//   5. change-management-policy-v1.md
//   6. data-management-policy-v1.md
//   7. health-safety-policy-v1.md
//   8. agent-operations-policy-v1.md
//
// Idempotent: checks the event store for a DocumentRegistered event with the
// same documentId before emitting — safe to re-run. Also safe to run
// concurrently with the 2026-05-14 backfill (distinct documentIds).
//
// How to run (from prototype/):
//   bun run scripts/backfill-document-registered-2026-05-22b.ts
//
// The script writes to the local SQLite event store at .local/event.db
// (or whatever BANK_EVENT_DB resolves to). Run event-store:sync after if
// you need the events in the Postgres mirror.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Devon (Chief Operating Officer, governance)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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
// Policy manifest — 8 operations policies authored 2026-05-22
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
  // --- Operations (payment & settlement) ---
  {
    documentId: "policy:payments-settlement-policy:v1",
    title: "Payments and Settlement Policy v1",
    kind: "policy",
    filePath: "Policies/payments-settlement-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon", "agent:tomas"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (trade confirmation) ---
  {
    documentId: "policy:trade-confirmation-affirmation-policy:v1",
    title: "Trade Confirmation and Affirmation Policy v1",
    kind: "policy",
    filePath: "Policies/trade-confirmation-affirmation-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:tomas", "agent:kai"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (nostro / correspondent banking) ---
  {
    documentId: "policy:nostro-correspondent-banking-policy:v1",
    title: "Nostro and Correspondent Banking Policy v1",
    kind: "policy",
    filePath: "Policies/nostro-correspondent-banking-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:tomas", "agent:eitan"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (reconciliation) ---
  {
    documentId: "policy:reconciliation-break-management-policy:v1",
    title: "Reconciliation and Break Management Policy v1",
    kind: "policy",
    filePath: "Policies/reconciliation-break-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:tomas", "agent:bea"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (change management) ---
  {
    documentId: "policy:change-management-policy:v1",
    title: "Change Management Policy v1",
    kind: "policy",
    filePath: "Policies/change-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon", "agent:atlas"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (data management) ---
  {
    documentId: "policy:data-management-policy:v1",
    title: "Data Management Policy v1",
    kind: "policy",
    filePath: "Policies/data-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon", "agent:anya", "agent:atlas"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (health and safety) ---
  {
    documentId: "policy:health-safety-policy:v1",
    title: "Health and Safety Policy v1",
    kind: "policy",
    filePath: "Policies/health-safety-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Operations (agent operations) ---
  {
    documentId: "policy:agent-operations-policy:v1",
    title: "Agent Operations Policy v1",
    kind: "policy",
    filePath: "Policies/agent-operations-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon", "agent:sade"],
    registeredAt: "2026-05-22T00:00:00.000Z",
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
  let errors = 0;

  for (const entry of POLICIES) {
    if (alreadyRegistered.has(entry.documentId)) {
      logger.info(
        { documentId: entry.documentId },
        "backfill-document-registered-2026-05-22b — skipped (event already exists)",
      );
      skipped += 1;
      continue;
    }

    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error(
        { documentId: entry.documentId, path: absPath },
        "backfill-document-registered-2026-05-22b — SKIPPED (file not found)",
      );
      errors += 1;
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
      "backfill-document-registered-2026-05-22b — DocumentRegistered event emitted",
    );
    emitted += 1;
  }

  logger.info(
    { emitted, skipped, errors, total: POLICIES.length },
    "backfill-document-registered-2026-05-22b — complete",
  );

  return errors === 0 ? 0 : 1;
}

process.exit(main());
