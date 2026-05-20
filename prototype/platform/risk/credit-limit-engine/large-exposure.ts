// platform/risk/credit-limit-engine/large-exposure.ts
//
// WS-CREDIT-LIMIT-ENGINE — Large Exposure (LEX) cap check.
//
// Computes counterparty exposure as % of eligible capital and returns the
// status against the constant 25% Banks Act / RRB Reg 23 / D3/2022 cap.
//
//   within — utilisationPct ≤ 20
//   amber  — utilisationPct > 20 and ≤ 25
//   breach — utilisationPct > 25
//
// Connected-group aggregation — per PROC-RISK-CLM-01 §5.3, exposures must
// be aggregated across the connected group (BCBS 283 §15 definition). The
// party-register is the source of group membership; we resolve via the
// `PartyRelationshipAsserted` events (relationshipKind ∈ {"parent-of",
// "subsidiary-of", "affiliate-of"}). If the party-register lookup is
// unavailable (degraded mode), we return per-counterparty results only and
// emit a console warning. The full graph resolver lives at
// `@domains/party` — when its dedicated projection lands, this fallback
// should call into that module.
//
// Substrate gap (queued, follow-on): party-register projection exposes a
// `getConnectedGroup(partyId)` helper. Tracked under
// D-CREDIT-LIMIT-ENGINE-BUILD Phase 4.
//
// Author: Atlas (Core banking platform architect, engineering).

import { type Money, minor } from "../../core/money";
import type { Currency } from "../../core/types";
import { eventStore } from "../../composition";
import { getCurrentExposure } from "./pre-deal-check";
import { listActiveLimits } from "./projection";
import type { LargeExposureCheck } from "./types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LEX_CAP_PCT = 25 as const;
const LEX_AMBER_PCT = 20;

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------

function statusFor(utilisationPct: number): LargeExposureCheck["status"] {
  if (utilisationPct > LEX_CAP_PCT) return "breach";
  if (utilisationPct > LEX_AMBER_PCT) return "amber";
  return "within";
}

function utilisationPercent(exposureMinor: bigint, capitalMinor: bigint): number {
  if (capitalMinor <= 0n) return exposureMinor > 0n ? 1000 : 0;
  const scaled = (exposureMinor * 1000n) / capitalMinor;
  return Math.round(Number(scaled)) / 10;
}

// ---------------------------------------------------------------------------
// Connected-group resolver. Returns the set of counterparty IDs in the same
// connected group as `counterpartyId`, including the counterparty itself.
// On error / unavailable, returns just the counterparty (degraded mode) and
// logs once per call.
//
// We fold PartyRelationshipAsserted events of kinds parent-of, subsidiary-of,
// affiliate-of, ultimate-parent-of. Each event payload carries
// { fromPartyId, toPartyId, relationshipKind }.
// ---------------------------------------------------------------------------

interface PartyRelationshipAssertedPayload {
  fromPartyId?: string;
  toPartyId?: string;
  relationshipKind?: string;
}

const GROUP_KINDS = new Set([
  "parent-of",
  "subsidiary-of",
  "affiliate-of",
  "ultimate-parent-of",
  "controls",
  "controlled-by",
]);

function resolveConnectedGroup(counterpartyId: string, asOf?: string): Set<string> {
  const group = new Set<string>([counterpartyId]);
  try {
    // Build an adjacency list from group-kind relationships.
    const adj = new Map<string, Set<string>>();
    for (const event of eventStore.replay({
      type: "PartyRelationshipAsserted",
      asOf,
    })) {
      const p = event.payload as PartyRelationshipAssertedPayload;
      if (!p.fromPartyId || !p.toPartyId || !p.relationshipKind) continue;
      if (!GROUP_KINDS.has(p.relationshipKind)) continue;
      addEdge(adj, p.fromPartyId, p.toPartyId);
      addEdge(adj, p.toPartyId, p.fromPartyId);
    }
    // BFS from counterpartyId.
    const queue: string[] = [counterpartyId];
    while (queue.length > 0) {
      const node = queue.shift();
      if (!node) break;
      const neighbours = adj.get(node);
      if (!neighbours) continue;
      for (const n of neighbours) {
        if (!group.has(n)) {
          group.add(n);
          queue.push(n);
        }
      }
    }
  } catch (err) {
    // Degraded mode: log once and return singleton group. We don't emit a
    // typed event from a pure helper; the warning surfaces in caller logs.
    // eslint-disable-next-line no-console
    console.warn(
      `[credit-limit-engine] LimitEngineDegradedMode: party-register lookup failed for ${counterpartyId}: ${String(err)}`,
    );
  }
  return group;
}

function addEdge(adj: Map<string, Set<string>>, a: string, b: string): void {
  const existing = adj.get(a) ?? new Set<string>();
  existing.add(b);
  adj.set(a, existing);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * `checkLargeExposure` — compute LEX utilisation for a single counterparty
 * (aggregated across the connected group per BCBS 283 §15).
 *
 * `eligibleCapital` is supplied by the caller (typically the capital-
 * adequacy projection) so this module remains pure.
 */
export function checkLargeExposure(
  counterpartyId: string,
  eligibleCapital: Money,
  asOf?: string,
): LargeExposureCheck {
  const group = resolveConnectedGroup(counterpartyId, asOf);
  const currency = eligibleCapital.currency;

  let totalMinor = 0n;
  for (const member of group) {
    const memberExposure = getCurrentExposure(member, currency, asOf);
    totalMinor += memberExposure.amount;
  }
  const exposure: Money = minor(totalMinor, currency as Currency);
  const utilisationPct = utilisationPercent(totalMinor, eligibleCapital.amount);
  return {
    counterpartyId,
    exposure,
    eligibleCapital,
    utilisationPct,
    capPct: LEX_CAP_PCT,
    status: statusFor(utilisationPct),
  };
}

/**
 * Portfolio-wide LEX check — runs `checkLargeExposure` for every
 * counterparty with a non-zero loaded limit. Used by the daily sweep.
 *
 * Returns one row per counterparty (group head). When a connected group
 * spans multiple counterparties with their own limits, each counterparty
 * row reports the group-aggregate utilisation (which is the correct LEX
 * view per BCBS 283 §15 — the cap applies to the group, not the entity).
 */
export function checkLargeExposureAcrossPortfolio(
  eligibleCapital: Money,
  asOf?: string,
): LargeExposureCheck[] {
  const limits = listActiveLimits(asOf);
  const out: LargeExposureCheck[] = [];
  for (const limit of limits) {
    if (limit.status === "pending") continue;
    out.push(checkLargeExposure(limit.counterpartyId, eligibleCapital, asOf));
  }
  return out;
}
