// scripts/event-store-sync.ts
//
// Run the bidirectional event-store sync between local sqlite and Neon
// Postgres. Intended for two callers:
//
//   - GitHub Actions workflows (before each agent run, and again after,
//     to push any newly-emitted events).
//   - Marc's local machine, manually or via a git hook, when he wants
//     to push new local events to the cloud.
//
// Behaviour:
//   - If BANK_EVENT_DB_URL is unset, exit 0 with a no-op message. This
//     lets us roll the workflow change out before Marc has the Neon
//     project provisioned (graceful degradation, same pattern as the
//     ANTHROPIC_API_KEY rollout).
//   - If sync fails (network, auth, schema), exit non-zero. The agent
//     run that calls this script will then fail with a clear cause —
//     better than running against an empty / stale store and producing
//     misleading recon results.
//
// Author: Atlas

import { resolve } from "node:path";

import { runSync } from "../platform/event-store/postgres-sync";
import { logger } from "../platform/observability/logger";

const SQLITE_PATH =
  process.env.BANK_EVENT_DB ?? resolve(import.meta.dir, "..", ".local", "event.db");
const POSTGRES_URL = process.env.BANK_EVENT_DB_URL;

async function main(): Promise<number> {
  if (!POSTGRES_URL) {
    logger.info(
      { sqlite: SQLITE_PATH },
      "event-store:sync — BANK_EVENT_DB_URL not set; skipping (no-op).",
    );
    return 0;
  }

  try {
    const result = await runSync({
      sqlitePath: SQLITE_PATH,
      postgresUrl: POSTGRES_URL,
    });
    logger.info(
      {
        pushed: result.pushedToCloud,
        pulled: result.pulledFromCloud,
        alreadyInSync: result.alreadyInSync,
        pgRole: result.pgRole,
        startedAt: result.startedAt,
        completedAt: result.completedAt,
      },
      `event-store:sync — done (push=${result.pushedToCloud}, pull=${result.pulledFromCloud}, agree=${result.alreadyInSync})`,
    );
    return 0;
  } catch (e) {
    logger.error(
      { err: (e as Error).message },
      "event-store:sync — failed; agent runs against this host will not have current cloud state",
    );
    return 1;
  }
}

if (import.meta.main) {
  const code = await main();
  process.exit(code);
}
