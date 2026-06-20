// dashboard/build-status-view.ts
//
// Build Status — the bank's complete build-phase roadmap with the status of
// every element derived LIVE from canonical sources (Principle 1). This view
// replaces the hand-maintained `WORKSTREAMS` array that previously lived in
// `public/roadmap.js`: that array was static client-side state that drifted
// from reality. Here, every status is a query over the event store and the
// committed engineering registries — nothing is hardcoded except the
// *structure* of the build phases (a structural fact of the operating model,
// CLAUDE.md "Build phase vs licence-day") and the RMS-phase catalogue (whose
// completion status is itself derived from the Decisions register).
//
// Live sources folded here:
//   - RMS Workstreams register   (AgentBriefIssued / AgentRunStarted /
//                                  AgentRunCompleted / BriefSuperseded folds)
//   - Decisions register         (open / resolved; RMS-phase completion lookup)
//   - V1-removal ratchet         (committed baseline + live registry counts)
//   - Recon-gate inventory       (parsed from package.json `recon:*` scripts)
//
// Name-masking: this DTO crosses no /api/v2 boundary by default, but it is a
// user-facing page, so all free-text that could embed agent personal names is
// run through `redactAgentNames` (no-agent-names rule; supersedes internal
// identity-discipline for UI surfaces).
//
// Author: Anya (Data / analytics engineer, engineering — projection-runtime
// consumer), coordinated by Scrooge (Chief of Staff).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { EVENT_TYPE_REGISTRY } from "../platform/event-store/registry/index";
import type {
  WorkstreamsRegisterRow,
  WorkstreamsStatus,
} from "../platform/rms-registers/workstreams";
import { redactAgentNames } from "./agent-title";
import type { DecisionsView } from "./v2-views";

/**
 * The build-phase v1-only baseline at the start of the bank-wide V2 migration
 * (D-V1-REMOVAL-PHASE-1, CEO-approved 2026-06-15). The ratchet baseline only
 * ever decreases from here; this anchor lets the page show total progress.
 */
const V1_ORIGINAL_BASELINE = 585;

/**
 * The four recon gates that enforce the V1-retirement directive (CLAUDE.md
 * "V1 retirement"). Surfaced by name so the page can show what backs the
 * harden-only contract; filtered against the actual gate inventory so the page
 * never claims a gate that does not exist.
 */
const V1_REMOVAL_GATE_NAMES = [
  "recon:v2-no-v1-import",
  "recon:v1-removal-ratchet",
  "recon:v1-removal-v2status-coverage",
  "recon:v1-only-count-trend",
] as const;

// ── Structural catalogue (shape only — status is derived) ───────────────────

interface BuildPhaseSpec {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly phaseKind: "current" | "gate" | "target";
}

/**
 * The three build-phase markers from the operating model (CLAUDE.md). These are
 * structural facts of where the bank sits, not per-element status; the live
 * status of *elements within* the build phase comes from the registers below.
 */
const BUILD_PHASES: readonly BuildPhaseSpec[] = [
  {
    id: "build-phase",
    title: "Build Phase",
    detail:
      "Engineering substrate, governance seats, regulatory chain, markets franchise prep. Current.",
    phaseKind: "current",
  },
  {
    id: "pre-licence-readiness",
    title: "Pre-licence Readiness Gate",
    detail:
      "Lights green when the substrate is production-grade. Co-owned by the readiness-gate seats.",
    phaseKind: "gate",
  },
  {
    id: "licence-day",
    title: "Licence Day",
    detail:
      "Real capital, real customers, minimum statutory human layer appointed under the Banks Act.",
    phaseKind: "target",
  },
];

interface RmsPhaseSpec {
  readonly id: string;
  readonly title: string;
  /** Decision whose resolution proves the phase landed (looked up live). */
  readonly decisionId: string;
  readonly summary: string;
}

/**
 * The Records Management Substrate phase catalogue. Each phase's STATUS is
 * derived live: resolved in the Decisions register → complete; open → in
 * progress; absent → planned. The catalogue itself (which phases exist, and
 * the decision that gates each) is the structural fact.
 */
