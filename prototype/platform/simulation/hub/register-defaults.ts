// platform/simulation/hub/register-defaults.ts
//
// Single source of the core-slice 3rd-party simulator roster. Constructs a
// ThirdPartySimHub and registers every module. Deferred modules (KYC-lookup,
// SARB-portal submit, breach sequence, inbound-message-set, and descriptor-only
// stubs) are added in a follow-up slice.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION. Scrooge session-delegation (Marc).

import type { EventStore } from "../../event-store/store";
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
}): { hub: ThirdPartySimHub; custodianSim: StdbankCustodianSim } {
  const hub = new ThirdPartySimHub({ eventStore: args.eventStore });
  hub.register(makeCounterpartyFxRequestModule(args.envSimEngine));
  hub.register(makeMarketDataFeedModule(args.envSimEngine));
  hub.register(makeNostroStatementModule(args.envSimEngine));
  hub.register(makeCorrespondentAdviceModule(args.envSimEngine));
  hub.register(makeRegulatoryAckModule(args.envSimEngine));
  const custodianSim = new StdbankCustodianSim(args.eventStore);
  custodianSim.start();
  hub.register(custodianSim);
  return { hub, custodianSim };
}
