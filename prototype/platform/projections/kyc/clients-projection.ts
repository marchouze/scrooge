// platform/projections/kyc/clients-projection.ts
//
// The `clients` master projection — the authoritative register of accepted
// clients. This projection is the SOLE read surface for "who is a client".
//
// CRITICAL INVARIANT: A client row may ONLY be inserted via a `ClientAccepted`
// event. No other path, no synthesized rows, no manual seeding. This is
// enforced at the projection layer via the `applyClientAccepted` handler which
// is the ONLY reduce branch that calls `insertClient`. All other branches may
// only UPDATE existing rows.
//
// This invariant maps directly to Principle 1 (events are the only source of
// truth) and to the KYC gateway design: ClientAccepted is the only gate that
// marks a candidate as having passed all AML/CDD/EDD checks.
//
// Reduces over: ClientAccepted, ClientRejected, KYCRefreshCompleted,
//               KYCRatingRevised, CounterpartyCategorised.
//
// Authority: D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18);
//   AML-CFT-POLICY-V1; FIC-ACT-38-2001; FAIS-ACT-37-2002.
//
// Authors: Atlas (Core banking platform architect, engineering) +
//   Anya (Data / analytics engineer, engineering).

import type { Event } from "@platform/event-store/types";
import type { Projection } from "../types";

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

/** Risk band for an accepted client. */
export type ClientRiskBand = "low" | "medium" | "high";

/** FAIS counterparty category. */
export type ClientCategory = "EC" | "PC"; // Eligible Counterparty | Professional Client

/** Entity type as recorded at acceptance. */
export type ClientEntityType = "company" | "trust" | "partnership" | "individual-sole-trader";

/** Per-client state folded from the client lifecycle event family. */
export interface ClientState {
  /** Primary key — assigned at ClientAccepted. */
  readonly clientId: string;
  /** Trading name as at acceptance. */
  readonly entityName: string;
  /** Legal form. */
  readonly entityType: ClientEntityType;
  /** Home jurisdiction (ISO 3166-1 alpha-2 or bespoke code). */
  readonly jurisdiction: string;
  /** Current risk band — set at acceptance, updated by KYCRatingRevised. */
  readonly riskBand: ClientRiskBand;
  /** FAIS category — set at acceptance, updated by CounterpartyCategorised. */
  readonly category: ClientCategory;
  /** ISO 8601 date — when the next periodic KYC refresh is due. */
  readonly nextRefreshDue: string | null;
  /** ISO 8601 — ClientAccepted.acceptedAt. */
  readonly onboardedAt: string;
  /** ISO 8601 — most recent update event as_of. */
  readonly lastUpdatedAt: string;
  /**
   * True when this client was onboarded as a simulated counterparty (build-phase
   * FX-sim banks). Simulated clients go through the full KYC event chain but are
   * marked so the UI can show a "sim" badge distinguishing them from real clients.
   */
  readonly simulated: boolean;
  /** KYC candidateId that produced this client — used to correlate ClientRejected tombstones. */
  readonly candidateId?: string;
}

/** Full projection state — Map keyed by clientId. */
export type ClientsProjectionState = Map<string, ClientState>;

// ---------------------------------------------------------------------------
// Accepted event-type list
// ---------------------------------------------------------------------------

const CLIENT_EVENT_TYPES = [
  "ClientAccepted",
  "ClientRejected",
  "KYCRefreshCompleted",
  "KYCRatingRevised",
  "CounterpartyCategorised",
] as const;

type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

