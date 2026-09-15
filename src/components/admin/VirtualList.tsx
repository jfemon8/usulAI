"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { clsx } from "clsx";
import { Button, Spinner, type Column } from "@/components/admin/ui";
import { RetryIcon } from "@/components/ui/Icons";

const LOAD_AHEAD_ROWS = 6;

function useScrollMargin() {
  const ref = useRef<HTMLDivElement>(null);
  const [margin, setMargin] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const measure = () => {
      const top = Math.round(element.getBoundingClientRect().top + window.scrollY);
      setMargin((current) => (current === top ? current : top));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(document.documentElement);
    if (element.parentElement) observer.observe(element.parentElement);
    window.addEventListener("resize", measure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return { ref, margin };
}

function subscribeMedia(query: string) {
  return (notify: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", notify);
    return () => media.removeEventListener("change", notify);
  };
}

export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(
    subscribeMedia(query),
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

function useElementWidth() {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = Math.round(entry?.contentRect.width ?? 0);
      setWidth((current) => (current === next ? current : next));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export interface VirtualFeedProps {
  hasMore?: boolean;
  loadingMore?: boolean;
  error?: string | null;
  onLoadMore?: () => void;
  onRetry?: () => void;
  endLabel?: ReactNode;
}

function FeedFooter({
  hasMore,
  loadingMore,
  error,
  onRetry,
  endLabel,
  count,
}: VirtualFeedProps & { count: number }) {
  if (error) {
    return (
      <div
        className="flex flex-col items-center gap-2 py-4 text-center text-sm text-(--danger)"
        role="alert"
      >
        <span>{error}</span>
        {onRetry ? (
          <Button size="sm" onClick={onRetry} icon={<RetryIcon className="h-4 w-4" />}>
            আবার চেষ্টা
          </Button>
        ) : null}
      </div>
    );
  }
  if (loadingMore) {
    return (
      <div
        className="flex items-center justify-center gap-2 py-4 text-sm text-(--text-3)"
        role="status"
      >
        <Spinner />
        আরও লোড হচ্ছে…
      </div>
    );
  }
  if (!hasMore && count > 0 && endLabel !== null) {
    return <p className="py-4 text-center text-xs text-(--text-3)">{endLabel ?? "তালিকার শেষ"}</p>;
  }
  return null;
}

export function VirtualList<T>({
  items,
  getKey,
  renderItem,
  estimateSize,
  gap = 8,
  overscan = 6,
  className,
  hasMore = false,
  loadingMore = false,
  error = null,
  onLoadMore,
  onRetry,
  endLabel,
}: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  estimateSize: number;
  gap?: number;
  overscan?: number;
  className?: string;
} & VirtualFeedProps) {
  const { ref, margin } = useScrollMargin();

  const virtualizer = useWindowVirtualizer({
    count: items.length,
    estimateSize: () => estimateSize,
    overscan,
    gap,
    scrollMargin: margin,
    getItemKey: (index) => {
      const item = items[index];
      return item === undefined ? index : getKey(item, index);
    },
  });

  const virtualItems = virtualizer.getVirtualItems();
  const lastIndex = virtualItems.at(-1)?.index ?? -1;

  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore || error) return;
    if (lastIndex >= items.length - LOAD_AHEAD_ROWS) onLoadMore();
  }, [lastIndex, items.length, hasMore, loadingMore, error, onLoadMore]);

  return (
    <div ref={ref} className={className}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          if (item === undefined) return null;
          return (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              className="absolute top-0 left-0 w-full"
              style={{
                transform: `translateY(${virtualItem.start - virtualizer.options.scrollMargin}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
      <FeedFooter
        hasMore={hasMore}
        loadingMore={loadingMore}
        error={error}
        onRetry={onRetry}
        endLabel={endLabel}
        count={items.length}
      />
    </div>
  );
}

export function VirtualGrid<T>({
  items,
  getKey,
  renderItem,
  minColumnWidth,
  maxColumns = 8,
  estimateRowHeight,
  gap = 12,
  className,
  ...feed
}: {
  items: readonly T[];
  getKey: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => ReactNode;
  minColumnWidth: number;
  maxColumns?: number;
  estimateRowHeight: number;
  gap?: number;
  className?: string;
} & VirtualFeedProps) {
  const { ref, width } = useElementWidth();
  const columns = Math.max(
    1,
    Math.min(maxColumns, Math.floor((width + gap) / (minColumnWidth + gap)) || 1),
  );
  const rows: { key: string; start: number; cells: T[] }[] = [];
  for (let start = 0; start < items.length; start += columns) {
    const cells = items.slice(start, start + columns);
    const first = cells[0];
    if (first !== undefined) rows.push({ key: `${columns}:${getKey(first, start)}`, start, cells });
  }

  return (
    <div ref={ref} className={className}>
      {width > 0 ? (
        <VirtualList
          items={rows}
          getKey={(row) => row.key}
          estimateSize={estimateRowHeight}
          gap={gap}
          {...feed}
          renderItem={(row) => (
            <div
              className="grid"
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}
            >
              {row.cells.map((cell, offset) => (
                <div key={getKey(cell, row.start + offset)} className="min-w-0">
                  {renderItem(cell, row.start + offset)}
                </div>
              ))}
            </div>
          )}
        />
      ) : null}
    </div>
  );
}

export interface VirtualColumn<T> extends Column<T> {
  width?: string;
}

export function VirtualDataList<T>({
  rows,
  columns,
  rowKey,
  actions,
  actionsWidth = "auto",
  onRowClick,
  estimateRowHeight = 56,
  estimateCardHeight = 132,
  ...feed
}: {
  rows: readonly T[];
  columns: VirtualColumn<T>[];
  rowKey: (row: T) => string;
  actions?: (row: T) => ReactNode;
  actionsWidth?: string;
  onRowClick?: (row: T) => void;
  estimateRowHeight?: number;
  estimateCardHeight?: number;
} & VirtualFeedProps) {
  const desktop = useMediaQuery("(min-width: 768px)", true);
  const primary = columns.find((column) => column.primary) ?? columns[0];
  const secondary = columns.filter((column) => column !== primary);
  const template = [
    ...columns.map((column) => column.width ?? "minmax(0, 1fr)"),
    ...(actions ? [actionsWidth] : []),
  ].join(" ");

  if (desktop) {
    return (
      <div className="text-sm">
        <div
          className="grid gap-x-3 border-b border-(--border) px-3 py-2.5 text-xs font-medium text-(--text-3)"
          style={{ gridTemplateColumns: template }}
          role="row"
        >
          {columns.map((column) => (
            <div key={column.key} role="columnheader" className={clsx("min-w-0", column.className)}>
              {column.label}
            </div>
          ))}
          {actions ? <div role="columnheader" aria-label="কাজ" /> : null}
        </div>
        <VirtualList
          items={rows}
          getKey={(row) => rowKey(row)}
          estimateSize={estimateRowHeight}
          gap={0}
          {...feed}
          renderItem={(row) => (
            <div
              role="row"
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={clsx(
                "grid items-start gap-x-3 border-b border-(--border) px-3 py-3",
                onRowClick && "cursor-pointer hover:bg-(--surface-2)",
              )}
              style={{ gridTemplateColumns: template }}
            >
              {columns.map((column) => (
                <div
                  key={column.key}
                  role="cell"
                  className={clsx("min-w-0 text-(--text-1)", column.className)}
                >
                  {column.render(row)}
                </div>
              ))}
              {actions ? (
                <div
                  role="cell"
                  className="flex justify-end gap-1"
                  onClick={(event) => event.stopPropagation()}
                >
                  {actions(row)}
                </div>
              ) : null}
            </div>
          )}
        />
      </div>
    );
  }

  return (
    <VirtualList
      items={rows}
      getKey={(row) => rowKey(row)}
      estimateSize={estimateCardHeight}
      gap={8}
      {...feed}
      renderItem={(row) => (
        <div
          className={clsx(
            "rounded-xl border border-(--border) p-3.5",
            onRowClick && "active:bg-(--surface-2)",
          )}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {primary ? (
            <div className="text-sm font-medium break-words text-(--text-1)">
              {primary.render(row)}
            </div>
          ) : null}
          {secondary.length > 0 ? (
            <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {secondary.map((column) => (
                <div key={column.key} className="contents">
                  <dt className="text-(--text-3)">{column.label}</dt>
                  <dd className="min-w-0 break-words text-(--text-1)">{column.render(row)}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          {actions ? (
            <div
              className="mt-3 flex flex-wrap justify-end gap-1 border-t border-(--border) pt-2"
              onClick={(event) => event.stopPropagation()}
            >
              {actions(row)}
            </div>
          ) : null}
        </div>
      )}
    />
  );
}
