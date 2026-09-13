import "./loadEnv";
import { HADITH_BOOKS, STORAGE_CONFIG } from "@/config/site";
import { getDocumentsCollection, getMongoClient } from "@/lib/db/mongoClient";
import type { HadithGrade } from "@/lib/ai/hadithGrade";
import { downloadRawDocument, getRawDocumentUrl, uploadRawDocument } from "@/lib/storage";
import { logger } from "@/lib/utils/logger";

const EDITION_URL = (slug: string) =>
  `https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/eng-${slug}.min.json`;

const BATCH_SIZE = 1000;

interface EditionHadith {
  hadithnumber: number | string;
  grades?: { name?: string; grade?: string }[];
}

async function fetchGrades(slug: string): Promise<Map<string, HadithGrade[]>> {
  const response = await fetch(EDITION_URL(slug));
  if (!response.ok) throw new Error(`eng-${slug} fetch failed: ${response.status}`);

  const edition = (await response.json()) as { hadiths: EditionHadith[] };
  const grades = new Map<string, HadithGrade[]>();

  for (const hadith of edition.hadiths) {
    const entries = (hadith.grades ?? [])
      .filter((entry) => entry.name && entry.grade)
      .map((entry) => ({ name: entry.name!.trim(), grade: entry.grade!.trim() }));

    if (entries.length > 0) grades.set(String(hadith.hadithnumber), entries);
  }

  return grades;
}

async function main() {
  const collection = await getDocumentsCollection();
  await collection.createIndex({
    sourceType: 1,
    "metadata.collection": 1,
    "metadata.hadithNumber": 1,
  });
  const retrievedAt = new Date().toISOString();
  let updatedTotal = 0;

  for (const book of HADITH_BOOKS) {
    const grades = await fetchGrades(book.slug);

    if (grades.size === 0) {
      logger.info(`${book.slug}: no grades published, skipped`);
      continue;
    }

    const gradesJson = JSON.stringify(Object.fromEntries(grades));
    const archivePath = `hadith/grades/${book.slug}.json`;
    const archiveKey = `${STORAGE_CONFIG.rawSourcesPrefix}/${archivePath}`;
    const previous = await downloadRawDocument(archiveKey)
      .then((buffer) =>
        JSON.stringify((JSON.parse(buffer.toString("utf8")) as { grades?: unknown }).grades),
      )
      .catch(() => null);

    if (previous === gradesJson) {
      logger.info(`${book.slug}: archived grades unchanged, not re-uploading`);
    } else {
      const archive = {
        source: "fawazahmed0/hadith-api",
        edition: `eng-${book.slug}`,
        license: "Unlicense",
        url: EDITION_URL(book.slug),
        retrievedAt,
        grades: JSON.parse(gradesJson) as unknown,
      };
      await uploadRawDocument(archivePath, Buffer.from(JSON.stringify(archive)));
    }

    const operations = [...grades].map(([hadithNumber, entries]) => ({
      updateMany: {
        filter: {
          sourceType: "hadith" as const,
          "metadata.collection": book.slug,
          "metadata.hadithNumber": hadithNumber,
          "metadata.grades": { $ne: entries },
        },
        update: { $set: { "metadata.grades": entries } },
      },
    }));

    let updated = 0;
    for (let start = 0; start < operations.length; start += BATCH_SIZE) {
      const result = await collection.bulkWrite(operations.slice(start, start + BATCH_SIZE), {
        ordered: false,
      });
      updated += result.modifiedCount;
    }

    updatedTotal += updated;
    logger.info(`${book.slug}: ${grades.size} graded narrations, ${updated} documents updated`, {
      archive: getRawDocumentUrl(archiveKey),
    });
  }

  logger.info(`Grades backfilled on ${updatedTotal} documents`);
  await (await getMongoClient()).close();
}

void main();
