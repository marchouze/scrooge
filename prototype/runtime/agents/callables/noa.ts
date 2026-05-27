// runtime/agents/callables/noa.ts
// Per-agent callable map for Noa (Intranet Product Owner & UI Architect).
// To add a handler: add the import and entry here, then add one spread in handler-callables.ts.

import type { AgentRunHandler } from "../../types";
import noaDesignReviewComplete from "../noa-design-review-complete";
import noaFeatureShipped from "../noa-feature-shipped";
import noaOpsCycle from "../noa-ops-cycle";
import noaUxFindingRaised from "../noa-ux-finding-raised";

export const NOA_CALLABLES: Record<string, AgentRunHandler> = {
  "noa:feature-shipped": noaFeatureShipped,
  "noa:design-review-complete": noaDesignReviewComplete,
  "noa:ux-finding-raised": noaUxFindingRaised,
  "noa:ops-cycle": noaOpsCycle,
};
