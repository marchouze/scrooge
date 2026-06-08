---
title: "WS-COMPLETENESS-AUDIT — continuous completeness-audit workstream (spec)"
date: 2026-06-08
author: "Vera (Internal audit / continuous-assurance engineer; functional reporting line → Thandiwe, Chief Audit Executive)"
status: spec — commissioned under D-COMPLETENESS-AUDIT-WORKSTREAM (CEO-approved, session-delegation, 2026-06-08)
authority: "D-COMPLETENESS-AUDIT-WORKSTREAM (CEO session-delegation, marc@tgv.co.za, 2026-06-08)"
backing_brief: "brief:vera:spec-the-continuous-completeness-audit-workstrea:2026-06-08"
originating_evidence: "docs/2026-06-08_fx-functionality-domain-review.md"
verified_against: "main @ post WS-SLA-FULL-RETIREMENT (#1094–#1098) + FX-gap closures this session"
location_note: >
  Filed to docs/ (the established dated-report convention on main — e.g.
  docs/2026-06-08_fx-functionality-domain-review.md), NOT a new reports/
  directory. The canonical commissioning artefact is the Decision event
  D-COMPLETENESS-AUDIT-WORKSTREAM (Principle 1); this markdown is its render.
---

# WS-COMPLETENESS-AUDIT — continuous completeness-audit workstream

> **Independence note.** This is a third-line product. Vera reports functionally
> to Thandiwe (Chief Audit Executive, governance) and administratively through
> the CEO. The completeness-audit function grades other agents' work without
> deference — it is explicitly **not** owned by the seats whose domains it audits.

---

## 1. Problem statement — breakage-monitoring vs incompleteness-monitoring

The bank already runs a strong **breakage-monitoring** substrate: ~120 `recon:*`
gates in `prototype/package.json` (`ci:recon:infra` + `ci:recon:domain`), failed-handler
detection, `AuditFinding` emission, the goal-loop that routes open findings/escalations
to handlers, and red-CI on any invariant break. This substrate is excellent at catching
things that **BREAK** — an orphan terminal event (`fx-lifecycle-parity`), a double-posting
emitter (`posting-engine-single-subscriber`), a missing citation (`mira:citation-gate`),
a silent zero (`calc-no-silent-zero`).

It is **blind to things that are SILENTLY INCOMPLETE behind a working fallback.** The FX
functionality review (`docs/2026-06-08_fx-functionality-domain-review.md`) surfaced three
canonical instances, each real and long-standing, each invisible to every existing gate:

- **G2.1 — fallback-masked CoA gap.** `platform/accounting/sla/rules/pr-fx-001.ts` provisions
  receivable/payable accounts for ZAR and USD only. Any EUR/GBP/JPY/CHF/AUD leg routes to the
  unresolved-currency suspense `ACC-2100-007`. The posting *balances*. `gl-ledger-coverage`
  passes (the event has GL coverage). `fx-subledger-reconciliation` passes (suspense residue
  with a backing CFO write-off decision is allowed). Nothing asserts "every traded ISO-4217
  currency has a dedicated CoA pair" — a real Principle-5 gap hiding behind a safe fallback.

- **G5.1 — built-but-inert module.** `platform/returns/ba310/period-close-subscriber.ts` (the
  SARB BA-310 market-risk / FX-NOP return) exists, is tested (`period-close-subscriber.test.ts`),
  and folds FX positions P1-compliantly. But a repo-wide search finds **zero non-test runtime
  importer** — `runtime/agents/bea-period-close.ts` never invokes it. The module breaks nothing;
  it simply never runs. There is **no automated SARB BA-310 submission path**, and no gate
  notices, because an unimported module emits no failure.

- **G3.1 — stale scheduled run.** `MarketRiskMeasureComputed` (VaR / MR-1-FX) is emitted by
  `scripts/market-risk-measure-run.ts` but appears in **no** `runtime/agents/metadata/*` cron
  entry. The measure is computed on-demand only; the figure can age indefinitely. No gate fails
  because nothing asserts a daily `MarketRiskMeasureComputed` is expected.

**Root cause.** A balanced suspense posting, an unimported module, and an unscheduled measure
each (i) break nothing, (ii) emit no trigger, finding, or red gate, and therefore (iii) are
never picked up by the goal-loop — which is driven by open findings/escalations/blocked routes,
none of which these produce. The proactive autonomous self-audit that would surface latent gaps
is not built. The FX review was a **one-off MANUAL stand-in for a missing STANDING function.**

