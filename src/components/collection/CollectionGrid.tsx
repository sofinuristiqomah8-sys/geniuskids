"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { t } from "@/lib/i18n";
import { relativeTimeId } from "@/lib/date";
import type { StoryStatus } from "@/lib/database.types";
import DeleteStoryButton from "./DeleteStoryButton";

export type CollectionItem = {
  id: string;
  title: string | null;
  status: StoryStatus;
  themeLabel: string | null;
  subthemeLabel: string | null;
  errorMessage: string | null;
  childName: string | null;
  coverUrl: string | null;
  createdAt: string;
  sceneCount: number;
  imageCount: number;
  audioCount: number;
  progress: number | null;
};

type Filter = "all" | "ready" | "generating" | "error";
type SortMode = "newest" | "oldest" | "title" | "child";

const collator = new Intl.Collator("id-ID", { numeric: true, sensitivity: "base" });

function isGenerating(status: StoryStatus) {
  return status !== "ready" && status !== "error";
}

function normalize(value: string | null | undefined) {
  return (value ?? "").toLocaleLowerCase("id-ID");
}

function clampProgress(value: number | null) {
  if (value === null) return null;
  return Math.max(0, Math.min(100, value));
}

function badge(status: StoryStatus): { text: string; className: string } {
  if (status === "ready")
    return { text: t("collection.statusReady"), className: "bg-emerald-100 text-emerald-700" };
  if (status === "error")
    return { text: t("collection.statusError"), className: "bg-red-100 text-red-600" };
  return { text: t("collection.statusGenerating"), className: "bg-amber-100 text-amber-700" };
}

