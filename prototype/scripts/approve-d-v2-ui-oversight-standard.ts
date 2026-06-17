import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordDecision } from "../runtime/decisions/record";

recordDecision(
  {
    decisionId: "D-V2-UI-OVERSIGHT-STANDARD",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "V2 UI human-oversight standard — every surface gives the human visibility into AI functions",
    category: "engineering",
    recommendation:
      "Adopt a standing UI standard (docs/v2-ui-oversight-standard.md) binding every V2 surface, current and future: " +
      "each must give a human direct visibility into the AI function behind it via four content types — " +
      "key metrics (tile + formula + constituents, drill to a detail page, never a modal), " +
      "tables/registers (every row drills to item detail), reports (generated returns viewable in-UI), " +
      "and schemas (event kinds + payload shapes browsable). " +
      "Cross-cutting rules: explicit provenance via the existing provenance-badge mechanism + the Prod/+Sim toggle; " +
      "drill-through not dead-ends; no silent gaps; a clean /api/v2/* data layer reading canonical sources directly. " +
      "First slice (this PR): Schemas & substrate — /api/v2/schemas, /api/v2/schemas/:type, /api/v2/substrate " +
      "backing operations/schemas.html, operations/schema.html and a wired operations/substrate.html. " +
      "Follow-on slices (financial metrics, registers, report viewer, errors/decision-required) each land as their own PR built to this standard.",
    rationale:
      "The bank is autonomous by default; the human oversees the residual (Principle 6). Oversight is only real if the " +
      "human can see what the AI is doing across every function — key metrics, tables, reports, schemas. Making that a " +
      "build-time obligation (not a separate 'oversight dashboard') ensures every V2 page ships as an oversight surface. " +
      "Marc set this as general guidance for the ongoing V2 UI build and chose the clean /api/v2/* data layer, " +
      "Schemas & substrate as the first slice, and a full event-schema browser. CEO approved in session 2026-06-17.",
    sourceDocHashes: [],
    citations: ["Principles/6-autonomous-by-default.md", "docs/v2-ui-oversight-standard.md"],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
