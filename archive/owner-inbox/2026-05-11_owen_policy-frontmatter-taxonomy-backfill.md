---
title: Policy frontmatter — riskTaxonomy backfill (v1)
author: Owen (Company Secretary, governance)
date: 2026-05-11
summary: Backfill of the `riskTaxonomy` YAML frontmatter field across the 10 standalone v1 policies merged 2026-05-11 and the 10 pre-existing core-policy and v0 bundles in Owner Inbox. Codes drawn exclusively from the canonical Risk Taxonomy v1 (`Regulations/_risk-taxonomy.md`); no new codes invented. Closes the policy-frontmatter line of the §9 gap log in the taxonomy register. Surfaces three taxonomy gaps for Helena's next-tick consideration.
decision-required: false
riskTaxonomy: RT-LR.RC
---

# Policy frontmatter — riskTaxonomy backfill (v1)

> **Author.** Owen (Company Secretary, governance).
> **Standing authority.** Risk Taxonomy v1 §8 (canonical-citation surface for policies) and §9 gap log line "Policy-frontmatter `riskTaxonomy` annotation across the eight risk-policy bundle + sibling policy bundles". Canonical taxonomy: [`Regulations/_risk-taxonomy.md`](../Regulations/_risk-taxonomy.md); typed enum mirror: [`prototype/platform/risk/taxonomy.ts`](../prototype/platform/risk/taxonomy.ts).
> **Scope.** YAML frontmatter only — no policy content modified. Two file classes:
> 1. **Standalone v1 policies merged 2026-05-11 (10 files)** — already had frontmatter; `riskTaxonomy` added.
> 2. **Bundle files (10 files: 5 × `core-policies-*` from 2026-05-06; 5 × `*_*-policies-bundle-v0.md` from 2026-05-07)** — 5 of these (the 2026-05-06 bundle) had no frontmatter; a minimal `---` block with only `riskTaxonomy` was added per the dispatch brief's "do not invent other fields" constraint.

## 1. Assignment table — standalone v1 policies

