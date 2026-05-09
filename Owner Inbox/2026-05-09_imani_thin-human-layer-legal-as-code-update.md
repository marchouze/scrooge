---
title: Legal-as-code update — JS-1 structural CRO + alternates split (D-THIN-HUMAN-LAYER-MINIMUM)
author: Imani
date: 2026-05-09
summary: Codifies the CEO-approved modification to the thin-human-layer composition (D-THIN-HUMAN-LAYER-MINIMUM) as a small set of testable legal-as-code rules. Under Joint Standard 1 of 2024 the separate-CRO test moves from best-practice (post-licence sequencing) to **structural** (pre-lodgment requirement). The alternates split is now binding: deputy-IO = CoSec; MLRO-alternate = AC-Chair NED, not double-hatted CoSec. FAIS Key Individual gates on external-counsel confirmation of FSP scope before transitioning Marc-interim → Saskia steady-state. Names the TypeScript modules under `prototype/platform/legal/` that need to land to make these rules executable; module build is a separate slice.
decision-required: false
maps-to-decision-id: D-THIN-HUMAN-LAYER-MINIMUM
note: Imani's legal-as-code reading update following the CEO modification of S3 (`Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md`). Companion update to Owen's governance-framework revision (in parallel) and Mira's obligations-register row closure (in parallel). Touches only Imani's own files.
---

# Legal-as-code update — JS-1 structural CRO + alternates split (D-THIN-HUMAN-LAYER-MINIMUM)

**Author:** Imani (Legal-as-code engineer)
**Reports through:** Devon (COO) on the engineering line; co-curated with Owen (CoSec) on the governance line.
**Contributors / dependencies:** Owen (governance-framework revision in parallel), Mira (obligations-register row closure in parallel), Zara (CCO governance line — RMCP), Iris (POPIA Information Officer governance line), Helena (CRO — second-line independence), Rashida (CISO — Joint Standard 1 of 2024 substrate co-owner), Nolan (recruitment scope in parallel).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:**

- `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md` — canonical CEO decision record. Approved with modification (`action: modify`).
- `Owner Inbox/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md` — original recommendation paper (now bears a supersedes header).
- `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` — JS-1-of-2024 challenge that drove the modification.
- `Regulations/Joint-Standards/js-1-of-2024-cyber.md` — instrument analysis.
- `Regulations/_obligations-register.md` — citation register (Mira-curated, v1.3).
- `CLAUDE.md` — operating model (statutory humans kept to "the minimum the law requires — no more"); Principle 2 (every action traces to a source); Principle 6 (single-graph discipline); Principle 7 (autonomous by default).

**Status:** Reading update. Codifies the modification as legal-as-code rules; does not re-derive the analysis. Module build is a separate slice (see §6).

> **Derivation note (Principle 6 — downward).** This brief sits at the *standard* layer. The *what* (the composition) is fixed by the CEO decision record at the policy / governance-framework layer; this brief converts the modified composition into testable legal-as-code rules and names the TypeScript modules required to make those rules executable. New substance does not enter here.

---

## 1. Headline change to Imani's legal-as-code reading

The CEO-approved composition is **6 separate humans + Marc + external audit firm**, not 5+Marc+audit-firm as Owen+Imani drafted. The 6th human is a **separate human CRO**, appointed **before licence-application lodgment**.

Under **Joint Standard 1 of 2024** (PA / FSCA, jointly under FSR Act 9 of 2017), read with the BCBS Corporate Governance Principles for Banks (2015) §3, the operational independence of the CRO from the CEO is a **structural** test for licence-day — the licence-application itself fails the JS-1 surface if the CEO carries named CRO accountability at lodgment. Mira+Zara's read (`§3.1` of their confirmation paper) is that this is not a SARB-precedent challenge that can be answered by a post-licence hiring commitment; it is a JS-1 finding read with BCBS principles, and the only two postures consistent with it are (a) named human CRO before lodgment, or (b) explicit JS-1 derogation lodged in pre-application engagement.

