---
id: PROC-NPA-GATE-01
title: New Product Approval Gate
owner: Saskia · Helena · Camille · Zara
policy-parent: D-NEW-PRODUCT-APPROVAL-POLICY
policy-amendment: D-NEW-PRODUCT-APPROVAL-POLICY-V2
policy-amendment-2: D-NPA-GATE-POLICY-REDESIGN
status: POPULATED
last-reviewed: 2026-06-15
reconciliation-cadence: per-product (stage-4 gate); re-checked at any controlled-launch limit amendment
canonical-events:
  - ProductDueDiligenceCompleted
  - ProductDimensionAttested
  - ProductApproved
  - ProductWithheld
  - ProductLaunched
---

# Procedure — New Product Approval Gate

**Procedure ID:** PROC-NPA-GATE-01
**Owner:** Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance) · Camille (Chief Financial Officer, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** EXCO (products within existing RAS); Board (products requiring RAS amendment or new regulatory authorisation)
**Cadence:** Event-triggered — fires on `ProductDueDiligenceCompleted`; one run per product per approval cycle
**Version:** v0.5 — 2026-06-15
**Status:** POPULATED

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` §4 (lifecycle stage 4) and §6 (approval authority matrix).
- **D-NEW-PRODUCT-APPROVAL-POLICY-V2** — `Policies/new-product-approval-policy-v2.md` (CEO session-delegation 2026-06-08). v2 binds `implementation-attested` to a green completeness recon (§3a.1), forward-tracks every `design-attested` deferral into the gap register with a production re-gate (§3a.2), enumerates the BA-series returns per product class against the Excel-canonical SARB schedule (Item 7; FX → BA 320 market-risk NOP + BA 300 LCR + FinSurv; the daily Reg 29(3) effective-NOP form is unresolved per `D-FX-NOP-SLA-CITATION-D5-MIGRATION`), and forbids silent out-of-scope absorption (Items 3, 9). This procedure operationalises those changes at §5 Steps 8, 10, 11 and §6 invariants.
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.
- Companion: Operational Risk Policy (operational-risk dimension sign-off); Market Risk Policy (RAS envelope check); New Product Approval Policy v2 §3a (attestation liveness + deferral forward-tracking), §4 (controlled-launch conditions).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-PR-24` | Documented NPA process: multi-dimensional due diligence, defined approval authority, controlled-launch limits, daily monitoring, breach escalation, post-implementation review. | This procedure executes stage 4 (gate convening, opinions, approval or deferral) and stage 5 handoff; controlled-launch config produced here feeds `product-controlled-launch.md`. |
| `ORG-PR-25` | NPA process: multi-dimensional due diligence, defined approval authority, controlled-launch limits with daily monitoring, and post-implementation review. | Approval authority matrix in §6 of the parent policy implements this requirement; the gate event carries `authority_level`. |
| `ORG-PR-26` | Documented NPA process addressing operational-risk implications; senior management and risk-management review before launch. | Helena (CRO) and Devon (COO) opinions constitute the required senior-management and risk-management review; Helena opinion is mandatory for approval. |
| FSCA Conduct Standard 3 of 2018 §§3–9 | Pre-trade dimensional coverage for OTC Derivative Providers; product classification and conduct review before launch. | Zara's conduct opinion (§5 Step 7) satisfies the conduct and suitability gate. |

## 3. Purpose

Execute the stage-4 approval gate of the New Product Approval lifecycle: receive the completed due-diligence package from `PROC-MK-NPA-DD-01`, convene the gate panel, collect written opinions from all four required sign-off holders, record the approval or deferral as a typed event, configure the controlled-launch constraints in the risk system, and hand off to `product-controlled-launch.md` and `product-post-implementation-review.md`.

This procedure does not repeat the due-diligence analysis — that is `PROC-MK-NPA-DD-01`. Its sole purpose is to close stage 4: the structured review of the consolidated package, the authority-level determination, and the `ProductApproved` or `ProductWithheld` event that is the gate itself.

No trade may be executed in any product before `ProductApproved` exists in the event store. This is a CI-enforced invariant.

**Event-name vocabulary.** This procedure's prose references the canonical typed event family declared in `prototype/platform/event-store/event-types/product.ts` (`Product*`), per D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2. The earlier `NPAGate*` / `NewProduct*` prose vocabulary (procedure v0.1–v0.2) is retired; see §13 change log v0.3 and the `recon:procedure-event-name-coherence` Vera pipeline that asserts no procedure-prose drift from the typed substrate.

## 4. Trigger

- `ProductDueDiligenceCompleted { productId, gatesCleared, gatesFailed }` arrives on the Product Register stream (i.e. `PROC-MK-NPA-DD-01` has closed cleanly with all 14 dimensions cleared or cleared-with-conditions). This is the **gate-open trigger** — there is no separate convene event; the gate is a synchronous review process bracketed by `ProductDueDiligenceCompleted` (open) and one of `ProductApproved` / `ProductWithheld` (close).
- Saskia (business sponsor) initiates the gate review by aggregating the dimension package and invoking the four-party opinion cycle.
- Re-trigger: if a gate opinion is `conditional` and the condition is subsequently cured (substrate change, regulatory clearance), Saskia may reopen the gate; the procedure re-fires on a fresh `ProductDueDiligenceCompleted` emitted from `PROC-MK-NPA-DD-01` for the amendment cycle.
- Deferred products: if `ProductWithheld` was emitted with a deferral remediation and the deferral reason is resolved (e.g. regulatory authorisation obtained, RAS amended by Board), Saskia re-initiates from the top of stage 3 (due-diligence refresh), which closes with a fresh `ProductDueDiligenceCompleted` and re-fires this procedure.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `ProductDueDiligenceCompleted`. Verify the package: confirm all 14 `ProductDimensionAttested` events are present (one per dimension, per the NPA Policy v1.0 §5 dimension owners), any `cleared-with-conditions` dimensions have their conditions documented, and the BRC paper has been prepared. | Saskia | `@platform/markets/product-register` (PLANNED) | The substrate auto-checks the 14-event invariant; a missing dimension blocks gate initiation. |
| 2 | Determine approval authority level. Classify the product against the RAS envelope (RAS §B — markets): (a) within existing RAS → EXCO authority; (b) requires RAS amendment → Board authority; (c) requires new regulatory authorisation → deferred until authorisation obtained. | Saskia · Helena | `@platform/risk/ras-engine` (PLANNED) | Authority level is set at gate open and cannot be downgraded during the gate cycle. If the correct authority level is Board, convene BRC paper for Board resolution; skip EXCO approval path. |
| 3 | Open the gate review. There is no separate convene event in the canonical typed family — the gate is bracketed by `ProductDueDiligenceCompleted` (open) and one of `ProductApproved` / `ProductWithheld` (close). Saskia circulates the BRC paper to the four-party opinion holders (Helena, Camille, Imani, Zara) with the BLAKE3 content hash recorded in the BRC packet manifest. | Saskia | `@platform/markets/product-register` (PLANNED) | The BLAKE3 content hash of the BRC paper is registered via the RMS `RecordFiled` event for the consolidated due-diligence package; this is the gate-cycle audit anchor. |
| 4 | **Helena (CRO) opinion.** Review the market-risk, credit-risk, liquidity, model-risk, and stress-test dimensions. Assess whether the product fits within the approved RAS envelope. Emit `ProductDimensionAttested { productId, dimension: 'market-risk' \| 'credit-risk' \| 'liquidity' \| 'model-risk' \| 'stress-test', result: 'design-attested' \| 'implementation-attested' \| 'failed', citationChain }` — one event per dimension Helena owns. | Helena | `@platform/risk/market-engine`, `@platform/risk/ras-engine` (PLANNED) | A `failed` result on a mandatory Helena dimension is immediately terminal; gate emits `ProductWithheld` and closes. Cite `ORG-PR-24`, `ORG-PR-26`. |
| 5 | **Camille (CFO) opinion.** Review the capital-impact, accounting-classification, and FTP dimensions. Confirm adequate capital headroom at expected book size and IFRS 9 / IAS 39 classification is settled. Emit `ProductDimensionAttested { productId, dimension, result, citationChain }` per dimension. | Camille | `@platform/capital/rwa-engine`, `@platform/accounting/posting-rules` (PLANNED) | Camille may condition the attestation on a maximum notional cap aligned with capital headroom; the cap is recorded in the controlled-launch limits attached to `ProductApproved`. |
| 6 | **Imani (General Counsel) opinion** (where legal-documentation dimension required execution of a new master-agreement form or new jurisdiction clause). Confirm legal-documentation attestation is complete. Emit `ProductDimensionAttested { productId, dimension: 'legal-documentation', result, citationChain }`. | Imani | `@platform/legal/clause-library` (PLANNED) | Optional if no new legal-doc form is required; absence of an Imani attestation in that case is the documented opt-out (recorded in the BRC paper). |
| 7 | **Zara (CCO) opinion.** Review conduct/suitability, AML/sanctions, FAIS treatment, and POPIA dimensions. Confirm the product may be offered to the intended counterparty categories under applicable conduct standards. Emit `ProductDimensionAttested { productId, dimension, result, citationChain }` per dimension. | Zara | `@platform/conduct/fais-treatment`, `@platform/compliance/sanctions-screening` (PLANNED) | Cite `ORG-CS3-005`, `ORG-CD-01..07`. A `failed` result from Zara on conduct / AML grounds is terminal. |
| 8 | Aggregate attestations. If any mandatory participant has emitted `result: 'failed'` → proceed to Step 9 (withhold). **Apply the v2 attestation-liveness rule (NPA Policy v2 §3a):** (i) a production-required dimension is `implementation-attested` ONLY if its attestation cites a GREEN completeness recon (§3a.1 — Item 3 → `recon:fx-supported-currency-no-suspense`; Item 7 → BA-310 submission-completeness check; Item 8 → `recon:expected-event-watchdog`); otherwise it is `design-attested`. (ii) For a **production-scope** approval, any production-required dimension still `design-attested` is **fatal** → withhold (Step 9) until re-gated. For **internal-test scope**, `design-attested` is acceptable but MUST forward-track (Step 10a). If all mandatory production-required attestations are `implementation-attested` (production) or at least `design-attested` (internal-test) → proceed to Step 10 (approval). If a regulatory authorisation gap or RAS-amendment dependency makes immediate approval infeasible despite no `failed` attestation → proceed to Step 11 (deferral). | system · Saskia | `@platform/markets/product-register` (PLANNED) | Mandatory attestations: Helena, Camille, Zara. Imani is mandatory where a new legal-doc form is introduced. The production-fire block is CI-enforced by the upgraded `recon:product-approval-attestation-integrity` (Vera). |
| 9 | **Withhold path.** Emit `ProductWithheld { productId, version, reason }` where `reason` names the vetoing party and the specific dimension failure (e.g. `helena:market-risk:ras-envelope-breach`). Gate closes. Saskia decides: redesign (return to stage 2) or abandon (emit a fresh `ProductWithheld` with `reason: "proposal-withdrawn:<rationale>"`). | Saskia | `@platform/markets/product-register` (PLANNED) | BRC is informed of the withhold; the withhold event is permanent in the event store. |
| 10 | **Approval path.** Compile controlled-launch limits: notional cap, counterparty-count cap, daily P&L limit, monitoring frequency (minimum: daily for first 90 days), breach-escalation path. **Record the approved declared `scope`** (NPA Policy v2 §1 / Item 9, Amendment D): the enumerated set of currencies, tenors, leg-types, counterparty categories, and venues. Emit `ProductApproved { productId, version, scope, conditions: [...], approvedBy: <authority-level-tag> }`. The controlled-launch limits flow into the subsequent `ProductLaunched` event's `controlledLaunchLimits` payload (Step 13). | Saskia · system | `@platform/markets/product-register` (PLANNED) | This is the gate event. No trade in this product may be executed before this event exists in the event store. The pre-trade gate enforces the `scope` (Item 9): an out-of-scope trade is REJECTED, never booked-and-absorbed into a suspense/default account (Amendment D). Vera enforces both invariants continuously. The `approvedBy` field carries the authority-level tag (`exco` or `board`) per the DOA matrix. |
| 10a | **Forward-track every deferral (production re-gate; NPA Policy v2 §3a.2).** For each dimension recorded `design-attested`, create a tracked gap-register obligation (`platform/substrate/gap-register.ts`) carrying the dimension id, the missing completeness recon, and the re-activation trigger (e.g. "commencement-of-trading", "BA-310 subscriber runtime-wired", "VaR watchdog green"). A production `ProductApproved` is blocked until every production-required dimension is `implementation-attested` and its gap obligation closed. `design-attested` is acceptable ONLY for an internal-test-scope approval. | Saskia · system | `platform/substrate/gap-register` | The deferral promise lives in the gap register, not only in the attestation narrative. The upgraded `recon:product-approval-attestation-integrity` (Vera) asserts every `design-attested` dimension has a matching open gap obligation, and that no production-scope `ProductApproved` carries a `design-attested` production-required dimension. |
| 11 | **Deferral path.** Where a required regulatory authorisation is not yet obtained, or where the Board must first amend the RAS, emit `ProductWithheld { productId, version, reason: "deferral:<gap-name>:expected-resolution=<iso-date>" }`. Gate closes; product remains on the register in `withheld:deferred` status. | Saskia | `@platform/markets/product-register` (PLANNED) | On resolution, Saskia re-initiates stage 3 (due-diligence refresh) which closes with a fresh `ProductDueDiligenceCompleted` and re-fires this procedure. The deferral remediation is the `reason` field; no separate `NewProductDeferred` event exists in the canonical family. |
| 12 | Configure controlled-launch constraints in the risk system. The controlled-launch limits compiled at Step 10 are the authoritative source; Atlas configures the system to enforce the notional cap and daily P&L limit as hard system limits (not advisory). | Atlas (substrate) | `@platform/risk/limit-engine` (PLANNED) | Limits are system-enforced. A hard breach blocks trade execution; a soft breach (80% utilisation) triggers monitoring alert. |
| 13 | Hand off to `product-controlled-launch.md` (stage 5) and schedule the PIR. Emit `ProductLaunched { productId, version, controlledLaunchLimits: { notionalCap, counterpartyCap, dailyPnlLimit, monitoringCadence, pirDate }, launchedAt }`. Notify Saskia and Helena that daily monitoring is now active. | Saskia · Atlas | `@platform/markets/product-register` (PLANNED) | PIR date defaults to 90 calendar days from `launchedAt`, per policy §4 stage 6. `ProductLaunched` is the typed handoff event consumed by `product-controlled-launch.md`. |

## 6. Reconciliation

- **Events produced per gate cycle:**
  - `ProductDueDiligenceCompleted { productId, gatesCleared, gatesFailed }` — one per cycle (gate-open trigger; emitted upstream by `PROC-MK-NPA-DD-01`).
  - `ProductDimensionAttested { productId, dimension, result, citationChain }` — one per dimension reviewed at the gate (Helena, Camille, Zara dimensions are mandatory; Imani's legal-documentation dimension where applicable).
  - Exactly one of: `ProductWithheld { productId, version, reason }` | `ProductApproved { productId, version, conditions, approvedBy }`.
  - `ProductLaunched { productId, version, controlledLaunchLimits, launchedAt }` — only on approval path; emitted at Step 13 handoff.

- **Reconciliation invariants:**
  1. For every `ProductDueDiligenceCompleted` (gate open), exactly one of `ProductWithheld` or `ProductApproved` must follow. Open gates with no closing event after 30 calendar days are escalated to BRC chair.
  2. Every `ProductApproved` must be preceded by at least one `ProductDimensionAttested` from each mandatory participant (Helena, Camille, Zara) with `result != 'failed'`.
  3. **No trade-execution event (`FxTradeExecuted` / `TradeExecuted` / equivalent) may reference a `productId` without a preceding `ProductApproved` event for that product.** This is the primary trade-gate invariant; Vera enforces it on every CI run and continuously in production via the `@platform/recon/product-gate-invariant` harness.
  4. Every `ProductApproved` with `approvedBy: 'board'` must be preceded by a `Decision` (CEO-approved or Board-approved) referencing the same `productId`.
  5. **Procedure-prose ↔ typed-substrate coherence.** Every event-name reference in this procedure file must resolve to a canonical `make<Type>` factory in `prototype/platform/event-store/event-types/product.ts` (or a permitted external factory cited at first mention). Enforced by `recon:procedure-event-name-coherence` (Vera; D-PRODUCT-CONSTRUCTION-SUBSTRATE; Principle 2).
  6. **Production attestation-liveness (NPA Policy v2 §3a.1).** No **production-scope** `ProductApproved` may be preceded by a production-required `ProductDimensionAttested` with `result:'design-attested'` and no tracked deferred gaps. A production-required dimension is `implementation-attested` only where it cites a GREEN completeness recon (Item 3 → `recon:fx-supported-currency-no-suspense`; Item 7 → BA-310 submission-completeness check; Item 8 → `recon:expected-event-watchdog`). `design-attested` with explicit tracked conditions (ProductDeferredGap with owner + targetTrigger + citations) is acceptable — the approval is `approved-with-conditions` and the openConditions list is enforced. Enforced by `recon:product-approval-attestation-integrity` (Vera; D-NPA-GATE-POLICY-REDESIGN; D-NEW-PRODUCT-APPROVAL-POLICY-V2).
  7. **Deferral forward-tracking (NPA Policy v2 §3a.2 / D-NPA-GATE-POLICY-REDESIGN).** Every `ProductDimensionAttested` with `result:'design-attested'` at approval time MUST carry at least one `deferredGaps` entry (owner + targetTrigger + citations). A `design-attested` dimension with no tracked deferred gaps is a `fail` at approval — the gate blocks until either the dimension is upgraded to `implementation-attested` or explicit tracked conditions are recorded. Enforced by `recon:product-approval-attestation-integrity` (Vera) and `validateNpaGate` in `platform/markets/products/npa-gate.ts`.
  8. **Scope enforcement — no silent out-of-scope absorption (NPA Policy v2 §1 / Item 9, Amendment D).** No trade-execution event may reference a `productId` with a currency / tenor / leg-type / counterparty / venue outside that product's `ProductApproved.scope`; an out-of-scope trade must be rejected pre-booking, never booked-and-routed to a suspense / default account (e.g. `ACC-2100-007`). A booked out-of-scope trade absorbed into suspense is a reportable NPA-gate breach.
  9. **`ProductApproved` = fully approved.** `ProductApproved` signals that all 14 NPA dimensions satisfy the gate (either `implementation-attested` or `design-attested` with explicit tracked conditions). Design-attested alone — without at least one `ProductDeferredGap` entry carrying owner + targetTrigger + citations — is insufficient for `ProductApproved`. Authority: D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15).
  10. **Every design-attested dimension at approval must carry at least one tracked deferred gap (owner + trigger + citations).** This invariant is enforced pre-approval by `validateNpaGate` (returns `ready: false` when the condition is absent) and post-approval by `recon:product-approval-attestation-integrity` (severity: fail). A `ProductApproved` preceded by a `design-attested`-no-gaps dimension is a governance bypass, surfaced by Vera on every CI run. Authority: D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15); enforced by `recon:npa-gate-integrity`.
  11. **Post-approval finding SLA (D-NPA-POST-APPROVAL-FINDING-REVIEW, CEO-approved 2026-06-15).** Every `ProductPostApprovalFinding` (critical or high) must have a matching `ProductDimensionRetrospectiveReview` within 30 calendar days of `discoveredAt`; medium severity within 90 days. This obligation is active immediately — **no licence-day deferral**. Enforced by `recon:npa-post-approval-finding-review` (BLOCKING).

