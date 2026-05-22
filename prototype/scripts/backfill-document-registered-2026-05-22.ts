// scripts/backfill-document-registered-2026-05-22.ts
//
// Extended backfill: emit a DocumentRegistered event for the 11 policy
// documents added to Policies/ on 2026-05-22 as part of the Finance /
// Treasury / Risk / Markets policy completion sprint.
//
// Covers:
//   - financial-reporting-policy-v1.md
//   - funds-transfer-pricing-policy-v1.md
//   - asset-liability-management-policy-v1.md
//   - treasury-investment-policy-v1.md
//   - counterparty-credit-risk-policy-v1.md
//   - concentration-risk-policy-v1.md
//   - country-sovereign-risk-policy-v1.md
//   - climate-environmental-risk-policy-v1.md
//   - conduct-risk-policy-v1.md
//   - new-product-approval-policy-v1.md
//   - securities-financing-policy-v1.md
//
// Idempotent: checks the event store for a DocumentRegistered event with the
// same documentId before emitting — safe to re-run. Also safe to run
// concurrently with the 2026-05-12 and 2026-05-14 backfills (distinct
// documentIds).
//
// How to run (from prototype/):
//   bun run scripts/backfill-document-registered-2026-05-22.ts
//
// The script writes to the local SQLite event store at .local/event.db
// (or whatever BANK_EVENT_DB resolves to). Run event-store:sync after if
// you need the events in the Postgres mirror.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Helena (Chief Risk Officer, governance) + Camille (Chief Financial
//   Officer, governance) + Saskia (Head of Global Markets, governance) +
//   Eitan (Treasurer, governance) — via Scrooge dispatch
//   brief:helena-eitan-camille-saskia:write-remaining-finance-treasury-risk-and-market:2026-05-22

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
// Policy manifest — 11 policies authored 2026-05-22
// ---------------------------------------------------------------------------

interface PolicyEntry {
  readonly documentId: string;
  readonly title: string;
  readonly kind: DocumentRegisteredPayload["kind"];
  readonly filePath: string; // repo-relative
  readonly version: string;
  readonly authors: string[];
  readonly registeredAt: string; // ISO 8601
}

const POLICIES: readonly PolicyEntry[] = [
  // --- Finance ---
  {
    documentId: "policy:financial-reporting-policy:v1",
    title: "Financial Reporting Policy v1",
    kind: "policy",
    filePath: "Policies/financial-reporting-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:camille", "agent:bea"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:funds-transfer-pricing-policy:v1",
    title: "Funds Transfer Pricing Policy v1",
    kind: "policy",
    filePath: "Policies/funds-transfer-pricing-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:eitan", "agent:camille"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Treasury ---
  {
    documentId: "policy:asset-liability-management-policy:v1",
    title: "Asset and Liability Management Policy v1",
    kind: "policy",
    filePath: "Policies/asset-liability-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:eitan", "agent:ravi"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:treasury-investment-policy:v1",
    title: "Treasury Investment Policy v1",
    kind: "policy",
    filePath: "Policies/treasury-investment-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:eitan", "agent:ravi"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Risk ---
  {
    documentId: "policy:counterparty-credit-risk-policy:v1",
    title: "Counterparty Credit Risk Policy v1",
    kind: "policy",
    filePath: "Policies/counterparty-credit-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:concentration-risk-policy:v1",
    title: "Concentration Risk Policy v1",
    kind: "policy",
    filePath: "Policies/concentration-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:country-sovereign-risk-policy:v1",
    title: "Country and Sovereign Risk Policy v1",
    kind: "policy",
    filePath: "Policies/country-sovereign-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:climate-environmental-risk-policy:v1",
    title: "Climate and Environmental Risk Policy v1",
    kind: "policy",
    filePath: "Policies/climate-environmental-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:conduct-risk-policy:v1",
    title: "Conduct Risk Policy v1",
    kind: "policy",
    filePath: "Policies/conduct-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:zara", "agent:saskia"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },

  // --- Markets ---
  {
    documentId: "policy:new-product-approval-policy:v1",
    title: "New Product Approval Policy v1",
    kind: "policy",
    filePath: "Policies/new-product-approval-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:saskia", "agent:owen"],
    registeredAt: "2026-05-22T00:00:00.000Z",
  },
  {
    documentId: "policy:securities-financing-policy:v1",
    title: "Securities Financing Transactions Policy v1",
    kind: "policy",
    filePath: "Policies/securities-financing-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:saskia", "agent:eitan", "agent:imani"],
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
        "backfill-document-registered-2026-05-22 — skipped (event already exists)",
      );
      skipped += 1;
      continue;
    }

    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error(
        { documentId: entry.documentId, path: absPath },
        "backfill-document-registered-2026-05-22 — SKIPPED (file not found)",
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
      "backfill-document-registered-2026-05-22 — DocumentRegistered event emitted",
    );
    emitted += 1;
  }

  logger.info(
    { emitted, skipped, errors, total: POLICIES.length },
    "backfill-document-registered-2026-05-22 — complete",
  );

  return errors === 0 ? 0 : 1;
}

process.exit(main());
