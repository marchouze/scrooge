---
title: "D-OPRISK-ENGINEER-ROLE — Operational-risk engineering: dedicated seat, subsume, or defer?"
agent: Owen (Company Secretary, governance)
trigger: ceo-decision-proposal
decisionId: D-OPRISK-ENGINEER-ROLE
decision-required: true
recommendation: Option B — subsume into Rohan (Risk engineer, engineering) + Vera (Internal audit engineer, engineering) + Devon (Chief Operating Officer, governance), with Helena (Chief Risk Officer, governance) as sponsor; revisit at licence-day under D-OPRISK-ENGINEER-ROLE-LICENCE-DAY.
record-kind: ceo-decision-proposal
workstream: WS-MARKET-RISK-PROCEDURES
brief: brief:owen:author-ceo-decision-card-d-oprisk-engineer-role:2026-05-21
runId: run:owen:2026-05-21T08-09-35-000Z
asOf: 2026-05-21T08:30:00Z
date: 2026-05-21
authority:
  - "CLAUDE.md — Decision authority routing (CRO category)"
  - "Principles/6-autonomous-by-default.md"
citations:
  - "Policies/regulatory-reporting-policy-v1.md §3 — operational-risk Risk Return (D4/2022) data"
  - "Policies/pillar-3-disclosure-policy-v1.md §3.6 — Operational Risk Disclosures (D10/2025)"
  - "PR #660 — non-CISO identity-drift sweep (merged 2026-05-21)"
  - "Team/_team-roster.json — canonical roster"
  - "Team/Helena.md — CRO scope (covers operational-risk policy)"
  - "Team/Rohan.md §16 — risk-engine includes operational risk module"
  - "Team/Devon.md §16 — accountable executive for operational resilience"
  - "Team/Vera.md — Internal audit engineer (third-line)"
  - "Principles/6-autonomous-by-default.md — agent-first staffing"
classification: ceo-only
register-key: decisions
status: proposed
---

# D-OPRISK-ENGINEER-ROLE — Operational-risk engineering: dedicated seat, subsume, or defer?

> **Decision asked.** Does an **operational-risk engineer** seat exist on Helena (Chief Risk Officer, governance)'s engineering bench as a distinct agent role, separate from Rohan (Risk engineer, engineering)'s risk-engine scope, Vera (Internal audit engineer, engineering)'s third-line continuous assurance, and Devon (Chief Operating Officer, governance)'s operational-resilience accountability? Or is the function already covered by existing seats? Two live policies (`Policies/regulatory-reporting-policy-v1.md` §3, `Policies/pillar-3-disclosure-policy-v1.md` §3.6) name the role; the role does not exist in `Team/_team-roster.json`.
>
> **Author.** Owen (Company Secretary, governance) — governance hygiene authority over org-chart drift and persona-policy coherence.
>
> **Recommendation.** **Option B** — subsume operational-risk engineering into the existing bench: Rohan (Risk engineer, engineering) owns the operational-risk module of the risk engine (already declared in `Team/Rohan.md` §16); Vera (Internal audit engineer, engineering) provides third-line continuous-assurance coverage of operational-risk controls (RCSA review, KRI breach review, loss-event coding integrity) under the CCM programme; Devon (Chief Operating Officer, governance) holds the executive operational-resilience accountability (already declared in `Team/Devon.md` §16); Helena (Chief Risk Officer, governance) sponsors policy authorship from the CRO seat. Update the two policy files to drop the "operational risk engineer" label and name the actual contributors. Open a follow-on decision `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` to re-examine at the pre-licence go-live readiness gate, where loss-event volume and Risk Return cadence may justify a dedicated bench seat.

---

## 1. Decision summary

This decision card asks Marc (CEO) to confirm the operational-risk engineering function's staffing shape during the build phase. The trigger is a textual drift surfaced by PR #660 (Owen non-CISO identity-drift sweep, merged 2026-05-21): two policies originally labelled Rashida (Chief Information Security Officer, governance) as "Operational risk engineer". The textual drift was corrected to a TBC label ("operational risk engineer (role on Helena's engineering bench — substantive name attribution pending)") in PR #651 + #660. The **substantive question** — whether a dedicated operational-risk-engineer seat exists on Helena's bench — is a CEO-category decision routed here.

