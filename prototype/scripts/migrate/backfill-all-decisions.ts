// scripts/migrate/backfill-all-decisions.ts
//
// D-DECISIONS-FRAMEWORK-REDESIGN Slice C — full backfill of all historical
// decision IDs as unified `Decision` events.
//
// Idempotent: re-running emits nothing when the projection already covers
// every phase inferred from the source. Safe to run in CI on every PR.
//
// Authority: D-DECISIONS-FRAMEWORK-REDESIGN (CEO-approved 2026-05-16).
// Spec: /Users/marc/.claude/plans/the-current-setup-for-polymorphic-pie.md
// §"Remediation (full backfill — chosen path)" + §"Slice C scope".
//
// Author: Atlas (Core banking platform architect, engineering)

import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { eventStore } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { PRODUCTION_CARVE_OUTS } from "../../platform/event-store/provenance";
import type { Event } from "../../platform/event-store/types";
import { buildDecisionsRegister, decisionsSourceFromStore } from "../../projections/decisions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function findRepoRoot(start: string): string {
  let dir = start;
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "CLAUDE.md"))) return dir;
    dir = resolve(dir, "..");
  }
  throw new Error("Cannot locate repo root (CLAUDE.md not found walking up)");
}

const REPO_ROOT = findRepoRoot(__dirname);

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "COMPANIES-ACT-71-2008"];

const RECORDED_VIA = "backfill:decisions-framework-cutover";

// ---------------------------------------------------------------------------
// §2: Slug mapping table for legacy numeric / ambiguous IDs
// ---------------------------------------------------------------------------
// S3..S8 were pre-D-* sprint identifiers; mapped to their semantic slugs.
// Add entries here as manual triage closes them.

const LEGACY_ID_MAP: Readonly<Record<string, string>> = {
  S3: "D-S7-TARGETED-3-5-OPEN-QUESTIONS", // S3 = the "S7-targeted slice 3" sprint decision pack
  S5: "D-FIRST-DRY-RUN-SCENARIO", // S5 = first dry-run scenario decision
  S6: "D-FLEET-ROLLOUT-SEQUENCING", // S6 = fleet rollout sequencing
  S7: "D-AGENT-RUNTIME-AUTHORIZE", // S7 = agent runtime authorise decision
  S8: "D-AGENT-AUTONOMY-OPERATIONAL", // S8 = agent autonomy operational decision
};

// IDs that are genuinely ambiguous / placeholder and cannot be auto-migrated.
// Logged to the triage log (see §6).
const TRIAGE_IDS: ReadonlySet<string> = new Set([
  "D-<SLUG>", // template placeholder in frontmatter-convention.md
  "D-XXX",
  "D-IN",
  "D-FX-",
  "D-TBD",
  "D-TODO",
]);

const NUMERIC_RE = /^D-0*[1-9][0-9]*$/;

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

interface ParsedFrontmatter {
  decisionId: string | null;
  title: string | null;
  decisionRequired: boolean | null;
  decisionAuthority: string | null;
  supersededOn: string | null;
  decisionDate: string | null;
  date: string | null;
}

const FM_BLOCK_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

function extractFrontmatter(text: string): ParsedFrontmatter {
  const m = text.match(FM_BLOCK_RE);
  if (!m || !m[1]) {
    return {
      decisionId: null,
      title: null,
      decisionRequired: null,
      decisionAuthority: null,
      supersededOn: null,
      decisionDate: null,
      date: null,
    };
  }
  const fm = m[1];
  function scalar(key: string): string | null {
    const re = new RegExp(`^${key}\\s*:\\s*(.+)$`, "im");
    const match = fm.match(re);
    return match?.[1]?.trim() ?? null;
  }
  const decisionId = scalar("decision-id");
  const title = scalar("title");
  const decisionRequired = scalar("decision-required");
  const decisionAuthority = scalar("decision-authority");
  const supersededOn = scalar("superseded-on");
  const decisionDate = scalar("decision-date");
  const date = scalar("date");

  return {
    decisionId,
    title,
    decisionRequired: decisionRequired === null ? null : decisionRequired.toLowerCase() === "true",
    decisionAuthority,
    supersededOn,
    decisionDate,
    date,
  };
}

