// platform/recon/cva-derivatives-sim-drive.ts
//
// recon:cva-derivatives-sim-drive — ENFORCING gate for the simulator-first CVA
// capital charge over the OTC derivative counterparty book (D-BA-RETURN-
// SIMULATOR-FIRST, Phase 2b).
//
// The CVA engine (computeCva) computes a standardised BA-CVA reduced charge over
// the OTC counterparty book. This gate proves it lands on a hand-computed BCBS
// golden case (a domain-truth oracle, NOT internal consistency), that the CVA
// RWA leg = capital × 12.5, and that the provenance boundary holds — over a
// self-contained in-memory simulated derivative book.
//
// ASSERTION FAMILIES:
//
//   (A) CVA LANDS ON THE BCBS GOLDEN ORACLE. Over the simulated book the
//       per-counterparty EAD / PD and the total CVA equal hand-computed values
//       (standardised: Σ LGD × EAD × PD × discount). A consistent-but-wrong CVA
//       is a FAIL.
//
//   (B) ETD EXCLUSION. The exchange-traded (no-counterparty) position contributes
//       nothing — only the two OTC counterparties are exposed.
//
//   (C) CVA RWA LEG = CVA capital × 12.5 — the BA 700 totalRWA leg sources the
//       real charge, not a zero placeholder.
//
//   (D) PROVENANCE BOUNDARY. A production-only read of the simulated book yields
//       `no-otc-exposure` (loud zero) and a zero CVA RWA leg — the R300m-into-
//       Prod regression guard. The simulated read drives it non-zero.
//
// SEVERITY: ENFORCING. Self-contained in-memory book — always asserts.
//
// Authority: D-BA-RETURN-SIMULATOR-FIRST (CEO-approved 2026-06-26);
//   D-MODEL-REGISTRY-SCOPE-CLOSURE-V1 Slice 5 (CVA engine); BCBS d424 MAR50;
//   D-PROVENANCE-FILTER-ENFORCEMENT; Regulations Relating to Banks Reg 28.
// Author: Atlas (Core banking platform architect, engineering).

import { money } from "../core/decimal-money";
import { encodeMoney } from "../core/money-codec";
import { ZAR } from "../core/types";
import {
  type DerivativeAssetClass,
  type DerivativeInstrumentType,
  type DerivativeVenue,
  makeDerivativeTradingPositionOpened,
} from "../event-store/event-types/derivative-book-positions";
import { simulatedTag } from "../event-store/provenance";
import { EventStore } from "../event-store/store";
import type { Actor } from "../event-store/types";
import { MarketDataStore } from "../market-data/store";
import { computeCva } from "../market-risk/cva-engine";
import { computeCvaRwaLeg } from "../market-risk/cva-rwa-leg";
import type { ProvenanceFilter } from "../projections/filter";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "cva-derivatives-sim-drive";
const ENTITY = "LE-ZA-HOZ-BANK";
const PE = "2026-06-30";
const TRADING_DESK = "urn:desk:trading-desk:trading-desk-1";
const TREASURY_DESK = "urn:desk:treasury-desk:treasury-desk-1";
const ACTOR: Actor = { type: "service", id: "agent:atlas:recon-cva-sim" };
const CP_BANK = "urn:party:legal-entity:standard-bank-za";
const CP_CORP = "urn:party:legal-entity:acme-corp-ltd";
const SIM = simulatedTag({
  scenario: "derivative-book-sim-v1",
  sourceLineage: "platform/recon/cva-derivatives-sim-drive.ts",
});
const COMBINED: ProvenanceFilter = { mode: "combined" };
const PRODUCTION: ProvenanceFilter = { mode: "production-only" };

interface Spec {
  id: string;
  ac: DerivativeAssetClass;
  it: DerivativeInstrumentType;
  venue: DerivativeVenue;
  notion: string;
  fv: string;
  book: "trading" | "banking-treasury";
  cp?: string;
}

const BOOK: readonly Spec[] = [
  {
    id: "swap-bank",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    notion: "200000000",
    fv: "4000000",
    book: "trading",
    cp: CP_BANK,
  },
  {
    id: "fra-bank",
    ac: "interest-rate",
    it: "forward-fra",
    venue: "over-the-counter",
    notion: "80000000",
    fv: "120000",
    book: "trading",
    cp: CP_BANK,
  },
  {
    id: "cds-bank",
    ac: "credit",
    it: "credit-default-swap",
    venue: "over-the-counter",
    notion: "50000000",
    fv: "300000",
    book: "trading",
    cp: CP_BANK,
  },
  {
    id: "swap-banking-bank",
    ac: "interest-rate",
    it: "swap",
    venue: "over-the-counter",
    notion: "150000000",
    fv: "-900000",
    book: "banking-treasury",
    cp: CP_BANK,
  },
  {
    id: "fx-corp",
    ac: "foreign-exchange",
    it: "forward-fra",
    venue: "over-the-counter",
    notion: "90000000",
    fv: "-600000",
    book: "trading",
    cp: CP_CORP,
  },
  {
    id: "eqopt-corp",
    ac: "equity",
    it: "put-option-written",
    venue: "over-the-counter",
    notion: "30000000",
    fv: "-250000",
    book: "trading",
    cp: CP_CORP,
  },
  {
    id: "etd-fut",
    ac: "interest-rate",
    it: "future-bought",
    venue: "exchange-traded",
    notion: "100000000",
    fv: "500000",
    book: "trading",
  },
];

