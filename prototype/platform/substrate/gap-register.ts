// platform/substrate/gap-register.ts
//
// Canonical typed register of the engineering substrate's known gaps.
//
// Previously these lived as a curated `KNOWN_SUBSTRATE_GAPS: string[]` inside
// `runtime/agents/atlas-substrate-state.ts`, with severity / status /
// mitigation re-derived every run by regex over the prose. That coupled the
// classification to keyword accidents and hid it from any other consumer.
//
// This register is the single canonical source (Principle 2): each gap carries
// a stable `id` and EXPLICIT severity / status / mitigation. Atlas's
// substrate-state handler folds it into the `SubstrateStateSnapshot.gaps[]`
// inventory + per-gap WorkstreamRegistered events. Substrate gaps are forward
// engineering work, NOT risk-register findings (WS-RISK-REGISTER-CLOSURE) —
// `severity` here is a planning heuristic (blast radius), not a risk-appetite
// measure.
//
// Author: Atlas (Core banking platform architect, engineering)

/** Planning-severity of a substrate gap — blast radius, not risk appetite. */
export type SubstrateGapSeverity = "medium" | "high";
/**
 * Lifecycle status of the engineering work that closes the gap.
 *   - "planned"   — work identified, not started.
 *   - "in-flight" — work underway.
 *   - "resolved"  — the gap is CLOSED; the substrate now exists. The record is
 *                   RETAINED (not deleted) for audit lineage — `closedBy` cites
 *                   the closing event/decision. Resolved gaps are filtered out
 *                   of the OPEN-gap inventory (they are no longer gaps).
 */
export type SubstrateGapStatus = "planned" | "in-flight" | "resolved";
/** Whether an interim mitigation is in place while the gap is open. */
export type SubstrateGapMitigation = "none" | "partial";

/** One row in the canonical substrate-gap register. */
export interface SubstrateGapRecord {
  /** Stable kebab-case identifier — survives reordering of the register. */
  readonly id: string;
  /** Short human title. */
  readonly title: string;
  /** Full prose: what the gap is, its dependency, and the closing plan. */
  readonly description: string;
  readonly severity: SubstrateGapSeverity;
  readonly status: SubstrateGapStatus;
  readonly mitigation: SubstrateGapMitigation;
  /**
   * When `status === "resolved"`: the closing event type / Decision / PR that
   * closed the gap (Principle 1 — the closure cites its evidence). Absent on
   * open gaps.
   */
  readonly closedBy?: string;
}

