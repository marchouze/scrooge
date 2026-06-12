// scripts/file-owen-v2-bbaas-w7-vendor-perimeter.ts
//
// One-shot RMS Phase 3 filing for Owen's W7 vendor-regulatory-perimeter
// paper for the v2 "Bank Backbone as a Service" (BBaaS) repositioning. Emits
// a RecordFiled event so the Documents register holds the canonical paper.
// The body is embedded inline (Phase 4 — D-RMS-PHASE-4 — made the
// content-addressed document store the canonical home; no in-tree root
// render is created). Idempotent — skips if already filed.
//
// Authority: D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12);
// D-RMS-PHASE-3 (active).
// Author: Owen (Company Secretary, governance), covering Legal scope
// (Imani, legal counsel)

import "../platform/event-store/resolve-event-db-boot";

import { clock, eventStore } from "../platform/composition";
import { recordFiled } from "../platform/records";

const RECORD_ID = "record:documents:owen:v2-bbaas-w7-vendor-perimeter:2026-06-12";

const alreadyFiled = [...eventStore.replay({ type: "RecordFiled" })].some(
  (e) => (e.payload as { recordId?: string }).recordId === RECORD_ID,
);

if (alreadyFiled) {
  console.log(`[file-owen-v2-bbaas-w7-vendor-perimeter] ${RECORD_ID} already filed — skipping.`);
  process.exit(0);
}

