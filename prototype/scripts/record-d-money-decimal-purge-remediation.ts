// scripts/record-d-money-decimal-purge-remediation.ts
//
// Records D-MONEY-DECIMAL-PURGE-REMEDIATION — Marc's in-session direction
// (2026-06-14) after discovering that the WS-MONEY-DECIMAL config-only purge
// (slice 4, PR #1325) did NOT remove the financial transactions from the
// canonical store. 496 transactional events remain (Bond settlements, FX
// settlements, RealisedPnl, MtM, ValuationAdjustment, CcrEad, ManualJournal,
// SubLedgerPosting, DailyPnLReport), and new ones keep arriving from live
// schedulers in legacy `*Minor` encoding.
//
// Root cause — two defects:
//   1. CLASSIFIER GAP. slice4-purge-reseed.ts classifies "transactional" by
//      categoryForEventType(t) ∈ {trading, accounting, settlement, market-data}.
//      Almost every financial-transaction type returns `<none>` from that
//      function — uncategorised in provenance-category.ts — so the classifier's
//      `if (cat && TRANSACTIONAL_CATEGORIES.has(cat)) purge; else retain` left
//      them retained. The purge was an allow-list keyed on an incomplete map.
//   2. LIVE RE-EMISSION IN LEGACY ENCODING. The gl-posting-engine
//      (SubLedgerPostingEmitted) and product-control-engine
//      (DailyPnLReportGenerated) — plus the schemas in product-control.ts,
//      fx-accounting.ts, valuation-adjustment.ts, accounting.ts,
//      bond-settlement.ts, mtm.ts — still define and write integer `*Minor`
//      fields. Slice 2 (#1322, 19 files/34 types) did not cover this surface.
//
// Detection gap: recon:no-residual-minor-encoding is fail-severity and DOES
// fail on the canonical store (6,212 violations) but CI runs it only against a
// fresh config-only store where these events do not exist, so it is trivially
// green on every PR. Main is green; the canonical store is not.
//
// Marc's decision (chosen 2026-06-14): FIX ROOT CAUSE FIRST, THEN RE-PURGE.
//   (1) Categorise the orphaned transactional event types in
//       provenance-category.ts and make the purge classifier fail-closed
//       (an uncategorised, money-bearing type must not silently retain).
//   (2) Migrate the surviving schemas + emitters to MoneyWire across the six
//       schema files and their emitters.
//   (3) Pause the launchd schedulers for the operation.
//   (4) Re-verify a pre-purge backup (Vera) and re-run the corrected purge
//       against the canonical store.
//   (5) Make recon:no-residual-minor-encoding run against the canonical store
//       so this failure can never silently pass CI again, and confirm green.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording
// instrument (recordedVia: scrooge:session-delegation); Marc is the
// authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-MONEY-DECIMAL-REDENOMINATION;
// D-MONEY-DECIMAL-BUILD-PROCEED.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-14T05:20:00.000Z";
const APP = "2026-06-14T05:22:00.000Z";

const base = {
  decisionId: "D-MONEY-DECIMAL-PURGE-REMEDIATION",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Remediate the WS-MONEY-DECIMAL purge: it left 496 financial-transaction events in the canonical store (incomplete classifier + live legacy-encoded re-emission). Fix root cause, then re-purge.",
  category: "governance" as const,
  recommendation:
    "Sequence, root-cause first: (1) close the classifier gap — categorise every orphaned money-bearing transactional event type in provenance-category.ts (BondSettlementInstructed, BondCustodianSettlementConfirmed, FxSettlementInstructed, RealisedPnlRecognised, MtmRunCompleted, ValuationAdjustmentComputed, CcrEadComputed, ManualJournalEntry, DailyPnLReportGenerated and the PnL* / AVA family) and make slice4-purge-reseed.ts fail-closed so an uncategorised money-bearing type aborts the purge rather than being silently retained; (2) migrate the surviving schemas and emitters to MoneyWire across product-control.ts, fx-accounting.ts, valuation-adjustment.ts, accounting.ts, bond-settlement.ts, mtm.ts and their emitting engines (gl-posting-engine, product-control-engine, settlement, mtm, valuation-adjustment, CCR); (3) pause the launchd schedulers for the operation window; (4) re-verify a pre-purge backup under Vera audit pre-authorisation and re-run the corrected purge against the canonical home store; (5) wire recon:no-residual-minor-encoding to run against the populated canonical store (not only fresh-CI) so the failure is visible and blocking, and confirm it goes green after the re-purge. Destructive re-purge execution against the canonical store is gated on a final CEO go after the build steps land.",
  rationale:
    "The earlier 'slice 3-5 MERGED + EXECUTED' status was true at the label level and false where it matters: the purge ran but removed only event types that happened to carry a provenance category in the four transactional buckets, while the bulk of financial-transaction types are uncategorised and fell through to 'retained'. Live schedulers continue to append legacy *Minor events post-purge. The gate built to catch exactly this never runs against the populated store in CI, so the regression was invisible. A durable fix must close the classification gap, migrate the emitters so the store stops refilling, and make the gate exercise the real store — otherwise any re-purge refills on the next scheduler tick.",
  sourceDocHashes: [],
  citations: [
    "D-MONEY-DECIMAL-REDENOMINATION",
    "D-MONEY-DECIMAL-BUILD-PROCEED",
    "D-LEGAL-ENTITY-NAME-HOZ-BANK",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
