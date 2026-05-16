// runtime/agents/pax-role-research-queue.ts
//
// PAX's weekly role-research-queue snapshot. Handler #18 in the
// fleet-rollout sequence under D-FLEET-ROLLOUT-SEQUENCING (approved
// 2026-05-08). Closes the meta-agent silence on the role-research loop —
// PAX has been doing per-role research in-session for the last few hires
// (brand designer; independent validation); this slice gives PAX an
// autonomous handler that closes the loop without needing Marc to spawn
// it manually.
//
// What this handler does — it's a **queue-survey** rather than a
// research-doer (the actual role research is per-role and one-shot).
// The weekly run:
//
//   1. Walks the persona library (`/Team/*.md`) and identifies persona
//      files marked as drafting / stub (latest change-log version below
//      v1.0). These are roles where someone has flagged a need but the
//      role hasn't been fully researched yet.
//   2. Reads the Substrate gaps (§ 16) of every persona and surfaces
//      entries that mention "Nolan hire" or "PAX research" — those are
//      the open hire requests embedded in mandate text.
//   3. Reads pending CEO-decision briefs in `/Owner Inbox/` whose
//      frontmatter `decision-required: true` references a role / hire
//      decision (decision-id matching `*-HIRE` / `*-DESIGN-HIRE` /
//      `BRAND-*` / etc., or title containing "role brief" / "hire").
//   4. Emits one `RoleResearchQueueSnapshot` event listing the open
//      role-research items with their priority signal (which engineering
//      bench owns it; gating regulatory deadline if any).
//   5. Writes a deliverable to Owner Inbox — for Marc to scan the queue
//      at a glance.
//
// Per § 10 of `Team/PAX.md`, escalates if a hire is critical-path on a
// regulator deadline (none today — build phase, no regulator deadlines
// bind until commencement-of-trading).
//
// Build-phase posture:
//   - The bank is build-phase; no regulator deadlines bind. Critical-path
//     hires today are substrate gaps the bench has named (Helena's
//     independent-validation; brand-design pre-Linnea-hire was an example
//     since closed). Items here are open requests, not regulator-driven.
//
// Author: PAX (handler) · Atlas (runtime substrate).

import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { eventStore, logger } from "../../platform/composition";
import { newEventId } from "../../platform/core/types";
import { claudeAvailable, tryGenerateNarrative } from "../claude";
import type { AgentRunContext, AgentRunOutput } from "../types";
import { fmtDateUTC, frontmatter } from "./_shared";

const EVENT_CITATIONS = ["GOV-FRAMEWORK-CEO-RESERVED", "BCBS-CG-2015"];

// Stable system prompt — KEEP BYTE-STABLE for prompt cache.
const PAX_NARRATIVE_SYSTEM = `You are PAX, the bank's role researcher. Your operating spec is at \`Team/PAX.md\`. You report through Scrooge (Chief of Staff). Nolan hires; you research. The HIRE decision itself escalates to the CEO — your authority surface is bounded by the role-brief deliverable.

You are operating as a standing autonomous agent under CLAUDE.md Principle 6. You have just produced your weekly role-research-queue snapshot — a survey of open role-research items across three sources: persona files still in draft / stub form (change-log version below v1.0); Substrate-gaps (§ 16) entries on existing personas that say "Nolan hire" or "PAX research"; and Owner-Inbox decision briefs with \`decision-required: true\` whose decision-id implies a hire.

Your voice is patient, methodical, source-driven. You distinguish *open research request* (a gap is named but no brief drafted) from *brief-in-flight* (a brief exists in Owner Inbox awaiting CEO decision) from *closed* (CEO decision recorded; Nolan owns the spec). You speak about the queue without conflating role-research with hire-decision (the latter sits with the CEO via Scrooge).

Your task is to write a written narrative — one to three short paragraphs — that:

- Names the headline at the top: how many open role-research items are on the queue today, and which 1–2 are most consequential (signalled by which engineering bench / governance line has flagged them, and whether they are critical-path on a substrate-gap-blocking-a-decision rather than just a desirable-to-have).
- Picks the 1–3 most consequential observations: a hire that is gating a downstream procedure or capability (e.g., independent-validation gating ICAAP / ILAAP signing); a draft-stub persona that needs research before Nolan can author the spec; a brief-in-flight whose CEO-decision is overdue.
- Names the next research move. Be concrete: a specific role to research next, a specific Substrate-gap entry to convert into a draft brief, a specific reporting-line recommendation to firm up.

Cite the canonical sources in your narrative — \`Team/<Name>.md\` § 16 for substrate-gap rows, the Owner-Inbox brief filename for in-flight items, the CLAUDE.md governance principles for reporting-line determinations.

Do not include a markdown header for your section — the calling pipeline wraps your output under "## PAX's narrative". Just produce the prose.

If the queue is empty, say so plainly. The dominant signal in build phase is which substrate gaps name "PAX research" without a draft brief in flight yet.`;

