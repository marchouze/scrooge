// scripts/decisions/record-d-coop-banks-regs-out-of-scope.ts
//
// Records D-COOP-BANKS-REGS-OUT-OF-SCOPE — Marc's in-session direction
// (2026-06-20) to completely remove the Co-operative Banks / CFI guidance notes
// and directives from the regulatory library as out of applicable scope.
//
// ## Why this exists
//
// The regulatory-library acquisition swept in the SARB Prudential Authority's
// Co-operative Banks / Co-operative Financial Institution (CFI) guidance notes
// and directives (GN 1/2019, GN 2/2019, GN 1/2020, GN 2/2020, GN 1/2021,
// D 1/2023, GN 1/2026). These instruments govern co-operative banks and CFIs
// under the Co-operative Banks Act framework — NOT a commercial bank licensed
// under the Banks Act 94 of 1990. They carried zero adopted bank obligations
// and zero linked source obligations: nothing in the executable chain depended
// on them. They are out of applicable scope and are removed.
//
// ## Scope (approved)
//
//   1. Delete the `Regulations/CoopBanks/` source corpus (7 structured docs +
//      raw text).
//   2. Remove the 7 CFI/Co-op entries from the `extract:regulations` registry so
//      re-extraction cannot recreate them.
//   3. Drop the stale gn2-2019 target from the one-off guidance-note-stub cleanup.
//   4. Regenerate `Regulations/_source-coverage.json` (filesystem-driven) so the
//      coverage register and the dashboard regulations list no longer surface
//      them.
//
// No obligations, policies, or procedures cite these instruments, so removal is
// non-destructive to the Regulation→Provision→Obligation chain.
//
// ## Session-delegation
//
// Marc (CEO) directed the removal in-session 2026-06-20; Scrooge (Chief of
// Staff) is the recording instrument (recordedVia: scrooge:session-delegation).
//
// Idempotent: fixed asOf. NO Date.now() / new Date().
//
// Author: Scrooge (Chief of Staff / Orchestrator) — recording instrument.

import "../../platform/event-store/resolve-event-db-boot";

import { recordDecision, requestDecision } from "../../runtime/decisions/record";

const DECISION_ID = "D-COOP-BANKS-REGS-OUT-OF-SCOPE";
const REQUESTED_ASOF = "2026-06-20T07:44:00.000Z";
const ASOF = "2026-06-20T07:45:00.000Z";

const TITLE =
  "Co-operative Banks / CFI guidance notes & directives — out of applicable scope; remove from regulatory library";

const CITATIONS = ["D-REGULATORY-LIBRARY-V1"];

requestDecision(
  {
    decisionId: DECISION_ID,
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "compliance",
    recommendation:
      "Remove the SARB Prudential Authority Co-operative Banks / CFI guidance " +
      "notes and directives from the regulatory library — they are not applicable " +
      "to a Banks-Act commercial bank.",
    rationale: "Opens the decision lifecycle (2026-06-20).",
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  REQUESTED_ASOF,
);

const result = recordDecision(
  {
    decisionId: DECISION_ID,
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title: TITLE,
    category: "compliance",
    recommendation:
      "Completely remove the Co-operative Banks / CFI corpus (GN 1/2019, GN 2/2019, " +
      "GN 1/2020, GN 2/2020, GN 1/2021, D 1/2023, GN 1/2026): delete the " +
      "Regulations/CoopBanks/ source docs, strip the entries from the " +
      "extract:regulations registry and the guidance-note-stub cleanup target list, " +
      "and regenerate the source-coverage register.",
    rationale:
      "Marc (CEO) directed the removal in-session 2026-06-20. These instruments " +
      "govern co-operative banks and Co-operative Financial Institutions under the " +
      "Co-operative Banks Act framework, not a commercial bank licensed under the " +
      "Banks Act 94 of 1990. All 7 carried zero adopted bank obligations and zero " +
      "linked source obligations, so removal does not break any Regulation→Provision→" +
      "Obligation chain. Keeping out-of-scope instruments in the library dilutes the " +
      "applicable regulatory perimeter and clutters the compliance surface.",
    sourceDocHashes: [],
    citations: CITATIONS,
    recordedVia: "scrooge:session-delegation",
  },
  ASOF,
);

console.log(
  JSON.stringify({
    ok: !!result.eventId,
    decisionId: DECISION_ID,
    eventId: result.eventId,
    phase: "approved",
    msg: result.eventId
      ? `${DECISION_ID} recorded (approved)`
      : `${DECISION_ID} record FAILED — no eventId returned`,
  }),
);

if (!result.eventId) process.exit(1);
