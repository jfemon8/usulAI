import type { Metadata } from "next";
import { CorpusBrowser } from "@/components/admin/corpus/CorpusBrowser";
import { isSourceType } from "@/lib/admin/corpus";

export const metadata: Metadata = { title: "দলিল ভান্ডার" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CorpusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const source = first(params.source);
  return (
    <CorpusBrowser
      initialSource={isSourceType(source) ? source : ""}
      initialQuery={first(params.q).trim().slice(0, 200)}
    />
  );
}
