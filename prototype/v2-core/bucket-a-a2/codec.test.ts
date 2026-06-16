// v2-core/bucket-a-a2/codec.test.ts
//
// Unit tests for the Bucket-A batch-A2 store-tee MoneyWire codecs. Because all
// nine types are data-empty in the build phase, the parity gate
// (recon:bucket-a-a2-v2-parity) is PASS-on-empty — so the codecs' MAJOR/MINOR-
// unit + currency-source CORRECTNESS is proven HERE (the honest place to prove a
// transform when the production store is legitimately empty, Charter cmd 3/5).
//
// Each test asserts: (a) the money field is lifted to MoneyWire with the exact
// decimal MAJOR-unit amount, (b) the currency is sourced as the per-type design
// records, (c) the codec output validates against the v2 schema, (d) non-money
// fields pass through verbatim.
//
// Author: Atlas (Core banking platform architect, engineering).

import { describe, expect, test } from "bun:test";

import {
  BUCKET_A_A2_SPECS,
  climateScenarioRunCodec,
  correspondentSettlementInstructionSentCodec,
  counterpartyExposureCalculatedCodec,
  feeDisclosureEventCodec,
  interEntityTransactionProposedCodec,
  nostroStatementReceivedCodec,
  paiaRequestCodec,
  relatedPartyTransactionProposedCodec,
  strCandidateCodec,
} from "./events";
import { isMoneyWire } from "./money-wire";
import { foldBucketAA2Register } from "./projection";

describe("bucket-a-a2 codecs — MAJOR-unit (plain number) currency from payload", () => {
  test("STRCandidate lifts amount; currency from payload", () => {
    const out = strCandidateCodec({
      candidateId: "STR-1",
      transactionRef: "TXN-1",
      flaggedBy: "mira",
      flaggedAt: "2026-06-16T00:00:00Z",
      amount: 1234.56,
      currency: "USD",
      suspicionBasis: "structuring",
      mlroReviewRequired: true,
    });
    expect(out.amount).toEqual({ __money: "v1", amount: "1234.56", currency: "USD" });
    expect(isMoneyWire(out.amount)).toBe(true);
    expect(out.suspicionBasis).toBe("structuring"); // verbatim passthrough
  });

  test("RelatedPartyTransactionProposed lifts amount; currency from payload", () => {
    const out = relatedPartyTransactionProposedCodec({
      proposalId: "RPT-1",
      relatedPartyRef: "party:x",
      transactionDescription: "loan",
      amount: 500000,
      currency: "ZAR",
      proposedAt: "2026-06-16",
      boardApprovalRequired: true,
    });
    expect(out.amount).toEqual({ __money: "v1", amount: "500000", currency: "ZAR" });
  });

  test("InterEntityTransactionProposed lifts amount; currency from payload", () => {
    const out = interEntityTransactionProposedCodec({
      proposalId: "IET-1",
      fromEntity: "LE-A",
      toEntity: "LE-B",
      transactionKind: "funding",
      amount: 100.5,
      currency: "EUR",
      proposedAt: "2026-06-16",
      transferPricingRequired: true,
      approvalRequired: true,
    });
    expect(out.amount).toEqual({ __money: "v1", amount: "100.5", currency: "EUR" });
  });
});

describe("bucket-a-a2 codecs — MINOR-unit (cents int) currency from payload", () => {
  test("CorrespondentSettlementInstructionSent divides minor by 10^2", () => {
    const out = correspondentSettlementInstructionSentCodec({
      msgId: "MSG-1",
      creditorBIC: "DEUTDEFF",
      instructedAmount: 100050, // R1000.50 in cents
      currency: "ZAR",
      settlementDate: "2026-06-16",
      endToEndId: "E2E-1",
    });
    expect(out.instructedAmount).toEqual({ __money: "v1", amount: "1000.5", currency: "ZAR" });
  });

  test("NostroStatementReceived handles negative minor balance", () => {
    const out = nostroStatementReceivedCodec({
      accountId: "ACC-1",
      asOf: "2026-06-16",
      closingBalance: -2550, // -R25.50
      currency: "USD",
      entryCount: 3,
    });
    expect(out.closingBalance).toEqual({ __money: "v1", amount: "-25.5", currency: "USD" });
  });
});

