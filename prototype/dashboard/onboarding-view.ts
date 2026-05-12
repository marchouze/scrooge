// dashboard/onboarding-view.ts
//
// Read-side projection surface for the onboarding board.
// Wired as GET /api/onboarding in dashboard/server.ts.
//
// This thin wrapper injects the real `eventStore` singleton (imported from
// `@platform/composition`) and calls `buildOnboardingBoardView()` from the
// orchestrator. The separation keeps the orchestrator pure (no composition-root
// imports) while giving the server a single import point.
//
// Authority chain (Principle 2 upward):
//   D-PARTY-REGISTER (CEO-approved 2026-05-11)
//   AML-CFT-POLICY-V1 (PR #261)
//   TRADING-MANDATE-V1 (PR #256)
//   FIC-ACT-38-2001 — KYC/CDD statutory root
//
// Author: Atlas (Core banking platform architect, engineering)

import type { EventStore } from "../platform/event-store/store";
import { buildOnboardingBoardView } from "../platform/lifecycle/onboarding-orchestrator";
import type { OnboardingBoardView } from "../platform/lifecycle/onboarding-orchestrator";

/**
 * Build the onboarding board view from the given event store.
 *
 * @param store  A `Pick<EventStore, "replay">` — the real `eventStore` from
 *               `@platform/composition` at the server layer, or a stub in
 *               tests. The orchestrator itself never imports the composition
 *               root.
 * @param nowIso  Optional ISO timestamp for `asOf`. Defaults to `Date.now()`.
 */
export function buildOnboardingView(
  store: Pick<EventStore, "replay">,
  nowIso: string = new Date().toISOString(), // wall-clock: default; pass nowIso for deterministic scenarios
): OnboardingBoardView {
  return buildOnboardingBoardView(store, nowIso);
}
