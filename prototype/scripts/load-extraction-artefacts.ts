// prototype/scripts/load-extraction-artefacts.ts
//
// Immediate, ADDITIVE load of on-demand extraction artefacts into graph.db,
// without a full `graph:seed` (which truncates and rebuilds). Use this to make
// a freshly-dropped Regulations/_extractions/*.artefact.json visible in the
// graph straight away; the same artefacts are also re-ingested by every
// `graph:seed` (seed-projection.ts), so the load is durable either way.
//
// Usage:
//   bun run scripts/load-extraction-artefacts.ts
//   BANK_GRAPH_DB=/tmp/g.db bun run scripts/load-extraction-artefacts.ts
//
// Author: generated for the on-demand LLM-analysis capability.

import "../platform/event-store/resolve-event-db-boot";
import { nowUtc } from "../platform/core/types";
import {
  defaultExtractionsDir,
  seedExtractionArtefacts,
} from "../platform/regulatory/graph/extraction-artefact-loader";

const stats = seedExtractionArtefacts(defaultExtractionsDir(), nowUtc());
console.log(JSON.stringify({ dir: defaultExtractionsDir(), ...stats }, null, 2));
