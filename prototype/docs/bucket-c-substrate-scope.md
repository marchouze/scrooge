# Bucket C — dispatch / RMS / runtime / governance substrate: V2-migration scope + pilot design

**Author:** Atlas (Core banking platform architect, engineering)
**Workstream:** WS-V2-MIGRATION-BUCKET-C
**Authority:** `D-BANK-WIDE-V2-MIGRATION` (CEO-approved 2026-06-16); Marc "continue as recommended", 2026-06-17.
**Charter:** `D-ENGINEERING-INTEGRITY-CHARTER` ([`Engineering-Charter.md`](../../Engineering-Charter.md)).
**Status:** SCOPING + DESIGN. No production code, no flips, no new types, no ratchet change. This note is a render of the intended work, not the work.

> **One-line answer.** Bucket C is **197 unique event types** (the orchestration substrate), almost entirely **money-free control-plane** types that take the proven **store-tee verbatim + parity + flip** path. **14** of them are **load-bearing for live dispatch** and must be migrated last, behind their RMS-parity gates, with the dispatch CLIs left emitting V1 throughout. The recommended pilot is **`AgentPerformanceEvaluated` + `AgentFeedbackIssued` (the agent-performance domain)** — money-free, seat-run-emitted, read by the dashboard only, never touched by the dispatch CLIs. The single biggest blast-radius risk is **flipping a run-lifecycle type (`AgentRunStarted`/`AgentRunCompleted`/`AgentRunFailed`) while the dispatch CLIs still write V1** — that desynchronises the machinery Scrooge uses to dispatch. The shared `MoneyWire` primitive **should be relocated** to a canonical `v2-core/core/money-wire.ts` as part of C (it is no longer A2-specific).

---

## 0. Method (how the numbers were derived)

- Imported `EVENT_TYPE_REGISTRY` (`platform/event-store/registry/index.ts`), filtered `v2Status === "v1-only"`.
- **469 rows**, but only **462 unique `type` names** — **7 duplicate rows** all live in `missing-types.ts` and shadow a canonical row elsewhere (`AuditIssueOpened`, `AuditIssueClosed`, `SettlementInstructionReceived`, `PaymentInitiated`, `PaymentSettled`, `ReconciliationBreak`, `IntradayHQLAStressProjection`). The `recon:v1-removal-ratchet` baseline counts **rows** (`v1OnlyCount: 469` in `v1-removal-ratchet.json`), so each de-dup or flip moves the row count, not the unique-type count. **This duplication is itself a finding (§7.6).**
- Mapped each type to its defining registry file by scanning every `platform/event-store/registry/*.ts` for `type: "X"`.
- Classified each unique type into **C (substrate)** / **B (financial-FIL)** / **residual**, then confirmed money-bearing status by scanning the backing schema modules in `platform/event-store/event-types/*.ts` for money fields (`*Minor`, `minorUnits`, `MoneyWire`, `notional`).

Counts on **unique types**:

| Bucket | Count | What it is |
|---|---|---|
| **C — substrate** | **197** | dispatch / RMS / runtime / governance-process / control / HR / security / legal-privacy process events |
| **B — financial-FIL** | **265** | trading / risk / GL / liquidity / settlement / repo / ODP / conduct-money — flips DEFERRED to licence-day (data-empty) |
| residual money-free not yet swept | **0** | all money-free reference/governance-attestation already swept (Wave-2 batches); nothing falls outside C or B |
| **Total unique v1-only** | **462** | (469 registry rows − 7 duplicate rows) |

The prior loose estimate was "~140". The real bucket-C figure is **197** — the gap is the ~98 process events that live inside `missing-types.ts` (HR, CISO/security, legal, privacy/POPIA, AML-process, readiness snapshots) which are substrate, not financial, and were not visible from the headline `missing-types.ts (~160)` count alone.

---

## 1. Precise bucket-C inventory (197 unique types)

Bucket C is sourced from three registry files plus the process-event subset of `missing-types.ts`:

| Source file | Bucket-C types | Notes |
|---|---|---|
| `governance.ts` | 68 | RMS registers, governance-process, party, product-lifecycle, readiness, agent-performance |
| `missing-types.ts` | 98 | HR, CISO/security, legal, privacy/POPIA, AML-process, audit-process, readiness snapshots, runtime-process |
| `runtime.ts` | 31 | agent lifecycle, run lifecycle, escalation, goal-loop, substrate alerts, bus |

