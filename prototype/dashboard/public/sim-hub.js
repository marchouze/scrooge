// sim-hub.js — control panel for the centralised 3rd-party simulator hub.
// Registry-driven: fetches the self-describing registry once, builds a card per
// simulator (config form auto-generated from configSchema), then polls status +
// events every 1.5s and patches the DOM.
(() => {
  const POLL_MS = 1500;
  const domainsEl = document.getElementById("domains");
  const feedBody = document.getElementById("feedBody");
  let registry = null; // { domains: [{ domain, simulators: [...] }] }
  let pollTimer = null;

  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
    );

  function fmtTs(ts) {
    if (!ts) return "—";
    try {
      return `${new Date(ts).toISOString().replace("T", " ").slice(0, 19)}Z`;
    } catch {
      return ts;
    }
  }

  async function getJson(url, opts) {
    const r = await fetch(url, opts);
    if (!r.ok) {
      let msg = `HTTP ${r.status}`;
      try {
        const b = await r.json();
        if (b?.error) msg = b.error;
      } catch {}
      throw new Error(msg);
    }
    return r.json();
  }

  function configFieldHtml(simId, f) {
    const fid = `cfg-${simId}-${f.key}`;
    if (f.type === "select") {
      const opts = (f.options || [])
        .map(
          (o) =>
            `<option value="${esc(o)}"${o === f.default ? " selected" : ""}>${esc(o)}</option>`,
        )
        .join("");
      return `<div class="sim-config-field"><label for="${fid}">${esc(f.label)}</label><select id="${fid}" data-key="${esc(f.key)}">${opts}</select></div>`;
    }
    const type = f.type === "number" ? "number" : "text";
    const min = f.min !== undefined ? ` min="${f.min}"` : "";
    const max = f.max !== undefined ? ` max="${f.max}"` : "";
    return `<div class="sim-config-field"><label for="${fid}">${esc(f.label)}</label><input id="${fid}" type="${type}"${min}${max} value="${esc(f.default)}" data-key="${esc(f.key)}"></div>`;
  }

  function cardHtml(sim) {
    const config = sim.configSchema.map((f) => configFieldHtml(sim.id, f)).join("");
    const loopable = sim.mode === "loop" || sim.mode === "loop+fire";
    const fireable = sim.mode === "fire" || sim.mode === "loop+fire";
    const fireBtns = fireable
      ? (sim.fireActions || [])
          .map(
            (a) =>
              `<button class="sim-btn sim-btn-fire" data-fire="${esc(a.id)}">${esc(a.label)}</button>`,
          )
          .join("")
      : "";
    return `
      <div class="sim-card" data-sim="${esc(sim.id)}">
        <div class="sim-card-head">
          <div>
            <div class="sim-card-name">${esc(sim.label)}</div>
          </div>
          <span class="sim-status-badge" data-badge><span class="sim-dot" data-dot></span><span data-state>—</span></span>
        </div>
        <div class="sim-card-desc">${esc(sim.description)}</div>
        ${config ? `<div class="sim-config" data-config>${config}</div>` : ""}
        <div class="sim-stats">
          <div><div class="sim-stat-label">Events emitted</div><div class="sim-stat-value" data-events>0</div></div>
          <div><div class="sim-stat-label">Last event</div><div class="sim-stat-value mono" data-lastat>—</div></div>
          <div><div class="sim-stat-label">Last type</div><div class="sim-stat-value mono" data-lasttype>—</div></div>
          <div><div class="sim-stat-label">Started</div><div class="sim-stat-value mono" data-started>—</div></div>
        </div>
        <div class="sim-extra" data-extra></div>
        <div class="sim-err" data-err></div>
        <div class="sim-actions">
          ${loopable ? `<button class="sim-btn sim-btn-start" data-start>▶ Start</button><button class="sim-btn sim-btn-stop" data-stop disabled>■ Stop</button>` : ""}
          ${fireBtns}
        </div>
      </div>`;
  }

  function readConfig(card) {
    const cfg = {};
    for (const el of card.querySelectorAll("[data-key]")) {
      const k = el.getAttribute("data-key");
      const v = el.value;
      if (v !== "" && v != null) cfg[k] = v;
    }
    return cfg;
  }

  function wireCard(card) {
    const id = card.getAttribute("data-sim");
    const errEl = card.querySelector("[data-err]");
    const setErr = (m) => {
      if (errEl) errEl.textContent = m || "";
    };

    card.querySelector("[data-start]")?.addEventListener("click", async () => {
      setErr("");
      try {
        await getJson(`/api/sim/${encodeURIComponent(id)}/start`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(readConfig(card)),
        });
        await refreshStatus();
      } catch (e) {
        setErr(e.message);
      }
    });

    card.querySelector("[data-stop]")?.addEventListener("click", async () => {
      setErr("");
      try {
        await getJson(`/api/sim/${encodeURIComponent(id)}/stop`, { method: "POST" });
        await refreshStatus();
      } catch (e) {
        setErr(e.message);
      }
    });

    for (const btn of card.querySelectorAll("[data-fire]")) {
      btn.addEventListener("click", async () => {
        setErr("");
        try {
          const res = await getJson(`/api/sim/${encodeURIComponent(id)}/fire`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              actionId: btn.getAttribute("data-fire"),
              args: readConfig(card),
            }),
          });
          if (res && res.ok === false)
            setErr(typeof res.detail === "string" ? res.detail : "fire failed");
          await refreshStatus();
          await refreshFeed();
        } catch (e) {
          setErr(e.message);
        }
      });
    }
  }

  function renderRegistry() {
    const groups = (registry.domains || [])
      .map((g) => {
        const cards = g.simulators.map(cardHtml).join("");
        return `<h2 class="sim-domain-title">${esc(g.domain)}</h2><div class="sim-grid">${cards}</div>`;
      })
      .join("");
    domainsEl.innerHTML = groups || "<p>No simulators registered.</p>";
    for (const card of domainsEl.querySelectorAll(".sim-card")) wireCard(card);
  }

  function patchStatus(s) {
    const card = domainsEl.querySelector(`.sim-card[data-sim="${CSS.escape(s.id)}"]`);
    if (!card) return;
    const running = s.running === true;
    const badge = card.querySelector("[data-badge]");
    const dot = card.querySelector("[data-dot]");
    badge.className = `sim-status-badge${running ? " running" : ""}`;
    card.querySelector("[data-state]").textContent = running ? "RUNNING" : "STOPPED";
    dot.className = `sim-dot${running ? " pulse" : ""}`;
    card.querySelector("[data-events]").textContent = s.eventsEmitted ?? 0;
    card.querySelector("[data-lastat]").textContent = fmtTs(s.lastEventAt);
    card.querySelector("[data-lasttype]").textContent = s.lastEventType || "—";
    card.querySelector("[data-started]").textContent = fmtTs(s.startedAt);
    const startBtn = card.querySelector("[data-start]");
    const stopBtn = card.querySelector("[data-stop]");
    if (startBtn) startBtn.disabled = running;
    if (stopBtn) stopBtn.disabled = !running;
    const cfg = card.querySelector("[data-config]");
    if (cfg) cfg.style.display = running ? "none" : "";
    const errEl = card.querySelector("[data-err]");
    if (errEl && s.lastError) errEl.textContent = s.lastError;
    renderExtra(card, s);
  }

  // FX risk-monitor + live-rates panel, folded in from the retired /fx-sim page.
  const observedRatesByCard = {};
  function renderExtra(card, s) {
    const el = card.querySelector("[data-extra]");
    if (!el) return;
    const extra = s.extra || {};
    const rm = extra.riskMonitor;
    if (!rm && extra.lastPair == null) {
      el.innerHTML = "";
      return;
    }
    if (!observedRatesByCard[s.id]) observedRatesByCard[s.id] = {};
    const store = observedRatesByCard[s.id];
    if (extra.lastPair && extra.lastRate != null) {
      store[extra.lastPair] = Number(extra.lastRate).toFixed(6);
    }
    const fmtZar = (n) =>
      n != null ? `ZAR ${Number(n).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}` : "—";
    let html = "";
    if (rm) {
      const pct = rm.b3UtilisationPct != null ? rm.b3UtilisationPct * 100 : null;
      const barPct = pct != null ? Math.min(pct, 200) / 2 : 0;
      const color =
        rm.b3RagStatus === "red" ? "#ef4444" : rm.b3RagStatus === "amber" ? "#f59e0b" : "#22c55e";
      const pctLabel = pct != null ? `${pct.toFixed(0)}%` : "—";
      const ragLabel = rm.b3RagStatus ? esc(rm.b3RagStatus.toUpperCase()) : "—";
      const forced = rm.lastForcedSide ? ` · forced ${esc(rm.lastForcedSide.toUpperCase())}` : "";
      html += `<div class="sim-rm">
        <div class="sim-rm-head"><span>B3 NOP vs limit</span><span>${pctLabel} · ${ragLabel} · ${esc(rm.mode || "—")}</span></div>
        <div class="sim-rm-bar"><div style="width:${barPct}%;background:${color}"></div></div>
        <div class="sim-rm-stats">Exposure ${esc(fmtZar(rm.b3ExposureZar))} · Limit ${esc(fmtZar(rm.b3LimitZar))}${forced}</div>
      </div>`;
    }
    const pairs = Object.keys(store);
    if (pairs.length) {
      html += `<div class="sim-rates">${pairs.map((p) => `<span class="sim-rate"><b>${esc(p)}</b> ${esc(store[p])}</span>`).join("")}</div>`;
    }
    if (extra.lastCounterparty) {
      const r = extra.lastRate != null ? Number(extra.lastRate).toFixed(4) : "—";
      html += `<div class="sim-last">Last: ${esc((extra.lastSide || "").toUpperCase())} ${esc(extra.lastPair || "")} @ ${esc(r)} — ${esc(extra.lastCounterparty)}</div>`;
    }
    el.innerHTML = html;
  }

  async function refreshStatus() {
    try {
      const data = await getJson("/api/sim/status");
      for (const g of data.domains || []) {
        for (const st of g.statuses || []) patchStatus(st);
      }
    } catch {
      /* ignore poll errors */
    }
  }

  async function refreshFeed() {
    try {
      const data = await getJson("/api/sim/events?limit=40");
      const rows = data.events || [];
      feedBody.innerHTML = rows.length
        ? rows
            .map(
              (e) =>
                `<tr><td class="mono">${esc(fmtTs(e.asOf))}</td><td>${esc(e.type)}</td><td class="mono">${esc(e.actor)}</td><td>${esc(e.scenario || "—")}</td></tr>`,
            )
            .join("")
        : `<tr><td colspan="4" style="color:var(--color-text-secondary)">No events yet.</td></tr>`;
    } catch {
      /* ignore poll errors */
    }
  }

  async function init() {
    try {
      registry = await getJson("/api/sim/registry");
      renderRegistry();
      await refreshStatus();
      await refreshFeed();
      pollTimer = setInterval(() => {
        refreshStatus();
        refreshFeed();
      }, POLL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
          if (pollTimer) clearInterval(pollTimer);
          pollTimer = null;
        } else if (!pollTimer)
          pollTimer = setInterval(() => {
            refreshStatus();
            refreshFeed();
          }, POLL_MS);
      });
    } catch (e) {
      domainsEl.innerHTML = `<p style="color:#991b1b">Failed to load simulators: ${esc(e.message)}</p>`;
    }
  }

  init();
})();
