# Brief — Markets franchise design

**From:** Scrooge (Chief of Staff)
**To:** Saskia (Head of Global Markets) — primary owner.
**Cc:** Helena (CRO), Camille (CFO), Eitan (Treasurer), Zara (CCO), Owen (CoSec), Devon (COO).
**Engineering:** Kai (trading systems), Imani (legal-as-code), Tomas (operations & payments), Ravi (treasury / ALM), Anya (data), Rohan (risk).
**Date:** 2026-05-06
**Authority:** CEO strategic-foundation decision (2026-05-06) — `Owner Inbox/2026-05-06_strategic-foundation.md`.
**Deliverable:** Markets franchise design proposal — written, in `Owner Inbox/`, ~2 weeks.

## Why now

The CEO has fixed the bank's product, client, geographic and capital scope. Your franchise *is* the bank. B5 (trading mandate) — previously deferred — is now the primary forward decision and the centre of gravity of the next pack.

## Scope (CEO-set, not for re-litigation)

- **Products:** JSE-listed bond trading; JSE-listed equity trading; OTC interest-rate derivatives.
- **Clients:** Large SA corporates; banks; non-bank financial institutions. Institutional-only.
- **Geography:** South Africa, single branch.
- **Capital envelope:** ~R300m (binding constraint).
- **Banking licence:** deferred. Interim posture is a parallel CEO decision; design assuming both modes are possible.

## What I need from you

A single proposal document covering:

### 1. Product specification

- **JSE bonds** — universe (govt — SAGB only? plus corporate? plus inflation-linked?), listed-traded vs OTC-with-listed-references, repo participation.
- **JSE equities** — universe (Top-40? full board?), market-making vs agency, ETF participation.
- **OTC IRD** — product list (vanilla swaps, FRAs, OIS, basis swaps, swaptions, caps/floors), ZARONIA-aligned curve framework (post-JIBAR transition), foreign-currency leg appetite.

### 2. Posture

- Market-making vs agency vs prop on each product line.
- Risk-taking appetite envelope (within Helena's RAS — but propose what *you* would target).
- Counterparty-set ambition (top-tier institutional only, or broader).

### 3. Documentation programme

- ISDA Master + Schedule + CSA template (Imani).
- GMRA for repo (Imani).
- Client onboarding documentation (Niko + Imani).
- JSE-membership / sponsored-access documentation if relevant.

### 4. Market access

- JSE membership: direct authorised-user vs sponsored access (interim) vs both. Concrete proposal with cost / timeline / dependency on banking licence.
- Trading-venue connectivity: FIX, colo, MD subscriptions.
- ZARONIA fixings, OIS reference rate sourcing.

### 5. Technology & operations dependencies

- OMS / EMS requirements (Kai's build scope).
- STP to settlement (Tomas).
- Surveillance feeds and market-abuse posture (Mira / Senna).
- Real-time risk feeds to Rohan's engine.
- Position-keeping and end-of-day P&L flow to Bea.

### 6. Capital, funding, collateral

- Coordinate with Camille / Eitan on the R300m envelope: how much risk capital is feasible across the three product lines under Standardised Approach market-risk RWA, plus SA-CCR for IRD CCR.
- Repo book sizing for funding.
- Collateral inventory & CSA terms.

### 7. Conduct & surveillance

- Market-abuse regime under FMA 19 of 2012 — front-running, layering, spoofing, insider-trading. Surveillance scope statement (with Mira).
- Personal-account-dealing policy reach to dealing-room staff (with Sade / Helena).
- Dealer-mandate framework (with Helena).

### 8. Open questions for CEO (within your proposal)

The questions you can't decide alone — surface them clearly. The CEO has already flagged §5 of the strategic-foundation doc; build on that list.

## Working method

- **Coordinate explicitly with:** Helena (RAS calibration), Camille (capital), Eitan (funding/collateral), Imani (documentation), Kai (technology), Tomas (settlement). Pull the others in as you need them.
- **No new substance authored at the presentation layer (P6).** Cite back to the obligations register for regulatory drivers; cite back to RAS / policy library for governance constraints.
- **No orphan capabilities (Principle 6 — upward chain).** Anything you propose Kai / Tomas / Anya build must trace to a procedure (existing or to-be-drafted) which traces to a policy.

## Cadence

- Drop questions / blockers into `Team Inbox/` as they arise.
- Final proposal in `Owner Inbox/` ~2 weeks. I'll route to Marc.
- Helena and Camille will be material contributors — coordinate, don't sequence around them.

—Scrooge
