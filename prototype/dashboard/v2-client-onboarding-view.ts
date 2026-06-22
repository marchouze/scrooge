// dashboard/v2-client-onboarding-view.ts
//
// V2 dashboard view for the born-V2 client (counterparty) onboarding register.
//
// Reads the canonical event store, folds the v2-core onboarding projection over
// the provenance-FILTERED event stream (the +Sim lens admits the simulated
// seed; Prod excludes it → the honest empty state, since the bank has no real
// customers pre-licence-day), and returns NAME-FREE DTOs for the page + API.
//
// NAME-FREEDOM: the onboarding projection carries no agent personal name — the
// only proper nouns are the CLIENT institution names (Standard Bank, JPMorgan
// Chase, …), which are counterparty identities, not internal agent personas, so
// they render verbatim. There is no seat name to mask in this family; the DTOs
// are name-free by construction. (If a future field carried a reviewer SEAT, it
// would be masked via `seatTitle()` per the standing V2-UI rule.)
//
// Authority: D-V1-REMOVAL-PHASE-1; WS-V2-CLIENT-ONBOARDING;
//   D-V2-UI-VISIBILITY-REMEDIATION (Prod/+Sim lens discipline).
// Author: Atlas (Core banking platform architect, engineering).

import type { EventStore } from "../platform/event-store/store";
import {
  type ProvenanceFilter,
  eventMatchesProvenanceFilter,
} from "../platform/projections/filter";
import {
  CLIENT_ONBOARDING_EVENT_KINDS,
  type ClientOnboardingPhase,
  REQUIRED_GATING_PHASES,
  foldClientOnboardingRegister,
} from "../v2-core/client-onboarding";

/** A single onboarded client, name-free (client institution names are not seats). */
export interface ClientOnboardingClientDto {
  readonly counterpartyId: string;
  readonly legalName: string | null;
  readonly jurisdiction: string | null;
  readonly sector: string | null;
  readonly kycTier: string | null;
  readonly faisCategory: string | null;
  readonly phase: ClientOnboardingPhase;
  readonly isTerminal: boolean;
  /** Count of REQUIRED_GATING_PHASES satisfied (for the page's gate column). */
  readonly gatesPassed: number;
  readonly gatesRequired: number;
  readonly lastEventKind: string;
  readonly lastAdvancedAt: string;
}

export interface ClientOnboardingViolationDto {
  readonly counterpartyId: string;
  readonly kind: string;
  readonly message: string;
}

export type ClientOnboardingDataState = "live" | "empty";

export interface ClientOnboardingView {
  readonly clients: readonly ClientOnboardingClientDto[];
  readonly activeCount: number;
  readonly totalCount: number;
  readonly violations: readonly ClientOnboardingViolationDto[];
  readonly dataState: ClientOnboardingDataState;
  readonly reason: string;
  readonly gatesRequired: number;
}

export interface BuildClientOnboardingViewArgs {
  readonly eventStore: EventStore;
  readonly filter: ProvenanceFilter;
}

const GATES_REQUIRED = REQUIRED_GATING_PHASES.length;

/**
 * Build the V2 client-onboarding view. The fold is provenance-aware: only events
 * admitted by `filter` reach the projection, so the Prod lens (which rejects the
 * simulated seed) yields the honest empty state pre-licence-day.
 */
export function buildClientOnboardingView(
  args: BuildClientOnboardingViewArgs,
): ClientOnboardingView {
  const { eventStore, filter } = args;
  const family = new Set<string>(CLIENT_ONBOARDING_EVENT_KINDS);

  const raw: Array<{ kind: string; payload: Record<string, unknown>; asOf: string }> = [];
  for (const ev of eventStore.replay()) {
    if (!family.has(ev.type)) continue;
    if (!eventMatchesProvenanceFilter(ev, filter)) continue;
    raw.push({ kind: ev.type, payload: ev.payload, asOf: ev.as_of });
  }

  const register = foldClientOnboardingRegister(raw);
  const records = register
    .listClients()
    .slice()
    .sort((a, b) => a.counterpartyId.localeCompare(b.counterpartyId));

  const clients: ClientOnboardingClientDto[] = records.map((r) => {
    let gatesPassed = 0;
    for (const g of REQUIRED_GATING_PHASES) {
      if (r.phasesSeen.has(g)) gatesPassed += 1;
    }
    return {
      counterpartyId: r.counterpartyId,
      legalName: r.legalName ?? null,
      jurisdiction: r.jurisdiction ?? null,
      sector: r.sector ?? null,
      kycTier: r.kycTier ?? null,
      faisCategory: r.faisCategory ?? null,
      phase: r.phase,
      isTerminal: r.isTerminal,
      gatesPassed,
      gatesRequired: GATES_REQUIRED,
      lastEventKind: r.lastEventKind,
      lastAdvancedAt: r.lastAdvancedAt,
    };
  });

  const activeCount = clients.filter((c) => c.phase === "activated").length;
  const dataState: ClientOnboardingDataState = clients.length > 0 ? "live" : "empty";
  const includeSimulated = filter.mode === "combined";
  const reason =
    dataState === "empty"
      ? includeSimulated
        ? "No client onboardings folded under the +Sim lens — no simulated onboarding events in this store."
        : "No real clients in the build phase (the bank has no customers pre-licence-day — client onboarding activates at licence-day). Switch to + Sim to view the 15 simulated institutional clients. This is an honest empty state, not a clean zero."
      : "";

  return {
    clients,
    activeCount,
    totalCount: clients.length,
    violations: register.violations.map((v) => ({
      counterpartyId: v.counterpartyId,
      kind: v.kind,
      message: v.message,
    })),
    dataState,
    reason,
    gatesRequired: GATES_REQUIRED,
  };
}

/** Single-client detail (drill-down by counterpartyId). Null if not present. */
export function buildClientOnboardingDetail(
  args: BuildClientOnboardingViewArgs & { counterpartyId: string },
): ClientOnboardingClientDto | null {
  const view = buildClientOnboardingView(args);
  return view.clients.find((c) => c.counterpartyId === args.counterpartyId) ?? null;
}
