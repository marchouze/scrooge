// platform/reporting/cell-value/ba100-leaf-fold.test.ts
//
// Tests for the BA 100 per-cell LEAF FOLD (D-BA-RETURN-CELL-VALUE-ENGINE Phase 1;
// brief brief:bea:ba-100-per-cell-value-leaf-fold-phase-1-pilot-ev:2026-06-27).
//
// The fold reads the BA 100 line values DIRECTLY from the capital FIL events (a
// return and the CoA are SIBLING folds of the same event log) and places them on
// their SARB BA 100 rows. These tests assert:
//   (1) the fold produces the expected per-(row, C0040) leaf values from a
//       synthetic capital event set (CET1 → R0040 cash asset + R0810 share
//       capital; AT1 → R0040 + R0700 capital liability);
//   (2) the generic engine computes the form's subtotals from those leaf values,
//       failing closed (a subtotal stays unresolved while its other inputs are
//       blank — never fabricated);
//   (3) the section sums reconcile to the canonical generateBa100BalanceSheet
//       oracle over the SAME events (the reconciliation invariant the gate asserts);
//   (4) provenance: a production-only lens excludes the simulated capital raise;
//   (5) a bare redemption (FilInstrumentTerminated) posts a zero memo — the stock
//       is unchanged, consistent with the CoA oracle (the reversal is a tracked
//       capital-posting-rule gap, not this fold's concern).
//
// Author: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille (CFO); domain owner of SARB BA 100).

import { describe, expect, test } from "bun:test";

import { COA_ACCOUNTS } from "../../../v2-core/accounting/chart-of-accounts";
import { formatInstanceUrn } from "../../../v2-core/fil-core/urn";
import type {
  FilCapitalSubCategory,
  FilCapitalTier,
  FilInstrumentCreatedPayload,
  FilInstrumentTerminatedPayload,
} from "../../../v2-core/fil-instances/events";
import { CAPITAL_INSTRUMENT_TYPE_URN } from "../../../v2-core/fil-models/capital/types/capital-type-definitions";
import { ba100Contract } from "../../../v2-core/regulatory-returns/ba100-contract";
import { computeDerivedCells } from "../../../v2-core/regulatory-returns/cell-value/engine";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../../event-store/event-types/fil-instances";
import { productionTag, simulatedTag } from "../../event-store/provenance";
import { EventStore } from "../../event-store/store";
import type { Actor } from "../../event-store/types";
import { setDefaultProvenanceModeOverride } from "../../projections/filter";
import { computeTrialBalanceV2 } from "../../projections/gl-projection-v2";
import {
  type Ba100LineClassification,
  generateBa100BalanceSheet,
  isOffBalanceSheetAccountId,
} from "../ba-100-balance-sheet";
import { foldBa100LeafValues } from "./ba100-leaf-fold";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "system", id: "bea:ba100-leaf-fold-test" };
const CITES = ["D-BA-RETURN-CELL-VALUE-ENGINE", "D-CAPITAL-ASSET-CLASS-V1"];
const CCY = "ZAR";
const AS_OF = "2026-06-21T00:00:00.000Z";
const QUERY_AS_OF = "2099-12-31";

const SIM = simulatedTag({
  scenario: "ba100-leaf-fold-test",
  sourceLineage: "bea:ba100-leaf-fold-test",
  tags: ["manual-simulation", "capital-raise"],
});
const PROD = productionTag({ sourceLineage: "bea:ba100-leaf-fold-test" });

function seedCapitalCreated(
  store: EventStore,
  args: {
    instanceId: string;
    amount: string;
    tier: FilCapitalTier;
    subCategory: FilCapitalSubCategory;
    provenance?: typeof SIM | typeof PROD;
  },
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: args.instanceId });
  const payload = {
    kind: "FilInstrumentCreated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalSubscriptionConfirmed",
      eventId: `CAP-${args.instanceId}`,
    },
    initialStage: "active" as const,
    economicTerms: {
      assetClass: "capital" as const,
      notional: { currency: CCY, amount: args.amount },
      direction: "long" as const,
      counterpartyId: "urn:party:capital-provider:founding-subscription",
      nettingSetId: `NS-CAPITAL-${args.tier.toUpperCase()}-${CCY}`,
      currency: CCY,
      settlementDate: AS_OF.slice(0, 10),
      qualifyingCapital: { tier: args.tier, subCategory: args.subCategory },
    },
  };
  const event = makeFilInstrumentCreated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: args.provenance ?? SIM,
    payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
      typeof makeFilInstrumentCreated
    >[0]["payload"],
  });
  store.append(event);
}

