---
title: RMS Phase 1 Slice 2 — seven event types + record-helpers (S8/RMS overlap disposed)
author: Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
date: 2026-05-10
summary: Second slice of D-RMS-PHASE-1 lands. Seven typed Zod payload schemas + `make<...>` constructors for the RMS event family (`AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`); record-helpers module (`prototype/platform/records/`) that pair document-store puts with event appends; backwards-compatible `CeoDecision` extension surface. S8/RMS overlap disposed per Scrooge ruling — RMS owns records-of-agent-runs types, S8 keeps runtime primitives. 51 tests passing across the two new test files; CI green.
decision-required: false
decision-id: D-RMS-PHASE-1-SLICE-2
decision-category: substrate-foundational
decision-owner: Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
---

# RMS Phase 1 Slice 2 — seven event types + record-helpers

> **Standing authority:** `D-RMS-PHASE-1` (CEO-approved 2026-05-09). Slice authorisation: `D-RMS-PHASE-1-SLICE-2`. No new CEO decision required — this slice executes the substrate the parent decision authorised; per the no-pause rule, downstream slices of an approved decision dispatch without per-item CEO confirmation.
>
> **Spec:** [`Owner Inbox/2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md`](2026-05-09_owen-atlas_records-management-substrate_phase-1-spec.md), §3 (Event type definitions).
>
> **Predecessor:** [`Owner Inbox/2026-05-10_owen-atlas_rms-phase-1-slice-1-document-store.md`](2026-05-10_owen-atlas_rms-phase-1-slice-1-document-store.md) — content-addressed document store + BLAKE3 hashing.

## What landed

Slice 2 freezes the seven RMS event types in the canonical event-store registry and provides record-helper functions that emit them with proper hashing through the Slice-1 document store.

### Files touched / created

| File | Status | Purpose |
|---|---|---|
| `prototype/platform/event-store/event-types.ts` | extended | Seven typed Zod payload schemas + `make<...>` constructors; reusable `rmsAgentRefSchema`; backwards-compatible `ceoDecisionRmsExtendedPayloadSchema`. |
| `prototype/platform/event-store/registry.ts` | extended | New `RMS_EVENT_TYPES` array (5 rows); `AgentRunStarted` / `AgentRunCompleted` envelope-only rows gain typed payloadSchema in-place. |
| `prototype/platform/records/helpers.ts` | created | Record-helpers — pair doc-store puts with event appends (one per type, plus `recordAgentRun` one-shot). |
| `prototype/platform/records/index.ts` | created | Public surface re-export. |
| `prototype/tests/rms-event-types.test.ts` | created | 27 tests covering registry coverage + per-type positive parse + boundary rejection + S8 overlap. |
| `prototype/tests/rms-record-helpers.test.ts` | created | 24 tests covering per-helper round-trip (event → store, document → doc-store, hash consistency). |
| `prototype/scripts/record-d-rms-phase-1-slice-2.ts` | created | CeoDecision-emitter script, idempotent. |

### Event-type catalogue

All seven types follow the existing `eventSchema` envelope (`event_id`, `type`, `as_of`, `entity`, `actor`, `citations`, `payload`). Below summarises the typed payload contract per type.

| # | Type | Replay | Class | Retention | Payload (key fields) |
|---|---|---|---|---|---|
| 1 | `AgentBriefIssued` | pair-coupled | runtime | RUNTIME_1Y | `briefId`, `issuedTo`, `issuedBy`, `title`, `directiveDocumentHash` (BLAKE3), `priority`, `expectedOutputs[]`, optional `workstreamId` / `scheduledFor` / `supersedes` |
| 2 | `AgentRunStarted` | pair-coupled | runtime | RUNTIME_1Y | `runId`, `briefId`, `agent`, `startedAt`, `substrate` (`agent-runtime` / `scrooge-coordinated-in-session`), optional `worktree` |
| 3 | `AgentRunCompleted` | pair-coupled | runtime | RUNTIME_1Y | `runId`, `briefId`, `agent`, `completedAt`, `outcome` (`delivered`/`blocked`/`withdrawn`), `deliverableDocumentHashes[]` (BLAKE3), `substrateGapsSurfaced[]`, `citations[]`, `followOnRoutes[]` |
| 4 | `DecisionRequested` | pair-coupled | runtime | GOVERNANCE_7Y | `decisionId`, `title`, `category`, `owner`, `forActor`, `decisionForActor`, `recommendation`, `sourceDocumentHashes[]`, optional `deadline` / `options[]` |
| 5 | `Feedback` | append-only-audit | runtime | GOVERNANCE_7Y | `feedbackId`, `from`, `channel`, `intakeAt`, `subject`, `body`, optional `bodyDocumentHash`, `classifications[]`, optional `routedTo[]` |
| 6 | `BriefSuperseded` | append-only-audit | runtime | RUNTIME_1Y | `originalBriefId`, `supersededBy`, `reason`, `authorisedBy` |
| 7 | `RecordFiled` | append-only-audit | governance | GOVERNANCE_7Y | `recordId`, `registerKey`, `documentHash` (BLAKE3), `classification`, `retention { citationRef, minimumYears, archivalTier }`, optional `supersedes` / `correctsOriginalErrors` |

