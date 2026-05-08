---
title: External legal counsel for the SARB banking-licence application
author: Imani
date: 2026-05-09
summary: Recommendation paper on engagement of external legal counsel for the SARB Banks Act 94 of 1990 licence application. Frames the why-now-vs-defer tradeoff against the build-phase no-real-counsel rule, scopes categories of expertise required, presents three engagement-model options (retained panel · project-based · deferred-until-pre-application gate), gives indicative budget bands with explicit uncertainty, and recommends the deferred-with-precondition option — engage at the moment a SARB licence-application date is set, scope-bounded to the application itself.
decision-required: false
maps-to-decision-id: S5
note: Brief written 2026-05-08 in parallel with CEO approval of curated S5 via dashboard /api/decide at 09:22:51Z. Duplicate ID retired; substantive analysis preserved as supporting artefact for resolved S5. Recommendation (Option C — defer engagement until SARB pre-application gate is set, scope-bounded project mandate; hold corporate-form and founder-shareholder work in-house) stands as the operating posture Imani + Owen + Mira maintain against.
---

# External legal counsel for the SARB banking-licence application

**Author:** Imani (Legal-as-code engineer)
**Reports through:** Devon (COO) on the engineering line; co-curated with Owen (CoSec) on the governance line for the items that cross the regulatory-engagement boundary.
**Contributors / dependencies:** Mira (compliance — obligations-register curator; FIC + FAIS interlocks), Owen (governance — director-duties pathway, board-approval routing), Saskia (Head of Global Markets — markets-licence implications under the indirect-participant posture), Camille (CFO — fee budget treatment), Devon (COO — third-party-risk treatment of any retained counsel).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:**
- Build-phase operating model — `CLAUDE.md` "Operating model — what is real, deferred, paused" (counsel is real at licence-application moment, not before).
- `project_ai_driven_bank.md` — external professional fees (counsel, audit) are real *when SARB engagement / first audit fires*, not during build.
- `project_strategic_foundation.md` — wholesale / institutional global-markets dealer profile; SA single-branch; capital target ~R300m at licence-day.
- `project_indirect_participant_posture.md` — indirect SAMOS participation creates a `D-LICENCE-TYPE` open question that is itself part of the legal scope.
- Principle 2 (every action traces to a source — including the engagement of counsel; the engagement letter is itself a citable artefact under the obligations register).
- Principle 6 (single-graph discipline — counsel's outputs are presentations / standards layered onto the bank's existing policy + register stack; counsel does not author at the policy layer, the bank does, with counsel reviewing).
- Principle 7 (autonomous by default — counsel is the residual humans-required slice for items the agent fleet cannot discharge unaided).

**Status:** Recommendation paper. No engagement is initiated until this decision is resolved.

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer: it sequences the engagement of an external professional service against an existing policy posture (build-phase no-real-counsel rule). It does not author new policy substance. New substance — what counsel is asked to opine on — enters at the policy layer through the items already in the procedure backlog, not through this brief.

---

## 1. Why now vs why defer — the tradeoff

The build-phase rule is unambiguous on the point: external counsel is **not real during the build phase**, and becomes real at the licence-application moment (`CLAUDE.md`, "Operating model — what is real, deferred, paused"; `project_ai_driven_bank.md` row "External professional fees (counsel, audit)"). The retired-decisions list under the AI-driven-bank reframe records S5 specifically as **kept, deferred to SARB engagement** (`project_ai_driven_bank.md` § Decisions retired or reshaped). The default, in other words, is defer.

That default is correct *as a default*, but it has two failure modes if applied without examination:

**Failure mode 1 — engaging too early burns build-phase budget.**
- External counsel for a banking-licence application is one of the larger discretionary spend lines available to a build-phase bank. At full retainer rates with a meaningful matter-team, a project-based mandate runs in the high six- to low seven-figure ZAR range over the application cycle (see § 4 for indicative bands and uncertainty caveats).
- Spend incurred before the bank's in-house artefacts are mature is partly *redone* once those artefacts land, because counsel works against the available record. The build-phase artefact stack — Mira's obligations register, Owen's policy register and governance framework, Imani's clause-library DSL and legal-entity tree, Bea's accounting register, Helena's RAS — is the record counsel will eventually review. Engaging counsel *while* those records are still being authored asks counsel to draft against placeholders.
- Counsel hours spent on the bank's own content during build are largely substitutable by Imani + Mira + Owen + agent-fleet hours at zero marginal cost; counsel hours spent on *regulator-facing* artefacts (the application document, SARB engagement letters, the fit-and-proper file structure) are not substitutable.

**Failure mode 2 — engaging too late risks the licence-application timeline.**
- A SARB banking-licence application under the Banks Act 94 of 1990 is non-trivial. The application document, supporting registers, fit-and-proper assessments for senior management and directors, business plan, capital plan, risk-management framework, IT systems documentation, and the supporting compliance file all need to be in a form the regulator reads. Counsel's role in shaping that file — particularly the items where the bank's posture is novel (AI-driven labour force; indirect participation in SAMOS; institutional-only client base) — is not a thin one.
- Once a SARB engagement date is on the calendar, the lead-time to build a credible counsel-of-record relationship (KYC on the bank, conflict-clearance, matter-team formation, rate negotiation, engagement letter) is on the order of several agent-cycles plus a chunk of human-calendar time on counsel's side. Starting that conversation the day before lodgment is the failure mode.

