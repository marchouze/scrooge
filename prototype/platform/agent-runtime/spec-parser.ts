// platform/agent-runtime/spec-parser.ts
//
// Parses a `/Team/<Name>.md` agent operating spec into a structured
// `AgentSpec`. Consumed by the agent registry (`./registry.ts`) and by
// the one-shot CLI (`prototype/scripts/agent-registry-sync.ts`).
//
// Scope:
//   - Identity (§1) — name, role, reports-to.
//   - Cadence (§6) — the "Mode:" line as a free-text summary.
//   - Triggers (§7) — count of trigger rows in the section's first table.
//   - Decisions in scope (§9) — count of decision rows.
//   - Decisions that escalate (§10) — count of escalation rows.
//   - Outputs (§11) — typed event names parsed from "Events emitted:".
//   - System capabilities called (§12) — `@platform/<x>` tokens parsed
//     from the bullet list. Used by the permission-policy generator
//     (A2 work) and by Vera Wave-5 capability-creep recon.
//   - Procedures owned (§13) — `Procedures/...` paths + step IDs
//     extracted from each procedure file's §5 Steps table inline anchors
//     per `Procedures/_step-id-convention.md` (D-AGENT-AUTONOMY-OPERATIONAL
//     Slice 3 prerequisite).
//   - Spec version (§17) — first row of the change log; falls back to
//     `v1.0` when the table is missing or unparseable.
//
// Heading tolerance: persona files use either `## 6. Cadence` (canonical
// numbered template) or `## Cadence` (a few legacy upgrades). The parser
// matches both shapes. Section bodies are everything between the heading
// and the next `## ` heading.
//
// Failure mode: parsing returns a discriminated `{ ok: true, spec } |
// { ok: false, reason }` — the caller decides whether to skip, exit
// non-zero, or escalate. We don't throw; the registry sync needs to
// surface every parse failure rather than abort on the first.
//
// Author: Atlas (A1.1 — registry substrate; §13 step-ID extension —
// D-AGENT-AUTONOMY-OPERATIONAL Slice 3 prerequisite)

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

/**
 * A procedure-step entry in `AgentSpec.procedureSteps`.
 *
 * Per `Procedures/_step-id-convention.md` (D-AGENT-AUTONOMY-OPERATIONAL
 * Slice 3 prerequisite): step IDs are extracted from the procedure file's
 * `§ 5. Steps` table inline anchors (`<a id="step-N">`). Files without
 * anchors (pre-backfill coverage-gap status) return an empty `stepIds`
 * array — not an error condition.
 */
export interface ProcedureStepEntry {
  /** Procedure file path relative to the repo root (e.g. `Procedures/by-policy/kyc-onboarding.md`). */
  readonly procedurePath: string;
  /**
   * Fully-qualified step IDs found in this procedure file.
   * Form: `<slug>:<step-key>` (e.g. `kyc-onboarding:step-3`).
   * Empty array when the file has no step anchors (coverage-gap) or
   * when the file cannot be read (logged as a warning; not fatal).
   */
  readonly stepIds: readonly string[];
}

/**
 * A typed citation to a specific step within a procedure. Used by the
 * goal-loop substrate to cite which procedure step authorises an agent
 * action. Per Owen's step-ID convention (D-AGENT-AUTONOMY-OPERATIONAL).
 *
 * `stepId` is optional until backfill of all cohort-1 procedure files is
 * complete. Goal-loop enforcement (permission-gate) rejects citations with
 * `stepId === ""` — callers must either provide a valid step ID or omit
 * the field entirely.
 */
export interface ProcedureCitation {
  /**
   * Procedure file path relative to the repo root.
   * E.g. `Procedures/by-policy/kyc-onboarding.md`
   */
  readonly procedurePath: string;
  /**
   * Step identifier — fully-qualified form `<slug>:<step-key>` where
   * `<slug>` is the basename of `procedurePath` without `.md`.
   * E.g. `kyc-onboarding:step-3`
   *
   * Optional until backfill of all cohort-1 procedure files is complete.
   * MUST NOT be the empty string; omit entirely when a step ID cannot yet
   * be cited (coverage-gap).
   */
  readonly stepId?: string;
  /** SHA-256 of the procedure file at parse time. */
  readonly procedureHash: string;
}