describe("bucket-a-a2 codecs — schema-declared / statutory ZAR denomination", () => {
  test("ClimateScenarioRun lifts the three *ZAR fields (MAJOR units, ZAR)", () => {
    const out = climateScenarioRunCodec({
      scenarioId: "PA-GN1-2024-ORDERLY",
      scenarioName: "Orderly",
      runDate: "2026-07-01",
      portfolioSnapshot: {
        totalExposureZAR: 1000000,
        carbonIntensiveExposureZAR: 250000.75,
        carbonIntensivePct: 25,
      },
      stressLossZAR: 50000,
      scenarioHorizonYears: 10,
      authority: "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
    });
    const snap = out.portfolioSnapshot as Record<string, unknown>;
    expect(snap.totalExposureZAR).toEqual({ __money: "v1", amount: "1000000", currency: "ZAR" });
    expect(snap.carbonIntensiveExposureZAR).toEqual({
      __money: "v1",
      amount: "250000.75",
      currency: "ZAR",
    });
    expect(snap.carbonIntensivePct).toBe(25); // non-money passthrough
    expect(out.stressLossZAR).toEqual({ __money: "v1", amount: "50000", currency: "ZAR" });
  });

  test("CounterpartyExposureCalculated lifts four MINOR-unit ZAR fields", () => {
    const out = counterpartyExposureCalculatedCodec({
      counterpartyId: "cp:1",
      exposureType: "replacement-cost",
      grossExposure: 200000000, // R2m in cents
      netExposure: 150000000,
      collateralHeld: 50000000,
      uncoveredExposure: 100000000,
      limitUtilisationPct: 40,
      breached: false,
      calculatedAt: "2026-06-16T00:00:00Z",
    });
    expect(out.grossExposure).toEqual({ __money: "v1", amount: "2000000", currency: "ZAR" });
    expect(out.netExposure).toEqual({ __money: "v1", amount: "1500000", currency: "ZAR" });
    expect(out.collateralHeld).toEqual({ __money: "v1", amount: "500000", currency: "ZAR" });
    expect(out.uncoveredExposure).toEqual({ __money: "v1", amount: "1000000", currency: "ZAR" });
    expect(out.limitUtilisationPct).toBe(40); // non-money passthrough
  });

  test("PAIARequest lifts the statutory ZAR fee when present; passthrough when absent", () => {
    const withFee = paiaRequestCodec({
      requestId: "PAIA-1",
      requesterRef: "r:1",
      receivedAt: "2026-06-16",
      informationDescription: "records",
      responseDeadline: "2026-07-16",
      fee: 50,
    });
    expect(withFee.fee).toEqual({ __money: "v1", amount: "50", currency: "ZAR" });

    const noFee = paiaRequestCodec({
      requestId: "PAIA-2",
      requesterRef: "r:2",
      receivedAt: "2026-06-16",
      informationDescription: "records",
      responseDeadline: "2026-07-16",
    });
    expect(noFee.fee).toBeUndefined();
  });
});

describe("bucket-a-a2 codecs — nullable / fail-closed edges", () => {
  test("FeeDisclosureEvent: notional lifted; null feeAmount stays null; currency from payload", () => {
    const out = feeDisclosureEventCodec({
      counterpartyId: "cp:1",
      instrument: "USD/ZAR",
      notional: 1000000,
      currency: "USD",
      spreadBps: 5,
      feeAmount: null,
      disclosureMethod: "pre-trade",
      disclosedAt: "2026-06-16T00:00:00Z",
    });
    expect(out.notional).toEqual({ __money: "v1", amount: "1000000", currency: "USD" });
    expect(out.feeAmount).toBeNull();

    const flat = feeDisclosureEventCodec({
      counterpartyId: "cp:1",
      instrument: "USD/ZAR",
      notional: 1000000,
      currency: "USD",
      spreadBps: null,
      feeAmount: 2500.5,
      disclosureMethod: "term-sheet",
      disclosedAt: "2026-06-16T00:00:00Z",
    });
    expect(flat.feeAmount).toEqual({ __money: "v1", amount: "2500.5", currency: "USD" });
  });

  test("codec fails closed on a missing required currency", () => {
    expect(() =>
      strCandidateCodec({
        candidateId: "STR-1",
        transactionRef: "TXN-1",
        flaggedBy: "mira",
        flaggedAt: "2026-06-16",
        amount: 100,
        // currency intentionally omitted
        suspicionBasis: "x",
        mlroReviewRequired: true,
      }),
    ).toThrow(/currency/);
  });

  test("MINOR codec fails closed on an unregistered currency scale", () => {
    expect(() =>
      correspondentSettlementInstructionSentCodec({
        msgId: "MSG-1",
        creditorBIC: "DEUTDEFF",
        instructedAmount: 100,
        currency: "XAU", // gold — not a registered minor-unit currency
        settlementDate: "2026-06-16",
        endToEndId: "E2E-1",
      }),
    ).toThrow(/exponent/);
  });
});

