// scripts/register-policy-update-2026-06-09-helena-findings.ts
//
// Re-emit DocumentRegistered events for the two risk policies amended in the
// 2026-06-09 close-out of seven Vera (internal audit engineer) findings:
//   - Policies/market-risk-policy-v1.md          (v1.2 — VINK + 4M7U)
//   - Policies/liquidity-risk-management-policy-v1.md (v1.2 — 8AO0/D9IJ/YQNK/96I3/XF2F)
//
// RMS Phase 3 (D-RMS-PHASE-3) requires every policy document to carry a
// DocumentRegistered event whose contentHash matches the current file. The
// content changed in this PR, so a fresh event is emitted (latest-wins by
// filePath per recon:document-registration). Idempotent: skips a file whose
// latest registered hash already equals the current content hash.
//
// Run against the SHARED store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/register-policy-update-2026-06-09-helena-findings.ts
//
// Authority: D-OPEN-THREADS-CLOSEOUT-2026-06-09 (CEO session-delegation);
//   D-POLICY-DOCUMENT-HOME; D-RMS-PHASE-3.
// Author: Helena (Chief Risk Officer, governance).

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
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
  throw new Error("Cannot locate repo root (CLAUDE.md not found by walking up from script dir)");
}

const REPO_ROOT = findRepoRoot(import.meta.dir);

interface PolicyEntry {
  readonly documentId: string;
  readonly title: string;
  readonly kind: DocumentRegisteredPayload["kind"];
  readonly filePath: string;
  readonly version: string;
  readonly authors: string[];
}

const POLICIES: readonly PolicyEntry[] = [
  {
    documentId: "policy:market-risk:v1",
    title: "Market Risk Policy v1",
    kind: "policy",
    filePath: "Policies/market-risk-policy-v1.md",
    version: "1.2.0",
    authors: ["agent:helena", "agent:rohan"],
  },
  {
    documentId: "policy:liquidity-risk-management:v1",
    title: "Liquidity Risk Management Policy v1",
    kind: "policy",
    filePath: "Policies/liquidity-risk-management-policy-v1.md",
    version: "1.2.0",
    authors: ["agent:camille", "agent:eitan", "agent:helena"],
  },
];

function latestHashByPath(): Map<string, string> {
  const out = new Map<string, string>();
  for (const e of eventStore.replay({ type: "DocumentRegistered" })) {
    const p = e.payload as Record<string, unknown>;
    if (typeof p.filePath === "string" && typeof p.contentHash === "string") {
      out.set(p.filePath, p.contentHash);
    }
  }
  return out;
}

function main(): number {
  const latest = latestHashByPath();
  let emitted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of POLICIES) {
    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error({ path: absPath }, "register-policy-update — SKIPPED (file not found)");
      errors += 1;
      continue;
    }

    const content = readFileSync(absPath, "utf8");
    const contentHash = hashContent(content);

    if (latest.get(entry.filePath) === contentHash) {
      logger.info(
        { documentId: entry.documentId, contentHash },
        "register-policy-update — skipped (latest registered hash already matches)",
      );
      skipped += 1;
      continue;
    }

    const registeredAt = nowUtc();
    const payload: DocumentRegisteredPayload = {
      documentId: entry.documentId,
      title: entry.title,
      kind: entry.kind,
      filePath: entry.filePath,
      contentHash,
      version: entry.version,
      authors: entry.authors,
      registeredAt,
    };

    const event = makeDocumentRegistered({
      asOf: registeredAt,
      entity: BANK_ZA_001 as string,
      actor: { type: "human", id: "marc@tgv.co.za" },
      citations: ["D-OPEN-THREADS-CLOSEOUT-2026-06-09", "D-POLICY-DOCUMENT-HOME", "D-RMS-PHASE-3"],
      payload,
      eventId: newEventId(),
    });

    eventStore.append(event);
    logger.info(
      { documentId: entry.documentId, contentHash, filePath: entry.filePath },
      "register-policy-update — DocumentRegistered event emitted",
    );
    emitted += 1;
  }

  logger.info({ emitted, skipped, errors }, "register-policy-update — complete");
  return errors === 0 ? 0 : 1;
}

process.exit(main());
