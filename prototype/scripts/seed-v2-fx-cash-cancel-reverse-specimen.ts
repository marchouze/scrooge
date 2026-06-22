// scripts/seed-v2-fx-cash-cancel-reverse-specimen.ts
//
// Seed the v2 ANCHOR store with ONE cancelled-FX-with-materialised-cash specimen
// so `recon:fx-cash-reverse-coherence` is NON-VACUOUS (MV-CASH-002) and GREEN.
//
// WHY THIS SEED EXISTS
// --------------------
// The reverse-coherence gate (D-FIL-CONSUMER-SURFACE-ARCHITECTURE) polices the
// case the backfill does NOT produce: an FX FIL instance that materialised cash
// and was then CANCELLED. The standing anchor book only carries SETTLED FX
// (`S1-FX-FIXTURE-USD-SETTLED-001`), so without this specimen the gate's
// non-vacuity guard would fail on the CLI (nothing to assert). This seed lands the
// canonical specimen — the real defect-then-fix the workstream closes:
//
//   1. a cancelled FX instance-of-record (terminalStage "cancelled");
//   2. its materialised cash leg(s) (carrying `originatingInstrument` → the FX);
//   3. the cash leg(s) CANCELLED alongside the parent (the reverse cascade made
//      durable as event-store truth — no manual reconcile, no phantom).
//
// The result: a cancelled parent whose derived cash is itself terminated. The gate
// examines it (non-vacuous), finds no phantom, and passes. The cascade
// (`effectiveLiveCashInstances`) also voids it for any consumer read.
//
// IDEMPOTENT / replay-safe: every append is guarded on the sink's
// hasCreated/hasTerminated, so a re-run emits 0 new events (Principle 1).
//
// This specimen is INERT to every other gate: the FX is `cancelled` (not
// `settled`), so the settled-FX-only gates (cash-materialisation-integrity
// completeness, fx-cash-gl-recognition-integrity, fx-settlement-continuity) skip
// it; the cash carries a valid `originatingInstrument` so the orphan check passes.
//
// Authority: D-FIL-CONSUMER-SURFACE-ARCHITECTURE (CEO-approved 2026-06-22);
//   D-CASH-ASSET-CLASS-V1; D-FIL-FRAMEWORK-UNIFICATION; Principle 1.
// Author: Atlas (Core banking platform architect, engineering).

import { anchorFunctionalCurrency } from "../platform/identity/functional-currency";
import { resolveV2AnchorDb } from "../platform/markets/products/materialise-settled-cash";
import { materialiseFxInstanceToAnchor } from "../platform/markets/products/materialise-settled-cash";
import { resolveMaturityMaterialisation } from "../platform/markets/products/maturity-materialisation";
import { AnchorDbCashSink } from "../platform/markets/settlement/cash-sink";
import { formatInstanceUrn, formatTypeUrn } from "../v2-core/fil-core/urn";
import {
  type SettledCashLeg,
  buildSettledCashPayloads,
} from "../v2-core/fil-instances/cash-materialisation";
import { filInstrumentTerminatedPayloadSchema } from "../v2-core/fil-instances/events";

const ENTITY = "LE-ZA-HOZ-BANK";
const TENANT = ENTITY;
const REPORTING = anchorFunctionalCurrency();

const FX_SPOT_TYPE_URN = formatTypeUrn({
  assetClass: "fx",
  familyPath: "spot",
  typeSlug: "otc-vanilla",
  version: { major: 1, minor: 0 },
});

const TRADE_ID = "S1-FX-FIXTURE-USD-CANCELLED-001";
const COUNTERPARTY = "urn:party:legal-entity:investec-bank-za";
const NETTING_SET = "NS-investec-USD";

// Materialisation rate matches the settled USD fixture (USD 100k @ 18.52) so the
// specimen reads as a realistic cancelled twin of the settled fixture.
const USD_MAJOR = 100_000;
const ZAR_MAJOR = 1_852_000;

const CREATED_TS = "2026-06-01T09:00:00.000Z";
const SETTLED_TS = "2026-06-03T09:00:00.000Z"; // when the cash was materialised
const CANCELLED_TS = "2026-06-05T09:00:00.000Z"; // the later cancellation of both legs

const CITATIONS = [
  "D-FIL-CONSUMER-SURFACE-ARCHITECTURE",
  "D-CASH-ASSET-CLASS-V1",
  "D-FIL-FRAMEWORK-UNIFICATION",
  "P1-EVENTS-AS-TRUTH",
];