function seedBook(store: EventStore): void {
  for (const s of BOOK) {
    store.append(
      makeDerivativeTradingPositionOpened({
        asOf: PE,
        entity: ENTITY,
        actor: ACTOR,
        citations: ["D-BA-RETURN-SIMULATOR-FIRST", "BANKS-REG-28"],
        eventId: `CVAREC-${s.id}`,
        provenance: SIM,
        payload: {
          positionId: s.id,
          instrumentId: s.id,
          instrumentName: `${s.id} (sim)`,
          assetClass: s.ac,
          instrumentType: s.it,
          venue: s.venue,
          maturityBand: "1y-5y",
          notional: encodeMoney(money(s.notion, ZAR)),
          fairValue: encodeMoney(money(s.fv, ZAR)),
          deskId: s.book === "trading" ? TRADING_DESK : TREASURY_DESK,
          bookType: s.book,
          openedDate: PE,
          maturityDate: "2030-01-01",
          ...(s.cp ? { counterpartyId: s.cp, counterpartyName: `${s.cp} (sim)` } : {}),
        },
      }),
    );
  }
}

// Hand-computed BCBS golden oracle (ZAR major / minor).
const ORACLE = {
  bankEadZar: 9_070_000,
  bankPd: 0.005,
  bankCvaZar: 26_393.7,
  corpEadZar: 3_300_000,
  corpPd: 0.02,
  corpCvaZar: 38_412.0,
  totalCvaZar: 64_805.7,
  cvaCapitalMinor: 6_480_570,
  cvaRwaMinor: 81_007_125, // capital × 12.5
};