The reusable `rmsAgentRefSchema` (`{ name, position, agentId? }`) enforces the identity-discipline rule (CLAUDE.md "Dispatch discipline") at the payload boundary — agent refs missing `position` fail Zod parse.

The `documentHashSchema` validates the format prefix (`blake3:<64-hex-chars>`); the document store remains the source of truth for whether the bytes resolve. Vera's planned `recon/rms-dangling-references` (Slice 2 follow-on) reconciles event-cited hashes against `documentStore.exists()`.

### Record-helpers module

```ts
import {
  recordBriefIssued,
  recordAgentRunStarted,
  recordAgentRunCompleted,
  recordAgentRun,           // one-shot start+complete
  recordDecisionRequested,
  recordFeedback,
  supersedeBrief,
  recordFiled,
} from "@platform/records";
```

Each helper:
- Accepts a typed input + ISO 8601 `asOf` + optional `RecordHelperDeps` (overrides `documentStore` for tests).
- For helpers that materialise a body: puts content into the doc store via `documentStore.put` (idempotent on identical bytes), gets back a `<algo>:<hex>` hash.
- Constructs the typed event via the corresponding `make<Type>(...)` constructor.
- Appends to `eventStore` via the existing composition-root singleton.
- Returns `{ event, eventId, documentHash, isNewDocument }` where applicable; helpers without bodies return `{ event, eventId }`.

The pattern matches `prototype/runtime/decisions/record.ts` (`recordCeoDecision`) — single canonical entry-point per record kind, validates inputs, fans into the typed event constructor, appends to the store. Document-layer idempotency comes for free from BLAKE3 content addressing; event-level idempotency is the caller's contract (matches the existing `recordCeoDecision` shape).

### S8 / RMS overlap disposition

Atlas (Core banking platform architect, engineering) surfaced this overlap during the S8 A0 close-out. Scrooge (Chief of Staff / Orchestrator) ruled, as routing authority over substrate ownership:

