// app.js — controller. Wires the UI to the engine modules.

import * as State from "./state.js";
import { analyze } from "./analyzer.js";
import { shape }   from "./shaper.js";
import { variantsFor } from "./compressor.js";
import { examples } from "./examples.js";
import { Storage } from "./storage.js";
import {
  renderAnalysis, renderHooks, renderDirectionTabs, renderDirection,
  renderControls, renderSourceCounts, renderDrawer, showToast
} from "./render.js";
import { asLyricSheet, asMarkdown, asHooksOnly, copyToClipboard } from "./export.js";

// ── boot ─────────────────────────────────────────────────────────────────
function boot() {
  State.loadTheme();

  // Restore last session if present.
  const last = Storage.get().last;
  if (last && last.source) {
    document.getElementById("source").value = last.source;
    State.set({
      source: last.source,
      formId: last.formId || "singer-songwriter",
      dials: new Set(last.dials || [])
    });
  }

  wireSource();
  wireControls();
  wireDirections();
  wireDrawer();
  wireExamples();
  wireExport();
  wireLineModal();
  wireTheme();

  // Initial render.
  State.subscribe(state => {
    renderControls(state);
    renderSourceCounts(state.source);
    renderAnalysis(state.analysis);
    renderHooks(state.analysis);
    renderDirectionTabs(state.directions, state.activeDir);
    renderDirection(state.directions[state.activeDir]);
  });

  Storage.subscribe(store => {
    renderDrawer(store);
    // re-render hooks panel for save-state changes
    const a = State.get().analysis;
    if (a) renderHooks(a);
  });

  // If we restored a source, run shape automatically.
  if (last && last.source) runShape();
}

// ── source ──────────────────────────────────────────────────────────────
function wireSource() {
  const ta = document.getElementById("source");
  ta.addEventListener("input", e => {
    State.set({ source: e.target.value, dirty: true });
  });
  document.getElementById("btn-clear").addEventListener("click", () => {
    ta.value = "";
    State.set({ source: "", analysis: null, directions: [], activeDir: 0, dirty: false });
    Storage.saveLast({ source: "", formId: State.get().formId, dials: [...State.get().dials] });
  });
  document.getElementById("btn-shape").addEventListener("click", runShape);
}

function runShape() {
  const s = State.get();
  if (!s.source.trim()) {
    showToast("Paste some text first.");
    return;
  }
  const analysis = analyze(s.source);
  const directions = shape(analysis, { form: s.formId, dials: [...s.dials] });
  State.set({ analysis, directions, dirty: false, activeDir: s.activeDir || 0 });
  Storage.saveLast({ source: s.source, formId: s.formId, dials: [...s.dials] });
}

// ── controls ────────────────────────────────────────────────────────────
function wireControls() {
  document.querySelectorAll("#form-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      State.setForm(chip.dataset.form);
    });
  });

  document.querySelectorAll("#dial-chips .chip").forEach(chip => {
    chip.addEventListener("click", () => {
      const name = chip.dataset.dial;
      const on = !State.get().dials.has(name);
      State.setDial(name, on);
    });
  });

  document.getElementById("btn-reset-dials").addEventListener("click", () => {
    State.clearDials();
  });
  document.getElementById("btn-reshape").addEventListener("click", runShape);
}

// ── directions ──────────────────────────────────────────────────────────
function wireDirections() {
  document.querySelectorAll(".dir-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      State.setActiveDir(Number(tab.dataset.dir));
    });
  });

  // Click on a line to open the line tools modal.
  document.getElementById("direction-body").addEventListener("click", e => {
    const lineEl = e.target.closest(".line");
    if (!lineEl) return;
    openLineModal(lineEl.dataset.line, lineEl);
  });

  // Click on a hook to copy / save.
  document.getElementById("hook-list").addEventListener("click", e => {
    const save = e.target.closest("[data-save-hook]");
    if (save) {
      const text = save.getAttribute("data-save-hook");
      if (Storage.hasHook(text)) {
        Storage.removeHook(text);
        showToast("Hook removed.");
      } else {
        Storage.saveHook(text);
        showToast("Hook saved.");
      }
      return;
    }
    const line = e.target.closest("[data-hook]");
    if (line) {
      const text = line.getAttribute("data-hook");
      copyToClipboard(text).then(ok => showToast(ok ? "Hook copied." : "Copy failed."));
    }
  });
}

// ── drawer ──────────────────────────────────────────────────────────────
function wireDrawer() {
  const drawer = document.getElementById("drawer");
  document.getElementById("drawer-tab").addEventListener("click", () => {
    const open = drawer.dataset.open === "true";
    drawer.dataset.open = open ? "false" : "true";
    document.getElementById("drawer-tab").setAttribute("aria-expanded", open ? "false" : "true");
  });

  drawer.addEventListener("click", e => {
    const cp = e.target.closest("[data-copy-hook]");
    if (cp) {
      copyToClipboard(cp.getAttribute("data-copy-hook")).then(ok =>
        showToast(ok ? "Copied." : "Copy failed."));
      return;
    }
    const rm = e.target.closest("[data-rm-hook]");
    if (rm) { Storage.removeHook(rm.getAttribute("data-rm-hook")); return; }

    const cv = e.target.closest("[data-copy-version]");
    if (cv) {
      const v = Storage.get().versions.find(x => x.id === cv.getAttribute("data-copy-version"));
      if (v) copyToClipboard(asLyricSheet(v)).then(ok => showToast(ok ? "Lyric sheet copied." : "Copy failed."));
      return;
    }
    const rv = e.target.closest("[data-rm-version]");
    if (rv) Storage.removeVersion(rv.getAttribute("data-rm-version"));
  });
}

