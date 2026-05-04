// forms.js
// Target song forms — each is a recipe describing how many sections of which
// type, and how the shaper should treat them (verse vs. hook-driven).

export const FORMS = {
  "singer-songwriter": {
    name: "singer-songwriter",
    blueprint: ["Verse 1", "Chorus", "Verse 2", "Chorus", "Bridge", "Chorus"],
    notes: "Two verses around a returning chorus. Bridge is the emotional turn."
  },
  "folk-ballad": {
    name: "folk ballad",
    blueprint: ["Verse 1", "Verse 2", "Chorus", "Verse 3", "Chorus", "Outro"],
    notes: "More verse weight than chorus weight. Story carries the form."
  },
  "indie-art-song": {
    name: "indie art song",
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Outro"],
    notes: "Loose structure, room for asymmetry. Outro can drift."
  },
  "musical-theatre": {
    name: "musical theatre",
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Bridge", "Chorus (button)"],
    notes: "I-want song shape. The bridge is the decision; the final chorus lands."
  },
  "pop-adjacent": {
    name: "pop-adjacent",
    blueprint: ["Verse 1", "Pre-Chorus", "Chorus", "Verse 2", "Pre-Chorus", "Chorus", "Bridge", "Chorus"],
    notes: "Symmetrical, hook-forward. Pre-choruses build lift."
  },
  "spoken-refrain": {
    name: "spoken-word with refrain",
    blueprint: ["Verse 1 (spoken)", "Refrain", "Verse 2 (spoken)", "Refrain", "Verse 3 (spoken)", "Refrain"],
    notes: "Verses are conversational and long. Refrain is the only sung anchor."
  }
};

export function getForm(id) {
  return FORMS[id] || FORMS["singer-songwriter"];
}
