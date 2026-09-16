import Link from "next/link";
import { authorLabel } from "@/components/masail/MasailChrome";
import type { MasalaSummary } from "@/lib/analytics/verifiedAnswers";

export function RelatedMasail({
  items,
  heading = "সম্পর্কিত মাসআলা",
  bare = false,
}: {
  items: MasalaSummary[];
  heading?: string;
  bare?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <section
      aria-labelledby="related-masail"
      className={bare ? "" : "mt-10 border-t border-(--border) pt-6"}
    >
      <h2
        id="related-masail"
        className={
          bare
            ? "sr-only"
            : "text-lg font-semibold tracking-tight text-(--text-1)"
        }
      >
        {heading}
      </h2>
      <ul className={bare ? "flex flex-col gap-3" : "mt-4 flex flex-col gap-3"}>
        {items.map((item) => {
          const author = authorLabel(item.author);
          return (
            <li key={item.id}>
              <Link
                href={item.path}
                className="block rounded-xl border border-(--border) px-4 py-3 transition hover:bg-(--surface-2)"
              >
                <span className="block font-medium text-balance text-(--text-1)">
                  {item.question}
                </span>
                <span className="mt-1 block line-clamp-2 text-sm text-(--text-3)">
                  {item.excerpt}
                </span>
                {author ? (
                  <span className="mt-1 block text-xs text-(--text-3)">{author}</span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
