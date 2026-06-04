// platform/obligations/projection.ts
//
// Bank-obligation register projection (Plane B, D-REGULATORY-ARCHITECTURE-TWO-
// PLANE). The ORG-* obligations register is a PROJECTION over the obligation-
// lifecycle event family — `ObligationAdopted` (origin) folded with
// `ObligationLifecycleTransitioned` (downstream steps). Events are the source
// of truth (Principle 1); the markdown register is a render of this projection.
//
// Pure fold (`buildBankObligations`) for testability + a store-backed loader
// (`loadBankObligations`). `derivesFrom` carries the DERIVES_FROM bridge to the
// source obligations in the reference graph (Plane A).
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type {
  ObligationAdoptedPayload,
  ObligationLifecycleTransitionedPayload,
} from "../event-store/event-types/obligation-lifecycle";
import type { EventStore } from "../event-store/store";
import type { Event } from "../event-store/types";

export interface BankObligation {
  readonly id: string;
  readonly urn: string;
  readonly domain: string;
  readonly citation: string;
  readonly requirement: string;
  readonly fulfilmentPolicy: string;
  readonly owner: string;
  readonly status: string;
  /** Source-obligation URN(s) this bank obligation derives from (DERIVES_FROM). */
  readonly derivesFrom: readonly string[];
  readonly adoptedAt: string;
  /** Most recent lifecycle transition, if any. */
  readonly lastTransition?: { readonly transition: string; readonly at: string };
}

/**
 * Fold obligation-lifecycle events into the current bank-obligation register.
 * `ObligationAdopted` establishes (and, on re-adoption, replaces) an obligation;
 * `ObligationLifecycleTransitioned` advances its status. Events are processed in
 * `as_of` order; ties keep insertion order.
 */
export function buildBankObligations(events: Iterable<Event>): BankObligation[] {
  const ordered = [...events].sort((a, b) => (a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0));
  const byId = new Map<string, BankObligation>();

  for (const ev of ordered) {
    if (ev.type === "ObligationAdopted") {
      const p = ev.payload as ObligationAdoptedPayload;
      byId.set(p.obligationId, {
        id: p.obligationId,
        urn: p.urn,
        domain: p.domain,
        citation: p.citation,
        requirement: p.requirement,
        fulfilmentPolicy: p.fulfilmentPolicy,
        owner: p.owner,
        status: p.status,
        derivesFrom: p.derivesFrom ?? [],
        adoptedAt: p.adoptedAt,
      });
    } else if (ev.type === "ObligationLifecycleTransitioned") {
      const p = ev.payload as ObligationLifecycleTransitionedPayload;
      const existing = byId.get(p.obligationId);
      if (!existing) continue; // transition for an unadopted obligation — skip
      byId.set(p.obligationId, {
        ...existing,
        status: p.toStatus ?? existing.status,
        lastTransition: { transition: p.transition, at: p.at },
      });
    }
  }

  return [...byId.values()].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Load the current bank-obligation register from the event store. */
export function loadBankObligations(store: EventStore): BankObligation[] {
  const events = [
    ...store.replay({ type: "ObligationAdopted" }),
    ...store.replay({ type: "ObligationLifecycleTransitioned" }),
  ];
  return buildBankObligations(events);
}
