// scripts/backfill-decision-events-2026-05-10.ts
//
// One-time backfill: for every Owner Inbox decision-record on disk
// that lacks a corresponding CeoDecision event in the event store,
// emit the missing event. Idempotent — checks each decisionId against
// existing events and skips if already recorded.
//
// Why this exists:
//   Every Scrooge-written CEO decision record between 2026-05-07 and
//   2026-05-10 was authored as markdown only (Principle 7 fallback —
//   the canonical event-emitting handler `agent:scrooge:ceo-decision-record`
//   would have clobbered the detailed records with brief stubs). The
//   handler fix landed 2026-05-10 (preserve-existing-record semantics)
//   makes the handler safe to invoke for any decisionId — running this
//   script after the fix lands closes the gap by emitting the events
//   that should have been on the bus all along.
//
// Effect on the dashboard:
//   `decisionStatus = "resolved"` for every entry resolved by an
//   on-disk Scrooge record once events emit (per derive.ts §1460-62).
//   The 10 stale "open" decisions in the cache as of 2026-05-10 all
//   have records on disk; this backfill resolves them.
//
// How to run:
//   1. Set `BANK_EVENT_DB_URL` to the Neon Postgres URL so the
//      subsequent `event-store:sync` push lands the events in the
//      canonical store (without it, events stay in the local sqlite
//      and the cloud dashboard never sees them).
//   2. `cd prototype && bun run scripts/backfill-decision-events-2026-05-10.ts`
//   3. `cd prototype && bun run event-store:sync` (push to Postgres)
//   4. `cd prototype && bun run scripts/regen-dashboard-cache.ts` to
//      refresh `prototype/seeds/dashboard-state.json`.
//
// Author: Atlas (substrate) · Scrooge (handler caller)

import { eventStore } from "../platform/composition";
import { logger } from "../platform/observability/logger";
import { recordCeoDecision } from "../runtime/decisions/record";

interface BackfillEntry {
  readonly decisionId: string;
  readonly action: "approve" | "defer" | "modify" | "request-revision";
  readonly title: string;
  readonly outcome: string;
  readonly comment?: string;
  readonly sourceDoc?: string;
  readonly asOf: string; // ISO 8601
}

