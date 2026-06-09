---
agent: Scrooge
trigger: ceo-decision-record
asOf: 2026-06-09T11:11:10.126Z
decision-required: false
---

# Scrooge — CEO decision record: D-IRS-DV01-BUCKETING-CALIBRATION, 2026-06-09

Audit record of a CEO-stated decision routed through Scrooge's chat-intake. The canonical authority is the `CeoDecision` event emitted alongside this file; this markdown is the human-readable mirror.

- **Decision ID:** `D-IRS-DV01-BUCKETING-CALIBRATION`
- **Title:** IRS DV01 bucketing methodology — ratify mechanics, hold combined BA320 charge until G1 fix
- **Action:** approve
- **Outcome:** Per Helena (CRO) calibration review: (1) ratify the per-period DV01 bucketing mechanics (bands, sign mapping, granularity) as calibrated; (2) HOLD the combined bond+IRS BA 320 IR-general-risk charge as NOT submission-fit until G1 is remediated — bond adapter feeds risk-weighted nominal while IRS feeds raw DV01 into the same ladder (incommensurable units, IRS ~3 orders of magnitude too small); IRS remains an internal sensitivity view meanwhile; (3) accept G2-G7 as tracked build-phase gaps; (4) authorise the G1 remediation (B-IRS-MATURITY-METHOD-DECOMP) under no-pause. BA 320 return-content authority sits with Camille (CFO) at submission — G1 fix jointly visible to her.
- **Actor:** `marc@tgv.co.za`
- **Comment:** Verified at code level: ba-320-bond-events-adapter.ts:234 (nominalMinor*riskWeight) vs ba-320-irs-events-adapter.ts:247 (abs raw dv01) both feed combineIrGeneralLadders. CRO authority (risk-measurement calibration) per decision-authority routing; under D-BA-RETURNS-FOLLOWON-BATCH.

## Provenance

Emitted via `agent:scrooge-ceo-decision-record` runtime handler. The CeoDecision event is the canonical record; the dashboard's resolution mechanism reads this event-stream — `decisionStatus = "resolved"` follows automatically. Future follow-on-router handler reads the `followOnRoutes` payload and chains the substantive work via event-driven fan-out.
