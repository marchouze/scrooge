// scripts/file-mira-obligation-cleanup-phase-0-audit.ts
//
// One-shot RMS Phase 3 filing for Mira's WS-OBLIGATION-CLEANUP Phase 0 audit of
// Regulations/_obligations.seed.json. Emits a RecordFiled event so the Documents
// register holds the canonical, readable audit summary; the typed findings JSON at
// platform/obligations/cleanup-audit-findings.json is the machine contract the
// Phase-1 remediation run consumes.
//
// READ-ONLY audit: changes no obligation data, no recon allowlist, no decision state.
//
// Authority: D-OBLIGATIONS-REGISTER-CLEANUP; D-RMS-PHASE-3.
// Author: Mira (Compliance / RegTech engineer, obligations-register curator).

import "../platform/event-store/resolve-event-db-boot";

import { clock } from "../platform/composition";
import { recordFiled } from "../platform/records";

const body = `# WS-OBLIGATION-CLEANUP — Phase 0 audit of the regulatory-obligation register

**Author:** Mira (Compliance / RegTech engineer, obligations-register curator)
**Date:** 2026-06-12
**Authority:** D-OBLIGATIONS-REGISTER-CLEANUP; D-RMS-PHASE-3
**Brief:** \`brief:mira:ws-obligation-cleanup-phase-0-obligations-regist:2026-06-12\`
**Source audited:** \`Regulations/_obligations.seed.json\` (567 rows)
**Machine contract:** \`prototype/platform/obligations/cleanup-audit-findings.json\`

This is a **read-only** audit. No edits were made to \`_obligations.seed.json\` or
\`_obligations-register.md\`. Marc's ask — obligations grouped correctly, referenced to
source, described correctly, with duplication/fragmentation eliminated — is assessed
across four dimensions below. Every flagged row is classed \`defect\` (with a proposed
action) or \`by-design\` (with a reason). The chosen policy of **honest deferral** is
respected: no provision is fabricated.

## Headline

Two large families dominate the register. \`ORG-PA-*\` (150 rows, adopted via PR #1238) is
clean — full scope, 0 \`[TBD]\` URNs. \`ORG-PR-*\` (164 rows, the legacy prudential register)
carries essentially all of the debt. The four real Phase-1 defects are:

1. **Fragmentation — recovery plan booked three times.** \`ORG-PR-30 / -35 / -53\` are three
   records of the *same* SARB PA Directive 1 of 2015 recovery-plan obligation. \`-35\` and
   \`-53\` are near-verbatim; \`-30\` adds a consolidated-basis clause already held by
   \`ORG-BNK-RECOVERY-CONS\`.
2. **True cross-family duplicate.** \`ORG-PA-049\` and \`ORG-PR-66\` are the same Directive
   D7/2020 SA-CCR leverage obligation. PA-049 holds the proper hard URN; PR-66 carries only
   a synthetic internal URN. (This was the *single* strong textual overlap in the full
   Domain A/F PA-vs-PR sweep — the two families are otherwise complementary, not duplicative.)
3. **15 mintable \`[TBD]\` URNs.** Of the 28 \`ORG-PR*\` \`[TBD]\` rows, 15 already name a concrete
   SA provision (Reg 26/38/39, PAIA s.51, Banks Act, PA Guidance Note 1/2024) and can be
   minted now via \`obligation-linker.normaliseCitationToSectionId\` + \`urn.ts\` schemas.
4. **ID-scheme/domain incoherence.** The 18 \`ORG-PR(IV)-*\` POPIA/PAIA privacy obligations are
   nested under the *prudential* PR ID-scheme; \`deriveDomainLetter\` has no PR(IV) branch.

## Dimension 1 — Grouping coherence

| Finding | Rows | Verdict |
|---|---|---|
| POPIA/PAIA privacy obligations on the PR (prudential) ID-scheme | 18 \`ORG-PR(IV)-*\` | **defect** — re-key off PR |
| Two section-headers each span >1 domain (Domain M → D/C/J; Domain O → E/B/F) | 2 sections | **defect** — make section→domain 1:1 |
| \`ORG-*-CONS\` consolidated-basis meta-obligations | 5 \`ORG-BNK-*-CONS\` | **by-design** — solo vs group scope |
| PA vs PR domain split in Domains A & F | PA & PR families | **by-design** — complementary source layers |

## Dimension 2 — Source-referencing

The 28 \`ORG-PR*\` \`[TBD]\` URNs split **15 mintable / 13 deferred**:

- **Mintable (defect):** \`ORG-PR(IV)-16/-17\`, \`ORG-PR-01/-02/-03/-05/-06/-07/-09/-12/-19/-22/-23/-24/-25\`
  — each names a concrete SA provision. Mint in Phase 1; if a section number is not
  extractable, route to the deferred set rather than invent it.
- **Genuinely deferred (by-design):** \`ORG-PR-04/-08/-10/-11/-15/-16/-17/-18/-20/-21/-26\` —
  internal RAS or BCBS-framework-only, no enumerable SA provision.

The 54 \`TBC\` citations (measured 53; 1-row drift vs the grounded snapshot, in the PR family)
are OCR-gated (\`GAP-SARB-PDF-OCR\` — image-only SARB directive PDFs, e.g. D1/2015) or
counsel-gated at the licence-application gate. Honest deferrals; revisit when the gate clears.

## Dimension 3 — Description correctness

- Terse internal-policy rows (\`ORG-CS1-004\`, \`ORG-CS3-008/009\`) confirmed **intentional**
  concise summaries with valid \`urn:reg:za:cs-*-2018\` URNs — not truncation. **by-design**.
- No mis-citation or leftover pollution found in any \`requirement\` field. The only annotation
  seen (\`ORG-PR-09\` '[correction …]') is legitimate citation-field provenance. **by-design**,
  with a Phase-1 recommendation to add a guard sweep keeping \`[correction\`/\`[citation:\` markers
  out of requirement text.

## Dimension 4 — Duplication / fragmentation

| Finding | Rows | Verdict |
|---|---|---|
| D1/2015 recovery plan booked three times | \`ORG-PR-30 / -35 / -53\` | **defect** — consolidate to one |
| Directive D7/2020 SA-CCR leverage duplicated | \`ORG-PA-049\` / \`ORG-PR-66\` | **defect** — keep PA-049, retire PR-66 |
| Layered capital obligations (min / reg buffer / internal buffer) | \`ORG-PR-01/-03/-04\` | **by-design** — atomic decomposition |
| 21 unclassified SA↔BCBS equivalence pairs | PR-family pairs | **by-design** — classify, not dedup |

The 21 unclassified equivalence pairs already carry merits-based proposed verdicts in
\`scripts/author-obligation-equivalence-verdicts.ts\` (priored on the \`basel-adoption.ts\`
\`ADOPTION_EDGES\` adoptionType). Running that one-off author script against the shared store
drives \`recon:obligation-divergence\` to zero unclassified.

## Phase-1 work-list

**Real defects to remediate (replay-safe, linkage-safe):**

1. Consolidate \`ORG-PR-30/-35/-53\` → one D1/2015 solo-basis recovery obligation; redirect
   edges; fold the consolidated clause into \`ORG-BNK-RECOVERY-CONS\`.
2. Deduplicate \`ORG-PA-049\` ↔ \`ORG-PR-66\`; keep PA-049, retire PR-66, redirect edges.
3. Mint the 15 mintable \`[TBD]\` URNs via the linker + urn schemas.
4. Re-key the 18 \`ORG-PR(IV)-*\` privacy obligations off the prudential PR ID-scheme; add a
   PR(IV)/privacy branch (or new prefix) so \`deriveDomainLetter\` groups them correctly.
5. Enforce section→domain as a 1:1 function; fix the two multi-domain section headers.
6. Classify the 21 SA↔BCBS equivalence pairs (run the existing author script).
7. (Guard) add a recon sweep keeping citation-annotation markers out of \`requirement\` fields.

**Honest deferrals (no action — record only):**

- 13 of 28 \`ORG-PR*\` \`[TBD]\` URNs (internal-RAS / BCBS-framework-only).
- ~157 of 185 register-wide \`[TBD]\` URNs (IFRS, King IV, internal policy, bare-Act-name HR).
- 54 \`TBC\` citations (OCR-gated \`GAP-SARB-PDF-OCR\` or counsel-gated at the licence gate).
- 5 \`ORG-*-CONS\` meta-obligations and \`ORG-PR-01/-03/-04\` layered-capital rows (legitimate).

## Substrate gap surfaced by this run

This was a fully self-contained read-only audit; no substrate gap blocked it. The one
upstream gap it *re-confirms* is \`GAP-SARB-PDF-OCR\`: a material share of the 54 \`TBC\`
citations cannot be resolved until the image-only SARB directive PDFs are OCR'd — that gap,
not register hygiene, is the binding constraint on closing those rows.
`;

const result = recordFiled(
  {
    recordId: "record:documents:mira:ws-obligation-cleanup-phase-0-audit:2026-06-12",
    registerKey: "documents",
    body,
    classification: "engineering-seat",
    retention: {
      citationRef: "urn:obligation:bank:org:gv:director-decision-retention:v1",
      minimumYears: 7,
      archivalTier: "hot" as const,
    },
    citations: ["D-OBLIGATIONS-REGISTER-CLEANUP", "D-RMS-PHASE-3"],
    actor: {
      type: "service",
      id: "agent:mira:compliance-regtech-engineer",
    },
    entity: "LE-ZA-HOZ-BANK",
    metadata: {
      title: "WS-OBLIGATION-CLEANUP audit",
      path: "2026-06-12_mira_ws-obligation-cleanup-phase-0-audit.md",
      category: "compliance-research",
      author: "Mira (Compliance / RegTech engineer, obligations-register curator)",
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