const body = `# V2 BBaaS — W7 vendor regulatory perimeter: outsourcing obligations, entity structure, learning law bounds

**Author:** Owen (Company Secretary, governance), covering Legal scope (Imani, legal counsel)
**Date:** 2026-06-12
**Authority:** D-V2-BBAAS-W4-W7-DISPATCH (CEO-approved 2026-06-12); builds on the session-1
initial ideas paper (record:documents:atlas:v2-bbaas-initial-ideas-paper:2026-06-12, §9.3),
the W3 tenancy architecture (record:documents:atlas:v2-bbaas-w3-tenancy-architecture:2026-06-12,
§2.2), and the W8 agent-learning paper
(record:documents:atlas:v2-bbaas-w8-agent-learning:2026-06-12, §8)
**Audience:** Marc (CEO)
**Status:** Analysis only. Nothing here incorporates an entity, signs a contract, or files
anything with a regulator. §6 names the decisions and corpus-acquisition follow-ons; they are
Marc's to take or refuse. Build-phase honesty applies throughout: external counsel ratifies
the entity-structure and licensing conclusions at the licence-application moment.
**Primary-source discipline:** the in-repo Regulations/ corpus was worked first. Every
operative requirement in §1 is quoted from a corpus-held instrument
(Regulations/Banks/source-docs/banks-gn5-2014.txt, banks-d3-2018.txt, banks-gn5-2018.txt;
Regulations/Joint-Standards/js-2-of-2024-cyber.md; Regulations/Information-Regulator/popia.md;
Regulations/FSCA/source-docs/fais-act-37-2002.txt). Instruments NOT held in corpus are flagged
inline and collected as acquisition follow-ons in §6.2.

---

## 0. The one-paragraph answer

BBaaS the vendor needs **no licence of its own** on any perimeter checked (§3) — but it is
**regulated through every subscriber's contract**. A South African subscriber bank that runs
its general ledger and regulatory returns on BBaaS is outsourcing what the Prudential
Authority explicitly names as the functions it "would prefer ... not be outsourced" — core
banking IT and the financial-reporting IT system — which sit in the **prior-written-approval
class**, not the mere-notification class (Guidance Note 5/2014 §4.4, §5.1(j)). That single
fact shapes the whole commercial architecture: the master agreement must hand the
subscriber's regulator audit and on-site access rights over *us*, the W3 per-tenant stores
are what makes the residency commitments signable, events-as-truth is what makes the
mandatory exit/portability clause unusually easy to honour, and our model-API providers
(Anthropic and peers) are sub-outsourcers we must disclose and answer for. The anchor tenant
being our own bank converts the arrangement into related-party outsourcing under the same
instruments ("insourcing" in GN5/2014 terms), which argues for a vendor entity *outside* the
bank's controlling-company consolidation perimeter, contracting at arm's length (§4).
Cross-tenant learning survives competition-law and POPIA scrutiny precisely because of the
W3/W8 generalisation gate — provided the gate's blocklist is extended to competitively
sensitive information as a named class (§5).

## 1. Subscriber-bank outsourcing obligations

### 1.1 The instrument set (as held in corpus)

The PA's outsourcing framework for banks is not a single standard; it is a lattice anchored
in the Regulations relating to Banks and elaborated through s.6(5) guidance notes and s.6(6)
directives under the Banks Act 94 of 1990:

| Instrument | Status in corpus | Role |
|---|---|---|
| Banks Act 94 of 1990 + Regulations relating to Banks (Reg 38(4)(e), 39(3)(p), 39(4), 48(1)(c)(i)) | HELD (Regulations/SARB-PA/banks-act.md; source-docs/rrb-structured.json) | Statutory root: governance, risk-management, PA enforcement lever |
| **Guidance Note 5/2014** — "Outsourcing of functions within banks" (G5/2014, 2014-07-08, replaces GN3/2008) | HELD (banks-gn5-2014.txt, full text) | The operative outsourcing code: materiality test, key requirements, contract minimums, supervisory access |
| **Directive 3/2018** — "Cloud computing and the offshoring of data" (D3/2018, s.6(6) — binding) | HELD (banks-d3-2018.txt, full text) | Binding conditions for cloud use and any offshore storage/processing of data |
| **Guidance Note 5/2018** — "Cloud computing and the offshoring of data" (G5/2018) | HELD (banks-gn5-2018.txt, full text) | Interpretive companion to D3/2018; board ultimate-responsibility framing |
| **Joint Standard 2 of 2024** — Cybersecurity and cyber resilience | HELD (Regulations/Joint-Standards/js-2-of-2024-cyber.md + js2-structured.json) | Third-party cyber risk assessed pre-engagement and continuously; material outsourcing aligned with D3/2018 |
| **Joint Standard 1 of 2023** — IT governance and risk management (effective 2024-11-15) | **NOT HELD — acquisition follow-on (§6.2)** | Oversight of outsourced/third-party IT dependencies for all financial institutions |
| **Joint Standard 1 of 2024** — Outsourcing by insurers (effective 2024-12-01) | **NOT HELD — acquisition follow-on (§6.2)** | Does not bind banks, but is the PA/FSCA's most modern outsourcing text and the likely template for any future banks equivalent — comparator value |

The lattice's statutory root matters for enforcement: Regulation 39(3)(p) makes "risk arising
from the outsourcing of material business activities and functions" an explicit
board-governed risk class, and Regulation 38(4)(e) gives the PA the power — quoted at
GN5/2014 §5.3 — to "require the bank to make alternate arrangements for the outsourced
activity or function as soon as reasonably possible" if it judges the risk unmanaged. That is
the kill switch over every BBaaS subscription, exercisable against the subscriber, landing on
us.

### 1.2 What GN5/2014 actually requires (operative text)

**Definitions that capture us.** GN5/2014 §2.1 defines outsourcing as "the use of a service
provider, whether it is an affiliate within a corporate group or a third party, to perform on
a continuing basis a business activity, service, function, or process, which could be
undertaken by the bank, on behalf of the bank" — and §2.2 removes any software-vs-services
ambiguity: "outsourcing includes the provision of information technology (IT) systems or
other IT services." BBaaS is squarely inside the definition at every subscription tier.
§2.3 names intra-group arrangements "insourcing" (still fully in scope — relevant to our
anchor tenant, §4). §2.4 defines offshoring by *where the activity is conducted*, not where
the provider is registered — a SA-registered vendor running tenant workloads in eu-west is
offshoring.

**Board accountability is non-delegable.** The executive summary: "The ultimate
responsibility for ensuring that the risk surrounding outsourcing relationships are duly
managed vests with the relevant bank's board of directors." §6.1.2: outsourcing "does not
relieve the board of directors and senior management of their responsibility to ensure that
outsourced activities are conducted in a safe and sound manner." Product consequence: BBaaS
must be *designed to be overseen* — the subscriber's board needs reporting, attestation
artefacts, and control evidence from us as first-class outputs, because their accountability
cannot move to us no matter what the contract says.

**The materiality test.** §3.1 lists eleven factors (a)–(k): financial/operational impact of
interruption; influence on a significant line of business; reputational impact of provider
failure; cost as a share of total expenses; difficulty of substitution or re-insourcing;
ability to meet regulatory requirements if the provider has problems; aggregation of multiple
agreements with one provider; effect on the PA's supervisory processes; strategic-objective
impact; potential customer losses; and — directly relevant to §4 of this paper — "the
affiliation or other relationship between the bank and the service provider."

**The approval/notification split.** §5.1(j)–(k) draws the line that matters most to BBaaS:

- **Prior written approval** from the PA before outsourcing: internal audit (per Reg
  48(1)(c)(i)), **core banking IT systems**, or **the financial reporting IT system**.
- **Notification at least 20 working days** before entering any other material outsourcing
  agreement.

And §4.4 sets the supervisory mood: the PA "views core banking IT systems as well as a
bank's financial reporting IT system as material business functions and would prefer that as
far as possible these systems not be outsourced", with case-by-case approval possible. §4.5
adds that banks "should notify this Office prior to offshoring material business activities."

**The remaining key requirements** (§5.1(a)–(i)): board-approved outsourcing policy; risk
assessments; due diligence (§6.4.2 lists eighteen provider factors, including "reliance on
subcontractors", "information security", "jurisdictional issues and sovereign risks");
a legal contract for every material arrangement; ongoing monitoring; effective control
environment at the bank *and at the service provider*; viable contingency and
business-continuity plans (§6.7.2 requires the bank to "periodically obtain evidence of
testing" of the provider's BCP and to "maintain an exit strategy, including a pool of
comparable service providers"); administrative measures and reporting; and demonstrable
verification of provider performance.

**Supervisory access — the clause that reaches us.** §6.9.1: contracts "are structured in
such a way as to ensure that the bank is able at all times to provide this Office with the
necessary information on the outsourced material business activities or functions ... The
outsourcing agreement should include the right for this Office to access information, which
includes conducting on-site visits at the service provider should this Office consider it
necessary." §6.10.2 adds that the PA may commission the bank's external auditor or an
external expert to assess the provider arrangement — paid for by the bank, reportable to the
PA.

**Sub-contracting and resolution.** §6.5.3: the agreement must include "an indemnity to the
effect that any subcontracting by a third-party service provider of the outsourced function
will be the responsibility of the third-party service provider, including liability for any
failure on the part of the sub-contractor." §6.5.4: the default clause must not "entitle the
service provider to unilaterally cancel the agreement in the event that a recovery or
resolution action is taken." We must keep serving a subscriber bank that is in resolution.

### 1.3 What D3/2018 adds (binding, s.6(6))

D3/2018 directs banks, from 1 October 2018, to comply with thirteen conditions
(§2.2.1–2.2.13) when using cloud computing or offshoring data. The ones with direct BBaaS
design force:

- **2.2.8** — remain compliant with applicable law "both locally as well as in any country
  where the cloud services and/or data are hosted" (residency schedule per tenant, §2 below);
- **2.2.9** — cloud/offshoring "must not in any way infringe on the bank's supervisors or
  prevent any regulatory mandated access to information";
- **2.2.10** — contingency plans to continue operations and meet regulatory/statutory
  obligations despite the arrangement;
- **2.2.11** — IP and contractual rights to data not compromised; **"Data must always be in
  a usable, readable and portable state, even when the contract is terminated"**;
- **2.2.12** — no impact on the bank's ability to conduct forensic audits or investigations;
- **2.2.13** — everything in "a documented, legally binding agreement";
- **2.1.2** — provide the PA with information on material cloud/offshoring arrangements "in
  accordance with Guidance Note 5/2014" (i.e. the notification/approval machinery of §1.2
  carries over).

D3/2018 §1.6 also reminds banks that FIC and SARB FinSurv obligations ride along — AML
records and exchange-control data processed on BBaaS keep their own access and retention
strings.

### 1.4 Joint Standard 2 of 2024 (cyber) — the continuous-assurance layer

The corpus-held JS2 analysis (Regulations/Joint-Standards/js-2-of-2024-cyber.md) carries the
third-party requirements: third-party cyber risk "assessed pre-engagement and continuously";
material outsourcing aligned with D3/2018; an ICT third-party register expected at the
subscriber. BBaaS must therefore feed each subscriber's continuous third-party-cyber
monitoring — point-in-time SOC-style attestations will not be enough; the natural BBaaS
answer is exposing our own recon-gate results and control evidence to tenants as a product
surface. Joint Standard 1 of 2023 (IT governance, not yet in corpus) adds the IT-governance
oversight frame and must be acquired before the clause library is finalised (§6.2).

### 1.5 Materiality classes across the BBaaS tiers

Applying §3.1's factors to the subscription tiers from the session-1 paper:

| Tier | What the subscriber runs on BBaaS | Materiality class | PA process |
|---|---|---|---|
| **T1 — full stack** | GL, sub-ledgers, returns generation (BA forms), risk engines, agent seats | Material **and** in the named prior-approval set: this *is* "core banking IT systems" and "the financial reporting IT system" (GN5/2014 §4.4, §5.1(j)) | **Prior written approval**, case-by-case; plus D3/2018 conditions; plus offshoring notification if any workload leaves SA |
| **T2 — domain subscription** | One or more domains (e.g. regulatory-returns preparation, risk computation) feeding the bank's own ledger of record | Material on factors (a), (f), (h) — interruption impact, regulatory-requirement dependence, supervisory-process effect | 20-working-day **prior notification** (§5.1(k)); approval if the domain is judged core/financial-reporting in substance |
| **T3 — knowledge tier** | Plane-A regulatory corpus, obligations register, posture/applicability tooling (W8) — no bank transaction records processed | Arguably **below** the materiality line: substitutable, no transaction processing, modest cost share. But the assessment is the subscriber's to make against §3.1, not ours to assert | Bank-internal materiality assessment; likely no PA process |

Two honest caveats. First, T1's prior-approval hurdle is not a formality: §4.4's stated
preference *against* outsourcing these systems means the first T1 subscriber and the PA will
effectively co-design the supervisory arrangement, and a concentration question (N banks on
one vendor — §3.1(g) aggregation viewed market-wide) will surface as N grows. Early,
voluntary engagement with the PA is the only sensible posture (§6.1, open question 2).
Second, tier boundaries blur in substance: a T3 subscriber whose obligation register and
applicability verdicts (W8) drive its compliance programme may conclude factor (f) makes
even the knowledge tier material. The cheap answer is to make the full §2 clause set
standard at every tier — over-compliance at T3 costs us little and removes the boundary
argument.

## 2. The contractual mirror — the BBaaS master agreement

Every obligation in §1 lands as a clause the subscriber *must* extract from us; we should
pre-write all of them. This becomes **Imani (legal counsel)'s clause-library workstream**:
a "BBaaS Master Subscription and Outsourcing Agreement" template in the clause library,
each clause carrying a typed citation to the instrument that forces it (Principle 2 — the
contract is a graph node whose clauses cite upward into Plane A). Named as
D-W7-OUTSOURCING-CLAUSE-LIBRARY in §6.

| # | Clause | Forced by | Design notes |
|---|---|---|---|
| C1 | **Regulator access + on-site visits.** PA (and the subscriber's other regulators) may access all information relating to the subscriber's arrangement and conduct on-site visits at the vendor | GN5/2014 §6.9.1; D3/2018 §2.2.9 | Must survive sub-outsourcing (flow-down, C6) and bind per-tenant: regulator of tenant A sees tenant A's store and platform controls, never tenant B's data — the W3 per-tenant store makes this scoping physically demonstrable |
| C2 | **Audit rights.** Subscriber internal/external audit and PA-commissioned external experts may audit the vendor; vendor supplies control evidence continuously | GN5/2014 §6.5.2(b), §6.10; JS2/2024 continuous third-party assessment | Product answer: tenant-visible recon-gate dashboard + exportable control-evidence events. Our audit cost scales with N unless evidence is self-serve — design for pooled assurance (one annual deep audit + shared report) where instruments permit |
| C3 | **Data residency schedule.** Per-tenant commitment naming jurisdiction/region of the tenant store and every processing location | D3/2018 §2.2.8; GN5/2014 §2.4 offshoring definition + §4.5 notification | W3 §2.2 makes residency "a deployment parameter per tenant" — tenant store in azure-southafrica-north, eu-west, or on-prem. The schedule is a render of control-plane config events, so the commitment is *provable from the log* |
| C4 | **Exit plan + data portability.** Full export of the tenant's data in usable, readable, portable form, including at termination; documented exit/migration plan; cooperation duty | D3/2018 §2.2.11; GN5/2014 §6.7.2(h)–(i) exit strategy | **Events-as-truth makes this unusually strong.** The tenant's entire history is one event log plus a content-addressed document store; "export" is a database copy plus published schema, not a bespoke extraction project. Every projection is recomputable from the log by construction (Principle 1), so the exported artefact is *complete by definition* — there is no hidden mutable state to leave behind. This is a sales asset: the exit clause every other core-banking vendor resists is one we can demo. It also substitutes for source-code escrow in substance: log + published event schema + open projection definitions let a successor rebuild state without our binaries |
| C5 | **BCP/resilience.** Vendor maintains tested DR/BCP; subscriber receives periodic evidence of testing; continuity through vendor distress | GN5/2014 §5.1(g), §6.7.2(e)–(g); D3/2018 §2.2.10 | Per-tenant stores shrink the blast radius (W3 §2.1) and make per-tenant recovery testing meaningful; publish RTO/RPO per tier |
| C6 | **Sub-outsourcing transparency + flow-down.** Register of vendor subcontractors disclosed to subscribers; material changes notified; vendor carries an indemnity for subcontractor failure; access/audit/residency clauses flow down | GN5/2014 §6.5.3 (indemnity), §6.4.2(p) (reliance on subcontractors); D3/2018 §2.2.8 | **The honest entry: our model-API providers (Anthropic and any successor/alternate LLM providers) are sub-outsourcers of every subscriber.** See §2.1 below — this is the hardest clause to sign and the one to engineer around earliest |
| C7 | **SLAs + performance monitoring.** Defined service levels, measurement, reporting, remedies including early-exit for non-performance | GN5/2014 §6.5.2(i),(u),(cc); §5.1(i) | SLA measurements should themselves be events (Principle 1) so the performance record is shared, citable, and not disputable after the fact |
| C8 | **Liability, indemnity, insurance.** Indemnification, limits and liability, insurance coverage | GN5/2014 §6.5.2(l)–(n) | The §6.5.3 subcontractor indemnity is uncapped in the guidance text; our cap structure must carve it out or price it. Professional-indemnity/cyber cover is a licence-day-adjacent procurement (build-phase: none needed yet) |
| C9 | **No unilateral termination on recovery/resolution.** Vendor cannot cancel because the subscriber enters recovery or resolution; defined service-continuation terms during resolution | GN5/2014 §6.5.4 | Pair with a pre-priced "resolution service schedule" so continuing service to a bank in resolution is a planned product mode, not a dispute. SARB-as-resolution-authority service-continuity expectations (FSLAA) reinforce this — flagged in §6.1 |
| C10 | **Confidentiality, POPIA operator terms, security** | GN5/2014 §6.5.2(e); POPIA s.20–21 | Written operator contract per POPIA s.20; s.21 compromise-notification duty to the responsible party (the tenant); JS2-aligned security schedule |
| C11 | **Incident + financial-distress notification** | GN5/2014 §6.5.2(o) | Notification of "financial difficulty, catastrophic events, and significant incidents" — wire to the same SubstrateAlert machinery the platform already runs |
| C12 | **Generalised-learning consent** | Contract architecture for §5; no instrument forbids it, POPIA + Competition Act bound it | Express tenant consent to posture-conditioned generalisation through the W3/W8 gate; definition of what may never cross (client data, pricing, strategy, CSI blocklist); audit access to the gate's crossing log |
| C13 | **Compliance-with-laws + multi-jurisdiction schedule** | D3/2018 §2.2.8; GN5/2014 §6.5.2(x) | Jurisdiction-specific annexes as we expand (session-1 §9.4) — the clause library needs a per-jurisdiction overlay structure from day one |
| C14 | **Records, retention, forensic access** | D3/2018 §2.2.12; GN5/2014 §6.5.2(w); FIC Act + FinSurv riders per D3/2018 §1.6 | Forensic-audit support is near-free on an append-only event store — another structural advantage worth contracting affirmatively |

### 2.1 The model-API sub-outsourcing problem, stated honestly

Agent seats are the product's labour force, and they run on third-party LLM APIs. Under
GN5/2014's definitions there is no reading on which that is not sub-outsourcing of the
subscriber's outsourced function. Consequences:

1. **Disclosure**: Anthropic (and any alternates) appear in every subscriber's
   sub-outsourcer register from day one.
2. **Indemnity** (§6.5.3): we answer to the subscriber for model-API failure. Multi-provider
   failover stops being an engineering nicety and becomes a contractual risk control.
3. **Residency**: if inference runs outside SA, then tenant data contained in prompts is
   being *processed offshore* — D3/2018 offshoring conditions and POPIA s.72 cross-border
   rules attach. Mitigations, in order of strength: region-pinned inference where the
   provider offers it; prompt minimisation (the W8 structured-first architecture helps —
   agents consume projections and registers, so prompts can carry derived, minimised
   context rather than raw client records); contractual no-training/zero-retention terms
   with the provider; and per-tenant inference logs so what crossed is always citable.
4. **Regulator access**: C1's flow-down will meet resistance at the model provider. The
   realistic answer is layered: regulator sees our full inference logs and controls;
   provider-level assurance arrives via the provider's own attestations rather than on-site
   rights. Whether the PA accepts that layering for T1 subscribers is an open supervisory
   question (§6.1).

This is the single most likely clause-negotiation failure point with a conservative
subscriber bank, and the reason to engage the PA early rather than discover its position
through a subscriber's stalled approval application.

## 3. Is the vendor itself regulated?

Perimeter-by-perimeter, with confidence levels. The structural fact doing most of the work:
**BBaaS never holds client money, never takes deposits, never stands in a transaction chain
in its own name.** It operates systems; the regulated acts are the subscriber's.

### 3.1 Banks Act 94 of 1990 — no

"The business of a bank" turns on deposit-taking from the general public (s.1 definitions;
s.11 prohibition on conducting the business of a bank unregistered). BBaaS accepts
subscription fees, not deposits; it holds no client funds; it intermediates no credit.
Running a bank's *systems* is not conducting the business of a bank — if it were, every core-
banking vendor and cloud provider serving SA banks would be unregistered banks.
**Conclusion: outside the perimeter. Confidence: high.**

### 3.2 FAIS Act 37 of 2002 — no, with a scoping discipline

The corpus-held FAIS analysis (Regulations/FSCA/fais-act.md; full Act at
source-docs/fais-act-37-2002.txt) frames the perimeter: an FSP is one who "as a regular
feature of the business ... furnishes advice" or "renders an intermediary service" in
respect of **financial products**, to **clients**. Two independent outs:

1. **Subject-matter**: BBaaS outputs are regulatory knowledge, compliance verdicts, control
   evidence, and operational computation — guidance about the subscriber's *obligations*,
   not recommendations "in respect of the purchase of any financial product" or the
   investment in one. An applicability verdict on a PA directive (W8) is not financial-
   product advice on any reading of the s.1 definition.
2. **Capacity**: the agent seats, when deployed for a tenant, operate as the *tenant's own
   systems* under the tenant's governance, licences, and mandates — analogous to a core-
   banking system executing a payment instruction or a treasury system proposing a hedge.
   The software vendor does not thereby render the financial service; the bank does, through
   tooling.

The scoping discipline that keeps this true: (a) the master agreement states that no BBaaS
output constitutes advice as defined in FAIS s.1 and that all financial-services acts remain
the subscriber's, performed under the subscriber's licences; (b) product design keeps any
agent capability that *selects or recommends financial products for end-clients* on the
tenant side of the line, governed by the tenant's FSP licence (exactly as our own
Hoz Securities holds the FSP licence for OTC-derivative advice, not the platform — posture
already recorded in the corpus FAIS analysis under D-FSP-LICENCE-NECESSITY). The residual
risk is drift: if a future BBaaS feature markets itself as recommending products to a
subscriber's clients, the analysis changes. **Conclusion: outside the perimeter with the
discipline held. Confidence: high for the knowledge/compliance tiers; medium-high for full-
stack agent seats, where the capacity argument does the work and external counsel should
ratify the framing at licence-application moment.**

### 3.3 National Payment System Act 78 of 1998 — no, by design constraint

(The NPS Act is **not in corpus** — acquisition follow-on §6.2; this analysis is from general
knowledge and must be re-verified against the text once acquired.) The NPS perimeter
restricts clearing/settlement participation and regulates payment intermediation —
including, via SARB directives on third-party payment providers, persons who accept money or
the proceeds of payment instructions on behalf of others. The design constraint that keeps
BBaaS outside: **the platform instructs; the bank executes.** Payment instructions generated
by the payments domain are issued in the subscriber's name, over the subscriber's clearing/
settlement participation and SAMOS/PCH connections; no BBaaS entity ever becomes a clearing-
system participant, holds a settlement account, or possesses funds in flight. If a future
product tier ever touched funds (e.g. operating a collections float), the TPPP framework
would attach immediately — so "never in possession of funds" should be recorded as a
standing product constraint, not an accident of the current design. **Conclusion: outside
the perimeter given the constraint. Confidence: medium-high pending corpus acquisition and
counsel ratification — the NPS Act is also under long-running reform, so this perimeter
needs monitoring.**

### 3.4 Critical infrastructure / essential-operator angles — obligations possible, licence no

Two distinct angles. First, the Critical Infrastructure Protection Act 8 of 2019 (not in
corpus; low-priority follow-on): designation is asset-focused and discretionary; a vendor
running core systems for multiple banks could conceivably be designated as N grows, which
brings security obligations, not licensing. Second — more real, sooner — **supervisory
concentration**: the PA assessing its tenth BBaaS approval application is no longer
assessing one bank's outsourcing but a market dependency. International practice (oversight
regimes for critical third parties serving financial institutions — the direction of travel
in the UK, EU DORA's critical-ICT-provider designation) suggests SA may eventually build a
direct-oversight hook for vendors in exactly our position. Nothing in SA law does this
today. **Conclusion: no licence today; expect designation-style obligations to emerge with
scale; treat direct PA engagement as inevitable and front-run it. Confidence: high for
today's law; the forward expectation is a judgement.**

### 3.5 POPIA and FIC Act — duties yes, licences no

POPIA (in corpus): BBaaS is an **operator** for each tenant (s.20 written-contract and
security-safeguard duties; s.21 duty to notify the responsible party of compromises) and a
responsible party only for its own platform data. No registration regime attaches beyond
the Information Officer machinery at the entity level. FIC Act (in corpus): BBaaS is not an
accountable institution — it carries on none of the Schedule 1 businesses — but it processes
AML-relevant records as operator, so FIC record-keeping and access strings ride through the
tenant contract (D3/2018 §1.6 makes this explicit for cloud arrangements).
**Confidence: high.**

### 3.6 Summary table

| Perimeter | Vendor licensed/regulated? | Confidence |
|---|---|---|
| Banks Act (deposit-taking) | No | High |
| FAIS (advice/intermediary services) | No, with scoping discipline + counsel ratification | High (knowledge tier) / medium-high (agent seats) |
| NPS Act (payments) | No, given never-hold-funds + instruct-don't-execute constraints | Medium-high (corpus gap) |
| Critical infrastructure / concentration | No licence; obligations plausible at scale | High today / judgement forward |
| POPIA / FIC | Operator duties, no licence | High |
| **Effective regulation via subscribers' contracts (§1–§2)** | **Yes — comprehensively** | High |

## 4. Platform-entity structure options

### 4.1 The constraint set

(a) The anchor tenant is our own bank — so the first subscription is **related-party
outsourcing**, "insourcing" in GN5/2014 §2.3 terms, fully in scope of the framework, with
§3.1(k) making the affiliation itself a materiality factor and §6.4.4 prescribing a
dedicated insourcing assessment. (b) Banks Act group machinery: a registered bank
establishing or acquiring subsidiaries/joint ventures needs PA approval, and a bank
**controlling company** brings consolidated supervision over the group it heads — where the
vendor sits relative to that perimeter determines whether vendor operations are inside the
PA's consolidated net. (c) Commercial independence: third-party subscriber banks will not
put their core ledger on a vendor their competitor owns (the session-1 anchor-tenant
firewall, §9.9, has a legal-structure dimension). (d) Build-phase reality: today there is no
licensed bank and no capital; the entity structure is nearly free to set up now and
expensive to repair later.

### 4.2 Options

**Option 1 — vendor as bank subsidiary.** The bank owns the platform company.
*Against:* PA approval needed for the acquisition itself; the vendor consolidates into the
bank's prudential returns (capital against vendor operational risk); every vendor commercial
move is inside bank governance; competitor-subscriber objection is maximal; a vendor
failure is a bank group event. *For:* simplest IP story during build. **Rejected.**

**Option 2 — vendor inside the controlling-company group (sister of the bank under the bank
controlling company).** *Against:* consolidated supervision still captures the vendor
(the controlling company answers to the PA for the group); competitor-subscriber optics
barely improve; group-wide governance standards apply. *For:* clean intra-group contracting.
**Rejected as steady state.**

**Option 3 — vendor outside the registered banking-group perimeter: a separate operating
company, sister to the bank's controlling company under a common investment holdco (or held
directly by the founder during build phase).** The bank contracts with the vendor at arm's
length under the full GN5/2014 process — board-approved outsourcing policy, materiality
assessment, due diligence file, prior-approval application for the core-IT/financial-
reporting outsourcing, the §2 master agreement signed for real. *For:* keeps the vendor out
of consolidated supervision; gives third-party subscribers a vendor not owned by their
competitor; makes the anchor tenant the **reference implementation of the compliance
artefacts we sell** — our own PA approval file becomes the template every subscriber reuses,
which is the strongest possible dogfooding. *Against:* related-party scrutiny is *higher*,
not lower — arm's-length pricing (transfer-pricing rules if cross-border; fair-value intra-
group terms regardless), conflict management, and the PA's §3.1(k) attention all need a
visible governance answer (independent approval of the related-party contract on the bank
side; documented market-equivalent terms).

### 4.3 Recommendation

**Option 3** — separate vendor company outside the bank's controlling-company consolidation
perimeter, common ultimate ownership, arm's-length master agreement, with the anchor
tenant's own PA outsourcing-approval file built as a product artefact. Named for decision as
**D-W7-VENDOR-ENTITY-STRUCTURE** (§6.3). Build-phase honesty: what is decidable now is the
*direction* (don't grow the platform inside the future bank's legal entity; keep IP
assignable to the vendor side from the start). What must wait for **real external counsel at
the licence-application moment**: exact holdco topology (Companies Act mechanics, s.45
financial-assistance constraints on intra-group support), tax and transfer-pricing
structuring, whether the PA's controlling-company registration sweeps wider than we model,
employment/IP assignment mechanics, and the related-party contract's independence
safeguards. None of that blocks the direction being set now.

## 5. Cross-tenant learning — the law bounds

The W8 cross-tenant carrier (§8 of that paper) moves **posture-conditioned generalised
knowledge** through the control plane: dimension vocabularies, APPLIES_WHEN predicates,
generalised playbooks and exam items — never tenant events, never client records. Three
legal frames bound it.

### 5.1 Competition Act 89 of 1998 (not in corpus — acquisition follow-on)

The hazard is precise: BBaaS is a **common supplier to competing banks**, which is the
classic hub-and-spoke topology — if competitively sensitive information (CSI) of one bank
reaches another *through us*, the banks can be in a concerted practice (s.4(1)) without ever
meeting, and we are the conduit. SA competition enforcement in the banking sector (the forex
matters) makes this no theoretical concern.

Why posture-conditioned generalised knowledge is not CSI exchange: CSI is information that
reduces a competitor's uncertainty about another's *market conduct* — prices, margins,
volumes, customers, strategy, capacity. What crosses the W3/W8 gate is none of these: it is
knowledge **about regulation and control technique** — "for SA-approach banks, this
provision binds; here is the control pattern" — conditioned on posture dimensions that are
themselves regulatory categories (approach elections, designation status), not commercial
parameters. It is closer in kind to a law firm's know-how or a Big-4 methodology than to an
information exchange. Publicly-sourced regulatory knowledge (Plane A) is not CSI at all.

**Where the line is.** Never crosses, under any generalisation: pricing or rate data; client
or counterparty identities or data; trading positions, volumes, or strategies;
risk-appetite calibrations (a bank's RAS thresholds are strategy); funding plans; product
launch plans; anything recent, granular, and firm-attributable. The grey zone to manage:
*directional precedents* distilled from one tenant's supervisory interactions could, if too
specific, reveal that tenant's regulatory strategy — the distillation step must generalise
to the posture class, never to the identifiable tenant.

**The gate as the compliance control.** The W3/W8 architecture is the defence in form
regulators respect: (i) structural separation — per-tenant stores mean tenant data *cannot*
flow tenant-to-tenant except through one named, reviewable distillation step; (ii) every
crossing is an event with provenance, so the complete history of what generalised, from
what, reviewed by whom, is producible to the Competition Commission on demand; (iii) the
gate's checklist should carry an explicit **CSI blocklist** as a named dimension (this is a
concrete W8 amendment: add competitively-sensitive-information screening to the
generalisation gate's review checklist, alongside the POPIA and confidentiality screens).
Counsel ratification of the blocklist taxonomy at licence-application moment.

### 5.2 POPIA

Roles are clean under the W3 split: each tenant bank is the **responsible party** for its
clients' personal information; BBaaS is its **operator** (s.20 written contract + security
safeguards; s.21 breach notification to the tenant). The generalisation rule is stricter
than de-identification: **generalised knowledge must contain no personal information at
all** — a playbook derived from events that touched client data must carry zero of it, and
the gate review asserts that affirmatively. Cross-border: per-tenant residency (W3) answers
s.72 for the stores; the model-API path (§2.1.3) is the one place s.72 conditions need
active management.

### 5.3 Confidentiality and contract architecture

Banks owe their clients confidentiality at common law and via sectoral statute; tenants owe
*us* nothing they don't contract. So the architecture is consent-forward: C12 (§2) has every
tenant expressly consent to posture-conditioned generalisation, with the never-crosses list
enumerated, audit access to the gate's crossing log, and a termination right over future
generalisation (already-generalised knowledge is irreversible and the contract says so
honestly). Because the gate strips tenant particulars *before* anything crosses, the
contractual consent is belt to the architecture's braces — the structural control does the
work; the consent makes it commercially undeniable.

## 6. Open questions and named decisions

### 6.1 Open questions (not decidable on paper)

1. **Will the PA approve T1 at all — and at what N?** §4.4's stated preference against core-
   IT outsourcing means the first full-stack approval is a co-designed supervisory
   arrangement, and market concentration becomes the PA's question as N grows. Action
   direction: voluntary early engagement with the PA (innovation/fintech engagement channel)
   ahead of any subscriber's application — owned by the Company Secretary seat with the CEO,
   at the commercial moment W6 defines.
2. **Model-API sub-outsourcing acceptability** (§2.1): will SA supervisors accept layered
   assurance (our inference logs + provider attestations) in lieu of on-site rights at the
   model provider for T1 subscribers? No instrument answers this; it is a supervisory-
   posture question.
3. **Resolution-regime service continuity**: FSLAA's resolution framework (SARB as
   resolution authority) is evolving toward explicit expectations of critical service
   providers to banks in resolution; C9's service-continuation schedule should track that
   framework as it lands. (FSLAA resolution chapters: corpus coverage to be verified during
   the §6.2 acquisition pass.)
4. **FAIS drift watch** (§3.2): any future product feature that recommends financial
   products to a subscriber's end-clients re-opens the perimeter conclusion. Standing
   constraint, owned by whoever owns the product roadmap, enforced at NPA gate.
5. **Jurisdictional overlays**: each expansion jurisdiction (session-1 §9.4) re-runs this
   whole paper against its own outsourcing code (EU DORA being the heaviest). The clause
   library must be per-jurisdiction layered from day one (§2 C13).

### 6.2 Corpus-acquisition follow-ons (source-artifact-first discipline)

| Instrument | Why | Priority |
|---|---|---|
| **Joint Standard 1 of 2023** (IT governance and risk management for financial institutions) | Binds subscribers' IT-dependency oversight; clause library C2/C5 must cite it | High |
| **National Payment System Act 78 of 1998** + SARB TPPP directive (Directive 1 of 2007) | §3.3's perimeter conclusion currently rests on general knowledge | High |
| **Competition Act 89 of 1998** | §5.1's CSI line and the gate blocklist need section-level citation (s.4 in particular) | High |
| **Joint Standard 1 of 2024** (Outsourcing by insurers) | Comparator: the PA/FSCA's most modern outsourcing text; likely template for any future banks standard; useful for clause-library future-proofing | Medium |
| **FSLAA resolution chapters** (verify existing corpus depth) | C9 / open question 3 | Medium |
| **Critical Infrastructure Protection Act 8 of 2019** | §3.4 designation angle | Low |

### 6.3 Named decisions for the CEO (recommend, not decide)

- **D-W7-VENDOR-ENTITY-STRUCTURE** — adopt the Option 3 direction (§4.3): platform entity
  outside the bank's controlling-company consolidation perimeter, common ultimate ownership,
  arm's-length anchor-tenant master agreement, anchor tenant's PA approval file built as a
  reusable product artefact; external-counsel ratification of topology/tax at licence-
  application moment. Recommended: approve the direction now.
- **D-W7-OUTSOURCING-CLAUSE-LIBRARY** — commission Imani (legal counsel)'s clause-library
  workstream: the BBaaS Master Subscription and Outsourcing Agreement template per §2's
  C1–C14, each clause citation-typed to its forcing instrument, with per-jurisdiction
  overlay structure; blocked on the §6.2 high-priority acquisitions for citation
  completeness. Recommended: approve, sequenced after the corpus acquisitions.
- **D-W7-CSI-GATE-BLOCKLIST** — amend the W8 generalisation-gate review checklist to carry
  an explicit competitively-sensitive-information blocklist (§5.1) alongside the POPIA and
  confidentiality screens, with every gate crossing recording the blocklist assertion in
  the crossing event. Recommended: approve; small, and it converts §5's legal argument into
  a standing coded control.
- **Corpus acquisitions per §6.2** — routable to Mira (Compliance / RegTech engineer) under
  the standing regulatory-library machinery; the three high-priority instruments gate the
  clause-library decision above.

---

*Filed as a RecordFiled event into the Documents register (D-RMS-PHASE-3); the
content-addressed document store is canonical (D-RMS-PHASE-4). W7 deliverable of the
v2 structural analysis under D-V2-BBAAS-W4-W7-DISPATCH.*
`;

const result = recordFiled(
  {
    recordId: RECORD_ID,
    registerKey: "documents",
    body,
    classification: "governance-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-RMS-PHASE-3", "D-V2-BBAAS-W4-W7-DISPATCH"],
    actor: {
      type: "service",
      id: "agent:owen:governance",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title:
        "V2 BBaaS — W7 vendor regulatory perimeter: outsourcing obligations, entity structure, learning law bounds",
      path: "2026-06-12_owen_v2-bbaas-w7-vendor-perimeter.md",
      category: "strategy-analysis",
      author: "Owen (Company Secretary, governance)",
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
