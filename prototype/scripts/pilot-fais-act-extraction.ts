// scripts/pilot-fais-act-extraction.ts
//
// Pilot script: FAIS Act 37/2002 regulatory horizon scan.
//
// Reads the FAIS Act source text, registers the instrument in the event
// store, extracts obligation concepts for every section using Claude, links
// concepts to existing obligations-register rows, and writes a candidate
// obligations report.
//
// Usage:
//   bun run prototype/scripts/pilot-fais-act-extraction.ts
//
// Prerequisites:
//   - Set ANTHROPIC_API_KEY to enable Claude extraction.
//     If unset, the script exits cleanly (no CI failure).
//   - Optionally set BANK_CLAUDE_MODEL to control which model is used.
//     Recommended: claude-haiku-4-5 for bulk extraction (lower cost).
//
// Author: Mira (Compliance / RegTech engineer, engineering)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore } from "../platform/composition";
import { BANK_ZA_001 } from "../platform/core/types";
import { hashContent } from "../platform/document-store/hash";
import { defaultDocumentStore } from "../platform/document-store/local-fs";
import { makeRegulatoryInstrumentRegistered } from "../platform/event-store/event-types/regulatory";
import type { Actor } from "../platform/event-store/types";
import { extractConcepts } from "../platform/regulatory/concept-extractor";
import { linkToObligations } from "../platform/regulatory/obligation-linker";
import { claudeAvailable } from "../runtime/claude";
import { formatPreflightFailure, preflightForWorkload } from "../runtime/preflight";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const REPO_ROOT = resolve(import.meta.dir, "../..");
const FAIS_ACT_PATH = resolve(REPO_ROOT, "Regulations/FSCA/source-docs/fais-act-37-2002.txt");
const OBLIGATIONS_REGISTER_PATH = resolve(REPO_ROOT, "Regulations/_obligations-register.md");
const OWNER_INBOX = resolve(REPO_ROOT, "Owner Inbox");
const INSTRUMENT_ID = "FAIS-ACT-37-2002";

const MIRA_ACTOR: Actor = {
  type: "service",
  id: "agent:mira:fais-horizon-scan",
};

const CITATIONS = ["FAIS-ACT-37-2002", "ORG-CD-01"];

// ---------------------------------------------------------------------------
// Guard: Claude availability
// ---------------------------------------------------------------------------

