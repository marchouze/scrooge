// scripts/seed-ifrs-accounting-posture.ts
//
// Option 1 (W8 accounting-elections discrimination): seed the bank's IFRS
// accounting-policy posture dimensions and RE-SCOPE the affected IFRS
// obligations so genuine electives the bank does NOT hold resolve to
// "does-not-apply" instead of the blunt jurisdiction-ZA "applies".
//
// Confirmed elections (CEO session-delegation, 2026-06-15):
//   • hedge accounting          → NOT applied   (build-phase: no designated IFRS 9 Ch.6 relationships)
//   • FVOCI equity election      → NOT elected    (no equity investments; strategy excludes JSE equity)
//   • fair-value option (FVO)    → NOT elected
//   • puttable-instruments-as-equity → ABSENT     (bank issues ordinary shares only)
//   • all transaction-driven flags (asset transfers/repos, IBOR reform, non-financial-asset FV,
//     simplified ECL, compound & credit-derivative instruments) → KEEP "applies" (conservative).
//
// CONSERVATIVE GUARD: an IFRS obligation is re-scoped to does-not-apply ONLY when
// EVERY dimension it was flagged under is in the confirmed-not-held set. If it is
// ALSO flagged under any keep-applies dimension, it stays "applies" (over-include,
// never wrongly exclude). The re-scope appends a fresh ApplicabilityAssessment
// (distinct assessmentId, later as-of) that supersedes the import's "applies"
// verdict; the obligation events themselves are never mutated (Principle 1).
//
// Reads the flagged obligation ids + dimensions from the distilled file's
// `suggestedPostureDimensions` block, so it stays in sync with the distill.
//
// Run against the shared store:
//   BANK_EVENT_DB=$HOME/.local/share/bank/event.db bun run scripts/seed-ifrs-accounting-posture.ts [path] [--dry-run]
//   path defaults to ~/Desktop/ifrs-accounting-obligations.json
//
// Authority: D-IFRS-ACCOUNTING-POSTURE-BUILD-PHASE (recorded here); D-W8-POSTURE-REGISTER-SLICE-1.
// Author: Mira (Chief Obligations & Regulatory Officer, compliance), elections confirmed by Marc (CEO).

import "../platform/event-store/resolve-event-db-boot";

import { readFileSync } from "node:fs";
import { homedir } from "node:os";

import { clock, eventStore } from "../platform/composition";
import {
  makeApplicabilityAssessmentConcluded,
  makeApplicabilityAssessmentPerformed,
  makeApplicabilityAssessmentRequested,
} from "../platform/event-store/event-types/applicability-assessment";
import {
  makePostureActivated,
  makePostureRegistered,
} from "../platform/event-store/event-types/posture";
import { provenanceForEmit } from "../platform/event-store/provenance";
import type { Event } from "../platform/event-store/types";
import {
  buildBankPostureContexts,
  readPostureRegister,
} from "../platform/obligations/applicability";
import { recordDecision } from "../runtime/decisions/record";
import { assessApplicability } from "../v2-core/applicability";
import type { CitationRef, Instant } from "../v2-core/fil-core/primitives";
import type { AppliesToScope, PostureContext } from "../v2-core/posture";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const path =
  argv.find((a) => !a.startsWith("--")) ?? `${homedir()}/Desktop/ifrs-accounting-obligations.json`;

const ENTITY = "LE-ZA-HOZ-BANK";
const ACTOR = { type: "service" as const, id: "agent:mira:obligations-officer" };
const ASSESS_ACTOR = { type: "service" as const, id: "agent:mira:obligation-applicability" };
const DECISION_ID = "D-IFRS-ACCOUNTING-POSTURE-BUILD-PHASE";
const CITATIONS = [
  DECISION_ID,
  "D-W8-POSTURE-REGISTER-SLICE-1",
  "P1-EVENTS-AS-TRUTH",
  "P2-SINGLE-GRAPH-DISCIPLINE",
];

