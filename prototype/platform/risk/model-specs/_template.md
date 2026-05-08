---
title: Model-spec template — frontmatter contract for ModelSubmitted.methodologyHash
authors: [Nadia, Rohan]
date: 2026-05-09
status: contract-v0.1
summary: Canonical Markdown frontmatter contract every per-model methodology document must satisfy when Rohan submits a model via `ModelSubmitted`. The submission event hashes this document into `methodologyHash` (sha256-hex). Without this contract, validation has no stable input shape — Nadia's validation cycle cannot start until the spec is in.
---

# Model-spec template

> **Co-authored.** Nadia (independent model-validation engineer; reports to Helena (CRO), functionally independent of Rohan) and Rohan (risk engineer; reports to Helena). The contract codifies the existing first-line / second-line discipline in `Team/Rohan.md` §5 ("Documents methodology before code") and `Team/Nadia.md` §3 (validation authority surface). Sub-slice of S7-Targeted item #3 (Nadia's validation-methodology v0, slice B).

---

## How to use this template

**Where the file lives.** Copy this template to `prototype/platform/risk/model-specs/<modelId>-spec.md` (one file per `modelId`; convention `model:<short-slug>`, e.g. `prototype/platform/risk/model-specs/var-historical-99-spec.md`). The `_template.md` filename is reserved for this contract; per-model specs never start with an underscore.

**Submission flow.**

1. Rohan authors the per-model spec by populating every required frontmatter field below and writing the corresponding body sections.
2. At submission, the file's full byte-content is hashed (`sha256-hex`, lowercase, 64 chars). That hash is `ModelSubmitted.payload.methodologyHash` per `prototype/platform/event-store/event-types.ts` (`modelSubmittedPayloadSchema`, line 1066).
3. Re-submitting the identical hash for the same `modelId` is a no-op (idempotency key — `event-types.ts` line 1037).
4. The file is the canonical methodology artefact. It does not move; it is versioned by content. Edits produce a new file (new byte content → new hash → new `ModelSubmitted` event with the new `version` label).

**Reciprocal SLAs (the second-line commitment Nadia makes against this contract — `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §3.4).**

| Stage | Window | Authority |
|---|---|---|
| Tier classification (`ModelTierClassified`) | 5 working days from `ModelSubmitted` | `Team/Nadia.md` §7 |
| Validation report — Tier-1 | 30 working days | `Team/Nadia.md` §7 |
| Validation report — Tier-2 | 20 working days | `Team/Nadia.md` §7 |
| Validation report — Tier-3 | 10 working days | `Team/Nadia.md` §7 |
| Findings | Severity, owner, deadline assigned at the moment they are raised | `Team/Nadia.md` §11 |

**Withhold rule.** If any required dimension below is absent or insufficient at submission, Nadia raises a `ValidationFindingRaised` citing the missing dimension and **the clock does not start**. This is the SR 11-7 §V.1 effective-challenge posture made operational; it is not optional.

**Rohan's commitment.** Methodology before code (`Team/Rohan.md` §5; `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §3.3). The seven dimensions below are the substance of "methodology" at submission — populating them is not documentation overhead, it is the precondition for any line of model code to enter the bus-canonical pipeline.

---

## Frontmatter contract — required fields

