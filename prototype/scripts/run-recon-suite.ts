// scripts/run-recon-suite.ts
//
// Run-all-then-aggregate runner for the recon CI suites.
//
// WHY THIS EXISTS
// ---------------
// `ci:recon:infra` and `ci:recon:domain` were single `&&` chains of
// `bun run recon:*` pipelines. The `&&` short-circuit meant the FIRST
// failing pipeline aborted every downstream pipeline. One of the infra
// pipelines — `recon:event-store-append-only` — fails LOCALLY ONLY on the
// pre-existing home-store archive-partition sequence gap
// (`~/.local/share/bank/event.db`; see `D-EVENT-STORE-SCALING-PHASE-5`).
// On a clean-store GitHub CI runner that pipeline passes, so the downstream
// gates (e.g. `recon:wall-clock-callsite-coverage`) ran on CI but never ran
// locally. On 2026-06-09 that masked two genuine wall-clock ratchet
// violations → three rounds of CI churn (PRs #1138 / #1140 / #1141).
//
// This runner runs EVERY named target regardless of individual failures,
// collects each exit code + a short failure summary, prints an aggregated
// report, and exits non-zero iff ANY target failed. So a locally-run
// `bun run ci` now surfaces the SAME failure set GitHub CI would — the
// env-only `event-store-append-only` failure no longer hides downstream
// real failures.
//
// NOTE: this runner deliberately does NOT paper over the underlying env
// gap. The home-store archive-partition gap is a separate pre-existing
// item tracked as `D-EVENT-STORE-SCALING-PHASE-5`. This runner only stops
// that (and any other env-sensitive early gate) from hiding downstream
// real failures.
//
// USAGE
// -----
//   bun run scripts/run-recon-suite.ts <suite-name>
//   bun run scripts/run-recon-suite.ts --targets recon:foo,recon:bar
//
// where <suite-name> ∈ keys of RECON_SUITES. `package.json` wires
// `ci:recon:infra` and `ci:recon:domain` to the named suites, so the
// ordered pipeline list for each suite lives here as a single source of
// truth (no duplication across package.json).
//
// Author: Atlas (Core banking platform architect)

import { spawnSync } from "node:child_process";

/**
 * The single source of truth for each CI recon suite's pipeline list.
 * Each entry is a `package.json` script name (`recon` or `recon:*`) run via
 * `bun run <name>`. Order is preserved from the legacy `&&` chains — this is
 * a control-flow change, not a coverage change.
 */
