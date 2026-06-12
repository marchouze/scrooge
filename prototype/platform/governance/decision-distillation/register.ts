// platform/governance/decision-distillation/register.ts
//
// Core-knowledge-base register — a pure fold over `DecisionDistilled`
// events (latest event per decisionId wins) joined with `Decision` events
// (title, category, latest phase).
//
// Exposes the BBaaS seam: foundational (backbone, holds for any tenant) /
// directional (this bank's choices) / obsolete (superseded or overtaken),
// plus the `unclassifiedApproved` residue the coverage recon gates on.
//
// Authority: D-V2-BBAAS-W1-DECISION-DISTILLATION (CEO session-delegation
// 2026-06-12); P1-EVENTS-AS-TRUTH.
// Author: Owen (Company Secretary, governance).

import { eventStore } from "../../composition";
import type {
  DecisionDistillationClass,
  DecisionDistilledPayload,
} from "../../event-store/event-types/decision-distillation";
import type { Event } from "../../event-store/types";

export interface CoreKnowledgeBaseRow {
  readonly decisionId: string;
  readonly class: DecisionDistillationClass;
  readonly rationale: string;
  readonly citations: readonly string[];
  readonly distilledBy: string;
  readonly workstream: string;
  /** as_of of the winning (latest) DecisionDistilled event. */
  readonly distilledAt: string;
  /** Joined from the latest approved Decision event ("" when absent). */
  readonly title: string;
  readonly category: string;
  /** Latest Decision phase across ALL phases for this decisionId. */
  readonly latestPhase: string;
}

export interface CoreKnowledgeBaseRegister {
  readonly foundational: readonly CoreKnowledgeBaseRow[];
  readonly directional: readonly CoreKnowledgeBaseRow[];
  readonly obsolete: readonly CoreKnowledgeBaseRow[];
  readonly counts: {
    readonly foundational: number;
    readonly directional: number;
    readonly obsolete: number;
    readonly total: number;
    readonly unclassifiedApproved: number;
  };
  /** decisionIds whose latest phase is `approved` but have no live
   *  DecisionDistilled classification. The coverage recon asserts []. */
  readonly unclassifiedApproved: readonly string[];
}

interface DecisionJoin {
  title: string;
  category: string;
  latestPhase: string;
  everApproved: boolean;
}

function byAsOf(a: Event, b: Event): number {
  return a.as_of < b.as_of ? -1 : a.as_of > b.as_of ? 1 : 0;
}

/**
 * Pure fold. `decisionEvents` carry every phase (the latest phase per
 * decisionId determines obsolescence candidacy); `distilledEvents` resolve
 * latest-per-decisionId (re-classification = new event, P1).
 */
export function foldCoreKnowledgeBase(
  decisionEvents: readonly Event[],
  distilledEvents: readonly Event[],
): CoreKnowledgeBaseRegister {
  // --- Decision join: latest phase + latest approved title/category. ---
  const joins = new Map<string, DecisionJoin>();
  const orderedDecisions = [...decisionEvents]
    .filter((e) => e.type === "Decision" || e.type === "CeoDecision")
    .sort(byAsOf);
  for (const ev of orderedDecisions) {
    const p = ev.payload as {
      decisionId?: string;
      phase?: string;
      title?: string;
      category?: string;
    };
    if (!p.decisionId || !p.phase) continue;
    const j = joins.get(p.decisionId) ?? {
      title: "",
      category: "",
      latestPhase: "",
      everApproved: false,
    };
    j.latestPhase = p.phase;
    if (p.phase === "approved") {
      j.everApproved = true;
      j.title = p.title ?? j.title;
      j.category = p.category ?? j.category;
    }
    joins.set(p.decisionId, j);
  }

  // --- Latest DecisionDistilled per decisionId wins. ---
  const latestDistilled = new Map<string, Event>();
  for (const ev of [...distilledEvents]
    .filter((e) => e.type === "DecisionDistilled")
    .sort(byAsOf)) {
    const p = ev.payload as DecisionDistilledPayload;
    latestDistilled.set(p.decisionId, ev);
  }

  const rows: CoreKnowledgeBaseRow[] = [];
  for (const ev of latestDistilled.values()) {
    const p = ev.payload as DecisionDistilledPayload;
    const j = joins.get(p.decisionId);
    rows.push({
      decisionId: p.decisionId,
      class: p.class,
      rationale: p.rationale,
      citations: p.citations,
      distilledBy: p.distilledBy,
      workstream: p.workstream,
      distilledAt: ev.as_of,
      title: j?.title ?? "",
      category: j?.category ?? "",
      latestPhase: j?.latestPhase ?? "",
    });
  }
  rows.sort((a, b) => (a.decisionId < b.decisionId ? -1 : a.decisionId > b.decisionId ? 1 : 0));

  const foundational = rows.filter((r) => r.class === "foundational");
  const directional = rows.filter((r) => r.class === "directional");
  const obsolete = rows.filter((r) => r.class === "obsolete");

  const unclassifiedApproved = [...joins.entries()]
    .filter(([did, j]) => j.latestPhase === "approved" && !latestDistilled.has(did))
    .map(([did]) => did)
    .sort();

  return {
    foundational,
    directional,
    obsolete,
    counts: {
      foundational: foundational.length,
      directional: directional.length,
      obsolete: obsolete.length,
      total: rows.length,
      unclassifiedApproved: unclassifiedApproved.length,
    },
    unclassifiedApproved,
  };
}

/** Store-backed entry point. Empty store → empty register by construction. */
export function readCoreKnowledgeBase(): CoreKnowledgeBaseRegister {
  let decisions: readonly Event[] = [];
  let distilled: readonly Event[] = [];
  try {
    decisions = [
      ...eventStore.replay({ type: "Decision" }),
      ...eventStore.replay({ type: "CeoDecision" }),
    ];
  } catch {
    decisions = [];
  }
  try {
    distilled = [...eventStore.replay({ type: "DecisionDistilled" })];
  } catch {
    distilled = [];
  }
  return foldCoreKnowledgeBase(decisions, distilled);
}
