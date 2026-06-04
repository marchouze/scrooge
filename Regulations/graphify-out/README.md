# graphify-out — exploratory, NOT the canonical regulatory store

**Status:** exploratory analysis artefact. **Out of the canonical regulatory pipeline**
(`D-REGULATORY-ARCHITECTURE-TWO-PLANE`).

This directory holds output from the general-purpose `/graphify` skill (a code/doc →
knowledge-graph tool with its *own* node/edge schema). It is **not** part of the
two-plane regulatory architecture:

- **Plane A — Regulatory Knowledge** (the canonical reference graph) is the bank
  ontology graph (`graph.db`), fed by pluggable extractors emitting the single
  `RegulatoryExtractionArtefact` contract (`prototype/platform/regulatory/extraction-contract.ts`)
  and loaded by `prototype/platform/regulatory/graph/seed-projection.ts`.
- Nothing in the regulatory ingestion path, the loader, or the recon gates reads
  this directory. It is regenerated ad hoc via `scripts/export-to-graphify.ts`
  and is safe to delete.

Do not wire `graphify-out/` into the regulatory pipeline. For "what does the
regulation say / source obligations", use the reference graph; for "what the bank
has accepted", use the event store. See `prototype/platform/regulatory/architecture.md`.
