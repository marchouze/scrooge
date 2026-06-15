// scripts/import-distilled-obligations.ts
//
// Offline importer for distilled obligation JSON (the co-work distill output:
// `{ instrument, obligations: [...] }`, each obligation carrying an
// LLM-proposed `appliesToScope`). It is the script counterpart to the dashboard
// adopt route (`handleRegAdoptObligations` in dashboard/server.ts) and mirrors
// its emission EXACTLY: per obligation it emits `ObligationAdopted` and then the
// W8 Slice C applicability lifecycle (`ApplicabilityAssessment{Requested,
// Performed,Concluded}`), reusing the same platform helpers — no new event types.
//
// Why a script rather than POSTing to a running dashboard: the importer binds an
// EXPLICIT event store (`BANK_EVENT_DB`), so there is no ambiguity about which
// store receives the permanent, append-only records. It is idempotent (skips
// obligations already adopted and assessments already concluded) and reusable
// for future distilled regulations (BCBS CRE, etc.).
//
// Usage:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db \
//     bun run scripts/import-distilled-obligations.ts [path] [--dry-run]
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
  assessObligationApplicability,
  buildBankPostureContexts,
  concludedAssessmentIds,
  obligationAssessmentId,
  readPostureRegister,
} from "../platform/obligations/applicability";
import { loadBankObligations } from "../platform/obligations/projection";
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
interface DistilledFile {
  instrument: string;
  obligations: DistilledObligation[];
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const path =
  args.find((a) => !a.startsWith("--")) ?? `${homedir()}/Desktop/bcbs-mar-obligations.json`;

const doc = JSON.parse(readFileSync(path, "utf8")) as DistilledFile;
if (!doc.instrument || !Array.isArray(doc.obligations)) {
  throw new Error(`malformed distilled file: ${path} (need { instrument, obligations[] })`);
}

const now = nowUtc();
const slug = doc.instrument;
const existing = new Set(loadBankObligations(eventStore).map((o) => o.id));
const contexts = buildBankPostureContexts(readPostureRegister(eventStore));
const alreadyAssessed = concludedAssessmentIds(eventStore);

const applicabilityActor = { type: "service" as const, id: "agent:mira:obligation-applicability" };
const applicabilityCitations = [
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

let adopted = 0;
let skippedExisting = 0;
let skippedBad = 0;
const tally: Record<string, number> = { applies: 0, "does-not-apply": 0, "partially-applies": 0 };

console.log(
  `${dryRun ? "[DRY-RUN] " : ""}importing ${doc.obligations.length} obligation(s) from ${slug}`,
);
console.log(`store: ${process.env.BANK_EVENT_DB ?? "(default)"} | as-of ${now}`);
console.log("");

for (const ob of doc.obligations) {
  if (!ob.obligationId || !ob.requirement) {
    skippedBad++;
    console.log(`  SKIP (missing id/requirement): ${ob.obligationId ?? "(no id)"}`);
    continue;
  }
  if (existing.has(ob.obligationId)) {
    skippedExisting++;
    console.log(`  SKIP (already adopted): ${ob.obligationId}`);
    continue;
  }

  // Explicit scope wins (validated); a malformed scope falls through to the
  // conservative extractor — mirrors the adopt route.
  let explicitScope: AppliesToScope | undefined;
  if (ob.appliesToScope !== undefined) {
    const parsed = appliesToScopeSchema.safeParse(ob.appliesToScope);
    if (parsed.success) explicitScope = parsed.data;
    else console.log(`  WARN (malformed appliesToScope, using extractor): ${ob.obligationId}`);
  }

  const { appliesToScope, contextsEvaluated, result } = assessObligationApplicability(
    {
      obligationId: ob.obligationId,
      derivesFrom: ob.derivesFrom ?? [],
      domain: ob.domain ?? "",
      citation: slug,
      ...(explicitScope !== undefined ? { appliesToScope: explicitScope } : {}),
    },
    contexts,
  );
  tally[result.verdict] = (tally[result.verdict] ?? 0) + 1;
  console.log(
    `  ${dryRun ? "WOULD ADOPT" : "ADOPT"} ${ob.obligationId.padEnd(10)} → ${result.verdict}`,
  );

  if (dryRun) {
    adopted++;
    continue;
  }

  // Verbatim snapshot: prefer the file's verbatim quotes (the bcbs-mar slug may
  // not resolve in the structured-doc loader on this worktree).
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
  adopted++;

  const assessmentId = obligationAssessmentId(ob.obligationId, now);
  if (alreadyAssessed.has(assessmentId)) continue;
  alreadyAssessed.add(assessmentId);

  eventStore.append(
    makeApplicabilityAssessmentRequested({
      asOf: now,
      entity: "LE-ZA-HOZ-BANK",
      actor: applicabilityActor,
      citations: applicabilityCitations,
      payload: {
        assessmentId,
        subjectRef: ob.obligationId,
        subjectKind: "obligation",
        appliesToScope,
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
        contextsEvaluated,
        matches: result.matches,
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
        verdict: result.verdict,
        appliesToContexts: result.matches,
        rationale: result.rationale,
        concludedBy: applicabilityActor.id,
        concludedAt: now,
        citations: applicabilityCitations,
      },
    }),
  );
}

console.log("");
console.log(
  `${dryRun ? "[DRY-RUN] " : ""}done: ${adopted} ${dryRun ? "would-adopt" : "adopted"}, ` +
    `${skippedExisting} skipped (existing), ${skippedBad} skipped (malformed)`,
);
console.log(
  `verdicts: ${tally.applies} applies / ${tally["does-not-apply"]} does-not-apply / ${tally["partially-applies"]} partially-applies`,
);
