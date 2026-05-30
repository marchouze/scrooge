// prototype/scripts/decisions/scrooge-fx-cross-pairs-production-ingest.ts
// CEO authorisation (Marc, in-session 2026-05-30 via Scrooge session delegation):
// ingest non-ZAR FX crosses (EUR/USD, GBP/USD) as production market data from
// Twelve Data so live cross positions get a production mark and unrealised P&L.
// Decision event already emitted to the shared store; recordDecision is idempotent.
// Author: Scrooge (Chief of Staff / Orchestrator), recording on behalf of Marc.
import { clock } from "../../platform/composition.ts";
import { recordDecision } from "../../runtime/decisions/record.ts";

const result = recordDecision(
  {
    decisionId: "D-FX-CROSS-PAIRS-PRODUCTION-INGEST",
    phase: "approved",
    authority: "CEO",
    authorityRef: "marc@tgv.co.za",
    title:
      "Ingest non-ZAR FX crosses (EUR/USD, GBP/USD) as production market data so cross positions get a mark + P&L",
    category: "engineering",
    recommendation:
      "Add EUR/USD and GBP/USD to the production Twelve Data FX ingest (TWELVE_DATA_TARGET_PAIRS) so the MarketDataStore carries production fx-quotes for the non-ZAR crosses the bank trades; update credit-cost comments (6->8 symbols; 2x8=16 credits/run, 384/day, under the 800/day cap); handle IPV tolerance tiering + fx-pair-direction + any pair-count recon for the new crosses. ZAR-triangulation was the considered alternative; direct ingestion was chosen for fidelity.",
    rationale:
      "Live FX positions in non-ZAR crosses showed zero/absent unrealised P&L because there was no production market data for those pairs and the MTM does not triangulate via the ZAR legs. Ingesting the traded crosses directly gives those positions a genuine production mark at negligible additional API cost.",
    sourceDocHashes: [],
    citations: [
      "urn:decision:bank:D-MARKETS-SCHEMA-FOUNDATION",
      "urn:decision:bank:D-MARKET-DATA-PROVENANCE-ISOLATION-HARDENING",
    ],
    recordedVia: "scrooge:session-delegation",
  },
  clock.now(),
);
console.log(
  JSON.stringify(
    { eventId: result.eventId, decisionId: "D-FX-CROSS-PAIRS-PRODUCTION-INGEST" },
    null,
    2,
  ),
);
