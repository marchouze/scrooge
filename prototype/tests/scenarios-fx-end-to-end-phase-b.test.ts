// tests/scenarios-fx-end-to-end-phase-b.test.ts
//
// Smoke + acceptance tests for Phase B of the first-dry-run FX scenario
// (`scenarios/03-fx-end-to-end-rehearsal.ts`). Asserts:
//   - `buildPhaseBPreCloseEvents()` produces the nine pre-close Phase-B
//     events (1 trade-date posting + 2 settlement instructions + 2
//     settlement true-up postings + 2 account-balance postings + 1
//     accounting-period-opened + 1 revaluation posting).
//   - The settlement instructions match the Phase-A trade by tradeId,
//     legKind, settlement-path, and message-standard.
//   - Every Phase-B event carries the scenario provenance tag and the
//     Hoz Bank entity.
//   - The end-to-end runner appends Phase A + Phase B events, the
//     close orchestrator emits TrialBalanceSnapshotted +
//     AccountingPeriodClosed, account balances reflect post-settlement
//     state (USD nostro +5m, ZAR nostro -92.5m), and the trial-balance
//     fold sees the revaluation row.
//
// Authority: D-FIRST-DRY-RUN-SCENARIO §5 Phase B (CEO-approved
// 2026-05-10).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; period-close + sub-ledger leg)
//   + Tomas (Operations & payments engineer, engineering — reports to
//   Devon COO; settlement + payments leg).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { accountBalanceProjection } from "../platform/projections/accounts/balance.projection";
import {
  ENTITY,
  MONTH_END_USDZAR_RATE,
  REVALUATION_PNL_ZAR_MINOR,
  SCENARIO_ID,
  SCENARIO_PROVENANCE,
  SOURCE_LINEAGE,
  TRADE_USD_NOTIONAL_MINOR,
  TRADE_ZAR_NOTIONAL_MINOR,
  buildPhaseAEvents,
  buildPhaseBPreCloseEvents,
  runPhaseAandB,
} from "../scenarios/03-fx-end-to-end-rehearsal";