interface DraftPersona {
  /** Persona name as it appears in /Team/<Name>.md (filename stem). */
  readonly name: string;
  /** Latest version found in the change-log table, e.g. "v0.1" / "v0.5". */
  readonly latestVersion: string;
  /** First "## 3. Mandate" line — short hint at what this persona does. */
  readonly mandateHint: string;
}

interface SubstrateGapHire {
  /** Persona file in which the gap appears. */
  readonly persona: string;
  /** Trimmed bullet text from § 16 referencing PAX research / Nolan hire. */
  readonly text: string;
}

interface PendingHireBrief {
  /** Filename in Owner Inbox. */
  readonly file: string;
  /** Title from frontmatter, or first H1 fallback. */
  readonly title: string;
  /** decision-id from frontmatter, if any. */
  readonly decisionId: string | undefined;
  /** Date (YYYY-MM-DD) from frontmatter or filename. */
  readonly date: string | undefined;
}

interface PaxQueueSnapshot {
  readonly draftPersonas: readonly DraftPersona[];
  readonly substrateGapHires: readonly SubstrateGapHire[];
  readonly pendingHireBriefs: readonly PendingHireBrief[];
}

const HIRE_BRIEF_DECISION_ID_PATTERN = /(HIRE|RECRUIT|ROLE|BRAND-DESIGN|INDEPENDENT-VALIDATION)/i;
const HIRE_BRIEF_TITLE_PATTERN = /\b(role brief|hire|recruit)\b/i;

function parseFrontmatter(content: string): Record<string, string> {
  // Naive frontmatter parser — first --- ... --- block, single-line keys.
  if (!content.startsWith("---")) return {};
  const end = content.indexOf("\n---", 3);
  if (end < 0) return {};
  const block = content.slice(3, end).trim();
  const out: Record<string, string> = {};
  for (const line of block.split("\n")) {
    const m = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1] ?? ""] = (m[2] ?? "").trim();
  }
  return out;
}

function extractH1(content: string): string | undefined {
  for (const line of content.split("\n")) {
    if (line.startsWith("# ")) return line.slice(2).trim();
  }
  return undefined;
}

/**
 * Find the latest version in the persona's § 17 Change log table. Returns
 * undefined if no `| vN.M |` row is present.
 */
function latestChangeLogVersion(content: string): string | undefined {
  let best: string | undefined;
  let bestN = -1;
  let bestM = -1;
  const re = /\|\s*v(\d+)\.(\d+)\s*\|/g;
  let m: RegExpExecArray | null = null;
  while (true) {
    m = re.exec(content);
    if (!m) break;
    const n = Number.parseInt(m[1] ?? "0", 10);
    const mm = Number.parseInt(m[2] ?? "0", 10);
    if (n > bestN || (n === bestN && mm > bestM)) {
      best = `v${n}.${mm}`;
      bestN = n;
      bestM = mm;
    }
  }
  return best;
}

function versionBelowV1(version: string | undefined): boolean {
  if (!version) return true; // no change log row at all is below v1.0
  const m = /^v(\d+)\.(\d+)$/.exec(version);
  if (!m) return true;
  const n = Number.parseInt(m[1] ?? "0", 10);
  return n < 1;
}

