---
status: POPULATED
---
# Procedure — Posting-rule publication

**Procedure ID:** PROC-FIN-AC-01
**Owner:** Bea (accounting) · Atlas (substrate — event-store schema seam)
**Approval:** AC (under Accounting Policies (IFRS) v0.1 — STUB)
**Cadence:** Per-event-type; runs whenever a postable event type is introduced or a posting-rule version is incremented
**Version:** v0.1 — 2026-05-07
**Status:** **In force (build-phase scope)** — runs against synthetic events today; lights up on real postings at licence-day

## 1. Source policy

- `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md` § Accounting Policies (IFRS) v0.1 §3 (Recognition and double-entry discipline); §4 (Multi-currency and entity discipline).
- `Owner Inbox/2026-05-07_bea_finance-policies-bundle-v0.md` § Financial Reporting & Disclosure v0.1 §2 (BA returns).

Both stubs (per the bundle's §6); citations resolve to the bundle until AC-approved full policies land.

## 2. Source regulation(s)

| Citation | Requirement | Resolves via |
|---|---|---|
| `ORG-AC-01` | Classify financial instruments at recognition. | Posting rule's account choice + chart-of-accounts entry's `ifrsClassification` field. |
| `ORG-AC-08` | Present financial statements per IAS 1. | Account category drives presentation line; posting rule fixes side. |
| `ORG-AC-13` | Submit BA returns to PA. | Posting rule's accounts carry `baReturnLines` mapping. |
| `IFRS 9 §3.1.1 / §3.1.2` (direct standard) | Recognition trigger. | Rule's `eventType` is the recognition event. |
| `IAS 21 §21` (direct standard) | Multi-currency recognition at functional-currency spot rate. | Rule's `currencyExpression` field. |

## 3. Purpose

Govern how a posting rule (mapping a typed event to one or more balanced double-entry postings) is authored, cited, validated, approved, and published. The procedure is the keystone of Bea's accounting substrate: every other Bea procedure (close cycle, BA-return generation, auditor pack, restatement handling) depends on the posting-rule register being citation-complete and resolvable. This is the meta-procedure — when it runs cleanly, every downstream event flows automatically.

In the build phase the procedure runs against synthetic event types Atlas's A0 schema-freeze published. At licence-day the same procedure runs against real product events without architectural change.

## 4. Trigger

- A new postable event type is added to the event-store schema (Atlas-owned). Atlas emits `EventTypeRegistered`.
- An existing posting-rule version is incremented because of an IFRS interpretation change, an account reclassification, or a correction.
- Cross-domain dependency: Yael publishes `TaxClassificationPublished` requiring deferred-tax posting; Rohan publishes `ModelVersionPublished` requiring ECL posting structure; Imani publishes a new contract type requiring lease / hedge accounting. Each fires this procedure for the relevant new posting rule(s).

## 5. Steps

| # | Action | Actor | System capability | Notes |
|---|---|---|---|---|
| 1 | Resolve the event type's schema and confirm the postable fields exist (amount, currency, entityId, plus rule-specific fields). | Bea | `@platform/event-store` (Atlas's schema registry) | Rule cannot be authored against a non-existent or unstable event schema. |
| 2 | Identify every account that will receive a posting. Confirm each exists and is `in-force` in `_chart-of-accounts.md`; if missing, run the chart-of-accounts publication step (subordinate procedure) first and only then resume here. | Bea | `@platform/accounting/chart-of-accounts` (today: markdown lookup) | Subordinate-procedure callout per Bea spec §13. |
| 3 | Author the rule following [`posting-rule.schema.json`](../../prototype/platform/accounting/posting-rule.schema.json): `id`, `eventType`, `preconditions`, `postings` (≥2, balanced per currency per entity), `version`, `status: draft`. | Bea | `@platform/accounting/posting-rules` | Sibling rules on the same event type must have disambiguating preconditions; ambiguity is a finding. |
| 4 | Cite the rule. At minimum: one IFRS / IAS reference + one regulation ID + one policy reference. Plain prose references are rejected. | Bea | `@platform/citation/gate.ts` | Citation gate runs at publication time and rejects rules with un-resolvable citations. |
| 5 | Validate the postings: balanced per currency, per entity; every `currencyExpression` yields non-null; every `entityExpression` resolves to an in-force entity in the legal-entity tree. | Bea | `@platform/accounting/posting-rules` validator (PLANNED — today: hand-validation) | Validator-PLANNED is a Substrate Gap § (see report). |
| 6 | Publish the rule's BA-return implications. Confirm every account it posts to has `baReturnLines` covering the rule's contribution; if a new line is implied, surface to Camille for AC review. | Bea | `@platform/accounting/ba-return-generator` (PLANNED) | The generator at M2 consumes the chart's `baReturnLines` array. |
| 7 | Approve. Bea approves rules within standing authority (chart-of-accounts already in-force, IFRS classification unchanged, no material P&L impact). Material policy changes escalate to Camille per Bea spec §10. | Bea / Camille | — | Standing-authority delegation is governance work; today this rests on Camille's interim approval per CEO directive 2026-05-07. |
| 8 | Emit `PostingRulePublished { ruleId, version, eventType, accountIds, citationChain }` to the event store. Downstream consumers (close engine, BA-return generator, auditor pack, reconciliation harness) re-resolve. | system | `@platform/event-store` | The event is the publication. Until it is emitted, the rule is `draft` even if the YAML lives in the register markdown. |

