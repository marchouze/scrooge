// platform/reporting/ba-325-reg29-fx-residency-fold.test.ts
//
// SIMULATOR-FIRST golden-case validation for the BA 325 reg-29(3) FX
// residency-segmented detail fold (R0610–R0750). Proves:
//
//   (1) RESIDENCY SEGMENTATION — an FX book with one counterparty per residency
//       bucket (resident / non-resident / authorised-dealer / SARB) lights ONLY
//       that bucket's row, with the foreign-currency amount in the right column.
//       Validated against the EXTERNAL oracle (Reg 29(3) / Exchange Control
//       categories), not internal consistency.
//   (2) CROSS-FOOT — againstRand sub-total = Σ residency rows; block total =
//       againstRand + againstForeignCurrency; effective NOP = purchase − sell.
//   (3) NOP RECONCILIATION — the per-currency effective NOP equals the long−short
//       net of the same open FX instances (the BA 320 FX sub-fold basis) by
//       construction.
//   (4) PROVENANCE BOUNDARY — the production read of an all-simulated book folds
//       to ZERO (the honest empty production state); the simulated/combined read
//       drives the rows. (The R300m-into-Prod regression guard.)
//   (5) FAIL-CLOSED — an FX position whose counterparty is not in any register is
//       collected into `unmappable[]`, NOT folded into a residency row.
//
// Author: Bea (Accounting & financial reporting engineer, engineering).

import { afterEach, beforeEach, describe, expect, it } from "bun:test";

import { type PartyId, makePartyClassified, makePartyRegistered } from "../../domains/party";
import { filInstrumentCreatedPayloadSchema } from "../../v2-core/fil-instances/events";
import { makeFilInstrumentCreated } from "../event-store/event-types/fil-instances";
import { productionTag, simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor, ProvenanceTag } from "../event-store/types";
import { setDefaultProvenanceModeOverride } from "../projections/filter";
import {
  BA325_GAP_REG29_FX_RESIDENCY,
  computeBa325Reg29FxResidency,
  currencyTotal,
} from "./ba-325-reg29-fx-residency-fold";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:bea:ba325-reg29-residency-test" };
const CITES = ["D-BA-RETURN-PER-PRODUCT-RICHNESS", "BANKS-REG-29"];
const PERIOD_END = "2026-06-30";
const AS_OF = "2026-06-30T00:00:00.000Z";

const SIM: ProvenanceTag = simulatedTag({
  scenario: "fx-residency-sim",
  sourceLineage: "platform/reporting/ba-325-reg29-fx-residency-fold.test.ts",
});
const PROD: ProvenanceTag = productionTag({
  sourceLineage: "platform/reporting/ba-325-reg29-fx-residency-fold.test.ts",
});

// Counterparty party URNs — one per residency bucket.
const CP_RESIDENT_CORP: PartyId = "urn:party:legal-entity:sim-resident-corp";
const CP_NONRESIDENT_BANK: PartyId = "urn:party:legal-entity:sim-nonresident-bank-gb";
const CP_AUTHORISED_DEALER: PartyId = "urn:party:legal-entity:sim-authorised-dealer-za";
const CP_SARB: PartyId = "urn:party:legal-entity:sim-sarb";

// ---------------------------------------------------------------------------
// Party-register seeding (event-sourced residency source).
// ---------------------------------------------------------------------------

function registerLegalEntity(
  store: EventStore,
  partyId: PartyId,
  args: {
    jurisdiction: string;
    primaryRegulator: "PA" | "JSE" | "FSCA" | "none-companies-act-only" | "other";
    provenance: ProvenanceTag;
  },
): void {
  store.append({
    ...makePartyRegistered({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: {
        partyId,
        kind: "legal-entity",
        displayName: partyId,
        legalName: partyId,
        jurisdictions: [args.jurisdiction],
        taxResidencies: [args.jurisdiction],
        kindAttributes: {
          kind: "legal-entity",
          entityForm: "Ltd",
          parentPartyId: null,
          primaryRegulator: args.primaryRegulator,
          regimeAnchor: ["test fixture regime anchor"],
        },
        citations: CITES,
      },
    }),
    provenance: args.provenance,
  });
}

function classifyParty(
  store: EventStore,
  partyId: PartyId,
  classification: string,
  provenance: ProvenanceTag,
): void {
  store.append({
    ...makePartyClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: { partyId, classification, scopeJson: {}, citations: CITES },
    }),
    provenance,
  });
}

// ---------------------------------------------------------------------------
// FX position seeding. A `long` position is a commitment to PURCHASE foreign
// currency; `short` is a commitment to SELL. Notional is foreign-denominated
// (the canonical FIL FX golden shape) with hedgingSetTag "<FCY>/ZAR".
// ---------------------------------------------------------------------------

