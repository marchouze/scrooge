---
title: M4 FX foundation — sub-decisions surfaced
author: Saskia, Kai
date: 2026-05-09
summary: M4 foundation slice surfaces three sub-decisions whose answers are not yet in the inbox: settlement-path concentration backup correspondent, FX FinSurv URN cluster ownership cadence, and primary FX venue selection. Each is recommended-with-default; none gates the foundation slice.
decision-required: true
decision-id: D-M4-FX-SUB-DECISIONS
decision-category: near-term
decision-for-ceo: Approve the three M4 FX sub-decisions (backup correspondent, FinSurv curation cadence, primary venue selection) — or amend the recommended defaults.
decision-recommendation: Approve all three as recommended; defaults are operationally safe.
decision-owner: Saskia (Head of Global Markets) + Kai (engineering)
---

# M4 FX foundation — sub-decisions surfaced

**Authors:** Saskia (Head of Global Markets — markets-side franchise) · Kai (trading systems engineer)
**Coordinated with:** Tomas (correspondent connectivity) · Devon (third-party-risk governance) · Mira (FinSurv URN cluster) · Eitan (treasury HQLA path) · Helena (concentration appetite).
**Date:** 2026-05-09
**For:** Marc (CEO)
**Authority:** Extension of `D-MARKETS-SCHEMA-FOUNDATION` (resolved 2026-05-07) under the M4 phase. Builds on `Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md` — the three resolved D-FX-* decisions remain authoritative; this card surfaces only the residue uncovered while landing the M4 foundation slice.
**Status:** **Sub-decisions surfaced — not pre-empted.** The foundation-slice schema is correct under any combination of resolutions.

> **Derivation note (Principle 6 — downward).** This card sits at the *standard* layer. It cites resolved D-FX-* decisions, the FX product-family proposal, and the markets architecture. It authors no new substance — only flags the residual decisions that follow naturally from them.

---

## Why this card now

While landing the M4 foundation typed-event shapes, three operational questions surfaced whose answers are not yet in the inbox. Each follows from a resolved D-FX-* decision but adds an operational detail that decision did not specify. Per CEO instruction (CLAUDE.md operating procedures), Saskia + Kai surface them rather than pre-empt the CEO.

## D-M4-FX-SUB-1 — Backup correspondent identity

**Question.** D-FX-CLS-MEMBERSHIP cross-cutting follow-up names "primary correspondent + named contingent backup" with periodic switch-test, owned by Devon + Tomas. The primary correspondent identity is the open question; the **backup correspondent identity** and the **switch-test cadence** are second-order open questions that affect M4 substrate (the `correspondent` field on `FxSettlementInstructed` carries the party identity at instruction time).

**Recommendation (default-if-no-decision).** Standard pattern: name two CLS Settlement Members both holding South African correspondent relationships (typically one of {Standard Bank, FirstRand, Absa, Nedbank} as primary; one of the remaining three as backup; quarterly switch-test cadence to validate the secondary path). Devon + Tomas to draft the named-pair proposal at M4 substrate-readiness.

**Default-if-no-decision.** Devon + Tomas pick the named pair under their respective mandates (third-party-risk governance + payments-readiness); the named pair flows back into the dashboard as an informational record once contracted.

**Why surface here.** The substrate field carries the party identity; the substrate is correct without naming. But the **operational concentration appetite** (Helena's RAS B-cluster line) needs the named correspondent before it can be calibrated.

**Owners.** Devon (third-party-risk governance) · Tomas (correspondent connectivity) · Helena (concentration appetite line) · Saskia (markets impact).

## D-M4-FX-SUB-2 — FinSurv URN cluster curation cadence

**Question.** The FX product-family proposal §5 calls FinSurv "the largest single citation extension to the obligations register". Mira's M1 register-citation completion brief notes the FinSurv URN cluster lands at M4 — but the **curation cadence** is open. Three options:
1. **Single-shot at M4 substrate-readiness** — Mira curates the entire cluster pre-substrate-completion; FinSurv reporting goes live with full URNs from day one.
2. **Wave-based** — Mira curates the high-volume FinSurv categories first (current-account / capital-account); long-tail categories accept `[citation: TBC]` until commencement-of-trading; URNs upgrade as flows materialise.
3. **Commencement-bind only** — Mira treats the FinSurv cluster as commencement-bind (per the rules-bind-at-commencement memory) and curates the full cluster at commencement-of-trading; build phase carries `[citation: TBC]` everywhere.

**Recommendation.** **Wave-based (option 2).** The substrate already accepts `[citation: TBC]` per Principle-2 norm; high-volume categories are the smaller-effort head of the long-tail and matter most for the run-once-it-goes-live test. Single-shot pre-builds work that won't be exercised until commencement; commencement-bind-only forfeits the build-phase rehearsal value of the FinSurv reporting path.

**Default-if-no-decision.** Mira proceeds wave-based as the standard register-curation pattern.

**Why surface here.** The substrate is correct under all three options; the choice affects Mira's M4 workload sequencing.

**Owners.** Mira (compliance — FinSurv URN curation) · Zara (governance line — CCO) · Saskia (consuming agent for AD-status reporting flow).

## D-M4-FX-SUB-3 — Primary FX venue at M4

**Question.** The schema accepts `venue: string` (e.g. "OTC", "EBS", "Refinitiv", "JSE-FX"). The bank's **primary FX venue** at M4 is open: pure-OTC voice / chat (institutional dealer model), an electronic platform (EBS / Refinitiv FXall / Bloomberg FXGO), or JSE-listed FX futures (JSE Currency Derivatives, on-exchange).

**Recommendation.** **OTC-first at M4.** Institutional FX (Saskia's franchise) is dominantly OTC bilateral; the M4 foundation slice does not need an electronic-venue connector to be substrate-complete. Electronic-venue selection is M5+ franchise-pull (when client volume justifies the FIX-gateway threat-model + connector engineering). JSE-listed FX futures are out-of-scope for M4 — they're a different product family (exchange-traded derivative) than the OTC FX foundation this slice covers.

**Default-if-no-decision.** Saskia + Kai default to OTC-first; electronic-venue selection deferred to M5+ as a separate decision card.

**Why surface here.** The substrate has no venue-specific dependency; this is a strategic-cadence question, not a substrate question.

**Owners.** Saskia (markets franchise) · Kai (engineering — connector substrate when M5+).

---

## What this card does *not* surface

Already resolved (refer back to `Owner Inbox/2026-05-07_ceo-decisions_fx-sub-decisions.md`):
- D-FX-AD-STATUS — full Authorised Dealer pursued.
- D-FX-CLS-MEMBERSHIP — correspondent routing for FX settlement.
- D-FX-BOOK-BOUNDARY — markets-vs-treasury at execution-time tagging.

Already in the foundation-slice substrate (no decision needed):
- The four M4 in-scope variants (Spot / Forward / Swap / NDF).
- The `bookType` discriminator on `FxTradeExecuted` (required from M4 onwards).
- The `productTaxonomy` discriminator (`FX-spot`/`FX-forward`/`FX-swap`/`NDF`).
- `correspondent` party required when `settlementPath = "correspondent"`.

Already routed to other agents (no CEO decision needed):
- Atlas event-typing reuse (event-store registry registration of the two new event types).
- Bea IFRS classification dispatch on `bookType` + `productTaxonomy`.
- Yael tax classification on FX-derivative variants.
- Tomas correspondent-bank wiring (operational integration).
- Devon outsourcing-due-diligence + Directive 3 PA notification procedures.

---

—Saskia (markets-side franchise) · Kai (engineering)
