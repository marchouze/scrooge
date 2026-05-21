// scripts/audit/find-deprecated-entity-refs.ts
//
// Vera audit — surface every event in the canonical event store whose
// `event.entity` value is NOT an active legal-entity short-id per
// `prototype/platform/identity/entity-short-ids.ts`
// (`LEGAL_ENTITY_SHORT_ID_REGISTRY`).
//
// Background
// ----------
// Atlas (Core banking platform architect, engineering) + Imani (Chief
// Legal Counsel, governance) shipped the entity-identity unification in
// PR #669 (`feat(party): entity-identity unification — single canonical
// identifier for the bank itself`, merged 2026-05-21 08:57Z), retiring
// the legacy `BANK-ZA-001` short-id in favour of canonical
// `LE-ZA-HOZ-BANK`. Owen (Company Secretary, governance) flagged in
// PR #672 close-out that the original D-OPRISK-ENGINEER-ROLE script
// (PR #666) had run BEFORE that cutover and emitted Decision / RecordFiled
// events carrying the deprecated `BANK-ZA-001`, and that the new
// `recon:entity-identity-coherence` (Atlas, PR #669) is hard-fail on
// any non-canonical `entity` value.
//
// This script is the read-only audit Owen requested:
//   - iterate every event in the canonical event store;
//   - group non-canonical `entity` values by (type, actor.id);
//   - surface earliest + latest `as_of` per group;
//   - classify pre-cutover (historical, immutable) vs post-cutover
//     (live source drift requiring code fix);
//   - emit a JSON summary to stdout and a markdown report at repo root.
//
// Authority
// ---------
// - D-PARTY-REGISTER (CEO-approved 2026-05-11) — Party register heads
//   the identity chain.
// - PR #669 (Atlas + Imani entity-identity unification) — sole canonical
//   short-id for the bank entity.
// - PR #666 (Owen — D-OPRISK-ENGINEER-ROLE decision card) — original
//   pre-cutover offender flagged by Owen.
// - PR #672 (Owen — Option B implementation) — surfaced this audit.
// - `prototype/platform/identity/entity-short-ids.ts` — resolution
//   authority the recon walks (this audit walks the same).
//
// Output
// ------
// - JSON to stdout (CI / pipeline ingest).
// - Markdown report to `<repo-root>/2026-05-21_vera_deprecated-entity-audit.md`
//   (Block A artefact; the same file is filed as a `RecordFiled` deliverable
//   under register-key `documents`).
//
// Read-only. This script never appends to the event store; remediation
// (if any) is a downstream brief Marc reviews.
//
// Author: Vera (Internal audit engineer, governance — functional reporting
//   to Thandiwe (Chief Audit Executive, governance)).

import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { eventStore } from "../../platform/composition";
import {
  ACTIVE_SHORT_IDS,
  LEGAL_ENTITY_SHORT_ID_REGISTRY,
  lookupShortId,
} from "../../platform/identity/entity-short-ids";

// ---------------------------------------------------------------------------
// Migration cutover boundary
// ---------------------------------------------------------------------------
//
// PR #669 (entity-identity unification, merged 2026-05-21 08:57:13Z UTC)
// is the source-level cutover. Events emitted BEFORE this timestamp may
// legitimately carry the legacy `BANK-ZA-001` short-id — they predate the
// unification decision and are append-only history (Principle 1: events
// are immutable). Events emitted AT OR AFTER this timestamp are live
// source drift — they indicate code paths that still hardcode the
// retired short-id.
//
// The recommendation in §Block B treats the two cohorts differently.
const MIGRATION_BOUNDARY_TIMESTAMP = "2026-05-21T08:57:13.000Z" as const;

// ---------------------------------------------------------------------------
// Finding shape
// ---------------------------------------------------------------------------

interface FindingGroup {
  /** The non-canonical `entity` value observed on these events. */
  readonly entity: string;
  /** Event type, e.g. "Decision", "RecordFiled". */
  readonly eventType: string;
  /** Emitting actor (actor.id from the canonical event shape). */
  readonly actorId: string;
  /** Number of events in the group. */
  readonly count: number;
  /** Earliest as_of in the group. */
  readonly earliestAsOf: string;
  /** Latest as_of in the group. */
  readonly latestAsOf: string;
  /** Number of events at or after the migration cutover (live drift). */
  readonly postCutoverCount: number;
  /** Cohort classification — derived from postCutoverCount and earliestAsOf. */
  readonly cohort: "pre-cutover" | "post-cutover" | "mixed";
}

