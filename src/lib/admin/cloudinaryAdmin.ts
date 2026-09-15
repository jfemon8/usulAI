import { z, ZodError } from "zod";
import { ADMIN_CONFIG, STORAGE_CONFIG } from "@/config/site";
import { AdminError } from "@/lib/admin/http";
import { cloudinaryClient } from "@/lib/storage";
import { getStorageEnv } from "@/lib/utils/env";
import { logger } from "@/lib/utils/logger";

export const RESOURCE_TYPES = ["image", "video", "raw"] as const;
export const DELIVERY_TYPES = ["upload", "private", "authenticated"] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];
export type DeliveryType = (typeof DELIVERY_TYPES)[number];

export const resourceTypeSchema = z.enum(RESOURCE_TYPES);
export const deliveryTypeSchema = z.enum(DELIVERY_TYPES);
export const assetRefSchema = z.object({
  publicId: z.string().trim().min(1).max(255),
  resourceType: resourceTypeSchema,
  type: deliveryTypeSchema,
});

export const FILE_LIMITS = {
  maxPublicIdChars: 255,
  maxTagChars: 64,
  maxTags: 30,
  maxBulkItems: 100,
  maxSearchChars: 120,
  maxCursorChars: 512,
  scanPageSize: 500,
  scanMaxPages: 6,
  scanTtlMs: 20_000,
  scanCacheEntries: 40,
  thumbnailSize: 240,
  previewWidth: 960,
  signedUrlSeconds: 3600,
} as const;

export interface AssetSummary {
  publicId: string;
  name: string;
  folder: string;
  resourceType: ResourceType;
  type: DeliveryType;
  format: string | null;
  bytes: number;
  width: number | null;
  height: number | null;
  createdAt: string | null;
  tags: string[];
  secureUrl: string | null;
  thumbnailUrl: string | null;
}

export interface AssetDetails extends AssetSummary {
  assetFolder: string | null;
  displayName: string | null;
  version: number | null;
  pages: number | null;
  duration: number | null;
  accessMode: string | null;
  previewUrl: string | null;
}

export interface FolderEntry {
  name: string;
  path: string;
  assets: number;
  bytes: number;
  real: boolean;
}

export interface FolderListing {
  path: string;
  resourceType: ResourceType;
  type: DeliveryType;
  folders: FolderEntry[];
  assets: AssetSummary[];
  total: number;
  nextCursor: string | null;
  truncated: boolean;
}

export interface SearchListing {
  assets: AssetSummary[];
  total: number;
  nextCursor: string | null;
}

export interface UsageMetric {
  usage: number;
  limit: number | null;
  usedPercent: number | null;
  creditsUsage: number | null;
}

export interface UsageSummary {
  plan: string | null;
  lastUpdated: string | null;
  storage: UsageMetric | null;
  bandwidth: UsageMetric | null;
  transformations: UsageMetric | null;
  credits: { usage: number; limit: number | null; usedPercent: number | null } | null;
  resources: number | null;
  derivedResources: number | null;
  mediaLimits: {
    imageMaxBytes: number | null;
    videoMaxBytes: number | null;
    rawMaxBytes: number | null;
  } | null;
}

export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  uploadUrl: string;
  publicId: string;
  folder: string;
  resourceType: ResourceType;
  type: DeliveryType;
  timestamp: number;
  signature: string;
  fields: Record<string, string>;
}

const FORBIDDEN_CHARACTERS = new Set([
  "?",
  "&",
  "#",
  "%",
  "\\",
  "<",
  ">",
  '"',
  "'",
  "`",
  "{",
  "}",
  "|",
  "^",
  "*",
  ":",
  ",",
  "~",
]);

function isInvisible(code: number): boolean {
  return (
    code < 0x20 ||
    code === 0x7f ||
    (code >= 0x80 && code < 0xa0) ||
    (code >= 0x200b && code <= 0x200f) ||
    (code >= 0x2028 && code <= 0x202e) ||
    code === 0x061c ||
    code === 0xfeff
  );
}

