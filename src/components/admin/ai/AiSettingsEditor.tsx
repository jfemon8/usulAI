"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  Field,
  LoadError,
  Notice,
  PageHeader,
  Skeleton,
  Textarea,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useAdminData } from "@/components/admin/useAdminData";
import { CharCount, SaveBar, Toggle, useUnsavedWarning } from "@/components/admin/site/FormBits";
import type { AiSettings } from "@/lib/site/contentShape";

interface ChainModel {
  tier: "primary" | "secondary" | "fallback" | "reserve";
  provider: string;
  modelId: string;
  keyName: string;
  keyConfigured: boolean;
  trusted: boolean;
  excludedFromAnswers: boolean;
}

interface AiResponse {
  settings: AiSettings;
  updatedAt: string | null;
  updatedBy: string | null;
  limits: { extraInstructionsChars: number };
  models: ChainModel[];
  filterIgnored: boolean;
}

const TIER_NAMES: Record<ChainModel["tier"], string> = {
  primary: "প্রথম স্তর",
  secondary: "দ্বিতীয় স্তর",
  fallback: "তৃতীয় স্তর",
  reserve: "শেষ স্তর",
};

const LONG_DASH = String.fromCharCode(0x2014);

function sameSettings(left: AiSettings, right: AiSettings): boolean {
  return (
    left.extraInstructions.trim() === right.extraInstructions &&
    left.verifiedAnswersEnabled === right.verifiedAnswersEnabled &&
    [...left.disabledModels].sort().join("|") === [...right.disabledModels].sort().join("|")
  );
}

