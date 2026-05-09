---
title: D-FSP-LICENCE-NECESSITY confirm-A — scope updates across FSP-path, TCF substrate, and counsel-application papers
author: Zara (Chief Compliance Officer, governance) + Imani (Legal-as-code engineer)
date: 2026-05-09
summary: Joint completion note recording the three scope-updates Zara and Imani applied to their prior PR-44 / PR-41 deliverables following the CEO's confirm-A-no-research resolution of D-FSP-LICENCE-NECESSITY (2026-05-09; PR #62). Closes the FSP-application-path paper as actioned, narrows TCF-4 from gated to load-bearing, and refines Imani's external-counsel scope from "evaluate Posture A vs B" to "ratify Posture-A bundle + counterparty-eligibility evidence package".
decision-required: false
---

# D-FSP-LICENCE-NECESSITY confirm-A — joint scope updates

**Authors:** Zara (Chief Compliance Officer, governance — direct CEO line; named MLRO + FIC Compliance Officer; FAIS-KI accountability) + Imani (Legal-as-code engineer — engineering line through Devon (COO, governance); governance line co-curated with Owen (Company Secretary, governance)).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Status:** Actioned — three file updates landed in this PR.

---

## 1. Decision context

On 2026-05-09 the CEO resolved decision **D-FSP-LICENCE-NECESSITY** as **`confirm-A-no-research`**. Posture A — FSP licence pursued; FAIS Categories I + II; Marc-interim Key Individual transitioning to Saskia (Head of Global Markets, governance) steady-state; FAIS-record-keeping substrate binding — is the steady-state. Posture B (documented carve-out) is closed; the PAX research dispatch on FSP-licence necessity is withdrawn.