export function hasForbiddenCharacter(value: string): boolean {
  for (const char of value) {
    if (FORBIDDEN_CHARACTERS.has(char) || isInvisible(char.codePointAt(0) ?? 0)) return true;
  }
  return false;
}

function segmentsOf(input: string, label: string): string[] {
  const segments = input
    .normalize("NFC")
    .replace(/\\/g, "/")
    .split("/")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);

  for (const segment of segments) {
    if (segment === "." || segment === "..") {
      throw new AdminError(`${label}-এ "." বা ".." অংশ ব্যবহার করা যাবে না।`);
    }
    if (hasForbiddenCharacter(segment)) {
      throw new AdminError(
        `${label}-এ ? & # % \\ < > " ' \` { } | ^ * : , ~ বা অদৃশ্য অক্ষর ব্যবহার করা যাবে না।`,
      );
    }
  }
  return segments;
}

export function normalizeFolderPath(input: string | null | undefined): string {
  const path = segmentsOf(input ?? "", "ফোল্ডারের পথ").join("/");
  if (path.length > FILE_LIMITS.maxPublicIdChars) {
    throw new AdminError(`ফোল্ডারের পথ ${FILE_LIMITS.maxPublicIdChars} অক্ষরের বেশি হতে পারবে না।`);
  }
  return path;
}

export function normalizePublicId(input: string | null | undefined): string {
  const publicId = segmentsOf(input ?? "", "public ID").join("/");
  if (!publicId) throw new AdminError("public ID খালি রাখা যাবে না।");
  if (publicId.length > FILE_LIMITS.maxPublicIdChars) {
    throw new AdminError(`public ID ${FILE_LIMITS.maxPublicIdChars} অক্ষরের বেশি হতে পারবে না।`);
  }
  return publicId;
}

export function joinPath(folder: string, name: string): string {
  return folder ? `${folder}/${name}` : name;
}

export function parentFolder(publicId: string): string {
  const index = publicId.lastIndexOf("/");
  return index === -1 ? "" : publicId.slice(0, index);
}

export function baseName(publicId: string): string {
  return publicId.slice(publicId.lastIndexOf("/") + 1);
}

export function isProtectedPath(value: string): boolean {
  const prefix = STORAGE_CONFIG.rawSourcesPrefix;
  const trimmed = value.replace(/^\/+/, "");
  return trimmed === prefix || trimmed.startsWith(`${prefix}/`);
}

function splitExtension(fileName: string): { stem: string; extension: string } {
  const index = fileName.lastIndexOf(".");
  if (index <= 0 || index === fileName.length - 1) return { stem: fileName, extension: "" };
  return { stem: fileName.slice(0, index), extension: fileName.slice(index + 1) };
}

function safeFileStem(value: string): string {
  let result = "";
  for (const char of value.normalize("NFC")) {
    if (char === "/" || /\s/u.test(char) || hasForbiddenCharacter(char)) result += "_";
    else result += char;
  }
  return result.replace(/_+/g, "_").replace(/^[_.]+|_+$/g, "");
}

export function uploadPublicId(
  folder: string,
  fileName: string,
  resourceType: ResourceType,
  custom?: string | null,
): string {
  const { stem, extension } = splitExtension(baseName(fileName.replace(/\\/g, "/")));
  const cleanExtension = safeFileStem(extension).toLowerCase();

  if (custom && custom.trim()) {
    let name = normalizePublicId(custom);
    const last = splitExtension(baseName(name));
    if (resourceType === "raw") {
      if (!last.extension && cleanExtension) name = `${name}.${cleanExtension}`;
    } else if (last.extension && last.extension.toLowerCase() === cleanExtension) {
      name = joinPath(parentFolder(name), last.stem);
    }
    return normalizePublicId(joinPath(folder, name));
  }

  const safeStem = safeFileStem(stem) || "file";
  const name =
    resourceType === "raw" && cleanExtension ? `${safeStem}.${cleanExtension}` : safeStem;
  return normalizePublicId(joinPath(folder, name));
}

