// compressor.js
// Line-level transformations. Heuristic, deterministic. Each variant is
// labeled so the user understands the trade.

const FILLERS = new Set([
  "very","really","quite","just","actually","somehow","always","sometimes",
  "perhaps","maybe","slightly","rather","kind","sort","of","that","which"
]);

const ARTICLES = new Set(["a","an","the"]);

const ELEVATED_TO_PLAIN = {
  "myriad": "many",
  "luminous": "bright",
  "ephemeral": "passing",
  "perpetual": "always",
  "amongst": "among",
  "ascend": "rise",
  "descend": "fall",
  "diminish": "fade",
  "depart": "leave",
  "remain": "stay",
  "whilst": "while",
  "shall": "will",
  "eternal": "forever",
  "tremble": "shake",
  "reside": "live",
  "behold": "see",
  "weep": "cry",
  "yonder": "there"
};

function tokens(line) {
  // keep punctuation attached to words for re-assembly
  return line.match(/[\w']+|[.,;:!?—–-]/g) || [];
}

function detok(toks) {
  return toks
    .filter(Boolean)
    .reduce((acc, t, i) => {
      if (i === 0) return t;
      if (/^[.,;:!?—–-]$/.test(t)) return acc + t;
      return acc + " " + t;
    }, "")
    .replace(/\s+/g, " ")
    .trim();
}

// 1. Shorter for melody — drops fillers, articles, and one trailing modifier.
function shorter(line) {
  const toks = tokens(line);
  const out = [];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    const lw = w.toLowerCase();
    if (FILLERS.has(lw)) continue;
    if (ARTICLES.has(lw) && i !== 0) continue;
    out.push(w);
  }
  let s = detok(out);
  // squeeze "is/was {-ing}" → "{-ing}"
  s = s.replace(/\b(is|was|are|were)\s+(\w+ing)\b/gi, "$2");
  return capFirst(s);
}

// 2. Simpler syntax — flips "X, the Y of Z" → "X is Y", removes inversions.
function simpler(line) {
  let s = line;
  // "doing its slow undressing" → "slowly undressing"
  s = s.replace(/\bdoing its (slow|quick|quiet|long|brief)\s+(\w+ing)\b/i,
                (_, adj, verb) => `${adj}ly ${verb}`);
  // strip parenthetical asides
  s = s.replace(/\s*[—–-]\s*[^—–-]+$/, "");
  // turn "I have learned" → "I learned"
  s = s.replace(/\bI have (\w+ed|\w+t|\w+n)\b/gi, "I $1");
  s = s.replace(/\bI am going to\b/gi, "I will");
  return capFirst(s.trim());
}

// 3. Keep image, cut words — preserve concrete nouns/verbs, drop scaffolding.
// Falls back to "shorter" if the result would be a fragment of < 4 words.
function keepImage(line) {
  const toks = tokens(line);
  const content = toks.filter(t => /^[\w']+$/.test(t) && t.length >= 4
    && !FILLERS.has(t.toLowerCase()) && !ARTICLES.has(t.toLowerCase()));
  if (content.length <= 3) return shorter(line);
  // Keep ~60% of content words, but always at least 4.
  const target = Math.max(4, Math.ceil(content.length * 0.6));
  const keep = new Set(content.slice(0, target));
  const out = [];
  for (const t of toks) {
    if (/^[\w']+$/.test(t)) {
      if (keep.has(t)) out.push(t);
    }
  }
  // Reject if too short — the image got lost, not preserved.
  if (out.length < 4) return shorter(line);
  return capFirst(detok(out));
}

// 4. Easier to sing — replace elevated diction, smooth consonant clusters lightly.
function singable(line) {
  let s = line;
  for (const [hi, lo] of Object.entries(ELEVATED_TO_PLAIN)) {
    s = s.replace(new RegExp(`\\b${hi}\\b`, "gi"), lo);
  }
  // Soften "n't" contractions retained for melody, keep "I'm"/"don't"
  // Drop semicolons (hard to sing past)
  s = s.replace(/;\s*/g, ", ");
  return capFirst(s);
}

// 5. More rhythmic — encourage iambic-ish by trimming odd-length stretches.
function rhythmic(line) {
  // crude: target 8 syllables ± 1 by trimming from the right
  const target = 8;
  const words = line.split(/\s+/);
  const sylsPer = words.map(w => approxSyllables(w));
  let total = sylsPer.reduce((a, b) => a + b, 0);
  const out = words.slice();
  while (total > target + 1 && out.length > 3) {
    // drop a low-content word from the middle/end
    const idx = findDroppable(out);
    if (idx === -1) break;
    total -= sylsPer[idx];
    out.splice(idx, 1);
    sylsPer.splice(idx, 1);
  }
  return capFirst(out.join(" ").replace(/\s+([.,;:!?])/g, "$1"));
}

function approxSyllables(w) {
  w = w.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  const m = w.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

function findDroppable(words) {
  for (let i = words.length - 1; i >= 0; i--) {
    const lw = words[i].toLowerCase().replace(/[^a-z']/g, "");
    if (FILLERS.has(lw) || ARTICLES.has(lw)) return i;
  }
  return -1;
}

function capFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function variantsFor(line) {
  const original = line.trim();
  const out = [
    { label: "shorter for melody",    text: shorter(original) },
    { label: "simpler syntax",        text: simpler(original) },
    { label: "keep image, cut words", text: keepImage(original) },
    { label: "easier to sing",        text: singable(original) },
    { label: "more rhythmic",         text: rhythmic(original) }
  ];
  // Filter out variants identical to the original
  return out.filter(v => v.text && v.text.toLowerCase().trim() !== original.toLowerCase().trim());
}

// Single-shot compression used by the shaper for "shorter lines" dial.
export function compressLine(line, mode = "shorter") {
  switch (mode) {
    case "simpler":   return simpler(line);
    case "keep":      return keepImage(line);
    case "singable":  return singable(line);
    case "rhythmic":  return rhythmic(line);
    default:          return shorter(line);
  }
}

export function classifyChange(original, transformed) {
  const a = original.trim().toLowerCase();
  const b = transformed.trim().toLowerCase();
  if (a === b) return "original";
  // word-overlap ratio
  const ta = new Set(a.split(/\s+/));
  const tb = new Set(b.split(/\s+/));
  let overlap = 0;
  for (const w of tb) if (ta.has(w)) overlap++;
  const ratio = overlap / Math.max(1, tb.size);
  if (ratio >= 0.85) return "adapted";
  if (ratio >= 0.45) return "heavy";
  return "new";
}