Marc (CEO) asked the defining question: *why weren't these closed before a human asked for a
report?* The answer is structural, not a lapse by any one agent: **we monitor for failure, not
for incompleteness.** This workstream specs the standing function that monitors for incompleteness.

---

## 2. Taxonomy of silent incompleteness

Six detectable classes. Each is defined by an **assertion that should hold but is not checked**,
an **observable signature** the gate can scan for statically or over the event store, and a
**canonical exemplar** from the FX review (or a confirmed cross-domain instance).

| # | Taxon | The assertion that is silently unmet | Observable signature | Canonical exemplar |
|---|-------|--------------------------------------|----------------------|--------------------|
| T1 | **Built-but-inert** | "Every tested capability module has a runtime importer that actually invokes it" | Module under a watched set is imported by tests only; zero non-test runtime importer | BA-310 period-close subscriber (G5.1); the retired-but-retained `fxTradeBookingJournals` in `posting-rules/fx-spot.ts` (kept as oracle only) |
| T2 | **Fallback-masked gap** | "Every supported X has a first-class wired Y (dedicated account / handler / route), not a safety-net catch-all" | A first-class case resolves to a suspense/default/catch-all branch instead of a dedicated one | Supported-ccy FX leg → suspense `ACC-2100-007` (G2.1); per-ccy nostro ZAR/USD/EUR only → suspense (G6.2) |
| T3 | **Un-gated risk surface** | "Every material exposure / invariant has a bounding recon gate" | An exposure or completeness property exists in code but no `recon:*` gate asserts a bound on it | No gate on settlement-window / Herstatt close (B2 perpetually open); no gate on FinSurv submission coverage; FX double-posting before `posting-engine-single-subscriber` (#1096) |
| T4 | **Stale scheduled run** | "Every figure that must be fresh is emitted on a scheduled cadence with a freshness watchdog" | An emitter exists but is in no cron metadata, OR is scheduled but its latest event is older than its declared cadence | VaR/MR-1-FX `MarketRiskMeasureComputed` unscheduled (G3.1) |
| T5 | **Specified-not-built / not-yet-specified** | "Every implicitly-deferred capability is an explicitly-tracked register item" | A gap acknowledged in prose (a `(c)`/`(d)` maturity tag, a "licence-day" deferral, a stub) with **no** backing `SubstrateGap` / `AuditFinding` / open Decision | FX confirmation-matching log-only (G1.1, "net-new, no brief"); CLS PvP model (G6.1); FinSurv stub (G5.2) |
| T6 | **Citation / graph drift** | "Every citation refers to a live, current node (not a retired/renumbered/superseded one)" | A reference to a form/account/decision/module that has been renamed, retired, or superseded | Residual "BA 350" prose in `pr-fx-001-ba-v2.ts` after `D-BA-RETURN-FORM-NUMBERING-RECON` made BA 310 canonical (G5.3) |

**Design note on T2 vs a safe fallback.** The suspense routing in G2.1 is the *correct safe
behaviour* — it never silently mis-books to a wrong currency. The incompleteness is not the
fallback's existence; it is that the **first-class provisioning was never completed** and the
fallback silently absorbs cases that should never reach it in steady state. A T2 gate therefore
asserts "no first-class case reaches the catch-all", not "the catch-all must not exist".

---

## 3. Detection mechanisms per taxon

Each taxon gets one or more `recon:completeness:*` gates. All follow the established
`platform/recon/*.ts` contract (`run(): ReconResult`, `severity ∈ info|warn|fail`, pure
assertion over real repo state — files or the event store), and slot into `ci:recon:domain`
(or a new `ci:recon:completeness` stage — see §4).

| Taxon | Proposed gate(s) | Mechanism |
|-------|------------------|-----------|
| T1 built-but-inert | `recon:completeness:inert-module-detection` | **Importer-graph scan.** For each module under a watched set (e.g. `platform/returns/**`), grep all non-test `.ts` for an import of it. Zero non-test importers + ≥1 test importer ⇒ inert ⇒ flag, unless on a `KNOWN_INERT_PENDING_WIRING` allowlist (each entry a tracked finding with owner + closing decision). **PoC built — see §9.** |
| T2 fallback-masked | `recon:completeness:supported-currency-coa-coverage`; `recon:completeness:nostro-currency-coverage` | **Completeness-assertion.** Enumerate the supported set (traded ISO-4217 currencies from `FxTradeExecuted` events, or the configured currency universe) and assert each has a dedicated CoA receivable/payable pair (T2-CoA) / nostro (T2-nostro) — i.e. the resolver never returns the suspense branch for a supported currency. |
| T3 un-gated risk | `recon:completeness:exposure-gate-coverage` (meta-gate) | **Gate-coverage manifest.** Maintain a typed register of material exposures/invariants (extending `gap-register.ts`) each mapped to the `recon:*` gate that bounds it; FAIL on any exposure with no bounding gate. Seeds the named net-new gates: `recon:fx-settlement-window-staleness`, `recon:finsurv-coverage`. |
| T4 stale scheduled run | `recon:completeness:scheduled-emit-freshness` (generalize `recon:expected-event-watchdog` + `recon:cron-map-drift`) | **Liveness + freshness probe.** A typed register of "must-be-fresh" event types each with (a) a required cron metadata entry (cron-presence) and (b) a max-age tolerance asserted against the latest event of that type (event-age freshness). |
| T5 specified-not-built | `recon:completeness:deferral-tracking` | **Provenance audit of deferrals.** Scan prose markers — maturity tags `(c)`/`(d)`, "licence-day", "stub", "net-new", "not-yet-specified" in `docs/**`, `platform/**` headers, and persona `Substrate gaps` sections — and assert each maps to a tracked `SubstrateGap` id or open Decision. Untracked deferral ⇒ warn (raise as finding). |
| T6 citation/graph drift | extend `recon:decision-id-hygiene`, `recon:golden-source-stale-pages`, `recon:graph-ontology` | **Orphan/drift scan.** Assert citations resolve to a live node and not a superseded/renamed one (e.g. "BA 350" prose after the BA-310 reconciliation). Largely covered; gap is the prose-citation surface inside code headers. |

**Why static analysis, not the event store, for T1.** The inert-module signature is a *code
structure* property (importer edges), invisible in the event stream — an inert module by
definition emits nothing. The gate must read the filesystem. This mirrors `orphan-capability.ts`
and `test-lineage-not-in-production.ts` (pure FS / pure event-store reads respectively).

---

## 4. Cadence & home

**Home.** The completeness-audit function lives in the third-line continuous-assurance substrate
alongside the existing `platform/recon/*` gates and Vera's runtime handler. The
`recon:completeness:*` family is a sub-namespace of the existing recon contract — same
`ReconResult` shape, same CI wiring, discoverable as a cohesive set.

**Cadence — both CI and scheduled sweep.** Two run modes, deliberately:

1. **CI recon stage (synchronous, per-PR).** Static-analysis gates (T1, T2-CoA static portion,
   T6) run in a new `ci:recon:completeness` stage appended to `bun run ci`. These are cheap,
   deterministic file reads — they catch a *newly-introduced* inert module or a *new* supported
   currency without a CoA pair at PR time, before merge. This is the "shift-left" half.

2. **Scheduled cross-domain sweep (periodic, Vera's tick).** Event-store-dependent and
   cross-domain gates (T3 exposure-coverage, T4 freshness, T5 deferral-tracking) run on Vera's
   scheduled continuous-assurance tick (mirroring the existing Vera 02:13 UTC slot), because they
   assert against the live event store / accumulated state and surface *aging* gaps (a measure
   that has gone stale since the last PR). This is the "standing sweep" half — the function whose
   absence the FX review exposed.

**Independence.** Both modes are third-line: the gates are authored and owned by Vera (functional
→ CAE), not by the engineering seats whose domains they audit. A seat cannot suppress a finding
against its own domain by editing its own code — the gate and its allowlist live in the recon
substrate, and allowlist additions are reviewable findings, not silent caps (§5).

---

## 5. Findings lifecycle

Completeness gaps are raised as **typed findings**, reusing existing substrate — no new event
family unless a gap demands it:

- **In-flight engineering gaps** → `SubstrateGap` register (`platform/substrate/gap-register.ts`),
  folded by Atlas's substrate-state handler into `SubstrateStateSnapshot.gaps[]` +
  `WorkstreamRegistered` events. Each completeness finding that is *forward engineering work*
  (provision per-ccy CoA, wire BA-310) lands here with explicit severity/status/mitigation.
- **Control / assurance findings** → `AuditFinding` events (the existing third-line family), with
  the `AuditFindingClosed` closure path (PROC-AUD-FT-01 Step 8) so they are **tracked to closure**,
  not perpetually open. This is the right home for "supported currency X routes to suspense" as an
  assurance observation distinct from the engineering task.
- **Risk-register integration.** Where a completeness gap is also a *risk* (e.g. an un-gated
  exposure), it pairs with the `RiskRaised` / `RiskResolved|Accepted|Mitigated` closure family and
  is asserted by `recon:risk-register-closure` (no open production finding without a `riskId`).

**No silent caps — log coverage.** Every `recon:completeness:*` gate reports `asserted` (the size
of the universe it checked) in its `ReconResult`, and every allowlist entry carries an explicit
owner + closing-decision reference. A growing allowlist is itself a Vera finding: the gate must
make the *count* of known-inert / known-uncovered items visible, so suppression is never silent.
The anti-pattern this forbids is exactly the one the FX review exposed — a gap absorbed quietly
with no number anyone can see.

**Dashboard surfacing.** Completeness findings surface in the existing findings/decisions
dashboard tiles (the same channel as `AuditFinding` + open Decisions), so a standing count of
"open completeness gaps by taxon" is visible without commissioning a manual report.

---

## 6. Relationship to existing recon — the completeness whitespace

Representative classification of current gates (breakage vs completeness):

**Breakage gates (assert an invariant is not violated by what EXISTS):**
`fx-lifecycle-parity`, `trade-lifecycle-parity`, `posting-engine-single-subscriber`,
`calc-no-silent-zero`, `gl-ledger-coverage`, `fx-subledger-reconciliation`,
`event-store-append-only`, `decision-id-hygiene`, `pnl-attribution-reconciles`,
`mtm-vs-gl-amount-delta`. These fire when present data/code is *wrong*.

**Completeness-leaning gates that already exist (assert something is PRESENT):**
`ras-cluster-feeder-coverage` (every RAS cluster has a feeder), `expected-event-watchdog`
(expected events are emitted), `orphan-capability` (every capability is REALISED),
`mandate-coverage`, `seed-manifest-parity`, `financial-constants-coverage`,
`liquidity-limit-coverage`, `coa-name-no-currency`. These are the *seeds* of the completeness
family — the workstream generalizes and extends this thin existing layer.

**The whitespace WS-COMPLETENESS-AUDIT fills** (no current gate asserts these):

| Whitespace | Taxon | Net-new gate |
|------------|-------|--------------|
| Tested module with no runtime importer | T1 | `recon:completeness:inert-module-detection` |
| Supported currency with no dedicated CoA/nostro | T2 | `recon:fx-supported-currency-no-suspense` (**landed on `main` this session** — a concurrent FX-gap closure shipped the CoA half, validating the taxonomy) + `recon:completeness:nostro-currency-coverage` (nostro half, net-new) |
| Material exposure with no bounding gate | T3 | `recon:completeness:exposure-gate-coverage` (meta) + `recon:fx-settlement-window-staleness`, `recon:finsurv-coverage` |
| Must-be-fresh figure not scheduled / stale | T4 | `recon:completeness:scheduled-emit-freshness` |
| Acknowledged deferral with no register entry | T5 | `recon:completeness:deferral-tracking` |
| Citation to a retired/renumbered node | T6 | extend existing drift gates to code-header prose |

**Finding from this review (cross-domain, beyond the FX exemplar):** the inert-module pattern is
**not unique to BA-310**. Every `platform/returns/*/period-close-subscriber.ts` — `ba100`, `ba110`,
`ba300`, `ba310`, `conduct`, `cms`, `climate` — has zero non-test runtime importer (verified:
`bea-period-close.ts` imports none of them). The entire returns-submission layer is built-and-tested
but inert. This is precisely the systemic silent-incompleteness the workstream exists to surface,
and it is the seed of the T1 backlog (§8).

---

## 7. Autonomy endgame (Principle 6)

**Interim (now → near-term):** Vera runs a **central periodic cross-domain sweep** — one
third-line function holds the whole completeness map, runs the `recon:completeness:*` family on
its scheduled tick + in CI, and raises findings against every domain. This is the fastest path to
closing the blind spot and keeps the audit independent (the auditor is not the audited).

**Steady-state (Principle 6 — autonomous by default):** each seat **self-audits its own domain and
self-raises**. The per-seat self-audit is the domain owner running the completeness assertions
relevant to its mandate as part of its own goal-loop (e.g. Bea asserts CoA/nostro currency
coverage; Rohan asserts risk-measure freshness; Mira asserts return-submission liveness), emitting
its own `SubstrateGap`/`AuditFinding` *before* a central sweep finds it.

**Migration (central-sweep → per-seat-self-audit):**

1. **Phase A (interim, this workstream).** Vera builds + owns the central `recon:completeness:*`
   family; all findings flow through the third-line sweep.
2. **Phase B (distribute the assertions).** Each gate is annotated with the *owning seat* (the seat
   whose mandate the completeness property belongs to). Vera's sweep remains the enforcer, but the
   per-gate owner is now explicit (extends the `decision-authority-routing` pattern to gates).
3. **Phase C (per-seat goal-loop integration).** Each owning seat's goal-loop subscribes to its
   completeness gates and self-raises on its own tick. Vera's central sweep **down-shifts to a
   meta-audit**: it no longer finds first-order gaps (the seats do) — it asserts that *every seat
   is in fact running its self-audit* (a completeness check on the completeness checks). Third-line
   independence is preserved: Vera audits that the self-audits happen, without owning the domains.

This mirrors the bank's general autonomy arc — central scaffolding first, then push the capability
out to the autonomous seat, with third-line retaining the meta-assurance.

---

## 8. Initial backlog — prioritized first completeness checks

Seeded from the FX review gaps + the cross-domain inert-module scan done for this spec. Priority:
P1 = build first (material + generalizable), P2 = next, P3 = opportunistic.

| # | Pri | Check / gap | Taxon | Owner (build) | Notes |
|---|-----|-------------|-------|---------------|-------|
| B1 | **P1** | `recon:completeness:inert-module-detection` over `platform/returns/**` | T1 | Vera | **PoC built this PR (§9).** Seeds the allowlist with all 7 inert returns subscribers as tracked findings. |
| B2 | **P1** | Wire BA-310 period-close subscriber into `AccountingPeriodClosed` (close the highest-value T1 finding) | T1 | Mira / Eitan (reporting) + Bea (Accounting & financial reporting engineer) | The most material reporting gap (G5.1); no SARB BA-310 submission path today. |
| B3 | ~~P1~~ **DONE** | `recon:fx-supported-currency-no-suspense` (every traded ISO-4217 ccy has a CoA pair; no suspense routing in steady state) | T2 | Bea | **Landed on `main` this session** by a concurrent FX-gap closure — the G2.1 monitoring half is closed. Remaining: the paired per-ccy CoA *provisioning* engineering task + nostro coverage (B7). |
| B4 | **P1** | `recon:completeness:scheduled-emit-freshness` + add VaR/MR-1-FX to cron metadata | T4 | Rohan (risk engineer) | Generalize `expected-event-watchdog`; G3.1. |
| B5 | P2 | `recon:fx-settlement-window-staleness` (no B2/Herstatt window open beyond N business days) | T3 | Rohan | Named net-new gate from FX review §7. |
| B6 | P2 | `recon:finsurv-coverage` (every AD-reportable cross-border FX flow has a FinSurv report) | T3 | Mira (Compliance / RegTech engineer) | G5.2; exercises the build-phase stub. |
| B7 | P2 | `recon:completeness:nostro-currency-coverage` (every traded ccy has a dedicated nostro) | T2 | Bea + Tomas (payments/settlement) | G6.2; same root as B3. |
| B8 | P2 | `recon:completeness:exposure-gate-coverage` meta-gate (exposure→bounding-gate manifest) | T3 | Vera | The register that makes T3 systematic; consumes B5/B6 entries. |
| B9 | P3 | `recon:completeness:deferral-tracking` (every `(c)`/`(d)`/licence-day/stub marker maps to a tracked register entry) | T5 | Vera | Closes the "implicitly deferred, untracked" class (G1.1, G6.1). |
| B10 | P3 | Sweep residual BA-350 → BA-310 citation drift in code headers (`pr-fx-001-ba-v2.ts`) | T6 | Bea | G5.3; cosmetic but in-scope for T6. |

---

## 9. Proof-of-concept gate — `recon:completeness:inert-module-detection`

Built this PR (`platform/recon/completeness/inert-module-detection.ts`, wired as
`recon:completeness:inert-module-detection`). It is the generalizable T1 gate.

**Mechanism (pure filesystem static analysis, no event store — mirrors `orphan-capability.ts`):**

1. Enumerate candidate modules under a tightly-scoped **watched set**:
   `platform/returns/**/period-close-subscriber.ts` (the runtime entry-point contract of the
   returns layer — a form is "submitted" only if its subscriber fires off the
   `AccountingPeriodClosed` stream). Helper modules (`xml.ts`, `generator.ts`, `types.ts`) are
   deliberately **excluded** — they are legitimately imported by their sibling subscriber, not by
   runtime, so including them would false-positive. `*.test.ts` excluded.
2. For each candidate, scan every `.ts` under `runtime/` and `dashboard/` (the production
   execution paths) for an import specifier ending in the module's canonical path-suffix
   (`returns/<form>/period-close-subscriber`). Tests inside `runtime/` (`*.test.ts`) and
   `scenarios/**` do **not** count — they are exercise harnesses, not wiring.
3. A candidate with **zero `runtime/`|`dashboard/` importer** is **inert** (built + tested but
   never invoked by any production path).
4. An inert module FAILs **unless** it is on the explicit `KNOWN_INERT_PENDING_WIRING` allowlist —
   each entry carrying an owner + a tracked closing workstream item. The allowlist makes the gate
   **green on `main`** (the 7 known-inert returns subscribers are tracked, not silently dropped)
   while still FAILing a *newly-introduced* inert module or a *de-allowlisted* one. The matcher was
   verified to return true for genuinely-wired modules (no false-negative "always inert" bug).

**What it found on `main`:** all seven `platform/returns/*/period-close-subscriber.ts` modules
(ba100, ba110, ba300, ba310, conduct, cms, climate) are inert — tested, zero non-test runtime
importer. This is a real, systemic finding (the BA-310 G5.1 gap is one of seven). They are seeded
into `KNOWN_INERT_PENDING_WIRING` as tracked items (owner: Mira/Eitan + Bea; closing work: B2 for
BA-310, with the rest following the same period-close-wiring pattern), so the gate passes green on
`main` while making the count of known-inert modules explicit (no silent cap, per §5).

**Demonstrating it flags the pattern:** removing any entry from `KNOWN_INERT_PENDING_WIRING` makes
the gate FAIL on that module with a precise message (module path + "tested but no non-test runtime
importer" + remediation). The gate is therefore not a trivial pass — it actively asserts the T1
property and is green only because the known instances are tracked.

> If a watched-set widening introduces false positives (a module legitimately invoked via dynamic
> dispatch / a barrel re-export the import scan misses), the fix is to narrow the watched set or
> add a typed exemption with a cited rationale — never to weaken the import scan into noise. A
> shallow false-positiving gate is worse than none (per the brief).

---

## 10. Substrate gaps surfaced by this workstream

- **No central "exposure → bounding gate" manifest** exists yet (T3). The `gap-register.ts` is the
  natural home but currently lists engineering gaps, not exposure-to-gate mappings. B8 builds it.
- **No per-gate owner annotation** on `recon:*` gates (needed for the Phase-B autonomy migration,
  §7). Today ownership is implicit in the gate's authorship comment.
- **Deferral markers are unstructured prose** (`(c)`, "licence-day", "stub") scattered across docs
  and code headers — T5 detection (B9) needs a convention or it will be regex-fragile. The spec
  recommends a structured `@deferred(<register-id>)` annotation convention as the durable form.
- **The returns-submission layer is wholesale inert** (§6 finding) — a larger engineering
  workstream than this assurance spec; flagged here, owned by reporting (Mira/Eitan) + Bea.

---

## Appendix — verification trail

- Decision: `D-COMPLETENESS-AUDIT-WORKSTREAM` recorded requested (2026-06-08T16:00Z) → approved
  (2026-06-08T16:01Z) via `scripts/record-d-completeness-audit-workstream.ts`
  (recordedVia `scrooge:session-delegation`, authorityRef `marc@tgv.co.za`).
  `recon:decision-symmetry` green.
- Inert-module finding verified: `grep -rln "returns/<form>/period-close-subscriber" runtime/ dashboard/ platform/`
  (excluding the module's own dir + tests + `permission-gate-default.ts`) returns empty for all
  seven returns forms; `bea-period-close.ts` imports none.
- PoC gate: `platform/recon/completeness/inert-module-detection.ts`, wired `recon:completeness:inert-module-detection`.
- Models: `platform/recon/orphan-capability.ts` (pure-FS allowlisted gate),
  `platform/recon/test-lineage-not-in-production.ts` (recon contract).
