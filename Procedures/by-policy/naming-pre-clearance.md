---
procedureId: PROC-CORP-NPC-01
title: Naming pre-clearance — TM + Banks Act §22 + CIPC + 11-language sweep
author: Owen (Company Secretary, governance) · Imani (Legal-as-code engineer) · Mira (Regulatory intelligence engineer)
date: 2026-05-15
owner: Owen (Company Secretary, governance) · Imani (Legal-as-code engineer)
status: POPULATED
policy-cited: corporate-naming-policy (planned by Owen)
system-capability: prototype/platform/legal/naming-pre-clearance.ts (PLANNED)
---

# Procedure — Naming pre-clearance — TM + Banks Act § 22 + CIPC + 11-language sweep

**Procedure ID:** PROC-CORP-NPC-01
**Owner:** Owen (Company Secretary, governance) — corporate-law surface; Imani (Legal-as-code engineer) — legal-as-code engineering substrate
**Approval:** Owen (Company Secretary, governance) for sub-marks; CEO for bank-name or subsidiary name; Board for any bank-name that diverges from a prior Board-approved name.
**Cadence:** Per-name; runs whenever any new external-facing named identity is proposed, renamed, or surfaced retroactively.
**Version:** v1.0 — 2026-05-15
**Status:** POPULATED

## 1. Source policy

- **`corporate-naming-policy`** — *planned (Owen, Company Secretary, governance)*. The policy supplies the *what*: every external-facing named identity the bank surfaces must pre-clear all four gates before external use. This procedure is the *how*. v0 of this procedure published ahead of v0 of the policy to anchor the retroactive run for the current bank-name selection per D-BANK-NAME-SELECTION; v1 of the procedure pairs to v0 of the policy when Owen authors it.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| Trade Marks Act 194 of 1993 (SA) — Class 36 + use-relevant classes | Pre-use TM clearance against registered marks; deceptive-similarity / class-overlap risk. | Gate 1 — counsel-executed TM cross-check. |
| Banks Act 94 of 1990 § 22 + Regulations Relating to Banks | A name may not be used that is undesirable, deceptively similar to a registered bank, or implies an unauthorised banking activity. PA engagement on bank-name selection. | Gate 2 — Imani (Legal-as-code engineer) + Mira (Regulatory intelligence engineer) joint s.22 opinion + PA notification log entry. |
| Companies Act 71 of 2008 § 11–§ 14 + Regulation 8 + CIPC name-availability | Name must be available, not undesirable, not falsely imply state / official endorsement; reservation under s.12. | Gate 3 — CIPC name-reservation filing. |
| Constitution of the Republic of South Africa § 6 (eleven official languages) + POPIA s.1 (where the named identity processes personal information) | Named identities surfaced to SA customers must not carry inadvertent meanings in any of the eleven SA official languages; institutional-international set covers cross-border counterparty exposure. | Gate 4 — written 11-language sweep + institutional-international set, native-speaker / linguist sign-off. |

> *Citation resolution to ORG-CORP-* IDs is pending Mira's registration of Domain — Corporate naming in the obligations register. v1 of this procedure resolves the `[citation: TBC — ORG-CORP-*]` placeholders.*

## 3. Purpose

Govern the pre-clearance of every named identity the bank surfaces externally — bank name, product family name, subsidiary name, regulatory-correspondence contact name, customer-facing brand sub-mark — before the name is used in any external context (counterparty contracts, customer-facing brand, regulatory correspondence, public domains, brand marks, product families). The procedure produces a composite `NamingPreClearanceApproved` event anchored to four typed gate-pass events. No named identity may be used externally until the composite approval fires.

The procedure also runs **retroactively** against named identities already in use (today: the current bank-name selection per D-BANK-NAME-SELECTION). Retroactive runs follow the same four-gate path; gate failures trigger D-BANK-NAME-FALLBACK or equivalent re-scoping decisions.

## 4. Trigger

Any of:
- A new external-facing name proposed (bank name, product family, subsidiary, customer-facing sub-mark, regulatory-correspondence contact).
- A renaming of an existing external-facing name.
- A name change driven by regulatory direction (e.g. PA directive requiring a name change).
- A name change driven by counterparty / market intelligence (e.g. brand-collision discovery post-launch).
- **Retroactive trigger** — a named identity surfaced before this procedure existed (today: "Hoz" per D-BANK-NAME-SELECTION).

