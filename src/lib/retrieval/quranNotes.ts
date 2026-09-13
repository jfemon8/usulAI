import { ObjectId } from "mongodb";
import { QURANENC_CONFIG } from "@/config/site";
import { getDocumentsCollection } from "@/lib/db/mongoClient";
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

export async function attachQuranNotes(context: RetrievedChunk[]): Promise<RetrievedChunk[]> {
  const ids = context
    .filter((chunk) => chunk.sourceType === "quran" && ObjectId.isValid(chunk.id))
    .map((chunk) => new ObjectId(chunk.id));

  if (ids.length === 0) return context;

  const collection = await getDocumentsCollection();
  const rows = await collection
    .find({ _id: { $in: ids } }, { projection: { "metadata.quranenc": 1 } })
    .toArray();

  const notes = new Map(
    rows.map((row) => [
      String(row._id),
      formatQuranEncNote((row.metadata as { quranenc?: QuranEncEntry } | undefined)?.quranenc),
    ]),
  );

  return context.map((chunk) => {
    const note = notes.get(chunk.id);
    return note ? { ...chunk, note } : chunk;
  });
}
