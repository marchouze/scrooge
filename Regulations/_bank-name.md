# Bank-name register — canonical source

| Field | Value |
|---|---|
| **Bank name** | Hoz |
| **URN** | `urn:obligation:bank:gv:bank-name-registered:v1` |
| **Authority** | D-BANK-NAME-SELECTION (revised 2026-05-09) |
| **Decision record** | `Owner Inbox/2026-05-09_scrooge_ceo-decision-record_d-bank-name-hoz.md` (PR #57) |
| **Pronunciation posture** | "rhymes with pause" — surfaced as a tooltip / `aria-label` in the shell header until Linnea's v3 brand-supplement confirms or revises |
| **Supersession** | v1 Cadens (Linnea recommendation, 2026-05-07) → v2 Lucet (PR #55, closed before merge) → **v3 Hoz** (current) |
| **Citation chain** | Principle 6 downward: D-BANK-NAME-SELECTION → bank-name register → brand substrate (CSS tokens, SVG wordmarks, HTML `<title>` tags, dashboard `state.bankName`) |
| **Owner (engineering)** | Linnea (Brand & design lead) |
| **Owner (governance)** | Owen (Company Secretary, governance) — Companies Act registered-name discipline |
| **Status** | LICENCE-BIND — formal regulator filing (CIPC) is part of the Imani (Legal-as-code engineer) naming-pre-clearance workstream and licence-application bundle. The bank uses the name in substrate from this point; legal registration follows the licence-application timeline. |
| **Mira URN row** | TBC — Mira (Compliance / RegTech engineer) lands the formal `_obligations-register.md` row separately on `claude/mira-finsurv-urn-cluster-wave-1` to avoid file-clash. |

## How this register is consumed

- **Dashboard substrate.** `prototype/dashboard/derive.ts` reads this file as the canonical bank-name source and surfaces it as `state.bankName` on `/api/state`. Every client page (`home.html`, `index.html`, `agents.html`, …) reads the name from a single place; no hard-coded duplication.
- **Curated seed fallback.** `prototype/seeds/dashboard-state.json` `bank.name` mirrors this register; the derivation pipeline prefers the register and falls through to the seed only if the register is unreadable. Drift is reportable under Vera (Internal-audit / continuous-assurance engineer) Wave-4 #16 prose-duplication recon.
- **Brand assets.** `prototype/dashboard/public/_brand.css` carries `--brand-name: "Hoz"` as a CSS-level mirror for legacy components that don't read `/api/state`. Three SVG wordmarks (`brand/logo-direction-{a,b,c}.svg`) render the three-letter form; Direction A (geometric mark + wordmark lockup) is the active variant per Linnea's 2026-05-07 inaugural brand package §2.1.
- **External presentations.** Board packs, regulator submissions, customer-facing pages, and marketing all read the name through the canonical chain. Manual assembly of name strings is forbidden by Principle 6 downward derivation; any presentation that hand-codes the name is a reportable finding.

## Open follow-ons

- **Mira URN row** in `Regulations/_obligations-register.md` once `claude/mira-finsurv-urn-cluster-wave-1` lands.
- **Linnea v3 brand-supplement** for the three-letter wordmark — letter-spacing, optical kerning, monogram variant for Direction B, pronunciation-posture confirmation.
- **Imani CIPC pre-clearance** — formal Companies Act name-reservation workflow on the chosen name (Trade Marks Act 194 of 1993, `.za` domain, formal 11-language cross-check). Sequence sits in Linnea's brand package §A.7.

[citation: D-BANK-NAME-SELECTION revised 2026-05-09; PR #57 decision record; Linnea inaugural brand package 2026-05-07 §1.7 + §2.1]