export function normalizeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  for (const raw of tags) {
    const tag = raw.normalize("NFC").trim();
    if (!tag) continue;
    if (tag.length > FILE_LIMITS.maxTagChars) {
      throw new AdminError(`ট্যাগ ${FILE_LIMITS.maxTagChars} অক্ষরের বেশি হতে পারবে না।`);
    }
    if (hasForbiddenCharacter(tag) || tag.includes("/")) {
      throw new AdminError(`"${tag.slice(0, 30)}" ট্যাগে অনুমোদিত নয় এমন অক্ষর আছে।`);
    }
    seen.add(tag);
  }
  if (seen.size > FILE_LIMITS.maxTags) {
    throw new AdminError(`একটি ফাইলে সর্বোচ্চ ${FILE_LIMITS.maxTags}টি ট্যাগ রাখা যায়।`);
  }
  return [...seen];
}

export function searchTokens(term: string): string[] {
  return term
    .normalize("NFC")
    .slice(0, FILE_LIMITS.maxSearchChars)
    .split(/\s+/u)
    .map((token) => token.replace(/[^\p{L}\p{N}\p{M}_./-]/gu, "").replace(/^[-.]+/, ""))
    .filter((token) => token.length > 0 && !/^(AND|OR|NOT|TO)$/.test(token))
    .slice(0, 6);
}

export function buildSearchExpression(options: {
  term: string;
  resourceType?: ResourceType | null;
  type?: DeliveryType | null;
  folder?: string | null;
}): string {
  const tokens = searchTokens(options.term);
  if (tokens.length === 0) throw new AdminError("খোঁজার জন্য অন্তত একটি শব্দ লিখুন।");

  const clauses = tokens.map(
    (token) => `(filename:${token}* OR public_id:${token}* OR tags=${token} OR ${token}*)`,
  );
  if (options.resourceType) clauses.push(`resource_type:${options.resourceType}`);
  if (options.type) clauses.push(`type:${options.type}`);
  if (options.folder) {
    const folder = normalizeFolderPath(options.folder);
    if (folder && !/[\s()]/u.test(folder)) clauses.push(`public_id:${folder}/*`);
  }
  return clauses.join(" AND ");
}

export function parseOffsetCursor(cursor: string | null | undefined): number {
  if (!cursor || !/^\d{1,7}$/.test(cursor)) return 0;
  return Number(cursor);
}