Citation: `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62).

This decision invalidates the *open-question* framing in three of Zara (Chief Compliance Officer, governance) and Imani (Legal-as-code engineer)'s prior deliverables. This note records the three corresponding scope-updates and the citation chain.

---

## 2. The three file updates

### 2.1 `Owner Inbox/2026-05-09_zara_fsp-application-path.md` (Zara — PR #44 deliverable)

**Update applied.** Header inserted at the top of the body (under the frontmatter): "Decision: confirm-A-no-research, 2026-05-09. See `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md` (PR #62). Posture A is the steady-state. PAX research dispatch withdrawn. This paper closes as actioned." Frontmatter `decision-required` flipped from `true` → `false`; new `decision-status: actioned` field added.

**What is preserved.** The body content (Posture A and Posture B reasoning, the asymmetry analysis, the substrate-footprint comparison) is left intact as the audit-trail of the reasoning the CEO consumed when making the decision. Per Principle 6 (single-graph discipline), the historical reasoning remains a citable node.

### 2.2 `Owner Inbox/2026-05-09_zara_tcf-substrate-plan-v0.md` (Zara — PR #44 deliverable)

**Update applied.** TCF 4 row (§2 applicability table) updated from "Conditional — depends on D-FSP-LICENCE-NECESSITY" / "gated on FSP-licence-necessity research dispatch" to "Binding under Posture A confirmed (D-FSP-LICENCE-NECESSITY 2026-05-09; PR #62)". Substrate-footprint §3.2 (advice-record substrate) re-status'd from `PLANNED` to `LOAD-BEARING` with cross-reference to Mira (Compliance / RegTech engineer)'s parallel FAIS-record-keeping URN cluster work on `Regulations/_obligations-register.md` (branch `claude/mira-fais-posture-a-register`; URN cluster `ORG-FAIS-KI`, `ORG-FAIS-RK-ADVICE`, `ORG-FAIS-RK-SUITABILITY`, `ORG-FAIS-RK-FEE-DISCLOSURE`, `ORG-FAIS-RK-COMPLAINT-HANDLING`, `ORG-FAIS-RK-GENERAL-CODE`). §2 headline and §4.1 Q1 updated to mark the FSP-licence question as resolved.

**Scope refinement, not new decision.** Frontmatter `decision-required: false` is preserved.

### 2.3 `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` (Imani — PR #41 deliverable)

**Update applied.** §2.4 (FAIS key-individual sponsor and FSP licence path) narrowed:
- Counsel **ratifies the Posture-A application-bundle scope** (institutional-only product set per `project_strategic_foundation.md`; FAIS Categories I + II; KI = Saskia (Head of Global Markets, governance) steady-state with Marc-interim build-phase; FAIS-record-keeping substrate binding).
- Counsel **does not evaluate Posture B** — that question is closed by CEO decision.
- New §2.4.1 added — **"Institutional-only counterparty-eligibility evidence requirements"** — listing the evidence types counsel must confirm to ratify operational enforceability of the institutional-only posture: counterparty-categorisation criteria; eligibility-screening at onboarding; ongoing-eligibility monitoring; exception-handling; audit-trail. Each carries `[citation: TBC pending counsel]` per Principle 2 — the bank does not invent the evidence-grade or cadence; counsel reads the relevant FSCA / FAIS sections and returns the citations.

---

## 3. Citation chain back to PR #62

```
Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-fsp-licence-necessity-confirm-a.md (PR #62)
  ├─ Owner Inbox/2026-05-09_zara_fsp-application-path.md (header inserted; PR #44)
  ├─ Owner Inbox/2026-05-09_zara_tcf-substrate-plan-v0.md (TCF 4 row + §3.2 + §4.1 Q1; PR #44)
  └─ Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md (§2.4 narrowed + §2.4.1 added; PR #41)
```

Cross-edge citations:
- Mira (Compliance / RegTech engineer) parallel FAIS-record-keeping URN cluster work on `Regulations/_obligations-register.md` — branch `claude/mira-fais-posture-a-register`. Imani §2.4 and Zara TCF §3.2 both cite Mira's work as the upstream citation backbone.
- Saskia (Head of Global Markets, governance) PAX-withdraw note — branch `claude/saskia-fsp-confirm-a-pax-withdraw` on `Team Inbox/2026-05-09_saskia-to-pax_*.md` and Saskia's PR #45 handover. The PAX research dispatch closes there; this note records that the *substrate consequences* of the closure land in Zara and Imani's deliverables.
- Owen (Company Secretary, governance) governance-framework FAIS-KI steady-state work — branch `claude/owen-governance-framework-fais-ki-steady-state`. Owen reflects KI-Saskia steady-state into the governance framework; this note records the FAIS-KI citation lineage for Zara and Imani's papers.

---

## 4. Still-open counsel-scope items (narrowed but not eliminated)

D-FSP-LICENCE-NECESSITY closes the *posture* question. Counsel work on FSP-related surfaces continues, narrower:

1. **Posture-A application-bundle ratification.** Counsel reads the bundle the bank has assembled (KI fit-and-proper file, FAIS Categories I + II justification, advice-record architecture) and confirms it is consistent with FSCA expectations.
2. **Institutional-only counterparty-eligibility evidence package.** Counsel returns the `[citation: TBC pending counsel]` rows in Imani §2.4.1 — the specific FAIS / FSCA sections that bind counterparty-categorisation criteria, eligibility-screening, ongoing-eligibility monitoring, exception-handling, and audit-trail evidence retention.
3. **KI fit-and-proper file form.** Counsel confirms the Determination of Fit and Proper 2017 file form for both Marc-interim and Saskia-steady-state KIs.
4. **FAIS-record-keeping substrate ratification.** Counsel reads Mira (Compliance / RegTech engineer)'s URN-cluster citation backbone on the obligations register against the substrate Zara (Chief Compliance Officer, governance)'s TCF plan §3.2 has set load-bearing, and confirms coverage.

These are no longer "evaluate whether to do this" items. They are "confirm the bank has done this correctly" items.

---

## 5. Substrate gaps surfaced

Per Principle 7 (gaps are roadmap items, not hidden):

- **S-1: TCF 4 substrate is `LOAD-BEARING` but not `IMPLEMENTED`.** The advice-record-capture pipeline `Procedures/by-policy/fais-advice-record-capture.md` is binding under Posture A; the engineering build (Niko (Sales / CRM engineer) on the customer-interaction record-capture; Mira (Compliance / RegTech engineer) on the FAIS-substrate engine) is not yet shipped. Niko is paused during build-phase per the AI-driven-bank reshape; the FAIS-record-keeping engine is what Mira's URN cluster work is paving the way for. Roadmap item: lift TCF 4 substrate from `PLANNED` → `IMPLEMENTED` ahead of commencement-of-trading per `project_rules_bind_at_commencement.md`.
- **S-2: Institutional-only counterparty-eligibility evidence package is dependent on counsel return.** Imani §2.4.1's five evidence types each carry `[citation: TBC pending counsel]`. The bank cannot finalise the evidence-grade or monitoring cadence without counsel input. Roadmap item: counsel engagement at the licence-application gate returns these citations; substrate is then locked.
- **S-3: TCF substrate plan v0 → v1 trigger.** v0 was framed for an open D-FSP-LICENCE-NECESSITY. v1 should be authored once the counsel-returned `[citation: TBC]` rows are filled and the FAIS-record-keeping engine is shipped. Roadmap item: Zara (Chief Compliance Officer, governance) re-runs at the next quarterly conduct cadence post-counsel-engagement.
- **S-4: Mira ↔ Zara ↔ Imani citation triangulation.** Multiple branches in flight (`claude/mira-fais-posture-a-register`, `claude/saskia-fsp-confirm-a-pax-withdraw`, `claude/owen-governance-framework-fais-ki-steady-state`, this branch) all cross-reference each other. The merge order matters; if Mira lands first, Zara and Imani's `[citation: ...obligations-register.md row...]` references resolve cleanly. Roadmap item: Scrooge tracks merge-order to avoid stale-citation drift per the orphan-branch reconciliation pattern.

---

## 6. Reporting lines

- Zara → CEO directly.
- Imani → Devon (COO, governance) on the engineering line; co-curated with Owen (Company Secretary, governance) on the governance line.
- This note is a joint deliverable; both authors agreed the scope-update package before submission.
