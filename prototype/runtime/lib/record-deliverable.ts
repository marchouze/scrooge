// runtime/lib/record-deliverable.ts
//
// Central RecordFiled emission for scheduler-produced deliverables.
//
// **Why this exists.** The autonomous-agent scheduler (`runtime/run.ts`)
// invokes each agent handler, which writes its daily run output as markdown
// into `archive/owner-inbox/` and returns the repo-relative deliverable path
// (`Owner Inbox/<filename>`) on `AgentRunOutput.deliverable`. Until this
// module, only a handful of handlers (atlas-alco-pack, ravi-intraday-stress,
// atlas-ilaap-run, …) emitted a backing `RecordFiled` event themselves. Every
// other run produced markdown-without-event — a Principle-1 violation that the
// `recon:rms-documents-parity` gate (Phase 3) flags as a hard fail.
//
// **What this does.** After a handler returns successfully, `runAgent` calls
// `recordDeliverableFiled(...)` with the run context, the output, and the set
// of `RecordFiled` events the handler emitted during its own run. If the
// handler already self-filed (any `RecordFiled` whose `metadata.path` matches
// the deliverable, OR any `RecordFiled(documents)` emitted this run), we skip —
// the handler owns its record. Otherwise we read the deliverable body from the
// owner-inbox directory, put it into the content-addressed document store, and
// append a `RecordFiled(documents)` event via the canonical `recordFiled`
// helper. The real BLAKE3 hash (not a zero/placeholder hash) makes the record
// blob-integrity-clean as well as parity-clean.
//
// **Idempotency.** Guarded three ways: (1) self-file detection (above);
// (2) a store-wide check for any prior `RecordFiled` whose `metadata.path`
// equals the deliverable; (3) a deterministic `recordId` so a re-run that
// somehow reaches this path appends no duplicate (the document store dedupes
// the blob, and the recordId match short-circuits before append). Best-effort:
// a failure here logs and returns rather than failing the run — the deliverable
// is already on disk and the next scheduled run (or the backfill manifest)
// re-files it.
//
// **Path convention.** The gate (`platform/recon/rms-documents-parity.ts`,
// `hasMatchingRecordEvent`) matches on `metadata.path === "Owner Inbox/<file>"`.
// The deliverable string the handlers return is exactly that, so we file it
// verbatim. The filesystem read uses `ctx.ownerInboxDir` (which resolves to
// `archive/owner-inbox/`, the Phase-4 home) + the basename.
//
// Authority: D-SCHEDULER-RECORDFILED-EMISSION (CEO session-delegation,
//            2026-06-11); D-RMS-PHASE-3 (active).
// Brief:     brief:atlas:scheduler-recordfiled-emission-remediation:2026-06-11
// Author:    Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";

import type { Event } from "../../platform/event-store/types";
import { logger } from "../../platform/observability/logger";
import { defaultRetentionForRegister, recordFiled } from "../../platform/records";
import type { AgentRunContext, AgentRunOutput } from "../types";

const DEFAULT_ENTITY = "LE-ZA-HOZ-BANK";

const CITATIONS: readonly string[] = ["D-SCHEDULER-RECORDFILED-EMISSION", "D-RMS-PHASE-3"];

/**
 * Slugify an agent name / deliverable basename into a stable, lowercase,
 * URN-safe fragment for the `recordId`.
 */
function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/\.md$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Does the deliverable path point at an Owner Inbox markdown file we should
 * file? We only auto-file `Owner Inbox/*.md` deliverables — other deliverable
 * shapes (e.g. a register row, a code path) are out of scope for the documents
 * register.
 */
function isOwnerInboxMarkdown(deliverable: string): boolean {
  return deliverable.startsWith("Owner Inbox/") && deliverable.endsWith(".md");
}

/**
 * Read the set of `RecordFiled` events appended during this run and decide
 * whether the handler already filed its own record for this deliverable.
 *
 * A handler is treated as self-filing when EITHER:
 *   - it emitted any `RecordFiled` whose `metadata.path` equals the
 *     deliverable path, OR
 *   - it emitted any `RecordFiled(documents)` this run at all (the handler
 *     owns the documents register for this run; we do not double-file).
 *
 * `RecordFiled(agent-runs)` alone does NOT count as self-filing the document —
 * the parity gate only inspects the documents register, so an agent that files
 * only an agent-runs record still needs a documents record. (In practice the
 * existing self-filers either file `documents` or rely on the date fallback;
 * the path-match arm covers both.)
 */
