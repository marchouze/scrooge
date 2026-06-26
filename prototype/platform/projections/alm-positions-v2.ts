// platform/projections/alm-positions-v2.ts
//
// V2-PARALLEL ALM (Asset-Liability Management) position projection.
//
// Folds the V2-parallel money-market lifecycle events (the DepositTakenV2 /
// FundingLineDrawnV2 / InterbankLoanPlacedV2 / RepoTradeOpenedV2 families in
// `repo-mmd-ibl-v2.ts`) into the EXACT SAME return shape as the V1
// `getALMPositionSnapshot()` (`alm-positions.ts`): the `ALMPositionSnapshot`
// interface — HQLA / funding / ASF / RSF position arrays + gaps + buildPhase +
// note. This is the snapshot-shaped V2 read the dashboard ALM / LCR / NSFR route
// consumes; the Phase-3b `recon:ba300-v2-parity` gate only compares a RATIO
// (the LCR denominator), not this snapshot shape.
//
// WHY a dedicated V2 projection (not reuse the V1 fold):
//   - The V1 fold reads MINOR-unit integers (`principalZar`/100, etc.); the V2
//     events carry decimal-native, currency-CARRYING `MoneyWire` amounts
//     (D-V2-CORE-MONEY-DECIMAL-NATIVE). The amount lift is a string→number parse
//     of the MoneyWire major-unit `amount`, NOT money arithmetic.
//   - The V2 events are tagged `v2-parallel` with V2-specific type names
//     (`DepositTakenV2` …), so they are a disjoint stream from the V1 events.
//
// CURRENCY-AGNOSTIC (WS-MULTI-BASE-CURRENCY, #1382): there is NO hardcoded
// reporting / base currency and NO `?? "ZAR"` default (the
// `recon:no-hardcoded-reporting-currency` gate enforces this). The reporting
// currency for the snapshot's `amountZar`-named fields is the HOLDING entity's
// functional currency, resolved fail-closed via `resolveReportingCurrency` +
// asserted via `requireReporting`. Any V2 position whose MoneyWire currency is
// NOT the reporting currency is NOT silently FX-converted into the ratio
// numerator/denominator (no silent cross-currency arithmetic — Charter cmd 2/4);
// it is surfaced as an explicit gap. In build phase there are no V2 MM events,
// so every array is empty (the honest PASS-on-empty shape).
//
// Snapshot-cache: reads through the byte-identical output-snapshot cache, keyed
// the same way the V1 projection keys (entity + horizon + operating-book
// provenance filter), so the V2 read is cache-coherent with the rest of the V2
// dual-read surfaces.
//
// NO v1 imports beyond the shared `platform/` types the V1 projection itself
// uses (this is a `platform/` module, not a `v2-core/` module — the
// `recon:v2-no-v1-import` gate guards `v2-core/`, not `platform/`).
//
// Out of scope (S6): NO flip to `v2-replaced`, NO ratchet change. Snapshot
// wiring only; the flip basis for ALM types is a later slice with its own
// Decision.
//
// Authority: D-BANK-WIDE-V2-MIGRATION (CEO-approved 2026-06-16);
//            D-V1-REMOVAL-PHASE-3B (CEO-approved 2026-06-16);
//            D-ENGINEERING-INTEGRITY-CHARTER;
//            WS-MULTI-BASE-CURRENCY / D-MULTI-BASE-CURRENCY-FOUNDATION;
//            RRTB Regulation 26 (LCR) · 26A (NSFR) · BCBS D238 · D396 ·
//            BA 110 · BA 120.
// Author: Atlas (Core banking platform architect, engineering).

import {
  requireReporting,
  resolveReportingCurrency,
} from "../../v2-core/fil-models/fx-valuation/reporting-currency-resolver";
import type {
  DepositTakenV2Payload,
  FundingLineDrawnV2Payload,
  InterbankLoanPlacedV2Payload,
  RepoTradeOpenedV2Payload,
} from "../event-store/event-types/repo-mmd-ibl-v2";
import type { EventStore } from "../event-store/store";
import { platformFunctionalCurrencyLookup } from "../identity/functional-currency";
import type { FundingPosition, HQLAPosition } from "../liquidity/lcr";
import type { ASFItem, RSFItem } from "../liquidity/nsfr";
import { computeCapitalMetrics } from "./capital-metrics";
import {
  type ProvenanceFilter,
  eventInOperatingBook,
  operatingBookFilter,
  provenanceFilterDigest,
} from "./filter";
import { readWithOutputSnapshot } from "./output-snapshot-cache";

