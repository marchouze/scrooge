---
title: Records Management Substrate (RMS) — Phase 1 spec (retire Owner Inbox / Team Inbox as canonical channels)
author: Owen (Company Secretary, governance) + Atlas (Core banking platform architect)
date: 2026-05-09
summary: Phase 1 spec for the typed Records Management Substrate that replaces the Owner Inbox / Team Inbox folders as the canonical channels for instructions, briefs, deliverables, decisions, and feedback. Events become the source of truth (P1); content-addressed document store holds heavy artefacts (P3); seven projection registers render the dashboard (P6); agents subscribe to typed brief events rather than polling filesystems (P7).
decision-required: true
decision-id: D-RMS-PHASE-1
decision-category: substrate-foundational
decision-owner: Owen (Company Secretary, governance) + Atlas (Core banking platform architect)
decision-for-ceo: Authorise Phase 1 build of the Records Management Substrate — seven new event types, content-addressed document store, seven projection registers, dual-render dashboard alongside legacy inboxes.
decision-recommendation: Approve Phase 1 as drafted with BLAKE3 hashing and `prototype/data/documents/` local store. Phase 1 lands the substrate spine without retiring the legacy directories; Phases 2–4 sequence in their named M-phases.
---

# Records Management Substrate (RMS) — Phase 1 spec

> **Co-authored:** Owen (Company Secretary, governance) leads §2, §6, §10, §12, §15; Atlas (Core banking platform architect) leads §3, §4, §5, §13. Both speak in §1, §7–§9, §11, §14, §16–§18.

## 1. Why we are retiring the inboxes

The CEO has approved retiring `Owner Inbox/` and `Team Inbox/` as the **canonical** channels for instructions, briefs, deliverables, decisions, and feedback. They were the right scaffold for the build phase up to today — they are not coherent with the architectural principles the bank is licensed against.

### P1 — folders are not authoritative

Principle 1 says **events are the only source of truth**. Today, `Owner Inbox/2026-05-10_*.md` files are read directly by `prototype/dashboard/derive.ts` (`parseOwnerInbox`, lines 879–926) and lifted into `decisionsOpen` via frontmatter. The folder *is* the source: rename a file, delete a file, edit frontmatter — the dashboard's view of "open decisions" mutates, and there is no event to replay against. CeoDecision events sit *alongside* the markdown rather than *driving* it. This violates P1 in the foundational direction: a balance, a position, an obligation, and **a decision** must all be queries over the event log, not files in a directory.

### P6 — presentations are authored, not derived

Principle 6 (downward) says external presentations are summaries of the internal stack — **generated, not assembled**. Today the Owner Inbox brief is the substantive artefact: a compliance engineer types prose with frontmatter, and the dashboard re-renders that prose. The presentation layer is where new substance enters. RMS inverts this: the substantive event (e.g. `DecisionRequested` with payload `{ decisionId, title, category, recommendation, sourceDocumentHash }`) is the canonical record; the markdown deliverable is a **document substrate artefact** referenced by hash; the Owner Inbox view becomes a **register projection** over the event stream. Substance enters at events; the dashboard renders.

### P7 — phantom-teammate framing

Principle 7 says briefs are never queues for phantom human teammates: they are either records of what an agent's last run produced or inputs to an agent's next run. The folder names "Owner Inbox" and "Team Inbox" *are* the phantom-teammate framing — they imply mailboxes that humans (or human-shaped agents) drain. The RMS replaces this with typed `AgentBriefIssued` events targeted at named agents, `AgentRunStarted` / `AgentRunCompleted` lifecycle events the agent runtime emits, and a `Feedback` event that intakes chat-originating CEO direction. No polling, no folder draining, no implicit ordering by filesystem mtime.

