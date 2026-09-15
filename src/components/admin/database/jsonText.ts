export interface JsonProblem {
  message: string;
  line: number | null;
  column: number | null;
  offset: number | null;
}

export function offsetAt(text: string, line: number, column: number): number {
  let offset = 0;
  for (let current = 1; current < line; current += 1) {
    const next = text.indexOf("\n", offset);
    if (next === -1) return text.length;
    offset = next + 1;
  }
  return Math.min(text.length, offset + Math.max(0, column - 1));
}

export function lineColumnAt(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, Math.max(0, Math.min(offset, text.length)));
  const lines = before.split("\n");
  return { line: lines.length, column: (lines.at(-1)?.length ?? 0) + 1 };
}

export function locateJsonError(
  text: string,
  options: { allowEmpty?: boolean } = {},
): JsonProblem | null {
  if (!text.trim()) {
    return options.allowEmpty
      ? null
      : { message: "JSON খালি রাখা যাবে না।", line: null, column: null, offset: null };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const lineMatch = /line (\d+) column (\d+)/i.exec(raw);
    const positionMatch = /position (\d+)/i.exec(raw);
    let line: number | null = null;
    let column: number | null = null;
    let offset: number | null = null;
    if (lineMatch) {
      line = Number(lineMatch[1]);
      column = Number(lineMatch[2]);
      offset = offsetAt(text, line, column);
    } else if (positionMatch) {
      offset = Number(positionMatch[1]);
      ({ line, column } = lineColumnAt(text, offset));
    }
    const where = line !== null ? `লাইন ${line}, কলাম ${column}: ` : "";
    return { message: `JSON সঠিক নয়, ${where}${raw}`, line, column, offset };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {
      message: "একটি JSON অবজেক্ট দিন, যেমন {}। array বা একক মান চলবে না।",
      line: 1,
      column: 1,
      offset: 0,
    };
  }
  return null;
}

export function utf8Bytes(text: string): number {
  return new TextEncoder().encode(text).length;
}

export function documentApiPath(collection: string, id: string): string {
  return `/api/admin/database/${encodeURIComponent(collection)}/document?id=${encodeURIComponent(id)}`;
}
