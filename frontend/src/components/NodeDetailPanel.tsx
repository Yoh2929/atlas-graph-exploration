import { useEffect, useMemo, useState } from "react";

import { CATEGORY_COLORS } from "../constants";
import { useBiography } from "../hooks/useBiography";
import { useNode } from "../hooks/useNode";
import { CATEGORY_LABELS } from "../types";
import type { SourceLink, User } from "../types";
import MathText from "./MathText";

interface Props {
  nodeId: string;
  user: User | null;
  onSelectNode: (id: string) => void;
  onClose: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
}

interface NeighborRow {
  id: string;
  label: string;
  category?: string;
  relation: string;
  displayRelationLabel: string;
  direction: "in" | "out";
}

const normalize = (value: string) => value
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("fr");

export default function NodeDetailPanel({ nodeId, user, onSelectNode, onClose, favorite = false, onToggleFavorite }: Props) {
  const { node, neighbors, loading } = useNode(nodeId);
  const { biography, loading: biographyLoading } = useBiography(nodeId);
  const [bioExpanded, setBioExpanded] = useState(false);
  const [relationQuery, setRelationQuery] = useState("");

  useEffect(() => {
    setBioExpanded(false);
    setRelationQuery("");
  }, [nodeId]);

  const rows = neighbors as NeighborRow[];
  const filteredRows = useMemo(() => {
    const query = normalize(relationQuery.trim());
    if (!query) return rows;
    return rows.filter((item) => normalize([
      item.label,
      item.displayRelationLabel,
      item.relation,
      item.category || "",
    ].join(" ")).includes(query));
  }, [relationQuery, rows]);
  const people = filteredRows.filter((item) => item.category === "person");
  const concepts = filteredRows.filter((item) => item.category !== "person");
  const totalPeople = rows.filter((item) => item.category === "person").length;
  const totalConcepts = rows.length - totalPeople;

  if (loading || !node) {
    return <aside className="grid h-full place-items-center border-l border-white/10 bg-surface"><div className="h-6 w-6 animate-spin rounded-full border-2 border-white/10 border-t-category-algorithm" /></aside>;
  }

  const color = CATEGORY_COLORS[node.category];
  const sources = Array.isArray(node.properties.sources) ? (node.properties.sources as SourceLink[]).filter((source) => source?.url) : [];
  const wikipedia = sources.find((source) => source.provider === "Wikipedia");
  const wikidata = sources.find((source) => source.provider === "Wikidata");
  const fullBio = biography?.extract || node.description || "Aucune description disponible.";
  const shownBio = !bioExpanded && fullBio.length > 520 ? `${fullBio.slice(0, 520).trim()}…` : fullBio;

  const RelationList = ({ items }: { items: NeighborRow[] }) => (
    <div className="overflow-hidden rounded-2xl border border-white/[.08] bg-black/10">
      {items.map((item) => (
        <button key={`${item.id}-${item.relation}-${item.direction}`} onClick={() => onSelectNode(item.id)}
          className="group relative w-full border-b border-white/[.07] px-4 py-3.5 text-left last:border-b-0 hover:bg-white/[.045]">
          <span className="flex items-center gap-3"><span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{backgroundColor:CATEGORY_COLORS[item.category as keyof typeof CATEGORY_COLORS]||"#8fa3c7"}}/><span className="min-w-0 flex-1 truncate text-sm text-[#e7eaf1] group-hover:text-white">{item.label}</span><span className="translate-x-0 text-xs text-ink-dim transition-transform group-hover:translate-x-1">→</span></span>
          <span className="mt-2 flex min-w-0 items-center gap-2 pl-[18px] text-[10px] leading-4 text-ink-dim"><span className="max-w-[34%] truncate">{node.label}</span><strong className="shrink-0 rounded-full border border-white/[.08] bg-white/[.035] px-2 py-0.5 font-normal text-[#aeb7ca]">{item.displayRelationLabel}</strong><span className="truncate">{item.label}</span></span>
        </button>
      ))}
    </div>
  );

  return (
    <aside className="flex h-full flex-col overflow-y-auto border-l border-white/10 bg-[#101521]/95 backdrop-blur-xl">
      {biography?.image_url && (
        <div className="relative h-52 shrink-0 overflow-hidden bg-bg">
          <img src={biography.image_url} alt={`Portrait ou illustration de ${node.label}`} className="h-full w-full object-cover object-top" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#101521] via-transparent to-transparent" />
          {biography.image_original_url && <a href={biography.image_original_url} target="_blank" rel="noreferrer" className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-[10px] text-white/80 backdrop-blur hover:text-white">Image originale ↗</a>}
        </div>
      )}

      <div className="sticky top-0 z-10 border-b border-white/10 bg-[#101521]/95 p-5 backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between">
          <span className="rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider" style={{ borderColor: `${color}55`, backgroundColor: `${color}14`, color }}>{CATEGORY_LABELS[node.category]}</span>
          <div className="flex gap-1">
            <button aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"} onClick={onToggleFavorite} title={user ? "Enregistrer ce repère" : "Connectez-vous pour enregistrer ce repère"} className={`rounded-lg p-2 text-lg hover:bg-white/5 ${favorite ? "text-[#ffd166]" : "text-ink-dim"}`}>{favorite ? "★" : "☆"}</button>
            <button aria-label="Fermer la fiche" onClick={onClose} className="rounded-lg px-2.5 py-2 text-sm text-ink-dim hover:bg-white/5 hover:text-ink">✕</button>
          </div>
        </div>
        <h2 className="text-balance font-display text-[28px] leading-tight">{node.label}</h2>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-wider text-ink-dim">{node.degree} connexions vérifiées</p>
      </div>

      <div className="space-y-7 p-5">
        <section>
          <div className="mb-2 flex items-center justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[.18em] text-ink-dim">Biographie et contexte</p>
            {biographyLoading && <span className="animate-pulse text-[10px] text-ink-dim">Wikipedia…</span>}
          </div>
          <MathText text={shownBio} className="text-sm leading-6 text-[#cbd0dc]" />
          {fullBio.length > 520 && <button onClick={() => setBioExpanded((value) => !value)} className="mt-2 text-xs text-category-algorithm hover:underline">{bioExpanded ? "Réduire" : "Lire la suite"}</button>}
        </section>

        <section>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[.18em] text-ink-dim">Sources fiables</p>
          <div className="flex flex-wrap gap-2">
            {wikipedia && <a href={wikipedia.url} target="_blank" rel="noreferrer" className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[#111521] hover:bg-category-theorem">Lire sur Wikipedia ↗</a>}
            {wikidata && <a href={wikidata.url} target="_blank" rel="noreferrer" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-ink-dim hover:text-ink">Fiche Wikidata ↗</a>}
          </div>
        </section>

        {rows.length > 0 && (
          <section className="sticky top-[132px] z-[5] -mx-1 rounded-2xl border border-white/[.09] bg-[#111827]/95 p-2 shadow-[0_12px_35px_rgba(0,0,0,.28)] backdrop-blur-xl">
            <label htmlFor="relation-search" className="sr-only">Filtrer les connexions</label>
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 focus-within:border-[#9eb5ff]/45">
              <span className="text-sm text-[#9eb5ff]">⌕</span>
              <input
                id="relation-search"
                value={relationQuery}
                onChange={(event) => setRelationQuery(event.target.value)}
                placeholder="Filtrer les connexions…"
                className="h-10 min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-ink-dim"
              />
              {relationQuery && (
                <button onClick={() => setRelationQuery("")} aria-label="Effacer le filtre" className="rounded-md px-1.5 py-1 text-xs text-ink-dim hover:bg-white/10 hover:text-white">✕</button>
              )}
            </div>
            {relationQuery && (
              <p className="px-2 pt-2 text-[10px] text-ink-dim">{filteredRows.length} connexion{filteredRows.length > 1 ? "s" : ""} trouvée{filteredRows.length > 1 ? "s" : ""}</p>
            )}
          </section>
        )}

        {(people.length > 0 || (!relationQuery && totalPeople > 0)) && <section><div className="mb-2 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-category-person">Personnes associées</p><span className="text-xs text-ink-dim">{relationQuery ? `${people.length} / ${totalPeople}` : people.length}</span></div>{people.length ? <RelationList items={people} /> : <p className="text-xs text-ink-dim">Aucune personne ne correspond au filtre.</p>}</section>}
        <section><div className="mb-2 flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[.18em] text-ink-dim">Idées connectées</p><span className="text-xs text-ink-dim">{relationQuery ? `${concepts.length} / ${totalConcepts}` : concepts.length}</span></div>{concepts.length ? <RelationList items={concepts} /> : <p className="text-xs text-ink-dim">{relationQuery ? "Aucune idée ne correspond au filtre." : "Aucune autre relation fiable."}</p>}</section>

      </div>
    </aside>
  );
}