| # | File | Code(s) assigned | Reasoning |
|---|---|---|---|
| 1 | `2026-05-11_camille-helena_capital-management-policy-v1.md` | `RT-CR`, `RT-LQ`, `RT-ST` | Capital adequacy is the bank's loss-absorbing buffer against credit losses (`RT-CR`) and the buffer against liquidity-driven re-pricing of trapped capital (`RT-LQ`); ICAAP governance and capital-planning sit under strategic / business risk (`RT-ST`). The policy covers CET1 / AT1 / T2 structure plus distribution controls, which span all three. Multi-code per §6 of the taxonomy: "A policy may *reference* additional nodes in its body … the frontmatter classification names the policy's *primary* risk it governs" — here three primary axes are co-equal. |
| 2 | `2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md` | `RT-LQ` | LCR, NSFR, intraday liquidity, CFP, ILAAP — all sit cleanly under `RT-LQ` (Liquidity & funding risk). Single-code. |
| 3 | `2026-05-11_mira-zara_rmcp-v1.md` | `RT-FC` | RMCP per FIC Act s.42 is the umbrella programme over all financial-crime sub-types (ML, TF, PF, sanctions, fraud, B&C, tax-evasion-facilitation). Tagged at level-1 `RT-FC` rather than a single level-2 because the programme spans the full sub-tree. |
| 4 | `2026-05-11_mira-zara_aml-cft-policy-v1.md` | `RT-FC.ML`, `RT-FC.TF`, `RT-FC.SA` | AML / CFT policy substantively covers money-laundering (`RT-FC.ML`), terrorism-financing (`RT-FC.TF`), and sanctions (`RT-FC.SA`) — those three are co-primary per §6 of the policy (transaction-monitoring + sanctions-screening + STR escalation). Proliferation-financing (`RT-FC.PF`) is referenced in body but not policy-primary; fraud (`RT-FC.FR`) and bribery (`RT-FC.BC`) sit under separate policies. |
| 5 | `2026-05-11_kai-helena-devon_trading-mandate-v1.md` | `RT-MK`, `RT-CR.CP`, `RT-CR.SL`, `RT-OP.PA` | Trading book exposures are level-1 market risk (`RT-MK`); the policy explicitly covers counterparty credit risk on OTC derivatives (`RT-CR.CP`), Herstatt FX settlement (`RT-CR.SL`), and payments / settlement processing (`RT-OP.PA`) since the mandate sets the booking model and FX settlement risk framework. |
| 6 | `2026-05-11_owen-helena_fit-and-proper-policy-v1.md` | `RT-OP.PE`, `RT-ST.GV` | F&P is at its core a *people-risk* control (`RT-OP.PE` — operational people risk) — competence, integrity, solvency of named individuals. It also operates as a *governance-effectiveness* control over Board / executive composition (`RT-ST.GV`). The dispatch brief proposed `RT-LR.GOV` as secondary; that code does not exist in v1 — `RT-ST.GV` (governance-effectiveness risk under strategic & business risk) is the canonical fit. See §3 gap. |
| 7 | `2026-05-11_iris-zara_popia-privacy-policy-v1.md` | `RT-LR.DP` | POPIA / data-protection is `RT-LR.DP` (data-protection risk under legal & regulatory risk). The dispatch brief proposed `RT-LR.PRIV` — that code does not exist in v1; the canonical code is `RT-LR.DP`. Single-code. |
| 8 | `2026-05-11_thandiwe-vera_internal-audit-charter-v1.md` | `RT-ST.GV` | Internal audit is a third-line *governance-effectiveness* control. The dispatch brief proposed `RT-LR.GOV`; that code does not exist in v1. The canonical fit is `RT-ST.GV` (governance-effectiveness risk under strategic & business risk) — see §3 gap. Single-code. |
| 9 | `2026-05-11_owen-sade_remuneration-policy-v1.md` | `RT-CD`, `RT-OP.PE`, `RT-ST.GV` | Remuneration design — deferral, malus, clawback, Material Risk Taker treatment — is principally a *conduct* control (`RT-CD`: prevent unfair-outcome incentives, market-abuse incentives, conflict-of-interest incentives). It is also a *people-risk* control (`RT-OP.PE`: turnover, key-person, retention) and a *governance-effectiveness* control (`RT-ST.GV`: RemCo cadence, Board-approved bonus pool). The dispatch brief proposed `RT-CO.CULT`; that code does not exist in v1 (no `RT-CO` level-1 node; closest is `RT-CD` Conduct risk) — see §3 gap. |
| 10 | `2026-05-11_helena-camille_recovery-resolution-planning-policy-v1.md` | `RT-CR`, `RT-LQ`, `RT-ST` | Recovery planning's early-warning indicators span capital (credit losses driving capital pressure → `RT-CR`), liquidity (LCR / NSFR / intraday breach → `RT-LQ`), and strategic levers (business-model viability, resolution preparedness → `RT-ST`). Mirrors the Capital Management Policy multi-code assignment — these two policies are the capital / strategic side of the ICAAP–ILAAP–Recovery triplet. |

## 2. Assignment table — bundles