const SCOPE_ZA_BANK: AppliesToScope = {
  kind: "and",
  conditions: [
    { kind: "jurisdiction", jurisdiction: "ZA" },
    { kind: "entity-type", entityType: "bank" },
  ],
};

// ── Confirmed posture dimensions: held value (bank's actual posture) + the gating
//    value an obligation must require to bind. Bank does NOT hold the gating value,
//    so a gating-scoped obligation resolves to does-not-apply. ───────────────────
interface AcctDim {
  key: string;
  heldValue: string; // bank's actual posture (held=true)
  gatingValue: string; // value an obligation requires (held=false for the bank)
  description: string;
}
const ACCT_DIMS: AcctDim[] = [
  {
    key: "accounting.hedge-accounting",
    heldValue: "not-applied",
    gatingValue: "applied",
    description:
      "IFRS 9 Chapter 6 hedge accounting election. The build-phase bank designates no formal hedge-accounting relationships (economic FX/NOP hedging is not the IFRS 9 Ch.6 election). Held value: not-applied.",
  },
  {
    key: "accounting.fvoci-equity-election",
    heldValue: "not-elected",
    gatingValue: "elected",
    description:
      "IFRS 9 irrevocable election to present equity-investment fair-value changes in OCI. The bank holds no equity investments (strategy excludes JSE equity). Held value: not-elected.",
  },
  {
    key: "accounting.fair-value-option",
    heldValue: "not-elected",
    gatingValue: "elected",
    description:
      "IFRS 9 fair-value option (designating financial assets/liabilities at FVTPL to remove an accounting mismatch / for liabilities). Not taken by the build-phase bank. Held value: not-elected.",
  },
  {
    key: "accounting.puttable-instruments-equity",
    heldValue: "absent",
    gatingValue: "present",
    description:
      "IAS 32 puttable-instruments-classified-as-equity. The bank issues ordinary shares only — no puttable instruments. Held value: absent.",
  },
];
// Map every flagged dimensionKey in the distilled file to the confirmed dim above
// (the 3 FVO sub-keys consolidate onto accounting.fair-value-option).
const KEY_TO_DIM: Record<string, AcctDim> = {};
for (const d of ACCT_DIMS) KEY_TO_DIM[d.key] = d;
KEY_TO_DIM["accounting.fair-value-option-financial-assets"] = KEY_TO_DIM[
  "accounting.fair-value-option"
] as AcctDim;
KEY_TO_DIM["accounting.fair-value-option-financial-liabilities"] = KEY_TO_DIM[
  "accounting.fair-value-option"
] as AcctDim;

const EXCLUDED_KEYS = new Set(Object.keys(KEY_TO_DIM));

// ---------------------------------------------------------------------------
// Read the distilled file's suggestedPostureDimensions → per-obligation flags
// ---------------------------------------------------------------------------
interface SuggestedDim {
  dimensionKey: string;
  appliesToObligationIds?: string[];
}
const file = JSON.parse(readFileSync(path, "utf8")) as {
  suggestedPostureDimensions?: SuggestedDim[];
};
const flags = new Map<string, Set<string>>(); // obligationId → set of dimensionKeys it was flagged under
for (const sd of file.suggestedPostureDimensions ?? []) {
  for (const id of sd.appliesToObligationIds ?? []) {
    if (!flags.has(id)) flags.set(id, new Set());
    flags.get(id)?.add(sd.dimensionKey);
  }
}

// An obligation is re-scoped only if EVERY dimension it was flagged under is excluded
// (none is a keep-applies dimension). Pick the gating scope from its first excluded key.
const rescopes: { obligationId: string; gating: AcctDim }[] = [];
let keptForSafety = 0;
for (const [id, keys] of flags) {
  const allExcluded = [...keys].every((k) => EXCLUDED_KEYS.has(k));
  if (!allExcluded) {
    keptForSafety++;
    continue;
  }
  const firstExcluded = [...keys].find((k) => EXCLUDED_KEYS.has(k));
  if (firstExcluded)
    rescopes.push({ obligationId: id, gating: KEY_TO_DIM[firstExcluded] as AcctDim });
}

