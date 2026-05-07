// render.js — DOM rendering. Pure-ish: takes state, paints DOM.

import { Storage } from "./storage.js";
import { thinSectionIndices } from "./ai.js";
import { t } from "./i18n.js";

export function renderAnalysis(analysis, lang) {
  const status = document.getElementById("analysis-status");
  const body   = document.getElementById("analysis-body");

  if (!analysis) {
    status.textContent = t("reading.awaiting");
    body.innerHTML = `<p class="empty">${escape(t("reading.empty"))}</p>`;
    return;
  }

  const { metrics, tone, recurring, refrains, tension, verdict, titles } = analysis;
  status.textContent = t("reading.linesPerAvg", metrics.lineCount, metrics.avgWords, metrics.avgSyllables);

  // Localize tone names through lang.toneNames if a pack was provided.
  const toneDisplay = (tone || []).map(name => (lang?.toneNames?.[name] || name));
  const toneStr = toneDisplay.length ? toneDisplay.join(" · ") : "—";
  const imagesStr = recurring.length
    ? recurring.map(r => `<em>${escape(r.word)}</em><span class="muted small"> ×${r.count}</span>`).join(", ")
    : `<span class="muted">${escape(t("reading.imagesNone"))}</span>`;
  const refrainStr = refrains.length
    ? refrains.map(r => `"${escape(truncate(r.text, 60))}" <span class="muted small">×${r.occurrences}</span>`).join("<br>")
    : `<span class="muted">${escape(t("reading.refrainNone"))}</span>`;
  const titlesStr = titles.length ? titles.slice(0, 3).map(s => escape(s)).join(" · ") : `<span class="muted">—</span>`;

  body.innerHTML = `
    <dl class="analysis-grid">
      <div><dt>${escape(t("reading.tone"))}</dt><dd>${escape(toneStr)}</dd></div>
      <div><dt>${escape(t("reading.tension"))}</dt><dd>${escape(tension)}</dd></div>
      <div><dt>${escape(t("reading.images"))}</dt><dd>${imagesStr}</dd></div>
      <div><dt>${escape(t("reading.refrain"))}</dt><dd>${refrainStr}</dd></div>
      <div><dt>${escape(t("reading.titles"))}</dt><dd>${titlesStr}</dd></div>
      <div><dt>${escape(t("reading.singable"))}</dt><dd>${escape(t("reading.singableOf", metrics.goodLines, metrics.lineCount))}</dd></div>
    </dl>
    <div class="analysis-verdict ${verdict.wantsSong ? "" : "warn"}">
      ${escape(verdict.verdict)}
    </div>
  `;
}

export function renderHooks(analysis) {
  const list = document.getElementById("hook-list");
  const status = document.getElementById("hooks-status");

  if (!analysis || !analysis.hooks.length) {
    status.textContent = "";
    list.innerHTML = `<li class="empty muted">${escape(t("hooks.empty"))}</li>`;
    return;
  }
  status.textContent = t("hooks.candidates", analysis.hooks.length);
  const saved = Storage.get().hooks.map(h => h.text.toLowerCase());
  list.innerHTML = analysis.hooks.map(h => {
    const on = saved.includes(h.text.toLowerCase());
    return `<li>
      <span class="hook-line" data-hook="${escape(h.text)}">${escape(h.text)}</span>
      <span class="hook-meta">${escape(h.fromText ? t("hooks.fromSource") : t("hooks.fabricated"))}</span>
      <button class="hook-save ${on ? "saved" : ""}" data-save-hook="${escape(h.text)}" title="${escape(t("hooks.saveTitle"))}">★</button>
    </li>`;
  }).join("");
}

// Tab keys map index → i18n short/full label keys. Falls back to splitting
// the direction's display name on whitespace if the lookup misses (e.g. when
// directions get refreshed mid-language-switch).
const TAB_KEYS = ["minimal", "balanced", "bold"];

export function renderDirectionTabs(directions, activeIdx) {
  const tabs = document.querySelectorAll(".dir-tab");
  tabs.forEach((tab, i) => {
    tab.classList.toggle("active", i === activeIdx);
    if (directions[i]) {
      const full  = t(`dir.${TAB_KEYS[i]}.full`)  || directions[i].direction;
      const short = t(`dir.${TAB_KEYS[i]}.short`) || full.split(/\s+/)[0];
      tab.innerHTML = `<span class="full">${escape(full)}</span><span class="short">${escape(short)}</span>`;
    } else {
      // Pre-shape: use the i18n keys directly so the placeholder labels
      // localize on language switch even before any text is shaped.
      const full  = t(`dir.${TAB_KEYS[i]}.full`);
      const short = t(`dir.${TAB_KEYS[i]}.short`);
      tab.innerHTML = `<span class="full">${escape(full)}</span><span class="short">${escape(short)}</span>`;
    }
  });
}