export const RECON_SUITES: Record<string, readonly string[]> = {
  infra: [
    "recon",
    // D-BANK-CONFIG-STORE — store-inventory coverage gate (ENFORCING, harden-only).
    // Every BANK_*_DB store-path env var in the source tree must appear in the
    // canonical STORE_INVENTORY registry (so a new store can't ship without being
    // advertised on the V2 Bank Config page); named non-store env vars excluded
    // explicitly. Authority: D-BANK-CONFIG-STORE; D-ENGINEERING-INTEGRITY-CHARTER.
    "recon:store-inventory-coverage",
    "recon:runtime-handler-sync",
    "recon:posting-engine-single-subscriber",
    // WS-V2-BBAAS — SA-CCR alias-flip single-emitter gate (CCR events of record).
    "recon:ccr-single-emitter",
    "recon:dispatch-sync-integrity",
    "recon:parallel-dispatch-divergence",
    "recon:rms-event-projection-parity",
    "recon:rms-briefs-parity",
    "recon:rms-documents-parity",
    "recon:rms-document-blob-integrity",
    "recon:cron-map-drift",
    "recon:agent-spec",
    "recon:agent-spec-cross-link",
    "recon:trigger-spec-handler-symmetry",
    "recon:event-store-append-only",
    "recon:event-store-no-delete-callsite",
    // D-MONEY-DECIMAL-REDENOMINATION — decimal-money cutover gates.
    // On a fresh config-only store: trivially green (no transactional events).
    // On a populated build-phase store: advisory audit lens (no FAIL-severity).
    // recon:no-legacy-le-identity is FAIL-severity (enforcement).
    // recon:no-residual-minor-encoding is FAIL-severity (enforcement).
    // Authority: D-MONEY-DECIMAL-BUILD-PROCEED; D-MONEY-DECIMAL-REDENOMINATION;
    //            D-LEGAL-ENTITY-NAME-HOZ-BANK.
    "recon:no-transactional-sim-events",
    "recon:no-legacy-le-identity",
    "recon:no-residual-minor-encoding",
    // WS-MONEY-DECIMAL-PURGE-REMEDIATION Wave 1 — CI-visibility companion for
    // the residual-minor gate. `recon:no-residual-minor-encoding` above runs
    // against the fresh config-only CI store (no transactional *Minor events),
    // so it is trivially green and could NOT have caught the slice-4 purge
    // regression (496 transactional events / 6,212 *Minor violations survived).
    // This companion builds an EPHEMERAL tmpdir store seeded with a legacy
    // *Minor event + a clean MoneyWire event and asserts the gate FAILS on the
    // former and not the latter — making the gate load-bearing in CI regardless
    // of the ambient store. Authority: D-MONEY-DECIMAL-PURGE-REMEDIATION.
    "recon:no-residual-minor-encoding-fixture",
    // recon:sub-ledger-leg-decimal-parity RETIRED — DROP complete per
    // D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3. SubLedgerLeg.amountMinor
    // removed from schema; the parity check is vacuously satisfied by type.
    "recon:urn-shape",
    "recon:aggregate-id-coverage",
    "recon:madge-circular-deps",
    "recon:v2-no-v1-import",
    "recon:fx-v2-sim-boundary",
    // WS-FX-V2-SIMULATOR Phase 1 — simulator-oracle gate (ENFORCING). Replaces
    // the retired FX V1-parity legs: asserts the SUT produces the expected
    // VaR/P&L/cash from known simulated inputs. Authority: D-FX-V2-SIMULATOR-FIRST.
    "recon:fx-v2-sim-oracle",
    // WS-FX-V2-SIMULATOR — market-path grounding-honesty gate (ENFORCING): every
    // world-simulator market-path field is grounded in a real production mark OR
    // explicitly flagged ungrounded — no synthetic value without a flag.
    // Authority: D-FX-V2-SIMULATOR-FIRST; Engineering-Charter cmd 4.
    "recon:fx-v2-market-path-grounding",
    "recon:v2-tenant-axis-present",
    "recon:v2-released-surface-clean-core",
    // WS-V2-BBAAS S16 — tier-entitlement coherence (ENFORCING): the K/R/C
    // flat-tier entitlement table stays coherent with the S5 released-surface
    // boundary — surfaceScope==tier, every capability resolves + is within
    // scope, C ⊆ R ⊆ K, flat-tier marker + no price field, anchor==K, and the
    // C-tier go-live preconditions (incl. tested second-provider fallback) are
    // present + gate go-live. The synthetic over-grant (C entitling a K-only
    // export) is caught sabotage-proof in the regression test. Authority:
    // D-V2-WAVE4-COMMERCIAL-POSTURE; D-V2-BBAAS-TIER-STRUCTURE.
    "recon:v2-tier-entitlement-coherence",
    "recon:v2-posture-register-integrity",
    // WS-V2-BBAAS S13 — eval-harness integrity (advisory). Every EvalRunCompleted
    // references a registered exam-set; exam-sets well-formed; recorded verdicts
    // reproducible by re-running the harness (engine-consistency). Authority:
    // D-W4-MODEL-LIBRARY-PILOT; D-V2-BBAAS-BLUEPRINT-SYNTHESIS.
    "recon:v2-eval-harness-integrity",
    // WS-V2-BBAAS S8 — applicability-assessment lifecycle integrity (advisory).
    "recon:v2-applicability-assessment-integrity",
    // WS-V2-BBAAS S9 — decision-impact sweep coverage (ENFORCING as of the W8
    // auto-trigger landing). Every approved Decision since the baseline MUST
    // carry a sweep (assertion 4 = fail); orphan impacts + recommendedActions
    // well-formedness asserted. The auto-trigger
    // (runtime/agents/owen-decision-impact-sweep.ts) sweeps every approved
    // Decision forward; the merge window was backfilled. Authority:
    // D-W8-DECISION-IMPACT-SWEEP.
    "recon:v2-decision-impact-sweep-coverage",
    // WS-V2-BBAAS W8 Slice D — context-pack freshness (advisory). For each
    // seat with postures, asserts a ContextPackBuilt event exists within the
    // last 30 days. Advisory: never fails CI; surfaces warn-severity findings.
    // Authority: D-W8-PARAMETRIC-TRAINING-POSITION; D-W8-EXAM-GOVERNANCE.
    "recon:context-pack-freshness",
    // WS-V2-BBAAS S1 — control-plane tenant registry (advisory in S1).
    "recon:v2-control-plane-tenant-registry",
    // Wave 0 (D-BANK-WIDE-V2-MIGRATION) — v2 type-registry coverage (advisory).
    // Every event type appended to the v2 control-plane store must have a
    // V2_EVENT_TYPE_REGISTRY row (with a Zod payloadSchema) so its payload is
    // validated fail-closed. Vacuous on a clean CI store; load-bearing on a
    // populated store. Flips enforcing once every v2-hosted type is guaranteed
    // a registry row at emit time. Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:v2-type-registry-coverage",
    // Wave 2 infra (D-BANK-WIDE-V2-MIGRATION) — generic store-tee coverage
    // (advisory). Every tee-enabled type (v2 registry row with a `tee` block) is
    // actually mirrored into the v2 control-plane store with a count matching its
    // V1 source (no gap = the loud-divergence backstop for a mirror failure; no
    // excess = no orphaned mirror). Vacuous on a clean store; load-bearing after
    // the ci:migrate chain seeds + backfills. Flips enforcing once every tee type
    // carries its own parity gate. Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:v2-store-tee-coverage",
    // WS-V2-BBAAS S14 — operational fleet integrity (advisory→enforcing): every
    // tenant has tier + surface grant; metering windows well-formed; upgrade
    // ledger consistent (no version regressions, connected chain).
    "recon:v2-fleet-integrity",
    // WS-V2-BBAAS S11 — tenant-scoped functional-seat roster parity (advisory→
    // enforcing): every anchor persona maps to exactly one anchor seat; seat
    // role/type/reportsTo/occupant consistent with Team/_team-roster.json
    // (the roster is the source — drift is a finding); no orphan seats. The
    // deterministic core is enforced sabotage-proof in the v2-core test.
    // Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-functional-seat-roster-parity",
    // WS-V2-BBAAS S6 — composition-factory seam (advisory): alias resolves +
    // no v2-core module bypasses the factory alias.
    "recon:v2-composition-factory",
    // WS-V2-BBAAS — shared FIL alias-registry conformance: every swappable
    // v2-core seam resolves through the one shared registry; no ad-hoc per-seam
    // singleton. Authority: D-FIL-SHARED-ALIAS-REGISTRY.
    "recon:v2-alias-registry-conformance",
    // WS-V2-BBAAS S10 — tenant-axis ENFORCEMENT (the S2 dark→enforced flip):
    // scoped reads isolate (synthetic cross-tenant-bleed case caught, non-vacuous),
    // routing fails closed on unknown tenant, no cross-tenant write. ENFORCING.
    // Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-tenant-isolation",
    // WS-V2-BBAAS S12 — cross-tenant CSI gate (competition-law keystone, ENFORCING).
    // No cross-tenant learning flow bypasses the CSI gate; the synthetic
    // tenant-A-position → tenant-B-posture leak is CAUGHT (sabotage-proof,
    // non-vacuous). D-W7 C-tier / multi-tenant-learning go-live precondition.
    // Authority: D-W7-VENDOR-ENTITY-STRUCTURE; D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-csi-cross-tenant-gate",
    // WS-V2-BBAAS A1 — FIL attribution kernel gates (design spec §5.2). Pass
    // vacuously over the live store until A2+ binds metrics; non-vacuous on
    // fixtures (they CAN fail). attribution-additivity: children-sum == joint
    // recompute for additive metrics. attribution-nonadditive-no-sum: a
    // joint-recompute metric (VaR/ES) can NEVER be summed from child results
    // (static: no `add` member; runtime: assertNoSum + sumChildren throw).
    // Authority: D-FIL-ATTRIBUTION-A1-BUILD; D-METRIC-ATTRIBUTION-DIMENSIONAL.
    "recon:attribution-additivity",
    "recon:attribution-nonadditive-no-sum",
    // WS-V2-BBAAS A3 — the NON-ADDITIVE proof. attribution-var-diversification:
    // the VaR `joint-recompute` AttributionMetric re-computes at each node; over
    // the LIVE standing-NOP book it proves (a) no-sum on the REAL metric, (b)
    // group VaR < Σ desk VaRs (diversification), (c) group VaR == v1 standing-NOP
    // VaR (read-only parity), (d) additive FX P&L still rolls up group == Σ desk.
    // Flat/historyless book downgrades (b)/(c) to info. v1 untouched.
    // Authority: D-FIL-ATTRIBUTION-A1-BUILD (A3); D-VAR-EXPOSURE-INCLUDES-STANDING-NOP.
    "recon:attribution-var-diversification",
    // WS-V2-BBAAS S15 — tenant onboarding-readiness (ENFORCING). Every registered
    // tenant is `ready` ONLY when every provisioning step landed (S1 register +
    // S11 seats + S5 surface grant + S14 fleet state) AND its tier preconditions
    // are met — a C-tier tenant cannot be ready while the S16 C-go-live
    // preconditions (tested second-provider fallback, cross-tenant CSI gate) are
    // unsatisfied (selling gated). The platform can REFUSE incomplete onboarding;
    // the synthetic half-provisioned tenant is caught sabotage-proof in the
    // v2-core regression test. The anchor (K) is already-onboarded and passes
    // without re-provisioning. Authority: D-V2-WAVE4-COMMERCIAL-POSTURE;
    // D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-onboarding-readiness",
    // A2 FX Valuable FIL-Model gates. fx-settlement-continuity: value_pre ==
    // value_post on settlement (structural — value() is lifecycle-free).
    // fx-book-nop-parity: the book:fx-trading slice value reconciles to the
    // shared standing-NOP fold (deriveNetFxPositionByCurrency), read-only /
    // parallel to v1. Authority: D-FIL-ATTRIBUTION-A1-BUILD (A2).
    "recon:fx-settlement-continuity",
    // Slice-3 fail-closed gate (D-CASH-ASSET-CLASS-V1): every `cash` FIL instance
    // carries an originatingInstrument back-ref (no orphan), and every settled FX
    // instance under a cash-materialising NPA has a matching cash instance (the
    // settlement path ran the product rule). Authority: D-CASH-ASSET-CLASS-V1.
    "recon:cash-materialisation-integrity",
    // Capital FIL asset-class fail-closed gate (D-CAPITAL-ASSET-CLASS-V1): every
    // `capital` FIL instance carries a valid typed qualifying-capital tier
    // (CET1/AT1/T2) + a tier-coherent sub-category + an originating back-ref (no
    // orphan); no own-funds leg lands in a suspense account; the composition tier
    // rollups (Tier 1 = CET1+AT1, Total = Tier1+T2) are internally consistent.
    // Non-vacuous on the anchor store (the R300m injection sim → one CET1 instance,
    // emitted by ci:migrate's capital:emit-injection-v2-sim). Authority:
    // D-CAPITAL-ASSET-CLASS-V1; Reg 38; Banks Act §70; BCBS CAP/RBC.
    "recon:capital-materialisation-integrity",
    // WS-CASH-ASSET-CLASS fail-closed gate (D-CASH-ASSET-CLASS-V1): ties
    // FX-settlement GL cash recognition to the Cash FIL instrument-of-record —
    // the sub-ledger cash leg (PR-FX-PRIN: received → Dr nostro, paid → Cr
    // nostro) and the FilInstrumentCreated{cash} instance are two renders of one
    // truth (Principle 1). Determinacy + two-sided balance + net non-vacuity.
    "recon:fx-cash-gl-recognition-integrity",
    "recon:fx-book-nop-parity",
    // WS-MULTI-BASE-CURRENCY (D-MULTI-BASE-CURRENCY-FOUNDATION) — ENFORCING,
    // harden-only. Asserts no literal reporting/base currency in the V2 FX
    // valuation path; the reporting currency must resolve from the holding
    // entity's functional currency. Expected 0 violations (debt removed in PR).
    "recon:no-hardcoded-reporting-currency",
    "recon:dashboard",
    "recon:wall-clock-callsite-coverage",
    "recon:decisions-events-only",
    "recon:decision-id-hygiene",
    "recon:decision-authority-routing",
    "recon:decision-authority-coverage",
    "recon:zod-schema-coverage",
    "recon:event-type-registry-coverage",
    "recon:golden-source-hardcoded-maps",
    "recon:server-version-vs-head",
    // Engineering Charter — "no-shortcuts" gates (D-ENGINEERING-INTEGRITY-CHARTER,
    // CEO-approved 2026-06-14). Harden-only ratchets that make the most common
    // coding shortcuts fail CI: type-checker suppression (#6), skipped/narrowed
    // tests (#3), swallowed errors (#6), and untracked deferrals (#1, #5).
    // ratchet-hardening-only is the advisory meta-gate guarding the ratchets
    // themselves (#3) — warns, never fails, during its soak phase.
    "recon:no-ts-suppression",
    "recon:no-skipped-tests",
    "recon:no-swallowed-errors",
    "recon:tracked-todo",
    "recon:ratchet-hardening-only",
    // WS-DECIMAL-NATIVE-MONEY-ARITHMETIC step 4 — advisory gate (allowlist applied,
    // exits 0 today). Blocks only NEW float-money arithmetic expressions added
    // outside the decimal-engine module. The allowlist shrinks as each engine
    // file migrates to decimal-native. Authority: D-DECIMAL-NATIVE-MONEY-ARITHMETIC.
    "recon:no-float-money-arithmetic",
    // D-V1-REMOVAL-PHASE-1 / D-V1-REMOVAL-PHASE-2 — V1→V2 cutover ledger + parity harness.
    // v2status-coverage: every event type must carry a v2Status field
    //   (ENFORCING — exits 1 if any entry lacks the field).
    // v1-removal-ratchet: v1-only count may not increase vs baseline
    //   (ENFORCING, HARDEN-ONLY — exits 1 if count > baseline).
    // v1-only-count-trend: advisory trend summary line; always exits 0.
    // fx-v2-parity: FX domain parity proof (ENFORCING in Phase 2;
    //   FLIP BLOCKED — see gate output for gap-closure requirements:
    //   Gap A2: daily-pnl.ts must migrate to FIL instance reads (A4);
    //   Gap A3: makeVarMetric must emit a typed production event).
    //   Fails CI intentionally until both gaps are resolved and the flip
    //   approved by CEO Decision. Authority: D-V1-REMOVAL-PHASE-2.
    "recon:v1-removal-v2status-coverage",
    "recon:v1-removal-ratchet",
    "recon:v1-only-count-trend",
    "recon:fx-v2-parity",
    // D-V1-REMOVAL-PHASE-3A — V2 GL posting engine parity gate (advisory).
    // Compares V1 SubLedgerPostingEmitted trial balance with V2 GlPostingEmitted
    // trial balance. Advisory (ok: true even with warn violations) until V2 covers
    // all 42 posting rules. V1-only accounts produce expected warn violations;
    // V2-only accounts (if any) or amount mismatches on common accounts fail.
    "recon:gl-v2-parity",
    // D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD — FX trial-balance fold byte-equivalence
    // gate (ENFORCING). Proves the FX contribution computed as a pure fold over the
    // primary FIL FX events (reading NO GlPostingEmitted) reproduces the FX posting
    // rules byte-for-byte (the legs the dual-run engine emits). Vacuous-pass on a
    // clean store (no FIL FX events). Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
    "recon:gl-v2-fold-equivalence-fx",
    // D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD FX3 — FX-fold election-provenance gate
    // (ADVISORY). Asserts every folded FX instance whose treatment DEVIATES from
    // the product default carries a backing recorded election with a citation
    // (FVOCI election IFRS 9 §5.7.5 etc.) — no silent, un-sourced treatment change.
    // Vacuous-pass on a store with no FX elections (the build-phase norm).
    // Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
    "recon:gl-fold-election-provenance",
    // D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD FX4 — close-snapshot reproducibility
    // gate (ENFORCING). Proves the period-close TrialBalanceSnapshotted is a
    // byte-faithful CACHE of the fold: re-folding the primaries at the snapshot's
    // window reproduces the snapshotted FX rows byte-for-byte (Principle 1 — the
    // one legitimate derived event in the accounting chain). Vacuous-pass on a
    // store with no close snapshots. Authority: D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD.
    "recon:tb-snapshot-reproducible",
    // D-V1-REMOVAL-PHASE-3B — V2 money-market LCR-denominator parity gate (advisory).
    // Compares the BA-300 LCR net-cash-outflow denominator from the V1 ALM snapshot
    // against the same denominator folded from the V2-parallel money-market
    // lifecycle events. Advisory (ok: true with warn) until the V2 path is
    // authoritative. Authority: D-V1-REMOVAL-PHASE-3B.
    "recon:ba300-v2-parity",
    // D-V1-REMOVAL-PHASE-3C — V2 bond GL parity gate (advisory). Compares the
    // bond GL trial-balance entries from the V1 bond lifecycle events against the
    // same entries folded from the V2-parallel bond lifecycle events, per bond
    // account. Advisory (ok: true with warn) until the V2 bond path is
    // authoritative. Authority: D-V1-REMOVAL-PHASE-3C.
    "recon:bond-gl-v2-parity",
    // D-V1-REMOVAL-PHASE2-GAP-A2 — daily P&L V2 parity gate (advisory).
    // Compares V1 DailyPnLReportGenerated (FxPositionRevalued-based, v1-only)
    // against V2 computeDailyPnLV2 (snapshot-anchored FIL projection + MarketDataSlice
    // per Valuable.value()). Advisory (ok: true even with warn violations) until:
    //   (1) FilInstrumentCreated backfill populates the V2 anchor store,
    //   (2) parity proof passes in production,
    //   (3) CEO Decision (A4) approves the flip (FxPositionRevalued → v2-replaced).
    // Gap warn on vacuous V2 side (no FIL FX instruments yet); divergence on
    // populated sides is warn-severity until A4 approved.
    // Authority: D-V1-REMOVAL-PHASE2-GAP-A2 (CEO-approved 2026-06-16).
    "recon:daily-pnl-v2-parity",
    // D-V1-REMOVAL-PHASE-3D — V2 credit-limit approval-registry parity gate (advisory).
    // Compares V1 approval registry (CreditLimitApproved/Loaded/Withdrawn) with V2
    // registry (CreditLimitApprovedV2/LoadedV2/WithdrawnV2). Advisory until dual-run
    // emitters are wired at every V1 call site. V1-only counterparties produce
    // expected warn violations; V2-only counterparties (if any) or mismatches fail.
    "recon:credit-limit-v2-parity",
    // D-V1-REMOVAL-PHASE-3E — BA-700 capital adequacy V2 parity gate (advisory).
    // Compares V1 BA-700 (SubLedgerPostingEmitted + CapitalContributionRecorded +
    // CcrEadComputed V1) vs V2 BA-700 (GlPostingEmitted capital accounts +
    // CcrEadComputed v2-parallel). Advisory: V2 capital numerator is zero at Phase 3e
    // (no capital GL posting rules emit GlPostingEmitted yet — GAP-3E-001).
    "recon:ba700-v2-parity",
    // D-FX-OTC-CLOSURE-BACKLOG (Phase B4) — BA-320 FX market risk V2 parity gate.
    // ENFORCING on the clean-store-provable legs: parity-harness self-test, the
    // FilInstrumentCreated/Terminated v2-parallel registration (FAIL for ANY
    // non-v2-parallel status), neither projection throws, and — when BOTH the V1
    // and V2 Reg 28(5) open-position charges are populated (a real book + production
    // rates) — charge equality (one shared rate snapshot + one shared decimal-engine
    // HALF_UP rounding; the precision gap is root-caused, not tolerance-loosened).
    // DATA-DEPENDENT legs (coverage gap, per-currency comparison) stay advisory/
    // vacuous on the clean store (no FX book — awaiting licence-day data).
    // Authority: D-FX-OTC-CLOSURE-BACKLOG; D-BANK-WIDE-V2-MIGRATION; D-V1-REMOVAL-PHASE-3E.
    "recon:ba320-fx-v2-parity",
    // WS-V2-AUTHORITATIVE S6 — ALM-snapshot-SHAPE V2 parity gate (advisory).
    // Structural-compares V1 getALMPositionSnapshot vs V2 getALMPositionSnapshotV2
    // (HQLA / funding / ASF / RSF arrays) for the anchor bank entity — the
    // snapshot shape the dashboard ALM / LCR / NSFR route reads, where
    // recon:ba300-v2-parity compares only the LCR ratio denominator. Advisory:
    // the V2 money-market shadow has no events in build phase, so a V2-vacuous /
    // V1-populated divergence is an expected warn. A compute throw fails.
    // Authority: D-BANK-WIDE-V2-MIGRATION + D-V1-REMOVAL-PHASE-3B.
    "recon:alm-snapshot-v2-parity",
    // D-V1-REMOVAL-PHASE-4 — dashboard read-route → V2 coverage gate (advisory).
    // Enumerates dashboard read routes with a V1↔V2 projection pairing and counts
    // how many have a V2 read path wired under the useV2Store flag vs total. Each
    // V1-only route carries an explicit reason (warn) — no silent gaps. Genuine
    // drift (missing handler / disappeared V2 marker) fails. Becomes enforcing
    // once all routes are wired. Authority: D-V1-REMOVAL-PHASE-4.
    "recon:dashboard-v2-coverage",
  ],
  domain: [
    "recon:prose-duplication",
    "recon:decision-recommendation",
    "recon:retention-citation-coverage",
    "recon:provenance-tag-coverage",
    "recon:provenance-lineage-registered",
    "recon:test-lineage-not-in-production",
    "recon:provenance-badge-coverage",
    "recon:operating-book-selector-coverage",
    "recon:category-policy-coverage",
    "recon:provenance-emit-discipline",
    "recon:ras-b2-calibration-coverage",
    "recon:ras-cluster-feeder-coverage",
    "recon:ras-b7-model-tier-discipline-coverage",
    "recon:liquidity-appetite-snapshot-coverage",
    "recon:ras-b6-cyber-severity-coverage",
    "recon:ras-register-parity",
    "recon:var-nop-exposure-parity",
    // WS-FX-OTC-CLOSURE A3 — V2 VaR parity gate (honest enforcing/awaiting-data
    // split; D-FX-OTC-CLOSURE-BACKLOG). Construction/wiring legs (registry
    // coherence, V1-not-prematurely-replaced sentinel, V2-kernel-live probe) are
    // ENFORCING and bind on the clean store. The byte-parity leg (V1
    // MarketRiskMeasureComputed ↔ V2 MarketRiskVarComputed within 1 ZAR
    // minor-unit) ENFORCES the instant both events exist, and vacuous-skips
    // (info, never forced green) when the clean store is data-empty.
    "recon:var-v2-parity",
    "recon:fx-gateway-threshold-enforcement",
    "recon:permission-gate-default",
    "recon:permission-policy-coverage",
    "recon:decision-required-event-pairing",
    "recon:agent-snapshot-staleness",
    "recon:goal-loop-capability",
    "recon:goal-loop-run-lifecycle",
    "recon:risk-taxonomy-coverage",
    "recon:decision-record-event-symmetry",
    "recon:document-registration",
    "recon:fsca-reg-to-policy",
    "recon:graph-ontology",
    "recon:orphan-capability",
    "recon:completeness:inert-module-detection",
    "recon:dcam-taxonomy-coverage",
    "recon:semantic-registry-coverage",
    "recon:decision-symmetry",
    "recon:conduct-surveillance-coverage",
    "recon:counterparty-exposure-coverage",
    "recon:market-data-provenance-gate",
    "recon:credit-limit-no-trade-without-loaded",
    "recon:credit-limit-annual-review-staleness",
    "recon:lex-cap-utilisation",
    "recon:credit-limit-breach-unescalated",
    "recon:risk-register-closure",
    "recon:liquidity-limit-breach-unescalated",
    "recon:liquidity-limit-coverage",
    "recon:cfp-trigger-coverage",
    "recon:position-revalued-cites-mark",
    "recon:mtm-reversal-paired-with-reval",
    "recon:no-prop-attribution",
    "recon:persona-attribution-coherence",
    "recon:policy-next-review",
    "recon:gl-ledger-coverage",
    "recon:fx-lifecycle-parity",
    "recon:trade-lifecycle-parity",
    "recon:fx-pair-direction",
    "recon:fx-pair-canonical-aggregation",
    "recon:fx-quoting-convention",
    // FRTB trading-desk compliance (D-FRTB-TRADING-DESK-STRUCTURE). ENFORCING:
    // every registered desk carries the full MAR12 desk-definition attribute set
    // + a valid bookType; every FX trade's deskId resolves to a registered active
    // desk whose bookType matches the trade's bookType (FRTB boundary integrity).
    "recon:frtb-desk-integrity",
    // WS-V2-CLIENT-ONBOARDING — born-V2 client (counterparty) onboarding gating
    // invariant. ENFORCING: a counterparty cannot reach `activated` without every
    // required gating phase (KYC / sanctions / FAIS / BO / FATCA-CRS / POPIA /
    // credit / accounts) + a prospect registration. A concealed activation is a
    // fail-closed compliance breach. Authority: D-V1-REMOVAL-PHASE-1.
    "recon:v2-client-onboarding-integrity",
    "recon:fx-rate-magnitude",
    "recon:entity-identity-coherence",
    "recon:procedure-event-name-coherence",
    "recon:regulatory-extraction-coverage",
    "recon:provision-tick-drift",
    "recon:decision-distillation-coverage",
    "recon:fil-conformance",
    // WS-ACCT-MODULAR-FOLD S0a — reporting-treatment menu registry-conflict gate
    // (no two treatment modules claim the same category+scope at the same
    // version). ADVISORY, ENFORCING-READY — matches the fil-conformance precedent:
    // the register starts empty so it passes trivially; only a malformed
    // declaration (hard fold error) blocks CI. Authority:
    // D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD; D-DERIVED-EVENT-IRREDUCIBILITY-TEST.
    "recon:reporting-treatment-registry-conflict",
    // WS-V2-BBAAS S7-FIL / D-FX-OTC-CLOSURE-BACKLOG (Phase B4) — SA-CCR FIL-Model
    // gate. ENFORCING on the clean-store-provable CONSTRUCTION CONDITIONS: the
    // production FIL SA-CCR model (`computeSaCcr`) on a deterministic synthetic
    // netting set must satisfy α=1.4, EAD=round_halfup(1.4×(RC+PFE)) over its own
    // RC+PFE outputs, and EAD≥RC≥0 — FAIL on any violation, so a flat store no
    // longer passes vacuously. The recorded-history byte-equivalence legs are
    // DATA-DEPENDENT: hard FAIL on a recompute divergence where netting sets are
    // recorded; vacuous (awaiting licence-day book data) on the clean store.
    // Authority: D-FX-OTC-CLOSURE-BACKLOG; D-BANK-WIDE-V2-MIGRATION; D-FIL-FRAMEWORK-UNIFICATION.
    "recon:v2-saccr-parity",
    // Wave 2 PILOT — posture domain V1-store ↔ v2-control-plane-store register
    // byte-equivalence. ENFORCING once byte-clean (the pilot flip evidence).
    "recon:posture-v2-parity",
    // Bucket A PILOT — RwaComputed → RwaComputedV2 retired-by-construction.
    // ENFORCING: asserts the four D-V1-REMOVAL-FLIP-BASIS-RBC conditions
    // (registry tags; V1 un-emittable; V2 sole live path produces non-vacuous;
    // decoded-decimal parity). Decoded-value compare (not byte) — unit change.
    "recon:rwa-computed-v2-parity",
    // Bucket A batch A3 (FINAL) — OperationalLossEvent → OperationalLossEventV2
    // retired-by-construction. ENFORCING: asserts the D-V1-REMOVAL-FLIP-BASIS-RBC
    // conditions (registry tags; V1 un-emittable; V2 sole live path PASS-on-empty;
    // decoded-decimal parity). Decoded-value compare (not byte) — unit change.
    "recon:operational-loss-v2-parity",
    // Wave 2 BATCH-1 — four money-free reference-data domains (regulatory,
    // market-data, obligation-review, obligation-equivalence; 19 types) V1-store
    // ↔ v2-control-plane-store event-list parity. ENFORCING (byte-clean flip).
    "recon:reference-data-v2-parity",
    // Wave 2 BATCH-2 — seven money-free governance-attestation + KYC + lifecycle
    // domains (kyc, cae-governance, ciso-governance, governance-seat-runs,
    // obligation-lifecycle, policy-activation, decision-distillation; 36 types)
    // V1-store ↔ v2-control-plane-store event-list parity. ENFORCING (byte-clean).
    "recon:governance-attestation-v2-parity",
    // Wave 2 BATCH-3 — remaining money-free, non-substrate domains (intranet,
    // sla-approval, regulatory-pa, seed-management, model-risk, regulatory-
    // reporting money-free rows + foothold domains v2-banking/decision-impact/
    // v2-eval/context-pack/cross-tenant-csi/applicability; 39 types) V1-store ↔
    // v2-control-plane-store event-list parity. ENFORCING (byte-clean).
    "recon:money-free-batch-3-v2-parity",
    // Bucket C PILOT — agent-performance domain (AgentPerformanceEvaluated,
    // AgentFeedbackIssued; 2 types) V1-store ↔ v2-control-plane-store event-list
    // parity. ENFORCING (byte-clean / PASS-on-empty). Validates the money-free
    // control-plane store-tee path for the ~195 remaining bucket-C types.
    "recon:agent-performance-v2-parity",
    // Bucket C bulk BATCH 1 — 57 non-load-bearing control-plane substrate types
    // (agent-lifecycle + governance-process + HR) V1-store ↔ v2-control-plane-
    // store VERBATIM {event_id, type, payload} tuple-fold parity. ENFORCING
    // (byte-clean / PASS-on-empty). Empty-population flips tracked as one
    // batch-level gap (scope §5.1). Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:bucket-c-batch1-v2-parity",
    // Bucket C bulk BATCH 2 — 68 non-load-bearing control-plane substrate types
    // (CISO/security-process + party/product-lifecycle + legal/privacy-process)
    // V1-store ↔ v2-control-plane-store VERBATIM {event_id, type, payload} tuple-
    // fold parity. ENFORCING (byte-clean / PASS-on-empty). Empty-population flips
    // tracked as one batch-level gap (scope §5.1). Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:bucket-c-batch2-v2-parity",
    // Bucket C bulk BATCH 3 (FINAL non-load-bearing) — 30 non-load-bearing
    // control-plane substrate types (C-3 agent-lifecycle/runtime remainder incl
    // SubstrateAlert + SubstrateAgentRun* + ScheduledTrigger, C-9 audit/readiness/
    // regulator-process, C-10 agent-performance remainder) V1-store ↔ v2-control-
    // plane-store VERBATIM {event_id, type, payload} tuple-fold parity. ENFORCING
    // (byte-clean / PASS-on-empty). Empty-population flips tracked as one batch-
    // level gap (scope §5.1). Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:bucket-c-batch3-v2-parity",
    // Bucket C bulk BATCH 4 (FINAL non-load-bearing — COMPLETES the wave) — the
    // 4 money-free reference-data-process boundary types (SanctionsListPublished,
    // PepListPublished, AdverseMediaPublished, TaxClassificationPublished)
    // V1-store ↔ v2-control-plane-store VERBATIM {event_id, type, payload} tuple-
    // fold parity. ENFORCING (byte-clean / PASS-on-empty). Empty-population flips
    // tracked as one batch-level gap (scope §5.1). ReconciliationBreak EXCLUDED
    // (money-bearing, C/B boundary). After this batch the ONLY bucket-C v1-only
    // types are the 14 load-bearing dispatch/run-lifecycle/RMS types (CEO
    // checkpoint). Authority: D-BANK-WIDE-V2-MIGRATION.
    "recon:bucket-c-batch4-v2-parity",
    // Bucket C FINAL load-bearing batch (CLOSES bucket C) — the 14 load-bearing
    // dispatch / run-lifecycle / RMS types (AgentBriefIssued, RecordFiled,
    // DecisionRequested, Feedback, BriefSuperseded, Decision, DocumentRegistered,
    // AgentRunStarted, AgentRunCompleted, AgentRunFailed, WorkstreamRegistered,
    // WorkstreamStarted, WorkstreamCompleted, ReconResult) V1-store ↔ v2-control-
    // plane-store VERBATIM {event_id, type, payload} tuple-fold parity. ENFORCING
    // (byte-clean; NON-VACUOUS on the home store — high-population dispatch/decision/
    // run history; PASS-on-empty on the CI store). The dispatch CLIs stay
    // V1-authoritative (this flip is v2Status+ratchet only); the RMS/dispatch gates
    // (rms-briefs-parity, rms-documents-parity, dispatch-sync-integrity) read V1
    // unchanged. ReconResult self-reference analysed, not a hazard (14/14 flipped).
    // CLOSES bucket C. Authority: D-V1-REMOVAL-BUCKET-C-LOAD-BEARING-FLIP.
    "recon:bucket-c-loadbearing-v2-parity",
    // Wave 2 BUCKET-A BATCH-A2 — nine EMITTABLE numeric-money, non-financial
    // types (ClimateScenarioRun, FeeDisclosureEvent, Correspondent…Sent,
    // NostroStatementReceived, CounterpartyExposureCalculated, STRCandidate,
    // RelatedPartyTransactionProposed, InterEntityTransactionProposed,
    // PAIARequest) V1-store ↔ v2-control-plane-store DECODED-DECIMAL parity
    // (v2 payload == codec(v1 payload); MoneyWire lift). ENFORCING; PASS-on-empty
    // in the build phase (all nine data-empty), codec correctness proven by unit
    // test. Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE.
    "recon:bucket-a-a2-v2-parity",
    // Money-bearing non-financial TAIL — two EMITTABLE numeric-money OPERATIONAL
    // payments-reconciliation types (ReconciliationBreak, DailyReconciliationReport)
    // V1-store ↔ v2-control-plane-store DECODED-DECIMAL parity (v2 payload ==
    // codec(v1 payload); optional minor-unit tradeAmount/paymentAmount lifted to
    // MoneyWire, currency sourced from payload). ENFORCING; PASS-on-empty on the
    // money lift in the build phase (codec correctness proven by unit test).
    // Authority: D-V2-CORE-MONEY-DECIMAL-NATIVE; D-V1-REMOVAL-FLIP-BASIS-RBC.
    "recon:money-tail-v2-parity",
    "recon:period-close-cursor-integrity",
    "recon:ba310-submission-completeness",
    "recon:ba-returns-vs-gl-balances",
    "recon:mtm-vs-gl-amount-delta",
    "recon:liquidity-position-vs-settled-notional",
    "recon:posting-rule-stub-audit",
    "recon:golden-source-decisions",
    "recon:golden-source-schema",
    "recon:golden-source-stale-pages",
    "recon:npa-gate",
    "recon:product-approval-attestation-integrity",
    "recon:model-risk-gap-inventory",
    "recon:calc-model-binding",
    "recon:fx-model-validation-of-record",
    // FX C8 (WS-FX-OTC-CLOSURE) — data-quality lineage audit. Asserts every FX
    // rate-feed tick + settlement-confirmation event carries lineage-to-source;
    // fail-closed on missing lineage. Closes the NPA gap `fx-data-feed-lineage-
    // audit`. Authority: D-FX-OTC-CLOSURE-BACKLOG; D-OPERATING-BOOK-PROVENANCE-
    // ARCHITECTURE.
    "recon:fx-data-feed-lineage",
    "recon:seed-manifest-parity",
    "recon:financial-constants-coverage",
    "recon:basel-constants-coverage",
    "recon:extraction-provenance",
    "recon:obligations-seed-parity",
    "recon:obligation-urn-coverage",
    "recon:obligation-divergence",
    "recon:regulator-mandate-coverage",
    "recon:requirement-objective-linkage",
    "recon:objective-policy-alignment",
    "recon:obligation-policy-coverage",
    "recon:npa-coverage",
    "recon:npa-deferred-gap-tracking",
    // D-NPA-POST-APPROVAL-FINDING-REVIEW (CEO-approved 2026-06-15): every
    // ProductPostApprovalFinding must have a ProductDimensionRetrospectiveReview
    // within SLA. BLOCKING. No licence-day deferral.
    "recon:npa-post-approval-finding-review",
    // D-BA-RETURN-DATA-CONTRACT (CEO-approved 2026-06-19): binds the L3 return-
    // cell data contract into the NPA gate. Every CURRENTLY-EFFECTIVE product
    // (resolveEffectiveApprovals — not dead approvals) must capture, or track as
    // a deferred gap on its accounting dimension, every PRODUCT-SPECIFIC required
    // product-attribute the inverse index says it owes. BLOCKING. Scope today is
    // small (BA 100 only, mostly GL-/projection-derived) and auto-tightens as
    // Phase C lands each return's product-attribute requirements.
    "recon:npa-return-data-obligation-integrity",
    // Capture-model coherence (D-BA-RETURN-DATA-CONTRACT "close the loop"):
    // asserts the C engine (CAPTURE_CAPABILITY_MAP) and the D event
    // (ProductReturnDataCaptureDeclared) stay grounded + non-redundant — no
    // fabricated capability rows, no ungrounded/redundant declarations, and the
    // gate-ready invariant holds for every effective product across both streams.
    // BLOCKING.
    "recon:product-return-capture-coherence",
    "recon:dsar-sla",
    "recon:counterparty-basel-classification-coverage",
    "recon:calc-no-silent-zero",
    "recon:pnl-attribution-reconciles",
    "recon:pnl-signoff-coverage",
    "recon:all-asset-pnl-ipv-coverage",
    "recon:expected-event-watchdog",
    "recon:clients-entityname-uniqueness",
    "recon:mandate-coverage",
    // D-DOMAIN-OWNERSHIP-MAP — Agent⟺Domain⟺Obligation ownership coherence
    // (advisory; C1 obligation→domain, C2 domain→seat→agent, C3 every top-level
    // domain owned, C4 owner alignment). Flips enforcing after Slice-3 remediation.
    "recon:domain-ownership-coherence",
    "recon:procedure-actor",
    "recon:compliance-obligation-tracing",
    "recon:posting-source-id-canonical",
    "recon:odp-portfolio-recon-dispute-staleness",
    "recon:odp-collateral-segregation-breach-staleness",
    "recon:odp-repo-recon-dispute-staleness",
    "recon:coa-name-no-currency",
    // WS-ACCT-FX-COMPLETENESS — accounting-schema canonical-home gate.
    // ENFORCING (Slice 4): no accounting schema hand-declared outside v2-core;
    // chart-of-accounts single-source; every treatment-module posting-rule
    // reference resolves. Authority: D-ACCT-SCHEMA-CANONICAL-HOME.
    "recon:accounting-schema-home",
    "recon:fx-supported-currency-no-suspense",
    "recon:account-designated-currency",
    "recon:valuation-adjustment-additive",
    "recon:orphan-open-runs",
    "recon:orphan-run-deliverable-state",
    "recon:sla-codegen-drift",
    "recon:sla-rule-versioning",
    "recon:sla-approval-workflow",
    "recon:ba-form-numbering",
    // ENFORCING (D-BA-RETURN-DATA-CONTRACT Phase B): every BA100.xsd cell has a
    // complete data-requirement contract entry; citations resolve; sourced
    // cells point at real GL categories / approved products / projections;
    // non-sourced cells are honestly tracked. Marc's "every cell fully
    // defined" guarantee, machine-checked.
    "recon:ba-return-cell-contract",
    // ENFORCING (D-FX-RETURN-CELL-CONTRACTS-AND-BA700-MR-WIRING): the FX→return-
    // cell inverse index (fx-product-return-cells.ts) names the SARB cells an FX
    // OTC vanilla trade feeds at verbatim XSD coordinates; this gate asserts each
    // declared cell resolves verbatim (form+row+column+label) against the XSD-
    // sourced L2 contract, the BA 100 per-product edges stay non-empty, and every
    // deferred edge / non-applicable finding is tracked. Drift in the FX lineage
    // is caught, never silent.
    "recon:fx-return-cell-lineage",
    "recon:ba320-ir-general-weighting-basis",
    "recon:rwa-computed-sourcing",
    "recon:fx-subledger-reconciliation",
    "recon:escalation-surface-parity",
    // Shared-store assertion, NOT a clean-CI gate. On a clean runner the
    // regulatory graph is unseeded and the in-repo store has no blobs, so it
    // asserts zero nodes → ok:true (intentional; pinned by
    // regulatory-golden-source-integrity-empty-graph.test.ts). The REAL
    // dangling-hash assertion runs off-pipeline on the populated shared store
    // via the scheduled tick (recon:golden-source-integrity-tick, launchd
    // com.scrooge.golden-source-integrity-tick), which escalates any missing
    // blob as SubstrateAlert{alertClass:"integrity"}.
    // Authority: D-GOLDEN-SOURCE-SHARED-STORE-ASSERTION (CEO-approved 2026-06-13).
    "recon:regulatory-golden-source-integrity",
    "recon:regulatory-source-coverage",
    "recon:regulatory-source-extract-quality",
    // WS-REGULATORY-REVIEW-MARKER (Phase 1) — review-marker freshness (advisory).
    // For each acquired direct/transposed instrument, warn if it has never been
    // reviewed or its review is stale (source re-acquired since). Advisory:
    // never fails CI; surfaces warn-severity findings.
    "recon:regulatory-review-freshness",
    // WS-V2-BBAAS S4 — advisory gate: v2 anchor store standing-data seed parity.
    // ok=true (advisory) unless store is absent; CI never fails on this alone.
    // Authority: D-V2-BBAAS-BLUEPRINT-SYNTHESIS; D-MODEL-BINDING-CONTRACT-V1.
    "recon:v2-standing-data-seed-parity",
    // WS-V2-BBAAS S10 — advisory gate: anchor migration rehearsal parity
    // (scratch-only). Asserts byte-equivalence + projection parity of a
    // scratch-migrated per-tenant store vs the source, and that the live store
    // was never written. Advisory — the live cutover is a separate gated
    // decision. Authority: D-V2-TENANCY-ARCHITECTURE.
    "recon:v2-anchor-migration-rehearsal",
  ],
};

