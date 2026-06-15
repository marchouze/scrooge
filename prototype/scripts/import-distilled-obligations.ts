// scripts/import-distilled-obligations.ts
//
// Offline importer for distilled obligation JSON (the co-work distill output).
// It is the script counterpart to the dashboard adopt route
// (`handleRegAdoptObligations` in dashboard/server.ts) and mirrors its emission
// EXACTLY: per obligation it emits `ObligationAdopted` and then the W8 Slice C
// applicability lifecycle (`ApplicabilityAssessment{Requested,Performed,
// Concluded}`), reusing the same platform helpers — no new event types.
//
// Two input shapes are accepted:
//   • single:       { instrument, obligations: [...] }            (e.g. one standard)
//   • consolidated: { standards: [ { instrument, obligations[] }, ... ] }
//                                                                 (e.g. all of BCBS)
//
// BATCHED imports: a consolidated file is imported one STANDARD at a time. Pass
// `--standard <instrument>` (repeatable) or `--standards <csv>` to import only a
// subset — so you can run the import in several reviewable batches (one standard
// per run). With no filter, every standard in the file is imported. `--list`
// prints the standards + obligation counts without importing.
//
// Why a script rather than POSTing to a running dashboard: the importer binds an
// EXPLICIT event store (`BANK_EVENT_DB`), so there is no ambiguity about which
// store receives the permanent, append-only records. It is idempotent (skips
// obligations already adopted and assessments already concluded), `--dry-run`
// guards a final preview.
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/import-distilled-obligations.ts [path] [flags]
//   flags: --dry-run | --list | --standard <inst> | --standards <csv>
//   path defaults to ~/Desktop/bcbs-mar-obligations.json
//
// Authority: D-W8-POSTURE-REGISTER-SLICE-1; D-REGULATORY-ARCHITECTURE-TWO-PLANE;
//   Principle 1 (events are truth). Adoption actor = Marc (CEO), in-session.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { eventStore } from "../platform/composition";
import { nowUtc } from "../platform/core/types";
import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import { makeObligationAdopted } from "../platform/event-store/event-types/obligation-lifecycle";
import {
  type ObligationApplicabilityResult,
  assessObligationApplicability,
  buildBankPostureContexts,
  concludedAssessmentIds,
  obligationAssessmentId,
  readPostureRegister,
} from "../platform/obligations/applicability";
import { loadBankObligations } from "../platform/obligations/projection";
import type { AssessedContext } from "../v2-core/applicability";
import { type AppliesToScope, appliesToScopeSchema } from "../v2-core/posture";

interface DistilledObligation {
  obligationId: string;
  urn?: string;
  domain?: string;
  owner?: string;
  requirement: string;
  derivesFrom?: string[];
  verbatimSourceText?: Record<string, string>;
  appliesToScope?: unknown;
}
interface DistilledBlock {
  instrument: string;
  obligations: DistilledObligation[];
}
// Consolidated form: { standards: DistilledBlock[] }. A single block ({ instrument,
// obligations }) is also accepted and normalised to a one-element list.
interface ConsolidatedFile {
  standards?: DistilledBlock[];
  instrument?: string;
  obligations?: DistilledObligation[];
}

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const listOnly = argv.includes("--list");
const path =
  argv.find((a) => !a.startsWith("--")) ?? `${homedir()}/Desktop/bcbs-mar-obligations.json`;

function flagValues(name: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === name && argv[i + 1]) out.push(argv[i + 1] as string);
  }
  return out;
}
// --standard <inst> (repeatable) and --standards <csv> both select a subset.
const selected = new Set(
  [...flagValues("--standard"), ...flagValues("--standards").flatMap((v) => v.split(","))]
    .map((s) => s.trim())
    .filter(Boolean),
);

// ---------------------------------------------------------------------------
// Load + normalise to blocks
// ---------------------------------------------------------------------------

