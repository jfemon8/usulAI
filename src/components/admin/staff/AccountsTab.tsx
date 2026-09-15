"use client";

import { useCallback, useRef, useState, type FormEvent } from "react";
import { adminApi, errorMessage } from "@/components/admin/api";
import { ConfirmDialog, useToast } from "@/components/admin/Dialog";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadError,
  Select,
  Skeleton,
  formatCount,
  formatWhen,
} from "@/components/admin/ui";
import { useInfiniteAdminData } from "@/components/admin/useInfiniteAdminData";
import { VirtualDataList, type VirtualColumn } from "@/components/admin/VirtualList";
import { CloseIcon, PlusIcon, SearchIcon } from "@/components/ui/Icons";
import {
  CreateAccountDialog,
  EditAccountDialog,
  PasswordResultDialog,
  ResetPasswordDialog,
  type PasswordResult,
} from "@/components/admin/staff/AccountDialogs";
import {
  RoleBadge,
  STATUS_LABELS,
  StatusBadge,
  categoryOptionGroups,
  type CategoryView,
  type StaffStatus,
  type StaffView,
} from "@/components/admin/staff/shared";

interface ListResponse {
  items: StaffView[];
  nextCursor: string | null;
  total: number | null;
}

type Panel =
  | { kind: "create" }
  | { kind: "edit"; account: StaffView }
  | { kind: "reset"; account: StaffView }
  | { kind: "delete"; account: StaffView }
  | { kind: "result"; result: PasswordResult };

function listPath(
  query: string,
  category: string,
  status: StaffStatus | "",
  cursor: string | null,
): string {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (category) params.set("category", category);
  if (status) params.set("status", status);
  if (cursor) params.set("cursor", cursor);
  const search = params.toString();
  return `/api/admin/staff${search ? `?${search}` : ""}`;
}

function WhenCell({ value }: { value: string | null }) {
  if (!value) return <span className="text-(--text-3)">কখনো না</span>;
  const text = formatWhen(value);
  const split = text.lastIndexOf(", ");
  if (split < 0) return <span className="whitespace-nowrap">{text}</span>;
  return (
    <span className="flex flex-col tabular-nums">
      <span className="whitespace-nowrap">{text.slice(0, split)}</span>
      <span className="text-xs whitespace-nowrap text-(--text-3)">{text.slice(split + 2)}</span>
    </span>
  );
}

function revealListTop(element: HTMLElement | null) {
  if (!element) return;
  const margin = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
  if (element.getBoundingClientRect().top >= margin) return;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
}

