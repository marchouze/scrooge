// domains/customer/projections.ts
//
// Pure-function projections over the event log. Capability code consumes
// these via the `@platform/projections` runtime — projections are caches
// (Principle 1); the event log is authoritative.
//
// Author: Niko · Anya

import type { Event } from "@platform/event-store/types";
import { type Projection, acceptType } from "@platform/projections";
import {
  CUSTOMER_EVENT_TYPES,
  type CounterpartyId,
  type CounterpartyStatus,
  type DocumentationStatus,
} from "./types";

export interface CounterpartyMasterRecord {
  counterpartyId: CounterpartyId;
  legalName?: string;
  jurisdiction?: string;
  sector?: string;
  currentTier?: "Tier-1" | "Tier-2";
  status: CounterpartyStatus;
}

export type CounterpartyMaster = Record<string, CounterpartyMasterRecord>;

/**
 * Counterparty master projection. Folds the lifecycle events into a
 * key-value record keyed by counterparty id.
 */
export const counterpartyMaster: Projection<CounterpartyMaster, Event> = {
  name: "counterparty-master",
  initial: {},
  accepts: (e): e is Event => (CUSTOMER_EVENT_TYPES as readonly string[]).includes(e.type),
  reduce: (state, e) => {
    const id = e.payload.counterpartyId as CounterpartyId | undefined;
    if (!id) return state;
    const prev: CounterpartyMasterRecord = state[id] ?? { counterpartyId: id, status: "Sounding" };
    const next = { ...prev };
    switch (e.type) {
      case "CounterpartySoundingOpened":
        next.status = "Sounding";
        break;
      case "CounterpartyProspectRegistered":
        next.legalName = e.payload.legalName as string;
        next.jurisdiction = e.payload.jurisdiction as string;
        next.sector = e.payload.sector as string;
        next.status = "Prospect";
        break;
      case "KycCompleted":
        next.currentTier = e.payload.tier as "Tier-1" | "Tier-2";
        next.status = "KycPassed";
        break;
      case "DocumentationReadyToExecute":
        next.status = "DocumentationReady";
        break;
      case "MandateAssigned":
        next.status = "MandateAssigned";
        break;
      case "CounterpartyActivated":
        next.status = "Active";
        break;
      case "CounterpartyOffboarded":
        next.status = "Offboarded";
        break;
      // Other event types do not advance status.
    }
    return { ...state, [id]: next };
  },
};

// ---------------- ISDA negotiation tracker ----------------

export type AgreementKey = `${string}::${string}`; // counterpartyId::agreementType

export type IsdaTracker = Record<AgreementKey, DocumentationStatus>;

function key(counterpartyId: string, agreementType: string): AgreementKey {
  return `${counterpartyId}::${agreementType}` as AgreementKey;
}

export const isdaTracker: Projection<IsdaTracker, Event> = {
  name: "isda-tracker",
  initial: {},
  accepts: (e): e is Event =>
    e.type === "DocumentationDrafted" ||
    e.type === "DocumentationReadyToExecute" ||
    e.type === "CounterpartyActivated",
  reduce: (state, e) => {
    if (e.type === "CounterpartyActivated") {
      // On activation, every Ready agreement transitions to Executed.
      const id = e.payload.counterpartyId as string;
      const next = { ...state };
      for (const k of Object.keys(state) as AgreementKey[]) {
        if (k.startsWith(`${id}::`) && state[k] === "ReadyToExecute") {
          next[k] = "Executed";
        }
      }
      return next;
    }
    const id = e.payload.counterpartyId as string;
    const at = e.payload.agreementType as string;
    const k = key(id, at);
    const status: DocumentationStatus =
      e.type === "DocumentationDrafted" ? "Drafted" : "ReadyToExecute";
    return { ...state, [k]: status };
  },
};

// ---------------- Authorised-signatory book ----------------

export interface SignatoryEntry {
  personId: string;
  scope: "signatory" | "authorised-trader" | "both";
  evidenceRef: string;
}

export type SignatoryBook = Record<string, readonly SignatoryEntry[]>;

export const signatoryBook: Projection<SignatoryBook, Event> = {
  name: "signatory-book",
  initial: {},
  accepts: acceptType<Event>("AuthorisedSignatoryAdded"),
  reduce: (state, e) => {
    const id = e.payload.counterpartyId as string;
    const entry: SignatoryEntry = {
      personId: e.payload.personId as string,
      scope: e.payload.scope as SignatoryEntry["scope"],
      evidenceRef: e.payload.evidenceRef as string,
    };
    const existing = state[id] ?? [];
    return { ...state, [id]: [...existing, entry] };
  },
};