The trigger emits `NamingPreClearanceRequested { nameId, candidate, sponsoringAgent, useContext, retroactive: boolean }`.

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Sponsoring agent proposes the name and fires `NamingPreClearanceRequested { nameId, candidate, sponsoringAgent, useContext, retroactive }`. Sponsoring agent's mandate must extend to the named-identity class. | Sponsoring agent (e.g. Linnea for brand mark; Saskia for product family; Owen for bank name; Niko for customer-facing sub-mark) | `prototype/platform/legal/naming-pre-clearance.ts` (`PLANNED`) | The request is the trigger; subsequent gate runs are state transitions on the same `nameId`. |
| 2 | **Gate 1 — Trade Marks Act 194 of 1993 cross-check.** Imani routes Gate 1 to external counsel: Class 36 (banking / financial services) + any class relevant to the named-identity's use (Class 35 / 9 / 41 commonly). SA + foreign-jurisdiction-set. Output: written TM-clearance opinion. | Imani (agent) + external counsel | `prototype/platform/legal/naming-pre-clearance.ts` + counsel routing per Imani's licence-application brief | Emits `NamingPreClearanceGatePassed { nameId, gateId: "tm-clearance", evidenceRef }` or `NamingPreClearanceGateFailed { nameId, gateId, failureReason, evidenceRef }`. |
| 3 | **Gate 2 — Banks Act 94 of 1990 § 22 use-of-name signals.** Imani + Mira jointly run: (a) deceptive-similarity test against all SA-licensed banks, DFIs, and foreign-bank branches; (b) unauthorised-implication test; (c) PA notification timing. Output: written s.22 opinion + PA notification log entry. | Imani (agent) + Mira (agent) | `prototype/platform/legal/naming-pre-clearance.ts` | Emits `NamingPreClearanceGatePassed { gateId: "banks-act-s22" }` or `NamingPreClearanceGateFailed`. Gate 2 sequences in parallel with Gate 1 where TM clearance is not a precondition to s.22 analysis. |
| 4 | **Gate 3 — Companies Act 71 of 2008 + CIPC name reservation.** Imani + external counsel: CIPC name-availability database scan; reservation under s.12 + Reg 8; objection-handling plan for contested reservations. Output: filed CIPC name reservation; objection-handling plan. | Imani (agent) + external counsel | `prototype/platform/legal/naming-pre-clearance.ts` | Emits `NamingPreClearanceGatePassed { gateId: "cipc-reservation" }` or `NamingPreClearanceGateFailed`. Gate 3 sequences after Gate 1 where reservation timing depends on TM clearance. |
| 5 | **Gate 4 — Eleven-language sweep (SA official languages + institutional-international set).** Languages: English, isiZulu, isiXhosa, Afrikaans, Sesotho, Sepedi, Setswana, siSwati, Tshivenda, Xitsonga, isiNdebele (SA official eleven) + French, Spanish, Portuguese, Mandarin, Arabic, Russian (institutional-international set). Three-letter or four-letter names: expand scope to include common dictionary-lookup matches. PAX (Role researcher) + Imani coordinate native-speaker / linguist sign-off. Output: written language-clearance opinion. | PAX (agent) + Imani (agent) + linguist sign-off (human) | `prototype/platform/legal/naming-pre-clearance.ts` | Emits `NamingPreClearanceGatePassed { gateId: "language-sweep" }` or `NamingPreClearanceGateFailed`. Gates 2, 4 can run in parallel with Gate 1. Gate 4 requires native-speaker / linguist human sign-off — tracked exception. |
| 6 | When all four gates emit `GatePassed` for `nameId`, sponsoring agent fires `NamingPreClearanceApproved { nameId, candidate, gateRefs[4], approvedAt }`. Named identity may be used externally. | Sponsoring agent | `prototype/platform/legal/naming-pre-clearance.ts` (gate-aggregation) | The composite event is the authoritative approval; downstream consumers (brand-mark publication, domain registration, regulatory correspondence) gate on its presence. |
| 7 | If any gate fires `GateFailed`, sponsoring agent fires `NamingPreClearanceFailed { nameId, failedGateId, recommendedRemediation }`. Named identity cannot be used externally; a fallback name or re-scoping is required. Failure routes via `AgentEscalation` to Owen for bank-name failures, or to the sponsoring governance seat for product / sub-mark failures. | Sponsoring agent | `@platform/event-store` ✓ | Bank-name failure triggers D-BANK-NAME-FALLBACK or equivalent CEO decision. |
| 8 | **Retroactive runs:** if a named identity is already in use before this procedure existed (today: "Hoz" per D-BANK-NAME-SELECTION), the procedure runs retroactively with `retroactive: true`. Gate failures trigger D-BANK-NAME-FALLBACK or equivalent. Sponsoring agent for the retroactive run is Imani per `claude/imani-hoz-name-clearance-scoping`. | Imani (agent) | as Steps 2–6 | Retroactive runs are the same procedure with `retroactive: true`; auditability is identical. |

