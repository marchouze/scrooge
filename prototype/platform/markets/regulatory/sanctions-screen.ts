// platform/markets/regulatory/sanctions-screen.ts
//
// Synchronous counterparty sanctions screen — the reusable core behind the FX
// pre-trade gateway's `sanctions` check and Mira's async sanctions handler.
//
// Build-phase: screens against the local stub blocked list
// (sanctions-list-stub.json). The real UN/OFAC/EU/HMT/POCDATARA feed integrates
// at licence-day via the Sanctions Screening Platform — D-SANCTIONS-SCREENING-
// SUBSTRATE (not yet built); until then this is exact-match on synthetic IDs.
//
// Authority: ORG-FC-08 (POCDATARA), ORG-FC-13 (UN/OFAC/EU/HMT/POCDATARA; RAS B4);
//            D-FX-OTC-NPA-SCOPE-EXPANSION (gateway enforcement).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

interface SanctionsStub {
  readonly blockedCounterpartyIds?: readonly string[];
}

export interface SanctionsScreenResult {
  readonly blocked: boolean;
  readonly matchedId?: string;
  readonly reason?: string;
  readonly citationToRule?: string;
}

let blockedCache: Set<string> | null = null;

function blockedSet(): Set<string> {
  if (blockedCache) return blockedCache;
  const stubPath = resolve(import.meta.dir, "sanctions-list-stub.json");
  const stub = JSON.parse(readFileSync(stubPath, "utf-8")) as SanctionsStub;
  blockedCache = new Set(stub.blockedCounterpartyIds ?? []);
  return blockedCache;
}

/**
 * Screen the supplied counterparty identifier form(s) against the sanctions
 * blocked list. Pass every form available (raw counterparty id + synthetic LEI)
 * so a hit on either blocks. Returns `{ blocked: false }` when clear.
 */
export function screenCounterpartySanctions(
  ids: ReadonlyArray<string | null | undefined>,
): SanctionsScreenResult {
  const blocked = blockedSet();
  for (const id of ids) {
    if (id && blocked.has(id)) {
      return {
        blocked: true,
        matchedId: id,
        reason: `Counterparty ${id} found on sanctions blocked list`,
        citationToRule: "ORG-FC-13",
      };
    }
  }
  return { blocked: false };
}
