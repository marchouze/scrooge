---
id: PROC-NPA-GATE-01
title: New Product Approval Gate
owner: Saskia · Helena · Camille · Zara
policy-parent: D-NEW-PRODUCT-APPROVAL-POLICY
status: POPULATED
last-reviewed: 2026-05-13
reconciliation-cadence: per-product (stage-4 gate); re-checked at any controlled-launch limit amendment
---

# Procedure — New Product Approval Gate

**Procedure ID:** PROC-NPA-GATE-01
**Owner:** Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance) · Camille (Chief Financial Officer, governance) · Zara (Chief Compliance Officer, governance)
**Approval:** EXCO (products within existing RAS); Board (products requiring RAS amendment or new regulatory authorisation)
**Cadence:** Event-triggered — fires on `ProductDueDiligenceCompleted`; one run per product per approval cycle
**Version:** v0.2 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **D-NEW-PRODUCT-APPROVAL-POLICY** — `Owner Inbox/2026-05-10_saskia_new-product-approval-policy.md` §4 (lifecycle stage 4) and §6 (approval authority matrix).
- Decision record: `Owner Inbox/2026-05-10_scrooge_ceo-decision-record_d-new-product-approval-policy.md`.
- Companion: Operational Risk Policy (operational-risk dimension sign-off); Market Risk Policy (RAS envelope check); New Product Approval Policy v1.0 §7 (controlled-launch conditions).

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-PR-24` | Documented NPA process: multi-dimensional due diligence, defined approval authority, controlled-launch limits, daily monitoring, breach escalation, post-implementation review. | This procedure executes stage 4 (gate convening, opinions, approval or deferral) and stage 5 handoff; controlled-launch config produced here feeds `product-controlled-launch.md`. |
| `ORG-PR-25` | NPA process: multi-dimensional due diligence, defined approval authority, controlled-launch limits with daily monitoring, and post-implementation review. | Approval authority matrix in §6 of the parent policy implements this requirement; the gate event carries `authority_level`. |
| `ORG-PR-26` | Documented NPA process addressing operational-risk implications; senior management and risk-management review before launch. | Helena (CRO) and Devon (COO) opinions constitute the required senior-management and risk-management review; Helena opinion is mandatory for approval. |
| FSCA Conduct Standard 3 of 2018 §§3–9 | Pre-trade dimensional coverage for OTC Derivative Providers; product classification and conduct review before launch. | Zara's conduct opinion (§5 Step 7) satisfies the conduct and suitability gate. |

## 3. Purpose

Execute the stage-4 approval gate of the New Product Approval lifecycle: receive the completed due-diligence package from `PROC-MK-NPA-DD-01`, convene the gate panel, collect written opinions from all four required sign-off holders, record the approval or deferral as a typed event, configure the controlled-launch constraints in the risk system, and hand off to `product-controlled-launch.md` and `product-post-implementation-review.md`.

This procedure does not repeat the due-diligence analysis — that is `PROC-MK-NPA-DD-01`. Its sole purpose is to close stage 4: the structured review of the consolidated package, the authority-level determination, and the `NewProductApproved` or `NewProductDeferred` event that is the gate itself.

No trade may be executed in any product before `NewProductApproved` exists in the event store. This is a CI-enforced invariant.

## 4. Trigger

- `ProductDueDiligenceCompleted { productId, dimensionResults, conditions, asOf }` arrives on the Product Register stream (i.e. `PROC-MK-NPA-DD-01` has closed cleanly with all 14 dimensions cleared or cleared-with-conditions).
- Saskia (business sponsor) initiates the gate by emitting `NPAGateConvened`.
- Re-trigger: if a gate opinion is `conditional` and the condition is subsequently cured (substrate change, regulatory clearance), Saskia may reopen the gate; the gate emits a fresh `NPAGateConvened` with `cycle: amendment`.
- Deferred products: if `NewProductDeferred` was emitted and the deferral reason is resolved (e.g. regulatory authorisation obtained, RAS amended by Board), Saskia re-initiates from the top of stage 4.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Receive `ProductDueDiligenceCompleted`. Verify the package: confirm all 14 `ProductDimensionAttested` events are present, any `cleared-with-conditions` dimensions have their conditions documented, and the BRC paper has been prepared. | Saskia | `@platform/markets/product-register` (PLANNED) | The substrate auto-checks the 14-event invariant; a missing dimension blocks gate initiation. |
| 2 | Determine approval authority level. Classify the product against the RAS envelope (RAS §B — markets): (a) within existing RAS → EXCO authority; (b) requires RAS amendment → Board authority; (c) requires new regulatory authorisation → deferred until authorisation obtained. | Saskia · Helena | `@platform/risk/ras-engine` (PLANNED) | Authority level is set at gate initiation and cannot be downgraded during the gate cycle. If the correct authority level is Board, convene BRC paper for Board resolution; skip EXCO approval path. |
| 3 | Emit `NPAGateConvened { productId, participants: [saskia, helena, camille, zara], authorityLevel, conveneDate, packageRef }`. Gate is now open. | Saskia | `@platform/markets/product-register` (PLANNED) | `packageRef` is the BLAKE3 content hash of the BRC paper / consolidated due-diligence package. |
| 4 | **Helena (CRO) opinion.** Review the market-risk, credit-risk, liquidity, model-risk, and stress-test dimensions. Assess whether the product fits within the approved RAS envelope. Emit `NPAGateOpinionSubmitted { productId, participant: 'helena', opinion: approve | veto | conditional, conditions?, citationChain }`. | Helena | `@platform/risk/market-engine`, `@platform/risk/ras-engine` (PLANNED) | A `veto` from Helena is immediately terminal; gate emits `NPAGateVetoed` and closes. Cite `ORG-PR-24`, `ORG-PR-26`. |
| 5 | **Camille (CFO) opinion.** Review the capital-impact, accounting-classification, and FTP dimensions. Confirm adequate capital headroom at expected book size and IFRS 9 / IAS 39 classification is settled. Emit `NPAGateOpinionSubmitted { participant: 'camille', opinion, conditions?, citationChain }`. | Camille | `@platform/capital/rwa-engine`, `@platform/accounting/posting-rules` (PLANNED) | Camille may condition approval on a maximum notional cap aligned with capital headroom. |
| 6 | **Imani (General Counsel) opinion** (where legal-documentation dimension required execution of a new master-agreement form or new jurisdiction clause). Confirm legal-documentation attestation is complete. Emit `NPAGateOpinionSubmitted { participant: 'imani', opinion, conditions?, citationChain }`. | Imani | `@platform/legal/clause-library` (PLANNED) | Optional if no new legal-doc form is required; Imani confirms opt-out via `NPAGateOpinionSubmitted { opinion: 'not-applicable', reason }`. |
| 7 | **Zara (CCO) opinion.** Review conduct/suitability, AML/sanctions, FAIS treatment, and POPIA dimensions. Confirm the product may be offered to the intended counterparty categories under applicable conduct standards. Emit `NPAGateOpinionSubmitted { participant: 'zara', opinion, conditions?, citationChain }`. | Zara | `@platform/conduct/fais-treatment`, `@platform/compliance/sanctions-screening` (PLANNED) | Cite `ORG-CS3-005`, `ORG-CD-01..07`. A `veto` from Zara on conduct / AML grounds is terminal. |
| 8 | Aggregate opinions. If any mandatory participant has emitted `veto` → proceed to Step 9 (veto). If any opinion is `conditional` → document conditions and proceed to Step 10 (conditional approval) or Step 11 (deferral), depending on whether conditions are satisfiable within the current gate cycle. If all mandatory opinions are `approve` or `conditional` with satisfiable conditions → proceed to Step 10. | system · Saskia | `@platform/markets/product-register` (PLANNED) | Mandatory opinions: Helena, Camille, Zara. Imani is mandatory where a new legal-doc form is introduced. |
| 9 | **Veto path.** Emit `NPAGateVetoed { productId, vetoingParty, reason, citationChain }`. Gate closes. Saskia decides: redesign (return to stage 2) or abandon (emit `ProductProposalWithdrawn`). | Saskia | `@platform/markets/product-register` (PLANNED) | BRC is informed of the veto; veto event is permanent in the event store. |
| 10 | **Approval path.** Compile controlled-launch configuration: notional cap, counterparty-count cap, daily P&L limit, monitoring frequency (minimum: daily for first 90 days), breach-escalation path. Emit `NewProductApproved { productId, approvedBy: [participants], authorityLevel, controlledLaunchConfig: { notionalCap, counterpartyCap, dailyPnlLimit, monitoringCadence, pirDate }, conditions: [...], approvalDate }`. | Saskia · system | `@platform/markets/product-register` (PLANNED) | This is the gate event. No trade in this product may be executed before this event exists in the event store. Vera enforces the invariant continuously. |
| 11 | **Deferral path.** Where a required regulatory authorisation is not yet obtained, or where the Board must first amend the RAS, emit `NewProductDeferred { productId, reason, expectedResolutionDate, deferredBy: 'gate-panel' }`. Gate closes; product remains on the register in `deferred` status. | Saskia | `@platform/markets/product-register` (PLANNED) | On resolution, Saskia re-initiates stage 4 (new `NPAGateConvened`). |
| 12 | Configure controlled-launch constraints in the risk system. The `controlledLaunchConfig` from `NewProductApproved` is the authoritative source; Atlas configures the system to enforce the notional cap and daily P&L limit as hard system limits (not advisory). | Atlas (substrate) | `@platform/risk/limit-engine` (PLANNED) | Limits are system-enforced. A hard breach blocks trade execution; a soft breach (80% utilisation) triggers monitoring alert. |
| 13 | Hand off to `product-controlled-launch.md` (stage 5) and schedule the PIR. Emit `ProductHandedToControlledLaunch { productId, controlledLaunchStart, pirScheduledDate }`. Notify Saskia and Helena that daily monitoring is now active. | Saskia · Atlas | `@platform/markets/product-register` (PLANNED) | PIR date defaults to 90 calendar days from controlled-launch start, per policy §4 stage 6. |

## 6. Reconciliation

- **Events produced per gate cycle:**
  - `NPAGateConvened { productId, participants, authorityLevel, conveneDate, packageRef }` — one per cycle.
  - `NPAGateOpinionSubmitted { productId, participant, opinion, conditions?, citationChain }` — one per mandatory participant (Helena, Camille, Zara; Imani where applicable).
  - Exactly one of: `NPAGateVetoed { productId, vetoingParty, reason }` | `NewProductApproved { productId, approvedBy, authorityLevel, controlledLaunchConfig }` | `NewProductDeferred { productId, reason }`.
  - `ProductHandedToControlledLaunch { productId, ... }` — only on approval path.

- **Reconciliation invariants:**
  1. For every `NPAGateConvened`, exactly one of `NPAGateVetoed`, `NewProductApproved`, or `NewProductDeferred` must follow. Open gates with no closing event after 30 calendar days are escalated to BRC chair.
  2. Every `NewProductApproved` must be preceded by at least one `NPAGateOpinionSubmitted` from each mandatory participant (Helena, Camille, Zara) with `opinion != 'veto'`.
  3. **No `TradeExecuted` event may reference a `productType` without a preceding `NewProductApproved` event for that product type.** This is the primary trade-gate invariant; Vera enforces it on every CI run and continuously in production via the `@platform/recon/product-gate-invariant` harness.
  4. Every `NewProductApproved` with `authorityLevel: 'board'` must be preceded by a `CeoDecision` or Board resolution event referencing the same `productId`.

- **Failure mode:** if the product-register substrate is unavailable, the gate cannot be convened. No workaround path exists — the gate is a hard dependency (fail-closed).

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `NPAGateConvened` event | Event log (P1) | Indefinite | Internal |
| `NPAGateOpinionSubmitted` events (all participants) | Event log (P1) | Indefinite | Internal — may reference commercially sensitive methodology |
| `NPAGateVetoed` / `NewProductApproved` / `NewProductDeferred` | Event log (P1) | Indefinite | Internal |
| Consolidated due-diligence package (BRC paper) | Owner Inbox `YYYY-MM-DD_saskia_npa-dd-package_<productId>.md` + document store (BLAKE3-addressed) | ≥ 5 years (Conduct Standard 3/2018 §12) | Internal |
| Controlled-launch configuration | `controlledLaunchConfig` payload of `NewProductApproved` + limit-engine config store | ≥ 5 years | Internal |
| `ProductHandedToControlledLaunch` | Event log (P1) | Indefinite | Internal |

## 8. Manual steps

- **Step 2 (authority determination):** Saskia and Helena make the RAS-envelope judgement. Where the RAS boundary is ambiguous (e.g. a novel instrument that partially overlaps an approved product), Helena escalates to BRC for a binding ruling before convening the gate.
- **Steps 4–7 (opinions):** each participant's substantive review is human-led analysis against the due-diligence package. The opinion event is the typed record; the underlying analysis may be documented in the BRC paper or as a separate signed memo.
- **Step 9 (veto):** Saskia's decision to redesign or abandon is human discretion. If the veto is on conduct or AML grounds, Zara must confirm in writing (typed event) that the redesigned product satisfies the blocking condition before a new gate cycle is initiated.
- **Step 10 (approval):** where authority level is Board, the Board resolution is the approval event source; Scrooge records it as a `CeoDecision` / Board-resolution event; the `NewProductApproved` event is emitted only after the Board resolution is confirmed.
- **Build-phase:** product-register substrate is PLANNED; gate is operated by Scrooge-coordinated runs against the policy spec until Atlas lands the substrate per `D-PRODUCT-CONSTRUCTION-SUBSTRATE`. The gap is a roadmap item.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Gate open with no closing event > 30 days | `@platform/markets/product-register` SLA monitor | Saskia → BRC chair → CEO |
| `NewProductApproved` missing a mandatory opinion | Reconciliation invariant 2 (Vera CI check) | Atlas blocks the event; Saskia must cure before approval can proceed |
| `TradeExecuted` without preceding `NewProductApproved` | Vera continuous recon (`@platform/recon/product-gate-invariant`) | Auto-halt of the execution path; Zara + Helena immediately; Saskia notified; incident raised under `incident-response.md` |
| Board-authority product approved without Board resolution event | Reconciliation invariant 4 | Vera escalates to Owen (CoSec, governance) + Helena; trade execution blocked |
| Controlled-launch limits not configured in risk system after `NewProductApproved` | Atlas limit-engine sync check | Atlas immediately; Saskia + Helena notified; no trading in the product until limits are configured |
| Veto overridden without gate-panel consensus | Cryptographic gate; `NPAGateVetoed` is immutable | Auto-event to BRC chair + Vera; treated as a governance incident |
| Product-register substrate unavailable at gate convening | Health check on `@platform/markets/product-register` | Atlas + Devon; gate is fail-closed; no workaround path |

## 10. Related procedures

- [`new-product-due-diligence.md`](new-product-due-diligence.md) — stage 3; this procedure consumes `ProductDueDiligenceCompleted` as its trigger.
- [`product-controlled-launch.md`](product-controlled-launch.md) — stage 5; consumes `ProductHandedToControlledLaunch`.
- [`product-post-implementation-review.md`](product-post-implementation-review.md) — stage 6; PIR date set at Step 13.
- [`product-retirement-migration.md`](product-retirement-migration.md) — stage 8.
- [`market-risk-monitoring.md`](market-risk-monitoring.md) — provides the live limit-monitoring that detects controlled-launch breaches.
- [`sanctions-screening.md`](sanctions-screening.md) — invoked inline by Zara's conduct dimension during the opinion stage.
- [`rcsa-cycle.md`](rcsa-cycle.md) — operational-risk findings feed Helena's CRO opinion.

## 11. Citations

- **[policy: D-NEW-PRODUCT-APPROVAL-POLICY]** — parent policy; §4 (lifecycle), §6 (authority matrix), §7 (controlled-launch conditions).
- **[register: ORG-PR-24, ORG-PR-25, ORG-PR-26]** — Prudential NPA obligations (Banks Act + Regulations Relating to Banks Reg 39 / BCBS).
- **[register: ORG-CS3-001..009]** — Conduct Standard 3/2018.
- **[register: ORG-CD-01..07]** — Conduct / TCF obligations.
- **[register: ORG-MK-01..08]** — Markets domain obligations.
- **[principle: CLAUDE.md P1]** — events are the only source of truth; `NewProductApproved` is the gate event.
- **[principle: CLAUDE.md P2]** — single-graph discipline; every approval traces to regulation via obligations register.
- **[principle: CLAUDE.md P6]** — autonomous-by-default; gate convening and aggregation are system-driven; human opinions are typed events.

## 12. Substrate gaps

- `@platform/markets/product-register` (gate orchestration) — PLANNED; operated by Scrooge-coordinated run until Atlas lands.
- `@platform/risk/ras-engine` (RAS-envelope check at Step 2) — PLANNED.
- `@platform/risk/limit-engine` (controlled-launch constraint configuration at Step 12) — PLANNED.
- `@platform/recon/product-gate-invariant` (Vera CI invariant) — PLANNED; the `TradeExecuted`-without-approval invariant is the highest-priority recon harness for the markets domain.

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-13 | Saskia · Helena · Camille · Zara (via Scrooge) | Initial STUB. Authored to complement `new-product-due-diligence.md`; covers stage-4 gate and handoff to stage 5. |
| v0.2 | 2026-05-15 | Saskia (Head of Global Markets) · Helena (Chief Risk Officer, governance) · Camille (Chief Financial Officer, governance) · Zara (Chief Compliance Officer, governance) | Promoted to POPULATED; owner title updated to CIO; version bumped. |

## 14. Audit / assurance

Vera continuously monitors the `NPAGateConvened` → `NewProductApproved` / `NewProductDeferred` event chain and the `TradeExecuted`-gate invariant. Findings: missing opinions, open gates past SLA, trades without approval events. Structural findings (substrate-gap-induced) flow to Atlas + Saskia. Reportable to Owen (CoSec, governance) + Helena (CRO, governance); critical breaches (trade without approval) flow to BRC chair immediately.
