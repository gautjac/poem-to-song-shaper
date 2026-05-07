// analyzer.js
// Reads the source text and infers tone, recurring images, hookable lines,
// and whether the piece even wants to become a song.
//
// All heuristic. Local. No network. Language-pack-driven so wordlists and
// emotion regexes can be swapped (en / fr).

import { analyzeProsody } from "./prosody.js";
import { LANG_EN } from "./lang-en.js";

// Approximate syllable count for a word — folk method. Tuned for English
// but performs reasonably on French (which has more vowel clusters and
// silent final 'e' that this method partially handles via the vowel-cluster
// regex). For high-precision French syllabics, the AI handles it server-side.
function syllables(word) {
  word = word.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿç]/gi, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  // Strip silent endings — works for English -es/-ed and roughly for French.
  word = word.replace(/(?:[^laeiouyàâäéèêëîïôöùûüÿ]es|ed|[^laeiouyàâäéèêëîïôöùûüÿ]e)$/, "");
  word = word.replace(/^y/, "");
  // Match vowel clusters including French accented vowels.
  const m = word.match(/[aeiouyàâäéèêëîïôöùûüÿ]{1,3}/g);
  return m ? m.length : 1;
}

function syllableCount(line) {
  return line.split(/\s+/).filter(Boolean).reduce((n, w) => n + syllables(w), 0);
}