export function AccountsTab({
  categories,
  categoriesError,
  onCategoriesChanged,
}: {
  categories: readonly CategoryView[] | null;
  categoriesError: string | null;
  onCategoriesChanged: () => void;
}) {
  const toast = useToast();
  const listTop = useRef<HTMLDivElement>(null);
  const [typed, setTyped] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<StaffStatus | "">("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const close = useCallback(() => setPanel(null), []);

  const list = useInfiniteAdminData<ListResponse, StaffView>({
    key: JSON.stringify([query, category, status]),
    path: (cursor) => listPath(query, category, status, cursor),
    items: (page) => page.items,
    next: (page) => page.nextCursor,
  });
  const { items, firstPage, error, setPages, reload } = list;
  const filtered = Boolean(query || category || status);
  const total = firstPage?.total ?? 0;

  const replaceAccount = useCallback(
    (account: StaffView) => {
      setPages((pages) =>
        pages.map((page) => ({
          ...page,
          items: page.items.map((item) => (item.id === account.id ? account : item)),
        })),
      );
    },
    [setPages],
  );

  const backToEdit = useCallback(() => {
    setPanel((current) =>
      current && (current.kind === "reset" || current.kind === "delete")
        ? { kind: "edit", account: current.account }
        : null,
    );
  }, []);

  function submit(event: FormEvent) {
    event.preventDefault();
    setQuery(typed.trim());
    revealListTop(listTop.current);
  }

  function clearSearch() {
    setTyped("");
    setQuery("");
    revealListTop(listTop.current);
  }

  async function confirmDelete(account: StaffView) {
    setDeleting(true);
    try {
      await adminApi(`/api/admin/staff/${account.id}`, { method: "DELETE" });
      toast.success(`${account.name}-এর অ্যাকাউন্ট মুছে ফেলা হয়েছে।`);
      setPanel(null);
      setPages((pages) =>
        pages.map((page, index) => ({
          ...page,
          items: page.items.filter((item) => item.id !== account.id),
          total: index === 0 && page.total !== null ? Math.max(0, page.total - 1) : page.total,
        })),
      );
      onCategoriesChanged();
    } catch (failure) {
      toast.error(errorMessage(failure));
    } finally {
      setDeleting(false);
    }
  }

  const columns: VirtualColumn<StaffView>[] = [
    {
      key: "name",
      label: "নাম ও ইমেইল",
      primary: true,
      width: "minmax(0, 1.6fr)",
      render: (row) => (
        <span className="flex min-w-0 flex-col">
          <span className="font-medium break-words text-(--text-1)">{row.name}</span>
          <span className="text-xs break-all text-(--text-3)">{row.email}</span>
        </span>
      ),
    },
    {
      key: "category",
      label: "ক্যাটাগরি",
      width: "minmax(0, 1fr)",
      render: (row) => (
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="break-words">{row.categoryName}</span>
          <RoleBadge role={row.role} />
        </span>
      ),
    },
    {
      key: "phone",
      label: "ফোন",
      width: "7.5rem",
      className: "tabular-nums",
      render: (row) =>
        row.phone ? (
          <span className="break-all">{row.phone}</span>
        ) : (
          <span className="text-(--text-3)">নেই</span>
        ),
    },
    {
      key: "status",
      label: "অবস্থা",
      width: "4.5rem",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "password",
      label: "পাসওয়ার্ড",
      width: "6.5rem",
      render: (row) =>
        row.mustChangePassword ? (
          <Badge tone="warn">নিজে বদলাননি</Badge>
        ) : (
          <span className="text-xs text-(--text-3)">বদলেছেন</span>
        ),
    },
    {
      key: "lastLogin",
      label: "শেষ লগইন",
      width: "8.5rem",
      render: (row) => <WhenCell value={row.lastLoginAt} />,
    },
  ];

  const categoryList = categories ?? [];

  return (
    <>
      <div ref={listTop} className="scroll-mt-16 lg:scroll-mt-4">
        <Card padded={false}>
          <div className="flex flex-col gap-2 border-b border-(--border) p-3 sm:p-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <form onSubmit={submit} className="flex min-w-0 flex-1 gap-2" role="search">
                <div className="relative min-w-0 flex-1">
                  <SearchIcon className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-3)" />
                  <Input
                    aria-label="নাম, ইমেইল বা ফোনে খুঁজুন"
                    placeholder="নাম, ইমেইল বা ফোন"
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    className="ps-9 pe-10"
                  />
                  {typed ? (
                    <IconButton
                      label="খোঁজা মুছুন"
                      onClick={clearSearch}
                      className="absolute end-0.5 top-1/2 h-9 w-9 -translate-y-1/2"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </IconButton>
                  ) : null}
                </div>
                <Button type="submit">খুঁজুন</Button>
              </form>
              <Button
                tone="primary"
                icon={<PlusIcon className="h-4 w-4" />}
                disabled={!categories || categoryList.length === 0}
                onClick={() => setPanel({ kind: "create" })}
              >
                নতুন অ্যাকাউন্ট
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                aria-label="ক্যাটাগরি অনুযায়ী ছাঁকুন"
                value={category}
                onChange={(event) => {
                  setCategory(event.target.value);
                  revealListTop(listTop.current);
                }}
                className="sm:w-56"
              >
                <option value="">সব ক্যাটাগরি</option>
                {categoryOptionGroups(categoryList).map((group) => (
                  <optgroup key={group.role} label={group.label}>
                    {group.items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Select>
              <Select
                aria-label="অবস্থা অনুযায়ী ছাঁকুন"
                value={status}
                onChange={(event) => {
                  const value = event.target.value;
                  setStatus(value === "active" || value === "suspended" ? value : "");
                  revealListTop(listTop.current);
                }}
                className="sm:w-44"
              >
                <option value="">সব অবস্থা</option>
                <option value="active">{STATUS_LABELS.active}</option>
                <option value="suspended">{STATUS_LABELS.suspended}</option>
              </Select>
            </div>
            {categoriesError ? (
              <p className="text-xs text-(--danger)">ক্যাটাগরি আনা যায়নি: {categoriesError}</p>
            ) : null}
          </div>

          <div className="p-3 sm:p-4" aria-busy={list.loading}>
            {!firstPage && error ? (
              <LoadError message={error} onRetry={list.retry} />
            ) : !firstPage ? (
              <Skeleton rows={5} />
            ) : items.length === 0 && !list.hasMore ? (
              <EmptyState
                title={filtered ? "কিছু পাওয়া যায়নি" : "এখনো কোনো স্টাফ অ্যাকাউন্ট নেই"}
              >
                {filtered
                  ? "অন্য শব্দে খুঁজে দেখুন বা ছাঁকনি বদলান।"
                  : "মডারেটর বা আলেমদের জন্য নতুন অ্যাকাউন্ট তৈরি করুন।"}
              </EmptyState>
            ) : (
              <>
                <p className="mb-3 text-xs text-(--text-3) tabular-nums">
                  মোট {formatCount(total)}টি অ্যাকাউন্ট
                  {items.length < total ? ` · ${formatCount(items.length)}টি দেখানো হচ্ছে` : null}
                </p>
                <VirtualDataList
                  rows={items}
                  columns={columns}
                  rowKey={(row) => row.id}
                  onRowClick={(row) => setPanel({ kind: "edit", account: row })}
                  estimateRowHeight={64}
                  estimateCardHeight={200}
                  hasMore={list.hasMore}
                  loadingMore={list.loadingMore}
                  error={error}
                  onLoadMore={list.loadMore}
                  onRetry={list.retry}
                  endLabel="সব অ্যাকাউন্ট দেখানো হয়েছে"
                />
              </>
            )}
          </div>
        </Card>
      </div>

      {panel?.kind === "create" ? (
        <CreateAccountDialog
          categories={categoryList}
          onClose={close}
          onCreated={(result) => {
            setPanel({ kind: "result", result });
            reload();
            onCategoriesChanged();
          }}
        />
      ) : null}

      {panel?.kind === "edit" ? (
        <EditAccountDialog
          key={panel.account.id}
          account={panel.account}
          categories={categoryList}
          onClose={close}
          onSaved={(account) => {
            replaceAccount(account);
            setPanel(null);
            if (account.categoryId !== panel.account.categoryId) onCategoriesChanged();
          }}
          onResetPassword={(account) => setPanel({ kind: "reset", account })}
          onDelete={(account) => setPanel({ kind: "delete", account })}
        />
      ) : null}

      {panel?.kind === "reset" ? (
        <ResetPasswordDialog
          account={panel.account}
          onClose={backToEdit}
          onDone={(result) => {
            replaceAccount(result.account);
            setPanel({ kind: "result", result });
          }}
        />
      ) : null}

      <ConfirmDialog
        open={panel?.kind === "delete"}
        title="অ্যাকাউন্টটি মুছে ফেলবেন?"
        message={
          panel?.kind === "delete" ? (
            <>
              <span className="block font-medium break-words text-(--text-1)">
                {panel.account.name}
              </span>
              <span className="block break-all">{panel.account.email}</span>
              <span className="mt-2 block">
                অ্যাকাউন্টটি স্থায়ীভাবে মুছে যাবে, ব্যক্তি সঙ্গে সঙ্গে লগআউট হবেন এবং আর লগইন করতে
                পারবেন না। এটি ফেরত আনা যাবে না। সাময়িকভাবে বন্ধ রাখতে চাইলে মুছে না ফেলে স্থগিত
                করুন।
              </span>
            </>
          ) : null
        }
        confirmLabel="স্থায়ীভাবে মুছুন"
        busy={deleting}
        onClose={backToEdit}
        onConfirm={() => {
          if (panel?.kind === "delete") void confirmDelete(panel.account);
        }}
      />

      {panel?.kind === "result" ? (
        <PasswordResultDialog result={panel.result} onClose={close} />
      ) : null}
    </>
  );
}