console.log(
  `${dryRun ? "[DRY-RUN] " : ""}IFRS accounting posture — store: ${process.env.BANK_EVENT_DB ?? "(default)"}`,
);
console.log(
  `flagged obligations: ${flags.size} | re-scope (does-not-apply): ${rescopes.length} | kept applies (co-flagged keep-applies): ${keptForSafety}`,
);

// ---------------------------------------------------------------------------
// 1. Record the Decision (idempotent)
// ---------------------------------------------------------------------------
const asOf = clock.now();
let decisionAlready = false;
for (const ev of eventStore.replay({ type: "Decision" })) {
  const p = ev.payload as { decisionId?: string; phase?: string };
  if (p.decisionId === DECISION_ID && p.phase === "approved") decisionAlready = true;
}
if (!dryRun && !decisionAlready) {
  recordDecision(
    {
      decisionId: DECISION_ID,
      phase: "approved",
      authority: "CEO",
      authorityRef: "marc@tgv.co.za",
      title:
        "Build-phase IFRS accounting-policy posture: hedge accounting not applied; FVOCI-equity, fair-value option, puttable-as-equity not held",
      category: "finance",
      recommendation:
        "Seed the bank's IFRS accounting-policy posture dimensions (accounting.hedge-accounting=not-applied, accounting.fvoci-equity-election=not-elected, accounting.fair-value-option=not-elected, accounting.puttable-instruments-equity=absent) and re-scope the corresponding IFRS obligations so they resolve to does-not-apply. All transaction-driven IFRS flags (asset transfers/repos, IBOR/JIBAR reform, non-financial-asset fair value, simplified ECL, compound & credit-derivative instruments) are kept at applies (conservative over-inclusion).",
      rationale:
        "The IFRS obligation set (IFRS 9/13/7) was adopted with a blunt jurisdiction-ZA 'applies' scope because no accounting posture dimensions existed. These four elections are genuinely not held by the build-phase bank, so their obligations do not bind it; recording them as posture + re-scoping makes the position auditable and automatically reversible (flip the posture if the bank later elects). Conservative guard: an obligation co-flagged under any transaction-driven (kept) dimension stays applies, so no obligation is wrongly excluded. Accounting-policy authority is the CFO seat; recorded here under CEO session-delegation in the build phase.",
      sourceDocHashes: [],
      citations: [
        "D-W8-POSTURE-REGISTER-SLICE-1",
        "P1-EVENTS-AS-TRUTH",
        "P2-SINGLE-GRAPH-DISCIPLINE",
      ],
      recordedVia: "scrooge:session-delegation",
    },
    asOf,
  );
  console.log(`[decision] ${DECISION_ID} recorded`);
} else {
  console.log(
    `[decision] ${DECISION_ID} ${decisionAlready ? "already approved — skip" : "(dry-run)"}`,
  );
}

// ---------------------------------------------------------------------------
// 2. Seed accounting.* postures (held + gating value per dimension), idempotent
// ---------------------------------------------------------------------------
const activePostures = new Set<string>();
for (const ev of eventStore.replay({ type: "PostureActivated" })) {
  const id = (ev.payload as { postureId?: string }).postureId;
  if (id) activePostures.add(id);
}
const postureBatch: Event[] = [];
function queuePosture(key: string, value: string, held: boolean, description: string): void {
  const postureId = `posture:${key}:${value}`;
  if (activePostures.has(postureId)) {
    console.log(`  [skip] ${postureId} — already active`);
    return;
  }
  const parameters = { dimensionKey: key, dimensionValue: value, held };
  postureBatch.push(
    makePostureRegistered({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        postureId,
        postureClass: "compliance-stance",
        description,
        appliesToScope: SCOPE_ZA_BANK,
        appliesToTier: "all",
        proposedBy: "Mira (Chief Obligations & Regulatory Officer, compliance)",
        citations: CITATIONS as unknown as CitationRef[],
        parameters,
      },
    }),
  );
  postureBatch.push(
    makePostureActivated({
      asOf,
      entity: ENTITY,
      actor: ACTOR,
      citations: CITATIONS,
      payload: {
        postureId,
        appliesToScope: SCOPE_ZA_BANK,
        activatedAt: asOf as unknown as Instant,
        authority: DECISION_ID,
        citations: CITATIONS as unknown as CitationRef[],
      },
    }),
  );
  console.log(`  [queue] ${postureId} (held=${held})`);
}
for (const d of ACCT_DIMS) {
  queuePosture(d.key, d.heldValue, true, d.description);
  queuePosture(
    d.key,
    d.gatingValue,
    false,
    `${d.description} (gating value — not held by the anchor).`,
  );
}
if (!dryRun) {
  for (const ev of postureBatch)
    eventStore.append(ev, { provenance: provenanceForEmit("PostureRegistered") });
}
console.log(
  `[postures] ${dryRun ? "would emit" : "emitted"} ${postureBatch.length} events (${postureBatch.length / 2} postures)`,
);