function main(): void {
  const dbPath = resolveV2AnchorDb();
  const fxInstance = formatInstanceUrn({ tenant: TENANT, instanceId: TRADE_ID });

  // The cash legs (both legs — received USD, paid ZAR) of the cancelled trade.
  const legs: SettledCashLeg[] = [
    { currency: "USD", signedMajor: USD_MAJOR, side: "received" },
    { currency: REPORTING, signedMajor: -ZAR_MAJOR, side: "paid" },
  ];

  // 1 + cancel — the FX instrument-of-record, created then cancelled. Idempotent.
  const fxResult = materialiseFxInstanceToAnchor({
    fxInstance,
    fxTypeUrn: FX_SPOT_TYPE_URN,
    entity: ENTITY,
    tenant: TENANT,
    createdAsOf: CREATED_TS,
    economicTerms: {
      assetClass: "fx",
      notional: { currency: REPORTING, amount: String(ZAR_MAJOR) },
      direction: "long",
      counterpartyId: COUNTERPARTY,
      nettingSetId: NETTING_SET,
      currency: REPORTING,
      settlementDate: SETTLED_TS,
      hedgingSetTag: `USD/${REPORTING}`,
    },
    originatingEvent: { eventType: "Ws-v2-s1-fixture-book", eventId: `s1-fixture:${TRADE_ID}` },
    terminal: { stage: "cancelled", asOf: CANCELLED_TS },
  });

  // 2 — materialise the cash leg(s), each linked back to the FX. The maturity rule
  // is read off the FX product (the same source the production path uses); if it
  // does not declare a cash rule the seed emits nothing for the cash (fail-closed,
  // no fabrication).
  const rule = resolveMaturityMaterialisation(FX_SPOT_TYPE_URN);
  if (!rule || rule.materialisesAssetClass !== "cash") {
    throw new Error(
      `reverse-coherence specimen: FX type ${FX_SPOT_TYPE_URN} declares no cash maturity rule — cannot materialise the specimen cash (root-cause: product binding missing). Fail-closed.`,
    );
  }
  const cashLegs = rule.bothLegs ? legs : legs.filter((l) => l.side === "received");
  const built = buildSettledCashPayloads({
    tradeId: TRADE_ID,
    tenant: TENANT,
    reporting: REPORTING,
    counterpartyId: COUNTERPARTY,
    nettingSetId: NETTING_SET,
    settledAsOf: SETTLED_TS,
    fxInstance,
    legs: cashLegs,
    originatingEvent: { eventType: "SettlementConfirmed", eventId: fxInstance },
    cashTypeUrn: rule.materialisesTypeUrn,
  });

  const sink = new AnchorDbCashSink(dbPath);
  let cashCreated = 0;
  let cashCancelled = 0;
  try {
    for (const leg of built) {
      // 2 — cash created (if absent).
      if (!sink.hasCreated(leg.instance)) {
        sink.appendCreated({
          asOf: SETTLED_TS,
          entity: ENTITY,
          citations: CITATIONS,
          payload: leg.payload,
        });
        cashCreated += 1;
      }
      // 3 — cash CANCELLED alongside its parent (the reverse cascade as durable
      // truth). terminalStage MUST be "cancelled" (the canonical FX-settlement
      // builder stamps "settled", which is wrong here), so the payload is built
      // directly through the validated schema with terminalStage "cancelled".
      if (!sink.hasTerminated(leg.instance)) {
        sink.appendTerminated({
          asOf: CANCELLED_TS,
          entity: ENTITY,
          citations: CITATIONS,
          payload: filInstrumentTerminatedPayloadSchema.parse({
            kind: "FilInstrumentTerminated",
            instance: leg.instance,
            type: rule.materialisesTypeUrn,
            tenant: TENANT,
            asOf: CANCELLED_TS,
            originatingEvent: { eventType: "BookingCancelled", eventId: fxInstance },
            terminalStage: "cancelled",
          }),
        });
        cashCancelled += 1;
      }
    }
  } finally {
    sink.close();
  }

  console.log(
    `seed:v2-fx-cash-cancel-reverse-specimen → anchor ${dbPath}: ` +
      `fx created=${fxResult.created} cancelled=${fxResult.terminated}; ` +
      `cash created=${cashCreated} cancelled=${cashCancelled} (idempotent; re-run emits 0).`,
  );
}

main();
