// platform/lifecycle/index.ts
//
// Re-exports from the lifecycle modules. Consumers import from
// `@platform/lifecycle` rather than referencing internal module paths.
//
// Author: Atlas (Core banking platform architect, engineering)

export type {
  CounterpartyOnboardingState,
  OnboardingBoardView,
  OnboardingPhase,
} from "./onboarding-orchestrator";
export { buildOnboardingBoardView, derivePhaseFromEvents } from "./onboarding-orchestrator";

// Trade lifecycle registry + projection (added 2026-05-22)
export type {
  LifecycleDefinition,
  LifecycleState,
  LifecycleTerminalCondition,
  TerminalPath,
} from "./trade-lifecycle-registry";
export {
  TRADE_LIFECYCLE_REGISTRY,
  findLifecycleByOpeningEvent,
  findLifecycleForEventType,
  getLifecycleStage,
} from "./trade-lifecycle-registry";
export type { LifecycleInstance } from "./trade-lifecycle-projection";
export { buildTradeLifecycleView } from "./trade-lifecycle-projection";
