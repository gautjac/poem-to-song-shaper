// storage.js
// Tiny localStorage layer for saved hooks, saved versions, and last source.

const KEY = "p2s.v1";

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultStore();
    return Object.assign(defaultStore(), JSON.parse(raw));
  } catch {
    return defaultStore();
  }
}

function defaultStore() {
  return {
    hooks: [],     // [{ text, source, savedAt }]
    versions: [],  // [{ id, title, direction, sections, savedAt }]
    last: null     // { source, formId, dials }
  };
}

function persist(store) {
  try { localStorage.setItem(KEY, JSON.stringify(store)); }
  catch { /* quota — silently drop */ }
}

const subscribers = new Set();
function emit(store) { subscribers.forEach(fn => fn(store)); }

export const Storage = {
  get() { return load(); },
  subscribe(fn) { subscribers.add(fn); fn(load()); return () => subscribers.delete(fn); },

  saveHook(text) {
    const store = load();
    if (!text) return store;
    if (store.hooks.some(h => h.text.toLowerCase() === text.toLowerCase())) return store;
    store.hooks.unshift({ text, savedAt: Date.now() });
    persist(store); emit(store); return store;
  },
  removeHook(text) {
    const store = load();
    store.hooks = store.hooks.filter(h => h.text !== text);
    persist(store); emit(store); return store;
  },
  hasHook(text) {
    return load().hooks.some(h => h.text.toLowerCase() === (text || "").toLowerCase());
  },

  saveVersion(version) {
    const store = load();
    const id = "v_" + Date.now().toString(36);
    store.versions.unshift({ id, savedAt: Date.now(), ...version });
    if (store.versions.length > 50) store.versions.length = 50;
    persist(store); emit(store); return store;
  },
  removeVersion(id) {
    const store = load();
    store.versions = store.versions.filter(v => v.id !== id);
    persist(store); emit(store); return store;
  },

  saveLast(state) {
    const store = load();
    store.last = state;
    persist(store); /* no emit — silent */
    return store;
  }
};