## 6. Reconciliation

- **Events produced (per name):** `NamingPreClearanceRequested` × 1; `NamingPreClearanceGatePassed` or `NamingPreClearanceGateFailed` × 4 (one per gate); `NamingPreClearanceApproved` (terminal-success) or `NamingPreClearanceFailed` (terminal-failure) × 1.
- **Reconciliation check (Vera):** every named identity surfaced in `prototype/dashboard/public/_brand.css`, brand SVGs, customer correspondence headers, regulatory-cover-sheets, and public domains has a current `NamingPreClearanceApproved` event with all four `GatePassed` references resolving.
- **Drift detection:** any named identity in use without a current approval fires a Vera Wave-4 finding (substrate gap — planned after Wave-4 #20 RAS-breach).
- **Cross-domain check:** every domain registered (Devon + Tomas's `claude/devon-tomas-hoz-domain-registration`) and every brand-mark published has a resolvable `NamingPreClearanceApproved` in its lineage.
- **Failure mode:** any gate fails → `NamingPreClearanceFailed` event; no external use until a new `NamingPreClearanceApproved` fires for an alternative name.

## 7. Evidence / artefacts

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

## 8. Manual steps

- **Gate 1 (TM cross-check)** — counsel-executed; the procedure orchestrates routing, but the substantive opinion is human counsel work. Tracked exception under Principle 3 — the `evidenceRef` is the bridge.
- **Gate 2 (Banks Act § 22)** — PA notification is human correspondence today. The procedure logs the notification as a typed event; the substance is human.
- **Gate 4 (11-language sweep)** — requires native-speaker / linguist sign-off. Automated pre-screening via dictionary-lookup is possible; the authoritative sign-off is human until LLM-assisted linguistic clearance reaches a defensible quality bar.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Gate 1 (TM) fails — registered mark collision | Counsel TM opinion | Owen — bank-name fallback decision (D-BANK-NAME-FALLBACK pattern); sponsoring governance seat for sub-marks |
| Gate 2 (Banks Act § 22) fails — deceptive similarity / unauthorised implication | Imani + Mira joint opinion + PA signal | Owen + Zara (Chief Compliance Officer, governance) — re-scoping; PA early engagement |
| Gate 3 (CIPC) fails — name unavailable / objected | CIPC filing response | Imani — alternative reservation; objection-handling plan |
| Gate 4 (11-language) fails — adverse meaning surfaced | PAX + Imani sweep result | Owen + Linnea (Brand & design lead) — re-scoping; sub-brand review |
| Retroactive-run fails for in-use named identity | Imani's retroactive run; Vera drift recon | Owen + CEO — D-BANK-NAME-FALLBACK or equivalent; communications plan for the in-flight name |
| Named identity used externally without `NamingPreClearanceApproved` | Vera Wave-4 finding-pipeline (planned) | Owen + Vera — finding registered; remediation tracked to closure |

## 10. Related procedures

- `agent-runtime-deploy.md` — populated; substrate procedure; this procedure depends on it for typed event family rollout.
- `popia-io-designation.md` (PROC-PRIV-IO-DSG-01) — named identity may involve PAIA s.51 manual updates.
- Devon + Tomas domain registration (`claude/devon-tomas-hoz-domain-registration`) — downstream consumer; gates on `NamingPreClearanceApproved`.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-09 | Atlas (Core banking platform architect, via Scrooge) | Initial STUB. Anchors the retroactive run for D-BANK-NAME-SELECTION. Five substrate gaps named (typed event family, substrate module, Vera recon, retroactive Hoz run, Owen's corporate-naming-policy partner). |
| v1.0 | 2026-05-15 | Owen (Company Secretary, governance) · Imani (Legal-as-code engineer) · Mira (Regulatory intelligence engineer) | Promoted to POPULATED: full 12-section body; YAML frontmatter aligned to standard; all 14 original sections consolidated to 12-section canonical template; no substantive content removed. |

## 12. Audit / assurance

Vera (Internal-audit / continuous-assurance engineer)'s planned Wave-4 finding-pipeline for unapproved named identities asserts:
1. Every named identity surfaced in `prototype/dashboard/public/_brand.css`, brand SVGs, customer correspondence headers, regulatory-cover-sheets, and public domains has a current `NamingPreClearanceApproved`.
2. The four `GatePassed` references resolve to immutable evidence artefacts.
3. Retroactive runs against previously-surfaced names are complete (today: "Hoz").
4. Failed gates have a registered fallback decision (D-BANK-NAME-FALLBACK or equivalent).

Owen performs an annual review of all current named identities against the approved-names register; findings are reported to the CEO.