export interface AgentSpec {
  /** Persona name as it appears on `/Team/<Name>.md` (mixed-case). */
  readonly personaName: string;
  /** Stable URN: `agent:<lowercased-persona-name>`. */
  readonly agentUrn: string;
  /** Role title from §1. */
  readonly role: string;
  /** Governance-line owner from §1 ("Reports to"). */
  readonly reportsTo: string;
  /** Free-text from §6's "Mode:" line. */
  readonly cadenceMode: string;
  /** Number of trigger rows in §7's table. */
  readonly triggerCount: number;
  /**
   * Typed event-name tokens parsed from the *first column* of §7's
   * trigger table (backticked tokens that look like `EventName`).
   * Powers the permission-policy `eventSubscribeAllowList` (S8 §3.3,
   * A4 — Gap #2 closure). Scheduled wakes and natural-language
   * triggers do not appear here; the §6 cadence + the source column
   * carry them.
   */
  readonly triggerSubscriptions: readonly string[];
  /** Number of in-scope decision rows in §9's table. */
  readonly decisionsInScopeCount: number;
  /**
   * Row labels (first column) of §9's decisions-in-scope table.
   * Consumed by `AgentGoalSelected.mandateCitations` validation and the
   * goal-loop recon pipeline. Empty array when §9 is absent or has no
   * data rows (both treated as "no decisions in scope" — parser still
   * requires the heading to be present per operating-spec rules).
   */
  readonly decisionsInScope: readonly string[];
  /** Number of escalation rows in §10's table. */
  readonly decisionsEscalateCount: number;
  /**
   * Row labels (first column) of §10's escalation table.
   * Consumed by the goal-loop before emitting `AgentGoalEscalation` — the
   * loop checks the requested escalation class exists in this closed set.
   * T-05 threat-model mitigation (agent-runtime-substrate-threat-model §T-05).
   * Empty array when §10 is absent or has no data rows.
   */
  readonly escalationClasses: readonly string[];
  /** `@platform/<x>` tokens parsed from §12 bullets. */
  readonly systemCapabilities: readonly string[];
  /** Typed event names parsed from §11's "Events emitted:" entry. */
  readonly eventsEmitted: readonly string[];
  /** Procedure paths parsed from §13 bullets. */
  readonly proceduresOwned: readonly string[];
  /**
   * Per-procedure step-ID entries parsed from §13. For each procedure
   * path in `proceduresOwned`, this field contains the corresponding
   * `stepIds` extracted from that procedure file's §5 Steps table inline
   * anchors (per `Procedures/_step-id-convention.md`). Files without
   * anchors return `stepIds: []` — coverage-gap, not an error.
   *
   * The index aligns 1-to-1 with `proceduresOwned`: `procedureSteps[i]`
   * corresponds to `proceduresOwned[i]`.
   */
  readonly procedureSteps: readonly ProcedureStepEntry[];
  /** Spec version from §17's first change-log row, or `v1.0` default. */
  readonly specVersion: string;
  /** SHA-256 hex digest of the file's raw contents at parse time. */
  readonly specHash: string;
  /** Absolute path of the source file. */
  readonly sourcePath: string;
}

export type ParseResult =
  | { readonly ok: true; readonly spec: AgentSpec }
  | { readonly ok: false; readonly reason: string };

/**
 * Section regex builder. Matches both numbered (`## 6. Cadence`) and
 * unnumbered (`## Cadence`) headings, anchored at line start, allowing
 * trailing whitespace before the newline.
 */
function sectionHeadingRegex(num: number, label: string): RegExp {
  // Escape regex specials in label.
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^##\\s+(?:${num}\\.\\s+)?${escaped}\\s*$`, "i");
}

