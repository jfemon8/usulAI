import "./loadEnv";
import { QURANENC_CONFIG } from "@/config/site";
import { getDocumentsCollection, getMongoClient } from "@/lib/db/mongoClient";
import { logger } from "@/lib/utils/logger";

interface QuranEncAyah {
  sura: string;
  aya: string;
  translation: string;
  footnotes?: string | null;
}

const SURAH_COUNT = 114;

async function fetchSurah(surah: number): Promise<QuranEncAyah[]> {
  const url = `${QURANENC_CONFIG.baseUrl}/translation/sura/${QURANENC_CONFIG.translationKey}/${surah}`;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return ((await response.json()) as { result: QuranEncAyah[] }).result;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }

  throw new Error(`QuranEnc surah ${surah} failed after retries`);
}

async function main() {
  const collection = await getDocumentsCollection();
  await collection.createIndex({ sourceType: 1, "metadata.surah": 1, "metadata.ayah": 1 });

  const retrievedAt = new Date().toISOString();
  let updated = 0;
  let ayahs = 0;

  for (let surah = 1; surah <= SURAH_COUNT; surah += 1) {
    const verses = await fetchSurah(surah);
    ayahs += verses.length;

    const result = await collection.bulkWrite(
      verses.map((verse) => ({
        updateOne: {
          filter: {
            sourceType: "quran" as const,
            "metadata.surah": Number(verse.sura),
            "metadata.ayah": Number(verse.aya),
            $or: [
              { "metadata.quranenc.translation": { $ne: verse.translation } },
              { "metadata.quranenc.footnotes": { $ne: verse.footnotes ?? "" } },
            ],
          },
          update: {
            $set: {
              "metadata.quranenc": {
                key: QURANENC_CONFIG.translationKey,
                translation: verse.translation,
                footnotes: verse.footnotes ?? "",
                source: "QuranEnc.com",
                retrievedAt,
              },
            },
          },
        },
      })),
      { ordered: false },
    );

    updated += result.modifiedCount;
    if (surah % 10 === 0)
      logger.info(`QuranEnc: ${surah}/${SURAH_COUNT} surahs, ${updated} ayahs stored`);
    await new Promise((resolve) => setTimeout(resolve, QURANENC_CONFIG.requestDelayMs));
  }

  logger.info(`QuranEnc import finished: ${ayahs} ayahs fetched, ${updated} documents updated`);
  await (await getMongoClient()).close();
}

void main();
