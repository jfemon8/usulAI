"use client";

import Image from "next/image";
import { useCallback, useState, type FormEvent } from "react";
import { clsx } from "clsx";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, Dialog, useToast } from "@/components/admin/Dialog";
import { AssetDialog } from "@/components/admin/files/AssetDialog";
import {
  assetKey,
  DELIVERY_OPTIONS,
  deliveryLabel,
  FileKindIcon,
  isProtectedPath,
  joinFolder,
  ProtectedWarning,
  RESOURCE_OPTIONS,
  type AssetSummary,
  type DeliveryType,
  type ResourceType,
  type UsageSummary,
} from "@/components/admin/files/shared";
import { UploadDialog } from "@/components/admin/files/UploadDialog";
import { UsageCard } from "@/components/admin/files/UsageCard";
import { useAdminData } from "@/components/admin/useAdminData";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualGrid } from "@/components/admin/VirtualList";
import {
  Button,
  Card,
  EmptyState,
  Field,
  formatCount,
  formatSize,
  IconButton,
  Input,
  LoadError,
  Notice,
  PageHeader,
  Select,
} from "@/components/admin/ui";
import {
  ChevronRightIcon,
  CloseIcon,
  FolderIcon,
  HomeIcon,
  LockIcon,
  PlusIcon,
  RetryIcon,
  SearchIcon,
  TrashIcon,
  UploadIcon,
} from "@/components/ui/Icons";
import type { FolderEntry, FolderListing, SearchListing } from "@/lib/admin/cloudinaryAdmin";

interface SearchState {
  term: string;
  resourceType: ResourceType | "all";
  type: DeliveryType | "all";
  folder: string;
}

type ListingPage = FolderListing | SearchListing;

const GRID_MIN_COLUMN_WIDTH = 130;
const GRID_MAX_COLUMNS = 6;
const GRID_GAP = 12;
const TILE_ROW_HEIGHT = 215;
const SEARCH_TILE_ROW_HEIGHT = 235;

function listingPath(options: {
  search: SearchState | null;
  resourceType: ResourceType;
  type: DeliveryType;
  path: string;
  cursor: string | null;
  fresh: number;
}): string {
  if (options.search) {
    const params = new URLSearchParams({
      view: "search",
      q: options.search.term,
      resourceType: options.search.resourceType,
      type: options.search.type,
    });
    if (options.search.folder) params.set("folder", options.search.folder);
    if (options.cursor) params.set("cursor", options.cursor);
    return `/api/admin/files?${params}`;
  }
  const params = new URLSearchParams({
    resourceType: options.resourceType,
    type: options.type,
    path: options.path,
  });
  if (options.cursor) params.set("cursor", options.cursor);
  else if (options.fresh > 0) params.set("fresh", String(options.fresh));
  return `/api/admin/files?${params}`;
}

