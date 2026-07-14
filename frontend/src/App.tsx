import { useCallback, useEffect, useMemo, useState } from "react";
import AccountPanel from "./components/AccountPanel";
import AuthModal from "./components/AuthModal";
import ExportMenu from "./components/ExportMenu";
import GraphCanvas3D from "./components/GraphCanvas3D";
import GraphControls from "./components/GraphControls";
import LibraryPanel from "./components/LibraryPanel";
import NodeDetailPanel from "./components/NodeDetailPanel";
import ResizableDetailPanel from "./components/ResizableDetailPanel";
import SearchBar from "./components/SearchBar";
import WelcomePanel from "./components/WelcomePanel";
import { useAuth } from "./hooks/useAuth";
import { useFavoriteCollection } from "./hooks/useFavoriteCollection";
import { useGraph } from "./hooks/useGraph";
import type { GraphNode } from "./types";

const RECENT_KEY = "atlas_recent_nodes";
export default function App() {
  const { graph, loading: graphLoading, loadingMore, error, exploreNode, nextPage, previousPage } = useGraph(); const auth = useAuth(); const favorites = useFavoriteCollection(!!auth.user);
  const [selectedId, setSelectedId] = useState<string | null>(null); const [focusIds, setFocusIds] = useState<Set<string>>(new Set()); const [lensLabel, setLensLabel] = useState("");
  const [showAuth, setShowAuth] = useState(false); const [showAccount, setShowAccount] = useState(false); const [showLibrary, setShowLibrary] = useState(false);
  const [recentIds, setRecentIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } });

  useEffect(() => { const shortcut = (e: KeyboardEvent) => { if (e.key === "/" && !["INPUT","TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) { e.preventDefault(); document.getElementById("atlas-search")?.focus(); } }; window.addEventListener("keydown",shortcut); return () => window.removeEventListener("keydown",shortcut); }, []);
  const nodeMap = useMemo(() => new Map(graph?.nodes.map((n) => [n.id,n]) || []), [graph]);
  const favoriteNodes = useMemo(() => [...favorites.ids].map((id) => nodeMap.get(id)).filter(Boolean) as GraphNode[], [favorites.ids,nodeMap]);
  const recentNodes = useMemo(() => recentIds.map((id) => nodeMap.get(id)).filter(Boolean) as GraphNode[], [recentIds,nodeMap]);

  const handleSelectNode = useCallback((id: string) => {
    const next = id || null; setSelectedId(next); if (!next) return;
    void exploreNode(next);
    setRecentIds((current) => { const updated = [next,...current.filter((item) => item !== next)].slice(0,12); localStorage.setItem(RECENT_KEY,JSON.stringify(updated)); return updated; });
  }, [exploreNode]);
  const lensNode = useCallback((node: GraphNode) => { if (!graph) return; const ids = new Set([node.id]); graph.edges.forEach((e) => { if (e.source===node.id) ids.add(e.target); if (e.target===node.id) ids.add(e.source); }); setFocusIds(ids); setLensLabel(`${node.label} · ${ids.size-1} connexions`); handleSelectNode(node.id); }, [graph,handleSelectNode]);
  const clearLens = useCallback(() => { setFocusIds(new Set()); setLensLabel(""); }, []);
  function surprise() { if (!graph) return; const candidates = graph.nodes.filter((n) => n.degree>=2); const weighted = candidates.sort(() => Math.random()-.5).slice(0,Math.min(80,candidates.length)).sort((a,b) => b.degree-a.degree); if (weighted[0]) lensNode(weighted[Math.floor(Math.random()*Math.min(12,weighted.length))]); }

  return <div className="relative h-screen w-screen overflow-hidden bg-bg text-ink">
    <header className="pointer-events-none absolute inset-x-0 top-0 z-[60] flex h-[76px] items-center gap-1 px-2 sm:gap-3 sm:px-5">
      <div className="pointer-events-auto flex min-w-fit items-center gap-3 rounded-2xl border border-white/10 bg-[#0c1320]/80 px-2 py-2 shadow-2xl backdrop-blur-xl sm:px-3"><div className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-white to-[#8da9ff] font-display text-lg text-bg">A</div><div className="hidden sm:block"><h1 className="font-display text-lg leading-none">Atlas</h1><p className="mt-1 font-mono text-[8px] uppercase tracking-[.18em] text-ink-dim">Math knowledge field</p></div></div>
      <div className="pointer-events-auto min-w-0 flex-1 sm:mx-auto sm:max-w-2xl"><SearchBar onSelectNode={handleSelectNode} /></div>
      <div className="pointer-events-auto flex items-center gap-2">{graph && <div className="hidden md:block"><ExportMenu graph={graph} title={lensLabel||"Atlas mathématique complet"} selectedId={selectedId} favoriteIds={favorites.ids} focusIds={focusIds}/></div>}<button onClick={() => setShowLibrary(true)} className="relative min-w-fit rounded-full border border-white/10 bg-[#0c1320]/80 px-3 py-2 text-xs backdrop-blur-xl hover:bg-white/10"><span className="hidden sm:inline">Bibliothèque</span><span className="sm:hidden">★</span>{favoriteNodes.length>0 && <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[#ffd166] px-1 text-[8px] text-bg">{favoriteNodes.length}</span>}</button>
      {!auth.loading && (auth.user ? <button onClick={() => setShowAccount(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-category-person/20 text-xs text-category-person">{(auth.user.display_name||auth.user.email).slice(0,2).toUpperCase()}</button> : <button onClick={() => setShowAuth(true)} className="rounded-full border border-white/10 bg-[#0c1320]/80 px-3 py-2 text-xs backdrop-blur-xl"><span className="hidden sm:inline">Connexion</span><span className="sm:hidden">◎</span></button>)}</div>
    </header>
    <main className="absolute inset-0">
      {error && <div className="absolute inset-0 z-10 grid place-items-center text-sm text-ink-dim">{error}</div>}
      {!error && graphLoading && <div className="absolute inset-0 z-10 grid place-items-center bg-bg"><div className="text-center"><div className="mx-auto h-12 w-12 animate-spin rounded-full border border-white/10 border-t-category-algorithm"/><p className="mt-5 font-display text-xl">Ouverture du champ de connaissance…</p><p className="mt-1 text-xs text-ink-dim">Chargement du premier lot</p></div></div>}
      {graph && <><GraphCanvas3D data={graph} selectedId={selectedId} focusIds={focusIds} favoriteIds={favorites.ids} onSelectNode={handleSelectNode}/><GraphControls lensLabel={lensLabel} onClearLens={clearLens} onGenerate={surprise} loaded={graph.loaded ?? graph.nodes.length} offset={graph.offset ?? 0} total={graph.total} hasMore={!!graph.has_more} loadingMore={loadingMore} onNext={() => { setSelectedId(null); clearLens(); nextPage(); }} onPrevious={() => { setSelectedId(null); clearLens(); previousPage(); }}/>{!selectedId&&!lensLabel&&<WelcomePanel onSearch={() => document.getElementById("atlas-search")?.focus()} onDrift={surprise}/>}</>}
      {selectedId && <ResizableDetailPanel onClose={() => setSelectedId(null)}><NodeDetailPanel key={selectedId} nodeId={selectedId} user={auth.user} favorite={favorites.ids.has(selectedId)} onToggleFavorite={() => { if (auth.user) void favorites.toggle(selectedId); else setShowAuth(true); }} onSelectNode={handleSelectNode}/></ResizableDetailPanel>}
    </main>
    <LibraryPanel open={showLibrary} onClose={() => setShowLibrary(false)} favorites={favoriteNodes} recent={recentNodes} signedIn={!!auth.user} onSelect={(id) => { handleSelectNode(id); setShowLibrary(false); }} onRemove={(id) => void favorites.toggle(id)} onLogin={() => { setShowLibrary(false); setShowAuth(true); }}/>
    {showAuth && <AuthModal onLogin={auth.login} onRegister={auth.register} onClose={() => setShowAuth(false)}/>} {showAccount&&auth.user&&<AccountPanel user={auth.user} onClose={() => setShowAccount(false)} onLogout={auth.logout} onUpdateProfile={auth.updateProfile} onChangePassword={auth.changePassword}/>} 
  </div>;
}