/**
 * Extract the body of a section identified by (number, label). Returns
 * everything between the heading line and the next `## ` heading, with
 * leading / trailing blank lines trimmed. Returns undefined if the
 * heading isn't present.
 */
function extractSection(content: string, num: number, label: string): string | undefined {
  const lines = content.split(/\r?\n/);
  const re = sectionHeadingRegex(num, label);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && re.test(line)) {
      start = i + 1;
      break;
    }
  }
  if (start === -1) return undefined;
  let end = lines.length;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (line !== undefined && /^##\s/.test(line)) {
      end = i;
      break;
    }
  }
  return lines
    .slice(start, end)
    .join("\n")
    .replace(/^\s+|\s+$/g, "");
}

/**
 * Parse §1 Identity bullet — looks for `- **Reports to:** ...` or
 * `- **Role:** ...`. The Identity section is consistent across the
 * fleet because the canonical template prescribes the exact bullets.
 */
function extractIdentityField(section: string, label: string): string | undefined {
  const re = new RegExp(`^[\\-\\*]\\s+\\*\\*${label}:\\*\\*\\s+(.+)$`, "im");
  const m = section.match(re);
  return m?.[1] ? m[1].trim() : undefined;
}

/**
 * Count the data rows in the first markdown table inside `section`.
 * A table is a header row, a separator row (`|---|---|...`), and ≥ 0
 * data rows. We count only the data rows (post-separator, pre-blank).
 *
 * Tolerant of leading bullets / paragraphs before the table; the
 * persona files often have a sentence introducing the table.
 */
function countTableDataRows(section: string | undefined): number {
  if (!section) return 0;
  const lines = section.split(/\r?\n/);
  let inTable = false;
  let separatorSeen = false;
  let dataRows = 0;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      // Header row + (next-line) separator pattern. We detect entry on
      // a separator-shaped line; the prior line was the header.
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        inTable = true;
        separatorSeen = true;
        continue;
      }
      continue;
    }
    // We're in a table; count rows until we hit a non-pipe line.
    if (trimmed.startsWith("|")) {
      if (separatorSeen) dataRows++;
      continue;
    }
    if (trimmed === "") {
      // Blank line ends the table.
      break;
    }
    // Non-pipe non-blank line ends the table.
    break;
  }
  return dataRows;
}

/**
 * Extract the first-column cell text from every data row of the first
 * markdown table inside `section`. Returns the raw cell text trimmed of
 * leading/trailing whitespace and backtick markers.
 *
 * Used to surface §9 (decisions-in-scope) and §10 (escalation classes) row
 * labels as closed-set string lists. Handles absent sections and sections
 * with no table gracefully by returning an empty array.
 *
 * Label extraction strips enclosing backticks (`...`) if present so callers
 * receive clean label strings regardless of persona authoring style.
 */
function extractTableFirstColumnLabels(section: string | undefined): string[] {
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  let separatorSeen = false;
  const labels: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!separatorSeen) {
      // Detect the separator row; header comes just before.
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        separatorSeen = true;
        continue;
      }
      continue;
    }
    // Past the separator — collect data rows.
    if (trimmed.startsWith("|")) {
      // Slice the first column. Row shape: `| col1 | col2 | ...`
      const stripped = trimmed.replace(/^\|/, "");
      const firstCol = (stripped.split("|")[0] ?? "").trim();
      // Strip surrounding backticks when present (some specs write
      // `Decision label` in the first column).
      const label = firstCol.replace(/^`(.+)`$/, "$1").trim();
      if (label !== "") {
        labels.push(label);
      }
      continue;
    }
    // Blank or non-pipe line ends the table.
    break;
  }
  return labels;
}

