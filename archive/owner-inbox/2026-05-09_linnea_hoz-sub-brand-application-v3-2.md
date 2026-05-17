---
title: Hoz brand application v3.2 — sub-brand lockups (Hoz Bank + Hoz Securities)
author: Linnea (Brand & design lead)
date: 2026-05-09
summary: Extends the v3 group brand-application supplement (PR #72) with sub-brand lockups for Hoz Bank Limited and Hoz Securities Limited under the legal-entity tree resolved in D-LEGAL-ENTITY-TREE-V0 (PR #82). Defines naming convention, voice/tone delta per sub-brand, lockup-usage rules, pronunciation, and four new SVG assets in the brand library. No dashboard substrate change in this version — per-page sub-brand activation is deferred to v3.3.
decision-required: false
supersedes: nothing (extends v3 supplement)
---

# Hoz brand application v3.2 — sub-brand lockups

**Author:** Linnea (Brand & design lead)
**Reporting line:** Linnea (Brand & design lead) → Devon (COO, governance)
**Date:** 2026-05-09
**Authority:** D-LEGAL-ENTITY-TREE-V0 (PR #82, merged); extends Linnea v3 brand-application supplement (PR #72, merged); reuses Linnea v1 inaugural brand package (`Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md`).

---

## §1 — Sub-brand naming convention

Per D-LEGAL-ENTITY-TREE-V0, the Hoz group is structured as **Hoz Group Limited** (parent) with two operating subsidiaries: **Hoz Bank Limited** (banking licence holder) and **Hoz Securities Limited** (securities licence holder).

The brand naming convention follows:

| Context | Form |
|---|---|
| Legal-entity name (formal documents, contracts, regulator filings, financial statements) | "Hoz Bank Limited" / "Hoz Securities Limited" / "Hoz Group Limited" |
| Brand name (consumer / counterparty / regulator-correspondence body copy where the legal suffix is unnecessary) | "Hoz Bank" / "Hoz Securities" / "Hoz" |
| Casual / spoken | "Hoz Bank" / "Hoz Securities" / "Hoz" |

Rules:

- **Single space, no hyphen, capitalised.** "Hoz Bank" and "Hoz Securities" — never "HozBank", "Hoz-Bank", "hoz bank", "HOZ BANK".
- **The legal suffix** ("Limited" / "Ltd") appears wherever Companies Act 71 of 2008 or counterparty-contract custom requires the registered name in full — every contract front sheet, every set of statutory financial statements, every share-register entry, every regulator licence-application form, every incorporation document.
- **The brand short form** appears in body copy, email signatures, marketing, customer-facing UI, conversational regulator correspondence, and the sub-brand lockup SVG itself (which carries only the qualifier, not "Limited").
- The group brand is "Hoz" alone. "Hoz Group" is reserved for contexts where the consolidated entity-set must be named distinctly from any one operating subsidiary (e.g. consolidated financial statements, group-level risk-appetite statement preamble).

---

## §2 — Voice + tone for sub-brand contexts

The v1 brand package set a single Hoz voice: precise, prudent, confident, plain. v3.2 disaggregates that voice into three contextual registers — one per sub-brand and one for the umbrella. The underlying register is the same; the sub-brand contexts are calibrations, not departures.

### §2.1 Hoz Bank voice

**Tone:** prudent, conservative, regulator-aligned.

**Sentence shape:** declarative, short-to-medium length. Active voice where neutral; passive voice acceptable where the actor is the regulator or the regulation itself ("This return is filed under Regulation 6 of the Regulations Relating to Banks").

**Vocabulary:** banking-domain plain English. Avoid market-floor argot ("the print", "lift the offer", "axe", "iceberg"). Avoid marketing intensifiers ("revolutionary", "best-in-class", "world-class").

**Register for SARB / PA correspondence:** institutional-formal. Salutation by title and surname; closing with full legal entity name and the named human accountable executive.

**Example header — SARB cover sheet:**
> Hoz Bank Limited — quarterly return, BA 100 (Capital adequacy), period ending 31 March 2026.

### §2.2 Hoz Securities voice

**Tone:** precise, market-aware, JSE-aligned.

**Sentence shape:** declarative, slightly more active and economical than Hoz Bank. Trading-counterparty conversation carries an implicit market-fluency expectation; the bank does not over-explain market mechanics to professional counterparties.

**Vocabulary:** securities-domain plain English with terms-of-art used precisely. Quote conventions follow JSE / ISDA. Numerals are precise (basis points, lots, settlement cycles named explicitly).

**Register for JSE / FSCA correspondence:** still institutional-formal, but with market-mechanic precision in the substantive paragraphs. Same salutation conventions as Hoz Bank; same closing with full legal entity name.

**Example header — FSCA cover sheet:**
> Hoz Securities Limited — section 6 conduct return, period ending 31 March 2026.

### §2.3 Hoz (group) voice

**Tone:** the umbrella — both prudent AND market-aware; the same brand language anchored at a higher altitude.

**Use:** group-level press release, consolidated AGM materials, group-level investor deck, group-website root pages, group-level governance documents (group risk-appetite preamble, group code of conduct).

**Rule:** when in doubt about which sub-brand voice applies and the artefact spans both businesses, the group voice is correct and the appropriate lockup is the group lockup (`lockup-lockup.svg`).

### §2.4 Voice delta — at-a-glance

| Dimension | Hoz Bank | Hoz Securities | Hoz (group) |
|---|---|---|---|
| Sentence energy | Lower (declarative, measured) | Higher (active, economical) | Mid (anchored, neither leans) |
| Permitted argot | None | Term-of-art only | None |
| Counterparty assumption | Plain English; no market literacy assumed | Professional market-literacy assumed | Mixed; assume the more conservative reader |
| Lead with | The obligation / control | The market action / position | The institution |
| Avoid | Market-floor slang; marketing intensifiers | Over-explanation; consumer-banking framings | Either-business specifics |

---

## §3 — Lockup usage rules

### §3.1 When to use which lockup

| Context | Lockup |
|---|---|
| Hoz Bank Limited business card; Hoz Bank product letterhead; SARB / PA cover sheet; BA-return header; Banks-Act statutory disclosure | `lockup-bank.svg` (or `-reversed` for dark surface) |
| Hoz Securities Limited business card; trading-counterparty letterhead; JSE notice cover sheet; FSCA s.6-return header; securities-trading confirmation | `lockup-securities.svg` (or `-reversed` for dark surface) |
| Group-level corporate page; consolidated financial statements; group press release; AGM materials; group-website root; corporate stationery where the entity is unspecified | `lockup-lockup.svg` (or `-reversed`) — the v3 group lockup |
| Wordmark-only contexts (long horizontal surfaces, email signature footer) | `lockup-wordmark.svg` — group only; no sub-brand wordmark variant |
| Favicon, app icon, sub-32px contexts | `lockup-logomark.svg` — the group glyph; no sub-brand variant (per §3.2) |

### §3.2 Mark-only is reserved for the group

The mark-only logomark (`lockup-logomark.svg`) is the **group glyph**. It does not carry a sub-brand variant. Reasoning:

- At favicon / sub-32px sizes, the sub-brand qualifier ("Bank" / "Securities") would be unreadable; rendering it would produce visual noise without conveying the differentiation.
- The mark is the institution's anchor across all surfaces. Forking it would dilute its single-symbol equity.
- A 16px favicon for `bank.hoz.co.za` and `securities.hoz.co.za` (or whichever future domain split applies) carries the group mark; the surface chrome (page title, header, page content) carries the sub-brand differentiation.

### §3.3 Construction discipline (across all four new SVGs)

- The mark element (circle d=56u, chord at y=24u, stroke 2u/3u) is **byte-for-byte identical** to `lockup-lockup.svg`. The mark is the consistent group anchor; sub-brand differentiation lives only in the qualifier.
- The wordmark "Hoz" is **byte-for-byte identical** to `lockup-lockup.svg` (Inter 700, 36u, x=76, y=44, letter-spacing -0.5, fill `#1F2A37` in light or `#F7F4EE` in reversed).
- The sub-brand qualifier ("Bank" / "Securities") is set in **IBM Plex Sans 500 at 20u** (per v1 typography choice — IBM Plex Sans is the secondary face of the Hoz typographic system; Inter is the wordmark face). The qualifier is visually distinct from the wordmark in both family AND weight, signalling that it is a **typographic suffix, not a separate logo**.
- A **1u-wide vertical divider** at x=144u, running y=20u→44u, separates the wordmark from the qualifier. The divider is the typographic device that prevents the qualifier from reading as a continuation of the wordmark.
- The qualifier baseline (y=40u) sits at the optical baseline of the wordmark — this is *not* the wordmark's mathematical baseline (y=44u) because the qualifier's smaller cap-height shifts its optical centre. The 4u offset is calibrated for visual alignment.
- Reversed variants use byte-identical shapes with the palette inverted — Slate-Deep field (`#0F1722`) and Paper ink (`#F7F4EE`) on mark + wordmark + divider + qualifier.

### §3.4 Clear-space and minimum size

Sub-brand lockups inherit v3 supplement §2.1 clear-space rules: **one mark-diameter** on all sides.

Minimum sizes:

| Lockup | Min width |
|---|---|
| `lockup-bank.svg` (280u native) | 184px |
| `lockup-bank-reversed.svg` | 184px |
| `lockup-securities.svg` (348u native) | 248px |
| `lockup-securities-reversed.svg` | 248px |

Below the minimum, fall back to the group lockup or the logomark.

---

## §4 — Pronunciation guide

- **Hoz** — rhymes with *pause*. Single syllable. (Confirmed in v3 supplement §3.)
- **Hoz Bank** — say each word; do not contract. Two stressed syllables: HOZ — BANK.
- **Hoz Securities** — say each word; do not contract. Stress pattern: HOZ — se-CUR-i-ties.
- The sub-brand qualifier is plain English. There is no proprietary pronunciation for "Bank" or "Securities".

---

## §5 — Authority + cross-references

| Reference | Role |
|---|---|
| D-LEGAL-ENTITY-TREE-V0 (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-legal-entity-tree-v0.md`; PR #82, merged) | Policy authority for the sub-brand structure (Hoz Group Limited / Hoz Bank Limited / Hoz Securities Limited). |
| Imani + Owen — entity tree v0 (`Owner Inbox/2026-05-09_imani-owen_legal-entity-tree-v0.md`) | The legal-entity tree this brand structure mirrors. |
| Linnea v3 brand-application supplement (PR #72, merged) | The substrate v3.2 extends — group wordmark, group lockup, group logomark, favicon family, pronunciation, palette, typography. |
| Linnea v1 inaugural brand package (`Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md`) | Original typography (Inter / IBM Plex Sans / IBM Plex Mono) and palette (Slate-Deep, Paper, Slate ink) reused unchanged in v3.2. |

### §5.1 Substrate gap — v3.3 dashboard per-page sub-brand activation

The dashboard shell (PR #52, merged) currently surfaces the **group brand only** via `lockup-direction-a.svg` (per PR #61). The sub-brand lockups land in the brand library in v3.2 but are **not yet wired into per-page chrome**.

Per-page sub-brand activation — e.g. `markets.html` showing the Hoz Securities lockup in its header chrome, banking pages showing the Hoz Bank lockup — is a **v3.3 substrate task**. It requires:

- A per-page brand-context selector in `_shell.css` and the dashboard shell HTML emitter, choosing the appropriate lockup from a typed map keyed by page identity.
- A page→sub-brand mapping config (Hoz Securities for markets / trading / surveillance pages; Hoz Bank for banking-product / capital / liquidity pages; Hoz Group for governance / committee / consolidated pages) — itself a register entry under Principle 6 to keep page→entity attribution citable.
- A retrofit pass over existing pages to set their brand context.

This work lands when the per-page chrome retrofit happens. v3.2 explicitly does not change `_brand.css` or `_shell.css` — the SVGs are content additions only.

### §5.2 Substrate gap — autonomous brand-application enforcement

Today, brand-lockup choice in any deliverable (board pack, regulator letter, customer statement) is a manual judgement against §3.1. There is no recon harness asserting that, e.g., a SARB-bound document carries `lockup-bank.svg` and not the group lockup. A future Vera continuous-controls recon (Wave-5+) could assert the Reg → Lockup mapping at artefact-generation time. Logged here as a roadmap item rather than an active gap.

---

## §6 — Change log

| Version | Date | Change |
|---|---|---|
| v3.2 | 2026-05-09 | Sub-brand lockups for Hoz Bank Limited + Hoz Securities Limited (this document); 4 new SVGs; sub-brand naming convention; sub-brand voice + tone delta; lockup-usage rules; pronunciation. |
| v3 | 2026-05-09 | Group brand-application supplement (PR #72) — group wordmark, group lockup, group logomark, favicon family, palette, typography. |
| v1 | 2026-05-07 | Inaugural brand package — name, mark directions, typography, palette, voice. |