// The set of decisionIds with on-disk records but (per investigation
// 2026-05-10) no corresponding CeoDecision events. asOf reflects the
// date on the record's filename. outcomes are condensed from the
// records' `**Outcome:**` lines.
const ENTRIES: readonly BackfillEntry[] = [
  // 2026-05-08 sessional decisions
  {
    decisionId: "S3",
    action: "approve",
    title: "Thin human layer at licence-day — composition and timing",
    outcome:
      "Approve thin-human-layer composition at licence-day per Owen+Imani recommendation. Refers downstream to D-THIN-HUMAN-LAYER-MINIMUM.",
    sourceDoc: "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s3.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  {
    decisionId: "S5",
    action: "approve",
    title: "External legal counsel for SARB licence application",
    outcome: "Approve external counsel engagement plan per Imani recommendation.",
    sourceDoc: "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s5.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  {
    decisionId: "S6",
    action: "approve",
    title: "API + cloud cost budget for the build phase",
    outcome: "Approve build-phase cost budget per Camille recommendation.",
    sourceDoc: "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s6.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  {
    decisionId: "S7",
    action: "approve",
    title: "Substrate-completeness budget — sessions / agent runs to substrate-complete",
    outcome:
      "Approve Targeted budget envelope per Atlas substrate-completeness budget. Slices authorised pre-M2.",
    sourceDoc: "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s7.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  {
    decisionId: "S8",
    action: "approve",
    title: "Agent-runtime-substrate brief — approve scope",
    outcome: "Approve agent-runtime-substrate scope per Atlas spec (A0–A4 baseline).",
    sourceDoc: "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_s8.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  {
    decisionId: "D-S7-TARGETED-3-5-OPEN-QUESTIONS",
    action: "approve",
    title: "S7-Targeted #3 / #4 / #5 open questions — adjudication",
    outcome:
      "Approve all three author recommendation sets as drafted (Nadia validation v0, Rohan backtest v0, Saskia+Kai pre-trade gateway envelope v0).",
    sourceDoc:
      "Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-s7-targeted-3-5-open-questions.md",
    asOf: "2026-05-08T12:00:00.000Z",
  },
  // 2026-05-09 records (not in dashboard cache as open, but may have missing events)
  {
    decisionId: "D-M4-FX-SUB-DECISIONS",
    action: "approve",
    title: "M4 FX foundation — sub-decisions surfaced",
    outcome: "Approve M4 FX sub-decisions per Saskia+Kai pack.",
    sourceDoc: "Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-m4-fx-sub-decisions.md",
    asOf: "2026-05-09T12:00:00.000Z",
  },
  // 2026-05-10 today's records
  {
    decisionId: "D-NEW-PRODUCT-APPROVAL-POLICY",
    action: "approve",
    title: "New Product Approval Policy v1.0 — adopt",
    outcome:
      "Saskia's NPA Policy v1.0 transitions PLANNED to IN FORCE. CEO-interim primary approval until BRC constituted; BRC steady-state.",
    comment: "approve all 3 — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-EVENT-STORE-SCALING",
    action: "approve",
    title:
      "Event-store scaling design — adopt framing, Azure target, first three slices under Targeted budget",
    outcome:
      "Atlas's framing adopted: five-concern decomposition, Azure target architecture, snapshot+partition+tier strategy. Slices 1-3 authorised pre-M2 under Targeted budget. Q1-Q5 resolved per Atlas recommendation.",
    comment: "approve all 3 — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_atlas_event-store-scaling-design.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-PRODUCT-CONSTRUCTION-SUBSTRATE",
    action: "approve",
    title:
      "Product-construction substrate — typed Product layer + 12-event lifecycle family + policy-attestation seam",
    outcome:
      "Atlas+Kai+Saskia substrate adopted. Slices 1-3 authorised pre-M2 under Targeted budget. Q1-Q5 resolved per authors' recommendations.",
    comment: "approve all 3 — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_atlas-kai-saskia_product-construction-substrate.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-SIX-SEATS-PACK",
    action: "approve",
    title:
      "Approve all six thin-human-layer recruitment role-briefs as drafted; cross-cutting defaults stand",
    outcome:
      "All six PAX role-briefs approved as drafted. Cross-cutting Q1-Q4 resolved at default. Nolan opens active search across all six channels.",
    comment: "Yes — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_scrooge_ceo-decision-pack_d-hire-six-seats.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-HUMAN-CRO",
    action: "approve",
    title: "Human CRO (Priority-1) — approve role-brief; open active search",
    outcome:
      "Open executive-search engagement per role-brief §7 channels; Camille framing pass; SA-resident-only; conventional bank-CRO candidate class. Priority-1 first lodgment.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_human-cro.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-INDEPENDENT-CHAIR",
    action: "approve",
    title: "Independent Chair / AC Chair / S&E NED — approve role-brief; open active search",
    outcome:
      "Open active search via two SA Board-search firms in parallel; 4-6 month time-to-shortlist; Chair appointment ahead of NED #2 and NED #3; King IV substantive-independence test as binding gate.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_independent-chair.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-NED-2",
    action: "approve",
    title: "NED #2 (strict-independent, AC member) — approve role-brief; open active search",
    outcome:
      "Open immediately in parallel with Chair search; technology/cyber primary skills-axis bias from day one; final axis confirmation deferred until Chair shortlist substantially complete.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_ned-2.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-NED-3",
    action: "approve",
    title: "NED #3 (non-strict-independent, AC member) — approve role-brief; open active search",
    outcome:
      "Primary candidate-class: SA-Reserve-Bank-alumni or recently-retired tier-1-bank-CRO/CFO/MLRO; secondary: deep CDD/financial-crime practitioner.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_ned-3.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-COMPLIANCE-LEAD",
    action: "approve",
    title:
      "Triple-hatted Compliance Lead (MLRO + FIC CO + POPIA IO) — approve role-brief; open active search",
    outcome:
      "Triple-hat stands (workload-concentration not statutory-defect). Channels: CISA, FIC-accredited-MLRO, SARB alumni, specialist compliance-search. Indicative comp R2.4-R3.4m TGV.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_compliance-lead.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-HIRE-COMPANY-SECRETARY",
    action: "approve",
    title:
      "Company Secretary (separate human, deputy-IO under POPIA Reg. 4) — approve role-brief; open active search",
    outcome:
      "Search through CGISA + specialist-exec-search; comp band Tier-2 SA bank CoSec all-in R3.0-R4.5m + 5-10% deputy-IO premium. Fractional pre-licence-day, full-time at licence-application lodgment.",
    sourceDoc: "Owner Inbox/2026-05-10_pax_role-brief_company-secretary.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-CI-GITHUB-PLAN-UPGRADE-DEFER",
    action: "defer",
    title: "GitHub plan upgrade for branch-protection enforcement — defer (with reminder)",
    outcome:
      "Plan-upgrade half of D-CI-GATE-INTEGRITY deferred. Substrate-fix half (Atlas #105) proceeds. Operating posture: red CI blocks merge via agent-discipline until upgrade lands. SUPERSEDED same day by D-CI-GATE-INTEGRITY closure.",
    comment: "Defer but remember need to upgrade — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_vera_ci-gate-integrity-finding.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
  {
    decisionId: "D-CI-GATE-INTEGRITY",
    action: "approve",
    title:
      "D-CI-GATE-INTEGRITY closed — substrate-fix landed; enforcement enabled via repo-visibility shift",
    outcome:
      "Both halves of Vera's recommendation in place. Substrate-fix: Atlas PR #105 merged, bun run ci exit 0. Enforcement: branch protection enabled on main with ci as required check (strict mode), force-pushes/deletions blocked, enforce_admins false (single-CEO break-glass retained).",
    comment: "github is now public — chat-intake 2026-05-10",
    sourceDoc: "Owner Inbox/2026-05-10_vera_ci-gate-integrity-finding.md",
    asOf: "2026-05-10T00:00:00.000Z",
  },
];

function main(): number {
  // Build the set of decisionIds that already have at least one
  // CeoDecision event in the store. recordCeoDecision is append-only;
  // re-emitting would create a duplicate that the dashboard's
  // reduceCeoDecisions correctly handles (latest-wins) but bloats the log.
  const alreadyRecorded = new Set<string>();
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const id = (e.payload as Record<string, unknown>).decisionId;
    if (typeof id === "string") alreadyRecorded.add(id);
  }

  let emitted = 0;
  let skipped = 0;
  for (const entry of ENTRIES) {
    if (alreadyRecorded.has(entry.decisionId)) {
      logger.info({ decisionId: entry.decisionId }, "backfill — skipped (event already exists)");
      skipped += 1;
      continue;
    }
    recordCeoDecision(
      {
        decisionId: entry.decisionId,
        action: entry.action,
        title: entry.title,
        outcome: entry.outcome,
        actor: "marc@tgv.co.za",
        ...(entry.comment ? { comment: entry.comment } : {}),
        ...(entry.sourceDoc ? { sourceDoc: entry.sourceDoc } : {}),
        recordedVia: "script:backfill-decision-events-2026-05-10",
      },
      entry.asOf,
    );
    logger.info(
      { decisionId: entry.decisionId, action: entry.action },
      "backfill — CeoDecision event emitted",
    );
    emitted += 1;
  }

  logger.info({ emitted, skipped, total: ENTRIES.length }, "backfill — complete");
  return 0;
}

process.exit(main());