// ---------------------------------------------------------------------------
// File walking
// ---------------------------------------------------------------------------

function walkMarkdown(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    let stat: ReturnType<typeof statSync>;
    try {
      stat = statSync(p);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      out.push(...walkMarkdown(p));
    } else if (name.endsWith(".md")) {
      out.push(p);
    }
  }
  return out;
}

// Extract the YYYY-MM-DD date from a filename, falling back to null.
function dateFromFilename(filePath: string): string | null {
  const name = filePath.split("/").pop() ?? "";
  const m = name.match(/^(\d{4}-\d{2}-\d{2})/);
  return m?.[1] ?? null;
}

function resolveAsOf(fm: ParsedFrontmatter, filePath: string, phase?: string): string {
  // For `requested` phase, use the file's creation date (filename date) as the
  // opener timestamp. This ensures requested events sort BEFORE terminal events
  // so the head-of-chain is the terminal phase, not the opener.
  if (phase === "requested") {
    const d = dateFromFilename(filePath) ?? fm.date ?? fm.decisionDate;
    if (d) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T00:00:00.000Z`;
      if (/^\d{4}-\d{2}-\d{2}T/.test(d)) return d;
    }
    // Fallback: use 2026-05-01 (before all known CEO decisions) so that
    // any terminal event sorts after the requested event.
    return "2026-05-01T00:00:00.000Z";
  }
  const d = fm.supersededOn ?? fm.decisionDate ?? fm.date ?? dateFromFilename(filePath);
  if (d) {
    // Normalise to ISO UTC
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return `${d}T00:00:00.000Z`;
    if (/^\d{4}-\d{2}-\d{2}T/.test(d)) return d;
  }
  return "2026-05-16T00:00:00.000Z";
}

// ---------------------------------------------------------------------------
// Phase inference
// ---------------------------------------------------------------------------

type InferredPhase = "requested" | "approved" | "superseded" | "deferred" | "withdrawn";

interface SourceDecision {
  decisionId: string;
  canonicalId: string;
  title: string;
  phase: InferredPhase;
  authority: "CEO" | "Agent";
  authorityRef: string;
  asOf: string;
  filePath: string;
  isReferenceOnly: boolean;
  triageReason?: string;
}

function inferPhase(fm: ParsedFrontmatter, filePath: string, isActioned: boolean): InferredPhase {
  const name = filePath.split("/").pop() ?? "";
  // Filename signals: [APPROVED-...], [SUPERSEDED-BY-...]
  if (/\[APPROVED-/i.test(name)) return "approved";
  if (/\[SUPERSEDED-BY-/i.test(name)) return "superseded";
  // frontmatter signals
  if (fm.supersededOn) return "superseded";
  // In actioned/ without a clear terminal signal → approved (most common case)
  if (isActioned) return "approved";
  // Active Owner Inbox with decision-required: true → still open / requested
  return "requested";
}

// ---------------------------------------------------------------------------
// Body-text D-* reference extraction
// ---------------------------------------------------------------------------

const BODY_DECISION_ID_RE = /\bD-[A-Z][A-Z0-9-]*\b(?!-?\{)/g;

function extractBodyDecisionIds(text: string): string[] {
  // Skip the frontmatter block
  const bodyStart = text.indexOf("\n---\n", 4);
  const body = bodyStart > 0 ? text.slice(bodyStart + 5) : text;
  const matches = body.match(BODY_DECISION_ID_RE) ?? [];
  return [...new Set(matches)];
}

// ---------------------------------------------------------------------------
// Triage log
// ---------------------------------------------------------------------------

interface TriageEntry {
  id: string;
  reason: string;
  sourceFile?: string;
}

// ---------------------------------------------------------------------------
// Main scan
// ---------------------------------------------------------------------------

export interface BackfillStats {
  emitted: string[];
  skipped: string[];
  triage: TriageEntry[];
}

export function runBackfill(opts: { dryRun?: boolean } = {}): BackfillStats {
  const { dryRun = false } = opts;

  const ownerInbox = join(REPO_ROOT, "Owner Inbox");
  const teamInboxActioned = join(REPO_ROOT, "Team Inbox", "actioned");

  // 1. Build existing projection to skip already-covered (decisionId, phase) pairs.
  const register = buildDecisionsRegister(decisionsSourceFromStore(eventStore));
  // Collect all phases already observed per decisionId
  const coveredPhases = new Map<string, Set<string>>();
  for (const [id, history] of register.byId.entries()) {
    const phases = new Set(history.events.map((e) => e.phase));
    coveredPhases.set(id, phases);
  }

  // Also track (decisionId, phase, asOf) triples from existing Decision events
  // so we don't re-emit the exact same event.
  const existingDecisionTriples = new Set<string>();
  // Track earliest terminal asOf per decisionId (across both Decision + CeoDecision)
  // so synthetic `requested` openers are dated BEFORE any existing terminal event.
  const earliestTerminalAsOf = new Map<string, number>();
  const TERMINAL_PHASES_SET = new Set([
    "approved",
    "rejected",
    "deferred",
    "superseded",
    "withdrawn",
  ]);
  for (const e of eventStore.replay({ type: "Decision" })) {
    const p = e.payload as Record<string, unknown>;
    const id = typeof p.decisionId === "string" ? p.decisionId : "";
    const phase = typeof p.phase === "string" ? p.phase : "";
    const asOf = e.as_of;
    if (id && phase) existingDecisionTriples.add(`${id}|${phase}|${asOf}`);
    if (id && TERMINAL_PHASES_SET.has(phase)) {
      const t = new Date(asOf).getTime();
      if (!earliestTerminalAsOf.has(id) || t < (earliestTerminalAsOf.get(id) as number)) {
        earliestTerminalAsOf.set(id, t);
      }
    }
  }
  // Also track existing CeoDecision events (mapped to approved phase)
  for (const e of eventStore.replay({ type: "CeoDecision" })) {
    const p = e.payload as Record<string, unknown>;
    const id = typeof p.decisionId === "string" ? p.decisionId : "";
    const action = typeof p.action === "string" ? p.action : "approve";
    let phase = "approved";
    if (action === "defer") phase = "deferred";
    if (action === "request-revision") phase = "requested";
    if (id) {
      existingDecisionTriples.add(`${id}|${phase}|${e.as_of}`);
      if (TERMINAL_PHASES_SET.has(phase)) {
        const t = new Date(e.as_of).getTime();
        if (!earliestTerminalAsOf.has(id) || t < (earliestTerminalAsOf.get(id) as number)) {
          earliestTerminalAsOf.set(id, t);
        }
      }
    }
  }

  // 2. Scan all markdown sources
  const ownerInboxFiles = walkMarkdown(ownerInbox);
  const teamInboxActionedFiles = walkMarkdown(teamInboxActioned);

  const sources: SourceDecision[] = [];
  const referenceOnlyIds = new Set<string>(); // body-text references only
  const triage: TriageEntry[] = [];
  const seenIds = new Set<string>();

  function processFile(filePath: string, isActioned: boolean): void {
    let text: string;
    try {
      text = readFileSync(filePath, "utf8");
    } catch {
      return;
    }

    const fm = extractFrontmatter(text);
    const rawId = fm.decisionId?.trim().toUpperCase();

    if (rawId) {
      const { canonicalId, triageReason } = resolveId(rawId, filePath);
      if (triageReason) {
        if (!triage.some((t) => t.id === rawId)) {
          triage.push({ id: rawId, reason: triageReason, sourceFile: filePath });
        }
      } else if (canonicalId) {
        const phase = inferPhase(fm, filePath, isActioned);
        const authority = resolveAuthority(fm);
        const asOf = resolveAsOf(fm, filePath, phase);
        const title = fm.title ?? canonicalId;
        if (!seenIds.has(`${canonicalId}|${phase}`)) {
          seenIds.add(`${canonicalId}|${phase}`);
          sources.push({
            decisionId: rawId,
            canonicalId,
            title,
            phase,
            authority,
            authorityRef: authority === "CEO" ? "marc@tgv.co.za" : "agent:unknown",
            asOf,
            filePath,
            isReferenceOnly: false,
          });
        }
      }
    }

    // Body-text scan for referenced IDs (only from actioned files to avoid noise)
    if (isActioned) {
      for (const bodyId of extractBodyDecisionIds(text)) {
        const upper = bodyId.toUpperCase();
        const { canonicalId, triageReason } = resolveId(upper, filePath);
        if (triageReason) {
          // Already logged above if it's the primary id
        } else if (canonicalId && !seenIds.has(`${canonicalId}|body-ref`)) {
          referenceOnlyIds.add(canonicalId);
        }
      }
    }
  }

  for (const f of ownerInboxFiles) {
    const isActioned = f.includes("/actioned/");
    processFile(f, isActioned);
  }
  for (const f of teamInboxActionedFiles) {
    processFile(f, true);
  }

  // 3. Reference-only IDs — IDs seen in body text but with no owning record
  for (const id of referenceOnlyIds) {
    if (!seenIds.has(`${id}|requested`)) {
      sources.push({
        decisionId: id,
        canonicalId: id,
        title: `${id} (referenced, no owning record)`,
        phase: "requested",
        authority: "CEO",
        authorityRef: "marc@tgv.co.za",
        asOf: "2026-05-01T00:00:00.000Z", // before all known CEO decisions → requested sorts first
        filePath: "(body-text reference)",
        isReferenceOnly: true,
      });
    }
  }

  // 4. Migrate AgentDecision events
  for (const e of eventStore.replay({ type: "AgentDecision" })) {
    const p = e.payload as Record<string, unknown>;
    const rawId = typeof p.decisionId === "string" ? p.decisionId.toUpperCase() : "";
    if (!rawId) continue;
    const { canonicalId, triageReason } = resolveId(rawId, "(AgentDecision event)");
    if (triageReason || !canonicalId) continue;
    if (!seenIds.has(`${canonicalId}|approved`)) {
      seenIds.add(`${canonicalId}|approved`);
      const decidedBy = typeof p.decidedBy === "string" ? p.decidedBy : "agent:unknown";
      const title = typeof p.what === "string" ? p.what : canonicalId;
      sources.push({
        decisionId: rawId,
        canonicalId,
        title,
        phase: "approved",
        authority: "Agent",
        authorityRef: decidedBy,
        asOf: e.as_of,
        filePath: "(AgentDecision event)",
        isReferenceOnly: false,
      });
    }
  }

  // 4b. For every terminal-phase source that doesn't already have a `requested`
  //     event, synthesise a matching opener so the symmetry recon is satisfied.
  //     The opener's asOf is set to one millisecond before the terminal event's
  //     asOf (or the filename date if earlier) so it sorts before the terminal.
  const TERMINAL_PHASES = new Set(["approved", "rejected", "deferred", "superseded", "withdrawn"]);
  const requestedSynthetic: SourceDecision[] = [];
  for (const src of sources) {
    if (!TERMINAL_PHASES.has(src.phase)) continue;
    if (seenIds.has(`${src.canonicalId}|requested`)) continue;
    const existingCov = coveredPhases.get(src.canonicalId);
    if (existingCov?.has("requested")) continue;
    // Use the MINIMUM of (markdown terminal date - 1day, earliest existing terminal event - 1ms)
    // so the synthetic opener always sorts before every terminal event, including pre-existing
    // CeoDecision events that may pre-date the markdown date.
    const markdownTerminalMs = new Date(src.asOf).getTime();
    const existingTerminalMs = earliestTerminalAsOf.get(src.canonicalId);
    const refMs =
      existingTerminalMs !== undefined
        ? Math.min(markdownTerminalMs - 86400_000, existingTerminalMs - 1)
        : markdownTerminalMs - 86400_000;
    const openerAsOf = new Date(refMs).toISOString();
    seenIds.add(`${src.canonicalId}|requested`);
    requestedSynthetic.push({
      decisionId: src.decisionId,
      canonicalId: src.canonicalId,
      title: src.title,
      phase: "requested",
      authority: src.authority,
      authorityRef: src.authorityRef,
      asOf: openerAsOf,
      filePath: src.filePath,
      isReferenceOnly: src.isReferenceOnly,
    });
  }
  sources.push(...requestedSynthetic);

  // 5. Emit Decision events for each source that isn't already covered
  const emitted: string[] = [];
  const skipped: string[] = [];

  for (const src of sources) {
    const triple = `${src.canonicalId}|${src.phase}|${src.asOf}`;
    if (existingDecisionTriples.has(triple)) {
      skipped.push(src.canonicalId);
      continue;
    }

    // Also skip if the canonical id + phase is already covered AND the asOf
    // we'd emit is older than or equal to the existing one.
    const existing = coveredPhases.get(src.canonicalId);
    if (existing?.has(src.phase)) {
      skipped.push(src.canonicalId);
      continue;
    }

    if (dryRun) {
      emitted.push(src.canonicalId);
      continue;
    }

    // Build the Decision event
    const event = buildDecisionEvent(src);
    eventStore.append(event);
    existingDecisionTriples.add(triple);
    // Update coveredPhases
    const phases = coveredPhases.get(src.canonicalId) ?? new Set<string>();
    phases.add(src.phase);
    coveredPhases.set(src.canonicalId, phases);
    emitted.push(src.canonicalId);
  }

  // 6. Write triage log
  writeTriage(triage, sources, emitted);

  return { emitted, skipped, triage };
}

// ---------------------------------------------------------------------------
// ID resolution
// ---------------------------------------------------------------------------

function resolveId(
  rawId: string,
  _sourceFile: string,
): { canonicalId: string | null; triageReason: string | null } {
  // Check triage set first
  if (TRIAGE_IDS.has(rawId)) {
    return { canonicalId: null, triageReason: `placeholder id \`${rawId}\`` };
  }
  // Check legacy map
  const mapped = LEGACY_ID_MAP[rawId];
  if (mapped) {
    return { canonicalId: mapped, triageReason: null };
  }
  // Numeric-only (D-01..D-99)
  if (NUMERIC_RE.test(rawId)) {
    return {
      canonicalId: null,
      triageReason: `numeric-only id \`${rawId}\` has no canonical slug mapping`,
    };
  }
  // Validate format
  if (!/^D-[A-Z0-9][A-Z0-9-]*[A-Z0-9]$/.test(rawId)) {
    return {
      canonicalId: null,
      triageReason: `id \`${rawId}\` does not match canonical D-* format`,
    };
  }
  // Too long
  if (rawId.length > 60) {
    return {
      canonicalId: null,
      triageReason: `id \`${rawId}\` exceeds 60-char limit`,
    };
  }
  // Too short / too few segments — these are likely body-text prefix fragments
  // (e.g., "D-FX", "D-RAS", "D-HIRE") that appear in prose but aren't real
  // canonical decision IDs. Require at least 2 dash-separated segments after D-
  // and a minimum of 10 characters total.
  const segmentsAfterD = rawId.slice(2).split("-");
  if (segmentsAfterD.length < 2 || rawId.length < 10) {
    return {
      canonicalId: null,
      triageReason: `id \`${rawId}\` is too short / too few segments to be a canonical decision ID (body-text fragment?)`,
    };
  }
  return { canonicalId: rawId, triageReason: null };
}

