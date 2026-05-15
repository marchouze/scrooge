// runtime/agents/metadata/_entry.ts
// Shared entry() helper for per-agent metadata modules.
// Do not import this from outside runtime/agents/metadata/.

import type { HandlerMetadata } from "../../handlers-metadata";

export function entry(
  agent: string,
  trigger: string,
  kind: HandlerMetadata["kind"],
  extras: {
    cadenceHours?: number;
    subscribesTo?: readonly string[];
    cronExpression?: string;
  } = {},
): HandlerMetadata {
  return {
    agent,
    trigger,
    kind,
    ...(extras.cadenceHours !== undefined ? { cadenceHours: extras.cadenceHours } : {}),
    ...(extras.subscribesTo !== undefined ? { subscribesTo: extras.subscribesTo } : {}),
    ...(extras.cronExpression !== undefined ? { cronExpression: extras.cronExpression } : {}),
    key: `${agent.toLowerCase()}:${trigger}`,
  };
}
