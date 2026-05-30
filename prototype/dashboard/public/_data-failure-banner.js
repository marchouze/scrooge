// dashboard/public/_data-failure-banner.js
//
// Cross-page DATA-failure surface (objective 4 of the Trusted-Figures Program).
// Sibling of _failure-banner.js (which surfaces agent CI-run failures); this one
// surfaces *figure* failures: every bound regulatory figure whose latest
// computation is `degraded` or `failed` (a missing input), plus expected-event
// gaps (a figure whose computation history is silent). Such a figure renders
// "value unavailable", never a silent 0 — and this banner names which figures and
// which inputs are missing so the gap can be chased.
//
// Presentation: each issue is a compact, expandable chip — collapsed it shows a
// status dot + figure name + owner; clicking it reveals the detail (missing
// inputs / expected event). Expansion state survives the 30s refresh so an
// open chip does not snap shut underneath the reader.
//
// Self-contained: injects its own scoped <style> + #dataFailureBanner element
// at the top of the page's <main> content column (so it clears the fixed topbar
// and sidebar rather than rendering underneath them) and polls
// /api/data-failures every 30s. Loaded globally by _shell.js, so it appears on
// every page without per-page wiring.
//
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  // Keys of chips the user has expanded — preserved across re-renders so a poll
  // refresh does not collapse what the reader is looking at.
  const expanded = new Set();

  function ensureStyles() {
    if (document.getElementById("dataFailureBannerStyles")) return;
    const style = document.createElement("style");
    style.id = "dataFailureBannerStyles";
    style.textContent = `
#dataFailureBanner.failure-banner {
  display: block; max-width: none; margin: 0 0 20px; border-radius: 8px;
  border: 1px solid var(--danger); border-bottom-width: 1px;
}
#dataFailureBanner .df-section { margin: 0; }
#dataFailureBanner .df-section + .df-section { margin-top: 8px; }
#dataFailureBanner .df-heading {
  display: block; font-size: 12px; font-weight: 600; letter-spacing: .02em;
  text-transform: uppercase; opacity: .85; margin: 0 0 6px;
}
#dataFailureBanner .df-chips {
  display: flex; flex-wrap: wrap; align-items: flex-start;
  gap: 6px; margin: 0; padding: 0; list-style: none;
}
#dataFailureBanner .df-chip {
  border: 1px solid rgba(0,0,0,.18); border-radius: 999px;
  background: rgba(255,255,255,.55); overflow: hidden; max-width: 100%;
}
#dataFailureBanner .df-chip.is-open { border-radius: 12px; }
#dataFailureBanner .df-chip-face {
  display: flex; align-items: center; gap: 7px; width: 100%;
  padding: 4px 10px; border: 0; background: transparent; cursor: pointer;
  font: inherit; color: inherit; text-align: left; line-height: 1.3;
}
#dataFailureBanner .df-chip-face:hover { background: rgba(0,0,0,.05); }
#dataFailureBanner .df-dot {
  flex: 0 0 auto; width: 8px; height: 8px; border-radius: 50%;
  background: #b45309;
}
#dataFailureBanner .df-dot--failed { background: #b91c1c; }
#dataFailureBanner .df-dot--degraded { background: #b45309; }
#dataFailureBanner .df-dot--gap { background: #7c3aed; }
#dataFailureBanner .df-chip-label {
  font-weight: 600; white-space: nowrap; overflow: hidden;
  text-overflow: ellipsis; max-width: 40ch;
}
#dataFailureBanner .df-chip-owner {
  opacity: .65; font-size: 12px; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; max-width: 24ch;
}
#dataFailureBanner .df-caret {
  flex: 0 0 auto; margin-left: 2px; opacity: .5; font-size: 10px;
  transition: transform .12s ease;
}
#dataFailureBanner .df-chip.is-open .df-caret { transform: rotate(90deg); }
#dataFailureBanner .df-chip-detail {
  padding: 0 12px 8px 25px; font-size: 12px; line-height: 1.45;
}
#dataFailureBanner .df-chip-detail dt {
  opacity: .6; text-transform: uppercase; font-size: 10px;
  letter-spacing: .03em; margin-top: 4px;
}
#dataFailureBanner .df-chip-detail dd { margin: 1px 0 0; }
#dataFailureBanner .df-chip-detail code {
  background: rgba(0,0,0,.08); padding: 0 4px; border-radius: 3px;
}
`;
    document.head.appendChild(style);
  }

  function ensureBanner() {
    ensureStyles();
    let banner = document.getElementById("dataFailureBanner");
    if (banner) return banner;
    banner = document.createElement("div");
    banner.id = "dataFailureBanner";
    banner.className = "failure-banner";
    banner.hidden = true;
    // Prefer the top of the page's <main> content column: it already clears the
    // fixed topbar + sidebar, so the banner lands in the readable area instead
    // of underneath the chrome. Fall back to after-topbar, then body.
    const main = document.querySelector("main");
    const topbar = document.querySelector(".topbar");
    if (main) {
      main.insertBefore(banner, main.firstChild);
    } else if (topbar?.parentNode) {
      topbar.parentNode.insertBefore(banner, topbar.nextSibling);
    } else {
      document.body.insertBefore(banner, document.body.firstChild);
    }
    return banner;
  }

  // Build one expandable chip. `face` keys: dotClass, label, owner; `detail` is
  // an array of [term, value] pairs shown when the chip is open.
  function buildChip(key, dotClass, label, owner, detail) {
    const chip = document.createElement("li");
    chip.className = "df-chip";
    const isOpen = expanded.has(key);
    if (isOpen) chip.classList.add("is-open");

    const face = document.createElement("button");
    face.type = "button";
    face.className = "df-chip-face";
    face.setAttribute("aria-expanded", String(isOpen));

    const dot = document.createElement("span");
    dot.className = `df-dot ${dotClass}`;
    face.appendChild(dot);

    const labelEl = document.createElement("span");
    labelEl.className = "df-chip-label";
    labelEl.textContent = label;
    face.appendChild(labelEl);

    if (owner) {
      const ownerEl = document.createElement("span");
      ownerEl.className = "df-chip-owner";
      ownerEl.textContent = owner;
      face.appendChild(ownerEl);
    }

    const caret = document.createElement("span");
    caret.className = "df-caret";
    caret.textContent = "▶";
    caret.setAttribute("aria-hidden", "true");
    face.appendChild(caret);

    const detailEl = document.createElement("dl");
    detailEl.className = "df-chip-detail";
    detailEl.hidden = !isOpen;
    for (const [term, value] of detail) {
      const dt = document.createElement("dt");
      dt.textContent = term;
      const dd = document.createElement("dd");
      dd.textContent = value;
      detailEl.appendChild(dt);
      detailEl.appendChild(dd);
    }

    face.addEventListener("click", () => {
      const nowOpen = !chip.classList.contains("is-open");
      chip.classList.toggle("is-open", nowOpen);
      detailEl.hidden = !nowOpen;
      face.setAttribute("aria-expanded", String(nowOpen));
      if (nowOpen) expanded.add(key);
      else expanded.delete(key);
    });

    chip.appendChild(face);
    chip.appendChild(detailEl);
    return chip;
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
      const section = document.createElement("div");
      section.className = "df-section";

      const heading = document.createElement("span");
      heading.className = "df-heading";
      heading.textContent =
        failures.length === 1
          ? "1 figure unavailable (data failure)"
          : `${failures.length} figures unavailable${failed ? ` · ${failed} failed` : ""}`;
      section.appendChild(heading);

      const chips = document.createElement("ul");
      chips.className = "df-chips";
      for (const f of failures) {
        const missing = (f.missingInputs || []).join(", ") || "unknown input";
        const key = `fig:${f.calcKey || f.figure}`;
        chips.appendChild(
          buildChip(key, `df-dot--${f.status}`, f.figure, f.owningAgent, [
            ["status", f.status],
            ["missing inputs", missing],
            ["owner", f.owningAgent || "—"],
          ]),
        );
      }
      section.appendChild(chips);
      banner.appendChild(section);
    }

    if (gaps && gaps.length > 0) {
      const section = document.createElement("div");
      section.className = "df-section";

      const heading = document.createElement("span");
      heading.className = "df-heading";
      heading.textContent =
        gaps.length === 1
          ? "1 expected event missing (data integrity)"
          : `${gaps.length} expected events missing (data integrity)`;
      section.appendChild(heading);

      const chips = document.createElement("ul");
      chips.className = "df-chips";
      for (const g of gaps) {
        const key = `gap:${g.eventType}:${g.label}`;
        chips.appendChild(
          buildChip(key, "df-dot--gap", g.label, g.owningRole, [
            ["expected event", g.eventType],
            ["status", "never emitted"],
            ["owner", g.owningRole || "—"],
          ]),
        );
      }
      section.appendChild(chips);
      banner.appendChild(section);
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