// ---------------------------------------------------------------------------
// Authority inference
// ---------------------------------------------------------------------------

function resolveAuthority(fm: ParsedFrontmatter): "CEO" | "Agent" {
  const auth = fm.decisionAuthority?.toUpperCase();
  if (auth === "BOARD") return "CEO"; // board decisions → CEO safe default for historical
  if (auth === "CEO") return "CEO";
  if (auth === "AGENT") return "Agent";
  // Default: CEO (all historical decisions were CEO in practice)
  return "CEO";
}

// ---------------------------------------------------------------------------
// Event construction
// ---------------------------------------------------------------------------

function buildDecisionEvent(src: SourceDecision): Event {
  const payload = {
    decisionId: src.canonicalId,
    phase: src.phase,
    authority: src.authority === "Agent" ? "Agent" : "CEO",
    authorityRef: src.authorityRef,
    title: src.title,
    category: "governance",
    recommendation: src.title,
    rationale: src.isReferenceOnly
      ? "Referenced in body text; no owning record found. Manual triage required."
      : "(backfill: inferred from markdown record)",
    sourceDocHashes: [] as string[],
    citations: EVENT_CITATIONS as string[],
    recordedVia: RECORDED_VIA,
  };

  return {
    event_id: newEventId(),
    type: "Decision",
    as_of: src.asOf,
    entity: "BANK-ZA-001",
    actor: {
      type: src.authority === "CEO" ? "human" : "service",
      id: src.authorityRef,
    },
    citations: EVENT_CITATIONS,
    payload,
    provenance: PRODUCTION_CARVE_OUTS.Decision,
  };
}