The CEO chose (a). This brief codifies (a).

The alternates split (deputy-IO + MLRO-alternate) is now operative — Owen+Imani's original "CoSec carries both alternates" framing is replaced by Mira+Zara's **§4.2** split (deputy-IO = CoSec; MLRO-alternate = AC-Chair NED), to avoid the single-point-of-failure CoSec workload concentration.

The FAIS Key Individual posture is unchanged in shape but has a clearer gate: Saskia (steady-state) ↔ Marc (interim) transition fires when external counsel confirms FSP licensing scope at the licence-application gate (per `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` §2.4 — counsel-confirmed at the licence-application gate).

---

## 2. The legal-as-code rules

The rules below are written in the form Imani's eventual `prototype/platform/legal/role-composition-rules.ts` module will assert — pseudocode-precise but module-agnostic. Each rule carries a typed citation under Principle 2.

### Rule 2.1 — Separate-CRO is structural under JS 1 of 2024

```
RULE: cro-separate-from-ceo
SCOPE: licence-application-lodgment AND steady-state
ASSERTION: humanRoster.cro !== humanRoster.ceo
HOLDS-FROM: licence-application-lodgment-readiness-gate (pre-lodgment)
GATE: assertion must hold before the application is lodged with SARB Prudential Authority

CITATIONS:
  - Joint Standard 1 of 2024 §6 (responsible-person designation; PA/FSCA jointly under FSR Act 9 of 2017)
    — register: ORG-CY-02 (in force; see §3 reconciliation note)
  - Joint Standard 1 of 2024 §7 (operational-independence read)
    — register: ORG-CY-02 (gloss-extension proposed in Mira+Zara §5; row ORG-GV-CRO-INDEPENDENCE proposed)
  - Banks Act 94 of 1990 s.60 (Board composition; "sufficient size and composition" reading)
    — register: gap; ORG-GV-CRO-INDEPENDENCE proposed by Mira+Zara §5
  - BCBS Corporate Governance Principles for Banks (2015) §3 (substantive-independence reading on CRO)
    — register: cited in Mira+Zara §3.1; standalone register row not yet created
    [citation: TBC — needs Mira / Owen confirmation on whether BCBS Corp Gov Principles 2015 receives its own ORG-* row or stays as a cross-reference under ORG-GV-CRO-INDEPENDENCE]
  - CLAUDE.md — operating model; Principle 7 (autonomous by default; engineering-vs-governance split — Helena is the engineering CRO agent; the human CRO is the named licence-day seat Helena's outputs flow through)

DEROGATION-PATH:
  - documented JS-1-of-2024 derogation lodged with SARB PA in pre-application engagement
    (Mira+Zara §3.1 alternative; not the path the CEO chose)
```

**Material change from the prior reading.** Owen+Imani's original `2.3 Banks Act 94 of 1990 — CEO; CRO; CFO; auditor (s.61)` framed CRO-CEO merger as **"conditionally mergeable — but only with explicit SARB acceptance"** with the licence-day human CRO appointed **"as the first hire post-licence"**. That framing is withdrawn. The CRO seat is filled before lodgment, full stop, unless the bank takes the documented-derogation path (which it has not).

### Rule 2.2 — Deputy Information Officer is the Company Secretary

```
RULE: deputy-io-is-cosec
SCOPE: licence-day human roster (post-IO-lodgment with the Information Regulator)
ASSERTION: humanRoster.deputyInformationOfficer === humanRoster.companySecretary

CITATIONS:
  - POPIA Act 4 of 2013 s.56 (Information Officer designation)
    — register: ORG-PR(IV)-13 (PARTIAL; designation lodgment deferred under Round 1 E1)
  - POPIA Regulation 4 (deputy-IO contemplated under POPIA Reg. 4(2))
    — register: ORG-PR(IV)-13 (gloss-extension proposed in Mira+Zara §5; deputy-IO sub-gloss missing)
  - Information Regulator's published guidance on IO / Deputy-IO designation (October 2021 onwards)
    — register: cited in Mira+Zara Q2; standalone register row not yet created
    [citation: TBC — needs Iris / Mira confirmation on the precise IR guidance instrument reference and as-of date for the citation chain]
  - Companies Act 71 of 2008 ss.86–89 (Company Secretary)
    — register: ORG-GV-01 (in force)
```

