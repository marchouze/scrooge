// platform/recon/orphan-run-deliverable-state.ts
//
// Vera continuous-controls pipeline: recon:orphan-run-deliverable-state
//
// EXTENDS recon:orphan-open-runs. Where orphan-run-detector.ts flags every
// orphan AgentRunStarted (>2h, no AgentRunCompleted) as a uniform high-severity
// integrity alert, this pipeline classifies each orphan by DELIVERABLE STATE
// and routes it:
//
//   deliverable-ready (PR merged) → auto-reconcile: idempotently synthesise the
//       missing AgentRunCompleted{outcome:"delivered"} (anti-fabrication gate:
//       ONLY on a verifiable merged-PR fact).
//   deliverable-ready (PR open-green) → surface a LOW-severity, one-action
//       decision-required item (merge + close-out), NOT auto-closed.
//   abandoned (no PR / red / draft) → unchanged high-severity integrity alert.
//
// The PR-state lookup is INJECTED (PrStateLookup), exactly like the asOf clock
// in orphan-run-detector, so the pipeline is deterministic and unit-testable
// without touching `gh` or the network. The CLI entrypoint wires a real
// gh-backed lookup; tests pass a fixture map.
//
// Authority: D-BEA-GOAL-LOOP-SINGLE-FLIGHT (orphan detection);
//            D-PROACTIVE-ESCALATION-SURFACING (decision-required routing).
// Author: Atlas (Core banking platform architect, engineering).

import { eventStore } from "../composition";
import { makeAgentRunCompleted } from "../event-store/event-types";
import { makeSubstrateAlert } from "../event-store/event-types/platform";
import type { EventStore } from "../event-store/store";
import {
  type OrphanClassification,
  type PrStateLookup,
  buildCorrelationKey,
  classifyFromPr,
  closeRunCommand,
} from "./orphan-run-classifier";
import { type ReconResult, type ReconViolation, emptyResult } from "./types";

const PIPELINE = "recon:orphan-run-deliverable-state";
const ORPHAN_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours — mirrors orphan-run-detector

const ACTOR = { type: "service" as const, id: "agent:atlas:recon-orphan-classifier" };
const ENTITY = "LE-ZA-HOZ-BANK";
const CITATIONS = ["D-BEA-GOAL-LOOP-SINGLE-FLIGHT", "D-PROACTIVE-ESCALATION-SURFACING"];

/** Resolved agent identity for an orphan run (name+position drive close-out). */
interface OrphanRun {
  readonly runId: string;
  readonly briefId: string;
  readonly startedAtMs: number;
  readonly agentName: string;
  readonly agentPosition: string;
  readonly agentId: string;
}

export interface RunOpts {
  /** Inject a custom event store (for tests). */
  store?: EventStore;
  /** Clock anchor (ISO string). Defaults to the emptyResult infra timestamp. */
  asOf?: string;
  /** Override the orphan age threshold in ms (for tests). */
  orphanAgeMs?: number;
  /**
   * Caller-supplied PR-state resolver (the gh/GitHub-API touchpoint). Required
   * for the classification to do real work; when omitted, every orphan resolves
   * to `state:"none"` (treated as abandoned) so the pipeline degrades safely.
   */
  prLookup?: PrStateLookup;
  /**
   * When false, do NOT emit anything (alerts or auto-reconcile completions).
   * Used by dry-run / test paths that only want the classifications back.
   */
  skipEmit?: boolean;
  /**
   * Master switch for the auto-reconcile path. Default true. When false, even a
   * verifiable merged PR is surfaced for confirmation rather than auto-closed —
   * the conservative posture. The anti-fabrication gate (merged-only) still
   * applies on top of this.
   */
  autoReconcile?: boolean;
}

export interface OrphanRunStateResult extends ReconResult {
  /** Full classification list (consumed by the decision-required surface render). */
  readonly classifications: readonly OrphanClassification[];
  /** runIds that were auto-reconciled this run (AgentRunCompleted synthesised). */
  readonly autoReconciledRunIds: readonly string[];
}