export function isSearchCursor(cursor: string): boolean {
  return cursor.length <= FILE_LIMITS.maxCursorChars && /^[A-Za-z0-9_=-]+$/.test(cursor);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asResourceType(value: unknown, fallback: ResourceType): ResourceType {
  return RESOURCE_TYPES.includes(value as ResourceType) ? (value as ResourceType) : fallback;
}

function asDeliveryType(value: unknown, fallback: DeliveryType): DeliveryType {
  return DELIVERY_TYPES.includes(value as DeliveryType) ? (value as DeliveryType) : fallback;
}

export type ThumbnailBuilder = (
  publicId: string,
  resourceType: ResourceType,
  type: DeliveryType,
) => string | null;

export function mapAsset(
  value: unknown,
  fallback: { resourceType: ResourceType; type: DeliveryType },
  thumbnail: ThumbnailBuilder = () => null,
): AssetSummary | null {
  if (!isRecord(value) || typeof value.public_id !== "string" || !value.public_id) return null;
  const publicId = value.public_id;
  const resourceType = asResourceType(value.resource_type, fallback.resourceType);
  const type = asDeliveryType(value.type, fallback.type);

  return {
    publicId,
    name: baseName(publicId),
    folder: parentFolder(publicId),
    resourceType,
    type,
    format: stringOrNull(value.format),
    bytes: numberOrNull(value.bytes) ?? 0,
    width: numberOrNull(value.width),
    height: numberOrNull(value.height),
    createdAt: stringOrNull(value.created_at),
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string")
      : [],
    secureUrl: type === "upload" ? stringOrNull(value.secure_url) : null,
    thumbnailUrl: thumbnail(publicId, resourceType, type),
  };
}

export function splitListing(
  items: AssetSummary[],
  path: string,
): { assets: AssetSummary[]; folders: FolderEntry[] } {
  const prefix = path ? `${path}/` : "";
  const assets: AssetSummary[] = [];
  const folders = new Map<string, FolderEntry>();

  for (const item of items) {
    if (!item.publicId.startsWith(prefix)) continue;
    const rest = item.publicId.slice(prefix.length);
    const slash = rest.indexOf("/");
    if (slash === -1) {
      assets.push(item);
      continue;
    }
    const name = rest.slice(0, slash);
    const entry = folders.get(name) ?? {
      name,
      path: joinPath(path, name),
      assets: 0,
      bytes: 0,
      real: false,
    };
    entry.assets += 1;
    entry.bytes += item.bytes;
    folders.set(name, entry);
  }

  return {
    assets: assets.sort((a, b) => a.publicId.localeCompare(b.publicId)),
    folders: [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

function metric(value: unknown): UsageMetric | null {
  if (!isRecord(value)) return null;
  const usage = numberOrNull(value.usage);
  if (usage === null) return null;
  return {
    usage,
    limit: numberOrNull(value.limit),
    usedPercent: numberOrNull(value.used_percent),
    creditsUsage: numberOrNull(value.credits_usage),
  };
}

export function mapUsage(value: unknown): UsageSummary {
  const source = isRecord(value) ? value : {};
  const credits = isRecord(source.credits) ? source.credits : null;
  const limits = isRecord(source.media_limits) ? source.media_limits : null;
  const creditUsage = credits ? numberOrNull(credits.usage) : null;

  return {
    plan: stringOrNull(source.plan),
    lastUpdated: stringOrNull(source.last_updated),
    storage: metric(source.storage),
    bandwidth: metric(source.bandwidth),
    transformations: metric(source.transformations),
    credits:
      credits && creditUsage !== null
        ? {
            usage: creditUsage,
            limit: numberOrNull(credits.limit),
            usedPercent: numberOrNull(credits.used_percent),
          }
        : null,
    resources: numberOrNull(source.resources),
    derivedResources: numberOrNull(source.derived_resources),
    mediaLimits: limits
      ? {
          imageMaxBytes: numberOrNull(limits.image_max_size_bytes),
          videoMaxBytes: numberOrNull(limits.video_max_size_bytes),
          rawMaxBytes: numberOrNull(limits.raw_max_size_bytes),
        }
      : null,
  };
}

export function cloudinaryErrorDetail(error: unknown): { status: number | null; message: string } {
  if (!isRecord(error)) return { status: null, message: "" };
  const inner = isRecord(error.error) ? error.error : error;
  const status = numberOrNull(inner.http_code);
  const message = typeof inner.message === "string" ? inner.message.slice(0, 200) : "";
  return { status, message };
}

export function toAdminError(error: unknown): AdminError {
  if (error instanceof AdminError) return error;
  if (error instanceof ZodError) {
    return new AdminError(
      "Cloudinary কনফিগার করা নেই। CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ও CLOUDINARY_API_SECRET সেট করুন।",
      503,
    );
  }

  const { status, message } = cloudinaryErrorDetail(error);

  if (/not empty/i.test(message)) {
    return new AdminError("ফোল্ডারটি খালি নয়। আগে ভেতরের সব ফাইল মুছুন বা সরান।", 409);
  }
  if (/already exists/i.test(message) || status === 409) {
    return new AdminError("এই public ID-তে আগে থেকেই একটি ফাইল বা ফোল্ডার আছে।", 409);
  }
  if (status === 404) return new AdminError("ফাইল বা ফোল্ডারটি Cloudinary-তে পাওয়া যায়নি।", 404);
  if (status === 401 || status === 403) {
    return new AdminError(
      "Cloudinary অনুরোধটি অনুমোদন করেনি। API key, secret ও অ্যাকাউন্টের অনুমতি দেখুন।",
      502,
    );
  }
  if (status === 420 || status === 429) {
    return new AdminError(
      "Cloudinary-র অনুরোধ সীমা আপাতত শেষ হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।",
      429,
    );
  }
  if (status === 400) {
    return new AdminError(
      message ? `Cloudinary অনুরোধটি গ্রহণ করেনি: ${message}` : "Cloudinary অনুরোধটি গ্রহণ করেনি।",
      400,
    );
  }

  logger.warn("Cloudinary admin call failed", {
    status,
    message: message || (error instanceof Error ? error.message.slice(0, 200) : "unknown"),
  });
  return new AdminError("Cloudinary থেকে উত্তর পাওয়া যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।", 502);
}

async function guarded<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw toAdminError(error);
  }
}

function client() {
  try {
    return cloudinaryClient();
  } catch (error) {
    throw toAdminError(error);
  }
}

const thumbnailUrl: ThumbnailBuilder = (publicId, resourceType, type) => {
  if (resourceType === "raw") return null;
  const size = FILE_LIMITS.thumbnailSize;
  const base = {
    resource_type: resourceType,
    type,
    secure: true,
    sign_url: type !== "upload",
  };
  if (resourceType === "video") {
    return client().url(publicId, {
      ...base,
      format: "jpg",
      transformation: [{ crop: "fill", width: size, height: size, start_offset: "0" }],
    });
  }
  return client().url(publicId, {
    ...base,
    format: "jpg",
    transformation: [{ crop: "fill", width: size, height: size }, { quality: "auto" }],
  });
};

function previewUrl(asset: AssetSummary): string | null {
  if (asset.resourceType === "raw") return null;
  return client().url(asset.publicId, {
    resource_type: asset.resourceType,
    type: asset.type,
    secure: true,
    sign_url: asset.type !== "upload",
    format: "jpg",
    transformation: [
      {
        crop: "limit",
        width: FILE_LIMITS.previewWidth,
        height: FILE_LIMITS.previewWidth,
        ...(asset.resourceType === "video" ? { start_offset: "0" } : {}),
      },
      { quality: "auto" },
    ],
  });
}

interface Scan {
  resourceType: ResourceType;
  type: DeliveryType;
  path: string;
  at: number;
  items: AssetSummary[];
  truncated: boolean;
}

const scans = new Map<string, Scan>();

export function forgetScans(): void {
  scans.clear();
}

function cachedScan(resourceType: ResourceType, type: DeliveryType, path: string): Scan | null {
  const now = Date.now();
  for (const [key, scan] of scans) {
    if (now - scan.at > FILE_LIMITS.scanTtlMs) {
      scans.delete(key);
      continue;
    }
    if (scan.resourceType !== resourceType || scan.type !== type) continue;
    if (scan.path === path) return scan;
    const covers = !scan.truncated && (scan.path === "" || path.startsWith(`${scan.path}/`));
    if (covers) {
      const prefix = `${path}/`;
      return {
        ...scan,
        path,
        items: scan.items.filter((item) => item.publicId.startsWith(prefix)),
      };
    }
  }
  return null;
}

async function scanPrefix(
  resourceType: ResourceType,
  type: DeliveryType,
  path: string,
  fresh: boolean,
): Promise<Scan> {
  if (!fresh) {
    const cached = cachedScan(resourceType, type, path);
    if (cached) return cached;
  }

  const items: AssetSummary[] = [];
  let cursor: string | undefined;
  let pages = 0;

  do {
    const response: unknown = await guarded(() =>
      client().api.resources({
        resource_type: resourceType,
        type,
        max_results: FILE_LIMITS.scanPageSize,
        tags: true,
        ...(path ? { prefix: `${path}/` } : {}),
        ...(cursor ? { next_cursor: cursor } : {}),
      }),
    );
    const record = isRecord(response) ? response : {};
    const resources = Array.isArray(record.resources) ? record.resources : [];
    for (const resource of resources) {
      const asset = mapAsset(resource, { resourceType, type }, thumbnailUrl);
      if (asset) items.push(asset);
    }
    cursor = stringOrNull(record.next_cursor) ?? undefined;
    pages += 1;
  } while (cursor && pages < FILE_LIMITS.scanMaxPages);

  const scan: Scan = { resourceType, type, path, at: Date.now(), items, truncated: !!cursor };
  if (scans.size >= FILE_LIMITS.scanCacheEntries) {
    const oldest = scans.keys().next().value;
    if (oldest !== undefined) scans.delete(oldest);
  }
  scans.set(`${resourceType}|${type}|${path}`, scan);
  return scan;
}

async function realSubfolders(path: string): Promise<string[]> {
  try {
    const response: unknown = path
      ? await client().api.sub_folders(path, { max_results: 500 })
      : await client().api.root_folders();
    const folders = isRecord(response) && Array.isArray(response.folders) ? response.folders : [];
    return folders
      .map((folder) => (isRecord(folder) && typeof folder.name === "string" ? folder.name : ""))
      .filter((name) => name.length > 0);
  } catch (error) {
    const mapped = toAdminError(error);
    if (mapped.status === 404) return [];
    if (mapped.status === 503) throw mapped;
    logger.warn("Cloudinary folder listing failed", { path, status: mapped.status });
    return [];
  }
}

export async function listSubfolders(path: string): Promise<FolderEntry[]> {
  const folder = normalizeFolderPath(path);
  const names = await realSubfolders(folder);
  return names
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ name, path: joinPath(folder, name), assets: 0, bytes: 0, real: true }));
}

