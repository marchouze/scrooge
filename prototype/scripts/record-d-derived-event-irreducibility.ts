// scripts/record-d-derived-event-irreducibility.ts
//
// Records two CEO decisions arising from Marc's challenge (this session) to the
// claim that accounting "emits durable derived events", focused on
// `SubLedgerPostingEmitted`.
//
//   1. D-DERIVED-EVENT-IRREDUCIBILITY-TEST (approved) — codifies the
//      irreducibility test for ALL derived event types and applies it to
//      reclassify double-entry postings / sub-ledger / trial balance / BA
//      returns as PROJECTIONS, not authoritative events.
//   2. D-ACCT-POSTING-PROJECTION-MIGRATION (deferred) — the tracked roadmap
//      item for the foundational migration, recorded in phase `deferred` so the
//      deferral surfaces in the Decisions register and is not silent
//      (Engineering Charter command 5 — no silent deferral).
//
// Authority: CEO (Marc, session-delegation 2026-06-16). Marc approved the
// direction in-session ("Formalise, defer build").
//
// Run against the SHARED canonical store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/record-d-derived-event-irreducibility.ts
//
// Author: Scrooge (Chief of Staff) — recording instrument for the CEO decision.

import { recordDecision } from "../runtime/decisions/record.ts";

const ts = new Date().toISOString();

const test = recordDecision(
  {
    decisionId: "D-DERIVED-EVENT-IRREDUCIBILITY-TEST",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Derived-event irreducibility test — double-entry postings are a projection, not an authoritative event",
    category: "engineering",
    recommendation:
      "Adopt the irreducibility test as the governing rule for every derived (non-primary) event type: a derived event type is legitimate ONLY if it carries at least one field that is NOT recoverable by replaying the primary events through the versioned rule in force at the event's effective date. If a derived event is fully re-derivable from f(sourceEvent, classification, rule@version), it carries no irreducible information and is a PROJECTION — it must not be stored as an authoritative event (Principle 1: stored projections are caches only). Apply the test now: double-entry postings, the sub-ledger, the trial balance and the BA returns are projections (pure folds), NOT events. The genuine accounting events are the recognition DECISIONS — IfrsClassificationApplied, official-mark adoptions, ECL/IFRS-9 staging, hedge designations — together with ManualJournalEntry (a primary authored fact carrying irreducible journalId/description/postedBy intent) and the period-close freeze (AccountingPeriodClosed / TrialBalanceSnapshotted, the single legitimate point at which the fold output is materialised as a point-in-time recognition act, analogous to OfficialMarkAdopted). SubLedgerPostingEmitted is reclassified as projection-output-pending-migration; the migration itself is deferred and tracked under D-ACCT-POSTING-PROJECTION-MIGRATION.",
    rationale:
      "Principle 1's own derived-event contract (Principles/1-events-are-truth.md:39-44) requires a derived event to record a recognition decision not recoverable by replay, and line 43 states that an artefact which cannot reproduce 'is storing state, not recording a decision'. A schema audit of subLedgerPostingEmittedPayloadSchema (platform/event-store/event-types/fx-accounting.ts:184-327) shows every field is a pointer (sourceEventId), a derivable mapping (postingType, legs, baselBusinessLine), a clock read (postedAt), a lens selector (representation), or rule identity (ruleId/ruleVersion) — no postedBy, no description, no judgment; superRefine validates only debits=credits. The posting is therefore the output of a fold wearing an event's clothes. Two corroborating smells: (a) the correction posting-type enum (duplicate-reversal-correction, sla-rebook-*, designated-currency-rebook) exists because wrong postings were frozen into the log and had to be neutralised with compensating events — the state-in-the-log pathology a projection self-heals on recompute; (b) the parity gates (recon:gl-v2-parity, recon:mtm-vs-gl-amount-delta, recon:posting-source-id-canonical) exist only to police two copies of one computation. The representation fan-out (IFRS|SARB-BA-RETURN|ZA-TAX) materialises N folds per source event — three lenses, which are read-side. The genuine decision events already exist (ManualJournalEntry carries irreducible authored intent; IfrsClassificationApplied is judgment) but are under-used relative to the mechanical posting. Codifying the test makes Principle 1's intent executable and prevents the class of error recurring.",
    sourceDocHashes: [],
    citations: ["D-ENGINEERING-INTEGRITY-CHARTER"],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

const migration = recordDecision(
  {
    decisionId: "D-ACCT-POSTING-PROJECTION-MIGRATION",
    phase: "deferred",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Migrate SubLedgerPostingEmitted from a stored derived-event to a projection (deferred roadmap item)",
    category: "engineering",
    recommendation:
      "Tracked, deferred roadmap item implementing D-DERIVED-EVENT-IRREDUCIBILITY-TEST for the accounting substrate. Deferred scope: (1) carve out and strengthen the genuine accounting decision events (IfrsClassificationApplied, mark adoptions, ECL/IFRS-9 staging, hedge designations) and keep ManualJournalEntry as a primary authored fact; (2) build a posting / trial-balance projection folded from (primary events x classification decisions x versioned posting rules), replacing stored SubLedgerPostingEmitted; (3) provide a close-time snapshot (TrialBalanceSnapshotted) for as-filed immutability; (4) backfill / compatibility for the existing posting-event population (~100k events) without deleting events (Principle 1, append-only); (5) add a recon:derived-event-irreducibility gate that asserts every derived event type carries irreducible content, with SubLedgerPostingEmitted allow-listed as the known tracked exception until migrated; (6) retire the posting parity gates post-cutover. A sequenced slice plan (Atlas / PAX) is required before any build commences. No build is authorised by this decision — it records and tracks the deferral.",
    rationale:
      "Marc approved 'formalise the principle now; defer the foundational migration' in-session (2026-06-16). The migration is foundational: the accounting and BA-returns substrate roots on SubLedgerPostingEmitted as a stored event across ~14 emit/consume sites plus recon gates and seeds, so it cannot be undertaken without an explicit sequenced plan. Recording it in phase `deferred` keeps it visible in the Decisions register as an open commitment (Engineering Charter command 5 — no silent deferral) rather than an undocumented TODO.",
    sourceDocHashes: [],
    citations: ["D-DERIVED-EVENT-IRREDUCIBILITY-TEST", "D-ENGINEERING-INTEGRITY-CHARTER"],
    recordedVia: "scrooge:session-delegation",
  },
  ts,
);

console.log(JSON.stringify({ test: test.eventId, migration: migration.eventId }, null, 2));
