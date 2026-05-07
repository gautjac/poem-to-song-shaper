// lang-fr.js — French language pack used by the heuristic engine.
// Mirrors the shape of lang-en.js. Wordlists chosen for poetic / song
// register, not exhaustive vocabulary.

export const LANG_FR = {
  code: "fr",

  stopwords: new Set(`
à au aux avec ce ces cet cette ceux celui celle celles c' ça cela
dans de des du d' donc dont elle elles en encore est et étaient était été
être eu fait faire fais fait fut il ils je j' la le les leur leurs lui ma mais
me même mes mon n' ne ni nos notre nous on ou où par pas peu plus pour quand que
qu' qui quoi sa sans se ses si son sur ta te tes toi ton tous tout toute toutes
tu un une vos votre vous y a ai as ont aux après aussi avant
chaque comme contre depuis donc encore jusqu' lorsque même mais ni où plus puis
quand sans sous sur très trop déjà aussi ainsi car donc jamais toujours alors
bien si non oui peut-être plutôt presque selon vers
`.trim().split(/\s+/)),

  sensory: new Set(`
lumière ombre ombres fenêtre porte chambranle rideau pluie soleil lune neige feu
cendre fumée eau mer océan fleuve route rue cuisine chambre jardin champ ciel
nuage poussière main mains peau souffle os cœur bouche œil yeux voix silence
chant murmure sel pain café thé vin verre tasse table chaise sol mur miroir
photographie oiseau chien cheval arbre feuille branche pétale pierre sable vague
goût odeur son couleur nuit matin soir crépuscule aube hiver été automne printemps
robe manteau écharpe horloge four bouilloire frigo lampe rideaux poire pomme
projecteur scène coulisses
`.trim().split(/\s+/)),

  emotion: {
    longing:  /\b(manque|manqué|manquer|attendre|attendant|attends|parti|partie|loin|distant|vide|creux)\b/i,
    tender:   /\b(doux|douce|tendrement|tenir|tiens|tient|tiens|tendre|chaud|chaude|calme|silencieux|silencieuse|paisible|encore|toujours)\b/i,
    grief:    /\b(perdu|perdue|perdus|perdues|perte|partir|parti|pleurer|pleuré|pleure|larmes|deuil|seul|seule|funéraille|adieu|absence)\b/i,
    defiance: /\b(rester|reste|jamais|ce soir|maintenant|ici|refuser|refuse|chanter|finir|finis|debout|cesser|assez|je vais|je veux)\b/i,
    joy:      /\b(rire|sourire|sourit|souriant|brillant|brillante|chanter|chanté|danser|dansé|joie|heureux|heureuse|sucré|sucrée)\b/i,
    fear:     /\b(peur|effrayé|effrayée|crainte|craindre|trembler|tremble|frisson|froid|froide)\b/i,
    wonder:   /\b(étrange|merveille|magique|miracle|impossible|on ne sait)\b/i
  },

  toneNames: {
    longing:  "manque",
    tender:   "tendresse",
    grief:    "deuil",
    defiance: "défi",
    joy:      "joie",
    fear:     "peur",
    wonder:   "émerveillement"
  },

  tensionFor(tones) {
    // Tones are already in the canonical en-named keys ("longing", "tender", …)
    if (tones.includes("longing") && tones.includes("tender"))
      return "Tenir ce qui s'en va déjà.";
    if (tones.includes("defiance"))
      return "Un refus longtemps différé, qui remonte enfin à la surface.";
    if (tones.includes("grief") && tones.includes("tender"))
      return "Un deuil qui n'a pas cessé d'être amour.";
    if (tones.includes("longing"))
      return "Une absence dont le narrateur croit encore au retour.";
    if (tones.includes("tender"))
      return "Un instant ordinaire qui refuse de l'être.";
    if (tones.length) {
      const display = tones.map(t => ({ longing:"manque", tender:"tendresse", grief:"deuil", defiance:"défi", joy:"joie", fear:"peur", wonder:"émerveillement" }[t] || t)).join(" + ");
      return `Un courant de ${display}.`;
    }
    return "Un tournant intérieur que le narrateur n'a pas encore nommé.";
  },

  nonImages: new Set([
    "quelqu'un","quelque","chose","chacun","rien","tout","toute","toutes","tous",
    "celui","celle","ceux","celles","aucun","aucune","autre","autres",
    "ce","cette","ces","cet","celui-ci","celle-ci",
    "ici","là","là-bas","ce soir","aujourd'hui","demain","hier",
    "aller","allé","va","vais","vas","vont","venir","venu","vient","viens",
    "faire","fait","faits","faisait","fais","fasse",
    "savoir","sait","sais","savait","su","connu","connaît","connais",
    "prendre","pris","prend","prends","prenait",
    "dire","dit","dis","disait","disais","disait",
    "rester","resté","reste","restait","encore","déjà","plus","moins",
    "vouloir","voulu","veut","veux","voulait",
    "pouvoir","pu","peut","peux","pouvait","peut-être",
    "devoir","dû","doit","dois","devait",
    "voir","vu","voit","vois","voyait",
    "trop","très","vraiment","plutôt","presque","seulement","aussi","ainsi",
    "toujours","jamais","souvent","parfois","quelquefois","encore","déjà","alors","donc"
  ]),

  fillers: new Set([
    "très","vraiment","tout","toute","juste","enfin","fait","peut-être","parfois",
    "toujours","plutôt","presque","aussi","ainsi","alors","bien","donc","ne","pas"
  ]),

  articles: new Set([
    "le","la","les","l'","un","une","des","du","de","d'",
    "au","aux","ce","cette","ces","cet"
  ]),

  // Heuristic French diction simplifications — used cautiously by the
  // "easier to sing" compressor. Only safe, register-neutral swaps.
  elevatedToPlain: {
    "demeure":   "reste",
    "demeurer":  "rester",
    "régner":    "rester",
    "advenir":   "arriver",
    "songer":    "penser",
    "ouïr":      "entendre",
    "errer":     "marcher",
    "déambuler": "marcher",
    "céans":     "ici",
    "naguère":   "avant",
    "jadis":     "avant",
    "céder":     "laisser",
    "implorer":  "demander",
    "redouter":  "craindre"
  },

  sectionLabels: {
    "Verse 1":        "Couplet 1",
    "Verse 2":        "Couplet 2",
    "Verse 3":        "Couplet 3",
    "Pre-Chorus":     "Pré-refrain",
    "Chorus":         "Refrain",
    "Chorus (button)": "Refrain (final)",
    "Bridge":         "Pont",
    "Outro":          "Outro",
    "Refrain":        "Refrain",
    "Verse 1 (spoken)": "Couplet 1 (parlé)",
    "Verse 2 (spoken)": "Couplet 2 (parlé)",
    "Verse 3 (spoken)": "Couplet 3 (parlé)"
  },

  titlePatterns: {
    everyPrefix: "Chaque",
    thePrefix:   "Le"     // "Le" / "La" — caller picks via gender if available
  },

  // Bold-direction refrain templates — the shaper inserts the dominant image.
  imageRefrainPatterns: [
    (image) => `chaque ${image} se souvient`,
    (image) => `le ${image} se souvient`
  ],

  shaper: {
    direction: {
      minimal:  "Intervention minimale",
      balanced: "Adaptation équilibrée",
      bold:     "Restructuration audacieuse"
    },
    rationale: {
      minimal:  "Préserve presque intact le rythme du poème et n'introduit qu'un léger refrain qui revient. Le texte reste lui-même ; il apprend simplement à revenir.",
      balanced: "Garde l'imagerie et la voix du narrateur, mais introduit un vrai refrain qui revient. Les vers longs sont compressés pour le phrasé mélodique ; le contraste couplet-refrain est volontaire.",
      bold:     "Traite le poème comme une carrière, non comme un script. Met en avant les images les plus fortes, construit un refrain autour de la figure dominante, et laisse le reste de la chanson servir cette gravité."
    },
    notes: {
      keepsOrder:       "Garde l'ordre et le rythme de tes vers.",
      softRefrain:      (n) => `Reprend ${n === 1 ? "un seul vers" : "deux vers"} comme refrain doux, plutôt que d'inventer un nouveau refrain.`,
      trimsLong:        "Raccourcit tes vers les plus longs pour le phrasé mélodique.",
      buildsChorus:     (hook) => `Construit un refrain autour de : « ${hook} ».`,
      compressesLong:   "Compresse tes vers les plus longs pour qu'une mélodie puisse s'y poser.",
      formIs:           (name, notes) => `Forme : ${name} — ${notes}`,
      repetitionEcho:   "Reprend la signature du refrain dans l'outro pour un effet d'écho.",
      conversational:   "Passe les vers adaptés en langage plus direct.",
      keepsDensity:     "Garde tes images les plus denses intactes dans les couplets.",
      restructures:     (image) => `Restructure le morceau autour de l'image récurrente : « ${image} ».`,
      condenses:        "Compresse chaque strophe à 2–3 vers déclaratifs pour que le refrain porte le poids du morceau.",
      invents:          "Invente un refrain et des vers de liaison ; reprend tes images les plus fortes telles quelles.",
      doublesChorus:    "Double la signature du refrain et laisse l'outro la répéter.",
      sharpensHook:     "L'accroche est aiguisée jusqu'à devenir un titre."
    },
    connective: {
      preChorusFallback: "et je le sens qui vient —",
      bridgeFallback:    "et je suis encore là",
      bridgeQuiet:       "(silence)",
      preChorusBoldA:    (img) => `et ${img} commence à parler`,
      preChorusBoldB:    (img) => `et ${img} commence à répondre`,
      iCanAlmost:        (longing) => longing ? "je l'entends presque" : "je peux presque le dire",
      continueStub:      "(à suivre)"
    },
    chorusFallback: "Chaque chambre se souvient"
  }
};

export default LANG_FR;
