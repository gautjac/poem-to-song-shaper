// lang-en.js — English language pack used by the heuristic engine.
// All previously-hardcoded English wordlists live here so the engine can
// be parameterized by language.

export const LANG_EN = {
  code: "en",

  stopwords: new Set(`
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
`.trim().split(/\s+/)),

  sensory: new Set(`
light dark shadow shadows window door doorway curtain rain sun moon snow fire ash
smoke water sea ocean river road street kitchen room garden field sky cloud dust
hand hands skin breath bone heart mouth eye eyes voice silence song hum whisper
salt bread coffee tea wine glass cup table chair floor wall mirror photograph
bird dog horse tree leaf branch petal stone sand wave taste smell sound color
night morning evening dusk dawn winter summer autumn spring spring's
`.trim().split(/\s+/)),

  emotion: {
    longing:  /\b(miss|missed|missing|long|longing|wait|waiting|gone|away|distant|empty|hollow)\b/i,
    tender:   /\b(soft|gentle|hold|holding|held|warm|kind|tender|quiet|still)\b/i,
    grief:    /\b(lost|leave|leaves|leaving|left|cry|cried|tears|grief|mourn|funeral|alone|loss)\b/i,
    defiance: /\b(stand|stood|won't|never|tonight|now|here|step|sing|shout|finish|i am going to|i will|enough)\b/i,
    joy:      /\b(laugh|smile|smiled|smiling|sweet|bright|sing|sang|dance|danced)\b/i,
    fear:     /\b(scared|afraid|fear|dread|trembling|shaking|cold)\b/i,
    wonder:   /\b(strange|wonder|magic|miracle|impossible|somehow)\b/i
  },

  // Tone names used for human-readable display (analyzer joins these).
  toneNames: {
    longing:  "longing",
    tender:   "tender",
    grief:    "grief",
    defiance: "defiance",
    joy:      "joy",
    fear:     "fear",
    wonder:   "wonder"
  },

  // Tension descriptions — selected by detected tone combination.
  tensionFor(tones) {
    if (tones.includes("longing") && tones.includes("tender"))
      return "Holding on to what is already leaving.";
    if (tones.includes("defiance"))
      return "A long-deferred refusal, finally breaking surface.";
    if (tones.includes("grief") && tones.includes("tender"))
      return "Grief that has not stopped being love.";
    if (tones.includes("longing"))
      return "An absence the speaker keeps half-believing will return.";
    if (tones.includes("tender"))
      return "An ordinary moment that refuses to be ordinary.";
    if (tones.length) return `A current of ${tones.join(" + ")}.`;
    return "An interior turn the speaker hasn't named yet.";
  },

  nonImages: new Set([
    "someone","somebody","anyone","anybody","nothing","something","everything",
    "every","any","this","that","these","those","there","here","tonight","today",
    "going","coming","make","made","gone","know","knew","known","take","took",
    "tell","told","said","say","sing","sang","sung","stand","stood","step","leave",
    "left","still","much","more","most","quite","very","really","like","just",
    "only","also","does","done","always","never","again","keep","kept","let",
    "lets","want","wanted","need","needed","feel","felt","seem","seemed","look",
    "looked","looking","walked","walking","moved","moving","turned","turning",
    "ago","ever","because","through","without"
  ]),

  // Compressor wordlists.
  fillers: new Set([
    "very","really","quite","just","actually","somehow","always","sometimes",
    "perhaps","maybe","slightly","rather","kind","sort","of","that","which"
  ]),
  articles: new Set(["a","an","the"]),
  elevatedToPlain: {
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
  },

  // Section labels — keys come from forms.js, values are display labels.
  sectionLabels: {
    "Verse 1":        "Verse 1",
    "Verse 2":        "Verse 2",
    "Verse 3":        "Verse 3",
    "Pre-Chorus":     "Pre-Chorus",
    "Chorus":         "Chorus",
    "Chorus (button)": "Chorus (button)",
    "Bridge":         "Bridge",
    "Outro":          "Outro",
    "Refrain":        "Refrain",
    "Verse 1 (spoken)": "Verse 1 (spoken)",
    "Verse 2 (spoken)": "Verse 2 (spoken)",
    "Verse 3 (spoken)": "Verse 3 (spoken)"
  },

  // Title-pattern hints. Used by the analyzer's title-candidate generator
  // to recognize patterns particular to this language.
  titlePatterns: {
    everyPrefix: "Every",
    thePrefix:   "The"
  },

  // Bold-direction's "every X remembers" chorus tag — translated below
  // for French. Provides an array of fallback patterns the shaper can use.
  imageRefrainPatterns: [
    (image) => `every ${image} remembers`,
    (image) => `the ${image} remembers`
  ],

  shaper: {
    direction: {
      minimal:  "Minimal intervention",
      balanced: "Balanced adaptation",
      bold:     "Bold restructuring"
    },
    rationale: {
      minimal:  "Preserves the poem's cadence almost intact and only introduces a light returning refrain. The piece stays mostly itself; it just learns how to come back.",
      balanced: "Keeps the imagery and the speaker's voice but introduces a true returning chorus. Long lines are compressed for melodic phrasing; the verse-chorus contrast is intentional.",
      bold:     "Treats the poem as a quarry rather than a script. Pulls the strongest images forward, builds a chorus around the dominant figure, and lets the rest of the song serve that gravity."
    },
    notes: {
      keepsOrder:       "Keeps your line order and cadence.",
      softRefrain:      (n) => `Returns ${n === 1 ? "a single line" : "two lines"} as a soft refrain rather than building a new chorus.`,
      trimsLong:        "Trims your longest lines for melodic phrasing.",
      buildsChorus:     (hook) => `Builds a chorus around: "${hook}".`,
      compressesLong:   "Compresses your longer lines so a melody can land on them.",
      formIs:           (name, notes) => `Form: ${name} — ${notes}`,
      repetitionEcho:   "Repeats the chorus tag in the outro for an echo effect.",
      conversational:   "Plain-language pass on adapted lines.",
      keepsDensity:     "Keeps your denser images intact in the verses.",
      restructures:     (image) => `Restructures the piece around the recurring image: "${image}".`,
      condenses:        "Compresses each stanza to 2–3 declarative lines so the chorus can carry the song's weight.",
      invents:          "Invents a chorus and connective lines; uses your strongest images verbatim.",
      doublesChorus:    "Doubles the chorus tag and lets the outro repeat.",
      sharpensHook:     "Hook is sharpened to a title-grade line."
    },
    connective: {
      preChorusFallback: "and I can feel it coming —",
      bridgeFallback:    "and I am still here",
      bridgeQuiet:       "(quiet)",
      preChorusBoldA:    (img) => `and ${img} is starting to speak`,
      preChorusBoldB:    (img) => `and ${img} is starting to answer`,
      iCanAlmost:        (longing) => longing ? "I can almost hear it" : "I can almost say it",
      continueStub:      "(continue)"
    },
    chorusFallback: "Every room remembers"
  }
};

export default LANG_EN;