## 2. Architectural overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    EVENT LOG  (canonical — Principle 1)                 │
│                                                                         │
│  AgentBriefIssued ─── AgentRunStarted ─── AgentRunCompleted             │
│         │                                          │                    │
│         │                                          │                    │
│         └────►  DecisionRequested  ◄───────────────┘                    │
│                        │                                                │
│                        ▼                                                │
│                  CeoDecision  (extended)                                │
│                                                                         │
│  Feedback     BriefSuperseded     RecordFiled                           │
└─────────────────────────────────────────────────────────────────────────┘
                              │ events carry
                              │ documentHash refs
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│   DOCUMENT SUBSTRATE  (content-addressed — Principle 3)                 │
│                                                                         │
│   put(content) → hash    get(hash) → content    exists(hash) → bool     │
│   prototype/data/documents/<hash>            (local; markdown today)    │
│   azure-blob://documents/<hash>  (cloud target; HSM-key envelope)       │
└─────────────────────────────────────────────────────────────────────────┘
                              │ projections fold
                              │ events into rows
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  REGISTERS  (projections — Principle 6 downward)                        │
│                                                                         │
│  • Decisions               • Briefs / Dispatches                        │
│  • Correspondence          • Workstreams                                │
│  • Records-of-agent-runs   • Document Register                          │
│  • Feedback                                                             │
│                                                                         │
│  The dashboard renders these views. The CEO Decisions Desk is the       │
│  Decisions register filtered to status=open + category=for-CEO.         │
└─────────────────────────────────────────────────────────────────────────┘
```

Three layers, one direction of authority: **events → documents-by-reference → registers**. The dashboard is a query over the registers; the registers are queries over the events; the documents are content-addressed binaries the events cite.

## 3. Event type definitions  (Atlas-led, Owen-reviewed)

All seven types follow the existing `EventEnvelope<TBody>` envelope (`prototype/platform/events/types.ts`): EventId, type, stream, streamVersion, recordedAt, legalEntity, currency, jurisdiction, citations, prevHash, hash, producer, signature, body. Below specifies only the `body` payload and the emission / reduction rules. All payloads pair `agent.name` with `agent.position` per the identity-discipline rule.

### 3.1 `AgentBriefIssued`

```ts
interface AgentBriefIssuedBody {
  readonly briefId: Brand<string, "BriefId">;
  readonly issuedTo: AgentRef;            // { name, position, agentId }
  readonly issuedBy: AgentRef;            // typically { name: "Scrooge", position: "Chief of Staff / Orchestrator" }
  readonly title: string;                 // one-line
  readonly directiveDocumentHash: Hash;   // content-addressed brief body
  readonly workstreamId?: Brand<string, "WorkstreamId">;
  readonly priority: "now" | "next-tick" | "scheduled";
  readonly scheduledFor?: UtcTimestamp;
  readonly supersedes?: Brand<string, "BriefId">;   // chain to prior brief
  readonly expectedOutputs: ReadonlyArray<{
    readonly kind: "decision-card" | "deliverable-document" | "register-row" | "code-pr";
    readonly description: string;
  }>;
  readonly citations: ReadonlyArray<Urn>; // policy / regulation / objective the brief implements
}
```

- **Emit:** Scrooge (CoS), any governance seat, or an upstream agent's `AgentRunCompleted` follow-on-router.
- **Trigger:** CEO directive (via `Feedback`), scheduler tick, or another event's follow-on routes.
- **Reduce into:** Briefs/Dispatches register (one row per brief, current status derived from downstream `AgentRunStarted` / `AgentRunCompleted` / `BriefSuperseded`).

### 3.2 `AgentRunStarted`

```ts
interface AgentRunStartedBody {
  readonly runId: Brand<string, "RunId">;
  readonly briefId: Brand<string, "BriefId">;
  readonly agent: AgentRef;
  readonly startedAt: UtcTimestamp;
  readonly substrate: "agent-runtime" | "scrooge-coordinated-in-session";
  readonly worktree?: string;             // when isolated worktree
}
```

- **Emit:** the agent runtime when scheduler dispatches; Scrooge in-session as the P7 fallback.
- **Reduce into:** Records-of-agent-runs register (lifecycle row); updates Briefs register status to `in-flight`.

### 3.3 `AgentRunCompleted`

```ts
interface AgentRunCompletedBody {
  readonly runId: Brand<string, "RunId">;
  readonly briefId: Brand<string, "BriefId">;
  readonly agent: AgentRef;
  readonly completedAt: UtcTimestamp;
  readonly outcome: "delivered" | "blocked" | "withdrawn";
  readonly deliverableDocumentHashes: ReadonlyArray<Hash>;
  readonly substrateGapsSurfaced: ReadonlyArray<string>;
  readonly citations: ReadonlyArray<Urn>;
  readonly followOnRoutes: ReadonlyArray<{
    readonly kind: "agent" | "decision" | "register-update";
    readonly target: string;              // agent ref, decisionId, or register key
    readonly directive: string;
  }>;
}
```

- **Emit:** the agent on completion; Scrooge in-session as the P7 fallback.
- **Reduce into:** Records-of-agent-runs (closes the row); Document Register (each `deliverableDocumentHash` becomes a row); optionally fans out into `AgentBriefIssued` / `DecisionRequested` per `followOnRoutes`.

### 3.4 `DecisionRequested`

```ts
interface DecisionRequestedBody {
  readonly decisionId: Brand<string, "DecisionId">;
  readonly title: string;
  readonly category: "pacing" | "near-term" | "second-order" | "medium-term" | "long-horizon" | "substrate-foundational";
  readonly owner: AgentRef;               // proposer
  readonly forActor: "CEO" | "Board" | "AC" | "ALCO" | "BRC";
  readonly decisionForActor: string;      // the question
  readonly recommendation: { stance: string; reasoning: string };
  readonly sourceDocumentHashes: ReadonlyArray<Hash>;
  readonly citations: ReadonlyArray<Urn>;
  readonly deadline?: UtcTimestamp;
  readonly options?: ReadonlyArray<{ label: string; description: string }>;
}
```

- **Emit:** any agent that needs an escalated decision, or directly from an `AgentRunCompleted` follow-on.
- **Reduce into:** Decisions register (status `open` until a matching `CeoDecision` lands).

### 3.5 `CeoDecision` (extended)

The existing `CeoDecision` event (see `prototype/runtime/decisions/record.ts`) already carries `{ decisionId, action, title, outcome, comment?, sourceDoc?, followOnRoutes?, recordedVia }`. RMS extends it minimally — additive — to bind decisions into the new substrate:

```ts
interface CeoDecisionBody {
  // pre-existing fields (unchanged):
  readonly decisionId: string;
  readonly action: "approve" | "defer" | "modify" | "request-revision";
  readonly title: string;
  readonly outcome: string;
  readonly comment?: string;
  readonly sourceDoc?: string;             // legacy markdown-path — deprecated
  readonly followOnRoutes?: readonly string[];
  readonly recordedVia: string;

