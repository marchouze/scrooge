// dashboard/forward-obligations-view.ts
//
// Read-side projection surface for the Forward Obligations Register.
// Wired as GET /api/forward-obligations in dashboard/server.ts.
//
// Thin wrapper that injects the real `eventStore` singleton (imported from
// `@platform/composition`) and calls `projectForwardObligations()` from the
// platform module. The separation keeps the projection pure (no
// composition-root imports) while giving the server a single import point.
//
// Authority chain (Principle 2 upward):
//   D-MARKETS-SCHEMA-FOUNDATION — schema-foundation authority
//   TRADING-MANDATE-V1 (PR #256) — trading / settlement obligations
//   P1-EVENTS-ARE-TRUTH — events are canonical; projection is a query
//   ORG-MK-10 — BA returns obligation in the obligations register
//
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../platform/event-store/store";
import { projectForwardObligations } from "../platform/forward-obligations/projection";
import type { ForwardObligationsBoardView } from "../platform/forward-obligations/types";

/**
 * Build the forward-obligations board view from the given event store.
 *
 * @param store  A `Pick<EventStore, "replay">` — the real `eventStore` from
 *               `@platform/composition` at the server layer, or a stub in
 *               tests. The projection itself never imports the composition root.
 * @param asOf   Optional point-in-time. Defaults to `new Date()`.
 */
export function getForwardObligationsView(
  store: Pick<EventStore, "replay">,
  asOf?: Date,
): ForwardObligationsBoardView {
  return projectForwardObligations(store, asOf);
}
