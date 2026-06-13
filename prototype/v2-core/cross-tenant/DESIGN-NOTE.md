# V2 S12 — Cross-tenant learning gate + CSI blocklist (design note)

**Author:** Atlas (Substrate Architect, engineering), with the CSI taxonomy from Zara (Chief Compliance Officer, governance) and independent validation from Vera (Internal Audit Engineer, governance).
**Workstream:** WS-V2-BBAAS.
**Brief:** `brief:atlas:v2-s12-cross-tenant-learning-gate-csi-blocklist-:2026-06-13`.
**Authority:** `D-W7-VENDOR-ENTITY-STRUCTURE` (CSI blocklist gate before C-tier go-live), `D-V2-TENANCY-ARCHITECTURE`, `D-V2-BBAAS-BLUEPRINT-SYNTHESIS`.

## Why S12 exists — the competition-law hazard

BBaaS is a **common supplier to competing banks** — the classic competition-law hub-and-spoke topology. The moment two competing tenants share infrastructure, one tenant's competitively-sensitive information (CSI) reaching another *through the platform* puts the banks in a concerted practice under **Competition Act 89 of 1998 s.4(1)** without their ever meeting — and the platform is the conduit. SA competition enforcement in banking (the forex matters) makes this no theoretical concern.

S10 made tenants isolated **at rest** (per-tenant stores, fail-closed routing). But the W8 agent-learning layer (posture register S3 → applicability S8 → decision-impact S9, and any future cross-tenant weight proposal) is **learning-derived** cross-tenant flow that data-at-rest isolation does not cover. S12 is the control that does: the **CSI blocklist** (what is competitively sensitive) plus the **cross-tenant learning gate** (screen every cross-tenant learning flow against it, fail-closed). This is the non-optional precondition `D-W7-VENDOR-ENTITY-STRUCTURE` names before any C-tier / multi-tenant-learning go-live.

## The CSI taxonomy (Zara, CCO) and its competition-law basis

The blocklist is an **event-sourced register** (Principle 1): a projection over `CsiCategoryRegistered` / `CsiCategoryRetired` events, never a static array. Zara owns the category content; the eight founding classes track the "never crosses" enumeration in Owen's W7 vendor-perimeter note §5.1. Each carries a section-level competition-law basis.

| Class | Category | Law basis |
|---|---|---|
| `positions-exposures` | Trading positions, exposures, volumes | Competition Act 89/1998 s.4(1) — concerted practice via a common supplier; the paradigm CSI class |
| `pricing-spreads` | Pricing, rate data, margins, spreads | s.4(1)(b)(i) — price-fixing via information exchange (the SA forex matters) |
| `client-counterparty-lists` | Client / counterparty identities and lists | s.4(1)(b)(ii) — customer allocation; also POPIA s.20–21 personal information |
| `pnl` | P&L, revenue, margins by book | s.4(1) — reduces uncertainty about a competitor's market conduct |
| `risk-appetite-calibrations` | RAS thresholds | s.4(1) — a bank's risk appetite is strategy |
| `model-calibrations` | Book-tuned model calibrations / parameters | s.4(1) — encode firm-attributable strategy (distinct from published FIL-Model methodology, which is not CSI) |
| `trade-level-data` | Individual trade records, tickets, granular flow | s.4(1) — recent, granular, firm-attributable data is CSI by construction |
| `strategy-plans` | Funding plans, product-launch plans, capacity, forward strategy | s.4(1) — forward strategy is highest-sensitivity CSI |

**What is NOT CSI** (and may generalise): knowledge about *regulation and control technique* conditioned on posture dimensions that are themselves regulatory categories (approach elections, designation status) — closer to a law firm's know-how than to an information exchange. Publicly-sourced regulatory knowledge is not CSI at all. Counsel ratifies the taxonomy at the licence-application moment (D-W7).

## The gate contract — fail-closed

`screenCrossTenantLearningFlow(flow, blocklist)` screens any learning flow that would use one tenant's data to inform another's **posture / FIL-model / applicability assessment / decision-impact** (the four W8 learning sinks). Decision tree:

1. **Within-tenant** (source == destination) → `within-tenant-pass`, allowed. A tenant learning from its own data is always permitted; the gate only guards *cross*-tenant flows. (This is what makes the gate correctness-neutral for the single anchor tenant today while being ACTIVE the moment a second tenant's learning appears.)
2. **Cross-tenant + unscreenable** (`csiCategoriesPresent` is `undefined`) → **blocked**. Fail-closed on doubt: a flow must be *positively* screened clean to cross; the absence of a clean classification is never a pass.
3. **Cross-tenant + empty active blocklist** → **blocked**. With no registered categories the gate cannot assert a flow is clean.
4. **Cross-tenant + any declared category is blocklisted** → **blocked**, naming the offending classes.
5. **Cross-tenant + screened clean** → `cleared`, allowed.

**Structured-first** (consistent with W8): the gate does not silently redact-and-proceed. Every screening decision becomes a typed, replayable event — `CrossTenantLearningScreened` (cleared / within-tenant) or `CrossTenantLearningBlocked` (carrying the offending categories). The complete crossing history is producible to the Competition Commission on demand.

Fail-closed is enforced in **three independent ways** so no single bug opens a leak: blocklisted-category present → block; unscreenable → block; empty blocklist → block.

## Enforcement posture and the S5 tie

The gate is **enforced** for cross-tenant flows via `recon:v2-csi-cross-tenant-gate` (ENFORCING, in the `ci:recon:infra` suite). C-tier / multi-tenant-learning **go-live is gated on this control being green** — the D-W7 precondition.

The S12 surface is tagged **`@tier K`** in `v2-core/index.ts` and listed in `RELEASED_SURFACE.K.kOnlyExports`: cross-tenant learning is **not in the R or C released surface** until this gate clears. No tenant tier can call the gate substrate; it is anchor-internal. This is the structural form of the S5 tie — the released-surface gate (`recon:v2-released-surface-clean-core`) asserts the `cross-tenant` token never bleeds into R/C.

## How it composes with S10 isolation

S10 and S12 are **orthogonal and complementary**:

- **S10 isolation** blocks cross-tenant data **at rest** — per-tenant stores, fail-closed routing. A query in tenant B's context cannot read tenant A's events.
- **S12 CSI gate** blocks cross-tenant **learning-derived** flow — the one named, reviewable distillation step where one tenant's data could inform another's posture/model/assessment. This is exactly the path S10 does *not* cover, because a learning flow is a derived artefact, not a stored row.

Together they are the defence regulators respect: (i) structural separation (S10) means tenant data cannot flow tenant-to-tenant *except* through one named step; (ii) that step (S12) screens every crossing against the CSI blocklist and surfaces every outcome as an event with provenance.

## Recon — `recon:v2-csi-cross-tenant-gate` (ENFORCING)

Four assertions: (1) **coverage** — every CSI class has an active blocklist entry (fail); (2) **non-bypass** — every recorded cross-tenant outcome is a well-formed gate event (fail); (3) **synthetic-leak / non-vacuous** — the gate is exercised against a constructed offender (tenant A `positions-exposures` → tenant B posture) and MUST block it (fail); (3b) a within-tenant control flow with the same payload is correctly allowed (proves the gate is not over-blocking); (4) fold integrity (warn).

**Sabotage-tested (Vera):** removing the screen (so the gate returns `allowed` for the leak) makes assertion 3 fire a fail-severity violation and the recon FAILS — confirmed by transiently patching the block branch and re-running. A CSI gate that does not block a leak is worthless; this gate provably is not.

## Substrate gap

The **cross-tenant learning *mechanism*** itself (weights proposing across tenants) is a later W8 slice and is out of S12 scope — S12 builds the GATE that screens it. When the mechanism lands, its emission path must route every candidate flow through `screenCrossTenantLearningFlow` and emit the gate-outcome event before any cross-tenant artefact is produced; a future recon assertion should tie the mechanism's emitters to a preceding gate event (the non-bypass invariant, strengthened from "well-formed" to "every mechanism output has a preceding cleared gate event"). The `csiCategoriesPresent` classifier (what categorises a flow's payload into CSI classes) is also a mechanism-side deliverable; S12 fail-closes on an absent classification so the gate is safe before the classifier exists.
