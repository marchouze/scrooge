// scripts/emit-capital-injection-sim.ts
//
// Emit a simulated capital injection:
//   Dr ACC-1200-001 (ZAR Nostro — Standard Bank correspondent) R300,000,000
//   Cr ACC-5000-001 (Share Capital — CET1)                     R300,000,000
//
// Two events:
//   1. CapitalEvent{capitalEventKind:"equity-issuance", amount:30_000_000_000}
//      — consumed by computeCapitalMetrics; switches it from build-phase
//        constant to live-event mode.
//   2. SubLedgerPostingEmitted{postingType:"capital-injection"}
//      — double-entry GL record (Dr nostro / Cr share capital).
//
// Provenance: simulated (scenario "capital-injection-standard-bank-2026-06-01").
// GL period-close uses production-only filter, so the posting is recorded
// in the event log but excluded from the production trial balance.
// CapitalEvent has no provenance filter — it is folded unconditionally.
//
// Idempotency: guarded on CAPITAL_EVENT_ID / POSTING_EVENT_ID.
//
// Authority: CEO session delegation 2026-06-01.
// Author: Scrooge (Chief of Staff) on behalf of Camille (CFO, finance).

import { eventStore } from "../platform/composition";
import { makeSubLedgerPostingEmitted } from "../platform/event-store/event-types/fx-accounting";
import { makeCapitalEvent } from "../platform/event-store/event-types/risk-treasury-extended";
import { logger } from "../platform/observability/logger";

const CAPITAL_EVENT_ID = "CAP-SIM-STD-BANK-300M-2026-06-01";
const POSTING_EVENT_ID = "GL-CAP-SIM-STD-BANK-300M-2026-06-01";
const AS_OF = new Date().toISOString();
const EFFECTIVE_DATE = "2026-06-01";
const ENTITY = "LE-BANK-SA";
const ACTOR = {
  type: "service" as const,
  id: "scrooge@bank-za-001",
  name: "Scrooge (Chief of Staff)",
};
const CITATIONS = ["D-MARKETS-CAPITAL-TIME-SHAPE", "CEO-SESSION-DELEGATION-2026-06-01"];

// R300,000,000 in ZAR minor units (cents): 300_000_000 × 100 = 30_000_000_000
const AMOUNT_MINOR = 30_000_000_000;

const SIMULATED_PROVENANCE = {
  kind: "simulated" as const,
  scenario: "capital-injection-standard-bank-2026-06-01",
  sourceLineage: "scripts/emit-capital-injection-sim.ts",
  tags: ["manual-simulation", "capital-raise"],
};

function alreadyEmitted(eventId: string): boolean {
  for (const e of eventStore.replay({})) {
    if (e.event_id === eventId) return true;
  }
  return false;
}

function main(): number {
  // ── Idempotency guards ─────────────────────────────────────────────────────
  if (alreadyEmitted(CAPITAL_EVENT_ID)) {
    logger.info({ eventId: CAPITAL_EVENT_ID }, "CapitalEvent already exists — skipped");
    return 0;
  }
  if (alreadyEmitted(POSTING_EVENT_ID)) {
    logger.info({ eventId: POSTING_EVENT_ID }, "SubLedgerPostingEmitted already exists — skipped");
    return 0;
  }

  // ── 1. CapitalEvent ────────────────────────────────────────────────────────
  const capitalEvent = makeCapitalEvent({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    eventId: CAPITAL_EVENT_ID,
    payload: {
      eventId: CAPITAL_EVENT_ID,
      capitalEventKind: "equity-issuance",
      amount: AMOUNT_MINOR,
      currency: "ZAR",
      effectiveDate: EFFECTIVE_DATE,
      approvedBy: "marc@tgv.co.za",
      notes:
        "Simulated licence-day capital raise. Dr ACC-1200-001 (Standard Bank ZAR nostro) / Cr ACC-5000-001 (Share Capital). Provenance: simulated.",
    },
  });
  capitalEvent.provenance = SIMULATED_PROVENANCE;
  eventStore.append(capitalEvent);
  logger.info(
    { eventId: CAPITAL_EVENT_ID, amountZar: AMOUNT_MINOR / 100 },
    "CapitalEvent emitted — equity-issuance R300m simulated",
  );

  // ── 2. SubLedgerPostingEmitted ─────────────────────────────────────────────
  // Dr ACC-1200-001 (ZAR Nostro — Standard Bank correspondent): asset increases → debit
  // Cr ACC-5000-001 (Share Capital — CET1 paid-up ordinary shares): equity increases → credit
  const glPosting = makeSubLedgerPostingEmitted({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    eventId: POSTING_EVENT_ID,
    payload: {
      sourceEventId: CAPITAL_EVENT_ID,
      postingType: "capital-injection",
      postedAt: AS_OF,
      legs: [
        {
          accountId: "ACC-1200-001",
          debitCredit: "debit",
          amountMinor: AMOUNT_MINOR,
          currency: "ZAR",
        },
        {
          accountId: "ACC-5000-001",
          debitCredit: "credit",
          amountMinor: AMOUNT_MINOR,
          currency: "ZAR",
        },
      ],
    },
  });
  glPosting.provenance = SIMULATED_PROVENANCE;
  eventStore.append(glPosting);
  logger.info(
    { eventId: POSTING_EVENT_ID, debit: "ACC-1200-001", credit: "ACC-5000-001" },
    "SubLedgerPostingEmitted — Dr ACC-1200-001 / Cr ACC-5000-001 R300m simulated",
  );

  return 0;
}

process.exit(main());
