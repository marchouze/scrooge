---
title: API + cloud cost budget for the build phase
author: Camille
date: 2026-05-09
summary: Proposes a monthly Anthropic API budget envelope for the build phase (lean / balanced / accelerated), a watch-and-report cadence, and a placeholder for the Azure projection that lands at M8. Recommends the balanced envelope.
decision-required: false
maps-to-decision-id: S6
note: Brief written 2026-05-08 to inform curated S6 (still open). Duplicate ID retired so the open-decision queue is not double-listed; substantive content (Balanced envelope USD 1,500–3,500/month, weekly Camille snapshot, Azure deferred to M8) is the CFO-frame source-doc Marc reads alongside the curated S6 entry on the dashboard.
---

# API + cloud cost budget for the build phase

**Author:** Camille (CFO)
**Reports through:** CEO (Marc)
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:**
- CLAUDE.md "Operating model — what is real, deferred, paused" — Anthropic API spend and Marc's attention are the only real costs in the build phase.
- `Finance/_opex-register.md` — `OPEX-COMPUTE-01` is the single `LIVE` opex line; `OPEX-INFRA-01` (Azure) is `DEFERRED` until M8.
- `project_cloud_target_azure` memory — Azure is the production cloud; the lift is the M8 phase.
- `project_ai_driven_bank` memory — build phase has no real customers, no real capital, no statutory humans beyond minimum.
- Principle 1 (events as truth — every cost reading is itself an event under `OpexReadingObserved`).
- Principle 5 (multi-currency from day one — Anthropic bills in USD; bank reports in ZAR).
- Principle 6 (no orphan capability — the budget envelope is the policy artefact this brief produces; the procedure binding is named in §6).

> **Derivation note (Principle 6 — downward).** This brief sits at the *policy* layer: it asks the CEO to set a financial-control envelope. The envelope below derives from (a) the only real opex line on the register, (b) the visible build pace from event-store evidence, and (c) the operating-model framing in CLAUDE.md. No new substantive content originates here — every number is sourced or flagged as an order-of-magnitude estimate.

---

## 1. The two costs, kept apart

The pack the CEO needs to decide on covers two cost surfaces. They are at very different stages and must not be conflated.

### 1.1 Today's recurring cost — Anthropic API tokens (`OPEX-COMPUTE-01`)

This is the **only** line in `Finance/_opex-register.md` marked `LIVE`. It is real, it is billed monthly to a real account, it is denominated in USD, and it grows with build pace. Every Scrooge-coordinated session, every Camille snapshot, every Atlas substrate-state run, every Vera recon-narrative consumes tokens. The largest visible token consumers today are:

- **Scrooge orchestration sessions** — multi-turn CEO interactions with file reads + persona briefs + dashboard derivations.
- **Persona handler runs** — each persona's scheduled / event-driven handler (when narrated) calls Claude with the inventory output and produces the deliverable text.
- **Recon-pipeline narratives** — the recon harnesses themselves are deterministic code, but the audit-friendly write-ups are LLM-generated.
- **Decision-pack drafting** — pieces like this brief, cutover specs, RAS, governance frameworks.

There is **no first formal reading** on this line yet (`Finance/_opex-register.md` row `OPEX-COMPUTE-01`, "Latest known amount: TBD"). That is the first substrate gap this brief surfaces and is part of the proposal in §3.

### 1.2 Future recurring cost — Azure cloud (`OPEX-INFRA-01`)

`Finance/_opex-register.md` lists this as `DEFERRED`. It activates on the M8 cloud lift (per the cloud-target memory). Today the bank's substrate runs locally — no Azure resources are provisioned, no Azure subscription is active for the bank. There is therefore **no Azure spend today** and no envelope to set today.

The cloud-target memory specifies the substrate components the lift will replace (event store → managed Postgres or Event Hubs+Cosmos; identity → Entra ID; HSM → Key Vault Managed HSM; observability → Azure Monitor; etc.). Each of those is a future cost line, several of which already have their own `OPEX-*` rows in `DEFERRED` state. The Azure envelope is decided **at the M8 readiness gate**, not now.

What this brief does for the Azure line is acknowledge it, register the placeholder, and name the trigger that opens the envelope decision (§5).

### 1.3 What is *not* in scope for this brief

For honesty:

- **External counsel** (`OPEX-OTHER-01`) — `DEFERRED`; activates at the licence-application moment.
- **External auditor** (`OPEX-OTHER-02`) — `DEFERRED`; activates on statutory trigger or licence-day.
- **Insurance** (`OPEX-OTHER-03`) — `DEFERRED`; activates at licence-day.
- **Domains + DNS** (`OPEX-INFRA-02`) — `DEFERRED`; activates on bank-name selection + CIPC filing.
- **Production data residency** (`OPEX-INFRA-04`) — `DEFERRED`; pre-licence review.
- **Marc's attention** — the binding *human* resource per CLAUDE.md, but not a financial cost line.

Each of those will be a separate decision pack at the moment its trigger fires. This brief is the API-and-cloud pair only.

---

## 2. The honest baseline — we don't have a reading yet

The CFO seat is asking for an envelope before it has read the first invoice. That is awkward but defensible:

- The envelope exists to **bound future spend**, not to reconcile to past spend. It is a forward-looking control. Setting it before a reading is fine; reconciling without one is not.
- The envelope sets the threshold above which Marc gets an alert. It does not commit Marc to spending up to it.
- The first formal reading lands on the next monthly close; the envelope is then re-read against that reading and adjusted up or down.

What I *can* see is the **build pace**, and pace is a proxy for token consumption:

| Surface | Visible quantity (as of 2026-05-08) | Source |
|---|---|---|
| PRs landed in the most recent session | ~9 | Most recent CEO status (`project_open_workstreams_2026_05_08` memory) |
| Persona files | 24 | Same, plus `/Team/` directory |
| Runtime handlers | ~28 | `runtime/handlers-metadata.ts` |
| Recon pipelines | 9 | `prototype/platform/recon/*.ts` |
| Live opex lines | 1 (Anthropic) | `Finance/_opex-register.md` |
| Decision packs already in `Owner Inbox/` | 40+ files | Directory listing |

A pace of "9 PRs + 24 personas + 28 handlers + 9 recon pipelines in the recent build window" is *substantial*. The most token-expensive activities — multi-file reads, multi-persona drafting, recon narrative generation — are running daily. We are firmly inside the territory where token spend is meaningful relative to a typical individual's discretionary budget. We are almost certainly *not* in territory where it is meaningful relative to the eventual licence-day cost stack.

The order-of-magnitude bands in §3 are calibrated against this pace, not against a past invoice. They are explicitly bands, not point estimates. The first reading will let me narrow them; until then they are honest about being bands.

---

## 3. Three monthly envelopes for build phase