  // new in RMS:
  readonly requestEventId?: EventId;       // the DecisionRequested event this resolves
  readonly recordDocumentHashes?: ReadonlyArray<Hash>;  // typed CEO-decision-record
  readonly modifiedRecommendation?: { stance: string; reasoning: string };  // when action=modify
}
```

- **Emit:** unchanged — `recordCeoDecision()` in `runtime/decisions/record.ts`.
- **Reduce into:** Decisions register (resolves the matching `DecisionRequested`); fans out into Briefs via `followOnRoutes`.
- **Backwards compatibility:** events without the new fields continue to work; the dashboard's resolved-decision derivation is unchanged for legacy events.

### 3.6 `Feedback`

```ts
interface FeedbackBody {
  readonly feedbackId: Brand<string, "FeedbackId">;
  readonly from: { actor: "CEO" | "Board" | AgentRef; identity: string };
  readonly channel: "chat" | "decisions-desk-comment" | "register-annotation" | "review-meeting-record";
  readonly intakeAt: UtcTimestamp;
  readonly subject: { kind: "decision" | "brief" | "run" | "register" | "policy" | "principle" | "operating-rule"; ref: string };
  readonly body: string;                   // the feedback content (short — long form is a documentHash)
  readonly bodyDocumentHash?: Hash;
  readonly classifications: ReadonlyArray<"directive" | "preference" | "correction" | "question" | "praise" | "concern">;
  readonly routedTo?: ReadonlyArray<AgentRef>;
}
```

- **Emit:** Scrooge's chat-intake handler (chat → typed event); any agent acknowledging feedback.
- **Trigger:** every CEO chat message that conveys instruction, preference, or correction. Today many of these become memory entries (`feedback_*.md` in user memory) — RMS makes them events first, with memory entries as the projection.
- **Reduce into:** Feedback register; certain classifications (`directive`) auto-fan into `AgentBriefIssued`.
- **This is the most novel event type in RMS** — see §17.

### 3.7 `BriefSuperseded`

```ts
interface BriefSupersededBody {
  readonly originalBriefId: Brand<string, "BriefId">;
  readonly supersededBy: Brand<string, "BriefId">;
  readonly reason: "withdrawn" | "merged" | "scope-changed" | "actioned-out-of-band";
  readonly authorisedBy: AgentRef;
}
```

- **Emit:** Scrooge or the briefing agent when a brief is no longer live.
- **Reduce into:** Briefs register (marks status `superseded`); records-of-agent-runs status flag if a run is in flight.

### 3.8 `RecordFiled`

```ts
interface RecordFiledBody {
  readonly recordId: Brand<string, "RecordId">;
  readonly registerKey: "decisions" | "correspondence" | "agent-runs" | "documents" | "feedback" | "briefs" | "workstreams";
  readonly documentHash: Hash;             // the canonical document body
  readonly classification: "ceo-only" | "governance-seat" | "engineering-seat" | "agent-internal" | "public-disclosure";
  readonly retention: { citationRef: Urn; minimumYears: number; archivalTier: "hot" | "cool" | "archive" };
  readonly supersedes?: Brand<string, "RecordId">;
  readonly correctsOriginalErrors?: boolean;
}
```

- **Emit:** any register's filing helper when a document needs to be canonically registered (e.g. a board-pack render, a regulator submission, a counterparty correspondence).
- **Reduce into:** Document Register; the named register's row gains the `recordId`.
- **Owen's note:** this is the event that makes a markdown a *record* (governance sense) rather than a *draft*.

### 3.9 Citations carried

Every event carries `citations: ReadonlyArray<Urn>` per Principle 2. Minimum citation discipline for RMS events:

- `AgentBriefIssued` cites the policy / regulation / objective the brief implements.
- `AgentRunCompleted` cites the citations the agent's deliverable rests on.
- `DecisionRequested` cites the regulation / policy that constrains the decision.
- `CeoDecision` cites `GOV-FRAMEWORK-CEO-RESERVED` + the policy / regulation in scope (existing convention preserved).
- `Feedback` cites the principle / policy the feedback amends or applies to (when relevant).
- `BriefSuperseded` cites the original brief's citations.
- `RecordFiled` cites the retention regime in `retention.citationRef` (Companies Act / Banks Act / FIC / POPIA — see §6).

## 4. Document substrate  (Atlas-led)

### 4.1 Storage model

- **Hash algorithm:** BLAKE3 (recommended). 256-bit output, ~6× faster than SHA-256 for the markdown-sized payloads RMS handles, cryptographically sound, well-supported (Rust impl with TS bindings; native Bun support viable). SHA-256 is acceptable as a fallback for compatibility with FIPS-only contexts; the registry stores the algorithm prefix (`blake3:<hex>` / `sha256:<hex>`) so a future swap is non-breaking.
- **Local storage:** `prototype/data/documents/<algo>/<first-2>/<rest>` — sharded by the first two hex characters to avoid 10k+ files in a single directory. Files are immutable once written; the path itself is the integrity check.
- **Cloud target:** `azure-blob://<container>/documents/<algo>/<first-2>/<rest>` with **HSM-managed-key envelope encryption** (Azure Key Vault Managed HSM, FIPS 140-2 Level 3, per CLAUDE.md cloud-target memory and P3 cryptographic-key-material rule). Customer-managed keys; per-document data-encryption-key wrapped by the HSM key.

### 4.2 API surface

```ts
interface DocumentStore {
  put(content: Uint8Array | string, opts?: { algo?: "blake3" | "sha256" }): Hash;
  get(hash: Hash): Uint8Array;
  exists(hash: Hash): boolean;
  metadata(hash: Hash): { size: number; algo: string; firstSeenAt: UtcTimestamp };
}
```

- `put` is **idempotent**: writing the same content yields the same hash and is a no-op against existing storage. No content collisions are addressed at the substrate layer (cryptographic hash output handles this).
- `get` throws on cache miss. The integrity invariant is verified on every read (the substrate re-hashes on read in dev; toggleable for prod).
- `exists` is the primitive Vera's recon pipelines use to assert "every event-cited hash resolves" (§14).
- No `delete`. Documents are immutable. Supersession is an event (`RecordFiled` with `supersedes`), not a file replacement. Retention-driven deletion runs as a **redaction event** at retention horizon end — cited under POPIA s.14 (records may not be retained longer than necessary) — and is out of scope for Phase 1.

### 4.3 Format-agnostic at the substrate layer

The substrate stores bytes. Format is the caller's contract:

- **Phase 1:** markdown (`text/markdown; charset=utf-8`) for briefs, run records, decision records, feedback bodies, register annotations.
- **Phase 2+:** structured data (JSON / JSON-LD) for typed deliverables; PDFs (signed, e.g. director-resolutions) where ECTA / counterparty contracts mandate; ISO 20022 XML for payment artefacts; XBRL for regulator filings.

The substrate stores; the consuming register interprets. Every `RecordFiled` event names the format in the document register row.

### 4.4 Retention citation enforcement

`RecordFiled.retention.citationRef` must resolve in Mira's obligations register (Vera Wave-4 #14 covers this for events generally; RMS adds the document-store dimension). The minimum horizons in Phase 1:

| Domain | Citation | Minimum |
|---|---|---|
| Director / committee decisions | Companies Act 71 of 2008 s.24 | 7 years from period-end |
| Banking records | Banks Act 94 of 1990 + Reg. Banks | 5 years (operational); 10 years (foundational) |
| AML / CFT records | FIC Act 38 of 2001 s.22-23 | 5 years from termination |
| Personal information | POPIA 4 of 2013 s.14 | "no longer than necessary" — purpose-bound |

## 5. Document substrate cont. — implementation notes (Atlas)

- The local store sits behind a clean `DocumentStore` interface defined in `prototype/platform/document-store/types.ts`; the local-fs implementation in `prototype/platform/document-store/local-fs.ts`; the future Azure-blob implementation swaps at M8 without changing call sites (P3 implementation sequence).
- Hashing helpers live in `prototype/platform/document-store/hash.ts`; BLAKE3 binding via `@noble/hashes` or equivalent zero-dep TS package — picked at slice-1 design pass, not pre-bound here.
- The store keeps a tiny manifest table (`documents` table in the local SQLite or filesystem catalogue) recording `firstSeenAt`, `size`, `algo`. This is **not** authoritative; replay from the event log + filesystem reconstructs it.
- Observability: every `put` / `get` emits an OpenTelemetry span; `put` records the hash in span attributes; recon pipelines consume the span stream to compute orphan / dangling rates.

## 6. Register schemas  (Owen-led, Atlas-reviewed)

Each register is a **projection** over events — derived, never authored. The dashboard renders these views; the legacy Owner Inbox / Team Inbox views remain in dual-render through Phase 1–3 (see §7, §15).

### 6.1 Decisions register

