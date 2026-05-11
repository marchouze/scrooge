// scripts/close-out-ceo-decisions-2026-05-11.ts
//
// One-shot close-out: emit the typed `CeoDecision` events that should have
// been on the bus already, but weren't. Two decisions are stuck on the
// dashboard `decisionsOpen` list for reasons that have nothing to do with
// fresh CEO input — they're missing or stale events. This script closes
// the gap.
//
// Background:
//
//   1. `D-PRINCIPLES-P2-P6-MERGE` — approved by Marc (CEO) and actioned via
//      PRs #214 (spec), #215 (principles merge collapsing P2+P6), #216
//      (cross-ref fixup). All three merged on `main`. No CeoDecision event
//      with `action="approve"` was ever recorded against the decisionId —
//      so the dashboard projection still surfaces it as open. This emits
//      the missing event, dated PR #215's merge timestamp.
//
//   2. `D-MARKETS-CAPITAL-TIME-SHAPE` — a `request-revision` event with
//      `actor.id="marc@tgv.co.za"` was emitted at 2026-05-07T13:51:16.781Z
//      (event_id `d935e2bc-bb24-4b45-aac3-ac66014385e1`). But it was a
//      Scrooge smoke-test of the dashboard `/api/decide` form,
//      mis-attributed to Marc due to the hardcoded actor in
//      `dashboard/server.ts` (substrate gap — deferred). The decision is
//      genuinely open; Saskia's §8 (capital time-shape) still awaits
//      Marc's actual call. This emits a corrective `request-revision`
//      event attributed to `agent:scrooge` (actor.type="service") that
//      supersedes the smoke-test by latest-wins-per-key. The decision
//      stays open (action remains `request-revision`), but with the
//      correctly-attributed actor in `reopenedFromEvents`.
//
// Approach for #2 — chose (a) corrective event over (b) spec-surface:
//   The dashboard `derive.ts::reduceCeoDecisions` projection recognises
//   only `approve | defer | modify | request-revision` actions (per
//   `dashboard/types.ts::DecisionAction`). There is no `supersede` or
//   `revoke` action. Approach (b) would have required adding a new
//   action to the projection AND back-dating or adjusting the Saskia
//   spec file — two changes for a one-line audit-trail correction. The
//   corrective-event approach is one append, idempotent, and preserves
//   the smoke-test event in the audit log for the substrate-gap recon
//   (the `/api/decide` identity seam) to point at.
//
// Substrate-gap items surfaced (documented in the close-out brief):
//   - `dashboard/server.ts` `/api/decide` hardcodes
//     `actor: { type: "human", id: "marc@tgv.co.za" }` regardless of
//     the actual caller. Needs an identity seam (deferred per Marc).
//   - `recordCeoDecision()` forces `actor.type="human"` (line 92 of
//     `runtime/decisions/record.ts`). Agent-authored corrective events
//     against a CeoDecision currently bypass the helper and construct
//     the Event directly — fine for one-shots, but a decision-record-
//     to-event symmetry recon should assert that every actor.type used
//     on CeoDecision is one of {human, service:agent:scrooge}.
//
// Idempotency:
//   - #1 skips if any CeoDecision event already exists for the
//     decisionId (matches the pattern in
//     `backfill-decision-events-2026-05-10.ts`).
//   - #2 uses a deterministic event_id (`evt-2026-05-11-d-markets-capital-
//     time-shape-correction`); re-running is a UNIQUE-constraint no-op.
//
// How to run:
//   `cd prototype && bun run scripts/close-out-ceo-decisions-2026-05-11.ts`
//   Then push to the canonical store with `bun run event-store:sync` (the
//   Postgres push) so the deployed dashboard sees the change. Local
//   verification via `bun run scripts/regen-dashboard-cache.ts`.
//
// Author: Scrooge (Chief of Staff / Orchestrator) — Marc (CEO) on the
//         audit-trail correction. Owen (Company Secretary, governance)
//         co-author for the CeoDecision-record paperwork.

import { eventStore } from "../platform/composition";
import { newEventId } from "../platform/core/types";
import { PRODUCTION_CARVE_OUTS } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

// ---------------------------------------------------------------------------
// #1 — D-PRINCIPLES-P2-P6-MERGE: emit missing `approve` event.
// ---------------------------------------------------------------------------

const PRINCIPLES_ENTRY = {
  decisionId: "D-PRINCIPLES-P2-P6-MERGE",
  action: "approve" as const,
  title: "Merge Principles 2 and 6 into single Principle 2 (Single-graph discipline)",
  outcome:
    "Approve the merge of Principles 2 and 6 into a single Principle 2 (Single-graph discipline), renumbering P7 (autonomous-by-default) to P6.",
  comment:
    "Approve event back-recorded: decision was actioned via PR #215 but the typed event was not emitted at the time. Closes the ghost-open state on the dashboard.",
  sourceDoc: "Owner Inbox/2026-05-11_owen_d-principles-p2-p6-merge_decision-spec.md",
  // PR #215 mergedAt — per `gh pr view 215 --json mergedAt`.
  asOf: "2026-05-11T07:44:04.000Z",
} as const;

// ---------------------------------------------------------------------------
// #2 — D-MARKETS-CAPITAL-TIME-SHAPE: emit corrective `request-revision`
//        attributed to agent:scrooge to supersede the smoke-test event.
//        The decision stays genuinely open.
// ---------------------------------------------------------------------------

const MARKETS_CORRECTION_EVENT_ID = "evt-2026-05-11-d-markets-capital-time-shape-correction";

