// platform/simulation/fx-sim-engine.ts
//
// @deprecated — use EnvSimEngine from platform/simulation/env-sim
// Kept for backward compatibility. Remove after all callers migrated.
//
// Authority: D-FX-SALES-TRADING-FRONTEND; D-MARKETS-SCHEMA-FOUNDATION.
// Author: Devon (Chief Operating Officer, engineering)

export {
  EnvSimEngine as FxSimEngine,
  type EnvSimOptions as SimConfig,
  type EnvSimStatus as SimStatus,
} from "./env-sim/index";

/** @deprecated Use EventStore directly. Kept for backward compatibility only. */
export type { EventStore as IEventStore } from "../event-store/store";
