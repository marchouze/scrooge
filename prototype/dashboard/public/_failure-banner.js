// dashboard/public/_failure-banner.js
//
// Cross-page failure surface. Loaded by every page; on each tick fetches
// /api/agent-runs and renders / hides #failureBanner based on whether
// any agent's most-recent completed run failed.
//
// The banner is intentionally non-dismissible — failures stay visible
// until the underlying state changes. Click-through to the failing
// run's GitHub Actions page so a human can investigate immediately.
//
// Page integration: every page's load function calls
// `window.refreshFailureBanner()` at the end. The first call on a page
// triggers an immediate fetch; subsequent calls are throttled to one
// fetch per 30 seconds (the typical page-refresh cadence).
//
// Author: Atlas

(function () {
  let lastFetchAt = 0;
  let cached = null;

  async function fetchRuns() {
    const now = Date.now();
    // 30s throttle. Pages refresh on this cadence anyway.
    if (cached && now - lastFetchAt < 30_000) return cached;
    try {
      const r = await fetch("/api/agent-runs", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      cached = await r.json();
      lastFetchAt = now;
      return cached;
    } catch (e) {
      console.warn("failure-banner: fetch failed", e);
      return cached; // serve stale on failure; don't blink the banner.
    }
  }

  function failedAgents(byAgent) {
    const out = [];
    for (const [agent, runs] of Object.entries(byAgent ?? {})) {
      if (!runs || runs.length === 0) continue;
      const latest = runs[0];
      if (latest.status === "completed" && latest.conclusion === "failure") {
        out.push({ agent, run: latest });
      }
    }
    return out;
  }

  function render(failures) {
    const banner = document.getElementById("failureBanner");
    if (!banner) return;
    if (failures.length === 0) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    banner.hidden = false;
    banner.innerHTML = "";

    const heading = document.createElement("strong");
    heading.textContent =
      failures.length === 1
        ? "1 agent's last run failed:"
        : `${failures.length} agents' last runs failed:`;
    banner.appendChild(heading);

    const list = document.createElement("ul");
    list.className = "failure-list";
    for (const f of failures) {
      const li = document.createElement("li");
      const link = document.createElement("a");
      link.href = f.run.url;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = `${f.agent} — ${f.run.workflowName}`;
      const time = document.createElement("span");
      time.className = "failure-time muted";
      time.textContent = ` (${f.run.createdAt.slice(0, 16).replace("T", " ")} UTC)`;
      li.appendChild(link);
      li.appendChild(time);
      list.appendChild(li);
    }
    banner.appendChild(list);
  }

  window.refreshFailureBanner = async function refreshFailureBanner() {
    const data = await fetchRuns();
    render(failedAgents(data?.byAgent ?? {}));
  };

  // Auto-refresh independently of the host page so the banner stays
  // current even on pages that don't poll.
  setTimeout(window.refreshFailureBanner, 100);
  setInterval(window.refreshFailureBanner, 30_000);
})();