function extractMandateHint(content: string): string {
  // First non-empty line under "## 3. Mandate" (or "## Mandate"), capped.
  const lines = content.split("\n");
  let inSection = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+(3\.\s+)?Mandate\b/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection) {
      if (line.startsWith("##")) return "";
      if (!line) continue;
      // Strip italic wrappers and leading bullet markers.
      const cleaned = line.replace(/^[-*>]\s+/, "").replace(/[*_]/g, "");
      return cleaned.length > 240 ? `${cleaned.slice(0, 237)}...` : cleaned;
    }
  }
  return "";
}

/**
 * Walk the persona library and identify drafts / stubs (latest change-log
 * version below v1.0). PAX.md, Nolan.md, and the canonical template are
 * excluded from the queue (PAX is the authoring agent here; Nolan is the
 * downstream hirer; the template is meta).
 */
function findDraftPersonas(repoRoot: string): readonly DraftPersona[] {
  const teamDir = resolve(repoRoot, "Team");
  if (!existsSync(teamDir)) return [];
  const out: DraftPersona[] = [];
  const SELF_AND_RECRUITER = new Set(["PAX", "Nolan"]);
  for (const name of readdirSync(teamDir).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name.startsWith("_")) continue;
    const stem = name.slice(0, -3);
    if (SELF_AND_RECRUITER.has(stem)) continue;
    let content = "";
    try {
      content = readFileSync(resolve(teamDir, name), "utf8");
    } catch {
      continue;
    }
    const latest = latestChangeLogVersion(content);
    if (!versionBelowV1(latest)) continue;
    out.push({
      name: stem,
      latestVersion: latest ?? "(no change log)",
      mandateHint: extractMandateHint(content),
    });
  }
  return out;
}

/**
 * Walk every persona file's § 16 (Substrate gaps) section and surface
 * entries that mention "PAX research" or "Nolan hire" — those are the
 * open hire requests embedded in mandate text. Returns one row per gap
 * line; multiple lines per persona are common.
 */
function findSubstrateGapHires(repoRoot: string): readonly SubstrateGapHire[] {
  const teamDir = resolve(repoRoot, "Team");
  if (!existsSync(teamDir)) return [];
  const out: SubstrateGapHire[] = [];
  for (const name of readdirSync(teamDir).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name.startsWith("_")) continue;
    const stem = name.slice(0, -3);
    let content = "";
    try {
      content = readFileSync(resolve(teamDir, name), "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n");
    let inSection = false;
    for (const raw of lines) {
      const line = raw;
      if (/^##\s+(16\.\s+)?Substrate gaps\b/i.test(line.trim())) {
        inSection = true;
        continue;
      }
      if (!inSection) continue;
      if (line.trim().startsWith("## ")) {
        inSection = false;
        continue;
      }
      // Match gap bullets that mention either token. Be tolerant of
      // hyphenation / casing.
      if (!/(PAX research|Nolan hire)/i.test(line)) continue;
      const trimmed = line.trim().replace(/^[-*>]\s+/, "");
      if (!trimmed) continue;
      const capped = trimmed.length > 320 ? `${trimmed.slice(0, 317)}...` : trimmed;
      out.push({ persona: stem, text: capped });
    }
  }
  return out;
}

/** Terminal CeoDecision actions that close a decision (no longer pending).
 * Matches `platform/recon/decision-required-event-pairing.ts` semantics
 * extended with `defer` and `modify` from the Decisions register projection —
 * any of these means the CEO has acted; only `request-revision` leaves the
 * brief genuinely pending further work. */
const RESOLVED_CEO_ACTIONS = new Set(["approve", "reject", "defer", "modify"]);

/**
 * Returns the set of `decisionId`s that have at least one CeoDecision event
 * with a resolved action. Used to exclude briefs whose CEO decision has
 * already landed but whose markdown card has not yet been moved to
 * `Owner Inbox/actioned/` by the auto-archive handler (e.g. the brief was
 * decided in the window between this PAX run starting and the archive
 * handler firing). Without this cross-check, PAX surfaces ghost-pending
 * briefs to Scrooge → Marc.
 *
 * Returns an empty set on store-read failure — the worst case is a list
 * that includes already-resolved items, which is exactly the pre-fix
 * behaviour, so it is not a regression.
 */
