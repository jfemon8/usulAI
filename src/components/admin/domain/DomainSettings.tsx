"use client";

import { useState } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { useToast } from "@/components/admin/Dialog";
import {
  Button,
  Card,
  Field,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { SaveBar, useUnsavedWarning } from "@/components/admin/site/FormBits";
import { normalizeDomainUrl } from "@/lib/site/contentShape";

interface DomainResponse {
  settings: { url: string };
  updatedAt: string | null;
  updatedBy: string | null;
  fallbackUrl: string;
  effectiveUrl: string;
  limits: { domainChars: number };
}

const USES = [
  ["ইমেইলের লিংক", "পাসওয়ার্ড রিসেট, স্টাফ অ্যাকাউন্ট ও আলেমের উত্তরের মেইল"],
  ["SEO", "canonical ঠিকানা, Open Graph, sitemap.xml ও robots.txt"],
  ["মাসআলা", "প্রতিটি মাসআলার শেয়ার লিংক ও QAPage structured data"],
] as const;

export function DomainSettings() {
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<DomainResponse>(
    "/api/admin/domain",
  );
  const [source, setSource] = useState<DomainResponse | null>(null);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  if (data && data !== source) {
    setSource(data);
    setValue(data.settings.url);
  }

  const trimmed = value.trim();
  const normalized = trimmed ? normalizeDomainUrl(trimmed) : "";
  const invalid = trimmed.length > 0 && normalized === null;
  const dirty = Boolean(data && trimmed !== data.settings.url);
  useUnsavedWarning(dirty);

  if (error && !data) {
    return (
      <>
        <PageHeader title="ডোমেইন" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !data) {
    return (
      <>
        <PageHeader title="ডোমেইন" description="সাইটের নিজস্ব ঠিকানা" />
        <Skeleton rows={4} />
      </>
    );
  }

  const preview = normalized || data.fallbackUrl;

  async function save(next: string) {
    setSaving(true);
    try {
      const saved = await adminApi<DomainResponse>("/api/admin/domain", {
        method: "PUT",
        body: { url: next },
      });
      replace(saved);
      setValue(saved.settings.url);
      toast.success(
        saved.settings.url
          ? "ডোমেইন সংরক্ষিত হয়েছে। নতুন লিংক ও SEO ঠিকানা এখন থেকে এটিই ব্যবহার করবে।"
          : "ডোমেইন মুছে ফেলা হয়েছে। এখন ফলব্যাক ঠিকানা ব্যবহার হবে।",
      );
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="ডোমেইন"
        description="সাইটের নিজস্ব ঠিকানা, যেটি ইমেইলের লিংক থেকে শুরু করে SEO পর্যন্ত সব জায়গায় ব্যবহার হয়।"
      />
      <p className="-mt-3 mb-5 text-xs text-(--text-3)">
        {data.updatedAt
          ? `সর্বশেষ হালনাগাদ: ${formatWhen(data.updatedAt)}${data.updatedBy ? `, ${data.updatedBy}` : ""}`
          : "এখনো কোনো ডোমেইন সেট করা হয়নি, ফলব্যাক ঠিকানা চলছে।"}
      </p>

      <div className="flex flex-col gap-5">
        <Card title="নিজস্ব ডোমেইন" description="খালি রাখলে ফলব্যাক ঠিকানা ব্যবহার হবে">
          <div className="flex flex-col gap-4">
            <Field
              label="ঠিকানা"
              hint="যেমন usulai.com অথবা https://usulai.com। শুধু https চলবে, শেষে / বা কোনো পথ দেবেন না।"
              error={invalid ? "ঠিকানাটি সঠিক নয়। একটি ডোমেইন লিখুন, যেমন usulai.com।" : null}
            >
              {(id) => (
                <Input
                  id={id}
                  value={value}
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={data.limits.domainChars}
                  placeholder={data.fallbackUrl}
                  onChange={(event) => setValue(event.target.value)}
                />
              )}
            </Field>

            <dl className="flex flex-col gap-2 rounded-lg bg-(--surface-2) p-4 text-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-(--text-3)">এখন ব্যবহার হচ্ছে</dt>
                <dd className="font-mono text-[0.8125rem] break-all">{data.effectiveUrl}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-(--text-3)">সংরক্ষণ করলে হবে</dt>
                <dd className="font-mono text-[0.8125rem] break-all">{preview}</dd>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <dt className="text-(--text-3)">ফলব্যাক</dt>
                <dd className="font-mono text-[0.8125rem] break-all">{data.fallbackUrl}</dd>
              </div>
            </dl>

            <Notice tone="warn">
              ডোমেইনটি সেট করার আগে DNS ঠিক করে নিন এবং হোস্টিং প্যানেলে ডোমেইনটি যোগ করুন। ভুল
              ঠিকানা দিলে পাসওয়ার্ড রিসেটসহ সব ইমেইলের লিংক কাজ করবে না।
            </Notice>
          </div>
        </Card>

        <Card title="কোথায় কোথায় ব্যবহার হয়">
          <dl className="flex flex-col gap-3 text-sm">
            {USES.map(([title, detail]) => (
              <div key={title} className="flex flex-col gap-0.5">
                <dt className="font-medium">{title}</dt>
                <dd className="text-(--text-3)">{detail}</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>

      <SaveBar dirty={dirty}>
        {data.settings.url ? (
          <Button
            onClick={() => void save("")}
            disabled={saving}
            className="w-full sm:w-auto"
          >
            ডোমেইন সরান
          </Button>
        ) : null}
        <Button
          onClick={() => setValue(data.settings.url)}
          disabled={!dirty || saving}
          className="w-full sm:w-auto"
        >
          বাতিল
        </Button>
        <Button
          tone="primary"
          onClick={() => void save(trimmed)}
          loading={saving}
          disabled={!dirty || invalid}
          className="w-full sm:w-auto"
        >
          সংরক্ষণ করুন
        </Button>
      </SaveBar>
    </>
  );
}
