// i18n.js — locale detection, UI strings, source-language detection.
//
// Two distinct concepts, kept separate on purpose:
//   - INTERFACE LOCALE — what language the UI is in (en or fr)
//   - SOURCE LANGUAGE  — what language the pasted poem is in
//
// They influence each other: when you paste a clearly French poem, the
// interface offers to switch. But you can also paste an English poem
// while the UI is in French, and that's fine — the AI honors the source
// language for output, not the interface.

const STRINGS = {
  en: {
    "app.title":            "Poem to Song Shaper",
    "app.tagline":          "a workbench for turning text into singable shape",
    "btn.examples":         "Examples",
    "btn.theme":            "◐",
    "btn.lang":             "EN / FR",

    "source.heading":       "Source",
    "source.metaPaste":     "paste a poem, fragment, or passage",
    "source.placeholder":   "Paste your poem, fragment, monologue, or passage here…",
    "source.clear":         "Clear",
    "source.shape":         "Shape it →",
    "source.lines":         "lines",
    "source.words":         "words",
    "source.chars":         "chars",

    "reading.heading":      "Reading",
    "reading.awaiting":     "awaiting text",
    "reading.empty":        "The poem will be read for tone, recurring images, hookable lines, and whether it actually wants to become a song. Paste something on the left to begin.",
    "reading.tone":         "Dominant tone",
    "reading.tension":      "Central tension",
    "reading.images":       "Recurring images",
    "reading.refrain":      "Natural refrain",
    "reading.titles":       "Title candidates",
    "reading.singable":     "Singable lines",
    "reading.linesPerAvg":  (n, w, s) => `${n} lines · avg ${w} words / ${s} syl`,
    "reading.refrainNone":  "none yet — could plant one",
    "reading.imagesNone":   "none recurring",
    "reading.singableOf":   (g, t) => `${g} of ${t}`,

    "shape.heading":        "Shape",
    "shape.targetForm":     "Target form",
    "shape.songability":    "Songability",
    "shape.resetDials":     "reset dials",
    "shape.reshape":        "Re-shape with these dials",

    "form.singer-songwriter": "singer-songwriter",
    "form.folk-ballad":       "folk ballad",
    "form.indie-art-song":    "indie art song",
    "form.musical-theatre":   "musical theatre",
    "form.pop-adjacent":      "pop-adjacent",
    "form.spoken-refrain":    "spoken-word w/ refrain",

    "dial.repetition":      "more repetition",
    "dial.clarity":         "more clarity",
    "dial.density":         "more poetic density",
    "dial.conversational":  "more conversational",
    "dial.melodic":         "more melodic phrasing",
    "dial.shorter":         "shorter lines",
    "dial.hook":            "stronger hook",

    "hooks.heading":        "Hook candidates",
    "hooks.empty":          "Hook candidates will appear here once shaping begins.",
    "hooks.fromSource":     "in source",
    "hooks.fabricated":     "fabricated",
    "hooks.candidates":     (n) => `${n} candidate${n === 1 ? "" : "s"}`,
    "hooks.saveTitle":      "Save hook",

    "directions.heading":   "Directions",
    "directions.subtitle":  "three ways this could move",
    "directions.empty":     "Three shaping directions will appear here: <em>minimal</em>, <em>balanced</em>, and <em>bold</em>. Each will say what it preserves, what it adapts, and why.",

    "dir.minimal.full":     "Minimal intervention",
    "dir.minimal.short":    "Minimal",
    "dir.balanced.full":    "Balanced adaptation",
    "dir.balanced.short":   "Balanced",
    "dir.bold.full":        "Bold restructuring",
    "dir.bold.short":       "Bold",

    "dir.title":            "Possible title",
    "dir.emotionalCore":    "Emotional core",
    "dir.adaptationNotes":  "Adaptation notes",

    "legend.original":      "original line",
    "legend.adapted":       "lightly adapted",
    "legend.heavy":         "heavily adapted",
    "legend.new":           "new connective",
    "legend.repeat":        "repeat",

    "section.refineHint":   "refine →",
    "section.proposeShort": "✦",
    "section.proposeLong":  "✦ propose",

    "footer.fillThin":      "✦ Fill thin sections",
    "footer.save":          "★ Save this version",
    "footer.copyLyric":     "Copy as lyric sheet",
    "footer.copyMd":        "Export markdown",
    "footer.copyHooks":     "Copy hooks only",

    "drawer.label":         "Saved",
    "drawer.favoriteHooks": "Favorite hooks",
    "drawer.savedVersions": "Saved versions",
    "drawer.noHooks":       "No saved hooks yet.",
    "drawer.noVersions":    "No saved versions yet.",
    "drawer.copy":          "copy",
    "drawer.remove":        "×",

    "modal.examples":       "Pick an example",
    "modal.close":          "close",
    "modal.lineTools":      "Line tools",
    "modal.replaceSection": "Replace in section",
    "modal.propose":        "Propose alternatives",
    "modal.proposeSubtitle": "3 takes from Claude, in your voice.",
    "modal.proposeFor":     (label) => `Propose alternatives — ${label}`,
    "modal.regenerate":     "↻ regenerate",
    "modal.replaceFull":    "Replace section",
    "modal.proposeLoading": "Reading the poem and writing alternatives…",
    "modal.proposeFreshLoading": "Writing fresh alternatives…",
    "modal.optionN":        (n) => `option ${n}`,

    "modal.proposeError.heading": "Couldn't reach the AI.",
    "modal.proposeError.body":    "Make sure ANTHROPIC_API_KEY is set as a Netlify environment variable, then redeploy. If you're running locally, use netlify dev instead of python3 -m http.server.",

    "modal.tightLine":      "This line is already tight. Nothing to compress without losing it.",

    "compress.shorter":     "shorter for melody",
    "compress.simpler":     "simpler syntax",
    "compress.keepImage":   "keep image, cut words",
    "compress.singable":    "easier to sing",
    "compress.rhythmic":    "more rhythmic",

    "toast.pasteFirst":     "Paste some text first.",
    "toast.hookSaved":      "Hook saved.",
    "toast.hookRemoved":    "Hook removed.",
    "toast.hookCopied":     "Hook copied.",
    "toast.copied":         "Copied.",
    "toast.copyFailed":     "Copy failed.",
    "toast.lyricCopied":    "Lyric sheet copied.",
    "toast.markdownCopied": "Markdown copied.",
    "toast.hooksCopied":    "Hooks copied.",
    "toast.savedToDrawer":  "Saved to drawer.",
    "toast.replacedSection": (label) => `Replaced ${label}.`,
    "toast.replacedNTimes": (n) => `Replaced in ${n} place${n === 1 ? "" : "s"}.`,
    "toast.lineNotFound":   "Line not found.",
    "toast.noThinSections": "No thin sections — every slot has body.",
    "toast.filledN":        (n) => `Filled ${n} section${n === 1 ? "" : "s"}.`,
    "toast.aiFailed":       "AI request failed.",
    "toast.languageSwitched": (loc) => loc === "fr" ? "Interface switched to French." : "Interface switched to English.",
    "toast.frenchDetected":   "French detected — interface switched. (Click EN/FR to override.)",
    "toast.englishDetected":  "English detected — interface switched. (Click EN/FR to override.)",
  },

  fr: {
    "app.title":            "Du poème au chant",
    "app.tagline":          "un atelier pour transformer un texte en forme chantable",
    "btn.examples":         "Exemples",
    "btn.theme":            "◐",
    "btn.lang":             "EN / FR",

    "source.heading":       "Source",
    "source.metaPaste":     "collez un poème, un fragment, un passage",
    "source.placeholder":   "Collez ici votre poème, fragment, monologue ou passage…",
    "source.clear":         "Effacer",
    "source.shape":         "Façonner →",
    "source.lines":         "vers",
    "source.words":         "mots",
    "source.chars":         "car.",

    "reading.heading":      "Lecture",
    "reading.awaiting":     "en attente de texte",
    "reading.empty":        "Le poème sera lu pour son ton, ses images récurrentes, ses vers chantables, et pour savoir s'il veut vraiment devenir une chanson. Collez quelque chose à gauche pour commencer.",
    "reading.tone":         "Ton dominant",
    "reading.tension":      "Tension centrale",
    "reading.images":       "Images récurrentes",
    "reading.refrain":      "Refrain naturel",
    "reading.titles":       "Titres possibles",
    "reading.singable":     "Vers chantables",
    "reading.linesPerAvg":  (n, w, s) => `${n} vers · moy. ${w} mots / ${s} syll.`,
    "reading.refrainNone":  "aucun encore — on pourrait en planter un",
    "reading.imagesNone":   "aucune image récurrente",
    "reading.singableOf":   (g, t) => `${g} sur ${t}`,

    "shape.heading":        "Forme",
    "shape.targetForm":     "Forme cible",
    "shape.songability":    "Chantabilité",
    "shape.resetDials":     "réinitialiser",
    "shape.reshape":        "Reformer avec ces réglages",

    "form.singer-songwriter": "auteur-compositeur",
    "form.folk-ballad":       "ballade folk",
    "form.indie-art-song":    "chanson d'auteur",
    "form.musical-theatre":   "théâtre musical",
    "form.pop-adjacent":      "proche de la pop",
    "form.spoken-refrain":    "spoken-word avec refrain",

    "dial.repetition":      "plus de répétition",
    "dial.clarity":         "plus de clarté",
    "dial.density":         "plus de densité poétique",
    "dial.conversational":  "plus conversationnel",
    "dial.melodic":         "plus de phrasé mélodique",
    "dial.shorter":         "vers plus courts",
    "dial.hook":            "accroche plus forte",

    "hooks.heading":        "Accroches possibles",
    "hooks.empty":          "Les accroches apparaîtront ici une fois le façonnage commencé.",
    "hooks.fromSource":     "dans le texte",
    "hooks.fabricated":     "inventée",
    "hooks.candidates":     (n) => `${n} proposition${n === 1 ? "" : "s"}`,
    "hooks.saveTitle":      "Enregistrer cette accroche",

    "directions.heading":   "Directions",
    "directions.subtitle":  "trois manières dont cela pourrait évoluer",
    "directions.empty":     "Trois directions apparaîtront ici : <em>minimale</em>, <em>équilibrée</em>, et <em>audacieuse</em>. Chacune dira ce qu'elle préserve, ce qu'elle adapte, et pourquoi.",

    "dir.minimal.full":     "Intervention minimale",
    "dir.minimal.short":    "Minimale",
    "dir.balanced.full":    "Adaptation équilibrée",
    "dir.balanced.short":   "Équilibrée",
    "dir.bold.full":        "Restructuration audacieuse",
    "dir.bold.short":       "Audacieuse",

    "dir.title":            "Titre possible",
    "dir.emotionalCore":    "Cœur émotionnel",
    "dir.adaptationNotes":  "Notes d'adaptation",

    "legend.original":      "vers original",
    "legend.adapted":       "légèrement adapté",
    "legend.heavy":         "fortement adapté",
    "legend.new":           "vers de liaison",
    "legend.repeat":        "reprise",

    "section.refineHint":   "raffiner →",
    "section.proposeShort": "✦",
    "section.proposeLong":  "✦ proposer",

    "footer.fillThin":      "✦ Compléter les sections faibles",
    "footer.save":          "★ Enregistrer",
    "footer.copyLyric":     "Copier comme paroles",
    "footer.copyMd":        "Exporter en markdown",
    "footer.copyHooks":     "Copier les accroches",

    "drawer.label":         "Enregistré",
    "drawer.favoriteHooks": "Accroches favorites",
    "drawer.savedVersions": "Versions enregistrées",
    "drawer.noHooks":       "Aucune accroche enregistrée.",
    "drawer.noVersions":    "Aucune version enregistrée.",
    "drawer.copy":          "copier",
    "drawer.remove":        "×",

    "modal.examples":       "Choisir un exemple",
    "modal.close":          "fermer",
    "modal.lineTools":      "Outils de vers",
    "modal.replaceSection": "Remplacer dans la section",
    "modal.propose":        "Proposer des alternatives",
    "modal.proposeSubtitle": "3 propositions de Claude, dans ta voix.",
    "modal.proposeFor":     (label) => `Alternatives — ${label}`,
    "modal.regenerate":     "↻ régénérer",
    "modal.replaceFull":    "Remplacer la section",
    "modal.proposeLoading": "Lecture du poème et écriture d'alternatives…",
    "modal.proposeFreshLoading": "Nouvelles alternatives en cours…",
    "modal.optionN":        (n) => `option ${n}`,

    "modal.proposeError.heading": "Impossible de joindre l'IA.",
    "modal.proposeError.body":    "Vérifiez que ANTHROPIC_API_KEY est défini comme variable d'environnement Netlify, puis redéployez. Si vous testez en local, utilisez netlify dev au lieu de python3 -m http.server.",

    "modal.tightLine":      "Ce vers est déjà serré. Rien à compresser sans le perdre.",

    "compress.shorter":     "plus court pour la mélodie",
    "compress.simpler":     "syntaxe plus simple",
    "compress.keepImage":   "garder l'image, couper les mots",
    "compress.singable":    "plus facile à chanter",
    "compress.rhythmic":    "plus rythmique",

    "toast.pasteFirst":     "Collez d'abord du texte.",
    "toast.hookSaved":      "Accroche enregistrée.",
    "toast.hookRemoved":    "Accroche retirée.",
    "toast.hookCopied":     "Accroche copiée.",
    "toast.copied":         "Copié.",
    "toast.copyFailed":     "Échec de la copie.",
    "toast.lyricCopied":    "Paroles copiées.",
    "toast.markdownCopied": "Markdown copié.",
    "toast.hooksCopied":    "Accroches copiées.",
    "toast.savedToDrawer":  "Enregistré dans le tiroir.",
    "toast.replacedSection": (label) => `${label} remplacé.`,
    "toast.replacedNTimes": (n) => `Remplacé à ${n} endroit${n === 1 ? "" : "s"}.`,
    "toast.lineNotFound":   "Vers introuvable.",
    "toast.noThinSections": "Aucune section faible — chaque slot a du contenu.",
    "toast.filledN":        (n) => `${n} section${n === 1 ? "" : "s"} complétée${n === 1 ? "" : "s"}.`,
    "toast.aiFailed":       "Échec de la requête IA.",
    "toast.languageSwitched": (loc) => loc === "fr" ? "Interface en français." : "Interface en anglais.",
    "toast.frenchDetected":   "Français détecté — interface adaptée. (Cliquez EN/FR pour basculer.)",
    "toast.englishDetected":  "Anglais détecté — interface adaptée. (Cliquez EN/FR pour basculer.)",
  }
};

