// platform/recon/regulatory-extraction-coverage.ts
//
// Blocking recon: every regulatory instrument that is registered in the event
// store (via `RegulatoryInstrumentRegistered`) must also have at least one
// `RegulatoryInstrumentContextualised` event AND at least one
// `RegulatoryConceptExtracted` event.
//
// This asserts Mira's horizon-scan pipeline (WS-ONTOLOGY-REG-EXTRACTION) has
// processed every registered instrument end-to-end. Registering an instrument
// without extracting concepts (or without contextualisation) is an incomplete
// state — the projection registers can't surface obligations from a bare
// registration event, so CI must fail.
//
// Mode: blocking — exits non-zero on violations.
//
// Authority: D-ONTOLOGY-REG-EXTRACTION-PHASE-1 (CEO-approved 2026-05-22 via
// session delegation; event `1b2dc554-24ca-4ce0-8c3d-43e41c281ec8`).
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { eventStore } from "../composition";
import { logger } from "../observability/logger";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "regulatory-extraction-coverage";

const CITATIONS = [
  "D-ONTOLOGY-REG-EXTRACTION-PHASE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

export interface RegulatoryExtractionCoverageResult extends ReconResult {
  /** Total registered instruments. */
  registered: number;
  /** Registered + contextualised. */
  contextualised: number;
  /** Registered + has at least one extracted concept. */
  extracted: number;
}

export function runRegulatoryExtractionCoverageRecon(): RegulatoryExtractionCoverageResult {
  const base = emptyResult(PIPELINE);
  const violations: ReconViolation[] = [];

  const registered = new Set<string>();
  const contextualised = new Set<string>();
  const extracted = new Set<string>();

  for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId) registered.add(p.instrumentId);
  }

  for (const event of eventStore.replay({ type: "RegulatoryInstrumentContextualised" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId) contextualised.add(p.instrumentId);
  }

  for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
    const p = event.payload as { instrumentId?: string };
    if (p.instrumentId) extracted.add(p.instrumentId);
  }

  for (const id of registered) {
    if (!contextualised.has(id)) {
      violations.push({
        subject: id,
        message: `Instrument ${id} is registered but has no RegulatoryInstrumentContextualised event. Run \`bun run extract:regulation --instrument ${id}\` to contextualise.`,
        severity: "fail",
      });
    }
    if (!extracted.has(id)) {
      violations.push({
        subject: id,
        message: `Instrument ${id} is registered but has no RegulatoryConceptExtracted event. Run \`bun run extract:regulation --instrument ${id}\` to extract.`,
        severity: "fail",
      });
    }
  }

  base.asserted = registered.size * 2; // two assertions per instrument
  base.violations = violations;
  base.ok = violations.length === 0;

  logger.info({
    pipeline: PIPELINE,
    asserted: base.asserted,
    violations: violations.length,
    registered: registered.size,
    contextualised: contextualised.size,
    extracted: extracted.size,
    citations: CITATIONS,
    msg: `${PIPELINE}: registered=${registered.size}, contextualised=${contextualised.size}, extracted=${extracted.size}, violations=${violations.length}`,
  });

  return {
    ...base,
    registered: registered.size,
    contextualised: contextualised.size,
    extracted: extracted.size,
  };
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const result = runRegulatoryExtractionCoverageRecon();
  console.log(
    JSON.stringify({
      level: result.ok ? "info" : "error",
      time: result.asOf,
      service: "bank-prototype",
      pipeline: result.pipeline,
      asserted: result.asserted,
      violations: result.violations.length,
      ok: result.ok,
      mode: "blocking",
      registered: result.registered,
      contextualised: result.contextualised,
      extracted: result.extracted,
      detail: result.violations.slice(0, 40),
    }),
  );
  process.exit(result.ok ? 0 : 1);
}
