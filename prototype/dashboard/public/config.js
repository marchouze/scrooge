// dashboard/public/config.js
//
// Platform configuration page — fetches /api/config, renders a table of all
// paths and server settings with source annotations (env/file/default), and
// supports inline editing for file- and default-sourced values.
//
// Authority: D-BANK-CONFIG-STORE (centralized config, 2026-05-25)
// Author: Atlas (Core banking platform architect, engineering)

(() => {
  function esc(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  // ── Fetch ──────────────────────────────────────────────────────────────────

  async function fetchConfig() {
    const r = await fetch("/api/config");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  }

  async function patchConfig(patch) {
    const r = await fetch("/api/config", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
      throw new Error(err.error ?? `HTTP ${r.status}`);
    }
    return await r.json();
  }

  // ── Source badge ───────────────────────────────────────────────────────────

  function sourceBadge(source) {
    const cls =
      source === "env" ? "source-env" : source === "file" ? "source-file" : "source-default";
    return `<span class="source-badge ${cls}">${esc(source)}</span>`;
  }

  // ── Render helpers ─────────────────────────────────────────────────────────

  let _configData = null;

  function renderSection(title, entries, sectionKey) {
    const rows = entries
      .map(([key, { value, source }]) => {
        const valueStr = String(value);
        const editable = source !== "env";
        const editCell = editable
          ? `<button class="edit-btn" data-section="${esc(sectionKey)}" data-key="${esc(key)}" data-value="${esc(valueStr)}">Edit</button>`
          : `<span class="env-note">Set by env var — edit the env to change</span>`;
        return `<tr>
          <td><span class="config-key">${esc(key)}</span></td>
          <td id="val-${esc(sectionKey)}-${esc(key)}"><span class="config-value">${esc(valueStr)}</span></td>
          <td>${sourceBadge(source)}</td>
          <td>${editCell}</td>
        </tr>`;
      })
      .join("");

    return `
      <div class="config-section">
        <h2>${esc(title)}</h2>
        <table class="config-table">
          <thead><tr>
            <th>Key</th><th>Value</th><th>Source</th><th>Action</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  }

  function renderConfig(data) {
    _configData = data;

    const pathEntries = Object.entries(data.paths);
    const serverEntries = Object.entries(data.server);

    const filePath = data.configFilePath ?? "~/.config/bank/platform.json";
    const fileExists = data.configFileExists;

    const subtitle = document.getElementById("configSubtitle");
    if (subtitle) {
      subtitle.innerHTML = `Single source of truth for all process paths and server settings.
        Stored at <code>${esc(filePath)}</code>
        ${fileExists ? '<span class="source-badge source-file">file exists</span>' : '<span class="source-badge source-default">auto-created on first access</span>'}.
        Env vars override per key.`;
    }

    const html =
      renderSection("Paths", pathEntries, "paths") +
      renderSection("Server", serverEntries, "server");

    const container = document.getElementById("configContent");
    container.innerHTML = html;

    // Wire edit buttons
    for (const btn of container.querySelectorAll(".edit-btn")) {
      btn.addEventListener("click", () => startEdit(btn));
    }
  }

  // ── Inline edit ────────────────────────────────────────────────────────────

  function startEdit(btn) {
    const sectionKey = btn.dataset.section;
    const key = btn.dataset.key;
    const currentValue = btn.dataset.value;

    const cell = btn.parentElement;
    const valCell = document.getElementById(`val-${sectionKey}-${key}`);

    // Swap value cell to an input
    valCell.innerHTML = `
      <div class="edit-row">
        <input class="edit-input" id="input-${sectionKey}-${key}" type="text" value="${esc(currentValue)}">
      </div>`;

    // Swap action cell to save/cancel
    cell.innerHTML = `
      <button class="save-btn" id="save-${sectionKey}-${key}">Save</button>
      <button class="cancel-btn" id="cancel-${sectionKey}-${key}">Cancel</button>`;

    document
      .getElementById(`save-${sectionKey}-${key}`)
      .addEventListener("click", () => saveEdit(sectionKey, key));
    document.getElementById(`cancel-${sectionKey}-${key}`).addEventListener("click", () => load());

    document.getElementById(`input-${sectionKey}-${key}`)?.focus();
  }

  async function saveEdit(sectionKey, key) {
    const input = document.getElementById(`input-${sectionKey}-${key}`);
    if (!input) return;
    const newValue = input.value.trim();
    if (!newValue) return;

    // For server keys, coerce to number
    const patch = {};
    if (sectionKey === "server") {
      const n = Number(newValue);
      if (Number.isNaN(n)) {
        alert(`"${newValue}" is not a valid number for server.${key}`);
        return;
      }
      patch.server = { [key]: n };
    } else {
      patch.paths = { [key]: newValue };
    }

    try {
      const result = await patchConfig(patch);
      renderConfig(result.config);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
      load(); // Re-render from server state
    }
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  async function load() {
    try {
      const data = await fetchConfig();
      renderConfig(data);
    } catch (err) {
      const container = document.getElementById("configContent");
      container.innerHTML = `<p style="color:var(--danger,#c33);">Failed to load config: ${esc(String(err))}</p>`;
    }
  }

  function init() {
    load();
    // Refresh every 30s to pick up external changes
    setInterval(load, 30_000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