**The tradeoff, framed.** Defer until the build-phase artefacts are mature *and* a SARB engagement date is set; at that gate, engage on a project-based mandate scoped tightly to application-only work. The work the bank can do unassisted (corporate form, articles, founder-shareholder agreement, governance-framework drafting, policy library, registers) is held in-house meanwhile. The work that genuinely requires counsel (regulator engagement protocol, fit-and-proper file form, application document quality, novel-posture risk review) waits for the gate.

This is the recommendation in §5. The rest of the paper enumerates the scope and the engagement-model options that lead there.

---

## 2. Scope of work — categories of legal expertise required

The scope below is enumerated in **categories**, not firm names and not specific advice. The author of this brief (Imani) is the bank's legal-as-code engineer; the author *does not* provide legal advice and does not pre-empt counsel's view. The categories below describe the surfaces on which the bank will need a qualified external view; the substantive opinions are counsel's to form, not the brief's to declare.

### 2.1 SARB banking-licence application — Banks Act 94 of 1990 + Regulations Relating to Banks

**Category.** South African banking-regulatory practice with a direct track record in Banks Act 94 of 1990 licence applications (Section 12 / Section 13 routes) and the Regulations Relating to Banks (Government Notice R.1029 of 2012, as amended).

**What counsel does on this surface.**
- Reviews the application document and the supporting file for completeness against SARB Prudential Authority expectations.
- Advises on form-of-application choice where the bank's posture creates options (general banking licence vs more specialised forms; the §3 indirect-participant decision on `D-LICENCE-TYPE` lives here).
- Advises on the fit-and-proper file structure for the statutory humans appointed at licence-day, including the form of evidence SARB Prudential Authority customarily accepts.
- Reviews novel-posture aspects (AI-driven labour force, indirect SAMOS participation, institutional-only client base) for application-strategy implications.

**What counsel does *not* do on this surface (and why).**
- Counsel does not author the bank's policy library, governance framework, or risk-management framework. Those are governance-approved bank artefacts (Owen, Helena, Zara, Iris, Devon, Camille, Eitan, Saskia, Rashida, Thandiwe own the relevant pieces) per Principle 6. Counsel may review and recommend, but the policy substance enters the graph at the bank's policy layer, not at counsel's pen.
- Counsel does not curate the obligations register (Mira's mandate). Counsel may flag missing entries or suggest refinements; entry-creation remains a Mira-owned act with the citation chain Mira-typed.

### 2.2 Corporate form and legal-entity tree — Companies Act 71 of 2008

**Category.** Corporate-law expertise on registration of a public company suitable to hold a banking licence, the form of the Memorandum of Incorporation (MOI), the founder-shareholder agreement, and the licence-day legal-entity tree (parent / bank / any subsidiary required by the operating model).

**What counsel does on this surface.**
- Reviews the MOI and the founder-shareholder agreement for compliance with the Companies Act 71 of 2008 and consistency with the SARB licence-application's view of the corporate structure.
- Advises on the legal-entity tree shape required by the bank's operating model — today a single registered entity (`BANK-ZA-001` placeholder per `2026-05-08_imani_legal-readiness.md`); whether a holdco / subsidiary structure is required for capital, regulatory, or tax reasons becomes a counsel question once the tree is no longer a single node.
- Drafts or reviews shareholder rights, board composition rights, share-class architecture, transfer restrictions, and any pre-emptive or drag-along / tag-along mechanics.

**What can advance unassisted in-house** (i.e. without counsel; see §6).
- The shape of the corporate-form recommendation (single public company; capitalisation outline; high-level rights architecture) can be formed in-house and presented to counsel as a starting position rather than as a blank-page request. This compresses counsel hours.
- Imani's existing legal-entity-tree register (substrate gap from `2026-05-08_imani_legal-readiness.md` — registry not yet live; placeholder floor) advances independently of counsel; counsel's role is to validate the *populated* tree, not to populate it.

### 2.3 SARB engagement protocol

**Category.** Practical experience of the cadence, form, and tone of pre-application and application-stage engagement with SARB Prudential Authority and Bank Supervision. This is process-knowledge, not statutory-text knowledge.

**What counsel does on this surface.**
- Advises on whether and when to request a pre-application meeting with SARB Prudential Authority.
- Advises on the form and channel of submissions, the typical question-response cadence, the level of detail SARB customarily expects on novel-posture topics, and the triage of which novel-posture items to surface in early conversations vs in the application document itself.
- Acts as channel-of-record for written engagement during the application cycle if the bank chooses.

**Why this is hard to substitute.** This category is the most counsel-unique slice of the scope. The bank's autonomous fleet has no SARB-engagement track record; the legal-as-code engineer (Imani) does not engage the regulator on the bank's behalf — the engagement is a CEO + CoSec + Compliance act. Counsel's value here is procedural, comparative, and reputational; the bank cannot build it in-house.

### 2.4 FAIS key-individual sponsor and FSP licence path (if any)

**Category.** Financial Advisory and Intermediary Services Act 37 of 2002 (FAIS) practice — specifically the key-individual designation requirements, the form of the FSP licence application (if pursued), and the interaction between FSP licensing and banking licensing for an institutional-only markets dealer.

**What counsel does on this surface.**
- Reviews whether the bank's institutional-only client base + product set (JSE bonds, JSE equities, OTC IRD per `project_strategic_foundation.md`) requires FSP licensing in addition to a banking licence, and if so, the licence categories.
- Advises on the key-individual designation pathway for the relevant statutory humans at licence-day (the build-phase posture per `project_strategic_foundation.md` is no FSP in interim; this category becomes live at the licence-application gate).
- Reviews the suitability records and advice-records architecture against FAIS requirements where relevant.

**Open question this scope inherits.** `project_strategic_foundation.md` records the interim posture as "no FSP licence pursued in interim". Whether an FSP licence is required *at all* for an institutional-only wholesale markets dealer is itself a counsel question — the answer depends on how counterparties are characterised under FAIS (clients vs not) and is not a question the build-phase brief presumes to answer.

### 2.5 FIC Act registration and the RMCP

**Category.** Financial Intelligence Centre Act 38 of 2001 (FIC Act) practice — registration as an accountable institution, RMCP construction, MLRO and FIC Compliance Officer designations, the suite of FIC Compliance Officer obligations, and the interlocks with the SARB licence-application.

**What counsel does on this surface.**
- Reviews the bank's RMCP draft (Mira-owned) against current FIC Act expectations and the most recent FIC Public Compliance Communications.
- Advises on the timing and form of accountable-institution registration relative to licence-grant.
- Reviews the MLRO and FIC Compliance Officer fit-and-proper file form.
- Reviews the customer-due-diligence, ongoing-due-diligence, and STR/CTR procedures (Mira-owned) for FIC-Act-compliance posture.

**Substitution surface.** Mira's obligations register already carries the FIC-Act citations (per `2026-05-08_imani_legal-readiness.md`'s mention of FIC entries on the register). The RMCP is a Zara-owned policy artefact with Mira engineering. Counsel reviews; counsel does not author.

