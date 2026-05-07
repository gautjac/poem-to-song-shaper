// forms.js
// Target song forms — each is a recipe describing how many sections of which
// type, and how the shaper should treat them (verse vs. hook-driven).
//
// Section labels in `blueprint` are kept in English as canonical keys; the
// language pack maps them to display labels (e.g. "Verse 1" → "Couplet 1").

import { LANG_EN } from "./lang-en.js";

const FORMS_BASE = {
  "singer-songwriter": {
    blueprint: ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"],
    name: { en: "singer-songwriter",   fr: "auteur-compositeur" },
    notes: {
      en: "Two verses around a returning chorus. Bridge is the emotional turn.",
      fr: "Deux couplets autour d'un refrain qui revient. Le pont est le tournant émotionnel."
    }
  },
  "folk-ballad": {
    blueprint: ["Verse 1", "Verse 2", "Chorus", "Verse 3", "Chorus", "Outro"],
    name: { en: "folk ballad",         fr: "ballade folk" },
    notes: {
      en: "More verse weight than chorus weight. Story carries the form.",
      fr: "Plus de poids dans les couplets que dans le refrain. C'est l'histoire qui porte la forme."
    }
  },
  "indie-art-song": {
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Outro"],
    name: { en: "indie art song",      fr: "chanson d'auteur" },
    notes: {
      en: "Loose structure, room for asymmetry. Outro can drift.",
      fr: "Structure souple, place à l'asymétrie. L'outro peut dériver."
    }
  },
  "musical-theatre": {
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Bridge", "Chorus (button)"],
    name: { en: "musical theatre",     fr: "théâtre musical" },
    notes: {
      en: "I-want song shape. The bridge is the decision; the final chorus lands.",
      fr: "Forme « I-want song ». Le pont est la décision ; le refrain final atterrit."
    }
  },
  "pop-adjacent": {
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Chorus"],
    name: { en: "pop-adjacent",        fr: "proche de la pop" },
    notes: {
      en: "Symmetrical, hook-forward. Pre-choruses build lift.",
      fr: "Symétrique, accroche en avant. Les pré-refrains construisent l'élan."
    }
  },
  "spoken-refrain": {
    blueprint: ["Verse 1 (spoken)", "Refrain", "Verse 2 (spoken)", "Refrain", "Verse 3 (spoken)", "Refrain"],
    name: { en: "spoken-word with refrain", fr: "spoken-word avec refrain" },
    notes: {
      en: "Verses are conversational and long. Refrain is the only sung anchor.",
      fr: "Les couplets sont conversationnels et longs. Le refrain est le seul ancrage chanté."
    }
  }
};

// Returns a form object localized for the given language pack.
// `blueprint` keeps the canonical English keys so the shaper's regex
// matchers ("chorus", "pre-?chorus", "refrain", "bridge", etc.) keep
// working language-agnostically. `displayLabels` is a parallel array of
// the localized labels used by the renderer.
export function getForm(id, lang = LANG_EN) {
  const base = FORMS_BASE[id] || FORMS_BASE["singer-songwriter"];
  const code = lang.code || "en";
  const labels = base.blueprint.map(label => lang.sectionLabels?.[label] || label);
  return {
    id: id || "singer-songwriter",
    blueprint:     base.blueprint,   // canonical English (used for matching)
    displayLabels: labels,           // localized (used for rendering)
    name:  base.name[code]  || base.name.en,
    notes: base.notes[code] || base.notes.en
  };
}

// Used by chips in the controls — returns [{id, name}] localized for `lang`.
export function listForms(lang = LANG_EN) {
  const code = lang.code || "en";
  return Object.entries(FORMS_BASE).map(([id, f]) => ({
    id,
    name: f.name[code] || f.name.en
  }));
}

// Backwards-compat default export of the raw blueprints (no localization).
export const FORMS = FORMS_BASE;