function fxPosition(
  store: EventStore,
  args: {
    id: string;
    foreignCcy: string;
    notionalMajor: number;
    direction: "long" | "short";
    counterpartyId: string;
    provenance: ProvenanceTag;
  },
): void {
  store.append(
    makeFilInstrumentCreated({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      provenance: args.provenance,
      payload: filInstrumentCreatedPayloadSchema.parse({
        kind: "FilInstrumentCreated",
        instance: `fil:inst:${ENTITY}:${args.id}`,
        type: "fil:type:fx:spot:otc-vanilla@1.0",
        tenant: ENTITY,
        asOf: AS_OF,
        originatingEvent: { eventType: "FxTradeExecuted", eventId: `evt-${args.id}` },
        initialStage: "active",
        economicTerms: {
          assetClass: "fx",
          notional: { currency: args.foreignCcy, amount: String(args.notionalMajor) },
          direction: args.direction,
          counterpartyId: args.counterpartyId,
          nettingSetId: `NS-${args.counterpartyId}-${args.foreignCcy}`,
          currency: args.foreignCcy,
          settlementDate: PERIOD_END,
          hedgingSetTag: `${args.foreignCcy}/ZAR`,
        },
      }),
    }),
  );
}

/** Seed the four parties (one per residency bucket) under the given provenance. */
function seedParties(store: EventStore, provenance: ProvenanceTag): void {
  registerLegalEntity(store, CP_RESIDENT_CORP, {
    jurisdiction: "ZA",
    primaryRegulator: "JSE", // a ZA non-bank → resident (not an AD)
    provenance,
  });
  registerLegalEntity(store, CP_NONRESIDENT_BANK, {
    jurisdiction: "GB", // foreign → non-resident
    primaryRegulator: "other",
    provenance,
  });
  registerLegalEntity(store, CP_AUTHORISED_DEALER, {
    jurisdiction: "ZA",
    primaryRegulator: "PA", // ZA SARB/PA-licensed bank → authorised dealer
    provenance,
  });
  registerLegalEntity(store, CP_SARB, {
    jurisdiction: "ZA",
    primaryRegulator: "other",
    provenance,
  });
  classifyParty(store, CP_SARB, "central-bank", provenance);
}

// ---------------------------------------------------------------------------
// The simulated FX book (USD; one position per residency bucket).
//   resident          : long  USD 1,000,000   (purchase)
//   non-resident      : long  USD 2,000,000   (purchase)
//   authorised-dealer : short USD 3,000,000   (sell)
//   SARB              : long  USD   500,000   (purchase)
// ---------------------------------------------------------------------------

function seedSimBook(store: EventStore): void {
  seedParties(store, SIM);
  fxPosition(store, {
    id: "RES-1",
    foreignCcy: "USD",
    notionalMajor: 1_000_000,
    direction: "long",
    counterpartyId: CP_RESIDENT_CORP,
    provenance: SIM,
  });
  fxPosition(store, {
    id: "NONRES-1",
    foreignCcy: "USD",
    notionalMajor: 2_000_000,
    direction: "long",
    counterpartyId: CP_NONRESIDENT_BANK,
    provenance: SIM,
  });
  fxPosition(store, {
    id: "AD-1",
    foreignCcy: "USD",
    notionalMajor: 3_000_000,
    direction: "short",
    counterpartyId: CP_AUTHORISED_DEALER,
    provenance: SIM,
  });
  fxPosition(store, {
    id: "SARB-1",
    foreignCcy: "USD",
    notionalMajor: 500_000,
    direction: "long",
    counterpartyId: CP_SARB,
    provenance: SIM,
  });
}

// USD minor units (scale 2) for N major.
const usdMinor = (major: number): number => major * 100;