/**
 * Extract typed event-name tokens from the first column of §7's
 * trigger table. The convention across the fleet:
 *
 *   | Trigger                          | Source     | Response SLA |
 *   |---|---|---|
 *   | `TransactionPosted` event        | Event store| 60s          |
 *   | Scheduled wake-up — daily 02:00  | Scheduler  | by 03:00     |
 *   | PR opened on `prototype/...`     | Git        | 1 working day|
 *
 * We extract backticked tokens whose shape looks like a typed event
 * name (UpperCamelCase, ASCII alnum) from the *first column only*. The
 * Source / SLA columns may also carry backticked tokens (registers,
 * URNs, timestamps) that are not subscriptions.
 *
 * Multiple tokens in one row are kept; some rows declare a tuple
 * (e.g. "`PepListPublished` / `AdverseMediaPublished`"). Deduplicated
 * in input order. Rows without a typed-event token contribute nothing.
 *
 * Author: Atlas (S8 §3.3, A4 — Gap #2 closure).
 */
function extractTriggerSubscriptions(section: string | undefined): string[] {
  if (!section) return [];
  const lines = section.split(/\r?\n/);
  let inTable = false;
  let separatorSeen = false;
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!inTable) {
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        inTable = true;
        separatorSeen = true;
        continue;
      }
      continue;
    }
    if (trimmed.startsWith("|")) {
      if (!separatorSeen) continue;
      // Slice the first column. Markdown rows look like `| col1 | col2 | col3 |`.
      // Strip leading `|`, then split on `|` and take index 0.
      const stripped = trimmed.replace(/^\|/, "");
      const firstCol = stripped.split("|")[0] ?? "";
      // Match backticked UpperCamelCase ASCII tokens — typed event names.
      // Allow internal digits but not hyphens, dots, or underscores
      // (those occur in URNs and procedure paths, not event names).
      for (const m of firstCol.matchAll(/`([A-Z][A-Za-z0-9]*)`/g)) {
        const tok = m[1]?.trim();
        if (tok && !seen.has(tok)) {
          seen.add(tok);
          tokens.push(tok);
        }
      }
      continue;
    }
    if (trimmed === "") break;
    break;
  }
  return tokens;
}

/**
 * Extract §6 cadence "Mode:" line. Falls back to the section's first
 * non-empty line when "Mode:" isn't structured.
 */
function extractCadenceMode(section: string | undefined): string {
  if (!section) return "(unspecified)";
  // Look for `- **Mode:** ...` first.
  const m = section.match(/^[\-*]\s+\*\*Mode:\*\*\s+(.+?)$/im);
  if (m?.[1]) return m[1].trim();
  // Fall back to the first non-empty line trimmed of bullet markers.
  for (const line of section.split(/\r?\n/)) {
    const t = line.trim();
    if (t === "") continue;
    return t.replace(/^[\-*]\s+/, "").slice(0, 200);
  }
  return "(unspecified)";
}

/**
 * Extract `@platform/<token>` capability tokens from §12. Each bullet
 * is of the form `- \`@platform/<x>\` — <description>`; we capture the
 * literal between backticks and dedupe in input order. Tokens with
 * trailing wildcards (e.g. `@platform/agent-runtime/*`) are kept verbatim.
 */
