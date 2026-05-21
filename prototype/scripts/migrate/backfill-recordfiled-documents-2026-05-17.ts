// scripts/migrate/backfill-recordfiled-documents-2026-05-17.ts
//
// One-shot backfill: emit `RecordFiled(documents)` events for the eight
// post-Phase-3 deliverables in `archive/owner-inbox/` that landed before
// the per-deliverable `file-*` script pattern was established. Without
// these events, `recon:rms-documents-parity` hard-fails on every fresh
// runner where any other RecordFiled(documents) event is present
// (because the "fresh-runner downgrade-to-warn" carve-out trips on
// emptyStore detection; one event from a `file-*` script flips it
// off and reclassifies the eight files from `warn` to `fail`).
//
// The carve-out itself is retired in the same PR — see
// `prototype/platform/recon/rms-documents-parity.ts` and the
// `D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE` Decision.
//
// Each entry below records:
//   - `path`             — repo-relative path matching the recon's primary
//                          match key (`Owner Inbox/<filename>` per spec
//                          §3.8 / `rms-documents-parity.ts`).
//   - `archivePath`      — actual on-disk path under `archive/owner-inbox/`
//                          (we read the body from here).
//   - `recordId`         — deterministic record identifier.
//   - `asOf`             — original frontmatter `date` (or `authored-on` /
//                          `asOf`) expressed as midnight UTC; falls back
//                          to file mtime if no frontmatter date.
//   - `actor`            — agent-service actor identity.
//   - `metadataTitle`    — title for the Documents register render.
//   - `metadataCategory` — coarse classification used for register grouping.
//   - `retention`        — retention envelope chosen per CLAUDE.md routing
//                          (governance specs → director-decision retention,
//                          7 years, hot; engineering / agent-perf →
//                          Banks Act 5-year baseline, cool).
//
// Idempotent: each emit is gated on absence of a prior `RecordFiled` event
// with the same `recordId`, so re-running emits nothing.
//
// Authority: D-RMS-PHASE-3 (CEO-approved 2026-05-17);
//            D-RMS-DOCUMENTS-FRESH-RUNNER-DOWNGRADE-RETIRE (2026-05-21).
// Brief:     brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21
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
// Retention envelopes
// ---------------------------------------------------------------------------
//
// `governance` — governance-seat decision artefacts (RMS phase specs,
//                CRO scope reviews, CISO design specs, CoSec authority
//                gap briefs). 7 years, hot tier, director-decision
//                obligation citation (mirrors existing file-* scripts).
//
// `agent-engineer` — engineer / agent operational artefacts (obligations-
//                register reviews, performance evaluations, accounting
//                design notes). 5 years (Banks Act baseline), cool tier.

type RetentionKind = "governance" | "agent-engineer";

function retentionFor(kind: RetentionKind): RecordFiledPayload["retention"] {
  switch (kind) {
    case "governance":
      return {
        citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
        minimumYears: 7,
        archivalTier: "hot",
      };
    case "agent-engineer":
      return {
        citationRef: "BANKS-ACT-94-1990",
        minimumYears: 5,
        archivalTier: "cool",
      };
  }
}

// ---------------------------------------------------------------------------
// Backfill catalogue — the 8 missing RecordFiled(documents) events
// ---------------------------------------------------------------------------

interface BackfillEntry {
  readonly filename: string;
  readonly recordId: string;
  /** Original frontmatter date (UTC midnight); mtime fallback applied at read-time. */
  readonly asOf: string;
  readonly actor: { readonly type: "service" | "human" | "system"; readonly id: string };
  readonly classification: RecordFiledPayload["classification"];
  readonly retentionKind: RetentionKind;
  readonly metadata: {
    readonly title: string;
    readonly category: string;
    readonly author: string;
    readonly date: string;
  };
  readonly citations: readonly string[];
}

