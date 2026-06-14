// scripts/record-d-decimal-native-consumer-migration.ts
//
// Records D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3 — Marc's in-session
// decision (2026-06-14) on how to sequence the Wave-3 re-purge given that the
// decimal-native emitter migration (PRs #1328/1329/1332/1333/1334/1338) left the
// legacy integer `*Minor` fields in every payload as DERIVED compat ("riding
// along for the not-yet-migrated consumers").
//
// FINDING. The emitter surface is now decimal-native in its ARITHMETIC — every
// money-emitting engine computes in exact decimal (HALF_EVEN, explicit per
// quantisation) and writes MoneyWire as the source of truth. But the strangler
// pattern keeps the numeric `amountMinor`/`notionalMinor`/etc. fields in the
// payload alongside MoneyWire so the ~269-file consumer surface (trial-balance,
// GL projection, BA-300/400/700 renderers, dashboard tiles, recon gates) does
// not break. The `recon:no-residual-minor-encoding` gate flags ANY numeric
// `*Minor` key, so any post-purge scheduler tick re-emits `*Minor` and re-dirties
// the store. Therefore Wave 3 cannot produce a clean, gate-green store while the
// strangler compat fields remain. The consumer migration is the BINDING
// dependency for a clean re-purge, not a follow-on nicety.
//
// MARC'S DECISION (2026-06-14): consumer migration FIRST, then Wave 3. Migrate the
// ~269 `*Minor` readers to read MoneyWire / the decimal `amount`, then DROP the
// legacy `*Minor` fields from the event payloads — at which point re-emissions
// carry only MoneyWire, the residual-minor gate goes green, and Wave 3 produces a
// genuinely clean store. The `*Minor`-drop is a decider-class action: it carries a
// Nadia (independent validation) reviewer gate + a Vera (internal audit) audit per
// the reviewer->decider sync primitive, because it removes a field that the most-
// audited code in the bank (GL, trial balance, BA returns) reads.
//
// Sequencing under this decision:
//   1. Consumer-read migration (additive): switch every production `*Minor`
//      reader to MoneyWire / `amount`; keep the `*Minor` payload fields for now.
//      Broken into bounded sub-slices by consumer domain to fit agent context.
//   2. `*Minor`-field drop (decider, Nadia + Vera): once the full tsc proves no
//      production reader remains, remove the legacy `*Minor` fields from the
//      event-type payload schemas. recon:no-residual-minor-encoding goes green.
//   3. Wave 3 re-purge (still gated on a final CEO go): pause launchd schedulers,
//      Vera re-verifies the backup, re-run the corrected purge against the
//      canonical store, confirm the gate is green.
//
// Supersedes the slice-2 brief's framing of the consumer migration as an
// out-of-scope follow-on; it is now the gating path to Wave 3.
//
// Idempotent on (decisionId, phase, as_of). Scrooge is the recording instrument
// (recordedVia: scrooge:session-delegation); Marc is the authorizing principal.
//
// Authority: CLAUDE.md §"Session delegation"; D-DECIMAL-NATIVE-MONEY-ARITHMETIC;
// D-MONEY-DECIMAL-PURGE-REMEDIATION; Principle 1 (deterministic replay).
import "../platform/event-store/resolve-event-db-boot";
import { recordDecision, requestDecision } from "../runtime/decisions/record";

const REQ = "2026-06-14T08:25:00.000Z";
const APP = "2026-06-14T08:27:00.000Z";

const base = {
  decisionId: "D-DECIMAL-NATIVE-CONSUMER-MIGRATION-BEFORE-WAVE-3",
  authority: "CEO" as const,
  authorityRef: "marc@tgv.co.za",
  title:
    "Sequence the Wave-3 re-purge behind the consumer migration: migrate the ~269 legacy *Minor readers to MoneyWire and DROP the *Minor payload fields (Nadia validation + Vera audit at the drop) before re-purging, so the re-purge produces a genuinely clean, residual-minor-gate-green store rather than one the next scheduler tick re-dirties",
  category: "governance" as const,
  recommendation:
    "Consumer migration FIRST, then Wave 3. (1) Migrate every production *Minor reader (trial-balance, GL projection, BA-300/400/700 renderers, dashboard tiles, recon gates) to read MoneyWire / the decimal amount, in bounded sub-slices by consumer domain; keep the *Minor payload fields during this step. (2) Once the full tsc proves no production reader remains, DROP the legacy *Minor fields from the event-type payload schemas — this is a decider-class action carrying a Nadia independent-validation reviewer gate and a Vera internal-audit audit per the reviewer->decider sync primitive, because it removes a field read by the most-audited code in the bank. recon:no-residual-minor-encoding goes green at this point. (3) Run the Wave-3 re-purge LAST, still gated on a final CEO go: pause the launchd schedulers, Vera re-verifies the backup, re-run the corrected purge against the canonical store, confirm the gate is green.",
  rationale:
    "The decimal-native emitter migration fixed the real Principle-1 defect (float intermediates in money arithmetic) but, by design, left the integer *Minor fields in every payload as derived compat so the ~269-file consumer surface would not break. recon:no-residual-minor-encoding flags any numeric *Minor key, so a Wave-3 re-purge today would be undone on the next launchd scheduler tick, which re-emits *Minor alongside MoneyWire. The consumer migration is therefore the binding dependency for a clean re-purge, not an optional follow-on. Doing it first — reads migrated, then fields dropped under Nadia + Vera review — yields a store that stays clean after re-emission and a residual-minor gate that is genuinely load-bearing. There is no live-data urgency forcing Wave 3 (build phase: the transactional events are simulated fixtures), so the correct end-state is worth the extra slice. Relaxing the gate to tolerate *Minor-alongside-MoneyWire was the alternative; it was rejected because it would leave dual encoding in the canonical store indefinitely and weaken the gate that exists to prevent exactly that.",
  sourceDocHashes: [],
  citations: [
    "D-DECIMAL-NATIVE-MONEY-ARITHMETIC",
    "D-MONEY-DECIMAL-PURGE-REMEDIATION",
    "Principles/1-events-are-truth.md",
  ],
  recordedVia: "scrooge:session-delegation" as const,
};

requestDecision(base, REQ);
const r = recordDecision({ ...base, phase: "approved" as const }, APP);
console.log(JSON.stringify({ ok: true, eventId: r.eventId, decisionId: base.decisionId }, null, 2));