interface AuditSummary {
  readonly pipeline: "vera:deprecated-entity-refs";
  readonly migrationBoundary: string;
  readonly canonicalActiveShortIds: readonly string[];
  readonly totalEvents: number;
  readonly canonicalEvents: number;
  readonly nonCanonicalEvents: number;
  readonly nonCanonicalEntityValues: readonly string[];
  /** Distinct entity values seen across the whole store. */
  readonly entityDistribution: ReadonlyArray<{
    readonly entity: string;
    readonly count: number;
    readonly status: "active" | "retired" | "unregistered";
  }>;
  /** Per-(entity, type, actor) finding rows. */
  readonly findings: readonly FindingGroup[];
  /** Aggregated post-cutover live drift — these need source fixes. */
  readonly postCutoverDrift: readonly FindingGroup[];
}

// ---------------------------------------------------------------------------
// Audit walk
// ---------------------------------------------------------------------------

function classifyEntity(entity: string): "active" | "retired" | "unregistered" {
  const entry = lookupShortId(entity);
  if (entry === null) return "unregistered";
  return entry.status === "active" ? "active" : "retired";
}

function isCanonicalActive(entity: string): boolean {
  const entry = lookupShortId(entity);
  return entry !== null && entry.status === "active";
}

function buildSummary(): AuditSummary {
  // Group key: `${entity}|${type}|${actorId}`
  type Acc = {
    entity: string;
    eventType: string;
    actorId: string;
    count: number;
    earliestAsOf: string;
    latestAsOf: string;
    postCutoverCount: number;
  };
  const groups = new Map<string, Acc>();
  const entityCounts = new Map<string, number>();

  let totalEvents = 0;
  let canonicalEvents = 0;
  let nonCanonicalEvents = 0;

  for (const ev of eventStore.replay({})) {
    totalEvents++;
    entityCounts.set(ev.entity, (entityCounts.get(ev.entity) ?? 0) + 1);

    if (isCanonicalActive(ev.entity)) {
      canonicalEvents++;
      continue;
    }
    nonCanonicalEvents++;

    const key = `${ev.entity}|${ev.type}|${ev.actor.id}`;
    const existing = groups.get(key);
    const postCutoverInc = ev.as_of >= MIGRATION_BOUNDARY_TIMESTAMP ? 1 : 0;
    if (existing === undefined) {
      groups.set(key, {
        entity: ev.entity,
        eventType: ev.type,
        actorId: ev.actor.id,
        count: 1,
        earliestAsOf: ev.as_of,
        latestAsOf: ev.as_of,
        postCutoverCount: postCutoverInc,
      });
    } else {
      existing.count++;
      if (ev.as_of < existing.earliestAsOf) existing.earliestAsOf = ev.as_of;
      if (ev.as_of > existing.latestAsOf) existing.latestAsOf = ev.as_of;
      existing.postCutoverCount += postCutoverInc;
    }
  }

  const findings: FindingGroup[] = [...groups.values()]
    .map((g) => {
      const cohort: FindingGroup["cohort"] =
        g.postCutoverCount === 0
          ? "pre-cutover"
          : g.postCutoverCount === g.count
            ? "post-cutover"
            : "mixed";
      return {
        entity: g.entity,
        eventType: g.eventType,
        actorId: g.actorId,
        count: g.count,
        earliestAsOf: g.earliestAsOf,
        latestAsOf: g.latestAsOf,
        postCutoverCount: g.postCutoverCount,
        cohort,
      };
    })
    .sort((a, b) => b.count - a.count);

  const nonCanonicalEntityValues = [...new Set(findings.map((f) => f.entity))].sort();

  const entityDistribution = [...entityCounts.entries()]
    .map(([entity, count]) => ({
      entity,
      count,
      status: classifyEntity(entity),
    }))
    .sort((a, b) => b.count - a.count);

  const postCutoverDrift = findings.filter((f) => f.postCutoverCount > 0);

  return {
    pipeline: "vera:deprecated-entity-refs",
    migrationBoundary: MIGRATION_BOUNDARY_TIMESTAMP,
    canonicalActiveShortIds: ACTIVE_SHORT_IDS,
    totalEvents,
    canonicalEvents,
    nonCanonicalEvents,
    nonCanonicalEntityValues,
    entityDistribution,
    findings,
    postCutoverDrift,
  };
}

