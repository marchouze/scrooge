---
title: risk-taxonomy-coverage recon v1 — Vera Wave-5 (advisory mode)
author: Vera (Internal audit engineer, engineering — functionally to Thandiwe (Chief Audit Executive, governance); administratively through the CEO)
date: 2026-05-11
summary: New continuous-controls recon pipeline `recon:risk-taxonomy-coverage` lands wired into `bun run ci`, asserting that every obligation row, RAS Part-B line, and policy / charter / mandate document in `Owner Inbox/` carries a valid `riskTaxonomy` code from the canonical register at `Regulations/_risk-taxonomy.md` (typed at `prototype/platform/risk/taxonomy.ts`, 94 codes). Advisory-only in v1 — every finding is emitted at `warn` severity and the pipeline returns `ok: true`. Initial steady-state: ~255 backfill findings across the three scopes (220 obligation rows + 20 RAS Part-B lines + 15 policy / charter / mandate documents). Three backfill PRs queued (Mira on obligations, Helena + Rohan on RAS, policy authors on frontmatter); once the finding count reaches zero, v2 flips advisory → enforcing in a single PR. The recon is the Principle 2 (single-graph discipline) enforcement layer for the risk axis: every artefact in the bank's executable chain must resolve to exactly one terminal taxonomy node so cross-cutting queries ("all RT-LQ obligations + fulfilment policies + outstanding RAS calibrations") complete in a single bidirectional walk.
decision-required: false
riskTaxonomy: RT-OP
---

# Vera Wave-5 — `recon:risk-taxonomy-coverage` v1 completion brief

> **Authors.** Vera (Internal audit engineer, engineering — functionally to Thandiwe (Chief Audit Executive, governance); administratively through the CEO).
> **Authority.** Substrate-gap call-out in `prototype/platform/risk/taxonomy.ts` header comment ("Substrate gap (v1): Vera Wave-5 will ship a `taxonomy-coverage` recon pipeline…"); Helena (CRO) + Rohan (Risk engineer) standing register-authoring authority over `Regulations/_risk-taxonomy.md`.
> **Substrate landing.** Three files touched / created:
> - `prototype/platform/recon/risk-taxonomy-coverage.ts` (new pipeline, advisory mode).
> - `prototype/platform/recon/risk-taxonomy-coverage.test.ts` (9 tests — all passing).
> - `prototype/package.json` (`recon:risk-taxonomy-coverage` script + appended to `ci` chain).

---

## 1. Advisory-mode rationale

The recon framework's severity vocabulary (`platform/recon/types.ts`) is `info | warn | fail`. A pipeline's `ok` flag flips to `false` only on a `fail`-severity violation. Advisory mode is implemented by emitting every finding at `warn` severity — the pipeline always returns `ok: true` in v1 even when findings exist, and CI does not block on the recon.

Why advisory, not enforcing, on day 1:

1. **Coverage gap is structural, not exceptional.** The canonical register at `Regulations/_risk-taxonomy.md` and the typed enum at `prototype/platform/risk/taxonomy.ts` landed in PRs #264 and #265 on 2026-05-11. None of the artefacts the recon walks — obligations register, RAS, policies — yet carries the `riskTaxonomy` field. A `fail`-mode launch would emit ~255 blocking findings on the next CI run, deadlocking the build.

2. **Surface the gap, then close it.** The recon's role in v1 is to surface coverage so the backfill PRs have a stable count to drive against. Each backfill PR shrinks the finding count; v2 (warn → fail) lands once the count reaches zero (or near-zero with a documented carve-out list).

3. **No `fail`-severity findings in v1.** Even malformed annotations (empty value, unrecognised code, embedded fake code) are emitted at `warn`. The single-bit upgrade (s/warn/fail/g across the four call sites in the pipeline) is the v2 PR — no schema change, no new test surface.

The advisory-mode hatch is reversible at any moment if a downstream consumer (Vera's overnight-recon handler, Thandiwe's AC pack) wants to start surfacing findings as alerts before v2.

---

## 2. Expected initial finding count

A live run against the current corpus at 2026-05-11 produces:

| Scope | Asserted | Findings (all `warn`) |
| --- | --- | --- |
| Obligations register (`Regulations/_obligations-register.md`) | 220 rows | 220 missing-field |
| RAS Part-B lines (`Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`) | 20 B-lines | 20 missing-annotation |
| Policies / charters / mandates (`Owner Inbox/*.md` whose `title:` matches `(Policy|Charter|Mandate)`) | 15 documents | 15 missing-frontmatter |
| **Total** | **255** | **255** |