describe("scenarios/03-fx-end-to-end-rehearsal — Phase B (pre-close builder)", () => {
  const phaseA = buildPhaseAEvents();
  const zarAccountId = (phaseA.accountsOpened[0]?.payload as { accountId: string }).accountId;
  const usdAccountId = (phaseA.accountsOpened[1]?.payload as { accountId: string }).accountId;

  const phaseB = buildPhaseBPreCloseEvents({
    trade: phaseA.trade,
    usdNostroAccountId: usdAccountId,
    zarNostroAccountId: zarAccountId,
  });

  it("emits nine pre-close events (T7a, T8-T13)", () => {
    expect(phaseB.tradeDatePosting.type).toBe("SubLedgerPostingEmitted");
    expect(phaseB.settlementInstructed.length).toBe(2);
    expect(phaseB.settlementPostings.length).toBe(2);
    expect(phaseB.accountBalanceUpdates.length).toBe(2);
    expect(phaseB.accountingPeriodOpened.type).toBe("AccountingPeriodOpened");
    expect(phaseB.revaluationPosting.type).toBe("SubLedgerPostingEmitted");
    expect(phaseB.all.length).toBe(9);
  });

  it("settlement instructions match the Phase-A trade and pack §2.2 schema", () => {
    const [usdLeg, zarLeg] = phaseB.settlementInstructed;
    expect(usdLeg?.type).toBe("FxSettlementInstructed");
    expect(zarLeg?.type).toBe("FxSettlementInstructed");

    const usdPayload = usdLeg?.payload as {
      tradeId: { value: string };
      legKind: string;
      settlementPath: string;
      messageStandard: string;
      netCash: { currency: string; amountMinor: number };
    };
    expect(usdPayload.tradeId.value).toBe("TRD-DRYRUN-001");
    expect(usdPayload.legKind).toBe("near");
    expect(usdPayload.settlementPath).toBe("correspondent");
    expect(usdPayload.messageStandard).toBe("ISO-20022-pacs.009");
    expect(usdPayload.netCash.currency).toBe("USD");
    expect(usdPayload.netCash.amountMinor).toBe(TRADE_USD_NOTIONAL_MINOR);

    const zarPayload = zarLeg?.payload as {
      tradeId: { value: string };
      netCash: { currency: string; amountMinor: number };
    };
    expect(zarPayload.netCash.currency).toBe("ZAR");
    expect(zarPayload.netCash.amountMinor).toBe(-TRADE_ZAR_NOTIONAL_MINOR);
  });

  it("settlement postings + account balance postings pair 1:1", () => {
    const [usdPosting, zarPosting] = phaseB.settlementPostings;
    const [usdBalance, zarBalance] = phaseB.accountBalanceUpdates;
    const usdPostingPayload = usdPosting?.payload as { legs: { currency: string }[] };
    const zarPostingPayload = zarPosting?.payload as { legs: { currency: string }[] };
    expect(usdPostingPayload.legs[0]?.currency).toBe("USD");
    expect(zarPostingPayload.legs[0]?.currency).toBe("ZAR");
    expect((usdBalance?.payload as { currency: string }).currency).toBe("USD");
    expect((zarBalance?.payload as { currency: string }).currency).toBe("ZAR");
  });

  it("trade-date booking carries both legs (USD long / ZAR short)", () => {
    const payload = phaseB.tradeDatePosting.payload as {
      legs: { currency: string; amountMinor: number }[];
    };
    expect(payload.legs.length).toBe(2);
    const usd = payload.legs.find((l) => l.currency === "USD");
    const zar = payload.legs.find((l) => l.currency === "ZAR");
    expect(usd?.amountMinor).toBe(TRADE_USD_NOTIONAL_MINOR);
    expect(zar?.amountMinor).toBe(TRADE_ZAR_NOTIONAL_MINOR);
  });

  it("accounting-period-opened payload reflects 2026-Q1-M01 (ZAR functional)", () => {
    const payload = phaseB.accountingPeriodOpened.payload as {
      periodId: string;
      periodKind: string;
      periodStart: string;
      periodEnd: string;
      functionalCurrency: string;
    };
    expect(payload.periodId).toBe("2026-Q1-M01");
    expect(payload.periodKind).toBe("month");
    expect(payload.functionalCurrency).toBe("ZAR");
    expect(payload.periodStart).toBe("2026-01-01T00:00:00.000Z");
    expect(payload.periodEnd).toBe("2026-01-31T23:59:59.999Z");
  });

  it("revaluation posting reflects USD/ZAR 18.5000 -> 18.4500 month-end move", () => {
    const payload = phaseB.revaluationPosting.payload as {
      postingType: string;
      legs: { currency: string; amountMinor: number }[];
    };
    expect(payload.postingType).toBe("revaluation");
    expect(payload.legs[0]?.currency).toBe("ZAR");
    expect(payload.legs[0]?.amountMinor).toBe(Math.abs(REVALUATION_PNL_ZAR_MINOR));
    // Confirm the rate constant the magnitude derives from.
    expect(MONTH_END_USDZAR_RATE).toBe(18.45);
  });

  it("every Phase-B event carries the scenario provenance tag", () => {
    for (const e of phaseB.all) {
      expect(e.provenance).toBeDefined();
      expect(e.provenance?.kind).toBe("simulated");
      expect(e.provenance?.scenario).toBe(SCENARIO_ID);
      expect(e.provenance?.sourceLineage).toBe(SOURCE_LINEAGE);
    }
  });

  it("every Phase-B event is bound to the Hoz Bank legal entity", () => {
    for (const e of phaseB.all) expect(e.entity).toBe(ENTITY);
  });

  it("every Phase-B event carries at least one citation (Principle 2)", () => {
    for (const e of phaseB.all) expect(e.citations.length).toBeGreaterThanOrEqual(1);
  });
});

