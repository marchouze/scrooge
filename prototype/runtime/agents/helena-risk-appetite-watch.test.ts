// runtime/agents/helena-risk-appetite-watch.test.ts
//
// Regression test for D-CRO-GAP-SECTION-DERIVE-FROM-STORE (CEO-approved
// 2026-06-08).
//
// Defect: helena-risk-appetite-watch.ts emitted its "## Substrate gaps
// surfaced this run" section as a sequence of UNCONDITIONAL string literals
// while the rest of the same report derived its status live from the event
// store. The two halves contradicted each other — the RWA-engine and
// independent-model-validation bullets kept printing as open long after
// `computeRwaFromPositions` (2026-05-30) and Nadia (Model Validation lead,
// governance — hired 2026-05-09) closed them.
//
// Fix: every gap bullet is now gated on a real store probe via
// `buildSubstrateGapLines`. These tests pin that contract:
//   (a) populated store (live RWA trade + ≥1 ModelValidationApproved) ⇒ the
//       RWA and model-validation bullets are ABSENT.
//   (b) empty store ⇒ both bullets are PRESENT.
//
// We drive `buildSubstrateGapLines` directly against an isolated in-memory
// EventStore so the assertion does not depend on the shared composition
// singleton (per-process tmpdir under tests/_setup.ts). Raw EventStore use is
// the standard isolated-store test pattern (see bea-gl-posting-engine.test.ts).
//
// Author: Atlas (Substrate engineer).

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

import { makeModelValidationApproved } from "../../platform/event-store/event-types/model-risk";
import { EventStore } from "../../platform/event-store/store";
import { makeFxTradeExecuted } from "../../platform/markets/cdm/fx";
import {
  RAS_APPETITE_LINES,
  formatThresholds,
  requireRasAppetiteLine,
} from "../../platform/risk/ras-appetite-register";
import { type AppetiteSnapshot, buildSubstrateGapLines } from "./helena-risk-appetite-watch";

const ENTITY = "LE-ZA-HOZ-BANK";
const ASOF = "2026-06-08T08:00:00.000Z";

// Minimal snapshot stub — buildSubstrateGapLines only reads `unmeasuredCount`.
// The other fields are present to satisfy the type; their values are inert.
const SNAP: AppetiteSnapshot = {
  lineStates: [],
  measuredCount: 0,
  unmeasuredCount: 2,
  breachCounts: { openBreaches: 0, disposedBreaches: 0, tier1Open: 0, tier2Open: 0 },
  daysSinceRasReview: 33,
};

const RWA_BULLET = "**RWA engine**";
const MODEL_VALIDATION_BULLET = "**Independent model-validation function**";
// The structured-RAS-register meta-gap is CLOSED by D-RAS-STRUCTURED-REGISTER
// (the typed register at platform/risk/ras-appetite-register.ts now exists), so
// this bullet must NO LONGER appear in the report.
const STRUCTURED_RAS_BULLET = "**Structured RAS register**";

// Seed one live FX trade so computeRwaFromPositions().buildPhaseFallback === false.
function seedLiveFxTrade(store: EventStore): void {
  store.append(
    makeFxTradeExecuted({
      asOf: ASOF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:saskia:fx-trader" },
      citations: ["D-MARKETS-SCHEMA-FOUNDATION"],
      payload: {
        tradeId: { scheme: "INTERNAL", value: "FX-HELENA-GAP-TEST-001" },
        productTaxonomy: "FX-spot",
        currencyPair: { base: "USD", quote: "ZAR" },
        side: "buy",
        legs: [
          {
            legKind: "near",
            payCurrency: "ZAR",
            receiveCurrency: "USD",
            notional: { currency: "ZAR", amountMinor: 18_500_000_00 },
            counterNotional: { currency: "USD", amountMinor: 1_000_000_00 },
            rate: { currency: "ZAR", amount: 18.5 },
            settlementDate: { iso: "2026-06-10", calendar: "JIHCAL" },
          },
        ],
        tradeDate: { iso: "2026-06-08", calendar: "JIHCAL" },
        counterparty: {
          partyId: "CPTY-HELENA-GAP-001",
          name: "Test Counterparty",
          role: "counterparty",
          jurisdiction: "ZA",
        },
        venue: "OTC",
        trader: "helena-gap-test@bank.local",
        bookId: "BOOK-FX-HELENA-GAP",
        bookType: "trading",
        settlementForm: "physical",
        settlementPath: "correspondent",
        finsurvCategory: "ODP-001-cross-border-institutional",
        clientFlowRef: "client-trade:FX-HELENA-GAP-TEST-001",
      },
    }),
  );
}

