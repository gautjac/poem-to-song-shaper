// prompts.js
// Prompt templates for each transformation. The local mock engine doesn't
// call these — it implements the same transforms with heuristics. They live
// here so swapping in a real LLM later is a one-function change.
//
// Each builder takes structured inputs and returns a string. The intended
// output is JSON conforming to the schema in the README.

const VOICE_RULES = `
You are shaping text into song. Follow these rules without exception:
- Preserve the writer's voice. Do not sterilize unusual phrasing.
- Do not impose neat commercial symmetry.
- Repetition must feel earned, never decorative.
- Hooks may emerge from image, rhythm, contradiction, or emotional statement —
  not from generic pop language.
- Keep ambiguity when it is artistically valuable.
- Prefer selective shaping over total rewriting.
- Do not use the words heart, fire, broken, forever, soul, free, fly, alive,
  or burn unless they already appear in the source.
- If the piece does not want to be a song, say so honestly.
`.trim();

export function analysisPrompt({ source }) {
  return `${VOICE_RULES}

TASK — analyze the following text and return JSON with these keys:
  emotional_tone: 1–3 short phrases
  recurring_images: array of objects { image, occurrences }
  central_tension: one sentence
  natural_refrains: array of lines that already repeat or want to
  singable_lines: lines that already scan well
  unsingable_lines: lines beautiful on the page but hard to sing
  wants_to_be_song: boolean
  verdict: one paragraph explaining the songability assessment

TEXT:
${fenced(source)}

Return JSON only.`;
}

export function hookExtractionPrompt({ source, n = 5 }) {
  return `${VOICE_RULES}

TASK — propose ${n} hook candidates from the text below. Each hook should be
3 to 11 words, memorable, concrete, and grounded in the writer's actual voice.
Prefer lines that already exist in the source over invented lines. If you
fabricate, make it clear in the rationale.

Return JSON: array of { text, source: "verbatim" | "lightly adapted" | "invented", rationale }.

TEXT:
${fenced(source)}`;
}

export function structureProposalPrompt({ source, analysis, form, dials, direction }) {
  const dialList = (dials && dials.length) ? dials.join(", ") : "none";
  return `${VOICE_RULES}

TASK — produce one shaping direction at the "${direction}" level of
intervention.
  - "Minimal intervention": preserve cadence; introduce only a soft refrain.
  - "Balanced adaptation": reorder into the target form, compress long lines,
    build a true returning chorus, but keep the speaker's voice.
  - "Bold restructuring": treat the poem as a quarry. Pull the strongest
    images forward, invent a chorus around the dominant figure, cut what
    doesn't serve the gravity.

Target form: ${form}
Active songability dials: ${dialList}

For each line in your output, mark its source_status as one of:
  "original"  — kept verbatim from the source
  "adapted"   — same content, lightly tightened
  "heavy"     — image preserved but heavily reworked
  "new"       — invented connective line
  "repeat"    — a repetition of an earlier line in this version

Return JSON conforming to:
{
  "direction": "${direction}",
  "rationale": string,
  "emotional_core": string,
  "possible_title": string,
  "hook_candidates": [string, ...],
  "preserve_verbatim": [string, ...],
  "adaptation_notes": [string, ...],
  "sections": [{ "label": string, "lines": [{ "text": string, "source_status": string }] }]
}

ANALYSIS:
${fenced(JSON.stringify(analysis, null, 2))}

TEXT:
${fenced(source)}`;
}

export function lineCompressionPrompt({ line, mode }) {
  return `${VOICE_RULES}

TASK — produce a single compressed variant of the line below in the mode
"${mode}". Preserve the strongest image. Do not generic-ify. Return only the
new line as plain text.

Modes:
  shorter        — fewer words, same shape
  simpler        — straightforward syntax, no inversions
  keep-image     — preserve the central image, cut scaffolding
  singable       — easier on the mouth, no consonant clusters
  rhythmic       — cleaner stress pattern, around 8 syllables

LINE:
${fenced(line)}`;
}

export function sectionRewritePrompt({ section, voice, dials }) {
  const dialList = (dials && dials.length) ? dials.join(", ") : "none";
  return `${VOICE_RULES}

TASK — rewrite the section below while honoring the writer's voice notes:
${fenced(voice || "(none provided)")}

Active dials: ${dialList}

SECTION:
${fenced(JSON.stringify(section, null, 2))}

Return JSON: { "label": string, "lines": [{ "text": string, "source_status": string }] }.`;
}

function fenced(text) {
  return "```\n" + (text || "") + "\n```";
}

export const TEMPLATES = {
  analysis: analysisPrompt,
  hooks:    hookExtractionPrompt,
  structure: structureProposalPrompt,
  compress:  lineCompressionPrompt,
  section:   sectionRewritePrompt
};
