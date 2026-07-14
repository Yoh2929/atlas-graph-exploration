interface Props { onSearch: () => void; onDrift: () => void; }

export default function WelcomePanel({onSearch,onDrift}:Props){
  return <section className="pointer-events-none absolute bottom-7 left-5 z-10 hidden max-w-[390px] sm:block">
    <div className="mb-4 h-px w-14 bg-gradient-to-r from-[#8da9ff] to-transparent"/>
    <p className="font-mono text-[9px] uppercase tracking-[.28em] text-[#8da9ff]">Atlas mathématique</p>
    <h2 className="mt-3 text-balance font-display text-4xl leading-[1.02] text-[#f2efe7]">Voyagez dans les idées qui ont changé notre manière de penser.</h2>
    <p className="mt-4 max-w-sm text-sm leading-6 text-[#9ea7ba]">Chaque lumière est une personne, un problème ou une découverte. Tournez librement dans la carte, puis ouvrez un point pour suivre son histoire.</p>
    <div className="pointer-events-auto mt-5 flex gap-2">
      <button onClick={onSearch} className="rounded-full bg-[#eef1f8] px-4 py-2 text-xs font-medium text-[#0a0e16] hover:bg-white">Commencer une recherche</button>
      <button onClick={onDrift} className="rounded-full border border-white/15 bg-black/20 px-4 py-2 text-xs text-[#c6ccda] backdrop-blur hover:bg-white/5">Me surprendre</button>
    </div>
  </section>;
}
