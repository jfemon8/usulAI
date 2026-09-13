import { arabicSkeleton } from "@/lib/ai/arabicText";

export type PronunciationLanguage = "bn" | "en";

type Vowel = "" | "a" | "i" | "u" | "aa" | "ii" | "uu" | "an" | "in" | "un";

interface Unit {
  c: string;
  v: Vowel;
  marked: boolean;
  sukun: boolean;
  gem: boolean;
  silent: boolean;
  dagger: boolean;
  iqlab: boolean;
  pause: boolean;
}

interface Word {
  units: Unit[];
  wasla: boolean;
  article: boolean;
  pauseAfter: boolean;
  fixed?: Record<PronunciationLanguage, string>;
}

const LETTERS = new Map<number, string>([
  [0x0628, "b"],
  [0x062a, "t"],
  [0x062b, "th"],
  [0x062c, "j"],
  [0x062d, "H"],
  [0x062e, "kh"],
  [0x062f, "d"],
  [0x0630, "dh"],
  [0x0631, "r"],
  [0x0632, "z"],
  [0x0633, "s"],
  [0x0634, "sh"],
  [0x0635, "S"],
  [0x0636, "D"],
  [0x0637, "T"],
  [0x0638, "Z"],
  [0x0639, "ayn"],
  [0x063a, "gh"],
  [0x0641, "f"],
  [0x0642, "q"],
  [0x0643, "k"],
  [0x06a9, "k"],
  [0x0644, "l"],
  [0x0645, "m"],
  [0x0646, "n"],
  [0x0647, "h"],
  [0x0648, "w"],
  [0x064a, "y"],
  [0x06cc, "y"],
  [0x0629, "tm"],
  [0x0649, "maqsura"],
  [0x0627, "alef"],
  [0x0671, "wasla"],
  [0x0621, "hamza"],
  [0x0623, "hamza"],
  [0x0625, "hamza"],
  [0x0624, "hamza"],
  [0x0626, "hamza"],
  [0x0622, "madda"],
]);

const VOWEL_MARKS = new Map<number, Vowel>([
  [0x064e, "a"],
  [0x0650, "i"],
  [0x064f, "u"],
  [0x064b, "an"],
  [0x064d, "in"],
  [0x064c, "un"],
]);

const SUKUN = new Set([0x0652, 0x06e1]);
const SHADDA = 0x0651;
const DAGGER_ALEF = 0x0670;
const SILENT_MARKS = new Set([0x06df, 0x06e0]);
const SMALL_WAW = 0x06e5;
const SMALL_YEH = 0x06e6;
const LONG_I_MARK = 0x0656;
const LONG_U_MARK = 0x0657;

function isWaqf(codepoint: number): boolean {
  return (
    (codepoint >= 0x06d6 && codepoint <= 0x06dc) || codepoint === 0x06de || codepoint === 0x06e9
  );
}

const TANWEEN_BASE: Partial<Record<Vowel, Vowel>> = { an: "a", in: "i", un: "u" };
const SHORTENED: Partial<Record<Vowel, Vowel>> = { aa: "a", ii: "i", uu: "u" };

const HONORIFIC_PHRASES: { arabic: string; text: Record<PronunciationLanguage, string> }[] = [
  {
    arabic: "صلى الله عليه وسلم",
    text: { en: "sallallaahu 'alaihi wa sallam", bn: "সাল্লাল্লাহু আলাইহি ওয়া সাল্লাম" },
  },
  { arabic: "رضي الله عنه", text: { en: "radiyallaahu 'anhu", bn: "রাদিয়াল্লাহু আনহু" } },
  { arabic: "رضي الله عنها", text: { en: "radiyallaahu 'anhaa", bn: "রাদিয়াল্লাহু আনহা" } },
  { arabic: "رضي الله عنهم", text: { en: "radiyallaahu 'anhum", bn: "রাদিয়াল্লাহু আনহুম" } },
  { arabic: "عليه السلام", text: { en: "'alaihis salaam", bn: "আলাইহিস সালাম" } },
];

const HONORIFICS = HONORIFIC_PHRASES.map((entry) => ({
  skeleton: arabicSkeleton(entry.arabic.replace(/\s+/g, "")),
  words: entry.arabic.split(/\s+/).length,
  text: entry.text,
}));