function extractCapabilities(section: string | undefined): string[] {
  if (!section) return [];
  const tokens: string[] = [];
  const seen = new Set<string>();
  // Match all `@platform/...` occurrences inside backticks first; if
  // none, fall back to bare-text detection.
  const inBackticks = section.matchAll(/`(@platform\/[^`]+)`/g);
  for (const m of inBackticks) {
    const tok = m[1]?.trim();
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  }
  if (tokens.length > 0) return tokens;
  // Fallback: bare `@platform/...` sequences (whitespace-bounded).
  const bare = section.matchAll(/@platform\/[A-Za-z0-9\-_/*.]+/g);
  for (const m of bare) {
    const tok = m[0].trim();
    if (!seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  }
  return tokens;
}

/**
 * Extract typed event names from §11's "Events emitted:" line. The
 * convention across the fleet is:
 *
 *   - **Events emitted:** `EventA`, `EventB`, `EventC` (...).
 *
 * We parse the literal-between-backticks tokens that follow the label.
 * If "Events emitted:" isn't present, returns an empty array — the
 * agent declares no typed events (some governance personas do).
 */
function extractEventsEmitted(section: string | undefined): string[] {
  if (!section) return [];
  // Find the bullet whose label is "Events emitted".
  const lines = section.split(/\r?\n/);
  let line: string | undefined;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l !== undefined && /\*\*Events emitted:\*\*/i.test(l)) {
      line = l;
      // Some specs spread the list across lines; concatenate
      // continuation lines that begin with whitespace before the next
      // bullet / blank line.
      let j = i + 1;
      while (j < lines.length) {
        const next = lines[j];
        if (next === undefined) break;
        const t = next.trim();
        if (t === "" || /^[\-*]\s/.test(next) || /^\s*\*\*/.test(t)) break;
        line += ` ${t}`;
        j++;
      }
      break;
    }
  }
  if (!line) return [];
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const m of line.matchAll(/`([A-Za-z][A-Za-z0-9]*)`/g)) {
    const tok = m[1]?.trim();
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  }
  return tokens;
}

/**
 * Extract `Procedures/...` paths from §13. Each bullet typically
 * begins with a backticked path; we capture them verbatim and dedupe.
 */
function extractProcedures(section: string | undefined): string[] {
  if (!section) return [];
  const tokens: string[] = [];
  const seen = new Set<string>();
  for (const m of section.matchAll(/`(Procedures\/[^`]+)`/g)) {
    const tok = m[1]?.trim();
    if (tok && !seen.has(tok)) {
      seen.add(tok);
      tokens.push(tok);
    }
  }
  return tokens;
}

/**
 * Regex that matches inline step-ID anchors in a procedure file's §5
 * Steps table. Per `Procedures/_step-id-convention.md`:
 *
 *   `<a id="step-3">3</a>` — standard numeric step.
 *   `<a id="step-8a">8a</a>` — branching step.
 *
 * We capture only the `id` attribute value; the anchor text (the
 * row-number column) is ignored. The regex is intentionally permissive
 * on whitespace around the `id=` attribute (the convention allows
 * `<a id="step-1">` with no extra spaces, but future tooling may
 * emit whitespace between attributes).
 */
const STEP_ID_RE = /<a\s+id="(step-[a-z0-9][a-z0-9-]*)"\s*>/g;

/**
 * Derive the fully-qualified step ID from a procedure path and an
 * anchor `id` value. Strips the directory prefix and `.md` extension
 * from `procedurePath` to produce the slug, then concatenates:
 *
 *   makeStepId("Procedures/by-policy/kyc-onboarding.md", "step-3")
 *   // → "kyc-onboarding:step-3"
 *
 * Per Owen's step-ID convention (D-AGENT-AUTONOMY-OPERATIONAL).
 */
