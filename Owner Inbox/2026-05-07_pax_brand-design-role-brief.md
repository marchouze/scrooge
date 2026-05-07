---
agent: PAX
trigger: role-research
asOf: 2026-05-07T11:25:00.000Z
decision-required: true
decisionId: S5
---

# PAX — role brief: Brand & design lead

**From:** PAX (role researcher)
**To:** Marc (CEO) — via Scrooge.
**For decision:** S5 — approve hire of brand & design agent; if approved, Nolan drafts the persona spec and the new agent's first run produces the inaugural brand package (name candidates, logo concepts, colour palette, overall feel).
**Origin:** CEO instruction 2026-05-07: *"Get graphic designer to design logo, name, colour palette and overall feel."*

> *In-voice role research per CLAUDE.md operating rules. Scrooge orchestrates only; the bank is AI-driven (Principle 7); a standing brand & design capability needs a standing autonomous agent, not a one-off task.*

## 1. Why this role exists

The bank's brand is a load-bearing artefact at licence-day:

- **Regulator engagement.** Pre-licence-application materials (S1 banking-licence pack, the meet-and-greet decks, the SARB Prudential Authority cover letter) read better with a coherent visual identity. Licence-day filings and ongoing public disclosures (BA returns, Pillar 3, AGM materials) all sit on a brand substrate.
- **Customer-facing identity at licence-day.** Niko's customer lifecycle activates at licence-day (per the AI-driven-bank reframe). The brand has to land *before* Niko goes live — onboarding flows, customer statements, the digital channel, FAIS-compliant advice records, terms-of-business templates.
- **Counterparty trust.** Saskia's institutional sales franchise (per the Global Markets system architecture brief, 2026-05-07) hinges on counterparty trust. Trading-desk pitch books, ISDA-cover materials, prime-broker introductions all need a brand that signals "this is a serious bank."
- **Internal coherence.** The dashboard, the agent deliverable templates, the Owner Inbox feed — all currently render as plain markdown and a Spartan dashboard UI. Not a problem during build, becomes one as the bank scales its surface area.

Brand is therefore not a one-off design exercise: it is a **standing capability** that produces and curates artefacts on cadence (new product family launching → new pitchbook template; regulator change → updated submission cover; complaint or TCF finding → review of customer-facing materials).

## 2. Scope of the role

**In scope:**

- **Visual identity.** Logo, wordmark, colour palette, typography system, iconography, illustration style, motion principles. Owns the brand-asset library and its versioning.
- **Naming.** The bank itself currently has no name (`Owner Inbox/2026-05-06_strategic-foundation.md` calls it "the bank"; `CLAUDE.md` calls it "the bank"). Naming is the single most consequential brand decision at this stage. The agent produces a longlist with regulatory, IP, linguistic, and market-positioning analysis; CEO chooses.
- **Voice & tone.** The written register the bank uses externally — regulator submissions, customer notices, investor materials, social. Distinct from each agent's internal in-voice register; this is the *bank's* voice when it speaks to the world.
- **Templates.** Pitch books, board packs (formatting layer; substance comes from Owen + the relevant seat per Principle 6 single-graph), regulator submissions, product factsheets, customer onboarding, statements, support correspondence.
- **Brand reviews.** Continuous curation — when a new artefact is authored, the agent reviews it against brand standards before it ships. Same shape as Vera's continuous-controls assurance, but for visual / verbal identity.

**Out of scope:**

- **Marketing strategy & channel buying.** Distinct role — typically goes under a "Marketing" or "Customer Acquisition" lead. Build phase doesn't need this; it activates at licence-day or shortly before, when Niko's customer pipeline starts.
- **Public relations & corporate communications.** Distinct role under a "Comms" lead.
- **Product UX design** for digital channels (mobile app, customer portal). Closer to Atlas/Niko engineering than to brand. Brand sets the visual language; product UX implements it.
- **Substantive content authoring** for any external artefact. Substance comes from the canonical authoring location per Principle 6 — the brand agent renders, doesn't author.

## 3. Regulatory and conduct touchpoints

The brand role is not a regulator-named seat (no statutory "head of brand" exists). It is, however, *load-bearing on several seats with regulator-named accountability*:

| Touchpoint | Regulator instrument | Engaged seat | What the brand agent produces |
|---|---|---|---|
| Marketing / advertising of financial products | FAIS Act s.14 (advertising); FSCA Conduct Standard 1 of 2020 (Banks); FSCA Standard 2 of 2018 (advertising rules within Twin Peaks) | Zara (CCO) | Customer-facing materials reviewed by Zara before publication; advertising claims sit in the obligations register (Mira) |
| Treating Customers Fairly (TCF Outcome 3 — clear and not-misleading information) | FSCA TCF policy; Insurance Act Regulations parallel for analogous products | Zara (CCO) | Brand voice & tone, plain-language standards, accessible-design standards |
| Banks Act use-of-name and trade-name registration | Banks Act 94 of 1990 s.22 (restricted use of "bank" / "banking" in trade names) | Owen (CoSec) for filing; Imani for ECTA / company-registration legal | Naming process flags any candidate that risks the s.22 restriction; legal sign-off required before adoption |
| Trademark, IP, domain | Trade Marks Act 194 of 1993; CIPC company-name registration | Imani (legal-as-code) | Naming candidates pre-cleared against CIPC + ZA trademarks + .za domain availability |
| POPIA — handling of customer-data in marketing | POPIA s.69 (direct marketing), s.18 (notification to data subjects) | Iris (Information Officer) | Customer-facing copy reviewed for s.69 consent language; marketing-data contracts |
| Cross-border brand consistency at licence-day expansion | (placeholder until expansion) | Imani | Brand-asset library tagged by jurisdiction once P5-multi-jurisdiction expansion lands |

