---
title: Hoz domain-registration plan
author: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
date: 2026-05-09
summary: Working-set + defensive domain plan for the bank brand "Hoz" (per D-BANK-NAME-SELECTION). Identifies registrar choices, DNS / email-deliverability hardening posture, budget order-of-magnitude, and surfaces D-HOZ-DOMAIN-REGISTRATION-SET for CEO confirmation before any registration is executed. No domain is registered in this PR — Marc executes after decision.
decision-required: true
decision-id: D-HOZ-DOMAIN-REGISTRATION-SET
---

# Hoz domain-registration plan

## Context

D-BANK-NAME-SELECTION (PR #57) selected **"Hoz"** as the bank brand. The CEO decision-record placed domain registration on Devon (COO) + Tomas (Operations & payments engineer) with a working-set of `hoz.bank` / `hoz.co.za` / `hoz.ai` plus `.com` aspirational. This plan specifies the working-set, defensive set, registrar selection, DNS hardening posture, and the decision card the CEO must confirm before any domain is acquired.

The build-phase posture (per `project_ai_driven_bank.md` — bank is a real SARB-licensed institution-in-formation, not a simulation) means domain choices must already be coherent with licence-day operating reality. `.bank` cannot be registered until SARB licence-day; `.co.za` and `.ai` are available now and serve build-phase needs (regulator correspondence, public-facing brand surface for the substrate dashboard, email).

[citation: D-BANK-NAME-SELECTION decision-record at `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md` (PR #57)]

## §1 — Working-set domains (priority ordered)

### `.bank` — `hoz.bank`

- **Status:** sponsored gTLD restricted to verified financial institutions; operated by fTLD Registry Services. Registration requires fTLD verification process (regulator confirmation + background check on the registering entity and key principals).
- **Build-phase posture:** the bank cannot complete `.bank` registration until SARB licence-day. The pre-licence path is to file an fTLD verification application as a "pending-licence" applicant so that registration completes the moment SARB licence is granted. This locks the string against opportunistic registration by another financial institution in the interim.
- **Cost order-of-magnitude:** `~$1,000–$1,500 / year` registration + verification + accredited-registrar fees. [citation: TBC — fTLD published fee schedule + registrar quote]
- **Signal:** very high. `.bank` is a strong legitimacy marker for institutional counterparties and regulator-facing correspondence.
- **Registrar:** must be fTLD-accredited (CSC Global, MarkMonitor, Com Laude — short list). [citation: TBC — fTLD accredited-registrar list]
- **Recommendation:** **file fTLD pre-application now; activate at licence-day.** Surfaces as a decision-point only if Marc rejects pre-application — the cost is committed at licence-day not now, but the application takes weeks-to-months and should not be deferred.

### `.co.za` — `hoz.co.za`

- **Status:** South African ccTLD; administered by ZACR; default option for SA-domiciled financial institutions. High local relevance for SARB-applicant context.
- **Availability:** three-letter `.co.za` domains are scarce; `hoz.co.za` is plausibly available given the unusual letter combination but cannot be confirmed without a live WHOIS check. `[preliminary: availability not yet verified — Tomas to run WHOIS at execution-time]`
- **Cost order-of-magnitude:** `~ZAR 100–200 / year` (`~$5–$15 / year`).
- **Registrar:** ZACR-accredited registrar; Diamatrix, Domains.co.za, Hosting.co.za are SA-market defaults. Recommend Diamatrix for governance alignment with other ZA financial institutions. [citation: TBC — ZACR accredited-registrar list]
- **Recommendation:** **register immediately on CEO confirmation.** Lowest cost; highest local relevance; primary build-phase public-facing domain.

### `.ai` — `hoz.ai`

- **Status:** Anguilla ccTLD; high signal for an AI-driven bank (per `project_ai_driven_bank.md` — the bank's identity is autonomous-AI-run, Principle 7).
- **Availability:** three-letter `.ai` domains are typically already registered or premium-priced. `hoz.ai` is plausibly available or low-tier-premium given the unusual letter combination but cannot be confirmed without a live WHOIS check. `[preliminary: availability not yet verified — Tomas to run WHOIS at execution-time]`
- **Cost order-of-magnitude:** standard registration `~$140–$200 / 2-year-term`; if premium-tier, could be `$500–$5,000+`. [citation: TBC — registrar quote pending availability check]
- **Registrar:** the .ai registry has limited registrar options; GoDaddy, Namecheap, 101domain are the common gateways. Recommend 101domain for ccTLD-specialist support.
- **Recommendation:** **register immediately on CEO confirmation if standard-priced; escalate to Marc if premium-tier.**

### `.com` — `hoz.com`

- **Status:** generic gTLD; aspirational. Three-letter `.com` domains are essentially all registered and trade on the aftermarket at six-to-seven-figure prices.
- **Availability:** `hoz.com` is highly likely already registered. `[preliminary: aftermarket-listing check pending; expect $50,000–$500,000+ acquisition cost if listed]`
- **Cost order-of-magnitude:** aftermarket bid `$50K–$500K+`. Standard registration not applicable.
- **Recommendation:** **NOT pursued in build-phase.** Revisit at substrate-readiness or post-licence cadence if the marketing / global-counterparty case strengthens. Defer indefinitely; do not place an aftermarket bid without a separate Camille (CFO) capital-allocation decision.

## §2 — Defensive domains (cybersquatting + brand-protection)

The typo / homograph / TLD-extension attack surface for "Hoz" is moderate (three-letter strings have lower typo-rate than longer brands). The defensive-registration recommendation is to cover the highest-likelihood phishing variants under a single registrar account for centralised management.

**Identified risk surface:**

| Variant | Risk type | Priority |
|---|---|---|
| `hozbank.com` | brand-extension typo (concatenation) | High |
| `hoz-bank.com` | brand-extension typo (hyphen) | High |
| `hozbank.co.za` | brand-extension typo (concatenation, ZA) | High |
| `hoz-bank.co.za` | brand-extension typo (hyphen, ZA) | Medium |
| `hozz.com` | character-doubling typo | Medium |
| `h0z.com` | homograph (zero-for-O) | Medium |
| `hoz.banking` | TLD-substitution | Low |
| `hoz.financial` | TLD-substitution | Low |
| `hoz.capital` | TLD-substitution | Low |
| `hoz.exchange` | TLD-substitution | Low |

**Recommendation:** **register the four High-priority variants** (`hozbank.com`, `hoz-bank.com`, `hozbank.co.za`, `hoz-bank.co.za`) and **the two Medium-priority `.com` variants** (`hozz.com`, `h0z.com`). Defer Low-priority TLD-substitution variants — too long a tail; revisit if specific abuse is detected.

**Cost order-of-magnitude:** `~$15–$20 / year` per `.com`; `~ZAR 100 / year` per `.co.za`. Total defensive set `~$80–$100 / year`.

## §3 — Registrar selection

### Option A — Single registrar (CSC Global)

- Single account for entire portfolio (`.bank`, `.co.za` via reseller arrangement, `.ai`, defensive `.com` set).
- **Pro:** centralised governance, single audit trail, single billing, single set of API tokens to manage in HSM-backed secret store, brand-protection-grade monitoring services (UDRP / cybersquatting alerts).
- **Con:** premium pricing — likely 2–3× retail registrar pricing. ZACR `.co.za` resale not all-CSC's-strength; may force an unusual reseller path.
- **Cost premium:** `~$1,500–$3,000 / year` over Option B.

### Option B — Split registrar

- CSC Global or MarkMonitor for `.bank` (mandatory accredited-registrar)
- Diamatrix for `.co.za` (and the `.co.za` defensive variants)
- 101domain for `.ai`
- Namecheap or GoDaddy for the `.com` defensive set (single account)
- **Pro:** lowest cost; best local-jurisdiction support per TLD.
- **Con:** four separate accounts, four sets of credentials, four audit trails. Higher operational overhead but manageable at this portfolio size.

### Recommendation

**Option B (split registrar)** for build-phase. Revisit at licence-day or once a brand-protection programme is established whether to consolidate to a single corporate-grade registrar (CSC Global / MarkMonitor) for unified governance. The build-phase cost premium of Option A is not justified by the small portfolio size.

[citation: TBC — Senna (Security engineer) HSM-secret-store specification covers registrar API tokens for whichever option is selected; Joint Standard 1 of 2024 + POPIA s.19–22]

## §4 — DNS + email-deliverability hardening

Every registered domain ships with the following hardening on initial DNS configuration. **Mark all as `v0 STUB; deeper hardening at substrate-readiness`** — Tomas (Operations & payments engineer) owns the hardening playbook; Senna (Security engineer) owns the security review.

- **DNSSEC** — enabled at registrar; signed delegation to authoritative nameservers. Required on every registered domain. [citation: TBC — Joint Standard 1 of 2024 cyber-resilience controls; SARB Directive on cloud-related cybersecurity]
- **SPF** — strict policy (`v=spf1 -all` initially with explicit includes for whichever transactional-email provider is selected).
- **DKIM** — 2048-bit signing key per sending domain; key rotation cadence quarterly; private keys stored in HSM-managed secret store per Senna's zero-trust posture.
- **DMARC** — `p=reject` enforced policy with `rua=` and `ruf=` reporting endpoints to a DMARC-aggregator. Start `p=quarantine` for first 30-day observation; tighten to `p=reject` thereafter.
- **HSTS preload** — submit the public-facing domain (`hoz.co.za` initially) to the HSTS preload list once TLS is in production.
- **CAA** — pin permitted certificate authorities (recommend a single CA initially; add backup CA when production).
- **MTA-STS + TLS-RPT** — enforce TLS for inbound mail; collect TLS-failure reports.
- **BIMI** — deferred; revisit post-licence-day when DMARC `p=reject` is stable for 90 days and a Verified Mark Certificate becomes affordable.

## §5 — Decision required from Marc

**D-HOZ-DOMAIN-REGISTRATION-SET**

The CEO must confirm the following before any domain is registered or any registrar account is opened:

1. **Working-set confirmation:** `.bank` (pre-applied at fTLD now; registered at licence-day) + `.co.za` (registered now) + `.ai` (registered now if standard-priced) — recommended. Or amend.
2. **Defensive-set confirmation:** the six High + Medium variants in §2 (`hozbank.com`, `hoz-bank.com`, `hozbank.co.za`, `hoz-bank.co.za`, `hozz.com`, `h0z.com`) — recommended. Or amend.
3. **Budget envelope:** `[commercial: TBC pending Camille (CFO)]`. Order-of-magnitude:
   - Working-set year-1: `.co.za` (~$10) + `.ai` standard (~$200) + `.bank` fTLD pre-application (~$300 administrative) = **~$500 build-phase**. `.bank` full registration (~$1,500/yr) activates at licence-day.
   - Defensive-set year-1: `~$100 / year` ongoing.
   - **Total build-phase year-1: ~$600** (working + defensive, excluding `.bank` registration which lands at licence-day).
4. **`.com` aftermarket bid:** **NOT pursued** in build-phase — recommended. Revisit at post-licence cadence. Confirm or amend.
5. **Registrar choice:** Option B split (CSC Global for `.bank`; Diamatrix for `.co.za`; 101domain for `.ai`; Namecheap or GoDaddy for `.com` defensive) — recommended. Or amend to Option A (single CSC Global) at ~$1,500–$3,000/year cost premium.

**Default-if-no-decision:** pursue `.co.za` + `.ai` only (lowest cost; defers `.bank` to licence-day; defers `.com` indefinitely; defensive set deferred). Substrate-side gap surfaced rather than committed.

## §6 — Substrate-side (Tomas)

The domain-registrar substrate Tomas (Operations & payments engineer) owns is **not yet wired** (per Hoz decision-record §"Substrate gaps surfaced"). Manual registration via registrar UI / CLI is acceptable for v0; substrate-automation is a v1 task and is captured here as a roadmap item.

**v0 (now, on CEO decision):**
- Tomas runs WHOIS to confirm availability of `hoz.co.za` and `hoz.ai`.
- Tomas opens registrar accounts (Diamatrix + 101domain at minimum); Devon countersigns as governance owner.
- Manual DNS configuration in registrar UI per §4 hardening checklist.
- Credentials (registrar API tokens, DNSSEC KSK / ZSK, DMARC reporting endpoints) loaded into HSM-managed secret storage per Senna (Security engineer)'s zero-trust posture (HSM Level-3 per Principle 4; Joint Standard 1 of 2024 + POPIA s.19–22).

**v1 (substrate-readiness cadence):**
- Domain-registrar adapter in `prototype/` operations namespace; Tomas owns; Senna reviews.
- DNS-as-code (Terraform / equivalent) per Principle 3 IaC discipline.
- Automated DNSSEC key-rotation pipeline.
- Automated DMARC-report ingestion + alerting.
- Registrar-renewal monitor with 90-day-prior alarm; escalation to Devon.

**Substrate-gap surfaced:** *no domain-registrar adapter exists in `prototype/` yet*. Captured as a roadmap item under D-HOZ-DOMAIN-REGISTRATION-SET v1 follow-on.

## §7 — Authority chain + cross-references

- **D-BANK-NAME-SELECTION** (PR #57) — `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md` — selects "Hoz" as the bank brand; places domain registration on Devon + Tomas.
- **Hoz substrate-application** (PR #61) — existing `prototype/dashboard/public/...` files reference Hoz as the brand wordmark; the public-facing domain (`hoz.co.za` initially) becomes the canonical home for that brand.
- **Linnea v3 brand-supplement** (PR #72) — favicons + manifest.json land at `<domain>/favicon-*.png` once domains are registered + DNS-pointed.
- **Imani (Legal-as-code engineer) parallel TM scoping** — `claude/imani-hoz-name-clearance-scoping` — TM clearance for "Hoz" should land before defensive-domain registration to avoid post-registration unwinding if the mark fails clearance.
- **Senna (Security engineer)** — HSM-managed secret-store, DNSSEC + DMARC operational hardening, threat-model gate per Principle 4.
- **Camille (Chief Financial Officer, governance)** — budget confirmation for working-set + defensive-set; aftermarket-bid escalation if `.com` is reconsidered.
- **Imani (Legal-as-code engineer)** — TM clearance reconciliation (referenced above).

## §8 — Sequencing

1. **Now (this PR):** plan landed; D-HOZ-DOMAIN-REGISTRATION-SET surfaced for CEO.
2. **On CEO decision (`decision-required: true` resolved):** Tomas runs WHOIS, opens registrar accounts, registers `.co.za` + `.ai`, files `.bank` fTLD pre-application.
3. **TM-clearance dependency:** defensive-set registration **gated** on Imani (Legal-as-code engineer)'s TM-clearance result. If TM clearance fails for "Hoz", the entire domain plan unwinds and a fresh name is required.
4. **Post-licence-day:** `.bank` registration completes; revisit `.com` aftermarket bid posture.
5. **Substrate v1 cadence:** Tomas wires the domain-registrar adapter into `prototype/`; Senna reviews; DNS-as-code lands.

---

*Authority chain: Principle 1 (event-sourced — domain-registration events captured in event log on registration), Principle 2 (every clause carries a citation), Principle 3 (cloud-native; IaC for DNS at substrate-v1), Principle 4 (security designed-in; HSM-managed secrets), Principle 6 (single-graph: this plan is procedure-level under the operating-resilience policy); Principle 7 (Devon + Tomas operate as autonomous agents with this dispatch as their operating-spec realisation for the domain-registration mandate).*
