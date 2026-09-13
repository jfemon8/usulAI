import { QURANENC_CONFIG } from "@/config/site";
import { loadSurahNotes } from "@/lib/retrieval/quranNoteStore";
import type { RetrievedChunk } from "@/types";

export interface QuranEncEntry {
  translation?: string;
  footnotes?: string;
}

const BENGALI_FOOTNOTE = /\[([০-৯]+)\]/g;

function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(BENGALI_FOOTNOTE, "($1)")
    .replace(/\s+/g, " ")
    .trim();
}

export function formatQuranEncNote(entry: QuranEncEntry | undefined): string | undefined {
  if (!entry?.translation) return undefined;

  const translation = clean(entry.translation);
  const footnotes = clean(entry.footnotes ?? "");
  const note = footnotes ? `${translation} টীকা: ${footnotes}` : translation;

  return note.length > QURANENC_CONFIG.maxNoteChars
    ? `${note.slice(0, QURANENC_CONFIG.maxNoteChars).trimEnd()}…`
    : note;
}

export function ayahPosition(reference: string): { surah: number; ayah: number } | null {
  const match = reference.match(/(\d+):(\d+)\s*$/);
  if (!match) return null;
  return { surah: Number(match[1]), ayah: Number(match[2]) };
}

export async function attachQuranNotes(context: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const positions = new Map(
    context.flatMap((chunk) => {
      if (chunk.sourceType !== "quran") return [];
      const position = ayahPosition(chunk.citation.reference);
      return position ? [[chunk.id, position] as const] : [];
    }),
  );

  if (positions.size === 0) return context;

  const surahs = await loadSurahNotes([...positions.values()].map((position) => position.surah));

  return context.map((chunk) => {
    const position = positions.get(chunk.id);
    const note = position
      ? formatQuranEncNote(surahs.get(position.surah)?.[position.ayah])
      : undefined;
    return note ? { ...chunk, note } : chunk;
  });
}