### 2.6 Cloud, offshoring, and data-residency provisions

**Category.** SARB Prudential Authority Directive 3 of 2018 on cloud computing and offshoring of data, read alongside POPIA cross-border-transfer requirements, and applied to the bank's cloud-native posture under Principle 3 (Azure target per `project_cloud_target_azure.md`).

**What counsel does on this surface.**
- Reviews the cloud-and-offshoring notification file required under Directive 3 of 2018.
- Reviews the data-residency design (which data sits where; under what processor / sub-processor arrangements; the cross-border-transfer legal basis under POPIA s.72) for licence-application form.
- Reviews the cloud-vendor and sub-processor contract suite (the master agreement, DPA, sub-processor list, exit-on-failure clauses, audit rights).

**Why this is on the licence-application critical path.** Directive 3 of 2018 contemplates *prior notification* to the Prudential Authority for material reliance on offshored / cloud-hosted services. The bank's substrate is cloud-native by design; the notification is not optional. Counsel's review of the notification file is part of the application-stage scope, not a post-licence afterthought.

### 2.7 POPIA — Information Officer designation and lawful-processing posture

**Category.** Protection of Personal Information Act 4 of 2013 practice — the Information Officer designation (s.56) and authorisation, the lawful-processing register, the cross-border-transfer treatment, the data-subject-rights workflow form, and the breach-notification workflow form.

**What counsel does on this surface.**
- Reviews the IO designation file and the deputy-IO arrangements (Iris-owned at the governance layer).
- Reviews the lawful-processing register and the bank's notice-and-consent framework.
- Reviews the breach-notification workflow against the Information Regulator's published guidance.

**Reliance on existing artefacts.** Iris's seat already carries this scope at the governance layer; counsel reviews Iris's outputs. Substitution surface is moderate — Iris's mandate covers most of it; counsel adds the "this passes the Information Regulator's bar in form and substance" judgment.

### 2.8 Markets-side regulatory perimeter — JSE membership, Strate, JSE Clear, ECTA execution

**Category.** Securities-services and exchange-membership practice — JSE membership rules (if pursued in any form), Strate participation rules (CSDP indirect under `project_indirect_participant_posture.md`), JSE Clear / clearing-member status (indirect under same), and the Electronic Communications and Transactions Act 25 of 2002 (ECTA) execution surface for derivatives master agreements.

