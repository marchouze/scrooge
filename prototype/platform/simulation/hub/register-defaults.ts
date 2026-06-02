// platform/simulation/hub/register-defaults.ts
//
// Single source of the core-slice 3rd-party simulator roster. Constructs a
// ThirdPartySimHub and registers every module. Deferred modules (KYC-lookup,
// SARB-portal submit, breach sequence, inbound-message-set, and descriptor-only
// stubs) are added in a follow-up slice.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import type { EventStore } from "../../event-store/store";
import { CorrespondentNostroSimulator } from "../env-sim/correspondent-nostro-sim";
import { mulberry32 } from "../env-sim/counterparty-profiles";
import type { EnvSimEngine } from "../env-sim/index";
import { StdbankCustodianSim } from "../stdbank-custodian-sim/index";
import {
  makeCorrespondentAdviceModule,
  makeCounterpartyFxRequestModule,
  makeMarketDataFeedModule,
  makeNostroStatementModule,
  makeRegulatoryAckModule,
} from "./adapters/env-sim";
import { ThirdPartySimHub } from "./index";

export function buildDefaultHub(args: {
  eventStore: EventStore;
  envSimEngine: EnvSimEngine;
}): {
  hub: ThirdPartySimHub;
  custodianSim: StdbankCustodianSim;
  correspondentNostroSim: CorrespondentNostroSimulator;
} {
  const hub = new ThirdPartySimHub({ eventStore: args.eventStore });
  hub.register(makeCounterpartyFxRequestModule(args.envSimEngine));
  hub.register(makeMarketDataFeedModule(args.envSimEngine));
  hub.register(makeNostroStatementModule(args.envSimEngine));
  hub.register(makeCorrespondentAdviceModule(args.envSimEngine));
  hub.register(makeRegulatoryAckModule(args.envSimEngine));
  const custodianSim = new StdbankCustodianSim(args.eventStore);
  custodianSim.start();
  hub.register(custodianSim);
  // Correspondent intraday nostro (MT942 + FundingDrawnDown) — standalone
  // SimulatorModule. Seeded PRNG → deterministic intraday outflow sequence.
  // Loop is operator-started via the hub (not auto-started) like the env-sim
  // sub-simulators; the fire("tick") action drives a single interim report.
  const correspondentNostroSim = new CorrespondentNostroSimulator({
    store: args.eventStore,
    rng: mulberry32(0x1042),
    intervalMs: 60_000,
  });
  hub.register(correspondentNostroSim);
  return { hub, custodianSim, correspondentNostroSim };
}