function newUnit(c: string): Unit {
  return {
    c,
    v: "",
    marked: false,
    sukun: false,
    gem: false,
    silent: false,
    dagger: false,
    iqlab: false,
    pause: false,
  };
}

function parseUnits(token: string): Unit[] {
  const units: Unit[] = [];

  for (const char of token.normalize("NFC")) {
    const codepoint = char.codePointAt(0)!;
    const letter = LETTERS.get(codepoint);
    const last = units[units.length - 1];

    if (letter === "madda") {
      if (last && last.v === "a") last.v = "aa";
      else units.push({ ...newUnit("hamza"), v: "aa", marked: true });
      continue;
    }

    if (letter) {
      units.push(newUnit(letter));
      continue;
    }

    if (!last) continue;

    const vowel = VOWEL_MARKS.get(codepoint);
    if (vowel) {
      last.v = last.dagger && vowel === "a" ? "aa" : vowel;
      last.marked = true;
    } else if (SUKUN.has(codepoint)) {
      last.sukun = true;
      last.marked = true;
    } else if (codepoint === SHADDA) {
      last.gem = true;
    } else if (codepoint === DAGGER_ALEF) {
      last.dagger = true;
      if (last.v === "a" || last.v === "") last.v = "aa";
    } else if (SILENT_MARKS.has(codepoint)) {
      last.silent = true;
    } else if (codepoint === SMALL_WAW || codepoint === LONG_U_MARK) {
      last.v = "uu";
    } else if (codepoint === SMALL_YEH || codepoint === LONG_I_MARK) {
      last.v = "ii";
    }
  }

  return units;
}

function isArticleLam(units: Unit[], index: number): boolean {
  const lam = units[index];
  if (lam?.c !== "l") return false;
  return lam.sukun || (!lam.marked && Boolean(units[index + 1]?.gem));
}

function resolveWord(units: Unit[]): Word {
  const word: Word = { units, wasla: false, article: false, pauseAfter: false };

  units.forEach((unit, index) => {
    const prev = units[index - 1];
    if (unit.silent) return;

    if (unit.c === "wasla" || (unit.c === "alef" && index === 0 && !unit.marked)) {
      unit.silent = true;
      if (index === 0) {
        word.wasla = true;
        word.article = isArticleLam(units, 1) || Boolean(units[1]?.gem);
      }
      return;
    }

    if (unit.c === "alef") {
      if (unit.marked) {
        unit.c = "hamza";
        return;
      }
      unit.silent = true;
      if (isArticleLam(units, index + 1)) return;
      if (prev && (prev.v === "a" || prev.dagger)) prev.v = "aa";
      return;
    }

    if (unit.c === "maqsura") {
      if (unit.marked && unit.v !== "") {
        unit.c = "y";
        return;
      }
      unit.silent = true;
      if (prev && (prev.v === "a" || prev.dagger)) prev.v = "aa";
      else if (prev?.v === "i") prev.v = "ii";
      return;
    }

    if ((unit.c === "w" || unit.c === "y") && !unit.marked && !unit.gem) {
      if (unit.dagger) {
        unit.silent = true;
        if (prev) prev.v = "aa";
      } else if (unit.c === "w" && prev?.v === "u") {
        unit.silent = true;
        prev.v = "uu";
      } else if (unit.c === "y" && prev?.v === "i") {
        unit.silent = true;
        prev.v = "ii";
      }
      return;
    }

    if (unit.c === "l" && !unit.marked && !unit.gem && units[index + 1]?.gem) {
      unit.silent = true;
      return;
    }

    if (
      unit.c === "l" &&
      unit.gem &&
      unit.v === "a" &&
      units[index - 1]?.c === "l" &&
      units[index + 1]?.c === "h" &&
      (index + 2 >= units.length || units[index + 2]?.c === "m")
    ) {
      unit.v = "aa";
    }
  });

  return word;
}

function pronounced(word: Word): Unit[] {
  return word.units.filter((unit) => !unit.silent);
}