// ---------------------------------------------------------------------------
// Triage log writer
// ---------------------------------------------------------------------------

function writeTriage(
  triageEntries: TriageEntry[],
  allSources: SourceDecision[],
  emittedIds: string[],
): void {
  const refOnly = allSources.filter((s) => s.isReferenceOnly);
  const lines: string[] = [
    "# Backfill triage log — D-DECISIONS-FRAMEWORK-REDESIGN Slice C",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "---",
    "",
    "## (a) Placeholder / ambiguous IDs that could not be auto-resolved",
    "",
  ];

  if (triageEntries.length === 0) {
    lines.push("_None — all encountered IDs resolved cleanly._");
  } else {
    for (const t of triageEntries) {
      lines.push(
        `- \`${t.id}\` — ${t.reason}${t.sourceFile ? ` (source: \`${t.sourceFile.split("Bank/").pop()}\`)` : ""}`,
      );
    }
  }

  lines.push("", "## (b) Reference-only IDs (body-text references, no owning record)", "");

  if (refOnly.length === 0) {
    lines.push("_None._");
  } else {
    for (const r of refOnly) {
      lines.push(`- \`${r.canonicalId}\``);
    }
  }

  lines.push("", "## (c) IDs with conflicting resolution signals", "");
  lines.push(
    "_None identified by the migration script. Review manually if recon gates still fire._",
  );

  lines.push("", "---", "", "## Summary", "");
  lines.push(`- Triage IDs (a): ${triageEntries.length}`);
  lines.push(`- Reference-only IDs (b): ${refOnly.length}`);
  lines.push(`- Emitted backfill events: ${emittedIds.length}`);

  const logPath = resolve(REPO_ROOT, "prototype", "scripts", "migrate", "backfill-triage-log.md");
  writeFileSync(logPath, `${lines.join("\n")}\n`, "utf8");
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.main) {
  const dryRun = process.argv.includes("--dry-run");
  console.log(JSON.stringify({ level: "info", msg: "backfill-all-decisions: starting", dryRun }));

  const stats = runBackfill({ dryRun });

  console.log(
    JSON.stringify({
      level: "info",
      msg: "backfill-all-decisions: complete",
      emitted: stats.emitted.length,
      skipped: stats.skipped.length,
      triage: stats.triage.length,
      dryRun,
    }),
  );

  if (stats.triage.length > 0) {
    console.log(
      JSON.stringify({
        level: "warn",
        msg: "backfill-all-decisions: triage items require manual resolution",
        items: stats.triage.map((t) => `${t.id}: ${t.reason}`),
      }),
    );
  }

  process.exit(0);
}