export interface ReconTargetResult {
  readonly target: string;
  readonly exitCode: number;
  readonly passed: boolean;
  /** Short, single-line failure summary (last non-empty stderr/stdout line). */
  readonly summary: string;
}

export interface ReconSuiteReport {
  readonly results: readonly ReconTargetResult[];
  readonly passedCount: number;
  readonly failedCount: number;
  readonly failedTargets: readonly string[];
  /** True iff every target passed. */
  readonly ok: boolean;
}

/**
 * Runs a single `bun run <target>` synchronously and captures its outcome.
 * Output is streamed live to the parent's stdout/stderr so individual
 * pipeline detail is still visible, AND captured so we can extract a short
 * failure summary line for the aggregated report.
 */
function runTarget(
  target: string,
  runner: (target: string) => { status: number | null; tail: string } = defaultRunner,
): ReconTargetResult {
  const { status, tail } = runner(target);
  const exitCode = status ?? 1;
  const passed = exitCode === 0;
  return {
    target,
    exitCode,
    passed,
    summary: passed ? "" : tail || `exited ${exitCode}`,
  };
}

function defaultRunner(target: string): { status: number | null; tail: string } {
  // stdout streams straight through (inherit) so per-pipeline detail is
  // preserved in CI logs WITHOUT buffering it in memory — some pipelines
  // emit >1MB of diagnostics, and buffering all of that across a 100-step
  // suite triggered OOM/SIGTERM reaps locally. Only stderr is captured,
  // and only its tail is used for the one-line failure summary.
  const proc = spawnSync("bun", ["run", target], {
    encoding: "utf8",
    stdio: ["inherit", "inherit", "pipe"],
  });
  const stderr = proc.stderr ?? "";
  if (stderr) process.stderr.write(stderr);
  const lastLine =
    stderr
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .pop() ?? "";
  return { status: proc.status, tail: lastLine };
}