if (!claudeAvailable()) {
  console.log(
    "ANTHROPIC_API_KEY is not set — Claude extraction unavailable.\n" +
      "Set ANTHROPIC_API_KEY to run the full FAIS Act extraction.\n" +
      "Exiting cleanly (no CI failure).",
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Preflight probe — realistic workload-shape check before bulk work.
//
// A 1-token ping passes whenever the account has any non-zero credit; it
// doesn't reflect whether enough credit exists for the per-section call.
// Mira hit this on 2026-05-22 — the 1-token preflight passed but every
// real ~5k-input/~500-output call returned `credit balance too low`.
// `preflightForWorkload` sends one realistically-sized call and reports
// back; we exit cleanly with a useful error if it fails.
// ---------------------------------------------------------------------------

const PILOT_PREFLIGHT_OPTS = {
  model: process.env.BANK_CLAUDE_MODEL ?? "claude-haiku-4-5",
  estimatedInputTokens: 5_000,
  estimatedOutputTokens: 500,
  // FAIS Act has roughly 60 sections; per-section call is one Claude
  // invocation. Echoed back in the failure message for budget context.
  expectedCallCount: 60,
};

console.log(
  `Preflight: probing ${PILOT_PREFLIGHT_OPTS.model} for ~${PILOT_PREFLIGHT_OPTS.estimatedInputTokens}-token input × ~${PILOT_PREFLIGHT_OPTS.estimatedOutputTokens}-token output workload (${PILOT_PREFLIGHT_OPTS.expectedCallCount} calls planned)...`,
);
const preflight = await preflightForWorkload(PILOT_PREFLIGHT_OPTS);
if (!preflight.ok) {
  console.error(formatPreflightFailure(preflight, PILOT_PREFLIGHT_OPTS));
  // credit_too_low / auth_failed → operator action needed; exit 1.
  // overloaded → transient, also exit 1 so a wrapper can retry.
  // key_missing is handled by claudeAvailable() above; shouldn't reach here.
  process.exit(1);
}
console.log(
  `Preflight OK — ${preflight.model} responded (${preflight.usage.inputTokens} in / ${preflight.usage.outputTokens} out).`,
);

// ---------------------------------------------------------------------------
// Step 1: Read FAIS Act source text
// ---------------------------------------------------------------------------

console.log(`Reading FAIS Act from: ${FAIS_ACT_PATH}`);
let fullText: string;
try {
  fullText = readFileSync(FAIS_ACT_PATH, "utf-8");
} catch (e) {
  console.error(`ERROR: Could not read FAIS Act source: ${(e as Error).message}`);
  process.exit(1);
}
console.log(`Read ${fullText.length.toLocaleString()} bytes.`);

// ---------------------------------------------------------------------------
// Step 2: Compute content hash and put in document store
// ---------------------------------------------------------------------------

const contentHash = hashContent(fullText);
const docStore = defaultDocumentStore;
const putResult = docStore.put(fullText);
console.log(
  `Document store: ${putResult.isNew ? "stored new" : "already present"} — hash: ${contentHash}`,
);

// ---------------------------------------------------------------------------
// Step 3: Check if already registered; if not, register
// ---------------------------------------------------------------------------

let alreadyRegistered = false;
for (const event of eventStore.replay({ type: "RegulatoryInstrumentRegistered" })) {
  const p = event.payload as { instrumentId?: string };
  if (p.instrumentId === INSTRUMENT_ID) {
    alreadyRegistered = true;
    break;
  }
}

if (alreadyRegistered) {
  console.log(`${INSTRUMENT_ID} already registered in event store — skipping registration.`);
} else {
  const now = new Date().toISOString();
  const registrationEvent = makeRegulatoryInstrumentRegistered({
    asOf: now,
    entity: BANK_ZA_001,
    actor: MIRA_ACTOR,
    citations: CITATIONS,
    payload: {
      instrumentId: INSTRUMENT_ID,
      title: "Financial Advisory and Intermediary Services Act 37 of 2002",
      issuingBody: "Parliament",
      instrumentType: "act",
      jurisdiction: "ZA",
      publicationDate: "2002-11-15",
      effectiveDate: "2004-10-01",
      gazetteRef: "GG-24079",
      version: "2002-orig",
      contentHash,
    },
  });
  eventStore.append(registrationEvent);
  console.log(`${INSTRUMENT_ID} registered.`);
}

// ---------------------------------------------------------------------------
// Step 4: Extract concepts
// ---------------------------------------------------------------------------

console.log("\nExtracting concepts from FAIS Act sections...");
const extractionResult = await extractConcepts({
  instrumentId: INSTRUMENT_ID,
  fullText,
  actor: MIRA_ACTOR,
  eventStore,
});

console.log(`Concepts emitted: ${extractionResult.conceptsEmitted}`);
console.log(`Sections skipped (idempotent): ${extractionResult.skipped}`);
console.log(`High-applicability sections (>=0.7): ${extractionResult.highApplicability.length}`);

// ---------------------------------------------------------------------------
// Step 5: Link to obligations register
// ---------------------------------------------------------------------------

console.log("\nLinking concepts to obligations register...");
const linkResult = await linkToObligations({
  instrumentId: INSTRUMENT_ID,
  obligationsRegisterPath: OBLIGATIONS_REGISTER_PATH,
  actor: MIRA_ACTOR,
  eventStore,
});

console.log(`Obligations linked: ${linkResult.linked}`);
console.log(`Unlinked high-relevancy concepts: ${linkResult.unlinkedHighRelevancy}`);

// ---------------------------------------------------------------------------
// Step 6: Compute summary stats from event store
// ---------------------------------------------------------------------------

let totalApplicability = 0;
let totalRelevancy = 0;
let sectionCount = 0;

for (const event of eventStore.replay({ type: "RegulatoryConceptExtracted" })) {
  const p = event.payload as {
    instrumentId?: string;
    applicabilityScore?: number;
    relevancyScore?: number;
  };
  if (p.instrumentId !== INSTRUMENT_ID) continue;
  totalApplicability += p.applicabilityScore ?? 0;
  totalRelevancy += p.relevancyScore ?? 0;
  sectionCount++;
}

const avgApplicability = sectionCount > 0 ? totalApplicability / sectionCount : 0;
const avgRelevancy = sectionCount > 0 ? totalRelevancy / sectionCount : 0;

// ---------------------------------------------------------------------------
// Step 7: Print summary table
// ---------------------------------------------------------------------------

const highCount = extractionResult.highApplicability.length;

console.log(`
FAIS Act Extraction Summary
===========================
Sections processed:           ${sectionCount}
Concepts emitted:             ${extractionResult.conceptsEmitted}
Avg applicability:            ${avgApplicability.toFixed(2)}
Avg relevancy:                ${avgRelevancy.toFixed(2)}
High-applicability (>=0.7):   ${highCount}
Obligations linked:           ${linkResult.linked}
Unlinked high-relevancy:      ${linkResult.unlinkedHighRelevancy} (candidate new obligations)
`);

// ---------------------------------------------------------------------------
// Step 8: Write candidate obligations report to Owner Inbox
// ---------------------------------------------------------------------------

if (linkResult.candidates.length > 0) {
  const today = new Date().toISOString().slice(0, 10);
  const reportPath = resolve(OWNER_INBOX, `${today}_mira_fais-candidate-obligations.md`);

  const rows = linkResult.candidates
    .sort((a, b) => b.applicabilityScore - a.applicabilityScore)
    .map(
      (c) =>
        `| ${c.sectionId} | ${c.applicabilityScore.toFixed(2)} | ${c.relevancyScore.toFixed(2)} | ${c.actionSummary} | ${c.domain.join(", ")} | ${c.riskTaxonomy.join(", ")} |`,
    )
    .join("\n");

  const report = `---
title: FAIS Act — Candidate New Obligations
date: ${today}
author: Mira (Compliance / RegTech engineer, engineering)
instrument: ${INSTRUMENT_ID}
decision-required: false
---

# FAIS Act — Candidate New Obligations

> Generated by \`scripts/pilot-fais-act-extraction.ts\` on ${today}.
> ${linkResult.candidates.length} sections scored ≥0.6 applicability but have no matching obligations-register row.
> Review and add rows to \`Regulations/_obligations-register.md\` as appropriate.

| Section | Applicability | Relevancy | Action Summary | Domain | Risk Taxonomy |
|---------|--------------|-----------|---------------|--------|---------------|
${rows}

## Extraction Stats

| Metric | Value |
|--------|-------|
| Sections processed | ${sectionCount} |
| Concepts emitted | ${extractionResult.conceptsEmitted} |
| Avg applicability | ${avgApplicability.toFixed(2)} |
| Avg relevancy | ${avgRelevancy.toFixed(2)} |
| High-applicability (≥0.7) | ${highCount} |
| Obligations linked | ${linkResult.linked} |
| Unlinked high-relevancy | ${linkResult.unlinkedHighRelevancy} |
`;

  writeFileSync(reportPath, report, "utf-8");
  console.log(`Candidate obligations report written to: ${reportPath}`);
} else {
  console.log("No candidate unlinked obligations — all high-relevancy sections are covered.");
}
