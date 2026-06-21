# Capital as a first-class V2-native FIL asset class — D-CAPITAL-ASSET-CLASS-V1

**Author:** Bea (Accounting & financial reporting engineer, engineering) · reports to Camille (Chief Financial Officer, governance)
**Authority:** `D-CAPITAL-ASSET-CLASS-V1` (CEO-approved 2026-06-21)
**Date:** 2026-06-21
**Workstream:** WS-CAPITAL-ASSET-CLASS

---

## 1. What was built

Capital — the bank's **own qualifying regulatory capital** (CET1 / AT1 / Tier 2) — is now a first-class, **V2-native** FIL (Financial Instrument Ledger) asset class, mirroring the proven Cash (`D-CASH-ASSET-CLASS-V1`, PR #1421) and FX (PR #1431) patterns. It is born-V2: no new V1 dependency, no `GlPostingEmitted` per capital event, accounting computed as a pure fold.

| Layer | Artefact |
|---|---|
| Taxonomy | `"capital"` added to `FIL_ASSET_CLASSES` (`v2-core/fil-core/taxonomy.ts`) + `filSaCcrAssetClassSchema` |
| Qualifying-capital dimension | `filQualifyingCapitalSchema` (tier + sub-category) on `FilEconomicTerms` (`v2-core/fil-instances/events.ts`); optional + append-only-safe |
| FIL type family | `v2-core/fil-models/capital/` — `fil:type:capital:instrument:vanilla@1.0`, lifecycle, Accountable+Reportable model |
| Chart of accounts | `ACC-5000-003` (CET1 Share Premium), `ACC-5000-004` (CET1 OCI reserve), `ACC-5050-001` (AT1 instruments); Tier 2 `ACC-5200-001/002` verified |
| Posting rules | `v2-core/posting-rules/capital.ts` — `PR-CAP-ISSUE-001-V2` / `PR-CAP-ADJUST-002-V2` / `PR-CAP-REDEEM-003-V2` (pure fold-native leg fns) + registry entries |
| Treatment modules | `v2-core/reporting-treatments/capital-modules.ts` — 4 modules scoped `fil:type:capital:*` |
| BA-700 composition fold | `platform/projections/ba700-capital-composition.ts` — own-funds composition; wired into `ba700-v2.ts` as the capital numerator source |
| Recon gate | `recon:capital-materialisation-integrity` (`platform/recon/capital-materialisation-integrity.ts`) |
| Simulation | `scripts/emit-capital-injection-v2-sim.ts` — R300m CET1 injection, wired into `ci:migrate` |

## 2. The capital-tier model

A capital FIL instance carries a typed `qualifyingCapital` dimension on its economic terms:

- **tier** ∈ `{cet1, at1, t2}` (reuses `CoaCapitalTier`; Basel III / Reg 38(8) three-tier partition)
- **sub-category** (closed set, CAP definition-of-capital components):
  - CET1: `cet1.paid-up-ordinary-shares`, `cet1.share-premium`, `cet1.retained-earnings`, `cet1.oci-reserve`
  - AT1: `at1.perpetual-noncumulative`
  - Tier 2: `t2.subordinated-debt`, `t2.qualifying-general-provisions`

Tier↔sub-category coherence is enforced (`capitalSubCategoryMatchesTier`): a `cet1.*` sub-category may only sit under tier `cet1`, fail-closed at parse + at posting + in recon.

**Composition rollups** (the BA-700 / BA-100 own-funds numerator): Tier 1 = CET1 + AT1; Total own funds = Tier 1 + Tier 2.

**Accounting classification:** CET1 paid-up shares / premium are IAS 32 §22 equity held at proceeds (not remeasured); liability-classified AT1 / Tier 2 are IFRS 9 §4.2.1 amortised cost. Capital is the capital-adequacy **numerator** — it is NOT a Valuable / RiskMeasurable market exposure (the deliberate difference from the Cash model).

## 3. Regulatory citations (sourced, not hardcoded)

Verified against the in-corpus primary text:

- `urn:reg:za:regs-relating-to-banks:reg38` — Regulation 38 (capital adequacy & leverage; qualifying capital CET1/AT1/T2; minimum ratios)
- `urn:reg:za:banks-act-94-1990:s70` — Banks Act 94 of 1990 §70(2)/(2A)/(2B) (minimum capital and reserve funds)
- `urn:reg:bcbs:rbc:20.2` — CET1 ≥ 4.5%, Tier 1 ≥ 6.0%, Total ≥ 8.0% of RWA (BCBS RBC; CAP defines the numerator)
- `urn:reg:bcbs:rbc:30.2` — capital conservation buffer 2.5% (CET1-met)
- `D5/2025 §2.1.3` — SARB PA Directive: Form **BA 100** capital-adequacy return (Annexure 2A/2B). The verbatim Reg 38 text still embeds the GG-era number **BA 700**; same obligation, two form numbers.
- Obligations: `ORG-PR-01` (maintain capital adequacy CET1/AT1/T2), `ORG-PR-RETURNS-002` (BA 100 capital-adequacy return); owner CFO.

