// scripts/escalation-enforce.ts
//
// One-shot CLI: walks every open AgentEscalation, emits an
// AgentEscalationOverdue event for any whose declared deadline has
// passed without a Decided / Delegated landing. Idempotent — a second
// invocation against the same store does not duplicate Overdue events.
//
// Invocation: `bun run escalation:enforce` (npm script in `package.json`).
//
// Exit status:
//   - 0 always (the channel's enforceOverdue itself is best-effort over
//     the open set; reading the event store cannot semantically fail
//     here — corrupt events would surface as schema violations on the
//     emitting path, not on the enforcing read).
//
// Per Atlas spec §3.5: "if no AgentEscalationDecided event lands by the
// declared deadline, the substrate emits an AgentEscalationOverdue
// event routed up the governance line".
//
// Author: Atlas + Senna + Iris (A3.1)

import { eventStore, logger } from "../platform/composition";
import { LocalEscalationChannel } from "../platform/escalation";

async function main(): Promise<number> {
  const channel = new LocalEscalationChannel(eventStore);
  const now = new Date();
  const result = channel.enforceOverdue(now);

  logger.info(
    {
      walked: result.walked,
      emitted: result.emitted.length,
      skipped: result.skipped.length,
      now: now.toISOString(),
    },
    `escalation:enforce — walked=${result.walked} emitted=${result.emitted.length} skipped=${result.skipped.length} (idempotent)`,
  );

  if (result.emitted.length > 0) {
    for (const id of result.emitted) {
      logger.info({ escalationId: id }, "escalation:enforce — emitted Overdue");
    }
  }

  return 0;
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