**What counsel does on this surface.**
- Advises on the membership-form question for JSE access (per the strategic-foundation file: no JSE membership in interim form, no sponsored access in interim — this becomes live at licence-application).
- Reviews ISDA / GMRA execution form against ECTA s.13 and Schedule 1 (the build-phase position is captured in Imani's clause-library DSL, currently a substrate gap per `2026-05-08_imani_legal-readiness.md`).
- Advises on the indirect-membership relationships that flow from `project_indirect_participant_posture.md` (sponsor selection, primary + backup design, switch-testing, exit strategy — the sponsor / correspondent contracts are themselves legal artefacts that need review).

### 2.9 Cross-cutting — outsourcing, third-party risk, and the sponsor-bank dependency stack

**Category.** Outsourcing-and-third-party-risk practice under the SARB Outsourcing Directive (Directive 4 of 2014, as in force) and its successors, applied to the bank's sponsor-bank dependencies (SAMOS sponsor, CLS-member correspondent, future Strate / JSE Clear sponsors per `project_indirect_participant_posture.md`).

**What counsel does on this surface.**
- Reviews the sponsor-relationship contracts and their SLAs, including the operational-resilience and impact-tolerance provisions.
- Advises on the regulator-notification posture for material outsourcings.
- Reviews the third-party-risk register's classification of sponsor banks as critical operational dependencies (Devon-owned; per `project_indirect_participant_posture.md` this is a binding control).

### 2.10 Items NOT in scope of this engagement

Explicitly out of scope of any engagement under this decision:

- **Customer-facing terms and FAIS-record templates.** Paused until commencement of trading per the build-phase rule.
- **Employment contracts and disciplinary code.** Paused until employees exist (build-phase rule).
- **Wholesale tax advice on transfer pricing, IAS 12 classifications, or VAT FS apportionment.** Yael's scope; counsel-substitution surface here is large and the build-phase posture is engineering-only.
- **Litigation, dispute resolution, restructuring, insolvency.** No live disputes; scope-bound out unless triggered.
- **Anti-trust / competition-law clearance for any acquisition.** No M&A on the strategic horizon.

---

## 3. Engagement-model options

Three options are presented. Each is a coherent posture on its own; the author's recommendation is in §5.

### 3.1 Option A — Retained panel firm

**Shape.** A single retained external counsel, appointed as the bank's panel firm for South African banking-regulatory matters. Panel-firm relationship is open-ended; the bank pays a retainer (or a deemed retainer through guaranteed-minimum-hours billing); matters are referred to the panel firm by default; second opinions on novel-posture items are sourced from outside the panel firm only when explicitly justified.

**When this fits.**
- A live trading bank with continuous regulator engagement, a steady stream of contract reviews, and a high-volume legal-domain event log — i.e. **post-licence-day**.
- Not a build-phase bank: a panel-firm retainer carries a continuous spend whose marginal value is low while the legal-domain event count is zero (per `2026-05-08_imani_legal-readiness.md`: 0 master agreements signed; 0 `MasterAgreementSigned` events; 0 `LegalEntityRegistered` events).

**Pros.**
- Continuity. The panel firm carries institutional knowledge of the bank across years.
- Predictability. Retainer caps the variance on routine matters.
- Faster spin-up on urgent items — no engagement-letter-cycle in the path.

**Cons.**
- Continuous spend during a phase (build) where the legal-domain event flow does not justify continuous spend. The retainer hours go unused or are spent on items in-house engineering would otherwise have absorbed.
- Concentration of legal work on one firm without a clear rationale for that concentration before licence-day — the bank does not yet know which firm best fits the novel-posture surfaces.
- Risk of the panel firm shaping early-stage bank artefacts in directions that constrain optionality — the panel firm becomes the de facto "house view" before the bank has chosen the house view.

**When this option becomes recommendable.** At or shortly after licence-grant, once the legal-domain event flow goes from zero to material (master agreements signing; legal-entity registrations; ECTA executions; recurring sponsor-contract amendments; routine regulatory submissions). The first ~12 months of post-licence operation is the natural window to consider transitioning from a project-based mandate (Option B, used for the application) to a retained-panel arrangement.

### 3.2 Option B — Project-based engagement, scope-bounded to the licence application

**Shape.** A single external counsel engaged on a defined-scope, defined-fee (or fee-band) project mandate, scoped tightly to the SARB banking-licence application and its surrounding bank-perimeter items (the §2 categories). Engagement letter has a defined start, defined deliverables, defined exit, and defined fee structure (cap with ceiling; or phase-gated fee with go / no-go between phases). No continuing relationship beyond the application unless separately agreed.

**When this fits.**
- A bank whose substantial legal need is concentrated in a finite, well-defined event (the licence application) rather than spread across continuous operations — i.e. **the licence-application moment for a build-phase bank**.
- A bank whose in-house artefact stack is mature enough that counsel's role is review + regulator-engagement, not blank-page authoring.

**Pros.**
- Spend is bounded and tied to a deliverable.
- Counsel hours are concentrated on the slice (regulator-facing artefacts) where counsel is least substitutable.
- Optionality preserved on post-licence-day arrangement — Option B does not foreclose Option A later.

**Cons.**
- Counsel does not carry continuity across years; if the same counsel is re-engaged on a project basis post-licence-day, knowledge-transfer is duplicated each time.
- Project-based mandates with ceilings can create perverse incentives near the ceiling (rushed work in the closing weeks; or scope-creep treated as out-of-scope when it is genuinely critical).
- The "this is project-based" framing must be defended against scope-creep throughout the cycle. The CEO + CoSec discipline on what gets routed to counsel vs what gets handled in-house is the binding control.

**Mitigations on the cons.** A phase-gated fee structure addresses the ceiling-incentive problem. A clear scope-change protocol in the engagement letter (any out-of-scope item is itself an explicit go / no-go) addresses the discipline problem.

### 3.3 Option C — Defer engagement until the SARB pre-application gate is set

**Shape.** No external counsel engaged today, and no engagement initiated until a SARB pre-application meeting date is set on the calendar (or a SARB licence-application lodgment date is set, whichever comes first). At that gate, the engagement model defaults to Option B (project-based, scope-bounded), with the engagement letter triggered by the gate event itself. Until that gate, the items in §6 ("Items that can advance unassisted") are advanced in-house.

**When this fits.**
- A build-phase bank whose in-house artefact stack is still being authored, whose legal-domain event flow is zero, and whose SARB engagement date is not yet set.
- Specifically: **today's posture, per the AI-driven-bank reframe.** `project_ai_driven_bank.md` records counsel as "real when SARB engagement / first audit fires"; Option C operationalises that rule.

**Pros.**
- Zero spend on counsel during a phase where counsel hours have low marginal value.
- The bank's in-house artefacts mature first, so counsel — when engaged — reviews finished material and concentrates hours on the regulator-facing slice.
- Retains optionality fully. The choice between Option A and Option B at licence-day is unconstrained by anything done in the build phase.
- Consistent with `CLAUDE.md` "Operating model — what is real, deferred, paused" and the retired-decisions list of `project_ai_driven_bank.md` (S5 is "kept, deferred to SARB engagement").

**Cons.**
- If the SARB engagement date moves up faster than the in-house artefact stack matures, counsel is engaged onto unfinished material — the failure-mode-1 scenario (counsel-redoing-bank-content) becomes real.
- Counsel's bandwidth is itself scarce; the counsel-of-record relationship cannot be built overnight at the gate. Mitigation: Imani + Owen + Mira maintain a "ready-to-engage" file (a one-page brief on the bank, the application timeline, the §2 scope, and the proposed engagement letter shape) so that the gate-trigger is "send the file" rather than "draft from scratch" (see §5 precondition).

**Why C is not "do nothing".** Option C is *active deferral* with named preconditions and a named trigger. The work that does not require counsel (corporate form, articles, founder-shareholder agreement, governance-framework drafting, policy library, registers, clause-library DSL, legal-entity tree, sponsor-relationship designs) advances in parallel. The in-house slice progresses; only the counsel slice waits.

---

## 4. Indicative budget bands

**Uncertainty caveat (large).** The author is the bank's legal-as-code engineer, not its CFO and not a counsel-of-record. The bands below are order-of-magnitude estimates synthesised from publicly-known SARB licence-application precedents and customary banking-regulatory rates; they are not quotes, not fixed-fee proposals, and not negotiated. They will move materially with (a) the firm chosen, (b) the matter-team composition, (c) the form of fee structure, (d) the novel-posture surfaces' actual difficulty as the application develops, and (e) the regulator's question-cycle volume.

| Engagement model | Indicative band (ZAR) | Time horizon | Counsel hours implied (rough) |
|---|---|---|---|
| Option A — retained panel (per year) | ~R3m – R8m+ | Annual; renews | ~600 – 1,500+ hours/year |
| Option B — project-based (full application cycle, including SARB engagement) | ~R5m – R15m | Application cycle (typically 6–18 months elapsed; agent-cycle equivalents) | ~1,000 – 3,000 hours over the cycle |
| Option C — deferred (current phase) | R0 | Until gate trigger | 0 |

**How to read these.** The band on Option B is wide because the application cycle's length is itself uncertain (a question-and-answer cycle with the Prudential Authority on novel-posture items can run several rounds). The band's lower edge assumes a clean application with limited regulator question-cycles; the upper edge assumes extended novel-posture review (AI-driven labour force; indirect SAMOS participation; institutional-only with the resulting `D-LICENCE-TYPE` open question).

**Camille's role.** On approval of an engagement under Option B (whether triggered today or at the deferred gate), Camille (CFO) sets up the budget line, approves the engagement-letter fee structure, and integrates counsel hours into the build-phase / licence-application spend forecast. The fee budget treatment cross-references the API + cloud cost budget decision (`project_ai_driven_bank.md` § Decisions retired or reshaped — open decision 6).

**What is *not* in these bands.** Disbursements (filing fees, regulator-charged fees, courier / sworn-translation / notary costs, travel for in-person SARB engagement). Counsel of overseas counterparties' choice on cross-border items (FATCA, CRS — Yael's domain). Counsel for any litigation, dispute, or regulatory enforcement action (not anticipated; not in scope).

