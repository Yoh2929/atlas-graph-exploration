import { useSigmaGraph } from "../hooks/useSigmaGraph";
import type { GraphData } from "../types";

interface Props { data: GraphData; selectedId: string | null; focusIds?: Set<string>; favoriteIds?: Set<string>; onSelectNode: (id: string) => void; }

export default function GraphCanvas(props: Props) {
  const { containerRef, rendererRef } = useSigmaGraph(props);
  return <div className="atlas-graph relative h-full w-full animate-[graphReveal_.7s_ease-out]">
    <div ref={containerRef} className="h-full w-full outline-none" />
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0b101b]/75 p-1.5 shadow-2xl backdrop-blur-xl">
      <button aria-label="Zoomer" className="h-9 w-9 rounded-xl text-lg text-ink-dim hover:bg-white/10 hover:text-white" onClick={() => rendererRef.current?.getCamera().animatedZoom({ duration: 220 })}>+</button>
      <button aria-label="Dézoomer" className="h-9 w-9 rounded-xl text-lg text-ink-dim hover:bg-white/10 hover:text-white" onClick={() => rendererRef.current?.getCamera().animatedUnzoom({ duration: 220 })}>−</button>
      <button aria-label="Recentrer" className="h-9 w-9 rounded-xl text-sm text-ink-dim hover:bg-white/10 hover:text-white" onClick={() => rendererRef.current?.getCamera().animatedReset({ duration: 500 })}>◎</button>
    </div>
    <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-bg/60 px-3 py-1.5 text-[10px] text-ink-dim backdrop-blur sm:block">Cliquez un point pour révéler sa constellation</p>
  </div>;
}
