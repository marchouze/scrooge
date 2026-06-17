// tests/period-close-v2-fold.test.ts
//
// FX4 proof (D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD): the period-close snapshot is
// the SINGLE legitimate materialisation of the FX fold — a byte-faithful CACHE
// of `computeTrialBalanceV2`, never divergent state (Principle 1).
//
//  (1) closePeriodV2 over a small FX book snapshots the FOLDED trial balance via
//      the SAME factories the V1 close uses (makeTrialBalanceSnapshotted /
//      makeAccountingPeriodClosed).
//  (2) Re-folding the primaries (computeTrialBalanceV2) at the snapshot's period
//      window reproduces the snapshotted rows BYTE-FOR-BYTE — the invariant the
//      `recon:tb-snapshot-reproducible` gate enforces continuously.
//
// Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD (CEO-approved 2026-06-17),
//   citing D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
// Author: Atlas (Substrate Architect, engineering).

import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { closePeriodV2, openPeriod } from "../platform/accounting/period-close";
import type { TrialBalanceSnapshottedPayload } from "../platform/event-store/event-types";
import { accountingPeriodOpenedPayloadSchema } from "../platform/event-store/event-types/accounting";
import {
  makeFilInstrumentCreated,
  makeFilInstrumentTerminated,
} from "../platform/event-store/event-types/fil-instances";
import { makeReportingTreatmentDeclared } from "../platform/event-store/event-types/reporting-treatments";
import { EventStore } from "../platform/event-store/store";
import type { Actor, Event, ProvenanceTag } from "../platform/event-store/types";
import { setDefaultProvenanceModeOverride } from "../platform/projections/filter";
import { computeTrialBalanceV2 } from "../platform/projections/gl-projection-v2";
import {
  filInstrumentCreatedPayloadSchema,
  filInstrumentTerminatedPayloadSchema,
} from "../v2-core/fil-instances/events";
import { FX_TREATMENT_MODULES } from "../v2-core/reporting-treatments/fx-modules";

const ACTOR: Actor = { type: "system", id: "atlas:fx4-close-test" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITES = ["D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD"];
const PROD_TAG: ProvenanceTag = { kind: "production", sourceLineage: "fx4-close-test" };
const TENANT = "tenant:za-bank";
const FX_TYPE_URN = "fil:type:fx:spot:otc-vanilla@1.0";
const PERIOD_ID = "2026-06";
const PERIOD_START = "2026-06-01T00:00:00.000Z";
const PERIOD_END = "2026-06-30T23:59:59.999Z";

function instanceUrn(id: string): string {
  return `fil:inst:${ENTITY}:${id}`;
}

function fxCreated(id: string, direction: "long" | "short", notional: string, asOf: string): Event {
  const base = makeFilInstrumentCreated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentCreatedPayloadSchema.parse({
      kind: "FilInstrumentCreated",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1:${id}` },
      initialStage: "active",
      economicTerms: {
        assetClass: "fx",
        notional: { currency: "ZAR", amount: notional },
        direction,
        counterpartyId: "urn:party:legal-entity:standard-bank-za",
        nettingSetId: "NS-test-ZAR",
        currency: "ZAR",
        settlementDate: asOf.slice(0, 10),
        hedgingSetTag: "USD/ZAR",
      },
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

function fxTerminated(id: string, asOf: string): Event {
  const base = makeFilInstrumentTerminated({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: filInstrumentTerminatedPayloadSchema.parse({
      kind: "FilInstrumentTerminated",
      instance: instanceUrn(id),
      type: FX_TYPE_URN,
      tenant: TENANT,
      asOf,
      originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1:${id}` },
      terminalStage: "settled",
    }),
  });
  return { ...base, provenance: PROD_TAG };
}

function seedTreatmentModules(store: EventStore): void {
  for (const m of FX_TREATMENT_MODULES) {
    const ev = makeReportingTreatmentDeclared({
      asOf: "2026-01-01T00:00:00.000Z",
      entity: ENTITY,
      actor: ACTOR,
      citations: CITES,
      payload: m as Parameters<typeof makeReportingTreatmentDeclared>[0]["payload"],
    });
    store.append({ ...ev, provenance: PROD_TAG });
  }
}

function openTheperiod(store: EventStore): void {
  openPeriod({
    eventStore: store,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITES,
    payload: accountingPeriodOpenedPayloadSchema.parse({
      periodId: PERIOD_ID,
      periodKind: "month",
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
      openedAt: PERIOD_START,
      functionalCurrency: "ZAR",
    }),
    provenance: PROD_TAG,
  });
}

beforeEach(() => {
  setDefaultProvenanceModeOverride("production-only");
});
afterEach(() => {
  setDefaultProvenanceModeOverride(undefined);
});

describe("FX4 — closePeriodV2 snapshot is a byte-faithful cache of the fold", () => {
  test("close snapshots the folded TB; re-folding at the snapshot window reproduces it byte-for-byte", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-A", "long", "9260000", "2026-06-01T10:00:00.000Z"));
    store.append(fxCreated("FX-B", "short", "6045000", "2026-06-02T10:00:00.000Z"));
    store.append(fxTerminated("FX-A", "2026-06-03T10:00:00.000Z"));
    openTheperiod(store);

    const result = closePeriodV2({
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: "2026-07-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
    });

    // The close produced a non-vacuous FX trial balance.
    const snapRows = (
      result.trialBalanceSnapshotEvent.payload as unknown as TrialBalanceSnapshottedPayload
    ).rows;
    expect(snapRows.length).toBeGreaterThan(0);
    expect(snapRows.some((r) => r.leafAccountId.startsWith("ACC-2100-"))).toBe(true);

    // Re-fold the primaries at the SAME period window the snapshot was taken at.
    const refold = computeTrialBalanceV2({
      eventStore: store,
      entity: ENTITY,
      periodStart: PERIOD_START,
      periodEnd: PERIOD_END,
    });

    // BYTE-FOR-BYTE: the snapshot rows equal the re-fold rows (the snapshot is a
    // cache of the fold, never divergent state).
    expect(JSON.stringify(snapRows)).toBe(JSON.stringify(refold.rows));
    // And the close result's own trialBalance equals the re-fold (it WAS the fold).
    expect(JSON.stringify(result.trialBalance.rows)).toBe(JSON.stringify(refold.rows));
  });

  test("double-close is refused (idempotent-terminal)", () => {
    const store = new EventStore(":memory:");
    seedTreatmentModules(store);
    store.append(fxCreated("FX-C", "long", "1000000", "2026-06-01T10:00:00.000Z"));
    openTheperiod(store);
    const closeArgs = {
      eventStore: store,
      entity: ENTITY,
      periodId: PERIOD_ID,
      closedAt: "2026-07-01T00:00:00.000Z",
      actor: ACTOR,
      citations: CITES,
      provenance: PROD_TAG,
    };
    closePeriodV2(closeArgs);
    expect(() => closePeriodV2(closeArgs)).toThrow(/already closed/);
  });
});