- **RMS owns all seven records-of-agent-runs event types**: `AgentBriefIssued`, `AgentRunStarted`, `AgentRunCompleted`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`. They are agent-run *records*, not agent-runtime *primitives*.
- **S8 keeps the runtime primitives**: `AgentRegistered`, `AgentRetired`, `IdentityKeyRotated`, `PermissionPolicyPublished`, `AgentDecision`, `AgentEscalation` family — already in `event-types.ts`, untouched by Slice 2.
- **`AgentRunStarted` / `AgentRunCompleted`** previously sat in `RUNTIME_EVENT_TYPES` as envelope-only rows (A0 freeze §4 #6 / #7). Slice 2 added the typed payload schemas in-place without changing class / issuer / subscribers / replay-rule. Source field updated to cite the joint A0-freeze + RMS-spec provenance.
- **`CeoDecision`** stays substantively complete in `runtime/decisions/record.ts`. Slice 2 publishes a `ceoDecisionRmsExtendedPayloadSchema` with three additive optional fields (`requestEventId`, `recordDocumentHashes`, `modifiedRecommendation`) for Slice 3's projection runtime + future RMS-aware writers; legacy events without these fields continue to validate (they're optional / Zod's `.optional()` allows absence). The schema is published but **not yet wired** into the registry's typed-validation gate — Slice 3 wires it through.

The seven RMS event names do not collide with any S8 type. The exit-criterion test `rms-event-types.test.ts > S8/RMS overlap disposition holds` asserts this.

### Cadence metadata

Per the dispatch brief, Slice 2 may declare `cadence` on `EventTypeMetadata` for high-volume types. We chose **not** to set per-type cadence on any of the seven RMS types in Slice 2 — none of them currently have a known projection state requiring snapshot-cadence tuning. The default cadence (1000 events / 1 hour, per `DEFAULT_SNAPSHOT_CADENCE`) covers the build-phase volume. When Slice 3 lands and projection consumers call `eventStore.shouldSnapshot()`, we revisit per-type cadence; today the defaults suffice.

### Test coverage

51 tests across two new test files (well over the 14-minimum):

- `tests/rms-event-types.test.ts` — 27 tests:
  - 5 registry-coverage tests (all seven registered, each carries typed schema, each carries retention, no S8 collision, no duplicates).
  - 21 per-type schema tests (positive parse + boundary rejection, plus `make<...>()` smoke).
  - 4 `CeoDecision` RMS-extension tests (legacy shape, new fields, invalid action, malformed hashes).
  - 1 sanity (agent-ref constants).
- `tests/rms-record-helpers.test.ts` — 24 tests covering per-helper round-trip plus boundary rejection.

All 51 pass. Full `bun run test` battery: 579/579 tests across 43 files passing. Full `bun run ci`: green (typecheck + lint + tests + 8 recon harnesses + citation-gate). Pre-existing recon warnings (49 agent-spec-cross-link warns; 1 decision-recommendation warn for D-CI-GATE-INTEGRITY; 1 parallel-dispatch-divergence warn waiting for D-A22-RETIRE-LEGACY sample window; 3 retention-citation-coverage warns for `COMPANIES-ACT-71-2008-S24` URN-table gap) are unchanged by Slice 2 — those are existing register / Mira follow-ons, not Slice-2-introduced.

## Substrate gaps remaining (Slices 3-5)

Slice 2 lands the typed event substrate. The remaining slices build on top.

| Slice | Scope | Status |
|---|---|---|
| **Slice 3** — Projection runtime for the seven registers | `prototype/dashboard/derive-rms.ts` exporting seven projections: Decisions, Correspondence, Records-of-agent-runs, Document, Feedback, Briefs, Workstreams. Wires `ceoDecisionRmsExtendedPayloadSchema` into the registry's typed-validation gate so `requestEventId` / `recordDocumentHashes` / `modifiedRecommendation` parse-on-append. | Pending. |
| **Slice 4** — Dashboard render (dual-render) | Seven new dashboard sections rendering the registers; Decisions Desk page; legacy Owner Inbox feed remains visible. | Pending. |
| **Slice 5** — End-to-end round-trip | One full chain through the substrate with no Owner Inbox / Team Inbox file authored. Suggested case: Mira (Compliance / RegTech engineer) obligations-register-update brief. | Pending. |

Other gaps surfaced by this slice:

1. **No Vera recon pipelines for RMS yet.** Spec §14 lists seven (`recon/rms-event-projection-parity`, `recon/rms-orphan-documents`, `recon/rms-dangling-references`, `recon/rms-supersession-resolution`, `recon/rms-citation-coverage`, `recon/rms-identity-pairing`, `recon/rms-overlap-parity`). All depend on either projections (Slice 3) or end-to-end events flowing (Slice 5). The `rms-overlap-parity` recon — asserting that the seven RMS types and the S8 runtime primitives remain non-overlapping — is the cheapest to build first; it can land without Slice 3 (suggested for the Slice 3 PR).
2. **Event-level idempotency is the caller's contract.** The helpers do not deduplicate event appends — re-running `recordBriefIssued` with the same `briefId` and identical body returns the same `documentHash` (idempotent at the doc-store layer) but emits a *new* `AgentBriefIssued` event each call. This matches `recordCeoDecision`'s shape; the `recordCeoDecision` script demonstrates the pattern (replay the store, skip if `decisionId` already recorded). Slice 3 / Slice 5 callers wire that pattern explicitly when needed.
3. **`recordCeoDecision` does not yet emit the new RMS fields.** The existing helper in `runtime/decisions/record.ts` is unchanged — Slice 2 publishes the extended schema as a contract for future writers. Slice 3 (projection runtime) decides whether to extend `recordCeoDecision` or have the dashboard's `/api/decide` populate the new fields directly. Either path preserves the additive / backwards-compatible posture.
4. **No OpenTelemetry spans on the helpers yet.** Spec §5 calls for them on `documentStore` `put` / `get`; Slice 2's helpers add a wrapping operation but the tracing wrap-up belongs with the substrate observability slice (out of scope for Slice 2).

## Provenance

- **Authorship.** Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering). Atlas leads the implementation files; Owen leads the records-management framing in this provenance and the S8/RMS overlap framing.
- **Parent decision.** `D-RMS-PHASE-1`, CEO-approved 2026-05-09, action `approve`, recorded in `Owner Inbox/actioned/2026-05-09_ceo-decisions-export.md`. The standing authority covers Phase 1 build sequencing including this slice.
- **Slice authorisation.** `D-RMS-PHASE-1-SLICE-2`, recorded by `prototype/scripts/record-d-rms-phase-1-slice-2.ts` (companion script committed alongside this record).
- **S8/RMS overlap disposition.** Scrooge ruling, 2026-05-10, communicated via the dispatch brief; embedded in `event-types.ts` block-comment, `registry.ts` `RMS_EVENT_TYPES` block-comment, the in-place updates to the existing `AgentRunStarted` / `AgentRunCompleted` rows, and asserted in `tests/rms-event-types.test.ts > S8/RMS overlap disposition holds`.
- **Citations.** Spec §3 (Event type definitions), §3.1–§3.8 (per-type contracts), §3.5 (CeoDecision additive extension), §3.9 (citation discipline); Principle 1 (events as truth — payload schemas validate at parse time); Principle 2 (every event carries citations — helpers require non-empty `citations`); Principle 7 (autonomous-by-default — `substrate: "agent-runtime" | "scrooge-coordinated-in-session"` makes the build-phase fallback explicit in the payload).

—Owen (Company Secretary, governance) + Atlas (Core banking platform architect, engineering)