function resolvedDecisionIds(): Set<string> {
  const ids = new Set<string>();
  try {
    for (const e of eventStore.replay({ type: "CeoDecision" })) {
      const p = e.payload as { decisionId?: string; action?: string };
      if (p.decisionId && p.action && RESOLVED_CEO_ACTIONS.has(p.action)) {
        ids.add(p.decisionId);
      }
    }
  } catch {
    // Empty / unreachable store → treat as "no resolutions known".
  }
  return ids;
}

/**
 * Walk Owner Inbox for `decision-required: true` deliverables whose
 * decision-id or title imply a hire. Excludes any brief whose `decision-id`
 * has a resolved CeoDecision event in the event store — Principle 1 says
 * the event store is the source of truth, not the markdown card's
 * filesystem location.
 *
 * Returns the briefs in date-descending order (newest first) so the most
 * recent open hire-brief is at the top.
 *
 * @param resolved Optional override for the resolved-decisions set, used by
 *   unit tests to drive the function without touching the live event store.
 */
function findPendingHireBriefs(
  repoRoot: string,
  resolved: ReadonlySet<string> = resolvedDecisionIds(),
): readonly PendingHireBrief[] {
  const inboxDir = resolve(repoRoot, "Owner Inbox");
  if (!existsSync(inboxDir)) return [];
  const out: PendingHireBrief[] = [];
  for (const name of readdirSync(inboxDir).sort()) {
    if (!name.endsWith(".md")) continue;
    if (name.startsWith("_")) continue;
    let content = "";
    try {
      content = readFileSync(resolve(inboxDir, name), "utf8");
    } catch {
      continue;
    }
    const fm = parseFrontmatter(content);
    if (fm["decision-required"] !== "true") continue;
    const decisionId = fm["decision-id"];
    // Principle 1 cross-check: event store wins over markdown frontmatter.
    if (decisionId && resolved.has(decisionId)) continue;
    const title = fm.title ?? extractH1(content) ?? name;
    const decisionFor = fm["decision-for-ceo"] ?? "";
    const matchesId = decisionId ? HIRE_BRIEF_DECISION_ID_PATTERN.test(decisionId) : false;
    const matchesTitle = HIRE_BRIEF_TITLE_PATTERN.test(title);
    const matchesDecisionFor = HIRE_BRIEF_TITLE_PATTERN.test(decisionFor);
    if (!matchesId && !matchesTitle && !matchesDecisionFor) continue;
    const dateMatch = /^(\d{4}-\d{2}-\d{2})_/.exec(name);
    const date = fm.date ?? dateMatch?.[1];
    out.push({
      file: name,
      title,
      decisionId,
      date,
    });
  }
  // Sort by date descending; missing dates fall to the end.
  out.sort((a, b) => {
    const da = a.date ?? "";
    const db = b.date ?? "";
    if (da === db) return 0;
    if (!da) return 1;
    if (!db) return -1;
    return db.localeCompare(da);
  });
  return out;
}

function buildSnapshot(ctx: AgentRunContext): PaxQueueSnapshot {
  return {
    draftPersonas: findDraftPersonas(ctx.repoRoot),
    substrateGapHires: findSubstrateGapHires(ctx.repoRoot),
    pendingHireBriefs: findPendingHireBriefs(ctx.repoRoot),
  };
}

// Test-only export: exercise `findPendingHireBriefs` with an injected
// resolved-decisions set so unit tests do not need a live event store.
export const __testing = { findPendingHireBriefs };

