// scripts/register-odp-substrate-workstreams.ts
//
// One-off: register 4 Large ODP substrate gap workstreams identified during
// the 2026-05-29 instrument-analysis session.
// Authority: CEO session delegation (Scrooge, 2026-05-29).

import { eventStore, logger } from "../platform/composition";
import { makeWorkstreamRegistered } from "../platform/event-store/event-types/platform";

const asOf = new Date().toISOString();
const actor = { type: "system" as const, id: "scrooge" };
const entity = "LE-ZA-HOZ-BANK";

const workstreams: Array<{
  workstreamId: string;
  title: string;
  owner: string;
  summary: string;
  citations: string[];
}> = [
  {
    workstreamId: "WS-ODP-ISDA-ANNEXURES",
    title: "ODP ISDA CS 2/2018 clause library — Schedule, CSA & multi-product confirmations",
    owner: "Imani (General Counsel / legal)",
    summary:
      "Build the ISDA CS 2/2018-compliant clause library: Schedule builder, Credit Support Annex election logic (thresholds, haircuts, eligible collateral), and confirmation generators for non-IRS products (FRAs, swaptions, basis swaps, cross-currency swaps). Obligation: ORG-ODP-COND-005. Size: Large (~1800 lines). Prerequisite for commencement of OTC derivative trading.",
    citations: ["ORG-ODP-COND-005", "urn:regulation:odp:cs-2-2018"],
  },
  {
    workstreamId: "WS-ODP-PORTFOLIO-RECON",
    title: "ODP portfolio reconciliation substrate — CS 2/2018 §9",
    owner: "Devon (COO / operations)",
    summary:
      "Automated portfolio reconciliation engine: MTM vs GL mark, counterparty exposure vs CSA collateral balance, collateral portfolio vs custody holdings, credit limit vs allocated limit, netting set vs settlement instruction. Cadences: daily ≥500 trades, weekly 51–499, quarterly 1–50. Dispute escalation: 3 BD (material terms) / 5 BD (valuation). Obligation: ORG-ODP-COND-007. Size: Large (~2000 lines). Prerequisite for commencement.",
    citations: ["ORG-ODP-COND-007", "urn:regulation:odp:cs-2-2018"],
  },
  {
    workstreamId: "WS-ODP-COLLATERAL-SEGREGATION",
    title: "ODP collateral segregation enforcement engine — CS 2/2018 §12",
    owner: "Devon (COO / operations)",
    summary:
      "Collateral segregation enforcement: cross-counterparty commingling prevention, automatic lock when CSA active, segregation audit trail, substitution rights validation, daily sufficiency checks with haircut + FX revaluation, breach escalation to CRO. Obligation: ORG-ODP-COND-010. Size: Medium-Large (~1200 lines). Prerequisite for commencement.",
    citations: ["ORG-ODP-COND-010", "urn:regulation:odp:cs-2-2018"],
  },
  {
    workstreamId: "WS-ODP-UMOJA-UTI",
    title: "ODP Umoja portal API + UTI allocation — CS 3/2018 + JN 2/2024",
    owner: "Devon (COO / operations)",
    summary:
      "Umoja portal machine-to-machine integration (OAuth2 + REST), UTI allocation (ISO 23602 deterministic SHA-256 or DTCC/SAFE API), TradeUtiAllocated event, EMIR XML serialisation, daily T+1 submission by 16:00 SA time, trade-repository reconciliation. Obligations: ORG-ODP-RPT-003, ORG-MK-RPT-002. Size: Large (~1400 lines). Prerequisite for commencement of OTC derivative reporting.",
    citations: [
      "ORG-ODP-RPT-003",
      "ORG-MK-RPT-002",
      "urn:regulation:odp:cs-3-2018",
      "urn:regulation:odp:jn-2-2024",
    ],
  },
];

let registered = 0;
for (const ws of workstreams) {
  const { citations, ...payload } = ws;
  const event = makeWorkstreamRegistered({
    asOf,
    entity,
    actor,
    citations,
    payload: { ...payload, status: "planned" },
  });
  eventStore.append(event);
  logger.info({ workstreamId: ws.workstreamId }, "WorkstreamRegistered");
  registered++;
}

logger.info({ registered }, "ODP substrate workstreams filed");