// Slightly later than the smoke-test event (2026-05-07T13:51:16.781Z) so
// `latest-wins-per-key` in `reduceCeoDecisions` picks this one. Dated
// 2026-05-11 — the day the audit-trail correction was authored, per the
// supersession markdown record at
// `Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-markets-capital-time-shape.md`
// which is the human-readable mirror of this event.
const MARKETS_CORRECTION_AS_OF = "2026-05-11T08:00:00.000Z";

const MARKETS_CORRECTION_EVENT: Event = {
  event_id: MARKETS_CORRECTION_EVENT_ID,
  type: "CeoDecision",
  as_of: MARKETS_CORRECTION_AS_OF,
  entity: "BANK-ZA-001",
  // `service` actor — this is an agent-authored audit-trail correction,
  // not a CEO decision. The corrective semantics: the prior event was
  // mis-attributed to Marc; the underlying decision is genuinely open.
  actor: { type: "service", id: "agent:scrooge" },
  citations: ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"],
  payload: {
    decisionId: "D-MARKETS-CAPITAL-TIME-SHAPE",
    title: "Markets franchise design — proposal (Saskia §8 capital time-shape)",
    action: "request-revision",
    outcome:
      "CORRECTION: the prior CeoDecision event on this decisionId (event_id d935e2bc-bb24-4b45-aac3-ac66014385e1, emitted 2026-05-07T13:51:16.781Z with actor.id=marc@tgv.co.za) was Scrooge's smoke-test of the dashboard /api/decide form, mis-attributed to Marc due to the hardcoded actor seam (substrate gap, deferred). This corrective event supersedes the smoke-test via latest-wins-per-key with the correct actor (agent:scrooge, service). The underlying decision remains genuinely open — Saskia's §8 capital time-shape (Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md) still awaits Marc's actual call.",
    comment:
      "Audit-trail correction (Principle 1). Pairs with the markdown mirror at Owner Inbox/2026-05-07_scrooge_ceo-decision-record_d-markets-capital-time-shape.md and the close-out brief at Owner Inbox/2026-05-11_scrooge-owen_ceo-decisions-close-out.md. The /api/decide identity seam is a deferred substrate fix.",
    sourceDoc: "Owner Inbox/2026-05-07_saskia_markets-franchise-design-proposal.md",
    recordedVia: "script:close-out-ceo-decisions-2026-05-11",
  },
  provenance: PRODUCTION_CARVE_OUTS.CeoDecision,
};

function main(): number {
  let emitted = 0;
  let skipped = 0;
  const failures: { label: string; err: string }[] = [];

  // -------------------------------------------------------------------------
  // #1 — D-PRINCIPLES-P2-P6-MERGE
  // -------------------------------------------------------------------------
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  if (alreadyRecorded.has(PRINCIPLES_ENTRY.decisionId)) {
    logger.info(
      { decisionId: PRINCIPLES_ENTRY.decisionId },
      "#1 skipped — CeoDecision event already exists",
    );
    skipped += 1;
  } else {
    try {
      const { eventId } = recordCeoDecision(
        {
          decisionId: PRINCIPLES_ENTRY.decisionId,
          action: PRINCIPLES_ENTRY.action,
          title: PRINCIPLES_ENTRY.title,
          outcome: PRINCIPLES_ENTRY.outcome,
          actor: "marc@tgv.co.za",
          comment: PRINCIPLES_ENTRY.comment,
          sourceDoc: PRINCIPLES_ENTRY.sourceDoc,
          recordedVia: "script:close-out-ceo-decisions-2026-05-11",
        },
        PRINCIPLES_ENTRY.asOf,
      );
      logger.info(
        { decisionId: PRINCIPLES_ENTRY.decisionId, eventId, action: PRINCIPLES_ENTRY.action },
        "#1 emitted — back-recorded approve for D-PRINCIPLES-P2-P6-MERGE",
      );
      emitted += 1;
    } catch (e) {
      const msg = (e as Error).message;
      failures.push({ label: "#1 D-PRINCIPLES-P2-P6-MERGE", err: msg });
      logger.error({ decisionId: PRINCIPLES_ENTRY.decisionId, err: msg }, "#1 failed");
    }
  }

  // -------------------------------------------------------------------------
  // #2 — D-MARKETS-CAPITAL-TIME-SHAPE corrective event
  // -------------------------------------------------------------------------
  try {
    eventStore.append(MARKETS_CORRECTION_EVENT);
    logger.info(
      {
        decisionId: "D-MARKETS-CAPITAL-TIME-SHAPE",
        eventId: MARKETS_CORRECTION_EVENT_ID,
        actor: "agent:scrooge",
        action: "request-revision",
      },
      "#2 emitted — corrective request-revision supersedes smoke-test event",
    );
    emitted += 1;
  } catch (e) {
    const msg = (e as Error).message;
    if (/UNIQUE constraint failed/.test(msg)) {
      logger.info(
        { eventId: MARKETS_CORRECTION_EVENT_ID },
        "#2 skipped — corrective event already exists (idempotent)",
      );
      skipped += 1;
    } else {
      failures.push({ label: "#2 D-MARKETS-CAPITAL-TIME-SHAPE", err: msg });
      logger.error({ eventId: MARKETS_CORRECTION_EVENT_ID, err: msg }, "#2 failed");
    }
  }

  logger.info({ emitted, skipped, failed: failures.length }, "close-out complete");

  // Reference newEventId so the import stays semantically meaningful in the
  // event a future maintainer switches the deterministic id pattern to a
  // random one (the current approach favours determinism for idempotency).
  void newEventId;

  return failures.length > 0 ? 1 : 0;
}

process.exit(main());
