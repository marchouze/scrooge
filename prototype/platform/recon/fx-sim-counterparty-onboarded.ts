// platform/recon/fx-sim-counterparty-onboarded.ts
//
// recon:fx-sim-counterparty-onboarded — THE COHERENCE GATE for the FX
// simulator's counterparty source (WS-FX-V2-SIMULATOR-FIRST).
//
// THE INVARIANT: every FX trade the SIMULATOR generates must name a counterparty
// that is an IN-SIM ONBOARDED, ACTIVE, FX-eligible client — i.e. a client that
// reached the terminal `ClientOnboardingActivated` phase carrying a BIC + an
// FX-spot eligibility (the `fxCounterpartiesFromOnboardingRegister` set). A
// simulator FX trade whose counterparty is NOT such a client is a defect: it
// means the sim fell back to a static seed / party-register list instead of the
// onboarded set. (Coherence rule: a client exists only by being onboarded; only
// then is it an FX counterparty. No onboarding → no trading.)
//
// SIMULATOR-AUTHORED TRADES are identified by `payload.venue === "OTC-SIM"` —
// the unique signature the FX sim trade generator stamps (fx-sim-generator.ts).
// Manually-booked / production FX trades use other venues and are out of scope
// for this gate (the production counterparty path is governed elsewhere).
//
// HOW IT RUNS: replay the V1 canonical store, fold the born-V2 onboarding
// register, derive the FX-eligible onboarded set (simulated provenance), then
// assert every `venue:"OTC-SIM"` FxTradeExecuted's `counterparty.partyId` is in
// that set. One assertion per simulator trade. Empty store → asserted=0, ok.
//
// SEVERITY: ADVISORY → ENFORCING. Registered ENFORCING from the start: the
// production wiring already only feeds onboarded clients to the sim, and the
// seed runs the full lifecycle, so a clean CI store has zero simulator trades
// with a non-onboarded counterparty. A violation is a real coherence breach.
//
// ARCHITECTURE NOTE: this gate lives on the v1 side (v1-side infra may check v2
// behaviour; the reverse is forbidden — recon:v2-no-v1-import). It imports the
// v2-core onboarding resolver via the permitted v1→v2 direction and the v1 event
// store via the v1 composition seam.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   WS-FX-V2-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1;
//   brief:atlas:fx-simulator-transacts-with-in-sim-onboarded-cli:2026-06-22.
// Author: Atlas (Core banking platform architect, engineering).

import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  fxCounterpartiesFromOnboardingEvents,
} from "../../v2-core/client-onboarding";
import { eventStore } from "../composition";
import type { EventStore } from "../event-store/store";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "fx-sim-counterparty-onboarded";

/** ENFORCING from the start — the production wiring only feeds onboarded clients. */
const ENFORCING = true;

/** The unique venue tag the FX sim trade generator stamps on every trade. */
export const SIM_FX_TRADE_VENUE = "OTC-SIM";

/** A minimal simulator-trade shape the assertion reasons over. */
export interface SimFxTradeRef {
  /** Trade identifier (for the violation subject). */
  readonly tradeId: string;
  /** The trade's counterparty partyId. */
  readonly counterpartyPartyId: string;
}

// ---------------------------------------------------------------------------
// Pure assertion core (exercised sabotage-proof in the test).
// ---------------------------------------------------------------------------

/**
 * Assert every simulator FX trade's counterparty is in the onboarded FX set.
 * `onboardedPartyIds` is the set of FX-eligible onboarded client ids; `trades`
 * the simulator-authored FX trades. Returns one assertion per trade and a
 * violation for any trade whose counterparty is not onboarded.
 */
