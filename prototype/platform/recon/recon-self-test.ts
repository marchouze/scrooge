// platform/recon/recon-self-test.ts
//
// Event-store self-test (renamed from harness.ts — F-004 / F-017).
// Asserts the event store can round-trip a synthetic event stream with
// deterministic results. This is NOT a reconciliation pipeline; GL
// trial-balance recon is a separate substrate gap (Atlas §16).
//
// Future: GL trial balance ↔ event-derived balance ↔ sub-ledger projection
// must reconcile to zero on every CI run (Principle 1, Principle 2).
//
// Author: Anya (data / analytics engineer) · Atlas (platform plumbing)

import { unlinkSync } from "node:fs";

import { BANK_ZA_001, newEventId, nowUtc } from "../core/types";
import { EventStore } from "../event-store/store";
import { logger } from "../observability/logger";

const tmp = ".local/recon-self-test.db";
try {
  unlinkSync(tmp);
} catch {
  // first run; nothing to remove
}

const store = new EventStore(tmp);

// F-005: use URN-prefixed citation form to model what real consumers must produce.
const events = Array.from({ length: 100 }, (_, i) => ({
  event_id: newEventId(),
  type: "ReconSynthetic",
  as_of: nowUtc(),
  entity: BANK_ZA_001 as string,
  actor: { type: "system" as const, id: "recon-self-test" },
  citations: ["URN:internal:recon-self-test:v1"],
  payload: { i },
}));

store.appendAll(events);

const replayed = [...store.replay()];
const ok =
  replayed.length === events.length && replayed.every((e, i) => e.event_id === events[i]?.event_id);

store.close();
unlinkSync(tmp);

logger.info(
  { total: events.length, replayed: replayed.length, ok },
  ok ? "Recon self-test passed" : "Recon self-test failed",
);

process.exit(ok ? 0 : 1);
