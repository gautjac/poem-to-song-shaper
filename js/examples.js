// examples.js
// Demo texts in two languages, three registers each (poetic/dense,
// plainspoken emotional, theatrical/dramatic). All original to this app.

export const EXAMPLES_EN = [
  {
    id: "borrowed-rooms",
    title: "Borrowed Rooms",
    register: "highly poetic / imagistic",
    blurb: "Dense imagery, long lines, second-person address. Wants pruning.",
    text:
`I keep arriving in rooms I have already left,
the doorframes warm with someone else's coat.
A pear on the counter, half-eaten and sweet,
the light through the curtain doing its slow undressing.

You said: hold this for me, the way one holds water.
I held it. I am still holding it.
The clock above the stove has stopped at the hour we agreed on.
Outside, a dog is teaching the evening to sit.

I smile like someone borrowing time from a stranger.
Every room remembers. Every room remembers.
The pear browns. The hour does not move.
I leave the way snow leaves — not at once, in pieces.`
  },
  {
    id: "kitchen-light",
    title: "Kitchen Light",
    register: "plainspoken emotional",
    blurb: "Direct address, conversational rhythm, ready for melody.",
    text:
`I don't know how to tell you that I'm tired.
I made the coffee. I cleaned the cups.
The light in the kitchen has been on for hours
and I'm not sure who I left it on for.

Maybe me. Maybe the version of me
that was supposed to come home tonight
and didn't, again, and didn't, again,
and didn't say where she was going.

I keep the light on. I keep the light on.
The kettle clicks. The fridge hums quiet.
If you come back, you will know me by this:
I always leave a light on for the both of us.`
  },
  {
    id: "the-understudy",
    title: "The Understudy",
    register: "theatrical / dramatic monologue",
    blurb: "Big voice, internal turn, naturally wants a chorus.",
    text:
`They said: stand here. They said: don't move.
They said: someone more important will arrive at any moment
and you will be the one to hand her the dress.
I have been standing here for six years.

I have learned the curtain like a second skin.
I know which floorboard whispers, which spotlight lies.
I know the lines she fumbles. I know the lines she cuts.
I know the song she never quite finishes
because the truth of it would cost her too much.

Tonight the dress is in my hands.
Tonight the spotlight is wider than I remember.
Tonight, when they say stand here, I'm going to step.
Tonight, when they say don't move,
I am going to sing the line she never finishes.
I am going to finish it.`
  }
];

export const EXAMPLES_FR = [
  {
    id: "chambres-empruntees",
    title: "Chambres empruntées",
    register: "très poétique / imagé",
    blurb: "Imagerie dense, vers longs, adresse à la deuxième personne. À élaguer.",
    text:
`Je continue d'arriver dans des chambres que j'ai déjà quittées,
les chambranles tièdes du manteau d'un autre.
Une poire sur le comptoir, à demi mangée et sucrée,
la lumière à travers le rideau qui se déshabille lentement.

Tu m'as dit : tiens-moi ça, comme on tient de l'eau.
Je l'ai tenu. Je le tiens encore.
L'horloge au-dessus du four s'est arrêtée à l'heure dite.
Dehors, un chien apprend au soir à s'asseoir.

Je souris comme quelqu'un qui emprunte du temps à un étranger.
Chaque chambre se souvient. Chaque chambre se souvient.
La poire brunit. L'heure ne bouge pas.
Je pars comme part la neige — non pas d'un coup, par morceaux.`
  },
  {
    id: "lumiere-de-cuisine",
    title: "Lumière de cuisine",
    register: "émotion directe / parlé",
    blurb: "Adresse directe, rythme conversationnel, prête pour une mélodie.",
    text:
`Je ne sais pas comment te dire que je suis fatiguée.
J'ai fait le café. J'ai lavé les tasses.
La lumière de la cuisine est allumée depuis des heures
et je ne sais plus pour qui je l'ai laissée.

Peut-être pour moi. Peut-être pour la version de moi
qui devait rentrer ce soir
et qui n'est pas rentrée, encore, et n'est pas rentrée, encore,
et qui n'a pas dit où elle allait.

Je laisse la lumière. Je laisse la lumière.
La bouilloire claque. Le frigo bourdonne tout bas.
Si tu reviens, tu me reconnaîtras à ceci :
je laisse toujours une lumière pour nous deux.`
  },
  {
    id: "la-doublure",
    title: "La doublure",
    register: "théâtral / monologue dramatique",
    blurb: "Grande voix, virage intérieur, veut naturellement un refrain.",
    text:
`Ils ont dit : tiens-toi là. Ils ont dit : ne bouge pas.
Ils ont dit : quelqu'un de plus important va arriver d'un instant à l'autre
et c'est toi qui lui tendras la robe.
Je me tiens là depuis six ans.

J'ai appris le rideau comme une seconde peau.
Je sais quelle latte chuchote, quel projecteur ment.
Je sais les vers qu'elle bafouille. Je sais les vers qu'elle coupe.
Je sais la chanson qu'elle ne finit jamais
parce que la vérité de la chanson lui coûterait trop cher.

Ce soir la robe est entre mes mains.
Ce soir le projecteur est plus large que dans mon souvenir.
Ce soir, quand ils diront tiens-toi là, je vais avancer.
Ce soir, quand ils diront ne bouge pas,
je vais chanter le vers qu'elle ne finit jamais.
Je vais le finir.`
  }
];

// Backwards-compat default export — used by older code paths.
export const examples = EXAMPLES_EN;

// Returns the example list for the given locale.
export function examplesFor(locale) {
  return locale === "fr" ? EXAMPLES_FR : EXAMPLES_EN;
}