The brand agent does **not** approve any of these — it produces and Zara/Owen/Imani/Iris approve in their respective lanes per Principle 6 upward (regulator → policy → procedure → system capability).

## 4. Where the role reports

**Recommendation: under Devon (COO).** Brand is part of the bank's operating substrate: it serves customer-facing capabilities (Niko), regulator-facing capabilities (Zara, Owen), counterparty-facing capabilities (Saskia / Kai), and internal capabilities (the dashboard, agent deliverables). Devon already owns the cross-cutting ops/platform/data/customer-facing engineering layer per CLAUDE.md "Engineering vs governance".

Alternatives considered:

- **Under Camille (CFO).** Plausible for an investor-relations-heavy bank. Less natural here — institutional / global-markets focus means counterparty trust matters more than retail brand pull.
- **Direct CEO report.** Plausible if branding were a bet-the-company exercise (e.g. a consumer-fintech going head-to-head with TymeBank or Discovery Bank). Not the case here — the bank is institutional, low-volume, regulator-and-counterparty-facing.
- **Under Saskia (Head of Global Markets).** Too narrow — would over-weight trading-desk identity at the expense of regulator and customer-facing materials.

Devon as the operational seat, with Zara having a hard sign-off on customer-facing materials and Owen having a hard sign-off on regulator-facing materials, is the structural fit.

## 5. Cadence and triggers

Same operating-spec shape as the seven existing agents (Vera, Atlas, Mira, Owen, Senna, Anya, Scrooge). Suggested:

- **Scheduled.** Weekly brand-review sweep — scans Owner Inbox deliverables published in the last 7 days, flags any that drift from brand standards (markdown formatting OK; visual / verbal identity not). Quarterly brand-system review.
- **Event-driven.** On `WorkstreamRegistered` for any new product-family / regulator-submission workstream, prepare a template package ahead of authoring. On any `CustomerOnboarded` event (post-licence-day) — confirm the welcome-pack template was used.
- **On-request.** Any time Marc, a governance seat, or another agent calls for a brand artefact (logo variant for a specific deck, naming review, palette extension).

The first run is not on cadence — it is the inaugural brand package: name candidates, logo concepts, colour palette, typography, voice & tone principles, the bank's overall feel as a one-pager. This is the deliverable that closes the immediate request.

## 6. Required expertise (what the persona has to know)

- **Identity systems for regulated financial institutions.** Knows the conventions (sans-serif wordmarks dominate banking; serif used sparingly for "trust" cues; navy / forest-green / charcoal / burgundy dominate; primary-coloured fintech palettes are jurisdictionally legible signals). Knows when to break convention.
- **South African market context.** Reads the local positioning of Standard Bank, Nedbank, Investec, RMB, Sasfin, TymeBank, Discovery Bank, Bank Zero. Knows the regulatory naming constraint (Banks Act s.22).
- **Institutional / wholesale brand register.** Reads JPMorgan, Goldman, Investec, Brookfield, Macquarie, Nomura — how they speak to counterparties vs retail. The bank's franchise is institutional global-markets (per the strategic foundation note); brand has to read that way.
- **Accessibility and inclusivity** — South African 11-language context; WCAG 2.2 AA as a baseline for digital surfaces; POPIA-compliant data handling in any brand-research process.
- **Production-grade output.** Vector files (SVG), token-based design systems (CSS variables / Tailwind config), asset library structure that integrates with Atlas's cloud substrate at M8.
- **AI-native workflow.** This is an agent, not a human designer-with-tools. The persona produces artefacts via tool-use (image generation, vector tools, font selection from open-licensed corpora) within a stable design-system frame. Output is reproducible and version-controlled.

## 7. Suggested persona name

The bank's existing agents follow short, memorable, internationally-pronounceable names with a slight literary or mythic register (Atlas, Mira, Anya, Senna, Vera, Owen, Scrooge, etc.). Suggested candidates for the brand-and-design seat, in preference order:

1. **Linnea** — Scandinavian-design lineage; soft, modern, professional; pairs well with engineering-led peers.
2. **Otto** — Bauhaus / design-canon associations; short; reads as senior.
3. **Yume** — Japanese for "dream"; avoids over-Anglo bias in the existing roster; carries a creative register without over-egging it.

Marc to choose; Nolan formalises in `/Team/<Name>.md` if S5 is approved.

## 8. Decision required

S5 — should I have Nolan hire this agent now, on the strength of this brief?

- **Approve.** Nolan drafts `/Team/<Name>.md` as a full operating spec following the Vera / Atlas / Mira shape; the new agent's first run produces the inaugural brand package (name longlist with regulatory IP analysis, three logo concepts, colour palette, typography, voice & tone, the bank's overall feel). Estimated turnaround: in-session if you say go now.
- **Approve with adjustments.** Tell me what to change — reporting line, scope cuts, persona name, sequencing — and I'll revise before Nolan starts.
- **Defer.** Brand stays unnamed and untemplated; this brief stays in the Owner Inbox as a queued item; we revisit after S1 (banking licence) clears its first regulator engagement gate.

—PAX
