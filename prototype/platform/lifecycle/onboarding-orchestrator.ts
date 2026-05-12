// platform/lifecycle/onboarding-orchestrator.ts
//
// Pure read-side projection over the customer event log. Folds the 12
// customer event types defined in `domains/customer/types.ts` into a
// per-counterparty lifecycle phase (21 phases; see `OnboardingPhase`).
//
// No event emissions. No writes to the store. No side effects. The
// orchestrator takes a `Pick<EventStore, "replay">` — never the real
// composition-root singleton — so it remains testable in isolation.
//
// Risk taxonomy (Principle 2 — upward chain):
//   RT-FC.ML  (financial crime — money laundering; KYC/CDD gates)
//   RT-FC.SA  (financial crime — sanctions)
//   RT-CR.CP  (credit risk — counterparty)
//   RT-OP.PR  (operational risk — process)
//
// Authority chain (Principle 2 upward):
//   D-PARTY-REGISTER (CEO-approved 2026-05-11)
//     — party identity discipline; all counterpartyId references carry
//       the Party URN discipline via types.ts.
//   AML-CFT-POLICY-V1 (PR #261)
//     — KYC/CDD gate obligations; RT-FC.ML + RT-FC.SA mapping.
//   TRADING-MANDATE-V1 (PR #256)
//     — mandate-scoped and mandate-assigned gate obligations; RT-CR.CP.
//   FIC-ACT-38-2001
//     — Financial Intelligence Centre Act; KYC/CDD statutory root.
//
// Slice 2 — all 21 phases now have backing event types:
//   Phase 3  (fais-categorised)     ← CounterpartyFaisClassified
//   Phase 5  (bo-resolved)          ← BeneficialOwnerResolved
//   Phase 6  (sanctions-cleared)    ← SanctionsClearancePassed
//   Phase 7  (fatca-crs-classified) ← FatcaCrsClassified
//   Phase 8  (popia-recorded)       ← PopiaConsentRecorded
//   Phase 10 (credit-assessed)      ← CreditAssessmentCompleted
//   Phase 16 (accounts-setup)       ← AccountsSetupCompleted
//
// Additional authority (Slice 2):
//   FAIS-ACT-37-2002         — fais-categorised gate (s.45 + GCC s.2(1))
//   POPIA-S11                — popia-recorded gate (processing consent)
//
// Author: Atlas (Core banking platform architect, engineering)

import { CUSTOMER_EVENT_TYPES } from "@domains/customer/types";
// Slice 2 event types are in CUSTOMER_EVENT_TYPES (indices 12–18); the
// fold below maps them to their respective phases via eventToPhaseCandidate.
import type { EventStore } from "@platform/event-store/store";
import type { Event } from "@platform/event-store/types";

// ---------------------------------------------------------------------------
// Post-activation + eligibility event types not yet in CUSTOMER_EVENT_TYPES.
// These are emitted by the rehearsal script and fold here once the event
// store replays them. When they land in CUSTOMER_EVENT_TYPES, delete this.
//   Substrate gap: [substrate-gap: planned, Slice 2 follow-on]
// ---------------------------------------------------------------------------
const SLICE2_EVENT_TYPES: readonly string[] = [
  "CounterpartyMonitoringStarted", // → monitoring              (Phase 18)
  "KycRefreshDue", // → kyc-refresh-due         (Phase 19)
  "CounterpartyEligibilityRevalidated", // → eligibility-revalidated (Phase 20)
  "CounterpartyEligibilityScreened", // → eligibility-screened   (Phase 9, CRM domain)
] as const;

// ---------------------------------------------------------------------------
// Phase type
// ---------------------------------------------------------------------------

/**
 * The 21 phases of the institutional counterparty onboarding lifecycle.
 * Phases advance monotonically except for `MandateRevoked` (regression to
 * `"mandate-scoped"`) and `"offboarded"` which is always terminal.
 */
export type OnboardingPhase =
  | "sounding"
  | "prospect-registered"
  | "fais-categorised"
  | "cdd-initiated"
  | "bo-resolved"
  | "sanctions-cleared"
  | "fatca-crs-classified"
  | "popia-recorded"
  | "eligibility-screened"
  | "credit-assessed"
  | "mandate-scoped"
  | "documentation-drafted"
  | "documentation-ready"
  | "signatories-registered"
  | "mandate-assigned"
  | "accounts-setup"
  | "activated"
  | "monitoring"
  | "kyc-refresh-due"
  | "eligibility-revalidated"
  | "offboarded";

