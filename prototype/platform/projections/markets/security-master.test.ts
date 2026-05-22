// platform/projections/markets/security-master.test.ts
//
// Unit tests for the SecurityMaster projection.
//
// Covers:
//   1. FinancialInstrumentDefined creates a row with all fields populated.
//   2. FinancialInstrumentDefined with isin populates isinToInstrumentId index.
//   3. FinancialInstrumentClassified updates classification fields on existing row.
//   4. Second FinancialInstrumentClassified overwrites the first (latest-wins).
//   5. FinancialInstrumentDecomposed sets decomposedIntoChildIds on parent.
//   6. FinancialInstrumentReconstituted clears decomposedIntoChildIds.
//   7. Unknown event types leave state unchanged.
//   8. FinancialInstrumentClassified for unknown instrumentId is a no-op.
//
// Note: contractTerms use minimal valid values per per-type ACTUS field
// validation added in Slice 5 (.superRefine on the payload schemas).
//
// Authority: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22).
// Author: Anya (Data / Analytics Engineer, engineering)
//   per brief:anya:d-financial-instrument-entity-slice-3-securityma:2026-05-22

import { describe, expect, it } from "bun:test";

import type { Event } from "../../event-store/types";
import {
  makeFinancialInstrumentClassified,
  makeFinancialInstrumentDecomposed,
  makeFinancialInstrumentDefined,
  makeFinancialInstrumentReconstituted,
} from "../../markets/cdm/instrument";
import { securityMasterInitial, securityMasterProjection } from "./security-master";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:kai:instrument-registry" };
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-V1-1"];
const AS_OF = "2026-05-22T09:00:00.000Z";
const LEGAL_ENTITY_ID = "LE-ZA-HOZ-BANK";

// ---------------------------------------------------------------------------
// Fold helpers
// ---------------------------------------------------------------------------

function fold(events: Event[]) {
  return events.reduce(
    (state, event) =>
      securityMasterProjection.accepts(event)
        ? securityMasterProjection.reduce(state, event)
        : state,
    securityMasterInitial,
  );
}

// ---------------------------------------------------------------------------
// Fixture factories
// ---------------------------------------------------------------------------

/** PAM (Principal at Maturity) bond with ISIN — representative of ZAG government bonds. */
function makeBondDefined(instrumentId = "fi:bond:ZAG000149017", isin = "ZAG000149017") {
  return makeFinancialInstrumentDefined({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentId,
      actusContractType: "PAM",
      instrumentSubtype: "decomposable",
      isin,
      cfiCode: "DBFNFR",
      issuerLei: "378900DATFB3JVOZL433",
      currency: "ZAR",
      jurisdiction: "ZA",
      legalEntityId: LEGAL_ENTITY_ID,
      maturityDate: "2030-01-31",
      // PAM requires nominalInterestRate, dayCountConvention, paymentFrequency
      contractTerms: {
        nominalInterestRate: 0.085,
        dayCountConvention: "ACT/365",
        paymentFrequency: "semi-annual",
      },
    },
  });
}

/** STK (Stock) equity — representative of JSE-listed share. */
function makeEquityDefined(instrumentId = "fi:equity:JSE:SOL") {
  return makeFinancialInstrumentDefined({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentId,
      actusContractType: "STK",
      instrumentSubtype: "atomic",
      isin: "ZAE000012084",
      cfiCode: "ESVUFR",
      issuerLei: "378900SOLBE1JVOZL001",
      currency: "ZAR",
      jurisdiction: "ZA",
      legalEntityId: LEGAL_ENTITY_ID,
      maturityDate: undefined,
      // STK requires dividendFrequency
      contractTerms: { dividendFrequency: "annual" },
    },
  });
}

/** CSH (Cash) instrument — ZAR central-bank reserves. No ISIN, no productRef. */
function makeCashDefined(instrumentId = "fi:csh:ZAR") {
  return makeFinancialInstrumentDefined({
    asOf: AS_OF,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentId,
      actusContractType: "CSH",
      instrumentSubtype: "atomic",
      currency: "ZAR",
      jurisdiction: "ZA",
      legalEntityId: LEGAL_ENTITY_ID,
      // CSH has no mandatory contractTerms fields
      contractTerms: {},
    },
  });
}