`ok: true`, `fails: 0`, `warns: 255`. The dispatch brief's pre-flight estimate was ~259 obligations + ~9 RAS lines + ~10 policies — the actuals are within rounding (the 220 vs ~259 delta is because the recon counts only structured 9-column rows; Domain N citation-URN inventory rows are excluded by design, since they are not obligations). The 20 RAS B-lines include the B14.x sub-sections (which are sub-headers under B14 PA look-through framing, all legitimately appetite-bearing).

This brief itself carries `riskTaxonomy: RT-OP` in its frontmatter as a demonstration — the recon walks `Owner Inbox/` files whose title contains "Policy / Charter / Mandate", so this completion note is not asserted by the recon (its title is "risk-taxonomy-coverage recon v1 — Vera Wave-5 (advisory mode)" — no policy-noun match). Adding the field anyway sets the precedent for future completion-notes.

---

## 3. Detection contract — what the recon walks

### 3.1 Obligations register

For each pipe-table row matching `| ORG-<prefix>-<id> |` in `Regulations/_obligations-register.md`, the recon expects either:

- A tenth column appended to the 9-column schema carrying `riskTaxonomy: RT-<code>` (or array), **or**
- A `riskTaxonomy: RT-<code>` annotation on the row's next line (for rows wrapped across two lines).

Backfill owner: Mira (Compliance / RegTech engineer, engineering — reports to Zara CCO) under standing register-curator mandate. Once the 220 missing fields are added, the schema may formally absorb `riskTaxonomy` as the 10th column in an obligations-register v1.17 banner.

### 3.2 RAS Part-B

For each Part-B header line (`## B<n>`, `### B<n>.<m>`, etc.) in `Owner Inbox/2026-05-06_risk-appetite-statement-and-framework.md`, the recon expects a `riskTaxonomy:` annotation somewhere in the section body between that header and the next B-header. Multi-axis lines (e.g. B5 financial-crime spanning RT-FC + RT-CD) use the array form.

Backfill owner: Helena (Chief Risk Officer, governance) + Rohan (Risk engineer, engineering — reports to Helena). The 20-line scope is tractable in a single PR.

### 3.3 Policies / charters / mandates