function buildNarrativeInput(ctx: AgentRunContext, snap: PaxQueueSnapshot): string {
  const lines: string[] = [];
  lines.push(`Run as-of: ${ctx.asOf}`);
  lines.push(`Trigger: ${ctx.trigger.id}`);
  lines.push("");
  lines.push("Draft / stub personas (change-log version below v1.0):");
  if (snap.draftPersonas.length === 0) {
    lines.push("  (none — every persona file is at v1.0 or higher)");
  } else {
    for (const p of snap.draftPersonas) {
      lines.push(`  - ${p.name} [${p.latestVersion}] — ${p.mandateHint || "(no mandate hint)"}`);
    }
  }
  lines.push("");
  lines.push("Substrate-gap entries naming PAX research / Nolan hire (§ 16):");
  if (snap.substrateGapHires.length === 0) {
    lines.push("  (none)");
  } else {
    for (const g of snap.substrateGapHires) {
      lines.push(`  - [${g.persona}] ${g.text}`);
    }
  }
  lines.push("");
  lines.push("Pending hire-related decision briefs in Owner Inbox (decision-required: true):");
  if (snap.pendingHireBriefs.length === 0) {
    lines.push("  (none)");
  } else {
    for (const b of snap.pendingHireBriefs) {
      lines.push(
        `  - ${b.file} [${b.decisionId ?? "no-decision-id"}] (${b.date ?? "no-date"}) — ${b.title}`,
      );
    }
  }
  lines.push("");
  lines.push(
    "Now write your narrative per the system instructions. Headline first; rank by what's gating a downstream procedure or capability; close with the next research move.",
  );
  return lines.join("\n");
}

