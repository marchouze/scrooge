// dashboard/public/_data-failure-banner.js
//
// Cross-page DATA-failure surface (objective 4 of the Trusted-Figures Program).
// Sibling of _failure-banner.js (which surfaces agent CI-run failures); this one
// surfaces *figure* failures: every bound regulatory figure whose latest
// computation is `degraded` or `failed` (a missing input). Such a figure renders
// "value unavailable", never a silent 0 — and this banner names which figures and
// which inputs are missing so the gap can be chased.
//
// Self-contained: injects its own #dataFailureBanner element below the topbar and
// polls /api/data-failures every 30s. Loaded globally by _shell.js, so it appears
// on every page without per-page wiring.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  function ensureBanner() {
    let banner = document.getElementById("dataFailureBanner");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "dataFailureBanner";
    banner.className = "failure-banner";
    banner.hidden = true;
    const topbar = document.querySelector(".topbar");
    if (topbar?.parentNode) {
      topbar.parentNode.insertBefore(banner, topbar.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return banner;
  }

  function render(failures, gaps) {
    const banner = ensureBanner();
    if ((!failures || failures.length === 0) && (!gaps || gaps.length === 0)) {
      banner.hidden = true;
      banner.innerHTML = "";
      return;
    }
    banner.hidden = false;
    banner.innerHTML = "";

    if (failures && failures.length > 0) {
      const failed = failures.filter((f) => f.status === "failed").length;
      const heading = document.createElement("strong");
      heading.textContent =
        failures.length === 1
          ? "1 figure is unavailable (data failure):"
          : `${failures.length} figures unavailable${failed ? ` (${failed} failed)` : ""}:`;
      banner.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "failure-list";
      for (const f of failures) {
        const li = document.createElement("li");
        const missing = (f.missingInputs || []).join(", ") || "unknown input";
        li.textContent = `${f.figure} — ${f.status} (missing: ${missing}) · ${f.owningAgent}`;
        list.appendChild(li);
      }
      banner.appendChild(list);
    }

    if (gaps && gaps.length > 0) {
      const heading = document.createElement("strong");
      heading.textContent =
        gaps.length === 1
          ? "1 expected event is missing (data integrity):"
          : `${gaps.length} expected events missing (data integrity):`;
      banner.appendChild(heading);

      const list = document.createElement("ul");
      list.className = "failure-list";
      for (const g of gaps) {
        const li = document.createElement("li");
        li.textContent = `${g.label} — no ${g.eventType} emitted · ${g.owningRole}`;
        list.appendChild(li);
      }
      banner.appendChild(list);
    }
  }

  async function refresh() {
    try {
      const r = await fetch("/api/data-failures", { cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      render(data?.failures ?? [], data?.expectedEventGaps ?? []);
    } catch (e) {
      console.warn("data-failure-banner: fetch failed", e);
    }
  }

  window.refreshDataFailureBanner = refresh;
  setTimeout(refresh, 100);
  setInterval(refresh, 30_000);
})();
