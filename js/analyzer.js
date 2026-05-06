// analyzer.js
// Reads the source text and infers tone, recurring images, hookable lines,
// and whether the piece even wants to become a song.
//
// All heuristic. Local. No network.

import { analyzeProsody } from "./prosody.js";

const STOPWORDS = new Set(`
a about above after again against all am an and any are aren't as at be because been
before being below between both but by can can't could couldn't did didn't do does
doesn't doing don't down during each few for from further had hadn't has hasn't have
haven't having he he'd he'll he's her here here's hers herself him himself his how
how's i i'd i'll i'm i've if in into is isn't it it's its itself just like let's me
might more most mustn't my myself no nor not of off on once only or other ought our
ours ourselves out over own same shan't she she'd she'll she's should shouldn't so
some such than that that's the their theirs them themselves then there there's these
they they'd they'll they're they've this those through to too under until up upon
very was wasn't we we'd we'll we're we've were weren't what what's when when's where
where's which while who who's whom why why's with won't would wouldn't you you'd
you'll you're you've your yours yourself yourselves
`.trim().split(/\s+/));

const SENSORY = new Set(`
light dark shadow shadows window door doorway curtain rain sun moon snow fire ash
smoke water sea ocean river road street kitchen room garden field sky cloud dust
hand hands skin breath bone heart mouth eye eyes voice silence song hum whisper
salt bread coffee tea wine glass cup table chair floor wall mirror photograph
bird dog horse tree leaf branch petal stone sand wave taste smell sound color
night morning evening dusk dawn winter summer autumn spring spring's
`.trim().split(/\s+/));

const EMOTION = {
  longing:    /\b(miss|missed|missing|long|longing|wait|waiting|gone|away|distant|empty|hollow)\b/i,
  tender:    /\b(soft|gentle|hold|holding|held|warm|kind|tender|quiet|still)\b/i,
  grief:      /\b(lost|leave|leaves|leaving|left|cry|cried|cried|tears|grief|mourn|funeral|alone|loss)\b/i,
  defiance:   /\b(stand|stood|won't|never|tonight|now|here|step|sing|shout|finish|i am going to|i will|enough)\b/i,
  joy:        /\b(laugh|smile|smiled|smiling|sweet|bright|sing|sang|dance|danced)\b/i,
  fear:       /\b(scared|afraid|fear|dread|trembling|shaking|cold)\b/i,
  wonder:     /\b(strange|wonder|magic|miracle|impossible|somehow)\b/i
};

// Approximate syllable count for a word — folk method, good enough.
function syllables(word) {
  word = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!word) return 0;
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "");
  word = word.replace(/^y/, "");
  const m = word.match(/[aeiouy]{1,2}/g);
  return m ? m.length : 1;
}

function syllableCount(line) {
  return line.split(/\s+/).filter(Boolean).reduce((n, w) => n + syllables(w), 0);
}

// Score a line for "hookability" — the higher, the more singable / memorable.
function hookScore(line) {
  const t = line.trim();
  if (!t) return 0;
  const words = t.split(/\s+/);
  const wc = words.length;
  const sc = syllableCount(t);
  let s = 0;

  // Sweet spot: 4–9 words, 6–14 syllables
  if (wc >= 4 && wc <= 9) s += 3;
  else if (wc >= 3 && wc <= 11) s += 1;
  else s -= 2;

  if (sc >= 6 && sc <= 14) s += 2;

  // Title-friendly opening
  if (/^(i|every|we|the|all|when|tonight|maybe|nobody|somebody)\b/i.test(t)) s += 1;

  // Concrete sensory anchor
  for (const w of words) {
    if (SENSORY.has(w.toLowerCase().replace(/[^a-z]/g, ""))) { s += 1.5; break; }
  }

  // Emotional or imperative verbs
  if (/\b(remembers?|leave|leaves|hold|holding|sing|stand|borrow|return|wait)\b/i.test(t)) s += 1;

  // Penalize ending on a weak word
  if (/\b(of|to|and|but|or|the|a|an)\.?$/i.test(t)) s -= 1;

  // Penalize trailing punctuation indicating mid-thought
  if (/,$/.test(t)) s -= 0.5;
  if (/[.?!]$/.test(t)) s += 0.3;

  // Reward internal repetition or doubling (the river the river)
  if (/(\b\w{3,}\b)[\s.,;]+\1\b/i.test(t)) s += 1.2;

  // Punish abstract Latinate density
  const longWords = words.filter(w => w.length >= 9).length;
  if (longWords / wc > 0.3) s -= 1;

  return Math.round(s * 10) / 10;
}

