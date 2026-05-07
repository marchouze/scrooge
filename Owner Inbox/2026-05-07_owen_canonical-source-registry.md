---
title: Canonical-source registry — doctrine and enforcement
author: Owen
date: 2026-05-07
summary: Every named fact-type in the bank has exactly one canonical authoring location. Cross-references are typed citations, not prose copies. Vera enforces via the no-prose-duplication pipeline.
decision-required: false
---

# Canonical-source registry — doctrine and enforcement

**Author:** Owen (Company Secretary; procedural-discipline custodian)
**For:** Marc (CEO), all engineering and governance personas
**Date:** 2026-05-07
**Authority:** Principle 6 (single-graph discipline) — the structural rule. CEO approval given 2026-05-07 in response to the Devon.md / Camille.md drift incident. Pairs with the Vera pipeline `platform/recon/prose-duplication.ts` (Wave-4 #16 in the agent-discipline assurance extension).
**Status:** **In force.** Pipeline live; this note is the rule of construction Owen owns.

> **Derivation note (Principle 6 — downward).** This note is doctrine over the existing canonical sources; it authors no new substance, only identifies which artefacts already author what. The rule it states is the structural reading of Principle 6.

---

## 1. The rule

**Every named fact-type in the bank has exactly one canonical authoring location.**

Anywhere else the same fact appears, it appears as a **typed citation** — a link, a path reference, an obligation URN, an event reference — never as a prose copy.

The Devon.md / Camille.md / Eitan.md / Saskia.md / Thandiwe.md / Rashida.md drift incident on 2026-05-07 made the failure mode concrete: persona-file Mandate paragraphs enumerated direct reports in prose; the prose was not derived from CLAUDE.md; CLAUDE.md changed; the prose drifted; the dashboard rendered the stale prose. Six persona files independently broke Principle 6 in the same way.

The lesson is structural, not local. Whenever a fact lives in two places — one canonical, one in prose — the prose will eventually drift. The doctrine prevents the duplication from arising.

## 2. The canonical-source registry

The registry below names, for each fact-type currently in the bank's information graph, the **single** authoring location. Anywhere else the fact appears must reference this location, not restate the content.

| Fact-type | Canonical authoring location | Format | Cross-reference idiom |
|---|---|---|---|
| **Architectural principles** (P1–P7) | `CLAUDE.md` § "Architectural principles" | Numbered headings + paragraph | "Per Principle N (CLAUDE.md)" |
| **Top-of-house reporting line** (CEO direct reports + future hires) | `CLAUDE.md` § "Top-of-house reporting" | Sentence enumeration | Dashboard renders from this paragraph; persona files do not restate it |
| **Engineering ↔ governance reporting** (engineer-to-supervisor map) | `CLAUDE.md` § "Engineering vs governance" | Sentence enumeration | Dashboard renders from this paragraph; persona files do not restate it |
| **Persona identity, mandate, expertise, working style, operating spec** | `Team/<Name>.md` | Persona file structure | "See `Team/<Name>.md`" or `agent:<name>` URN |
| **Agent-spec template** | `Team/_agent-spec-template.md` | Template | "Per the agent-spec template" |
| **Regulator obligations** | `Regulations/_obligations-register.md` | Typed register with URNs (`ORG-…`) | Cite the URN in any procedure / policy referring to the obligation |
| **Regulator instruments** | `Regulations/_index.md` and per-instrument folders | Per-instrument file | Cite the instrument URN; do not paraphrase the instrument text |
| **Approved policies** | `Owner Inbox/2026-05-06_policy-register.md` and the bundle files | Numbered policy entries | "Per Policy <name> § <n>" or cite policy file path |
| **Procedures** | `Procedures/_index.md` and `Procedures/by-policy/<name>.md` | Standard procedure template | Cite the procedure path; do not summarise its steps in prose elsewhere |
| **Risk Appetite Statement** | `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` | RAS document | "Per RAS § B<n>" (B1, B2, etc.) |
| **Strategic foundation** | `Owner Inbox/2026-05-06_strategic-foundation.md` | Strategic-foundation document | "Per the strategic foundation" |
| **Governance framework** | `Owner Inbox/2026-05-06_governance-framework.md` | Governance document | "Per the governance framework § <area>" |
| **Legal-entity tree** | `Imani`'s curated register (path TBC pending Imani agent-spec upgrade) | Typed register | Entity URN |
| **CEO decisions** | The event store (`CeoDecision` events) | Typed events with citations | Reference the decision-id; the dashboard's resolved-decisions list is a derived view |
| **Open decisions awaiting CEO** | `prototype/seeds/dashboard-curated.json` `decisionsOpen` + Owner Inbox files with `decision-required: true` frontmatter | Curated JSON + frontmatter lift | The dashboard's "Decisions for CEO" surface is derived from these |
| **Owner Inbox feed (recent deliverables)** | Files under `/Owner Inbox/*.md` (frontmatter or fallback parse) | Markdown with optional frontmatter | The dashboard's Owner Inbox feed is derived |
| **Conflicts register** (declarations, recusals, remediation) | Event log (`ConflictDeclared`, `ConflictAttested`, etc.) per `Procedures/by-policy/conflicts-declaration.md` | Typed events | Standing register is a projection over events |
| **Audit findings, recon results, audit issues** | Vera's pipeline event stream (`ReconResult`, `AuditFinding`, etc.) | Typed events | Quarterly opinion-pack is a projection |
| **Workstreams in flight** | `prototype/seeds/dashboard-curated.json` `inFlight` + `WorkstreamStarted` / `WorkstreamCompleted` events | Curated baseline + event reductions | Dashboard "In flight" surface is derived |
| **Substrate-gap inventory** | Each persona file's §16 (Substrate gaps) — until Atlas's agent-runtime substrate publishes a single canonical register | Per-persona prose, consolidated by Scrooge in the rollout coordination note | When the runtime lands, gaps move there as typed entries; persona-file §16 becomes derived |

**Pending registry entries** (fact-types already in use but not yet canonically located):

- **Subordinate-mini state** for the agents dashboard — currently composed at derivation time from `/Team/`. No alternative authoring; this is fine.
- **Threat models** (Senna / Rashida) — locations to be named when the secure-SDLC threat-model gate publishes a registry.
- **Sanctions-list version attestations** — locations to be named when the screening pipeline lands at M1.

## 3. Cross-reference idioms

Approved citation idioms by location and form:

- **In prose** — "per CLAUDE.md (Engineering vs governance)", "per Policy <name> § <n>", "see `Team/<Name>.md`", "obligation `ORG-FC-13`".
- **In structured fields** (frontmatter, persona-spec sections) — backtick the path or URN exactly: `\`Team/Atlas.md\``, `\`ORG-PR-04\``, `\`Owner Inbox/2026-05-06_policy-register.md\``.
- **In tables** — typed columns (procedure id, regulator instrument URN, persona name) with consistent format.
- **In events** — payload field carrying the URN or path; never an inline prose summary.

What is **not** a citation:

- A sentence in a persona file that lists the persona's direct reports — duplicates CLAUDE.md.
- A sentence in a procedure that paraphrases a regulator instrument — duplicates `Regulations/`.
- A sentence in a policy that restates an obligation — duplicates the obligations register.
- A sentence in a board-pack draft that asserts the bank's capital ratio — duplicates the event log; the pack must derive.

## 4. Enforcement

**Vera owns the enforcement.** The continuous-controls programme has the following pipelines covering this doctrine:

| Pipeline | Status | Asserts |
|---|---|---|
| `@platform/citation/gate.ts` (#1) | **Live** | Every event in the event store carries ≥ 1 citation. |
| `@platform/recon/mandate-ownership.ts` (#3) | **Live** | Every populated procedure resolves to a real mandate-bearing persona / governance seat. |
| `@platform/recon/decision-event-recon.ts` (#4) | **Live** | Dashboard registry's `decisionsResolved` reconciles to `CeoDecision` events. |
| `@platform/recon/prose-duplication.ts` (Wave-4 #16) | **Live (today, 2026-05-07)** | No persona file or procedure enumerates direct reports in prose. Initial scope: org chart. |
| `@platform/recon/agent-spec.ts` (#10) | Planned | Every `/Team/<name>.md` is shaped as an agent operating spec. |
| `@platform/recon/procedure-actor.ts` (#11) | Planned | Every procedure step's actor is typed; human-default steps carry a P2 citation. |
| `@platform/recon/mandate-agent.ts` (#12) | Planned | Every populated procedure resolves bidirectionally to a mandate-bearing agent. |
| Future `@platform/recon/obligations-citation.ts` | Planned | Every regulator-instrument reference in policies / procedures cites the URN canonically. |
| Future `@platform/recon/policy-register-coverage.ts` | Planned | Every approved policy in the register has a populated or planned procedure. |

The enforcement is **continuous** (every commit, nightly), **typed** (each violation names the fact-type and the canonical source it conflicts with), and **bidirectional** (a fact in the canonical source must reconcile to its references; references must reconcile to the canonical source).

## 5. Process

When you author or edit anything:

1. **Identify the fact.** Is it a regulator obligation? An org-chart entry? A policy clause? A persona's mandate? An event?
2. **Locate the canonical source** (§2 above). If the fact-type is not in the registry, raise it to Owen so we extend the registry — do not invent a new authoring location.
3. **Author at the canonical source** if the fact is genuinely new. Where the canonical source is owned by another seat (e.g. CLAUDE.md is owned by the CEO; obligations register is owned by Mira), route through the appropriate owner.
4. **Cite, don't copy** anywhere else. Use the cross-reference idioms in §3.

When Vera's pipelines find drift, the remediation is **always** to remove the duplicate — never to "update both". If both copies disagree, the canonical source is correct by definition.

## 6. Adding to the registry

The registry is itself a living document. New canonical sources are added by:

1. The persona / seat that authors the fact-type proposes the addition (e.g. when Imani's legal-entity-tree register lands, Imani proposes the addition).
2. Owen reviews for procedural-discipline coherence (no overlap with existing entries; the cross-reference idiom is workable).
3. Vera adds the corresponding pipeline (or extends an existing one) before the addition is closed.

A fact-type cannot be considered "registered" until its enforcement pipeline is live. This prevents the registry itself from becoming a presentation-layer artefact that doesn't bind anything.

## 7. Today's rollout

Today's remediation has already happened:

- Six persona files corrected (Devon, Camille, Eitan, Saskia, Thandiwe, Rashida) — Mandate paragraphs no longer enumerate direct reports.
- Vera's pipeline #16 live: `bun run recon:prose-duplication` runs in CI; 38 files asserted; 0 violations.
- Memory `feedback_persona_mandate_no_org_chart` captures the local rule.
- This note (`feedback_canonical_source_registry`-grade) generalises the rule across all canonical fact-types.

Going forward, any new persona file, procedure, or Owner Inbox deliverable that re-asserts an org-chart fact will fail CI on the prose-duplication pipeline. The same enforcement extends to obligations, policies, and procedure-owners as those pipelines come online (Wave-4 #11 / #12; future obligations-citation / policy-register-coverage).

## 8. What this note does *not* do

- It does not prohibit narrative prose. Persona files, procedures, and board packs may all use prose for substantive description — the rule is only that prose must not *re-state structured facts* that live elsewhere.
- It does not require a dashboard or UI for the registry today. The registry lives in this note; if it grows, Owen will graduate it to a structured `Procedures/canonical-sources.md` index or similar. Today's volume (≈ 20 entries) does not warrant that yet.
- It does not affect provisional / brainstorm content. Drafts in `Team Inbox/` or working notes are exempt; the rule binds at the point a deliverable is filed in `/Owner Inbox/`, `/Team/`, `/Procedures/`, or the policy / obligations registers.
- It does not replace Principle 2's atomic citation discipline at the event level. P2 is per-event-emission; this rule is per-artefact-authoring. They reinforce each other.

## 9. Open items

- **To Imani:** when the legal-entity tree register lands, propose its registry entry to Owen.
- **To Mira:** the obligations register is already canonical; consider extending the prose-duplication pipeline to detect prose-paraphrases of regulator instruments without URNs.
- **To Atlas:** the substrate-gap inventory should graduate to a typed register on the agent runtime when A0–A2 lands; until then, the per-persona §16 distribution is the canonical form.
- **To Camille / Helena / Eitan:** capital ratios, RAS lines, and ICAAP / ILAAP outputs should never be authored at the presentation layer (board pack, regulator submission). When the BA-return generator and ICAAP engine come online, those generators are the canonical projection; Vera's pipeline #9 (BA-return cell ↔ event-derived cell) enforces.

—Owen
