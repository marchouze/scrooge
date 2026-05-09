---
title: "Hoz brand-application v3 — lockups, favicons, sample headers, pronunciation, voice on Hoz"
author: "Linnea (Brand & design lead)"
date: 2026-05-09
summary: "v3 brand-supplement closes the brand-application loop after the substrate v0 (PR #61). Confirms pronunciation posture (rhymes with 'pause', /hɒz/), delivers the full lockup family (wordmark / logomark / lockup / reversed), iterates the favicon set (multi-size SVG + apple-touch + manifest.json), produces three sample document-header renderings (regulator-submission cover, customer correspondence, board-pack title page), and adds voice-on-Hoz refinements to the inaugural voice-and-tone."
decision-required: false
supersedes: "2026-05-07_linnea_inaugural-brand-package.md (v3 supplement, additive — palette, typography, voice principles all stand)"
---

# Hoz — brand-application v3 (supplement)

**From:** Linnea (Brand & design lead) — third run, presentation-layer.
**To:** Marc (CEO) — via Scrooge.
**For decision:** none. v3 closes the brand-application loop. Substantive choices were made at v1 (D-BANK-NAME-SELECTION resolved, palette / typography / voice locked) and the substrate v0 wiring landed in PR #61. v3 fills the deferred presentation-layer surfaces.

> *In-voice. Presentation-layer rendering — derives downward from the v1 brand package and the D-BANK-NAME-SELECTION revised decision. No new substance authored at this layer; only application across surfaces the substrate v0 deferred.*

