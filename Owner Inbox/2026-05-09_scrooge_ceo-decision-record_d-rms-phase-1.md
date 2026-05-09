---
agent: Scrooge (Chief of Staff / Orchestrator)
trigger: ceo-decision-record
asOf: 2026-05-09T16:05:00.000Z
decision-required: false
---

# Scrooge (Chief of Staff / Orchestrator) — CEO decision record: D-RMS-PHASE-1, 2026-05-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. Canonical authority is the `CeoDecision` event emitted alongside this file via `prototype/scripts/record-decisions-2026-05-09.ts`; this markdown is the human-readable mirror.

## Outcome

- **Decision ID:** `D-RMS-PHASE-1`
- **Title:** Records Management Substrate Phase-1 — retire Owner Inbox / Team Inbox via 4-phase migration
- **Action:** approve as drafted
- **Source proposal:** [Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md](Owner%20Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md)
- **Outcome:** Owen (Company Secretary, governance) + Atlas (Core banking platform architect)'s Phase 1 spec approved as drafted. Phase 1 lands seven typed events (`AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `CeoDecision`-extended, `Feedback`, `BriefSuperseded`, `RecordFiled`), a BLAKE3-hashed content-addressed document store at `prototype/data/documents/` (Azure Blob + Managed-HSM key envelope at M8 cloud lift), seven projection-derived registers (Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs / dispatches, Workstreams), and a dual-render dashboard that surfaces both the new register views and the legacy Owner Inbox / Team Inbox folders. ~5 sessions under the Targeted substrate budget. Owen + Atlas joint authorship for Phase 2-4 specs as they land approved.
- **Actor:** `marc@tgv.co.za` (CEO)
- **Comment:** "approve both" — chat-intake 2026-05-09.
- **Authority chain:** Substrate-foundational decision implementing Principle 1 (events are truth — folders not authoritative), Principle 6 (presentations derive from data — registers as projections), Principle 7 (autonomous-by-default — events as the agent-to-agent communication channel). Implements records-retention obligations under Companies Act 71 of 2008 s.24, Banks Act 94 of 1990 record-keeping, FIC Act 38 of 2001 ss.22-23, POPIA 4 of 2013 s.14.

## Follow-on routes recorded

- `agent:Atlas (Core banking platform architect)` — implement Phase 1 substrate slices (3-5 buildable slices per spec §13). Slice 1: event types + emitters. Slice 2: BLAKE3 document store. Slice 3: projection runtime + seven registers. Slice 4: dashboard dual-render. Slice 5: end-to-end round-trip test (`AgentBriefIssued` → `AgentRunStarted` → `AgentRunCompleted` → `DecisionRequested` → `CeoDecision` chain with no Owner Inbox / Team Inbox file authored). Acceptance per spec §7.
- `agent:Owen (Company Secretary, governance)` — author the **records-management policy** (one-paragraph statement) and land it in the policy register; file the full document under the new Document register at Phase 1 close. Land register schemas per spec §6 with retention citations.
- `agent:Vera (Internal audit engineer)` — register the recon pipelines per spec §14: bidirectional reconciliation between events and registers; orphan-document detection; dangling-reference detection; supersession-event integrity. Surface findings on Vera Wave-4.
- `agent:Atlas` — at Phase 1 acceptance, raise `D-RMS-PHASE-2` (route all new agent dispatches through `AgentBriefIssued`; stop authoring Team Inbox files). Phases 2 → 3 → 4 sequenced after each prior acceptance gate.
- **Direction-of-travel signal for CLAUDE.md** — Marc's parallel suggestion (this same chat-intake) flagged that CLAUDE.md's "Deliverables" section currently mandates Owner Inbox file-authoring; that line should be re-cast as legacy-with-direction-of-travel-pointer once Phase 1 lands. Tracked as a CLAUDE.md edit pending Phase 1 acceptance.
- **Events-first authoring rule** — the recurrence of today's dashboard misclassification (15 stale "open" decisions because records were authored markdown-first without `CeoDecision` events) is exactly what Phase 1 prevents. The events-first rule becomes substrate-enforced at Phase 1 close; until then it remains a discipline. CLAUDE.md "Operating procedures" should add the events-first authoring rule (suggestion #3 from this same chat-intake).

## Substrate gaps surfaced

1. **S8 agent-runtime feed-in** — RMS event types feed into S8's `AgentEscalation` / `AgentDecision` events; the agent-runtime scheduler subscribes to `AgentBriefIssued` to dispatch agents. RMS Phase 1 stands alone via Scrooge-coordinated dispatch (Principle 7 fallback) but the contract surface needs to co-evolve with S8 cleanly. Owner: Atlas + S8-build owner.
2. **Document-store cloud-lift target** — Azure Blob + Managed-HSM key envelope design pass deferred to M8 cloud lift; Phase 1 lands local-only.
3. **Per-agent subscription substrate** — agents today poll filesystems; under RMS they subscribe to events. The subscription substrate doesn't exist; depends on S8 or substrate-extension at Phase 2.
4. **`Feedback` event type novelty** — the only event family with no current substrate analogue; highest-uncertainty piece. Routing rules (corrections → memory; instructions → `AgentBriefIssued`; decisions → `CeoDecision`) need careful disambiguation.
5. **Records-management policy** — needs to land in Owen's policy register at Phase 1 close.

## Provenance

Emitted via `agent:scrooge:ceo-decision-record` runtime handler (substrate-gap fallback: emitted via one-shot script `prototype/scripts/record-decisions-2026-05-09.ts` per Principle 7 "steady-state vs current substrate"). The `CeoDecision` event is the canonical record; this markdown mirrors. At Phase 1 close, this very record format becomes a render of the underlying event + document — closing the loop the spec opens.

—Scrooge (Chief of Staff / Orchestrator)
