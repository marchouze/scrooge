# Principle 4 — Security designed in from the start

Security is a foundational design constraint, not a layer added later.

- **Threat modelling** is part of every design, not a periodic review. New event types, new APIs, new workflows are not approved without an explicit threat model and the controls that follow from it.
- **Zero trust** is the default — no network position, no service identity, no operator role gets implicit trust. Every request authenticates, every request authorises, every request is logged.
- **Least privilege** for humans and machines. Access is just-in-time, narrowly scoped, and recorded as events.
- **Defence in depth** — encryption in transit and at rest with managed cloud HSM, per-field encryption for sensitive data, network segmentation, anomaly detection, immutable audit logs.
- **Secure SDLC** — dependency scanning, SAST/DAST, signed builds, reproducible deployments, supply-chain verification (SLSA-aligned).
- **Operational security** — intrusion detection, log integrity, key rotation, incident response with rehearsed runbooks. Incidents are register-tracked under Principle 2.
- **Customer security** — strong authentication (WebAuthn / FIDO2 by default), session-binding, transaction-signing for high-risk actions.
- POPIA breach notification (Information Regulator and data subjects) is an automated workflow, not a runbook step.
- Aligned with the Joint Standard on Cybersecurity and Cyber Resilience (PA / FSCA Joint Standard 2 of 2024), POPIA security safeguards (sections 19–22), and BCBS principles on operational and cyber risk.