// ---------------------------------------------------------------------------
// 3. Re-scope the affected obligations (fresh assessment, distinct id, later as-of)
// ---------------------------------------------------------------------------
// Build contexts AFTER seeding so the bank's accounting dims are present.
const liveContext: PostureContext =
  buildBankPostureContexts(readPostureRegister(eventStore))[0]?.context ?? {};
console.log(
  `[context] accounting dims: ${JSON.stringify(Object.fromEntries(Object.entries(liveContext.dimensions ?? {}).filter(([k]) => k.startsWith("accounting."))))}`,
);

const concludedIds = new Set<string>();
for (const ev of eventStore.replay({ type: "ApplicabilityAssessmentConcluded" })) {
  const id = (ev.payload as { assessmentId?: string }).assessmentId;
  if (id) concludedIds.add(id);
}
const contexts = buildBankPostureContexts(readPostureRegister(eventStore));
let rescoped = 0;
const verdictTally: Record<string, number> = {};
const rescopeBatch: Event[] = [];
for (const r of rescopes) {
  const assessmentId = `assessment:obligation:${r.obligationId.toLowerCase()}:${asOf.slice(0, 10)}:accounting-posture`;
  if (concludedIds.has(assessmentId)) {
    continue;
  }
  const scope: AppliesToScope = {
    kind: "and",
    conditions: [
      { kind: "jurisdiction", jurisdiction: "ZA" },
      { kind: "dimension", dimensionKey: r.gating.key, dimensionValue: r.gating.gatingValue },
    ],
  };
  const result = assessApplicability(scope, contexts);
  verdictTally[result.verdict] = (verdictTally[result.verdict] ?? 0) + 1;
  rescoped++;
  if (dryRun) continue;
  rescopeBatch.push(
    makeApplicabilityAssessmentRequested({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        subjectRef: r.obligationId,
        subjectKind: "obligation",
        appliesToScope: scope,
        requestedBy: ASSESS_ACTOR.id,
        citations: CITATIONS,
      },
    }),
  );
  rescopeBatch.push(
    makeApplicabilityAssessmentPerformed({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        contextsEvaluated: contexts,
        matches: result.matches,
        performedBy: ASSESS_ACTOR.id,
        performedAt: asOf,
      },
    }),
  );
  rescopeBatch.push(
    makeApplicabilityAssessmentConcluded({
      asOf,
      entity: ENTITY,
      actor: ASSESS_ACTOR,
      citations: CITATIONS,
      payload: {
        assessmentId,
        verdict: result.verdict,
        appliesToContexts: result.matches,
        rationale: result.rationale,
        concludedBy: ASSESS_ACTOR.id,
        concludedAt: asOf,
        citations: CITATIONS,
      },
    }),
  );
}
if (!dryRun) {
  for (const ev of rescopeBatch) eventStore.append(ev);
}
console.log(
  `[re-scope] ${dryRun ? "would re-scope" : "re-scoped"} ${rescoped} obligations → ${JSON.stringify(verdictTally)}`,
);
console.log(`${dryRun ? "[DRY-RUN] " : ""}done.`);