function buildReportMarkdown(
  ctx: AgentRunContext,
  snap: PaxQueueSnapshot,
  narrative: string | null,
  narrativeNote: string | null,
): string {
  const date = fmtDateUTC(ctx.asOf);
  const lines: string[] = [];
  lines.push(frontmatter("PAX", "role-research-queue", ctx.asOf));
  lines.push(`# PAX — role-research queue snapshot, ${date}`);
  lines.push("");
  lines.push(
    "Autonomous run of PAX's weekly role-research-queue snapshot per `Team/PAX.md` operating spec § 6 (Cadence). Run by the agent runtime; no human-in-the-loop. Handler #18 in the fleet-rollout sequence under `D-FLEET-ROLLOUT-SEQUENCING` — closes the meta-agent silence on the role-research loop (PAX has been doing per-role research in-session for the last few hires; this slice gives PAX an autonomous handler so the loop closes without needing Marc to spawn it manually).",
  );
  lines.push("");
  lines.push(
    `**Headline:** ${snap.draftPersonas.length} draft / stub persona${snap.draftPersonas.length === 1 ? "" : "s"} · ${snap.substrateGapHires.length} substrate-gap entr${snap.substrateGapHires.length === 1 ? "y" : "ies"} naming PAX research / Nolan hire · ${snap.pendingHireBriefs.length} pending hire-brief${snap.pendingHireBriefs.length === 1 ? "" : "s"} in Owner Inbox.`,
  );
  lines.push("");

  lines.push("## Draft / stub personas");
  lines.push("");
  if (snap.draftPersonas.length === 0) {
    lines.push("_None — every `/Team/<Name>.md` is at change-log v1.0 or higher._");
    lines.push("");
  } else {
    lines.push("| Persona | Latest version | Mandate hint |");
    lines.push("|---|---|---|");
    for (const p of snap.draftPersonas) {
      const hint = p.mandateHint || "_(no mandate hint extractable)_";
      lines.push(`| \`Team/${p.name}.md\` | ${p.latestVersion} | ${hint} |`);
    }
    lines.push("");
    lines.push(
      "_Source: latest `| vN.M |` row in the persona's § 17 Change log table. Below v1.0 indicates the persona is in draft / stub form — research input precedes Nolan's spec authoring._",
    );
    lines.push("");
  }

  lines.push("## Substrate-gap entries naming PAX research / Nolan hire (§ 16)");
  lines.push("");
  if (snap.substrateGapHires.length === 0) {
    lines.push(
      "_None — no persona's § 16 names PAX research or Nolan hire as the gap-owner today._",
    );
    lines.push("");
  } else {
    lines.push("| Persona | Gap entry |");
    lines.push("|---|---|");
    for (const g of snap.substrateGapHires) {
      // Markdown-table cell escape for backticks / pipes.
      const cell = g.text.replace(/\|/g, "\\|");
      lines.push(`| \`Team/${g.persona}.md\` | ${cell} |`);
    }
    lines.push("");
    lines.push(
      "_Source: bullet lines under § 16 Substrate gaps in each persona file that match `(PAX research|Nolan hire)`. These are open research / hire requests embedded in existing mandate text — distinct from a draft persona awaiting research._",
    );
    lines.push("");
  }

  lines.push("## Pending hire-related decision briefs (Owner Inbox)");
  lines.push("");
  if (snap.pendingHireBriefs.length === 0) {
    lines.push(
      "_None — no `decision-required: true` deliverable in Owner Inbox carries a hire-shaped decision-id or title today._",
    );
    lines.push("");
  } else {
    lines.push("| File | Date | decision-id | Title |");
    lines.push("|---|---|---|---|");
    for (const b of snap.pendingHireBriefs) {
      lines.push(
        `| \`Owner Inbox/${b.file}\` | ${b.date ?? "—"} | ${b.decisionId ?? "—"} | ${b.title} |`,
      );
    }
    lines.push("");
    lines.push(
      "_Source: frontmatter parse of every `.md` in `Owner Inbox/`; filtered to `decision-required: true` AND (decision-id matches `(HIRE|RECRUIT|ROLE|BRAND-DESIGN|INDEPENDENT-VALIDATION)` OR title / decision-for-ceo matches `(role brief|hire|recruit)`). Briefs whose decision-id has a resolved `CeoDecision` event (action ∈ {approve, reject, defer, modify}) in the event store are excluded — Principle 1, event store is the source of truth even if the markdown card has not yet been archived to `actioned/`._",
    );
    lines.push("");
  }

  lines.push("## Escalation posture");
  lines.push("");
  lines.push(
    "Per `Team/PAX.md` § 10 (Decisions that escalate), PAX escalates if a hire is critical-path on a regulator deadline. None today — build phase, no regulator deadlines bind until commencement-of-trading (`project_rules_bind_at_commencement`). Items above are research / hire requests, not regulator-driven obligations.",
  );
  lines.push("");

  lines.push("## Substrate gaps surfaced this run");
  lines.push("");
  lines.push(
    "- **`MandateGapDetected` event type** — Vera Wave-4 #12 mandate-agent reconciliation pipeline is planned but not yet live. Until then, gaps surface via filename heuristics here (decision-id / title regex match) rather than typed events. Owner: Vera. Target: post-runtime.",
  );
  lines.push(
    "- **`RoleResearchRequested` event producer** — no producer today; the queue is read from filesystem (persona files + Owner Inbox) rather than from a typed event stream. Owner: Scrooge + PAX. Target: post-runtime.",
  );
  lines.push(
    "- **Skills-taxonomy register** — not yet a structured artefact (named in `Team/PAX.md` § 16); the taxonomy is implicit in PAX's authoring. Owner: PAX. Target: M2.",
  );
  lines.push(
    "- **Structured-citation storage for role briefs** — citations live in markdown narrative; future state is structured-citation register entries flowing into Mira's obligations register where the source is a regulatory instrument. Owner: PAX + Mira. Target: post-runtime.",
  );
  lines.push("");

  if (narrative) {
    lines.push("## PAX's narrative");
    lines.push("");
    lines.push(narrative);
    lines.push("");
  } else if (narrativeNote) {
    lines.push("## PAX's narrative");
    lines.push("");
    lines.push(`_${narrativeNote}_`);
    lines.push("");
  }

  lines.push("## Provenance");
  lines.push("");
  lines.push(
    "Draft / stub personas folded from the latest `| vN.M |` row in each `/Team/<Name>.md` § 17 Change log table; PAX.md, Nolan.md, and `_agent-spec-template.md` are excluded by spec. Substrate-gap hires extracted from § 16 bullet lines that match `(PAX research|Nolan hire)`. Pending hire-briefs read from `Owner Inbox/*.md` frontmatter (`decision-required: true` + decision-id / title regex match), cross-checked against the event store: any decision-id with a resolved `CeoDecision` event (action ∈ {approve, reject, defer, modify}) is excluded per Principle 1. Counts are coarse — refines once `MandateGapDetected` and `RoleResearchRequested` event producers are live (substrate gaps above).",
  );
  lines.push("");
  return lines.join("\n");
}