export async function listFolder(options: {
  resourceType: ResourceType;
  type: DeliveryType;
  path: string;
  cursor?: string | null;
  fresh?: boolean;
}): Promise<FolderListing> {
  const path = normalizeFolderPath(options.path);
  const [scan, real] = await Promise.all([
    scanPrefix(options.resourceType, options.type, path, options.fresh ?? false),
    realSubfolders(path),
  ]);
  const split = splitListing(scan.items, path);

  const folders = new Map(split.folders.map((folder) => [folder.name, folder]));
  for (const name of real) {
    const existing = folders.get(name);
    if (existing) existing.real = true;
    else folders.set(name, { name, path: joinPath(path, name), assets: 0, bytes: 0, real: true });
  }

  const offset = parseOffsetCursor(options.cursor);
  const pageSize = ADMIN_CONFIG.filesPageSize;
  const end = offset + pageSize;

  return {
    path,
    resourceType: options.resourceType,
    type: options.type,
    folders: offset === 0 ? [...folders.values()].sort((a, b) => a.name.localeCompare(b.name)) : [],
    assets: split.assets.slice(offset, end),
    total: split.assets.length,
    nextCursor: end < split.assets.length ? String(end) : null,
    truncated: scan.truncated,
  };
}

export async function searchAssets(options: {
  term: string;
  resourceType?: ResourceType | null;
  type?: DeliveryType | null;
  folder?: string | null;
  cursor?: string | null;
}): Promise<SearchListing> {
  const expression = buildSearchExpression(options);
  const cursor = options.cursor && isSearchCursor(options.cursor) ? options.cursor : null;

  const response: unknown = await guarded(() => {
    let query = client()
      .search.expression(expression)
      .max_results(ADMIN_CONFIG.filesPageSize)
      .sort_by("public_id", "asc")
      .with_field("tags");
    if (cursor) query = query.next_cursor(cursor);
    return query.execute();
  });

  const record = isRecord(response) ? response : {};
  const resources = Array.isArray(record.resources) ? record.resources : [];
  return {
    assets: resources
      .map((resource) => mapAsset(resource, { resourceType: "raw", type: "upload" }, thumbnailUrl))
      .filter((asset): asset is AssetSummary => asset !== null),
    total: numberOrNull(record.total_count) ?? resources.length,
    nextCursor: stringOrNull(record.next_cursor),
  };
}

