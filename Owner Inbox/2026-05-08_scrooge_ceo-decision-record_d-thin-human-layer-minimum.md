---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-05-08T12:48:02.157Z
decision-required: false
---

# Scrooge — CEO decision record: D-THIN-HUMAN-LAYER-MINIMUM, 2026-05-08

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-THIN-HUMAN-LAYER-MINIMUM`
- **Title:** Thin human layer — minimum-possible composition under SA banking law
- **Action:** modify
- **Outcome:** Approved with modification: tighten Owen+Imani's drafted composition from 5 to 6 separate humans + Marc + external audit firm. Add a separate human CRO before licence-application lodgment, per Mira+Zara's Joint Standard 1 of 2024 challenge (interim-CRO-as-CEO is a structural finding under JS 1 of 2024, not just SARB precedent). Other Owen+Imani recommendations stand: 3 NEDs (one as Chair + AC Chair + S&E NED; the other two as AC members); separate Company Secretary; triple-hatted compliance lead (MLRO + FIC CO + POPIA IO). Additional refinements from Mira+Zara accepted: alternate split (deputy-IO = CoSec; MLRO-alternate = AC-Chair NED, not double-hatted CoSec); FAIS KI (Saskia steady-state, Marc-interim acceptable until external counsel confirms FSP licensing scope).
- **Actor:** `marc@tgv.co.za`
- **Comment:** Add another human for CRO. Adopt Mira+Zara's JS-1 challenge over Owen+Imani's interim-CRO-as-CEO draft.
- **Source proposal:** `Owner Inbox/2026-05-09_owen-imani_thin-human-layer-minimum-possible.md`
- **Follow-on routes recorded:** `agent:Owen — update governance-framework + composition paper to reflect the 6-human composition; CRO seat added with appointment cadence (before licence-application lodgment); revise concentration-risk caveats to drop interim-CRO-as-CEO as a flagged risk`, `agent:Imani — update legal-as-code reading: separate-CRO test under JS 1 of 2024 is now structural; the alternates split (deputy-IO=CoSec; MLRO-alternate=AC-Chair) becomes operative`, `agent:Mira — close the 10 obligations-register gaps named in the conduct-side confirmation paper (ORG-GV-DIRECTORS-MINIMUM, ORG-GV-AC-MINIMUM, ORG-GV-CRO-INDEPENDENCE, ORG-GV-CFO-INDEPENDENCE, ORG-FC-11 gloss, ORG-FC-MLRO-ALTERNATE, ORG-PR(IV)-13 deputy-IO sub-gloss, ORG-FAIS-KI, ORG-FC-SANCTIONS-SCREENING, ORG-CY-02 reconciliation)`, `agent:Zara — operationalise the post-decision compliance posture: FIC submission cycle, FSP application path under FAIS-KI clarification, TCF substrate planning`, `agent:Helena (CRO governance) — note: the human CRO seat now sits in the licence-application search; engineering line continues (Rohan, Nadia) under Helena's eventual oversight; Helena's mandate becomes load-bearing for the search criteria (CRO must be JS 1 of 2024 fit-and-proper)`, `agent:Nolan — open recruitment scope for: 3 NEDs, Company Secretary, triple-hatted compliance lead, CRO. Six external searches; coordinate cadence with the SARB pre-application gate.`, `agent:Saskia — note: Marc retains FAIS Key Individual interim; Saskia is the steady-state KI candidate. PAX role-research on whether the bank's institutional-only / wholesale posture requires an FSP licence at all — input needed before licence-application lodgment.`

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
