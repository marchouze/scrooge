// platform/simulation-v2-live/register-v2-defaults.ts
//
// V2 simulator roster. Constructs a ThirdPartySimHub (reused as-is from the V1
// hub package — it has zero V1-sim coupling and emits no events) and registers
// ONLY born-V2 modules. The V1 `buildDefaultHub` (register-defaults.ts) is left
// untouched; this is the V2-native parallel roster.
//
// Authority: D-FX-V2-SIMULATOR-FIRST (CEO-approved 2026-06-20);
//   D-V1-REMOVAL-PHASE-1 (no new V1 dependency — born-V2 modules only).

import type { EventStore } from "../event-store/store";
import type { MarketDataStore } from "../market-data/store";
import { ThirdPartySimHub } from "../simulation/hub/index";
import { makeV2FxGenerativeModule } from "./hub-module";

/**
 * Build the V2 simulator hub and register the born-V2 modules against the shared
 * event + market-data stores. The hub is the control surface the dashboard's
 * `/api/v2/sim/*` routes drive.
 */
export function buildV2Hub(args: {
  readonly eventStore: EventStore;
  readonly marketDataStore: MarketDataStore;
}): { hub: ThirdPartySimHub } {
  const hub = new ThirdPartySimHub({ eventStore: args.eventStore });
  hub.register(
    makeV2FxGenerativeModule({
      eventStore: args.eventStore,
      marketDataStore: args.marketDataStore,
    }),
  );
  // Slice 5 registers the born-V2 sub-sims (nostro / correspondent / regulatory-ack).
  return { hub };
}