const RMS_PHASE_CATALOGUE: readonly RmsPhaseSpec[] = [
  {
    id: "RMS-PHASE-1",
    title: "Phase 1 — typed events + document store + 7 registers",
    decisionId: "D-RMS-PHASE-1",
    summary: "Seven typed event kinds, BLAKE3 document store, seven projection-derived registers.",
  },
  {
    id: "RMS-PHASE-2",
    title: "Phase 2 — events-first dispatch",
    decisionId: "D-RMS-PHASE-2",
    summary: "Every dispatch requires a backing AgentBriefIssued event. Team Inbox is a render.",
  },
  {
    id: "RMS-PHASE-3",
    title: "Phase 3 — events-first deliverables",
    decisionId: "D-RMS-PHASE-3",
    summary: "Every deliverable requires a backing RecordFiled event. Owner Inbox is a render.",
  },
  {
    id: "RMS-PHASE-4",
    title: "Phase 4 — full archive move",
    decisionId: "D-RMS-PHASE-4-ARCHIVE-SCOPE",
    summary: "Legacy inbox folders moved to archive/; RMS registers are sole canonical.",
  },
];

// ── DTO ──────────────────────────────────────────────────────────────────────

export type ElementStatus = "complete" | "in-progress" | "planned";

export interface BuildPhaseStatus {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly phaseKind: "current" | "gate" | "target";
}

export interface RmsPhaseStatus {
  readonly id: string;
  readonly title: string;
  readonly decisionId: string;
  readonly status: ElementStatus;
  readonly summary: string;
}

export interface V1RemovalStatus {
  /** v1-only count at the start of the migration (anchor for total progress). */
  readonly originalBaseline: number;
  /** Committed ratchet baseline (decreases only). */
  readonly currentBaseline: number;
  readonly baselineAsOf: string;
  /** Live count from the current event-type registry. */
  readonly v1Only: number;
  readonly v2Parallel: number;
  readonly v2Replaced: number;
  readonly totalTypes: number;
  /** Percentage of the original baseline retired (0–100, one decimal). */
  readonly pctRetired: number;
}

export interface BuildWorkstreamRow {
  readonly workstreamId: string;
  readonly title: string;
  readonly status: WorkstreamsStatus;
  readonly briefCount: number;
  readonly runCount: number;
  readonly decisionCount: number;
  readonly firstActivityAt: string;
  readonly lastActivityAt: string;
}

export interface BuildOpenDecisionRow {
  readonly id: string;
  readonly title: string;
  readonly category: string;
  readonly authority: string;
  readonly owner: string;
}

export interface BuildStatusView {
  readonly generatedAt: string;
  readonly buildPhases: readonly BuildPhaseStatus[];
  readonly rmsPhases: readonly RmsPhaseStatus[];
  readonly v1Removal: V1RemovalStatus;
  readonly workstreams: {
    readonly total: number;
    readonly active: number;
    readonly blocked: number;
    readonly complete: number;
    readonly rows: readonly BuildWorkstreamRow[];
  };
  readonly decisions: {
    readonly open: number;
    readonly resolved: number;
    readonly authorities: number;
    readonly categories: number;
    readonly openRows: readonly BuildOpenDecisionRow[];
  };
  readonly reconGates: {
    readonly total: number;
    readonly v1RemovalEnforcing: readonly string[];
  };
}

// ── Live readers ──────────────────────────────────────────────────────────────

/** Resolve the prototype root from this module's location (dashboard/ → ..). */
function prototypeRoot(): string {
  return resolve(import.meta.dir, "..");
}

/**
 * Read the committed V1-removal ratchet baseline. Fail-closed (Charter cmd 2):
 * the baseline is committed alongside the migration and must be present.
 */