export default function CollectionGrid({ items }: { items: CollectionItem[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [childFilter, setChildFilter] = useState("all");
  const [sort, setSort] = useState<SortMode>("newest");

  const counts = useMemo(
    () => ({
      all: items.length,
      ready: items.filter((i) => i.status === "ready").length,
      generating: items.filter((i) => isGenerating(i.status)).length,
      error: items.filter((i) => i.status === "error").length,
    }),
    [items]
  );

  const childOptions = useMemo(() => {
    const names = items.map((i) => i.childName).filter((name): name is string => Boolean(name));
    return [...new Set(names)].sort((a, b) => collator.compare(a, b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());

    return items
      .filter((i) => {
        if (filter === "ready" && i.status !== "ready") return false;
        if (filter === "generating" && !isGenerating(i.status)) return false;
        if (filter === "error" && i.status !== "error") return false;
        if (childFilter !== "all" && i.childName !== childFilter) return false;
        if (!q) return true;

        return [
          i.title,
          i.childName,
          i.themeLabel,
          i.subthemeLabel,
          i.errorMessage,
          i.status,
        ].some((value) => normalize(value).includes(q));
      })
      .sort((a, b) => {
        if (sort === "oldest") return Date.parse(a.createdAt) - Date.parse(b.createdAt);
        if (sort === "title") return collator.compare(a.title ?? "", b.title ?? "");
        if (sort === "child") {
          const byChild = collator.compare(a.childName ?? "", b.childName ?? "");
          return byChild || Date.parse(b.createdAt) - Date.parse(a.createdAt);
        }
        return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      });
  }, [items, query, filter, childFilter, sort]);

  const hasActiveControls =
    query.trim() !== "" || filter !== "all" || childFilter !== "all" || sort !== "newest";

  function resetControls() {
    setQuery("");
    setFilter("all");
    setChildFilter("all");
    setSort("newest");
  }

  const chips: { id: Filter; label: string; count: number }[] = [
    { id: "all", label: t("collection.filterAll"), count: counts.all },
    { id: "ready", label: t("collection.filterReady"), count: counts.ready },
    { id: "generating", label: t("collection.filterGenerating"), count: counts.generating },
    { id: "error", label: t("collection.filterError"), count: counts.error },
  ];

  return (
    <div>
      <div className="mb-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_150px]">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            🔍
          </span>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("collection.search")}
            className="field-input pl-9"
          />
        </div>

        <label className="sr-only" htmlFor="collection-sort">
          {t("collection.sortBy")}
        </label>
        <select
          id="collection-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
          className="field-input"
        >
          <option value="newest">{t("collection.sortNewest")}</option>
          <option value="oldest">{t("collection.sortOldest")}</option>
          <option value="title">{t("collection.sortTitle")}</option>
          <option value="child">{t("collection.sortChild")}</option>
        </select>
      </div>

      {childOptions.length > 1 && (
        <div className="mb-3">
          <label className="sr-only" htmlFor="collection-child">
            {t("collection.childFilter")}
          </label>
          <select
            id="collection-child"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="field-input"
          >
            <option value="all">{t("collection.childAll")}</option>
            {childOptions.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setFilter(c.id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition active:scale-95 ${
              filter === c.id
                ? "bg-brand-primary text-white shadow-sm"
                : "bg-surface-card text-ink-soft ring-1 ring-black/[0.06] hover:bg-surface-soft"
            }`}
          >
            {c.label} <span className="opacity-70">{c.count}</span>
          </button>
        ))}
      </div>

      <div className="mb-5 flex min-h-6 items-center justify-between gap-3 text-[11px] text-ink-faint">
        <span>{t("collection.showing", { shown: filtered.length, total: items.length })}</span>
        {hasActiveControls && (
          <button
            type="button"
            onClick={resetControls}
            className="font-semibold text-brand-primary transition hover:text-brand-primary/80"
          >
            {t("collection.resetFilters")}
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="py-14 text-center">
          <p className="text-sm text-ink-soft">{t("collection.noMatch")}</p>
          {hasActiveControls && (
            <button
              type="button"
              onClick={resetControls}
              className="mt-3 rounded-full bg-surface-card px-4 py-2 text-xs font-bold text-brand-primary ring-1 ring-black/[0.06]"
            >
              {t("collection.resetFilters")}
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {filtered.map((item, i) => (
            <Card key={item.id} item={item} delay={Math.min(i, 10) * 0.05} />
          ))}
        </div>
      )}
    </div>
  );
}

function Card({ item, delay }: { item: CollectionItem; delay: number }) {
  const b = badge(item.status);
  const ready = item.status === "ready";
  const generating = isGenerating(item.status);
  const progress = generating ? clampProgress(item.progress) : null;
  const overlayLabel =
    item.status === "error"
      ? `↻ ${t("collection.recover")}`
      : ready
        ? `▶ ${t("collection.read")}`
        : `⏳ ${t("collection.resume")}`;

  return (
    <div
      className="card anim-fade-up hover-lift group relative overflow-hidden"
      style={{ animationDelay: `${delay}s` }}
    >
      <div className="absolute right-2 top-2 z-20">
        <DeleteStoryButton id={item.id} />
      </div>

      <Link href={`/story/${item.id}`} className="block">
        <div className="relative overflow-hidden">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.coverUrl}
              alt={item.title ?? "Cerita"}
              className="aspect-square w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex aspect-square w-full items-center justify-center bg-gradient-to-br from-brand-primary/15 via-brand-accent/10 to-amber-200/35 text-3xl">
              📖
            </div>
          )}

          {generating && (
            <div className="absolute inset-x-0 bottom-0 h-1 overflow-hidden bg-amber-200/60">
              <span className="shimmer absolute inset-0" />
            </div>
          )}

          <span
            className={`absolute left-2 top-2 max-w-[calc(100%-3rem)] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold shadow-sm ${b.className}`}
          >
            {b.text}
          </span>

          <div className="absolute inset-0 flex items-center justify-center bg-ink/25 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100">
            <span className="rounded-full bg-surface-card px-4 py-1.5 text-xs font-bold text-brand-primary shadow">
              {overlayLabel}
            </span>
          </div>
        </div>

        <div className="p-3">
          <p className="line-clamp-2 min-h-[2.2rem] text-sm font-bold leading-snug text-ink">
            {item.title ?? "Cerita untuk " + (item.childName ?? "si kecil")}
          </p>

          <div className="mt-1.5 flex min-h-[1.35rem] flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
            {item.themeLabel && (
              <span className="max-w-full truncate rounded-full bg-surface-soft px-1.5 py-0.5 font-semibold text-ink-soft">
                {item.themeLabel}
              </span>
            )}
            {item.subthemeLabel && (
              <span className="max-w-full truncate rounded-full bg-brand-accent/10 px-1.5 py-0.5 font-semibold text-brand-primary">
                {item.subthemeLabel}
              </span>
            )}
          </div>

          {progress !== null && (
            <div className="mt-2">
              <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-ink-faint">
                <span>{t("collection.progress")}</span>
                <span>{progress}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-amber-100">
                <span
                  className="block h-full rounded-full bg-amber-400 transition-[width]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {item.status === "error" && item.errorMessage && (
            <p className="mt-2 line-clamp-2 rounded-md bg-red-50 px-2 py-1 text-[10px] font-medium leading-snug text-red-600">
              {item.errorMessage}
            </p>
          )}

          <div className="mt-2 flex min-h-[1rem] flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
            {item.sceneCount > 0 && (
              <span>{t("collection.scenes", { count: item.sceneCount })}</span>
            )}
            {item.sceneCount > 0 && (
              <span>{t("collection.assets", { images: item.imageCount, audio: item.audioCount })}</span>
            )}
          </div>

          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-ink-faint">
            <span className="min-w-0 flex-1 truncate">
              {item.childName ? t("collection.for", { name: item.childName }) : ""}
            </span>
            <span className="flex-none">{relativeTimeId(item.createdAt)}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
