// scripts/agents/sens-ingest.test.ts
//
// Unit tests for SENS announcement HTML parsing logic.
// No network calls — all tests use fixture HTML strings.
//
// Authority: D-MARKETS-SCHEMA-FOUNDATION
// Author: Devon (Chief Operating Officer, engineering)

import { describe, expect, it } from "bun:test";
import { parseAnnouncementsFromHtml, tdateToUtcIso } from "./sens-parse";

// ---------------------------------------------------------------------------
// Fixture HTML — simplified Sharenet SENS page with 2 announcements
// ---------------------------------------------------------------------------

const FIXTURE_HTML = `
<!DOCTYPE html>
<html>
<body>
<table>
  <tr>
    <td>10:30 - 19 May 2026</td>
    <td>
      <a href="/v3/quickshare.php?scode=RMH">RMH</a>
    </td>
    <td>
      <a href="/v3/sens_display.php?tdate=20260519103000&seq=28&scode=RMH">
        RMH HOLDINGS LIMITED - Interim Results for the six months ended 31 March 2026
      </a>
    </td>
  </tr>
  <tr>
    <td>09:15 - 19 May 2026</td>
    <td>
      <a href="/v3/quickshare.php?scode=AGL">AGL</a>
    </td>
    <td>
      <a href="/v3/sens_display.php?tdate=20260519091500&amp;seq=12&amp;scode=AGL">
        ANGLO AMERICAN PLC - Trading Statement for the quarter ended 31 March 2026
      </a>
    </td>
  </tr>
</table>
</body>
</html>
`;

// ---------------------------------------------------------------------------
// tdateToUtcIso
// ---------------------------------------------------------------------------

describe("tdateToUtcIso", () => {
  it("converts SAST tdate to UTC ISO 8601", () => {
    // 10:30 SAST = 08:30 UTC
    expect(tdateToUtcIso("20260519103000")).toBe("2026-05-19T08:30:00.000Z");
  });

  it("handles midnight SAST → previous day UTC", () => {
    // 01:00 SAST = 23:00 UTC previous day
    expect(tdateToUtcIso("20260520010000")).toBe("2026-05-19T23:00:00.000Z");
  });

  it("throws on malformed tdate", () => {
    expect(() => tdateToUtcIso("2026051910300")).toThrow();
  });
});

// ---------------------------------------------------------------------------
// parseAnnouncementsFromHtml
// ---------------------------------------------------------------------------

describe("parseAnnouncementsFromHtml", () => {
  it("extracts two announcements from fixture HTML", () => {
    const result = parseAnnouncementsFromHtml(FIXTURE_HTML);
    expect(result).toHaveLength(2);
  });

  it("extracts RMH announcement correctly", () => {
    const result = parseAnnouncementsFromHtml(FIXTURE_HTML);
    const rmh = result.find((a) => a.scode === "RMH");
    expect(rmh).toBeDefined();
    expect(rmh!.tdate).toBe("20260519103000");
    expect(rmh!.seq).toBe("28");
    expect(rmh!.scode).toBe("RMH");
    expect(rmh!.headline).toContain("Interim Results");
    expect(rmh!.company).toContain("RMH HOLDINGS");
    expect(rmh!.asOfUtc).toBe("2026-05-19T08:30:00.000Z");
  });

  it("extracts AGL announcement with &amp; encoded params", () => {
    const result = parseAnnouncementsFromHtml(FIXTURE_HTML);
    const agl = result.find((a) => a.scode === "AGL");
    expect(agl).toBeDefined();
    expect(agl!.tdate).toBe("20260519091500");
    expect(agl!.seq).toBe("12");
    expect(agl!.headline).toContain("Trading Statement");
    expect(agl!.asOfUtc).toBe("2026-05-19T07:15:00.000Z");
  });

  it("deduplicates identical announcements in the same HTML", () => {
    // Double the HTML — should still return only 2
    const doubled = FIXTURE_HTML + FIXTURE_HTML;
    const result = parseAnnouncementsFromHtml(doubled);
    expect(result).toHaveLength(2);
  });

  it("returns empty array for HTML with no SENS links", () => {
    const result = parseAnnouncementsFromHtml("<html><body>no announcements</body></html>");
    expect(result).toHaveLength(0);
  });

  it("splits headline correctly on first ` - ` separator", () => {
    const result = parseAnnouncementsFromHtml(FIXTURE_HTML);
    const rmh = result.find((a) => a.scode === "RMH");
    // company is everything before first " - "
    expect(rmh!.company).toBe("RMH HOLDINGS LIMITED");
    // headline is everything after first " - "
    expect(rmh!.headline).toBe("Interim Results for the six months ended 31 March 2026");
  });
});