---

## 5. Recommendation

**Approve Option C — defer engagement until the SARB pre-application gate is set, with the precondition that Imani + Owen + Mira maintain a "ready-to-engage" file so the gate-trigger is fast.**

The recommendation in detail:

1. **No external counsel engagement is initiated today.** Spend remains zero on this line. The build-phase rule (`CLAUDE.md`; `project_ai_driven_bank.md`) is honoured by default.

2. **The trigger condition is named.** The engagement is initiated when *any one of* the following events occurs:
   - A SARB pre-application meeting date is set on the calendar (this is the most likely trigger).
   - A SARB licence-application lodgment date is set on the calendar.
   - Helena, Owen, Saskia, or Mira raises a formal request that an item in their mandate has reached a counsel-required gate that cannot wait for the licence-application moment (e.g. the `D-LICENCE-TYPE` decision blocks on a specific counsel-only question that the in-house fleet cannot resolve).
   - Atlas's substrate timeline indicates the pre-licence go-live readiness gate (Saskia / Rashida / Devon co-owned) is within 2 fleet-cycles of green, and counsel lead-time would otherwise overshoot the gate.

3. **At the trigger, the default engagement model is Option B — project-based, scope-bounded.** A retained-panel arrangement (Option A) is *not* selected at the trigger; that decision is held until post-licence-day per §3.1, when the bank's legal-domain event flow can support the rationale.