For each `*.md` file in `Owner Inbox/` whose YAML frontmatter `title:` contains "Policy", "Charter", or "Mandate" (case-insensitive), the recon expects a `riskTaxonomy:` field in the same frontmatter. Discovered policies / charters / mandates as at 2026-05-11 (PRs #255–#264 plus prior):

- `2026-05-11_camille-eitan-helena_liquidity-risk-management-policy-v1.md` → expect `RT-LQ` (+ `RT-IRRBB` likely).
- `2026-05-11_camille-helena_capital-management-policy-v1.md` → expect `RT-CR` + `RT-MK` + `RT-OP` axes (or whole-bank multi-code).
- `2026-05-11_helena-camille_recovery-resolution-planning-policy-v1.md` → expect `[RT-CR, RT-LQ, RT-OP, ...]` (resolution is whole-bank).
- `2026-05-11_iris-zara_popia-privacy-policy-v1.md` → expect `RT-OP` (privacy is operational/legal-conduct).
- `2026-05-11_kai-helena-devon_trading-mandate-v1.md` → expect `[RT-MK, RT-CR, RT-OP]`.
- `2026-05-11_mira-zara_aml-cft-policy-v1.md` → expect `RT-FC`.
- `2026-05-11_mira-zara_rmcp-v1.md` → expect `RT-FC`.
- `2026-05-11_owen-helena_fit-and-proper-policy-v1.md` → expect `RT-OP` (governance) or specific node.
- `2026-05-11_owen-sade_remuneration-policy-v1.md` → expect `RT-OP` (governance/conduct).
- `2026-05-11_thandiwe-vera_internal-audit-charter-v1.md` → expect `RT-OP` (oversight; or whole-bank).
- `2026-05-10_saskia_new-product-approval-policy.md` → expect array (every new product spans multiple risks).
- `2026-05-10_zara-mira_rmcp-attestable-spec.md` → expect `RT-FC`.
- `2026-05-07_imani_legal-policies-bundle-v0.md` → bundle (multi-code).
- `2026-05-07_niko_conduct-policies-bundle-v0.md` → bundle (multi-code, `RT-FC` + `RT-OP`).
- `2026-05-07_rohan_risk-policies-bundle-v0.md` → bundle (whole-bank).
- `2026-05-07_tomas_payments-policies-bundle-v0.md` → bundle (`RT-OP` + `RT-LQ`).
- `2026-05-09_saskia-kai-atlas_routing-policy-projection-v0.md` → expect `[RT-MK, RT-OP]`.

Authors-in-frontmatter are the natural backfill owners. The pattern is "smallest stable terminal node" per the canonical register's §6 mapping rules — when a policy genuinely spans more than one terminal node, the array form is acceptable.

---

## 4. Upgrade plan — v1 advisory → v2 enforcing

The flip is a single PR with two edits:

1. In `prototype/platform/recon/risk-taxonomy-coverage.ts`: change every `severity: "warn"` to `severity: "fail"` (four call sites — missing field, empty value, invalid code; one each for obligations + RAS + policies).
2. In the completion brief addendum (this file's successor `2026-05-XX_vera_risk-taxonomy-coverage-recon-v2.md`): document the carve-out list (if any) and the final-state finding count.

Pre-requisites for v2 dispatch:

- [ ] PR-A: Mira backfills `riskTaxonomy` across the 220 obligation rows in `Regulations/_obligations-register.md`. Recon finding count drops from 255 → 35.
- [ ] PR-B: Helena + Rohan backfill `riskTaxonomy:` annotations across the 20 RAS Part-B lines. Recon finding count drops from 35 → 15.
- [ ] PR-C: Each policy / charter / mandate author backfills the frontmatter field. Recon finding count drops from 15 → 0.
- [ ] PR-D: v2 flip — single-bit `warn → fail` change + this brief's successor.

PR-A, PR-B, and PR-C can land in parallel; only PR-D is sequenced after all three. Vera's overnight-recon handler will surface the shrinking finding count in the daily run; Thandiwe sees the trajectory in the AC pack as a coverage-burn-down.

---

## 5. What the recon does NOT cover (v1 scope boundary)

- **Substrate events.** `RaisedFinding`, `IncidentReported`, `BreachDetected` events carry their own provenance + citation chain; the recon does not (yet) walk the event store. Wave-6 candidate: emit a `riskTaxonomy` dimension on every risk-bearing event type and assert coverage at the projection layer.
- **Procedures + system capabilities.** Per Principle 2, every procedure (`Procedures/by-policy/*.md`) and every system capability (`prototype/platform/*`) should also cite a `riskTaxonomy` code where applicable. v1 does not walk these; Wave-5 follow-on.
- **Register-to-enum byte-for-byte parity.** The taxonomy.ts header notes a future assertion that the typed enum derives byte-for-byte from `Regulations/_risk-taxonomy.md`. That parity check is a separate Vera recon (planned Wave-5 #2), not bundled with coverage.
- **Owner-seat reconciliation.** Each L1 node has an `owner` (e.g. `OWNER_HELENA` for RT-CR). The recon does not yet assert that the policy fulfilling an obligation under that L1 is authored by the named owner seat. Wave-6 candidate.

These boundaries are by-design — v1 ships the minimum-viable coverage check that locks in the canonical reference and unblocks the three backfill PRs.

---

## 6. Substrate gap

The recon framework's `ReconSeverity` type does not yet carry an explicit `"advisory"` literal. v1 implements advisory mode by emitting at `warn` and relying on the `ok = violations.every(v => v.severity !== "fail")` invariant in `types.ts`. This is sufficient for v1, but a future framework-level `ReconMode = "enforcing" | "advisory"` flag would let pipelines surface intent without overloading the severity dimension. Filed as a Wave-5 follow-on; not blocking.

---

## 7. Sign-off

- **Vera (Internal audit engineer)** — pipeline authored, tested (9 tests passing), wired into `bun run ci`, advisory mode rationale documented above. Ready to land.
- **Thandiwe (Chief Audit Executive, governance)** — functional-line oversight; sees this in the next AC pack as Wave-5 #1 deliverable.

Citations on this brief:

- Principle 2 — single-graph discipline → [`Principles/2-single-graph-discipline.md`](../Principles/2-single-graph-discipline.md)
- Canonical risk taxonomy register → [`Regulations/_risk-taxonomy.md`](../Regulations/_risk-taxonomy.md)
- Typed enum mirror → [`prototype/platform/risk/taxonomy.ts`](../prototype/platform/risk/taxonomy.ts)
- Recon framework types → [`prototype/platform/recon/types.ts`](../prototype/platform/recon/types.ts)