// ---------------------------------------------------------------------------
// 1. FinancialInstrumentDefined creates a row with all fields populated
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — FinancialInstrumentDefined", () => {
  it("creates a row with all fields populated for a PAM bond", () => {
    const state = fold([makeBondDefined()]);

    const row = state.instruments.get("fi:bond:ZAG000149017");
    expect(row).toBeDefined();
    expect(row?.instrumentId).toBe("fi:bond:ZAG000149017");
    expect(row?.actusContractType).toBe("PAM");
    expect(row?.instrumentSubtype).toBe("decomposable");
    expect(row?.isin).toBe("ZAG000149017");
    expect(row?.cfiCode).toBe("DBFNFR");
    expect(row?.issuerLei).toBe("378900DATFB3JVOZL433");
    expect(row?.currency).toBe("ZAR");
    expect(row?.jurisdiction).toBe("ZA");
    expect(row?.legalEntityId).toBe(LEGAL_ENTITY_ID);
    expect(row?.maturityDate).toBe("2030-01-31");
    expect(row?.contractTerms).toEqual({
      nominalInterestRate: 0.085,
      dayCountConvention: "ACT/365",
      paymentFrequency: "semi-annual",
    });
    expect(row?.eventCount).toBe(1);
  });

  it("creates a row for a CSH instrument with only required fields (no isin, no productRef, no maturityDate)", () => {
    const state = fold([makeCashDefined()]);

    const row = state.instruments.get("fi:csh:ZAR");
    expect(row).toBeDefined();
    expect(row?.actusContractType).toBe("CSH");
    expect(row?.isin).toBeUndefined();
    expect(row?.productRef).toBeUndefined();
    expect(row?.maturityDate).toBeUndefined();
    expect(row?.issuerLei).toBeUndefined();
  });

  it("classification fields are undefined until FinancialInstrumentClassified fires", () => {
    const state = fold([makeBondDefined()]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    expect(row?.hqlaLevel).toBeUndefined();
    expect(row?.baselRiskWeight).toBeUndefined();
    expect(row?.ifrs9Category).toBeUndefined();
    expect(row?.saCcrAssetClass).toBeUndefined();
    expect(row?.classificationEffectiveDate).toBeUndefined();
  });

  it("decomposition fields are undefined for a fresh row", () => {
    const state = fold([makeBondDefined()]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    expect(row?.decomposedIntoChildIds).toBeUndefined();
    expect(row?.parentInstrumentId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// 2. FinancialInstrumentDefined with isin populates isinToInstrumentId index
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — isinToInstrumentId index", () => {
  it("populates the isin index when isin is present", () => {
    const state = fold([makeBondDefined("fi:bond:ZAG000149017", "ZAG000149017")]);

    expect(state.isinToInstrumentId.get("ZAG000149017")).toBe("fi:bond:ZAG000149017");
  });

  it("does not add isin index entry when isin is absent", () => {
    const state = fold([makeCashDefined()]);

    expect(state.isinToInstrumentId.size).toBe(0);
  });

  it("multiple instruments with different ISINs each get their own index entry", () => {
    const state = fold([
      makeBondDefined("fi:bond:ZAG000149017", "ZAG000149017"),
      makeEquityDefined("fi:equity:JSE:SOL"),
    ]);

    expect(state.isinToInstrumentId.get("ZAG000149017")).toBe("fi:bond:ZAG000149017");
    expect(state.isinToInstrumentId.get("ZAE000012084")).toBe("fi:equity:JSE:SOL");
    expect(state.isinToInstrumentId.size).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// 3. FinancialInstrumentClassified updates classification fields
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — FinancialInstrumentClassified", () => {
  it("updates all classification fields on the existing row", () => {
    const classified = makeFinancialInstrumentClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: [...CITATIONS, "BA-325", "IFRS9-4-1"],
      payload: {
        instrumentId: "fi:bond:ZAG000149017",
        hqlaLevel: "level-1",
        baselRiskWeight: "0pct",
        ifrs9Category: "amortised-cost",
        saCcrAssetClass: "n-a",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-22",
        rationale: "Sovereign ZAR bond; meets all Level-1 HQLA criteria under BA 325.",
      },
    });

    const state = fold([makeBondDefined(), classified]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    expect(row?.hqlaLevel).toBe("level-1");
    expect(row?.baselRiskWeight).toBe("0pct");
    expect(row?.ifrs9Category).toBe("amortised-cost");
    expect(row?.saCcrAssetClass).toBe("n-a");
    expect(row?.classificationEffectiveDate).toBe("2026-05-22");
    expect(row?.eventCount).toBe(2);
  });

  it("does not mutate other fields (instrument definition fields survive classification overlay)", () => {
    const classified = makeFinancialInstrumentClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        instrumentId: "fi:bond:ZAG000149017",
        hqlaLevel: "level-1",
        baselRiskWeight: "0pct",
        ifrs9Category: "amortised-cost",
        saCcrAssetClass: "n-a",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-22",
        rationale: "Sovereign ZAR bond.",
      },
    });

    const state = fold([makeBondDefined(), classified]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    // Definition fields must be intact
    expect(row?.actusContractType).toBe("PAM");
    expect(row?.isin).toBe("ZAG000149017");
    expect(row?.maturityDate).toBe("2030-01-31");
    expect(row?.currency).toBe("ZAR");
  });
});

// ---------------------------------------------------------------------------
// 4. Second FinancialInstrumentClassified overwrites the first (latest-wins)
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — latest-wins classification", () => {
  it("second FinancialInstrumentClassified for the same instrumentId overwrites the first", () => {
    const first = makeFinancialInstrumentClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        instrumentId: "fi:bond:ZAG000149017",
        hqlaLevel: "level-1",
        baselRiskWeight: "0pct",
        ifrs9Category: "amortised-cost",
        saCcrAssetClass: "n-a",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-22",
        rationale: "Initial classification.",
      },
    });

    const second = makeFinancialInstrumentClassified({
      asOf: "2026-05-22T14:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        instrumentId: "fi:bond:ZAG000149017",
        hqlaLevel: "level-2a",
        baselRiskWeight: "20pct",
        ifrs9Category: "fvtoci",
        saCcrAssetClass: "interest-rate",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-23",
        rationale: "Revised after reclassification review.",
      },
    });

    const state = fold([makeBondDefined(), first, second]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    // Second classification wins
    expect(row?.hqlaLevel).toBe("level-2a");
    expect(row?.baselRiskWeight).toBe("20pct");
    expect(row?.ifrs9Category).toBe("fvtoci");
    expect(row?.saCcrAssetClass).toBe("interest-rate");
    expect(row?.classificationEffectiveDate).toBe("2026-05-23");
    expect(row?.eventCount).toBe(3); // 1 defined + 2 classified
  });
});

