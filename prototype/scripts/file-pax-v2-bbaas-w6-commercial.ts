// scripts/file-pax-v2-bbaas-w6-commercial.ts
//
// One-shot RMS Phase 3 filing for PAX's W6 commercial and market analysis
// paper for the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits
// a RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: PAX (Role researcher)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:pax:v2-bbaas-w6-commercial:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-pax-v2-bbaas-w6-commercial] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W6 commercial: competitor landscape, tiers, pricing, market entry

**Author:** PAX (Role researcher) — Research seat
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12); builds on the session-1
initial ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12, §§2, 7,
9.2, 9.4) and the W2 domain map
(record:documents:atlas:v2-bbaas-w2-domain-map:2026-06-12 — the 25 domains and the C/R/K
tier column used throughout this paper).
**Audience:** Marc (CEO)
**Status:** W6 analysis deliverable of the WS-V2-BBAAS structural analysis. Market data is
sourced from public web research at authoring time and cited inline with URLs; pricing
figures for competitors are signals, not quotes — enterprise banking software is
custom-negotiated and public numbers are directional at best. Nothing here is a decision;
§6 names the decisions this paper tees up.

---

## 1. Competitor landscape

BBaaS straddles two markets that today are sold separately: **core-banking SaaS** (the
operational substrate) and **regulatory reporting / RegTech** (the compliance overlay). No
vendor in either market sells what the backbone is: a single substrate in which the
operations *are* the compliance evidence. The landscape below is organised around that
claim, and each vendor is scored against the four BBaaS differentiators:

- **D1 — events-as-truth audit trail.** State is a pure function of an append-only log;
  audit, replay, and regulator inspection are operations on one durable artefact.
- **D2 — cited regulation-to-code graph.** Every operational behaviour traces upward to a
  regulatory provision and every provision traces downward to running code (Plane A /
  Plane B, the bridge edges as the subscription contract).
- **D3 — standing recon harness.** 200+ continuously-running pipelines that re-derive
  compliance from first principles; "are we compliant, right now, provably?" answered
  mechanically every day.
- **D4 — autonomous agent workforce.** Seats, briefs, run lifecycles, decision authority
  routing — the labour layer ships with the platform.

### 1.1 Core-banking SaaS