describe("bucket-a-a2 — codec output validates against its v2 schema", () => {
  test("every codec's output parses against the matching v2 schema", () => {
    const samples: Record<string, Record<string, unknown>> = {
      STRCandidate: {
        candidateId: "STR-1",
        transactionRef: "TXN-1",
        flaggedBy: "mira",
        flaggedAt: "2026-06-16",
        amount: 100,
        currency: "ZAR",
        suspicionBasis: "x",
        mlroReviewRequired: true,
      },
      RelatedPartyTransactionProposed: {
        proposalId: "RPT-1",
        relatedPartyRef: "p",
        transactionDescription: "d",
        amount: 100,
        currency: "ZAR",
        proposedAt: "2026-06-16",
        boardApprovalRequired: true,
      },
      InterEntityTransactionProposed: {
        proposalId: "IET-1",
        fromEntity: "A",
        toEntity: "B",
        transactionKind: "k",
        amount: 100,
        currency: "ZAR",
        proposedAt: "2026-06-16",
        transferPricingRequired: false,
        approvalRequired: true,
      },
      CorrespondentSettlementInstructionSent: {
        msgId: "M",
        creditorBIC: "DEUTDEFF",
        instructedAmount: 100,
        currency: "ZAR",
        settlementDate: "2026-06-16",
        endToEndId: "E",
      },
      NostroStatementReceived: {
        accountId: "A",
        asOf: "2026-06-16",
        closingBalance: 100,
        currency: "ZAR",
        entryCount: 1,
      },
      CounterpartyExposureCalculated: {
        counterpartyId: "cp",
        exposureType: "issuer",
        grossExposure: 100,
        netExposure: 100,
        collateralHeld: 0,
        uncoveredExposure: 100,
        limitUtilisationPct: 1,
        breached: false,
        calculatedAt: "2026-06-16",
      },
      PAIARequest: {
        requestId: "P",
        requesterRef: "r",
        receivedAt: "2026-06-16",
        informationDescription: "i",
        responseDeadline: "2026-07-16",
        fee: 50,
      },
      FeeDisclosureEvent: {
        counterpartyId: "cp",
        instrument: "USD/ZAR",
        notional: 100,
        currency: "USD",
        spreadBps: null,
        feeAmount: 5,
        disclosureMethod: "pre-trade",
        disclosedAt: "2026-06-16",
      },
      ClimateScenarioRun: {
        scenarioId: "s",
        scenarioName: "n",
        runDate: "2026-07-01",
        portfolioSnapshot: {
          totalExposureZAR: 100,
          carbonIntensiveExposureZAR: 50,
          carbonIntensivePct: 50,
        },
        stressLossZAR: 10,
        scenarioHorizonYears: 10,
        authority: "D-RAS-CLIMATE-SCENARIO-FRAMEWORK",
      },
    };
    for (const spec of BUCKET_A_A2_SPECS) {
      const sample = samples[spec.type];
      expect(sample, `missing sample for ${spec.type}`).toBeDefined();
      if (!sample) continue;
      const mirrored = spec.codec(sample);
      const parsed = spec.schema.safeParse(mirrored);
      expect(
        parsed.success,
        `${spec.type} codec output failed v2 schema: ${JSON.stringify(parsed)}`,
      ).toBe(true);
    }
  });
});

describe("bucket-a-a2 projection — codec-applied V1 == as-stored v2", () => {
  test("fold(V1, applyCodec=true) equals fold(codec-mirrored, applyCodec=false)", () => {
    const typeSet = new Set(["STRCandidate"]);
    const v1View = {
      event_id: "evt-1",
      type: "STRCandidate",
      payload: {
        candidateId: "STR-1",
        transactionRef: "TXN-1",
        flaggedBy: "mira",
        flaggedAt: "2026-06-16",
        amount: 1234.5,
        currency: "ZAR",
        suspicionBasis: "x",
        mlroReviewRequired: true,
      },
    };
    const v1Reg = foldBucketAA2Register([v1View], typeSet, true);
    // Simulate what the tee stores: codec applied once.
    const mirrored = { ...v1View, payload: strCandidateCodec(v1View.payload) };
    const v2Reg = foldBucketAA2Register([mirrored], typeSet, false);
    expect(v1Reg.rows).toEqual(v2Reg.rows);
  });
});