export interface AssetRef {
  publicId: string;
  resourceType: ResourceType;
  type: DeliveryType;
}

function detailsFrom(value: unknown, ref: AssetRef): AssetDetails {
  const asset = mapAsset(value, ref, thumbnailUrl);
  if (!asset || !isRecord(value)) throw new AdminError("ফাইলের তথ্য পড়া যায়নি।", 502);
  return {
    ...asset,
    assetFolder: typeof value.asset_folder === "string" ? value.asset_folder : null,
    displayName: stringOrNull(value.display_name),
    version: numberOrNull(value.version),
    pages: numberOrNull(value.pages),
    duration: numberOrNull(value.duration),
    accessMode: stringOrNull(value.access_mode),
    previewUrl: previewUrl(asset),
  };
}

export async function getAsset(ref: AssetRef): Promise<AssetDetails> {
  const publicId = normalizePublicId(ref.publicId);
  const response: unknown = await guarded(() =>
    client().api.resource(publicId, { resource_type: ref.resourceType, type: ref.type }),
  );
  return detailsFrom(response, { ...ref, publicId });
}

let folderModeCache: string | null = null;

async function folderMode(): Promise<string> {
  if (folderModeCache) return folderModeCache;
  try {
    const response: unknown = await client().api.config({ settings: true });
    const settings = isRecord(response) && isRecord(response.settings) ? response.settings : {};
    folderModeCache = typeof settings.folder_mode === "string" ? settings.folder_mode : "fixed";
    return folderModeCache;
  } catch (error) {
    const mapped = toAdminError(error);
    if (mapped.status === 503) throw mapped;
    return "fixed";
  }
}

