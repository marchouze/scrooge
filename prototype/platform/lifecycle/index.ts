// platform/lifecycle/index.ts
//
// Re-exports from the onboarding orchestrator. Consumers import from
// `@platform/lifecycle` rather than referencing the internal module path.
//
// Author: Atlas (Core banking platform architect, engineering)

export type {
  CounterpartyOnboardingState,
  OnboardingBoardView,
  OnboardingPhase,
} from "./onboarding-orchestrator";
export { buildOnboardingBoardView, derivePhaseFromEvents } from "./onboarding-orchestrator";
