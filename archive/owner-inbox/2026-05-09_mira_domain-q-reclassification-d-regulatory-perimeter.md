---
title: Domain Q reclassification under PA look-through perimeter (D-REGULATORY-PERIMETER)
author: Mira (Compliance / RegTech engineer)
date: 2026-05-09
summary: Reclassifies the 8 Domain Q URNs landed in PR #84 under CEO decision D-REGULATORY-PERIMETER (PR #85). 3 stay `entity-scope: group` (parent-of-bank PA notification + IFRS 10 consolidated financial reporting + IAS 24 related-party disclosure — bind on Hoz Group Limited as a Companies Act / IFRS entity in its own right); 5 move to `entity-scope: bank` with new field `applies-at: consolidated` (CGPs, ICAAP, ILAAP, recovery plan, cyber-resilience programme — bind on Hoz Bank Limited but measured at consolidated level via PA look-through). New `applies-at` vocabulary added to the entity-scope section. Register bumped v1.8 → v1.9. No row-add, no row-remove — pure reclassification + vocabulary extension.
decision-required: false
---

# Mira (Compliance / RegTech engineer) — Domain Q reclassification under PA look-through perimeter, 2026-05-09

## Authority

CEO decision **D-REGULATORY-PERIMETER** (approved 2026-05-09; record `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-regulatory-perimeter.md` / PR #85, merged). The CEO clarified the regulatory perimeter per entity:

| Entity | Primary regulator | Regime |
|---|---|---|
| `Hoz Bank Limited` | SARB Prudential Authority | Banks Act + Prudential Standards + Joint Standards + BCBS as applied by PA |
| `Hoz Securities Limited` | Johannesburg Stock Exchange (JSE) | JSE Listings + Membership Rules + STRATE; FSCA / FAIS secondary |
| `Hoz Group Limited` | **Not separately regulated** | Companies Act 71 of 2008 + SARB PA *consolidated-supervision look-through* via Banks Act § 60+ — the group does NOT hold a separate prudential / conduct licence in its own right |

The decision-record §"What this clarifies" item 2 routed me to refine the per-entity register scoping (PR #84 baseline, currently `Regulations/_obligations-register.md` v1.8) post-merge. This is that close-out.

## What changed

### URNs that stay `entity-scope: group`

These obligations bind on `Hoz Group Limited` as a Companies Act / IFRS entity in its own right — not via PA look-through. They remain group-scope because the obligation source (IAS 24 / IFRS 10 / IFRS 12 / Companies Act / Banks Act § 60+ parent-of-bank designation) directly anchors the group as the obliged entity.

| URN | ID | Anchor |
|---|---|---|
| `urn:obligation:bank:group:consolidated-related-party-disclosure:v1` | `ORG-GRP-RPT` | IAS 24 + Companies Act 71 of 2008 § 75 + § 2 |
| `urn:obligation:bank:group:consolidated-financial-reporting:v1` | `ORG-GRP-FINREP` | IFRS 10 + IFRS 12 + Companies Act § 28–30 |
| `urn:obligation:bank:group:parent-of-bank-pa-notification:v1` | `ORG-GRP-PA-PARENT` | Banks Act 94 of 1990 § 60+ (controlling-company designation) |

Each row carries a v1.9 confirmation note + citation back to D-REGULATORY-PERIMETER §"What this clarifies" item 2. Each row now also explicitly sets `applies-at: entity-only` (the default; made explicit on Domain Q rows for clarity).

D-REGULATORY-PERIMETER §"Follow-on routes" Bea route is the framing source: "consolidated-supervision is a *prudential* concept (PA look-through), not a *financial-reporting* concept (which is IFRS-driven and applies to the group as a Companies Act entity)" — so IFRS 10 / IAS 24 stay group-bound; only the prudential rows reclassify.

### URNs reclassified to `entity-scope: bank` with `applies-at: consolidated`

These obligations bind on `Hoz Bank Limited` as a regulated bank, but are *measured / reported* at consolidated level via PA look-through (Banks Act § 60+). The PA does not directly license `Hoz Group Limited`; instead, the PA "looks through" the bank entity to assess group-wide risk under the consolidation perimeter (`Hoz Bank Limited` + `Hoz Securities Limited` + any future entity within scope).

| Old URN / ID | New URN / ID |
|---|---|
| `urn:obligation:bank:group:consolidated-cgps:v1` (`ORG-GRP-CGPS`) | `urn:obligation:bank:bank:cgps-consolidated-basis:v1` (`ORG-BNK-CGPS-CONS`) |
| `urn:obligation:bank:group:consolidated-icaap:v1` (`ORG-GRP-ICAAP`) | `urn:obligation:bank:bank:icaap-consolidated-basis:v1` (`ORG-BNK-ICAAP-CONS`) |
| `urn:obligation:bank:group:consolidated-ilaap:v1` (`ORG-GRP-ILAAP`) | `urn:obligation:bank:bank:ilaap-consolidated-basis:v1` (`ORG-BNK-ILAAP-CONS`) |
| `urn:obligation:bank:group:consolidated-recovery-plan:v1` (`ORG-GRP-RECOVERY`) | `urn:obligation:bank:bank:recovery-plan-consolidated-basis:v1` (`ORG-BNK-RECOVERY-CONS`) |
| `urn:obligation:bank:group:consolidated-cyber-resilience:v1` (`ORG-GRP-CYBER`) | `urn:obligation:bank:bank:cyber-resilience-consolidated-basis:v1` (`ORG-BNK-CYBER-CONS`) |

Each row carries:

- `entity-scope: bank` (replacing `group` / `consolidated-supervision`)
- `applies-at: consolidated` (new field, v1.9)
- A citation to `D-REGULATORY-PERIMETER` (the reclassification authority) **and** the underlying regulatory anchor (Banks Act § 60+ / JS 1 of 2024 / BCBS / IFRS / Companies Act — unchanged from v1.8) per Principle 2.
- An explicit note on the v1.8 → v1.9 reclassification (URN slug change + entity-scope change + applies-at addition).

For the cyber-resilience row, the brief offered a choice between `entity-scope: bank` + `applies-at: consolidated` and keeping `entity-scope: consolidated-supervision`. I chose `entity-scope: bank` + `applies-at: consolidated` for symmetry with the other 4 reclassified rows. The `consolidated-supervision` value is retained on `ORG-CY-02` (Joint Standard 1 of 2024 responsible-person designation) because that row tracks both per-entity and group-level discharges in a single row — cross-references between the two rows are now explicit. Documented this rationale inline in the cyber row and in the entity-scope vocabulary section.

## New `applies-at` vocabulary (extends entity-scope vocabulary section, register lines after the entity-scope table)

| Value | Meaning |
|---|---|
| `entity-only` | **Default.** The obligation is measured at the entity stated in `entity-scope`. No consolidation, no look-through. |
| `consolidated` | The obligation binds at the entity stated in `entity-scope`, but is **measured / reported on a consolidated basis** via PA look-through. The aggregation perimeter is the group of entities within consolidation scope under Banks Act § 60+ + IFRS 10. |
| `look-through` | The SARB PA (or other regulator) reads through the entity to assess group-wide risk. The obligation may bind on the parent (`Hoz Group Limited`) or on the entity depending on the regulatory anchor — the citation is decisive. |

Authority: D-REGULATORY-PERIMETER §"What this clarifies" item 2 + §"Follow-on routes recorded" Mira route. Cross-reference: D-LEGAL-ENTITY-TREE-V0 (PR #82) remains the entity-tree authority.

The `applies-at` field is the operational expression of "the bank is subject to PA prudential regulation; the group is not separately regulated; PA look-through assesses group-wide risk via the bank entity" (CEO posture statement, 2026-05-09).

## Register version bump

`Regulations/_obligations-register.md` header: **v1.8 → v1.9**. New changelog entry at the top of the file under the v1.9 banner, citing D-REGULATORY-PERIMETER + the PR #84 baseline.

## Obligations metric

**Total tracked obligations: ~215**, unchanged from v1.8 (the brief noted "expected ~219 same as v1.8 — reclassification not row-add"; the actual v1.8 total in the register footer is ~215; the count is unchanged either way because v1.9 is a pure reclassification + vocabulary extension, with no row-add and no row-remove).

Status-summary line for `corporate-bind` updated to reflect the reclassification: "Domain Q (8 URNs, reclassified v1.9 under D-REGULATORY-PERIMETER): 3 stay `entity-scope: group` + 5 reclassified to `entity-scope: bank` with `applies-at: consolidated`".

## Co-ordination with concurrent Wave

- **Atlas (Core banking platform architect)** — `claude/atlas-legal-entity-event-family-v0` — no register conflict.
- **Helena (Chief Risk Officer, governance) + Rohan (Risk engineer)** — `claude/helena-rohan-ras-pa-lookthrough-reframe` — possible conflict on `ORG-PR-23`. Confirmed that this PR's edits avoid `ORG-PR-23`; the Helena/Rohan PR can layer on top by reusing the `applies-at` vocabulary established here. If their PR lands first I will rebase and harmonise; if this PR lands first they should reuse the vocabulary as-is.
- **Linnea (Brand & design lead)** — no conflict.

## Substrate gaps surfaced

1. **Full register reclassification under PA look-through** — the v1.9 reclassification covers Domain Q only. The remaining ~190 implicit-`bank` rows still default to `applies-at: entity-only`; rows that may carry a consolidated reading (e.g. some Domain A prudential rows where the PA may apply consolidated reading) are part of the v1 substrate task already named under v1.8 (`Owner Inbox/2026-05-09_mira_per-entity-register-scoping-v0.md`). v1.9 establishes the vocabulary; v1 completes the classification.
2. **Vera recon harness** — `applies-at` field needs to be parsed by the same recon pipeline that consumes `entity-scope`. Documented as a Vera Wave-4 substrate-gap item.
3. **`CeoDecision` event substrate** — D-REGULATORY-PERIMETER was written-direct under Principle 7 "steady-state vs current substrate"; the canonical event will land when Atlas's CeoDecision event family ships (D-REGULATORY-PERIMETER §"Substrate gaps surfaced" item 1).

## Provenance

Authored by Mira (Compliance / RegTech engineer) under Zara (Chief Compliance Officer). Branch `claude/mira-domain-q-reclassification`; PR title `compliance(register): Domain Q reclassification under PA look-through (D-REGULATORY-PERIMETER)`. Reporting line: Mira → Zara.

—Mira (Compliance / RegTech engineer)
