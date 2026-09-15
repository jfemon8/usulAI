"use client";

import type { ReactNode } from "react";
import { clsx } from "clsx";
import { FileTextIcon, FolderIcon, ImageIcon, LockIcon } from "@/components/ui/Icons";
import { STORAGE_CONFIG } from "@/config/site";
import type {
  AssetDetails,
  AssetSummary,
  DeliveryType,
  ResourceType,
  UsageSummary,
} from "@/lib/admin/cloudinaryAdmin";

export type { AssetDetails, AssetSummary, DeliveryType, ResourceType, UsageSummary };

export const RESOURCE_OPTIONS: { value: ResourceType; label: string }[] = [
  { value: "raw", label: "ডকুমেন্ট (raw)" },
  { value: "image", label: "ছবি (image)" },
  { value: "video", label: "ভিডিও (video)" },
];

export const DELIVERY_OPTIONS: { value: DeliveryType; label: string; hint: string }[] = [
  { value: "upload", label: "পাবলিক (upload)", hint: "লিংক থাকলে যে কেউ দেখতে পারে।" },
  {
    value: "authenticated",
    label: "সুরক্ষিত (authenticated)",
    hint: "শুধু সাইন করা লিংকে খোলে। কপিরাইটযুক্ত বইয়ের জন্য।",
  },
  {
    value: "private",
    label: "প্রাইভেট (private)",
    hint: "মূল ফাইল শুধু সাইন করা ডাউনলোড লিংকে পাওয়া যায়।",
  },
];

export function resourceLabel(value: ResourceType): string {
  return RESOURCE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function deliveryLabel(value: DeliveryType): string {
  return DELIVERY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function assetKey(asset: {
  publicId: string;
  resourceType: ResourceType;
  type: DeliveryType;
}): string {
  return `${asset.resourceType}|${asset.type}|${asset.publicId}`;
}

export function joinFolder(folder: string, name: string): string {
  const clean = name.replace(/^\/+|\/+$/g, "");
  return folder ? (clean ? `${folder}/${clean}` : folder) : clean;
}

export function isProtectedPath(value: string): boolean {
  const prefix = STORAGE_CONFIG.rawSourcesPrefix;
  const trimmed = value.trim().replace(/^\/+/, "");
  return trimmed === prefix || trimmed.startsWith(`${prefix}/`);
}

export function resourceTypeForFile(file: File): ResourceType {
  if (file.type.startsWith("image/") && file.type !== "image/svg+xml") return "image";
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return "video";
  return "raw";
}

export function maxBytesFor(resourceType: ResourceType, usage: UsageSummary | null): number | null {
  const limits = usage?.mediaLimits;
  if (!limits) return null;
  if (resourceType === "image") return limits.imageMaxBytes;
  if (resourceType === "video") return limits.videoMaxBytes;
  return limits.rawMaxBytes;
}

export function ProtectedWarning({ children }: { children?: ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl bg-(--warn-soft) px-3.5 py-3 text-sm leading-6 text-(--warn)"
    >
      <LockIcon className="mt-1 h-4 w-4 shrink-0" />
      <div className="min-w-0 break-words">
        <p className="font-medium">সতর্কতা: এটি অ্যাপের মূল উৎস ফাইল</p>
        <p>
          {STORAGE_CONFIG.rawSourcesPrefix}/ ফোল্ডারে দলিল ভান্ডারের মূল বই (কপিরাইটযুক্ত সুরক্ষিত
          বইসহ) এবং হাদিসের মান-সংক্রান্ত আর্কাইভ রাখা আছে। মুছে ফেললে বা নাম বদলালে সোর্স ভিউয়ার ও
          ইনজেশনের আর্কাইভ লিংক ভেঙে যেতে পারে।
        </p>
        {children}
      </div>
    </div>
  );
}

export function FileKindIcon({
  resourceType,
  type,
  className,
}: {
  resourceType: ResourceType | "folder";
  type?: DeliveryType;
  className?: string;
}) {
  const Icon =
    resourceType === "folder" ? FolderIcon : resourceType === "raw" ? FileTextIcon : ImageIcon;
  return (
    <span className={clsx("relative inline-flex", className)}>
      <Icon className="h-full w-full" />
      {type && type !== "upload" ? (
        <span className="absolute -right-1 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full bg-(--bg) text-(--warn)">
          <LockIcon className="h-3 w-3" />
        </span>
      ) : null}
    </span>
  );
}