| # | File | Code(s) assigned | Reasoning |
|---|---|---|---|
| 11 | `2026-05-06_core-policies-risk.md` | `RT-CR`, `RT-MK`, `RT-LQ`, `RT-OP`, `RT-OP.RE`, `RT-OP.MD` | Bundle contains RMF (cross-cutting), Credit Risk (`RT-CR`), Market Risk (`RT-MK`), Liquidity (`RT-LQ`), Operational (`RT-OP`), Operational Resilience (`RT-OP.RE`), Model Risk (`RT-OP.MD`), Stress Testing (cross-cutting; subsumed by all level-1s). Frontmatter added (was bare `# Core policies — Risk` heading; no prior frontmatter). |
| 12 | `2026-05-06_core-policies-compliance-privacy.md` | `RT-FC`, `RT-FC.ML`, `RT-FC.SA`, `RT-CD`, `RT-CD.TC`, `RT-LR.DP` | RMCP (`RT-FC`), AML/CFT (`RT-FC.ML`), Sanctions (`RT-FC.SA`), KYC/CDD/EDD (`RT-FC.ML` lever), Conduct/TCF (`RT-CD`, `RT-CD.TC`), POPIA + PAIA + cross-border-transfer (`RT-LR.DP`). Frontmatter added. |
| 13 | `2026-05-06_core-policies-conduct-hr.md` | `RT-CD`, `RT-CD.CI`, `RT-CD.MA`, `RT-FC.BC`, `RT-OP.PE`, `RT-ST.GV` | Code of Conduct (`RT-CD`), Conflicts of Interest (`RT-CD.CI`), Insider Trading / PAD (`RT-CD.MA`), Anti-Bribery & Corruption (`RT-FC.BC`), Remuneration + Fit-and-Proper + Harassment (`RT-OP.PE` people-risk + `RT-ST.GV` governance), Whistleblowing + Gifts (`RT-CD` conduct overlay). Frontmatter added. |
| 14 | `2026-05-06_core-policies-finance.md` | `RT-CR`, `RT-LQ`, `RT-LQ.FN`, `RT-IRRBB`, `RT-ST.EV`, `RT-LR.RC` | Capital Management (multi: `RT-CR`+`RT-LQ`+`RT-ST.EV`), Accounting + Disclosure (`RT-LR.RC` regulatory-compliance + `RT-ST.EV` earnings reporting), Tax (`RT-LR.RC`), IFRS 9 ECL Provisioning (`RT-CR`), Funding Strategy + FTP (`RT-LQ.FN`), Hedge Accounting (`RT-IRRBB` banking-book; trading-book hedges sit under `RT-MK` in the Risk bundle), Collateral Management (`RT-CR.CP` cross-reference). Frontmatter added. |
| 15 | `2026-05-06_core-policies-infosec-ops.md` | `RT-OP.CY`, `RT-OP.TP`, `RT-OP.TP.CL`, `RT-OP.RE`, `RT-OP.TE`, `RT-OP.PR` | InfoSec + Cyber Resilience + Incident Response (`RT-OP.CY`), Outsourcing + Cloud (`RT-OP.TP` + `RT-OP.TP.CL`), BCP/DR (`RT-OP.RE`), Records Management (`RT-OP.PR` process risk; cross-references `RT-LR.DP` for POPIA-bound records), Change Management + Secure SDLC (`RT-OP.TE` technology-resilience + `RT-OP.CY` security-vuln). Frontmatter added. |
| 16 | `2026-05-07_bea_finance-policies-bundle-v0.md` | `RT-LR.RC`, `RT-ST.EV`, `RT-OP.MD` | Accounting Policies (IFRS) + Financial Reporting & Disclosure are primarily regulatory-compliance (`RT-LR.RC`: IFRS-disclosure obligations) and earnings-presentation (`RT-ST.EV`). IFRS-model dimension (ECL inputs, hedge-accounting tests) anchors `RT-OP.MD`. |
| 17 | `2026-05-07_imani_legal-policies-bundle-v0.md` | `RT-LR.CT`, `RT-OP.LE` | Contracting Policy is `RT-LR.CT` (contract-enforceability risk — ISDA / GMRA / clause-library). Document Execution / ECTA is `RT-OP.LE` (legal-execution risk — defective contracting, unenforceable clauses in the operational pipeline). Clean two-axis split per §6 worked-examples logic. |
| 18 | `2026-05-07_niko_conduct-policies-bundle-v0.md` | `RT-CD`, `RT-CD.CC`, `RT-CD.TC` | FAIS Policy + Customer Treatment Policy = conduct-risk regime at level-1 (`RT-CD`), with client-conduct (`RT-CD.CC`) and TCF (`RT-CD.TC`) as the specific sub-types the policies target. |
| 19 | `2026-05-07_rohan_risk-policies-bundle-v0.md` | `RT-CR` | Provisioning / IFRS 9 ECL Policy is ECL on credit exposures — single-code `RT-CR`. |
| 20 | `2026-05-07_tomas_payments-policies-bundle-v0.md` | `RT-OP.PA`, `RT-OP.TP.MS`, `RT-CR.SL` | Payments Policy primarily payments / settlement processing (`RT-OP.PA`); Sponsor-Bank Operating Policy is third-party market-services dependency (`RT-OP.TP.MS`); FX-leg-PvP carve-out anchors `RT-CR.SL` (Herstatt) per §6 worked example. |