- **Step 14 — Post-approval finding protocol (standing; effective immediately in pre-licence phase).**

  If any agent, recon gate, or audit review surfaces a defect traceable to this product after `ProductApproved` has been emitted — including during the pre-licence build phase:

  1. The discovering agent emits `ProductPostApprovalFinding { productId, findingId, severity, title, description, discoveredBy, discoveredAt, missedDimension, findingTrigger, citations }`. This is mandatory and may not be deferred to licence-day.
  2. Scrooge surfaces the open finding at the start of the next status report (per `D-PROACTIVE-ESCALATION-SURFACING`); a `SubstrateAlert { alertClass:"integrity", severity:"high" }` is also emitted.
  3. The responsible agent for `missedDimension` emits `ProductDimensionRetrospectiveReview { productId, findingId, dimension, reviewedBy, reviewedAt, rootCause, correctiveAction, revisedAttestation }` within the SLA (30 days critical/high; 90 days medium).
  4. If `revisedAttestation: "strengthened"`, the agent emits a new `ProductDimensionAttested` with updated conditions. If the approved scope was wrong, a `ProductWithheld` + re-gate cycle is triggered.

  Authority: D-NPA-POST-APPROVAL-FINDING-REVIEW (CEO-approved 2026-06-15); PROC-NPA-GATE-01 §6 invariant 11.

