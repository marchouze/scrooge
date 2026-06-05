# `_extractions/` — on-demand regulatory analysis drop-zone

This directory is the **Plane-A drop-zone** for on-demand semantic analyses of regulation
(per `D-REGULATORY-ARCHITECTURE-TWO-PLANE` and `prototype/platform/regulatory/architecture.md`).

Any producer — an interactive Claude/LLM session, an agent, a deterministic script, or a
human — can drop a `*.artefact.json` file here. Each file is a
[`RegulatoryExtractionArtefact`](../../prototype/platform/regulatory/extraction-contract.ts):
nodes + edges conforming to the graph ontology (`prototype/platform/regulatory/graph/types.ts`),
carrying provenance. This is **reference data, not events** — re-derivable, never event-sourced.

## How it flows into the bank

```
*.artefact.json  ──►  seed-projection.ts (seedExtractionArtefacts, every `graph:seed`)
                 └─►  scripts/load-extraction-artefacts.ts (immediate, additive)
                                   │
                                   ▼
                              graph.db  ──►  query.ts (traceObligationChain → riskCategories,
                                             activities, terms, thresholds) ──► dashboard / agents
```

- **Durable across re-seeds.** `seed-projection.ts` truncates and rebuilds `graph.db`, then
  re-ingests every artefact in this directory — so a dropped analysis is never lost on reseed.
- **Immediate load.** `bun run scripts/load-extraction-artefacts.ts` upserts the artefacts
  into the live graph without a full reseed.
- **Presentable / actionable.** Because the nodes/edges land in `graph.db` with ontology types,
  the existing query layer surfaces them. `traceObligationChain(obligationId)` returns the
  obligation's `riskCategories` (ADDRESSES), `activities` (APPLIES_TO_ACTIVITY), `terms` (USES)
  and `thresholds` (SETS); the dashboard graph view renders the nodes/edges directly.

## The contract (what a valid artefact looks like)

Required file-level fields: `instrumentId`, `extractionMethod` (`llm` | `rule-based` | `agent`
| `manual`), `ontology`, `nodes[]`, `edges[]`. Validated at load via
`validateExtractionArtefact()`; a file that fails the contract is **skipped wholesale** (one bad
artefact never pollutes the graph or breaks the seed).

Edges may reference nodes that **already exist** in the graph (obligations `OBL-*`, provisions
`urn:reg:bcbs:*`, taxonomy `RISK-RT-*` / `ACT-ACT-*`) — they need not be redeclared in the file.
Node-type-specific fields (`term`, `definitionText`, `value`, `unit`, `obligationType`,
`actionSummary`, …) are folded into the node's `metadata` (the `graph_nodes` columns are fixed).

Every node/edge should carry `provenance` (`extractionMethod`, `extractorId`, `confidenceScore`,
`extractedAt`) so competing extractions can be attributed and reconciled rather than silently
overwritten. The loader tags everything `metadata.loader = "extraction-artefacts"` and
`metadata.artefactFile = <filename>` for inspection and selective removal:

```sql
DELETE FROM graph_edges WHERE metadata LIKE '%"artefactFile":"<file>"%';
DELETE FROM graph_nodes WHERE metadata LIKE '%"artefactFile":"<file>"%';
```

## Asking for an analysis

A request like *"run an LLM analysis of MAR30–33 and add it to the graph"* produces a new
`<scope>-semantic-extraction.artefact.json` here, with `extractionMethod: "llm"` and provenance
naming the in-session model as `extractorId`. It then loads via the script (immediate) or the
next `graph:seed` (durable).

## Current contents

- `mar12-semantic-extraction.artefact.json` — in-session Claude semantic pass over BCBS MAR12
  ("Definition of trading desk"): 6 `Term` nodes (trading desk, trading account, head trader,
  trader mandate, risk scope, trading limits), 3 `Threshold` nodes, and 100 semantic edges
  (`ADDRESSES` / `APPLIES_TO_ACTIVITY` / `USES` / `SETS` / `DEFINES`) wiring the 25 MAR12
  obligation atoms to the bank's risk/activity taxonomy.
