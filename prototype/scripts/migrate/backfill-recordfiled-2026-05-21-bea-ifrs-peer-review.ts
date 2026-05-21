// scripts/migrate/backfill-recordfiled-2026-05-21-bea-ifrs-peer-review.ts
//
// One-shot backfill: emit a single `RecordFiled(documents)` event for
// Bea's IFRS quantitative-thresholds peer-review deliverable
// (`archive/owner-inbox/2026-05-21_bea_ifrs-thresholds-peer-review.md`).
//
// Bea filed her peer-review record at the repo root rather than under
// `archive/owner-inbox/` in PR #656, so the file was out of scope for
// `recon:rms-documents-parity`. The file is being relocated to its
// canonical Phase-4 location in this PR; this backfill emits the
// matching `RecordFiled(documents)` event so the recon's primary-path
// match key (`Owner Inbox/<filename>`) resolves on every fresh runner.
//
// Idempotent on `recordId`: re-running emits nothing.
//
// Authority: D-RMS-PHASE-3 (CEO-approved 2026-05-17);
//            D-RMS-PHASE-4 (CEO-approved 2026-05-18);
//            D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE (2026-05-21).
// Brief:     brief:owen:move-bea-ifrs-peer-review-record-into-canonical-:2026-05-21
// Author:    Owen (Company Secretary, governance)

import { existsSync, readFileSync } from "node:fs";
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
// Retention envelope — governance-equivalent peer-review deliverable
// ---------------------------------------------------------------------------
//
// Bea is the Accounting & financial reporting engineer (engineering seat),
// but her IFRS quantitative-thresholds peer review is a CFO-engineering
// governance-equivalent record under the IFRS-policy chain
// (FIN-ACCT-01 v1.3, ratified by Camille at next ICAAP cycle). Director-
// decision artefact: 7-year minimum, hot tier — same envelope as Owen's
// 2026-05-21 investigation backfill.

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
  filename: "2026-05-21_bea_ifrs-thresholds-peer-review.md",
  recordId: "record:documents:bea:ifrs-thresholds-peer-review:2026-05-21",
  asOf: "2026-05-21T00:00:00.000Z",
  actor: { type: "service", id: "agent:bea:engineering" },
  classification: "governance-seat",
  metadata: {
    title: "Peer review — IFRS quantitative thresholds (§3.2.2 SICR, §3.5.2 Materiality)",
    category: "governance",
    author: "Bea (Accounting & financial reporting engineer, engineering)",
    date: "2026-05-21",
  },
  citations: [
    "D-RMS-PHASE-3",
    "D-RMS-PHASE-4",
    "D-TRADE-LIFECYCLE-IFRS-CHAIN",
    "brief:bea:peer-review-ifrs-quantitative-thresholds-drafted:2026-05-21",
    "brief:owen:move-bea-ifrs-peer-review-record-into-canonical-:2026-05-21",
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
        msg: "backfill-recordfiled-2026-05-21-bea-ifrs-peer-review: already filed — skip",
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
          msg: "backfill-recordfiled-2026-05-21-bea-ifrs-peer-review: archive file missing on disk",
          missing: [ENTRY.filename],
        },
        null,
        2,
      ),
    );
  } else {
    const body = readFileSync(archiveAbs, "utf8");

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
          msg: "backfill-recordfiled-2026-05-21-bea-ifrs-peer-review: emitted 1 RecordFiled(documents) event",
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
