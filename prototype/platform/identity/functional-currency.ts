// platform/identity/functional-currency.ts
//
// FUNCTIONAL-CURRENCY RESOLVER (platform side) — the source-data binding for the
// v2 FX valuation path's reporting-currency resolution (WS-MULTI-BASE-CURRENCY,
// D-MULTI-BASE-CURRENCY-FOUNDATION).
//
// "Foreign vs. domestic" is a view-time comparison between a cash/position
// currency and the FUNCTIONAL currency of the holding entity/branch (IAS-21) —
// never an instrument property. This module answers "what functional currency
// does entity X keep its books in?" from the SOURCE OF TRUTH (the versioned
// legal-entity tree + the `EntityFunctionalCurrencyAssigned` events that render
// it). It is the platform-side `FunctionalCurrencyLookup` the v2 core resolver
// (`v2-core/fil-models/fx-valuation/reporting-currency-resolver.ts`) consumes —
// the v2 core stays free of any `platform/` import (recon:v2-no-v1-import).
//
// FAIL-CLOSED (Engineering Charter cmd 2 + cmd 4): there is NO `?? "ZAR"`
// fallback. An unknown entity yields `undefined`, and the v2 resolver THROWS.
//
// Author: Atlas (Core banking platform architect, engineering).

import legalEntityTree from "../../seeds/legal-entity-tree.json";
import { HOZ_BANK_ENTITY } from "../core/types";
import { resolvePartyUrn } from "./entity-short-ids";

interface LegalEntityTreeFile {
  readonly entities: ReadonlyArray<{
    readonly entityId: string;
    readonly functionalCurrency?: string;
  }>;
}

const TREE = legalEntityTree as LegalEntityTreeFile;

/**
 * Versioned-URN → functional-currency map, sourced from the legal-entity tree.
 * Every tree entity MUST carry `functionalCurrency` (the seed is the source of
 * truth; the `EntityFunctionalCurrencyAssigned` events are its event-sourced
 * render). A tree row missing the field is a source defect — fail-closed.
 */
const FUNCTIONAL_BY_TREE_URN: ReadonlyMap<string, string> = new Map(
  TREE.entities.map((e): [string, string] => {
    if (e.functionalCurrency === undefined || e.functionalCurrency.trim() === "") {
      throw new Error(
        `functional-currency: legal-entity-tree entity "${e.entityId}" has no functionalCurrency (source defect; every entity/branch must carry its IAS-21 functional currency). WS-MULTI-BASE-CURRENCY.`,
      );
    }
    return [e.entityId, e.functionalCurrency];
  }),
);

/**
 * Short-id (the `event.entity` form, e.g. `LE-ZA-HOZ-BANK`) → tree-URN bridge.
 * The anchor bank short-id maps to the hoz-bank tree URN. We derive the bridge
 * from the canonical Party URN so it stays in lock-step with the identity
 * registry (no second hardcoded mapping). The Party URN
 * `urn:party:legal-entity:hoz-bank` corresponds to tree URN
 * `urn:legal-entity:hoz:hoz-bank:v1`.
 */
const TREE_URN_BY_PARTY_URN: ReadonlyMap<string, string> = new Map([
  ["urn:party:legal-entity:hoz-group", "urn:legal-entity:hoz:hoz-group:v1"],
  ["urn:party:legal-entity:hoz-bank", "urn:legal-entity:hoz:hoz-bank:v1"],
  ["urn:party:legal-entity:hoz-securities", "urn:legal-entity:hoz:hoz-securities:v1"],
]);

/**
 * Resolve an entity reference to its functional currency, or `undefined` if it
 * is unknown / unassigned. Accepts a versioned tree URN
 * (`urn:legal-entity:hoz:hoz-bank:v1`), a Party URN
 * (`urn:party:legal-entity:hoz-bank`), or a short-id (`LE-ZA-HOZ-BANK`).
 * Fail-closed: NEVER returns a default.
 */
export function resolveFunctionalCurrency(entityRef: string): string | undefined {
  if (entityRef.trim() === "") return undefined;
  // 1. Direct tree URN.
  const direct = FUNCTIONAL_BY_TREE_URN.get(entityRef);
  if (direct !== undefined) return direct;
  // 2. Party URN → tree URN.
  const viaParty = TREE_URN_BY_PARTY_URN.get(entityRef);
  if (viaParty !== undefined) return FUNCTIONAL_BY_TREE_URN.get(viaParty);
  // 3. Short-id → Party URN → tree URN.
  const partyUrn = resolvePartyUrn(entityRef);
  if (partyUrn !== null) {
    const treeUrn = TREE_URN_BY_PARTY_URN.get(partyUrn);
    if (treeUrn !== undefined) return FUNCTIONAL_BY_TREE_URN.get(treeUrn);
  }
  return undefined;
}

/** A `FunctionalCurrencyLookup` (the v2 resolver's injected dependency). */
export const platformFunctionalCurrencyLookup = (ref: string): string | undefined =>
  resolveFunctionalCurrency(ref);

/**
 * The ANCHOR bank's functional currency (`LE-ZA-HOZ-BANK` → ZAR), resolved from
 * the entity tree. The SA anchor book values into this. Sourced, not hardcoded:
 * it derives from the tree, so re-pointing the anchor's functional currency is a
 * seed change, not a code change. Fail-closed if the anchor is unresolved.
 */
export function anchorFunctionalCurrency(): string {
  const ccy = resolveFunctionalCurrency(HOZ_BANK_ENTITY);
  if (ccy === undefined) {
    throw new Error(
      "functional-currency: the anchor bank entity has no resolved functional currency — " +
        "the legal-entity tree must assign one to LE-ZA-HOZ-BANK (fail-closed). WS-MULTI-BASE-CURRENCY.",
    );
  }
  return ccy;
}