export async function renameAsset(
  ref: AssetRef & { toPublicId: string; toType: DeliveryType; overwrite: boolean },
): Promise<AssetDetails> {
  const from = normalizePublicId(ref.publicId);
  const to = normalizePublicId(ref.toPublicId);
  if (from === to && ref.type === ref.toType) {
    throw new AdminError("নতুন public ID বা ডেলিভারি ধরনে কোনো পরিবর্তন নেই।");
  }

  const response: unknown = await guarded(() =>
    client().uploader.rename(from, to, {
      resource_type: ref.resourceType,
      type: ref.type,
      to_type: ref.toType,
      overwrite: ref.overwrite,
      invalidate: true,
    }),
  );
  forgetScans();

  const moved = isRecord(response) ? response : {};
  const oldParent = parentFolder(from);
  const newParent = parentFolder(to);
  if (
    oldParent !== newParent &&
    moved.asset_folder === oldParent &&
    oldParent !== "" &&
    (await folderMode()) === "dynamic"
  ) {
    try {
      await client().api.update(to, {
        resource_type: ref.resourceType,
        type: ref.toType,
        asset_folder: newParent,
      });
    } catch (error) {
      logger.warn("Cloudinary asset folder update after rename failed", {
        status: cloudinaryErrorDetail(error).status,
      });
    }
  }

  return getAsset({ publicId: to, resourceType: ref.resourceType, type: ref.toType }).catch(() =>
    detailsFrom(response, { publicId: to, resourceType: ref.resourceType, type: ref.toType }),
  );
}

export async function setAssetTags(ref: AssetRef & { tags: string[] }): Promise<AssetDetails> {
  const publicId = normalizePublicId(ref.publicId);
  const tags = normalizeTags(ref.tags);

  await guarded(() =>
    tags.length === 0
      ? client().uploader.remove_all_tags([publicId], {
          resource_type: ref.resourceType,
          type: ref.type,
        })
      : client().api.update(publicId, {
          resource_type: ref.resourceType,
          type: ref.type,
          tags: tags.join(","),
        }),
  );
  forgetScans();
  return getAsset({ ...ref, publicId });
}