- **Failure mode:** if the product-register substrate is unavailable, the gate cannot be convened. No workaround path exists — the gate is a hard dependency (fail-closed).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `ProductDueDiligenceCompleted` event (gate-open trigger) | Event log (P1) | Indefinite | Internal |
| `ProductDimensionAttested` events (all participants) | Event log (P1) | Indefinite | Internal — may reference commercially sensitive methodology |
| `ProductWithheld` / `ProductApproved` (terminal gate event) | Event log (P1) | Indefinite | Internal |
| Consolidated due-diligence package (BRC paper) | Document store (BLAKE3-addressed) — registered via `RecordFiled` event per RMS Phase 3 (D-RMS-PHASE-3) | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal |
| Controlled-launch limits | `controlledLaunchLimits` payload of `ProductLaunched` + limit-engine config store | ≥ 5 years | Internal |
| `ProductLaunched` (stage-5 handoff) | Event log (P1) | Indefinite | Internal |

## 8. Manual steps

- **Step 2 (authority determination):** Saskia and Helena make the RAS-envelope judgement. Where the RAS boundary is ambiguous (e.g. a novel instrument that partially overlaps an approved product), Helena escalates to BRC for a binding ruling before convening the gate.
- **Steps 4–7 (attestations):** each participant's substantive review is agent-led analysis against the due-diligence package (Principle 6 — autonomous by default). The `ProductDimensionAttested` event is the typed record; the underlying analysis may be documented in the BRC paper or as a separate signed memo registered via `RecordFiled`.
- **Step 9 (withhold):** Saskia's decision to redesign or abandon is human-overseen discretion (CEO-residual). If the withhold is on conduct or AML grounds, Zara must emit a `ProductDimensionAttested` with `result: 'design-attested'` (or `implementation-attested`) confirming the redesigned product satisfies the blocking condition before a new gate cycle is initiated.
- **Step 10 (approval):** where authority level is Board, the Board resolution is the approval event source; Scrooge records it as a `Decision` (CEO-approved or Board-approved) event; the `ProductApproved` event is emitted only after the Board resolution is confirmed.
- **Build-phase:** product-register substrate is PLANNED; gate is operated by Scrooge-coordinated runs against the policy spec until Atlas lands the substrate per `D-PRODUCT-CONSTRUCTION-SUBSTRATE`. The gap is a roadmap item.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Gate open (`ProductDueDiligenceCompleted` emitted) with no closing event > 30 days | `@platform/markets/product-register` SLA monitor | Saskia → BRC chair → CEO |
| `ProductApproved` missing a mandatory dimension attestation | Reconciliation invariant 2 (Vera CI check) | Atlas blocks the event; Saskia must cure before approval can proceed |
| Trade-execution event without preceding `ProductApproved` | Vera continuous recon (`@platform/recon/product-gate-invariant`) | Auto-halt of the execution path; Zara + Helena immediately; Saskia notified; incident raised under `incident-response.md` |
| Board-authority product approved without Board resolution event | Reconciliation invariant 4 | Vera escalates to Owen (CoSec, governance) + Helena; trade execution blocked |
| Controlled-launch limits not configured in risk system after `ProductApproved` | Atlas limit-engine sync check | Atlas immediately; Saskia + Helena notified; no trading in the product until limits are configured |
| Withhold overridden without gate-panel consensus | Cryptographic gate; `ProductWithheld` is immutable | Auto-event to BRC chair + Vera; treated as a governance incident |
| Product-register substrate unavailable at gate opening | Health check on `@platform/markets/product-register` | Atlas + Devon; gate is fail-closed; no workaround path |
| Procedure-prose drift from typed event family | `recon:procedure-event-name-coherence` (Vera) | Atlas + Owen (CoSec, governance) immediately; procedure-prose rewrite required before next gate cycle. |