export function makeStepId(procedurePath: string, anchorId: string): string {
  const slug = procedurePath.replace(/^.*\//, "").replace(/\.md$/i, "");
  return `${slug}:${anchorId}`;
}

/**
 * Extract all step IDs from a procedure file at `absolutePath`. Returns
 * an empty array when:
 *   - the file doesn't exist (pre-backfill coverage-gap — not an error).
 *   - the file has no `<a id="step-...">` anchors (pre-backfill).
 *   - the file cannot be read (logs a warning; not fatal — registry must
 *     not abort on missing procedure files during the backfill window).
 *
 * Duplicate anchor IDs within a single file are deduplicated in input
 * order (the convention forbids duplicates; we handle them defensively).
 *
 * @param absolutePath - Resolved absolute path to the procedure `.md` file.
 * @param procedurePath - Repo-relative path (used to construct step IDs).
 */
function extractStepIdsFromFile(absolutePath: string, procedurePath: string): string[] {
  if (!existsSync(absolutePath)) {
    // Coverage-gap: file exists in §13 but hasn't been created or
    // backfilled yet. Silent — the step-ID convention §5 backfill plan
    // acknowledges this state.
    return [];
  }
  let content: string;
  try {
    content = readFileSync(absolutePath, "utf8");
  } catch (e) {
    // IO error — warn and treat as empty. The registry sync surfaces
    // every parse failure independently; we don't throw here.
    console.warn(
      `[spec-parser] warning: could not read procedure file "${absolutePath}": ${(e as Error).message}`,
    );
    return [];
  }
  const stepIds: string[] = [];
  const seen = new Set<string>();
  // Reset regex lastIndex to be safe when reusing the literal.
  STEP_ID_RE.lastIndex = 0;
  for (const m of content.matchAll(STEP_ID_RE)) {
    const anchorId = m[1];
    if (!anchorId) continue;
    const stepId = makeStepId(procedurePath, anchorId);
    if (!seen.has(stepId)) {
      seen.add(stepId);
      stepIds.push(stepId);
    }
  }
  return stepIds;
}

/**
 * Resolve a repo-relative procedure path to an absolute path, using
 * the agent spec file's location as the anchor point.
 *
 * Agent spec files live at `<repoRoot>/Team/<Name>.md`. The repo root
 * is therefore two levels up from the spec file: `dirname(dirname(sourcePath))`.
 * Procedure paths are repo-relative (e.g. `Procedures/by-policy/kyc-onboarding.md`).
 *
 * Callers that provide synthetic `sourcePath` values (e.g. `/tmp/Test.md`)
 * still get a resolved path — it just won't exist on disk, which is
 * handled gracefully by `extractStepIdsFromFile`.
 */
function resolveProcedurePath(sourcePath: string, procedurePath: string): string {
  // Team/<Name>.md → go up two levels to reach repo root.
  const repoRoot = dirname(dirname(sourcePath));
  return resolve(repoRoot, procedurePath);
}

/**
 * Extract the spec version from §17's change log. The change log is a
 * markdown table whose first data row carries the latest version (the
 * persona convention is newest-last in some files, newest-first in
 * others). We take the *last* data row's first column when present —
 * the canonical template lists v1.0 last, and the upgrade pattern
 * appends v1.0 below the v0.1 character-sheet row. Falls back to
 * `v1.0` when the table can't be read.
 */
function extractSpecVersion(section: string | undefined): string {
  if (!section) return "v1.0";
  const lines = section.split(/\r?\n/);
  const dataRows: string[] = [];
  let separatorSeen = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!separatorSeen) {
      if (/^\|\s*[-:]+(\s*\|\s*[-:]+)+\s*\|?\s*$/.test(trimmed)) {
        separatorSeen = true;
      }
      continue;
    }
    if (trimmed.startsWith("|")) {
      dataRows.push(trimmed);
      continue;
    }
    if (trimmed === "") break;
    break;
  }
  if (dataRows.length === 0) return "v1.0";
  // Take the last data row, split by `|`, drop empties, take col 0.
  const last = dataRows[dataRows.length - 1];
  if (!last) return "v1.0";
  const cols = last
    .split("|")
    .map((c) => c.trim())
    .filter((c) => c !== "");
  const v = cols[0];
  if (!v) return "v1.0";
  // Sanity: must look like vX.Y(.Z)? — otherwise default.
  if (!/^v\d+(\.\d+){1,2}$/i.test(v)) return "v1.0";
  return v;
}

/**
 * Compute the SHA-256 hex digest of `content`. The registry uses this
 * to decide whether a re-registration is a no-op (same hash) or a
 * version-bump (different hash).
 */