/**
 * Runs every target in `targets` regardless of individual failures, then
 * returns an aggregated report. Pure orchestration — the per-target runner
 * is injectable so tests can drive it without spawning subprocesses.
 */
export function runReconSuite(
  targets: readonly string[],
  runner?: (target: string) => { status: number | null; tail: string },
): ReconSuiteReport {
  const results: ReconTargetResult[] = [];
  for (const target of targets) {
    results.push(runTarget(target, runner));
  }
  const failed = results.filter((r) => !r.passed);
  return {
    results,
    passedCount: results.length - failed.length,
    failedCount: failed.length,
    failedTargets: failed.map((r) => r.target),
    ok: failed.length === 0,
  };
}

/** Renders the aggregated report as a multi-line string. */
export function formatReport(report: ReconSuiteReport, suiteLabel: string): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(`── recon suite [${suiteLabel}] aggregate report ──`);
  if (report.ok) {
    lines.push(`✅ ${report.passedCount} passed, 0 failed.`);
  } else {
    lines.push(
      `❌ ${report.passedCount} passed, ${report.failedCount} failed: [${report.failedTargets.join(", ")}]`,
    );
    for (const r of report.results) {
      if (!r.passed) {
        lines.push(`   • ${r.target} (exit ${r.exitCode}): ${r.summary}`);
      }
    }
  }
  return lines.join("\n");
}

/** Resolves CLI args to (label, targets). */
export function resolveTargets(argv: readonly string[]): {
  label: string;
  targets: readonly string[];
} {
  const targetsFlagIdx = argv.indexOf("--targets");
  if (targetsFlagIdx !== -1) {
    const raw = argv[targetsFlagIdx + 1];
    if (!raw) {
      throw new Error("--targets requires a comma-separated list of recon target names");
    }
    const targets = raw
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    return { label: "ad-hoc", targets };
  }
  const suiteName = argv[0];
  if (!suiteName) {
    throw new Error(
      `usage: run-recon-suite <suite-name|--targets a,b,c>; known suites: ${Object.keys(RECON_SUITES).join(", ")}`,
    );
  }
  const suite = RECON_SUITES[suiteName];
  if (!suite) {
    throw new Error(
      `unknown recon suite "${suiteName}"; known suites: ${Object.keys(RECON_SUITES).join(", ")}`,
    );
  }
  return { label: suiteName, targets: suite };
}

if (import.meta.main) {
  const { label, targets } = resolveTargets(process.argv.slice(2));
  const report = runReconSuite(targets);
  process.stdout.write(`${formatReport(report, label)}\n`);
  process.exit(report.ok ? 0 : 1);
}