// Markers for cheap source-language detection. We don't need anything
// fancy — looking for very-frequent function words gives a clear signal
// because both sets are large and almost disjoint.
const FRENCH_MARKERS = /\b(le|la|les|une|un|des|du|de|d'|et|que|qu'|dans|pour|avec|comme|mais|sur|tout|toute|toutes|tous|pas|je|tu|il|elle|nous|vous|ils|elles|au|aux|en|ne|si|où|qui|me|te|se|son|sa|ses|ce|cette|ces|c'est|j'ai|tu|nous|vous|toi|moi|eux|y|leur|leurs|m'|t'|s'|n'|j'|qu')\b/gi;
const ENGLISH_MARKERS = /\b(the|a|an|is|are|was|were|of|to|in|that|it|this|with|for|on|but|not|you|we|they|he|she|me|him|her|us|them|my|your|his|its|our|their|have|has|had|been|will|would|could|should)\b/gi;

// ─────────────────────────────────────────────────────────────────────────
// State + listeners
// ─────────────────────────────────────────────────────────────────────────

let _locale = "en";
const subs = new Set();
function emit() { subs.forEach(fn => { try { fn(_locale); } catch {} }); }

export function detectLocale() {
  try {
    const saved = localStorage.getItem("p2s.locale");
    if (saved === "en" || saved === "fr") return saved;
  } catch {}
  const nav = (navigator.language || "en").toLowerCase();
  if (nav.startsWith("fr")) return "fr";
  return "en";
}