function parseText(text: string): Word[] {
  const words: Word[] = [];
  const tokens = text.split(/\s+/).filter(Boolean);

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    const codepoints = [...token].map((char) => char.codePointAt(0)!);
    const hasLetter = codepoints.some((codepoint) => LETTERS.has(codepoint));

    if (!hasLetter) {
      if (codepoints.some(isWaqf) && words.length > 0) words[words.length - 1]!.pauseAfter = true;
      continue;
    }

    const honorific = HONORIFICS.find(
      (entry) =>
        arabicSkeleton(tokens.slice(index, index + entry.words).join("")) === entry.skeleton,
    );

    if (honorific) {
      words.push({
        units: [],
        wasla: false,
        article: false,
        pauseAfter: false,
        fixed: honorific.text,
      });
      index += honorific.words - 1;
      continue;
    }

    const word = resolveWord(parseUnits(token));
    if (codepoints.some(isWaqf)) word.pauseAfter = true;
    words.push(word);
  }

  return words;
}

function appendConsonant(word: Word, c: string): void {
  word.units.push(newUnit(c));
}

function connectWords(words: Word[]): void {
  for (let index = 1; index < words.length; index += 1) {
    const word = words[index]!;
    const prev = words[index - 1]!;
    if (prev.pauseAfter || prev.fixed || word.fixed) continue;

    const first = pronounced(word)[0];
    const prevUnits = pronounced(prev);
    const last = prevUnits[prevUnits.length - 1];
    if (!first || !last) continue;

    if (word.wasla) {
      const shortened = SHORTENED[last.v];
      if (shortened) last.v = shortened;

      const tanween = TANWEEN_BASE[last.v];
      if (tanween) {
        last.v = tanween;
        prev.units.push({ ...newUnit("n"), v: "i" });
      }

      if (first.v === "" && !first.gem) {
        appendConsonant(prev, first.c);
        first.silent = true;
      } else if (first.gem) {
        appendConsonant(prev, first.c);
        first.gem = false;
      }
      continue;
    }

    if (first.c === "b" && (TANWEEN_BASE[last.v] || (last.c === "n" && last.v === ""))) {
      last.iqlab = true;
    }

    if (first.gem) {
      if (last.c === "n" && !last.marked) {
        last.silent = true;
        appendConsonant(prev, first.c);
        first.gem = false;
      } else if (TANWEEN_BASE[last.v]) {
        last.v = TANWEEN_BASE[last.v]!;
        appendConsonant(prev, first.c);
        first.gem = false;
      }
    }
  }
}

function applyPauses(words: Word[]): void {
  words.forEach((word, index) => {
    if (word.fixed) return;
    if (index !== words.length - 1 && !word.pauseAfter) return;

    const units = pronounced(word);
    const last = units[units.length - 1];
    if (!last) return;

    last.pause = true;
    if (last.c === "tm") {
      last.c = "h";
      last.v = "";
      return;
    }
    if (last.v === "an") last.v = "aa";
    else if (
      last.v === "a" ||
      last.v === "i" ||
      last.v === "u" ||
      last.v === "in" ||
      last.v === "un"
    ) {
      last.v = "";
    }
  });

  words.forEach((word, index) => {
    const restarts = index === 0 || Boolean(words[index - 1]?.pauseAfter);
    if (!restarts || word.fixed) return;

    const opening = pronounced(word)[0];
    if (opening && !word.wasla) opening.gem = false;

    if (word.wasla) {
      word.units.unshift({ ...newUnit("hamza"), v: word.article ? "a" : "i", marked: true });
    }
  });
}

const EN_CONSONANTS: Record<string, string> = {
  hamza: "'",
  ayn: "'",
  b: "b",
  t: "t",
  th: "th",
  j: "j",
  H: "h",
  kh: "kh",
  d: "d",
  dh: "dh",
  r: "r",
  z: "z",
  s: "s",
  sh: "sh",
  S: "s",
  D: "d",
  T: "t",
  Z: "z",
  gh: "gh",
  f: "f",
  q: "q",
  k: "k",
  l: "l",
  m: "m",
  n: "n",
  h: "h",
  w: "w",
  y: "y",
  tm: "t",
};

const EN_VOWELS: Record<Vowel, string> = {
  "": "",
  a: "a",
  i: "i",
  u: "u",
  aa: "aa",
  ii: "ee",
  uu: "oo",
  an: "an",
  in: "in",
  un: "un",
};

