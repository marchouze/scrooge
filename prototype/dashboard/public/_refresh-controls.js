// dashboard/public/_refresh-controls.js
//
// Cross-page periodic-refresh controls. Loaded by every dashboard page.
//
// Provides three pieces of behaviour:
//
//  1. `window.registerPagePoll(fn, intervalMs)` — pages call this instead of
//     `setInterval(fn, ms)`. The shared module owns the timer so that all
//     pages share consistent visibility-pause behaviour.
//
//  2. Tab-visibility pausing. While the tab is hidden, registered polls do
//     not tick (saves CPU on background tabs and avoids burning bandwidth
//     against /api/state for tabs the operator isn't looking at). When the
//     tab becomes visible again, every registered fn fires immediately and
//     the interval resumes.
//
//  3. Manual "Refresh" button auto-injected into the topbar `.meta` area.
//     On click, POSTs to /api/refresh (forces server-side re-derivation
//     even if the 30s server poll hasn't fired yet) then calls every
//     registered fn so the page re-renders.
//
// Memory rule: feedback_dashboards_live_reports_as_of.md (2026-05-09).
// Dashboards = live = periodic re-derivation + user-trigger refresh.
//
// Author: Anya (Data / analytics engineer)

(() => {
  /** @type {Array<{ fn: () => unknown, intervalMs: number, timer: number | null }>} */
  const registrations = [];

  function clearTimer(reg) {
    if (reg.timer !== null) {
      window.clearInterval(reg.timer);
      reg.timer = null;
    }
  }

  function startTimer(reg) {
    clearTimer(reg);
    reg.timer = window.setInterval(() => {
      try {
        reg.fn();
      } catch (e) {
        console.warn("registered poll threw", e);
      }
    }, reg.intervalMs);
  }

  function pauseAll() {
    for (const reg of registrations) clearTimer(reg);
  }

  function resumeAll() {
    for (const reg of registrations) {
      // Immediate fetch on resume so the operator sees fresh data straight
      // away rather than waiting up to `intervalMs` for the next tick.
      try {
        reg.fn();
      } catch (e) {
        console.warn("registered poll threw on resume", e);
      }
      startTimer(reg);
    }
  }

  /**
   * Register a polling function. Replaces `setInterval(fn, intervalMs)` for
   * dashboard pages so visibility-pause and manual-refresh apply uniformly.
   */
  window.registerPagePoll = function registerPagePoll(fn, intervalMs) {
    if (typeof fn !== "function") return;
    const reg = { fn, intervalMs: intervalMs || 30_000, timer: null };
    registrations.push(reg);
    if (document.visibilityState !== "hidden") startTimer(reg);
    return () => {
      clearTimer(reg);
      const i = registrations.indexOf(reg);
      if (i >= 0) registrations.splice(i, 1);
    };
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") pauseAll();
    else resumeAll();
  });

  // ---------- Refresh button ----------

  function findMeta() {
    // Every page's topbar uses <div class="meta"> (sometimes with id="meta").
    return document.querySelector(".topbar .meta");
  }

  function injectRefreshButton() {
    const meta = findMeta();
    if (!meta) return;
    if (document.getElementById("refreshNowBtn")) return;
    const btn = document.createElement("button");
    btn.id = "refreshNowBtn";
    btn.type = "button";
    btn.className = "btn-ghost refresh-now";
    btn.textContent = "Refresh";
    btn.title = "Force server-side re-derivation, then refetch";
    btn.addEventListener("click", onRefreshClick);
    // Insert before the live-dot / lastUpdated cluster if present, otherwise
    // append. Both layouts work because the topbar uses flex.
    const liveDot = meta.querySelector("#liveDot");
    if (liveDot) meta.insertBefore(btn, liveDot);
    else meta.appendChild(btn);
  }

  async function onRefreshClick() {
    const btn = document.getElementById("refreshNowBtn");
    if (!btn || btn.disabled) return;
    btn.disabled = true;
    const prev = btn.textContent;
    btn.textContent = "Refreshing…";
    try {
      // Force the server to re-derive immediately. The POST returns once
      // re-derivation completes, so the subsequent fn() calls will see
      // fresh state.
      await fetch("/api/refresh", { method: "POST", cache: "no-store" });
    } catch (e) {
      console.warn("manual refresh: /api/refresh failed", e);
    }
    // Trigger every registered page-poll regardless of POST outcome — at
    // worst we re-render the prior server state.
    await Promise.allSettled(
      registrations.map((reg) => {
        try {
          return Promise.resolve(reg.fn());
        } catch (e) {
          return Promise.reject(e);
        }
      }),
    );
    btn.textContent = prev;
    btn.disabled = false;
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectRefreshButton);
  } else {
    injectRefreshButton();
  }
})();