4. **Precondition — the "ready-to-engage" file.** Imani + Owen + Mira maintain a short standing file (target: ~10 pages, not more) covering: (a) the bank's strategic foundation and current artefact stack at the date of the file's last update; (b) the §2 scope categories with current bank posture on each; (c) the proposed engagement-letter shape (scope, phases, fee structure, deliverables, exit); (d) the licence-application timeline as currently understood. The file is refreshed quarterly or on material change. Its purpose is to compress the engagement-letter cycle at the trigger from "blank page" to "review and counter-propose".

5. **Authority to execute on trigger.** When the trigger fires, authority to execute the engagement (sign the engagement letter; release the first tranche of fees) sits with the CEO, on a short brief from Imani + Owen + Mira that names the trigger event, the proposed counsel, the fee-band agreed, and the engagement-letter scope. The brief is itself a `decision-required: true` Owner Inbox deliverable when authored; that decision is *not* this decision pre-resolved — it is a separate decision card carried at trigger-time, with the engagement-letter as the deliverable.

6. **Counsel selection process.** When the trigger fires, the bank runs a short counsel-selection process — three firms invited to scope-and-quote; firm-selection brief surfaces to the CEO inside the engagement-letter decision card above. The selection process itself is not gated on this decision; it is part of the trigger-time motion.

