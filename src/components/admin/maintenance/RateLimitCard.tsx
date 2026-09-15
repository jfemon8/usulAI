"use client";

import { useCallback, useState } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  formatCount,
  formatWhen,
  LoadError,
  Skeleton,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { RetryIcon } from "@/components/ui/Icons";
import type { RateLimitClient, RateLimitList } from "@/lib/admin/maintenance";

const SCOPE_NAMES: Record<string, string> = {
  chat: "চ্যাটে প্রশ্ন",
  feedback: "মতামত",
  maintenance: "স্বয়ংক্রিয় রক্ষণাবেক্ষণ",
  sourceView: "সূত্র দেখা",
  usage: "ব্যবহারের হিসাব",
  admin: "অ্যাডমিন প্যানেল",
  adminLogin: "স্টাফ লগইন",
  adminReset: "পাসওয়ার্ড রিসেট",
  helpRequest: "আলেমের কাছে প্রশ্ন পাঠানো",
  helpTrack: "প্রশ্নের অবস্থা দেখা",
  masail: "মাসআলা পাতা",
};

function Count({ value, limit }: { value: number; limit: number | undefined }) {
  const over = limit !== undefined && value > limit;
  const near = limit !== undefined && !over && value >= limit * 0.8;
  return (
    <span
      className={clsx(
        "tabular-nums",
        over ? "font-semibold text-(--danger)" : near ? "text-(--warn)" : "text-(--text-1)",
      )}
    >
      {formatCount(value)}
      {limit !== undefined ? <span className="text-(--text-3)">/{formatCount(limit)}</span> : null}
    </span>
  );
}

export function RateLimitCard() {
  const toast = useToast();
  const list = useAdminData<RateLimitList>("/api/admin/maintenance/rate-limits");
  const [target, setTarget] = useState<{ scope: string; client: RateLimitClient } | null>(null);
  const [busy, setBusy] = useState(false);
  const close = useCallback(() => setTarget(null), []);

  async function unblock() {
    if (!target) return;
    setBusy(true);
    try {
      await adminApi("/api/admin/maintenance/rate-limits", {
        method: "DELETE",
        body: { id: target.client.id },
      });
      toast.success("হিসাব মুছে দেওয়া হয়েছে, এই ক্লায়েন্ট আবার ব্যবহার করতে পারবে।");
      setTarget(null);
      list.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const scopes = list.data?.scopes ?? [];

  return (
    <Card
      title="অনুরোধের সীমা"
      description="আজ কোন ক্লায়েন্ট কোন কাজে সবচেয়ে বেশি অনুরোধ করেছে। ক্লায়েন্ট মানে IP-এর লবণযুক্ত হ্যাশ, IP কোথাও জমা থাকে না। সীমা পার হওয়া কাউকে ভুল করে আটকানো হলে ব্লক খুলে দিতে পারেন।"
      actions={
        <Button
          size="sm"
          onClick={list.reload}
          loading={list.loading && list.data !== null}
          icon={<RetryIcon className="h-4 w-4" />}
        >
          হালনাগাদ
        </Button>
      }
    >
      {list.error && !list.data ? <LoadError message={list.error} onRetry={list.reload} /> : null}
      {list.loading && !list.data ? <Skeleton rows={3} /> : null}
      {list.data && scopes.length === 0 ? <EmptyState title="আজ কোনো অনুরোধের হিসাব নেই" /> : null}
      {scopes.length > 0 ? (
        <div className="flex flex-col gap-5">
          {scopes.map((scope) => (
            <section key={scope.scope}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="text-sm font-semibold text-(--text-1)">
                  {SCOPE_NAMES[scope.scope] ?? scope.scope}
                </h3>
                {scope.limits ? (
                  <p className="text-xs text-(--text-3) tabular-nums">
                    সীমা: মিনিটে {formatCount(scope.limits.minute)}, ঘণ্টায়{" "}
                    {formatCount(scope.limits.hour)}, দিনে {formatCount(scope.limits.day)}
                  </p>
                ) : null}
              </div>
              <ul className="flex flex-col divide-y divide-(--border) rounded-xl border border-(--border)">
                {scope.clients.map((client) => (
                  <li
                    key={client.id}
                    className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:gap-4"
                  >
                    <div className="flex min-w-0 flex-wrap items-center gap-1.5 sm:w-44 sm:shrink-0">
                      <span className="font-mono text-xs break-all text-(--text-2)">
                        {client.client}
                      </span>
                      {client.blocked ? <Badge tone="danger">আটকানো</Badge> : null}
                    </div>
                    <dl className="grid flex-1 grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-(--text-3)">এই মিনিটে</dt>
                        <dd>
                          <Count
                            value={client.minute}
                            limit={client.shared ? undefined : scope.limits?.minute}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-(--text-3)">এই ঘণ্টায়</dt>
                        <dd>
                          <Count
                            value={client.hour}
                            limit={client.shared ? undefined : scope.limits?.hour}
                          />
                        </dd>
                      </div>
                      <div>
                        <dt className="text-(--text-3)">আজ</dt>
                        <dd>
                          <Count
                            value={client.day}
                            limit={client.shared ? undefined : scope.limits?.day}
                          />
                        </dd>
                      </div>
                    </dl>
                    <Button
                      size="sm"
                      tone={client.blocked ? "primary" : "ghost"}
                      onClick={() => setTarget({ scope: scope.scope, client })}
                      className="self-end sm:self-auto"
                    >
                      {client.shared ? "হিসাব শূন্য করুন" : "ব্লক খুলুন"}
                    </Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {list.data ? (
            <p className="text-xs text-(--text-3)">
              হিসাবের সময়: {formatWhen(list.data.generatedAt)}। প্রতিটি কাজে সবচেয়ে বেশি
              অনুরোধকারী দশটি ক্লায়েন্ট দেখানো হয়।
            </p>
          ) : null}
        </div>
      ) : null}

      <ConfirmDialog
        open={target !== null}
        title="এই ক্লায়েন্টের হিসাব মুছবেন?"
        message={
          target ? (
            <>
              <span className="block">
                {SCOPE_NAMES[target.scope] ?? target.scope} ·{" "}
                <span className="font-mono">{target.client.client}</span>
              </span>
              <span className="mt-2 block">
                মিনিট, ঘণ্টা ও দিনের গণনা শূন্য হয়ে যাবে এবং সঙ্গে সঙ্গে আবার অনুরোধ করা যাবে।
                অপব্যবহার চলতে থাকলে আবার আটকে যাবে।
              </span>
            </>
          ) : null
        }
        confirmLabel={target?.client.shared ? "শূন্য করুন" : "ব্লক খুলুন"}
        tone="primary"
        busy={busy}
        onConfirm={() => void unblock()}
        onClose={close}
      />
    </Card>
  );
}
