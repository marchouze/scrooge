// scenarios/01-hello-bank.ts
//
// First end-to-end scenario. Demonstrates Principle 1 (event log as source
// of truth) and Principle 2 (citations on every event). Walks a synthetic
// client through the onboarding gate per
// `Procedures/by-policy/kyc-onboarding.md`.
//
// Run: `bun run scenarios/01-hello-bank.ts`
//
// Author: Atlas (substrate) · Mira (KYC events)

import { eventStore, logger } from "../platform/composition";
import { type Actor, BANK_ZA_001, newEventId, nowUtc } from "../platform/core/types";
import type { Event } from "../platform/event-store/types";

logger.info("scenario 01 — hello bank — starting");

const niko: Actor = { type: "human", id: "niko" };
const idverify: Actor = { type: "service", id: "identity-verification" };
const zara: Actor = { type: "human", id: "zara" };

const candidate_id = "cand-001";
const client_id = "client-001";

const events: Event[] = [
  {
    event_id: newEventId(),
    type: "ClientCandidateRegistered",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: niko,
    citations: ["ORG-FC-02", "FIC-Act-s.21"],
    payload: {
      candidate_id,
      source: "web",
      jurisdiction_tags: { registration: ["ZA"], operating: ["ZA"] },
    },
  },
  {
    event_id: newEventId(),
    type: "ClientIdentityVerified",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: idverify,
    citations: ["ORG-FC-02"],
    payload: { candidate_id, method: "id-document", score: 0.98 },
  },
  {
    event_id: newEventId(),
    type: "KYCRuleEvaluated",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "system", id: "screening-engine" },
    citations: ["ORG-FC-13", "ORG-FC-14", "RAS-B4"],
    payload: { candidate_id, rule: "sanctions-screen", outcome: "no-match" },
  },
  {
    event_id: newEventId(),
    type: "RiskRatingAssigned",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: { type: "system", id: "risk-rater" },
    citations: ["ORG-FC-06", "FIC-GN-7"],
    payload: { candidate_id, rating: "low", basis: "typology" },
  },
  {
    event_id: newEventId(),
    type: "ClientAccepted",
    as_of: nowUtc(),
    entity: BANK_ZA_001,
    actor: zara,
    citations: ["ORG-FC-02", "FIC-Act-s.21", "RAS-B3"],
    payload: { client_id, accepted_at: nowUtc() },
  },
];

eventStore.appendAll(events);

const total = eventStore.count();
logger.info({ total }, "events appended");

logger.info("replay (entity = BANK_ZA_001):");
for (const e of eventStore.replay({ entity: BANK_ZA_001 })) {
  logger.info(
    {
      type: e.type,
      actor: `${e.actor.type}:${e.actor.id}`,
      citations: e.citations,
    },
    `  · ${e.type}`,
  );
}

eventStore.close();
logger.info("scenario 01 — done");
