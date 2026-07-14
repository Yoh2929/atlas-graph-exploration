interface Props { lensLabel: string; onClearLens: () => void; onGenerate: () => void; }
export default function GraphControls({ lensLabel,onClearLens,onGenerate }: Props) {
  return <div className="absolute left-3 top-[84px] z-20 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-1.5 sm:left-5">
    {lensLabel && <button onClick={onClearLens} className="max-w-[220px] truncate rounded-xl bg-white/[.06] px-3 py-1.5 text-[10px] text-[#cbd3e4]" title="Revenir à la vue complète">{lensLabel} <span className="ml-1 opacity-50">×</span></button>}
    <button onClick={onGenerate} className="rounded-full border border-white/10 bg-[#0c1320]/70 px-3 py-1.5 text-[10px] text-ink-dim shadow-xl backdrop-blur-xl hover:bg-white/[.06] hover:text-ink">Dérive</button>
  </div>;
}