## 6. Reconciliation

- **Events produced:** `PostingRulePublished`. Optionally `ChartAccountPublished` (if Step 2 created a new account) and `AgentEscalation` (if Step 7 escalated).
- **Reconciliation check:** every `PostingRulePublished` has (a) a resolvable `eventType` in the event-store schema; (b) every `accountId` resolves to an `in-force` chart entry; (c) postings balance per currency per entity in synthetic dry-run; (d) citations resolve.
- **Closing-the-loop check:** for every postable event type registered by Atlas, at least one matching `PostingRulePublished` exists. Vera's planned posting-rule recon (Wave-4 candidate) emits findings for orphan event types.
- **Failure mode:** a published rule that fails any of the four checks is reverted by superseding-version (versioning is append-only); failure is itself a finding.

## 7. Evidence / artefacts

| Artefact | Location | Retention | Sensitivity |
|---|---|---|---|
| `PostingRulePublished` event | Event log | Indefinite (P1) | Internal |
| Posting-rule entry | `prototype/platform/accounting/_posting-rules.md` (today); per-rule typed file at M2 | Indefinite (versioned) | Internal |
| Citation chain (resolved) | Materialised projection | Re-derivable | Internal |

## 8. Manual steps

- **Step 5 (validator)** is hand-validated today against the JSON schema; the runtime validator is Bea Substrate Gap § (Posting-rule validator, M2 with the close engine). Tracked exception under Principle 3.
- **Step 8 (event emission)** runs through Scrooge today (Principle 6 in-session run); it lands on Atlas's A2 (event-trigger bus) when the runtime substrate is live.

## 9. Failure modes and escalation

| Failure mode | Detection | Escalation |
|---|---|---|
| Account ID does not resolve | Step 2 / validator | Run chart-of-accounts publication first; resume |
| Postings do not balance | Step 5 validator | Bea — re-author rule; if structural (e.g., FX leg required), open a sibling rule for the FX revaluation |
| Citation un-resolvable | Step 4 citation gate | Bea — confirm regulation ID, IFRS reference, policy section exist; if a citation is missing because the policy is not yet authored, escalate to Camille / Owen for stub-policy creation |
| Material policy implication | Step 7 review | Camille — pre-publication; possibly AC consultation before next reporting cycle |
| Cross-domain dispute (e.g., trading vs banking-book) | Camille review | Camille + Helena / Eitan as relevant; pre-close per Bea spec §10 |

## 10. Related procedures

- `Procedures/by-policy/accounting-close.md` — **planned (Bea-owned)** — consumes posting-rule register at every close cycle.
- `Procedures/by-policy/ba-return-generation.md` — **planned (Bea-owned)** — consumes the `baReturnLines` array on each chart-of-accounts entry, fan-in over events matched to rules.
- `Procedures/by-policy/ifrs9-ecl-methodology.md` — **planned (Bea + Rohan co-owned)** — produces ECL-stage posting rules consumed by this procedure.
- `Procedures/by-policy/restatement-handling.md` — **planned (Bea-owned)** — supersedes posting rules with corrected versions; the supersede event chain runs through this procedure.

## 11. Change log

| Version | Date | Author | Summary |
|---|---|---|---|
| v0.1 | 2026-05-07 | Bea (via Scrooge) | Initial draft as keystone of Bea's first end-to-end Reg→Policy→Procedure→Capability chain demonstration. |

## 12. Audit / assurance

Vera's planned posting-rule recon (Wave-4 candidate) asserts: (a) every postable event type has a matching `PostingRulePublished`; (b) every published rule's accounts and citations resolve; (c) postings balance under synthetic replay; (d) every `BAReturnGenerated` reconciles upward to its source rules. Findings flow to Bea for remediation; structural findings (orphan event types, missing IFRS interpretations) flow to Camille.
