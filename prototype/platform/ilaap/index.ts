// platform/ilaap/index.ts
//
// Barrel export for the ILAAP (Internal Liquidity Adequacy Assessment Process) engine.
//
// Exports:
//   - stress-scenarios: runILAAPStressScenarios, makeILAAPRunInputs, ILAAPScenarioResult,
//       ILAAPScenario, ILAAPStatus, ILAAPRunInputs
//   - summary: computeILAAPSummary, ILAAPSummary
//
// Authority: D-TREASURY-GAPS-WAVE1; Banks Act 94/1990; PA ILAAP guidance.
// Author: Atlas (Core banking platform architect, engineering)

export {
  makeILAAPRunInputs,
  runILAAPStressScenarios,
  type ILAAPRunInputs,
  type ILAAPScenario,
  type ILAAPScenarioResult,
  type ILAAPStatus,
} from "./stress-scenarios";

export { computeILAAPSummary, type ILAAPSummary } from "./summary";