export function run(): ReconResult {
  const result = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];
  let asserted = 0;

  const store = new EventStore(":memory:");
  seedBook(store);
  const md = new MarketDataStore(":memory:");

  const rSim = computeCva({
    eventStore: store,
    marketData: md,
    asOf: PE,
    derivativeProvenanceFilter: COMBINED,
  });
  const rProd = computeCva({
    eventStore: store,
    marketData: md,
    asOf: PE,
    derivativeProvenanceFilter: PRODUCTION,
  });
  const legSim = computeCvaRwaLeg({
    eventStore: store,
    asOf: PE,
    derivativeProvenanceFilter: COMBINED,
  });
  const legProd = computeCvaRwaLeg({
    eventStore: store,
    asOf: PE,
    derivativeProvenanceFilter: PRODUCTION,
  });

  const fail = (subject: string, message: string) => {
    violations.push({ subject: `${PIPELINE}:${subject}`, severity: "fail", message });
  };
  const near = (a: number, b: number) => Math.abs(a - b) < 0.01;

  // (A) CVA lands on the golden oracle.
  asserted += 1;
  if (rSim.status !== "computed") {
    fail(
      "not-computed",
      `Simulated CVA status="${rSim.status}" — expected "computed" over the simulated OTC book. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
    );
  }
  asserted += 1;
  if (rSim.exposedCounterparties !== 2) {
    fail(
      "counterparty-count",
      `Simulated CVA exposed counterparties=${rSim.exposedCounterparties} ≠ 2 (CP_BANK + CP_CORP). Authority: BCBS d424 MAR50.`,
    );
  }
  const bank = rSim.counterparties.find((c) => c.counterpartyId === CP_BANK);
  const corp = rSim.counterparties.find((c) => c.counterpartyId === CP_CORP);
  asserted += 1;
  if (
    !bank ||
    bank.eadZar !== ORACLE.bankEadZar ||
    bank.pd !== ORACLE.bankPd ||
    !near(bank.cvaZar ?? -1, ORACLE.bankCvaZar)
  ) {
    fail(
      "bank-cp-mismatch",
      `CP_BANK CVA leg (EAD ${bank?.eadZar}, PD ${bank?.pd}, CVA ${bank?.cvaZar}) ≠ oracle (EAD ${ORACLE.bankEadZar}, PD ${ORACLE.bankPd}, CVA ${ORACLE.bankCvaZar}). A consistent-but-wrong CVA is a finding. Authority: BCBS d424 MAR50.`,
    );
  }
  asserted += 1;
  if (
    !corp ||
    corp.eadZar !== ORACLE.corpEadZar ||
    corp.pd !== ORACLE.corpPd ||
    !near(corp.cvaZar ?? -1, ORACLE.corpCvaZar)
  ) {
    fail(
      "corp-cp-mismatch",
      `CP_CORP CVA leg (EAD ${corp?.eadZar}, PD ${corp?.pd}, CVA ${corp?.cvaZar}) ≠ oracle (EAD ${ORACLE.corpEadZar}, PD ${ORACLE.corpPd}, CVA ${ORACLE.corpCvaZar}). Authority: BCBS d424 MAR50.`,
    );
  }
  asserted += 1;
  const totalCva = rSim.cva.present ? rSim.cva.value : Number.NaN;
  if (!near(totalCva, ORACLE.totalCvaZar)) {
    fail(
      "total-cva-mismatch",
      `Total CVA ${totalCva} ≠ hand-computed oracle ${ORACLE.totalCvaZar} (Σ LGD × EAD × PD × discount). Authority: BCBS d424 MAR50.`,
    );
  }

  // (B) ETD exclusion — only the two OTC counterparties appear.
  asserted += 1;
  const ids = rSim.counterparties.map((c) => c.counterpartyId).sort();
  if (ids.length !== 2 || !ids.includes(CP_BANK) || !ids.includes(CP_CORP)) {
    fail(
      "etd-not-excluded",
      `CVA counterparties [${ids.join(", ")}] include an unexpected party — the ETD (no-counterparty) position must be EXCLUDED (CCP exposure is not bilateral OTC CVA). Authority: BCBS d424 MAR50.`,
    );
  }

  // (C) CVA RWA leg = capital × 12.5.
  asserted += 1;
  if (legSim.cvaCapitalMinor !== ORACLE.cvaCapitalMinor) {
    fail(
      "cva-capital-minor",
      `CVA capital ${legSim.cvaCapitalMinor} ≠ oracle ${ORACLE.cvaCapitalMinor} minor. Authority: BCBS d424 MAR50.`,
    );
  }
  asserted += 1;
  if (legSim.cvaRwaMinor !== ORACLE.cvaRwaMinor) {
    fail(
      "cva-rwa-minor",
      `CVA RWA leg ${legSim.cvaRwaMinor} ≠ oracle ${ORACLE.cvaRwaMinor} minor (capital × 12.5). The BA 700 totalRWA CVA leg must source the real charge, not a zero placeholder. Authority: Reg 28 (RWA = capital × 12.5).`,
    );
  }

  // (D) Provenance boundary — production read → no-otc-exposure, leg 0.
  asserted += 1;
  if (rProd.status !== "no-otc-exposure" || rProd.cva.present !== false) {
    fail(
      "production-cva-nonzero",
      `PRODUCTION-only CVA status="${rProd.status}" (present=${rProd.cva.present}) — expected "no-otc-exposure" / absent. The simulated counterparty book must be invisible to the production read (R300m-into-Prod guard). Authority: D-PROVENANCE-FILTER-ENFORCEMENT.`,
    );
  }
  asserted += 1;
  if (legProd.cvaRwaMinor !== 0 || legProd.cvaCapitalMinor !== 0) {
    fail(
      "production-cva-rwa-nonzero",
      `PRODUCTION-only CVA RWA leg (capital ${legProd.cvaCapitalMinor}, RWA ${legProd.cvaRwaMinor}) ≠ 0 — production CVA RWA must stay zero pre-licence-day. Authority: D-BA-RETURN-SIMULATOR-FIRST.`,
    );
  }

  result.asserted = asserted;
  result.violations = violations;
  result.ok = !violations.some((v) => v.severity === "fail");
  result.asOf =
    `cva-derivatives-sim-drive [ENFORCING]: sim total CVA=${totalCva} ZAR (status=${rSim.status}); ` +
    `sim CVA RWA leg=${legSim.cvaRwaMinor} minor; prod CVA status=${rProd.status} (RWA leg=${legProd.cvaRwaMinor}); ` +
    `${violations.filter((v) => v.severity === "fail").length} fail.`;
  return result;
}

if (import.meta.main) {
  const r = run();
  for (const v of r.violations) {
    process.stderr.write(`[${v.severity}] ${v.subject}: ${v.message}\n`);
  }
  process.stdout.write(`\nrecon:${PIPELINE} ${r.ok ? "OK" : "FAIL"}\n${r.asOf}\n`);
  console.log(
    JSON.stringify({
      level: r.ok ? "info" : "error",
      time: r.asOf,
      service: "bank-prototype",
      pipeline: r.pipeline,
      asserted: r.asserted,
      violations: r.violations.length,
      ok: r.ok,
      msg: r.asOf,
    }),
  );
  process.exit(r.ok ? 0 : 1);
}
