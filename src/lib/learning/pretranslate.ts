import { ARABIC_TEXT_SOURCES, DB_CONFIG, SELF_LEARNING_CONFIG } from "@/config/site";
import {
  loadTranslations,
  passageKind,
  passageTranslationKey,
  translatePassageOnDemand,
  type PassageKind,
} from "@/lib/ai/sourceTranslation";
import { getDb } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";

const DAY_MS = 86_400_000;
const CANDIDATE_REFERENCES = 60;

interface Candidate {
  reference: string;
  content: string;
  kind: PassageKind;
  key: string;
}

async function frequentlyCitedReferences(): Promise<string[]> {
  const db = await getDb();
  const since = new Date(Date.now() - SELF_LEARNING_CONFIG.pretranslateLookbackDays * DAY_MS);
  const rows = await db
    .collection(DB_CONFIG.queryLogCollection)
    .aggregate<{ _id: string }>([
      { $match: { createdAt: { $gte: since } } },
      { $unwind: "$references" },
      { $group: { _id: "$references", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: CANDIDATE_REFERENCES },
    ])
    .toArray();
  return rows.map((row) => row._id);
}

async function untranslatedCandidates(references: string[]): Promise<Candidate[]> {
  if (references.length === 0) return [];
  const db = await getDb();
  const rows = await db
    .collection<{
      content: string;
      citation: { reference: string };
      metadata?: { restricted?: boolean };
    }>(DB_CONFIG.collection)
    .find(
      { sourceType: { $in: [...ARABIC_TEXT_SOURCES] }, "citation.reference": { $in: references } },
      { projection: { content: 1, "citation.reference": 1, "metadata.restricted": 1 } },
    )
    .toArray();

  const order = new Map(references.map((reference, index) => [reference, index]));
  const candidates = rows
    .filter((row) => !row.metadata?.restricted)
    .flatMap((row): Candidate[] => {
      const kind = passageKind(row.content);
      if (!kind) return [];
      return [
        {
          reference: row.citation.reference,
          content: row.content,
          kind,
          key: passageTranslationKey(row.content, kind),
        },
      ];
    })
    .sort((left, right) => (order.get(left.reference) ?? 0) - (order.get(right.reference) ?? 0));

  const cached = await loadTranslations(candidates.map((candidate) => candidate.key));
  return candidates.filter((candidate) => !cached.has(candidate.key));
}

export async function pretranslateFrequentPassages(dryRun: boolean): Promise<number> {
  if (!SELF_LEARNING_CONFIG.enabled) return 0;

  try {
    const pending = (await untranslatedCandidates(await frequentlyCitedReferences())).slice(
      0,
      SELF_LEARNING_CONFIG.pretranslatePerRun,
    );
    if (dryRun) return pending.length;

    const deadline = Date.now() + SELF_LEARNING_CONFIG.pretranslateBudgetMs;
    let translated = 0;
    for (const candidate of pending) {
      if (Date.now() >= deadline) break;
      const result = await translatePassageOnDemand(
        candidate.content,
        candidate.reference,
        candidate.kind,
      );
      if (result) translated += 1;
    }

    if (translated > 0) logger.info(`Pre-translated ${translated} frequently cited passages`);
    return translated;
  } catch (error) {
    logger.warn("Pre-translation skipped", { error: String(error).slice(0, 160) });
    return 0;
  }
}