function seedCapitalTerminated(
  store: EventStore,
  instanceId: string,
  terminalStage: "settled" | "matured" | "cancelled" | "terminated",
): void {
  const instance = formatInstanceUrn({ tenant: ENTITY, instanceId });
  const payload = {
    kind: "FilInstrumentTerminated" as const,
    instance,
    type: CAPITAL_INSTRUMENT_TYPE_URN,
    tenant: ENTITY,
    asOf: AS_OF,
    originatingEvent: {
      eventType: "CapitalRedemptionConfirmed",
      eventId: `CAP-${instanceId}-term`,
    },
    terminalStage,
  };
  const event = makeFilInstrumentTerminated({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    provenance: SIM,
    payload: payload as unknown as FilInstrumentTerminatedPayload as Parameters<
      typeof makeFilInstrumentTerminated
    >[0]["payload"],
  });
  store.append(event);
}

function fold(store: EventStore, mode: "combined" | "production-only"): Map<string, string> {
  setDefaultProvenanceModeOverride(mode);
  try {
    return new Map(
      foldBa100LeafValues({
        eventStore: store,
        marketData: undefined as never,
        entity: ENTITY,
        asOf: QUERY_AS_OF,
        functionalCurrency: CCY,
      }),
    );
  } finally {
    setDefaultProvenanceModeOverride(undefined);
  }
}

function deriveClassifications(): readonly Ba100LineClassification[] {
  const out: Ba100LineClassification[] = [];
  for (const a of COA_ACCOUNTS) {
    if (isOffBalanceSheetAccountId(a.id)) continue;
    const section = a.category.startsWith("asset")
      ? ("assets" as const)
      : a.category.startsWith("liability")
        ? ("liabilities" as const)
        : a.category.startsWith("equity")
          ? ("equity" as const)
          : null;
    if (section === null) continue;
    out.push({ leafAccountId: a.id, section, lineLabel: `${section}.${a.name}` });
  }
  return out;
}

