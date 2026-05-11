---
title: Procedure step-ID convention
author: Owen (Company Secretary, governance)
date: 2026-05-11
authority: D-AGENT-AUTONOMY-OPERATIONAL (Slice 3 — goal-loop prerequisite)
status: Approved
---

# Procedure step-ID convention

**Author:** Owen (Company Secretary, governance)  
**Date:** 2026-05-11  
**Authority:** `D-AGENT-AUTONOMY-OPERATIONAL` (CEO-approved 2026-05-11) — prerequisite for
Slice 3 (per-persona goal-loop substrate); cited in `Owner Inbox/2026-05-11_atlas_per-persona-goal-loop-substrate-spec.md` §3.2.  
**Status:** Approved — effective immediately for new procedure files; retroactive coverage per §5.

---

## 1. ID format

A step ID has the form:

```
<procedure-slug>:<step-key>
```

Where:

- **`<procedure-slug>`** is the procedure file's basename without the `.md` extension
  (e.g. `kyc-onboarding`, `party-registration`, `margin-im`). The slug is already
  stable and machine-readable; it matches the filename exactly.
- **`<step-key>`** is a short, lowercase, hyphen-separated label that identifies the
  step within the procedure. It MUST be unique within a given procedure file.

Two `<step-key>` forms are permitted:

| Form | Example | When to use |
|---|---|---|
| **Numeric** `step-<n>` | `step-3` | Default for numbered table rows in §5. Use the row's `#` column value. |
| **Slug** `step-<label>` | `step-accept`, `step-reject` | Branching rows (e.g. `8a` / `8b` → `step-8a` / `step-8b`), or sub-steps that lack a clean integer. |

**Valid step IDs — examples:**

```
kyc-onboarding:step-1
kyc-onboarding:step-8a
party-registration:step-5
margin-im:step-reconcile
```

**Regex (for parsers):**

```
^([a-z0-9][a-z0-9._-]*):(step-[a-z0-9][a-z0-9-]*)$
```

The slug segment allows dots (procedure files may live at nested paths like
`by-policy/kyc-onboarding` — the parser strips the directory prefix and uses
only the basename).

---

## 2. Authoring rule — embedding step IDs in procedure markdown

Step IDs are embedded as **inline anchors** at the start of each step row in the
`§ 5. Steps` table. The anchor appears in the `#` (row-number) column, wrapped in
an HTML `<a>` tag:

```markdown
| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| <a id="step-1">1</a> | Resolve source-of-truth … | `agent` … | `@scripts/…` | … |
| <a id="step-2">2</a> | Determine URN slug … | `agent` … | `@scripts/…` | … |
```

**Parser rule (regex-friendly, no full AST required):**

```ts
// Extract all step IDs from a procedure file's §5 Steps table.
// Matches: <a id="step-<key>">
const STEP_ID_RE = /<a\s+id="(step-[a-z0-9][a-z0-9-]*)"\s*>/g;
```

The anchor form was chosen because:

1. It is grep/regex-detectable without an AST.
2. It renders correctly in GitHub Markdown (producing a named anchor).
3. It doesn't require frontmatter changes or a separate ID list.
4. It survives prose edits to the row's Action / Notes columns without change.

