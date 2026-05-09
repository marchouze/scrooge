---
procedureId: PROC-CORP-NPC-01
title: Naming pre-clearance — TM + Banks Act + CIPC + 11-language sweep
author: Atlas (Core banking platform architect)
date: 2026-05-09
owner: Owen (Company Secretary, governance) — corporate-law surface; Imani (Legal-as-code engineer) — legal-as-code engineering substrate
status: STUB
policy-cited: corporate-naming-policy (planned by Owen)
system-capability: prototype/platform/legal/naming-pre-clearance.ts (planned)
---

# Procedure — Naming pre-clearance — TM + Banks Act + CIPC + 11-language sweep

**Procedure ID:** PROC-CORP-NPC-01
**Owner:** Owen (Company Secretary, governance) · Imani (Legal-as-code engineer)
**Approval:** Pending — corporate-naming-policy (Owen, planned) is the procedure-pair partner; v0 STUB published ahead of policy to anchor the retroactive run for the current bank-name selection (D-BANK-NAME-SELECTION).
**Cadence:** Per-name; runs whenever any new external-facing named identity is proposed, renamed, or surfaced retroactively.
**Version:** v0.1 — 2026-05-09
**Status:** **STUB** — engineering substrate authored; policy-pair partner (Owen) outstanding; typed-event family (Atlas v1) pending; retroactive run for "Hoz" sequenced via `claude/imani-hoz-name-clearance-scoping`.

## 1. Source policy

- **`corporate-naming-policy`** — *planned (Owen, Company Secretary, governance)*. The policy supplies the *what*: every external-facing named identity the bank surfaces — bank name, product family name, subsidiary name, regulatory-correspondence contact name, customer-facing brand sub-mark — must pre-clear all four gates before external use. v0 of this procedure publishes ahead of v0 of the policy to anchor the retroactive run for the current bank-name selection; v1 of the procedure pairs to v0 of the policy when Owen authors it.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| Trade Marks Act 194 of 1993 (SA) — Class 36 (financial services) and use-relevant classes (Class 35 / 9 / 41 etc.) | Pre-use TM clearance against registered marks; deceptive-similarity / class-overlap risk. | Gate 1 — counsel-executed TM cross-check. |
| Banks Act 94 of 1990 § 22 (use of name "bank") + Regulations Relating to Banks | A name may not be used that is undesirable, deceptively similar to a registered bank, or implies an unauthorised banking activity. SARB Prudential Authority engagement on bank-name selection. | Gate 2 — Imani (Legal-as-code engineer) + Mira (Compliance / RegTech engineer) joint s.22 opinion + PA notification log entry. |
| Companies Act 71 of 2008 § 11–§ 14 + Regulation 8 + CIPC name-availability | Name must be available, not undesirable, not falsely imply state / official endorsement; reservation under s.12. | Gate 3 — CIPC name-reservation filing; objection-handling plan. |
| Constitution of the Republic of South Africa § 6 (eleven official languages) + POPIA where the named identity processes personal information | Named identities surfaced to SA customers must not carry inadvertent meanings in any of the eleven SA official languages; institutional-international set covers cross-border-counterparty exposure. | Gate 4 — written 11-language sweep + institutional-international set sweep, native-speaker / linguist sign-off. |

> *Citation resolution to obligations-register IDs is pending Mira's registration of Domain — Corporate naming. v1 of this procedure resolves the `[citation: TBC — ORG-CORP-*]` placeholders.*

## 3. Purpose

Govern the pre-clearance of every named identity the bank surfaces externally, before the name is used in any external context (counterparty contracts, customer-facing brand, regulatory correspondence, public domains, brand mark, product family). The procedure produces a composite `NamingPreClearanceApproved` event keyed to a typed name-clearance file, anchored to four typed gate-pass events. The named identity cannot be used externally until the composite approval fires.

The procedure runs **retroactively** against named identities already in use (today: the current bank-name selection per D-BANK-NAME-SELECTION). Retroactive runs follow the same four-gate path; gate-failures trigger D-BANK-NAME-FALLBACK or equivalent re-scoping decisions.

## 4. Trigger

Any of:

