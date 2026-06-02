// scripts/seed-financial-instruments.ts
//
// Idempotent seed runner for the FinancialInstrument security master.
//
// Emits FinancialInstrumentDefined (+ FinancialInstrumentClassified where a
// classification payload exists) for a representative set across the bank's
// tradeable instrument types, so the /instruments page and the trade-book
// instrument selector are populated immediately. Reference data is tagged
// `build-phase-fixture` (it describes instruments the bank is able to transact
// in, independent of any held position or build phase).
//
// Idempotency: the runner replays the store first and skips any instrumentId
// that already has a FinancialInstrumentDefined event, so re-running it is a
// no-op (zero new events on the second run).
//
// Run (against the shared home store):
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//   BANK_PERMISSION_GATE_DISABLED=true \
//   bun run scripts/seed-financial-instruments.ts
//
// The events are local-store only — not committed — consistent with the
// boot-seed phase-out pattern (seed logic lives in platform/seed modules +
// idempotent scripts, not the boot path).
//
// Citations: D-FINANCIAL-INSTRUMENT-ENTITY (CEO-approved 2026-05-22);
//   ACTUS-FRF-V1.1.

import { clock, eventStore } from "../platform/composition";
import { buildPhaseFixtureTag } from "../platform/event-store/provenance";
import type { Actor } from "../platform/event-store/types";
import {
  type FinancialInstrumentClassifiedPayload,
  type FinancialInstrumentDefinedPayload,
  makeFinancialInstrumentClassified,
  makeFinancialInstrumentDefined,
} from "../platform/markets/cdm/instrument";
import {
  JSE_EQUITY_CLASSIFIED_PAYLOADS,
  JSE_EQUITY_DEFINED_PAYLOADS,
} from "../seeds/financial-instruments/jse-equities";
import {
  SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS,
  SA_GOVERNMENT_BOND_DEFINED_PAYLOADS,
} from "../seeds/financial-instruments/sa-government-bonds";
import {
  ZAR_IRS_CLASSIFIED_PAYLOADS,
  ZAR_IRS_DEFINED_PAYLOADS,
} from "../seeds/financial-instruments/zar-irs";
import { TREASURY_INSTRUMENT_DEFINED_PAYLOADS } from "../seeds/treasury/instrument-definitions-seed";

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR: Actor = { type: "service", id: "agent:kai:instrument-master" };
const CITATIONS = ["D-FINANCIAL-INSTRUMENT-ENTITY", "ACTUS-FRF-V1.1"];
const PROVENANCE = buildPhaseFixtureTag({
  sourceLineage: "scripts:seed-financial-instruments",
  tags: ["security-master", "reference-data"],
});

const DEFINED: FinancialInstrumentDefinedPayload[] = [
  ...SA_GOVERNMENT_BOND_DEFINED_PAYLOADS,
  ...JSE_EQUITY_DEFINED_PAYLOADS,
  ...ZAR_IRS_DEFINED_PAYLOADS,
  ...TREASURY_INSTRUMENT_DEFINED_PAYLOADS,
];

const CLASSIFIED: FinancialInstrumentClassifiedPayload[] = [
  ...SA_GOVERNMENT_BOND_CLASSIFIED_PAYLOADS,
  ...JSE_EQUITY_CLASSIFIED_PAYLOADS,
  ...ZAR_IRS_CLASSIFIED_PAYLOADS,
];

// Collect instrumentIds that already have a FinancialInstrumentDefined event.
const existingDefined = new Set<string>();
const existingClassified = new Set<string>();
for (const e of eventStore.replay()) {
  if (e.type === "FinancialInstrumentDefined") {
    existingDefined.add(String((e.payload as { instrumentId?: string }).instrumentId));
  } else if (e.type === "FinancialInstrumentClassified") {
    existingClassified.add(String((e.payload as { instrumentId?: string }).instrumentId));
  }
}

const asOf = clock.now();
let definedAppended = 0;
let classifiedAppended = 0;

for (const payload of DEFINED) {
  if (existingDefined.has(payload.instrumentId)) continue;
  const event = makeFinancialInstrumentDefined({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload,
  });
  eventStore.append({ ...event, provenance: PROVENANCE });
  existingDefined.add(payload.instrumentId);
  definedAppended += 1;
  console.log(`+ defined  ${payload.instrumentId} (${payload.actusContractType})`);
}

for (const payload of CLASSIFIED) {
  if (existingClassified.has(payload.instrumentId)) continue;
  // Only classify instruments that are now defined in the store.
  if (!existingDefined.has(payload.instrumentId)) continue;
  const event = makeFinancialInstrumentClassified({
    asOf,
    entity: ENTITY,
    actor: ACTOR,
    citations: CITATIONS,
    payload,
  });
  eventStore.append({ ...event, provenance: PROVENANCE });
  existingClassified.add(payload.instrumentId);
  classifiedAppended += 1;
  console.log(`+ classified ${payload.instrumentId}`);
}

console.log(
  `\nseed-financial-instruments: ${definedAppended} defined, ${classifiedAppended} classified appended ` +
    `(${DEFINED.length} candidate instruments, ${CLASSIFIED.length} classifications).`,
);
