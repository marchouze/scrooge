// scripts/record-d-agent-memory-persistence.ts
//
// Records D-AGENT-MEMORY-PERSISTENCE — Marc's in-session approval (2026-06-25,
// "proceed as recommended") to build the EXPERIENTIAL per-agent memory layer:
// federate accumulated agent knowledge by mandate-domain in the ONE canonical
// event store, so standing agents actually accumulate memory across runs and
// Scrooge stops being the central bottleneck (today the flat 116KB MEMORY.md).
//
// Complementary to D-AGENT-DOMAIN-COMPETENCE (the AUTHORITATIVE knowledge-base +
// domain-oracle layer): this is the EXPERIENTIAL layer (learnings / state-facts /
// open-threads accumulated across runs). Both are mandate-tagged, citable, in the
// single graph (Principle 2). NOT a parallel system.
//
// Scope approved (adversarial-design-reviewed — workflow wf_3762ea08-5d5):
//   - Memory = append-only `AgentMemoryCommitted` events tagged by mandate
//     `domains[]` in the one event store (NOT per-agent physical silos; NOT a
//     free-text keyword router — the router mis-routes statutory domains:
//     Owen/Iris own POPIA/records/ECTA with ZERO engineering builders). A
//     cross-cutting fact carries N domain tags and lives ONCE. Each agent loads
//     `WHERE domains ∩ its mandate`. "Who to ask" = the tag (+ the existing
//     domain-ownership-map), not a router; Scrooge keeps routing by hand.
//   - Slice 0: give all 31 personas a stable `agentId` (only `noa` has one).
//   - Slice 1 (irreducible — stops the knowledge leak): born-V2
//     `AgentMemoryCommitted{memoryId, domains[](min1), producedByAgent,
//     bodyDocumentHash, citations(min1), supersedes?}` written at
//     `dispatch:close-run`, body → existing content-addressed doc store, wired
//     into BOTH read vocabularies (world-state `SubstrateAgentRun*` + the
//     un-prefixed `AgentRun*` projection — the two-vocabulary footgun), with
//     fail-closed `recon:agent-memory-citation-integrity` + `-doc-resolves`.
//   - Slice 2: read-at-dispatch as a filtered query into
//     `WorldStateSnapshot.myMemory` (single snapshotHash preserved).
//   - DEFERRED until volume proves need (tracked Principle-6 roadmap gaps): the
//     auto-router / `routeDomains` / `PromptRouted`, salience tiers, and the
//     consolidate-vs-hire trigger. The trigger ships as an ADVISORY
//     `SubstrateAlert` + a CEO hire-Decision mapped onto the existing
//     PAX-researches → Nolan-hires loop (hiring = a routing edit, no data
//     migration); the retrieval-precision metric is NOT instrumentable on the
//     current paste-at-dispatch substrate, so it must not gate (green-by-
//     concealment). DROP the salience enum, the 5-way `kind` enum, the
//     retention envelope (premature ceremony on agent-internal scratch memory).
//
// Until the autonomous runtime lands, "load-at-dispatch" means Scrooge pastes the
// agent's memory slice into the brief (manual instrument) — the gap is a roadmap
// item (Principle 6), not hidden. Slices 0–2 are still worth building now: they
// make memory replayable + recon-gated instead of a hand-edited 116KB file that
// violates Principle 1 today.
//
// Idempotent on (decisionId, phase, as_of) with FIXED instants for byte-stable
// ci:migrate replay. Scrooge is the recording instrument; Marc is the authorizing
// principal. Engineering build decision (build phase) → CEO authority,
// `engineering` category.
//
// Authority: CLAUDE.md §"Session delegation"; D-AGENT-DOMAIN-COMPETENCE;
//   Principles 1 (events-are-truth), 2 (single-graph), 6 (autonomous-by-default);
//   D-ENGINEERING-INTEGRITY-CHARTER.
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQUESTED = "2026-06-25T16:50:00.000Z";
const APPROVED = "2026-06-25T16:55:00.000Z";

const base = {
  decisionId: "D-AGENT-MEMORY-PERSISTENCE",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Persistent per-mandate agent memory — experiential layer (federated by domain tag, one event store)",
  category: "engineering" as const,
  recommendation:
    "Build the experiential agent-memory layer complementary to D-AGENT-DOMAIN-COMPETENCE's authoritative-KB layer. Memory = append-only AgentMemoryCommitted events tagged by mandate-domain in the ONE canonical event store (NOT per-agent physical silos; NOT a free-text keyword router — the router mis-routes statutory domains, e.g. Owen/Iris own POPIA/records/ECTA with zero engineering builders). A cross-cutting fact carries N domain tags and lives once; each agent loads WHERE domains intersect its mandate; 'who to ask' = the tag plus the existing domain-ownership-map, with Scrooge routing by hand. Slice 0: stable agentId for all 31 personas. Slice 1 (irreducible): born-V2 AgentMemoryCommitted{memoryId, domains[] min 1, producedByAgent, bodyDocumentHash, citations min 1, supersedes?} written at dispatch:close-run, body to the existing doc store, wired into BOTH read vocabularies (world-state SubstrateAgentRun* and the un-prefixed AgentRun* projection), with fail-closed recon:agent-memory-citation-integrity + -doc-resolves. Slice 2: read-at-dispatch as a filtered query into WorldStateSnapshot.myMemory preserving the single snapshotHash. Defer the auto-router/routeDomains/PromptRouted, salience tiers, and the consolidate-vs-hire trigger until volume proves need; ship the trigger as an advisory SubstrateAlert + CEO hire-Decision mapped onto the existing PAX→Nolan loop (hiring = a routing edit, no data migration); the retrieval-precision metric is not instrumentable today so it must not gate. Drop the salience enum, the 5-way kind enum, and the retention envelope as premature ceremony.",
  rationale:
    "Dispatched agents are stateless today — WorldStateSnapshot (platform/agent-runtime/world-state.ts) carries no learnings field — so all durable knowledge funnels into Scrooge's single flat 116KB MEMORY.md, which itself violates Principle 1 (a mutable hand-edited file, not events). That makes Scrooge a central memory bottleneck and lets cross-session facts go stale silently (proven live this session: the NPA Accounting perspective drifted from the corrected FX model of #1534/#1538, caught only by lucky recall). Federating memory by mandate-domain in the one event store makes the roster's standing agents actually stand (accumulate memory), keeps the single citable graph (Principles 1/2), and lets Scrooge route by tag rather than hold knowledge. A 7-agent adversarial design review rejected literal per-agent silos plus a keyword router and landed on one store indexed by mandate-domain as the correct, simplest design.",
  sourceDocHashes: [],
  citations: [
    "D-AGENT-DOMAIN-COMPETENCE",
    "D-ENGINEERING-INTEGRITY-CHARTER",
    "Principles/1-events-are-truth.md",
    "Principles/2-single-graph-discipline.md",
    "Principles/6-autonomous-by-default.md",
  ],
  recordedVia: "scrooge:session-delegation",
};

requestDecision(base, REQUESTED);
const r = recordDecision({ ...base, phase: "approved" as const }, APPROVED);

console.log(
  JSON.stringify(
    { ok: true, eventId: r.eventId, decisionId: "D-AGENT-MEMORY-PERSISTENCE" },
    null,
    2,
  ),
);