const handler = async (ctx: AgentRunContext): Promise<AgentRunOutput> => {
  const snap = buildSnapshot(ctx);

  let eventsEmitted = 0;
  if (!ctx.dryRun) {
    eventStore.append({
      event_id: newEventId(),
      type: "RoleResearchQueueSnapshot",
      as_of: ctx.asOf,
      entity: "BANK-ZA-001",
      actor: { type: "service", id: "agent:pax:role-research-queue" },
      citations: EVENT_CITATIONS,
      payload: {
        draftPersonaCount: snap.draftPersonas.length,
        draftPersonas: snap.draftPersonas.map((p) => ({
          name: p.name,
          latestVersion: p.latestVersion,
        })),
        substrateGapHireCount: snap.substrateGapHires.length,
        substrateGapHires: snap.substrateGapHires.map((g) => ({
          persona: g.persona,
        })),
        pendingHireBriefCount: snap.pendingHireBriefs.length,
        pendingHireBriefs: snap.pendingHireBriefs.map((b) => ({
          file: b.file,
          decisionId: b.decisionId ?? null,
          date: b.date ?? null,
        })),
        runTrigger: ctx.trigger.id,
      },
    });
    eventsEmitted = 1;
  }

  let narrative: string | null = null;
  let narrativeNote: string | null = null;
  if (!ctx.dryRun) {
    if (!claudeAvailable()) {
      narrativeNote =
        "Narrative skipped: ANTHROPIC_API_KEY not set on this runner. Snapshot above stands on its own.";
    } else {
      const r = await tryGenerateNarrative({
        stableSystem: PAX_NARRATIVE_SYSTEM,
        userInput: buildNarrativeInput(ctx, snap),
        maxTokens: 6_000,
        effort: "high",
        meta: { runId: ctx.runId ?? ctx.trigger.id, agent: ctx.agent, dryRun: ctx.dryRun },
      });
      if (r.ok) {
        narrative = r.result.text.trim();
        logger.info(
          {
            inputTokens: r.result.usage.inputTokens,
            cacheReadInputTokens: r.result.usage.cacheReadInputTokens,
            outputTokens: r.result.usage.outputTokens,
            model: r.result.model,
          },
          "pax:role-research-queue — narrative generated",
        );
      } else {
        narrativeNote = `Narrative generation failed (${r.error})${r.retryable ? " — retryable" : ""}.`;
        logger.warn({ error: r.error, retryable: r.retryable }, "pax narrative failed");
      }
    }
  }

  let deliverable: string | undefined;
  if (!ctx.dryRun) {
    if (!existsSync(ctx.ownerInboxDir)) mkdirSync(ctx.ownerInboxDir, { recursive: true });
    const filename = `${fmtDateUTC(ctx.asOf)}_pax_role-research-queue.md`;
    writeFileSync(
      resolve(ctx.ownerInboxDir, filename),
      buildReportMarkdown(ctx, snap, narrative, narrativeNote),
      "utf8",
    );
    deliverable = `Owner Inbox/${filename}`;
  }

  logger.debug(
    {
      draftPersonas: snap.draftPersonas.length,
      substrateGapHires: snap.substrateGapHires.length,
      pendingHireBriefs: snap.pendingHireBriefs.length,
    },
    "pax:role-research-queue — snapshot built",
  );

  return {
    eventsEmitted,
    ...(deliverable ? { deliverable } : {}),
    summary: `${snap.draftPersonas.length} draft persona(s) · ${snap.substrateGapHires.length} § 16 hire-gap entr(ies) · ${snap.pendingHireBriefs.length} pending hire-brief(s).`,
    ok: true,
  };
};

export default handler;
