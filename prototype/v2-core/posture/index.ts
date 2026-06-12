// v2-core/posture/index.ts
//
// Barrel export for the posture sub-package.
//
// Public surface:
//   applies-when   — AppliesToScope type, PostureContext, evaluateAppliesToScope
//   events         — PostureRegistered / Activated / Deactivated / Revised payloads
//   projection     — PostureRegister, foldPostureRegister, emptyPostureRegister
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

export * from "./applies-when";
export * from "./events";
export * from "./projection";