export function renderDirection(direction) {
  const body = document.getElementById("direction-body");
  const foot = document.getElementById("direction-foot");

  if (!direction) {
    foot.hidden = true;
    body.innerHTML = `<div class="empty-pane"><p class="empty">${t("directions.empty")}</p></div>`;
    return;
  }

  foot.hidden = false;

  const thin = new Set(thinSectionIndices(direction));
  const sectionHTML = direction.sections.map((sec, sIdx) => `
    <div class="section ${thin.has(sIdx) ? "thin" : ""}" data-section-idx="${sIdx}">
      <div class="section-label">
        ${escape(sec.label)}
        <button class="section-propose" data-propose-section="${sIdx}" title="${escape(t("modal.propose"))}">
          ${escape(thin.has(sIdx) ? t("section.proposeLong") : t("section.proposeShort"))}
        </button>
      </div>
      <div class="section-lines">
        ${sec.lines.map((l, i) => `
          <div class="line ${l.source_status}" data-section="${escape(sec.label)}" data-line-idx="${i}" data-line="${escape(l.text)}">
            <span class="marker"></span>
            <span class="text">${escape(l.text)}</span>
            <span class="tools">${escape(t("section.refineHint"))}</span>
          </div>`).join("")}
      </div>
    </div>
  `).join("");

  body.innerHTML = `
    <div class="dir-rationale">${escape(direction.rationale)}</div>

    <dl class="dir-meta">
      <div><dt>${escape(t("dir.title"))}</dt><dd><strong>${escape(direction.possible_title || "—")}</strong></dd></div>
      <div><dt>${escape(t("dir.emotionalCore"))}</dt><dd>${escape(direction.emotional_core || "—")}</dd></div>
    </dl>

    <div class="preserve-legend">
      <span><i style="background:var(--moss)"></i>${escape(t("legend.original"))}</span>
      <span><i style="background:var(--rust)"></i>${escape(t("legend.adapted"))}</span>
      <span><i style="background:var(--plum)"></i>${escape(t("legend.heavy"))}</span>
      <span><i style="background:var(--gold)"></i>${escape(t("legend.new"))}</span>
      <span><i style="background:var(--ink-faint)"></i>${escape(t("legend.repeat"))}</span>
    </div>

    ${sectionHTML}

    <div class="dir-notes">
      <h4>${escape(t("dir.adaptationNotes"))}</h4>
      <ul>${(direction.adaptation_notes || []).map(n => `<li>${escape(n)}</li>`).join("")}</ul>
    </div>
  `;
}

export function renderControls(state) {
  // form chips
  document.querySelectorAll("#form-chips .chip").forEach(chip => {
    const on = chip.dataset.form === state.formId;
    chip.classList.toggle("active", on);
    chip.setAttribute("aria-checked", on ? "true" : "false");
  });
  // dial chips
  document.querySelectorAll("#dial-chips .chip").forEach(chip => {
    chip.classList.toggle("active", state.dials.has(chip.dataset.dial));
  });
  // re-shape button
  const btn = document.getElementById("btn-reshape");
  btn.disabled = !(state.analysis && state.dirty);
}

export function renderSourceCounts(text) {
  const counts = document.getElementById("source-counts");
  if (!text) { counts.textContent = ""; return; }
  const lines = text.split("\n").filter(l => l.trim()).length;
  const words = (text.match(/\S+/g) || []).length;
  const chars = text.length;
  counts.textContent = `${lines} ${t("source.lines")} · ${words} ${t("source.words")} · ${chars} ${t("source.chars")}`;
}

export function renderDrawer(store) {
  document.getElementById("drawer-count").textContent = String(store.hooks.length + store.versions.length);

  const hooks = document.getElementById("saved-hooks");
  hooks.innerHTML = store.hooks.length
    ? store.hooks.map(h => `<li><span>${escape(h.text)}</span><span class="saved-actions">
        <button data-copy-hook="${escape(h.text)}" title="${escape(t("drawer.copy"))}">${escape(t("drawer.copy"))}</button>
        <button data-rm-hook="${escape(h.text)}" title="${escape(t("drawer.remove"))}">×</button>
      </span></li>`).join("")
    : `<li class="empty muted">${escape(t("drawer.noHooks"))}</li>`;

  const versions = document.getElementById("saved-versions");
  versions.innerHTML = store.versions.length
    ? store.versions.map(v => `<li>
        <span><strong>${escape(v.title || "Untitled")}</strong>
        <span class="muted small"> · ${escape(v.direction)}</span></span>
        <span class="saved-actions">
          <button data-copy-version="${v.id}" title="${escape(t("drawer.copy"))}">${escape(t("drawer.copy"))}</button>
          <button data-rm-version="${v.id}" title="${escape(t("drawer.remove"))}">×</button>
        </span>
      </li>`).join("")
    : `<li class="empty muted">${escape(t("drawer.noVersions"))}</li>`;
}

export function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(showToast._h);
  showToast._h = setTimeout(() => { el.hidden = true; }, 1700);
}

// helpers
function escape(s) {
  if (s == null) return "";
  return String(s).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