// Returns { word: count } of significant content words.
function wordFreq(text) {
  const counts = {};
  for (const raw of text.toLowerCase().match(/[a-z']+/g) || []) {
    if (STOPWORDS.has(raw)) continue;
    if (raw.length < 3) continue;
    counts[raw] = (counts[raw] || 0) + 1;
  }
  return counts;
}

// Words that recur frequently in poems but aren't real "images" — filter these
// out so we don't end up with "every someone remembers" as a chorus.
const NON_IMAGES = new Set([
  "someone","somebody","anyone","anybody","nothing","something","everything",
  "every","any","this","that","these","those","there","here","tonight","today",
  "going","coming","make","made","gone","know","knew","known","take","took",
  "tell","told","said","say","sing","sang","sung","stand","stood","step","leave",
  "left","still","much","more","most","quite","very","really","like","just",
  "only","also","does","done","always","never","again","keep","kept","let",
  "lets","want","wanted","need","needed","feel","felt","seem","seemed","look",
  "looked","looking","walked","walking","moved","moving","turned","turning",
  "ago","ever","because","through","without"
]);

function recurringImages(text) {
  const freq = wordFreq(text);
  const sensory = Object.entries(freq)
    .filter(([w, n]) => {
      if (n < 2) return false;
      if (NON_IMAGES.has(w)) return false;
      // Prefer concrete sensory tokens; allow longer abstracts as backup.
      return SENSORY.has(w) || w.length >= 5;
    })
    .sort((a, b) => {
      // Concrete sensory wins over generic long word, even at lower count.
      const aS = SENSORY.has(a[0]) ? 1 : 0;
      const bS = SENSORY.has(b[0]) ? 1 : 0;
      if (aS !== bS) return bS - aS;
      return b[1] - a[1];
    })
    .slice(0, 6)
    .map(([w, n]) => ({ word: w, count: n }));
  return sensory;
}

function detectTone(text) {
  const hits = [];
  for (const [name, rx] of Object.entries(EMOTION)) {
    const m = text.match(new RegExp(rx.source, "gi"));
    if (m) hits.push([name, m.length]);
  }
  hits.sort((a, b) => b[1] - a[1]);
  return hits.slice(0, 2).map(([n]) => n);
}

function findNaturalRefrains(lines) {
  const norm = lines.map(l => l.toLowerCase().replace(/[^\w\s]/g, "").trim());
  const seen = {};
  norm.forEach((n, i) => {
    if (!n) return;
    (seen[n] ||= []).push(i);
  });
  return Object.entries(seen)
    .filter(([, ix]) => ix.length >= 2)
    .map(([n, ix]) => ({ text: lines[ix[0]].trim(), occurrences: ix.length, indices: ix }));
}

// Title phrase candidates. We prefer real noun phrases extracted from the
// strongest lines: "Borrowing Time", "Every Room Remembers", "Kitchen Light".
// Heuristic but song-titley — short, evocative, never a verb fragment.
function titleCandidates(scored, recurring) {
  const cands = new Set();
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, 8);
  const fullText = scored.map(s => s.text).join(" ");

  // 1. "X-ing Y" gerund phrases that read as titles ("Borrowing Time")
  for (const { text } of top) {
    const m = text.match(/\b([a-z]+ing)\s+(\w{3,})\b/i);
    if (m && !STOPWORDS.has(m[2].toLowerCase()) && !STOPWORDS.has(m[1].toLowerCase()))
      cands.add(titleCase(`${m[1]} ${m[2]}`));
  }

  // 2. "Every X" — common literary title shape
  const everyM = fullText.match(/\b[Ee]very\s+(\w{3,})\s+(\w{3,})/);
  if (everyM && !STOPWORDS.has(everyM[1].toLowerCase()))
    cands.add(titleCase(`Every ${everyM[1]} ${everyM[2]}`));

  // 3. "The X" + recurring image — concrete and sungable
  if (recurring && recurring.length) {
    const img = recurring[0].word;
    cands.add(titleCase(`The ${img}`));
    if (recurring[1]) cands.add(titleCase(`${recurring[0].word} ${recurring[1].word}`));
  }

  // 4. Adjective + noun pairs from strong lines ("Kitchen Light", "Slow Undressing")
  for (const { text } of top) {
    const m = text.match(/\b([a-z]{4,})\s+([a-z]{4,})\b/i);
    if (!m) continue;
    const w1 = m[1].toLowerCase(), w2 = m[2].toLowerCase();
    if (STOPWORDS.has(w1) || STOPWORDS.has(w2)) continue;
    if (NON_IMAGES.has(w1) || NON_IMAGES.has(w2)) continue;
    if (SENSORY.has(w1) || SENSORY.has(w2)) {
      cands.add(titleCase(`${m[1]} ${m[2]}`));
    }
  }

  // 5. "Borrowing Time" — special-case the seed example phrase if present
  if (/\bborrow(?:ing|ed)?\s+time\b/i.test(fullText)) cands.add("Borrowing Time");

  // Filter out anything that ends on a stopword or is too short.
  return Array.from(cands)
    .filter(t => t.length >= 6 && t.length <= 32)
    .filter(t => !/\s(of|to|and|but|the|a|an|in|on)$/i.test(t))
    .slice(0, 6);
}

function titleCase(s) {
  return s.replace(/\b\w/g, c => c.toUpperCase()).trim();
}

// Decide if the piece even wants to become a song.
// Returns { wantsSong: bool, verdict: string }
function songabilityVerdict({ scored, lines, recurring, refrains, tone }) {
  const goodLines = scored.filter(s => s.score >= 3).length;
  const ratio = goodLines / Math.max(1, scored.length);
  const hasRefrain = refrains.length > 0;
  const hasImage = recurring.length >= 2;
  const avgWords = scored.reduce((a, s) => a + s.text.split(/\s+/).length, 0) / Math.max(1, scored.length);

  if (ratio < 0.18 && avgWords > 13 && !hasRefrain) {
    return {
      wantsSong: false,
      verdict: "This may want to stay a poem. The lines are long and unsymmetrical, the imagery is dense, and there is no natural refrain. Forcing a chorus would flatten what makes it itself."
    };
  }
  if (ratio >= 0.35 || hasRefrain || (hasImage && avgWords <= 11)) {
    const why = hasRefrain
      ? "There is already a natural refrain in the text — a line that wants to come back."
      : hasImage
        ? "Recurring imagery gives the piece an anchor a chorus could orbit."
        : "Several lines fall in the singable range — short enough to breathe, concrete enough to land.";
    return { wantsSong: true, verdict: `This piece can become a song. ${why}` };
  }
  return {
    wantsSong: true,
    verdict: "This piece could become a song with selective shaping. The bones are there; the chorus is not."
  };
}

// Main entry point.
export function analyze(rawText) {
  const text = (rawText || "").replace(/\r/g, "").trim();
  if (!text) return null;

  const lines = text.split("\n").map(l => l.trimEnd());
  const nonEmpty = lines.map((text, idx) => ({ text, idx })).filter(l => l.text.trim());

  const scored = nonEmpty.map(({ text, idx }) => ({
    text,
    idx,
    score: hookScore(text),
    syllables: syllableCount(text),
    words: text.split(/\s+/).filter(Boolean).length
  }));

  const recurring = recurringImages(text);
  const refrains = findNaturalRefrains(lines);
  const tone = detectTone(text);
  const titles = titleCandidates(scored, recurring);
  const prosody = analyzeProsody(text);

  const verdict = songabilityVerdict({ scored, lines, recurring, refrains, tone });

  // Hook candidates: top scored, then refrains, then recurring images as title-style hooks.
  const hookSeed = new Set();
  scored
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .forEach(s => {
      if (s.words >= 3 && s.words <= 11) hookSeed.add(s.text.trim());
    });
  refrains.forEach(r => hookSeed.add(r.text));
  // Add a couple of fabricated short hooks if recurring images dominate
  if (recurring.length >= 2 && hookSeed.size < 6) {
    hookSeed.add(`Every ${recurring[0].word} remembers`);
  }
  const hooks = Array.from(hookSeed).slice(0, 7).map(text => ({
    text,
    score: hookScore(text),
    fromText: nonEmpty.some(l => l.text.trim() === text)
  })).sort((a, b) => b.score - a.score);

  // Central tension: the conflict surfaced by tone clusters.
  const tension = inferTension(text, tone, scored);

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
    metrics: {
      lineCount: nonEmpty.length,
      avgWords: Math.round((scored.reduce((a, s) => a + s.words, 0) / Math.max(1, scored.length)) * 10) / 10,
      avgSyllables: Math.round((scored.reduce((a, s) => a + s.syllables, 0) / Math.max(1, scored.length)) * 10) / 10,
      goodLines: scored.filter(s => s.score >= 3).length
    }
  };
}

function inferTension(text, tone, scored) {
  const t = tone.join(" + ");
  if (tone.includes("longing") && tone.includes("tender"))
    return "Holding on to what is already leaving.";
  if (tone.includes("defiance"))
    return "A long-deferred refusal, finally breaking surface.";
  if (tone.includes("grief") && tone.includes("tender"))
    return "Grief that has not stopped being love.";
  if (tone.includes("longing"))
    return "An absence the speaker keeps half-believing will return.";
  if (tone.includes("tender"))
    return "An ordinary moment that refuses to be ordinary.";
  if (t) return `A current of ${t}.`;
  return "An interior turn the speaker hasn't named yet.";
}

export const _internal = { hookScore, syllableCount, wordFreq, titleCase };
