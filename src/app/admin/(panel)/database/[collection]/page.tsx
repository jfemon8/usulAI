import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CollectionBrowser } from "@/components/admin/database/CollectionBrowser";
import { COLLECTION_NAME_PATTERN, isProtectedCollection } from "@/lib/admin/database";

type SearchParams = Record<string, string | string[] | undefined>;

interface Props {
  params: Promise<{ collection: string }>;
  searchParams: Promise<SearchParams>;
}

function collectionName(raw: string): string | null {
  let name = raw;
  try {
    name = decodeURIComponent(raw);
  } catch {
    return null;
  }
  return COLLECTION_NAME_PATTERN.test(name) && !isProtectedCollection(name) ? name : null;
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const name = collectionName((await params).collection);
  return { title: name ? `${name} · ডাটাবেস` : "ডাটাবেস" };
}

export default async function AdminCollectionPage({ params, searchParams }: Props) {
  const name = collectionName((await params).collection);
  if (!name) notFound();

  const query = await searchParams;

  return (
    <CollectionBrowser
      key={name}
      collection={name}
      initial={{
        filter: single(query.filter),
        sort: single(query.sort),
        dir: single(query.dir) === "asc" ? "asc" : "desc",
      }}
    />
  );
}
