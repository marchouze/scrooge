// platform/alco/index.ts
//
// Public surface of the ALCO pack generator module.
//
// Exports:
//   - generateALCOPack(asOf: string): ALCOPack — assembles the pack from events
//   - serialiseALCOPack(pack: ALCOPack): string — renders pack as markdown
//   - Type exports: ALCOPack and all section types
//
// Authority: D-TREASURY-GAPS-WAVE1.
// Author: Atlas (Core banking platform architect, engineering)

export { generateALCOPack } from "./pack";
export type {
  ALCOPack,
  ALMSection,
  FTPSection,
  HQLASection,
  ILAAPSection,
  IntradaySection,
  LiquiditySection,
  RiskItem,
  RiskItemSection,
} from "./pack";

export { serialiseALCOPack } from "./serialise";
