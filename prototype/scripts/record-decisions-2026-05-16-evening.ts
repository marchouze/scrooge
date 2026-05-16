// scripts/record-decisions-2026-05-16-evening.ts
//
// One-shot: emit CeoDecision(approve) for D-DECISIONS-FRAMEWORK-REDESIGN per
// Marc's in-session approval ("yes" on 2026-05-16). Owen's brief landed via
// PR #447 (merge commit 5d99e1e). Recorded under scrooge:session-delegation.
//
// Idempotent: re-running is a no-op if the event already exists.

import { recordDelegatedDecision } from "../runtime/decisions/record";

const ASOF = "2026-05-16T11:45:00.000Z";

const result = recordDelegatedDecision(
  {
    decisionId: "D-DECISIONS-FRAMEWORK-REDESIGN",
    action: "approve",
    title:
      "Decisions framework redesign — unified Decision event + single authoring path + full backfill",
    outcome:
      "Owen (Company Secretary, governance) + Atlas (Core banking platform architect)'s redesign of the decision-recording substrate approved as specified in plan file /Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md. Authorises: (1) one unified Decision event family with phase + authority discriminators (CEO, Board, AC, BRC, ALCO, CRO, CCO, CFO, COO, CISO, CAE, IO, CoSec, Agent); (2) single recordDecision authoring path, deprecating recordCeoDecision / recordDelegatedDecision / direct /api/decide event construction; (3) events-only projection at prototype/projections/decisions.ts, retiring the filesystem scan and curated JSON cache in dashboard/derive.ts; (4) slug registry + auto-suggest with hygiene recon; (5) four new recon gates wired into bun run ci. Slice A (types + projection + dashboard switch) authorised for immediate dispatch under the no-pause rule. Slices B-D follow as their own PRs.",
    comment: "approve — chat-intake 2026-05-16 (Marc: 'yes')",
    sourceDoc: "Owner Inbox/2026-05-16_owen-atlas_decisions-framework-redesign_ceo-decision.md",
    followOnRoutes: ["atlas:slice-a-decision-event-type-and-projection"],
  },
  ASOF,
);

console.log(
  `Recorded CeoDecision(approve) D-DECISIONS-FRAMEWORK-REDESIGN — event ${result.eventId}`,
);
