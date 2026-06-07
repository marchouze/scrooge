// roadmap.js — Project Plan page.
//
// Pulls /api/state for live counts (decisions, workstreams, procedures,
// obligations, policies). Workstream structure and milestone items are
// hardcoded from the canonical roadmap (Owner Inbox/2026-05-10_scrooge_
// project-status-roadmap.md) — stable architectural content.
//
// Author: Atlas (Core banking platform architect) — roadmap page scaffold.

(() => {
  // ── Workstream catalogue ────────────────────────────────────────────────
  // Each workstream has: id, label, owner, blockers[], done[], todo[]
  // inflight[] is derived live from /api/state (inFlight items tagged with roadmapWorkstream)
  // Items: { text, ref? }

  const WORKSTREAMS = [
    {
      id: "A",
      anchor: "ws-a",
      label: "Substrate",
      sublabel: "Engineering platform",
      owner: "Atlas (Core banking platform architect) · Devon (COO)",
      blockers: ["D-S8-AGENT-RUNTIME-SUBSTRATE-APPROVED", "D-S7-SUBSTRATE-COMPLETENESS-GATE"],
      done: [
        {
          text: "Walking-skeleton platform: event store, projection runtime, identity authenticator, IaC seam, recon harnesses",
          ref: "prototype/platform/recon/*",
        },
        {
          text: "Bank UI v0 + intranet shell + dashboard with obligations page",
          ref: "PRs #52 #48 #81",
        },
        {
          text: "CI gate live: typecheck, lint, tests, citation-gate, nine recon harnesses; branch protection on main",
          ref: "package.json ci",
        },
        {
          text: "Markets schema foundation — FX Spot/Forward/Swap/NDF typed shapes + bookType discriminator",
          ref: "D-MARKETS-SCHEMA-FOUNDATION PR #49",
        },
        {
          text: "Correspondent routing-policy projection + switch-test event family",
          ref: "D-FX-CORRESPONDENT-PAIR-NAMING PR #64",
        },
        { text: "Legal-entity events + IFRS 10 consolidation substrate v0", ref: "PRs #90 #92" },
        {
          text: "RMS Phase 1 — seven typed events + content-addressed doc store + seven projection registers",
          ref: "D-RMS-PHASE-1",
        },
        {
          text: "Provenance substrate Slices 1–3 + intranet scaffold + provenance badges",
          ref: "D-DATA-PROVENANCE-SUBSTRATE",
        },
        {
          text: "Agent-runtime S8 Tier 1 — 27 personas registered, AgentRunner lifecycle wrapper, worker-isolation primitive",
          ref: "PRs #185–#188",
        },
        {
          text: "Party register substrate — unified identity axis (natural-person, legal-entity, counterparty, agent)",
          ref: "D-PARTY-REGISTER PRs 1–3",
        },
        {
          text: "Regulatory knowledge graph — 664 nodes, 373+ edges, GOVERNS fuzzy resolver, JSON Schema ontology",
          ref: "PRs #424–#427",
        },
        {
          text: "Canonical risk taxonomy — 94 codes, typed enum, register, RAS/obligations/policy frontmatter backfilled",
          ref: "PR #256",
        },
        {
          text: "Vera circular-dependency gate — 36 circular deps resolved, madge-circular-deps CI gate live",
          ref: "PR #406",
        },
        { text: "Semantic-layer registry recon gate (M2 Slice 1)", ref: "PR #436" },
        {
          text: "Event-type registry — 143 missing types added, registry warns → 0",
          ref: "PR #434",
        },
        { text: "PermissionPolicies for 41 agent actors (T-01)", ref: "PR #433" },
        {
          text: "Event-type registry coverage — CI-blocking gate (F-032), zero warns",
          ref: "PR #464",
        },
        {
          text: "RMS Phase 2 — events-first dispatch CLIs + /briefs route (briefs / runs events-first)",
          ref: "PR #465",
        },
        {
          text: "RMS Phase 3 — RecordFiled wiring + /documents route + projection-parity recon (deliverables events-first)",
          ref: "PR #466",
        },
        {
          text: "RMS Phase 4 complete — archive move done; Owner Inbox / Team Inbox retired; parseOwnerInbox removed; registers sole canonical",
          ref: "D-RMS-PHASE-4 PR #523",
        },
        {
          text: "KYC onboarding build sprint — event handlers, screening flows, onboarding lifecycle (D-KYC-ONBOARDING-BUILD)",
          ref: "PRs #532–#536",
        },
        {
          text: "Valuation + MTM substrate — EnvSim, MarketDataStore, SENS ingest, Valuation Policy, MTM engine, IPV tolerance, provenance recon",
          ref: "PRs #576–#582",
        },
        {
          text: "Regulation reader sprint — all 8 regulation JSON files rebuilt with verbatim text (Banks Act, FAIS, FIC, POPIA, JS2, RRB, Excon)",
          ref: "PRs #586–#593",
        },
        {
          text: "Market data page + Twelve Data live hourly feed — MarketDataStore browser UI + /time_series ingest",
          ref: "PRs #686 #688",
        },
        {
          text: "Cross-worktree shared event-DB sync — single canonical SQLite store; dispatch CLIs unified",
          ref: "PR #704 D-CROSS-WORKTREE-EVENT-STORE-SYNC",
        },
        {
          text: "Event-store append-only typed gate — SQL-DELETE prevention; Vera finding resolved",
          ref: "PR #697",
        },
        {
          text: "GL COA fix — duplicate ACC-3100-001/002 resolved; posting imbalance and blank account names fixed",
          ref: "PR #707",
        },
        {
          text: "Reporting-capability M2–M3 build — all slices complete (M2 Slices 1–11, M3 Slices 4–10, conduct events, period-close, IFRS statements, BA 300/310/320/325/350/600/700 projections)",
          ref: "PRs #436–#481 WS-REPORTING-M2-M3",
        },
        {
          text: "T-12 sub-agent PermissionPolicy substrate — handler + coverage recon + seed; ACCEPTED_NO_POLICY_ACTORS carve-out closed",
          ref: "PRs #512 #516 #529",
        },
        {
          text: "Event-store scaling — WAL + composite indexes + snapshot pruning + recon cursors (Phase 1); cold archive partitioning + PartitionedEventStore (Phase 5)",
          ref: "PRs #777 #779 D-EVENT-STORE-SCALING",
        },
        {
          text: "Reg knowledge graph wired to ODP obligations — regulation reader feeds graph; 664+ nodes, 373+ edges",
          ref: "PR #774",
        },
        {
          text: "Reg structural extraction — 349 blobs → 30 (92% reduction); 4,664 total sections extracted across 10+ regulation JSONs",
          ref: "PR #786",
        },
        {
          text: "buildRmsRegistersFold race condition closed — asOf passed to all non-decisions projections",
          ref: "commit 43d006e1",
        },
        {
          text: "Liquidity substrate gaps closed — buildPhaseProvider deleted; settlement outflows derived from TradeBooked.settlementDate",
          ref: "PRs #788 #789",
        },
        {
          text: "Product-construction substrate — pricing-model registration, RWA-delta engine, NPA gate, trade-confirmation generators, NPA attestation runtime, M1–M4 ProductApproved events, Vera integrity recon",
          ref: "PRs #819–#825",
        },
        {
          text: "Trade booking extended — equity/bond/IRS booking + Repo/MMD/IBL bookable; sim/prod toggle; provenance recon gate",
          ref: "PRs #822 #823",
        },
        {
          text: "Stale-server prevention — /api/version + post-merge hook + env guard + recon:server-version-vs-head",
          ref: "PR #815",
        },
        {
          text: "Data quality cross-domain complete — D-DATA-QUALITY-CROSS-DOMAIN-V1; 5 domains; dispatch-sync-integrity 389/0",
          ref: "PRs #805–#809",
        },
        {
          text: "Data quality golden source complete — D-DATA-QUALITY-GOLDEN-SOURCE-V1; oversight.html auto-poll; 4 recon gates in CI",
          ref: "PRs #810–#814",
        },
        {
          text: "Atlas escalation idempotency — hasDecidedEscalation guard; ghost-open decisions resolved; /api/decisions-register AgentEscalationDecided fix",
          ref: "PRs #835 #837",
        },
        {
          text: "S8 A4 complete — all 31 personas wired; Env + Noa handlers; fleet-status lifecycle fold; escalation-overdue cron",
          ref: "PR #838",
        },
        {
          text: "Inbound MT202 dedup — correspondentSim gated on realtime mode; coveredTradeIds dedup set",
          ref: "PR #839",
        },
        {
          text: "ALM substrate gaps closed — SettlementInstructionIssued + BalanceSheetProjected defined; CollateralInventorySnapshotted rename fixed; FundingLineDrawn seed",
          ref: "PR #840",
        },
        {
          text: "Substrate gap batch — GL recon (0 violations), permission gate (0 warns), IFRS9 alias, period-close seed, Helena appetite runner, SA-CCR seed, §7 handler-without-spec 37→0",
          ref: "PRs #841–#844",
        },
        {
          text: "Atlas goal-deriver — defer-ratio 98%→fixed; 4h cadence; 30-min brief window",
          ref: "PR #845",
        },
        {
          text: "Event-store append-only test isolation — injected-observation archive checks skipped in unit-test mode",
          ref: "PRs #846 #847",
        },
        {
          text: "WAL-loss data fix — archive partition max_sequence 94330→94522; SubstrateAlert + AuditFinding F-ATLAS-20260527-MBZB filed",
          ref: "d4701916",
        },
        {
          text: "MTM stale-mark PnL fix — overnight-close proxy; mark-unavailable indicator; 25 SettlementConfirmed backfilled (active 137→111)",
          ref: "PR #850",
        },
        {
          text: "Client entity-name uniqueness gate — recon CI gate + projection dedup guard; 240 tombstones",
          ref: "PR #849",
        },
        {
          text: "Vera Wave-4 #11–#13 — mandate-coverage, procedure-actor, compliance-obligation-tracing recon pipelines",
          ref: "PR #854",
        },
        {
          text: "BA 325/700 SARB adapters — XML adapters + local portal simulator + sarb:dry-run script + stress-test coverage — G3 gate",
          ref: "PRs #855 #856",
        },
        {
          text: "S7 substrate-completeness brief filed — sessions-to-pre-licence-gate countdown live",
          ref: "PR #851",
        },
        {
          text: "D-S8-AGENT-RUNTIME-SUBSTRATE-APPROVED — agent-runtime substrate approved; autonomous personas unblocked (Principle 6)",
          ref: "D-S8-AGENT-RUNTIME-SUBSTRATE-APPROVED",
        },
        {
          text: "D-S7-SUBSTRATE-COMPLETENESS-GATE — substrate-completeness budget approved; sessions-to-gate cadence active",
          ref: "D-S7-SUBSTRATE-COMPLETENESS-GATE",
        },
      ],
      todo: [
        {
          text: "M4–M8 markers — M2/M3 reporting done; M4 payments/tax vertical deferred to revenue-start (Yael); M8 agent-runtime auto-commit ingest + Azure cloud lift",
        },
        { text: "Azure migration — single-coherent-phase per Principle 3; seams already in place" },
      ],
    },
    {
      id: "B",
      anchor: "ws-b",
      label: "Governance",
      sublabel: "Seats, hires, frameworks",
      owner: "Owen (Company Secretary) · Devon (COO) · Nolan (Recruiter)",
      blockers: [],
      done: [
        {
          text: "11 CEO direct reports filled — Scrooge, Helena (CRO), Devon (COO), Camille (CFO), Eitan, Saskia, Owen, Zara (CCO), Iris (IO), Thandiwe (CAE), Rashida (CISO)",
        },
        {
          text: "Compensation framework approved — six-seat thin-human-layer comp envelope",
          ref: "D-COMP-FRAMEWORK-SIX-SEATS PR #134",
        },
        {
          text: "Thin-human-layer composition fixed at six humans",
          ref: "D-THIN-HUMAN-LAYER-MINIMUM PR #47",
        },
        {
          text: "Legal-entity tree v0 — Group + Bank + Securities, shared board across three entities",
          ref: "D-LEGAL-ENTITY-TREE-V0 PRs #82 #93",
        },
        {
          text: "Regulatory perimeter set — Bank to PA, Securities to JSE, Group not separately regulated",
          ref: "D-REGULATORY-PERIMETER PR #85",
        },
        {
          text: "Principles consolidated — six principles, P2 single-graph discipline + P6 autonomous-by-default",
          ref: "D-PRINCIPLES-P2-P6-MERGE",
        },
        {
          text: "27 personas registered as standing autonomous agents; 17-section operating-spec template adopted",
        },
        {
          text: "Six thin-human-layer role briefs drafted by PAX (Independent Chair, NED #2 #3, Human CRO, Compliance Lead, Company Secretary)",
          ref: "D-HIRE-SIX-SEATS-PACK",
        },
        {
          text: "Vera advisory recon pipeline online — mandate coverage, prose duplication, canonical source, policy-obligation trace",
        },
        {
          text: "All 16 STUB procedures → POPULATED; 35 further procedures drafted across Batches G–K",
          ref: "PRs #407–#426",
        },
        {
          text: "Market risk procedures — PROC-NPA-GATE-01 reconciled with Product* event family; PROC-MK-PLG-01 rehearsal READY-FOR-INTERNAL-TEST",
          ref: "PRs #681 #683",
        },
        {
          text: "D-OPRISK-ENGINEER-ROLE approved — Option B (subsume into existing roster); licence-day successor card filed",
          ref: "PR #671 #672",
        },
        {
          text: "Entity-identity unification — single canonical identifier for the bank entity; BANK-ZA-001 literal audit + remediation",
          ref: "PRs #669 #679",
        },
        {
          text: "Dispatch sync primitive — reviewer→decider gate; recon:dispatch-sync-integrity pipeline; D-DISPATCH-SYNC-PRIMITIVE approved",
          ref: "D-DISPATCH-SYNC-PRIMITIVE",
        },
        {
          text: "Persona agent-spec upgrades — sections 6–17 backfill complete; all 31 persona files have §16 substrate-gaps section confirmed",
          ref: "PRs #117 #119–#125 #491 7c904629",
        },
        {
          text: "Internal Audit Charter v1 + first risk-based audit plan v1 (Thandiwe) — IIA IPPF + BCBS 223 + AI-native scope",
          ref: "PRs #257 #402",
        },
        {
          text: "RAS recalibration v2 — all 8 sections complete; capital / liquidity / market risk / AI-agent / concentration / Pillar 2A (Helena)",
          ref: "archive/owner-inbox/2026-05-12_helena_ras-recalibration-v2.md",
        },
        {
          text: "Zero PLANNED procedures — all ~30 PLANNED procedures promoted to POPULATED or SCAFFOLD across Batches A–K and follow-on",
          ref: "PRs #407–#423 #470 2026-05-15",
        },
        {
          text: "Bank strategy v1 — Hoz Bank institutional strategy (D-BANK-STRATEGY-V1) filed",
          ref: "PR #790 D-BANK-STRATEGY-V1",
        },
        {
          text: "Decision-authority routing operationalised — 5 inaugural seat decisions seeded (CISO/COO/CFO/CCO/CAE); routing table active per Owen brief",
          ref: "PR #848",
        },
        {
          text: "IFRS 9 staging engine v1 — stage classification + ECL provision; G4 gate complete",
          ref: "PR #857",
        },
        {
          text: "CAE quarterly autonomous run — audit-plan review + QAIP + third-line opinion; G5 gate",
          ref: "PR #858",
        },
        {
          text: "CCO quarterly autonomous run — RMCP + STR/AML + EDD; G5 gate",
          ref: "PR #861",
        },
        {
          text: "CISO quarterly autonomous run — JS-2 + SBOM + threat-model + key-ceremony; G5 gate",
          ref: "PR #860",
        },
        {
          text: "D-PRELICENCE-SUBSTRATE-GATES-G3-G4-G5 approved — G3 (BA 700/325 stress tests + SARB dry-run), G4 (IFRS 9 ECL engine), G5 (CAE/CCO/CISO governance seat runs) all CI-green; build-phase substrate readiness recorded",
          ref: "D-PRELICENCE-SUBSTRATE-GATES-G3-G4-G5",
        },
        {
          text: "D-S3-THIN-HUMAN-LAYER-COMPOSITION approved — thin-human-layer composition and timing for licence-day confirmed (Owen)",
          ref: "D-S3-THIN-HUMAN-LAYER-COMPOSITION",
        },
        {
          text: "D-HIRE-SIX-SEATS-PACK approved — all six thin-human-layer role-briefs approved as drafted; Nolan opened active search across all six channels",
          ref: "D-HIRE-SIX-SEATS-PACK",
        },
      ],
      todo: [
        { text: "Open governance seats — GC then CHRO per hire-order (A2-approved)" },
        {
          text: "Board AC constitution — replaces Interim Audit Forum once independent-NED hires land",
        },
      ],
    },
    {
      id: "C",
      anchor: "ws-c",
      label: "Regulatory chain",
      sublabel: "Obligations, policies, procedures, instruments",
      owner:
        "Mira (Compliance / RegTech engineer) · Zara (CCO) · Iris (IO) · Imani (Legal-as-code)",
      blockers: ["S5"],
      done: [
        {
          text: "Obligations register — entity-scope + applies-at vocabulary; bind-status taxonomy live",
          ref: "Regulations/_obligations-register.md",
          live: "obligations-summary",
        },
        {
          text: "FAIS Posture A confirmed — bank entity does not need its own FSP licence; securities entity holds FSP path",
          ref: "D-FSP-LICENCE-NECESSITY PRs #66 #68 #70",
        },
        { text: "FIC cycle + FSP path + TCF substrate v0", ref: "PR #44" },
        {
          text: "Naming pre-clearance procedure — TM + Banks Act + CIPC + 11-language; CIPC three-reservation update for all entities",
          ref: "PROC-CORP-NPC-01 PRs #74 #83",
        },
        {
          text: "Procedures populated across Batches A–K (up from 9 at 2026-05-06)",
          live: "procedures-count",
        },
        { text: "Records Management Policy + retention citation coverage", ref: "v1.12" },
        { text: "Per-entity POPIA s.55–56 IO designation scoping + procedure", ref: "PR #91" },
        {
          text: "FAIS Act full analysis + GCC analysis; fsca-reg-to-policy recon pipeline live",
          ref: "PRs 2026-05-12",
        },
        {
          text: "Ten governance policies drafted and registered (top-10 Owen priority batch)",
          ref: "PRs #255–#265",
        },
        {
          text: "Bind-status taxonomy — CORPORATE-BIND / LICENCE-BIND / COMMENCEMENT-BIND / CONDITIONAL-BIND vocabulary live",
        },
        {
          text: "DCAM taxonomy complete — EDM Council three-layer architecture, 7 new product codes, party LEI field",
          ref: "PR #432",
        },
        {
          text: "FX Spot product Policy → Procedure → Function chain — per-dimension attestations, Triggered-by/Emits, accounting card",
          ref: "PR #684",
        },
        {
          text: "3 Decision(requested) obligations surfaced as CEO decision cards — queued for approval",
          ref: "PR #670",
        },
        {
          text: "11 policy stubs authored + 3LoD alias — fsca-reg-to-policy WARNs 12→0; all instrument-to-policy gaps closed",
          ref: "commit b97f0e53",
        },
        {
          text: "D-IFRS-THRESHOLDS-V13 approved — Bea's IFRS v1.3 threshold amendments (materiality thresholds + recognition boundaries)",
          ref: "commit 3ebbfc3b",
        },
        {
          text: "Compliance obligation tracing 82→7 — noBackRef 67→0; Complaints Handling Policy authored; 22 policy files back-referenced (Principle 2)",
          ref: "PR #862",
        },
        {
          text: "D-CREDIT-RISK-CAPITAL-APPROACH-V1 alignment — capital-management-policy v1.1, credit-risk-policy v1.2, pillar-3-disclosure-policy v1.1; IRB sections marked NOT_APPLICABLE; SA election principle recorded",
          ref: "PR #863 D-CREDIT-RISK-CAPITAL-APPROACH-V1",
        },
        {
          text: "New Product Approval Policy v1.0 authored + D-NEW-PRODUCT-APPROVAL-POLICY approved — gates product walk-through PROC-NPA-GATE-01; backfilled 2026-05-10",
          ref: "D-NEW-PRODUCT-APPROVAL-POLICY",
        },
      ],
      todo: [
        {
          text: "Complete instrument analyses — markets-profile priority; each unlocks obligations register rows",
          live: "instrument-analyses",
        },
        {
          text: "Drive procedures backlog — prioritised by profile",
          live: "procedures-backlog",
        },
        {
          text: "Obligation-source tagging — every policy carries Source column (Regulation OR Bank Objective)",
        },
        {
          text: "SARB licence application package — assembled when pre-licence readiness gate lights green; needs S5 external counsel",
          ref: "S5",
        },
      ],
    },
    {
      id: "D",
      anchor: "ws-d",
      label: "Markets franchise",
      sublabel: "Saskia's domain — products, RAS, trading mandate, NPA",
      owner:
        "Saskia (Head of Global Markets) · Helena (CRO) · Kai (technology) · Tomas (settlement) · Eitan (funding)",
      blockers: [],
      done: [
        {
          text: "Strategic foundation — institutional global-markets dealer in JSE bonds + JSE equities + OTC IRD; institutional-only; SA single-branch; ~R300m capital target",
          ref: "D-STRATEGIC-FOUNDATION 2026-05-06",
        },
        {
          text: "FX foundation slice — Spot/Forward/Swap/NDF typed shapes + bookType discriminator",
          ref: "D-MARKETS-SCHEMA-FOUNDATION PR #49",
        },
        {
          text: "Named correspondent pair + switch-test cadence + outsourcing procedures",
          ref: "D-M4-FX-SUB-DECISIONS PR #58",
        },
        {
          text: "Correspondent routing-policy projection",
          ref: "D-FX-CORRESPONDENT-PAIR-NAMING PR #64",
        },
        { text: "B-cluster FX-settlement-concentration appetite lines (Helena)", ref: "PR #60" },
        {
          text: "FAIS-KI handover gate-(a) closed + counterparty institutional-eligibility screening v0",
          ref: "PRs #66 #77",
        },
        {
          text: "Product-construction substrate approved",
          ref: "D-PRODUCT-CONSTRUCTION-SUBSTRATE PR #115 series",
        },
        { text: "FinSurv URN cluster wave-1 — current-account + capital-account", ref: "PR #56" },
        {
          text: "Validation methodology — slice A tier definitions locked",
          ref: "D-S7-TARGETED-3-5 PR #50",
        },
        {
          text: "First SARB return (BA-700 capital) — dry-run scenarios A + B + D",
          ref: "S8 Tier 1",
        },
        {
          text: "Trade booking UI + FX trade lifecycle — /trade-book.html manual booking; post-trade chain, T+2 settlement, cancellation filter",
          ref: "PRs #549–#556 #570 #574 #575",
        },
        {
          text: "FX posting rules + Bea autonomous GL subscriber — 4 memo rules; PR-FX-PRIN GL-significant; bea-gl-posting-engine live",
          ref: "PRs #608 #609 #616 #668",
        },
        {
          text: "Credit limit engine — full Reg 29 / LEX / BCBS SA-CCR chain; 17 events; SA-CCR v1; netting-set register; PROC-RISK-CLM-01",
          ref: "PRs #611–#614 #617–#619 #622–#624",
        },
        {
          text: "FX quoting convention (D-FX-QUOTING-CONVENTION) — schema + Zod refinement + rate inversion + MT300 field 36 + unrealised-P&L repair",
          ref: "PRs #664 #675 #676 #677",
        },
        {
          text: "D-BRC-INTERIM-MR-1-FX approved — CEO interim approval of Helena's MR-1-FX market risk limits",
          ref: "PR #680",
        },
        {
          text: "D-NPA-FX-SPOT-INTERNAL-TEST approved — FX Spot walked through PROC-NPA-GATE-01 for internal pre-licence test scope",
          ref: "PRs #673 #674",
        },
        {
          text: "MTM daily cadence — rohan:daily-mtm scheduled handler; stale-mark carry-forward; inverse-pair lookup fix",
          ref: "PRs #685 #687 #691",
        },
        {
          text: "Product Control P&L + FX-risk fix — MR-1-FX RAS schedule; realised-P&L on FxSettlementConfirmed; inverse-pair direction sanity-check",
          ref: "PRs #692 #693 #694",
        },
        {
          text: "Leverage ratio + liquidity-limit engine + ALM positions — LR-1 appetite line; LCR/NSFR breach detector; ALM-positions projection wired",
          ref: "PRs #699 #700 #701",
        },
        {
          text: "Finance page capital/liquidity projections — CET1 ~407%, LCR/NSFR, leverage tiles live on dashboard",
          ref: "PR #709",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slice 1 — FinancialInstrument entity schema (Zod, ISIN, assetClass, ACTUS discriminator)",
          ref: "PR #742",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slice 2 — financial-instrument lifecycle registry entries (trade lifecycle wiring)",
          ref: "PR #743",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slice 3 — SecurityMaster projection (instrument registry, HQLA tier lookup)",
          ref: "PR #744",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slices 4 & 5 — semantic-layer registry + ACTUS→DCAM contract-terms mapping",
          ref: "PR #746",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slices 6–8 — optional instrumentId on equity, IRS, and FX CDM events",
          ref: "PRs #747 #748 #749",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slices 9 & 10 — SecurityMaster HQLA override in BA 325 LCR; BondTradeExecuted CDM schema + SA govt bond seeds",
          ref: "PR #750",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slice 11 — unified cross-asset position projection (FX + equity + bond + IRS in single view)",
          ref: "PR #751",
        },
        {
          text: "D-FINANCIAL-INSTRUMENT-ENTITY Slice 12 — bond lifecycle events wired into GL posting engine (PR-BOND-001/001T/EIR/002/MAT/SALE)",
          ref: "PR #752",
        },
        {
          text: "IPV breach recalibration — D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22 approved; two-tier tolerance schedule wired in ipv-tolerance.ts",
          ref: "PRs #718 #720 #721 D-IPV-TOLERANCE-SCHEDULE-FX-SPOT-2026-05-22",
        },
        {
          text: "Markets franchise design proposal v1 — bank-strategy-v1.md filed; institutional global-markets strategy approved",
          ref: "PR #790 D-BANK-STRATEGY-V1",
        },
        {
          text: "Market risk procedures Wave-2 — BA-325 + daily P&L + GL projection scenarios; SicrTriggered fixture (WS-MARKET-RISK-PROCEDURES)",
          ref: "PR #663",
        },
        {
          text: "Product-construction substrate slices 4–8 — NPA attestation runtime, M1–M4 ProductApproved events, Vera integrity recon",
          ref: "PRs #824 #825",
        },
        {
          text: "NPA gate walks — PROC-NPA-GATE-01 walked for equity/bond/repo/IRS/FX-swap (internal pre-licence test scope); gate rehearsal complete",
          ref: "PR #826",
        },
        {
          text: "Track B model-risk complete — ZARONIA feed + model registry seed + Tier-2/3 methodology + validation sign-offs; all 5 products model-risk implementation-attested",
          ref: "PRs #828–#831",
        },
        {
          text: "NPA dimension bulk upgrades — 53 new impl-attested; 13/14 dimensions at 5/5 (tax deferred to revenue-start, Yael)",
          ref: "PRs #832 #833 #836",
        },
        {
          text: "B3 risk limit fix — computeB3Exposure canonical formula; shared market-data store wiring; B3 = ZAR 602.6M / 301% red",
          ref: "PR #834",
        },
        {
          text: "M5 NPA gate walk — PROC-NPA-GATE-01 for prd:bank:treasury:repo-sagb-term (SAGB-backed Term Repo); ProductApproved event emitted",
          ref: "PR #850 brief:saskia:m5-m7-npa-gate-walks-productapproved-events:2026-05-28",
        },
        {
          text: "M6 NPA gate walk — PROC-NPA-GATE-01 for prd:bank:treasury:mmd-deposit (Money Market Deposit); ProductApproved event emitted",
          ref: "PR #850 brief:saskia:m5-m7-npa-gate-walks-productapproved-events:2026-05-28",
        },
        {
          text: "M7 NPA gate walk — PROC-NPA-GATE-01 for prd:bank:treasury:funding-line (Committed Funding Line); ProductApproved event emitted",
          ref: "PR #850 brief:saskia:m5-m7-npa-gate-walks-productapproved-events:2026-05-28",
        },
        {
          text: "B3 NOP fix — ZAR home-currency excluded from NOP calculation per BA 600; B3 = ZAR 602.6M / 301% red (pre-licence design intent)",
          ref: "PR #859",
        },
      ],
      todo: [
        { text: "NPA gate fires as products approach commencement-of-trading" },
        {
          text: "JSE Listings Requirements scoping (ORG-MK-10) — fires only on first listing event",
        },
        {
          text: "Pre-licence go-live readiness gate — co-owned Saskia + Rashida + Devon; defines build-phase endpoint",
        },
        {
          text: "Licence-day commencement — real capital, real customers, minimum human layer per Banks Act",
        },
      ],
    },
  ];

  // ── Helpers ─────────────────────────────────────────────────────────────

  function setMetric(id, text, tone) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = text ?? "–";
    if (tone) el.setAttribute("data-tone", tone);
  }

  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function itemsHtml(items, iconClass, iconChar) {
    if (!items.length)
      return `<li class="rm-items" style="padding:6px 0;font-size:12.5px;color:var(--neutral-stone)">None recorded.</li>`;
    return items
      .map(
        (it) =>
          `<li>
            <span class="rm-item-icon ${iconClass}">${iconChar}</span>
            <span class="rm-item-text">${esc(it.text)}</span>
            ${it.ref ? `<span class="rm-item-ref">${esc(it.ref)}</span>` : ""}
          </li>`,
      )
      .join("");
  }

  // ── Live count resolution ────────────────────────────────────────────────
  // Milestone items tagged with a `live` key render from /api/state's
  // bank.metrics instead of a hardcoded snapshot, so the roadmap never drifts
  // from the canonical _index.md / register counts (D-ROADMAP-WS-C-RECONCILE).
  // An item that resolves with `_done: true` is relocated from the To-do
  // panel into the Done panel.
  function resolveLiveItem(item, m) {
    if (!item.live || !m) return { ...item };
    const n = (v) => (typeof v === "number" ? v : null);
    switch (item.live) {
      case "obligations-summary": {
        const obl = n(m.obligations);
        const inst = n(m.instruments);
        const pop = n(m.instrumentsAnalysed);
        if (obl == null || inst == null) return { ...item };
        return {
          ...item,
          text: `Obligations register — ${obl} obligations registered; ${inst} instruments indexed (${pop} populated)`,
        };
      }
      case "procedures-count": {
        const pop = n(m.proceduresPopulated);
        if (pop == null) return { ...item };
        const stub = n(m.proceduresStub) ?? 0;
        const planned = n(m.proceduresPlanned) ?? 0;
        return { ...item, text: `${pop} procedures populated (${stub} STUB · ${planned} PLANNED)` };
      }
      case "instrument-analyses": {
        const stub = n(m.instrumentsStub);
        const pop = n(m.instrumentsAnalysed);
        if (stub == null) return { ...item };
        if (stub > 0) {
          return {
            ...item,
            text: `Complete instrument analyses — ${stub} STUB remaining (${pop ?? "?"} populated), markets-profile priority; each unlocks obligations register rows`,
          };
        }
        return {
          ...item,
          text: `Instrument analyses complete — ${pop ?? 0} populated, 0 STUB`,
          _done: true,
        };
      }
      case "procedures-backlog": {
        const pop = n(m.proceduresPopulated);
        if (pop == null) return { ...item };
        const stub = n(m.proceduresStub) ?? 0;
        const planned = n(m.proceduresPlanned) ?? 0;
        if (stub + planned === 0) {
          return {
            ...item,
            text: `Procedures backlog closed — ${pop} populated, 0 STUB, 0 PLANNED (target met)`,
            _done: true,
          };
        }
        return {
          ...item,
          text: `Drive procedures backlog — ${pop} populated · ${stub} STUB · ${planned} PLANNED, prioritised by profile`,
        };
      }
      default:
        return { ...item };
    }
  }

  // ── Render workstreams ───────────────────────────────────────────────────

  function renderWorkstreams(resolvedIds = new Set(), liveInFlight = [], metrics = null) {
    const container = document.getElementById("rm-workstreams");
    if (!container) return;

    container.innerHTML = WORKSTREAMS.map((ws) => {
      // Resolve live-tagged milestone items against bank.metrics. Items that
      // resolve as `_done` move from the To-do queue into Done.
      const doneStatic = ws.done.map((it) => resolveLiveItem(it, metrics));
      const todoResolved = ws.todo.map((it) => resolveLiveItem(it, metrics));
      const doneItems = doneStatic.concat(todoResolved.filter((it) => it._done));
      const todoItems = todoResolved.filter((it) => !it._done);
      // Derive inflight from the live event store (inFlight items tagged for this workstream)
      const wsInflight = liveInFlight
        .filter((item) => item.roadmapWorkstream === ws.id && item.active === true)
        .map((item) => ({
          text:
            item.what + (item.owner ? ` — ${item.owner}` : "") + (item.due ? ` · ${item.due}` : ""),
          ref: item.id,
        }));

      const openBlockers = ws.blockers.filter((b) => !resolvedIds.has(b));
      const blockerChips = openBlockers
        .map((b) => `<span class="rm-blocker-chip">${esc(b)}</span>`)
        .join(" ");

      return `
        <div class="rm-workstream" id="${esc(ws.anchor)}">
          <div class="rm-ws-head">
            <span class="rm-ws-id">${esc(ws.id)}</span>
            <div>
              <div class="rm-ws-name">${esc(ws.label)}</div>
              <div style="font-size:11.5px;color:var(--text-secondary);margin-top:2px">${esc(ws.sublabel)}</div>
            </div>
            <div class="rm-ws-owner">${esc(ws.owner)}</div>
          </div>
          <div class="rm-ws-body">
            <details class="rm-panel" open>
              <summary>
                <span class="rm-panel-badge done">✓ Done</span>
                Past milestones
                <span class="rm-panel-count">${doneItems.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(doneItems, "icon-done", "✓")}</ul>
              </div>
            </details>
            <details class="rm-panel" open>
              <summary>
                <span class="rm-panel-badge inflight">⟳ In flight</span>
                Active work
                <span class="rm-panel-count">${wsInflight.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(wsInflight, "icon-inflight", "⟳")}</ul>
              </div>
            </details>
            <details class="rm-panel">
              <summary>
                <span class="rm-panel-badge todo">→ To do</span>
                Forward queue (sequenced)
                <span class="rm-panel-count">${todoItems.length} items</span>
              </summary>
              <div class="rm-panel-body">
                <ul class="rm-items">${itemsHtml(todoItems, "icon-todo", "→")}</ul>
              </div>
            </details>
            ${
              openBlockers.length
                ? `<div class="rm-blockers">
                    <span class="rm-blocker-label">Open blockers</span>
                    ${blockerChips}
                  </div>`
                : ""
            }
          </div>
        </div>
      `;
    }).join("");
  }

  // ── Render CEO queue ─────────────────────────────────────────────────────

  function renderCeoQueue(decisionsOpen) {
    const tbody = document.getElementById("rm-queue-body");
    if (!tbody) return;
    const items = Array.isArray(decisionsOpen) ? decisionsOpen : [];
    if (!items.length) {
      tbody.innerHTML = `<tr><td colspan="4" class="rm-empty">No open decisions found.</td></tr>`;
      return;
    }
    tbody.innerHTML = items
      .map(
        (d) => `<tr>
          <td><code>${esc(d.id)}</code></td>
          <td>${esc(d.title)}</td>
          <td>${esc(d.owner ?? "–")}</td>
          <td>${esc(d.category ?? "–")}</td>
        </tr>`,
      )
      .join("");
  }

  // ── Main fetch + render ──────────────────────────────────────────────────

  async function refreshAll() {
    let state = null;
    try {
      const res = await fetch("/api/state");
      if (res.ok) state = await res.json();
    } catch {
      // fall through — render with nulls
    }

    const inFlight = state?.inFlight ?? [];
    const decisionsOpen = state?.decisionsOpen ?? [];
    const decisionsResolved = state?.decisionsResolvedSeed ?? state?.decisionsResolved ?? [];
    // Canonical live counts are nested under bank.metrics (see derive.ts).
    const metrics = state?.bank?.metrics ?? null;

    // Stat cards
    setMetric(
      "rm-resolved",
      decisionsResolved.length || "–",
      decisionsResolved.length ? "green" : "muted",
    );
    setMetric("rm-open", decisionsOpen.length || "–", decisionsOpen.length > 0 ? "amber" : "muted");
    setMetric("rm-inflight", inFlight.filter((w) => w.active !== false).length || "–", "muted");

    // Canonical counts live under bank.metrics; fall back to legacy shapes.
    const procedureCount =
      metrics?.proceduresPopulated ??
      state?.procedures?.populated ??
      state?.proceduresPopulated ??
      null;
    const obligationsCount =
      metrics?.obligations ?? state?.obligations?.total ?? state?.obligationsTotal ?? null;
    const policiesCount =
      metrics?.policies ?? state?.policies?.total ?? state?.policiesTotal ?? null;

    setMetric("rm-procedures", procedureCount != null ? String(procedureCount) : "103+", "muted");
    setMetric(
      "rm-obligations",
      obligationsCount != null ? String(obligationsCount) : "224+",
      "muted",
    );
    setMetric("rm-policies", policiesCount != null ? String(policiesCount) : "112+", "muted");

    const resolvedIds = new Set(decisionsResolved.map((r) => r.id ?? r));
    renderWorkstreams(resolvedIds, inFlight, metrics);

    // CEO queue
    renderCeoQueue(decisionsOpen);

    // Update as-of timestamp
    const asOf = document.querySelector("[data-shell-asof]");
    if (asOf) {
      const now = `${new Date().toISOString().slice(0, 16).replace("T", " ")}Z`;
      asOf.textContent = `as of ${now}`;
    }
  }

  // Run on load + wire refresh button + 30 s auto-refresh
  // Authority: D-DATA-QUALITY-GOLDEN-SOURCE-V1 Slice 4 — stale-page recon gate
  refreshAll();
  document.addEventListener("shell:refresh", refreshAll);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refreshAll();
  });
  setInterval(refreshAll, 30_000);
})();
