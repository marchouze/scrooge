// dashboard/ownership-map-view.ts
//
// Read-side for the coherent Agent ⟺ Domain ⟺ Obligation ownership map
// (D-DOMAIN-OWNERSHIP-MAP). Folds the adopted obligations through the canonical
// `domain-ownership-map.ts` to produce two rollups — by agent and by top-level
// domain — plus the two-axis coverage stats (every obligation owned; every
// domain owned) and the current owner-drift count (authored `owner` vs the
// domain's accountable seat).
//
// Pure derivation (Principle 1): no events, no schema change — the map is the
// single source of truth; this view is a query over it.
//
// Author: Mira (Compliance / RegTech engineer, engineering).

import type { EventStore } from "../platform/event-store/store";
import { loadBankObligations } from "../platform/obligations/projection";
import {
  DOMAIN_OWNERSHIP,
  SEAT_AGENT,
  type Seat,
  classifyObligationDomain,
  ownershipForObligation,
  topLevelDomains,
} from "../platform/regulatory/domain-ownership-map";

export interface OwnershipObligationRef {
  id: string;
  title: string;
  subDomainKey: string;
  subDomainLabel: string;
  /** True when authored `owner` disagrees with the domain's accountable seat. */
  ownerDrift: boolean;
  owner: string;
}

export interface AgentRollup {
  seat: Seat;
  agent: { name: string; position: string };
  subDomains: Array<{ key: string; label: string; topLevel: number; count: number }>;
  obligationCount: number;
}

export interface DomainRollup {
  topLevel: number;
  label: string;
  obligationCount: number;
  accountableAgents: Array<{ seat: Seat; name: string }>;
  subDomains: Array<{ key: string; label: string; seat: Seat; agent: string; count: number }>;
}

export interface OwnershipMapView {
  byAgent: AgentRollup[];
  byDomain: DomainRollup[];
  coverage: {
    totalObligations: number;
    classified: number;
    orphans: number;
    orphanIds: string[];
    ownerDrift: number;
    topLevelDomains: number;
    uncoveredTopLevels: number;
    accountableSeats: number;
  };
}

/** Short obligation NAME (mirrors the bank-obligations list title derivation). */
function obligationTitle(o: { id: string; citation?: string }): string {
  const c = o.citation ?? "";
  if (c && !/^urn:/i.test(c) && c.includes("—")) return c.split("—").pop()?.trim() || o.id;
  if (c && !/^urn:/i.test(c) && c.length <= 60) return c;
  return o.id;
}

export function getOwnershipMapView(store: EventStore): OwnershipMapView {
  const obligations = loadBankObligations(store).filter((o) => o.adopted);

  // Per-sub-domain obligation tally + per-seat tally + drift.
  const subCount = new Map<string, number>();
  const seatCount = new Map<Seat, number>();
  const topCount = new Map<number, number>();
  const orphanIds: string[] = [];
  let ownerDrift = 0;

  for (const o of obligations) {
    const sub = ownershipForObligation(o);
    if (!sub || classifyObligationDomain(o) === null) {
      orphanIds.push(o.id);
      continue;
    }
    subCount.set(sub.key, (subCount.get(sub.key) ?? 0) + 1);
    topCount.set(sub.topLevel, (topCount.get(sub.topLevel) ?? 0) + 1);
    const seat = sub.accountableSeat;
    seatCount.set(seat, (seatCount.get(seat) ?? 0) + 1);
    const owner = (o.owner ?? "").trim();
    if (
      owner &&
      owner !== sub.accountableSeat &&
      !(sub.coAccountableSeats ?? []).includes(owner as Seat)
    ) {
      ownerDrift++;
    }
  }

  // by-agent rollup (accountable seat → its sub-domains + counts).
  const seats = [...new Set(DOMAIN_OWNERSHIP.map((d) => d.accountableSeat))];
  const byAgent: AgentRollup[] = seats
    .map((seat) => {
      const subs = DOMAIN_OWNERSHIP.filter((d) => d.accountableSeat === seat).map((d) => ({
        key: d.key,
        label: d.label,
        topLevel: d.topLevel,
        count: subCount.get(d.key) ?? 0,
      }));
      return {
        seat,
        agent: SEAT_AGENT[seat],
        subDomains: subs,
        obligationCount: subs.reduce((s, x) => s + x.count, 0),
      };
    })
    .sort((a, b) => b.obligationCount - a.obligationCount);

  // by-domain rollup (top-level → sub-domains + accountable agents).
  const byDomain: DomainRollup[] = topLevelDomains().map((t) => {
    const subs = DOMAIN_OWNERSHIP.filter((d) => d.topLevel === t.topLevel).map((d) => ({
      key: d.key,
      label: d.label,
      seat: d.accountableSeat,
      agent: SEAT_AGENT[d.accountableSeat].name,
      count: subCount.get(d.key) ?? 0,
    }));
    return {
      topLevel: t.topLevel,
      label: t.label,
      obligationCount: topCount.get(t.topLevel) ?? 0,
      accountableAgents: t.seats.map((s) => ({ seat: s, name: SEAT_AGENT[s].name })),
      subDomains: subs,
    };
  });

  const tops = topLevelDomains();
  return {
    byAgent,
    byDomain,
    coverage: {
      totalObligations: obligations.length,
      classified: obligations.length - orphanIds.length,
      orphans: orphanIds.length,
      orphanIds,
      ownerDrift,
      topLevelDomains: tops.length,
      // every top-level domain has an accountable seat by construction — this is
      // the structural integrity check for the "an agent owns each domain" axis.
      uncoveredTopLevels: tops.filter((t) => t.seats.length === 0).length,
      accountableSeats: seats.length,
    },
  };
}

/** Obligations owned by one seat, with drift flags — for the agent drill-down. */
export function getSeatObligations(store: EventStore, seat: string): OwnershipObligationRef[] {
  const out: OwnershipObligationRef[] = [];
  for (const o of loadBankObligations(store).filter((x) => x.adopted)) {
    const sub = ownershipForObligation(o);
    if (!sub || sub.accountableSeat !== seat) continue;
    const owner = (o.owner ?? "").trim();
    out.push({
      id: o.id,
      title: obligationTitle(o),
      subDomainKey: sub.key,
      subDomainLabel: sub.label,
      owner,
      ownerDrift:
        !!owner &&
        owner !== sub.accountableSeat &&
        !(sub.coAccountableSeats ?? []).includes(owner as Seat),
    });
  }
  return out.sort((a, b) => (a.id < b.id ? -1 : 1));
}