describe("BA 100 leaf fold — capital FIL → BA 100 rows (sibling fold, events-direct)", () => {
  test("a CET1 raise lights up R0040 (cash) + R0810 (share capital) at C0040", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "CET1-1",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("300000000");
    expect(leaf.get("R0810 C0040")).toBe("300000000");
    // No other row lit up — nothing fabricated.
    expect([...leaf.keys()].sort()).toEqual(["R0040 C0040", "R0810 C0040"]);
  });

  test("the engine computes equity subtotals from the leaf values (cross-foot)", () => {
    const store = new EventStore();
    // CET1 split across all three equity lines so R0800 (equity attributable)
    // resolves fully (R0810 + R0820 + R0830), exercising the engine cross-foot.
    seedCapitalCreated(store, {
      instanceId: "SC",
      amount: "200000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });
    seedCapitalCreated(store, {
      instanceId: "RE",
      amount: "50000000",
      tier: "cet1",
      subCategory: "cet1.retained-earnings",
    });
    seedCapitalCreated(store, {
      instanceId: "SP",
      amount: "50000000",
      tier: "cet1",
      subCategory: "cet1.share-premium",
    });

    const leaf = fold(store, "combined");
    expect(leaf.get("R0810 C0040")).toBe("200000000");
    expect(leaf.get("R0820 C0040")).toBe("50000000");
    expect(leaf.get("R0830 C0040")).toBe("50000000");

    const contract = ba100Contract();
    const derived = computeDerivedCells({ contract, leafValues: leaf, functionalCurrency: CCY });
    const valueAt = (row: string): string | undefined => {
      const cell = contract.cells.find(
        (c) => c.cellRef.row === row && c.cellRef.column === "C0040",
      );
      return cell ? derived.get(cell.cellRef.xsdElement)?.amount : undefined;
    };
    // R0800 = R0810 + R0820 + R0830 = 300,000,000 (all inputs present → resolves).
    expect(valueAt("R0800")).toBe("300000000");
    // R0870 TOTAL EQUITY = R0800 + R0840; R0840 (pref/minority) is blank → R0870
    // stays UNRESOLVED (fail-closed, never zero-filled).
    expect(valueAt("R0870")).toBeUndefined();
  });

  test("an AT1 raise lights up R0040 (cash) + R0700 (qualifying as capital liability)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "AT1-1",
      amount: "75000000",
      tier: "at1",
      subCategory: "at1.perpetual-noncumulative",
    });
    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("75000000");
    expect(leaf.get("R0700 C0040")).toBe("75000000");
  });

  test("the section sums reconcile to the generateBa100BalanceSheet oracle (the gate invariant)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "CET1-RECON",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
    });

    setDefaultProvenanceModeOverride("combined");
    try {
      const leaf = new Map(
        foldBa100LeafValues({
          eventStore: store,
          marketData: undefined as never,
          entity: ENTITY,
          asOf: QUERY_AS_OF,
          functionalCurrency: CCY,
        }),
      );
      // Σ folded asset leaf values (R0040) vs Σ folded equity leaf values (R0810).
      const assetSum = Number(leaf.get("R0040 C0040") ?? "0");
      const equitySum = Number(leaf.get("R0810 C0040") ?? "0");

      const tb = computeTrialBalanceV2({
        eventStore: store,
        entity: ENTITY,
        periodStart: "2026-01-01",
        periodEnd: "2099-12-31",
      });
      const sheet = generateBa100BalanceSheet({
        entity: ENTITY,
        asOf: QUERY_AS_OF,
        periodId: "period:hoz-bank:test",
        functionalCurrency: CCY,
        trialBalance: tb.rows,
        classifications: deriveClassifications(),
        tolerateImbalanceMinor: Number.MAX_SAFE_INTEGER,
      });
      // Oracle totals are minor units; compare in major.
      expect(assetSum).toBe(sheet.assets.totalMinor / 100);
      expect(equitySum).toBe(sheet.equity.totalMinor / 100);
      expect(sheet.liabilities.totalMinor).toBe(0);
    } finally {
      setDefaultProvenanceModeOverride(undefined);
    }
  });

  test("provenance: a production-only lens excludes the simulated capital raise (honest empty state)", () => {
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "SIM-ONLY",
      amount: "300000000",
      tier: "cet1",
      subCategory: "cet1.paid-up-ordinary-shares",
      provenance: SIM,
    });
    expect(fold(store, "production-only").size).toBe(0);
    expect(fold(store, "combined").size).toBe(2);
  });

  test("a bare redemption posts a zero memo — stock unchanged, consistent with the CoA oracle", () => {
    // FilInstrumentTerminated carries NO economic terms, so PR-CAP-REDEEM-003-V2
    // posts a ZERO-AMOUNT memo (a tracked substrate gap in the CAPITAL posting
    // rules — proper reversal needs a richer terminal event; NOT this fold's gap).
    // The leaf fold therefore leaves the stock UNCHANGED on a bare cancellation —
    // exactly as the CoA oracle (which folds the same zero memo) does, so the two
    // sibling folds stay reconciled (never a silent unwind, never a fabricated 0).
    const store = new EventStore();
    seedCapitalCreated(store, {
      instanceId: "REDEEM",
      amount: "100000000",
      tier: "at1",
      subCategory: "at1.perpetual-noncumulative",
    });
    seedCapitalTerminated(store, "REDEEM", "cancelled");

    const leaf = fold(store, "combined");
    expect(leaf.get("R0040 C0040")).toBe("100000000");
    expect(leaf.get("R0700 C0040")).toBe("100000000");
  });

  test("a non-functional-currency capital leg is excluded (licence-day refinement, not silently mixed)", () => {
    const store = new EventStore();
    // A USD CET1 raise — folded onto the USD nostro + share capital, but the
    // build-phase BA 100 reports functional currency (ZAR) only, so a USD leg is
    // excluded (tracked, never silently summed into a ZAR line).
    const instance = formatInstanceUrn({ tenant: ENTITY, instanceId: "USD-CET1" });
    const payload = {
      kind: "FilInstrumentCreated" as const,
      instance,
      type: CAPITAL_INSTRUMENT_TYPE_URN,
      tenant: ENTITY,
      asOf: AS_OF,
      originatingEvent: { eventType: "CapitalSubscriptionConfirmed", eventId: "CAP-USD" },
      initialStage: "active" as const,
      economicTerms: {
        assetClass: "capital" as const,
        notional: { currency: "USD", amount: "10000000" },
        direction: "long" as const,
        counterpartyId: "urn:party:capital-provider:founding-subscription",
        nettingSetId: "NS-CAPITAL-CET1-USD",
        currency: "USD",
        settlementDate: AS_OF.slice(0, 10),
        qualifyingCapital: {
          tier: "cet1" as const,
          subCategory: "cet1.paid-up-ordinary-shares" as const,
        },
      },
    };
    store.append(
      makeFilInstrumentCreated({
        asOf: AS_OF,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITES,
        provenance: SIM,
        payload: payload as unknown as FilInstrumentCreatedPayload as Parameters<
          typeof makeFilInstrumentCreated
        >[0]["payload"],
      }),
    );
    expect(fold(store, "combined").size).toBe(0);
  });
});
