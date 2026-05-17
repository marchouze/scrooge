---
title: "Hoz applied to substrate v0 — wordmark, titles, canonical bank-name register"
author: "Linnea (Brand & design lead) + Atlas (Core banking platform architect) + Anya (Data / analytics engineer)"
date: 2026-05-09
summary: "v0 application of the CEO-selected name 'Hoz' across the dashboard substrate. Canonical-source register at Regulations/_bank-name.md established as the single read site; brand tokens, wordmark SVGs, favicon, page <title> pattern across all 9 sibling pages, and bankName field on DashboardState all derive from there."
decision-required: false
---

# Hoz — substrate application v0

This deliverable closes out the brand-substrate work for D-BANK-NAME-SELECTION (revised 2026-05-09; PR #57 decision record). It applies the name "Hoz" to the dashboard substrate and establishes the canonical register that all downstream readers — code, brand assets, board packs, regulator filings, customer-facing pages — derive from.

The branch is stacked on PR #52 (bank UI shell v0) and was originally scoped for "Lucet". The CEO reversed the choice to "Hoz" before any Lucet PR merged, so there is no Lucet residue on this branch.

## What landed

| Artefact | Path | Purpose |
|---|---|---|
| Canonical-source register | `Regulations/_bank-name.md` | Single citable bank-name source. URN `urn:obligation:bank:gv:bank-name-registered:v1`. Mira (Compliance / RegTech engineer) lands the formal `_obligations-register.md` row separately on `claude/mira-finsurv-urn-cluster-wave-1`. |
| `--brand-name` token | `prototype/dashboard/public/_brand.css` | CSS-level mirror for legacy components that don't read `/api/state`. |
| Wordmark | `prototype/dashboard/public/home.html` (header) | Renders the active `logo-direction-a.svg` lockup. |
| Three-letter logo SVGs | `prototype/dashboard/public/brand/logo-direction-{a,b,c}.svg` | Direction A active; B + C alternates retained for the Linnea v3 supplement. |
| Favicon | `prototype/dashboard/public/favicon.svg` | Mark-only variant; tab + bookmark identifier. |
| Page-title pattern | All 9 sibling pages (`activity.html`, `agents.html`, `architecture.html`, `decision.html`, `escalations.html`, `fleet.html`, `health.html`, `index.html`, `policies.html`) | `<page-purpose> · Hoz` consistently. |
| `bankName` on `DashboardState` | `prototype/dashboard/types.ts` + `prototype/dashboard/derive.ts` | Sourced from `Regulations/_bank-name.md`; surfaced via `/api/state`; consumed by `_shell.js` and any per-page header. Falls through to `bank.name` if the register is unreadable. |

The derivation pipeline now reads the register on every refresh through `readBankNameFromRegister()` in `derive.ts`. The register is added to `watchTargets()` so edits trigger re-derivation; it is added to `SourcePaths` so tests and alt-layouts can override it; it is added to `defaultSourcePaths()` so the server picks it up automatically.

## Active logo direction (Direction A — geometric mark + wordmark lockup)

The active variant is `prototype/dashboard/public/brand/logo-direction-a.svg`: a circle (d=56u) with a horizontal chord at y=24u, paired with the wordmark "Hoz" set in Inter 700 at ~36u. The mark is **name-agnostic by design** — the same chord-on-circle motif renders on the favicon and would survive a future name change.

The wordmark sits to the right of the mark with a fixed gutter; lockup proportions follow Linnea's inaugural brand package §2.1 wordmark-to-mark ratio. Letter-spacing is -0.5 for optical kerning at the current size.

**Decision: Direction A is the right choice for v0.** Rationale: (a) it pairs an abstract mark with the wordmark, which gives the brand a place to retreat to (the mark alone) at small sizes — favicon, tab, in-product chrome; (b) the chord-on-circle is unique without being noisy, and reads well at 16×16 (favicon) through to the 220×64 lockup; (c) the geometric construction is reproducible programmatically, so we don't depend on a designer to render new sizes.

Direction B (monogram) and Direction C (wordmark-only) are kept as alternates for the Linnea v3 supplement to evaluate against printed and small-format use-cases the v0 substrate doesn't surface.

## Pronunciation posture

The brief recommended **"rhymes with 'pause'"** ("hawz" / /hɔːz/). This is **confirmed** for v0. The posture is surfaced as a tooltip / `aria-label` in the shell header (per `Regulations/_bank-name.md` row "Pronunciation posture") so non-English-first speakers see it on hover.

The posture is supplement-pending — Linnea v3 is owed the formal phonemic rendering (IPA), an audio sample, and a recommendation on whether the spelling should be hinted in the wordmark itself (e.g. a faint subscript "/hɔːz/" in marketing-only contexts; we do not recommend altering the wordmark).

## Linnea v3 brand-supplement scope (owed)

The v0 substrate is intentionally minimal — wordmark + favicon + token + register — to unblock the dashboard. The v3 supplement Linnea (Brand & design lead) owes covers:

1. **Full lockup family** — Direction A at the canonical sizes used in board packs, regulator submissions, customer letters, and product UI (16, 24, 32, 48, 64, 96, 128, 220 width). Padding, clear-space, mis-use examples.
2. **Favicon iteration** — the v0 mark-only favicon (`favicon.svg`) is a placeholder rendering of the chord-on-circle. The supplement should evaluate whether a higher-contrast / filled variant is needed for OS dark mode + browser tab pinned states, and produce `.ico` + Apple-touch sizes.
3. **Sample document headers** — board pack cover, BA-return cover, customer statement header, customer letter letterhead, internal memo template. Each surfaces the wordmark at the right scale and the registered-name footnote.
4. **Pronunciation guide** — IPA, audio sample, "first-mention" hint pattern for marketing copy, FAQ row for the customer-facing site.

## Mira URN row (owed)

The formal obligations-register row for `urn:obligation:bank:gv:bank-name-registered:v1` is owed. Mira (Compliance / RegTech engineer) lands it on `claude/mira-finsurv-urn-cluster-wave-1` to avoid file-clash with this branch. The register entry already declares the URN; the obligations register is the cross-referenced canonical citation site.

## Substrate gaps surfaced

1. **No automated drift recon between register and `dashboard-state.json` cache** — the register and the curated seed both carry the bank name. Drift is *reportable* under Vera (Internal-audit / continuous-assurance engineer) Wave-4 #16 prose-duplication recon, but no dedicated test asserts the equality. Recommend a recon line: `state.bankName === readBankNameFromRegister(register)` on every dashboard re-derivation. **Roadmap item.**
2. **No CIPC pre-clearance gate** — the bank uses "Hoz" in substrate from this commit, but Companies Act registered-name discipline (CIPC name reservation, Trade Marks Act 194 of 1993 cross-check, `.za` domain registration, 11-language cross-check) is owed by Imani (Legal-as-code engineer). LICENCE-BIND, not COMMENCEMENT-BIND — must complete before licence-application bundle, not before continued internal use. **Imani naming-pre-clearance workstream.**
3. **No agent-runtime substrate to fire this work autonomously** — Linnea, Atlas, and Anya were realised as Scrooge-coordinated in-session runs against their personas. A standing-agent runtime (Principle 7) would have run the brand-application sequence — register-write → derive.ts wiring → page-title sweep → favicon → completion note → PR — without the orchestrator. **Catalogued under the agent-runtime roadmap.**
4. **`prototype/seeds/dashboard-state.json` is a cache that drifts** — the seed file already carries `"name": "Hoz"` on the `bank` object, but it does not carry the new top-level `bankName` field; the next refresh re-derives and re-writes the cache, so drift is self-healing on the first server boot. The seed is not hand-edited per memory `feedback_dashboard_always_derived.md`. **No action.**

## Verification

- `prototype && bun run typecheck` — clean.
- `prototype && bun run lint` — clean.
- `prototype && bun run ci` — three pre-existing failures (Vera overnight-recon × 2; Rohan amber fixture); no new failures introduced. Pre-existing failures are catalogued on `main`; not introduced by this branch.
- Live dashboard verification: `BANK_DASHBOARD_PORT=3011 bun run dashboard` then `curl http://localhost:3011/home.html` confirms the wordmark and `<title>` "operations · Hoz" / "home · Hoz" patterns; `/api/state` includes `bankName: "Hoz"`.

[citation: D-BANK-NAME-SELECTION revised 2026-05-09; PR #57 decision record; Linnea (Brand & design lead) inaugural brand package 2026-05-07 §1.7 + §2.1; `Regulations/_bank-name.md` canonical register]