**Note on lodgment.** The deputy-IO designation is itself a **separate lodgment** with the Information Regulator (Mira+Zara Q2 caveat). The lodgment is a CEO act (out-of-system today; in-system at the IO-designation procedure under Iris's mandate); this rule fires once both lodgments are complete.

### Rule 2.3 — MLRO-alternate is the Audit Committee Chair NED, not the Company Secretary

```
RULE: mlro-alternate-is-ac-chair-ned
SCOPE: licence-day human roster (post-MLRO-designation)
ASSERTION: humanRoster.mlroAlternate === humanRoster.audComCharNed
GUARD: humanRoster.mlroAlternate !== humanRoster.companySecretary
GUARD: humanRoster.mlroAlternate satisfies fit-and-proper independently per ORG-GV-11

CITATIONS:
  - FIC Act 38 of 2001 s.43A (MLRO designation; alternate contemplated under FIC published RMCP guidance)
    — register: ORG-FC-11 (in force; gloss-extension proposed in Mira+Zara §5 — `ORG-FC-MLRO-ALTERNATE` gap)
  - FIC published RMCP / Compliance-Officer guidance (FIC Public Compliance Communications)
    — register: cited in Mira+Zara §4.2; standalone register row not yet created
    [citation: TBC — needs Mira confirmation on the precise FIC PCC instrument reference and as-of date]
  - BCBS Corporate Governance Principles for Banks (2015) §3 (NED / AC-Chair substantive independence)
    — see Rule 2.1 citation TBC
  - CLAUDE.md — fit-and-proper standards under PA expectations (per ORG-GV-11)
```

**Material change from the prior reading.** Owen+Imani's `§4.2 — Triple-hatted MLRO + FIC CO + IO` named the **CoSec** as MLRO-alternate (and as deputy-IO simultaneously). Mira+Zara's `§4.2` rejected the double-hatted-CoSec posture as a single-point-of-failure on the CoSec seat; this rule splits the alternates by transferring MLRO-alternate to the AC-Chair NED. CoSec retains deputy-IO under Rule 2.2.

**Disclosure obligation.** Where the AC-Chair NED is also the MLRO-alternate, that overlap must be **declared in the fit-and-proper file** (Mira+Zara §4.3 amplification — "should be declared in the fit-and-proper file as an overlap that the Board has explicitly considered — not hidden"). This becomes a structured field on the `FitAndProperOverlapDeclaration` event when the substrate lands.

### Rule 2.4 — FAIS Key Individual transition gates on external-counsel confirmation

```
RULE: fais-ki-steady-state-vs-interim
SCOPE: where FSP licence is held by the bank (counsel-confirmed at the licence-application gate)

ASSERTION (steady-state): humanRoster.faisKeyIndividual === Saskia (Head of Global Markets)
ASSERTION (interim):       humanRoster.faisKeyIndividual === Marc (CEO)

GATE-CONDITION (transition Marc-interim → Saskia steady-state):
  external-counsel confirms-in-writing the FSP licensing scope for the bank's
  institutional-only / wholesale posture at the licence-application gate

CITATIONS:
  - FAIS Act 37 of 2002 s.8 (Key Individual; FSP licence requirement)
    — register: ORG-CD-02 (status: N/A-yet — FSP licence pending) and ORG-CD-03 (status: N/A-yet — KI designation pending)
  - FSCA Determination of Fit and Proper Requirements 2017
    — register: cited in Mira+Zara Q4; ORG-FAIS-KI proposed by Mira+Zara §5
  - FAIS General Code of Conduct
    — register: cross-referenced under ORG-CD-01 (in force); FAIS-specific KI row is the proposed ORG-FAIS-KI
  - FAIS Subordinate Legislation on s.45 exemptions for institutional / professional counterparties
    — register: cited in Mira+Zara Q4; standalone register row not yet created
    [citation: TBC — needs Mira / external-counsel confirmation on the precise s.45 exemption instrument reference and as-of date; this is a counsel call per Owen+Imani §2.6 and Mira+Zara Q4]
  - Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md §2.4 — counsel-confirmed at the licence-application gate
  - CLAUDE.md — Saskia named as candidate FAIS Key Individual under the Head of Global Markets governance seat
```

**Note on the FSP-licence question itself.** Whether the bank requires an FSP licence at all under its institutional-only / wholesale posture is **a counsel question**, not engineer input. Mira's read (Q4) is that, conservatively, the FSP route is pursued anyway. The KI rule above presupposes FSP licence is held. If counsel confirms no FSP licence is required, this rule becomes vacuous and the FAIS KI seat is not on the licence-day roster.

### Rule 2.5 — The 6th human (separate CRO) carries no merger paths

```
RULE: cro-no-merger-paths
SCOPE: licence-application-lodgment AND steady-state
GUARDS:
  humanRoster.cro !== humanRoster.ceo
  humanRoster.cro !== humanRoster.cfo
  humanRoster.cro !== humanRoster.companySecretary
  humanRoster.cro !== humanRoster.mlroFicCoIo (the triple-hatted compliance lead)
  humanRoster.cro !== humanRoster.faisKeyIndividual
  humanRoster.cro is fit-and-proper under JS 1 of 2024 + Banks Act + PA expectations

CITATIONS:
  - Joint Standard 1 of 2024 §6–§7 (per Rule 2.1)
  - Banks Act 94 of 1990 s.60 + PA fit-and-proper expectations
    — register: ORG-GV-11 (in force; named CRO is among designated officers)
  - BCBS Corporate Governance Principles for Banks (2015) §3 (three-lines-of-defence; CRO is second line)
    — see Rule 2.1 citation TBC
  - CLAUDE.md — engineering-vs-governance split (Helena is the engineering CRO; the human CRO is the named licence-day seat)
```

**Note on Helena.** Helena (engineering CRO; agent) **is unchanged**. The human CRO is the licence-day seat Helena's outputs flow through, exactly as Owen-the-agent's outputs flow through the human CoSec and Camille-the-agent's outputs will flow through the human CFO. Helena's mandate becomes load-bearing for the **search criteria** the CRO recruitment runs against (the human CRO must be JS 1 of 2024 fit-and-proper; Helena's risk taxonomy + RAS is the brief the human CRO inherits).

---

## 3. Composite assertion the role-composition rules engine must satisfy at licence-application lodgment

```
licence-application-lodgment-readiness :=
  Rule 2.1 (cro-separate-from-ceo)        holds AND
  Rule 2.2 (deputy-io-is-cosec)           holds (post-IO-lodgment) AND
  Rule 2.3 (mlro-alternate-is-ac-chair-ned) holds AND
  Rule 2.4 (fais-ki-steady-state-vs-interim) holds OR is vacuous (per counsel) AND
  Rule 2.5 (cro-no-merger-paths)          holds AND
  fitAndProperOverlapDeclaration(ac-chair-ned, mlro-alternate) recorded as event
```

The composite assertion is what Vera (and the future CAE) will test as part of continuous-controls assurance — orphaned or merged seats are reportable findings under Principle 6 ("no orphan functionality; no orphan procedures") read with Principle 7 (every step has a named, accountable, autonomous owner inside the system).

---

## 4. Updates to existing Imani deliverables

Only one prior Imani deliverable materially conflicts with the modification.

### 4.1 `Owner Inbox/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md`

A "Superseded by D-THIN-HUMAN-LAYER-MINIMUM (modified, approved 2026-05-08)" header has been added at the top of that paper. The body is preserved as the substantive analysis under the original framing; the supersedes note redirects readers to the CEO decision record and to this brief for the legal-as-code consequences.

### 4.2 No other Imani deliverables conflict

`2026-05-08_imani_legal-readiness.md` — statistical snapshot; does not name the human roster.
`2026-05-07_imani_legal-policies-bundle-v0.md` — Contracting + Document Execution policy stubs; does not name the human roster.
`2026-05-07_imani_clause-library-v0-and-fix-a-demonstration.md` — clause-library + legal-entity-tree v0 substrate; does not name the human roster.
`2026-05-07_imani_isda-readiness-deep-dive-priority-a.md` — ISDA / GMRA readiness; does not name the human roster (mentions Helena as CRO in standard cross-reference form, which is unaffected by the modification — engineering Helena is unchanged; the human CRO is the addition).
`2026-05-09_imani_external-counsel-licence-application.md` — counsel-engagement posture; references the human roster only by cross-reference. The roster section the brief points to is now this document.

No edits required on those files.

---

## 5. Open questions surfaced (citation TBC items routed for resolution)

The four `[citation: TBC]` markers above are real questions that need register-row hardening or counsel input before the role-composition rules engine can be built without ambiguity. Resolution routes:

| TBC | Resolves to | Routed to | Why deferred |
|---|---|---|---|
| BCBS Corp Gov Principles 2015 §3 — own ORG-* row vs. cross-reference under ORG-GV-CRO-INDEPENDENCE | Mira's obligations-register update (in parallel under D-THIN-HUMAN-LAYER-MINIMUM) | Mira | Mira owns register-row authoring; her brief in flight covers ORG-GV-CRO-INDEPENDENCE creation |
| Information Regulator's published guidance on IO / Deputy-IO — precise instrument reference and as-of date | Iris (Information Officer governance) co-curated with Mira | Iris + Mira | Iris's POPIA controls snapshot is the natural place to harden the IR-guidance citation |
| FIC Public Compliance Communications on MLRO-alternate — precise instrument reference and as-of date | Mira's obligations-register update (in parallel) | Mira | Mira's `ORG-FC-MLRO-ALTERNATE` gap closure carries this citation |
| FAIS Subordinate Legislation s.45 institutional-counterparty exemption — precise instrument reference and as-of date | External counsel at the licence-application gate (counsel-confirmed) | Marc (decides FSP-licence question with counsel input); Mira drafts the engineer-side note | Per Owen+Imani §2.6 and Mira+Zara Q4 — this is genuinely a counsel call |

None of the four TBC items blocks the rules engine from being built; they will harden the citations on the rules once resolved. Imani will refresh this brief's citations on confirmation.

---

## 6. Substrate gaps — what TypeScript modules need to land

The rules above are written today as prose-precise pseudocode with typed citations. Making them executable requires three new TypeScript modules under `prototype/platform/legal/`. Module build is **a separate slice** — out of scope for this PR.

### 6.1 Modules required

| Module | Purpose | Owners | Dependencies |
|---|---|---|---|
| `prototype/platform/legal/role-composition-rules.ts` | Encodes the five rules in §2 as testable predicates against a `HumanRoster` value type. Exports `assertLicenceApplicationLodgmentReadiness(roster: HumanRoster, asOf: Date): ReadinessVerdict`. | Imani (engineering) + Atlas (substrate primitives — value type registration with the event store) | The `HumanRoster` value type itself, which is part of Owen's governance-framework substrate (Owen revises in parallel under this decision) |
| `prototype/platform/legal/role-composition-rules.schema.json` | JSON Schema 2020-12 typed shape for `HumanRoster` and `ReadinessVerdict`. Mirrors the typed-citation pattern from `clause-library.schema.json` (per `2026-05-07_imani_clause-library-v0-and-fix-a-demonstration.md` §1). | Imani | Same shape discipline as `clause-library.schema.json` (typed citation arrays; oneOf regulation / policy / ic-guidance / standard) |
| `prototype/platform/legal/_role-composition-rules.md` | Human-readable index of the rules + cross-reference to this brief; the canonical-source-registry entry for "licence-day human-roster role-composition rules". | Imani (with Owen co-curating the human-roster value type) | Canonical-source registry convention (`Owen Inbox/2026-05-07_owen_canonical-source-registry.md`) |

### 6.2 Procedure that consumes the modules

A new procedure `Procedures/by-policy/licence-application-lodgment-readiness-check.md` (`PROC-GOV-LAR-01`) ought to land alongside the modules, owned jointly by Owen (governance) and Imani (engineering). Steps: (i) load `HumanRoster` from the agent-registry / governance-framework canonical source; (ii) call `assertLicenceApplicationLodgmentReadiness`; (iii) on `pass`, emit `LicenceApplicationLodgmentReadinessAsserted` event; (iv) on `fail`, emit `LicenceApplicationLodgmentReadinessFailed` event with rule-by-rule breakdown; (v) on `fail`, route the breakdown into Owen's secretariat substrate as a remediation queue. The procedure is itself a Principle 6 chain: Banks Act + JS 1 of 2024 → Governance Framework (post-Owen-revision) → this procedure → the three modules above.

### 6.3 Vera reconciliation harness

`prototype/platform/recon/role-composition-recon.ts` should land as part of the Vera Wave-4 backlog. It walks the rules, the obligations register, the governance framework, and the agent registry, and asserts that no orphan or contradiction exists. This is the third-line independence check that the rules engine itself does not provide.

### 6.4 Why a separate slice

The three modules need (a) Owen's revised governance framework to land first (it defines `HumanRoster`'s canonical source); (b) Mira's obligations-register `ORG-GV-CRO-INDEPENDENCE` row to land first (the citation chain inside the rules engine resolves to register-row IDs at runtime); (c) the four `[citation: TBC]` items above to harden. The dependencies are in flight under D-THIN-HUMAN-LAYER-MINIMUM in parallel; the module slice opens once they are resolved.

---

## 7. What this brief enables / what it does not change

**Enables.**

- The role-composition rules engine slice (§6) can begin once the four parallel workstreams (Owen governance-framework revision; Mira register-row closure; Iris IR-guidance citation; counsel FSP-scope confirmation) report back.
- The licence-application lodgment-readiness check becomes a typed procedure with a typed assertion — consistent with Principle 6 (single-graph discipline) and Principle 7 (every step has a named, accountable, autonomous owner — here, Owen + Imani jointly).
- Vera's continuous-controls assurance gains a concrete fixture for human-roster integrity (§6.3).
- Nolan's recruitment scope (in parallel under this decision) inherits the rule-set as the **fit-and-proper criteria** the six new hires are recruited against.

**Does not change.**

- Helena, Camille, Saskia, Owen, Iris, Zara, Rashida, Devon, Eitan, Thandiwe — all the *engineering and governance agents* — are unchanged. The modification adds a sixth human at licence-day; it does not reshape the agent fleet.
- The build-phase no-real-employees rule is unchanged. The six humans are recruited *for* licence-day, not appointed during the build phase.
- The legal-entity tree (`prototype/platform/legal/_legal-entity-tree.md` v0 substrate; `LE-ZA-BANKNEWCO`) is unchanged at the entity level. The composition operates inside a single legal entity at licence-day.
- The clause library (CL-GVL-001 and the planned subsequent slices) is unchanged.
- The ISDA / GMRA readiness substrate is unchanged.
- External-counsel posture is unchanged at the policy layer; the four TBC items confirm at the same gate counsel already engages at.

---

## 8. Authority

- `CLAUDE.md` — operating model ("statutory humans kept to the minimum the law requires — no more"; six humans + Marc + audit firm sits at the lower-middle of the 5–10 envelope); Principle 2 (every action traces to a source); Principle 6 (single-graph discipline); Principle 7 (autonomous by default; engineering-vs-governance split).
- `Owner Inbox/2026-05-08_scrooge_ceo-decision-record_d-thin-human-layer-minimum.md` — canonical CEO decision record.
- `Owner Inbox/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md` — original recommendation paper (now bears a supersedes header).
- `Owner Inbox/2026-05-09_mira-zara_concentration-risk-conduct-confirmation.md` — JS-1-of-2024 challenge that drove the modification.
- `Owner Inbox/2026-05-09_imani_external-counsel-licence-application.md` — counsel-engagement posture; the FAIS-KI gate condition (Rule 2.4) fires at the same counsel-engagement gate.
- **Joint Standard 1 of 2024** (PA / FSCA Cybersecurity and Cyber Resilience; jointly under FSR Act 9 of 2017) — §6 (responsible-person designation); §7 (operational independence). Read with `Regulations/Joint-Standards/js-1-of-2024-cyber.md` and `_obligations-register.md` ORG-CY-01 through ORG-CY-05.
- **Banks Act 94 of 1990** + **Regulations Relating to Banks** — s.60 (Board composition); s.61 (auditor); fit-and-proper standards under PA expectations (per ORG-GV-11).
- **Companies Act 71 of 2008** — s.66 (directors minimum); ss.86–89 (Company Secretary; per ORG-GV-01); s.94 (Audit Committee composition); Companies Regulation 43 (Social & Ethics Committee).
- **FIC Act 38 of 2001** — s.43A (MLRO designation); s.43B (FIC Compliance Officer designation); read with `_obligations-register.md` ORG-FC-11. FIC Public Compliance Communications on MLRO-alternate designation [citation: TBC — see §5].
- **POPIA Act 4 of 2013** — s.56 (Information Officer designation); POPIA Regulation 4 (deputy-IO contemplated); read with `_obligations-register.md` ORG-PR(IV)-13. Information Regulator's published guidance on IO / Deputy-IO designation [citation: TBC — see §5].
- **FAIS Act 37 of 2002** — s.8 (Key Individual); FSCA Determination of Fit and Proper Requirements 2017; FAIS General Code of Conduct; FAIS Subordinate Legislation on s.45 institutional / professional counterparty exemptions [citation: TBC — see §5].
- **BCBS Corporate Governance Principles for Banks (2015)** — substantive-independence reading on AC and CRO §3 [citation: TBC — see §5].
- **King IV Code on Corporate Governance for South Africa** — independent-NED concept; AC composition.
- `Team/Imani.md` — legal-as-code engineering mandate; clause-library, legal-entity tree, ECTA-execution, CLM-platform substrate ownership; Devon (COO) engineering line, Owen co-curation on the governance line.
- `Regulations/_obligations-register.md` — citation register (Mira-curated, v1.3); proposed gap rows ORG-GV-DIRECTORS-MINIMUM, ORG-GV-AC-MINIMUM, ORG-GV-CRO-INDEPENDENCE, ORG-GV-CFO-INDEPENDENCE, ORG-FC-MLRO-ALTERNATE, ORG-FAIS-KI, ORG-FC-SANCTIONS-SCREENING (per Mira+Zara §5).

---

## 9. Change log

| Date | Change | Author |
|---|---|---|
| 2026-05-09 | Initial brief — codifies D-THIN-HUMAN-LAYER-MINIMUM (modified) as five legal-as-code rules; names the three TypeScript modules, the procedure, and the recon harness required to make the rules executable; surfaces four `[citation: TBC]` items for Mira / Owen / Iris / counsel resolution. Adds supersedes header to `2026-05-09_owen-imani_thin-human-layer-minimum-possible.md`. | Imani |

---

—Imani (Legal-as-code engineer)