// Re-export the V1 snapshot type — the V2 projection produces the IDENTICAL
// shape field-for-field, so callers (the dashboard route) consume one type.
export type { ALMPositionSnapshot } from "./alm-positions";
import type { ALMPositionSnapshot } from "./alm-positions";

// ---------------------------------------------------------------------------
// Operating-book live-flow view (mirrors alm-positions.ts liveFlowView).
// ---------------------------------------------------------------------------
// The LCR/NSFR the dashboard renders is a BANK ratio (Reg 26 / 26A are
// bank-licence-bound). The V2 fold narrows the replay to a single entity when
// supplied and drops seed scaffolding + sandbox via `eventInOperatingBook` —
// exactly as the V1 projection does — so the V1 and V2 reads see the same
// operating-book population. When `entity` is omitted the behaviour is
// store-wide (legacy parity).
function v2LiveFlowView(store: EventStore, entity?: string): EventStore {
  return new Proxy(store, {
    get(target, prop, receiver) {
      if (prop === "replay") {
        return function* (opts?: Parameters<EventStore["replay"]>[0]) {
          const scoped =
            entity !== undefined ? { ...(opts ?? {}), entity: opts?.entity ?? entity } : opts;
          for (const ev of target.replay(scoped)) {
            if (!eventInOperatingBook(ev)) continue;
            yield ev;
          }
        };
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

// ---------------------------------------------------------------------------
// Reporting-currency resolution (fail-closed; NO `?? "ZAR"`).
// ---------------------------------------------------------------------------
/**
 * Resolve the reporting (functional) currency for the snapshot's amount fields.
 * Store-wide reads (no entity) fall back to the ANCHOR bank's functional
 * currency — itself SOURCED from the entity tree, never a literal — so the
 * store-wide snapshot still carries a sourced reporting currency. Fail-closed:
 * throws (via `resolveReportingCurrency` / `requireReporting`) if unresolved.
 */
function resolveSnapshotReportingCurrency(entity: string | undefined): string {
  // Anchor bank short-id; its functional currency is resolved from the tree.
  const ANCHOR = "LE-ZA-HOZ-BANK";
  const ref = entity ?? ANCHOR;
  const reporting = resolveReportingCurrency(ref, platformFunctionalCurrencyLookup);
  return requireReporting(reporting, `alm-positions-v2 (entity=${ref})`);
}

/** True iff the MoneyWire currency matches the reporting currency. */
function inReportingCurrency(wire: { currency: string }, reporting: string): boolean {
  return wire.currency === reporting;
}

/**
 * MoneyWire major-unit amount string → number, to match the V1 ALM projection's
 * `FundingPosition.amountZar` (an intrinsic JS number `computeLCR`/`computeNSFR`
 * operate on). This is a string→number parse, NOT money arithmetic, so the
 * no-float-money discipline (which targets `Money` multiply/divide) is N/A.
 */
function moneyWireToNumber(wire: { amount: string }): number {
  return Number(wire.amount);
}

// ---------------------------------------------------------------------------
// Public API — getALMPositionSnapshotV2
// ---------------------------------------------------------------------------

export function getALMPositionSnapshotV2(
  eventStore: EventStore,
  asOf: string,
  horizonDays: number,
  entity?: string,
  capitalFilter?: ProvenanceFilter,
): ALMPositionSnapshot {
  // Output-snapshot cache, keyed identically to the V1 projection (entity +
  // horizon + operating-book provenance digest) plus a `:v2` discriminant so the
  // V1 and V2 cache rows never collide. The Tier-1-capital ASF read is the only
  // provenance-sensitive input (the money-market fold is operating-book), so the
  // capital filter's digest rides in the stream key when it narrows the default.
  const capFilter = capitalFilter ?? operatingBookFilter();
  const capDigest = provenanceFilterDigest(capFilter);
  const { output } = readWithOutputSnapshot<ALMPositionSnapshot>({
    store: eventStore,
    streamKey: `alm-positions-v2:${entity ?? "store-wide"}:h${horizonDays}:cap=${capDigest}`,
    asOf,
    provenanceFilter: operatingBookFilter(),
    compute: () => computeALMPositionSnapshotV2(eventStore, asOf, horizonDays, entity, capFilter),
    encode: (o) => JSON.stringify(o),
    decode: (p) => JSON.parse(p) as ALMPositionSnapshot,
  });
  return output;
}

/**
 * Unchanged procedural V2 ALM fold (slow path behind the snapshot cache).
 * Direct callers that want to bypass the cache (e.g. the parity recon) call this.
 */
export function computeALMPositionSnapshotV2(
  eventStore: EventStore,
  asOf: string,
  horizonDays: number,
  entity?: string,
  capitalFilter?: ProvenanceFilter,
): ALMPositionSnapshot {
  const reporting = resolveSnapshotReportingCurrency(entity);
  const store = v2LiveFlowView(eventStore, entity);
  const gaps: string[] = [];
  let crossCurrencySkipped = 0;

  // -------------------------------------------------------------------------
  // Funding fold — DepositTakenV2 / FundingLineDrawnV2 / InterbankLoanPlacedV2.
  // Mirrors buildFundingPositions (V1) but reads MoneyWire amounts.
  // -------------------------------------------------------------------------
  const fundingPositions: FundingPosition[] = [];

  // Deposits — live only (exclude matured / withdrawn-early).
  const closedDeposits = new Set<string>();
  for (const e of store.replay({ type: "DepositMaturedV2" })) {
    if (e.as_of > asOf) continue;
    closedDeposits.add((e.payload as { depositId: string }).depositId);
  }
  for (const e of store.replay({ type: "DepositWithdrawnEarlyV2" })) {
    if (e.as_of > asOf) continue;
    closedDeposits.add((e.payload as { depositId: string }).depositId);
  }
  let depositCount = 0;
  for (const e of store.replay({ type: "DepositTakenV2" })) {
    if (e.as_of > asOf) continue;
    const p = e.payload as unknown as DepositTakenV2Payload;
    if (closedDeposits.has(p.depositId)) continue;
    if (!inReportingCurrency(p.principal, reporting)) {
      crossCurrencySkipped++;
      continue;
    }
    const amountZar = moneyWireToNumber(p.principal);
    if (amountZar <= 0) continue;
    fundingPositions.push({ amountZar, category: p.depositCategory });
    depositCount++;
  }

  // Funding lines — live only (exclude repaid). Wholesale-non-operational (100%).
  const repaidLines = new Set<string>();
  for (const e of store.replay({ type: "FundingLineRepaidV2" })) {
    if (e.as_of > asOf) continue;
    repaidLines.add((e.payload as { fundingLineId: string }).fundingLineId);
  }
  let fundingLineCount = 0;
  for (const e of store.replay({ type: "FundingLineDrawnV2" })) {
    if (e.as_of > asOf) continue;
    const p = e.payload as unknown as FundingLineDrawnV2Payload;
    if (repaidLines.has(p.fundingLineId)) continue;
    if (!inReportingCurrency(p.drawnAmount, reporting)) {
      crossCurrencySkipped++;
      continue;
    }
    const amountZar = moneyWireToNumber(p.drawnAmount);
    if (amountZar <= 0) continue;
    fundingPositions.push({ amountZar, category: "wholesale-non-operational" });
    fundingLineCount++;
  }

  // Interbank placements — live only (exclude matured / recalled). Inflow-contractual.
  const closedIbl = new Set<string>();
  for (const e of store.replay({ type: "InterbankLoanMaturedV2" })) {
    if (e.as_of > asOf) continue;
    closedIbl.add((e.payload as { placementId: string }).placementId);
  }
  for (const e of store.replay({ type: "InterbankLoanRecalledEarlyV2" })) {
    if (e.as_of > asOf) continue;
    closedIbl.add((e.payload as { placementId: string }).placementId);
  }
  const liveIBLs: Array<{ principalZar: number; maturityDate: string | null }> = [];
  let iblCount = 0;
  for (const e of store.replay({ type: "InterbankLoanPlacedV2" })) {
    if (e.as_of > asOf) continue;
    const p = e.payload as unknown as InterbankLoanPlacedV2Payload;
    if (closedIbl.has(p.placementId)) continue;
    if (!inReportingCurrency(p.principal, reporting)) {
      crossCurrencySkipped++;
      continue;
    }
    const amountZar = moneyWireToNumber(p.principal);
    if (amountZar <= 0) continue;
    fundingPositions.push({ amountZar, category: "inflow-contractual" });
    liveIBLs.push({ principalZar: amountZar, maturityDate: p.maturityDate ?? null });
    iblCount++;
  }

  // -------------------------------------------------------------------------
  // HQLA fold — repo start-leg cash (RepoTradeOpenedV2) is unencumbered cash
  // (L1) until the repo is terminated. Mirrors the V1 repo-cash fold. The
  // security-snapshot / bond folds are V1-only event vocabularies (no V2
  // counterpart exists yet) → surfaced as a gap, not silently zeroed.
  // -------------------------------------------------------------------------
  const closedRepos = new Set<string>();
  for (const e of store.replay({ type: "RepoTradeTerminatedV2" })) {
    if (e.as_of > asOf) continue;
    closedRepos.add((e.payload as { tradeId: string }).tradeId);
  }
  for (const e of store.replay({ type: "RepoTradeTerminatedEarlyV2" })) {
    if (e.as_of > asOf) continue;
    closedRepos.add((e.payload as { tradeId: string }).tradeId);
  }
  const hqlaPositions: HQLAPosition[] = [];
  for (const e of store.replay({ type: "RepoTradeOpenedV2" })) {
    if (e.as_of > asOf) continue;
    const p = e.payload as unknown as RepoTradeOpenedV2Payload;
    if (closedRepos.has(p.tradeId)) continue;
    if (!inReportingCurrency(p.startLegCash, reporting)) {
      crossCurrencySkipped++;
      continue;
    }
    const cash = moneyWireToNumber(p.startLegCash);
    if (cash <= 0) continue;
    hqlaPositions.push({ amountZar: cash, tier: "L1" });
  }

  // -------------------------------------------------------------------------
  // ASF / RSF fold — Tier-1 capital (via computeCapitalMetrics, NOT entity-
  // scoped, matching the V1 projection's capital read) + deposits + IBL + HQLA.
  // -------------------------------------------------------------------------
  const asfItems: ASFItem[] = [];
  const asOfDate = new Date(asOf);

  // The Tier-1 ASF read honours the supplied capital provenance lens. Under
  // `production-only` the simulated R300m injection (and the ICAAP build-phase
  // baseline) are excluded, so a Prod-toggled treasury surface does not show a
  // simulated capital ASF as production data. Default = operating-book (legacy
  // callers unchanged). Authority: D-V2-UI-VISIBILITY-REMEDIATION gap #1.
  const capitalMetrics = computeCapitalMetrics(eventStore, asOf, capitalFilter);
  const tier1 = capitalMetrics.availableCapitalMinor / 100;
  if (tier1 > 0) asfItems.push({ amountZar: tier1, category: "tier1-capital" });

  // Deposits → ASF by category + residual maturity (mirrors buildASFItems).
  for (const e of store.replay({ type: "DepositTakenV2" })) {
    if (e.as_of > asOf) continue;
    const p = e.payload as unknown as DepositTakenV2Payload;
    if (closedDeposits.has(p.depositId)) continue;
    if (!inReportingCurrency(p.principal, reporting)) continue;
    const amountZar = moneyWireToNumber(p.principal);
    if (amountZar <= 0) continue;
    const residualDays = Math.floor(
      (new Date(p.maturityDate).getTime() - asOfDate.getTime()) / 86_400_000,
    );
    let category: ASFItem["category"];
    switch (p.depositCategory) {
      case "retail-stable":
        category = residualDays >= 365 ? "wholesale-gt1y" : "retail-stable-lt1y";
        break;
      case "retail-less-stable":
        category = residualDays >= 365 ? "wholesale-gt1y" : "retail-less-stable-lt1y";
        break;
      case "wholesale-operational":
        category = residualDays >= 365 ? "wholesale-gt1y" : "wholesale-lt1y-operational";
        break;
      default:
        category = "wholesale-lt1y-non-operational";
    }
    asfItems.push({ amountZar, category });
  }

  const rsfItems: RSFItem[] = [];
  // HQLA → RSF by tier.
  for (const pos of hqlaPositions) {
    const category: RSFItem["category"] =
      pos.tier === "L1" ? "hqla-l1" : pos.tier === "L2a" ? "hqla-l2a" : "hqla-l2b";
    rsfItems.push({ amountZar: pos.amountZar, category });
  }
  // IBL placements → RSF by residual maturity (mirrors buildRSFItems).
  for (const ibl of liveIBLs) {
    const amountZar = ibl.principalZar;
    if (amountZar <= 0) continue;
    let residualDays: number;
    if (ibl.maturityDate === null) {
      residualDays = 1; // call placement → overnight
    } else {
      residualDays = Math.floor(
        (new Date(ibl.maturityDate).getTime() - asOfDate.getTime()) / 86_400_000,
      );
    }
    const category: RSFItem["category"] = residualDays >= 180 ? "loan-6m-1y" : "loan-lt6m";
    rsfItems.push({ amountZar, category });
  }

  // -------------------------------------------------------------------------
  // Gaps — honest substrate inventory (Charter cmd 5: no silent deferral).
  // -------------------------------------------------------------------------
  gaps.push(
    `V2 ALM snapshot (reporting currency=${reporting}, sourced from the entity tree — no hardcoded ZAR). Folds the V2-parallel money-market lifecycle events (DepositTakenV2 / FundingLineDrawnV2 / InterbankLoanPlacedV2 / RepoTradeOpenedV2). Authority: D-V1-REMOVAL-PHASE-3B.`,
  );
  if (crossCurrencySkipped > 0) {
    gaps.push(
      `${crossCurrencySkipped} V2 money-market position(s) carried a MoneyWire currency other than the reporting currency (${reporting}) and were NOT FX-converted into the LCR/NSFR ratio (no silent cross-currency arithmetic — Charter cmd 2/4). A multi-currency liquidity view requires a rate-feed FX-translation step (deferred; later slice).`,
    );
  }
  gaps.push(
    "CollateralInventorySnapshotted / BondTradeExecuted: no V2-parallel counterpart event vocabulary yet — V2 HQLA is folded from RepoTradeOpenedV2 start-leg cash only (the security-snapshot + bond-inventory HQLA folds remain V1-only). Surfaced, not silently zeroed.",
  );
  gaps.push(
    "BalanceSheetProjected: no V2-parallel counterpart yet — supplemental BA 120 ASF/RSF items (tier-2, retail loans, encumbered assets, OBS) are V1-only. Surfaced.",
  );

  const totalPositionCount =
    hqlaPositions.length + fundingPositions.length + asfItems.length + rsfItems.length;
  const buildPhase = totalPositionCount === 0;

  const note = buildPhase
    ? `Build-phase V2 ALM snapshot at ${asOf} (T+${horizonDays}d): no positions derived from V2 money-market events (the V2 shadow has no live data in build phase). ${gaps.length} substrate gap(s) named. Reporting currency=${reporting}.`
    : `V2 ALM snapshot at ${asOf} (T+${horizonDays}d): ${hqlaPositions.length} HQLA position(s), ${fundingPositions.length} funding position(s) [${depositCount} deposit(s), ${fundingLineCount} funding line(s), ${iblCount} IBL(s)], ${asfItems.length} ASF item(s), ${rsfItems.length} RSF item(s). Reporting currency=${reporting}. ${gaps.length} residual substrate gap(s).`;

  return {
    asOf,
    horizonDays,
    hqlaPositions,
    fundingPositions,
    asfItems,
    rsfItems,
    gaps,
    buildPhase,
    note,
  };
}