// ---------------------------------------------------------------------------
// Markdown render
// ---------------------------------------------------------------------------

function fmtCohort(c: FindingGroup["cohort"]): string {
  switch (c) {
    case "pre-cutover":
      return "pre-cutover (historical)";
    case "post-cutover":
      return "post-cutover (live drift)";
    case "mixed":
      return "mixed (straddles cutover)";
  }
}

function renderMarkdown(s: AuditSummary): string {
  const lines: string[] = [];
  lines.push("---");
  lines.push("title: Deprecated entity-reference audit — BANK-ZA-001 in the canonical event store");
  lines.push(
    "author: Vera (Internal audit engineer, governance — functional reporting to Thandiwe (Chief Audit Executive, governance))",
  );
  lines.push("date: 2026-05-21");
  lines.push("classification: governance-seat");
  lines.push("register-key: documents");
  lines.push("decision-required: false");
  lines.push("citations:");
  lines.push("  - D-PARTY-REGISTER");
  lines.push("  - PR #669");
  lines.push("  - PR #666");
  lines.push("  - PR #672");
  lines.push("  - Regulations/_party-register.md");
  lines.push("  - prototype/platform/identity/entity-short-ids.ts");
  lines.push("---");
  lines.push("");
  lines.push("# Deprecated entity-reference audit — `BANK-ZA-001` in the canonical event store");
  lines.push("");
  lines.push(
    "**Author:** Vera (Internal audit engineer, governance — functional reporting to Thandiwe (Chief Audit Executive, governance))",
  );
  lines.push("**Date:** 2026-05-21");
  lines.push(
    "**Brief:** `brief:vera:audit-production-event-store-for-deprecated-bank:2026-05-21` (Scrooge, Chief of Staff)",
  );
  lines.push("**Workstream:** WS-MARKET-RISK-PROCEDURES (substrate hygiene)");
  lines.push(
    "**Scope:** read-only audit of the canonical event store; surface findings + recommend remediation; do NOT remediate in this PR.",
  );
  lines.push("");
  lines.push("## 1. Question");
  lines.push("");
  lines.push(
    'Owen (Company Secretary, governance) flagged in PR #672 close-out that the original D-OPRISK-ENGINEER-ROLE script (PR #666) used `entity: "BANK-ZA-001"` — canonical at the time, but retired by Atlas (Core banking platform architect, engineering) + Imani (Chief Legal Counsel, governance) in the entity-identity unification (PR #669, merged 2026-05-21 08:57Z UTC). `recon:entity-identity-coherence` is now hard-fail on any non-canonical `entity` value.',
  );
  lines.push("");
  lines.push("This audit answers:");
  lines.push("");
  lines.push(
    '1. Are there any events with `entity: "BANK-ZA-001"` (or any other non-canonical short-id) still in the canonical store?',
  );
  lines.push("2. If yes, what kinds, which agents, when?");
  lines.push(
    "3. What is the right remediation path per cohort — re-emit, migrate-in-place, or document as historical-immutable?",
  );
  lines.push("");
  lines.push("## 2. Method");
  lines.push("");
  lines.push(
    "- Iterate every event in the canonical store via `eventStore.replay({})` (composition root; same store the recon walks).",
  );
  lines.push(
    "- For each event whose `entity` is not in `LEGAL_ENTITY_SHORT_ID_REGISTRY` with status `active`, accumulate per `(entity, type, actor.id)` group.",
  );
  lines.push(
    "- Per group, record `count`, `earliestAsOf`, `latestAsOf`, and `postCutoverCount` (events emitted at or after the migration boundary).",
  );
  lines.push("");
  lines.push(
    `- **Migration boundary:** \`${MIGRATION_BOUNDARY_TIMESTAMP}\` — the merge timestamp of PR #669 on \`main\`. Events strictly before this timestamp are immutable history under Principle 1 (\"events are the only source of truth\"); events at or after this timestamp are live source drift.`,
  );
  lines.push("");
  lines.push(
    `- **Canonical active short-ids:** \`[${s.canonicalActiveShortIds.join(", ")}]\` per \`LEGAL_ENTITY_SHORT_ID_REGISTRY\`.`,
  );
  lines.push("");
  lines.push("## 3. Headline numbers");
  lines.push("");
  lines.push(`- Total events in canonical store: **${s.totalEvents.toLocaleString("en-US")}**`);
  lines.push(
    `- Events with canonical \`entity\`: **${s.canonicalEvents.toLocaleString("en-US")}**`,
  );
  lines.push(
    `- Events with non-canonical \`entity\`: **${s.nonCanonicalEvents.toLocaleString("en-US")}** (${((s.nonCanonicalEvents / Math.max(s.totalEvents, 1)) * 100).toFixed(1)}%)`,
  );
  lines.push(
    `- Distinct non-canonical \`entity\` values: ${s.nonCanonicalEntityValues.length} (\`${s.nonCanonicalEntityValues.join("`, `")}\`)`,
  );
  lines.push(
    `- Post-cutover drift groups: **${s.postCutoverDrift.length}** (live source paths to fix)`,
  );
  lines.push(
    `- Post-cutover drift events: **${s.postCutoverDrift.reduce((acc, f) => acc + f.postCutoverCount, 0)}**`,
  );
  lines.push("");
  lines.push("### Entity distribution across the canonical store");
  lines.push("");
  lines.push("| Entity | Status | Count |");
  lines.push("|---|---|---:|");
  for (const r of s.entityDistribution) {
    lines.push(`| \`${r.entity}\` | ${r.status} | ${r.count.toLocaleString("en-US")} |`);
  }
  lines.push("");
  lines.push("## 4. Post-cutover live drift (source-fix candidates)");
  lines.push("");
  if (s.postCutoverDrift.length === 0) {
    lines.push(
      "**None.** Every non-canonical `entity` reference in the store predates the PR #669 cutover. Recommendation per §5(C): leave history immutable; teach the recon about the migration boundary (§Block D).",
    );
  } else {
    lines.push(
      `These ${s.postCutoverDrift.length} group(s) emitted events with the deprecated entity short-id **at or after** the PR #669 cutover. They indicate code paths that still hardcode \`BANK-ZA-001\` and must be patched at source.`,
    );
    lines.push("");
    lines.push(
      "| Entity | Event type | Actor | Count (total) | Post-cutover | Earliest | Latest |",
    );
    lines.push("|---|---|---|---:|---:|---|---|");
    for (const f of s.postCutoverDrift) {
      lines.push(
        `| \`${f.entity}\` | \`${f.eventType}\` | \`${f.actorId}\` | ${f.count} | **${f.postCutoverCount}** | ${f.earliestAsOf} | ${f.latestAsOf} |`,
      );
    }
  }
  lines.push("");
  lines.push("## 5. Full findings — all non-canonical groups");
  lines.push("");
  if (s.findings.length === 0) {
    lines.push("No non-canonical entity references in the canonical store. Audit closes clean.");
  } else {
    lines.push(`${s.findings.length} group(s) total, ordered by event count.`);
    lines.push("");
    lines.push("| Entity | Event type | Actor | Count | Earliest | Latest | Cohort |");
    lines.push("|---|---|---|---:|---|---|---|");
    for (const f of s.findings) {
      lines.push(
        `| \`${f.entity}\` | \`${f.eventType}\` | \`${f.actorId}\` | ${f.count} | ${f.earliestAsOf} | ${f.latestAsOf} | ${fmtCohort(f.cohort)} |`,
      );
    }
  }
  lines.push("");
  lines.push("## 6. Remediation recommendation");
  lines.push("");
  lines.push(
    "Per the brief, three remediation paths are available; each finding cohort routes to one. Defended below.",
  );
  lines.push("");
  lines.push(
    "### 6.1 Pre-cutover events (cohort: `pre-cutover`) → **document as historical-immutable**",
  );
  lines.push("");
  lines.push("Defence:");
  lines.push("");
  lines.push(
    "- Principle 1 (events are the only source of truth) makes the event log append-only and immutable. Rewriting the `entity` field in-place violates the principle and corrupts the audit chain — every downstream projection, hash, and provenance lineage was computed against the original `entity` value.",
  );
  lines.push(
    "- At the time of emission, `BANK-ZA-001` was the canonical short-id. The events are faithful records of what the substrate decided at that point. The retroactive change is a *naming* event, not a *meaning* event — the underlying legal entity (Hoz Bank Limited, `urn:party:legal-entity:hoz-bank`) is unchanged.",
  );
  lines.push(
    '- The unification is structurally encoded in `LEGAL_ENTITY_SHORT_ID_REGISTRY`: the retired `BANK-ZA-001` row would resolve via a future `status: "retired"` entry, mapping to the same Party URN. The audit chain stays intact via the registry, not via event mutation.',
  );
  lines.push(
    "- The `recon:entity-identity-coherence` pipeline (Atlas, PR #669) currently hard-fails on any short-id not in `LEGAL_ENTITY_SHORT_ID_REGISTRY`. To accommodate pre-cutover history without weakening the live gate, the recon needs awareness of the migration boundary — see §Block D below.",
  );
  lines.push("");
  lines.push(
    "### 6.2 Post-cutover events (cohort: `post-cutover` or `mixed`) → **source fix + supersession** (do NOT modify the emitted events)",
  );
  lines.push("");
  lines.push("Defence:");
  lines.push("");
  lines.push(
    "- These are *new* drift — code paths that hardcoded `BANK-ZA-001` and continued to fire after PR #669 merged. The mistake is in source, not in the event log. Patching source eliminates future drift without rewriting history.",
  );
  lines.push(
    '- For events that carry meaningful state (e.g. `Decision`, `RecordFiled`, `ProductDimensionAttested`), Principle 1 forbids in-place mutation. The right remediation is the standard supersession pattern: emit a corrected event with canonical `entity: "LE-ZA-HOZ-BANK"`, citing the original event_id under `supersedes` / `correctsOriginalErrors`. The recon then resolves the live posture to the corrected event.',
  );
  lines.push(
    "- For low-stakes lifecycle scaffolding (e.g. `SubstrateAgentRunStarted`, `BusDispatched`, `AgentRunStarted`, `AgentRunCompleted`), supersession is overkill — these are operational telemetry. The right path is: patch source, accept the pre-fix events as immutable telemetry, and let the migration-boundary exemption (§Block D) cover them.",
  );
  lines.push("");
  lines.push("### 6.3 Migrate-in-place at projection time → **NOT recommended**");
  lines.push("");
  lines.push("Defence:");
  lines.push("");
  lines.push(
    '- The brief mentions "normalise `entity` at projection time" as an option. This is feasible *technically* (projections already JOIN against `LEGAL_ENTITY_SHORT_ID_REGISTRY`) but introduces a parallel ledger: events say `BANK-ZA-001`; projections say `LE-ZA-HOZ-BANK`. Two readers, two answers, depending on which side they query — exactly the divergence PR #669 just closed.',
  );
  lines.push(
    "- Cleaner approach: keep events as-emitted (P1); resolve to Party URN at the registry layer; have the recon honour the migration boundary so the gate stays meaningful for post-cutover writes.",
  );
  lines.push("");
  lines.push("### 6.4 Per-finding routing summary");
  lines.push("");
  if (s.findings.length === 0) {
    lines.push("Audit clean — no routing required.");
  } else {
    const preCutover = s.findings.filter((f) => f.cohort === "pre-cutover").length;
    const postCutover = s.findings.filter((f) => f.cohort === "post-cutover").length;
    const mixed = s.findings.filter((f) => f.cohort === "mixed").length;
    lines.push(
      `- **${preCutover} groups → §6.1 (historical-immutable + migration-boundary exemption).**`,
    );
    lines.push(
      `- **${postCutover} groups → §6.2 (source fix; selective supersession for state-bearing events).**`,
    );
    lines.push(
      `- **${mixed} groups → §6.2 + §6.1 (source fix going forward; pre-cutover share treated as historical).**`,
    );
  }
  lines.push("");
  lines.push("## 7. Block C — Follow-on remediation briefs (recommended)");
  lines.push("");
  lines.push(
    "Three follow-on briefs surface as a consequence of this audit. **Vera does not remediate** — the briefs below are recommendations for Scrooge to dispatch, scoped to a single substrate owner each.",
  );
  lines.push("");
  lines.push(
    "### Brief 1 (Atlas, engineering) — Patch hardcoded `BANK-ZA-001` in production source paths",
  );
  lines.push("");
  lines.push('**Scope.** 7 source files still hardcode `entity: "BANK-ZA-001"`:');
  lines.push("");
  lines.push(
    "- `prototype/scripts/dispatch/close-run.ts:242` — the SubstrateAlert emitted on dispatch-bypass paths. **Fires every close-run that hits the bypass gap.** Highest priority.",
  );
  lines.push(
    "- `prototype/scripts/file-saskia-owen-npa-fx-spot.ts:132,172` — NPA gate filing (Saskia + Owen) emits `ProductDimensionAttested` + `RecordFiled` events.",
  );
  lines.push(
    "- `prototype/scripts/run-npa-gate-fx-spot.ts:83` — NPA gate scenario runner ENTITY constant.",
  );
  lines.push(
    "- `prototype/scripts/file-devon-zara-proc-mk-plg-01-rehearsal.ts:46` — Devon + Zara PROC-MK-PLG-01 rehearsal filing.",
  );
  lines.push(
    "- `prototype/scripts/record-d-oprisk-engineer-role.ts:117` — original PR #666 script (one-shot historical; Atlas's call whether to retire the script or just fix the constant).",
  );
  lines.push(
    "- `prototype/scripts/run-pre-licence-go-live-rehearsal.ts:72` — pre-licence rehearsal ENTITY constant.",
  );
  lines.push(
    "- `prototype/platform/accounting/gl-posting-engine.test.ts:44` — **test-only**, can stay as a documented legacy literal or be migrated to `HOZ_BANK_ENTITY` for hygiene.",
  );
  lines.push("");
  lines.push(
    '**Deliverable.** Single PR that flips each `"BANK-ZA-001"` literal to either `HOZ_BANK_ENTITY` (from `platform/core/types`) or the `LE-ZA-HOZ-BANK` literal. CI gate: `recon:entity-identity-coherence` must remain green on a freshly-replayed scenario after the patch.',
  );
  lines.push("");
  lines.push(
    "**Owner.** Atlas (Core banking platform architect, engineering) — owns the identity substrate.",
  );
  lines.push(
    "**Authority.** PR #669 (Atlas + Imani) is the source-of-truth for canonical short-ids; this brief is housekeeping under that authority.",
  );
  lines.push("");
  lines.push(
    "### Brief 2 (Atlas, engineering) — Teach `recon:entity-identity-coherence` about the migration boundary",
  );
  lines.push("");
  lines.push(
    "**Scope.** See §Block D below — minimum change to the recon to accept pre-cutover events as historical-immutable without weakening the live gate for post-cutover writes.",
  );
  lines.push("");
  lines.push(
    "**Deliverable.** Single PR; updates `prototype/platform/recon/entity-identity-coherence.ts` to honour a `MIGRATION_BOUNDARY_TIMESTAMP` (constant exported from the same module). Pre-cutover events with retired-but-registered short-ids degrade to a structural `warn`-class violation, not `fail`. Unregistered short-ids stay hard-fail in every era.",
  );
  lines.push("");
  lines.push("**Owner.** Atlas (Core banking platform architect, engineering) — owns the recon.");
  lines.push(
    "**Authority.** This audit (Vera) recommends; CEO approval gates because the change relaxes a live recon gate.",
  );
  lines.push("");
  lines.push(
    "### Brief 3 (Owen, governance) — Add a `retired` row for `BANK-ZA-001` to `LEGAL_ENTITY_SHORT_ID_REGISTRY`",
  );
  lines.push("");
  lines.push(
    '**Scope.** Currently `LEGAL_ENTITY_SHORT_ID_REGISTRY` has exactly one row (`LE-ZA-HOZ-BANK`, status `active`). Adding a second row with `shortId: "BANK-ZA-001"`, `partyUrn: "urn:party:legal-entity:hoz-bank"`, `status: "retired"`:',
  );
  lines.push("");
  lines.push(
    "- preserves the upward chain from every pre-cutover event to its canonical Party URN (audit chain intact);",
  );
  lines.push(
    '- lets `lookupShortId("BANK-ZA-001")` succeed (with `status: "retired"`) rather than returning `null`, which `recon:entity-identity-coherence` currently treats as the most severe failure class ("unregistered");',
  );
  lines.push(
    '- combined with Brief 2\'s migration-boundary awareness, lets the recon discriminate cleanly between "pre-cutover retired short-id" (acceptable, warn-class) and "unregistered short-id, ever" (always fail).',
  );
  lines.push("");
  lines.push(
    "**Deliverable.** Single small PR adding the row and an idempotent `PartyRegistered{kind:\"legal-entity\"}` backfill event in case the Party register's `BANK-ZA-001`-era row isn't yet linked. Cross-cite to PR #669.",
  );
  lines.push("");
  lines.push(
    "**Owner.** Owen (Company Secretary, governance) — owns the Party register; PR #669 was Imani + Atlas, but the registry row is governance bookkeeping.",
  );
  lines.push("**Authority.** D-PARTY-REGISTER + PR #669; this is the housekeeping companion.");
  lines.push("");
  lines.push("## 8. Block D — Minimum change to `recon:entity-identity-coherence`");
  lines.push("");
  lines.push("Proposed (not implemented in this PR — see Brief 2):");
  lines.push("");
  lines.push("```ts");
  lines.push("// platform/recon/entity-identity-coherence.ts");
  lines.push("");
  lines.push("// Source-cutover for the entity-identity unification (PR #669).");
  lines.push("// Events emitted strictly BEFORE this timestamp predate the");
  lines.push("// unification decision and are immutable history under Principle 1.");
  lines.push("// Retired-but-registered short-ids in this window degrade from fail");
  lines.push("// to warn; unregistered short-ids stay fail in every era.");
  lines.push(`export const MIGRATION_BOUNDARY_TIMESTAMP = "${MIGRATION_BOUNDARY_TIMESTAMP}";`);
  lines.push("");
  lines.push("// ... inside `run()`, in the existing per-event branch:");
  lines.push('if (entry.status !== "active") {');
  lines.push("  const preMigration = ev.as_of < MIGRATION_BOUNDARY_TIMESTAMP;");
  lines.push("  violations.push({");
  lines.push("    subject: `event:${ev.event_id}:${ev.type}`,");
  lines.push('    severity: preMigration ? "warn" : "fail",');
  lines.push("    message: preMigration");
  lines.push(
    '      ? `event.entity "${ev.entity}" resolves to a retired Party register row; pre-cutover history per migration boundary ${MIGRATION_BOUNDARY_TIMESTAMP}.`',
  );
  lines.push(
    '      : `event.entity "${ev.entity}" resolves to a retired Party register row. Post-cutover writes must use canonical short-id. Authority: D-PARTY-REGISTER + PR #669.`,',
  );
  lines.push("  });");
  lines.push("}");
  lines.push("```");
  lines.push("");
  lines.push("This change:");
  lines.push("");
  lines.push(
    "- preserves the hard-fail for any unregistered short-id (line 102 of the current recon — the `entry === null` branch — stays unchanged);",
  );
  lines.push(
    "- preserves the hard-fail for post-cutover retired-short-id writes (the `else` branch under `status !== active` is unchanged for post-cutover events);",
  );
  lines.push(
    "- adds the `warn` carve-out only for pre-cutover events with a retired-but-registered short-id — the exact cohort this audit identifies as historical-immutable;",
  );
  lines.push(
    "- requires Brief 3 (the `retired` row for `BANK-ZA-001` in the registry) to be merged first, otherwise pre-cutover events still resolve to `null` and stay hard-fail.",
  );
  lines.push("");
  lines.push(
    "**Important.** This is NOT a bypass. Every pre-cutover event with a retired short-id still produces an audit-trail entry (warn-class). The structurally-honest interpretation is: the substrate notes the legacy short-id, links it to its canonical Party URN via the registry, and surfaces the divergence as a non-blocking observation rather than treating immutable history as a live failure.",
  );
  lines.push("");
  lines.push("## 9. Out of scope (for this PR)");
  lines.push("");
  lines.push(
    "- **No source patches.** All three follow-on briefs are recommendations; Vera does not implement.",
  );
  lines.push("- **No event-store mutations.** Read-only audit (Principle 1).");
  lines.push("- **No Party register edits.** Owen's brief.");
  lines.push("- **No `LEGAL_ENTITY_SHORT_ID_REGISTRY` edits.** Owen's brief.");
  lines.push("- **No recon edits.** Atlas's brief.");
  lines.push(
    "- **Other deprecated identifiers** (e.g. legacy actor URN forms) are out of scope per the brief — this audit is specifically `BANK-ZA-001`.",
  );
  lines.push("");
  lines.push("## 10. Citations");
  lines.push("");
  lines.push(
    "- D-PARTY-REGISTER (CEO-approved 2026-05-11) — Party register heads the identity chain.",
  );
  lines.push(
    "- PR #669 — Atlas + Imani: entity-identity unification (merged 2026-05-21 08:57Z UTC).",
  );
  lines.push(
    "- PR #666 — Owen: D-OPRISK-ENGINEER-ROLE decision card (the original offender Owen flagged).",
  );
  lines.push("- PR #672 — Owen: Option B implementation (surfaced this audit).");
  lines.push("- `Regulations/_party-register.md` — canonical Party register.");
  lines.push("- `prototype/platform/identity/entity-short-ids.ts` — resolution authority.");
  lines.push(
    "- `prototype/platform/recon/entity-identity-coherence.ts` — the live recon this audit complements.",
  );
  lines.push("- Principle 1 — events are the only source of truth (immutable, append-only).");
  lines.push(
    "- Principle 2 — single-graph discipline (Party register → short-id registry → event-store `entity` field).",
  );
  lines.push("");
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function repoRoot(): string {
  // prototype/scripts/audit/<this> — repo root is three levels up.
  return join(import.meta.dir, "..", "..", "..");
}

if (import.meta.main) {
  const summary = buildSummary();
  const reportPath = join(repoRoot(), "2026-05-21_vera_deprecated-entity-audit.md");
  const md = renderMarkdown(summary);
  writeFileSync(reportPath, md, "utf8");

  console.log(
    JSON.stringify(
      {
        level: summary.postCutoverDrift.length > 0 ? "warn" : "info",
        time: new Date().toISOString(),
        service: "bank-prototype",
        pipeline: summary.pipeline,
        migrationBoundary: summary.migrationBoundary,
        totalEvents: summary.totalEvents,
        canonicalEvents: summary.canonicalEvents,
        nonCanonicalEvents: summary.nonCanonicalEvents,
        nonCanonicalEntityValues: summary.nonCanonicalEntityValues,
        groupCount: summary.findings.length,
        postCutoverDriftGroups: summary.postCutoverDrift.length,
        postCutoverDriftEvents: summary.postCutoverDrift.reduce(
          (acc, f) => acc + f.postCutoverCount,
          0,
        ),
        reportPath,
        msg:
          summary.postCutoverDrift.length === 0
            ? `vera:deprecated-entity-refs — ${summary.nonCanonicalEvents} non-canonical events found, all pre-cutover (historical-immutable). Report at ${reportPath}.`
            : `vera:deprecated-entity-refs — ${summary.nonCanonicalEvents} non-canonical events, ${summary.postCutoverDrift.length} live-drift source paths require fix. Report at ${reportPath}.`,
        canonicalActiveShortIds: summary.canonicalActiveShortIds,
        registrySize: LEGAL_ENTITY_SHORT_ID_REGISTRY.length,
      },
      null,
      2,
    ),
  );
  // Read-only audit — exit 0 even when drift exists (the report carries the signal).
  process.exit(0);
}

// Exported for tests / programmatic use.
export {
  type AuditSummary,
  type FindingGroup,
  MIGRATION_BOUNDARY_TIMESTAMP,
  buildSummary,
  renderMarkdown,
};
