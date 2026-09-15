import type { Metadata } from "next";
import { CorpusEditor } from "@/components/admin/corpus/CorpusEditor";
import { isSourceType } from "@/lib/admin/corpus";

export const metadata: Metadata = { title: "নতুন দলিল" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function NewCorpusDocumentPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { source } = await searchParams;
  const value = Array.isArray(source) ? source[0] : source;
  return <CorpusEditor {...(isSourceType(value) ? { initialSource: value } : {})} />;
}
