// tests/scenarios-fx-end-to-end.test.ts
//
// Smoke tests for the Phase-A FX end-to-end rehearsal scenario
// (`scenarios/03-fx-end-to-end-rehearsal.ts`). Asserts:
//   - Module imports cleanly (no top-level side effects).
//   - `buildPhaseAEvents()` produces the seven Phase-A events with the
//     expected types and counts.
//   - Every event carries the scenario provenance tag (kind / scenario
//     / sourceLineage exactly as named in the design pack §2.1).
//   - The canonical FX `TradeExecuted` event passes its CDM Zod parse.
//   - The runner's provenance recon (pack §2.6 assertion #6) returns ok.
//
// Authority: D-FIRST-DRY-RUN-SCENARIO (CEO-approved 2026-05-10).
//
// Authors: Saskia (Head of Global Markets) · Kai (Trading systems engineer)
//          · Bea (Accounting & financial reporting engineer)

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "bun:test";

import { isRegisteredLineage } from "../platform/event-store/provenance-lineage.registry";
import { fxTradeExecutedPayloadSchema } from "../platform/markets/cdm/fx";
import {
  COUNTERPARTY_ID,
  ENTITY,
  SCENARIO_ID,
  SCENARIO_PROVENANCE,
  SOURCE_LINEAGE,
  buildPhaseAEvents,
  countByType,
  runPhaseA,
} from "../scenarios/03-fx-end-to-end-rehearsal";

describe("scenarios/03-fx-end-to-end-rehearsal — Phase A", () => {
  it("declares scenario constants per pack §2.1", () => {
    expect(SCENARIO_ID).toBe("first-dry-run-2026-Q1");
    expect(SOURCE_LINEAGE).toBe("scenario-runner:03-fx-end-to-end-rehearsal");
    expect(String(COUNTERPARTY_ID)).toBe("CP-SYN-DRYRUN-001");
    expect(SCENARIO_PROVENANCE.kind).toBe("simulated");
    expect(SCENARIO_PROVENANCE.scenario).toBe(SCENARIO_ID);
    expect(SCENARIO_PROVENANCE.sourceLineage).toBe(SOURCE_LINEAGE);
  });

  it("source lineage is registered with the provenance registry", () => {
    expect(isRegisteredLineage(SOURCE_LINEAGE)).toBe(true);
  });

  it("builds the seven Phase-A choreography steps", () => {
    const phaseA = buildPhaseAEvents();
    expect(phaseA.accountsOpened.length).toBe(3);
    expect(phaseA.capitalContribution.type).toBe("CapitalContributionRecorded");
    // Counterparty replay = sounding + prospect + KYC + mandate.
    expect(phaseA.counterpartyReplay.length).toBe(4);
    expect(phaseA.rfq.type).toBe("RfqRequested");
    expect(phaseA.pricing.type).toBe("PricingModelEvaluated");
    expect(phaseA.trade.type).toBe("FxTradeExecuted");
    // Total: 3 + 1 + 4 + 1 + 1 + 1 = 11 events.
    expect(phaseA.all.length).toBe(11);
  });

  it("counts by event type match the pack §2.1 ledger", () => {
    const counts = countByType(buildPhaseAEvents().all);
    expect(counts).toEqual({
      AccountOpened: 3,
      CapitalContributionRecorded: 1,
      CounterpartySoundingOpened: 1,
      CounterpartyProspectRegistered: 1,
      KycCompleted: 1,
      MandateAssigned: 1,
      RfqRequested: 1,
      PricingModelEvaluated: 1,
      FxTradeExecuted: 1,
    });
  });

  it("every emitted event carries the scenario provenance tag", () => {
    for (const e of buildPhaseAEvents().all) {
      expect(e.provenance).toBeDefined();
      expect(e.provenance?.kind).toBe("simulated");
      expect(e.provenance?.scenario).toBe(SCENARIO_ID);
      expect(e.provenance?.sourceLineage).toBe(SOURCE_LINEAGE);
    }
  });

  it("every emitted event is bound to the Hoz Bank legal entity", () => {
    for (const e of buildPhaseAEvents().all) {
      expect(e.entity).toBe(ENTITY);
    }
  });

  it("every emitted event carries at least one citation (Principle 2)", () => {
    for (const e of buildPhaseAEvents().all) {
      expect(e.citations.length).toBeGreaterThanOrEqual(1);
    }
  });

  it("FxTradeExecuted payload parses against the M4 CDM Zod schema", () => {
    const trade = buildPhaseAEvents().trade;
    expect(() => fxTradeExecutedPayloadSchema.parse(trade.payload)).not.toThrow();
  });

  it("runs Phase A end-to-end against an isolated event store", () => {
    const dbPath = join(mkdtempSync(join(tmpdir(), "scenario-03-phase-a-")), "event.db");
    const result = runPhaseA({ dbPath, cleanup: true });
    expect(result.ok).toBe(true);
    expect(result.emitted).toBe(11);
    expect(result.countsByType.FxTradeExecuted).toBe(1);
    expect(result.countsByType.AccountOpened).toBe(3);
  });
});