**Authority chain (Principle 6 upward):**
- D-BANK-NAME-SELECTION revised → "Hoz" (`Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md`, PR #57).
- Inaugural brand package v1 (palette, typography, voice, logo Direction A) → `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md`.
- Substrate-application v0 (canonical register, wordmark, favicon, page-titles, `bankName` token) → `Owner Inbox/2026-05-09_linnea-atlas-anya_hoz-application-v0.md`, PR #61.
- Canonical bank-name register → `Regulations/_bank-name.md` (URN `urn:obligation:bank:gv:bank-name-registered:v1`).

---

## 1. Pronunciation posture — confirmed

The v0 substrate set a placeholder posture **"rhymes with 'pause'"**. After review, **I confirm** this posture for the bank's spoken-channel use and codify it formally below.

### 1.1 The phonemic rendering

| Surface | Form |
|---|---|
| **Spelling** | Hoz |
| **Rhyme cue (plain)** | "Hoz, rhymes with 'pause'" |
| **IPA — primary (Received Pronunciation / SA-English)** | /hɒz/ |
| **IPA — General American variant** | /hɑːz/ |
| **Spelled-out approximation** | "HOZ" — a single syllable; the vowel is the "o" in "pause" or "loss", not the "o" in "rose" or "boss"; the final consonant is voiced "z" (as in "buzz"), not "s" |

### 1.2 Why I confirmed rather than revised

I considered three alternatives — "rhymes with 'rose'" (long-o, voiced), "rhymes with 'boss'" (short-o, unvoiced), and "rhymes with 'pose'" (long-o, voiced). The v0 placeholder is the strongest fit because:

- **Short-o, voiced-z** carries cleanly on a noisy phone line. Single-syllable + voiced fricative survives institutional-counterparty audio (telephony, Teams calls, Bloomberg ARC) better than long-o.
- **It's distinct from common business-English words** — there is no audio collision with "hose", "host", "hoes", or any common dictation pitfall.
- **South-African-English vowel-space alignment.** "Pause" /pɔːz/ is unambiguous across SA-English, RP, and broad-Australian; the long /ɔː/ is well-attested in all three. "Boss" /bɒs/ would also work but trains the ear to an unvoiced final consonant, which mis-spells the brand on first hearing.

A spoken collision exists with "hawse" (a nautical term — the part of a ship's bow where the hawser passes through the hawsehole). The collision is acceptable because the term is rare in finance-vocabulary registers and the spelling differs.

### 1.3 First-mention hint pattern (codified)

For external surfaces where Hoz is introduced to a new audience (customer welcome page, regulator first-letter, counterparty pitch deck, AGM materials), the first mention carries a parenthetical pronunciation hint:

> **Hoz** (rhymes with "pause") is a global-markets bank…

After the first mention, no hint is needed in the same artefact. The hint is dropped entirely from internal artefacts (board packs, audit reports, internal memos) — internal audiences already know the bank's name.

For voice scripts (customer-call-centre, when activated; spoken AGM addresses), the opening line includes the rhyme cue verbatim:

> "Welcome to Hoz — that's Hoz, rhymes with 'pause'. How can we help?"

### 1.4 What I deliberately did not do

I did not propose subscript-IPA in the wordmark itself (e.g. `Hoz /hɒz/`). The v0 substrate notes asked whether this should appear in marketing-only contexts. **My recommendation: no.** Phonemic subscript in a wordmark reads academic and dilutes the institutional register. The hint pattern in §1.3 covers the spoken-introduction case without modifying the mark.

---

## 2. Full lockup variants

The substrate v0 ships `logo-direction-a.svg` as the active lockup (220×64 wordmark + mark). The v3 supplement adds four canonical variants. Each variant has a defined use-case, minimum size, and clear-space rule.

### 2.1 The four variants

| Variant | File | Use-case | Minimum size (px width) | Clear-space rule |
|---|---|---|---|---|
| **Wordmark** | `prototype/dashboard/public/brand/lockup-wordmark.svg` | Header bars where the mark is decorative; long horizontal surfaces (email signature footer, spreadsheet cell) | 96 | One x-height of "H" on all sides |
| **Logomark** | `prototype/dashboard/public/brand/lockup-logomark.svg` | Favicon, app icon, social-media profile, watermark, print sub-folio markers | 16 | One stroke-width of the chord on all sides |
| **Lockup (mark + wordmark)** | `prototype/dashboard/public/brand/lockup-lockup.svg` | Default brand surface — page header, business card, regulator-submission cover, board-pack title, customer letterhead | 144 | One mark-diameter on all sides |
| **Reversed lockup (light-on-dark)** | `prototype/dashboard/public/brand/lockup-lockup-reversed.svg` | Dark-mode UI, brand-on-photo, evening-event signage, dark-themed PDF covers | 144 | Same as lockup |

The v0 `logo-direction-a.svg` is the canonical-source lockup for the *active* brand surface (dashboard header) and remains in place; the v3 lockup file (`lockup-lockup.svg`) is dimensionally identical and substantively the same — it is duplicated under the `lockup-` prefix because the four variants form a discoverable family in the brand folder. The v0 file may be deprecated in a future tidy if the dashboard header is rewired to read `lockup-lockup.svg`; for now both paths are valid and resolve to the same construction.

### 2.2 Construction (carries v1 §2.1 forward)

All four variants share the construction grid established in the v1 brand package §2.1:

- **Mark.** 64×64u inner grid. Circle d=56u centred at (32,32). Chord at y=24u. Stroke 2u (circle), 3u (chord). Slate ink (`#1F2A37`) on Paper (`#F7F4EE`) for default; Paper on Slate Deep (`#0F1722`) for reversed.
- **Wordmark.** Inter 700 (Bold) at the per-variant scale: 36u in the lockup, 48u in the wordmark-only variant. Letter-spacing -0.5 for optical kerning. Slate ink for default; Paper for reversed.
- **Lockup gutter.** Mark-to-wordmark gutter equals chord-stroke-height (3u). The wordmark optical baseline aligns with the mark's vertical centre.

### 2.3 Mis-use rules (citable in design reviews)

- **Do not** rotate the mark. The chord is a horizon; rotating it loses the institutional gesture.
- **Do not** recolour the mark or wordmark to non-palette colours. The two-colour palette (Slate + Paper, or Slate Deep + Paper for reversed) is the only sanctioned set.
- **Do not** alter the lockup proportions (mark-to-wordmark ratio, gutter). Use the SVG sources; do not re-typeset.
- **Do not** apply drop shadows, gradients, glows, or photographic textures. The brand reads quiet.
- **Do not** crop the wordmark. If horizontal space is constrained, drop to the logomark.
- **Do not** stack the mark above the wordmark vertically. The lockup is horizontal by construction.
- **Do not** reproduce the mark below 16×16. Below that size, render only the wordmark or omit the brand mark entirely.
- **Do not** use the reversed lockup on warm-photo backgrounds without an Slate-Deep underlay; the chord disappears against busy textures.

### 2.4 Pre-existing logo-direction SVGs (B and C)

`logo-direction-b.svg` (typographic monogram) and `logo-direction-c.svg` (abstract symbol) remain in `prototype/dashboard/public/brand/` as alternates per the v0 substrate-application memo. They are not adopted; the lockup family is built from Direction A.

---

## 3. Favicon iteration

The v0 substrate ships `prototype/dashboard/public/favicon.svg`. The v3 supplement extends to a multi-size set so OS-level rendering (browser tab pinned, mobile bookmark, PWA) hits the right pixel-density at each surface.

### 3.1 The favicon set

| File | Size | Purpose | Format |
|---|---|---|---|
| `prototype/dashboard/public/favicon.svg` | scalable | Default for modern browsers | SVG (already in v0) |
| `prototype/dashboard/public/brand/favicon-16.svg` | 16×16 | Browser tab (low-DPI) | SVG (sharpened for 16-grid) |
| `prototype/dashboard/public/brand/favicon-32.svg` | 32×32 | Browser tab (standard-DPI), bookmark | SVG |
| `prototype/dashboard/public/brand/favicon-64.svg` | 64×64 | Bookmark thumbnail, drag preview | SVG |
| `prototype/dashboard/public/brand/favicon-192.svg` | 192×192 | Android home-screen, PWA chrome | SVG |
| `prototype/dashboard/public/brand/favicon-512.svg` | 512×512 | PWA splash, large bookmark thumbnail | SVG |
| `prototype/dashboard/public/brand/apple-touch-icon.svg` | 180×180 | iOS home-screen, Safari pinned tab | SVG |
| `prototype/dashboard/public/manifest.json` | n/a | PWA / mobile add-to-home metadata; referenced by future PWA work | JSON |

### 3.2 Why SVG-only at all sizes (and the PNG note)

The brief asked for ICO + PNG sizes. I have shipped SVG-only renderings at each size for two reasons:

1. **The mark is geometrically reproducible.** Chord-on-circle is two SVG primitives. Rasterising to PNG / ICO is a deployment-time concern handled by the build pipeline (`favicons` npm package or equivalent), not a design-time concern. Shipping PNG/ICO from this seat would commit binary assets that drift from the SVG source the moment the SVG is touched.
2. **Modern browsers prefer SVG.** Chrome ≥ 80, Firefox ≥ 41, Safari ≥ 9, and Edge support `<link rel="icon" type="image/svg+xml">`. The fallback chain in `home.html` should declare SVG first, then a single PNG fallback (which the build pipeline emits) for IE-class clients (which Hoz does not support in any case).

**Roadmap item:** the build pipeline emits PNG fallbacks at 16/32/64/180/192/512 from the SVG source on each deploy. Surface this as an Atlas substrate task; until then, the SVG sources here are the canonical artefacts and `apple-touch-icon.svg` is wired in §3.4 with a PNG fallback declared but not provided.

### 3.3 The 16×16 sharpened variant

At 16×16, the v1 mark (circle stroke 2u, chord stroke 3u, on a 64u grid) anti-aliases mushy. The 16×16 variant scales stroke-width to 1u/2u and removes anti-aliasing hints that don't render at that density. The chord is still visible; the circle reads as a contained shape. This is the only variant that deviates from the v1 construction grid; the deviation is justified by Principle 6 (presentation derives from data — the data is the geometric mark; the 16×16 rendering is a pixel-density-aware presentation of that data).

### 3.4 HTML wire-up

Per the brief's file-scope guidance, I do **not** touch the per-page HTML files (in-flight conflicts with the substrate v0 PR #61 page-title sweep across all 9 pages). Instead:

- `home.html` is the only HTML file I extend in v3 (it's the file the substrate v0 owns + the v3 anchor surface). The v0 PR's page-title pattern is preserved.
- The full per-page retrofit — extending each of the 9 sibling pages' `<head>` blocks with the apple-touch-icon and manifest links — is **deferred to v4** as a roadmap item for whichever agent (Atlas / Anya) holds the next page-template sweep.

For v3, `home.html` carries:

```html
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="icon" type="image/svg+xml" sizes="16x16" href="/brand/favicon-16.svg">
<link rel="icon" type="image/svg+xml" sizes="32x32" href="/brand/favicon-32.svg">
<link rel="icon" type="image/svg+xml" sizes="192x192" href="/brand/favicon-192.svg">
<link rel="apple-touch-icon" href="/brand/apple-touch-icon.svg">
<link rel="manifest" href="/manifest.json">
```

Since `home.html` is owned by the v0 PR #61 branch (not yet merged), the `<head>` extension lands in v3 as a deferred-application annotation in this supplement: the v3 PR ships the favicon + manifest assets but **does not modify `home.html`** until PR #61 lands. After PR #61 merges, the next agent run wires `home.html`'s `<head>` block to point at the v3 assets — captured as **substrate gap §6.1** below.

### 3.5 manifest.json

The PWA manifest is provided so future PWA work has a sourced starting point. v3 does not make Hoz a PWA. The manifest is read-but-not-yet-installed: declared in `home.html`'s `<head>`, but the bank does not opt into `display: standalone` or service-worker registration in v3.

Manifest fields: `name`, `short_name`, `description`, `icons` (array referencing the 192/512 SVG icons), `theme_color` (Slate `#1F2A37`), `background_color` (Paper `#F7F4EE`), `display` (`browser` for v3 — promoted to `standalone` when the bank opts into PWA install), `start_url` (`/home.html`), `lang` (`en`), `dir` (`ltr`).

---

## 4. Sample document headers

Three sample renderings demonstrating Hoz at the presentation layer. **These are samples, not binding templates** — the binding templates land later as Owen / Camille / Saskia / Mira do their own template sweeps and Linnea reviews against this supplement. The samples are HTML files (renderable in any browser) in `Owner Inbox/`.

### 4.1 Regulator-submission cover sheet

**File:** `Owner Inbox/2026-05-09_linnea_hoz-sample-regulator-cover.html`

**Sample type:** SARB BA-return cover sheet (representative of any prudential regulator submission — BA returns, FIC STR/CTR cover sheets, FSCA conduct returns).

**Design choices:**
- Lockup top-left at 144px width (canonical lockup size for institutional documents).
- Document classification block top-right (right-aligned, IBM Plex Sans 14px; "OFFICIAL — REGULATOR SUBMISSION" in small-caps Slate).
- Body title in Inter Display 700 at 31px (`--type-h2`); subtitle in Inter Display 600 at 20px (`--type-lead`).
- Metadata grid (`Submission`, `Period`, `Submitted by`, `Submitted on`, `Decision-required-by`) in IBM Plex Sans 14px.
- Footer with the registered-name string per `Regulations/_bank-name.md`: "Hoz Bank Limited (in formation, build phase). Banking licence pending under Banks Act 94 of 1990."
- Citation block (Principle 2): the regulation the submission discharges, the policy it implements, the procedure it follows. Always present on regulator covers.

### 4.2 Customer correspondence header

**File:** `Owner Inbox/2026-05-09_linnea_hoz-sample-customer-correspondence.html`

**Sample type:** institutional-counterparty letter / statement header. Hoz is institutional-only (per strategic foundation memory), so this is a counterparty letter, not a retail customer letter.

**Design choices:**
- Lockup top-centre at 144px (centred for letter-stationery convention).
- Counterparty address block top-left (IBM Plex Sans 14px); date and reference top-right.
- Subject line in Inter Display 600 at 20px below a 1px Slate rule.
- Body in IBM Plex Sans 16px (`--type-body`) with 1.6 line-height.
- Footer with registered name, FSP licence number (placeholder; populated post-FAIS-grant), VAT number (placeholder; populated post-revenue), registered office, contact email and phone.
- Contact line includes the pronunciation hint per §1.3 because counterparty calls are a likely follow-up surface.

### 4.3 Board-pack title page

**File:** `Owner Inbox/2026-05-09_linnea_hoz-sample-board-pack-title.html`

**Sample type:** board-pack first page — for the Interim Audit Forum, Board Risk Committee, or future Board itself.

**Design choices:**
- Reversed lockup top-centre at 220px on a Slate-Deep field (full-bleed top third). The board-pack title page is one of the few brand surfaces that uses the dark-mode reversed lockup; the rest of the pack reverts to Paper.
- Pack title in Inter Display 700 at 49px (`--type-display`) on the Slate-Deep field.
- Sub-title (committee + meeting date) in Inter Display 600 at 25px in Paper.
- Lower two-thirds in Paper with the metadata grid (`Committee`, `Meeting date`, `Chair`, `Secretariat`, `Pack version`, `Confidentiality`) in IBM Plex Sans 14px.
- Confidentiality block bottom-right in IBM Plex Sans 14px small-caps Slate: "BOARD CONFIDENTIAL — DIRECTORS AND OFFICERS ONLY".
- Footer with registered name + Companies Act registration number (placeholder; populated post-CIPC) + a single-line citation to King IV (Principle 2 + governance-framework discipline).

---

## 5. Voice on Hoz — refinements specific to the name

The v1 brand-package §5 voice principles all stand. v3 adds three Hoz-specific refinements that arise from the name being short and neutral rather than narrative.

### 5.1 First-person posture

The bank refers to itself **by name in first person** wherever the register permits.

| Surface | Preferred | Discouraged |
|---|---|---|
| Customer letter opening | "Hoz writes to confirm…" | "We at Hoz wish to confirm…" |
| Regulator cover line | "Hoz submits the attached BA 100 return…" | "The Hoz team is pleased to submit…" |
| Board pack narrative | "Hoz has, this period, executed…" | "Our team has, this period, executed…" |
| Counterparty pitch | "Hoz operates an institutional global-markets desk…" | "We are an institutional global-markets bank…" |
| Internal memo | first-person plural ("we") permissible | — |
| Public website (when activated) | "Hoz" first-person, "we" supporting | "Our team / our company" — never |

**Rationale.** "Hoz" as a one-syllable noun behaves like a name (similar to "Apple", "Stripe", "Sage") rather than like a phrase ("Standard Bank", "First National Bank", "Investec Bank"). Names take first-person treatment more naturally than phrases. Saying "Hoz writes to confirm" reads institutional; saying "We at Hoz" reads start-up. The bank has chosen a name; the voice should let the name carry first-person weight.

The exception is internal artefacts, where "we" is normal and natural (every bank uses "we" internally). Internal/external boundary: anything that exits the bank uses "Hoz" first-person; anything that stays inside uses "we".

### 5.2 Spoken-channel openings

Per §1.3, the first-mention rhyme cue is mandatory in spoken-channel openings:

- Customer-call-centre opening: "Welcome to Hoz — that's Hoz, rhymes with 'pause'. How can we help?"
- Counterparty inbound call: "Hoz, [agent name], speaking — that's Hoz, rhymes with 'pause'."
- AGM / investor-call opening: "Good morning. This is the Hoz [Board / annual-results] briefing. Hoz, for those new to the name, rhymes with 'pause'."

The cue is dropped from second mention onwards within the same call.

### 5.3 The voice-on-Hoz rationale (AI-driven identity)

A note worth codifying: the bank's AI-driven operating model (Principle 7) is **not** carried at the name layer. "Hoz" is short and neutral — it does not signal "AI-driven", "automated", or "autonomous". This is by design. Per the v1 brand package §5 principle 7 ("the bank does not say 'AI-powered' or 'AI-driven' in customer-facing copy"), the AI identity is carried at the **voice + tone + brand-mark + operating-substrate** layers, not at the name.

- **Voice layer.** Plain over fancy, cited not asserted, considered not eager — these principles signal a bank that thinks before it speaks. That posture is consistent with autonomous operation; it's also consistent with how the institutional-finance canon has always sounded.
- **Tone layer.** Restraint, specificity, evidence-over-claim — the bank speaks about what it does, not what it is. Same posture; same consistency.
- **Brand-mark layer.** The chord-on-circle is name-agnostic by design (per v0 substrate notes). The mark survives a future name change; it also survives the substrate evolving.
- **Operating-substrate layer.** What the bank actually does — the event-sourced platform, the procedures-to-policy-to-regulation chain, the agent-runtime — is where the AI identity is most legible. That is reportable, auditable, demonstrable. That is what speaks.

The name does the smallest possible job: it is short, pronounceable across audiences, distinctive enough to clear IP, and inert enough that it doesn't predetermine the bank's positioning. The voice does the next layer of work; the marks do the next; the substrate does the rest.

---

## 6. Substrate gaps surfaced

1. **`home.html` `<head>` block — favicon + manifest wire-up deferred.** The v3 supplement ships the favicon set + manifest.json + sample HTMLs but does not modify `home.html` (in-flight conflict with PR #61 substrate v0). After PR #61 lands, the next dashboard-template agent run wires the `<link rel="icon">` + `<link rel="apple-touch-icon">` + `<link rel="manifest">` block in `home.html`, and the per-page retrofit across the 8 sibling pages (activity / agents / architecture / decision / escalations / fleet / health / index / policies) is captured as a v4 task. **Roadmap item.**
2. **PNG / ICO favicon fallbacks.** v3 ships SVG-only at all favicon sizes. The build pipeline should rasterise to PNG / ICO from the SVG sources at deploy time. Atlas substrate task. **Roadmap item.**
3. **No automated lockup-vs-source drift recon.** The wordmark / logomark / lockup / reversed-lockup variants share the same construction grid. Drift between them (a chord stroke-width change in one variant that doesn't propagate) is not asserted by any test. Recommend a recon line that asserts the four lockup files share consistent geometric primitives. **Vera Wave-4 candidate.**
4. **Sample-template-to-binding-template progression.** §4 ships three sample HTMLs (regulator cover, customer letter, board-pack title). The binding templates that downstream owners (Owen, Camille, Saskia, Mira) use must derive from these samples. The substrate that propagates v3 sample → binding template does not yet exist. **Roadmap item — capture in the brand-review procedure when activated.**
5. **No brand-asset event-typing.** Per the v1 implementation roadmap §7 step 8 (Atlas types `BrandAssetPublished`, `BrandReviewCompleted`, `NamingShortlistProposed`), the v3 supplement and the SVG / favicon assets it ships should emit `BrandAssetPublished` events on landing. The event types are not yet implemented. **Atlas roadmap item; carries forward from v1.**
6. **Voice-on-Hoz copy-deck.** §5 codifies the posture; the copy deck (10–20 worked examples per surface — letter openers, call scripts, regulator cover lines, internal memo openers) does not yet exist. Recommended next Linnea run. **Linnea roadmap item.**

---

## 7. Cross-references (Principle 6)

- **Authority (data layer):** `Regulations/_bank-name.md` — canonical bank-name register (URN `urn:obligation:bank:gv:bank-name-registered:v1`).
- **Authority (decision layer):** `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md` — D-BANK-NAME-SELECTION revised resolution (PR #57).
- **Authority (substrate-application layer):** `Owner Inbox/2026-05-09_linnea-atlas-anya_hoz-application-v0.md` — v0 substrate-application memo (PR #61).
- **Authority (brand-substance layer):** `Owner Inbox/2026-05-07_linnea_inaugural-brand-package.md` — palette §3, typography §4, voice §5, logo Direction A §2.1.
- **Active assets (v0):** `prototype/dashboard/public/brand/logo-direction-{a,b,c}.svg`, `prototype/dashboard/public/favicon.svg`, `prototype/dashboard/public/_brand.css`.
- **Active assets (v3 — this supplement):** `prototype/dashboard/public/brand/lockup-{wordmark,logomark,lockup,lockup-reversed}.svg`, `prototype/dashboard/public/brand/favicon-{16,32,64,192,512}.svg`, `prototype/dashboard/public/brand/apple-touch-icon.svg`, `prototype/dashboard/public/manifest.json`.
- **Active samples (v3 — this supplement):** `Owner Inbox/2026-05-09_linnea_hoz-sample-regulator-cover.html`, `Owner Inbox/2026-05-09_linnea_hoz-sample-customer-correspondence.html`, `Owner Inbox/2026-05-09_linnea_hoz-sample-board-pack-title.html`.

---

## 8. What I deliberately did not do

- I did not modify the per-page HTML files (8 sibling pages) — in-flight conflict with PR #61's page-title sweep. Wire-up is deferred to v4 (substrate gap §6.1).
- I did not ship binary PNG / ICO favicon assets — these belong in the build pipeline (substrate gap §6.2).
- I did not author binding templates — only samples. Binding-template ownership rests with Owen (board-pack), Camille (regulator submissions), Saskia / Niko (counterparty correspondence), Mira (FIC submissions).
- I did not make Hoz a PWA — only provided the manifest.json so a future PWA opt-in has a sourced starting point.
- I did not modify the v1 palette, typography, or voice-and-tone substance — v3 is additive and rendering, not new substance.

—Linnea (Brand & design lead)