7. **Build-phase substitution surface.** Until the trigger, items in §6 advance in-house. Specifically: corporate form recommendation; MOI draft; founder-shareholder agreement draft; legal-entity tree register population (Imani's substrate gap); clause-library DSL design (Imani's substrate gap, M1); ECTA-execution engine design (Imani's substrate gap, M1); RMCP draft (Mira); IO designation file draft (Iris); cloud-and-offshoring notification file draft (Devon + Senna + Atlas); sponsor-relationship draft contracts (Imani + Devon).

The recommendation is consistent with the build-phase operating model, conservative on spend, preserves all optionality on engagement form, and names a typed trigger with the precondition that closes the lead-time risk.

**If Option B is preferred today** (i.e. engage immediately on a project-based mandate), the brief recommends — in that contingent — that the engagement letter explicitly adopt a phase-gated fee structure with the first phase scoped to (i) reviewing the in-house artefact stack as it currently exists, (ii) confirming the §2 scope categories, and (iii) building the matter-team's institutional knowledge of the bank's posture. Phase 2 (regulator-facing application work) is gated on a CEO go / no-go decision after Phase 1, on the substantive evidence that the in-house artefact stack is application-ready. This contingent recommendation preserves most of Option C's risk profile while accepting some early spend.

**If Option A is preferred today** (retained panel firm), the brief flags this as inconsistent with the build-phase rule and the AI-driven-bank reframe (`project_ai_driven_bank.md`); a CEO-level reasoned override of those documents is then in scope and would be the load-bearing artefact, not this brief.

---

## 6. Items that can / must wait — the partition

The partition below answers the explicit question on what cannot wait for counsel and what must wait.

### 6.1 Items the bank can advance unassisted (counsel not required to start)

These advance in the build phase regardless of the counsel-engagement decision. They benefit from counsel review at the licence-application gate, but they do not block on counsel today.

| Item | Owner | Substrate state today |
|---|---|---|
| Corporate-form recommendation (single public company; capital structure outline) | Imani + Owen + Camille | Design-only |
| MOI draft (initial) | Imani + Owen | Design-only |
| Founder-shareholder agreement draft (initial) | Imani + Owen + Camille | Design-only |
| Legal-entity tree register (live registry, queryable) | Imani + Anya | Substrate gap (placeholder floor) per `2026-05-08_imani_legal-readiness.md` |
| Clause-library DSL (ISDA, GMRA, master-agreement templates) | Imani + Atlas | Substrate gap (M1) per `2026-05-08_imani_legal-readiness.md` |
| ECTA-execution engine (HSM-backed signing, Schedule-1 gating) | Imani + Senna | Substrate gap (pre-licence) per `2026-05-08_imani_legal-readiness.md` |
| Obligations register (structured, citable, machine-queryable) | Mira | In flight (per Mira's last register snapshot) |
| RMCP draft | Zara (policy) + Mira (engineering) | In flight |
| Policy library (governance-approved policies covering each FIC / FAIS / Banks Act / POPIA surface) | Owen (CoSec) + per-policy owner | In flight (policy register live) |
| Governance Framework | Owen | In flight |
| IO designation file structure | Iris | Design-only (Marc serves as interim IO per `project_ai_driven_bank.md` § WS-E1-IO-OPTIONS) |
| Cloud-and-offshoring notification file (under Directive 3 of 2018) | Devon + Senna + Atlas | Design-only |
| Sponsor-relationship designs (SAMOS sponsor; CLS-member correspondent; future Strate / JSE Clear) | Imani + Devon (third-party-risk) | Design-only per `project_indirect_participant_posture.md` |
| Third-party-risk register | Devon | In flight |
| Fit-and-proper file structure (for licence-day humans) | Owen + Helena | Design-only (humans land at licence-day per `project_ai_driven_bank.md`) |

### 6.2 Items that genuinely must wait for counsel (cannot be executed without external view)

| Item | Why counsel is required |
|---|---|
| The SARB licence application document — final form | Counsel's review of the application's form-and-substance against current Prudential Authority practice is a load-bearing input. The bank can draft; the bank cannot lodge unreviewed. |
| SARB pre-application engagement (live conversation with the regulator) | The bank's first formal engagement with the Prudential Authority is shaped by counsel's process knowledge. Engaging "raw" risks setting an unhelpful tone on novel-posture items. |
| `D-LICENCE-TYPE` resolution | The licence-type question raised by `project_indirect_participant_posture.md` (indirect SAMOS participation; institutional-only product set) needs a counsel view on whether the application is for a general banking licence under Section 12 or a different form. The in-house fleet can sketch the question; the answer is counsel's. |
| Cloud-and-offshoring notification — final form | The notification file under Directive 3 of 2018 is *drafted* in-house but the *form of submission* and the question-cycle with the Prudential Authority is counsel-fronted. |
| ISDA / GMRA execution (first signed counterparty agreement) | The bank's first signed master agreement is a high-stakes legal artefact. Counsel reviews the bank's clause-library DSL output before first signature. (This is post-licence-day per the build-phase rule, but called out for completeness.) |
| Founder-shareholder agreement — final form | The bank can draft; counsel reviews and reduces to executable form. The author is conservative on this point — the agreement is itself the document that defines initial governance and is hard to amend post-licence. |
| MOI — final form | Same logic as the founder-shareholder agreement. The MOI is filed with the Companies and Intellectual Property Commission and bound to the Companies Act 71 of 2008 in form; counsel review is the binding control. |

### 6.3 Items in the grey zone (advance in-house; counsel review at the gate adds material value)

- The clause-library DSL design (Imani's M1 deliverable). The DSL itself does not require counsel; the *first version of the clause-set* counsel reviews is the artefact that benefits.
- The legal-entity tree register population (registry build is not legal work; the *content* of the tree at licence-day benefits from counsel review).
- The fit-and-proper file structure for licence-day humans (the structure can be designed in-house against the Banks Act and the Regulations Relating to Banks; counsel reviews the *populated* file at licence-day).
- The third-party-risk register's classification of sponsor banks (Devon owns; counsel reviews the contractual treatment of the sponsor relationship rather than the register itself).

---

## 7. Substrate gaps the engagement decision surfaces

The recommended Option C is itself substrate-coherent — it does not introduce new substrate gaps. It *closes* one gap (the explicit deferral with named trigger replaces the prior open S5 status). It *names* one new lightweight artefact:

| Gap | Owner | Closes at |
|---|---|---|
| **Ready-to-engage file** (the precondition in §5.4) | Imani + Owen + Mira | Standing artefact; first version produced within 2 agent-cycles of decision approval; refreshed quarterly. |

The substrate gaps already named in `2026-05-08_imani_legal-readiness.md` (clause-library DSL; ECTA-execution engine; CLM platform; legal-entity-tree as live registry; customer-facing terms) are unchanged by this brief — they advance on their existing roadmaps.

---

## 8. Procedure binding (Principle 6 — upward)

The engagement decision and any subsequent execution bind to:

- **`Procedures/by-policy/outsourcing-and-third-party-risk.md`** — owner Devon. External counsel is a third-party service provider; engagement is governed by the bank's third-party-risk procedure. The procedure's standing controls — counterparty due diligence, contract review, ongoing monitoring, exit planning — apply to counsel as they do to any other third party.
- **`Procedures/by-policy/change-management.md`** — owner Atlas. The introduction of an external counsel into the bank's operating context is itself a change, recorded under change-management as a `ChangeRequestSubmitted` / `ChangeApproved` / `ChangeImplemented` tuple.
- **`Procedures/by-policy/regulator-engagement.md`** — owner Mira (planned, per Mira's standing scope). Counsel-fronted SARB engagement runs under this procedure; the procedure's signature steps include "engagement-letter on file" and "matter-team identified" as preconditions.
- **`Procedures/by-policy/expense-authorisation.md`** — owner Camille (planned). The release of fees to counsel is governed by the standing expense-authorisation procedure, with materiality thresholds that surface counsel fees to the appropriate approval level.

The engagement letter itself, when executed, is registered in Mira's obligations register as a typed contract entry (Principle 2 — citable artefact) and in Devon's third-party-risk register (criticality-classified per the sponsor / vendor framework).

---

## 9. Dependencies on other personas

| Dependency | Persona | What I need from them, and by when |
|---|---|---|
| Confirmation of the engagement model and trigger | Marc (CEO) | The decision asked in §10. |
| Co-curation of the ready-to-engage file | Owen (CoSec), Mira (compliance) | Joint authorship; first version within 2 agent-cycles of decision approval. |
| Fee-budget treatment when trigger fires | Camille (CFO) | Budget line set up at trigger; build-phase forecast updated. |
| Markets-licence implications for `D-LICENCE-TYPE` | Saskia (Head of Global Markets), Mira | Joint deliverable on the licence-type question that *this* engagement decision presumes is resolved at the trigger; not a build-phase blocker, but the deliverable should land before the gate fires. |
| Third-party-risk classification of counsel | Devon (COO) | At trigger; counsel-as-vendor classification on Devon's register. |
| Procedure binding | Owen (CoSec) | Add `regulator-engagement.md` and `expense-authorisation.md` to the procedure index if not already; otherwise no-op. |
| CEO-decision lift | Scrooge | Run `agent:anya-projection-refresh` after this brief is committed so the dashboard projection lifts `D-EXTERNAL-COUNSEL` into the open-decisions queue. |
| Recording of the resolved decision | Scrooge | Pick up via `ceo-decision-record` handler when Marc decides; route the precondition (ready-to-engage file authoring) to Imani + Owen + Mira via `follow-on-router`. |

---

## 10. The decision asked

**D-EXTERNAL-COUNSEL — authorise the engagement model and trigger condition for external legal counsel on the SARB banking-licence application.**

If approved as recommended (Option C — deferred-with-precondition):

1. No engagement initiated today; spend remains zero on this line.
2. Imani + Owen + Mira author the ready-to-engage file within 2 agent-cycles; standing artefact thereafter, refreshed quarterly.
3. Trigger conditions named in §5.2 are watched by the standing fleet; first match fires the trigger.
4. At trigger, a counsel-selection process runs (3-firm scope-and-quote); engagement-letter decision is brought to the CEO as a separate `decision-required: true` Owner Inbox deliverable carrying the firm-selection rationale, the agreed fee-band, and the engagement-letter scope.
5. Engagement model at trigger defaults to Option B (project-based, scope-bounded, phase-gated fees).
6. Option A (retained panel) is held until post-licence-day per §3.1.

If the CEO prefers Option B today (immediate project-based engagement), the brief recommends the contingent in §5 — phase-gated fees with Phase 1 limited to artefact review and matter-team building, Phase 2 gated on a separate CEO go / no-go decision.

If the CEO prefers Option A today (retained panel), this is flagged as inconsistent with the build-phase rule and the AI-driven-bank reframe; the load-bearing artefact in that case is the CEO-level reasoned override of those documents, not this brief.

If the CEO prefers a different sequence not covered above (e.g. engage today on a non-counsel professional services basis — a banking consultancy rather than counsel — for the application-strategy slice), Imani re-sequences and re-publishes.

---

## 11. Open items routed elsewhere

- **To Marc (CEO):** the decision in §10. Confirm Option C with the named precondition and trigger conditions, or counter-propose.
- **To Owen + Mira:** co-curation of the ready-to-engage file; expected within 2 agent-cycles of decision approval.
- **To Saskia + Mira:** the `D-LICENCE-TYPE` deliverable raised by `project_indirect_participant_posture.md` — landed before the trigger fires, so the engagement letter at trigger-time can refer to a resolved licence-type rather than an open question.
- **To Devon:** at trigger, counsel-as-vendor classification on the third-party-risk register; standing third-party-risk treatment thereafter.
- **To Camille:** at trigger, fee-budget treatment; integration into the build-phase forecast and the licence-application spend line.
- **To Atlas + Senna:** at trigger, threat-model / information-security gate on counsel's access channel to bank artefacts (which artefacts; under what NDA; through what data room).
- **To Scrooge:** dashboard lift for `D-EXTERNAL-COUNSEL`; pickup of the resolved decision via `ceo-decision-record`; routing of the precondition (ready-to-engage file authoring) via `follow-on-router`.

—Imani