describe("scenarios/03-fx-end-to-end-rehearsal — runPhaseAandB end-to-end", () => {
  it("appends 22 events (Phase A: 11; Phase B: 11) and the close fires", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "scenario-03-phase-ab-")), "event.db");
    const result = runPhaseAandB({ dbPath, cleanup: true });

    expect(result.ok).toBe(true);
    // Phase A: 11; Phase B pre-close: 9; close orchestrator emits 2 (TB + Closed).
    // Total = 22; Phase B = 11.
    expect(result.emitted).toBe(22);
    expect(result.phaseBEmitted).toBe(11);

    expect(result.countsByType.SubLedgerPostingEmitted).toBe(4); // T7a + T10 + T11 + T13
    expect(result.countsByType.FxSettlementInstructed).toBe(2);
    expect(result.countsByType.AccountPostingRecorded).toBe(2);
    expect(result.countsByType.AccountingPeriodOpened).toBe(1);
    expect(result.countsByType.AccountingPeriodClosed).toBe(1);
    expect(result.countsByType.TrialBalanceSnapshotted).toBe(1);
    // Phase A counts preserved.
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.AccountOpened).toBe(3);
    expect(result.countsByType.CapitalContributionRecorded).toBe(1);
  });

  it("trial balance has at least 4 distinct (account, currency) rows post-close", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "scenario-03-phase-ab-tb-")), "event.db");
    const result = runPhaseAandB({ dbPath, cleanup: true });
    // Surviving rows: USD nostro (debit), ZAR nostro (credit), FX-position
    // ZAR (residual after revaluation), FX-revaluation P&L (debit). Plus
    // FX-position USD (debit) and FX-pending nets that survive vs zero out.
    expect(result.trialBalanceRowCount).toBeGreaterThanOrEqual(4);
  });

  it("account-balance projection reflects post-settlement balances", () => {
    // Replay Phase A + Phase B pre-close events through the balance
    // projection. Phase A's CapitalContributionRecorded posts ZAR +300m
    // to the capital account. Phase B's two AccountPostingRecorded
    // events post USD +5m to USD nostro and ZAR -92.5m to ZAR nostro.
    const phaseA = buildPhaseAEvents();
    const zarAccountId = (phaseA.accountsOpened[0]?.payload as { accountId: string }).accountId;
    const usdAccountId = (phaseA.accountsOpened[1]?.payload as { accountId: string }).accountId;
    const phaseB = buildPhaseBPreCloseEvents({
      trade: phaseA.trade,
      usdNostroAccountId: usdAccountId,
      zarNostroAccountId: zarAccountId,
    });

    let state = accountBalanceProjection.initial;
    for (const e of [...phaseA.all, ...phaseB.all]) {
      if (accountBalanceProjection.accepts(e)) {
        state = accountBalanceProjection.reduce(state, e);
      }
    }

    const usdBalance = state.balances.get(usdAccountId);
    const zarBalance = state.balances.get(zarAccountId);
    expect(usdBalance).toBeDefined();
    expect(zarBalance).toBeDefined();
    expect(usdBalance?.balanceMinor).toBe(TRADE_USD_NOTIONAL_MINOR); // +5m USD
    expect(usdBalance?.currency).toBe("USD");
    expect(zarBalance?.balanceMinor).toBe(-TRADE_ZAR_NOTIONAL_MINOR); // -92.5m ZAR
    expect(zarBalance?.currency).toBe("ZAR");
  });

  it("every event emitted (including close orchestrator events) carries scenario provenance", () => {
    // The runPhaseAandB wraps provenance assertion; ok=true confirms it.
    const dbPath = join(mkdtempSync(join(tmpdir(), "scenario-03-phase-ab-prov-")), "event.db");
    const result = runPhaseAandB({ dbPath, cleanup: true });
    expect(result.ok).toBe(true);
    expect(SCENARIO_PROVENANCE.scenario).toBe(SCENARIO_ID);
  });
});
