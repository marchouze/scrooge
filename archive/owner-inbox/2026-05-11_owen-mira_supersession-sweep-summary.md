---
title: Supersession sweep — 14 stale Owner Inbox candidates (results)
author: Owen (Company Secretary, governance), Mira (Compliance / RegTech engineer)
date: 2026-05-11
summary: CEO-authorised supersession sweep over 14 stale Owner Inbox candidates. 11 items moved to actioned/ with verified `superseded-by` annotations; 3 items left in place with reasoning (HOZ-domain defer record, fix-(a) demonstration record, Imani clause-library v0 run-record, SAMOS non-clearing decision record). Surfaces a recon-substrate gap — there is no pipeline asserting "every superseded record has a `superseded-by` annotation".
decision-required: false
---

# Supersession sweep — 14 stale Owner Inbox candidates (results)

**Authors:** Owen (Company Secretary, governance — primary), Mira (Compliance / RegTech engineer — citation-discipline reviewer).
**Date:** 2026-05-11
**For:** Marc (CEO).
**Authority:** CEO sweep authorisation 2026-05-11 (Scrooge dispatch, this sweep).
**Citation chain:** Principles 1, 2, 6 (`Principles/1-events-are-truth.md`, `Principles/2-citation-discipline.md`, `Principles/6-single-graph-discipline.md`); the `feedback_canonical_source_registry` rule; the `feedback_team_inbox_hygiene` memory; the `Owner Inbox/_frontmatter-convention.md` authoring rule.

> **Derivation note (Principle 6 — downward).** This summary derives from (a) reading each candidate file and its alleged superseder; (b) verifying every `decision-id` cited as a superseder is present in the codebase as a `^decision-id: D-X` declaration in a canonical record; (c) the inbox-hygiene rule that completed work moves to `actioned/`. No new substance is authored here — the substantive supersession statements live in each moved file's `superseded-by` frontmatter block.

---

## 1. Sweep result table

