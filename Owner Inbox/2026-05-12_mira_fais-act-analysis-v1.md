---
title: "FAIS Act 37/2002 — Analysis v1 Executive Summary"
author: Mira (Compliance / RegTech engineer)
date: 2026-05-12
dispatch-id: D-FAIS-ANALYSIS-V1
decision-required: false
status: delivered
artefacts:
  - Regulations/FSCA/fais-act.md
  - Regulations/_obligations-register.md (v1.17)
---

# FAIS Act 37/2002 — Analysis v1 Executive Summary

**Curator:** Mira (Compliance / RegTech engineer) · **Governance:** Zara (Chief Compliance Officer) · **Dispatch:** D-FAIS-ANALYSIS-V1 · **Date:** 2026-05-12

## What was done

Full statutory analysis of FAIS Act 37 of 2002 (Government Gazette No. 24079, 15 November 2002) for Hoz Securities Limited (FSP / ODP entity). Source: verbatim text from the original Government Gazette PDF. Structure follows the Act's actual Chapter headings (Chapters I–VII), not the "Parts" description in earlier planning documents.

Obligations register updated to v1.17: five Domain P `[citation: TBC]` markers replaced with confirmed Act section references. GCC sub-section references remain `[TEXT NOT RETRIEVED]` — the General Code of Conduct PDF was not retrievable via automated fetch; manual verification required at licence-application gate.

## Key obligations for Hoz Securities Limited

| Obligation | Act anchor | Status |
|---|---|---|
| FSP licence required before rendering advice or intermediary services | s.7(1): *"No person shall … act as an authorised financial services provider … unless such person has been issued with … a licence"* | Licence-bind — activates at licence-day |
| Key Individual designation (Saskia steady-state; Marc interim) | s.8(1) + Determination of Fit and Proper Requirements 2017 | Corporate-bind |
| Advice records — 5-year minimum retention | s.18(a): *"an authorised financial services provider must … maintain records of … every financial service rendered"* | Corporate-bind |
| Suitability assessments per GCC s.8 | s.16(1)(c) + GCC s.8 `[TEXT NOT RETRIEVED]` | Corporate-bind |
| Fee disclosure before engagement | s.16(2)(a) + GCC s.7 `[TEXT NOT RETRIEVED]` | Corporate-bind |
| Complaint records — 5-year minimum retention | s.18(b): *"records of all complaints received … and the outcome of each complaint"* | Corporate-bind |
| General Code of Conduct umbrella | s.15(1)(a)–(b) + GCC ss.2–9 | Corporate-bind (licence-activated) |
| FSCA Ombud jurisdiction over FSP conduct | s.27(3)(a)(i)–(ii) | Licence-bind |
| Offences: R1 000 000 fine / 10 years imprisonment | s.36 | Licence-bind |

## Domain P gaps closed

Five Domain P rows updated in `Regulations/_obligations-register.md` v1.17:

- `ORG-FAIS-RK-ADVICE` — Act s.18 + s.16(1)(a)–(e) confirmed; GCC s.3 `[TEXT NOT RETRIEVED]`
- `ORG-FAIS-RK-SUITABILITY` — Act s.16(1)(c) + s.18 confirmed; GCC s.8 `[TEXT NOT RETRIEVED]`
- `ORG-FAIS-RK-FEE-DISCLOSURE` — Act s.16(2)(a) + s.16(2)(f) + s.18 confirmed; GCC s.7 `[TEXT NOT RETRIEVED]`
- `ORG-FAIS-RK-COMPLAINT-HANDLING` — Act s.18(b) confirmed; GCC s.9 + FSCA Conduct Standard number `[TEXT NOT RETRIEVED / citation: TBC]`
- `ORG-FAIS-RK-GENERAL-CODE` — Act s.15(1)(a)–(b) + s.16(1)(a)–(e) + s.16(2)(a)–(f) confirmed; GCC ss.2–9 sub-section index `[TEXT NOT RETRIEVED]`

## What remains TBC

1. **General Code of Conduct verbatim text** (Board Notice 80 of 2003 / GCC ss.2–9) — PDF not retrieved. Precise sub-section wording for each obligation requires manual extraction. Imani (Legal-as-code engineer) + external counsel action at licence-application gate.
2. **Determination of Fit and Proper Requirements 2017** (Board Notice 194 of 2017) — qualification schedule and experience threshold tables not retrieved. Saskia's fit-and-proper file builds against these requirements; external counsel ratifies.
3. **FSCA Conduct Standard number** for complaint-handling — cross-reference to FSCA Conduct Standards 1–3 of 2018 complaint-handling provisions to be confirmed.
4. **FSP category ratification** — Categories I and II likely sufficient for the institutional-only product set; IIA (discretionary) is conditional. External counsel confirms at licence-application lodgment.
5. **Bank-exemption s.1(3)(b)(i) formal analysis** — Posture A is confirmed (`D-FSP-LICENCE-NECESSITY`); the fais-act.md §4.3 documents the structural reasoning (Hoz Securities is not a mere conduit; provides independent OTC derivative structuring).

## Next steps for licence application

1. Instruct external counsel to produce verbatim GCC ss.2–9 sub-section index + BN 194 of 2017 schedule (feeds `WS-INSTRUMENT-ANALYSES` workstream).
2. Imani to cross-reference FSCA Conduct Standards 1–3 of 2018 complaint-handling section numbers against `ORG-FAIS-RK-COMPLAINT-HANDLING`.
3. Saskia fit-and-proper file to be built against BN 194 of 2017 requirements once verbatim text confirmed.
4. NPA gate: FAIS Categories I + II confirmed product set; IIA gate deferred to counsel.
5. FAIS Policy (planned, conduct bundle) to be authored under Zara's next policy-cadence run, citing `Regulations/FSCA/fais-act.md` as the source regulation document.

## Artefacts

| Artefact | Path | Status |
|---|---|---|
| FAIS Act full analysis (23 obligations) | `Regulations/FSCA/fais-act.md` | Delivered |
| Obligations register v1.17 | `Regulations/_obligations-register.md` | Delivered |
| This brief | `Owner Inbox/2026-05-12_mira_fais-act-analysis-v1.md` | Delivered |