const raw = JSON.parse(readFileSync(path, "utf8")) as ConsolidatedFile;
let blocks: DistilledBlock[];
if (Array.isArray(raw.standards)) {
  blocks = raw.standards;
} else if (raw.instrument && Array.isArray(raw.obligations)) {
  blocks = [{ instrument: raw.instrument, obligations: raw.obligations }];
} else {
  throw new Error(
    `malformed distilled file: ${path} (need { instrument, obligations[] } or { standards: [...] })`,
  );
}
for (const b of blocks) {
  if (!b.instrument || !Array.isArray(b.obligations)) {
    throw new Error(
      `malformed standard block (need { instrument, obligations[] }): ${JSON.stringify(b).slice(0, 120)}`,
    );
  }
}

const chosen = selected.size > 0 ? blocks.filter((b) => selected.has(b.instrument)) : blocks;

// --list: enumerate standards + counts and exit (no import).
if (listOnly) {
  console.log(`${blocks.length} standard(s) in ${path}:`);
  for (const b of blocks) {
    const mark = selected.size > 0 && !selected.has(b.instrument) ? "  (skipped by filter)" : "";
    console.log(
      `  ${b.instrument.padEnd(14)} ${String(b.obligations.length).padStart(4)} obligation(s)${mark}`,
    );
  }
  process.exit(0);
}

if (selected.size > 0) {
  const missing = [...selected].filter((s) => !blocks.some((b) => b.instrument === s));
  if (missing.length) console.log(`WARN: requested standard(s) not in file: ${missing.join(", ")}`);
  if (chosen.length === 0)
    throw new Error("no matching standards to import (check --standard/--standards)");
}

// ---------------------------------------------------------------------------
// Shared setup (one posture/context snapshot for the whole run)
// ---------------------------------------------------------------------------

const now = nowUtc();
const existing = new Set(loadBankObligations(eventStore).map((o) => o.id));
const contexts = buildBankPostureContexts(readPostureRegister(eventStore));
const alreadyAssessed = concludedAssessmentIds(eventStore);

const applicabilityActor = { type: "service" as const, id: "agent:mira:obligation-applicability" };
const applicabilityCitations = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

interface BlockStats {
  adopted: number;
  skippedExisting: number;
  skippedBad: number;
  tally: Record<string, number>;
}

function emitAssessment(
  obligationId: string,
  r: ObligationApplicabilityResult,
  evaluated: AssessedContext[],
): void {
  const assessmentId = obligationAssessmentId(obligationId, now);
  if (alreadyAssessed.has(assessmentId)) return;
  alreadyAssessed.add(assessmentId);
  eventStore.append(
    makeApplicabilityAssessmentRequested({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: applicabilityActor,
      citations: applicabilityCitations,
      payload: {
        assessmentId,
        subjectRef: obligationId,
        subjectKind: "obligation",
        appliesToScope: r.appliesToScope,
        requestedBy: applicabilityActor.id,
        citations: applicabilityCitations,
      },
    }),
  );
  eventStore.append(
    makeApplicabilityAssessmentPerformed({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: applicabilityActor,
      citations: applicabilityCitations,
      payload: {
        assessmentId,
        contextsEvaluated: evaluated,
        matches: r.result.matches,
        performedBy: applicabilityActor.id,
        performedAt: now,
      },
    }),
  );
  eventStore.append(
    makeApplicabilityAssessmentConcluded({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: applicabilityActor,
      citations: applicabilityCitations,
      payload: {
        assessmentId,
        verdict: r.result.verdict,
        appliesToContexts: r.result.matches,
        rationale: r.result.rationale,
        concludedBy: applicabilityActor.id,
        concludedAt: now,
        citations: applicabilityCitations,
      },
    }),
  );
}