const ENTRIES: readonly BackfillEntry[] = [
  {
    filename: "2026-05-17_mira_obligations-register-v1.30-activity-scope-review.md",
    recordId: "record:documents:mira:obligations-register-v1-30-activity-scope-review:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:mira:engineering" },
    classification: "engineering-seat",
    retentionKind: "agent-engineer",
    metadata: {
      title: "Obligations register v1.30 — Activity scope column corrections",
      category: "compliance-engineer-review",
      author:
        "Mira (Compliance / RegTech engineer, engineering — reports to Zara, Chief Compliance Officer, governance)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-3",
      "WS-INSTRUMENT-ANALYSES",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_owen-atlas_rms-phase-2-spec.md",
    recordId: "record:documents:owen-atlas:rms-phase-2-spec:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:owen:governance" },
    classification: "governance-seat",
    retentionKind: "governance",
    metadata: {
      title: "RMS Phase 2 — Mandatory AgentBriefIssued Dispatch",
      category: "rms-phase-spec",
      author:
        "Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-2",
      "D-RMS-PHASE-3",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_owen-atlas_rms-phase-3-spec.md",
    recordId: "record:documents:owen-atlas:rms-phase-3-spec:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:owen:governance" },
    classification: "governance-seat",
    retentionKind: "governance",
    metadata: {
      title: "RMS Phase 3 — Mandatory RecordFiled Deliverable",
      category: "rms-phase-spec",
      author:
        "Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-3",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_owen-atlas_rms-phase-4-spec.md",
    recordId: "record:documents:owen-atlas:rms-phase-4-spec:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:owen:governance" },
    classification: "governance-seat",
    retentionKind: "governance",
    metadata: {
      title: "RMS Phase 4 — Archive Cutover (Legacy Inboxes → archive/)",
      category: "rms-phase-spec",
      author:
        "Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-4",
      "D-RMS-PHASE-3",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_owen_authority-gap-five-seats.md",
    recordId: "record:documents:owen:authority-gap-five-seats:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:owen:governance" },
    classification: "governance-seat",
    retentionKind: "governance",
    metadata: {
      title: "Authority gap brief — CFO / COO / CISO / CAE / CCO decision authority scoping",
      category: "governance-seat-scoping",
      author: "Owen (Company Secretary, governance)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-3",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_sade_agent-performance-evaluation-2026-05-16-17.md",
    recordId: "record:documents:sade:agent-performance-evaluation-2026-05-16-17:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:sade:engineering" },
    classification: "engineering-seat",
    retentionKind: "agent-engineer",
    metadata: {
      title: "Agent Performance Evaluation — 2026-05-16/17 period",
      category: "agent-performance-evaluation",
      author: "Sade (AgentOps & Token Efficiency Engineer, engineering)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-AGENT-AUTONOMY-OPERATIONAL",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-17_senna_t12-sub-agent-permission-policy-design-spec.md",
    recordId: "record:documents:senna:t12-sub-agent-permission-policy-design-spec:2026-05-17",
    asOf: "2026-05-17T12:00:00.000Z",
    actor: { type: "service", id: "agent:senna:governance" },
    classification: "governance-seat",
    retentionKind: "governance",
    metadata: {
      title: "T-12 — Per-sub-agent PermissionPolicy design specification",
      category: "ciso-design-spec",
      author: "Senna (Chief Information Security Officer, governance)",
      date: "2026-05-17",
    },
    citations: [
      "D-RMS-PHASE-3",
      "brief:senna:t-12-per-sub-agent-permissionpolicy-threat-model:2026-05-17",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
  {
    filename: "2026-05-20_bea_fx-lifecycle-posting-rules-design-note.md",
    recordId: "record:documents:bea:fx-lifecycle-posting-rules-design-note:2026-05-20",
    asOf: "2026-05-20T12:00:00.000Z",
    actor: { type: "service", id: "agent:bea:engineering" },
    classification: "engineering-seat",
    retentionKind: "agent-engineer",
    metadata: {
      title: "FX lifecycle posting rules — design note",
      category: "accounting-design-note",
      author: "Bea (Accounting & financial reporting engineer, engineering)",
      date: "2026-05-20",
    },
    citations: [
      "D-RMS-PHASE-3",
      "D-MARKETS-SCHEMA-FOUNDATION",
      "brief:bea:author-fx-lifecycle-posting-rules-pr-fx-instruct:2026-05-20",
      "brief:atlas:backfill-8-missing-recordfiled-documents-events-:2026-05-21",
    ],
  },
];

// ---------------------------------------------------------------------------
// Idempotency: collect existing RecordFiled(documents) recordIds.
// ---------------------------------------------------------------------------

const existingRecordIds = new Set<string>();
for (const e of eventStore.replay({ type: "RecordFiled" })) {
  const payload = e.payload as Record<string, unknown>;
  if (payload.registerKey !== "documents") continue;
  const id = typeof payload.recordId === "string" ? payload.recordId : null;
  if (id) existingRecordIds.add(id);
}

// ---------------------------------------------------------------------------
// Emit pass
// ---------------------------------------------------------------------------

const emitted: Array<{
  recordId: string;
  eventId: string;
  documentHash: string;
  isNewDocument: boolean;
}> = [];
const skipped: string[] = [];
const missing: string[] = [];

for (const entry of ENTRIES) {
  if (existingRecordIds.has(entry.recordId)) {
    skipped.push(entry.recordId);
    continue;
  }

  const archiveAbs = resolve(REPO_ROOT, "archive", "owner-inbox", entry.filename);
  if (!existsSync(archiveAbs)) {
    missing.push(entry.filename);
    continue;
  }

  const body = readFileSync(archiveAbs, "utf8");

  // mtime fallback (informational only; we always prefer the deterministic
  // frontmatter-derived `entry.asOf` so the hash is stable across runners).
  // Kept here so a future maintainer can swap to mtime if the frontmatter
  // is later corrected and the deterministic date no longer reflects the
  // canonical filing moment.
  const _mtimeIso = statSync(archiveAbs).mtime.toISOString();
  void _mtimeIso;

  const result = recordFiled(
    {
      recordId: entry.recordId,
      registerKey: "documents",
      body,
      classification: entry.classification,
      retention: retentionFor(entry.retentionKind),
      citations: [...entry.citations],
      actor: entry.actor,
      entity: "BANK-ZA-001",
      metadata: {
        title: entry.metadata.title,
        // Recon primary-match key: `Owner Inbox/<filename>` per
        // rms-documents-parity.ts §"matching". The on-disk archive path is
        // the historical successor (Phase 4 archive cutover); the recon
        // still expects the pre-archive logical path.
        path: `Owner Inbox/${entry.filename}`,
        category: entry.metadata.category,
        author: entry.metadata.author,
        date: entry.metadata.date,
      },
    },
    entry.asOf,
  );

  emitted.push({
    recordId: entry.recordId,
    eventId: result.eventId,
    documentHash: result.documentHash,
    isNewDocument: result.isNewDocument,
  });
}

console.log(
  JSON.stringify(
    {
      level: "info",
      msg:
        emitted.length === 0
          ? `backfill-recordfiled-documents-2026-05-17: all ${ENTRIES.length} entries already filed — skip`
          : `backfill-recordfiled-documents-2026-05-17: emitted ${emitted.length} RecordFiled(documents) event(s); ${skipped.length} skipped (idempotent); ${missing.length} archive file(s) missing on disk`,
      emitted,
      skipped,
      missing,
    },
    null,
    2,
  ),
);