// ── examples ────────────────────────────────────────────────────────────
function wireExamples() {
  const modal = document.getElementById("modal-examples");
  const grid  = document.getElementById("example-grid");
  document.getElementById("btn-examples").addEventListener("click", () => {
    grid.innerHTML = examples.map(ex => `
      <button class="example-card" data-ex="${ex.id}">
        <h4>${escapeAttr(ex.title)}</h4>
        <p>${escapeAttr(ex.blurb)}</p>
        <div class="ex-meta">${escapeAttr(ex.register)}</div>
      </button>
    `).join("");
    modal.hidden = false;
  });

  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      modal.hidden = true; return;
    }
    const card = e.target.closest("[data-ex]");
    if (!card) return;
    const ex = examples.find(x => x.id === card.dataset.ex);
    if (!ex) return;
    document.getElementById("source").value = ex.text;
    State.set({ source: ex.text, dirty: true });
    modal.hidden = true;
    runShape();
  });
}

// ── export ──────────────────────────────────────────────────────────────
function wireExport() {
  document.getElementById("btn-save").addEventListener("click", () => {
    const s = State.get();
    const dir = s.directions[s.activeDir];
    if (!dir) return;
    Storage.saveVersion({
      title: dir.possible_title || "Untitled",
      direction: dir.direction,
      sections: dir.sections,
      possible_title: dir.possible_title,
      hook_candidates: dir.hook_candidates
    });
    showToast("Saved to drawer.");
    document.getElementById("drawer").dataset.open = "true";
  });

  document.getElementById("btn-copy-lyric").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asLyricSheet(dir)).then(ok => showToast(ok ? "Lyric sheet copied." : "Copy failed."));
  });
  document.getElementById("btn-copy-md").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asMarkdown(dir)).then(ok => showToast(ok ? "Markdown copied." : "Copy failed."));
  });
  document.getElementById("btn-copy-hooks").addEventListener("click", () => {
    const dir = currentDir(); if (!dir) return;
    copyToClipboard(asHooksOnly(dir)).then(ok => showToast(ok ? "Hooks copied." : "Copy failed."));
  });
}

function currentDir() {
  const s = State.get();
  return s.directions[s.activeDir];
}

// ── line modal ──────────────────────────────────────────────────────────
let lineCtx = null;

function openLineModal(text, lineEl) {
  if (!text) return;
  lineCtx = { text, el: lineEl, picked: null };
  const modal = document.getElementById("modal-line");
  document.getElementById("line-original").textContent = text;
  const variants = variantsFor(text);
  const list = document.getElementById("line-variants");
  if (!variants.length) {
    list.innerHTML = `<p class="muted" style="padding:8px 16px;">This line is already tight. Nothing to compress without losing it.</p>`;
  } else {
    list.innerHTML = variants.map((v, i) => `
      <div class="variant" data-variant-idx="${i}">
        <span>${escapeText(v.text)}</span>
        <span class="label">${escapeText(v.label)}</span>
      </div>
    `).join("");
  }
  // store variants on the modal for picking
  list.dataset.variants = JSON.stringify(variants);
  document.getElementById("line-replace").disabled = true;
  modal.hidden = false;
}

function wireLineModal() {
  const modal = document.getElementById("modal-line");
  modal.addEventListener("click", e => {
    if (e.target === modal || e.target.matches("[data-close]")) {
      modal.hidden = true;
      return;
    }
    const v = e.target.closest("[data-variant-idx]");
    if (!v) return;
    document.querySelectorAll("#line-variants .variant").forEach(x => x.classList.remove("selected"));
    v.classList.add("selected");
    const list = document.getElementById("line-variants");
    const variants = JSON.parse(list.dataset.variants || "[]");
    lineCtx.picked = variants[Number(v.dataset.variantIdx)];
    document.getElementById("line-replace").disabled = false;
  });

  document.getElementById("line-replace").addEventListener("click", () => {
    if (!lineCtx || !lineCtx.picked) return;
    // Mutate the active direction in state and re-render.
    const s = State.get();
    const dir = s.directions[s.activeDir];
    const target = lineCtx.text;
    const newText = lineCtx.picked.text;
    let replaced = 0;
    for (const sec of dir.sections) {
      for (const line of sec.lines) {
        if (line.text === target) {
          line.text = newText;
          line.source_status = classify(target, newText);
          replaced++;
        }
      }
    }
    State.set({ directions: s.directions });
    document.getElementById("modal-line").hidden = true;
    showToast(replaced ? `Replaced in ${replaced} place${replaced === 1 ? "" : "s"}.` : "Line not found.");
  });
}

// Lightweight version of classifier for runtime line edits.
function classify(orig, next) {
  if (orig.trim() === next.trim()) return "original";
  const a = new Set(orig.toLowerCase().split(/\s+/));
  const b = next.toLowerCase().split(/\s+/);
  const overlap = b.filter(w => a.has(w)).length / Math.max(1, b.length);
  if (overlap >= 0.85) return "adapted";
  if (overlap >= 0.45) return "heavy";
  return "new";
}

// ── theme ───────────────────────────────────────────────────────────────
function wireTheme() {
  document.getElementById("btn-theme").addEventListener("click", () => {
    const s = State.get();
    State.setTheme(s.theme === "dark" ? "light" : "dark");
  });
}

// ── helpers ─────────────────────────────────────────────────────────────
function escapeAttr(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
function escapeText(s) { return escapeAttr(s); }

document.addEventListener("DOMContentLoaded", boot);
