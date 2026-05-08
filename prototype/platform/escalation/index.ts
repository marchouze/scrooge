// platform/escalation/index.ts
//
// Public surface of the escalation channel (A3.1, Atlas spec §3.5).

export type {
  AckResult,
  DecideArgs,
  DecideResult,
  DelegateArgs,
  DelegateResult,
  EscalationChannel,
  EscalationFold,
  EscalationStatus,
  EscalationView,
  LocalEscalationChannelOpts,
  OpenArgs,
  OpenResult,
  OverdueResult,
} from "./channel";
export { LocalEscalationChannel, resolveSealedRouting } from "./channel";
