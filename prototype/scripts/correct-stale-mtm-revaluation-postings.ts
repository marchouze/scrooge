// scripts/correct-stale-mtm-revaluation-postings.ts
//
// Append-only correcting entries for 14 stale revaluation postings (seqs
// 24160–24173) that were emitted by the MtmRunCompleted backfill on
// 2026-05-21 (run seq 23192, runId 06726182-1b68-43ff-b7d3-651e787c8a7d).
//
// Root cause: the backfill posted ALL historical FxPositionRevalued events
// for each trade (3 prior runs × 6 SIM trades = 18 stale + 6 new from
// the last run) in a single batch, rather than only the latest revaluation
// per trade.  The "latest" entries (seqs 24174–24183) correctly represent
// the current mark; the 14 stale entries (24160–24173) duplicate P&L that
// was already superseded by newer valuations.
//
// Net overcounting on ACC-2100-005 (Unrealised FX P&L): ZAR 9,631,107.60
//
// Fix: emit 14 `SubLedgerPostingEmitted` events with `postingType:
// "stale-revaluation-correction"`, each carrying legs that are the exact
// mirror-image (equal-and-opposite) of the stale posting's legs.  Per
// Principle 1 — NO SQL DELETE, no mutation of existing events.
//
// Idempotent: skips any stale posting that already has a matching
// `stale-revaluation-correction` entry (identified by `correctsEventId`).
//
// Authority:
//   D-CORRECT-DUPLICATE-MTM-REVERSALS (CEO session-delegation 2026-05-21)
//   IFRS-9-§5.7.1 (FVTPL: changes in fair value recognised in P&L)
//   Principles/1-events-are-truth.md (append-only event store)
//
// Author: Rohan (Risk engineer, engineering)

import { eventStore } from "../platform/composition";
import { makeSubLedgerPostingEmitted } from "../platform/event-store/event-types/fx-accounting";
import type { SubLedgerLeg } from "../platform/event-store/event-types/fx-accounting";
import { logger } from "../platform/observability/logger";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = {
  type: "service" as const,
  id: "agent:rohan:correct-stale-mtm-revaluation-postings:D-CORRECT-DUPLICATE-MTM-REVERSALS",
};
const CITATIONS = [
  "D-CORRECT-DUPLICATE-MTM-REVERSALS",
  "IFRS-9-§5.7.1",
  "Principles/1-events-are-truth.md",
];
const AS_OF = "2026-05-21";
const POSTED_AT = new Date().toISOString();

// ---------------------------------------------------------------------------
// Stale posting definitions
// ---------------------------------------------------------------------------
// Each entry: the event_id of the stale posting + its sequence number +
// the legs to reverse (equal-and-opposite of the original legs).
// ---------------------------------------------------------------------------

interface StaleEntry {
  correctsEventId: string;
  correctsSequence: number;
  /** Legs of the ORIGINAL stale posting (to be inverted for correction). */
  originalLegs: SubLedgerLeg[];
}

