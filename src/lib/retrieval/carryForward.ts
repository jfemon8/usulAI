import { CONTEXT_CONFIG, SOURCE_PRIORITY } from "@/config/site";
import type { AnswerSource, RetrievedChunk, SourceType, UsulUIMessage } from "@/types";

function isAnswerSource(value: unknown): value is Pick<AnswerSource, "reference" | "index"> {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as { reference?: unknown; index?: unknown };
  return typeof candidate.reference === "string" && candidate.reference.length > 0;
}

export function previousSourceReferences(messages: UsulUIMessage[]): string[] {
  const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
  const earlier = messages.slice(0, Math.max(0, lastUserIndex));
  const assistant = [...earlier].reverse().find((message) => message.role === "assistant");
  if (!assistant) return [];

  const references = assistant.parts.flatMap((part) => {
    if (part.type !== "data-sources" || !Array.isArray(part.data)) return [];
    return (part.data as unknown[]).filter(isAnswerSource).map((source) => source.reference);
  });

  return [...new Set(references)].slice(0, CONTEXT_CONFIG.carriedSources);
}

export function mergeCarriedContext(
  retrieved: RetrievedChunk[],
  carried: RetrievedChunk[],
  maxChunks: number = CONTEXT_CONFIG.maxContextChunks,
): RetrievedChunk[] {
  const carriedIds = new Set(carried.map((chunk) => chunk.id));
  const combined = [...carried, ...retrieved.filter((chunk) => !carriedIds.has(chunk.id))].slice(
    0,
    maxChunks,
  );

  return combined
    .map((chunk, order) => ({ chunk, order }))
    .sort(
      (a, b) =>
        SOURCE_PRIORITY.indexOf(a.chunk.sourceType) - SOURCE_PRIORITY.indexOf(b.chunk.sourceType) ||
        a.order - b.order,
    )
    .map(({ chunk }) => chunk);
}

export function sourceCap(sourceType: SourceType, sources: readonly SourceType[]): number {
  const cap = CONTEXT_CONFIG.perSourceCap[sourceType];
  return sources.length < SOURCE_PRIORITY.length ? Math.max(cap, CONTEXT_CONFIG.scopedMinCap) : cap;
}

export function capPerSource(
  chunks: RetrievedChunk[],
  carriedIds: ReadonlySet<string>,
  sources: readonly SourceType[] = SOURCE_PRIORITY,
): RetrievedChunk[] {
  return sources.flatMap((sourceType) => {
    const group = chunks.filter((chunk) => chunk.sourceType === sourceType);
    const pinned = group.filter((chunk) => carriedIds.has(chunk.id));
    const rest = group.filter((chunk) => !carriedIds.has(chunk.id));
    return [...pinned, ...rest].slice(0, sourceCap(sourceType, sources));
  });
}
