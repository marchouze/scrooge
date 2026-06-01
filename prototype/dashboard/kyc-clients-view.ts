// dashboard/kyc-clients-view.ts
//
// Read-side projection surfaces for the KYC client register and KYC checks.
// Wired as:
//   GET /api/kyc/clients         — accepted clients register
//   GET /api/kyc/clients/:id     — single client with KYC checks
//   GET /api/kyc/candidates/:id  — single candidate with KYC checks
//
// Authority chain (Principle 2 upward):
//   D-KYC-ONBOARDING-BUILD (CEO-approved 2026-05-18)
//   AML-CFT-POLICY-V1
//   FIC-ACT-38-2001 — KYC/CDD/EDD statutory root
//
// Authors: Atlas (Core banking platform architect, engineering)

import { nowUtc } from "../platform/core/types";
import type { EventStore } from "../platform/event-store/store";
import { buildPartyProjection } from "../platform/identity/party-projection";
import { LocalProjector } from "../platform/projections";
import { clientsProjection } from "../platform/projections/kyc/clients-projection";
import type { ClientState } from "../platform/projections/kyc/clients-projection";
import { kycChecksProjection } from "../platform/projections/kyc/kyc-checks-projection";
import type { KYCChecksState } from "../platform/projections/kyc/kyc-checks-projection";

// ---------------------------------------------------------------------------
// Clients register view
// ---------------------------------------------------------------------------

/** ClientState enriched with party-register attributes (bic, lei, authorisedProducts). */
export interface EnrichedClientState extends ClientState {
  /** SWIFT BIC-11 from the party register. */
  readonly bic?: string;
  /** ISO 17442 LEI from the party register. */
  readonly lei?: string;
  /** Authorised products from the party register. */
  readonly authorisedProducts?: readonly string[];
  /** FX pair eligibility from the party register. */
  readonly eligibleFxPairs?: readonly string[];
}

export interface KycClientsView {
  readonly asOf: string;
  readonly clients: readonly EnrichedClientState[];
  readonly counts: {
    readonly total: number;
    readonly low: number;
    readonly medium: number;
    readonly high: number;
    readonly ec: number; // Eligible Counterparty
    readonly pc: number; // Professional Client
  };
}

export function buildKycClientsView(store: Pick<EventStore, "replay">): KycClientsView {
  const projector = new LocalProjector(store as EventStore);
  const stateMap = projector.build(clientsProjection);
  // Simulated (build-phase fictitious) entries excluded — they exist in the
  // event store for substrate testing only. The party register is the master;
  // the KYC register shows the onboarded subset.
  const rawClients = [...stateMap.values()].filter((c) => !c.simulated);

  // Enrich each client with party-register attributes (bic, lei, products).
  // The party register is the canonical source — KYC projection provides
  // onboarding status only.
  const partyProjection = buildPartyProjection(store as EventStore);

  const clients: EnrichedClientState[] = rawClients.map((c) => {
    const partyId = c.clientId as `urn:party:legal-entity:${string}`;
    const partyRecord = partyProjection.parties.get(partyId);
    const attrs =
      partyRecord?.kind === "legal-entity" && partyRecord.kindAttributes.kind === "legal-entity"
        ? partyRecord.kindAttributes
        : undefined;
    return {
      ...c,
      ...(attrs?.bic !== undefined ? { bic: attrs.bic } : {}),
      ...(attrs?.lei !== undefined ? { lei: attrs.lei } : {}),
      ...(attrs?.authorisedProducts !== undefined
        ? { authorisedProducts: attrs.authorisedProducts }
        : {}),
      ...(attrs?.eligibleFxPairs !== undefined ? { eligibleFxPairs: attrs.eligibleFxPairs } : {}),
    };
  });

  return {
    asOf: nowUtc(),
    clients,
    counts: {
      total: clients.length,
      low: clients.filter((c) => c.riskBand === "low").length,
      medium: clients.filter((c) => c.riskBand === "medium").length,
      high: clients.filter((c) => c.riskBand === "high").length,
      ec: clients.filter((c) => c.category === "EC").length,
      pc: clients.filter((c) => c.category === "PC").length,
    },
  };
}

// ---------------------------------------------------------------------------
// Single client with KYC checks
// ---------------------------------------------------------------------------

export interface KycClientDetailView {
  readonly asOf: string;
  readonly client: ClientState | null;
  readonly kycChecks: KYCChecksState | null;
}

export function buildKycClientDetailView(
  store: Pick<EventStore, "replay">,
  clientId: string,
): KycClientDetailView {
  const projector = new LocalProjector(store as EventStore);
  const clientsMap = projector.build(clientsProjection);
  const checksMap = projector.build(kycChecksProjection);

  const client = clientsMap.get(clientId) ?? null;
  // KYC checks are keyed by candidateId — for accepted clients we look by clientId
  // (the candidateId and clientId are different; checks may be under candidateId).
  // Fallback: try both keys.
  const kycChecks = checksMap.get(clientId) ?? null;

  return {
    asOf: nowUtc(),
    client,
    kycChecks,
  };
}

// ---------------------------------------------------------------------------
// Single candidate with KYC checks (for in-progress candidates)
// ---------------------------------------------------------------------------

export interface KycCandidateDetailView {
  readonly asOf: string;
  readonly kycChecks: KYCChecksState | null;
}

export function buildKycCandidateDetailView(
  store: Pick<EventStore, "replay">,
  candidateId: string,
): KycCandidateDetailView {
  const projector = new LocalProjector(store as EventStore);
  const checksMap = projector.build(kycChecksProjection);
  const kycChecks = checksMap.get(candidateId) ?? null;

  return {
    asOf: nowUtc(),
    kycChecks,
  };
}