## 3. Taxonomy gaps surfaced — for Helena (Chief Risk Officer, governance) next-tick consideration

The dispatch brief proposed three codes that do not exist in the v1 taxonomy. None were invented; each was substituted with the canonical fit. These substitutions also surface three live questions for the taxonomy maintainer:

| Brief-proposed code | Status | Substituted with | Question for taxonomy maintainer |
|---|---|---|---|
| `RT-LR.GOV` | Does not exist | `RT-ST.GV` (governance-effectiveness risk) | Should `RT-LR` get a `.GV` level-2 for *legal-side governance risk* (board-meeting quoracy, statutory-filing deficiency, statutory-officer-vacancy risk), distinct from `RT-ST.GV` (governance-*effectiveness* risk — how good the governance is at producing decisions)? Three documents (Fit-and-Proper, Internal Audit Charter, Remuneration) want a code that's about the *form* of governance, not its effectiveness. For v1 the substitution into `RT-ST.GV` works; if Helena wants the distinction, a `D-RT-LR-GV` CeoDecision could add it. |
| `RT-LR.PRIV` | Does not exist | `RT-LR.DP` (data-protection risk) | None — `RT-LR.DP` is unambiguously the canonical POPIA / data-protection node. The brief used a non-canonical synonym; no taxonomy change needed. |
| `RT-CO.CULT` | Does not exist (no `RT-CO` level-1) | `RT-CD` + `RT-OP.PE` + `RT-ST.GV` | The brief's `RT-CO.CULT` was reaching for a "Conduct / culture / remuneration" pocket. v1 places conduct risk under `RT-CD` (which the brief miswrote as `RT-CO`); culture-of-the-bank concerns are distributed across `RT-CD` (conduct-of-business culture), `RT-OP.PE` (people / insider misconduct), and `RT-ST.GV` (governance / tone-at-the-top). No new node is recommended for v1 — three existing nodes carry the load — but Helena may wish to add a `RT-CD.CL` (culture) level-2 if she wants the dimension cited atomically in one place. Flagging for v2 consideration only. |

Additionally, the brief's `RT-LIQ`, `RT-FC.SANC`, `RT-CR.COUNTERPARTY`, `RT-OP.PEOPLE`, `RT-OP.PROC`, `RT-STRAT` were *naming-convention drift* against the canonical taxonomy (`RT-LQ`, `RT-FC.SA`, `RT-CR.CP`, `RT-OP.PE`, `RT-OP.PR`, `RT-ST`). The dispatch brief did not impose those as authoritative — the canonical register was followed in every case. No taxonomy change needed; flagging for any downstream brief-writing pipeline that may want to validate against the typed enum at authoring time.

## 4. Ambiguous cases — reasoning record

A handful of files involved genuine judgement calls. Recording the reasoning here so Vera's planned Wave-5 `taxonomy-coverage` recon can audit consistency:

