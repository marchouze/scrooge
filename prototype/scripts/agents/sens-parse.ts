// scripts/agents/sens-parse.ts
//
// Pure HTML parsing logic for Sharenet SENS announcements.
// Extracted into a separate module to enable unit testing without network calls.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RawAnnouncement {
  tdate: string; // "YYYYMMDDHHmmss" as extracted from the detail link
  seq: string;
  scode: string; // ticker code e.g. "RMH"
  company: string; // company name (before first " - " in link text)
  headline: string; // announcement headline (after first " - " in link text)
  linkText: string; // full link text as-is
  asOfUtc: string; // ISO 8601 UTC derived from tdate (SAST = UTC+2)
}

// ---------------------------------------------------------------------------
// tdate → ISO 8601 UTC
// ---------------------------------------------------------------------------

/**
 * Convert a Sharenet tdate string (YYYYMMDDHHmmss, SAST = UTC+2) to ISO 8601 UTC.
 * Example: "20260519103000" → "2026-05-19T08:30:00.000Z"
 */
export function tdateToUtcIso(tdate: string): string {
  if (tdate.length !== 14) {
    throw new Error(`Invalid tdate length: "${tdate}" (expected 14 chars)`);
  }
  const year = tdate.slice(0, 4);
  const month = tdate.slice(4, 6);
  const day = tdate.slice(6, 8);
  const hour = tdate.slice(8, 10);
  const minute = tdate.slice(10, 12);
  const second = tdate.slice(12, 14);
  // SAST is UTC+2 — subtract 2 hours for UTC
  const sast = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}+02:00`);
  return sast.toISOString();
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

/**
 * Parse Sharenet SENS HTML and return a list of raw announcements.
 * Uses only regex — no external HTML parser required.
 */
export function parseAnnouncementsFromHtml(html: string): RawAnnouncement[] {
  const results: RawAnnouncement[] = [];
  const seen = new Set<string>();

  // Match the detail link anchor — groups: [tdate, seq, scode, linkText]
  // Handles both &amp; and & in query string (depends on context)
  const detailPattern =
    /href="\/v3\/sens_display\.php\?tdate=(\d{14})&(?:amp;)?seq=(\d+)&(?:amp;)?scode=([A-Z0-9]+)"[^>]*>([^<]+)<\/a>/g;

  for (;;) {
    const match = detailPattern.exec(html);
    if (match === null) break;
    const [, tdate, seq, scode, linkText] = match;

    // Dedup within parse pass
    const key = `${scode}:${tdate}:${seq}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Split company name from headline on first " - "
    const sepIdx = linkText.indexOf(" - ");
    const company = sepIdx >= 0 ? linkText.slice(0, sepIdx).trim() : scode;
    const headline = sepIdx >= 0 ? linkText.slice(sepIdx + 3).trim() : linkText.trim();

    let asOfUtc: string;
    try {
      asOfUtc = tdateToUtcIso(tdate);
    } catch {
      // Skip malformed entries
      continue;
    }

    results.push({ tdate, seq, scode, company, headline, linkText: linkText.trim(), asOfUtc });
  }

  return results;
}