function renderEnglish(word: Word): string {
  if (word.fixed) return word.fixed.en;

  let out = "";
  for (const unit of pronounced(word)) {
    let consonant = EN_CONSONANTS[unit.c] ?? "";
    if (consonant === "'" && out.length === 0) consonant = "";
    if (unit.gem && consonant !== "'") consonant += consonant;

    let vowel = EN_VOWELS[unit.v];
    if (unit.iqlab && TANWEEN_BASE[unit.v]) vowel = `${EN_VOWELS[TANWEEN_BASE[unit.v]!]}m`;
    if (unit.iqlab && unit.c === "n" && unit.v === "") consonant = "m";
    out += consonant + vowel;
  }

  return out;
}

const BN_CONSONANTS: Record<string, string> = {
  b: "ব",
  t: "ত",
  th: "ছ",
  j: "জ",
  H: "হ",
  kh: "খ",
  d: "দ",
  dh: "য",
  r: "র",
  z: "য",
  s: "স",
  sh: "শ",
  S: "স",
  D: "দ",
  T: "ত",
  Z: "য",
  gh: "গ",
  f: "ফ",
  q: "ক",
  k: "ক",
  l: "ল",
  m: "ম",
  n: "ন",
  h: "হ",
  tm: "ত",
};

const BN_SIGNS: Record<Vowel, string> = {
  "": "",
  a: "া",
  aa: "া",
  i: "ি",
  ii: "ী",
  u: "ু",
  uu: "ূ",
  an: "ান",
  in: "িন",
  un: "ুন",
};

const BN_INDEPENDENT: Record<Vowel, string> = {
  "": "",
  a: "আ",
  aa: "আ",
  i: "ই",
  ii: "ঈ",
  u: "উ",
  uu: "ঊ",
  an: "আন",
  in: "ইন",
  un: "উন",
};

const HASANTA = "্";
const YA_PHALA = "য়";

function bnTanween(unit: Unit): string {
  const base = TANWEEN_BASE[unit.v];
  if (!base) return BN_SIGNS[unit.v];
  return `${BN_SIGNS[base]}${unit.iqlab ? "ম" : "ন"}`;
}

function renderBangla(word: Word): string {
  if (word.fixed) return word.fixed.bn;

  let out = "";
  let afterVowel = false;

  for (const unit of pronounced(word)) {
    if (unit.c === "hamza" || unit.c === "ayn") {
      out += BN_INDEPENDENT[unit.v];
      afterVowel = unit.v !== "";
      continue;
    }

    if (unit.c === "w") {
      const forms: Record<Vowel, string> = {
        "": afterVowel ? "ও" : "উ",
        a: "ওয়া",
        aa: "ওয়া",
        an: "ওয়ান",
        i: "উই",
        ii: "উঈ",
        in: "উইন",
        u: "উ",
        uu: "ঊ",
        un: "উন",
      };
      out += forms[unit.v];
      afterVowel = true;
      continue;
    }

    if (unit.c === "y") {
      if (unit.v === "") {
        out += "ই";
      } else if (unit.gem) {
        out += `${YA_PHALA}${HASANTA}য${bnTanween(unit)}`;
      } else if (unit.v === "u" || unit.v === "uu") {
        out += "ইউ";
      } else if (afterVowel) {
        out += `${YA_PHALA}${bnTanween(unit)}`;
      } else {
        out += `ই${YA_PHALA}${bnTanween(unit)}`;
      }
      afterVowel = true;
      continue;
    }

    const base =
      unit.iqlab && unit.c === "n" && unit.v === "" ? "ম" : (BN_CONSONANTS[unit.c] ?? "");
    if (!base) continue;

    const doubled = unit.c === "r" ? `${base}${base}` : `${base}${HASANTA}${base}`;
    const consonant = unit.gem && !unit.pause ? doubled : base;
    out += consonant + bnTanween(unit);
    afterVowel = unit.v !== "";
  }

  return out;
}

export function transliterateArabic(text: string, language: PronunciationLanguage): string {
  const words = parseText(text);
  connectWords(words);
  applyPauses(words);

  const render = language === "en" ? renderEnglish : renderBangla;
  return words
    .map(render)
    .filter((word) => word.length > 0)
    .join(" ");
}
