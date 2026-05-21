// scripts/migrate/backfill-recordfiled-2026-05-21-owen-investigation.ts
//
// One-shot backfill: emit a single `RecordFiled(documents)` event for
// Owen's Team Inbox stale-files investigation deliverable
// (`archive/owner-inbox/2026-05-21_owen_team-inbox-stale-files-investigation.md`).
//
// Owen filed his investigation record via an inline emit during dispatch,
// without authoring a re-runnable backfill script. With the fresh-runner
// downgrade-to-warn carve-out retired (see `backfill-recordfiled-documents-
// -2026-05-17.ts` and `D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE`),
// `recon:rms-documents-parity` hard-fails on every fresh runner because
// the on-disk markdown has no matching `RecordFiled(documents)` event.
//
// This script closes the gap. Idempotent on `recordId`: re-running emits
// nothing.
//
// Authority: D-RMS-PHASE-3 (CEO-approved 2026-05-17);
//            D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE (2026-05-21).
// Brief:     brief:atlas:wire-owen-investigation-record-recordfiled-into-:2026-05-21
// Author:    Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { eventStore } from "../../platform/composition";
import { recordFiled } from "../../platform/records";
import type { RecordFiledPayload } from "../../platform/records/helpers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found walking up)");
}

const REPO_ROOT = findRepoRoot(__dirname);

// ---------------------------------------------------------------------------
// Retention envelope — governance-seat investigation deliverable
// ---------------------------------------------------------------------------
//
// Owen is the CoSec governance seat; investigation records authored under
// his authority are director-decision artefacts (per CLAUDE.md authority
// routing). 7-year minimum, hot tier — same envelope as RMS phase specs
// and authority-gap briefs in the 2026-05-17 backfill catalogue.

const GOVERNANCE_RETENTION: RecordFiledPayload["retention"] = {
  citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
  minimumYears: 7,
  archivalTier: "hot",
};

// ---------------------------------------------------------------------------
// Backfill entry — single record
// ---------------------------------------------------------------------------

interface BackfillEntry {
  readonly filename: string;
  readonly recordId: string;
  readonly asOf: string;
  readonly actor: { readonly type: "service" | "human" | "system"; readonly id: string };
  readonly classification: RecordFiledPayload["classification"];
  readonly metadata: {
    readonly title: string;
    readonly category: string;
    readonly author: string;
    readonly date: string;
  };
  readonly citations: readonly string[];
}

const ENTRY: BackfillEntry = {
  filename: "2026-05-21_owen_team-inbox-stale-files-investigation.md",
  recordId: "record:documents:owen:team-inbox-stale-files-investigation:2026-05-21",
  asOf: "2026-05-21T00:00:00.000Z",
  actor: { type: "service", id: "agent:owen:governance" },
  classification: "governance-seat",
  metadata: {
    title: "Team Inbox stale-files investigation",
    category: "governance",
    author: "Owen (Company Secretary, governance)",
    date: "2026-05-21",
  },
  citations: [
    "D-RMS-PHASE-2",
    "D-RMS-PHASE-3",
    "D-RMS-PHASE-4",
    "brief:owen:investigate-remediate-5-stale-team-inbox-authori:2026-05-21",
    "brief:atlas:wire-owen-investigation-record-recordfiled-into-:2026-05-21",
  ],
};

// ---------------------------------------------------------------------------
// Idempotency: skip if a prior RecordFiled(documents) event matches recordId.
// ---------------------------------------------------------------------------

let alreadyFiled = false;
for (const e of eventStore.replay({ type: "RecordFiled" })) {
  const payload = e.payload as Record<string, unknown>;
  if (payload.registerKey !== "documents") continue;
  if (payload.recordId === ENTRY.recordId) {
    alreadyFiled = true;
    break;
  }
}

// ---------------------------------------------------------------------------
// Emit (or skip)
// ---------------------------------------------------------------------------

if (alreadyFiled) {
  console.log(
    JSON.stringify(
      {
        level: "info",
        msg: "backfill-recordfiled-2026-05-21-owen-investigation: already filed — skip",
        skipped: [ENTRY.recordId],
      },
      null,
      2,
    ),
  );
} else {
  const archiveAbs = resolve(REPO_ROOT, "archive", "owner-inbox", ENTRY.filename);
  if (!existsSync(archiveAbs)) {
    console.log(
      JSON.stringify(
        {
          level: "warn",
          msg: "backfill-recordfiled-2026-05-21-owen-investigation: archive file missing on disk",
          missing: [ENTRY.filename],
        },
        null,
        2,
      ),
    );
  } else {
    const body = readFileSync(archiveAbs, "utf8");

    // mtime fallback retained for parity with the 2026-05-17 backfill — we
    // always prefer the deterministic frontmatter-derived `asOf` so the hash
    // is stable across runners.
    const _mtimeIso = statSync(archiveAbs).mtime.toISOString();
    void _mtimeIso;

    const result = recordFiled(
      {
        recordId: ENTRY.recordId,
        registerKey: "documents",
        body,
        classification: ENTRY.classification,
        retention: GOVERNANCE_RETENTION,
        citations: [...ENTRY.citations],
        actor: ENTRY.actor,
        entity: "BANK-ZA-001",
        metadata: {
          title: ENTRY.metadata.title,
          // Recon primary-match key: `Owner Inbox/<filename>` per
          // rms-documents-parity.ts §"matching". On-disk archive path is
          // Phase 4 successor; recon still expects the pre-archive logical
          // path.
          path: `Owner Inbox/${ENTRY.filename}`,
          category: ENTRY.metadata.category,
          author: ENTRY.metadata.author,
          date: ENTRY.metadata.date,
        },
      },
      ENTRY.asOf,
    );

    console.log(
      JSON.stringify(
        {
          level: "info",
          msg: "backfill-recordfiled-2026-05-21-owen-investigation: emitted 1 RecordFiled(documents) event",
          emitted: [
            {
              recordId: ENTRY.recordId,
              eventId: result.eventId,
              documentHash: result.documentHash,
              isNewDocument: result.isNewDocument,
            },
          ],
        },
        null,
        2,
      ),
    );
  }
}