## 4. Fold wiring

`ba700-v2.ts` previously folded `GlPostingEmitted` for capital accounts and **always got zero** (no capital GL rules existed — GAP-3E-001). The capital numerator is now derived **fold-native** from the capital FIL instruments via `computeCapitalComposition` — resolving GAP-3E-001. No `GlPostingEmitted` is stored on the capital read path (`D-ACCT-MODULAR-PRODUCT-COMPOSED-FOLD`).

The fold: capital FIL events → `postCapitalIssuanceLegs` / `postCapitalRedemptionLegs` (own-funds CREDIT leg per tier, settlement-cash DEBIT leg) → sum the own-funds legs per tier → composition. The settlement-cash (nostro) leg is excluded from own funds by account-block predicate.

## 5. Simulation result — R300,000,000 CET1 injection

`scripts/emit-capital-injection-v2-sim.ts` emits ONE `FilInstrumentCreated` for a R300,000,000 CET1 paid-up ordinary share-capital subscription (tier `cet1`, sub-category `cet1.paid-up-ordinary-shares`, entity `LE-ZA-HOZ-BANK`, currency ZAR, `provenance.kind:"simulated"`, fixed asOf, idempotent id). It emits into both the main canonical store (read by `computeBA700V2`) and the v2-anchor store (read by the recon gate).

**Accounting fold derives:**
```
Dr ACC-1200-001 (ZAR Nostro — settlement cash)   R300,000,000
Cr ACC-5000-001 (Share Capital — CET1)           R300,000,000   (balanced)
```

**BA-700 capital-composition fold derives** (from the actual anchor store):
```
CET1             : R300,000,000
AT1              : R0
Tier 2           : R0
Tier 1 (CET1+AT1): R300,000,000
Total own funds  : R300,000,000
```

> "Capital injection" = CET1 paid-up ordinary share capital (the natural reading + the existing sim basis). The design also supports AT1 / Tier 2 issuance — only the simulated instance is CET1.

## 6. Verification (Definition of Done)

- `tsc --noEmit` (full project) — clean
- `bun run lint` (biome) — clean
- 15 new tests pass (composition fold incl. the R300m demonstration; recon gate)
- `recon:capital-materialisation-integrity` — OK non-vacuous (1 capital instance)
- `recon:accounting-schema-home` — 9 asserted, 0 violations (extended to assert capital treatment-module posting-rule references resolve)
- `recon:v2-no-v1-import` — 0 violations
- `recon:v1-removal-ratchet` — HELD at 286 (no new v1-only type)
- `citation-gate` — 0 violations
- recon suites on a clean store: infra 85/0, domain 149/0

## 7. Substrate gaps surfaced (tracked, Charter cmd 5 — not hidden)

1. **Capital redemption proceeds leg** — `FilInstrumentTerminated` carries no economic terms, so a bare terminal posts a zero-amount memo. A proper redemption/call reverses the prior recognition + posts the cash proceeds; needs a richer FIL terminal event (mirrors the FX `PR-FX-CLOSE-V2` history). Tracked in `posting-rules/capital.ts` + registry `PR-CAP-REDEEM-003-V2`.
2. **Tier 2 amortisation** — `PR-CAP-ADJUST-002-V2` (`FilInstrumentAmended`) has no straight-line amortisation arithmetic yet (qualifying Tier 2 amortises in its last 5 years, BCBS CAP). Tracked in the registry conditionDetail.
3. **CET1 distributions** — dividends on CET1 are an IAS 32 §35 equity charge in the retained-earnings fold, not a capital-instrument posting; out of scope of the atomic issuance rule.
4. **Cross-currency own funds** — the composition reports in the functional currency; a leg in another currency is excluded (licence-day refinement; build-phase anchor capital is ZAR).
5. **CapitalMetrics tile V2 promotion** — the BA-700 V2 output shape differs from the dashboard CapitalMetrics tile; a CapitalMetrics-shaped V2 adapter + real capital (licence-day) are needed before the tile flips off V1 (`dashboard-v2-coverage` note refreshed).
6. **Production capital is zero in the build phase** — the only capital instrument is the simulated R300m, which the production provenance filter correctly excludes; real capital lands at licence-day.
