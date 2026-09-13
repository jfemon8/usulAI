export interface RightToLeftToken {
  leading: string;
  core: string;
  trailing: string;
}

const LEADING_PUNCTUATION = /^[("«[{﴿]+/;
const TRAILING_PUNCTUATION = /[)"»\]}﴾.,:;!?،؛؟…]+$/;
const DETACHED_PUNCTUATION = /^[.,:;!?،؛؟…]+$/;

const MIRRORED: Record<string, string> = {
  "(": ")",
  ")": "(",
  "[": "]",
  "]": "[",
  "{": "}",
  "}": "{",
  "«": "»",
  "»": "«",
};

export function mirror(text: string): string {
  return [...text].map((character) => MIRRORED[character] ?? character).join("");
}

export function splitRightToLeftToken(word: string): RightToLeftToken {
  const leading = word.match(LEADING_PUNCTUATION)?.[0] ?? "";
  const rest = word.slice(leading.length);
  const trailing = rest.match(TRAILING_PUNCTUATION)?.[0] ?? "";
  const core = rest.slice(0, rest.length - trailing.length);
  return core.length > 0 ? { leading, core, trailing } : { leading: "", core: word, trailing: "" };
}

export function wrapWords(
  text: string,
  maxWidth: number,
  measure: (value: string) => number,
): string[][] {
  const lines: string[][] = [];
  const space = measure(" ");
  let current: string[] = [];
  let width = 0;

  const words = text.split(/\s+/).reduce<string[]>((result, word) => {
    const previous = result.length - 1;
    if (word.length === 0) return result;
    if (previous >= 0 && DETACHED_PUNCTUATION.test(word)) result[previous] += word;
    else result.push(word);
    return result;
  }, []);

  for (const word of words) {
    const wordWidth = measure(word);
    const next = current.length === 0 ? wordWidth : width + space + wordWidth;
    if (current.length > 0 && next > maxWidth) {
      lines.push(current);
      current = [word];
      width = wordWidth;
    } else {
      current.push(word);
      width = next;
    }
  }

  if (current.length > 0) lines.push(current);
  return lines;
}