By `class`: governance 99, runtime 51, audit 40, markets 7 (the 7 `markets`-class rows in `missing-types.ts` that are operational not financial — e.g. `CutOffBreach`, `LeadCaptured` — classified into C by name/semantics).

### 1.1 Sub-class breakdown + load-bearing flag

All bucket-C types are **control-plane** (they belong on the W0 general host `v2_events` store, NOT a financial authoritative store) and all are **money-free** (confirmed: no money field in `agent-ops.ts`, `performance.ts`, `governance.ts`, `runtime.ts`, `rms.ts`, `agent.ts`, `decision.ts`, `audit.ts`, `ciso-governance.ts`, `cae-governance.ts`, `legal-entity.ts`, `legal-documentation.ts`, `aml-popia-extended.ts`, `customer.ts`, `governance-extended.ts`, `governance-snapshots.ts`, `risk.ts:RasLineCalibrated`). The money in this neighbourhood (RAS floor) already migrated under bucket A in `V2RiskAppetiteSet` (#1404).

| Sub-class | Representative types (registry file) | Control-plane | Money | **Load-bearing for live dispatch?** |
|---|---|---|---|---|
| **C-1 RMS registers** | `AgentBriefIssued`, `RecordFiled`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `Decision`, `DocumentRegistered`, `DecisionComment` (governance.ts) | `v2_events` | free | **YES** — emitted/replayed by the dispatch CLIs (`open-brief` replays `AgentBriefIssued`; `close-run` emits run-lifecycle + reads briefs); gated by `recon:rms-briefs-parity`, `recon:rms-documents-parity` |
| **C-2 run lifecycle** | `AgentRunStarted`, `AgentRunCompleted`, `AgentRunFailed`, `SubstrateAgentRunStarted/Completed/Failed`, `WorkstreamStarted/Completed/Registered`, `ReconResult` (runtime.ts / governance.ts) | `v2_events` | free | **YES** — `dispatch:start-run` / `dispatch:close-run` emit these via `recordAgentRunCompleted`; `recon:dispatch-sync-integrity` reviewer→decider topology depends on their shape |
| **C-3 agent lifecycle / escalation / goal-loop** | `AgentRegistered`, `AgentRetired`, `IdentityKeyRotated`, `PermissionPolicyPublished`, `AgentEscalation*`, `AgentGoal*`, `ScheduledTrigger`, `BusDispatched`, `SubstrateAlert` (runtime.ts) | `v2_events` | free | partial — `ScheduledTrigger`/`SubstrateAgentRun*` are substrate-emitted by the runtime, not the CLIs; safe to migrate once C-1/C-2 patterns are proven, but `SubstrateAlert` is emitted by the store-tee itself on divergence (§4.3) |
| **C-4 governance-process** | `BankModePolicySet`, `CeoDecision`, `AuditFinding`, `AuditFindingClosed`, `ProvenanceReclassified`, `EntityReclassified`, `CitationGate(Passed/Failed)`, `RasLineCalibrated`, `MLROAttestation`, `ObligationRegistered`, `*ProjectionRefreshed`, all `*Snapshot` (governance.ts) | `v2_events` | free | no |
| **C-5 party / product-lifecycle** | `PartyRegistered`, `PartyClassified`, …, `ProductProposalRegistered`, `ProductApproved`, `ProductLaunched`, … (governance.ts) | `v2_events` | free | no |
| **C-6 HR / agent-ops** | `HireConfirmed`, `Termination`, `LeaveGranted`, `DisciplinaryActionRequested`, `AgentCapabilityChanged`, `PersonaSpecChanged`, `TokenUsageRecorded`, `MandateGapDetected`, `RoleResearch*` (missing-types.ts) | `v2_events` | free | no |
| **C-7 CISO / security-process** | `SecurityIncidentRaised`, `KeyRotationDue`, `DependencyVulnDetected`, `SBOMRequired`, `KeyCeremonyScheduled`, `ThreatModelGateDecision`, `CyberResilienceSnapshot`, … (missing-types.ts) | `v2_events` | free | no |
| **C-8 legal / privacy-process** | `LegalDocumentationSigned`, `ContractDraftRequested`, `SignatureRequested`, `DSARReceived/Closed/Extended`, `ConsentWithdrawn`, `POPIAControlsSnapshot`, … (missing-types.ts) | `v2_events` | free | no |
| **C-9 audit-process / readiness** | `IncidentRaised`, `ResilienceTestResult`, `*ReadinessSnapshot`, `WhistleblowingDisclosure`, `ReconciliationBreak` (missing-types.ts) | `v2_events` | free | no |
| **C-10 agent-performance** | `AgentPerformanceEvaluated`, `AgentFeedbackIssued`, `AgentEfficiencyAdvisoryIssued`, `AgentPromptOptimizationApplied` (governance.ts / runtime.ts) | `v2_events` | free | no — **pilot domain (§3)** |

### 1.2 The 14 load-bearing dispatch types (the careful set)

These are the ONLY bucket-C types whose V1 form is consumed by the dispatch CLIs / run-recon / RMS-parity gates. They are migrated **last** (§4):

`AgentBriefIssued`, `DecisionRequested`, `Feedback`, `BriefSuperseded`, `RecordFiled`, `Decision`, `DocumentRegistered`, `ReconResult`, `WorkstreamRegistered`, `WorkstreamStarted`, `WorkstreamCompleted`, `AgentRunStarted`, `AgentRunCompleted`, `AgentRunFailed`.

Evidence of load-bearing:
- `scripts/dispatch/open-brief.ts` — replays `{ type: "AgentBriefIssued" }` for dedup and emits the brief (`AgentBriefIssuedPayload` from `platform/event-store/event-types`).
- `scripts/dispatch/close-run.ts` — emits `AgentRunCompleted` via `recordAgentRunCompleted`, enforces the `D-DISPATCH-SYNC-PRIMITIVE` reviewer→decider block, and refuses delivery unless every reviewer run has a matching closing event.
- `recon:rms-briefs-parity`, `recon:rms-documents-parity`, `recon:dispatch-sync-integrity` all read these events' V1 shape.

---

## 2. Migration mechanics per sub-class

The Wave-2 generic store-tee (`platform/event-store/v2-store-tee.ts`) is the engine. Onboarding a type is a **registry edit, not a callsite edit**: add a `tee` block to the type's `V2_EVENT_TYPE_REGISTRY` row (`v2-core/registry/index.ts`), add a parity gate, run the generic backfill once, then flip. Live emit sites are untouched until the flip. Three paths apply to bucket C:

### 2.1 Money-free control-plane → store-tee VERBATIM (the posture/refdata pattern) — **applies to 100% of bucket C (197/197)**

This is the dominant path. Pattern (proved by `posture`, the four reference-data domains, govAtt batches, and money-free-batch-3):

1. **Register a v2-core row** with `tee: {}` (verbatim codec — `VERBATIM_CODEC`). The tee mirrors every V1 append into the W0 general host `v2_events` store, reusing the V1 `event_id` as the idempotency key (`INSERT OR IGNORE` — replay-safe).
2. **Backfill once** via the generic backfill (the posture pilot's `scripts/backfill-posture-v2-dual-run.ts` generalised). Dual-write + backfill in one script.
3. **Parity gate** — a `ParitySpec<S>` on `platform/recon/v1-v2-parity-harness.ts` asserting byte-equivalence of the V1 payload vs the v2-mirrored payload (the `posture-v2-parity` shape). For verbatim, parity is byte-identical.
4. **Flip** — once parity is byte-clean over the full recorded population, change `v2Status` `v1-only → v2-replaced`, move the parity gate advisory→enforcing, and lower the ratchet baseline (`v1-removal-ratchet.json`) by the number of **rows** flipped.

Because bucket C is control-plane, there is no MoneyWire codec and no authoritative-store split: every type lands on the single W0 general host (`tenantId` rides the provenance tag, not a column — control-plane is single-store / anchor-tenant).

### 2.2 Money-bearing → control-plane MoneyWire codec — **applies to 0 bucket-C types**

No bucket-C type carries money (confirmed §1.1). The MoneyWire path (`tee: { codec }`, `moneyWireSchema` + `moneyWireFromMajorString`) is **not exercised within C**. It remains the path for any future money-bearing control-plane row and for bucket-B/licence-day work.

**Recommendation on the shared MoneyWire primitive (relocate? — YES):** `v2-core/bucket-a-a2/money-wire.ts` is mis-located. Its own doc-comment already calls `moneyWireSchema` "the REUSABLE control-plane money primitive" used by `V2RiskAppetiteSet.floor` (a bucket-A *non*-A2 type, #1404) and the batch-A2 mirrors. It is no longer A2-specific. As **part of bucket C** (a low-risk, doc-and-import-only move), relocate it to **`v2-core/core/money-wire.ts`** (creating the canonical `v2-core/core/` directory the brief anticipates), keeping a thin re-export shim at the old path for one cycle to avoid a big-bang import churn, then deleting the shim once callers move. This is a pure refactor (no behaviour change, no flip) and belongs in C because C is the wave that establishes the canonical control-plane layout. **Caveat:** it touches a shared-infra file imported by bucket-A codecs and `V2RiskAppetiteSet`, so it must be a standalone PR (not bundled with a flip) to keep the blast radius of a flip PR minimal (§4.4).

### 2.3 Un-emittable `*Minor` → retired-by-construction (RwaComputed / OperationalLossEvent pattern) — **applies to 0 bucket-C types**

No bucket-C type is an un-emittable legacy `*Minor`. This path stays a bucket-B/decimal-native tool. Noted for completeness; not used in C.

**Net:** bucket C is a single-path wave — **store-tee verbatim** for all 197 types. That is what makes it tractable despite the high blast radius; the risk is entirely in **ordering**, not in codec complexity.

---

## 3. Recommended pilot — `AgentPerformanceEvaluated` + `AgentFeedbackIssued` (agent-performance domain, C-10)

**Why this is the lowest-blast-radius bucket-C pilot:**

- **Money-free** (confirmed in `performance.ts` — no money field) → verbatim codec, no MoneyWire dependency.
- **Self-contained domain** — emitted by governance-seat eval runs (W8 agent-learning), read **only** by the dashboard performance tile. It is NOT replayed or emitted by any dispatch CLI, NOT in the run-lifecycle, NOT behind an RMS-parity gate. A flip cannot desync the dispatch substrate.
- **Already has a v2-core foothold neighbourhood** (the W8 posture/eval rows in `v2-core/eval` and `v2-core/posture`), so the parity gate slots next to existing W8 recon with minimal new wiring.
- **Small, bounded population** — a handful of seat-run evaluations, so byte-clean parity over the full recorded population is cheap to assert (the posture pilot proved 46==46; this is the same shape at smaller N).

The pilot establishes the **bucket-C substrate pattern end-to-end** (register `tee: {}` → generic backfill → `recon:agent-performance-v2-parity` → flip `v1-only → v2-replaced` → ratchet −N rows) on a type whose failure mode is "a dashboard tile reads stale data", not "Scrooge can't dispatch". Everything in C-3 through C-10 then follows the identical recipe.

**Fallback pilot if a smaller scope is wanted:** a single readiness-snapshot type (e.g. `CyberResilienceSnapshot`, C-9) — append-only, dashboard-read, zero dispatch coupling. Even lower blast radius but less representative (snapshots are simpler than paired events).

---

## 4. Sequencing + blast-radius plan (live dispatch never breaks mid-flight)

The cardinal rule: **the dispatch CLIs (`open-brief`/`start-run`/`close-run`) keep writing the V1 store as authoritative throughout the entire wave.** The store-tee mirrors V1→v2; nothing in C asks the CLIs to write v2. A "flip" changes `v2Status` and the ratchet — it does NOT change where the CLIs write. The ordering protects against the one way this can still go wrong: flipping a load-bearing type's parity gate to enforcing while V1 emission and v2 mirror are out of step.

### Wave order

1. **C-prep (no flips):** relocate `MoneyWire` to `v2-core/core/money-wire.ts` (§2.2) as a standalone PR; resolve the 7 duplicate `missing-types.ts` rows (§7.6) as a standalone PR (de-dup lowers the ratchet by 7 rows for free and removes a parity-ambiguity hazard before any flip).
2. **C-pilot:** agent-performance domain (§3). Prove the recipe.
3. **C-bulk, non-load-bearing (C-4..C-10, ~183 types):** batch by domain the way Wave-2 batched money-free domains — governance-process, party/product, HR, CISO, legal/privacy, audit/readiness, agent-lifecycle (C-3 minus the tee-emitter). Each batch: register `tee: {}`, backfill, parity, flip. These have **zero dispatch coupling**, so they can flip in any order, in parallel batches, without risk to the CLIs. Watch only for shared-infra collisions (§4.4).
4. **C-RMS-and-run-lifecycle LAST (the 14 load-bearing types, §1.2):** migrate these only after the recipe is battle-tested on ~183 types. For each, the tee mirrors V1→v2 verbatim while the CLIs still write V1; the parity gate (`rms-briefs-parity`, `rms-documents-parity`, plus a new run-lifecycle parity) must be **byte-clean and enforcing** *before* the flip; the flip is `v2-status`-only and changes nothing about CLI write paths. The CLI cutover to read/write v2 is a **separate, later workstream** explicitly out of scope here (and gated on Scrooge, who owns the run lifecycle).

### 4.1 Types that must be done last / most carefully

The 14 in §1.2. Within them, the run-lifecycle trio (`AgentRunStarted`/`AgentRunCompleted`/`AgentRunFailed`) is the most delicate because `recon:dispatch-sync-integrity` asserts the reviewer→decider topology on their shape, and `close-run` emits them live — a flip while a long-running dispatch is mid-flight is the worst-case window.

### 4.2 The one type whose migration could change dispatch-CLI behaviour Scrooge depends on

`AgentBriefIssued`. `open-brief` **replays** `{ type: "AgentBriefIssued" }` to dedup before emitting. If a flip ever rewired the CLI's replay to read the v2 store (out of scope here, but the natural next step), a v1↔v2 divergence would make the CLI either double-emit or wrongly skip a brief. **Mitigation:** in bucket C the CLI replay stays on V1; the v2 mirror is read-only/derived. The CLI-read cutover is deferred and must carry its own decision + a green run-lifecycle parity gate.

### 4.3 Store-tee self-reference hazard

`SubstrateAlert` (C-3) is the event the store-tee itself emits on a mirror divergence (`alertClass:"integrity", severity:"high"`). Migrating `SubstrateAlert` through the same tee is safe (the tee emits the alert into the **V1** store, which is then mirrored like any other type) but must be sequenced after the pilot proves the tee is stable, to avoid a feedback-confusing window. Flag, not blocker.

### 4.4 Shared-infra collisions (the deterministic ones)

Parallel C batches that touch the same files collide deterministically (per Dispatch discipline "Concurrency on shared files"):
- `v2-core/registry/index.ts` (`V2_EVENT_TYPE_REGISTRY`) — every batch edits it. Serialise registry edits or resolve manually + run `recon:runtime-handler-sync`.
- `v1-removal-ratchet.json` — every flip lowers the baseline; concurrent flips race on the same JSON. One flip-PR at a time, or rebase-then-recompute.
- ~~`scripts/migrate/backfill-triage-log.md` — `ci:migrate` rewrites it; `git checkout --` before commit/push~~ — **resolved:** the triage log now writes to gitignored `.local/` and is no longer tracked, so `ci:migrate` cannot dirty the tree (Engineering Charter cmd 9).
- `platform/event-store/v2-store-tee.ts` codec switch + `v2-core/registry` codec map — verbatim batches don't touch the codec map, so this collision is avoided in C (no money codecs).
- provenance-category — control-plane events must be in `provenance-category.ts` or the seed marks them `simulated`/scenario-required (the S3 posture gotcha). Each new tee'd type must be confirmed present there before backfill, else parity passes vacuously on a mis-categorised seed.

---

## 5. Honest gaps / risks

1. **Data-empty PASS-on-empty (the dominant risk).** Build-phase has **no live customers/trades**, and many bucket-C process domains (HR, legal, privacy DSAR, several readiness snapshots) have **zero or near-zero recorded events**. A byte-clean parity over an empty population is **vacuously green** — it proves the wiring, not the codec on real data. Mitigation: for verbatim this is acceptable (verbatim is identity — there is no codec to get wrong), but the design note must record each empty-population flip as a `tracked` gap so it is re-validated when data lands at licence-day. This mirrors the bucket-B "WIRED but flip DEFERRED" honesty. **For C the recommendation is: flip the verbatim types anyway (identity codec is safe on empty)** but tag the empty ones so Vera can re-assert at first real append.
2. **Load-bearing types cannot have their V1 form retired without a CLI change.** Flipping `v2Status` to `v2-replaced` for the 14 dispatch types is safe (it only re-tags + lowers the ratchet); but the CLIs still **emit/replay V1**. "V1-removed" in the literal sense (deleting the V1 emit path) is **out of scope** and blocked on a separate Scrooge-owned dispatch-CLI cutover + a green run-lifecycle parity gate. The note must not claim these are "done" beyond the mirror+parity+status-flip; claiming full V1 retirement would be a Charter cmd-3 ("no green by concealment") violation.
3. **Ratchet rows vs unique types.** The ratchet counts 469 **rows**; bucket C is 197 **unique types** but more rows once duplicates and multi-row types are counted. Every flip PR must compute the exact **row** delta it removes and lower `v1-removal-ratchet.json` by that, not by the unique-type count — else CI fails or the ratchet under-hardens.
4. **The 7 duplicate `missing-types.ts` rows (§0).** They make parity ambiguous (which row's `v2Status` governs?). De-dup them in C-prep **before** any flip touches those names.
5. **`SubstrateAlert` self-reference (§4.3)** and **`ScheduledTrigger`/`SubstrateAgentRun*` substrate emission** — runtime-emitted, not CLI-emitted; safe but sequence after pilot.
6. **provenance-category vacuous-pass (§4.4)** — a tee'd type missing from `provenance-category.ts` seeds as `simulated`, making parity pass on a degenerate seed. Confirm category membership per type before backfill.

---

## 6. Definition of Done for bucket C (per the Charter)

A bucket-C type is *done* when: (a) its v2-core row carries `tee: {}`; (b) the generic backfill has mirrored its full recorded V1 population (reusing V1 `event_id`); (c) a parity gate asserts byte-equivalence and is **enforcing**; (d) `v2Status` is `v2-replaced`; (e) the ratchet baseline is lowered by the exact row delta; (f) full `bun run ci` is EXIT 0 on a clean store; (g) any empty-population flip is recorded as a tracked gap for licence-day re-validation. The **wave** is done when all 197 are flipped AND the deferred dispatch-CLI cutover for the 14 load-bearing types has its own decision recorded (not built here).

---

## 7. Appendix — full bucket-C type list by sub-class

*(Derived from `EVENT_TYPE_REGISTRY` filtered `v2Status === "v1-only"`, classified by registry file + semantics. Load-bearing types marked **[LB]**.)*

- **C-1 RMS registers (governance.ts):** AgentBriefIssued **[LB]**, RecordFiled **[LB]**, DecisionRequested **[LB]**, Feedback **[LB]**, BriefSuperseded **[LB]**, Decision **[LB]**, DocumentRegistered **[LB]**, DecisionComment.
- **C-2 run lifecycle (runtime.ts / governance.ts):** AgentRunStarted **[LB]**, AgentRunCompleted **[LB]**, AgentRunFailed **[LB]**, SubstrateAgentRunStarted, SubstrateAgentRunCompleted, SubstrateAgentRunFailed, WorkstreamRegistered **[LB]**, WorkstreamStarted **[LB]**, WorkstreamCompleted **[LB]**, ReconResult **[LB]**.
- **C-3 agent lifecycle / escalation / goal-loop (runtime.ts):** AgentRegistered, AgentRetired, IdentityKeyRotated, PermissionPolicyPublished, AgentEscalation, AgentEscalationAcknowledged, AgentEscalationDecided, AgentEscalationDelegated, AgentEscalationOverdue, AgentDecision, AgentDecisionRequired, AgentGoalEvaluated, AgentGoalSelected, AgentGoalDeferred, ScheduledTrigger, BusDispatched, SubstrateAlert, LegacyFanoutShadowed, RiskRaised, RiskResolved, RiskAccepted, RiskMitigated.
- **C-4 governance-process (governance.ts):** BankModePolicySet, CeoDecision, AuditFinding, AuditFindingClosed, ProvenanceReclassified, EntityReclassified, CitationGatePassed, CitationGateFailed, RasLineCalibrated, MLROAttestation, ObligationRegistered, ObligationsRegisterSnapshot, M1CitationTrancheRegistered, GovernanceCyclePrep, InboxHygieneSweep, MarketsProjectionRegistered, MarketsProjectionRefreshed, DashboardProjectionRefreshed, DataProjectionSnapshot, SubstrateStateSnapshot, SecuritySubstrateSnapshot, ThreatModelDimensionRegistered, SecurityGateRegistered, SemanticLayerQuantityRegistered, AccountingReadinessSnapshot, AgentOpsReadinessSnapshot.
- **C-5 party / product-lifecycle (governance.ts):** LegalEntityRegistered, LegalEntityChanged, IntraGroupArrangementSigned, PartyRegistered, PartyAttributeChanged, PartyClassified, PartyDeclassified, PartyScreeningCompleted, PartyRelationshipAsserted, PartyRelationshipChanged, PartyRelationshipRevoked, BeneficialOwnerChainAsserted, PartyDeactivated, ProductProposalRegistered, ProductConceptualised, ProductDueDiligenceCompleted, ProductDueDiligenceWithheld, ProductDimensionAttested, ProductApproved, ProductWithheld, ProductLaunched, ProductPostImplementationReviewCompleted, ProductReviewCompleted, ProductRetired, ProductVersionPublished, ProductPostApprovalFinding, ProductDimensionRetrospectiveReview, ProductDimensionNarrativeRequested, ProductDimensionNarrativeRecorded.
- **C-6 HR / agent-ops (missing-types.ts):** HireConfirmed, Termination, LeaveGranted, DisciplinaryActionRequested, RoleBriefDelivered, AgentCapabilityChanged, PersonaSpecChanged, TokenUsageRecorded, MandateGapDetected, RoleResearchRequested, RoleResearchQueueSnapshot.
- **C-7 CISO / security-process (missing-types.ts):** SecurityIncidentRaised, KeyRotationDue, DependencyVulnDetected, SuspiciousAuthEvent, SBOMRequired, SBOMAcceptanceRequired, MergeRequested, KeyCeremonyScheduled, VendorSecurityReview, RegulatorCyberInquiry, ThreatModelGateDecision, ThreatModelExceptionRequested, CyberResilienceSnapshot, OperationalResilienceSnapshot, EventSchemaProposal, EventSchemaPublished, IdentityPermissionChangeProposal, ChangeApprovalRequested, SLOBudgetBurn, CapacityBreach.
- **C-8 legal / privacy-process (missing-types.ts):** LegalDocumentationSigned, JurisdictionalOpinionRefreshed, LegalEntityChange, ContractDraftRequested, ClauseChangeProposed, SignatureRequested, ECTAExceptionFlagged, MOIChangeProposed, ConflictDeclared, ResolutionRequired, DSARReceived, DSARClosed, DSARExtended, NewProcessingPurposeProposed, ConsentWithdrawn, CrossBorderTransferRequested, InformationRegulatorInquiry, POPIAControlsSnapshot, PersonalInformationCompromiseSuspected.
- **C-9 audit-process / readiness / regulator-process (missing-types.ts):** IncidentRaised, ResilienceTestResult, ReconciliationBreak, WhistleblowingDisclosure, ExternalAuditorInquiry, AuditCommitteePackPrepped, PolicyChange, PolicyChange-adjacent (RiskPolicyChange, RiskPolicyChangeProposal), RegulatorRequest, RegulatorInquiry, SupervisoryLetterReceived, RegulatoryInstrumentUpdate, SARSGuidanceUpdate, SchemeRuleChange, CSPAttestationDue, ALMReadinessSnapshot, MarketsReadinessSnapshot, PaymentsReadinessSnapshot, LegalReadinessSnapshot, TaxReadinessSnapshot, CutOffBreach.
- **C-10 agent-performance (governance.ts / runtime.ts) — PILOT:** AgentPerformanceEvaluated, AgentFeedbackIssued, AgentEfficiencyAdvisoryIssued, AgentPromptOptimizationApplied.

> Sub-class boundaries are an authoring aid for batching, not a registry field. The authoritative classifier is `v2Status === "v1-only"` + the registry file + the money-free confirmation in §1.1. A few process types (`SanctionsListPublished`, `PepListPublished`, `AdverseMediaPublished`, `TaxClassificationPublished`, customer-onboarding-process events) sit on the C/B boundary as reference-data-process; they are money-free and control-plane, so they ride the C verbatim path regardless of which sub-class they are filed under.