export function AiSettingsEditor() {
  const toast = useToast();
  const { data, error, loading, reload, replace } = useAdminData<AiResponse>("/api/admin/ai");
  const [source, setSource] = useState<AiResponse | null>(null);
  const [form, setForm] = useState<AiSettings | null>(null);
  const [saving, setSaving] = useState(false);

  if (data && data !== source) {
    setSource(data);
    setForm({ ...data.settings, disabledModels: [...data.settings.disabledModels] });
  }

  const dirty = Boolean(form && data && !sameSettings(form, data.settings));
  useUnsavedWarning(dirty);

  if (error && !data) {
    return (
      <>
        <PageHeader title="AI সেটিংস" />
        <LoadError message={error} onRetry={reload} />
      </>
    );
  }

  if (loading || !data || !form) {
    return (
      <>
        <PageHeader title="AI সেটিংস" description="উত্তর তৈরির নির্দেশনা ও মডেল চেইন" />
        <Skeleton rows={5} />
      </>
    );
  }

  const limit = data.limits.extraInstructionsChars;
  const instructionsError =
    form.extraInstructions.length > limit
      ? `সর্বোচ্চ ${formatCount(limit)} অক্ষর।`
      : form.extraInstructions.includes(LONG_DASH)
        ? "লম্বা ড্যাশ ব্যবহার করবেন না; মডেল সেটা নকল করে উত্তরে লেখে।"
        : null;

  const disabled = new Set(form.disabledModels);
  const usable = data.models.filter((model) => model.keyConfigured);
  const allUsableDisabled =
    usable.length > 0 && usable.every((model) => disabled.has(model.modelId));
  const enabledUsable = usable.filter((model) => !disabled.has(model.modelId));
  const hasNotice = allUsableDisabled || enabledUsable.length === 1 || usable.length === 0;

  function toggleModel(modelId: string, enabled: boolean) {
    setForm((previous) => {
      if (!previous) return previous;
      const next = new Set(previous.disabledModels);
      if (enabled) next.delete(modelId);
      else next.add(modelId);
      return { ...previous, disabledModels: [...next] };
    });
  }

  async function save() {
    if (!form || instructionsError) return;
    setSaving(true);
    try {
      const saved = await adminApi<AiResponse>("/api/admin/ai", {
        method: "PUT",
        body: { ...form, extraInstructions: form.extraInstructions.trim() },
      });
      replace(saved);
      toast.success(
        "AI সেটিংস সংরক্ষিত হয়েছে। অন্য সার্ভার ইনস্ট্যান্সে এক মিনিটের মধ্যে কার্যকর হবে।",
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
        title="AI সেটিংস"
        description="প্রতিটি উত্তরে যোগ হওয়া অতিরিক্ত নির্দেশনা, কোন মডেল ব্যবহার হবে আর যাচাইকৃত উত্তরের ক্যাশ।"
      />
      <p className="-mt-3 mb-5 text-xs text-(--text-3)">
        {data.updatedAt
          ? `সর্বশেষ হালনাগাদ: ${formatWhen(data.updatedAt)}${data.updatedBy ? `, ${data.updatedBy}` : ""}`
          : "এখনো কিছু সংরক্ষণ করা হয়নি, ডিফল্ট সেটিংস চলছে।"}
      </p>

      <div className="flex flex-col gap-5">
        <Card
          title="অতিরিক্ত নির্দেশনা"
          description="সিস্টেম প্রম্পটের শেষে আলাদা অংশ হিসেবে যোগ হয়"
        >
          <div className="flex flex-col gap-4">
            <Notice tone="warn">
              এই লেখা প্রতিটি উত্তরের নির্দেশনায় যোগ হয়। রেফারেন্স দেওয়া, প্রশ্নের ভাষায় উত্তর
              দেওয়া, আরবি হুবহু রাখা বা Context-এর বাইরে কিছু না বলার নিয়মের বিরোধী কিছু লিখবেন
              না; বিরোধ হলে মডেলকে মূল নিয়মই মানতে বলা হয়। ছোট, স্পষ্ট বাংলা বাক্যে লিখুন।
            </Notice>
            <Field
              label="নির্দেশনা"
              hint={<CharCount value={form.extraInstructions} max={limit} />}
              error={instructionsError}
            >
              {(id) => (
                <Textarea
                  id={id}
                  rows={8}
                  value={form.extraInstructions}
                  placeholder="যেমন: উত্তরের শেষে সংক্ষেপে একটি দোয়া বা নসিহত যোগ করো, তবে Context-এর দলিল থেকেই।"
                  onChange={(event) =>
                    setForm((previous) =>
                      previous ? { ...previous, extraInstructions: event.target.value } : previous,
                    )
                  }
                />
              )}
            </Field>
          </div>
        </Card>

        <Card
          title="মডেল চেইন"
          description="উত্তর, প্রশ্ন পুনর্লিখন, পুনর্বাছাই ও অনুবাদ এই ক্রমে মডেলগুলো চেষ্টা করে"
          padded={false}
        >
          {hasNotice ? (
            <div className="flex flex-col gap-3 p-4 sm:p-5">
              {allUsableDisabled ? (
                <Notice tone="danger">
                  চাবি আছে এমন সব মডেল বন্ধ করা হয়েছে। চ্যাট যেন বন্ধ না হয়ে যায় তাই এই অবস্থায়
                  বন্ধ তালিকা উপেক্ষা করে সব মডেল ব্যবহার হবে।
                </Notice>
              ) : enabledUsable.length === 1 ? (
                <Notice tone="warn">
                  শুধু একটি মডেল চালু আছে। সেটি ব্যর্থ হলে পাঠক কোনো উত্তর পাবেন না।
                </Notice>
              ) : null}
              {usable.length === 0 ? (
                <Notice tone="danger">কোনো মডেলের API চাবি সেট করা নেই।</Notice>
              ) : null}
            </div>
          ) : null}
          <ul
            className={clsx(
              "divide-y divide-(--border)",
              hasNotice && "border-t border-(--border)",
            )}
          >
            {data.models.map((model, index) => {
              const enabled = !disabled.has(model.modelId);
              return (
                <li
                  key={`${model.tier}-${model.modelId}`}
                  className={clsx("px-4 py-3.5 sm:px-5", !model.keyConfigured && "opacity-70")}
                >
                  <Toggle
                    checked={enabled}
                    onChange={(value) => toggleModel(model.modelId, value)}
                    label={
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="font-mono text-[0.8125rem] break-all">
                          {formatCount(index + 1)}. {model.modelId}
                        </span>
                        <span className="flex flex-wrap gap-1.5">
                          <Badge>{TIER_NAMES[model.tier]}</Badge>
                          <Badge>{model.provider}</Badge>
                          {model.keyConfigured ? (
                            <Badge tone="accent">চাবি আছে</Badge>
                          ) : (
                            <Badge tone="danger">চাবি নেই</Badge>
                          )}
                          {model.trusted ? <Badge tone="accent">সরাসরি স্ট্রিম</Badge> : null}
                          {model.excludedFromAnswers ? (
                            <Badge tone="warn">উত্তরে ব্যবহার হয় না</Badge>
                          ) : null}
                        </span>
                      </span>
                    }
                    description={
                      model.keyConfigured
                        ? enabled
                          ? undefined
                          : "বন্ধ: চেইন থেকে বাদ থাকবে।"
                        : `${model.keyName} সেট না থাকায় এই মডেল এমনিতেই ব্যবহার হয় না।`
                    }
                  />
                </li>
              );
            })}
          </ul>
        </Card>

        <Card title="যাচাইকৃত উত্তর">
          <Toggle
            label="যাচাইকৃত উত্তরের ক্যাশ ব্যবহার করুন"
            description="চালু থাকলে আলেমের অনুমোদিত বা বারবার সমর্থিত উত্তর হুবহু দেখানো হয়, মডেল ডাকা হয় না। বন্ধ করলে প্রতিটি প্রশ্নের উত্তর নতুন করে তৈরি হবে।"
            checked={form.verifiedAnswersEnabled}
            onChange={(verifiedAnswersEnabled) =>
              setForm((previous) => (previous ? { ...previous, verifiedAnswersEnabled } : previous))
            }
          />
        </Card>
      </div>

      <SaveBar dirty={dirty}>
        <Button
          onClick={() =>
            setForm({ ...data.settings, disabledModels: [...data.settings.disabledModels] })
          }
          disabled={!dirty || saving}
          className="w-full sm:w-auto"
        >
          বাতিল
        </Button>
        <Button
          tone="primary"
          onClick={() => void save()}
          loading={saving}
          disabled={!dirty || Boolean(instructionsError)}
          className="w-full sm:w-auto"
        >
          সংরক্ষণ করুন
        </Button>
      </SaveBar>
    </>
  );
}