export function hashSpec(content: string): string {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Parse a persona file at `path`. The persona name is derived from
 * the filename (e.g. `Helena.md` → `Helena`); the URN is the
 * lowercased name prefixed with `agent:`.
 */
export function parseSpecFile(path: string): ParseResult {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch (e) {
    return {
      ok: false,
      reason: `cannot read file: ${(e as Error).message}`,
    };
  }
  const personaName = basename(path).replace(/\.md$/i, "");
  if (personaName.startsWith("_") || personaName.startsWith(".")) {
    return {
      ok: false,
      reason: `skipping non-persona file (template / hidden): ${personaName}`,
    };
  }
  return parseSpecContent(personaName, content, path);
}

/**
 * Parse pre-loaded content. Exposed for tests and for callers that
 * already have the file contents in hand.
 */
export function parseSpecContent(
  personaName: string,
  content: string,
  sourcePath: string,
): ParseResult {
  const identity = extractSection(content, 1, "Identity");
  if (!identity) {
    return { ok: false, reason: `${personaName}: missing §1 Identity section` };
  }
  const role = extractIdentityField(identity, "Role");
  const reportsTo = extractIdentityField(identity, "Reports to");
  if (!role) {
    return { ok: false, reason: `${personaName}: §1 missing **Role:** bullet` };
  }
  if (!reportsTo) {
    return { ok: false, reason: `${personaName}: §1 missing **Reports to:** bullet` };
  }

  // Operating-spec sections are required (Principle 6 — character
  // sheets are findings until upgraded). We require §6, §7, §9, §11,
  // §12; §10 and §13 may legitimately be empty for some agents
  // (count = 0 / no procedures yet) but the *headings* must be present
  // for the file to be a recognised operating spec.
  const cadence = extractSection(content, 6, "Cadence");
  if (!cadence) {
    return { ok: false, reason: `${personaName}: missing §6 Cadence (operating-spec required)` };
  }
  const triggers = extractSection(content, 7, "Triggers");
  if (!triggers) {
    return { ok: false, reason: `${personaName}: missing §7 Triggers (operating-spec required)` };
  }
  const decisionsInScope = extractSection(content, 9, "Decisions in scope");
  if (!decisionsInScope) {
    return {
      ok: false,
      reason: `${personaName}: missing §9 Decisions in scope (operating-spec required)`,
    };
  }
  const outputs = extractSection(content, 11, "Outputs");
  if (!outputs) {
    return { ok: false, reason: `${personaName}: missing §11 Outputs (operating-spec required)` };
  }
  const capabilities = extractSection(content, 12, "System capabilities called");
  if (!capabilities) {
    return {
      ok: false,
      reason: `${personaName}: missing §12 System capabilities called (operating-spec required)`,
    };
  }
  const decisionsEscalate = extractSection(content, 10, "Decisions that escalate");
  const procedures = extractSection(content, 13, "Procedures owned");
  const changeLog = extractSection(content, 17, "Change log");

  const proceduresOwned = extractProcedures(procedures);

  // §13 step-ID extraction: for each procedure path, resolve to an
  // absolute path and extract step anchors per the step-ID convention.
  // Missing files and files with no anchors return stepIds: [] (not an
  // error — the backfill window is acknowledged in _step-id-convention.md §5).
  const procedureSteps: ProcedureStepEntry[] = proceduresOwned.map((procedurePath) => {
    const absolutePath = resolveProcedurePath(sourcePath, procedurePath);
    const stepIds = extractStepIdsFromFile(absolutePath, procedurePath);
    return { procedurePath, stepIds };
  });

  const spec: AgentSpec = {
    personaName,
    agentUrn: `agent:${personaName.toLowerCase()}`,
    role,
    reportsTo,
    cadenceMode: extractCadenceMode(cadence),
    triggerCount: countTableDataRows(triggers),
    triggerSubscriptions: extractTriggerSubscriptions(triggers),
    decisionsInScopeCount: countTableDataRows(decisionsInScope),
    decisionsInScope: extractTableFirstColumnLabels(decisionsInScope),
    decisionsEscalateCount: countTableDataRows(decisionsEscalate),
    escalationClasses: extractTableFirstColumnLabels(decisionsEscalate),
    systemCapabilities: extractCapabilities(capabilities),
    eventsEmitted: extractEventsEmitted(outputs),
    proceduresOwned,
    procedureSteps,
    specVersion: extractSpecVersion(changeLog),
    specHash: hashSpec(content),
    sourcePath,
  };
  return { ok: true, spec };
}