const STALE_ENTRIES: StaleEntry[] = [
  {
    correctsEventId: "3b749e5d-1131-43ab-8f05-7f9c19946d2b", // seq 24160
    correctsSequence: 24160,
    originalLegs: [
      { accountId: "ACC-2100-005", debitCredit: "debit", amountMinor: 244495969, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 244495969, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "8264c93d-42e9-4f1b-82f3-1eec3085f43b", // seq 24161
    correctsSequence: 24161,
    originalLegs: [
      { accountId: "ACC-2100-005", debitCredit: "debit", amountMinor: 244495969, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 244495969, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "c40cea45-f2e7-4747-bd00-faae09de400a", // seq 24162
    correctsSequence: 24162,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 496689, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 496689, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "84bae3fe-88c8-4397-83a5-da2f50b1ab4a", // seq 24163
    correctsSequence: 24163,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 373534, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 373534, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "a32c8e32-001f-45e5-8718-f2c94bb8d213", // seq 24164
    correctsSequence: 24164,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 234605, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 234605, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "8bbd034f-15f7-4ba2-a493-d2fc64955115", // seq 24165
    correctsSequence: 24165,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 5382089, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 5382089, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "6512363d-856d-4d57-922e-e520c7670685", // seq 24166
    correctsSequence: 24166,
    originalLegs: [
      { accountId: "ACC-2100-005", debitCredit: "debit", amountMinor: 244495969, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 244495969, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "f5750125-7088-4c17-a706-7b75b8d1c3cb", // seq 24167
    correctsSequence: 24167,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 949641, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 949641, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "d1ec136a-9731-44c5-8eef-95f670305577", // seq 24168
    correctsSequence: 24168,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 496689, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 496689, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "6827c14d-9fc5-46cf-8029-f6c6f4f3d8cf", // seq 24169
    correctsSequence: 24169,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 373534, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 373534, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "623dcf85-8c34-4d4a-9815-36f221f48732", // seq 24170
    correctsSequence: 24170,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 234605, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 234605, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "3cc7b686-ff4e-4df5-9068-c28718a7ec09", // seq 24171
    correctsSequence: 24171,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 5382089, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 5382089, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "e6cd97b8-9587-4f9f-9ed1-e8fdb224d4a1", // seq 24172
    correctsSequence: 24172,
    originalLegs: [
      { accountId: "ACC-2100-005", debitCredit: "debit", amountMinor: 244495969, currency: "ZAR" },
      { accountId: "ACC-2100-001", debitCredit: "credit", amountMinor: 244495969, currency: "ZAR" },
    ],
  },
  {
    correctsEventId: "d6a3aa55-394e-488d-9489-7e07536b0071", // seq 24173
    correctsSequence: 24173,
    originalLegs: [
      { accountId: "ACC-2100-001", debitCredit: "debit", amountMinor: 949641, currency: "ZAR" },
      { accountId: "ACC-2100-005", debitCredit: "credit", amountMinor: 949641, currency: "ZAR" },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Invert a leg's debitCredit direction (debit → credit, credit → debit). */
function invertLeg(leg: SubLedgerLeg): SubLedgerLeg {
  return {
    ...leg,
    debitCredit: leg.debitCredit === "debit" ? "credit" : "debit",
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function run(): void {
  // Build lookup of existing correction entries by correctsEventId so we
  // can skip already-corrected entries (idempotency).
  const alreadyCorrected = new Set<string>();
  for (const e of eventStore.replay()) {
    if (
      e.type === "SubLedgerPostingEmitted" &&
      (e.payload as Record<string, unknown>).postingType === "stale-revaluation-correction"
    ) {
      const ce = (e.payload as Record<string, unknown>).correctsEventId as string | undefined;
      if (ce) alreadyCorrected.add(ce);
    }
  }

  let emitted = 0;
  let skipped = 0;

  for (const entry of STALE_ENTRIES) {
    if (alreadyCorrected.has(entry.correctsEventId)) {
      logger.info(
        { correctsEventId: entry.correctsEventId, correctsSequence: entry.correctsSequence },
        "stale-revaluation-correction: already corrected — skipping (idempotent)",
      );
      skipped++;
      continue;
    }

    const correctionLegs = entry.originalLegs.map(invertLeg);

    const event = makeSubLedgerPostingEmitted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        // No sourceEventId — correction entries use correctsEventId instead.
        postingType: "stale-revaluation-correction",
        correctsEventId: entry.correctsEventId,
        correctsSequence: entry.correctsSequence,
        legs: correctionLegs,
        postedAt: POSTED_AT,
        memo: `Corrects stale MTM revaluation posting seq ${entry.correctsSequence} (D-CORRECT-DUPLICATE-MTM-REVERSALS). Root cause: MtmRunCompleted backfill (seq 23192) posted all historical FxPositionRevalued events rather than only the latest per trade. This entry reverses the stale over-counting on ACC-2100-005.`,
      } as Parameters<typeof makeSubLedgerPostingEmitted>[0]["payload"],
    });

    eventStore.append(event);
    emitted++;

    logger.info(
      {
        correctionEventId: event.event_id,
        correctsEventId: entry.correctsEventId,
        correctsSequence: entry.correctsSequence,
        legs: correctionLegs,
      },
      "stale-revaluation-correction: emitted",
    );
  }

  logger.info(
    { emitted, skipped, total: STALE_ENTRIES.length },
    "correct-stale-mtm-revaluation-postings: done",
  );
}

run();