export function readV1RemovalStatus(): V1RemovalStatus {
  const ratchetPath = resolve(prototypeRoot(), "platform/recon/v1-removal-ratchet.json");
  const raw = readFileSync(ratchetPath, "utf8");
  const parsed = JSON.parse(raw) as { v1OnlyCount?: unknown; asOf?: unknown };
  if (typeof parsed.v1OnlyCount !== "number" || typeof parsed.asOf !== "string") {
    throw new Error(
      `v1-removal-ratchet.json is malformed (expected { v1OnlyCount: number, asOf: string }) at ${ratchetPath}`,
    );
  }
  const v1Only = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v1-only").length;
  const v2Parallel = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v2-parallel").length;
  const v2Replaced = EVENT_TYPE_REGISTRY.filter((e) => e.v2Status === "v2-replaced").length;
  const pctRetired =
    Math.round(((V1_ORIGINAL_BASELINE - v1Only) / V1_ORIGINAL_BASELINE) * 1000) / 10;
  return {
    originalBaseline: V1_ORIGINAL_BASELINE,
    currentBaseline: parsed.v1OnlyCount,
    baselineAsOf: parsed.asOf,
    v1Only,
    v2Parallel,
    v2Replaced,
    totalTypes: EVENT_TYPE_REGISTRY.length,
    pctRetired,
  };
}

/**
 * Count the recon-gate inventory live from package.json `recon:*` scripts, and
 * surface which of the four V1-retirement gates actually exist. Fail-closed:
 * package.json must be present and parseable.
 */
export function readReconGates(): BuildStatusView["reconGates"] {
  const pkgPath = resolve(prototypeRoot(), "package.json");
  const raw = readFileSync(pkgPath, "utf8");
  const parsed = JSON.parse(raw) as { scripts?: Record<string, unknown> };
  const scripts = parsed.scripts ?? {};
  const gateNames = Object.keys(scripts).filter((name) => name.startsWith("recon:"));
  const present = new Set(gateNames);
  return {
    total: gateNames.length,
    v1RemovalEnforcing: V1_REMOVAL_GATE_NAMES.filter((g) => present.has(g)),
  };
}

// ── Assembler ──────────────────────────────────────────────────────────────────

/**
 * Assemble the build-status view from the live registers. The caller supplies
 * the already-folded Workstreams rows and the Decisions view (so the page
 * reuses the server's cached fold rather than re-folding); the V1-removal and
 * recon-gate figures are read here from the committed registries.
 */
export function buildBuildStatusView(args: {
  readonly workstreams: readonly WorkstreamsRegisterRow[];
  readonly decisions: DecisionsView;
  readonly now: string;
}): BuildStatusView {
  const { workstreams, decisions, now } = args;

  // RMS phase status — derived from the Decisions register, not asserted.
  const resolvedIds = new Set(decisions.resolved.map((d) => d.id));
  const openIds = new Set(decisions.open.map((d) => d.id));
  const rmsPhases: RmsPhaseStatus[] = RMS_PHASE_CATALOGUE.map((p) => {
    const status: ElementStatus = resolvedIds.has(p.decisionId)
      ? "complete"
      : openIds.has(p.decisionId)
        ? "in-progress"
        : "planned";
    return { id: p.id, title: p.title, decisionId: p.decisionId, status, summary: p.summary };
  });

  // Workstream rows — name-masked title; counts from the fold.
  const rows: BuildWorkstreamRow[] = workstreams
    .map((w) => ({
      workstreamId: w.workstreamId,
      title: redactAgentNames(w.title),
      status: w.status,
      briefCount: w.briefIds.length,
      runCount: w.runIds.length,
      decisionCount: w.decisionIds.length,
      firstActivityAt: w.firstActivityAt,
      lastActivityAt: w.lastActivityAt,
    }))
    .sort((a, b) => (a.lastActivityAt < b.lastActivityAt ? 1 : -1));

  const active = rows.filter((r) => r.status === "active").length;
  const blocked = rows.filter((r) => r.status === "blocked").length;
  const complete = rows.filter((r) => r.status === "complete").length;

  const openRows: BuildOpenDecisionRow[] = decisions.open.map((d) => ({
    id: d.id,
    title: redactAgentNames(d.title),
    category: d.category,
    authority: d.authority,
    owner: d.owner,
  }));

  return {
    generatedAt: now,
    buildPhases: BUILD_PHASES.map((p) => ({ ...p })),
    rmsPhases,
    v1Removal: readV1RemovalStatus(),
    workstreams: { total: rows.length, active, blocked, complete, rows },
    decisions: {
      open: decisions.summary.open,
      resolved: decisions.summary.resolved,
      authorities: decisions.summary.authorities,
      categories: decisions.summary.categories,
      openRows,
    },
    reconGates: readReconGates(),
  };
}