function collectOrphanRuns(store: EventStore, asOfMs: number, orphanAgeMs: number): OrphanRun[] {
  const started = new Map<string, OrphanRun>();
  for (const e of store.replay({ type: "AgentRunStarted" })) {
    const p = e.payload as Record<string, unknown>;
    const runId = String(p.runId ?? "");
    const briefId = String(p.briefId ?? "");
    if (!runId || !briefId) continue;
    const startedAtMs = new Date(String(p.startedAt ?? e.as_of)).getTime();
    if (Number.isNaN(startedAtMs)) continue;
    const agentRef = (p.agent as Record<string, unknown> | undefined) ?? {};
    started.set(runId, {
      runId,
      briefId,
      startedAtMs,
      agentName: String(agentRef.name ?? "unknown"),
      agentPosition: String(agentRef.position ?? "unknown"),
      agentId: String(agentRef.agentId ?? agentRef.name ?? "unknown"),
    });
  }

  const completed = new Set<string>();
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    const runId = String((e.payload as Record<string, unknown>).runId ?? "");
    if (runId) completed.add(runId);
  }

  const orphans: OrphanRun[] = [];
  for (const [runId, run] of started) {
    if (completed.has(runId)) continue;
    if (asOfMs - run.startedAtMs < orphanAgeMs) continue;
    orphans.push(run);
  }
  return orphans;
}

export function run(opts: RunOpts = {}): OrphanRunStateResult {
  const base = emptyResult(PIPELINE);
  const store = opts.store ?? eventStore;
  const asOf = opts.asOf ?? base.asOf;
  const asOfMs = new Date(asOf).getTime();
  const orphanAgeMs = opts.orphanAgeMs ?? ORPHAN_AGE_MS;
  const autoReconcile = opts.autoReconcile ?? true;
  const lookup: PrStateLookup = opts.prLookup ?? (() => ({ state: "none" }));

  const orphans = collectOrphanRuns(store, asOfMs, orphanAgeMs);
  const violations: ReconViolation[] = [];
  const classifications: OrphanClassification[] = [];
  const autoReconciledRunIds: string[] = [];

  for (const orphan of orphans) {
    const key = buildCorrelationKey(store, orphan.runId, orphan.briefId, orphan.agentId);
    const pr = lookup(key);
    const c = classifyFromPr(key, pr);
    classifications.push(c);

    if (c.disposition === "abandoned") {
      // Unchanged behaviour: genuine loss stays a high-severity integrity alert.
      const message = `Orphan AgentRunStarted runId="${c.runId}" agent="${c.agentId}" classified ABANDONED. ${c.reason} Remediation: investigate; if truly abandoned, emit AgentRunCompleted{outcome:"blocked", substrateGapsSurfaced:["orphan run: no completion event emitted"]}.`;
      violations.push({ subject: `orphan-run:${c.runId}`, message, severity: "fail" });
      if (!opts.skipEmit) emitAbandonedAlert(store, asOf, c, message);
      continue;
    }

    // deliverable-ready. Two paths: merged → auto-reconcile (gated); else surface.
    if (c.autoReconcilable && autoReconcile && pr.state === "merged") {
      // ANTI-FABRICATION GATE: only a verifiable merged-PR fact reaches here.
      if (!opts.skipEmit) {
        const did = autoReconcileMergedOrphan(store, asOf, orphan, c);
        if (did) autoReconciledRunIds.push(c.runId);
      } else {
        autoReconciledRunIds.push(c.runId);
      }
      // Auto-reconciled orphans are NOT violations — they self-healed.
      continue;
    }

    // open-green (or merged with auto-reconcile disabled): surface a LOW-severity
    // one-action item rather than failing the gate. We model "low-severity" as a
    // `warn` violation (does not fail the pipeline) carrying the exact close-out
    // command. The decision-required surface consumes the classification list.
    const cmd = closeRunCommand(c, orphan.agentPosition);
    violations.push({
      subject: `orphan-run:${c.runId}`,
      message: `Orphan run "${c.runId}" is DELIVERABLE-READY (PR #${c.prNumber ?? "?"}, ${c.prState}). ${c.reason} One action: ${cmd}`,
      severity: "warn",
    });
  }

  base.asserted = Math.max(1, orphans.length);
  base.violations = violations;
  base.ok = violations.every((v) => v.severity !== "fail");
  return { ...base, classifications, autoReconciledRunIds };
}

