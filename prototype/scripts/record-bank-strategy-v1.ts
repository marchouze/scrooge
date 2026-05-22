// scripts/record-bank-strategy-v1.ts
//
// Emit a DocumentRegistered event for the inaugural bank strategy document:
//   Policies/bank-strategy-v1.md
//
// Idempotent: checks the event store for a DocumentRegistered event with the
// same documentId before emitting.
//
// How to run (from prototype/):
//   bun run scripts/record-bank-strategy-v1.ts

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

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 8; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

function main(): number {
  const filePath = "Policies/bank-strategy-v1.md";
  const absPath = resolve(REPO_ROOT, filePath);

  if (!existsSync(absPath)) {
    logger.error({ filePath }, "record-bank-strategy-v1 — file not found");
    return 1;
  }

  const content = readFileSync(absPath, "utf-8");
  const contentHash = hashContent(content);
  const documentId = "policy:bank-strategy:v1";

  // Idempotency check
  const alreadyRegistered = new Set<string>();
  for (const e of eventStore.replay({ type: "DocumentRegistered" })) {
    const id = (e.payload as Record<string, unknown>).documentId;
    if (typeof id === "string") alreadyRegistered.add(id);
  }

  if (alreadyRegistered.has(documentId)) {
    logger.info({ documentId }, "record-bank-strategy-v1 — already registered, skipping");
    return 0;
  }

  const payload: DocumentRegisteredPayload = {
    documentId,
    title: "Hoz Bank — Institutional Strategy v1",
    kind: "other",
    contentHash,
    filePath,
    version: "1.0.0",
    authors: [
      "agent:scrooge",
      "agent:helena",
      "agent:camille",
      "agent:devon",
      "agent:saskia",
      "agent:owen",
      "agent:zara",
      "agent:eitan",
    ],
    status: "draft",
    registeredAt: "2026-05-22T00:00:00.000Z",
  };

  const event = makeDocumentRegistered({
    asOf: "2026-05-22T00:00:00.000Z",
    entity: BANK_ZA_001 as string,
    actor: { type: "human", id: "marc@tgv.co.za" },
    citations: ["D-POLICY-DOCUMENT-HOME"],
    payload,
    eventId: newEventId(),
  });

  eventStore.append(event);
  logger.info(
    { documentId, contentHash, filePath },
    "record-bank-strategy-v1 — DocumentRegistered event emitted",
  );

  return 0;
}

process.exit(main());