/**
 * Canonical phase ordering for monotonicity enforcement. Lower index =
 * earlier phase. `offboarded` is terminal and overrides any ordering;
 * `activated` is the other terminal that still allows `monitoring` /
 * `kyc-refresh-due` / `eligibility-revalidated` as forward-only extensions.
 */
const PHASE_ORDER: readonly OnboardingPhase[] = [
  "sounding",
  "prospect-registered",
  "fais-categorised",
  "cdd-initiated",
  "bo-resolved",
  "sanctions-cleared",
  "fatca-crs-classified",
  "popia-recorded",
  "eligibility-screened",
  "credit-assessed",
  "mandate-scoped",
  "documentation-drafted",
  "documentation-ready",
  "signatories-registered",
  "mandate-assigned",
  "accounts-setup",
  "activated",
  "monitoring",
  "kyc-refresh-due",
  "eligibility-revalidated",
  "offboarded",
] as const;

function phaseIndex(p: OnboardingPhase): number {
  return PHASE_ORDER.indexOf(p);
}

// ---------------------------------------------------------------------------
// Per-counterparty fold result
// ---------------------------------------------------------------------------

export interface CounterpartyOnboardingState {
  readonly counterpartyId: string;
  readonly phase: OnboardingPhase;
  /** Last event type that advanced the phase. */
  readonly lastEventType: string;
  /** ISO timestamp of last phase advance. */
  readonly lastAdvancedAt: string;
  /** Events seen for this counterparty (count only — not the full payloads). */
  readonly eventCount: number;
  /** True if phase is terminal (activated or offboarded). */
  readonly isTerminal: boolean;
  /** Phase-advance history: [{phase, asOf}] in chronological order. */
  readonly history: ReadonlyArray<{ readonly phase: OnboardingPhase; readonly asOf: string }>;
}

// ---------------------------------------------------------------------------
// Board view
// ---------------------------------------------------------------------------

export interface OnboardingBoardView {
  readonly counterparties: readonly CounterpartyOnboardingState[];
  /** Counts by phase for the dashboard summary tile. */
  readonly phaseCounts: Partial<Record<OnboardingPhase, number>>;
  readonly totalCounterparties: number;
  readonly activeCounterparties: number; // phase === "activated"
  readonly inProgressCounterparties: number; // not terminal, not "sounding"
  readonly asOf: string;
}

// ---------------------------------------------------------------------------
// Internal mutable fold state (never exposed outside this module)
// ---------------------------------------------------------------------------

interface MutableState {
  counterpartyId: string;
  /** Current phase. `null` before the first phase-advancing event. */
  phase: OnboardingPhase | null;
  lastEventType: string;
  lastAdvancedAt: string;
  eventCount: number;
  history: Array<{ phase: OnboardingPhase; asOf: string }>;
}

/**
 * Advance phase only if `candidate` is strictly later in the ordering than
 * the current phase. Returns true if the phase advanced.
 *
 * Special case: `"offboarded"` always wins (terminal override).
 * When the current phase is `null` (no prior phase-advancing event), any
 * candidate unconditionally advances (sets the initial phase).
 * `MandateRevoked` is handled separately in the fold and regresses to
 * `"mandate-scoped"` regardless of ordering.
 */