- **Capital Management Policy** — chose three-code (`RT-CR` + `RT-LQ` + `RT-ST`) rather than the dispatch-brief's "pick the dominant" guidance because §6 of the taxonomy register explicitly permits multi-code frontmatter "where the policy spans multiple taxonomy nodes" and the Capital policy is genuinely the centre of all three (loss-absorbing → `RT-CR`; LCR-buffer dimension → `RT-LQ`; ICAAP-governance → `RT-ST`). A single-code reduction to `RT-CR` would mis-describe the policy.
- **RMCP vs AML/CFT Policy** — RMCP got level-1 `RT-FC`; AML/CFT got three level-2 codes (`RT-FC.ML`, `RT-FC.TF`, `RT-FC.SA`). The split mirrors the documents themselves: RMCP is the umbrella programme spanning the *whole* `RT-FC` sub-tree; AML/CFT Policy is the substantive instrument covering three named sub-types. This satisfies §8 "policy may *reference* additional nodes in its body … frontmatter classification names the policy's *primary* risk".
- **Trading Mandate** — four codes (`RT-MK`, `RT-CR.CP`, `RT-CR.SL`, `RT-OP.PA`). The brief proposed three; I added `RT-OP.PA` because the mandate's "FX settlement risk framework" explicitly covers operational payments / settlement processing in addition to the Herstatt-credit dimension (`RT-CR.SL`). The two are distinct (per §4.5 / §5.6 of the taxonomy register).
- **Internal Audit Charter** — `RT-ST.GV` single-code. Internal audit is a *control* over governance-effectiveness, not a risk-bearing function in itself; tagging at `RT-ST.GV` matches §8 "policies tag at primary risk *governed*".
- **5 × `core-policies-*` bundles** — each carries 4–6 codes reflecting the bundle's actual coverage (verified by enumerating section headings and matching to taxonomy nodes). Bundle multi-coding is explicitly contemplated by the dispatch brief ("multi-code — covers many").

## 5. Outputs

20 files edited (frontmatter-only):

- 10 standalone v1 policies (already had frontmatter; `riskTaxonomy` added).
- 5 × `2026-05-06_core-policies-*.md` (no prior frontmatter; minimal `---` block added per dispatch-brief constraint).
- 5 × `2026-05-07_*_*-policies-bundle-v0.md` (already had frontmatter; `riskTaxonomy` added).

## 6. Next-tick handoffs

- **Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO; obligations-register curator).** Obligations-register backfill (next-tick item per §9 of the taxonomy register) is the natural next step now that policies cite the taxonomy. Mira tags each `ORG-*` row with `riskTaxonomy: RT-<code>` at the narrowest stable node; the citation graph then closes Policy ↔ Obligation on the new axis.
- **Helena (Chief Risk Officer, governance).** Three taxonomy gaps surfaced in §3 above for v2 consideration; none block v1 publication. If Helena wishes to add `RT-LR.GV`, `RT-CD.CL`, or refine `RT-OP.PE` granularity, a `D-RT-<slug>` CeoDecision per §9 of the taxonomy register is the route.
- **Vera (Internal-audit engineer, engineering — functionally to Thandiwe CAE; administratively to CEO).** Wave-5 `taxonomy-coverage` recon pipeline (§9 of the taxonomy register) can now assert: every policy in `Owner Inbox/` carrying the word "policy" or "charter" or "mandate" in its filename has a `riskTaxonomy` frontmatter field — this backfill closes the "Policy-frontmatter" line of the gap log.
- **Owen (Company Secretary, governance) — self.** Future policy authoring includes `riskTaxonomy` in frontmatter at authoring time, not as a backfill — the agent-spec template at `Team/_agent-spec-template.md` should pick this up in its next touch.

## 7. Substrate gap

A typed validator (e.g. extending the citation-gate at `prototype/platform/citations/citation-gate.ts` or adding a new gate `prototype/platform/citations/risk-taxonomy-gate.ts`) that asserts every `Owner Inbox/*policy*.md` and `*charter*.md` and `*mandate*.md` carries a valid `riskTaxonomy: RT-<code>` field — and that every cited code resolves against the typed enum at `prototype/platform/risk/taxonomy.ts` — would prevent drift between the register and the policy-frontmatter set. This is the Vera Wave-5 work named at §9 of the taxonomy register. Flagging as a known substrate gap (not a blocker for this backfill).