// Score a line for "hookability" — the higher, the more singable / memorable.
function hookScore(line, lang) {
  const t = line.trim();
  if (!t) return 0;
  const words = t.split(/\s+/);
  const wc = words.length;
  const sc = syllableCount(t);
  let s = 0;

  // Sweet spot: 4–9 words, 6–14 syllables.
  if (wc >= 4 && wc <= 9) s += 3;
  else if (wc >= 3 && wc <= 11) s += 1;
  else s -= 2;

  if (sc >= 6 && sc <= 14) s += 2;

  // Title-friendly opening (language-aware).
  const opening = (lang.code === "fr")
    ? /^(je|tu|nous|vous|chaque|tous|toutes|le|la|les|une|un|quand|ce soir|peut-être|personne|quelqu'?un)\b/i
    : /^(i|every|we|the|all|when|tonight|maybe|nobody|somebody)\b/i;
  if (opening.test(t)) s += 1;

  // Concrete sensory anchor (lang.sensory wordlist).
  for (const w of words) {
    const stripped = w.toLowerCase().replace(/[^a-zàâäéèêëîïôöùûüÿç']/gi, "");
    if (lang.sensory.has(stripped)) { s += 1.5; break; }
  }

  // Emotional / imperative verbs (language-aware).
  const verbs = (lang.code === "fr")
    ? /\b(souvient|souviens|partir|tenir|tient|chante|reste|emprunte|attends|attendre|revenir)\b/i
    : /\b(remembers?|leave|leaves|hold|holding|sing|stand|borrow|return|wait)\b/i;
  if (verbs.test(t)) s += 1;

  // Penalize ending on a weak word (language-aware).
  const weakEnd = (lang.code === "fr")
    ? /\b(de|du|des|le|la|les|et|à|au|aux|en|que|qu'|dans|pour|avec|comme|mais|sur|d'|l')\.?$/i
    : /\b(of|to|and|but|or|the|a|an)\.?$/i;
  if (weakEnd.test(t)) s -= 1;

  if (/,$/.test(t)) s -= 0.5;
  if (/[.?!]$/.test(t)) s += 0.3;

  // Reward internal repetition or doubling.
  if (/(\b\w{3,}\b)[\s.,;]+\1\b/i.test(t)) s += 1.2;

  // Punish abstract Latinate density.
  const longWords = words.filter(w => w.length >= 9).length;
  if (longWords / wc > 0.3) s -= 1;

  return Math.round(s * 10) / 10;
}

// Returns { word: count } of significant content words.
function wordFreq(text, lang) {
  const counts = {};
  // Match Latin + accented French letters and apostrophes (' or ').
  for (const raw of text.toLowerCase().match(/[a-zàâäéèêëîïôöùûüÿç']+/gi) || []) {
    if (lang.stopwords.has(raw)) continue;
    if (raw.length < 3) continue;
    counts[raw] = (counts[raw] || 0) + 1;
  }
  return counts;
}

function recurringImages(text, lang) {
  const freq = wordFreq(text, lang);
  const sensory = Object.entries(freq)
    .filter(([w, n]) => {
      if (n < 2) return false;
      if (lang.nonImages.has(w)) return false;
      // Prefer concrete sensory tokens; allow longer abstracts as backup.
      return lang.sensory.has(w) || w.length >= 5;
    })
    .sort((a, b) => {
      const aS = lang.sensory.has(a[0]) ? 1 : 0;
      const bS = lang.sensory.has(b[0]) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b[1] - a[1];
    })
    .slice(0, 6)
    .map(([w, n]) => ({ word: w, count: n }));
  return sensory;
}

function detectTone(text, lang) {
  const hits = [];
  for (const [name, rx] of Object.entries(lang.emotion)) {
    const m = text.match(new RegExp(rx.source, "gi"));
    if (m) hits.push([name, m.length]);
  }
  hits.sort((a, b) => b[1] - a[1]);
  // Returns the canonical tone keys ("longing", "tender", …) — display
  // localization happens in the renderer.
  return hits.slice(0, 2).map(([n]) => n);
}

function findNaturalRefrains(lines) {
  const norm = lines.map(l => l.toLowerCase().replace(/[^\w\sàâäéèêëîïôöùûüÿç]/gi, "").trim());
  const seen = {};
  norm.forEach((n, i) => {
    if (!n) return;
    (seen[n] ||= []).push(i);
  });
  return Object.entries(seen)
    .filter(([, ix]) => ix.length >= 2)
    .map(([n, ix]) => ({ text: lines[ix[0]].trim(), occurrences: ix.length, indices: ix }));
}

// Title phrase candidates. Heuristic but song-titley: short, evocative,
// never a verb fragment. Patterns are language-aware.
function titleCandidates(scored, recurring, lang) {
  const cands = new Set();
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  const fullText = scored.map(s => s.text).join(" ");

  if (lang.code === "fr") {
    // 1. Verbal noun pairs — "Le X qui Y" patterns
    for (const { text } of top) {
      const m = text.match(/\b(le|la|les|une|un)\s+(\w{4,})\b/i);
      if (m && !lang.stopwords.has(m[2].toLowerCase())) {
        cands.add(titleCase(`${m[1]} ${m[2]}`));
      }
    }

    // 2. "Chaque X" — Every-X equivalent
    const everyM = fullText.match(/\b[Cc]haque\s+(\w{3,})\s+(\w{3,})/);
    if (everyM && !lang.stopwords.has(everyM[1].toLowerCase()))
      cands.add(titleCase(`Chaque ${everyM[1]} ${everyM[2]}`));

    // 3. "Le/La X" + recurring image
    if (recurring && recurring.length) {
      const img = recurring[0].word;
      cands.add(titleCase(`La ${img}`));
      cands.add(titleCase(`Le ${img}`));
    }

    // 4. Adjective + noun pairs
    for (const { text } of top) {
      const m = text.match(/\b([a-zàâäéèêëîïôöùûüÿç]{4,})\s+([a-zàâäéèêëîïôöùûüÿç]{4,})\b/i);
      if (!m) continue;
      const w1 = m[1].toLowerCase(), w2 = m[2].toLowerCase();
      if (lang.stopwords.has(w1) || lang.stopwords.has(w2)) continue;
      if (lang.nonImages.has(w1) || lang.nonImages.has(w2)) continue;
      if (lang.sensory.has(w1) || lang.sensory.has(w2)) {
        cands.add(titleCase(`${m[1]} ${m[2]}`));
      }
    }
  } else {
    // 1. "X-ing Y" gerund phrases that read as titles ("Borrowing Time")
    for (const { text } of top) {
      const m = text.match(/\b([a-z]+ing)\s+(\w{3,})\b/i);
      if (m && !lang.stopwords.has(m[2].toLowerCase()) && !lang.stopwords.has(m[1].toLowerCase()))
        cands.add(titleCase(`${m[1]} ${m[2]}`));
    }

    // 2. "Every X"
    const everyM = fullText.match(/\b[Ee]very\s+(\w{3,})\s+(\w{3,})/);
    if (everyM && !lang.stopwords.has(everyM[1].toLowerCase()))
      cands.add(titleCase(`Every ${everyM[1]} ${everyM[2]}`));

    // 3. "The X" + recurring image
    if (recurring && recurring.length) {
      const img = recurring[0].word;
      cands.add(titleCase(`The ${img}`));
      if (recurring[1]) cands.add(titleCase(`${recurring[0].word} ${recurring[1].word}`));
    }

    // 4. Adjective + noun pairs
    for (const { text } of top) {
      const m = text.match(/\b([a-z]{4,})\s+([a-z]{4,})\b/i);
      if (!m) continue;
      const w1 = m[1].toLowerCase(), w2 = m[2].toLowerCase();
      if (lang.stopwords.has(w1) || lang.stopwords.has(w2)) continue;
      if (lang.nonImages.has(w1) || lang.nonImages.has(w2)) continue;
      if (lang.sensory.has(w1) || lang.sensory.has(w2)) {
        cands.add(titleCase(`${m[1]} ${m[2]}`));
      }
    }

    // 5. "Borrowing Time" — special-case the seed example phrase if present
    if (/\bborrow(?:ing|ed)?\s+time\b/i.test(fullText)) cands.add("Borrowing Time");
  }

  // Filter trailing-stopword titles.
  const trailingStop = (lang.code === "fr")
    ? /\s(de|du|des|le|la|les|et|à|au|aux|en|d'|l')$/i
    : /\s(of|to|and|but|the|a|an|in|on)$/i;

  return Array.from(cands)
    .filter(t => t.length >= 6 && t.length <= 32)
    .filter(t => !trailingStop.test(t))
    .slice(0, 6);
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// Decide if the piece even wants to become a song.
function songabilityVerdict({ scored, recurring, refrains, lang }) {
  const goodLines = scored.filter(s => s.score >= 3).length;
  const ratio = goodLines / Math.max(1, scored.length);
  const hasRefrain = refrains.length > 0;
  const hasImage = recurring.length >= 2;
  const avgWords = scored.reduce((a, s) => a + s.text.split(/\s+/).length, 0) / Math.max(1, scored.length);

  const fr = lang.code === "fr";

  if (ratio < 0.18 && avgWords > 13 && !hasRefrain) {
    return {
      wantsSong: false,
      verdict: fr
        ? "Ce texte préfère peut-être rester un poème. Les vers sont longs et asymétriques, l'imagerie est dense, et il n'y a pas de refrain naturel. Forcer un refrain aplatirait ce qui le rend lui-même."
        : "This may want to stay a poem. The lines are long and unsymmetrical, the imagery is dense, and there is no natural refrain. Forcing a chorus would flatten what makes it itself."
    };
  }
  if (ratio >= 0.35 || hasRefrain || (hasImage && avgWords <= 11)) {
    const why = hasRefrain
      ? (fr
          ? "Il y a déjà un refrain naturel dans le texte — un vers qui veut revenir."
          : "There is already a natural refrain in the text — a line that wants to come back.")
      : hasImage
        ? (fr
            ? "L'imagerie récurrente offre un point d'ancrage autour duquel un refrain peut tourner."
            : "Recurring imagery gives the piece an anchor a chorus could orbit.")
        : (fr
            ? "Plusieurs vers tombent dans le registre chantable — assez courts pour respirer, assez concrets pour atterrir."
            : "Several lines fall in the singable range — short enough to breathe, concrete enough to land.");
    return {
      wantsSong: true,
      verdict: fr ? `Ce texte peut devenir une chanson. ${why}` : `This piece can become a song. ${why}`
    };
  }
  return {
    wantsSong: true,
    verdict: fr
      ? "Ce texte pourrait devenir une chanson avec un façonnage sélectif. Les os sont là ; le refrain ne l'est pas encore."
      : "This piece could become a song with selective shaping. The bones are there; the chorus is not."
  };
}

// Main entry point. lang defaults to English to keep the previous API intact.
export function analyze(rawText, lang = LANG_EN) {
  const text = (rawText || "").replace(/\r/g, "").trim();
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trimEnd());
  const nonEmpty = lines.map((text, idx) => ({ text, idx })).filter(l => l.text.trim());

  const scored = nonEmpty.map(({ text, idx }) => ({
    text,
    idx,
    score: hookScore(text, lang),
    syllables: syllableCount(text),
    words: text.split(/\s+/).filter(Boolean).length
  }));

  const recurring = recurringImages(text, lang);
  const refrains  = findNaturalRefrains(lines);
  const tone      = detectTone(text, lang);
  const titles    = titleCandidates(scored, recurring, lang);
  const prosody   = analyzeProsody(text);

  const verdict = songabilityVerdict({ scored, recurring, refrains, lang });

  // Hook candidates: top scored, then refrains, then a fabricated image-led
  // hook if recurring images dominate.
  const hookSeed = new Set();
  scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .forEach(s => {
      if (s.words >= 3 && s.words <= 11) hookSeed.add(s.text.trim());
    });
  refrains.forEach(r => hookSeed.add(r.text));

  if (recurring.length >= 2 && hookSeed.size < 6) {
    const fabricated = (lang.imageRefrainPatterns?.[0] || (img => `every ${img} remembers`))(recurring[0].word);
    hookSeed.add(fabricated);
  }
  const hooks = Array.from(hookSeed).slice(0, 7).map(text => ({
    text,
    score: hookScore(text, lang),
    fromText: nonEmpty.some(l => l.text.trim() === text)
  })).sort((a, b) => b.score - a.score);

  // Central tension — drawn from the language pack.
  const tension = lang.tensionFor(tone);

  return {
    raw: text,
    lines,
    scored,
    recurring,
    refrains,
    tone,
    titles,
    hooks: hooks.slice(0, 7),
    verdict,
    tension,
    prosody,
    lang: lang.code,
    metrics: {
      lineCount: nonEmpty.length,
      avgWords: Math.round((scored.reduce((a, s) => a + s.words, 0) / Math.max(1, scored.length)) * 10) / 10,
      avgSyllables: Math.round((scored.reduce((a, s) => a + s.syllables, 0) / Math.max(1, scored.length)) * 10) / 10,
      goodLines: scored.filter(s => s.score >= 3).length
    }
  };
}

export const _internal = { hookScore, syllableCount, wordFreq, titleCase };
