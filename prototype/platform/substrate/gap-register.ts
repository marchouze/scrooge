// platform/substrate/gap-register.ts
//
// Canonical typed register of the engineering substrate's known gaps.
//
// Previously these lived as a curated `KNOWN_SUBSTRATE_GAPS: string[]` inside
// `runtime/agents/atlas-substrate-state.ts`, with severity / status /
// mitigation re-derived every run by regex over the prose. That coupled the
// classification to keyword accidents and hid it from any other consumer.
//
// This register is the single canonical source (Principle 2): each gap carries
// a stable `id` and EXPLICIT severity / status / mitigation. Atlas's
// substrate-state handler folds it into the `SubstrateStateSnapshot.gaps[]`
// inventory + per-gap WorkstreamRegistered events. Substrate gaps are forward
// engineering work, NOT risk-register findings (WS-RISK-REGISTER-CLOSURE) —
// `severity` here is a planning heuristic (blast radius), not a risk-appetite
// measure.
//
// Author: Atlas (Core banking platform architect, engineering)

/** Planning-severity of a substrate gap — blast radius, not risk appetite. */
export type SubstrateGapSeverity = "medium" | "high";
/** Lifecycle status of the engineering work that closes the gap. */
export type SubstrateGapStatus = "planned" | "in-flight";
/** Whether an interim mitigation is in place while the gap is open. */
export type SubstrateGapMitigation = "none" | "partial";

/** One row in the canonical substrate-gap register. */
export interface SubstrateGapRecord {
  /** Stable kebab-case identifier — survives reordering of the register. */
  readonly id: string;
  /** Short human title. */
  readonly title: string;
  /** Full prose: what the gap is, its dependency, and the closing plan. */
  readonly description: string;
  readonly severity: SubstrateGapSeverity;
  readonly status: SubstrateGapStatus;
  readonly mitigation: SubstrateGapMitigation;
}

export const SUBSTRATE_GAP_REGISTER: readonly SubstrateGapRecord[] = [
  {
    id: "event-store-cloud-shared",
    title: "Event store cloud-shared via Neon Postgres",
    description:
      "Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "typed-event-payload-schemas",
    title: "Typed event-payload schemas + risk closure family",
    description:
      "Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "runtime-trigger-kinds",
    title: "Runtime trigger kinds (scheduled / event-driven / on-request)",
    description:
      "Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "claude-api-narrative",
    title: "Claude API integration for agent-narrative output",
    description:
      "Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.",
    severity: "medium",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "projection-cache-persistence",
    title: "Projection-cache persistence via anya:projection-refresh",
    description:
      "Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "citation-gate-wrapper",
    title: "Citation gate wrapped as mira:citation-gate",
    description:
      "Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "github-actions-cron",
    title: "GitHub Actions cron unreliability (A2.1 scheduler)",
    description:
      "GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
];

/** Look up a gap record by id. */
export function getSubstrateGap(id: string): SubstrateGapRecord | undefined {
  return SUBSTRATE_GAP_REGISTER.find((g) => g.id === id);
}
