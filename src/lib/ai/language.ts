export type QuestionLanguage = "bangla" | "banglish" | "other";

const BENGALI_SCRIPT = /[ঀ-৿]/;

const BANGLISH_MARKERS = new Set([
  "ache",
  "achi",
  "achhe",
  "ami",
  "amake",
  "amar",
  "amra",
  "apnar",
  "apni",
  "ar",
  "bhalo",
  "bujhi",
  "bujhte",
  "bole",
  "bolo",
  "chai",
  "dao",
  "dekhe",
  "dekho",
  "diye",
  "dorkar",
  "ei",
  "ekta",
  "er",
  "hobe",
  "hocche",
  "hoy",
  "hoye",
  "hoyeche",
  "hoise",
  "jodi",
  "jonno",
  "kaj",
  "karon",
  "kemon",
  "kemne",
  "keno",
  "kina",
  "kintu",
  "kivabe",
  "kokhon",
  "kono",
  "kora",
  "korba",
  "korbo",
  "korchi",
  "kore",
  "koro",
  "korte",
  "koto",
  "kothay",
  "lagbe",
  "likho",
  "mane",
  "nai",
  "nei",
  "onek",
  "ota",
  "parbo",
  "pari",
  "sei",
  "sob",
  "sobgulo",
  "tahole",
  "tar",
  "theke",
  "tomar",
  "tumi",
  "shudhu",
  "sudhu",
  "dila",
  "dilen",
  "dile",
  "dilo",
  "dilam",
  "dite",
  "dibe",
  "diben",
  "niye",
  "bolen",
  "bolun",
  "bolchen",
  "bolechen",
  "kichu",
  "keu",
  "ekhon",
  "ekhane",
  "naki",
  "jeno",
  "hadiser",
  "quraner",
  "ayater",
]);

function latinWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function markerCount(words: string[]): number {
  return words.filter((word) => BANGLISH_MARKERS.has(word)).length;
}

export function detectQuestionLanguage(text: string): QuestionLanguage {
  if (BENGALI_SCRIPT.test(text)) return "bangla";

  const words = latinWords(text);
  if (words.length === 0) return "other";

  const markers = markerCount(words);

  if (markers >= 2) return "banglish";
  if (markers === 1 && words.length <= 10) return "banglish";

  return "other";
}

export function detectConversationLanguage(
  question: string,
  previousUserTurns: string[],
): QuestionLanguage {
  const language = detectQuestionLanguage(question);
  if (language !== "other") return language;

  const lastTurn = previousUserTurns[previousUserTurns.length - 1];
  if (!lastTurn || detectQuestionLanguage(lastTurn) === "other") return language;

  return markerCount(latinWords(question)) >= 1 ? "banglish" : language;
}

export function shouldAnswerInBangla(text: string): boolean {
  return detectQuestionLanguage(text) !== "other";
}