| Field | Type | Source |
|---|---|---|
| `decisionId` | DecisionId | `DecisionRequested.body.decisionId` |
| `title` | string | `DecisionRequested.body.title` |
| `category` | DecisionCategory | `DecisionRequested.body.category` |
| `owner` | AgentRef | `DecisionRequested.body.owner` |
| `forActor` | "CEO" \| "Board" \| ... | `DecisionRequested.body.forActor` |
| `recommendation` | { stance, reasoning } | `DecisionRequested.body.recommendation` |
| `sourceDocumentHashes` | Hash[] | `DecisionRequested.body.sourceDocumentHashes` |
| `status` | "open" \| "resolved" | derived: `resolved` iff matching `CeoDecision` |
| `resolution` | CeoDecision payload | the matching `CeoDecision` (when resolved) |
| `requestedAt` | UtcTimestamp | event recordedAt |
| `resolvedAt` | UtcTimestamp \| null | matching `CeoDecision.recordedAt` |

- **Retention:** Companies Act 71 of 2008 s.24 — 7 years post period-end; CEO-reserved decisions retained per the Governance Framework (indefinite while the bank exists).
- **Access:** CEO-only and full governance access; engineering seats see decisions touching their domain; agent-internal feed read-only.

### 6.2 Correspondence register

| Field | Type | Source |
|---|---|---|
| `correspondenceId` | string | from `RecordFiled.recordId` where `registerKey="correspondence"` |
| `direction` | "inbound" \| "outbound" | document metadata |
| `counterparty` | string | document metadata (regulator, counterparty, customer, internal-committee) |
| `subject` | string | document metadata |
| `documentHash` | Hash | `RecordFiled.documentHash` |
| `classification` | classification | `RecordFiled.classification` |
| `correspondenceAt` | UtcTimestamp | derived from event recordedAt |

- **Retention:** Banks Act + Reg. Banks 5 years operational; PA / FSCA correspondence 10 years per Joint Standard 1 of 2024 (cyber incidents) and per regulator-specific record-keeping guidance.
- **Access:** governance-seat default; CEO sees all; engineering sees domain-relevant.

### 6.3 Records-of-agent-runs register

| Field | Type | Source |
|---|---|---|
| `runId` | RunId | `AgentRunStarted.body.runId` |
| `agent` | AgentRef | `AgentRunStarted.body.agent` |
| `briefId` | BriefId | `AgentRunStarted.body.briefId` |
| `startedAt` | UtcTimestamp | `AgentRunStarted.recordedAt` |
| `completedAt` | UtcTimestamp \| null | `AgentRunCompleted.recordedAt` |
| `outcome` | outcome \| "in-flight" | derived |
| `deliverableHashes` | Hash[] | `AgentRunCompleted.body.deliverableDocumentHashes` |
| `substrateGapsSurfaced` | string[] | `AgentRunCompleted.body.substrateGapsSurfaced` |
| `substrate` | "agent-runtime" \| "scrooge-coordinated-in-session" | `AgentRunStarted.body.substrate` |

- **Retention:** Banks Act operational records 5 years; longer for runs producing director-decision artefacts (linked Companies Act 7 years).
- **Access:** governance + engineering for own-domain; CEO sees all; Vera and Thandiwe (CAE) read all for assurance.

### 6.4 Document register

| Field | Type | Source |
|---|---|---|
| `documentHash` | Hash | document store |
| `recordId` | RecordId \| null | `RecordFiled` (null if event-cited but not registered) |
| `firstSeenAt` | UtcTimestamp | document store metadata |
| `firstReferencedByEvent` | EventId | first event citing the hash |
| `classification` | classification | from `RecordFiled` (or `agent-internal` default) |
| `format` | string | document store metadata (mime) |
| `size` | number | document store metadata |
| `supersededBy` | RecordId \| null | derived from `RecordFiled.supersedes` chain |

- **Retention:** maximum of any event citing the document. Documents older than every citing event's retention horizon are eligible for redaction events (Phase 4+).
- **Access:** inherits from `RecordFiled.classification`; pre-registered documents default to `agent-internal`.

### 6.5 Feedback register

| Field | Type | Source |
|---|---|---|
| `feedbackId` | FeedbackId | `Feedback.body.feedbackId` |
| `from` | { actor, identity } | `Feedback.body.from` |
| `channel` | channel | `Feedback.body.channel` |
| `subject` | { kind, ref } | `Feedback.body.subject` |
| `classifications` | classification[] | `Feedback.body.classifications` |
| `body` | string | `Feedback.body.body` |
| `bodyDocumentHash` | Hash \| null | `Feedback.body.bodyDocumentHash` |
| `intakeAt` | UtcTimestamp | event recordedAt |
| `routedTo` | AgentRef[] | `Feedback.body.routedTo` |

- **Retention:** depends on classification — directives (7 years per Companies Act); preferences / corrections (5 years operational); questions / praise (1 year operational; permanent index entry).
- **Access:** CEO + recipients see content; governance secretariat (Owen) curates; agent-internal read for own routing.

### 6.6 Briefs / Dispatches register

| Field | Type | Source |
|---|---|---|
| `briefId` | BriefId | `AgentBriefIssued.body.briefId` |
| `issuedTo` | AgentRef | `AgentBriefIssued.body.issuedTo` |
| `issuedBy` | AgentRef | `AgentBriefIssued.body.issuedBy` |
| `title` | string | `AgentBriefIssued.body.title` |
| `directiveDocumentHash` | Hash | `AgentBriefIssued.body.directiveDocumentHash` |
| `priority` | priority | `AgentBriefIssued.body.priority` |
| `status` | "issued" \| "in-flight" \| "delivered" \| "blocked" \| "superseded" | derived |
| `runId` | RunId \| null | first matching `AgentRunStarted` |
| `supersedingBriefId` | BriefId \| null | derived from `BriefSuperseded` |
| `expectedOutputs` | output[] | `AgentBriefIssued.body.expectedOutputs` |
| `issuedAt` | UtcTimestamp | event recordedAt |

- **Retention:** 5 years operational; longer when the brief implements a director decision (linked Companies Act 7 years).
- **Access:** issuing seat + receiving agent + governance secretariat; CEO sees all; Vera reads all for cadence-audit.

### 6.7 Workstreams register

| Field | Type | Source |
|---|---|---|
| `workstreamId` | WorkstreamId | `AgentBriefIssued.body.workstreamId` (group by) |
| `title` | string | first brief in workstream |
| `briefIds` | BriefId[] | all briefs sharing workstreamId |
| `runIds` | RunId[] | all runs against those briefs |
| `decisionIds` | DecisionId[] | decisions emitted by runs in workstream |
| `documentHashes` | Hash[] | documents produced by runs in workstream |
| `status` | "active" \| "complete" \| "blocked" | derived from constituent briefs |
| `firstActivityAt` | UtcTimestamp | min event recordedAt in workstream |
| `lastActivityAt` | UtcTimestamp | max event recordedAt in workstream |