// ---------------------------------------------------------------------------
// 5. FinancialInstrumentDecomposed sets decomposedIntoChildIds on parent
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — FinancialInstrumentDecomposed", () => {
  it("sets decomposedIntoChildIds on the parent instrument row", () => {
    const decomposed = makeFinancialInstrumentDecomposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        parentInstrumentId: "fi:bond:ZAG000149017",
        childInstrumentIds: ["fi:zcb:ZAG000149017:C1", "fi:zcb:ZAG000149017:PRINC"],
        decompositionType: "bond-strip",
        effectiveDate: "2026-05-22",
      },
    });

    const state = fold([makeBondDefined(), decomposed]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    expect(row?.decomposedIntoChildIds).toEqual([
      "fi:zcb:ZAG000149017:C1",
      "fi:zcb:ZAG000149017:PRINC",
    ]);
    expect(row?.eventCount).toBe(2);
  });

  it("is a no-op for an unknown parentInstrumentId", () => {
    const decomposed = makeFinancialInstrumentDecomposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        parentInstrumentId: "fi:bond:UNKNOWN",
        childInstrumentIds: ["fi:zcb:UNKNOWN:C1", "fi:zcb:UNKNOWN:PRINC"],
        decompositionType: "bond-strip",
        effectiveDate: "2026-05-22",
      },
    });

    const state = fold([makeBondDefined(), decomposed]);
    // Only the bond defined in makeBondDefined() should exist
    expect(state.instruments.size).toBe(1);
    expect(state.instruments.has("fi:bond:ZAG000149017")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 6. FinancialInstrumentReconstituted clears decomposedIntoChildIds
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — FinancialInstrumentReconstituted", () => {
  it("clears decomposedIntoChildIds after reconstitution", () => {
    const decomposed = makeFinancialInstrumentDecomposed({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        parentInstrumentId: "fi:bond:ZAG000149017",
        childInstrumentIds: ["fi:zcb:ZAG000149017:C1", "fi:zcb:ZAG000149017:PRINC"],
        decompositionType: "bond-strip",
        effectiveDate: "2026-05-22",
      },
    });

    const reconstituted = makeFinancialInstrumentReconstituted({
      asOf: "2026-05-22T15:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        parentInstrumentId: "fi:bond:ZAG000149017",
        childInstrumentIds: ["fi:zcb:ZAG000149017:C1", "fi:zcb:ZAG000149017:PRINC"],
        reconstitutionDate: "2026-05-22",
      },
    });

    const state = fold([makeBondDefined(), decomposed, reconstituted]);
    const row = state.instruments.get("fi:bond:ZAG000149017");

    expect(row?.decomposedIntoChildIds).toBeUndefined();
    expect(row?.eventCount).toBe(3); // defined + decomposed + reconstituted
  });

  it("is a no-op for an unknown parentInstrumentId", () => {
    const reconstituted = makeFinancialInstrumentReconstituted({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        parentInstrumentId: "fi:bond:UNKNOWN",
        childInstrumentIds: ["fi:zcb:UNKNOWN:C1", "fi:zcb:UNKNOWN:PRINC"],
        reconstitutionDate: "2026-05-22",
      },
    });

    const before = fold([makeBondDefined()]);
    const after = fold([makeBondDefined(), reconstituted]);

    // State must be unchanged (same instrument count, same row shape)
    expect(after.instruments.size).toBe(before.instruments.size);
  });
});

