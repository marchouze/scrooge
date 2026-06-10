# FX OTC umbrella NPA — per-dimension verification pass

**Product:** `prd:bank:fx:otc-vanilla` v1.0.1 (OTC · spot/forward/swap · any supported pair · institutional/professional)
**Decision context:** D-FX-OTC-NPA-SCOPE-EXPANSION roadmap. Verification before promoting any design-attested dimension to implementation-attested.
**Method:** ground each dimension in code (file:line); promote only where enforcement substrate genuinely runs for this scope.

## Headline finding (control gap — controlled-launch concern)

The FX pre-trade gateway (`dashboard/markets-fx-gateway.ts:209-237`) runs all 7 pre-trade
checks but **only `counterparty-eligibility` has enforcing logic** (line 232-234). The other
six — **identity, sanctions, suitability, credit-limit, capital-impact, funding** — default
to `outcome = "approve"` (line 229) with no logic. The credit-limit pre-deal-check and the
sanctions-screening handler **exist as engines but are not invoked anywhere on the live order
path** (verified: no call sites in gateway/trade/server).

Consequence: the risk/AML/conduct *measurement* engines are real, but their *pre-trade
enforcement* is not wired. So the corresponding NPA dimensions cannot honestly be
implementation-attested on a "the gateway enforces it" basis — and a controlled launch must
not proceed with five approve-always pre-trade checks.

**Unlock:** wire the six stubbed gateway checks to their existing engines (credit-limit
pre-deal-check, sanctions handler, capital-impact, funding/liquidity, suitability beyond
eligibility, identity). This is the single change that makes credit-risk / aml / capital /
liquidity promotable. Spun off as a backlog item (owner: Kai, trading-systems + risk seats).

## Per-dimension verdict (grounded)

| Dimension | Substrate (real) | Why NOT yet implementation-attested |
|---|---|---|
| accounting | ✅ implementation-attested (build-3) | — |
| operational-readiness | ✅ implementation-attested (build-4) | — |
| **credit-risk** | SA-CCR (RC+PFE+EAD), CVA, credit-limit engine + projection all compute off events | Pre-trade credit-limit enforcement NOT wired into the gateway (approve-always); SA-CCR counterparty-class-blind (task_4edabfa7) |
| **conduct** | Counterparty-eligibility/professional screening IS enforced (gateway line 232-234) | Best-execution surveillance design-only; FAIS s.45 professional-classification citation TBC (pending counsel) |
| **aml** | Sanctions handler exists; reads a **stub** list | Gateway sanctions check approve-always (handler not invoked); stub list, not live UN/OFAC/EU/HMT/POCDATARA (D-SANCTIONS-SCREENING-SUBSTRATE not built); EDD/STR design-only |
| **market-risk** | VaR engine computes (spot) | Forward/swap on static curve + flat-discount; multi-pair VaR design-only |
| **model-risk** | Spot tier-1 (live quotes, no model) | Forward/swap model `model:fx-forward-irp-v1` has no ModelValidationApproved; option = M5 |
| **legal** | LegalDocumentationSigned / JurisdictionalOpinionRefreshed event types | No legal-doc gate wired; product declaration is static; opinion-refresh SLA not enforced |
| **liquidity-risk** | Liquidity-limit engine structure | FX funding-curve not integrated; gateway funding check approve-always; stress design-only |
| **infosec** | Threat-model REGISTRATION events | No prose threat-model artefact; zero-trust not enforced |
| **privacy** | Weekly POPIA s.19-22 snapshot | Visibility only; no enforcement gate / DSAR SLA |
| **capital** | RWA projection (credit/market/op) | FX market-risk charge pre-FRTB; capital-impact gateway check approve-always; option not in scope |
| **operational-risk** | event types only | No loss-distribution / BIC engine; no op-risk gate |
| **tax** | weekly readiness snapshot | Deferred to revenue-start (Yael) |

## Outcome

**No dimensions promoted this pass.** The verification found the enforcement substrate is
less wired than the design implied (the gateway-stub finding). Promoting on the strength of
the *engines* — without the *enforcement* wiring — would be an over-attestation. The honest
posture: accounting + operational-readiness remain the only implementation-attested
dimensions; the rest stay design-attested with this grounded map as the precise worklist.

**Closest to promotable once the gateway is wired:** credit-risk (rich measurement substrate
+ credit-limit engine — needs the pre-deal-check wired) and conduct (eligibility gate already
enforced — needs best-execution + the FAIS s.45 citation).
