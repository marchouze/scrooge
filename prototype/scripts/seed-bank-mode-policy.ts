// scripts/seed-bank-mode-policy.ts
//
// Idempotent seed of the initial bank-wide provenance policy
// (D-OPERATING-BOOK-PROVENANCE-ARCHITECTURE PR2). Records an explicit
// BankModePolicySet{bankMode:"sim"} with the default per-category granularity so
// the policy is a real, auditable event rather than the implicit built-in
// default. Re-running is a no-op (fixed as_of → recorder idempotency guard).
//
// Author: Scrooge (Chief of Staff / Orchestrator), on behalf of Marc (CEO).

import "../platform/event-store/resolve-event-db-boot";

import { DEFAULT_CATEGORY_POLICY } from "../platform/projections/bank-mode";
import { recordBankModePolicy } from "../runtime/bank-mode/record";

const SEED_AS_OF = "2026-06-03T00:00:00.000Z";

const { eventId, event } = recordBankModePolicy(
  {
    payload: {
      bankMode: "sim",
      categoryPolicy: [...DEFAULT_CATEGORY_POLICY],
      note: "Initial bank-wide provenance policy — build-phase status quo made explicit (sim mode; governance/build production, operations simulated).",
      setBy: "marc@tgv.co.za",
    },
  },
  SEED_AS_OF,
);

console.log(JSON.stringify({ ok: true, eventId, asOf: event.as_of }, null, 2));