// ---------------------------------------------------------------------------
// 7. Unknown event types leave state unchanged
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — unknown event types", () => {
  it("accepts predicate rejects non-FinancialInstrument events", () => {
    const unknownEvent: Event = {
      event_id: "evt:test:unknown",
      type: "FxTradeExecuted",
      as_of: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: { tradeId: "T-001" },
    };

    const accepted = securityMasterProjection.accepts(unknownEvent);
    expect(accepted).toBe(false);
  });

  it("folding an unrecognised event leaves state unchanged", () => {
    const defined = makeBondDefined();
    const state = fold([defined]);

    const unknownEvent: Event = {
      event_id: "evt:test:unknown",
      type: "SomeOtherEvent",
      as_of: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {},
    };

    // Manually fold the unknown event through reduce (bypassing accepts)
    const stateAfter = securityMasterProjection.reduce(
      state,
      // Cast to the expected event type to test the default branch
      unknownEvent as Parameters<typeof securityMasterProjection.reduce>[1],
    );

    // State reference must be identical (pure no-op)
    expect(stateAfter).toBe(state);
  });
});

// ---------------------------------------------------------------------------
// 8. FinancialInstrumentClassified for unknown instrumentId is a no-op
// ---------------------------------------------------------------------------

describe("SecurityMasterProjection — classification before definition is a no-op", () => {
  it("does not create a row when FinancialInstrumentClassified fires with no matching definition", () => {
    const classified = makeFinancialInstrumentClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        instrumentId: "fi:bond:UNDEFINED-INSTRUMENT",
        hqlaLevel: "level-1",
        baselRiskWeight: "0pct",
        ifrs9Category: "amortised-cost",
        saCcrAssetClass: "n-a",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-22",
        rationale: "Should be ignored — instrument not yet defined.",
      },
    });

    const state = fold([classified]);

    // No row should be created for the undefined instrument
    expect(state.instruments.size).toBe(0);
    expect(state.instruments.has("fi:bond:UNDEFINED-INSTRUMENT")).toBe(false);
  });

  it("existing instruments are not affected by a no-op classification on an unknown id", () => {
    const classified = makeFinancialInstrumentClassified({
      asOf: AS_OF,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        instrumentId: "fi:bond:GHOST",
        hqlaLevel: "level-1",
        baselRiskWeight: "0pct",
        ifrs9Category: "amortised-cost",
        saCcrAssetClass: "n-a",
        classifiedBy: "Helena (Chief Risk Officer, governance)",
        effectiveDate: "2026-05-22",
        rationale: "Orphaned classification — must not mutate existing rows.",
      },
    });

    const state = fold([makeBondDefined(), classified]);

    // The bond row must be unchanged
    const row = state.instruments.get("fi:bond:ZAG000149017");
    expect(row?.eventCount).toBe(1);
    expect(row?.hqlaLevel).toBeUndefined();
    expect(state.instruments.size).toBe(1);
  });
});