function isClientEvent(e: Event): e is Event & { type: ClientEventType } {
  return (CLIENT_EVENT_TYPES as readonly string[]).includes(e.type);
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

/**
 * INVARIANT GUARD — only ClientAccepted may insert a row.
 * Called ONLY from applyClientAccepted.
 */
function insertClient(
  state: ClientsProjectionState,
  clientId: string,
  row: ClientState,
): ClientsProjectionState {
  if (state.has(clientId)) {
    // First-write-wins idempotency: duplicate ClientAccepted is dropped.
    return state;
  }
  const next = new Map(state);
  next.set(clientId, row);
  return next;
}

/**
 * Update an existing client row. Returns original state if client not found
 * (defensive — downstream should only emit update events for existing clients).
 */
function updateClient(
  state: ClientsProjectionState,
  clientId: string,
  update: Partial<Omit<ClientState, "clientId" | "onboardedAt">>,
): ClientsProjectionState {
  const existing = state.get(clientId);
  if (!existing) return state; // no row — defensive drop
  const next = new Map(state);
  next.set(clientId, { ...existing, ...update });
  return next;
}

// ---------------------------------------------------------------------------
// Per-event-type handlers
// ---------------------------------------------------------------------------

function applyClientAccepted(state: ClientsProjectionState, e: Event): ClientsProjectionState {
  const p = e.payload as Record<string, unknown>;
  const clientId = typeof p.clientId === "string" ? p.clientId : undefined;
  const candidateId = typeof p.candidateId === "string" ? p.candidateId : undefined;

  if (!clientId || !candidateId) return state; // malformed — drop

  const entityName = typeof p.entityName === "string" ? p.entityName : "";
  const jurisdiction = typeof p.jurisdiction === "string" ? p.jurisdiction : "";
  const acceptedAt = typeof p.acceptedAt === "string" ? p.acceptedAt : e.as_of;

  const entityType: ClientEntityType =
    p.entityType === "company" ||
    p.entityType === "trust" ||
    p.entityType === "partnership" ||
    p.entityType === "individual-sole-trader"
      ? p.entityType
      : "company";

  const riskBand: ClientRiskBand =
    p.riskBand === "low" || p.riskBand === "medium" || p.riskBand === "high"
      ? p.riskBand
      : "medium";

  const category: ClientCategory = p.category === "EC" || p.category === "PC" ? p.category : "PC";
  const simulated = p.simulated === true;

  // INVARIANT: insertClient is the ONLY function that may create a row.
  return insertClient(state, clientId, {
    clientId,
    candidateId,
    entityName,
    entityType,
    jurisdiction,
    riskBand,
    category,
    nextRefreshDue: null, // set by KYCRefreshCompleted
    onboardedAt: acceptedAt,
    lastUpdatedAt: e.as_of,
    simulated,
  });
}

function applyClientRejected(state: ClientsProjectionState, e: Event): ClientsProjectionState {
  const p = e.payload as Record<string, unknown>;
  const candidateId = typeof p.candidateId === "string" ? p.candidateId : undefined;
  if (!candidateId) return state;
  // Find the client whose candidateId matches (linear scan — small set).
  const entry = [...state.values()].find((c) => c.candidateId === candidateId);
  if (!entry) return state;
  const next = new Map(state);
  next.delete(entry.clientId);
  return next;
}

function applyKYCRefreshCompleted(state: ClientsProjectionState, e: Event): ClientsProjectionState {
  const p = e.payload as Record<string, unknown>;
  const clientId = typeof p.clientId === "string" ? p.clientId : undefined;
  if (!clientId) return state;

  const nextDueDate = typeof p.nextDueDate === "string" ? p.nextDueDate : null;

  return updateClient(state, clientId, {
    nextRefreshDue: nextDueDate,
    lastUpdatedAt: e.as_of,
  });
}

function applyKYCRatingRevised(state: ClientsProjectionState, e: Event): ClientsProjectionState {
  const p = e.payload as Record<string, unknown>;
  const clientId = typeof p.clientId === "string" ? p.clientId : undefined;
  if (!clientId) return state;

  const newBand: ClientRiskBand | undefined =
    p.newBand === "low" || p.newBand === "medium" || p.newBand === "high" ? p.newBand : undefined;

  if (!newBand) return state;

  return updateClient(state, clientId, {
    riskBand: newBand,
    lastUpdatedAt: e.as_of,
  });
}

function applyCounterpartyCategorised(
  state: ClientsProjectionState,
  e: Event,
): ClientsProjectionState {
  const p = e.payload as Record<string, unknown>;
  // CounterpartyCategorised uses partyId which may map to clientId.
  const partyId = typeof p.partyId === "string" ? p.partyId : undefined;
  if (!partyId) return state;

  const category: ClientCategory | undefined =
    p.category === "EC" || p.category === "PC" ? p.category : undefined;
  if (!category) return state; // RC (retail client) not inserted into clients

  return updateClient(state, partyId, {
    category,
    lastUpdatedAt: e.as_of,
  });
}

// ---------------------------------------------------------------------------
// Projection definition
// ---------------------------------------------------------------------------

export const clientsProjection: Projection<ClientsProjectionState> = {
  name: "clients",
  initial: new Map<string, ClientState>(),
  accepts: (e): e is Event => isClientEvent(e),
  reduce(state, event) {
    switch (event.type) {
      case "ClientAccepted":
        return applyClientAccepted(state, event);
      case "ClientRejected":
        return applyClientRejected(state, event);
      case "KYCRefreshCompleted":
        return applyKYCRefreshCompleted(state, event);
      case "KYCRatingRevised":
        return applyKYCRatingRevised(state, event);
      case "CounterpartyCategorised":
        return applyCounterpartyCategorised(state, event);
      default:
        return state;
    }
  },
};