export function assertSimTradesOnboarded(
  trades: readonly SimFxTradeRef[],
  onboardedPartyIds: ReadonlySet<string>,
  severity: ReconViolation["severity"],
): { asserted: number; violations: ReconViolation[] } {
  const violations: ReconViolation[] = [];
  for (const t of trades) {
    if (!onboardedPartyIds.has(t.counterpartyPartyId)) {
      violations.push({
        subject: `fx-sim-trade:${t.tradeId}`,
        severity,
        message: `simulator FX trade ${t.tradeId} names counterparty ${t.counterpartyPartyId}, which is NOT an in-sim onboarded, active, FX-eligible client (terminal ClientOnboardingActivated + BIC + FX-spot eligibility). The FX simulator must transact ONLY with onboarded clients — no seed fallback (WS-FX-V2-SIMULATOR-FIRST; D-FX-V2-SIMULATOR-FIRST).`,
      });
    }
  }
  return { asserted: trades.length, violations };
}

// ---------------------------------------------------------------------------
// Store readers.
// ---------------------------------------------------------------------------

/** The set of FX-eligible onboarded (simulated) client partyIds from the store. */
export function onboardedFxPartyIds(store: Pick<EventStore, "replay">): Set<string> {
  const onboarded = fxCounterpartiesFromOnboardingEvents(collectOnboardingEvents(store));
  return new Set(onboarded.map((c) => c.counterpartyId));
}

/** Replay the onboarding family (simulated provenance only) from the store. */
function* collectOnboardingEvents(
  store: Pick<EventStore, "replay">,
): Generator<{ kind: string; payload: Record<string, unknown>; asOf: string }> {
  const family = new Set<string>(CLIENT_ONBOARDING_EVENT_KINDS);
  for (const ev of store.replay()) {
    if (!family.has(ev.type)) continue;
    if (!isSimulated(ev)) continue;
    yield { kind: ev.type, payload: ev.payload, asOf: ev.as_of };
  }
}

/** True when an event carries a `simulated` provenance tag. */
function isSimulated(ev: { provenance?: unknown }): boolean {
  const prov = ev.provenance;
  if (typeof prov !== "object" || prov === null) return false;
  return (prov as { kind?: unknown }).kind === "simulated";
}

/** Every simulator-authored FX trade (venue OTC-SIM) from the store. */
export function simFxTrades(store: Pick<EventStore, "replay">): SimFxTradeRef[] {
  const trades: SimFxTradeRef[] = [];
  for (const ev of store.replay({ type: "FxTradeExecuted" })) {
    const payload = ev.payload as {
      venue?: unknown;
      tradeId?: { value?: unknown } | unknown;
      counterparty?: { partyId?: unknown };
    };
    if (payload.venue !== SIM_FX_TRADE_VENUE) continue; // not simulator-authored.
    const counterpartyPartyId =
      typeof payload.counterparty?.partyId === "string" ? payload.counterparty.partyId : "";
    if (counterpartyPartyId === "") continue; // malformed; out of this gate's scope.
    const tradeId = extractTradeId(payload.tradeId) ?? ev.event_id;
    trades.push({ tradeId, counterpartyPartyId });
  }
  return trades;
}

/** Best-effort trade-id extraction (`{ value }` | string | fallback to event id). */
function extractTradeId(raw: unknown): string | null {
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && raw !== null) {
    const v = (raw as { value?: unknown }).value;
    if (typeof v === "string") return v;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Live run() — reads the V1 canonical event store.
// ---------------------------------------------------------------------------

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const severity: ReconViolation["severity"] = ENFORCING ? "fail" : "warn";

  const onboardedIds = onboardedFxPartyIds(eventStore);
  const trades = simFxTrades(eventStore);
  const { asserted, violations } = assertSimTradesOnboarded(trades, onboardedIds, severity);

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  return result;
}

// ---------------------------------------------------------------------------
// CLI entry point — `bun run recon:fx-sim-counterparty-onboarded`
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = run();
  const label = result.violations.length === 0 ? "OK" : ENFORCING ? "FAIL" : "ADVISORY";
  console.log(`recon:fx-sim-counterparty-onboarded [${label}]`);
  console.log(`  asserted: ${result.asserted}  violations: ${result.violations.length}`);
  for (const v of result.violations) {
    console.warn(`  [${v.severity}] ${v.subject}: ${v.message}`);
  }
  process.exit(result.ok ? 0 : 1);
}
