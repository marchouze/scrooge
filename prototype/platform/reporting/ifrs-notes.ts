// platform/reporting/ifrs-notes.ts
//
// D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN Slice 6 — IFRS notes-skeleton
// generator. v0 emits headings only per pack §6 Slice 6 ("Notes (skeleton —
// per IFRS 7 financial-instruments + IAS 1 + headings only at v1)").
//
// Standing authority: D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN (CEO-approved
// 2026-05-10), pack §6 Slice 6.
//
// Each note is a typed heading with the IFRS reference + a placeholder for
// content that downstream slices (Slice 7-8 in the build proposal) will
// fill in: fair-value-hierarchy tables (IFRS 13), risk-disclosure tables
// (IFRS 7), accounting-policy notes (IAS 1 §117), critical estimates +
// judgements (IAS 1 §125), capital-management disclosure (IAS 1 §134).
//
// Per pack §6 Slice 6: per-entity (Hoz Bank only at v0).
//
// Authors: Bea (Accounting & financial reporting engineer, engineering —
//   reports to Camille CFO; IFRS line-mapping owner) · Atlas (Core banking
//   platform architect, engineering — substrate consult).

import {
  IFRS_AFS_BASE_CITATIONS,
  type IfrsGeneratorInput,
  type IfrsOutputMeta,
  assertIfrsBankEntity,
  assertIso4217,
  fingerprintIfrsClassifications,
  indexClassifications,
} from "./ifrs-types";

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

export interface IfrsNoteHeading {
  readonly noteNumber: number;
  readonly title: string;
  readonly ifrsRef: string;
  readonly status: "skeleton";
  readonly placeholder: string;
}

export interface IfrsNotesOutput {
  readonly meta: IfrsOutputMeta;
  readonly notes: readonly IfrsNoteHeading[];
  readonly citations: readonly string[];
  readonly placeholders: readonly string[];
}

// ---------------------------------------------------------------------------
// Note-skeleton catalogue (rehearsal-grade headings)
// ---------------------------------------------------------------------------

const NOTE_SKELETON: readonly Omit<IfrsNoteHeading, "status" | "placeholder">[] = [
  {
    noteNumber: 1,
    title: "Reporting entity",
    ifrsRef: "IAS 1 §138",
  },
  {
    noteNumber: 2,
    title: "Basis of preparation",
    ifrsRef: "IAS 1 §16, §27, §117",
  },
  {
    noteNumber: 3,
    title: "Significant accounting policies",
    ifrsRef: "IAS 1 §117–§124",
  },
  {
    noteNumber: 4,
    title: "Critical accounting estimates and judgements",
    ifrsRef: "IAS 1 §122, §125",
  },
  {
    noteNumber: 5,
    title: "Financial instruments — categories and measurement basis",
    ifrsRef: "IFRS 9, IFRS 7 §6–§8",
  },
  {
    noteNumber: 6,
    title: "Financial instruments — credit-risk disclosures (ECL)",
    ifrsRef: "IFRS 7 §35A–§35N",
  },
  {
    noteNumber: 7,
    title: "Financial instruments — liquidity-risk disclosures",
    ifrsRef: "IFRS 7 §39",
  },
  {
    noteNumber: 8,
    title: "Financial instruments — market-risk sensitivity analyses",
    ifrsRef: "IFRS 7 §40–§42",
  },
  {
    noteNumber: 9,
    title: "Fair-value measurement — hierarchy and inputs (Levels 1/2/3)",
    ifrsRef: "IFRS 13 §93",
  },
  {
    noteNumber: 10,
    title: "Income tax — current and deferred",
    ifrsRef: "IAS 12",
  },
  {
    noteNumber: 11,
    title: "Capital management",
    ifrsRef: "IAS 1 §134–§136",
  },
  {
    noteNumber: 12,
    title: "Related-party transactions",
    ifrsRef: "IAS 24",
  },
  {
    noteNumber: 13,
    title: "Subsequent events",
    ifrsRef: "IAS 10",
  },
] as const;

// ---------------------------------------------------------------------------
// Generator
// ---------------------------------------------------------------------------

/**
 * Generate the IFRS notes skeleton per pack §6 Slice 6 ("Notes (skeleton —
 * per IFRS 7 financial-instruments + IAS 1 + headings only at v1)"). Pure
 * function; deterministic.
 *
 * Each note is a typed heading + placeholder for the content downstream
 * slices will populate. The skeleton signals the structural completeness
 * of the AFS skeleton without committing to disclosure content (which is
 * accounting-policy-adoption-dependent and Tier-1-model-dependent for the
 * IFRS 7 risk-disclosure tables).
 */
export function generateIfrsNotes(input: IfrsGeneratorInput): IfrsNotesOutput {
  assertIfrsBankEntity(input.entity);
  assertIso4217(input.functionalCurrency, "functionalCurrency");
  // Validate the classifications map (so the input shape parity holds with
  // the other four generators). The notes skeleton itself does not consume
  // the trial balance — it's a structural artefact.
  indexClassifications(input.classifications);

  const placeholders: string[] = [];
  const notes: IfrsNoteHeading[] = NOTE_SKELETON.map((n) => ({
    ...n,
    status: "skeleton" as const,
    placeholder: `[citation: TBC — Note ${n.noteNumber} (${n.title}) content pending: per ${n.ifrsRef} + Camille's accounting-policy adoption per Owner Inbox/2026-05-06_core-policies-finance.md]`,
  }));

  for (const n of notes) {
    placeholders.push(n.placeholder);
  }

  const meta: IfrsOutputMeta = {
    statement: "notes",
    statementVersion: "v0.1-rehearsal",
    entity: input.entity,
    asOf: input.asOf,
    periodId: input.periodId,
    functionalCurrency: input.functionalCurrency,
    generatorVersion: "v0.1",
    ...(input.comparativeAsOf ? { comparativeAsOf: input.comparativeAsOf } : {}),
    ...(input.trialBalanceSnapshotEventId
      ? { trialBalanceSnapshotEventId: input.trialBalanceSnapshotEventId }
      : {}),
    classificationsFingerprint: fingerprintIfrsClassifications(input.classifications),
  };

  return {
    meta,
    notes,
    citations: [...IFRS_AFS_BASE_CITATIONS, "IAS 1 §117", "IAS 1 §138", "IFRS 13 §93"],
    placeholders,
  };
}

export type { IfrsGeneratorInput } from "./ifrs-types";