function importBlock(block: DistilledBlock): BlockStats {
  const stats: BlockStats = {
    adopted: 0,
    skippedExisting: 0,
    skippedBad: 0,
    tally: { applies: 0, "does-not-apply": 0, "partially-applies": 0 },
  };
  const slug = block.instrument;
  console.log(`\n── ${slug} (${block.obligations.length} obligation(s)) ──`);
  for (const ob of block.obligations) {
    if (!ob.obligationId || !ob.requirement) {
      stats.skippedBad++;
      console.log(`  SKIP (missing id/requirement): ${ob.obligationId ?? "(no id)"}`);
      continue;
    }
    if (existing.has(ob.obligationId)) {
      stats.skippedExisting++;
      console.log(`  SKIP (already adopted): ${ob.obligationId}`);
      continue;
    }

    let explicitScope: AppliesToScope | undefined;
    if (ob.appliesToScope !== undefined) {
      const parsed = appliesToScopeSchema.safeParse(ob.appliesToScope);
      if (parsed.success) explicitScope = parsed.data;
      else console.log(`  WARN (malformed appliesToScope, using extractor): ${ob.obligationId}`);
    }

    const assessed = assessObligationApplicability(
      {
        obligationId: ob.obligationId,
        derivesFrom: ob.derivesFrom ?? [],
        domain: ob.domain ?? "",
        citation: slug,
        ...(explicitScope !== undefined ? { appliesToScope: explicitScope } : {}),
      },
      contexts,
    );
    stats.tally[assessed.result.verdict] = (stats.tally[assessed.result.verdict] ?? 0) + 1;
    console.log(
      `  ${dryRun ? "WOULD ADOPT" : "ADOPT"} ${ob.obligationId.padEnd(12)} → ${assessed.result.verdict}`,
    );

    if (dryRun) {
      stats.adopted++;
      continue;
    }

    const verbatim: Record<string, string> = {};
    for (const provId of ob.derivesFrom ?? []) {
      const q = ob.verbatimSourceText?.[provId];
      if (q) verbatim[provId] = q;
    }
    eventStore.append(
      makeObligationAdopted({
        asOf: now,
        entity: "LE-ZA-HOZ-BANK",
        actor: { type: "human", id: "marc@tgv.co.za" },
        citations: ["D-REGULATORY-ARCHITECTURE-TWO-PLANE", "P1-EVENTS-AS-TRUTH"],
        payload: {
          obligationId: ob.obligationId,
          urn: ob.urn ?? "",
          domain: ob.domain ?? "",
          citation: slug,
          requirement: ob.requirement,
          fulfilmentPolicy: "",
          owner: ob.owner ?? "",
          status: "active",
          derivesFrom: ob.derivesFrom ?? [],
          ...(Object.keys(verbatim).length > 0 ? { verbatimSourceText: verbatim } : {}),
          adoptedAt: now,
        },
      }),
    );
    existing.add(ob.obligationId);
    stats.adopted++;
    emitAssessment(ob.obligationId, assessed, assessed.contextsEvaluated);
  }
  console.log(
    `  → ${slug}: ${stats.adopted} ${dryRun ? "would-adopt" : "adopted"}, ${stats.skippedExisting} existing, ${stats.skippedBad} malformed ` +
      `| ${stats.tally.applies} applies / ${stats.tally["does-not-apply"]} does-not-apply`,
  );
  return stats;
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(
  `${dryRun ? "[DRY-RUN] " : ""}importing ${chosen.length} of ${blocks.length} standard(s) from ${path}`,
);
console.log(`store: ${process.env.BANK_EVENT_DB ?? "(default)"} | as-of ${now}`);

const totals: BlockStats = {
  adopted: 0,
  skippedExisting: 0,
  skippedBad: 0,
  tally: { applies: 0, "does-not-apply": 0, "partially-applies": 0 },
};
for (const block of chosen) {
  const s = importBlock(block);
  totals.adopted += s.adopted;
  totals.skippedExisting += s.skippedExisting;
  totals.skippedBad += s.skippedBad;
  for (const k of Object.keys(s.tally))
    totals.tally[k] = (totals.tally[k] ?? 0) + (s.tally[k] ?? 0);
}

console.log(
  `\n${dryRun ? "[DRY-RUN] " : ""}TOTAL across ${chosen.length} standard(s): ` +
    `${totals.adopted} ${dryRun ? "would-adopt" : "adopted"}, ${totals.skippedExisting} skipped (existing), ${totals.skippedBad} skipped (malformed)`,
);
console.log(
  `verdicts: ${totals.tally.applies} applies / ${totals.tally["does-not-apply"]} does-not-apply / ${totals.tally["partially-applies"]} partially-applies`,
);
