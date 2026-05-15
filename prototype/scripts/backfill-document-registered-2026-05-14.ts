// scripts/backfill-document-registered-2026-05-14.ts
//
// Extended backfill: emit a DocumentRegistered event for every policy document
// in Policies/ that was added after the initial 2026-05-12 backfill. Covers
// the 20 additional policies that exist in Policies/ as of 2026-05-14 but
// were not included in backfill-document-registered-2026-05-12.ts.
//
// Idempotent: checks the event store for a DocumentRegistered event with the
// same documentId before emitting — safe to re-run. Also safe to run
// concurrently with the 2026-05-12 backfill (distinct documentIds).
//
// How to run (from prototype/):
//   bun run scripts/backfill-document-registered-2026-05-14.ts
//
// The script writes to the local SQLite event store at .local/event.db
// (or whatever BANK_EVENT_DB resolves to). Run event-store:sync after if
// you need the events in the Postgres mirror.
//
// Authority: D-POLICY-DOCUMENT-HOME Option C (CEO-approved 2026-05-12).
// Author: Atlas (Core banking platform architect, engineering)

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
// Policy manifest — 20 additional policies in Policies/ as of 2026-05-14
// (those not covered by backfill-document-registered-2026-05-12.ts)
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
  // --- Accounting / Finance ---
  {
    documentId: "policy:accounting-policies-ifrs:v1",
    title: "Accounting Policies — IFRS v1",
    kind: "policy",
    filePath: "Policies/accounting-policies-ifrs-v1.md",
    version: "1.0.0",
    authors: ["agent:owen"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Compliance ---
  {
    documentId: "policy:anti-bribery-corruption-whistleblowing:v1",
    title: "Anti-Bribery, Corruption, and Whistleblowing Policy v1",
    kind: "policy",
    filePath: "Policies/anti-bribery-corruption-whistleblowing-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:zara"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:conduct-of-business-tcf:v1",
    title: "Conduct of Business and Treating Customers Fairly Policy v1",
    kind: "policy",
    filePath: "Policies/conduct-of-business-tcf-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:zara"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:conflicts-of-interest:v1",
    title: "Conflicts of Interest Policy v1",
    kind: "policy",
    filePath: "Policies/conflicts-of-interest-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:zara"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:excon-compliance:v1",
    title: "Exchange Control Compliance Policy v1",
    kind: "policy",
    filePath: "Policies/excon-compliance-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:zara", "agent:mira"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:fais-compliance:v1",
    title: "FAIS Compliance Policy v1",
    kind: "policy",
    filePath: "Policies/fais-compliance-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:zara", "agent:mira"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Governance ---
  {
    documentId: "policy:governance-framework:v1",
    title: "Governance Framework v1",
    kind: "policy",
    filePath: "Policies/governance-framework-v1.md",
    version: "1.0.0",
    authors: ["agent:owen"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- InfoSec / Cyber ---
  {
    documentId: "policy:incident-response:v1",
    title: "Cyber and Operational Incident Response Policy v1",
    kind: "policy",
    filePath: "Policies/incident-response-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:senna"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:information-security-it-governance:v1",
    title: "Information Security and IT Governance Policy v1",
    kind: "policy",
    filePath: "Policies/information-security-it-governance-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:senna", "agent:devon"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Risk ---
  {
    documentId: "policy:credit-risk:v1",
    title: "Credit Risk Policy v1",
    kind: "policy",
    filePath: "Policies/credit-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:market-risk:v1",
    title: "Market Risk Policy v1",
    kind: "policy",
    filePath: "Policies/market-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:rohan"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:model-risk:v1",
    title: "Model Risk Policy v1",
    kind: "policy",
    filePath: "Policies/model-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:operational-resilience:v1",
    title: "Operational Resilience Policy v1",
    kind: "policy",
    filePath: "Policies/operational-resilience-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:devon", "agent:helena"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:operational-risk:v1",
    title: "Operational Risk Policy v1",
    kind: "policy",
    filePath: "Policies/operational-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena", "agent:devon"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:stress-testing:v1",
    title: "Stress Testing Policy v1",
    kind: "policy",
    filePath: "Policies/stress-testing-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:helena"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Operations ---
  {
    documentId: "policy:outsourcing-third-party-risk:v1",
    title: "Outsourcing and Third-Party Risk Policy v1",
    kind: "policy",
    filePath: "Policies/outsourcing-third-party-risk-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:senna", "agent:devon"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Regulatory Reporting ---
  {
    documentId: "policy:pillar-3-disclosure:v1",
    title: "Pillar 3 Disclosure Policy v1",
    kind: "policy",
    filePath: "Policies/pillar-3-disclosure-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:camille", "agent:mira"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:records-management:v1",
    title: "Records Management Policy v1",
    kind: "policy",
    filePath: "Policies/records-management-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:owen", "agent:devon"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },
  {
    documentId: "policy:regulatory-reporting:v1",
    title: "Regulatory Reporting Policy v1",
    kind: "policy",
    filePath: "Policies/regulatory-reporting-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:camille", "agent:mira"],
    registeredAt: "2026-05-13T00:00:00.000Z",
  },

  // --- Tax ---
  {
    documentId: "policy:tax-governance:v1",
    title: "Tax Governance Policy v1",
    kind: "policy",
    filePath: "Policies/tax-policy-v1.md",
    version: "1.0.0",
    authors: ["agent:yael"],
    registeredAt: "2026-05-13T00:00:00.000Z",
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
        "backfill-document-registered-2026-05-14 — skipped (event already exists)",
      );
      skipped += 1;
      continue;
    }

    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error(
        { documentId: entry.documentId, path: absPath },
        "backfill-document-registered-2026-05-14 — SKIPPED (file not found)",
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
      "backfill-document-registered-2026-05-14 — DocumentRegistered event emitted",
    );
    emitted += 1;
  }

  logger.info(
    { emitted, skipped, errors, total: POLICIES.length },
    "backfill-document-registered-2026-05-14 — complete",
  );

  return errors === 0 ? 0 : 1;
}

process.exit(main());