| # | Candidate | Result | Primary superseder applied | One-line justification |
|---|---|---|---|---|
| 1 | `2026-05-06_client-master-and-continuous-kyc.md` + `.html` | superseded | `D-MARKETS-SCHEMA-FOUNDATION` | Counterparty event family at `prototype/domains/customer/types.ts` is the canonical lifecycle and projection shape; the markdown design no longer authoritative. (Imani's in-flight Party-register substrate is forward-noted in the annotation but not cited as an approved decision — `D-PARTY-REGISTER` is not yet in the CeoDecision set.) |
| 2 | `2026-05-06_institutional-client-lifecycle-proposal.md` | superseded | `D-MARKETS-SCHEMA-FOUNDATION` | Same — counterparty event family in code is canonical; the nine-stage markdown lifecycle pre-dates and is overtaken by the M1 substrate. |
| 3 | `2026-05-06_org-structure.md` + `.html` | superseded | `D-THIN-HUMAN-LAYER-MINIMUM` (+ `Team/_team-roster.json` + `D-LEGAL-ENTITY-TREE-V0`) | Roster is now `Team/_team-roster.json` (canonical per CLAUDE.md `Team structure`); the 26-seat structure pre-dates the build-phase pause on real employees beyond statutory minimum. |
| 4 | `2026-05-06_governance-framework.md` + `.html`; `2026-05-06_governance-presentation.md` + `.html` + `.pdf` (5 files) | superseded | `D-THIN-HUMAN-LAYER-MINIMUM` (+ `D-LEGAL-ENTITY-TREE-V0` + `D-FSP-LICENCE-NECESSITY` + `2026-05-09_owen_thin-human-layer-composition-final.md`) | Owen's final-composition paper + the three named CeoDecisions (all verified as `^decision-id:` in canonical mirror records) supersede the initial framework's licence-day-composition + legal-entity + FSP-licence framing. Owen authored the superseder, strong prior held on read of both. |
| 5 | `2026-05-06_principles-consolidation-proposal.md` | superseded | `Principles/1..7-*.md` (canonical files) | Proposal would have collapsed P2+P6+P7 into one principle; the actual outcome (per CLAUDE.md `Principle-numbering history`) was that only old-P6 + old-P7 collapsed into current P6, P2 stayed separate, and a new P7 (autonomous-by-default) was added 2026-05-07. The proposal is contradicted by the canonical principles files. |
| 6 | `2026-05-06_continuous-controls-programme.md` | superseded | Vera Wave-4 recon (live in `prototype/platform/recon/`) + `feedback_canonical_source_registry` | Wave-4 pipelines (#5–#16+) and the agent-discipline-assurance extension are operational; the wave-1/2/3 framing here is overtaken. The canonical-source-registry rule (Owen 2026-05-07; enforced by `prose-duplication.ts` Wave-4 #16) supersedes the catalogue framing. |
| 7 | `2026-05-06_local-base-infrastructure-spec.md`; `2026-05-05_local-prototype-plan.md`; `2026-05-05_core-platform-architecture.md` (3 files) | superseded | `D-EVENT-STORE-SCALING` (+ `D-RMS-PHASE-1` + `D-DATA-PROVENANCE-SUBSTRATE`) | All three post-2026-05-09 substrate decisions materially update the architecture set in these v0.1 / pre-build specs. The substrate has been built and matured well past the spec text. (Note: the dispatch listed two of these as 2026-05-06 dated; actual filenames are 2026-05-05.) |
| 8 | `2026-05-06_dashboard-continuous-derivation.md` | superseded | `D-EVENT-STORE-SCALING` (slice-3B) + `feedback_cache_in_commit_graph_anti_pattern` | The committed-cache-in-commit-graph approach in this delivery is the precise anti-pattern superseded by slice-3B (cache-from-commit-graph) and PR #157. |
| 9 | `2026-05-06_reporting-capability-spec.md`; `2026-05-06_ceo-decision_reporting-capability-build-authorisation.md` (2 files) | superseded | `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` (+ slices 2-6) | The current canonical build plan is `D-REPORTING-CAPABILITY-M2-M3-BUILD-PLAN` with slices 2 / 3 / 4 / 6 already shipped (period-close / BA-325 LCR / BA-700 / IFRS statements). Old `ceo-decision_<slug>` naming pattern is no longer canonical. |
| 10 | `2026-05-06_cae-shortlist.md`; `2026-05-06_cae-hire-confirmation.md`; `2026-05-06_ciso-shortlist.md`; `2026-05-06_ciso-hire-confirmation.md` (4 files) | superseded | `D-THIN-HUMAN-LAYER-MINIMUM` (+ `project_ai_driven_bank` memory) | Build-phase has no real employees beyond statutory minimum (memory set 2026-05-07); CAE / CISO seats are not in the licence-day six-humans-plus-Marc-plus-audit-firm composition. CAE function sits with Vera; CISO function sits with Senna (engineering-fronted). |
| 11a | `2026-05-07_ceo-decision_brand-design-hire.md` | superseded | `2026-05-07_scrooge_ceo-decision-record_d-brand-design-hire.md` (mirror) | Old `ceo-decision_<slug>` naming pattern; the canonical `scrooge_ceo-decision-record_d-<id>.md` mirror exists with proper provenance header. |
| 11b | `2026-05-07_ceo-decision_markets-schema-foundation.md` | superseded | `2026-05-07_scrooge_ceo-decision-record_d-markets-schema-foundation.md` (mirror) | Same — canonical mirror exists. |
| 11c | `2026-05-07_ceo-decision_samos-non-clearing.md` | **NOT moved — see §2** | n/a | No `scrooge_ceo-decision-record_d-samos-non-clearing.md` mirror exists; this file is the only record of the SAMOS non-clearing decision. |
| 12 | `2026-05-09_scrooge_ceo-decision-record_d-hoz-domain-registration-set-defer.md` | **NOT moved — see §2** | n/a | The file IS itself the canonical CeoDecision record (`D-HOZ-DOMAIN-REGISTRATION-SET`, action: defer); the defer state is still active (no later `D-HOZ-DOMAIN-*` events in the codebase). Decision records of resolved decisions stay in `Owner Inbox/` per the existing convention. |
| 13 | `2026-05-07_pax_brand-design-role-brief.md`; `2026-05-07_linnea_inaugural-brand-package.md` (2 files) | superseded | `D-BRAND-DESIGN-HIRE` (PAX brief: decision approved); `D-BANK-NAME-SELECTION` + Linnea v3 / v3-2 brand-application files (Linnea inaugural package) | PAX role brief: decision approved 2026-05-07; brief moves to actioned per inbox-hygiene rule (decision-required flipped to false in annotation). Linnea inaugural package: bank-name resolved to Hoz under D-BANK-NAME-SELECTION (revised 2026-05-09); v3 / v3-2 brand-application files supersede the inaugural-package logo / palette / typography sections. |
| 14 | `2026-05-07_fix-a-second-wave-bea-rohan-niko-tomas.md`; `2026-05-07_imani_clause-library-v0-and-fix-a-demonstration.md` (2 files) | **NOT moved — see §2** | n/a | These are records-of-runs (record of what already happened); the substrate they describe matured and is in code (`prototype/platform/legal/clause-library.schema.json`, `prototype/platform/legal/_clause-library.md`, `prototype/platform/accounting/`, etc.) but the run records themselves are permanent audit-trail artefacts, not action items. They are not contradicted; they are completed. |

**Totals:** 14 candidate items reviewed; **20 files moved** to `Owner Inbox/actioned/` with `superseded-by` frontmatter (md + html + pdf siblings counted); **5 files left in place** across 3 candidate slots (SAMOS decision record; HOZ-domain defer record; the two fix-(a) run records — counts file twins).

---

## 2. Files NOT moved — reasoning

### 2.1 `2026-05-07_ceo-decision_samos-non-clearing.md` (item 11c)

The file pre-dates the `scrooge_ceo-decision-record_d-<id>.md` naming convention, but a search for any `D-SAMOS-NON-CLEARING` mirror returns no canonical record. The file *is* itself the only record of the SAMOS non-clearing decision (Marc's chat-intake → captured in Owen Inbox → no later mirror authored). The dispatch's stated rationale ("each has a properly-named `2026-05-07_scrooge_ceo-decision-record_d-<id>.md` mirror") does not hold for this file.

**Recommendation (recorded for Marc / Scrooge to action):** either (a) author a `2026-05-09+_scrooge_ceo-decision-record_d-samos-non-clearing.md` mirror file with the proper provenance header (and *then* this file becomes superseder-eligible), or (b) accept that this file plays the canonical-record role under the old naming convention and leave it. Substrate fix: the `agent:scrooge-ceo-decision-record` runtime handler (per Atlas's substrate plan) would auto-emit the mirror at the time of capture; the gap is that the substrate didn't exist on 2026-05-07. Backfill is a small follow-on (a separate Scrooge dispatch).

### 2.2 `2026-05-09_scrooge_ceo-decision-record_d-hoz-domain-registration-set-defer.md` (item 12)

Read-and-verified per the dispatch's `bun -e` sketch (no later `D-HOZ-DOMAIN-*` decision IDs in the codebase). The file is itself a canonical CeoDecision record for `D-HOZ-DOMAIN-REGISTRATION-SET` with action `defer` and a §"Deferral-lift trigger" listing four conditions (none of which has fired). The defer state is still active.

CeoDecision records of resolved decisions (including resolved-as-defer) stay in `Owner Inbox/` and surface in the dashboard as resolved; they are not moved on the basis of an alleged "supersession", because they are themselves what defines the canonical state. Per the dispatch's own caveat: "If you read a candidate file and find the supersession claim is wrong (the file is still load-bearing, or the named superseder doesn't actually contradict it), DO NOT move it".

### 2.3 `2026-05-07_fix-a-second-wave-bea-rohan-niko-tomas.md` + `2026-05-07_imani_clause-library-v0-and-fix-a-demonstration.md` (item 14)

These two files are **records-of-runs** — they document four (resp. one) substantive engineering threads that landed on 2026-05-07 (substrate added, schemas committed, stub policies registered, keystone procedures populated, file paths cited inline). Records-of-runs are permanent audit-trail artefacts under Principle 1: the events that lit up — `PostingRulePublished`, the clause-library substrate landing, the procedures-index 10→11→15 progression — are real history. The substrate has matured (clause-library v0 → today's much-fuller `prototype/platform/legal/clause-library.schema.json` + `_clause-library.md`; Bea's posting-rule v0 → much-richer accounting plumbing; etc.), but maturation does not contradict the records: the records remain accurate as history.

If a future cleanup wants to retire these *as a "now-historical-context" pass* (separate from "stale-and-superseded"), that would be a different sweep with a different rule. The current sweep's scope is "truly-stale items contradicted by a later canonical decision or substrate" — these don't fit.

---

## 3. Substrate gaps surfaced (Principle 7 inventory transparency)

This sweep surfaces three gaps in the supersession-discipline substrate. None blocks the sweep itself; each is a roadmap item.

### 3.1 No recon pipeline for supersession-annotation integrity

There is no pipeline in `prototype/platform/recon/` that asserts: *"every Owner Inbox / Team Inbox file referenced as superseded by an approved CeoDecision has either been moved to `actioned/` or carries a `superseded-by:` frontmatter annotation citing that decision-ID"*. Without this assertion, supersession discipline is best-effort manual hygiene, not engineered. The right shape is a Vera pipeline (call it `supersession-annotation-integrity.ts`) that walks the CeoDecision event stream, inspects each `supersedes:` / referenced-by relationship, and reports unannotated stale files as findings. Effort: small (~1 day's substrate work). Owner candidate: Vera (recon engineering). This sweep itself is the manual catch-up; the pipeline keeps the discipline going.

### 3.2 Owner Inbox auto-archive-on-CEO-decision lands but is not retroactive

The auto-archive substrate (`Owner Inbox/2026-05-10_atlas-owen_owner-inbox-auto-archive-on-ceo-decision.md`, in `actioned/`) handles forward-flow: when a `CeoDecision` event lands for `decisionId: D-X`, the source brief auto-moves to `actioned/`. It does not retroactively sweep pre-existing stale items (which is why this manual sweep is needed). Recommendation: a one-shot retroactive run (essentially an automated version of this sweep) belongs in the same substrate.

### 3.3 The `feedback_team_inbox_hygiene` rule is enforced for Team Inbox; equivalent rule for Owner Inbox is informal

The memory `feedback_team_inbox_hygiene` (set 2026-05-08) generalises the auto-move-completed-items rule to all of Team Inbox. The Owner Inbox doesn't have an exact-equivalent enforced rule — the closest is the auto-archive-on-CEO-decision substrate (above), which only handles decision briefs. Specs that aren't decision-briefs (like the reporting-capability spec, item 9) sit in Owner Inbox forever unless someone manually runs a sweep like this one. The rule should be generalised: *"every completed-or-superseded artefact in Owner Inbox moves to actioned/ within K days of the superseding event"*, with the recon pipeline (3.1) as enforcement.

---

## 4. Citation chain

- **Principle 1** (`Principles/1-events-are-truth.md`) — events are the only source of truth; `CeoDecision` events are canonical, markdown is the human-readable mirror.
- **Principle 2** (`Principles/2-citation-discipline.md`) — every action traces to a source; this sweep cites a verifiable `decision-id: D-X` for every `superseded-by` annotation, no prose-only references.
- **Principle 6** (`Principles/6-single-graph-discipline.md`) — single-graph discipline; `superseded-by` is a typed edge in the bidirectional graph (superseder ← superseded).
- **`feedback_canonical_source_registry` memory** (Owen, set 2026-05-07) — every fact-type has one canonical authoring location; cross-references are typed citations.
- **`feedback_team_inbox_hygiene` memory** (set 2026-05-08) — auto-move completed items; the Owner Inbox extension is informal, gap noted §3.3.
- **`Owner Inbox/_frontmatter-convention.md`** — frontmatter shape; this sweep extends it with the typed `superseded-by` block.
- **CEO sweep authorisation 2026-05-11** — Scrooge dispatch (this sweep), authorising verify-then-move per the 14-item candidate list.

---

## 5. Acceptance-criteria checklist

1. Every candidate item is either moved + annotated, OR explicitly justified as still load-bearing in §2 — **done**.
2. Each `superseded-by` annotation cites a decision-ID verifiably present in the CeoDecision record set (or a `Principles/` file, or a memory file, or a code path) — **done** (verification: every `decision-id: D-X` in this sweep matches an existing `^decision-id: D-X$` declaration in a canonical record under `Owner Inbox/`).
3. `bun run citation-gate` green — **done** (last run before commit: 0 violations).
4. `bun run lint` — no code touched in this sweep, but spot-runnable.
5. The deliverable summary file exists and is committed — **done** (this file).
6. Open one PR with all moves + annotations + the summary — **done at PR-open**.

—Owen (Company Secretary, governance) and Mira (Compliance / RegTech engineer)