function emitAbandonedAlert(
  store: EventStore,
  asOf: string,
  c: OrphanClassification,
  message: string,
): void {
  try {
    store.append(
      makeSubstrateAlert({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          alertId: `alert:integrity:orphan-run-abandoned-${c.runId
            .replace(/[^a-z0-9-]/gi, "-")
            .toLowerCase()
            .slice(0, 60)}`,
          alertClass: "integrity",
          severity: "high",
          details: message,
        },
      }),
    );
  } catch {
    // Best-effort: violation is still reported in the result.
  }
}

/**
 * Idempotently synthesise the missing AgentRunCompleted{outcome:"delivered"}.
 *
 * Idempotency: re-checks completion right before the append so a concurrent
 * close-run or a prior reconcile is never double-counted. The append carries a
 * substrateGapsSurfaced marker recording that this completion was auto-
 * reconciled (not hand-emitted), so the audit trail is honest about provenance.
 *
 * Anti-fabrication: the caller has already proven `pr.state === "merged"` via
 * the injected lookup. This function does not re-derive merge state — it is the
 * emit step gated by that fact.
 *
 * Returns true if an event was appended, false if the run was already complete.
 */
function autoReconcileMergedOrphan(
  store: EventStore,
  asOf: string,
  orphan: OrphanRun,
  c: OrphanClassification,
): boolean {
  // Idempotency re-check at emit time.
  for (const e of store.replay({ type: "AgentRunCompleted" })) {
    if (String((e.payload as Record<string, unknown>).runId ?? "") === orphan.runId) return false;
  }
  try {
    store.append(
      makeAgentRunCompleted({
        asOf,
        entity: ENTITY,
        actor: ACTOR,
        citations: CITATIONS,
        payload: {
          runId: orphan.runId,
          briefId: orphan.briefId,
          agent: {
            name: orphan.agentName,
            position: orphan.agentPosition,
            agentId: orphan.agentId,
          },
          completedAt: asOf,
          outcome: "delivered",
          deliverableDocumentHashes: [],
          substrateGapsSurfaced: [
            `auto-reconciled by recon:${PIPELINE.split(":")[1]}: orphan finished-but-didn't-return; close-run never fired but PR #${c.prNumber ?? "?"} is verified MERGED`,
          ],
          citations: CITATIONS,
          followOnRoutes: c.prUrl
            ? [
                {
                  kind: "code-pr",
                  target: c.prUrl,
                  directive: "merged deliverable; run auto-closed by orphan classifier",
                },
              ]
            : [],
        },
      }),
    );
    return true;
  } catch {
    return false;
  }
}

if (import.meta.main) {
  const asOf = new Date().toISOString(); // wall-clock: CLI entrypoint only
  // CLI wires a real gh-backed PR-state lookup. Kept thin and lazy so the
  // module stays import-pure for tests.
  const { ghPrStateLookup } = await import("./orphan-run-gh-lookup");
  const result = run({ asOf, prLookup: ghPrStateLookup });
  console.log(
    JSON.stringify(
      {
        level: result.ok ? "info" : "error",
        time: result.asOf,
        service: "bank-prototype",
        pipeline: result.pipeline,
        asserted: result.asserted,
        violations: result.violations.filter((v) => v.severity === "fail").length,
        warnings: result.violations.filter((v) => v.severity === "warn").length,
        autoReconciled: result.autoReconciledRunIds,
        ok: result.ok,
        msg: result.ok
          ? "orphan-run-deliverable-state: no abandoned orphans (deliverable-ready ones surfaced / auto-reconciled)"
          : "orphan-run-deliverable-state FAILED — abandoned orphan run(s) detected",
        detail: result.violations,
        classifications: result.classifications,
      },
      null,
      2,
    ),
  );
  process.exit(result.ok ? 0 : 1);
}
