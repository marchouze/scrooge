// runtime/agents/callables/env.ts
// Per-agent callable map for Env (External Environment Simulator).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import envReadiness from "../env-readiness";

export const ENV_CALLABLES: Record<string, AgentRunHandler> = {
  "env:readiness": envReadiness,
};