Three options on the table: (A) hire a dedicated operational-risk engineer agent; (B) subsume into existing seats (Rohan + Vera + Devon, with Helena sponsoring); (C) defer until licence-day and remove the role label from policies in the meantime.

The decision authority is CEO (Risk-Appetite category in CLAUDE.md's decision-authority-routing table is CRO; staffing of the CRO bench is a CEO decision; Helena is consulted but does not approve her own headcount). The decision belongs in scope of Helena's CRO mandate operationally, but a *new bench seat* is a CEO decision under the build-phase staffing posture (Principle 6: agent-first, minimal humans).

---

## 2. Context — substrate facts

### 2.1 What surfaced the question

PR #660 (Owen non-CISO identity-drift sweep, merged 2026-05-21) is the cleanup PR that flipped Vera (Internal audit engineer, engineering)'s `recon:persona-attribution-coherence` pipeline to strict-by-default. Two pre-existing label drifts on Rashida (Chief Information Security Officer, governance) were resolved by PR #651 (Senna's CISO-label sweep) ahead of PR #660. The PR #651 fix rephrased the original "`Rashida (Operational risk engineer)`" prose to a TBC marker — non-parenthetical so it does not trip recon's `Name (position)` pattern, but flagged for substantive resolution:

- `Policies/regulatory-reporting-policy-v1.md:146`: "Helena and the operational risk engineer (role on Helena's engineering bench — substantive name attribution pending) own the operational-loss event taxonomy"
- `Policies/regulatory-reporting-policy-v1.md:289`: "Risk Return generator (Bea, the markets risk engineer (Rohan / Helena's bench), and the operational risk engineer (Helena's bench — substantive name attribution pending))"
- `Policies/pillar-3-disclosure-policy-v1.md:170`: "The operational risk engineer (role on Helena's engineering bench — current name attribution drift surfaced 2026-05-21; substantive role assignment pending) curates the operational-loss event taxonomy"

The three references describe a single conceptual seat: someone curates the **operational-loss event taxonomy**, generates the **operational-risk section of the Risk Return (D4/2022)**, and produces inputs for the **Pillar 3 §3.6 Operational Risk Disclosures (D10/2025)**.

### 2.2 What "operational risk engineering" actually involves

Decomposing the function described in the two policies:

| Sub-function | What it produces | Cadence |
|---|---|---|
| Operational-loss event taxonomy curation | Aligns the event substrate's loss-event categorisation with Basel II loss event categories (IF, EF, EPWS, CPBP, DPA, BDSF, EDPM) and D4/2022 thresholds | Ongoing (event substrate change-controlled); annual taxonomy review |
| Operational-loss event capture (the events themselves) | `OperationalLossEvent { eventDate, businessLine, baselCategory, grossLoss, recovery, netLoss }` typed events | Continuous (event-driven on incidents); build-phase: synthetic backfill only |
| Risk and Control Self-Assessment (RCSA) cycle | RCSA workpapers per business line; control effectiveness ratings | Annual (per `Procedures/by-policy/rcsa-cycle.md` — Helena co-owns with Devon, planned) |
| Key Risk Indicator (KRI) framework | KRI definitions, thresholds, breach events into Helena's RAS taxonomy | Monthly review |
| ICAAP operational-risk inputs | Stressed loss projections; capital-add-on rationale | Annual ICAAP cycle |
| Risk Return §3 (operational-risk loss events) generator | `ReturnDraftGenerated { returnId: "risk-return", section: "op-risk" }` over the quarter's loss events | Quarterly |
| Pillar 3 §3.6 operational-risk disclosures | Approach disclosure (SMA), historical loss data window, qualitative management description | Quarterly |
| Operational-risk capital RWA computation | SMA per BCBS Basel III/IV (Business Indicator Component × Internal Loss Multiplier) | Monthly (BA returns); quarterly (Pillar 3) |

This is a real, distinct, regulatory-bind workload. The question is *who* does it during the build phase.

### 2.3 What the existing roster already covers

The current `Team/_team-roster.json` (canonical) has no `operational-risk engineer` seat. The conceptually adjacent seats:

- **Rohan (Risk engineer, engineering)** — `Team/Rohan.md:16` declares "Rohan owns risk computation and governance: market risk (sensitivities, VaR, ES, FRTB), credit risk (PD/LGD/EAD, IFRS 9 ECL, SA-CCR), liquidity risk (LCR, NSFR, intraday), **operational risk**, the limits framework with Kai, ICAAP and ILAAP as live artefacts, stress testing, and the risk-related BA returns." Rohan's `§16` lists the "Risk engine (market / credit / liquidity / **operational**) — planned." Operational risk is **already explicitly in Rohan's scope**. The "markets risk engineer" rephrase Senna applied in PR #651 narrowed Rohan's role in those two policy lines specifically to markets-risk-quant — that narrowing is a recon-driven artifact, not a CRO-approved scope change. Rohan's actual scope per the persona spec covers all four risk types.
- **Nadia (Independent-validation engineer (second line), engineering)** — second-line peer to Rohan; independent model validation of any operational-risk model Rohan produces (e.g. SMA's ILM if PA adopts it). Already on the bench.
- **Vera (Internal audit engineer, engineering)** — third-line continuous assurance; reports functionally to Thandiwe (Chief Audit Executive, governance). Vera owns recon-style coverage of every control; would build a `recon:oprisk-loss-event-coding-integrity` or similar pipeline. Already on the bench.
- **Devon (Chief Operating Officer, governance)** — `Team/Devon.md:18` declares "Named accountable executive for operational resilience under BCBS principles." Devon **already holds** the named operational-resilience accountability at executive level (the COO-owned dimension of operational risk: SLOs, capacity, DR/BC, incident command). Devon pairs with Helena on "operational-risk appetite and breach pathway" (`Team/Devon.md:39`). Devon co-owns `Procedures/by-policy/rcsa-cycle.md` with Helena.
- **Helena (Chief Risk Officer, governance)** — overall CRO accountability for the risk-management framework, including operational risk as one of the seven canonical risk types in the bank's risk taxonomy. Helena does **not** measure (Rohan does); Helena governs.
- **Bea (Accounting & financial reporting engineer, engineering)** — `Policies/regulatory-reporting-policy-v1.md:146` declares "Bea generates the Risk Return schedule from the typed events." Bea is the **producer** of the BA-form / Risk Return / Pillar 3 deliverable; the **upstream taxonomy curation and loss-event coding** is the open question.

The gap, framed clearly: **operational-loss event taxonomy curation and RCSA cycle delivery** — between Helena's CRO governance and Rohan's risk-engine module — is the slice that needs an owner. The remaining sub-functions (Risk Return generation, Pillar 3 disclosure rendering, SMA RWA computation, KRI framework) all have current owners (Bea, Helena+Rohan, Rohan, Rohan+Helena).

### 2.4 Build-phase posture (per CLAUDE.md "Operating model — what is real, deferred, paused")

The bank is in the build phase. Per the rules at the head of CLAUDE.md:

- **No real customers** until licence-day → **no real operational-loss events** yet. The build phase produces zero op-risk incidents in the operational sense (no clients, no payments executed against real positions). The op-risk discipline must be **rehearsal-ready** by the pre-licence go-live gate — the taxonomy, the RCSA template, the Risk Return §3 generator, the Pillar 3 §3.6 generator — but none of it carries live data yet.
- **No real employees** beyond statutory minimum → the op-risk staffing decision is a question of which **agent** carries the function, not a human headcount question.
- **Banking rules bind at commencement of trading.** Per the memory note `project_rules_bind_at_commencement.md`, operational risk regulation (PA D4/2022 Risk Return §3, D10/2025 Pillar 3 §3.6, SMA RWA) is COMMENCEMENT-BIND — the operational obligation activates at licence-day, not now. The build-phase task is to have the substrate ready.

The substrate-readiness items the function must deliver by the pre-licence gate:

1. `OperationalLossEvent` event type wired into the event store with Basel II taxonomy
2. RCSA-cycle procedure (planned in `Procedures/by-policy/rcsa-cycle.md`, owners Helena + Devon)
3. KRI framework wired into Helena's RAS taxonomy (some KRI lines already exist in the RAS schedule per `D-RAS-SCHEDULE-V1`)
4. Risk Return §3 generator (planned per `Policies/regulatory-reporting-policy-v1.md:289`)
5. Pillar 3 §3.6 disclosure renderer (planned per `Policies/pillar-3-disclosure-policy-v1.md` §3.6)
6. SMA RWA computation engine (planned in Rohan's `risk engine — operational` module per `Team/Rohan.md` §16)

None of these are live today. The decision below is essentially: **who carries the build-phase delivery of these six items?**

---

## 3. Options

### Option A — Hire a dedicated operational-risk engineer

PAX scopes the role; Nolan recruits an agent. The agent reports to Helena (engineering bench), matrix to Devon (COO-level operational-resilience oversight), peer to Rohan on risk-engine integration, peer to Bea on Risk Return / Pillar 3 delivery.

**Concrete shape:**

- Role spec authored under PAX → Nolan flow (out of scope of this card; would follow approval).
- New row in `Team/_team-roster.json`: `{ "name": "<TBD>", "role": "Operational risk engineer", "type": "engineering", "reportsTo": "Helena", "matrixTo": "Devon" }`.
- New persona spec file `Team/<Name>.md` using the 17-section operating-spec template.
- Six substrate items above become this agent's owned roadmap.
- The two policy files keep the "operational risk engineer" label and the TBC marker resolves to a named agent.

**Pros:**

- Cleanest separation of duty. SARB / external auditor at licence-day sees a named accountable bench seat for the function. Defensible at the licence-application interview.
- Maps cleanly to the policy text as currently written.
- Matches BCBS sound-practice expectations that operational-risk has a dedicated engineering function in second-line.
- Frees Rohan to focus on market / credit / liquidity quant work (Rohan is already a wide scope; "operational risk" is the sub-function with the least overlap with the quant core of Rohan's work).

**Cons:**

- Adds an org-chart row during the build phase, against the operating-model rule "no real employees beyond the statutory minimum the law requires" and Principle 6's agent-minimalism (only hire when no qualified agent exists — *and* the work load justifies a dedicated agent).
- Anthropic API spend increment: a new standing agent adds ~marginal monthly token cost (small, but real per CLAUDE.md "Anthropic API token spend — the largest current cost").
- The function's actual workload during the build phase is **zero live loss events**, so the marginal agent is over-allocated relative to actual work in progress.
- Risk of inventing a seat the live operation does not need — at licence-day the workload may justify a hire OR may not, and the answer is clearer with a quarter or two of live data.

### Option B — Subsume into existing roles (RECOMMENDED)

No new bench seat. Distribute the six substrate items across the existing roster, matching each item to its natural owner.

**Concrete shape:**

| Substrate item | Owner |
|---|---|
| 1. `OperationalLossEvent` event type + Basel II taxonomy | **Rohan** (risk-engine event types are Rohan's domain; persona spec §16 already declares "operational risk" within the risk engine) |
| 2. RCSA-cycle procedure delivery | **Helena + Devon** (already co-owners of `Procedures/by-policy/rcsa-cycle.md` per `Team/Helena.md:117`) |
| 3. KRI framework | **Helena** (KRIs are RAS-cluster lines; RAS authoring is Helena's) |
| 4. Risk Return §3 generator | **Bea** (Risk Return generator owner per `Policies/regulatory-reporting-policy-v1.md:289`); inputs from Rohan's loss-event projection |
| 5. Pillar 3 §3.6 disclosure renderer | **Bea** (Pillar 3 production is CFO bench); inputs from Rohan |
| 6. SMA RWA computation engine | **Rohan** (risk-engine operational module) |
| Continuous assurance (RCSA control testing, loss-event coding integrity, KRI breach review) | **Vera** (third-line, under Thandiwe's CAE attestation) |
| Sponsorship + sign-off | **Helena** (CRO) |

Update the two policy files to replace "operational risk engineer (role on Helena's engineering bench — substantive name attribution pending)" with the actual contributors:
- `Policies/regulatory-reporting-policy-v1.md:146` → "Helena (Chief Risk Officer, governance) sponsors; Rohan (Risk engineer, engineering) curates the operational-loss event taxonomy and the SMA RWA computation; Bea (Accounting & financial reporting engineer, engineering) generates the Risk Return schedule from the typed events; Vera (Internal audit engineer, engineering) provides continuous-assurance coverage."
- `Policies/regulatory-reporting-policy-v1.md:289` → "Risk Return generator (Bea), drawing from Rohan's operational-loss event projection, the markets-risk-sensitivity projection, and the credit large-exposure events."
- `Policies/pillar-3-disclosure-policy-v1.md:170` → "Rohan (Risk engineer, engineering) curates the operational-loss event taxonomy under Helena (Chief Risk Officer, governance)'s sponsorship; Bea (Accounting & financial reporting engineer, engineering) sources the data from the Risk Return §3 (per §3 of the Regulatory Reporting Policy) for consistency."

Open `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` as a planned re-examination at the pre-licence go-live gate (Saskia's pre-licence readiness substrate). At that gate the licence-day workload signal will be visible: if loss-event volume + RCSA cycle + ICAAP authoring cumulatively justify a dedicated seat, hire under that decision. If not, keep the subsume arrangement live.

**Pros:**

- No new bench seat during the build phase — consistent with the operating model and Principle 6.
- Each substrate item lands with its *natural* owner (Rohan for risk-engine code, Bea for return generators, Helena for governance, Vera for assurance) rather than synthesising a new seat to hold all of them.
- Operational-risk RWA / Pillar 3 §3.6 are already Bea's; loss-event taxonomy is the cleanest fit with Rohan's existing risk-engine ownership.
- Decision can be revisited at licence-day with actual workload signal.
- Zero immediate incremental cost.

**Cons:**

- Diffuses operational-risk accountability across four agents (Rohan + Helena + Devon + Bea + Vera). The mitigation is the matrix-ownership table above, which CLAUDE.md / Owen's persona-policy coherence recon can assert.
- SARB at licence-application *may* expect to see a single named accountable engineer for the operational-risk function. The mitigation is that Helena holds the named CRO accountability (the SARB-visible accountable seat) and Rohan holds the engineering-side scope (named in the risk-engine module). The same shape works for market risk (Helena governs; Rohan measures) and is unobjectionable; applying it to op-risk is consistent.
- Requires updating the two policy files in a follow-on PR — small but real authoring cost.
- If a real op-risk incident happens early in live operation, the substrate is ready but a *named* engineer who can be paged is absent; the bench escalates via Helena. Acceptable for build-phase posture; revisited at licence-day.

### Option C — Defer; remove the role label from policies

Delete the "operational risk engineer" references from both policy files; mark operational-risk engineering as PLANNED post-licence under `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY`. The build phase explicitly does not staff the function; the six substrate items are pushed to post-licence delivery.

**Concrete shape:**

- Update the two policy files to remove the TBC labels.
- Mark the six substrate items as `licence-day-bind` in the substrate gap registry.
- Open `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` (or a successor decision) as the gating decision for staffing at the pre-licence gate.

**Pros:**

- Cleanest for the build phase — no diffuse accountability, no new seat, no policy contradiction.
- Defensible if framed as "operational risk regulation is COMMENCEMENT-BIND; the function activates at commencement; the build phase is preparation, not compliance."
- Zero immediate cost.

**Cons:**

- The two policies (regulatory-reporting and Pillar 3) **describe operational-risk substrate as live** (Risk Return §3, Pillar 3 §3.6 are sections in already-active policies). Removing the role labels would leave the policy sections describing work without a named owner — a worse drift than the current TBC marker.
- SARB at licence-application may ask "where is the operational-risk engineering function?" and the answer would be "deferred" — weaker than Option B's "subsumed into a matrix of named seats."
- The substrate items (loss-event taxonomy, RCSA cycle, KRI framework, Risk Return §3 generator, Pillar 3 §3.6 renderer, SMA RWA engine) are all build-phase-buildable; deferring them means more work compressed at the licence-day gate.
- Forfeits the build-phase opportunity to dry-run the operational-risk discipline against synthetic loss events.

---

## 4. Recommendation

**Option B — subsume into existing roles, with `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` opened as the licence-day re-examination.**

Reasoning, in priority order:

1. **Principle 6 (autonomous by default) and the operating-model "no real employees beyond statutory minimum" rule both push against Option A during the build phase.** A new agent seat is appropriate when (a) no qualified agent exists *and* (b) the workload justifies a dedicated agent. Test (a) fails for operational risk: Rohan's persona spec already covers the operational risk module of the risk engine; Helena's CRO mandate covers the policy governance; Devon's COO mandate covers operational-resilience execution; Vera's mandate covers third-line assurance; Bea owns the return generators. Five existing agents collectively cover the six substrate items — none stretches an existing scope beyond its declared boundary.

2. **The build-phase workload is zero live loss events.** A dedicated agent with no live event flow is over-allocated; the build phase is for substrate-readiness, not live operation. Re-examining at licence-day, when actual workload is observable, is the more disciplined call.

3. **Option C's "defer and delete" produces worse policy drift than the current TBC marker.** Both policies *describe* operational-risk substrate as in-scope; deleting the role label would leave orphaned substrate descriptions. Option B repairs the policy text with named contributors *and* preserves the substrate work.

4. **Option B is consistent with how the bank already governs market risk and credit risk.** Helena governs, Rohan measures, Bea reports, Vera assures. No standalone "market risk engineer" or "credit risk engineer" seat exists; the four-agent matrix is the working pattern. Op-risk applying the same shape is a coherence win, not a special case.

5. **The licence-day re-examination is the right cadence to ask the hire question.** At that gate the bank has (a) actual loss-event flow signal (real or synthetic-stressed), (b) a concrete Risk Return submission cadence, (c) a Pillar 3 first-issue under live operations, and (d) a defensible answer to "do we need a dedicated engineer here?" None of those signals are present today.

The trade-off Option B accepts is matrix accountability rather than single-named accountability. The mitigation is the four-agent ownership table in §3 Option B; Owen's persona-policy coherence sweep already asserts this kind of matrix in code (the recon pipeline at `prototype/platform/recon/persona-attribution-coherence.ts`); Vera will run continuous assurance over the arrangement. The arrangement is auditable.

---

## 5. Implications if approved

### If Marc approves Option A (hire)

**Files that change:**

- `Team/_team-roster.json` — new row, type `engineering`, reportsTo Helena, matrixTo Devon (added by Nolan post-approval).
- `Team/<Name>.md` — new persona spec, 17-section template (authored by Nolan post-approval).
- `Policies/regulatory-reporting-policy-v1.md` (3 occurrences) — replace TBC marker with the new agent's name.
- `Policies/pillar-3-disclosure-policy-v1.md` (1 occurrence) — same.
- `CLAUDE.md` — Engineering-vs-governance section may want a one-line nod to the new bench row (Helena's bench gains an engineer).

**Agents spec'd / briefed:**

- PAX briefed to research the role (one dispatch).
- Nolan briefed to mint the role spec + roster row (one dispatch, after PAX research).
- The new agent gets the six substrate items as its initial workstream backlog.

**Cost line items:**

- Anthropic token spend: marginal monthly increment for one standing agent (small but recurring).
- Author time: PAX research dispatch + Nolan hire dispatch + policy-update dispatch ≈ 3 author cycles.

**Timeline shape:**

- Approval → PAX research dispatch → Nolan hire dispatch → policy text update → first substrate-item dispatch under the new agent: ~5 dispatches over a build-phase week.

### If Marc approves Option B (subsume — RECOMMENDED)

**Files that change:**

- `Policies/regulatory-reporting-policy-v1.md` — 3 line edits replacing "operational risk engineer (role on Helena's engineering bench — substantive name attribution pending)" with the named contributor matrix from §3 Option B.
- `Policies/pillar-3-disclosure-policy-v1.md` — 1 line edit, same shape.
- `Team/_team-roster.json` — **no change** (canonical).
- `Team/Rohan.md` — optional one-line clarification in §16 that operational-risk engineering is in-scope (it already is; the language can be sharpened).
- `Team/Helena.md` — optional one-line clarification under "Decisions in scope" naming operational-risk sponsorship explicitly (it already is implicit via the CRO mandate).
- A new decision card `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` is opened with `phase: "requested"` and deadline pinned to Saskia's pre-licence go-live readiness gate.

**Agents spec'd / briefed:**

- No new agents.
- One dispatch (Owen, governance hygiene) to update the two policy files post-approval.
- No further dispatches for the operational-risk function itself — the six substrate items lift to their natural owners' roadmaps (Rohan, Helena, Devon, Bea, Vera) and are picked up under those owners' standing workstreams.

**Cost line items:**

- Anthropic token spend: zero immediate increment.
- Author time: one policy-update dispatch (Owen) + one decision-card-opening dispatch (Owen) for the licence-day successor.

**Timeline shape:**

- Approval → Owen policy-update dispatch → recon:persona-attribution-coherence asserts the new attribution shape → done. Approx one dispatch within build-phase day.
- The licence-day re-examination dispatch ticks on Saskia's pre-licence-readiness substrate cadence.

### If Marc approves Option C (defer + delete)

**Files that change:**

- `Policies/regulatory-reporting-policy-v1.md` — delete or rephrase the three "operational risk engineer" references; mark §3 (Risk Return op-risk content) as **PLANNED licence-day**.
- `Policies/pillar-3-disclosure-policy-v1.md` — delete or rephrase §3.6 references; mark §3.6 as **PLANNED licence-day**.
- Substrate gap registry — add the six items above as `licence-day-bind` with explicit no-owner during the build phase.
- A new decision card `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` is opened as the gating decision for staffing the function at the pre-licence gate.

**Agents spec'd / briefed:**

- No new agents.
- One dispatch (Owen, governance hygiene) to update the two policy files + author the licence-day decision card.

**Cost line items:**

- Anthropic token spend: zero immediate increment.
- Author time: one dispatch.
- **Hidden cost:** the six substrate items move to licence-day; that gate absorbs their delivery load, increasing the burst-work the bank must complete before commencement-of-trading.

**Timeline shape:**

- Approval → Owen policy-update + licence-day-card dispatch → done. One dispatch.
- The six substrate items move to the licence-day backlog.

---

## 6. Decision

```
[ ] Approved — Option A (hire a dedicated operational-risk engineer)
[ ] Approved — Option B (subsume into Rohan + Vera + Devon + Bea, sponsored by Helena) — RECOMMENDED
[ ] Approved — Option C (defer; remove role label from policies; revisit at licence-day)
[ ] Sent back for more analysis

Authority: Marc (CEO)
Decided at: <pending>
Signature: <pending>
```

Routing on approval:
- Option A → PAX role-research dispatch → Nolan hire dispatch → policy-update dispatch.
- Option B → Owen policy-update dispatch + open `D-OPRISK-ENGINEER-ROLE-LICENCE-DAY` (planned).
- Option C → Owen policy-update + licence-day-card dispatch.

If sent back: comment with the angle missing or the option you want re-scoped.

---

*Authored by Owen (Company Secretary, governance) under brief `brief:owen:author-ceo-decision-card-d-oprisk-engineer-role:2026-05-21`, run `run:owen:2026-05-21T08-09-35-000Z`, in worktree `agent-a9179e34e499f2c4b`, on branch `worktree-agent-a9179e34e499f2c4b`. CEO decision routing per CLAUDE.md "Decision authority routing". Identity discipline (name + position on first mention) observed throughout.*