- A new external-facing name proposed (bank name, product family, subsidiary, customer-facing sub-mark, regulatory-correspondence contact).
- A renaming of an existing external-facing name.
- A name change driven by regulatory direction (e.g. PA Directive requiring a name change).
- A name change driven by counterparty / market intelligence (e.g. brand-collision discovery post-launch).
- **Retroactive trigger** — a named identity surfaced before this procedure existed (today: "Hoz" per D-BANK-NAME-SELECTION; sequenced via Imani's `claude/imani-hoz-name-clearance-scoping`).

The trigger is the typed event `NamingPreClearanceRequested { nameId, candidate, sponsoringAgent, useContext, retroactive: boolean }` (Atlas v1 substrate gap — typed event family pending).

## 5. Scope of pre-clearance — the four gates

Each candidate name passes through four gates before it can be used externally.

### Gate 1 — Trade Marks Act 194 of 1993 cross-check

- **Class 36** (banking / financial services) for any product or sub-brand.
- Plus any class relevant to the named-identity's use (Class 35 / 9 / 41 commonly).
- SA + foreign-jurisdiction-set defined per Imani (Legal-as-code engineer)'s TM scoping brief.
- Counsel-executed; Imani routes to external counsel via `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md`.
- **Output:** written TM-clearance opinion.
- **Event:** `NamingPreClearanceGatePassed { nameId, gateId: "tm-clearance", evidenceRef }` or `NamingPreClearanceGateFailed { nameId, gateId: "tm-clearance", failureReason, evidenceRef }`.

### Gate 2 — Banks Act 94 of 1990 § 22 use-of-name signals

- **Deceptive-similarity test:** any SA-licensed bank, DFI, or foreign-bank-branch name with a deceptively-similar mark.
- **Unauthorised-implication test:** any name that implies an unauthorised banking activity.
- **SARB Prudential Authority engagement:** notification timing on the bank-name choice.
- Imani (Legal-as-code engineer) + Mira (Compliance / RegTech engineer) joint.
- **Output:** written s.22 opinion + PA notification log entry.
- **Event:** `NamingPreClearanceGatePassed { gateId: "banks-act-s22" }` or `NamingPreClearanceGateFailed`.

### Gate 3 — Companies Act 71 of 2008 + CIPC name reservation

- CIPC name-availability database scan.
- Reservation under s.12 + Reg.8.
- Objection-handling plan for contested reservations.
- Imani (Legal-as-code engineer) + external counsel.
- **Output:** filed CIPC name reservation; objection-handling plan.
- **Event:** `NamingPreClearanceGatePassed { gateId: "cipc-reservation" }` or `NamingPreClearanceGateFailed`.

### Gate 4 — Eleven-language sweep (SA official languages + institutional-international set)

- **Eleven SA official languages:** English, isiZulu, isiXhosa, Afrikaans, Sesotho, Sepedi, Setswana, siSwati, Tshivenda, Xitsonga, isiNdebele.
- **Institutional-international set:** French, Spanish, Portuguese, Mandarin, Arabic, Russian.
- **Three-letter or four-letter names:** false-positive risk elevated; expand scope to include common dictionary-lookup matches.
- Native-speaker / linguist sign-off via PAX (Role researcher) + Imani (Legal-as-code engineer).
- **Output:** written language-clearance opinion across the language set.
- **Event:** `NamingPreClearanceGatePassed { gateId: "language-sweep" }` or `NamingPreClearanceGateFailed`.

## 6. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Name proposed by sponsoring agent (e.g. Linnea (Brand & design lead) for a brand mark; Saskia (Head of Global Markets, governance) for a product family; Owen (Company Secretary, governance) for the bank name; Niko (Sales / CRM engineer) for a customer-facing sub-mark). | sponsoring agent | `prototype/platform/legal/naming-pre-clearance.ts` (planned) | Sponsoring agent's mandate must extend to the named-identity class. |
| 2 | Sponsoring agent fires `NamingPreClearanceRequested { nameId, candidate, sponsoringAgent, useContext, retroactive }`. | sponsoring agent | `@platform/event-store` (typed event — Atlas v1 substrate gap) | The request is the trigger; subsequent gate runs are state transitions on the same `nameId`. |
| 3 | Imani (Legal-as-code engineer) routes Gate 1 (TM) + Gate 3 (CIPC) to external counsel; Imani + Mira (Compliance / RegTech engineer) drive Gate 2 (s.22); PAX (Role researcher) + Imani drive Gate 4 (11-language sweep). | Imani · Mira · PAX | `prototype/platform/legal/naming-pre-clearance.ts` + counsel routing per Imani's licence-application brief | Gates run in parallel where possible; Gate 3 (CIPC) sequences after Gate 1 (TM) where reservation timing depends on TM clearance. |
| 4 | Each gate emits `NamingPreClearanceGatePassed { nameId, gateId, evidenceRef }` or `NamingPreClearanceGateFailed { nameId, gateId, failureReason, evidenceRef }` with the supporting opinion / clearance / sweep result attached. | per-gate actor | `@platform/event-store` (typed events — Atlas v1 substrate gap) | Gate-result events are the audit trail; `evidenceRef` is the immutable artefact pointer. |
| 5 | When all four gates have emitted `GatePassed` for `nameId`, sponsoring agent fires `NamingPreClearanceApproved { nameId, candidate, gateRefs[4], approvedAt }`. The named identity can be used externally. | sponsoring agent | `prototype/platform/legal/naming-pre-clearance.ts` (gate-aggregation) | The composite event is the authoritative approval; downstream consumers (brand-mark publication, domain registration, regulatory correspondence) gate on its presence. |
| 6 | If any gate fires `GateFailed`, sponsoring agent fires `NamingPreClearanceFailed { nameId, failedGateId, recommendedRemediation }`. The named identity cannot be used externally; a fallback name (or a re-scoping) is required. | sponsoring agent | `@platform/event-store` | Failure routes via `AgentEscalation` to Owen (Company Secretary, governance) for board-level visibility on bank-name failures, or to the sponsoring governance seat for product / sub-mark failures. |
| 7 | If the named identity is already in use (e.g. "Hoz" was selected before this procedure existed), the procedure runs **retroactively** — Gate-failures trigger D-BANK-NAME-FALLBACK or equivalent. The sponsoring agent for the retroactive run is Imani (Legal-as-code engineer) per `claude/imani-hoz-name-clearance-scoping`. | Imani | `prototype/platform/legal/naming-pre-clearance.ts` + retroactive-run flag on `NamingPreClearanceRequested` | Retroactive runs are the same procedure with `retroactive: true`; downstream auditability is identical. |

## 7. Reconciliation

- **Events produced (per name):** `NamingPreClearanceRequested` × 1; `NamingPreClearanceGatePassed` or `NamingPreClearanceGateFailed` × 4 (one per gate); `NamingPreClearanceApproved` (terminal-success) or `NamingPreClearanceFailed` (terminal-failure) × 1.
- **Reconciliation check (Vera, Internal-audit / continuous-assurance engineer):** every named identity surfaced in `prototype/dashboard/public/_brand.css`, brand SVGs, customer correspondence headers, regulatory-cover-sheets, public domains has a current `NamingPreClearanceApproved` event with all four `GatePassed` references resolving.
- **Drift detection:** any named-identity in use without a current approval fires a Vera Wave-4 finding (substrate gap — Vera Wave-4 finding-pipeline for unapproved named-identities; sequenced after Wave-4 #20 RAS-breach).
- **Cross-domain check:** every domain registered (Devon + Tomas's `claude/devon-tomas-hoz-domain-registration`) and every brand-mark published has a resolvable `NamingPreClearanceApproved` in its lineage.
- **Failure mode:** rejected at any gate — no `NamingPreClearanceApproved` event; the failure surfaces as `AgentEscalation` to Owen (bank-name) or the sponsoring governance seat (sub-marks).

## 8. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `NamingPreClearanceRequested` event | Event log | Indefinite (P1) | Internal |
| `NamingPreClearanceGatePassed` × 4 / `GateFailed` events | Event log | Indefinite (P1) | Internal |
| `NamingPreClearanceApproved` / `Failed` event | Event log | Indefinite (P1) | Internal |
| Counsel TM-clearance opinion (Gate 1) | External-counsel deliverable; archived per Imani's substrate (PDF / HTML) | Indefinite | Counsel-confidential |
| PA s.22 opinion + notification log entry (Gate 2) | Imani + Mira joint deliverable; PA correspondence register | Indefinite | Regulator-confidential |
| CIPC name-reservation certificate (Gate 3) | CIPC filing register | Indefinite | Internal |
| 11-language sweep written opinion (Gate 4) | PAX + Imani joint deliverable | Indefinite | Internal |
| Composite `NamingPreClearanceFile<nameId>` document | `Owner Inbox/<date>_naming-pre-clearance/<nameId>.md` | Indefinite | Internal |

## 9. Manual steps

- **Gate 1 (TM cross-check)** is counsel-executed; the procedure orchestrates the routing, but the substantive opinion is human counsel work. Tracked exception under Principle 3 — counsel work cannot be fully automated; the `evidenceRef` is the bridge.
- **Gate 2 (Banks Act § 22)** has a regulator-engagement element (PA notification) that is human correspondence today. The procedure logs the notification as a typed event; the substance is human.
- **Gate 4 (11-language sweep)** requires native-speaker / linguist sign-off. Automation can pre-screen with dictionary-lookup, but the authoritative sign-off is human until LLM-assisted linguistic clearance reaches a defensible quality bar.

## 10. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Gate 1 (TM) fails — registered mark collision | Counsel TM opinion | Owen (Company Secretary, governance) — bank-name fallback decision (D-BANK-NAME-FALLBACK pattern); sponsoring governance seat for sub-marks |
| Gate 2 (Banks Act § 22) fails — deceptive similarity / unauthorised implication | Imani + Mira joint opinion + PA signal | Owen + Zara (Chief Compliance Officer, governance) — re-scoping; PA early engagement |
| Gate 3 (CIPC) fails — name unavailable / objected | CIPC filing response | Imani — alternative reservation; objection-handling plan |
| Gate 4 (11-language) fails — adverse meaning surfaced | PAX + Imani sweep result | Owen + Linnea (Brand & design lead) — re-scoping; sub-brand review |
| Retroactive-run fails for in-use named identity | Imani's retroactive run; Vera drift recon | Owen + CEO — D-BANK-NAME-FALLBACK or equivalent; communications plan for the in-flight name |
| Named identity used externally without `NamingPreClearanceApproved` | Vera Wave-4 finding-pipeline (planned) | Owen + Vera — finding registered; remediation tracked to closure |

## 11. Related procedures

- **`Procedures/by-policy/agent-runtime-deploy.md`** — *populated (Atlas + Senna + Rashida)* — substrate procedure that this procedure depends on for the typed event family rollout.
- **Imani's parallel scoping (retroactive run for "Hoz"):** `claude/imani-hoz-name-clearance-scoping` — the four scoping documents Imani is producing today are the retroactive Gate-1, Gate-2, Gate-3, Gate-4 inputs for the current bank-name selection.
- **Devon + Tomas's parallel work:** `claude/devon-tomas-hoz-domain-registration` — domain registration is a downstream consumer; gates on `NamingPreClearanceApproved`.
- **Owen-owned policy partner (planned):** `corporate-naming-policy` — supplies the *what* this procedure implements; v0 STUB owed to Owen as the procedure-pair partner.

## 12. Substrate gaps named (NOT built in this PR)

1. **Typed event family** — `NamingPreClearanceRequested` / `NamingPreClearanceGatePassed` / `NamingPreClearanceGateFailed` / `NamingPreClearanceApproved` / `NamingPreClearanceFailed` — Atlas v1 substrate task. Add to `prototype/platform/event-store/event-types.ts` once a clean window opens (currently busy with FAIS event family + routing-policy reconciliation against PR #49).
2. **`prototype/platform/legal/naming-pre-clearance.ts`** — the substrate-side TypeScript module that performs gate-result aggregation and emits the composite events. Atlas (Core banking platform architect) + Imani (Legal-as-code engineer) joint follow-on.
3. **Vera Wave-4 finding-pipeline for unapproved named-identities** — Vera (Internal-audit / continuous-assurance engineer) planning task; sequenced after Wave-4 #20 RAS-breach.
4. **Retroactive run for "Hoz"** — the procedure runs *retroactively* against the current bank-name selection; the four gates Imani is currently scoping (PR via `claude/imani-hoz-name-clearance-scoping`) are the retroactive Gate-1, Gate-2, Gate-3, Gate-4 runs. Cross-reference Imani's PR.
5. **Procedure-pair partner: corporate-naming-policy (Owen)** — the procedure cites a `corporate-naming-policy` that Owen (Company Secretary, governance) has not yet authored; the policy supplies the *what* (the rule that all named identities pre-clear); the procedure supplies the *how*. v0 STUB acceptable; v1 owed to Owen.

## 13. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Atlas (Core banking platform architect, via Scrooge) | Initial STUB. Anchors the retroactive run for the current bank-name selection (D-BANK-NAME-SELECTION) and forward-runs for any subsequent named identity. Format follows Niko's PROC-CRM-FA-01 + Sade's PROC-FAIS-KI-FAP-01. Five substrate gaps named (typed event family, substrate module, Vera recon, retroactive Hoz run, Owen's corporate-naming-policy partner). |

## 14. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer)'s planned Wave-4 finding-pipeline for unapproved named-identities asserts: (a) every named identity surfaced in `prototype/dashboard/public/_brand.css`, brand SVGs, customer correspondence headers, regulatory-cover-sheets, and public domains has a current `NamingPreClearanceApproved`; (b) the four `GatePassed` references resolve to immutable evidence; (c) retroactive runs against previously-surfaced names are complete (today: "Hoz"); (d) failed gates have a registered fallback decision (D-BANK-NAME-FALLBACK or equivalent).