function Breadcrumbs({ path, onOpen }: { path: string; onOpen: (path: string) => void }) {
  const segments = path ? path.split("/") : [];
  return (
    <nav aria-label="ফোল্ডারের পথ" className="min-w-0">
      <ol className="flex flex-wrap items-center gap-0.5 text-sm">
        <li>
          <button
            type="button"
            onClick={() => onOpen("")}
            aria-current={segments.length === 0 ? "page" : undefined}
            className={clsx(
              "flex min-h-10 items-center gap-1.5 rounded-lg px-2 transition hover:bg-(--surface-2)",
              segments.length === 0 ? "font-medium text-(--text-1)" : "text-(--text-2)",
            )}
          >
            <HomeIcon className="h-4 w-4" />
            মূল ফোল্ডার
          </button>
        </li>
        {segments.map((segment, index) => {
          const target = segments.slice(0, index + 1).join("/");
          const last = index === segments.length - 1;
          return (
            <li key={target} className="flex min-w-0 items-center gap-0.5">
              <ChevronRightIcon className="h-4 w-4 shrink-0 text-(--text-3)" />
              <button
                type="button"
                onClick={() => onOpen(target)}
                aria-current={last ? "page" : undefined}
                className={clsx(
                  "min-h-10 max-w-48 truncate rounded-lg px-2 transition hover:bg-(--surface-2)",
                  last ? "font-medium text-(--text-1)" : "text-(--text-2)",
                )}
                title={segment}
              >
                {segment}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function FolderTile({
  folder,
  onOpen,
  onDelete,
}: {
  folder: FolderEntry;
  onOpen: () => void;
  onDelete: (() => void) | null;
}) {
  return (
    <li className="relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className="flex h-full min-h-20 w-full items-center gap-3 rounded-2xl border border-(--border) bg-(--bg) py-3 ps-3 pe-11 text-start transition hover:border-(--accent) hover:bg-(--surface-2)"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--accent-soft) text-(--accent)">
          <FolderIcon className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-(--text-1)" title={folder.name}>
            {folder.name}
          </span>
          <span className="block truncate text-xs text-(--text-3)">
            {folder.assets > 0
              ? `${formatCount(folder.assets)} ফাইল, ${formatSize(folder.bytes)}`
              : "এই ধরনে ফাইল নেই"}
          </span>
        </span>
      </button>
      {onDelete ? (
        <IconButton
          label={`${folder.name} ফোল্ডার মুছুন`}
          onClick={onDelete}
          className="absolute top-1/2 right-1 -translate-y-1/2 hover:text-(--danger)"
        >
          <TrashIcon className="h-4 w-4" />
        </IconButton>
      ) : null}
    </li>
  );
}

function AssetTile({
  asset,
  selected,
  showPath,
  onOpen,
  onToggle,
}: {
  asset: AssetSummary;
  selected: boolean;
  showPath: boolean;
  onOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={onOpen}
        className={clsx(
          "flex w-full flex-col overflow-hidden rounded-2xl border bg-(--bg) text-start transition hover:border-(--accent)",
          selected ? "border-(--accent) ring-2 ring-(--accent-soft)" : "border-(--border)",
        )}
      >
        <span className="relative flex aspect-square w-full items-center justify-center bg-(--surface-2)">
          {asset.thumbnailUrl ? (
            <Image
              src={asset.thumbnailUrl}
              alt=""
              fill
              unoptimized
              loading="lazy"
              sizes="(min-width: 1024px) 12rem, (min-width: 640px) 25vw, 50vw"
              className="object-cover"
            />
          ) : (
            <FileKindIcon
              resourceType={asset.resourceType}
              type={asset.type}
              className="h-10 w-10 text-(--text-3)"
            />
          )}
          {asset.type !== "upload" && asset.thumbnailUrl ? (
            <span className="absolute right-2 bottom-2 flex h-6 w-6 items-center justify-center rounded-full bg-(--bg) text-(--warn) shadow">
              <LockIcon className="h-3.5 w-3.5" />
            </span>
          ) : null}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5 px-2.5 py-2">
          <span className="truncate text-sm font-medium text-(--text-1)" title={asset.publicId}>
            {asset.name}
          </span>
          <span className="truncate text-xs text-(--text-3)">
            {showPath
              ? asset.folder || "মূল ফোল্ডার"
              : [formatSize(asset.bytes), asset.format].filter(Boolean).join(", ")}
          </span>
          {showPath ? (
            <span className="truncate text-xs text-(--text-3)">
              {asset.resourceType}, {deliveryLabel(asset.type)}
            </span>
          ) : null}
        </span>
      </button>
      <label
        className="absolute top-1 left-1 flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl bg-(--bg)/85 backdrop-blur-sm"
        title="নির্বাচন"
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`${asset.name} নির্বাচন করুন`}
          className="h-5 w-5 accent-(--accent)"
        />
      </label>
    </div>
  );
}

export function FileManager() {
  const toast = useToast();
  const [resourceType, setResourceType] = useState<ResourceType>("raw");
  const [type, setType] = useState<DeliveryType>("upload");
  const [path, setPath] = useState("");
  const [fresh, setFresh] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState<SearchState | null>(null);
  const [selected, setSelected] = useState<Map<string, AssetSummary>>(new Map());
  const [detail, setDetail] = useState<AssetSummary | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [folderError, setFolderError] = useState<string | null>(null);
  const [folderBusy, setFolderBusy] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<FolderEntry | null>(null);
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const usageState = useAdminData<{ usage: UsageSummary }>("/api/admin/files/usage");
  const listing = useInfiniteAdminData<ListingPage, AssetSummary>({
    key: JSON.stringify({ search, resourceType, type, path, fresh }),
    path: (cursor) => listingPath({ search, resourceType, type, path, cursor, fresh }),
    items: (page) => page.assets,
    next: (page) => page.nextCursor,
  });
  const data = listing.firstPage;
  const browse = data && "folders" in data ? data : null;
  const assets = listing.items;

  const resetView = useCallback(() => {
    setSelected(new Map());
  }, []);

  const refresh = useCallback(() => {
    setSelected(new Map());
    setFresh((value) => value + 1);
  }, []);

  const closeDetail = useCallback(() => setDetail(null), []);
  const closeUpload = useCallback(() => setUploadOpen(false), []);
  const closeFolderDialog = useCallback(() => setFolderDialog(false), []);
  const closeFolderDelete = useCallback(() => setFolderToDelete(null), []);
  const closeBulk = useCallback(() => setBulkConfirm(false), []);

  function openFolder(target: string) {
    setSearch(null);
    setSearchInput("");
    setPath(target);
    resetView();
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = searchInput.trim();
    if (!term) {
      setSearch(null);
      resetView();
      return;
    }
    setSearch({
      term,
      resourceType: search?.resourceType ?? "all",
      type: search?.type ?? "all",
      folder: search?.folder ?? path,
    });
    resetView();
  }

  function clearSearch() {
    setSearch(null);
    setSearchInput("");
    resetView();
  }

  function toggle(asset: AssetSummary) {
    setSelected((current) => {
      const next = new Map(current);
      const key = assetKey(asset);
      if (next.has(key)) next.delete(key);
      else next.set(key, asset);
      return next;
    });
  }

  const allSelected = assets.length > 0 && assets.every((asset) => selected.has(assetKey(asset)));

  function toggleAll() {
    setSelected(
      allSelected ? new Map() : new Map(assets.map((asset) => [assetKey(asset), asset] as const)),
    );
  }

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim().replace(/^\/+|\/+$/g, "");
    if (!name) {
      setFolderError("ফোল্ডারের নাম লিখুন।");
      return;
    }
    setFolderBusy(true);
    setFolderError(null);
    try {
      const result = await adminApi<{ path: string }>("/api/admin/files/folders", {
        body: { path: joinFolder(path, name) },
      });
      toast.success(`${result.path} ফোল্ডার তৈরি হয়েছে।`);
      setFolderDialog(false);
      setFolderName("");
      refresh();
    } catch (failure) {
      setFolderError(errorMessage(failure));
    } finally {
      setFolderBusy(false);
    }
  }

  async function deleteFolder() {
    if (!folderToDelete) return;
    setFolderBusy(true);
    try {
      await adminApi("/api/admin/files/folders", {
        method: "DELETE",
        body: { path: folderToDelete.path },
      });
      toast.success(`${folderToDelete.path} ফোল্ডার মুছে ফেলা হয়েছে।`);
      setFolderToDelete(null);
      refresh();
    } catch (failure) {
      toast.error(errorMessage(failure));
      setFolderToDelete(null);
    } finally {
      setFolderBusy(false);
    }
  }

  async function deleteSelected() {
    const items = [...selected.values()].map((asset) => ({
      publicId: asset.publicId,
      resourceType: asset.resourceType,
      type: asset.type,
    }));
    if (items.length === 0) return;
    setBulkBusy(true);
    try {
      const result = await adminApi<{ deleted: string[]; notFound: string[] }>("/api/admin/files", {
        method: "DELETE",
        body: { items },
      });
      if (result.deleted.length > 0) {
        toast.success(`${formatCount(result.deleted.length)}টি ফাইল মুছে ফেলা হয়েছে।`);
      }
      if (result.notFound.length > 0) {
        toast.error(`${formatCount(result.notFound.length)}টি ফাইল পাওয়া যায়নি।`);
      }
      setBulkConfirm(false);
      refresh();
    } catch (failure) {
      toast.error(errorMessage(failure));
      setBulkConfirm(false);
    } finally {
      setBulkBusy(false);
    }
  }

  const selectedList = [...selected.values()];
  const protectedSelection = selectedList.some((asset) => isProtectedPath(asset.publicId));
  const folders = browse?.folders ?? [];
  const hasContent = folders.length > 0 || assets.length > 0;
  const total = data?.total ?? 0;
  const loadedLabel = listing.hasMore
    ? `${formatCount(assets.length)}টি ফাইল লোড হয়েছে, মোট ${formatCount(total)}টি`
    : `মোট ${formatCount(total)}টি ফাইল`;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="ফাইল (Cloudinary)"
        description="Cloudinary অ্যাকাউন্টের সব ফাইল দেখুন, খুঁজুন, আপলোড করুন, নাম বদলান, সরান বা মুছুন।"
        actions={
          <>
            <Button
              onClick={() => {
                setFolderName("");
                setFolderError(null);
                setFolderDialog(true);
              }}
              icon={<PlusIcon className="h-4 w-4" />}
            >
              নতুন ফোল্ডার
            </Button>
            <Button
              tone="primary"
              onClick={() => setUploadOpen(true)}
              icon={<UploadIcon className="h-4 w-4" />}
            >
              আপলোড
            </Button>
          </>
        }
      />

      <UsageCard
        usage={usageState.data?.usage ?? null}
        loading={usageState.loading}
        error={usageState.error}
        onReload={usageState.reload}
      />

      <Card padded={false}>
        <div className="flex flex-col gap-3 border-b border-(--border) p-3 sm:p-4">
          <form onSubmit={submitSearch} className="flex gap-2" role="search">
            <div className="relative min-w-0 flex-1">
              <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
              <Input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="public ID, ফাইলের নাম বা ট্যাগ দিয়ে খুঁজুন"
                aria-label="ফাইল খুঁজুন"
                className="ps-9"
                maxLength={120}
              />
            </div>
            <Button
              type="submit"
              tone="secondary"
              aria-label="খুঁজুন"
              icon={<SearchIcon className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">খুঁজুন</span>
            </Button>
          </form>

          <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
            {search ? (
              <>
                <Select
                  aria-label="ফাইলের ধরন"
                  value={search.resourceType}
                  onChange={(event) => {
                    setSearch({
                      ...search,
                      resourceType: event.target.value as ResourceType | "all",
                    });
                    resetView();
                  }}
                  className="lg:w-52"
                >
                  <option value="all">সব ধরনের ফাইল</option>
                  {RESOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="ডেলিভারি ধরন"
                  value={search.type}
                  onChange={(event) => {
                    setSearch({ ...search, type: event.target.value as DeliveryType | "all" });
                    resetView();
                  }}
                  className="lg:w-60"
                >
                  <option value="all">সব ডেলিভারি ধরন</option>
                  {DELIVERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </>
            ) : (
              <>
                <Select
                  aria-label="ফাইলের ধরন"
                  value={resourceType}
                  onChange={(event) => {
                    setResourceType(event.target.value as ResourceType);
                    resetView();
                  }}
                  className="lg:w-52"
                >
                  {RESOURCE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
                <Select
                  aria-label="ডেলিভারি ধরন"
                  value={type}
                  onChange={(event) => {
                    setType(event.target.value as DeliveryType);
                    resetView();
                  }}
                  className="lg:w-60"
                >
                  {DELIVERY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </>
            )}
            <div className="flex gap-2 min-[420px]:col-span-2 lg:ms-auto">
              <Button
                onClick={refresh}
                disabled={listing.loading}
                icon={
                  <RetryIcon
                    className={clsx(
                      "h-4 w-4",
                      listing.loading && "animate-spin motion-reduce:animate-none",
                    )}
                  />
                }
                className="flex-1 lg:flex-none"
              >
                রিফ্রেশ
              </Button>
              {assets.length > 0 ? (
                <Button
                  onClick={toggleAll}
                  className="flex-1 lg:flex-none"
                  title={`এখন পর্যন্ত লোড হওয়া ${formatCount(assets.length)}টি ফাইল`}
                >
                  {allSelected ? "নির্বাচন বাতিল" : "লোড হওয়া সব নির্বাচন"}
                </Button>
              ) : null}
            </div>
          </div>

          {search ? (
            <div className="flex flex-wrap items-center gap-2 text-sm text-(--text-2)">
              <span className="min-w-0 break-words">
                &ldquo;{search.term}&rdquo; খোঁজা হচ্ছে
                {search.folder ? ` ${search.folder} ফোল্ডারের ভেতরে` : " পুরো অ্যাকাউন্টে"}
                {data ? `, ${formatCount(data.total)}টি ফলাফল` : ""}
              </span>
              {search.folder ? (
                <Button
                  size="sm"
                  tone="ghost"
                  onClick={() => {
                    setSearch({ ...search, folder: "" });
                    resetView();
                  }}
                >
                  পুরো অ্যাকাউন্টে খুঁজুন
                </Button>
              ) : null}
              <Button
                size="sm"
                tone="ghost"
                onClick={clearSearch}
                icon={<CloseIcon className="h-4 w-4" />}
              >
                খোঁজা বন্ধ
              </Button>
            </div>
          ) : (
            <Breadcrumbs path={path} onOpen={openFolder} />
          )}
        </div>

        {selected.size > 0 ? (
          <div className="sticky top-14 z-10 flex flex-wrap items-center gap-2 border-b border-(--border) bg-(--accent-soft) px-3 py-2 sm:px-4 lg:top-0">
            <span className="min-w-0 flex-1 text-sm font-medium text-(--accent)">
              {formatCount(selected.size)}টি ফাইল নির্বাচিত
            </span>
            <Button size="sm" tone="ghost" onClick={() => setSelected(new Map())}>
              বাতিল
            </Button>
            <Button
              size="sm"
              tone="danger"
              onClick={() => setBulkConfirm(true)}
              icon={<TrashIcon className="h-4 w-4" />}
            >
              মুছুন
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-4 p-3 sm:p-4">
          {!search && isProtectedPath(path) ? (
            <Notice tone="warn">
              এই ফোল্ডারে অ্যাপের মূল উৎস ফাইল আছে। এখানে কিছু মুছলে বা নাম বদলালে সোর্স ভিউয়ার ও
              ইনজেশনের আর্কাইভ ভেঙে যেতে পারে।
            </Notice>
          ) : null}

          {browse?.truncated ? (
            <Notice tone="warn">
              এই ফোল্ডারে অনেক ফাইল, তাই সব এক সাথে দেখানো যায়নি। নির্দিষ্ট ফাইল পেতে খোঁজ ব্যবহার
              করুন।
            </Notice>
          ) : null}

          {listing.error && !data ? (
            <LoadError message={listing.error} onRetry={listing.retry} />
          ) : listing.loading || !data ? (
            <div
              className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-6"
              aria-hidden="true"
            >
              {Array.from({ length: 12 }, (_, index) => (
                <div
                  key={index}
                  className="aspect-[4/5] animate-pulse rounded-2xl bg-(--surface-2) motion-reduce:animate-none"
                />
              ))}
            </div>
          ) : !hasContent ? (
            <EmptyState title={search ? "কিছু পাওয়া যায়নি" : "এই ফোল্ডার খালি"}>
              {search
                ? "অন্য শব্দ দিয়ে খুঁজে দেখুন। সদ্য আপলোড করা ফাইল খোঁজে আসতে কয়েক সেকেন্ড লাগতে পারে।"
                : `${deliveryLabel(type)} ধরনে এখানে কোনো ফাইল নেই। অন্য ধরন বেছে নিন বা ফাইল আপলোড করুন।`}
            </EmptyState>
          ) : (
            <div className="flex flex-col gap-4" aria-busy={listing.loadingMore}>
              {folders.length > 0 ? (
                <ul
                  className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-3"
                  aria-label="ফোল্ডার"
                >
                  {folders.map((folder) => (
                    <FolderTile
                      key={folder.path}
                      folder={folder}
                      onOpen={() => openFolder(folder.path)}
                      onDelete={
                        folder.real && folder.assets === 0 ? () => setFolderToDelete(folder) : null
                      }
                    />
                  ))}
                </ul>
              ) : null}

              {assets.length > 0 ? (
                <section aria-label="ফাইল" className="flex flex-col gap-2">
                  <p className="text-xs text-(--text-3)" aria-live="polite">
                    {loadedLabel}
                  </p>
                  <VirtualGrid
                    items={assets}
                    getKey={(asset) => assetKey(asset)}
                    minColumnWidth={GRID_MIN_COLUMN_WIDTH}
                    maxColumns={GRID_MAX_COLUMNS}
                    gap={GRID_GAP}
                    estimateRowHeight={search ? SEARCH_TILE_ROW_HEIGHT : TILE_ROW_HEIGHT}
                    hasMore={listing.hasMore}
                    loadingMore={listing.loadingMore}
                    error={listing.error}
                    onLoadMore={listing.loadMore}
                    onRetry={listing.retry}
                    endLabel={search ? "সব ফলাফল দেখানো হয়েছে" : "সব ফাইল দেখানো হয়েছে"}
                    renderItem={(asset) => (
                      <AssetTile
                        asset={asset}
                        selected={selected.has(assetKey(asset))}
                        showPath={search !== null}
                        onOpen={() => setDetail(asset)}
                        onToggle={() => toggle(asset)}
                      />
                    )}
                  />
                </section>
              ) : listing.error ? (
                <LoadError message={listing.error} onRetry={listing.retry} />
              ) : null}
            </div>
          )}
        </div>
      </Card>

      <AssetDialog
        key={detail ? assetKey(detail) : "none"}
        asset={detail}
        onClose={closeDetail}
        onChanged={refresh}
      />

      <UploadDialog
        open={uploadOpen}
        onClose={closeUpload}
        folder={search ? "" : path}
        defaultType={type}
        usage={usageState.data?.usage ?? null}
        onUploaded={refresh}
      />

      <Dialog
        open={folderDialog}
        onClose={closeFolderDialog}
        busy={folderBusy}
        title="নতুন ফোল্ডার"
        description={`তৈরি হবে: ${path ? `${path}/` : "মূল ফোল্ডারে "}${folderName.trim() || "..."}`}
      >
        <form onSubmit={(event) => void createFolder(event)} className="flex flex-col gap-4">
          <Field
            label="ফোল্ডারের নাম"
            error={folderError}
            hint="ভেতরে ভেতরে ফোল্ডার বানাতে / দিয়ে লিখুন, যেমন books/2026।"
          >
            {(id) => (
              <Input
                id={id}
                value={folderName}
                onChange={(event) => setFolderName(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                maxLength={200}
                disabled={folderBusy}
              />
            )}
          </Field>
          {isProtectedPath(joinFolder(path, folderName.trim())) ? <ProtectedWarning /> : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={closeFolderDialog} disabled={folderBusy} className="w-full sm:w-auto">
              বাতিল
            </Button>
            <Button
              type="submit"
              tone="primary"
              loading={folderBusy}
              icon={<PlusIcon className="h-4 w-4" />}
              className="w-full sm:w-auto"
            >
              তৈরি করুন
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={folderToDelete !== null}
        onClose={closeFolderDelete}
        busy={folderBusy}
        title="ফোল্ডার মুছবেন?"
        confirmLabel="ফোল্ডার মুছুন"
        onConfirm={() => void deleteFolder()}
        message={
          <div className="flex flex-col gap-3">
            <p className="break-all">
              {folderToDelete?.path} ফোল্ডারটি মুছে যাবে। শুধু খালি ফোল্ডার মোছা যায়; অন্য ধরনের
              ফাইল থাকলে Cloudinary অনুরোধটি ফিরিয়ে দেবে।
            </p>
            {folderToDelete && isProtectedPath(folderToDelete.path) ? <ProtectedWarning /> : null}
          </div>
        }
      />

      <ConfirmDialog
        open={bulkConfirm}
        onClose={closeBulk}
        busy={bulkBusy}
        title={`${formatCount(selected.size)}টি ফাইল মুছবেন?`}
        confirmLabel="মুছে ফেলুন"
        onConfirm={() => void deleteSelected()}
        message={
          <div className="flex flex-col gap-3">
            <p>
              নির্বাচিত ফাইলগুলো স্থায়ীভাবে মুছে যাবে এবং CDN থেকেও সরানো হবে। এই কাজ ফেরানো যায়
              না।
            </p>
            <ul className="thin-scroll max-h-40 overflow-y-auto rounded-xl bg-(--surface-2) px-3 py-2 text-xs break-all">
              {selectedList.slice(0, 50).map((asset) => (
                <li key={assetKey(asset)} className="py-0.5">
                  {asset.publicId}
                </li>
              ))}
              {selectedList.length > 50 ? (
                <li className="py-0.5">আরও {formatCount(selectedList.length - 50)}টি</li>
              ) : null}
            </ul>
            {protectedSelection ? <ProtectedWarning /> : null}
          </div>
        }
      />
    </div>
  );
}
