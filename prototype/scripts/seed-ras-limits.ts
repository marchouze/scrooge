// scripts/seed-ras-limits.ts
//
// Slice 5 — Emit the Helena seed `RasLimitSchedulePublished` event for
// RAS clusters B1–B5. Idempotent: skips if an event with scheduleId
// "RAS-LIMIT-SCHEDULE-SEED-2026-05-14" already exists in the store.
//
// Actor: marc@tgv.co.za (CEO delegation on behalf of Helena CRO)
// recordedVia: scrooge:session-delegation
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION Slice 5
// Citations: ORG-PR-19, ORG-PR-48, GOV-FRAMEWORK-CEO-RESERVED
//
// Run via:  bun run ras:seed-limits
//           (from prototype/)

import { eventStore } from "../platform/composition";
import { newEventId, nowUtc } from "../platform/core/types";
import { makeRasLimitSchedulePublished } from "../platform/event-store/event-types/trading";

const SCHEDULE_ID = "RAS-LIMIT-SCHEDULE-SEED-2026-05-14";
const ENTITY = "LE-ZA-HOZ-BANK";
const AS_OF = "2026-05-14T00:00:00.000Z";

// Check idempotency: has this schedule already been published?
const existing = [...eventStore.replay({ type: "RasLimitSchedulePublished" })].find(
  (e) => (e.payload as { scheduleId?: string }).scheduleId === SCHEDULE_ID,
);

if (existing) {
  console.log(`[seed-ras-limits] Schedule ${SCHEDULE_ID} already exists — skipping.`);
  process.exit(0);
}

const event = makeRasLimitSchedulePublished({
  asOf: AS_OF,
  entity: ENTITY,
  actor: { type: "human", id: "marc@tgv.co.za" },
  citations: ["ORG-PR-19", "ORG-PR-48", "GOV-FRAMEWORK-CEO-RESERVED"],
  payload: {
    scheduleId: SCHEDULE_ID,
    publishedBy: "helena@bank-za.internal",
    effectiveFrom: "2026-05-14",
    limits: [
      {
        cluster: "B1",
        limitName: "Credit risk — counterparty exposure",
        limitValue: 50_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        cluster: "B2",
        limitName: "Credit risk — settlement exposure",
        limitValue: 100_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        cluster: "B3",
        limitName: "Market risk — FX notional",
        limitValue: 200_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        cluster: "B4",
        limitName: "Market risk — IR notional",
        limitValue: 150_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
      {
        cluster: "B5",
        limitName: "Liquidity — intraday",
        limitValue: 500_000_000,
        currency: "ZAR",
        breachThresholdAmber: 0.7,
        breachThresholdRed: 0.9,
      },
    ],
  },
  eventId: newEventId(),
});

eventStore.append(event);
console.log(`[seed-ras-limits] Emitted RasLimitSchedulePublished event_id=${event.event_id}`);
console.log(`[seed-ras-limits] Schedule: ${SCHEDULE_ID} effective from 2026-05-14 (5 clusters)`);