export function setLocale(loc, { silent = false, persist = true } = {}) {
  if (loc !== "en" && loc !== "fr") loc = "en";
  if (loc === _locale) return _locale;
  _locale = loc;
  if (typeof document !== "undefined") {
    document.documentElement.lang = loc;
  }
  if (persist) {
    try { localStorage.setItem("p2s.locale", loc); } catch {}
  }
  if (!silent) emit();
  return _locale;
}

export function getLocale() { return _locale; }

export function subscribe(fn) {
  subs.add(fn);
  fn(_locale);
  return () => subs.delete(fn);
}

// Translate a key. If the entry is a function, returns the function (caller
// supplies args). Falls back to English if the key is missing in the active
// locale, then to the key itself if not found at all.
export function t(key, ...args) {
  const entry = (STRINGS[_locale] && STRINGS[_locale][key])
              ?? STRINGS.en[key]
              ?? key;
  if (typeof entry === "function") return entry(...args);
  return entry;
}

// Walk the DOM and substitute all data-i18n / data-i18n-placeholder /
// data-i18n-html attributes with the active locale's strings.
//
// data-i18n         — replaces textContent
// data-i18n-html    — replaces innerHTML (for strings that contain markup)
// data-i18n-placeholder — replaces the `placeholder` attribute
// data-i18n-title   — replaces the `title` attribute
export function applyI18n(root = document) {
  root.querySelectorAll("[data-i18n]").forEach(el => {
    const v = t(el.getAttribute("data-i18n"));
    if (typeof v === "string") el.textContent = v;
  });
  root.querySelectorAll("[data-i18n-html]").forEach(el => {
    const v = t(el.getAttribute("data-i18n-html"));
    if (typeof v === "string") el.innerHTML = v;
  });
  root.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const v = t(el.getAttribute("data-i18n-placeholder"));
    if (typeof v === "string") el.placeholder = v;
  });
  root.querySelectorAll("[data-i18n-title]").forEach(el => {
    const v = t(el.getAttribute("data-i18n-title"));
    if (typeof v === "string") el.title = v;
  });
}

// Detect language of a chunk of source text. Returns "en", "fr", or null
// if the text is too short / ambiguous.
export function detectTextLanguage(text) {
  if (!text || text.length < 20) return null;
  const fr = (text.match(FRENCH_MARKERS) || []).length;
  const en = (text.match(ENGLISH_MARKERS) || []).length;
  if (fr === 0 && en === 0) return null;
  if (Math.max(fr, en) < 2) return null;             // not enough signal
  if (fr === en) return null;
  return fr > en ? "fr" : "en";
}