I propose three named options, each scoped to the **Anthropic API line only**. The Azure envelope is §5, deferred. All amounts are USD (Anthropic's billing currency); ZAR conversion is a presentation overlay applied at reading time per Principle 5.

| Option | Monthly envelope (USD) | What it buys (build pace) | What it sacrifices |
|---|---|---|---|
| **Lean** | 500 – 1,500 | ~2–3 deep Scrooge sessions / week, daily handler runs at low narrative cadence (inventory-only on most runs; narrative on weekly runs), recon pipelines run but most narratives suppressed, decision packs drafted in shorter form. | Slower fleet rollout; fewer cross-persona briefs; some Vera recon findings stay un-narrated; less iteration headroom on substrate design (e.g. P-series pivots, M1 trading-stack threat model). |
| **Balanced** | 1,500 – 3,500 | ~5 deep sessions / week (matches current observed cadence), all handlers narrate at their declared cadence, all recon pipelines narrate findings, decision packs drafted in full prose, parallel cross-persona briefs (e.g. Atlas + Vera + Anya simultaneous). | Cost grows linearly with fleet size — adding a persona adds its handler's monthly token usage. Visible upper-band breach on a busy week is plausible. |
| **Accelerated** | 3,500 – 7,500+ | Two-track parallel build (e.g. M1 trading stack + agent-runtime substrate progressing in lockstep), aggressive A/B substrate experimentation, multiple recon pipelines per week, in-session deep-research forks via PAX, larger context windows for legal-and-regulatory drafting (Imani, Mira). | Highest spend; the tail is fat — a Claude-heavy week (multi-persona M1 drafting + obligations-register expansion + governance bundle re-derivation) can run substantially over the upper band. Variance is the cost. |

**Reading the bands.** The bottom of each band assumes a quiet week (one or two sessions, scheduled handlers running, no big drafting push). The top of each band assumes a busy week (multi-persona deep-drafting, decision-pack-heavy). Neither bound is a hard ceiling — Anthropic's billing is post-paid and usage-based — they are the **alert thresholds** Camille watches against.

**What "balanced" matches today.** The current build cadence — single owner-CEO, ~5 working days a week, multi-persona daily handlers, full recon narration, decision packs at full prose, currently ~24 personas — is what the **Balanced** option is calibrated for. Without a formal reading I will not commit a point estimate; the band is my honest range.

**What pushes spend up over time.** Three forces:
1. **More personas.** Each new hire adds its handler's monthly token usage. 24 → 30 personas is roughly +25% on handler-narrative spend, all else equal.
2. **More events triggering narratives.** As event-store volume grows, recon pipelines have more to assert against — narrative cost scales with finding count.
3. **Higher session intensity.** A multi-track week with M1 + agent-runtime + governance drafting in parallel uses more tokens than a single-track week.

**What pushes spend down over time.** Two forces:
1. **Inventory-only handlers when ANTHROPIC_API_KEY is unset on the runner.** Today many handler runs already skip the narrative when the key is unavailable (visible in the recent Camille substrate-state outputs — "Narrative skipped: ANTHROPIC_API_KEY not set on this runner"). That is a free rate-limiter; it also means a fraction of today's runs cost zero in API tokens.
2. **Caching and prompt-shape hygiene.** Anthropic prompt cache hits are materially cheaper than fresh reads. As substrate stabilises, more reads become cache hits — particularly on the persona files, principle text, and obligations register, all of which are read by every Scrooge orchestration session.

**Why I am not point-estimating.** A point estimate without an invoice would be theatre. The bands above are calibrated to "what range of monthly billing would not surprise me, given the visible build pace". The first reading collapses the range to a number; until then, the band is the honest answer.

---

## 4. Watch-and-report cadence

The envelope is only useful if Camille reports against it on a known cadence. I propose:

| Cadence | Surface | What it carries | Owner |
|---|---|---|---|
| **Weekly** | Camille's existing `financial-position-snapshot` (per `Team/Camille.md` § 6) | Current week's cumulative spend (best-known), running monthly total, % of envelope used, days remaining in the month, projection-to-month-end straight-line. | Camille (handler run) |
| **Monthly close** | Camille's `cfo-substrate-state` + first formal `OPEX-COMPUTE-01` reading on `Finance/_opex-register.md` | Closed-month actual; reconciliation to envelope; variance commentary; trigger to adjust envelope if variance > 20%. | Camille (handler run) |
| **Threshold alert (event-driven)** | New `BudgetThresholdBreached` event → Scrooge surfaces in Owner Inbox | Fires when month-to-date spend crosses 75% of envelope mid-month, or 100% of envelope at any point. Carries the breach amount, days remaining, projected month-end. | Camille (event) → Scrooge (surface) |

The threshold alert is the only event-driven piece — the rest is calendar-cadence handler. The alert is what gives the envelope teeth.

**On the missing reading.** Until the first reading lands, Camille's weekly snapshot uses Marc's manually-attested figure (Marc reads the Anthropic console, attests an `OpexReadingObserved` event with the observed monthly-billed amount). The procedure binding for this is `Procedures/by-policy/cost-reading-attestation.md` — listed as **planned** in `Finance/_opex-register.md` § Procedures. Closing that procedure gap is a Camille-owned next slice; it does not block setting the envelope today.

**Estimated cadence reliability.** The weekly handler runs whether or not Marc is in-session. The monthly close depends on Marc attesting the reading once per month. The threshold alert depends on the `OpexReadingObserved` event existing — i.e. on the attestation handler running.

---

## 5. Azure projection — placeholder, not a number

I will not put a number on Azure today. Doing so would either:
- (a) anchor on a number that is wrong by an order of magnitude (Azure cost depends on substrate choices Atlas has not yet made — managed Postgres vs Event Hubs+Cosmos, AKS vs Container Apps vs Functions, cross-region DR posture, Key Vault Managed HSM tier — all per the cloud-target memory's "Open architectural questions"), or
- (b) constrain those substrate choices in advance of the design work, which is the wrong sequencing.

What I *can* commit is the **shape** of the Azure projection that lands at M8:

| Section of Azure projection (M8) | What it will contain |
|---|---|
| **Substrate inventory** | Resource list per substrate-replacement seam (event store, identity, HSM, observability, IaC, dashboard distribution). Cited to Atlas's M8 IaC. |
| **Pricing per resource** | Azure list price + reservation discount where applicable, per resource. Cited to the Azure price calculator output baked into the IaC. |
| **Monthly run-rate band** | Lean / balanced / accelerated calibrated to expected M8 traffic — same shape as §3, calibrated to cloud spend not API spend. |
| **Capacity headroom** | What additional load (event volume, projection refresh frequency, retention) the band absorbs before tier-up. |
| **One-time migration cost** | Data migration egress + first-month over-provisioning during the cutover. |

**Trigger for the Azure envelope decision.** When Atlas's M8 substrate-spec lands (separate decision card, expected post-Phase-3 of the A2.2 cutover and post the agent-runtime substrate becoming load-bearing), Camille produces the Azure projection in the shape above and a sibling decision pack `D-AZURE-COST-BUDGET`. That pack carries the numbers; this pack does not.

**Status until then.** `OPEX-INFRA-01` stays `DEFERRED` on the opex register. The line exists; it does not consume budget; it does not surface in the weekly snapshot.

---

## 6. Procedure binding (Principle 6 — upward)

The envelope binds to the existing build-phase opex policy chain:

- **`Procedures/by-policy/build-phase-opex-tracking.md`** — owner Camille (planned, listed in `Finance/_opex-register.md` § Procedures). This is the procedure that reads the register, refreshes monthly readings, and surfaces variance > 20% as `RiskRaised`. The envelope set by this brief is the threshold the procedure asserts against.
- **`Procedures/by-policy/cost-reading-attestation.md`** — owner Camille (planned, same source). This is the procedure that turns "Marc looked at the Anthropic console" into a typed `OpexReadingObserved` event with citation. The envelope's threshold-alert depends on this procedure existing.
- **`Procedures/by-policy/monthly-close-sign-off.md`** — owner Camille (planned, listed in `2026-05-07_camille_cfo-substrate-state.md`). Reconciles closed-month actuals to the envelope; emits `BudgetVarianceFiled` if > 20% off.

All three procedures are in the **planned** column of `2026-05-07_camille_cfo-substrate-state.md` ("CFO-domain procedures — Missing"). This brief does not require any of them to land before the envelope is set — the envelope is itself the policy artefact, and the procedures discharge it. Closing them is a Camille-owned next slice, sequenced after Bea's sub-ledger projection (which is the higher-priority CFO-domain substrate).

**Source policy.** Build-phase opex tracking falls under the Financial Management Policy (in the policy register). The Financial Management Policy does not yet enumerate a "build-phase budget envelope" requirement — adding that paragraph is a one-line policy-register update that Owen sequences after this decision lands. Until then the envelope sits as a CEO-approved control that the policy will explicitly cite at its next refresh.

---

## 7. The decision asked

**D-API-CLOUD-COST-BUDGET — set the monthly Anthropic API budget envelope for the build phase, with a watch-and-report cadence; defer the Azure envelope to M8.**

Three sub-questions:

### 7.1 Envelope size

Choose one:
- **Lean** — USD 500–1,500 / month
- **Balanced** — USD 1,500–3,500 / month *(recommended)*
- **Accelerated** — USD 3,500–7,500+ / month
- **Counter** — Marc proposes a different band

### 7.2 Reporting cadence

Default proposal:
- Weekly snapshot (within Camille's existing `financial-position-snapshot` handler — no extra session cost).
- Monthly close reading (manually-attested by Marc once per month until the attestation procedure lands).
- Event-driven threshold alert at 75% mid-month + 100% any-time.

### 7.3 Azure deferral

Acknowledge that the Azure envelope is **deferred to M8** and that `OPEX-INFRA-01` stays `DEFERRED` on the register. Camille produces the Azure projection at the M8 readiness gate as a sibling decision pack `D-AZURE-COST-BUDGET`.

---

## 8. Recommendation

**Approve Balanced (USD 1,500–3,500 / month) with the cadence above; defer Azure.**

Reasoning, in three lines:

1. The current build pace — 9 PRs / ~24 personas / ~28 handlers / 9 recon pipelines in the recent window — is the pace the bank has been running at. Lean would slow this measurably; Accelerated buys parallel-track headroom that is not yet being used. Balanced matches today.
2. The envelope is an alert threshold, not a commitment — under-spend just means under-spend; over-spend triggers a conversation, not a blown budget. Setting the envelope at observed pace is conservative.
3. Deferring Azure is the right sequencing per the cloud-target memory: M8 is one coherent phase, the substrate choices are not yet made, putting a number on it now would either anchor or constrain. The placeholder is cheap; the number is not.

If a reading comes in materially above the upper band on the first close, I propose to re-read this decision rather than to keep silently breaching — the envelope is a control, not a fiction.

**One numerate sanity check.** Scaling the bank from "build phase, single owner, ~24 personas" up to "licence-day, real customers, real BA returns, real STRs/CTRs" will scale spend by a multiple I cannot estimate yet — but the multiple is almost certainly larger than 1× and almost certainly smaller than 100×. A build-phase envelope in the low-thousands of USD per month is therefore in the right *order of magnitude* even before the first reading. Wrong by 2× is plausible; wrong by 10× would imply the visible build pace and the spend it produces are decoupled in a way I would expect to notice in the recent invoices Marc has seen on the Anthropic console. The first attested reading either confirms this or collapses the bands.

---

## 9. When the envelope gets re-read

The envelope is not set-and-forget. I propose to re-read it on any of these triggers:

| Trigger | Why | Action |
|---|---|---|
| **First formal reading lands** | Calibrates the bands to a real number. | Camille publishes a one-page "envelope reconciliation" note: actual vs band, recommended adjustment if the actual is outside the band. |
| **Two consecutive months > 90% of upper band** | Pace has shifted up; the envelope is now trailing reality. | Camille proposes a band step-up (e.g. Balanced → Accelerated) as a sibling decision pack. |
| **Two consecutive months < 50% of lower band** | Pace has shifted down; the envelope is now wider than needed. | Camille proposes a band step-down. Lower envelope → tighter alert thresholds → earlier visibility. |
| **Fleet hires +5 personas** | Each persona adds handler-narrative spend; +5 is roughly +20% on the handler line. | Camille re-reads the upper band; may need a small step. |
| **A new substrate component starts narrating** (e.g. M1 trading-stack ships and emits its own briefs) | Net new spend line not previously in the envelope's calibration. | Camille re-reads. |
| **The ANTHROPIC_API_KEY is enabled on more runners** | Currently many runs produce inventory-only outputs because the key is absent. Enabling the key on more runners is itself a spend-up event. | Camille flags before the change lands; envelope re-read after one month of observed effect. |
| **M8 cloud lift authorised** | The Azure line activates; the API line continues. The total opex picture changes shape. | Camille produces the consolidated `D-AZURE-COST-BUDGET` pack. |

The general principle: **the envelope follows the bank, not the other way around.** It is a tracking instrument, not a forcing function. If pace genuinely demands more spend, the right answer is a step-up, not a self-imposed throttle that slows the build.

---

## 10. Substrate gaps surfaced

The brief surfaces these gaps; each becomes a roadmap item, not a hidden fact:

| # | Gap | Owner | Closes at |
|---|---|---|---|
| G-1 | **No first formal `OPEX-COMPUTE-01` reading.** Until Marc attests one, the envelope's variance metric is uncalibrated. | Camille + Marc | Next monthly close |
| G-2 | **Cost-reading-attestation procedure missing.** Listed `planned` in `Finance/_opex-register.md` § Procedures. | Camille | Sequenced after Bea's M1 sub-ledger projection |
| G-3 | **Build-phase-opex-tracking procedure missing.** Same source. | Camille | Same |
| G-4 | **No automated reader for Anthropic invoices.** Manual attestation is the bridge; Atlas's substrate could read the Anthropic billing API in a future slice. | Atlas (substrate) + Camille (consumer) | Post-M8 substrate slice |
| G-5 | **Azure projection placeholder, not a number.** Resolved at M8 readiness gate. | Camille + Atlas + Eitan | M8 |
| G-6 | **Financial Management Policy does not yet name the build-phase envelope.** One-line update at next policy refresh. | Owen | Next policy-register refresh |

---

## 11. Open items routed elsewhere

- **To Marc (CEO):** the decision in §7. Pick an envelope band, confirm cadence, acknowledge Azure deferral.
- **To Atlas:** no action this slice; the brief depends on Atlas's M8 substrate-spec arriving on its own cadence to unlock the Azure pack.
- **To Anya:** add `OpexReadingObserved` and `BudgetThresholdBreached` to the semantic layer ahead of the threshold-alert wiring. Short.
- **To Owen:** schedule the Financial Management Policy paragraph (§6) for the next policy-register refresh; cite this decision card.
- **To Bea:** no direct action; awareness only — when the sub-ledger projection lands, the close-cycle will be the natural home for the monthly variance reading.
- **To Vera:** consider adding a recon assertion that every `LIVE` line on `Finance/_opex-register.md` has at least one `OpexReadingObserved` event in the last 35 days once the attestation procedure lands. (Wave-5 candidate; not a Wave-4 entry.)
- **To Scrooge:** lift `D-API-CLOUD-COST-BUDGET` to the dashboard's Decisions queue via the `decision-required: true` frontmatter on this file; route the resolved decision via `ceo-decision-record` when Marc decides.

—Camille