**Constraint:** each `<a id="...">` value MUST be unique within the file. Tools
that validate IDs (Vera recon, Atlas's spec-parser extension) should reject
files with duplicate IDs.

---

## 3. Stability guarantee

| Operation | Step ID impact |
|---|---|
| Prose edit to Action / Notes column | **No change** — ID is in the `#` column, not the prose. |
| Reordering rows within §5 (e.g. swap steps 3 and 4) | **No change** — IDs are anchored to the `<a id="...">` value, not the row position. |
| Adding a new step at the end | **No change** to existing IDs; new step gets the next integer. |
| Inserting a step between existing steps | Existing IDs **do not change**. The inserted row gets the next available integer (may be non-contiguous). |
| Splitting one step into two | Original step **keeps its ID**; the new sub-step gets a new ID. |
| Merging two steps into one | The surviving step keeps the **lower-numbered ID**; the retired ID MUST be recorded in the procedure's `§ 11. Change log` as `retired: step-<n>` in the Summary column. |
| Renaming the procedure file (slug change) | All IDs change, because the slug is part of the fully-qualified ID. This is a **breaking change** — any `ProcedureCitation` referencing the old slug must be updated. Treat as a new procedure and deprecate the old one. |
| Moving a step to a different procedure | Remove the step from the source; add it to the target with a new ID. Both changes are logged. |

**Summary:** prose, reordering, and insertions are non-breaking. Structural
splits/merges, slug changes, and cross-procedure moves require explicit ID
management and change-log entries.

---

## 4. Citation form — `ProcedureCitation` in TypeScript

The `ProcedureCitation` interface (defined in
`prototype/platform/agent-runtime/goal-loop.ts`, per the goal-loop substrate spec)
already carries `procedurePath` and `stepId`. The convention for populating both:

```ts
export interface ProcedureCitation {
  /**
   * Procedure file path relative to the repo root.
   * E.g. `Procedures/by-policy/kyc-onboarding.md`
   */
  readonly procedurePath: string;

  /**
   * Step identifier — fully-qualified form `<slug>:<step-key>` where
   * <slug> is the basename of procedurePath without ".md".
   * E.g. `kyc-onboarding:step-3`
   *
   * MUST NOT be null or empty string. Goal-loop submissions that carry
   * a ProcedureCitation with stepId === "" are rejected at the
   * permission-gate.
   */
  readonly stepId: string;

  /** SHA-256 of the procedure file at parse time. */
  readonly procedureHash: string;
}
```

**Canonical example:**

```ts
const citation: ProcedureCitation = {
  procedurePath: "Procedures/by-policy/kyc-onboarding.md",
  stepId: "kyc-onboarding:step-3",
  procedureHash: "a3f8c2...",
};
```

**Parser helper (Atlas's spec-parser extension):**

```ts
/** Derive the step slug from a procedurePath and an anchor id. */
function makeStepId(procedurePath: string, anchorId: string): string {
  // Strip directory + extension: "Procedures/by-policy/kyc-onboarding.md" → "kyc-onboarding"
  const slug = procedurePath.replace(/^.*\//, "").replace(/\.md$/i, "");
  return `${slug}:${anchorId}`;
}
```

---

## 5. Retroactive coverage plan

**Policy:** all procedure files in `/Procedures/by-policy/` MUST carry step-ID
anchors before a `ProcedureCitation` referencing that file can be emitted with a
non-null `stepId`. Until a file is backfilled it is in **coverage-gap** status.

**Backfill convention:**

1. For each un-anchored procedure file, add `<a id="step-<n>">` anchors to every
   row in `§ 5. Steps`, using the existing row's `#` column integer.
2. Branching rows (`8a`, `8b`, etc.) become `step-8a`, `step-8b`.
3. The backfill is a **non-breaking mechanical change** — no prose changes, no ID
   collisions possible (anchors are new insertions into existing rows).
4. Commit the backfill as a single PR per procedure file (or as a batch if
   time-sensitive). PR description cites this document.

**Urgency:** backfill is not urgent for files whose owning persona is not yet in
the goal-loop cohort 1. The cohort-1 agents (Vera, Mira, Owen, Bea, Atlas) MUST
have their owned procedures backfilled before their goal-loop build ships.

**Tracking:** Owen opens a Vera finding entry (Wave-4 or Wave-5, per Vera's
recon cadence) for each procedure file that remains in coverage-gap status after
the cohort-1 build ships. The finding closes on PR merge.

---

## 6. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v1.0 | 2026-05-11 | Owen (Company Secretary, governance) | Initial convention — step-ID format, authoring rule, stability guarantee, citation form, backfill plan. Prerequisite for goal-loop cohort 1. |
