interface Props {
  lensLabel: string;
  onClearLens: () => void;
  onGenerate: () => void;
  loaded: number;
  offset: number;
  total?: number;
  hasMore: boolean;
  loadingMore: boolean;
  onNext: () => void;
  onPrevious: () => void;
}

export default function GraphControls({
  lensLabel,
  onClearLens,
  onGenerate,
  loaded,
  offset,
  total,
  hasMore,
  loadingMore,
  onNext,
  onPrevious,
}: Props) {
  return (
    <div className="absolute left-3 top-[84px] z-20 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5 sm:left-5">
      {lensLabel && (
        <button onClick={onClearLens} className="max-w-[220px] truncate rounded-xl bg-white/[.06] px-3 py-1.5 text-[10px] text-[#cbd3e4]" title="Revenir à la vue complète">
          {lensLabel} <span className="ml-1 opacity-50">×</span>
        </button>
      )}
      <button
        onClick={onGenerate}
        className="rounded-full border border-[#9eb5ff]/40 bg-[#28375f]/90 px-3.5 py-2 text-[11px] font-medium text-white shadow-[0_8px_28px_rgba(77,105,190,.28)] backdrop-blur-xl transition hover:border-[#b9c8ff]/70 hover:bg-[#34497d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9eb5ff]"
      >
        ✦ {lensLabel ? "Nouvelle dérive" : "Dérive"}
      </button>
      {offset > 0 && (
        <button
          onClick={onPrevious}
          disabled={loadingMore}
          className="rounded-full border border-white/20 bg-[#0c1320]/90 px-3 py-2 text-[10px] font-medium text-[#dce3f2] shadow-xl backdrop-blur-xl hover:bg-[#1a2436] hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          ← Lot précédent
        </button>
      )}
      {hasMore && (
        <button
          onClick={onNext}
          disabled={loadingMore}
          className="rounded-full border border-white/20 bg-[#0c1320]/90 px-3 py-2 text-[10px] font-medium text-[#dce3f2] shadow-xl backdrop-blur-xl hover:bg-[#1a2436] hover:text-white disabled:cursor-wait disabled:opacity-60"
        >
          {loadingMore ? "Chargement…" : "Lot suivant →"}
        </button>
      )}
      <span className="rounded-full bg-[#0c1320]/55 px-2.5 py-1.5 text-[9px] text-ink-dim backdrop-blur-xl">
        {(offset + 1).toLocaleString("fr-FR")}–{(offset + loaded).toLocaleString("fr-FR")}{total ? ` / ${total.toLocaleString("fr-FR")}` : ""}
      </span>
    </div>
  );
}