- **Retention:** the workstream entry inherits the longest retention of any constituent record.
- **Access:** governance-seat default; CEO sees all.

## 7. Migration path — Phase 1 scope (focus of this spec)

**Phase 1 lands the substrate spine. Phase 1 does NOT retire the legacy directories.** Dual-render only.

### 7.1 Phase 1 acceptance criteria

1. **All seven event types registered** in `prototype/platform/event-store/event-types.ts` (or successor `events/types.ts` registry) with typed payloads and `make<EventType>()` constructors matching the existing `makeDecisionComment` / `makeCeoDecision` pattern.
2. **`recordCeoDecision`-style helpers** for each new type land in `prototype/runtime/<domain>/record.ts` — `recordAgentBriefIssued`, `recordAgentRunStarted`, `recordAgentRunCompleted`, `recordDecisionRequested`, `recordFeedback`, `recordBriefSuperseded`, `recordRecordFiled`.
3. **Document store live** at `prototype/platform/document-store/`: `local-fs.ts` impl, BLAKE3 hashing, `put` / `get` / `exists` / `metadata` callable from runtime handlers.
4. **Projection runtime derives all seven registers** from events. Lives in `prototype/dashboard/derive.ts` (or a co-located `derive-rms.ts`); each register a named export like the existing `decisionsOpen` / `decisionsResolved`.
5. **Dashboard renders all seven register views** alongside the legacy Owner Inbox / Team Inbox views (dual-render). The Decisions Desk page (§10) overlays the legacy `decisionsOpen` lift onto the new register view; both remain visible until Phase 4.
6. **Round-trip end-to-end**: at least one full chain through the new path with no Owner Inbox / Team Inbox file authored — `AgentBriefIssued → AgentRunStarted → AgentRunCompleted → DecisionRequested → CeoDecision`. Suggested first round-trip: a small Mira (Compliance / RegTech engineer) obligations-register-update brief.
7. **Vera recon pipelines** (§14) pass for the new substrate: orphan-document, dangling-reference, register-event reconciliation, supersession resolution.
8. **Citation gate** (`bun run citation-gate` in prototype/) passes including the seven new event types.

### 7.2 Phase 1 explicitly does NOT

- Retire `Owner Inbox/` or `Team Inbox/` (Phase 4).
- Route all dispatches through events (Phase 2).
- Route all deliverables through events (Phase 3).
- Migrate historical Owner Inbox / Team Inbox files into the event log (never — see §15).

## 8. Phase 2 / 3 / 4 outline

**Phase 2 — Dispatch routing.** All new agent dispatches issue an `AgentBriefIssued` event first; Scrooge-coordinated in-session dispatch is captured by Scrooge emitting the event before the run. The Briefs register becomes the canonical view of dispatched work; Team Inbox files become a *derived render* of the register. Acceptance: zero Team Inbox files authored without a corresponding `AgentBriefIssued` event for one full agent-week. Substrate dependency: agent-runtime per-agent subscription (S8 Phase A2).

**Phase 3 — Deliverable routing.** All new deliverables are stored in the document substrate, referenced by hash from `AgentRunCompleted`. The Owner Inbox view becomes a *derived render* of the Document Register filtered to `recordFiled` events with classification `ceo-only` or `governance-seat`. Frontmatter convention deprecated; replaced by the typed payload of `AgentBriefIssued` / `RecordFiled`. Acceptance: zero Owner Inbox files authored without a corresponding `RecordFiled` event for one full agent-week.

**Phase 4 — Cutover & archive.** Full move: all four directories — `Owner Inbox/`, `Owner Inbox/actioned/`, `Team Inbox/`, and `Team Inbox/actioned/` — move to `archive/` at Phase 4 cutover; no directories stay in-tree. A one-time `RecordFiled` index event captures the bulk-historical context. Dashboard removes the legacy renderers. Frontmatter convention removed. The dashboard reads only registers thereafter. The Owner Inbox feed parser at `prototype/dashboard/derive.ts:879–926` is deleted. Acceptance: dashboard renders identically with all four legacy directories moved to `archive/`. (Archive scope approved as D-RMS-PHASE-4-ARCHIVE-SCOPE, CEO-approved 2026-05-17.)

## 9. Interlock with S8 agent-runtime substrate

S8 (the autonomous-agent runtime — `D-AGENT-RUNTIME-AUTHORIZE`, Atlas (Core banking platform architect)) and RMS share the events spine. The contract surface:

- **S8 emits, RMS projects.** The agent runtime's scheduler subscribes to `AgentBriefIssued` events targeted at the agents it hosts; it emits `AgentRunStarted` on dispatch and `AgentRunCompleted` on completion. RMS's Records-of-agent-runs register projects these. No additional event types are needed for the lifecycle.
- **`AgentEscalation` is `DecisionRequested`.** S8's planned `AgentEscalation` event type is unified with RMS's `DecisionRequested` — the escalation-channel-to-CEO is the `forActor: "CEO"` filter on the Decisions register. Atlas (S8 author) and Atlas (RMS co-author) confirm same human, same intent, one event type.
- **`AgentDecision` (in-scope agent decisions) is a separate type** S8 owns — it's not in RMS Phase 1. S8 emits it, RMS may project it into a Records-of-agent-runs detail row in a later phase.
- **Phase 1 of RMS does not depend on S8 build completing.** Per Principle 7's steady-state-vs-current-substrate clause: until S8 lands, Scrooge-coordinated in-session runs emit RMS events directly (`substrate: "scrooge-coordinated-in-session"` on `AgentRunStarted`). The substrate gap is named, not hidden. When S8 lands, the same events keep flowing — the *emitter* shifts from Scrooge to the runtime; the consumers (registers, recon pipelines, dashboard) don't notice.
- **Identity and signing.** S8's agent identity (zero-trust, per-agent signing key) is the source of `producer` and `signature` on RMS event envelopes when S8 is live. Pre-S8, Scrooge's identity signs them, with `producer: "scrooge-coordinated"` for the audit trail.

## 10. CEO interaction model — Decisions Desk

The CEO's primary view shifts from the Owner Inbox feed to the **Decisions Desk** — the Decisions register filtered to `forActor: "CEO"` and `status: "open"`, sorted by category urgency.

### 10.1 Card render

Each `DecisionRequested` row renders as a card with:

- Title, category chip, owner (with position).
- One-line `decisionForActor`.
- Recommendation (stance + reasoning, two lines).
- Source-document links: clickable links to each `sourceDocumentHash` resolved through the document store.
- Citations chips: clickable to obligations register entries.
- Action row: Approve / Defer / Modify / Request-Revision (the four valid `CeoDecision.action` values, unchanged).

### 10.2 Intake surfaces

Three input modes for the CEO, all emitting `CeoDecision` (or `Feedback`):

- **Keystroke.** Card focused; `a` approve, `d` defer, `m` modify, `r` request-revision; `Enter` confirms; comment field appears as overlay. Shortcut posts to existing dashboard `POST /api/decide` endpoint, which calls `recordCeoDecision()` with the new `requestEventId` field bound to the source `DecisionRequested`.
- **Chip.** UI button on the card; same backing call.
- **Chat-intake.** Marc says "approve D-RMS-PHASE-1" in chat; Scrooge's chat-intake handler emits the `Feedback` event (classification `directive`); a follow-on handler (Scrooge) materialises the `CeoDecision` event. Audit trail: Feedback event → CeoDecision event, both in the log, `recordedVia: "chat:scrooge → ceo-decision-record"`.

### 10.3 Feedback intake

Chat messages that aren't decisions go in as `Feedback`. Scrooge classifies (`directive` / `preference` / `correction` / `question` / `praise` / `concern`) and routes — directives auto-fan into `AgentBriefIssued`; preferences go into the user-memory projection; corrections amend a register row through a `RecordFiled` supersession; questions route to the relevant agent.

### 10.4 Records browser

Side panel: queryable register surface. Filters: register, agent, date range, classification. Rows expand to show events that contributed (full citation chain: row → events → documents → citations → obligations register entries). Read-only.

### 10.5 Wireframe

```
┌─────────────────── Decisions Desk ──────────────────────────────────────┐
│  [substrate-foundational] D-RMS-PHASE-1 · Owen (CoSec) + Atlas (Core)   │
│  Authorise Phase 1 build of the Records Management Substrate.           │
│  Recommendation: Approve as drafted with BLAKE3 + local store.          │
│  Sources: 1 doc (this spec).  Citations: P1, P6, P7, COMPANIES-ACT-S24. │
│  [Approve]  [Defer]  [Modify]  [Request-Revision]                       │
├─────────────────────────────────────────────────────────────────────────┤
│  Records browser ▸  ┌─ Decisions ┐ Correspondence ┐ Runs ┐ Documents ┐  │
│                     │ Feedback   ┐ Briefs        ┐ Workstreams      ┐   │
│                                                                         │
│                     [filter: agent▾] [date▾] [classification▾]          │
└─────────────────────────────────────────────────────────────────────────┘
```

## 11. Agent interaction model

- **Agents subscribe; agents do not poll.** Each agent in the runtime has a typed subscription on `AgentBriefIssued` events where `issuedTo.name == agent.name`. No directory polling. Pre-S8, Scrooge-coordinated in-session dispatch is the substitute, but it still emits the same event so the audit trail is unified.
- **Lifecycle.** On pickup: emit `AgentRunStarted`. On completion: emit `AgentRunCompleted` with `deliverableDocumentHashes` (after `documentStore.put()`-ing each deliverable), `substrateGapsSurfaced` (per the P7 substrate-gap discipline), `citations`, and `followOnRoutes`.
- **Escalation.** When a decision is needed, emit `DecisionRequested` directly — do not file an "Owner Inbox brief" first. The Decisions Desk renders the request without a markdown intermediary. Source documents (the analysis) go in the document store; the event references hashes.
- **Identity discipline.** Every emit pairs `agent.name` with `agent.position` per the cross-cutting CLAUDE.md rule. The event-store envelope's `producer` field carries the same identity. Vera's identity-pairing recon pipeline (already live for chat / decision records) extends to the new event types.

## 12. Owen-specific — records-management governance

### 12.1 Record vs draft

A markdown-in-flight is a **draft** until a `RecordFiled` event registers it. Drafts live in the document store (they have hashes, they are immutable bytes) but are not yet records — they confer no governance authority. A draft becomes a record when `RecordFiled` is emitted; the `recordId` is the canonical citation thereafter, not the document hash.

This distinction matters for: (a) what counts as authoritative for board / regulator purposes; (b) what the retention clock starts on; (c) what the Vera recon pipelines test for completeness.

### 12.2 Supersession, amendment, corrigendum

