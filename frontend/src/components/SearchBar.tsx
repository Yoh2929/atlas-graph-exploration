import { useState } from "react";

import { useSearchNodes } from "../hooks/useSearchNodes";
import { CATEGORY_LABELS } from "../types";
import type { Category, GraphNode } from "../types";

interface Props {
  onSelectNode: (id: string) => void;
}

const MAX_VISIBLE_RESULTS = 80;
const CATEGORIES = Object.entries(CATEGORY_LABELS) as [Category, string][];

export default function SearchBar({ onSelectNode }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);
  const [category, setCategory] = useState<Category | "all">("all");
  const { results, loading } = useSearchNodes(query, category === "all" ? undefined : category);
  const visibleResults = results.slice(0, MAX_VISIBLE_RESULTS);

  function update(value: string) {
    setQuery(value);
    setOpen(true);
    setCursor(0);
  }

  function select(node: GraphNode) {
    setQuery("");
    setOpen(false);
    onSelectNode(node.id);
  }

  return (
    <div className="relative mx-auto w-full max-w-2xl">
      <div className="group flex items-center rounded-2xl border border-white/10 bg-[#111827]/75 px-4 shadow-[0_16px_60px_rgba(0,0,0,.3)] backdrop-blur-xl focus-within:border-white/25">
        <span className="mr-3 text-category-algorithm">⌕</span>
        <input
          id="atlas-search"
          value={query}
          onChange={(event) => update(event.target.value)}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!event.currentTarget.parentElement?.contains(event.relatedTarget as Node | null)) {
              window.setTimeout(() => setOpen(false), 160);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setCursor((current) => Math.min(visibleResults.length - 1, current + 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setCursor((current) => Math.max(0, current - 1));
            }
            if (event.key === "Enter" && visibleResults[cursor]) select(visibleResults[cursor]);
            if (event.key === "Escape") {
              update("");
              setOpen(false);
            }
          }}
          placeholder="Chercher dans toute la base…"
          className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-ink-dim"
        />
        {loading ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/70" />
        ) : (
          <kbd className="hidden rounded-md border border-white/10 px-1.5 py-0.5 font-mono text-[9px] text-ink-dim sm:block">/</kbd>
        )}
        <label htmlFor="atlas-theme" className="sr-only">Filtrer par thème</label>
        <select
          id="atlas-theme"
          value={category}
          onChange={(event) => {
            setCategory(event.target.value as Category | "all");
            setOpen(true);
            setCursor(0);
          }}
          onFocus={() => setOpen(true)}
          className="ml-2 max-w-[112px] border-l border-white/10 bg-transparent py-1 pl-2 text-[10px] text-[#cbd3e4] outline-none sm:max-w-[150px] sm:text-xs"
        >
          <option value="all" className="bg-[#111827]">Tous les thèmes</option>
          {CATEGORIES.map(([value, label]) => <option key={value} value={value} className="bg-[#111827]">{label}</option>)}
        </select>
      </div>

      {open && (query.trim().length >= 2 || category !== "all") && (
        <div className="absolute left-0 right-0 top-14 z-50 overflow-hidden rounded-2xl border border-white/10 bg-[#111827]/95 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-center justify-between border-b border-white/[.06] px-4 py-3">
            <span className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-dim">{category === "all" ? "Base complète" : CATEGORY_LABELS[category]}</span>
            <span className="text-[10px] text-ink-dim">{loading ? "Recherche…" : `${results.length}${results.length === 150 ? "+" : ""} résultats`}</span>
          </div>
          <div className="max-h-[min(68vh,560px)] overflow-y-auto p-2">
            {visibleResults.map((node, index) => (
              <button
                key={node.id}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => select(node)}
                onMouseEnter={() => setCursor(index)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${cursor === index ? "bg-white/[.08]" : "hover:bg-white/[.05]"}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[.03] text-[10px] text-ink-dim">{node.degree}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-ink">{node.label}</span>
                  <span className="mt-0.5 block truncate text-[11px] text-ink-dim">{node.description || `${node.degree} connexions`}</span>
                </span>
                <span className="text-xs text-ink-dim">↵</span>
              </button>
            ))}
            {!loading && !visibleResults.length && (
              <p className="px-3 py-8 text-center text-xs text-ink-dim">Aucune correspondance dans la base.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