function handlerSelfFiled(deliverable: string, recordFiledThisRun: readonly Event[]): boolean {
  for (const e of recordFiledThisRun) {
    const payload = e.payload as Record<string, unknown>;
    const metadata = payload.metadata as Record<string, unknown> | undefined;
    const metaPath = typeof metadata?.path === "string" ? metadata.path : null;
    if (metaPath === deliverable) return true;
    if (payload.registerKey === "documents") return true;
  }
  return false;
}

export interface RecordDeliverableDeps {
  /** Injectable for tests — defaults to scanning the live event store. */
  readonly priorRecordFiledPaths?: () => ReadonlySet<string>;
}

/**
 * Central RecordFiled emission for a scheduler run's deliverable.
 *
 * Returns the `recordId` filed (or `null` when nothing was filed — skipped,
 * self-filed, not an owner-inbox markdown, dry-run, or missing on disk).
 * Best-effort: never throws; failures are logged.
 */
export function recordDeliverableFiled(
  ctx: AgentRunContext,
  output: AgentRunOutput,
  recordFiledThisRun: readonly Event[],
  priorRecordFiledPaths: () => ReadonlySet<string>,
  deps?: RecordDeliverableDeps,
): string | null {
  try {
    if (ctx.dryRun) return null;
    const deliverable = output.deliverable;
    if (!deliverable || !isOwnerInboxMarkdown(deliverable)) return null;

    // Skip if the handler already filed its own record for this deliverable.
    if (handlerSelfFiled(deliverable, recordFiledThisRun)) return null;

    // Skip if a prior RecordFiled already covers this exact path (idempotent
    // across re-runs of the same deliverable).
    const priorPaths = (deps?.priorRecordFiledPaths ?? priorRecordFiledPaths)();
    if (priorPaths.has(deliverable)) return null;

    const filename = basename(deliverable);
    const fsPath = resolve(ctx.ownerInboxDir, filename);
    if (!existsSync(fsPath)) {
      logger.warn(
        { agent: ctx.agent, runId: ctx.runId, deliverable, fsPath },
        "record-deliverable — deliverable not found on disk (skipping RecordFiled)",
      );
      return null;
    }

    const body = readFileSync(fsPath, "utf8");
    if (body.trim() === "") {
      logger.warn(
        { agent: ctx.agent, runId: ctx.runId, deliverable },
        "record-deliverable — deliverable is empty (skipping RecordFiled)",
      );
      return null;
    }

    const date = (ctx.asOf ?? "").slice(0, 10);
    const agentSlug = slug(ctx.agent);
    const fileSlug = slug(filename);
    const recordId = `record:documents:${agentSlug}:${fileSlug}:${date}`;

    const result = recordFiled(
      {
        recordId,
        registerKey: "documents",
        body,
        classification: "agent-internal",
        retention: defaultRetentionForRegister("documents"),
        citations: [...CITATIONS],
        actor: { type: "service", id: `agent:${agentSlug}:${ctx.trigger.id}` },
        entity: DEFAULT_ENTITY,
        metadata: {
          title: `${ctx.agent} — ${ctx.trigger.id} — ${date}`,
          path: deliverable,
          category: "agent-run-snapshot",
          author: agentSlug,
          date,
        },
      },
      ctx.asOf,
    );

    logger.info(
      {
        agent: ctx.agent,
        runId: ctx.runId,
        recordId,
        documentHash: result.documentHash,
        isNewDocument: result.isNewDocument,
        deliverable,
      },
      "record-deliverable — RecordFiled(documents) emitted for scheduler deliverable",
    );
    return recordId;
  } catch (err) {
    logger.error(
      {
        agent: ctx.agent,
        runId: ctx.runId,
        deliverable: output.deliverable,
        err: (err as Error).message,
      },
      "record-deliverable — RecordFiled emission failed (non-fatal; deliverable on disk)",
    );
    return null;
  }
}
