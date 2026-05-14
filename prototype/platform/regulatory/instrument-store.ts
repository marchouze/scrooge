// platform/regulatory/instrument-store.ts
//
// Regulatory Instrument Store — thin wrapper over the content-addressed
// document store. Registers regulatory instruments by content hash and
// emits typed events (RegulatoryInstrumentRegistered / RegulatoryInstrumentAmended)
// so the reg-instrument projection can fold state from the event log.
//
// Types will be imported from event-types/regulatory.ts once Mira's PR lands.
// Until then, event payload interfaces are declared inline here.
//
// D-REGULATORY-HORIZON-SCANNING — Anya (Data / analytics engineer, engineering).
// Author: Anya (Data / analytics engineer, engineering)

import { newEventId } from "../core/types";
import type { DocumentHash } from "../document-store/types";
import { defaultDocumentStore } from "../document-store/local-fs";
import { eventStore } from "../composition";
import type { Actor, Event } from "../event-store/types";

// ---------------------------------------------------------------------------
// Stub event-payload types — will be superseded by Mira's
// event-types/regulatory.ts once that PR lands.
// ---------------------------------------------------------------------------

/** Payload emitted when a regulatory instrument is first registered. */
export interface RegulatoryInstrumentRegisteredPayload {
  readonly instrumentId: string;
  readonly title: string;
  readonly issuingBody: string;
  readonly instrumentType: string;
  readonly jurisdiction: string;
  readonly publicationDate: string;
  readonly effectiveDate: string;
  readonly gazetteRef?: string;
  readonly version: string;
  readonly sourceUrl?: string;
  readonly supersedes?: string[];
  readonly contentHash: string;
}

/** Payload emitted when a registered instrument's content changes. */
export interface RegulatoryInstrumentAmendedPayload {
  readonly instrumentId: string;
  readonly previousHash: string;
  readonly contentHash: string;
  readonly version: string;
  readonly amendedAt: string;
  readonly reason?: string;
}

// ---------------------------------------------------------------------------
// Public API types
// ---------------------------------------------------------------------------

export interface InstrumentRegistration {
  readonly instrumentId: string;
  readonly title: string;
  readonly issuingBody: string;
  readonly instrumentType: string;
  readonly jurisdiction: string;
  readonly publicationDate: string;
  readonly effectiveDate: string;
  readonly gazetteRef?: string;
  readonly version: string;
  readonly sourceUrl?: string;
  readonly supersedes?: string[];
}

export interface RegisterInstrumentOpts {
  readonly actor: Actor;
  readonly asOf: string;
  readonly citations: string[];
}

export interface RegisterInstrumentResult {
  readonly contentHash: string;
  readonly isNew: boolean;
}

// ---------------------------------------------------------------------------
// RegulatoryInstrumentStore
// ---------------------------------------------------------------------------

/**
 * Thin wrapper over the content-addressed document store that manages the
 * lifecycle of regulatory instruments.
 *
 * Idempotent: calling `registerInstrument` with the same content and same
 * instrumentId returns `{ isNew: false }` without emitting any event.
 *
 * Amendment: calling `registerInstrument` with a different content for an
 * already-registered instrumentId emits `RegulatoryInstrumentAmended`.
 *
 * D-REGULATORY-HORIZON-SCANNING. Author: Anya.
 */
export class RegulatoryInstrumentStore {
  /**
   * Register or amend a regulatory instrument.
   *
   * Logic:
   *   1. Store content in document store (idempotent) → contentHash.
   *   2. Query event log for any prior `RegulatoryInstrumentRegistered` event
   *      for this instrumentId.
   *   3a. Not registered → emit `RegulatoryInstrumentRegistered`.
   *   3b. Registered with a different hash → emit `RegulatoryInstrumentAmended`.
   *   3c. Registered with the same hash → no-op, return `{ isNew: false }`.
   */
  async registerInstrument(
    content: string,
    registration: InstrumentRegistration,
    opts: RegisterInstrumentOpts,
  ): Promise<RegisterInstrumentResult> {
    // 1. Content-address the document.
    const putResult = defaultDocumentStore.put(content);
    const contentHash = putResult.hash as string;

    // 2. Check for prior registration in the event log.
    const existingHash = await this.getLatestHash(registration.instrumentId);

    if (existingHash === null) {
      // 3a. First registration.
      const event: Event = {
        event_id: newEventId(),
        type: "RegulatoryInstrumentRegistered",
        as_of: opts.asOf,
        entity: "LE-ZA-HOZ-BANK",
        actor: opts.actor,
        citations: opts.citations,
        payload: {
          ...registration,
          supersedes: registration.supersedes ?? [],
          contentHash,
        } satisfies RegulatoryInstrumentRegisteredPayload,
      };
      eventStore.append(event);
      return { contentHash, isNew: true };
    }

    if (existingHash === contentHash) {
      // 3c. Same content — idempotent no-op.
      return { contentHash, isNew: false };
    }

    // 3b. Content has changed — emit amendment.
    const event: Event = {
      event_id: newEventId(),
      type: "RegulatoryInstrumentAmended",
      as_of: opts.asOf,
      entity: "LE-ZA-HOZ-BANK",
      actor: opts.actor,
      citations: opts.citations,
      payload: {
        instrumentId: registration.instrumentId,
        previousHash: existingHash,
        contentHash,
        version: registration.version,
        amendedAt: opts.asOf,
      } satisfies RegulatoryInstrumentAmendedPayload,
    };
    eventStore.append(event);
    return { contentHash, isNew: false };
  }

  /**
   * Fold `RegulatoryInstrumentRegistered` + `RegulatoryInstrumentAmended`
   * events to return the current content hash for an instrument.
   * Returns `null` if the instrument has never been registered.
   */
  async getLatestHash(instrumentId: string): Promise<string | null> {
    let latestHash: string | null = null;

    for (const event of eventStore.replay({})) {
      if (event.type === "RegulatoryInstrumentRegistered") {
        const p = event.payload as RegulatoryInstrumentRegisteredPayload;
        if (p.instrumentId === instrumentId) {
          latestHash = p.contentHash;
        }
      } else if (event.type === "RegulatoryInstrumentAmended") {
        const p = event.payload as RegulatoryInstrumentAmendedPayload;
        if (p.instrumentId === instrumentId) {
          latestHash = p.contentHash;
        }
      }
    }

    return latestHash;
  }

  /**
   * Fetch the current content of a registered instrument.
   * Returns `null` if the instrument is not registered.
   */
  async getContent(instrumentId: string): Promise<string | null> {
    const hash = await this.getLatestHash(instrumentId);
    if (hash === null) return null;

    try {
      const bytes = defaultDocumentStore.get(hash as DocumentHash);
      return new TextDecoder().decode(bytes);
    } catch {
      return null;
    }
  }

  /**
   * Returns true iff a `RegulatoryInstrumentRegistered` event exists for
   * this instrumentId.
   */
  async isRegistered(instrumentId: string): Promise<boolean> {
    const hash = await this.getLatestHash(instrumentId);
    return hash !== null;
  }
}