export async function deleteAssets(
  refs: AssetRef[],
): Promise<{ deleted: string[]; notFound: string[] }> {
  const groups = new Map<
    string,
    { resourceType: ResourceType; type: DeliveryType; ids: string[] }
  >();
  for (const ref of refs) {
    const publicId = normalizePublicId(ref.publicId);
    const key = `${ref.resourceType}|${ref.type}`;
    const group = groups.get(key) ?? { resourceType: ref.resourceType, type: ref.type, ids: [] };
    if (!group.ids.includes(publicId)) group.ids.push(publicId);
    groups.set(key, group);
  }

  const deleted: string[] = [];
  const notFound: string[] = [];
  try {
    for (const group of groups.values()) {
      for (let start = 0; start < group.ids.length; start += FILE_LIMITS.maxBulkItems) {
        const ids = group.ids.slice(start, start + FILE_LIMITS.maxBulkItems);
        const response: unknown = await guarded(() =>
          client().api.delete_resources(ids, {
            resource_type: group.resourceType,
            type: group.type,
            invalidate: true,
          }),
        );
        const outcome =
          isRecord(response) && isRecord(response.deleted)
            ? response.deleted
            : ({} as Record<string, unknown>);
        for (const id of ids) {
          if (outcome[id] === "deleted") deleted.push(id);
          else notFound.push(id);
        }
      }
    }
  } finally {
    forgetScans();
  }
  return { deleted, notFound };
}

export async function createFolder(path: string): Promise<string> {
  const folder = normalizeFolderPath(path);
  if (!folder) throw new AdminError("ফোল্ডারের নাম লিখুন।");
  await guarded(() => client().api.create_folder(folder));
  forgetScans();
  return folder;
}

export async function deleteFolder(path: string): Promise<string> {
  const folder = normalizeFolderPath(path);
  if (!folder) throw new AdminError("মূল ফোল্ডার মুছে ফেলা যায় না।");
  await guarded(() => client().api.delete_folder(folder));
  forgetScans();
  return folder;
}

export async function getUsage(): Promise<UsageSummary> {
  return mapUsage(await guarded(() => client().api.usage()));
}

export async function signUpload(options: {
  folder: string;
  fileName: string;
  publicId?: string | null;
  resourceType: ResourceType;
  type: DeliveryType;
  overwrite: boolean;
}): Promise<UploadSignature> {
  const folder = normalizeFolderPath(options.folder);
  const publicId = uploadPublicId(folder, options.fileName, options.resourceType, options.publicId);
  const cloudinary = client();
  const env = (() => {
    try {
      return getStorageEnv();
    } catch (error) {
      throw toAdminError(error);
    }
  })();
  const dynamic = (await folderMode()) === "dynamic";
  const timestamp = Math.floor(Date.now() / 1000);
  const parent = parentFolder(publicId);

  const params: Record<string, string> = {
    public_id: publicId,
    timestamp: String(timestamp),
    type: options.type,
    overwrite: options.overwrite ? "true" : "false",
    ...(options.overwrite ? { invalidate: "true" } : {}),
    ...(dynamic && parent ? { asset_folder: parent } : {}),
  };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET);

  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    uploadUrl: `https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/${options.resourceType}/upload`,
    publicId,
    folder: parent,
    resourceType: options.resourceType,
    type: options.type,
    timestamp,
    signature,
    fields: { ...params, signature, api_key: env.CLOUDINARY_API_KEY },
  };
}

export function assetUrl(ref: AssetRef & { format?: string | null; download: boolean }): {
  url: string;
  expiresAt: string | null;
} {
  const publicId = normalizePublicId(ref.publicId);
  const format = ref.format && /^[a-z0-9]{1,10}$/i.test(ref.format) ? ref.format : undefined;
  const cloudinary = client();

  if (!ref.download && ref.type !== "private") {
    return {
      url: cloudinary.url(publicId, {
        resource_type: ref.resourceType,
        type: ref.type,
        secure: true,
        sign_url: ref.type !== "upload",
        ...(ref.resourceType !== "raw" && format ? { format } : {}),
      }),
      expiresAt: null,
    };
  }

  const expiresAt = Math.floor(Date.now() / 1000) + FILE_LIMITS.signedUrlSeconds;
  return {
    url: cloudinary.utils.private_download_url(
      publicId,
      ref.resourceType === "raw" ? "" : (format ?? ""),
      {
        resource_type: ref.resourceType,
        type: ref.type,
        expires_at: expiresAt,
        attachment: ref.download,
      },
    ),
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}