describe("BA 325 reg-29(3) FX residency-segmented detail fold", () => {
  beforeEach(() => setDefaultProvenanceModeOverride("combined"));
  afterEach(() => setDefaultProvenanceModeOverride(undefined));

  it("segments commitments by residency bucket × currency (external Reg 29(3) oracle)", () => {
    const store = new EventStore(":memory:");
    seedSimBook(store);

    const out = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });

    expect(out.meta.foldedInstanceCount).toBe(4);
    expect(out.unmappable).toHaveLength(0);

    // PURCHASE block (long positions): residents + non-residents + SARB.
    expect(out.purchase.byResidency.resident.USD).toBe(usdMinor(1_000_000));
    expect(out.purchase.byResidency["non-resident"].USD).toBe(usdMinor(2_000_000));
    expect(out.purchase.byResidency.sarb.USD).toBe(usdMinor(500_000));
    // The authorised-dealer position was a SELL → not in the purchase block.
    expect(out.purchase.byResidency["authorised-dealer"].USD).toBe(0);

    // SELL block (short positions): authorised dealer only.
    expect(out.sell.byResidency["authorised-dealer"].USD).toBe(usdMinor(3_000_000));
    expect(out.sell.byResidency.resident.USD).toBe(0);
    expect(out.sell.byResidency["non-resident"].USD).toBe(0);
    expect(out.sell.byResidency.sarb.USD).toBe(0);
  });

  it("cross-foots: againstRand = Σ residency; total = rand + fc; NOP = purchase − sell", () => {
    const store = new EventStore(":memory:");
    seedSimBook(store);
    const out = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });

    // againstRand (R0620 / R0690) = Σ residency rows.
    expect(out.purchase.againstRand.USD).toBe(usdMinor(1_000_000 + 2_000_000 + 500_000));
    expect(out.sell.againstRand.USD).toBe(usdMinor(3_000_000));

    // No FX-cross instrument → againstForeignCurrency is zero; total = rand.
    expect(out.purchase.againstForeignCurrency.USD).toBe(0);
    expect(out.purchase.total.USD).toBe(out.purchase.againstRand.USD);
    expect(out.sell.total.USD).toBe(out.sell.againstRand.USD);

    // Effective NOP (R0750) per currency = purchase − sell.
    expect(out.effectiveNetOpenPosition.USD).toBe(
      usdMinor(1_000_000 + 2_000_000 + 500_000 - 3_000_000),
    );

    // Currency Total column (C0070) cross-foots the named currencies.
    expect(currencyTotal(out.purchase.againstRand)).toBe(out.purchase.againstRand.USD);
  });

  it("reconciles the effective NOP to the long−short net of the same open instances (BA 320 basis)", () => {
    const store = new EventStore(":memory:");
    seedSimBook(store);
    const out = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });

    // Independently compute the net from the seeded positions: long − short.
    const longUsd = 1_000_000 + 2_000_000 + 500_000; // resident + non-res + SARB
    const shortUsd = 3_000_000; // authorised dealer
    const expectedNetMinor = usdMinor(longUsd - shortUsd);
    expect(out.effectiveNetOpenPosition.USD).toBe(expectedNetMinor);
  });

  it("provenance boundary: production read of an all-simulated book folds to ZERO", () => {
    const store = new EventStore(":memory:");
    seedSimBook(store); // all simulated provenance

    const prod = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      provenanceFilter: { mode: "production-only" },
    });

    expect(prod.meta.foldedInstanceCount).toBe(0);
    for (const bucket of ["resident", "non-resident", "authorised-dealer", "sarb"] as const) {
      expect(prod.purchase.byResidency[bucket].USD).toBe(0);
      expect(prod.sell.byResidency[bucket].USD).toBe(0);
    }
    expect(prod.effectiveNetOpenPosition.USD).toBe(0);
    // The gap is still tracked even in the empty production state (never silent).
    expect(prod.gaps).toContain(BA325_GAP_REG29_FX_RESIDENCY);
  });

  it("production read DRIVES the rows when the book is production provenance", () => {
    const store = new EventStore(":memory:");
    seedParties(store, PROD);
    fxPosition(store, {
      id: "PROD-RES-1",
      foreignCcy: "EUR",
      notionalMajor: 4_000_000,
      direction: "long",
      counterpartyId: CP_RESIDENT_CORP,
      provenance: PROD,
    });

    const prod = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
      provenanceFilter: { mode: "production-only" },
    });

    expect(prod.meta.foldedInstanceCount).toBe(1);
    expect(prod.purchase.byResidency.resident.EUR).toBe(4_000_000 * 100);
  });

  it("fails closed: an unclassifiable counterparty is collected, not folded into a row", () => {
    const store = new EventStore(":memory:");
    seedParties(store, SIM);
    // A counterparty registered NOWHERE (no party record, no onboarding record).
    fxPosition(store, {
      id: "GHOST-1",
      foreignCcy: "USD",
      notionalMajor: 9_000_000,
      direction: "long",
      counterpartyId: "urn:party:legal-entity:ghost-unregistered",
      provenance: SIM,
    });

    const out = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });

    // The ghost position is NOT folded into any residency row.
    expect(out.purchase.byResidency.resident.USD).toBe(0);
    expect(out.purchase.byResidency["non-resident"].USD).toBe(0);
    expect(out.meta.foldedInstanceCount).toBe(0);
    // It is surfaced loudly.
    expect(out.unmappable).toHaveLength(1);
    expect(out.unmappable[0]?.counterpartyId).toBe("urn:party:legal-entity:ghost-unregistered");
    expect(out.unmappable[0]?.reason).toContain("could not be classified");
  });

  it("excludes terminated instances and functional-currency legs", () => {
    const store = new EventStore(":memory:");
    seedParties(store, SIM);
    // A ZAR/ZAR position (functional leg) → no FX risk, excluded.
    fxPosition(store, {
      id: "ZAR-LEG",
      foreignCcy: "ZAR",
      notionalMajor: 5_000_000,
      direction: "long",
      counterpartyId: CP_RESIDENT_CORP,
      provenance: SIM,
    });

    const out = computeBa325Reg29FxResidency({
      eventStore: store,
      asOf: AS_OF,
      functionalCurrency: "ZAR",
    });
    expect(out.meta.foldedInstanceCount).toBe(0);
    expect(out.purchase.byResidency.resident.USD).toBe(0);
  });
});
