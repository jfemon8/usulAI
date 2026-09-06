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
]);

export function detectQuestionLanguage(text: string): QuestionLanguage {
  if (BENGALI_SCRIPT.test(text)) return "bangla";

  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);

  if (words.length === 0) return "other";

  const markerCount = words.filter((word) => BANGLISH_MARKERS.has(word)).length;

  if (markerCount >= 2) return "banglish";
  if (markerCount === 1 && words.length <= 10) return "banglish";

  return "other";
}

export function shouldAnswerInBangla(text: string): boolean {
  return detectQuestionLanguage(text) !== "other";
}