function tryAdvancePhase(state: MutableState, candidate: OnboardingPhase, asOf: string): boolean {
  if (candidate === "offboarded") {
    // Terminal — always overrides.
    if (state.phase !== "offboarded") {
      state.phase = "offboarded";
      state.lastAdvancedAt = asOf;
      state.history.push({ phase: "offboarded", asOf });
      return true;
    }
    return false;
  }
  // `null` current phase means no prior phase advance — any candidate wins.
  const currentIndex = state.phase === null ? -1 : phaseIndex(state.phase);
  if (phaseIndex(candidate) > currentIndex) {
    state.phase = candidate;
    state.lastAdvancedAt = asOf;
    state.history.push({ phase: candidate, asOf });
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Event-type → phase mapping
// ---------------------------------------------------------------------------

/**
 * Map a single customer event onto a phase candidate. Returns `null` when
 * the event type is not a phase-advance (e.g. `AuthorisedSignatoryRemoved`,
 * `MandateRevised`) — the caller still counts the event but does not change
 * the phase.
 *
 * `MandateRevoked` returns the sentinel `"mandate-scoped"` which the caller
 * applies as a regression regardless of the monotonicity rule.
 */
function eventToPhaseCandidate(eventType: string): OnboardingPhase | null | "REVOKE" {
  switch (eventType) {
    case "CounterpartySoundingOpened":
      return "sounding";
    case "CounterpartyProspectRegistered":
      return "prospect-registered";
    // Slice 2 — FAIS categorisation (Phase 3). Authority: FAIS-ACT-37-2002 s.45.
    case "CounterpartyFaisClassified":
      return "fais-categorised";
    case "KycCompleted":
      // KYC completion maps to cdd-initiated (the CDD process is initiated
      // by the KYC gate). Authority: AML-CFT-POLICY-V1, FIC-ACT-38-2001.
      return "cdd-initiated";
    // Slice 2 — Beneficial-owner resolution (Phase 5). Authority: FIC-ACT-38-2001 s.21B.
    case "BeneficialOwnerResolved":
      return "bo-resolved";
    // Slice 2 — Sanctions clearance (Phase 6). Authority: AML-CFT-POLICY-V1; FAFT Recommendations.
    case "SanctionsClearancePassed":
      return "sanctions-cleared";
    // Slice 2 — FATCA/CRS classification (Phase 7). Authority: IRS IRC §1471–1474; OECD CRS.
    case "FatcaCrsClassified":
      return "fatca-crs-classified";
    // Slice 2 — POPIA consent (Phase 8). Authority: POPIA s.11.
    case "PopiaConsentRecorded":
      return "popia-recorded";
    // Slice 2 — Credit assessment (Phase 10). Authority: RT-CR.CP; TRADING-MANDATE-V1.
    case "CreditAssessmentCompleted":
      return "credit-assessed";
    case "DocumentationDrafted":
      return "documentation-drafted";
    case "DocumentationReadyToExecute":
      return "documentation-ready";
    case "AuthorisedSignatoryAdded":
      return "signatories-registered";
    case "MandateAssigned":
      return "mandate-assigned";
    case "MandateRevoked":
      // Regression sentinel — not a monotonic advance.
      return "REVOKE";
    // Slice 2 — Accounts setup (Phase 16). Authority: RT-OP.PR.
    case "AccountsSetupCompleted":
      return "accounts-setup";
    case "CounterpartyActivated":
      return "activated";
    case "CounterpartyOffboarded":
      return "offboarded";
    // ------------------------------------------------------------------
    // Post-activation phases (Slice 2 monitoring cycle)
    // ------------------------------------------------------------------
    case "CounterpartyMonitoringStarted":
      return "monitoring";
    case "KycRefreshDue":
      return "kyc-refresh-due";
    case "CounterpartyEligibilityRevalidated":
      return "eligibility-revalidated";
    // ------------------------------------------------------------------
    // CounterpartyEligibilityScreened maps to "eligibility-screened"
    // (from the CRM domain — already in the registry; wired here for
    // the 21-phase ordering).
    // ------------------------------------------------------------------
    case "CounterpartyEligibilityScreened":
      return "eligibility-screened";
    default:
      // MandateRevised: keeps the current phase; the mandate is updated in
      // place. Authority: TRADING-MANDATE-V1.
      // AuthorisedSignatoryRemoved: not a phase advance; the phase stays
      // at "signatories-registered" or wherever it currently sits.
      return null;
  }
}

// ---------------------------------------------------------------------------
// Core fold
// ---------------------------------------------------------------------------

/**
 * Fold a sequence of customer events (in chronological order) into a
 * per-counterparty lifecycle state map. The `latest-wins-per-key` projection
 * pattern is keyed on `counterpartyId`.
 *
 * The caller is responsible for yielding events in sequence order. Any event
 * whose `type` is not in `CUSTOMER_EVENT_TYPES` is silently ignored.
 *
 * Risk codes: RT-FC.ML, RT-FC.SA (KYC/CDD/sanctions gates),
 *             RT-CR.CP (mandate/credit gates), RT-OP.PR (process).
 * Citations: D-PARTY-REGISTER, AML-CFT-POLICY-V1, TRADING-MANDATE-V1,
 *            FIC-ACT-38-2001.
 */
export function derivePhaseFromEvents(
  events: Iterable<Event>,
): Map<string, CounterpartyOnboardingState> {
  const customerEventSet = new Set<string>([...CUSTOMER_EVENT_TYPES, ...SLICE2_EVENT_TYPES]);
  const byCounterparty = new Map<string, MutableState>();

  for (const ev of events) {
    // Ignore non-customer events.
    if (!customerEventSet.has(ev.type)) continue;

    const payload = ev.payload as Record<string, unknown>;
    const counterpartyId = typeof payload.counterpartyId === "string" ? payload.counterpartyId : "";
    if (!counterpartyId) continue;

    // Initialise state for first-seen counterparties. Phase starts as `null`
    // so that the first phase-advancing event unconditionally sets it
    // (including `SoundingOpened` → `"sounding"`). See `tryAdvancePhase`.
    let state = byCounterparty.get(counterpartyId);
    if (state === undefined) {
      state = {
        counterpartyId,
        phase: null,
        lastEventType: ev.type,
        lastAdvancedAt: ev.as_of,
        eventCount: 0,
        history: [],
      };
      byCounterparty.set(counterpartyId, state);
    }

    state.eventCount += 1;

    const candidate = eventToPhaseCandidate(ev.type);

    if (candidate === null) {
      // Non-phase-advance event — count only.
      continue;
    }

    if (candidate === "REVOKE") {
      // MandateRevoked regression: force-set to "mandate-scoped" regardless
      // of current phase ordering. Authority: TRADING-MANDATE-V1.
      // (If phase is null — no prior phase-advancing event — still regress
      // to mandate-scoped so the event is not silently dropped.)
      state.phase = "mandate-scoped";
      state.lastEventType = ev.type;
      state.lastAdvancedAt = ev.as_of;
      state.history.push({ phase: "mandate-scoped", asOf: ev.as_of });
      continue;
    }

    // Monotonic advance — only moves forward.
    const advanced = tryAdvancePhase(state, candidate, ev.as_of);
    if (advanced) {
      state.lastEventType = ev.type;
    }
  }

  // Freeze into read-only shape. If a counterparty has only non-phase-advance
  // events (e.g. only MandateRevised or AuthorisedSignatoryRemoved — highly
  // unlikely in practice), the phase stays `null`; we resolve that to
  // `"sounding"` as a safe default.
  const result = new Map<string, CounterpartyOnboardingState>();
  for (const [id, s] of byCounterparty) {
    const phase: OnboardingPhase = s.phase ?? "sounding";
    result.set(id, {
      counterpartyId: s.counterpartyId,
      phase,
      lastEventType: s.lastEventType,
      lastAdvancedAt: s.lastAdvancedAt,
      eventCount: s.eventCount,
      isTerminal: phase === "activated" || phase === "offboarded",
      history: [...s.history],
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Board view builder
// ---------------------------------------------------------------------------

/**
 * Wrap `derivePhaseFromEvents()`, returning an `OnboardingBoardView` that
 * includes phase counts and summary statistics suitable for the dashboard
 * summary tile.
 *
 * The `store` argument is a `Pick<EventStore, "replay">` — never the real
 * composition-root singleton. Pass it from `onboarding-view.ts` which owns
 * the server-side import.
 */
export function buildOnboardingBoardView(
  store: Pick<EventStore, "replay">,
  nowIso: string = new Date().toISOString(), // wall-clock: default; pass nowIso for deterministic scenarios
): OnboardingBoardView {
  // Replay all customer event types in a single pass. The `replay()` method
  // on `EventStore` accepts a `ReplayOpts` filter; we do not filter by type
  // here because we want all customer event types in sequence order and
  // CUSTOMER_EVENT_TYPES has 12 members — a single full replay + in-loop
  // filter is equivalent to 12 separate replays at the build-phase event
  // volumes, and easier to reason about as a single fold.
  const events = store.replay();
  const stateMap = derivePhaseFromEvents(events);

  const counterparties = Array.from(stateMap.values());

  // Build phase counts.
  const phaseCounts: Partial<Record<OnboardingPhase, number>> = {};
  for (const cp of counterparties) {
    phaseCounts[cp.phase] = (phaseCounts[cp.phase] ?? 0) + 1;
  }

  const totalCounterparties = counterparties.length;
  const activeCounterparties = counterparties.filter((c) => c.phase === "activated").length;
  const inProgressCounterparties = counterparties.filter(
    (c) => !c.isTerminal && c.phase !== "sounding",
  ).length;

  return {
    counterparties,
    phaseCounts,
    totalCounterparties,
    activeCounterparties,
    inProgressCounterparties,
    asOf: nowIso,
  };
}