## 10. Related procedures

- [`new-product-due-diligence.md`](new-product-due-diligence.md) — stage 3; this procedure consumes `ProductDueDiligenceCompleted` as its trigger.
- [`product-controlled-launch.md`](product-controlled-launch.md) — stage 5; consumes `ProductLaunched` emitted at Step 13.
- [`product-post-implementation-review.md`](product-post-implementation-review.md) — stage 6; PIR date set at Step 13.
- [`product-retirement-migration.md`](product-retirement-migration.md) — stage 8.
- [`market-risk-monitoring.md`](market-risk-monitoring.md) — provides the live limit-monitoring that detects controlled-launch breaches.
- [`sanctions-screening.md`](sanctions-screening.md) — invoked inline by Zara's conduct dimension during the opinion stage.
- [`rcsa-cycle.md`](rcsa-cycle.md) — operational-risk findings feed Helena's CRO opinion.

## 11. Citations

- **[policy: D-NEW-PRODUCT-APPROVAL-POLICY]** — parent policy; §4 (lifecycle), §6 (authority matrix), §7 (controlled-launch conditions).
- **[policy: D-NEW-PRODUCT-APPROVAL-POLICY-V2]** — `Policies/new-product-approval-policy-v2.md`; §3a (attestation liveness + deferral forward-tracking), Item 7 (enumerated BA-series returns per product class), Items 3 & 9 (no silent out-of-scope absorption). Operationalised at §5 Steps 8, 10, 10a and §6 invariants 6–8.
- **[decision: D-BA-RETURN-FORM-NUMBERING-RECON]** — FX net-open-position rides BA-310 (Reg 28) / BA-110 (daily return, Reg 29(3)); there is no BA-320/325. Source of the Item-7 citation refresh.
- **[review: docs/2026-06-08_fx-functionality-domain-review.md]** — the FX functionality domain review that diagnosed the three weaknesses v2 fixes (deferral never re-gated; BA-310 coverage hole; out-of-scope suspense absorption).
- **[register: ORG-PR-24, ORG-PR-25, ORG-PR-26]** — Prudential NPA obligations (Banks Act + Regulations Relating to Banks Reg 39 / BCBS).
- **[register: ORG-CS3-001..009]** — Conduct Standard 3/2018.
- **[register: ORG-CD-01..07]** — Conduct / TCF obligations.
- **[register: ORG-MK-01..08]** — Markets domain obligations.
- **[principle: CLAUDE.md P1]** — events are the only source of truth; `ProductApproved` is the gate event.
- **[principle: CLAUDE.md P2]** — single-graph discipline; every approval traces to regulation via obligations register; procedure-prose event-name references resolve into the typed substrate per `recon:procedure-event-name-coherence`.
- **[principle: CLAUDE.md P6]** — autonomous-by-default; gate opening, attestation submission, and aggregation are agent-driven; the typed events are the substantive record.
- **[decision: D-PRODUCT-CONSTRUCTION-SUBSTRATE]** — Slice 2 establishes the canonical 14-event `Product*` typed family in `prototype/platform/event-store/event-types/product.ts`. This procedure's prose was reconciled to that family in v0.3 (2026-05-21).
- **[pr: GitHub #673]** — Saskia walk for FX-spot internal pre-licence test surfaced the `NPAGate*` ↔ `Product*` drift; the present reconciliation is the substrate-hygiene follow-on.

## 12. Substrate gaps

- `@platform/markets/product-register` (gate orchestration) — PLANNED; operated by Scrooge-coordinated run until Atlas lands.
- `@platform/risk/ras-engine` (RAS-envelope check at Step 2) — PLANNED.
- `@platform/risk/limit-engine` (controlled-launch constraint configuration at Step 12) — PLANNED.
- `@platform/recon/product-gate-invariant` (Vera CI invariant) — PLANNED; the `TradeExecuted`-without-approval invariant is the highest-priority recon harness for the markets domain.
- **`recon:product-approval-attestation-integrity` upgrade (Vera) — NAMED follow-on (NPA Policy v2 §7).** The existing `platform/recon/product-approval-attestation-integrity.ts` blocks only on `result:'failed'`. Upgrade: (a) for a production-scope `ProductApproved`, any production-required `design-attested` dimension → `fail` (production-fire block, §6 invariant 6); (b) every `design-attested` dimension must have a matching open gap-register obligation (§6 invariant 7). Coordinate with Vera's `WS-COMPLETENESS-AUDIT`. NOT built in the v2 policy run (avoids collision with Vera's concurrent recon work).

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Saskia · Helena · Camille · Zara (via Scrooge) | Initial STUB. Authored to complement `new-product-due-diligence.md`; covers stage-4 gate and handoff to stage 5. |
| v0.2 | 2026-05-15 | Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance) · Camille (Chief Financial Officer, governance) · Zara (Chief Compliance Officer, governance) | Promoted to POPULATED; owner title updated to CIO; version bumped. |
| v0.3 | 2026-05-21 | Atlas (Core banking platform architect, engineering) · Owen (Company Secretary, governance) | Reconciled procedure-prose event names with canonical `Product*` typed family per D-PRODUCT-CONSTRUCTION-SUBSTRATE Slice 2 (substrate hygiene follow-on to PR #673 Saskia walk). `NPAGate*` / `NewProduct*` / `ProductHandedToControlledLaunch` / `ProductProposalWithdrawn` vocabulary retired; mapped to `ProductDueDiligenceCompleted` (trigger) / `ProductDimensionAttested` (attestations) / `ProductApproved` / `ProductWithheld` (terminal) / `ProductLaunched` (handoff). New recon `recon:procedure-event-name-coherence` enforces no future drift. Single-graph discipline (Principle 2). |
| v0.4 | 2026-06-08 | Saskia (Head of Global Markets, governance) · Owen (Company Secretary, governance) | Operationalised New Product Approval Policy v2 (`D-NEW-PRODUCT-APPROVAL-POLICY-V2`, CEO session-delegation 2026-06-08). §5 Step 8 applies the v2 attestation-liveness rule (production-required dimension `implementation-attested` only with a green completeness recon; `design-attested` fatal for production scope, acceptable for internal-test). Step 10 records the approved declared `scope` and the pre-trade out-of-scope-rejection rule (Amendment D). New Step 10a forward-tracks every `design-attested` deferral into a gap-register obligation with a production re-gate (§3a.2). §6 adds invariants 6 (production attestation-liveness), 7 (deferral forward-tracking), 8 (no silent out-of-scope absorption). §11 adds the v2 policy, `D-BA-RETURN-FORM-NUMBERING-RECON`, and the FX review citations. Substrate-gap §12 adds the `recon:product-approval-attestation-integrity` upgrade as a named Vera follow-on. |
| v0.5 | 2026-06-15 | Owen (Company Secretary, governance) | Operationalised D-NPA-GATE-POLICY-REDESIGN (CEO 2026-06-15). `ProductApproved` = fully approved: design-attested-alone (no tracked deferred gaps) is insufficient; design-attested WITH at least one `ProductDeferredGap` (owner + targetTrigger + citations) is acceptable — approval is `approved-with-conditions`. Gate enforced in `validateNpaGate` (returns `ready:false` for design-attested-no-gaps) and `recon:product-approval-attestation-integrity` (severity:fail). §6 invariants 6–7 reworded; invariants 9–10 added. `counterpartyEligibility` fixed to `"institutional"` in `run-npa-gate-fx-otc-vanilla.ts` (D-NPA-SCOPE-FIX-COUNTERPARTY-ELIGIBILITY). `ProductWithheld` emitted for `prd:bank:fx:otc-vanilla` pending re-gate (D-FX-OTC-PRODUCT-APPROVAL-WITHDRAWAL). `attestedDimensions` type upgraded from `Set<string>` to `Map<string, AttestationRecord>` to carry deferredGaps through to the gate. |

## 14. Audit / assurance

Vera continuously monitors the `ProductDueDiligenceCompleted` → `ProductApproved` / `ProductWithheld` event chain and the trade-execution-gate invariant (no trade without preceding `ProductApproved`). Findings: missing dimension attestations, open gates past SLA, trades without approval events, procedure-prose drift from the typed event family (`recon:procedure-event-name-coherence`). Structural findings (substrate-gap-induced) flow to Atlas (Core banking platform architect, engineering) + Saskia (Head of Global Markets, governance). Reportable to Owen (Company Secretary, governance) + Helena (Chief Risk Officer, governance); critical breaches (trade without approval) flow to BRC chair immediately.