**Temenos** (Transact / Temenos SaaS). The incumbent at global scale: ~3,000 financial
institutions, the most complete functional footprint, increasingly sold as SaaS on public
cloud. Pricing signals: an estimated average annual software licence around USD 518k per
client, with entry-level contracts for mid-market banks commonly cited at USD 150k–250k per
year, before implementation (which routinely exceeds licence cost)
(https://www.openbankingtracker.com/banktech-providers/temenos;
https://sdk.finance/blog/how-much-does-temenos-core-banking-software-cost/). Against the
differentiators: ledger-centric mutable-state architecture (no D1); regulatory content is
partner-delivered (notably the long-standing Temenos–Wolters Kluwer OneSumX integration
for reg reporting — compliance is an *adjacent product*, not the substrate) (no D2, no D3);
no agent workforce (no D4). Temenos sells functionality; assurance is the customer's
problem.

**Thought Machine** (Vault Core / Vault Payments). The architectural high-end of the
cloud-native generation: smart-contract product definitions, strong configurability, real
tier-1 logos. Pricing signals: higher setup cost than peers, positioned for banks that can
fund bespoke build (https://www.peerspot.com/products/comparisons/mambu_vs_thought-machine).
Vault's ledger is append-friendly internally but the product surface is core processing,
not assurance: no citation graph, no recon harness, no agent layer. Closest of the cohort
to D1 in spirit; sells none of D2–D4.

**Mambu.** The volume leader of cloud-native cores by mind share (~16.5% as of late 2025,
the largest single share in the category —
https://www.peerspot.com/categories/core-banking-software), composable SaaS, fast
time-to-market, consumption-based pricing, dominant among neobanks and lenders. Mambu's
pitch is speed and cost, explicitly *not* depth: regulatory reporting, risk engines, and
compliance are ecosystem integrations. No D1–D4.

**10x Banking** (10x Banking platform, ex-SuperCore). Cloud-native core founded by a former
Barclays CEO; the directly relevant fact for this analysis is that **10x built OM Bank's
substrate**: Old Mutual partnered with 10x from 2016 and spent a cumulative R2.8 billion
from 2022–2024 building the bank and securing its licence
(https://en.wikipedia.org/wiki/OM_Bank;
https://businesstech.co.za/news/banking/834347/the-south-african-giant-that-sold-a-bank-then-spent-r3-billion-to-launch-a-new-one/).
That number is the single most useful commercial anchor in this paper: it is what a
well-funded SA new entrant pays today for a core + build programme that still leaves
compliance, returns, risk models, and the entire control workforce as separate costs. No
D1–D4.

**nCino.** Not a core — a bank operating system for lending/onboarding built on
Salesforce — but commercially instructive: nCino has migrated from per-seat to
platform/asset-based pricing, with roughly 38% of ACV moved away from seat-based pricing
by end of fiscal 2026 and all new and renewal deals priced on assets under management from
February 2025
(https://www.fool.com/earnings/call-transcripts/2026/04/01/ncino-ncno-q4-2026-earnings-call-transcript/).
The lesson for §3: even the flagship "seats" vendor in banking software concluded that
seats under-monetise as automation rises — pricing must attach to the value base, not the
human headcount. No D1–D4.

**FIS / Fiserv** (briefly). The US-scale processors; Fiserv's cloud-native core is
**Finxact**, consumption-priced
(https://aws.amazon.com/marketplace/pp/prodview-7f6ou5paz6itm), and notably **FirstRand
selected Finxact** for its core modernisation — the most consequential recent core decision
inside SA's big four
(https://www.fintechfutures.com/core-banking-technology/south-african-banking-group-firstrand-selects-fiserv-s-finxact-core-banking-system).
Signal: even SA tier-1 banks now buy foreign SaaS cores; the procurement door for
cloud-delivered substrate is open in this market. No D1–D4.

### 1.2 Regulatory reporting / RegTech

**Wolters Kluwer OneSumX.** The reference reg-reporting suite: modular (separate modules
per framework — Basel, IFRS, local returns), licence plus usage-based elements, annual
costs ranging roughly USD 50k–500k+ depending on reporting complexity and volume, with
material implementation cost on top and multi-year discounts of 10–20%
(https://www.vendr.com/marketplace/wolters-kluwer; https://aidoos.com/products/wolters-kluwer-onesumx/).
Critically: Wolters Kluwer has agreed to sell the entire Finance, Risk and Regulatory
Reporting unit **to Regnology**, expected to close fall 2025
(https://www.wolterskluwer.com/en/solutions/onesumx-for-finance-risk-and-regulatory-reporting).
OneSumX takes the bank's data as given and renders returns; it cannot prove the data, has
no citation chain below the form cell, no recon harness, no agents. Partial D2 at the
form-template level only.

**Regnology.** The consolidation story of the category. In ~18 months Regnology has
acquired **Vermeg's AGILE division** (announced November 2024, 150+ bank customers —
https://www.businesswire.com/news/home/20241124525888/en/Regnology-Acquires-VERMEGs-RegTech-Division-AGILE-to-Solidify-Position-as-Global-Market-Leader),
**Moody's ALM & regulatory reporting business**, and now the **Wolters Kluwer FRR/OneSumX
unit**. Post-close, Regnology is the default global reg-reporting vendor — a
template-and-filing factory at enormous scale, increasingly also selling to regulators
themselves (the "RegTech meets SupTech" angle). What the roll-up does *not* produce is any
of D1–D4: gluing three template libraries together deepens the moat around forms, not
around proof. The roll-up simultaneously (a) validates that reg-reporting spend is large
and consolidating, and (b) creates exactly the slow-moving, integration-burdened incumbent
a substrate-level product differentiates against.

**Moody's (ex-AxiomSL ControllerView).** AxiomSL's data-lineage-conscious
risk-and-reporting platform went to Adenza (with Calypso), thence into Nasdaq; Moody's own
ALM/reg-reporting line has gone to Regnology. The churn matters more than the assets: the
category is being traded between financial-data conglomerates as a *content business*.
Lineage in these platforms is data-pipeline lineage (cell to source feed), not
regulation-to-code citation; strongest partial-D2 of the incumbents, still no D1/D3/D4.

**Suade Labs.** The closest *conceptual* neighbour: API-first "RegTech-as-a-Service",
founded 2014, built around a standardised regulatory data model (FIRE) and
regulation-as-code ambitions, NLP/ML over regulatory text, popular with UK challengers
(https://suade.org/introduction-to-suade/;
https://relevant.software/blog/suade-labs-discusses-all-things-regtech/). Suade proves the
buyer exists for "regulation as a programmable artefact". But Suade consumes the bank's
data and returns calculations; it does not run the bank, hold the event log, operate the
controls, or staff the seats. Partial D2; no D1, D3, D4.

**Vermeg AGILE.** Now inside Regnology (above); pre-acquisition it was the UK/EU
template-coverage leader from the FRSGlobal lineage. Same profile: forms, not proof.

### 1.3 The white space

Arrange the two columns and the gap is geometric:

| | Operations (core) | Compliance evidence |
|---|---|---|
| Core-banking SaaS (Temenos, TM, Mambu, 10x, Finxact) | sells this | externalises this |
| RegTech (Regnology-OneSumX-AGILE, Moody's, Suade) | externalises this | sells this (as forms) |
| **BBaaS** | **one substrate** | **same substrate** |

Every vendor above sells either functionality without proof, or proof-shaped documents
without the functionality that generates them. The seam between the two — the
reconciliation projects, the data-lineage programmes, the "get the data to the reg
platform" ETL estates, the armies of humans who attest that system A's numbers are what
system B reported — is where banks actually spend, and it exists *because* the two markets
are separate. Nobody sells **provable continuous compliance and operations as one
substrate**, because nobody else's architecture can: without events-as-truth there is
nothing to replay; without the citation graph there is nothing to trace; without the recon
harness there is no standing proof; without the agent workforce the marginal cost of
operating the controls stays human-shaped. The four differentiators are not features on a
comparison chart; they are one property (assurance-native architecture) that incumbents
cannot retrofit without becoming a different product. The W2 finding that the
shared/tenant seam runs through all 25 domains in the same place is the engineering form
of this commercial claim.

Honest qualifier: the white space is partly white because regulators have not yet been
asked to accept it (§5.1), and partly because banks buy conservatively (§5.4). White space
is a necessary, not sufficient, condition.

## 2. Packaging — three tiers against W2's 25 domains

The session-1 paper named the tiers; W2 assigned every domain a tier letter (C ⊃ R ⊃ K).
This section materialises them as products.

### 2.1 Tier contents

**Knowledge tier (K)** — "the regulatory brain". Six domains: Regulatory Knowledge &
Obligation Management (W2 #17 — Plane A, the obligation registers, adoption tooling);
Records & Document Management (#20); Decision Governance & Distillation (#21); Internal
Audit & Continuous Assurance (#22 — the harness and the recon pattern library); Event
Backbone & Tenant Composition (#23 — the substrate every tier stands on); Data Semantics &
Provenance (#25 — citable constants, provenance discipline). What the subscriber gets: the
maintained jurisdictional corpus (155+ instruments for SA), provision trees with
verbatim-hash drift detection, obligation adoption workflow, the typed-records substrate,
and the recon patterns to assert their own estate against. Buyer: head of compliance /
regulatory change at any bank, including tier-1s that would never replace their core.

**Risk-and-reporting tier (R)** — K plus the model library and the returns factory. Adds
eleven domains: Market Data Management (#3); Collateral Administration (#7); Market Risk
Models (#10); Credit Risk Models (#11); Risk Appetite & Limit Management (#12); ALM (#13);
Liquidity Risk & Funding (#14); Capital Adequacy & Stress Testing (#15); Regulatory
Reporting & Returns (#16); Conduct & Market Surveillance (#19); plus the Position Keeping
event contract (#6) as the **ingestion seam** — the bank keeps its own core and trading
systems and feeds positions/trades into the backbone's event contract (W2 §4.2). What the
subscriber gets: every number on every return computed by a cited model from replayable
events, with the recon harness standing over the whole chain — OneSumX-class scope with
proof attached. Buyer: CRO/CFO office of any bank; the direct competitive collision with
Regnology happens here, on purpose.

**Comprehensive tier (C)** — the full backbone. Adds the remaining eight operational
domains: Party Reference Data (#1); Product Directory (#2); Payment Order & Execution
(#4); Trade Booking & Post-Trade (#5); Position Keeping natively (#6); Financial
Accounting (#8); Product Control & P&L (#9); Customer Due Diligence (#18); and the full
Agent Workforce & Dispatch (#24 — R-tier gets assurance/reporting seats only; C gets the
whole labour layer). What the subscriber gets: a bank. Buyer: new entrants, mutual and
co-operative banks, and small commercial banks for whom running any in-house estate is the
anomaly. W2's gap list (G1–G12: lending, deposits at scale, channels, cards…) binds only
this tier's claim to full core replacement for retail banks; the honest C-tier pitch today
is "everything a wholesale/treasury-led bank needs, lending and channels on the roadmap
against the anchor tenant's licence-day needs".

### 2.2 Upgrade paths

The tiers nest by construction, so upgrades are subscription events, not migrations —
this is a genuine structural advantage over every competitor, for whom tier boundaries
are product boundaries:

- **K → R**: the subscriber's adopted obligations (K-tier events) become the citation
  targets of the models they switch on; market-data feeds and position ingestion are the
  only new integration work. Their compliance corpus is already in place.
- **R → C**: the position-feed seam inverts — instead of feeding positions in, the
  backbone originates them. Because R-tier subscribers already express their state as
  backbone events at the seam, the cutover is domain-by-domain (payments first, accounting
  last, or vice versa), not big-bang. Gartner-class research has ~50% of conventional core
  transformations failing or abandoned (https://www.ispirer.com/blog/core-banking-system-migration);
  a domain-at-a-time path over an event seam the bank already operates is the direct
  answer to that statistic in a sales conversation.
- **Downgrade/exit**: events-as-truth makes exit honest — the tenant's log is theirs,
  complete and replayable. An honest exit story is itself a differentiator in bank
  procurement (§5.4), where vendor lock-in is a named due-diligence item.

### 2.3 What the anchor tenant proves, per tier

- **For K:** the corpus is real and load-bearing — the anchor's 1,000+ adopted
  obligations, the source-extract quality gates, the BA-numbering incident-and-correction
  arc (the *lesson* is a sales asset: the platform detects fabricated reference knowledge
  mechanically).
- **For R:** every BA return the anchor files is rendered from RwaComputed-class events of
  record, recon-gated end to end; the anchor's supervisory interactions with the PA are the
  reference-visit material.
- **For C:** the anchor *is* a C-tier tenant — a licensed bank whose entire operation runs
  on the backbone with a statutory-minimum human staff. No competitor can say "our first
  customer is a bank we run"; this is the proof artefact the whole go-to-market rests on.

## 3. Pricing hypotheses

### 3.1 The candidate axes, examined

**Per-domain subscription.** Price each of the 25 domains (practically: the three bundles,
with à-la-carte domain add-ons inside R and C). For: matches the unit of value and the
unit of architecture (W2 made domains the subscription unit); comparable to how OneSumX
sells modules per framework; predictable for the buyer. Against: on its own it
under-prices heavy users and over-prices small ones — needs a scaling factor.

**Per-seat — agent seats.** Price the labour layer: each activated functional seat
(Risk Engineer seat, Treasurer seat, CCO seat…) is a line item. For: this is the
category-defining axis — nobody else *can* sell seats whose occupant is software, and the
buyer's mental comparator is a salary (a human treasury analyst costs a bank far more per
year than any plausible seat fee), which makes the value story arithmetic; it also scales
naturally with tier (R-tier gets assurance seats, C-tier the full roster). Against: nCino
just spent two years walking *away* from seat pricing because automation shrinks seat
counts and decouples seats from value
(https://www.fool.com/earnings/call-transcripts/2026/04/01/ncino-ncno-q4-2026-earnings-call-transcript/);
pure seat pricing also perversely penalises the platform for making seats more capable.

**Per-recon-coverage.** Price on assurance delivered: number of standing recon pipelines
active, obligations covered by enforcing gates, percentage of adopted obligations with
green IMPLEMENTED_BY chains. For: prices the differentiator itself; aligns vendor
incentive with subscriber assurance; auditable from the platform's own registers
(coverage numbers are projections, so the invoice is itself recon-derivable — a pleasing
property). Against: novel metrics scare procurement; it can perversely incentivise gate
inflation; and coverage is partly a function of the *tenant's* adoption choices, making
the bill feel out of the buyer's control.

**Per-return filed.** Price per regulatory return rendered/submitted per period. For:
simple, legible, directly comparable to reg-reporting bureau pricing. Against: returns are
a tiny fraction of delivered value (the standing harness runs daily; returns are
monthly/quarterly artefacts of it); per-unit return pricing invites comparison with
form-factories on the form-factory's terms — strategically self-defeating.

**The cost floor — model-API token spend.** The real v1 cost driver is Anthropic API
spend (the largest current cost in the build phase). Current public list pricing
(https://platform.claude.com/docs/en/about-claude/pricing): roughly USD 1/5 per million
input/output tokens for the Haiku class, 3/15 for the Sonnet class, 5/25 for the Opus
class, with batch processing at 50% and prompt caching cutting cached input ~90%. A
C-tier tenant's standing agent workforce (≈30 seats on daily-or-faster cadences, plus
event-triggered runs) is plausibly in the tens of millions to low hundreds of millions of
tokens per day depending on cadence design; at a cached-Sonnet-heavy blend that is order
USD 5k–40k per tenant-month, with K-tier tenants an order of magnitude lower (knowledge
queries, no operational loops). Two design consequences: (1) **the floor is real but not
scary** — even the high end is a rounding error against a USD 500k+ OneSumX-class licence
or one human FTE per seat; (2) **the floor is volatile in our favour** — per-token prices
have fallen with every model generation while capability rose, so margin on a
fixed-subscription price expands over time, but contracts must still carry a
token-pass-through or repricing clause for the tail risk (§5.3).

### 3.2 Recommended hybrid

**Base: per-domain tier subscription (annual, by tier and bank-size band). Plus: per
active agent seat. Plus: metered model-API consumption above a bundled allowance, at
cost-plus. Recon coverage and returns filed are reported as value evidence on every
invoice — but are not priced.**

Rationale: the domain-tier base captures the architecture's unit of value and gives
procurement a familiar shape (it reads like a OneSumX or Temenos SaaS line item, which is
what the buyer's benchmark file contains). Agent seats are the differentiated, expandable
axis — land with few seats, expand seat-by-seat as trust grows, each seat priced against
the salary it displaces rather than the software it resembles. Metered tokens above an
allowance protect the floor without making the bill unpredictable (the allowance is set so
~80% of tenants never hit it). Recon coverage appears on the invoice as *delivered
assurance* — "1,142 standing pipelines, 96.4% of adopted obligations gate-covered this
quarter" — because showing the meter without charging by it builds the very trust that
later supports premium pricing, while charging by it on day one invites gaming arguments.

Indicative anchors (hypotheses to test in anchor-tenant-adjacent conversations, not a
rate card): K tier USD 60–150k/yr (priced against a regulatory-change subscription plus a
compliance hire); R tier USD 250–600k/yr (priced against OneSumX-class licence + the
reconciliation humans it retires — the comparator band is USD 50k–500k+ licence *plus*
multiples of that in people); C tier USD 0.8–2.5m/yr all-in (priced against the
~USD 1m/yr average core contract (https://crassula.io/blog/how-much-core-banking-system-cost/)
*plus* the reg stack *plus* the operations staff — and against OM Bank's R2.8bn build as
the build-it-yourself alternative). Agent seats USD 30–80k/seat/yr depending on seat class
(assurance vs governance vs operational). All bands deliberately price *below* the sum of
the components they replace and *above* the component-vendor each line resembles —
the premium is the proof.

## 4. Market-entry sequencing

### 4.1 Stage 0 — anchor tenant proof (now → licence-day)

Everything sequences off the anchor: a SARB-licensed bank operating on the backbone with
statutory-minimum humans. The sales artefacts to manufacture deliberately along the way:
the licence-application pack itself (its citations are backbone projections), the PA's
supervisory correspondence, the first cycle of BA returns filed from events of record, and
a regulator-facing demonstration of the recon harness. Stage 0 exit criterion: licence
granted and first returns accepted.

### 4.2 Stage 1 — SA second tier, mutual/co-op banks, and new entrants

The home market is structurally receptive right now:

- **The PA is licensing again and open to tiering.** YWBN Mutual Bank was registered
  January 2024 — the first mutual licence in years — and the PA received five further
  applications in the same financial year, with its CEO publicly open to more tiering of
  bank licences (https://www.businessday.co.za/bd/economy/2024-08-08-sas-banking-regulator-open-to-more-tiering-of-bank-licences/;
  https://businesstech.co.za/news/business/760833/4-new-banks-launching-in-south-africa/).
- **Realistic named candidates.** Mutual banks: **YWBN** (new, building from scratch —
  the cleanest C-tier prospect in the country), **GBS Mutual Bank** and **Finbond Mutual
  Bank** (small balance sheets carrying full BA-return burdens — R-tier prospects where
  the compliance cost-to-income argument is sharpest), **Bank Zero** (already digital;
  K/R prospect). Co-operative banks and the proposed **SA Innovative Financial Services
  Cooperative (SAIFSC)** parliamentary initiative: a C-tier-shaped segment whose
  economics only work with a near-zero-staff operating model — arguably the purest BBaaS
  fit in existence. New entrants: the five pending applicants, plus the OM Bank cohort's
  successors — every future applicant faces the R2.8bn/10x-Banking build benchmark
  (https://businesstech.co.za/news/banking/834347/the-south-african-giant-that-sold-a-bank-then-spent-r3-billion-to-launch-a-new-one/)
  and a 3–4 year break-even horizon; the pitch "your licence application *is* a backbone
  projection, your day-one bank costs a subscription not a build programme" attacks both
  numbers at once.
- **Even SA tier-1s are buying cloud substrate** (FirstRand → Finxact), which normalises
  the procurement category for everyone below them.

Stage 1 target shape: 1–2 R-tier logos (Finbond/GBS-class) + 1 C-tier new entrant or
mutual within the first two agent-years after licence-day. SA also has a unique selling
asset: every prospect files the *same* BA returns the anchor files — the corpus is 100%
reusable, the reference is 100% relevant.

### 4.3 Stage 2 — first offshore jurisdiction: the UK, with UAE as fast-follow

Criteria: (a) regulator posture toward agent-operated controls; (b) corpus build cost
(W2's proven "2 artefacts, ~0 code" pattern per regulator); (c) market size and buyer
density. Candidates examined:

- **UK — recommended.** Posture: the FCA/PRA/Bank of England approach is explicitly to
  supervise AI through *existing* frameworks (SM&CR, model risk management) rather than
  bespoke AI rules, and the FCA launched **AI Live Testing** in April 2025 — a voluntary
  scheme to trial AI solutions in a live, supervised environment — plus an FCA/BoE AI
  Consortium (https://www.fca.org.uk/firms/innovation/ai-approach;
  https://www.bankofengland.co.uk/financial-stability-in-focus/2025/april-2025). The
  regulators' own survey shows 55% of AI use cases already involve some autonomous
  decision-making (2% fully autonomous) — the supervisory conversation about autonomy is
  *already happening*, and AI Live Testing is a literal, named channel through which
  agent-operated controls can be demonstrated to the regulator rather than argued in the
  abstract. Corpus cost: moderate — PRA Rulebook + Basel-aligned reporting where the BCBS
  Plane-A layer already built for SA carries over (the EQUIVALENT_TO machinery exists);
  English-language sources; no OCR-class extraction problem. Market: the deepest pool of
  challenger banks and new licences in any single English-speaking jurisdiction, a proven
  RegTech buyer (Suade's home market), and reg-reporting spend already being disrupted.
  Risks: crowded, and the PRA's intensity raises the proof bar — but that bar is the moat
  once cleared.
- **UAE — strong second, sequence as fast-follow.** The CBUAE/SCA/DFSA/FSRA jointly issued
  Enabling Technologies guidelines and the CBUAE has published responsible-AI guidance for
  the financial sector; DFSA reports generative-AI usage in firms up 166% year-on-year;
  open finance is mandated and live
  (https://www.dfsa.ae/news/uae-regulatory-authorities-jointly-issue-guidelines-financial-institutions-adopting-enabling-technologies;
  https://www.pinsentmasons.com/out-law/news/uae-central-bank-responsible-ai-guidance-financial-sector).
  ADGM/DIFC are common-law, English-language, innovation-courting financial centres with
  active new-licence flow. Corpus cost: low-moderate (Basel-aligned, English rulebooks).
  Smaller market than the UK, but plausibly *faster* to a paying logo; ideal second
  jurisdiction once the UK corpus proves the replication pattern.
- **Nigeria / Kenya — not first, watch closely.** Nigeria's CBN has gone furthest of any
  regulator examined toward *mandating* AI: automated AML monitoring is now required, with
  an 18-month deployment deadline for banks and a "test-then-codify" posture on AI rules
  (https://techcabal.com/2026/03/12/cbn-wants-ai-to-fight-money-laundering/;
  https://www.financemagnates.com/fintech/ai-joins-africas-rulebook-as-nigeria-orders-automated-aml-gives-fintechs-2-years-to-comply/)
  — a regulator *requiring* what BBaaS sells. Kenya has a National AI Strategy 2025–2030
  and the CBK is modernising its Acts (https://practiceguides.chambers.com/practice-guides/fintech-2026/kenya).
  Both have large bank populations and real compliance-cost pain; both are weaker on
  pay-capacity per institution and (for Nigeria) FX/repatriation friction. The right
  instrument is a K-tier (corpus + obligation tooling) entry priced for the market,
  possibly partner-delivered — not a C-tier push. Sequence after the UK pattern is proven.

**Recommendation: anchor (SA) → SA second-tier/mutual/new-entrant cohort → UK → UAE →
Nigeria/Kenya K-tier.** One jurisdiction at a time, each entered corpus-first (the
"2 artefacts, ~0 code" pattern means jurisdiction entry is a content programme, not an
engineering programme — the inverse of every competitor's cost structure).

## 5. What would kill it

**5.1 Regulators refuse agent-operated controls.** The existential risk. A PA (or
FCA/CBUAE) position that key controls require human operators would gut Principle 6 and
the C-tier. Mitigations: the anchor tenant exists precisely to settle this with the home
regulator first, inside a licence process where every question gets answered with a
projection; the architecture keeps humans-oversee-the-residual as a first-class typed
channel (escalations, decision authority routing), so the regulatory ask is "approve this
specific human-oversight topology", never "trust the robots"; choose jurisdiction 2 (UK)
where a named supervised channel (AI Live Testing) exists for exactly this conversation;
and the K/R tiers are deliberately sellable *without* any agent-operated-controls
acceptance — the kill scenario degrades the company to a smaller, still-viable one rather
than to zero.

**5.2 Incumbent switching costs and the consolidated giant.** Core deals run a decade;
50% of core transformations fail (https://www.ispirer.com/blog/core-banking-system-migration),
which makes banks *more* conservative, not less; and Regnology is rolling up the entire
reg-reporting category (AGILE + Moody's unit + OneSumX) into a vendor with every
template and every regulator relationship. Mitigations: don't fight the core-replacement
war — Stage 1/2 targets are new entrants and R-tier overlays where the incumbent contract
is irrelevant or expiring; the R-tier ingestion seam is designed so the bank keeps its
core; the upgrade path (§2.2) converts overlay tenants to substrate tenants
domain-by-domain on the tenant's clock. Against Regnology specifically: never compete on
template count; compete on proof — the roll-up cannot retrofit D1–D4 without rebuilding
on a different architecture, and integration of three acquired stacks will consume their
roadmap for years.

**5.3 Model-provider dependency and token economics.** The platform's labour layer runs on
one vendor's API; a 10x price move, a capability regression, a terms change (e.g.
restrictions on financial-services autonomy), or an outage SLA mismatch all transmit
directly into tenant operations. Mitigations: contracts carry token pass-through/repricing
clauses (§3.1) so price risk is shared, not absorbed; the agent substrate's
provider-facing surface is already narrow (briefs, runs, typed events — the substrate is
provider-agnostic by construction, the seats' prompts/playbooks are the porting cost);
maintain a tested second-provider fallback for the assurance-critical seat classes before
any C-tier tenant goes live; cache-and-batch discipline (90%/50% levers) keeps the floor
low enough that margin survives adverse moves. Residual risk is real and should be
disclosed to tenants as a named dependency, the way banks disclose cloud concentration.

**5.4 Bank trust and procurement cycles.** Banks buy slowly, from vendors with balance
sheets, references, SOC reports, and exit plans; a single-product startup selling "we
replace your compliance department" triggers every procurement antibody. Mitigations: the
anchor tenant collapses the reference problem (the first reference is a *regulator-
supervised bank*); the K tier is a low-risk, low-integration first purchase that starts
the trust clock without touching operations; events-as-truth gives the cleanest exit/
escrow story in the industry (the tenant's log is complete, portable, replayable);
outsourcing-regulation compliance (the W7 paper's subject) is built into the offering
rather than negotiated per deal; and pricing's value-evidence-on-every-invoice (§3.2) is
designed to compound trust quarterly.

**5.5 Single-founder key-person risk.** Today the company is one human CEO plus an agent
workforce; every supervisor, investor, and procurement committee will name this. The
build-phase reality (Marc's attention is the binding resource) is also the commercial
bottleneck: enterprise bank sales need humans in rooms. Mitigations: the platform's own
records substrate is the institutional-memory hedge (the bus-factor on *knowledge* is
already near zero — everything is events, decisions, and distilled registers; a new
principal could replay the company); licence-day already mandates a 5–10 human statutory
core for the anchor — sequence the commercial hires (a sales/regulatory-affairs principal
first) on the same clock; and the W8 agent-learning architecture progressively shrinks
the set of decisions only Marc can take, with the decision-authority routing table as the
measurable artefact of that shrinkage.

Ranked: 5.1 and 5.3 are existential-class (acceptance and substrate dependency); 5.2 and
5.4 are growth-rate risks; 5.5 is a financing/procurement risk that compounds the others
until staffed.

## 6. Named decisions / asks for the CEO

1. **D-V2-BBAAS-TIER-STRUCTURE (proposed).** Adopt K/R/C as the productised tier
   structure per §2 (contents, nesting, upgrade paths), as the frame for all subsequent
   commercial artefacts. Cheap to adopt now, expensive to churn later — every W4/W7
   output references it.
2. **D-V2-BBAAS-PRICING-HYPOTHESIS (proposed).** Adopt §3.2's hybrid (domain-tier base +
   agent seats + metered tokens above allowance; coverage/returns as value evidence, not
   meters) as the *working hypothesis* to be tested in Stage-1 conversations — explicitly
   revisable on first-tenant evidence.
3. **D-V2-BBAAS-ENTRY-SEQUENCE (proposed).** Adopt §4's sequencing: anchor → SA
   second-tier/mutual/new-entrant cohort → UK → UAE → Nigeria/Kenya K-tier; commit corpus
   investment in jurisdiction 2 (UK) only after Stage-1 first external logo, except for
   the low-cost step of registering for FCA AI Live Testing observation/participation,
   which has a calendar of its own and should be investigated now.
4. **Ask: second-provider fallback gate.** Direct the substrate roadmap (Atlas, Core
   banking platform architect, engineering) to include a tested second-model-provider
   fallback for assurance-critical seat classes as a pre-condition to any external C-tier
   tenant go-live (§5.3). This is a small standing workstream now versus an existential
   scramble later.
5. **Ask: commercial principal timing.** A decision on when the first human commercial/
   regulatory-affairs hire is sequenced (licence-day cohort vs earlier), given §5.5 —
   PAX can run the role-definition research on request; the hire itself is a licence-day-
   class spend decision.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W6 deliverable of the
v2 structural analysis under D-V2-BBAAS-W4-W7-DISPATCH.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W4-W7-DISPATCH"],
    actor: {
      type: "service",
      id: "agent:pax:research",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "V2 BBaaS — W6 commercial: competitor landscape, tiers, pricing, market entry",
      path: "2026-06-12_pax_v2-bbaas-w6-commercial.md",
      category: "strategy-analysis",
      author: "PAX (Role researcher)",
      date: "2026-06-12",
    },
  },
  clock.now(),
);

console.log(
  JSON.stringify(
    {
      ok: true,
      eventId: result.eventId,
      documentHash: result.documentHash,
      isNewDocument: result.isNewDocument,
    },
    null,
    2,
  ),
);
