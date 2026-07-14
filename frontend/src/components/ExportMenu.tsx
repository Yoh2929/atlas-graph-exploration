import { useRef, useState } from "react";
import { exportKnowledgePdf } from "../services/pdfExport";
import type { GraphData, GraphNode } from "../types";

interface Props { graph:GraphData; title?:string; selectedId?:string|null; favoriteIds?:Set<string>; focusIds?:Set<string>; }
function save(content:string,filename:string,type:string){const url=URL.createObjectURL(new Blob([content],{type}));const link=document.createElement("a");link.href=url;link.download=filename;link.click();window.setTimeout(()=>URL.revokeObjectURL(url),500);}

export default function ExportMenu({graph,title="Atlas",selectedId,favoriteIds=new Set(),focusIds=new Set()}:Props){
  const detailsRef=useRef<HTMLDetailsElement|null>(null);const[status,setStatus]=useState("");const map=new Map(graph.nodes.map(n=>[n.id,n]));
  const selected=selectedId?map.get(selectedId):undefined;const favorites=[...favoriteIds].map(id=>map.get(id)).filter(Boolean) as GraphNode[];const focus=[...focusIds].map(id=>map.get(id)).filter(Boolean) as GraphNode[];
  async function pdf(nodes:GraphNode[],name:string){detailsRef.current?.removeAttribute("open");setStatus("Préparation…");try{await exportKnowledgePdf(nodes,graph,name,(done,total)=>setStatus(`PDF ${Math.min(100,Math.round(done/total*100))}%`));setStatus("");}catch(error){console.error("PDF export failed",error);setStatus("Échec PDF");window.setTimeout(()=>setStatus(""),6000);}}
  return <details ref={detailsRef} className="relative">
    <summary className="min-w-fit cursor-pointer list-none rounded-full border border-white/15 px-3 py-2 text-xs hover:bg-white/5">{status||"Exporter"}</summary>
    <div className="absolute right-0 top-11 z-50 w-72 rounded-2xl border border-white/10 bg-[#111827]/95 p-2 shadow-2xl backdrop-blur-2xl">
      <div className="px-3 py-2"><p className="font-mono text-[9px] uppercase tracking-[.18em] text-ink-dim">Dossier éditorial PDF</p></div>
      {selected&&<button onClick={()=>void pdf([selected],`Fiche · ${selected.label}`)} className="w-full rounded-xl px-3 py-2.5 text-left text-xs hover:bg-white/5"><b className="block text-ink">Fiche active</b><span className="text-[10px] text-ink-dim">Portrait, biographie, relations et sources</span></button>}
      {favorites.length>0&&<button onClick={()=>void pdf(favorites,"Ma bibliothèque Atlas")} className="w-full rounded-xl px-3 py-2.5 text-left text-xs hover:bg-white/5"><b className="block text-ink">Bibliothèque · {favorites.length} fiches</b><span className="text-[10px] text-ink-dim">Un livre de vos repères enregistrés</span></button>}
      {focus.length>0&&<button onClick={()=>void pdf(focus,`Constellation · ${title}`)} className="w-full rounded-xl px-3 py-2.5 text-left text-xs hover:bg-white/5"><b className="block text-ink">Constellation · {focus.length} fiches</b><span className="text-[10px] text-ink-dim">La lentille actuellement éclairée</span></button>}
      <div className="my-1 border-t border-white/10"/><button onClick={()=>save(JSON.stringify(graph,null,2),"atlas-complet.json","application/json")} className="w-full rounded-xl px-3 py-2 text-left text-[11px] text-ink-dim hover:bg-white/5">Données complètes JSON</button>
      {!selected&&!favorites.length&&!focus.length&&<p className="px-3 py-3 text-[10px] leading-4 text-ink-dim">Ouvrez une fiche, une recherche ou des favoris pour composer un PDF.</p>}
    </div>
  </details>;
}