The frontmatter is YAML. Every field below is required unless explicitly marked optional. Future Vera recon (Wave-4 #11 validation-cycle pipeline; `Team/Nadia.md` §15) asserts the shape per the type column.

```yaml
---
# ── Identity ─────────────────────────────────────────────────────────
modelId: model:<short-slug>            # string; convention: model:<short-slug>
version: <version-label>               # string; submitter-assigned (e.g. v1.0, 2026.05-q2)
tier: <1|2|3>                          # integer; submitter's proposed tier (RAS § B7)
submittedBy: agent:<name>              # string; agent:<name> | human:<email>
description: <one-line purpose>        # string; one-line summary; ≤ 200 chars
methodologyHash: <sha256-hex|computed> # string; written "computed-at-submission" in the spec;
                                       #   the runtime hashes the file at ModelSubmitted-time and
                                       #   populates the event-payload field. Field is present in
                                       #   the spec for contract-completeness; its value is the
                                       #   literal string "computed-at-submission" when authored.

# ── Citations (Principle 2) ──────────────────────────────────────────
citations:                             # list of typed register references; minimum 1 entry
  - register: obligations              # one of: obligations | policy | standard | internal
    id: <register-row-id>              # e.g. ORG-PR-21
    note: <why-cited>                  # one-line; what this citation justifies
  # Add further entries as the spec demands. Every quantitative claim in the body
  # must trace to at least one citation here. Placeholders permitted at draft
  # time as `[citation: route to Mira]` and resolved before publication.

# ── The seven dimensions (SR 11-7 §V.1 conceptual-soundness review) ─

# 1. Model purpose
modelPurpose: |                        # string; multiline permitted
  <what decision the model supports; which output use-case
   (regulatory submission / accounting application / operational decision);
   which downstream consumers; which RAS § B7 dimension classifies the tier>

# 2. Data inputs
dataInputs:
  sourceStreams:                       # list of event-log streams or projections
    - stream: <event-type-or-projection>
      lineage: <event-store-or-derived> # event-store | projection:<name> | external:<feed>
      asOfPolicy: <how-as-of-resolves>  # e.g. "T-1 close", "real-time per-event", "month-end"
  bcbs239Conformance:                  # required boolean assertion + justification
    asserted: true                     # boolean; submitter asserts BCBS 239 conformance
    justification: <one-paragraph>     # cites the data-quality controls; references Anya's
                                       # data-contracts catalogue (`Team/Anya.md` §11) for each
                                       # input stream. Required by `Team/Nadia.md` §4 — "BCBS 239
                                       # risk-data-aggregation conformance as a precondition for
                                       # model validity".

# 3. Outputs
outputs:
  schema:                              # the model's output shape
    - field: <output-field-name>
      type: <type>                     # number | enum<...> | record<...>
      semanticLayerEntry: <anya-entry> # cite Anya's semantic-layer entry id; required for
                                       # every named quantity (Principle 6 — single graph)
  downstreamConsumers:                 # list of typed consumers
    - consumer: <agent-or-system>      # e.g. agent:bea (ECL accounting), agent:ravi (LCR),
                                       #      capability:pre-trade-gateway
      useCase: <how-consumed>          # e.g. "Stage-2 ECL provision posting"
      bindingClass: <regulatory|accounting|operational|advisory>

# 4. Methodology (mathematical / algorithmic specification)
methodology: |                         # string; multiline
  <model class — e.g. "historical-simulation VaR, 99% 1-day, 250-day window">
  <parameter set — e.g. "no decay; equal-weighted observations">
  <calibration approach — e.g. "rolling-window, daily reset">
  <citation to standard methodology if implementing one — e.g. "Kupiec POF test
   per SR 11-7 § V.4 outcome analysis"; citation entry must appear in `citations` above>

# 5. Training procedure
trainingProcedure:                     # required structured field
  modelClass: <statistical|ml|deterministic|hybrid>
  # If statistical / ml / hybrid:
  trainingCorpus: <description>        # event-log windows, external feeds, synthetic supplements
  trainTestSplit: <description>        # e.g. "rolling 250-day train, 60-day forward test"
  calibrationCycle: <description>      # e.g. "daily refit", "quarterly recalibration"
  # If deterministic:
  parameterSourceRegister:             # list of parameter-source register entries
    - parameter: <name>
      sourceRegister: <register-id>    # e.g. anya:rates-curve-config, anya:vol-surfaces
      asOfPolicy: <as-of-policy>
  naJustification: <if-na>              # required iff modelClass=deterministic and the
                                       # statistical fields are written "n/a"; cite why no
                                       # training step exists (e.g. closed-form revaluation)

# 6. Validation envelope (populates ProductionUseBoundary at approval-time)
validationEnvelope:                    # the bounds within which the model is claimed valid;
                                       # the field Nadia's `restrict-to-validated-envelope`
                                       # disposition reads from (`Team/Nadia.md` §9). Without it,
                                       # every approval is necessarily binary.
  assetClass:                          # list; the asset / instrument scope
    - <asset-class>                    # e.g. "ZAR-government-bonds", "ZAR-IRS-vanilla"
  portfolioScope: <description>        # e.g. "trading-book only; no banking-book extension"
  scenarioRange:                       # the input-perturbation envelope under which the
                                       # methodology was validated (rate-shock magnitude,
                                       # vol-regime range, credit-spread range)
    - dimension: <input-dimension>
      validatedRange: <range>          # e.g. "rates ±300 bp parallel; ±150 bp twist"
  outOfEnvelopeBehaviour: <description> # what the model does when an input falls outside
                                       # the validated envelope (typical: emit a typed
                                       # `OutOfEnvelopeFlag` event; consumer routes to Nadia)

# 7. Deployment scope
deploymentScope:
  authorisedConsumers:                 # list; only these consumers may consume in production
    - consumer: <agent-or-system>
      mode: <binding|advisory>         # binding = drives an automated decision; advisory =
                                       # human-reviewed-before-action. Tier-3 models default
                                       # advisory-only per RAS § B7.
  advisoryOnly: <boolean>              # convenience flag; true iff every authorised consumer
                                       # is mode=advisory. Vera's recon asserts this matches
                                       # the per-consumer mode field.
---
```

### Field-by-field expectations

The body of the per-model spec elaborates each frontmatter field with prose, citations, and worked detail. The frontmatter is the contract that recon asserts against; the body is the substance Nadia validates against. Both are required.

#### 1. `modelPurpose`

A single decisional statement, not a marketing description. Three sub-points: (a) the decision the output supports; (b) the use-case envelope (regulatory submission line / accounting posting / operational decision / advisory); (c) the downstream consumers (who reads the output, what they do with it). The tier classification (`tier`) follows from this — a model whose output enters a BA-return cell or an IFRS 9 ECL provision is Tier-1 by RAS § B7 regulatory-consequence rule.

#### 2. `dataInputs`

Every input stream is a typed reference. **No untyped data.** Lineage resolves to the event log or to a derived projection that itself resolves to the event log (Principle 1 — events are the only source of truth). `asOfPolicy` is required for each input — the as-of replay capability (Principle 1) requires an explicit policy per input.

The BCBS 239 conformance assertion is non-negotiable. `Team/Nadia.md` §4 names risk-data-aggregation conformance as a *precondition for model validity*; without it, validation cannot meaningfully begin. The justification cites Anya's data-contracts catalogue per input.

#### 3. `outputs`

Schema is typed; every named quantity has a semantic-layer entry under Anya (`Team/Anya.md` §11; Principle 6 — single graph). Downstream consumers are typed by binding class — `regulatory | accounting | operational | advisory` — because the binding class drives the tier (a regulatory or accounting binding lifts the tier to 1; advisory caps at 3).

#### 4. `methodology`

The mathematical / algorithmic specification. Model class, parameter set, calibration approach, citations to any standard methodology being implemented. This is the SR 11-7 §V.1 *conceptual-soundness* substance — Nadia's first read. Quote the published methodology by section where one exists (e.g. "Kupiec POF test per SR 11-7 §V.4"); the matching citation entry appears under `citations`. **No invented citations** (Principle 2). Where a citation should exist but the obligations register does not yet hold it, write the placeholder `[citation: route to Mira]` and the spec proceeds; publication blocks until Mira resolves the placeholder to a register row.

#### 5. `trainingProcedure`

For statistical / ML / hybrid model classes: the training corpus, train/test split, calibration cycle. For deterministic models (closed-form revaluation, rule-based screening, etc.): the parameter-source register entries that supply the model's calibration constants — rates curves, vol surfaces, spreads, threshold tables. The `naJustification` field is required iff the statistical fields are "n/a"; it cites why no training step exists.

#### 6. `validationEnvelope`

The bounds — asset-class, portfolio-scope, scenario-range — within which the methodology claims validity. **This is the field that makes `restrict-to-validated-envelope` actionable** (`Team/Nadia.md` §9 — the disposition that produces a `ProductionUseBoundary`). A spec without an explicit envelope forces every approval into binary `approve | withhold`; an envelope produces the third disposition that real-world validation usually wants.

`outOfEnvelopeBehaviour` is required. The typical pattern is "model emits a typed `OutOfEnvelopeFlag`; pre-trade gateway / consumer routes to Nadia for envelope-extension" — the substrate work that lands at S7-Targeted slice #5 (`Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §6 row 4).

#### 7. `deploymentScope`

Per-consumer mode (binding / advisory). Required because RAS § B7 distinguishes decisioning from advisory consequence — the same output consumed in two modes can land in two tiers, and the production-eligibility query in the model registry needs to resolve at the consumer boundary.

---

## Body sections — required structure

Below the frontmatter, the per-model spec body has the following section headings, in order. Each section elaborates the corresponding frontmatter field with prose, worked numerics where applicable, and explicit citations. Sections are required (write "n/a — see frontmatter" only where the frontmatter is genuinely sufficient).

```markdown
## 1. Model purpose
## 2. Data inputs
## 3. Outputs
## 4. Methodology
## 5. Training procedure
## 6. Validation envelope
## 7. Deployment scope
## 8. References
   - One-to-one with the `citations` frontmatter field; each entry repeats the
     register/id/note triple in human-readable form, plus the publication
     reference for any external standard.
## 9. Change log
   - Version | Date | Author | Summary. New rows on every methodology edit;
     each edit produces a new `methodologyHash`.
```

---

## What this template is not

- **Not a tutorial on model risk management.** It is the contract Vera's recon asserts against. The methodology library (per-tier `_methodology-tier-N.md` files in `Procedures/validation/` — Slice C onward of the validation-methodology library v0) carries the tutorial substance.
- **Not editable by the validator.** Nadia consumes the spec; Rohan authors it. Independence boundary per `Team/Nadia.md` §15.
- **Not a stable schema yet.** This is contract-v0.1. The frontmatter shape lifts to a typed schema (Zod / TypeScript) when the typed-event slice for `ValidationMethodologyPublished` lands (Atlas-coordinated; `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §6 row 3). Until that lands, recon asserts the YAML shape directly.

---

## Authority

- **SR 11-7 §V.1 — effective challenge.** *Guidance on Model Risk Management*, US Federal Reserve / OCC, 2011. Conceptual-soundness review and the seven dimensions trace to this section. Cited via the `ORG-PR-21` row of `Regulations/_obligations-register.md` (RAS B7 / SR 11-7 idiom; in force).
- **SS 1/23 Principle 4 — model documentation and version control.** *Model Risk Management Principles for Banks*, Bank of England PRA, 2023. Frontmatter contract is the documentation-and-version-control discipline made operational. Citation registration `[citation: route to Mira]` — pending obligations-register entry per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §5.5.
- **RAS § B7 — three-tier model risk classification.** `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md` lines 136–144. Tier values in `frontmatter.tier` resolve to this register row.
- **Banks Act 94 of 1990 § 70(2A)(b).** Risk-management process and audit. Citation registration `[citation: route to Mira]` — pending obligations-register entry per `Owner Inbox/2026-05-09_nadia_validation-methodology-library-v0-scoping.md` §5.5.
- **CLAUDE.md Principle 6 — single-graph discipline.** Every named quantity in `outputs.schema[].field` resolves to an Anya semantic-layer entry; every consumer in `deploymentScope.authorisedConsumers[].consumer` resolves to a typed agent or system capability; every citation in `citations[]` resolves to a register row. No orphans.
- **CLAUDE.md Principle 2 — every action traces to a source.** The `citations` frontmatter field is the per-spec citation register; placeholders are permitted at draft time and resolved before publication. No invented citations.
- **CLAUDE.md Principle 7 — autonomous by default.** The submitter (`submittedBy`) is an agent by default (`agent:<name>`). Human submitters (`human:<email>`) are the registered exception per Principle 7's typed-actor rule.

Event-store binding: `prototype/platform/event-store/event-types.ts` — `modelSubmittedPayloadSchema` (line 1046) and the `methodologyHash` field (line 1066) reference this template.

Registry binding: `prototype/platform/model-registry/registry.ts` — `LocalModelRegistry` consumes `ModelSubmitted` events and projects the model state. The validation-cycle handlers consume the per-spec body for conceptual-soundness review.

---

— Nadia (independent model-validation engineer)
— Rohan (risk engineer)

*Co-authored 2026-05-09 as sub-slice B of S7-Targeted item #3. Slice A (tier definitions locked) preceded; Slice C (Tier-1 methodology v0.1) follows.*