- **Supersession** — a new record replaces an old one *prospectively*. Emit `RecordFiled` with `supersedes: <oldRecordId>`. The old record remains queryable as historical; current views show the new one.
- **Amendment** — a record is updated in place (rare; only for non-substantive corrections that don't change governance authority). Same mechanism: `RecordFiled` with `supersedes`, but `correctsOriginalErrors: false` and a body-document recording the amendment.
- **Corrigendum** — a substantive correction to a prior record (e.g. a misstatement in a board pack). `RecordFiled` with `supersedes` and `correctsOriginalErrors: true`. The audit trail preserves both versions; the Decisions / Correspondence registers render the corrigendum and link the original.

### 12.3 Access classifications

Five-level classification on every `RecordFiled`:

- `ceo-only` — only the CEO and the issuing agent see content.
- `governance-seat` — full access for governance seats (Helena, Devon, Camille, Eitan, Saskia, Owen, Zara, Iris, Thandiwe, Rashida); CEO; engineering-seat reads metadata only.
- `engineering-seat` — full access for the relevant engineering seat and their governance home; metadata-only outside.
- `agent-internal` — read by issuing and receiving agents only; no human render except via opt-in expansion.
- `public-disclosure` — eligible for external rendering (regulator filings, AGM materials, customer notices, public statements).

Classifications are granted by the issuing agent; Owen (CoSec) governs reclassification. Reclassification is itself an event (`RecordFiled` superseding with new classification).

### 12.4 Records-management policy entry

A one-paragraph policy statement lands in Owen's policy register at Phase 1 close:

> **Records Management Policy (RMP-001).** The bank operates a typed, content-addressed records substrate as the canonical store for all instructions, briefs, deliverables, decisions, correspondence, agent-run records, and CEO feedback. Records are immutable; supersession is by event, not by file replacement. Retention horizons follow the Companies Act 71 of 2008 s.24 (director decisions, 7y), Banks Act 94 of 1990 + Reg. Banks (banking records, 5y / 10y), FIC Act 38 of 2001 s.22-23 (AML/CFT, 5y from termination), and POPIA 4 of 2013 s.14 (personal-information retention, purpose-bound). Access classifications (ceo-only / governance-seat / engineering-seat / agent-internal / public-disclosure) are granted by the issuing agent and governed by the Company Secretary. Continuous-controls assurance over the substrate is performed by the Internal Audit function (Vera, with Thandiwe (CAE) functional supervision).

The full policy document — citations, classifications, supersession discipline, retention schedule, exception handling, breach reporting — lands in the document store at Phase 1 close, registered as a `governance-seat` record under the policy register.

## 13. Atlas-specific — substrate-build slices

Phase 1 breaks into **five slices**, sequenced. Effort framing is in agent-tick units consistent with `D-EVENT-STORE-SCALING` and `D-PRODUCT-CONSTRUCTION-SUBSTRATE`. Each slice is independently shippable.

### Slice 1 — Document store + hashing  (~1 session)

- **Dependencies:** none.
- **Deliverables:** `prototype/platform/document-store/types.ts` (interface), `local-fs.ts` (impl), `hash.ts` (BLAKE3 binding), `prototype/data/documents/` directory. Manifest table `documents` recording `firstSeenAt / size / algo`.
- **Acceptance:** unit tests for `put` idempotency, `get` integrity check, `exists` boolean, `metadata` shape; round-trip a 4KB markdown document; collision-resistance test with 10K random payloads.
- **Observability:** `documentStore.put` / `get` OpenTelemetry spans; counter for unique-hash count.
- **Recon:** integrity-on-read pipeline (re-hash the payload on every `get` in dev mode; fail loudly on mismatch).

### Slice 2 — Event-type registration + record helpers  (~1 session)

- **Dependencies:** Slice 1 (event payloads carry hashes).
- **Deliverables:** seven new entries in `EVENT_TYPE_REGISTRY`; `make<EventType>()` constructors; seven `record<EventType>()` runtime helpers in `prototype/runtime/rms/record.ts` (each modelled on `recordCeoDecision`); extension to `CeoDecisionBody` (`requestEventId`, `recordDocumentHashes`, `modifiedRecommendation`).
- **Acceptance:** each helper validates required fields, appends to event store, returns `{ event, eventId }`; the `CeoDecision` extension is backwards-compatible (legacy events without new fields parse fine); citation gate passes.
- **Observability:** per-helper OpenTelemetry span; counter for emit volume per event-type.
- **Recon:** event-type-registration recon (Vera Wave-3 #11 extension) — every helper has a registry entry; every registry entry has retention metadata; every retention citationRef resolves in the obligations register (Wave-4 #14).

### Slice 3 — Projection runtime for the seven registers  (~1.5 sessions)

- **Dependencies:** Slice 2 (events to project).
- **Deliverables:** `prototype/dashboard/derive-rms.ts` exporting seven projection functions: `decisionsRegister`, `correspondenceRegister`, `agentRunsRegister`, `documentRegister`, `feedbackRegister`, `briefsRegister`, `workstreamsRegister`. Each consumes an event sequence and produces a typed register.
- **Acceptance:** unit tests for each projection (happy-path + supersession + multi-event aggregation); replay-from-zero produces identical registers; existing `decisionsOpen` / `decisionsResolved` derivation sits alongside (dual-render) and produces consistent output for the overlap set.
- **Observability:** per-projection rebuild duration histogram.
- **Recon:** byte-identical-overlap recon — for the overlap set (decisions resolved by both old Owner Inbox lift and new register), the two paths must agree. Vera Wave-4 #16 (planned).

### Slice 4 — Dashboard render (dual-render)  (~1 session)

- **Dependencies:** Slice 3.
- **Deliverables:** seven new dashboard sections (or one tabbed pane) rendering the registers; Decisions Desk page (§10) updated to pull from `decisionsRegister` filtered to `forActor: "CEO" && status: "open"`; legacy Owner Inbox feed remains visible.
- **Acceptance:** wireframe-grade UI live in `prototype/dashboard/server.ts`; keystroke shortcuts work on Decisions Desk; records browser side-panel queryable; legacy view unchanged (no regression on existing Owner Inbox / Decisions render).
- **Observability:** per-route latency for register endpoints.
- **Recon:** UI-snapshot recon compares legacy vs new for the overlap set (dev-mode only).

### Slice 5 — End-to-end round-trip  (~0.5 sessions)

- **Dependencies:** Slices 1–4.
- **Deliverables:** one full chain through the substrate with no Owner Inbox / Team Inbox file authored. Suggested case: Mira (Compliance / RegTech engineer) obligations-register-update brief — Scrooge emits `AgentBriefIssued`, Mira emits `AgentRunStarted`, Mira emits `AgentRunCompleted` with the updated obligation as a document hash, deliverable triggers `DecisionRequested` if a CEO sign-off needed, CEO emits `CeoDecision` via Decisions Desk.
- **Acceptance:** the run renders correctly across all seven registers; recon pipelines pass; a `git grep` for files newly created in Owner Inbox / Team Inbox during the run window returns empty.
- **Observability:** run-trace dashboard view showing the event chain.
- **Recon:** Vera asserts the chain is closed (no orphan brief, no orphan run, no dangling decision).

### Effort envelope

Total Phase 1: **~5 sessions** sequentially; up to 3 parallelisable (Slices 1–3 in parallel after Slice 1 lands the type stubs). Calendar-equivalent: ~1 working week if dispatched immediately on approval; longer if batched alongside competing M-phase work.

## 14. Reconciliation discipline (Vera Wave-4 interlock)

Every register reconciles **bidirectionally** with the events that fed it; supersession events resolve cleanly; orphan documents and dangling references are reportable findings.

Vera recon pipelines that land alongside Phase 1 (sequence agreed with Vera (Internal audit engineer) and Thandiwe (Chief Audit Executive)):

1. **`recon/rms-event-projection-parity`** — for each register, replay events and assert the projection equals the live cache. Fails on any drift.
2. **`recon/rms-orphan-documents`** — every hash in the document store is referenced by at least one event. Orphans are reportable findings.
3. **`recon/rms-dangling-references`** — every `documentHash` in any event resolves to an existing document store entry. Dangling refs are *blocker* findings (read-time integrity violation).
4. **`recon/rms-supersession-resolution`** — every `BriefSuperseded` and `RecordFiled-with-supersedes` resolves to an existing original; cycles forbidden; chains finite.
5. **`recon/rms-citation-coverage`** — every event of the seven new types carries `≥1` citation that resolves in the obligations register. Composes with Wave-4 #14 (retention-citation-coverage) for the `RecordFiled.retention.citationRef` dimension.
6. **`recon/rms-identity-pairing`** — every `agent` field carries a name + position pair that resolves in the team roster (CLAUDE.md). Extension of the existing identity-pairing pipeline to the new event types.
7. **`recon/rms-overlap-parity`** — Phase 1-only — for the overlap set (legacy Owner Inbox lift + new Decisions register), the two paths produce byte-identical output. Retired at Phase 4 cutover.

Each pipeline has a fixture-based unit test, a live-event-store integration test, and a dashboard tile for citation-coverage / orphan-rate / dangling-rate.

## 15. Backwards-compatibility & legacy-migration note

Existing Owner Inbox / Team Inbox files are **not** retroactively re-emitted as events. Reasoning:

- Re-emitting historical events with synthetic `recordedAt` timestamps corrupts the audit trail. The events represent things that happened — the old files represent things that were authored. They are different semantic categories.
- The historical files are queryable as-is; replay-from-zero against today's event log reconstructs all events that *did* happen.

What does happen at Phase 4 cutover:

- One **`RecordFiled` index event** captures the bulk-historical context: a single document (a typed manifest listing every file under all four archived directories — `archive/owner-inbox/`, `archive/owner-inbox/actioned/`, `archive/team-inbox/`, and `archive/team-inbox/actioned/` — with filename, hash, first-seen date, summary), filed under the Document Register with classification `governance-seat` and citation to this Phase 1 spec.
- All four directories (`Owner Inbox/`, `Owner Inbox/actioned/`, `Team Inbox/`, `Team Inbox/actioned/`) move under `archive/` so they remain accessible to historical search but no longer appear in the dashboard's live view. No directories stay in-tree. (D-RMS-PHASE-4-ARCHIVE-SCOPE, CEO-approved 2026-05-17.)
- The Owner Inbox feed parser at `derive.ts:879–926` is deleted at Phase 4 close.

Phase 1 dual-render means: today's Owner Inbox / Team Inbox files continue to render exactly as they do now, alongside the new register views. No file in either directory needs to be touched for Phase 1 to land.

## 16. Open questions for CEO decision

The CEO must resolve the following to authorise Phase 1 build:

1. **Phase 1 scope as drafted: approve / modify?** Recommendation: approve. The spec is sized at ~5 sessions, parallelisable to ~3 calendar; it lands the substrate spine without retiring legacy.
2. **Document-store hash algorithm: BLAKE3 (recommended) / SHA-256 / other?** Recommendation: BLAKE3 with SHA-256 fallback for FIPS-only contexts; algorithm prefix in the hash string makes future swaps non-breaking.
3. **Document-store location pre-Azure-lift: `prototype/data/documents/` (local) — confirm?** Recommendation: confirm, sharded `<algo>/<first-2>/<rest>` layout.
4. **Slice ordering and effort envelope: approve as drafted / re-prioritise?** Recommendation: approve as drafted (Slice 1 → 2 → 3 → 4 → 5).
5. **Owen + Atlas joint authorship for Phase 2-4 specs as they land: approve / route differently?** Recommendation: approve — same dual-author voice for the remaining specs maintains governance + substrate balance.

## 17. Substrate gaps surfaced

1. **Agent-runtime substrate (S8) feed-in not yet built.** Per-agent subscription, scheduler, identity, signing keys are S8 deliverables (`D-AGENT-RUNTIME-AUTHORIZE`). RMS Phase 1 stands alone via Scrooge-coordinated dispatch (P7 fallback) but is leaner once S8 lands. Sequencing: RMS Phase 1 can ship before S8 A2; Phase 2 of RMS depends on S8 A2.
2. **Document-store cloud-lift target (Azure Blob + Managed HSM key envelope).** Needs design pass at M8 alongside the broader cloud-lift. Phase 1 only commits to the local-fs implementation behind a clean interface; the cloud swap is a Phase 1+1 concern.
3. **Per-agent subscription substrate doesn't exist.** Today agents poll filesystems (Team Inbox draining). The runtime substrate (S8 A2) provides this; until then, Scrooge is the dispatcher of record.
4. **Records-management policy not yet in Owen's policy register.** Lands at Phase 1 close per §12.4. The policy is co-authored Owen + Atlas, governance-approved through Owen's standard pathway.
5. **`Feedback` event type is the most novel.** It is the only event of the seven with no current substrate analogue. Today, CEO chat-feedback becomes either a memory entry (`feedback_*.md`), a CLAUDE.md amendment, or an undocumented preference. Capturing it as a typed event raises questions: how granular? what classifies as feedback vs casual chatter? what is the latency budget for chat → event? RMS Phase 1 lands the type and the basic chat-intake handler; the curation discipline matures iteratively.
6. **Memory projection from `Feedback` events.** The user-memory layer (`feedback_*.md` summaries) becomes a Phase 2+ projection of `Feedback` events with `classifications: ["preference"]`. Out of scope for Phase 1.
7. **Cross-event recon at scale.** The seven recon pipelines (§14) are designed for the current event volume (low thousands). At 10M events/year (D-EVENT-STORE-SCALING horizon), they need snapshot + per-pipeline checkpoint state. Sequencing: aligns with `D-EVENT-STORE-SCALING` Slice 3 consumer-adoption pattern.

## 18. Provenance

- **Authorship.** Co-authored Owen (Company Secretary, governance) + Atlas (Core banking platform architect). P7 fallback note: written in-session pending agent-runtime substrate; once S8 A2 lands, this spec's recommendations would themselves arrive as `AgentRunCompleted` deliverables with `deliverableDocumentHashes`. The Phase 1 substrate this spec defines is the substrate that would have authored it.
- **Parent decision request.** CEO directive given in chat ("retire Owner Inbox / Team Inbox as canonical channels; replace with typed Records Management Substrate; produce Phase 1 spec for the engineering substrate to build against"). At Phase 1 close, that directive is captured retroactively as a `Feedback` event (classification: `directive`, channel: `chat`, subject: { kind: "operating-rule", ref: "RMS-PHASE-1-AUTHORIZE" }) so the audit trail is closed.
- **Principle citations.** Principle 1 (events as truth — `prototype/CLAUDE.md` §Principles); Principle 6 (single-graph discipline, downward and upward); Principle 7 (autonomous-by-default, agents-not-mailboxes).
- **Records-retention citations.** Companies Act 71 of 2008 s.24; Banks Act 94 of 1990 + Regulations Relating to Banks; FIC Act 38 of 2001 s.22-23; POPIA 4 of 2013 s.14.
- **Adjacent decisions.** `D-AGENT-RUNTIME-AUTHORIZE` (S8); `D-EVENT-STORE-SCALING` (event store at scale); `D-PRODUCT-CONSTRUCTION-SUBSTRATE` (slice-style substrate authorisation pattern).

—Owen (Company Secretary, governance) + Atlas (Core banking platform architect)
