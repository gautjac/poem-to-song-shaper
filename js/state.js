// state.js — minimal reactive state.

const state = {
  source: "",
  formId: "singer-songwriter",
  dials: new Set(),
  analysis: null,
  directions: [],
  activeDir: 0,
  dirty: false,        // dials changed since last shape
  theme: "dark"
};

const listeners = new Set();
export function subscribe(fn) {
  listeners.add(fn);
  fn(state);
  return () => listeners.delete(fn);
}
function emit() { listeners.forEach(fn => fn(state)); }

export function get() { return state; }

export function set(patch) {
  Object.assign(state, patch);
  emit();
}

export function setDial(name, on) {
  if (on) state.dials.add(name);
  else    state.dials.delete(name);
  state.dirty = true;
  emit();
}

export function clearDials() {
  state.dials.clear();
  state.dirty = true;
  emit();
}

export function setForm(formId) {
  state.formId = formId;
  state.dirty = true;
  emit();
}

export function setActiveDir(i) {
  state.activeDir = i;
  emit();
}

export function setTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute("data-theme", theme);
  try { localStorage.setItem("p2s.theme", theme); } catch {}
  emit();
}

export function loadTheme() {
  const t = (() => { try { return localStorage.getItem("p2s.theme"); } catch { return null; } })();
  if (t === "light" || t === "dark") setTheme(t);
}
