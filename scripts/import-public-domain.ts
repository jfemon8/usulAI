import "./loadEnv";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { gunzipSync } from "zlib";
import { PUBLIC_DOMAIN_BOOKS, type ArchiveBookSource, type PublicDomainBook } from "@/config/site";
import {
  convertArchiveOcr,
  convertGutenbergSira,
  convertWikisourceSira,
  pagesFromDjvuXml,
  pagesFromSearchText,
  type ArchiveOcrVolume,
  type PublicDomainConversion,
  type PublicDomainFrontMatter,
} from "@/lib/ingestion/sources/publicDomain";
import { logger } from "@/lib/utils/logger";

async function download(url: string): Promise<Buffer> {
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    const response = await fetch(url, { headers: { "user-agent": "UsulAI-importer/1.0" } });
    if (response.ok) return Buffer.from(await response.arrayBuffer());
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw new Error(`Download failed: ${url}`);
}

async function archiveVolumes(source: ArchiveBookSource): Promise<ArchiveOcrVolume[]> {
  const volumes: ArchiveOcrVolume[] = [];

  for (const { item, file, kind, fromLeaf, toLeaf, volume } of source.volumes) {
    const base = `https://archive.org/download/${item}/${encodeURIComponent(file)}`;
    const pages =
      kind === "searchtext"
        ? pagesFromSearchText(
            gunzipSync(await download(`${base}_hocr_searchtext.txt.gz`)).toString("utf8"),
            JSON.parse(
              gunzipSync(await download(`${base}_hocr_pageindex.json.gz`)).toString("utf8"),
            ) as number[][],
          )
        : pagesFromDjvuXml((await download(`${base}_djvu.xml`)).toString("utf8"));
    volumes.push({ pages, fromLeaf, toLeaf, volume });
  }

  return volumes;
}

async function convert(book: PublicDomainBook): Promise<PublicDomainConversion> {
  const meta: PublicDomainFrontMatter = {
    title: book.title,
    author: book.author,
    license: book.license,
    source: book.url,
    note: book.note,
  };

  if (book.format === "archive") {
    if (!book.archive) throw new Error(`${book.slug} needs its Internet Archive volumes`);
    return convertArchiveOcr(await archiveVolumes(book.archive), meta, {
      runningHead: new RegExp(book.archive.runningHead, book.archive.ignoreCaseHead ? "iu" : "u"),
      footnote: book.archive.footnote ? new RegExp(book.archive.footnote, "u") : undefined,
    });
  }

  const raw = (await download(book.url)).toString("utf8");

  if (book.format === "gutenberg") {
    if (!book.gutenberg) throw new Error(`${book.slug} needs Gutenberg start and end lines`);
    return convertGutenbergSira(raw, meta, book.gutenberg);
  }

  return convertWikisourceSira(raw, meta);
}

async function main() {
  const sources = process.argv.slice(2);
  const books = PUBLIC_DOMAIN_BOOKS.filter(
    (book) => sources.length === 0 || sources.includes(book.sourceType),
  );

  for (const book of books) {
    const directory = path.join(process.cwd(), "data", book.sourceType);
    await mkdir(directory, { recursive: true });

    const { markdown, chapters, pages } = await convert(book);

    await writeFile(path.join(directory, `${book.slug}.md`), markdown, "utf8");
    await writeFile(
      path.join(directory, `${book.slug}.json`),
      `${JSON.stringify(
        {
          title: book.title,
          author: book.author,
          edition: book.note,
          license: book.license,
          source: book.url,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );

    logger.info(
      `${book.sourceType}/${book.slug}: ${chapters} headings, ${pages} pages, ${markdown.length} characters`,
    );
  }
}

void main();