function seedModelValidationApproved(store: EventStore): void {
  store.append(
    makeModelValidationApproved({
      asOf: ASOF,
      entity: ENTITY,
      actor: { type: "service", id: "agent:nadia:model-validation" },
      citations: ["RAS-FRAMEWORK-2026-05-06"],
      payload: {
        modelId: "MODEL-HELENA-GAP-TEST",
        version: "v1",
        approvedBy: "Nadia",
        validationFindingsResolved: [],
        expiryDate: "2027-06-08",
      },
    }),
  );
}

describe("helena-risk-appetite-watch — substrate gaps derived from store (D-CRO-GAP-SECTION-DERIVE-FROM-STORE)", () => {
  it("populated store (live RWA trade + ModelValidationApproved): RWA + model-validation bullets ABSENT", () => {
    const store = new EventStore(":memory:");
    seedLiveFxTrade(store);
    seedModelValidationApproved(store);

    const gaps = buildSubstrateGapLines(store, ASOF, SNAP).join("\n");

    expect(gaps).not.toContain(RWA_BULLET);
    expect(gaps).not.toContain(MODEL_VALIDATION_BULLET);
    // The structured-RAS meta-gap is CLOSED — the bullet must be absent.
    expect(gaps).not.toContain(STRUCTURED_RAS_BULLET);
  });

  it("empty store: RWA + model-validation bullets PRESENT; structured-RAS gap CLOSED", () => {
    const store = new EventStore(":memory:");

    const gaps = buildSubstrateGapLines(store, ASOF, SNAP).join("\n");

    expect(gaps).toContain(RWA_BULLET);
    expect(gaps).toContain(MODEL_VALIDATION_BULLET);
    // Structured-RAS-register gap is closed by D-RAS-STRUCTURED-REGISTER even
    // against an empty store — the register exists regardless of event state.
    expect(gaps).not.toContain(STRUCTURED_RAS_BULLET);
  });

  it("zero unmeasured lines: measurement-substrate bullet drops off", () => {
    const store = new EventStore(":memory:");
    const measuredSnap: AppetiteSnapshot = { ...SNAP, unmeasuredCount: 0 };

    const gaps = buildSubstrateGapLines(store, ASOF, measuredSnap).join("\n");

    expect(gaps).not.toContain("**Measurement substrate**");
  });
});

// Faithfulness of the register extraction (D-RAS-STRUCTURED-REGISTER). Proves
// the handler now sources its appetite lines + LCR/NSFR thresholds from the
// canonical register, with NO semantic change vs the pre-change hand-curated
// constants. The 14 line ids and the LCR/NSFR threshold strings are
// byte-identical to what the report has always printed.
describe("helena-risk-appetite-watch — faithful register extraction (D-RAS-STRUCTURED-REGISTER)", () => {
  const HANDLER_SRC = readFileSync(
    new URL("./helena-risk-appetite-watch.ts", import.meta.url),
    "utf8",
  );

  it("the register carries exactly the 14 pre-change line ids", () => {
    expect(RAS_APPETITE_LINES.map((l) => l.id)).toEqual([
      "appetite:liquidity:lcr",
      "appetite:liquidity:nsfr",
      "appetite:capital:cet1-buffer",
      "appetite:capital:leverage-ratio",
      "appetite:credit:single-name-concentration",
      "appetite:credit:sector-concentration",
      "appetite:market:trading-var",
      "appetite:market:counterparty-concentration",
      "appetite:financial-crime:sanctions-match",
      "appetite:financial-crime:str-filing-judgement",
      "appetite:operational:cyber-severity-tiers",
      "appetite:model:tier-discipline",
      "appetite:climate:guidance-note-1-2024",
      "appetite:conduct:tcf",
    ]);
  });

  it("LCR/NSFR threshold strings the report prints come from the register", () => {
    // These are the EXACT strings the pre-change render embedded inline.
    expect(formatThresholds(requireRasAppetiteLine("appetite:liquidity:lcr").thresholds)).toBe(
      "green ≥120% / amber 110-120% / red <110% / critical <105%",
    );
    expect(formatThresholds(requireRasAppetiteLine("appetite:liquidity:nsfr").thresholds)).toBe(
      "green ≥115% / amber 108-115% / red <108% / critical <103%",
    );
  });

  it("the handler no longer hardcodes the LCR/NSFR threshold strings or an appetite-line array", () => {
    // The handler must read thresholds from the register, not re-type them.
    // (The literal strings now live ONLY in the register module.)
    expect(HANDLER_SRC).not.toContain("green ≥120% / amber 110-120%");
    expect(HANDLER_SRC).not.toContain("green ≥115% / amber 108-115%");
    // No re-declared local appetite-line array literal.
    expect(HANDLER_SRC).not.toContain('id: "appetite:');
  });
});
