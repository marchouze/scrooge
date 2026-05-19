// scripts/agents/sens-ingest.ts
//
// SENS ingest agent — fetches Sharenet SENS announcements and stores new ones
// in the MarketDataStore (SQLite). Run every 15 minutes via launchd.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)
//
// Usage:
//   bun run scripts/agents/sens-ingest.ts
//   bun run sens:ingest

import { MarketDataStore } from "../../platform/market-data/store";
import type { SensAnnouncementPayload } from "../../platform/market-data/types";
import { parseAnnouncementsFromHtml } from "./sens-parse";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SENS_URL = "https://www.sharenet.co.za/v3/sens.php";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const DB_PATH = process.env.BANK_MARKET_DATA_DB ?? ".local/market-data.db";

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const mdStore = new MarketDataStore(DB_PATH);

  // ---- Fetch ---------------------------------------------------------------
  let html: string;
  try {
    const resp = await fetch(SENS_URL, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }
    html = await resp.text();
  } catch (err) {
    console.error(`[sens-ingest] ERROR: fetch failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Parse ---------------------------------------------------------------
  let announcements: ReturnType<typeof parseAnnouncementsFromHtml>;
  try {
    announcements = parseAnnouncementsFromHtml(html);
  } catch (err) {
    console.error(`[sens-ingest] ERROR: parse failed — ${String(err)}`);
    process.exit(1);
  }

  // ---- Dedup ---------------------------------------------------------------
  const existing = mdStore.query({ source: "jse-sens" });
  const existingIds = new Set(existing.map((t) => t.id));

  // ---- Store ---------------------------------------------------------------
  let newCount = 0;
  for (const ann of announcements) {
    const id = `jse-sens:${ann.scode}:${ann.tdate}:${ann.seq}`;

    if (existingIds.has(id)) {
      // Already stored — skip silently to keep logs clean
      continue;
    }

    const sensDetailUrl = `https://www.sharenet.co.za/v3/sens_display.php?tdate=${ann.tdate}&seq=${ann.seq}&scode=${ann.scode}`;

    const payload: SensAnnouncementPayload = {
      ticker: ann.scode,
      exchange: "JSE",
      headline: ann.headline,
      category: "Other", // free page does not expose category
      body: ann.linkText,
      sensDetailUrl,
    };

    mdStore.append({
      id,
      source: "jse-sens",
      instrument: ann.scode,
      dataType: "sens-announcement",
      provenance: "production",
      asOf: ann.asOfUtc,
      payload: payload as unknown as Record<string, unknown>,
    });

    console.log(`[sens-ingest] NEW: ${ann.scode} — ${ann.headline} (${ann.asOfUtc})`);
    newCount++;
  }

  console.log(
    `[sens-ingest] fetched ${announcements.length} announcements, ${newCount} new stored`,
  );

  mdStore.close();
}

main().catch((err: unknown) => {
  console.error(`[sens-ingest] FATAL: ${String(err)}`);
  process.exit(1);
});