export const SUBSTRATE_GAP_REGISTER: readonly SubstrateGapRecord[] = [
  {
    id: "event-store-cloud-shared",
    title: "Event store cloud-shared via Neon Postgres",
    description:
      "Event store: cloud-shared via Neon Postgres (`BANK_EVENT_DB_URL`); local sqlite remains canonical-shape on every host. Bidirectional sync runs before/after every agent workflow via `bun run event-store:sync`. Senna threat model APPROVED for build-phase use under exception `TM-NEON-EVENT-STORE-001` (Owen's substrate-exception register). Hardening conditions §5.1 (role downgrade to SELECT+INSERT) and §5.2 (IP allowlist) deferred while events remain non-sensitive; required before any sensitive-data event flows. M8 cloud lift swaps Neon for Neon-on-Azure or Azure Postgres without code change.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "typed-event-payload-schemas",
    title: "Typed event-payload schemas + risk closure family",
    description:
      "Typed event-payload schemas: AgentEscalation, AgentDecision, WorkstreamRegistered, RiskRaised + closure family (RiskResolved / RiskAccepted / RiskMitigated) — DEFINED in `platform/event-store/event-types/risk.ts` + `.../event-types.ts` with Zod payload schemas and typed `make<Type>` factories. Substrate gaps surface on the SubstrateStateSnapshot `gaps[]` status inventory + per-gap WorkstreamRegistered events; they are NOT risk-register findings, so Atlas no longer emits RiskRaised for them (WS-RISK-REGISTER-CLOSURE). The closure family lets goal-loops resolve a risk register by riskId pairing. Vera's audit pipelines #14/#15 and the dashboard's curated-seed retirement now have substrate to consume.",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "runtime-trigger-kinds",
    title: "Runtime trigger kinds (scheduled / event-driven / on-request)",
    description:
      "Runtime trigger kinds: scheduled, event-driven, and on-request are all first-class in `runtime/run.ts`. Event-driven dispatch fans out in-process from a parent run when the parent appended an event type a downstream handler subscribes to; cross-process / cross-workflow event-bus is M8 cloud-lift work. On-request handlers are dispatched via `bun run agent:<slug>` or workflow_dispatch with no schedule (first example: `mira:citation-gate`).",
    severity: "high",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "claude-api-narrative",
    title: "Claude API integration for agent-narrative output",
    description:
      "Claude API integration for agent-narrative output: ROLLED OUT. All seven runtime handlers (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge) call `tryGenerateNarrative` after their mechanical pass. Each has a stable persona-grounded system prompt cached as the prefix; per-run state is the volatile suffix. Requires ANTHROPIC_API_KEY in the host env or GitHub Actions secret; runs degrade gracefully when unset.",
    severity: "medium",
    status: "in-flight",
    mitigation: "partial",
  },
  {
    id: "projection-cache-persistence",
    title: "Projection-cache persistence via anya:projection-refresh",
    description:
      "Projection-cache persistence: closed by `anya:projection-refresh`, an event-driven handler subscribed to SubstrateStateSnapshot / WorkstreamRegistered / WorkstreamCompleted / CeoDecision. Re-derives the dashboard projection from canonical sources + the live event store and writes it to the runtime cache `prototype/.local/dashboard-state.json` (gitignored). D-EVENT-STORE-SCALING Slice 3a (PR #138, 2026-05-10) split this runtime path off the previously-committed seed; Slice 3b (same day) removed the seed from the commit graph entirely — the recon harness now derives + asserts internal consistency at recon time rather than comparing against a stored cache.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "citation-gate-wrapper",
    title: "Citation gate wrapped as mira:citation-gate",
    description:
      "Citation gate: now wrapped as `mira:citation-gate` (on-request). Walks the event store, emits `CitationGatePassed` / `CitationGateFailed` and one `AuditFinding` per missing-citation event. Workflow at `.github/workflows/agent-runtime-mira-citation-gate.yml` (workflow_dispatch only — the gate is also still part of the `ci` script for synchronous CI verification).",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "github-actions-cron",
    title: "GitHub Actions cron unreliability (A2.1 scheduler)",
    description:
      "GitHub Actions cron unreliability — interim substrate. GH Actions silently dropped Anya 03:00 UTC + Scrooge 04:00 UTC daily slots overnight 2026-05-07/08; Vera 02:00 UTC fired 2h46m late. All ten scheduled workflows re-pinned 2026-05-08 to off-the-hour distinct minutes (Vera 02:13, Anya 03:17, Scrooge 04:27, Helena 04:30, Devon Mon 05:23, Zara Mon 05:30, Atlas Mon 06:19, Owen Tue 07:31, Mira Wed 07:29, Senna Thu 07:37). Permanent fix is A2.1 — substrate scheduler emitting typed `ScheduledTrigger` events from a Bun process — at which point cron files become thin shims or retire entirely.",
    severity: "medium",
    status: "planned",
    mitigation: "none",
  },
  // ---------------------------------------------------------------------------
  // Legacy product re-NPA backlog (D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION,
  // CEO-approved 2026-06-18). Five products approved 2026-05-26..28 under the
  // superseded 14-dimension gate policy were withdrawn via ProductWithheld
  // (scripts/withdraw-legacy-superseded-products.ts). Each must be re-run
  // through a clean 15-dimension NPA cycle (the FX-OTC pattern, per
  // platform/markets/products/fx-otc-vanilla-npa-cycle.ts) once the per-product
  // substrate is ready. Tracked here so the re-NPA work is never silently
  // dropped (Engineering Charter: no silent deferral). Trigger for every entry:
  // "substrate ready → clean NPA cycle".
  // ---------------------------------------------------------------------------
  {
    id: "re-npa-jse-equity-cash",
    title: "Re-run clean NPA cycle — prd:bank:equity:jse-equity-cash",
    description:
      "prd:bank:equity:jse-equity-cash (JSE listed cash equity, M1) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle (incl. data-quality dimension, no design-attested-without-tracked-gaps) before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-sagb-fixed-coupon",
    title: "Re-run clean NPA cycle — prd:bank:bond:sagb-fixed-coupon",
    description:
      "prd:bank:bond:sagb-fixed-coupon (SAGB fixed-coupon bond) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-open-repo-gmra",
    title: "Re-run clean NPA cycle — prd:bank:bond:open-repo-gmra",
    description:
      "prd:bank:bond:open-repo-gmra (open repo under GMRA) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-vanilla-zar-fix-zaronia",
    title: "Re-run clean NPA cycle — prd:bank:ird:vanilla-zar-fix-zaronia",
    description:
      "prd:bank:ird:vanilla-zar-fix-zaronia (vanilla ZAR fixed-vs-ZARONIA IRS) was approved 2026-05-26 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-repo-sagb-term",
    title: "Re-run clean NPA cycle — prd:bank:treasury:repo-sagb-term",
    description:
      "prd:bank:treasury:repo-sagb-term (SAGB-backed term repo, M5) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-mmd-deposit",
    title: "Re-run clean NPA cycle — prd:bank:treasury:mmd-deposit",
    description:
      "prd:bank:treasury:mmd-deposit (Money Market Deposit, M6) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  {
    id: "re-npa-funding-line",
    title: "Re-run clean NPA cycle — prd:bank:treasury:funding-line",
    description:
      "prd:bank:treasury:funding-line (Committed Funding Line, M7) was approved 2026-05-28 under the superseded 14-dimension gate policy and withdrawn via ProductWithheld under D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION. Must be re-run through a clean 15-dimension NPA cycle before re-approval. Trigger: substrate ready → clean NPA cycle. Authority: D-LEGACY-PRODUCT-APPROVAL-SUPERSESSION; D-NPA-GATE-POLICY-REDESIGN.",
    severity: "high",
    status: "planned",
    mitigation: "none",
  },
  // ---------------------------------------------------------------------------
  // BA-return filing-lifecycle gap (no silent deferral — Engineering Charter #5).
  // Surfaced while wiring the V2 Finance → Regulatory-Returns register page
  // (brief:mira:wire-ba-returns-register-onto-v2-finance-regulat:2026-06-20):
  // the register shows what each return IS and (for BA 700 / BA 320) its live
  // figure, but the page CANNOT show "last filed" / "reporting period" /
  // "overdue" because there is no filing-lifecycle event in the substrate. The
  // page renders those columns "—" / "N/A" (never fabricated); this register
  // entry is the tracked obligation to build the event family.
  // ---------------------------------------------------------------------------
  {
    id: "ba-returns-filing-lifecycle",
    title: "BA-return filing-lifecycle event family (ReportFiled / ReportDue)",
    description:
      "RESOLVED (D-BA-RETURN-OF-RECORD-EVENT-FAMILY): the born-V2 filing-lifecycle event family now exists — ReportGenerated (return-of-record: attestable figures + BLAKE3 content hash) + ReportDue / ReportFiled / ReportSubmissionAcknowledged. The BA 700 period-close handler (bea:ba700-period-close) emits ReportGenerated + ReportFiled on every AccountingPeriodClosed (idempotent). The V2 Finance Regulatory-Returns page (GET /api/v2/finance/returns) folds these events for reporting-period / last-filed / overdue instead of rendering '—' / 'N/A'. Authority: D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1. Originally tracked under D-BANK-WIDE-V2-MIGRATION; brief:mira:wire-ba-returns-register-onto-v2-finance-regulat:2026-06-20.",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy: "ReportGenerated/ReportFiled (D-BA-RETURN-OF-RECORD-EVENT-FAMILY)",
  },
  // ---------------------------------------------------------------------------
  // RESOLVED (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE): the full rendered return
  // blob is now filed into the RMS content-addressed document store.
  // ---------------------------------------------------------------------------
  {
    id: "ba-return-of-record-document-store",
    title: "BA-return rendered-artefact into RMS document store (RecordFiled)",
    description:
      "RESOLVED (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE): the FULL rendered BA 700 return artefact (the SARB XML envelope) is now filed into the RMS content-addressed document store via a RecordFiled{registerKey:'documents'} event on every period-close (fileBa700ReturnArtefact in platform/returns/ba700/report-of-record.ts). The envelope is rendered from the SAME generator output already attested by ReportGenerated (renderBa700Envelope; NOT re-derived). HASH-LINKAGE: the RecordFiled records the envelope's OWN document-store hash as documentHash (NOT equal to ReportGenerated.contentHash — the two hash different bytes; the contentHash is over the attestable figures, replay-stable, while the envelope hash is over the rendered XML and embeds incidental per-store ids), and references the ReportGenerated by event id + attestable contentHash in its citations — linkage by reference, not hash-equality. Filing is idempotent at both the blob layer (content-addressing) and the event layer (per entity+form+period). Read-path-store-aware recon: recon:ba700-document-store-completeness asserts every closed-period BA 700 return-of-record has a filed artefact whose blob resolves in the store the reader actually reads (home-default-ENABLED, NOT the excludeHomeDefault singleton). Authority: D-BA-RETURN-OF-RECORD-DOCUMENT-STORE; D-BA-RETURN-OF-RECORD-EVENT-FAMILY; D-RMS-PHASE-1.",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy: "RecordFiled rendered-envelope filing (D-BA-RETURN-OF-RECORD-DOCUMENT-STORE)",
  },
  // ---------------------------------------------------------------------------
  // IAS 21 oracle coverage (D-FX-IFRS-REVIEW-FOUNDATION, F9). The IAS-21 domain-
  // truth oracle (Regulations/INTL/IASB/source-docs/ias-21-structured.json) the
  // FX-vanilla review validates against ingests the FX-vanilla-bearing paragraphs:
  // RESOLVED (FX-vanilla full-closure tail, 2026-06-26). The oracle now ingests
  // the full FX-vanilla-bearing set §8, §15, §15A, §20–§23, §25, §26, §28–§30, §32,
  // §33, §48 — every paragraph this gap previously named as un-ingested (§15A net-
  // investment monetary-item holder; §25 carrying-amount-by-comparison; §26 several-
  // rates / temporary-non-exchangeability; §33 where the net-investment difference
  // arises; §48 reclassification on disposal) is now in ias-21-structured.json,
  // verbatim. Nothing FX-vanilla-relevant remains un-ingested, so the gap is CLOSED
  // (not merely narrowed). The only IAS 21 material deliberately still excluded is
  // the translation-to-a-presentation-currency machinery §38–§47 and §49–§57, which
  // is a CONSOLIDATION concern (presentation currency ≠ functional currency), not an
  // FX trading-book treatment — it sits in a SEPARATE, not-yet-opened scope, never a
  // blind spot of the FX-vanilla oracle. Full IAS 21 text is © IFRS Foundation; the
  // licence-day procurement obligation is tracked separately (file-ias-21-licensing-
  // flag), independent of this coverage gap.
  // ---------------------------------------------------------------------------
  {
    id: "ias21-oracle-coverage",
    title: "IAS 21 oracle: §15A/§25/§26/§33/§48 ingested — FX-vanilla coverage complete",
    description:
      "RESOLVED (2026-06-26, FX-vanilla full-closure). The IAS-21 domain-truth oracle now ingests the complete FX-vanilla-bearing set (§8, §15, §15A, §20–§23, §25, §26, §28–§30, §32, §33, §48) in Regulations/INTL/IASB/source-docs/ias-21-structured.json, verbatim. The previously-named tail — §15A (net-investment monetary-item holder), §25 (carrying-amount-by-comparison), §26 (several rates / temporary non-exchangeability), §33 (where the net-investment difference arises), §48 (reclassification on disposal) — is fully ingested. Nothing FX-vanilla-relevant is un-ingested. The translation-to-a-presentation-currency paragraphs (§38–§47, §49–§57) remain out of scope by design — they are a CONSOLIDATION concern (presentation ≠ functional currency), not an FX trading-book treatment, and belong to a separate not-yet-opened scope rather than a blind spot of this oracle. The golden-case test header (fx-ifrs-golden-cases.test.ts) is updated to record the closed coverage. Full IAS 21 text is © IFRS Foundation; the licence-day procurement obligation is tracked separately. Authority: D-FX-IFRS-REVIEW-FOUNDATION (F9).",
    severity: "medium",
    status: "resolved",
    mitigation: "none",
    closedBy:
      "FX-vanilla full-closure run (D-FX-IFRS-REVIEW-FOUNDATION F9); ias-21-structured.json §15/§15A/§25/§26/§33/§48 ingestion.",
  },
  {
    id: "ba320-ir-sim-gl",
    title: "BA 320 IR risk class: live simulated trading-book bond seed deferred",
    description:
      "The simulator-first trading book (D-BA-RETURN-SIMULATOR-FIRST Phase 1; scripts/sim/seed-trading-book-sim-v1.ts) seeds live SIMULATED equity + commodity trading-book positions that drive the BA 320 equity + commodity risk classes (the classes that previously folded to zero — no event stream fed them). It does NOT seed a live simulated BondTradeExecuted for the INTEREST-RATE risk class, because every live BondTradeExecuted requires its matching V1 SubLedgerPostingEmitted (posting rule PR-BOND-001) or recon:gl-ledger-coverage flags an uncovered lifecycle — seeding a live sim bond would drag the whole bond GL-posting chain into this slice. The IR risk class is ALREADY driven by the existing ba-320-bond-events-adapter / ba-320-irs-events-adapter (which filter portfolio === 'trading-book'); the brief's IR scope ('ensure trading-book designation') is honoured and PROVEN end-to-end against the Reg 28(3)(a) Table A oracle by platform/returns/ba320/trading-book-sim-golden.test.ts (R100m SA-gov @ 5-7y → R3,250,000; banking-book excluded) using an in-memory store. The live IR sim seed (a simulated trading-book bond WITH its GL postings on the sim path) is the named follow-on. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5 (no silent deferral).",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba325-irc-engine",
    title: "BA 325 IMA Incremental Risk Charge (IRC): no engine",
    description:
      "BA 325 (Selected Risk Exposure — Trading & Treasury) carries an internal-models-approach IRC column (C0040 on rows R0240/R0250/R0260/R0290). The bank has NO incremental-risk-charge engine — IRC requires a default + migration-risk model (a 1-year, 99.9% measure over the trading-book credit positions; Basel-2.5 MAR / BCBS d352 §718(xcvi)+) that the build-phase substrate does not implement. BA 325 Phase 2a (D-BA-RETURN-SIMULATOR-FIRST) ASSEMBLES the summary from the BA 320 / BA 300 LCR / SA-CCR / cohort-VaR folds; the IRC cells are surfaced as an explicit `absent` (reasoned, gap-tracked) — NOT a silent zero and NOT an overclaimed fold (the original BA 325 audit finding was an overclaimed fold). The IRC engine is the named follow-on, gated behind a real trading-book credit-position substrate. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5 (no silent deferral); Reg 28; BCBS d352 §718.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba325-sarb-repo-liquidity",
    title: "BA 325 SARB-repo-participation liquidity summary: no fold",
    description:
      "BA 325 carries a SARB-repo-participation liquidity summary (R0110 repo participation; R0120 liquid assets held on preceding day; R0130 month-to-date average held; R0140 requirement). This is a TREASURY banking-book liquidity line — none of the four BA 325 source folds (BA 320 market-risk, BA 300 LCR, SA-CCR, cohort VaR) derives it. BA 325 Phase 2a surfaces R0110 as an explicit `absent` (gap-tracked) rather than a silent zero. The repo-participation fold (preceding-day liquid-asset stock + SARB repo facility participation) is the named follow-on; it shares substrate with the BA 300 / BA 310 minimum-reserve liquidity folds. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5; Reg 29 (daily selected-risk: trading & treasury).",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba325-reg29-fx-residency-detail",
    title: "BA 325 reg-29 foreign-currency residency-segmented detail block: no fold",
    description:
      "BA 325 carries a large reg-29(3) foreign-currency detail block (R0360–R0790): foreign-currency assets and liabilities, commitments to buy/sell, and the effective net-open-foreign-currency position, all segmented by counterparty RESIDENCY (residents / non-residents / authorised dealers / SARB) — ~430 cells. The AGGREGATE effective NOP (R0750) is driveable from the BA 320 FX sub-fold's net-open-position basis, but the by-residency / by-counterparty gross-detail segmentation is NOT folded — it requires a counterparty-residency-tagged FX position fold the build-phase substrate does not implement. BA 325 Phase 2a leaves this block licence-day-gated (residency-segmented detail only exists with real counterparties at licence-day) and tracks the missing fold here. The residency-segmented FX detail fold is the named follow-on. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5; Reg 29(3).",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // BA 350 (Derivatives Instruments) — Phase 2b (D-BA-RETURN-SIMULATOR-FIRST).
  // The aggregate inventory backbone (asset-class × book × venue × instrument-
  // type × maturity-band notional + fair value) IS folded and oracle-validated;
  // what is deferred is the exhaustive leaf-cell row-number mapping of the
  // ~1000-cell maturity ladder. The DATA exists in the fold; only the
  // presentation-row enumeration is deferred — tracked here, not silently zeroed.
  // ---------------------------------------------------------------------------
  {
    id: "ba350-maturity-ladder-cell-mapping",
    title: "BA 350 maturity-ladder leaf-cell row-number mapping: deferred (data folded)",
    description:
      "BA 350 (Derivatives Instruments) is a notional + fair-value inventory grid. Phase 2b (D-BA-RETURN-SIMULATOR-FIRST) folds the derivative book (born-V2 DerivativeTradingPositionOpened; scripts/sim/seed-derivative-book-sim-v1.ts) into the BA 350 inventory (platform/reporting/ba-350-derivatives-fold.ts) carrying every grid axis — asset class, ETD/OTC venue, instrument type, maturity band, trading/banking book — and the cell-assembly (platform/returns/ba350/ba-350-derivatives.ts) drives the BACKBONE cells (per-asset-class × per-book notional + net/positive/negative fair value, ETD/OTC venue split, credit-derivative Section 2, grand-total hash-totals) to oracle-validated NON-ZERO figures. The fine-grained ~1000-leaf maturity-ladder detail rows (R0250–R0790: each instrument-type × maturity-band leaf cell) are a PRESENTATION EXPANSION of the same folded inventory — the fold already carries instrumentType + maturityBand, so the data EXISTS; only the exhaustive leaf-cell row-number enumeration onto the xlsx-derived contract grid is deferred. It is a mechanical mapping follow-on, gated on nothing (no missing engine). Surfaced as a tracked gap on the assembled BA 350 output's gaps[] — never a silent zero. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5; Reg 28 / Reg 30.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba340-internal-models-approach-engine",
    title: "BA 340 internal-models / market-based approach for banking-book equity: no engine",
    description:
      "BA 340 (Equity Risk in the Banking Book) reports the capital held against banking-book equity (strategic / held-to-collect investments). Phase 2c (D-BA-RETURN-SIMULATOR-FIRST) builds the SIMPLE RISK-WEIGHT method engine (SARB Reg 31(6)(b)(i), Table 1: 300% publicly-traded / 400% other; Reg 38 8% min ratio) — the fold (platform/reporting/ba-340-equity-risk-banking-book.ts) + cell-assembly (platform/returns/ba340/ba-340-equity-risk-banking-book.ts) drive the per-holding-class exposure → risk-weighted exposure → capital cells to oracle-validated NON-ZERO figures over a simulated banking-book equity book (scripts/sim/seed-banking-book-equity-sim-v1.ts). The ALTERNATIVE column — the internal-models / market-based approach (Reg 31(6)(b)(ii); BA 340 R0060–R0080) — is NOT implemented: it requires a PD/LGD market-based equity model the build-phase substrate does not yet have. It is surfaced as an explicit `absent` on the assembled BA 340 output's IMA section + tracked here — never a silent zero, never an overclaimed fold. A bank using the simple risk-weight method (the conservative default, the build-phase choice) does not file the IMA column; the engine is a future-product follow-on if the bank ever adopts the market-based approach. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5; Reg 31 / Reg 38; Basel CRE.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // Cohort-VaR provenance filtering (surfaced by BA 325 Phase 2a, tracked by
  // Phase 2b — D-BA-RETURN-SIMULATOR-FIRST). The cohort VaR engine relies on
  // STORE SEPARATION, not provenance FILTERING, so a canonical store that ever
  // held a simulated FIL instrument would compute VaR over it. The fix is a
  // separate FX-V2-simulator hardening, OUT of scope for the BA 350 / CVA slice.
  // ---------------------------------------------------------------------------
  {
    id: "cohort-var-provenance-filter",
    title: "Cohort VaR engine not provenance-filtered (relies on store separation)",
    description:
      "The cohort VaR engine (platform/market-risk/eod-cohort-var-v2.ts, computeCohortVar) derives FX exposures by replaying FIL-instrument lifecycle events from the supplied event store WITHOUT applying a provenance filter — it relies on STORE SEPARATION (the production canonical store and the simulated store are physically distinct files) rather than provenance FILTERING within a store. BA 325 Phase 2a's provenance-boundary proof works by passing an EMPTY production store for the production leg (so 'no-positions'); it does NOT prove the engine would exclude a simulated FIL instrument if one were ever present in the production canonical store. If a simulated FIL instrument ever leaked into the production store (the same class of regression as the R300m-into-Prod incident, D-V2-UI-VISIBILITY-REMEDIATION), computeCohortVar would silently compute VaR over it — a production figure contaminated by simulated positions. The correct fix is to thread a ProvenanceFilter through deriveCohortFxExposures / computeCohortVar (the same filter the BA 320 / BA 350 folds apply) so the production read fails closed regardless of store contents. This is a FX-V2-simulator hardening tracked as a named follow-on; it is OUT of scope for the BA 350 + CVA slice (which only consumes the engine via the empty-store production leg, already correct under store separation). Authority: D-BA-RETURN-SIMULATOR-FIRST; D-FX-V2-SIMULATOR-FIRST; D-PROVENANCE-FILTER-ENFORCEMENT; Engineering Charter cmd 5 (no silent deferral).",
    severity: "high",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // Deposit/funding/HQLA simulator-first slice (D-BA-RETURN-SIMULATOR-FIRST).
  // Three named follow-ons surfaced by the slice — never silent.
  // ---------------------------------------------------------------------------
  {
    id: "ba310-l1-breakdown-by-type",
    title: "BA 310 held level-1 liquid-asset BREAKDOWN by instrument type: aggregate only",
    description:
      "BA 310 (Minimum Liquid Reserve Balance and Liquid Assets) is built by the deposit/funding simulator-first slice (D-BA-RETURN-SIMULATOR-FIRST): the fold (platform/reporting/ba-310-min-reserve.ts) drives the DERIVATION-CHAIN rows (R0010 liabilities base → R0040 reduced → R0090 adjusted → R0100 minimum reserve balance ×2.5% → R0140 level-1 required ×5% → R0150 level-1 held) to an oracle-validated figure over a simulated deposit/funding/HQLA book. R0150 (held level-1 stock) is sourced as an AGGREGATE from the CollateralInventorySnapshotted L1 tier. The granular BREAKDOWN rows (R0160 Reserve Bank notes/coin, R0170 gold, R0180 central-bank reserves, R0190 treasury bills, R0200 sec-66 PFMA securities, R0210 SARB securities, R0220 guaranteed securities, R0230 other) are NOT decomposed — the single-aggregate L1 snapshot carries one number, not a per-instrument-type split. Closing this needs a per-instrument-type HQLA fold (the SecurityMaster × unified-position path used by hqla-stock.ts, tagged with the BA-310 level-1 sub-type) rather than the aggregate snapshot. Those rows stay licence-day-data with their existing reason — never a fabricated split. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5; Reg 27.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba300-lcr-nsfr-granular-cell-mapping",
    title: "BA 300 LCR/NSFR granular published-schedule cell mapping: aggregate-ratio proven",
    description:
      "The BA 300 LCR (platform/reporting/ba-300-lcr.ts + platform/liquidity/lcr.ts) and NSFR (platform/reporting/ba-300-nsfr.ts + platform/liquidity/nsfr.ts) engines are DRIVEN + PROVEN at the AGGREGATE-ratio level by the deposit/funding simulator-first slice (D-BA-RETURN-SIMULATOR-FIRST): a simulated deposit/funding/HQLA book (scripts/sim/seed-deposit-funding-book-sim-v1.ts) drives HQLA total / net cash outflows / LCR ratio and ASF/RSF totals / NSFR ratio to hand-computed BCBS D238 / BCBS 295 / Reg 26 / Reg 26A oracles (recon:ba300-deposit-funding-sim-drive; deposit-funding-sim-golden.test.ts). However the BA 300 PUBLISHED CONTRACT (ba300-contract.json) is a 1,500+-cell granular per-counterparty / per-collateral-type / per-run-off-bucket schedule. The simulated book + the aggregate LCR/NSFR engines do NOT populate that schedule cell-by-cell — the book exercises the run-off buckets and ASF/RSF bands at the AGGREGATE level, not every published leaf line. Stamping the granular BA 300 cells 'driven' would be an overclaim, so they are deliberately NOT reclassified by this slice (they stay licence-day-data with their existing reason). Closing this needs the aggregate-ratio→granular-published-cell expansion mapping (the same class of work as ba350-maturity-ladder-cell-mapping) — a mechanical presentation follow-on gated on the published-schedule line enumeration, not on a missing engine. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5 (no overclaim); Reg 26 / Reg 26A.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba300-deposit-funding-v1-flip",
    title: "Deposit/funding/collateral event types still v1-only (consumed by V2 engines)",
    description:
      "The deposit/funding simulator-first slice (D-BA-RETURN-SIMULATOR-FIRST) CONSUMES the existing DepositTaken / DepositMatured / DepositWithdrawnEarly / FundingLineDrawn / FundingLineRepaid / InterbankLoanPlaced / CollateralInventorySnapshotted event types to drive the V2 LCR / NSFR / BA-310 engines. The slice introduces ZERO new event types (so the v1-only estate is NOT widened — V1-retirement directive rule 1 satisfied), but those CONSUMED types are still tagged `v1-only` in the event-type registry (they were born V1, with V1 GL-posting consumers). Flipping them v1-only → v2-parallel → v2-replaced requires confirming a V2 canonical home for each and that no remaining V1-only consumer depends on them (the V1 GL-posting chain) — a larger change than this slice, NOT feasible in-place here without dragging the bond/MM GL-posting retirement in. Tracked here as the named follow-on (V1-retirement directive rule 2: retire when feasible; here deferred-with-reason, not hidden). The provenance-capable factory extensions this slice added (provenance? on makeDepositTaken / makeFundingLineDrawn / makeInterbankLoanPlaced / makeCollateralInventorySnapshotted) are the first step toward a born-V2 simulated emission path. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1; Engineering Charter cmd 5.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba300-deposit-funding-sim-gl",
    title: "Deposit/funding sim book not live-seeded into the canonical store (GL coupling)",
    description:
      "The deposit/funding simulator-first slice (D-BA-RETURN-SIMULATOR-FIRST) drives BA 300 LCR + NSFR + BA 310 from a simulated deposit/funding/HQLA book, PROVEN end-to-end by a self-contained IN-MEMORY oracle (recon:ba300-deposit-funding-sim-drive leg A + deposit-funding-sim-golden.test.ts). The seed script (scripts/sim/seed-deposit-funding-book-sim-v1.ts) is DELIBERATELY NOT wired into `ci:migrate`: DepositTaken / FundingLineDrawn / InterbankLoanPlaced are V1-only LIFECYCLE-registered events (lifecycleIds mmd-deposit / funding-line / interbank-loan; trade-lifecycle-registry.ts), so `recon:gl-ledger-coverage` requires a matching GL posting for each opening event. Seeding them into the canonical store WITHOUT their postings trips that gate (6 uncovered-lifecycle violations); emitting the V1 GL postings would WIDEN the v1-only estate (V1-retirement directive — the V1 gl-posting path), and the born-V2 MM GL engine (gl-posting-engine-v2-mm.ts, PR-MMD-001-V2) keys on the V2-parallel DepositTakenV2 event type, NOT the V1 DepositTaken the simulator emits. So the live-store seed is a tracked follow-on gated on the born-V2 DepositTakenV2 / FundingLineDrawnV2 / InterbankLoanPlacedV2 emission path (+ their GL postings) — exactly the same GL-coupling deferral the trading-book IR oracle took (GAP-BA320-IR-SIM-GL). recon:ba300-deposit-funding-sim-drive leg B (live BA 310 production read = 0) still asserts on the clean store; leg C (live operating-book drive) is the dormant activation assertion for when the born-V2 live seed lands. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1; Engineering Charter cmd 5 (no silent deferral); Reg 26 / Reg 26A / Reg 27.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // Credit (loans-and-advances) simulator-first slice Phase A
  // (D-BA-RETURN-SIMULATOR-FIRST). Two named follow-ons — never silent.
  // ---------------------------------------------------------------------------
  {
    id: "ba200-credit-sim-gl",
    title:
      "Credit (loans-and-advances) sim book: born-V2 loan-origination fold BUILT; live ci:migrate seed deferred",
    description:
      "BORN-V2 LOAN-ORIGINATION FOLD — NOW BUILT (L5-FTR DISCOVERY-ranked #2 cross-cutting; D-BA-RETURN-CELL-VALUE-ENGINE). The core engine block this gap was gated on is CLOSED: a typed `loanTerms` dimension (loanProductSubType → BA 100 R0130–R0230, ifrs9Stage, SA-CR exposureClass + ltvBucket) on the FIL economic terms (v2-core/fil-instances/events.ts), a born-V2 loan posting rule (v2-core/posting-rules/loan.ts, PR-LOAN-ORIG-001-V2 / PR-LOAN-REPAY-002-V2 under lifecycleId loan-fil-instance — mirrors the capital/deposit fold, no v1-only emission), a born-V2 `credit` loan FIL type (fil:type:credit:loan.advance:vanilla), and — the KEY UNBLOCK — a born-V2 loan-origination fold in `readDebtExposures` (platform/accounting/ecl-engine.ts). readDebtExposures previously read ONLY BondTradeExecuted net positions + live InterbankLoanPlaced placements (NO loan source at all), so the credit-RWA leg from a loan book folded to an honest 0; it now folds born-V2 loan FIL instances into EAD that drives BOTH the BA 200 credit projection AND computeRwaComputed's credit leg (the dominant BA 700 denominator). PROVEN end-to-end against the hand-computed Reg 23 / Basel CRE20 + IFRS 9 §5.5 oracle: an EVENT-SOURCED born-V2 loan book (platform/returns/ba200/loan-origination-sim-book.ts, the canonical CREDIT_BOOK_SIM_BOOK emitted as FilInstrumentCreated events) drives the credit-RWA leg to R1,235m and total gross to R3,100m through readDebtExposures → debtExposureToCreditExposure → computeRwa (loan-origination-sim-golden.test.ts), and stays 0 under the production-only lens. NO v1-only emission — the v1 `LoanBooked` family is NOT used or widened (D-V1-REMOVAL-PHASE-1). What REMAINS (DATA, not ENGINE — the licence-day boundary, gap ba200-credit-loan-instrument-live-seed): the live-store seed of the simulated loan book into the canonical store (ci:migrate) — the same GL-coupling deferral the trading-book IR / deposit / FX slices took (a live FIL loan seed must carry its fold-time legs; the loan fold is a pure read-path fold with no stored GlPostingEmitted, so the production credit read is the honest empty state until a born-V2 simulated loan book is seeded on the +Sim provenance lane), plus per-loan Ifrs9StageAssigned staging events so the BA 200 events-first STAGE split (vs the engine Stage-1 fallback) lights up live. The in-memory oracle (recon:ba200-credit-sim-drive legs A+B+C + credit-book-sim-golden.test.ts) continues to assert the engine + aggregate figures; the new event-sourced golden test proves the same figures flow through the live path. Authority: D-BA-RETURN-SIMULATOR-FIRST; D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST; D-V1-REMOVAL-PHASE-1; Engineering Charter cmd 5 (no silent deferral); Reg 23; Basel CRE20; IFRS 9 §5.5.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // Born-V2 loan-origination instrument — L5-FTR DISCOVERY #2 cross-cutting
  // capability (D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST). The
  // loan posting rule + typed loanTerms dimension + readDebtExposures loan fold +
  // BA 100 advances rows now EXIST and the credit-RWA leg folds from born-V2 loan
  // FIL events. What remains is the licence-day DATA boundary (live-store seed +
  // per-loan staging events) — never silent.
  // ---------------------------------------------------------------------------
  {
    id: "ba200-credit-loan-instrument-live-seed",
    title:
      "Born-V2 loan instrument: credit-RWA + BA 100 advances fold built; live seed + staging events deferred",
    description:
      "The born-V2 LOAN-ORIGINATION instrument capability (L5-FTR DISCOVERY-ranked #2 cross-cutting) is BUILT: an optional `loanTerms` block (loanProductSubType + ifrs9Stage + exposureClass + ltvBucket) on the FIL economic terms (v2-core/fil-instances/events.ts), a born-V2 loan posting rule (v2-core/posting-rules/loan.ts, PR-LOAN-ORIG-001-V2 / PR-LOAN-REPAY-002-V2 under lifecycleId loan-fil-instance — mirrors the capital/deposit fold, no v1-only emission), a born-V2 `credit` loan FIL type (v2-core/fil-models/credit/types/), a born-V2 loan-origination fold in readDebtExposures (platform/accounting/ecl-engine.ts) that drives BOTH the BA 200 credit projection AND computeRwaComputed's credit leg, and the BA 100 leaf fold (platform/reporting/cell-value/ba100-leaf-fold.ts) now places loan FIL instances onto the SARB advances detail rows R0130 (homeloans) / R0140 (commercial mortgages) / R0150 (credit cards) / R0160 (lease-instalment) / R0170 (overdrafts) / R0200 (term loans) / R0230 (other) by the instance's typed loanProductSubType, proven against a simulated loan book (ba100-leaf-fold.test.ts loan tests + loan-origination-sim-golden.test.ts, credit RWA R1,235m oracle). TWO named follow-ons remain, both gating DATA not the ENGINE (D-BA-RETURN-SIMULATOR-FIRST §5 licence-gate→sim rule): (1) the live-store seed of a simulated born-V2 loan book is NOT wired into ci:migrate — the same GL-coupling deferral the capital / FX / deposit slices took (a live FIL loan seed must carry its fold-time legs; the loan fold is a pure read-path fold with no stored GlPostingEmitted, so the production BA 100 / BA 200 / BA 700 read is the honest empty state until a born-V2 simulated loan book is seeded on the +Sim provenance lane); (2) per-loan Ifrs9StageAssigned staging events so the BA 200 events-first STAGE split (12-month vs lifetime ECL) lights up from the events rather than the engine Stage-1 fallback (the loan instance now CARRIES ifrs9Stage; threading it into an emitted staging event is the mechanical follow-on). Neither is a missing engine; both are the licence-day real-borrower DATA boundary + a mechanical wiring step. Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1; Engineering Charter cmd 5 (no silent deferral); SARB BA 100 / BA 200 / BA 700; Reg 23; Basel CRE20; IFRS 9 §5.5.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // BA 100 per-cell leaf fold — Phase 1 pilot (D-BA-RETURN-CELL-VALUE-ENGINE).
  // The capital FIL instances fold soundly onto their BA 100 rows (R0040 cash,
  // R0810/R0820/R0830 equity, R0700 capital liabilities); the remaining BA 100
  // lines stay BLANK because the build-phase instruments do not yet carry the
  // dimension each line needs. Tracked here — never folded from a coarser proxy.
  // ---------------------------------------------------------------------------
  {
    id: "ba100-leaf-fold-instrument-coverage",
    title: "BA 100 leaf fold: most lines blank — instruments lack the line dimension",
    description:
      "The BA 100 per-cell leaf fold (platform/reporting/cell-value/ba100-leaf-fold.ts; D-BA-RETURN-CELL-VALUE-ENGINE Phase 1) folds the CAPITAL FIL instances (assetClass:'capital') directly from the event log onto their SARB BA 100 rows — Dr settlement-cash (nostro) → R0040 (local & foreign currency), Cr own-funds → R0810 share capital / R0820 retained earnings / R0830 other reserves (CET1) or R0700 qualifying-as-capital (AT1/Tier 2). This reconciles to the canonical generateBa100BalanceSheet section totals by construction (recon:ba100-cell-values-reconcile). Every OTHER BA 100 line stays BLANK because the build-phase instruments do not yet carry the event/product dimension that line needs — NOT because 'the CoA is too coarse' (a return and the CoA are sibling folds of the same log; the missing dimension is an EVENT/PRODUCT-SCHEMA gap). Named missing dimensions: (1) loans-and-advances rows R0130–R0230 (homeloans → R0130 / commercial mortgages → R0140 / credit cards → R0150 / lease-instalment → R0160 / overdrafts → R0170 / term loans → R0200 / other → R0230): NOW FOLDED (L5-FTR loan-origination slice, DISCOVERY #2) — the born-V2 loan-origination instrument carrying typed loanTerms (loanProductSubType) places loan FIL instances directly onto R0130–R0230 by the EVENT dimension (gap ba200-credit-loan-instrument-live-seed tracks the remaining live-seed + staging-event wiring); only the licence-day live-borrower DATA boundary remains; (2) deposits-and-creditors rows R0570–R0620 + the R1010 counterparty-sector analysis: NOW FOLDED (L5-FTR slice) — the born-V2 deposit instrument carrying typed depositTerms (depositCategory + counterpartySector) places deposit FIL instances directly onto R0570–R0620 + R1010 (gap ba100-300-deposit-instrument-live-seed-lcr-wiring tracks the remaining live-seed + BA 300 LCR wiring); only the licence-day live-depositor DATA boundary remains; (3) investment & trading securities rows R0270–R0330 + pledged-assets R0350–R0380 need a securities-holding FIL instrument carrying listed/unlisted + issuer-sector + pledge status; (4) the Banking (C0010) / Trading (C0020) column split needs a per-leg banking-vs-trading-book designation on the posting leg (the capital legs are reported in the consolidated C0040 'Total bank' column only at Phase 1); (5) settled `cash` FX legs (FilInstrumentCreated{cash}) are NOT folded onto R0040 because they are not yet on-balance-sheet GL-posted on the clean store — folding them would break the trial-balance reconciliation (they have no matching GL line), so they stay blank pending the born-V2 FX-settlement GL path. Each line is left UNRESOLVED (blank), never fabricated and never folded from a coarser proxy (Engineering Charter cmd 2 fail-closed / cmd 4 source-don't-fabricate). Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-CAPITAL-ASSET-CLASS-V1; Engineering Charter cmd 2 / cmd 5 (no silent deferral); SARB BA 100; Banks Act §75; Reg 32.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  // ---------------------------------------------------------------------------
  // Born-V2 deposit instrument — L5-FTR DISCOVERY #1 cross-cutting capability
  // (D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST). The deposit
  // posting rule + typed depositTerms dimension now EXIST and the BA 100 deposit
  // detail rows fold from deposit FIL events. What remains is the licence-day
  // DATA boundary (live-store seed) + the BA 300 LCR run-off wiring — never silent.
  // ---------------------------------------------------------------------------
  {
    id: "ba100-300-deposit-instrument-live-seed-lcr-wiring",
    title: "Born-V2 deposit instrument: BA 100 fold built; live seed + BA 300 LCR wiring deferred",
    description:
      "The born-V2 DEPOSIT instrument capability (L5-FTR DISCOVERY-ranked #1 cross-cutting) is BUILT: an optional `depositTerms` block (depositCategory + counterpartySector) on the FIL economic terms (v2-core/fil-instances/events.ts), a born-V2 deposit posting rule (v2-core/posting-rules/deposit.ts, PR-DEP-TAKEON-001-V2 / PR-DEP-REPAY-002-V2 under lifecycleId deposit-fil-instance — mirrors the capital fold, no v1-only emission), and the BA 100 leaf fold (platform/reporting/cell-value/ba100-leaf-fold.ts) now places deposit FIL instances onto the SARB deposit detail rows R0570 (savings) / R0580 (call) / R0590 (fixed-notice) / R0600 (NCD) / R0610 (other) / R0620 (repo) + the R1010 counterparty-sector analysis (retail→R1080, wholesale→R1070), proven against a simulated depositor book (ba100-leaf-fold.test.ts, 6 deposit tests). TWO named follow-ons remain, both gating DATA not the ENGINE (D-BA-RETURN-SIMULATOR-FIRST §5 licence-gate→sim rule): (1) the live-store seed of a simulated born-V2 deposit book is NOT wired into ci:migrate — the same GL-coupling deferral the capital / FX / credit slices took (a live FIL deposit seed must carry its fold-time legs; the deposit fold is a pure read-path fold with no stored GlPostingEmitted, so the production BA 100 read is the honest empty state until a born-V2 simulated deposit book is seeded on the +Sim provenance lane); (2) the BA 300 LCR / NSFR run-off wiring keyed on `depositTerms.counterpartySector` is the next consumer of the same dimension — the deposit instance now CARRIES the LCR sector, but threading it into platform/liquidity/lcr.ts run-off bands is the follow-on that completes the cross-cutting lift (shares substrate with ba300-deposit-funding-sim-gl, which the born-V2 deposit path now unblocks). Neither is a missing engine; both are the licence-day real-depositor DATA boundary + a mechanical wiring step. Authority: D-BA-RETURN-CELL-VALUE-ENGINE; D-BA-RETURN-CAPABILITY-FIRST; D-BA-RETURN-SIMULATOR-FIRST; D-V1-REMOVAL-PHASE-1; Engineering Charter cmd 5 (no silent deferral); SARB BA 100 / BA 300; BCBS d238; Reg 26.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
  {
    id: "ba200-credit-granular-cell-mapping",
    title: "BA 200 granular published-schedule cell mapping: engine + aggregate proven",
    description:
      "The BA 200 credit-risk engine (platform/reporting/ba-200-credit-risk.ts) and the CRE20 credit-RWA engine (platform/risk/rwa-engine.ts) are DRIVEN + PROVEN by the credit simulator-first slice Phase A (D-BA-RETURN-SIMULATOR-FIRST) at the ENGINE + AGGREGATE level: the by-category and by-IFRS-9-stage folds, the EAD/ECL/NPL/coverage figures, and the CRE20 standardised credit RWA land on hand-computed Reg 23 / CRE20 / IFRS 9 oracles. However the BA 200 PUBLISHED CONTRACT (ba200-contract.json) is a 4,570-cell granular schedule with the SARB Excel exposure-class taxonomy (R0180–R0470: corporate / commercial-real-estate / specialised-lending / SME / PSE / sovereign / banks / retail / residential-mortgage / securitisation, each split by PD/LGD/EL/EAD columns). The engine's by-category fold uses a free-form productCategory vocabulary, not the exact SARB row enumeration cell-by-cell. Stamping all 4,570 published cells 'driven' would be an overclaim; the statusReason reclassification (scripts/reclassify-ba200-credit-sim-status.ts) touches ONLY the engine-level aggregate concept rows my fold actually computes (the EAD / RWA / total-credit-impairment / by-stage derivation chain), and the granular per-exposure-class published leaf cells stay licence-day-data with their existing reason. Closing this needs the aggregate→granular-published-cell expansion mapping (the same class of work as ba350-maturity-ladder-cell-mapping / ba300-lcr-nsfr-granular-cell-mapping) — a mechanical presentation follow-on gated on the published-schedule line enumeration, not on a missing engine. Authority: D-BA-RETURN-SIMULATOR-FIRST; Engineering Charter cmd 5 (no overclaim); Reg 23; Basel CRE20.",
    severity: "medium",
    status: "planned",
    mitigation: "partial",
  },
];

/** Open (not-yet-resolved) gaps — the inventory the substrate snapshot tracks. */
export function openSubstrateGaps(): readonly SubstrateGapRecord[] {
  return SUBSTRATE_GAP_REGISTER.filter((g) => g.status !== "resolved");
}

/** Look up a gap record by id. */
export function getSubstrateGap(id: string): SubstrateGapRecord | undefined {
  return SUBSTRATE_GAP_REGISTER.find((g) => g.id === id);
}
