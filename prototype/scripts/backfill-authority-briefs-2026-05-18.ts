// scripts/backfill-authority-briefs-2026-05-18.ts
//
// Backfill the 5 missing `AgentBriefIssued` events for Owen's 2026-05-18
// authority operationalisation briefs to the 5 governance seats.
//
// Context:
//   PR #515 (feat(governance): operationalise decision-authority routing — 5
//   governance seats, merged 2026-05-18 07:16 SAST) added 5 authority briefs
//   to `Team Inbox/` without backing `AgentBriefIssued` events because
//   RMS Phase 2 (events-first dispatch, D-RMS-PHASE-2) activated on
//   2026-05-17. The original 2026-05-18 backfill (commit a71c066e) emitted
//   the events to the production event store, but a fresh worktree /
//   GitHub Actions container starts with an empty .local/event.db and the
//   events are not re-derived. This script re-emits them deterministically
//   so `recon:rms-briefs-parity` matches them on any worktree / CI run.
//
// Idempotent: checks the event store for an `AgentBriefIssued` event with
// the same briefId before emitting — safe to re-run.
//
// How to run (from prototype/):
//   bun run scripts/backfill-authority-briefs-2026-05-18.ts
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16);
//            D-RMS-PHASE-2 (events-first dispatch, 2026-05-17).
// Spec: archive/team-inbox/2026-05-18_owen_authority-brief-*.md (5 files)
// Author: Owen (Company Secretary, governance)

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import type { Actor } from "../platform/core/types";
import type { RmsAgentRef } from "../platform/event-store/event-types/agent";
import { logger } from "../platform/observability/logger";
import { recordBriefIssued } from "../platform/records";

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
// Brief manifest — Owen's 5 authority operationalisation briefs (2026-05-18)
// ---------------------------------------------------------------------------

interface AuthorityBriefEntry {
  readonly briefId: string;
  readonly filePath: string; // repo-relative
  readonly issuedTo: RmsAgentRef;
  readonly title: string;
}

const ISSUED_BY: RmsAgentRef = {
  name: "Owen",
  position: "Company Secretary, governance",
};

const ASOF = "2026-05-18T05:00:00.000Z"; // back-dated to original authoring

const BRIEFS: readonly AuthorityBriefEntry[] = [
  {
    briefId: "brief:owen:authority-brief-cae-thandiwe:2026-05-18",
    filePath: "archive/team-inbox/2026-05-18_owen_authority-brief-cae-thandiwe.md",
    issuedTo: { name: "Thandiwe", position: "Chief Audit Executive, governance" },
    title: "Authority operationalisation — CAE decision authority surface",
  },
  {
    briefId: "brief:owen:authority-brief-cco-zara:2026-05-18",
    filePath: "archive/team-inbox/2026-05-18_owen_authority-brief-cco-zara.md",
    issuedTo: { name: "Zara", position: "Chief Compliance Officer, governance" },
    title: "Authority operationalisation — CCO decision authority surface",
  },
  {
    briefId: "brief:owen:authority-brief-cfo-camille:2026-05-18",
    filePath: "archive/team-inbox/2026-05-18_owen_authority-brief-cfo-camille.md",
    issuedTo: { name: "Camille", position: "Chief Financial Officer, governance" },
    title: "Authority operationalisation — CFO decision authority surface",
  },
  {
    briefId: "brief:owen:authority-brief-ciso-rashida:2026-05-18",
    filePath: "archive/team-inbox/2026-05-18_owen_authority-brief-ciso-rashida.md",
    issuedTo: {
      name: "Rashida",
      position: "Chief Information Security Officer, governance",
    },
    title: "Authority operationalisation — CISO decision authority surface",
  },
  {
    briefId: "brief:owen:authority-brief-coo-devon:2026-05-18",
    filePath: "archive/team-inbox/2026-05-18_owen_authority-brief-coo-devon.md",
    issuedTo: { name: "Devon", position: "Chief Operating Officer, governance" },
    title: "Authority operationalisation — COO decision authority surface",
  },
];

const ACTOR: Actor = { type: "human", id: "marc@tgv.co.za" };

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main(): number {
  // Build idempotency set: briefIds already in the store.
  const alreadyIssued = new Set<string>();
  for (const e of eventStore.replay({ type: "AgentBriefIssued" })) {
    const id = (e.payload as Record<string, unknown>).briefId;
    if (typeof id === "string") alreadyIssued.add(id);
  }

  let emitted = 0;
  let skipped = 0;
  let errors = 0;

  for (const entry of BRIEFS) {
    if (alreadyIssued.has(entry.briefId)) {
      logger.info(
        { briefId: entry.briefId },
        "backfill-authority-briefs-2026-05-18 — skipped (event already exists)",
      );
      skipped += 1;
      continue;
    }

    const absPath = resolve(REPO_ROOT, entry.filePath);
    if (!existsSync(absPath)) {
      logger.error(
        { briefId: entry.briefId, path: absPath },
        "backfill-authority-briefs-2026-05-18 — SKIPPED (brief body file not found)",
      );
      errors += 1;
      continue;
    }

    const directiveBody = readFileSync(absPath, "utf8");

    try {
      const result = recordBriefIssued(
        {
          briefId: entry.briefId,
          issuedTo: entry.issuedTo,
          issuedBy: ISSUED_BY,
          title: entry.title,
          directiveBody,
          priority: "next-tick",
          expectedOutputs: [
            {
              kind: "deliverable-document",
              description: `${entry.issuedTo.position} starts issuing Decision events under own authority`,
            },
          ],
          workstreamId: "WS-DECISIONS-FRAMEWORK",
          citations: ["D-DECISIONS-FRAMEWORK-REDESIGN", "D-RMS-PHASE-2"],
          actor: ACTOR,
        },
        ASOF,
      );

      logger.info(
        {
          briefId: entry.briefId,
          eventId: result.eventId,
          documentHash: result.documentHash,
        },
        "backfill-authority-briefs-2026-05-18 — AgentBriefIssued event emitted",
      );
      emitted += 1;
    } catch (err) {
      logger.error(
        { briefId: entry.briefId, error: (err as Error).message },
        "backfill-authority-briefs-2026-05-18 — emit FAILED",
      );
      errors += 1;
    }
  }

  logger.info(
    { emitted, skipped, errors, total: BRIEFS.length },
    "backfill-authority-briefs-2026-05-18 — complete",
  );

  return errors === 0 ? 0 : 1;
}

process.exit(main());
