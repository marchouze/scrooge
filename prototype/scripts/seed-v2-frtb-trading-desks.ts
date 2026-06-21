// scripts/seed-v2-frtb-trading-desks.ts
//
// Idempotent seed — the three FRTB-compliant trading desks (born V2).
//
// Emits one `DeskRegistered` event per canonical desk into the v2 control-plane
// store (the desk register's authoritative host). Events-first (Principle 1):
// the DeskRegistered events ARE the register; the markdown / dashboard render
// is downstream. Each event CITES `D-FRTB-TRADING-DESK-STRUCTURE` as a string —
// it does NOT record the Decision (the Decision is already approved in the
// canonical store; re-recording it in a seed path would trip
// `recon:decision-symmetry`).
//
//   Trading Desk 1  — trading-desk,  trading-book           (FX market-making)
//   Hedging Desk 1  — hedging-desk,  trading-book           (hedges trading-book risk)
//   Treasury Desk 1 — treasury-desk, banking-treasury-book  (funding / ALM / IRRBB)
//
// IDEMPOTENCY: replays the desk register first and skips any desk whose
// `deskId` already has a DeskRegistered event. The payloads are sourced VERBATIM
// from the v2-core canonical roster (`CANONICAL_DESKS`) — the single source the
// FX-trade boundary refinement also resolves against, so seed and refinement
// never diverge. The `effectiveFrom` is a FIXED constant (never `new Date()`)
// so the ci:migrate replay is byte-stable (Engineering Charter — replay-safe).
//
// REPLAY-SAFE EVENT IDS: each desk's event_id is DERIVED from its deskId
// (`urn:desk:...` → `desk-registered:<slug>`) — deterministic, so re-running
// the seed produces the SAME event_id and the store's INSERT-OR-IGNORE keeps it
// idempotent at the row level too.
//
// Usage (default home control-plane store):
//   bun run scripts/seed-v2-frtb-trading-desks.ts
// Override the store path:
//   BANK_V2_CONTROL_PLANE_DB=/tmp/cp.db bun run scripts/seed-v2-frtb-trading-desks.ts
//
// Authority: D-FRTB-TRADING-DESK-STRUCTURE (CEO-approved 2026-06-21);
//   D-FX-BOOK-BOUNDARY; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Brief: brief:atlas:frtb-compliant-trading-desk-structure-simulator-:2026-06-21
// Author: Atlas (Core banking platform architect, engineering).

import {
  defaultControlPlanePath,
  openControlPlaneStore,
} from "../v2-core/control-plane";
import {
  CANONICAL_DESKS,
  DESK_REGISTERED,
  DESK_ROSTER_EFFECTIVE_FROM,
  buildDeskRegister,
} from "../v2-core/desk";

const ENTITY = "control-plane";
const ACTOR = { type: "service" as const, id: "scripts:seed-v2-frtb-trading-desks" };

/** Deterministic event_id derived from the desk URN (replay-safe). */
function deskEventId(deskId: string): string {
  // urn:desk:<kind>:<slug> → desk-registered:<kind>:<slug>
  return `desk-registered:${deskId.replace(/^urn:desk:/, "")}`;
}

const dbPath = defaultControlPlanePath();
console.log(`[seed-v2-frtb-trading-desks] opening control-plane store at: ${dbPath}`);

const store = openControlPlaneStore(dbPath);
let emitted = 0;
try {
  const register = buildDeskRegister(store);

  for (const desk of CANONICAL_DESKS) {
    if (register.getDesk(desk.deskId)) {
      console.log(`[seed-v2-frtb-trading-desks] ${desk.deskId} already registered — skipping.`);
      continue;
    }
    store.append({
      event_id: deskEventId(desk.deskId),
      type: DESK_REGISTERED,
      as_of: DESK_ROSTER_EFFECTIVE_FROM,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...desk.citations],
      payload: { ...desk },
    });
    console.log(
      `[seed-v2-frtb-trading-desks] DeskRegistered emitted: ${desk.deskName} ` +
        `(${desk.deskKind}, ${desk.bookType}-book, head=${desk.deskHeadSeat}).`,
    );
    emitted += 1;
  }
} finally {
  store.close();
}

console.log(
  JSON.stringify({ ok: true, emitted, desks: CANONICAL_DESKS.map((d) => d.deskId) }, null, 2),
);
