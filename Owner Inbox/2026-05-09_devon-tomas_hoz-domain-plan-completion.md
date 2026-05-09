---
title: Hoz domain-registration plan — completion note
author: Devon (Chief Operating Officer, governance) + Tomas (Operations & payments engineer)
date: 2026-05-09
summary: One-paragraph completion note for the Hoz domain-registration plan; cross-references the plan and the D-HOZ-DOMAIN-REGISTRATION-SET decision card surfaced for CEO confirmation.
decision-required: false
---

# Hoz domain-registration plan — completion note

Devon (Chief Operating Officer, governance) and Tomas (Operations & payments engineer) have authored the Hoz domain-registration plan at `Owner Inbox/2026-05-09_devon-tomas_hoz-domain-registration-plan.md`. The plan specifies a working-set of `.bank` (pre-applied at fTLD now; activated at SARB licence-day) + `.co.za` (registered now) + `.ai` (registered now if standard-priced), defers `.com` indefinitely as cost-prohibitive, and recommends six defensive variants under split-registrar arrangement (CSC Global / Diamatrix / 101domain / Namecheap-or-GoDaddy). Build-phase year-1 budget order-of-magnitude is `~$600` (working + defensive, excluding `.bank` full registration which lands at licence-day at `~$1,500/year`). DNS hardening posture (DNSSEC, SPF / DKIM / DMARC, HSTS preload, CAA, MTA-STS) is specified as v0 stub with substrate-readiness deepening. **D-HOZ-DOMAIN-REGISTRATION-SET** is surfaced for CEO confirmation on five points (working-set, defensive-set, budget envelope, `.com` posture, registrar choice); no domain is registered until Marc confirms. Defensive-set registration is gated on Imani (Legal-as-code engineer)'s TM-clearance result for "Hoz" to avoid post-registration unwinding. The substrate-side domain-registrar adapter does not yet exist in `prototype/` and is captured as a v1 roadmap item under this decision.
