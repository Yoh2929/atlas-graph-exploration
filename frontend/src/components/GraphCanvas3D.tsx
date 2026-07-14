import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph3D, { type NodeObject } from "react-force-graph-3d";
import { CATEGORY_COLORS } from "../constants";
import type { GraphData } from "../types";

interface Props { data: GraphData; selectedId: string | null; focusIds?: Set<string>; favoriteIds?: Set<string>; onSelectNode: (id: string) => void; }
type Atlas3DNode = NodeObject & { id: string; label: string; category: keyof typeof CATEGORY_COLORS; degree: number; description: string };
type Atlas3DLink = { source: string | Atlas3DNode; target: string | Atlas3DNode; label: string; relation: string };
const idOf = (value: string | Atlas3DNode) => typeof value === "string" ? value : value.id;

export default function GraphCanvas3D({ data, selectedId, focusIds = new Set(), favoriteIds = new Set(), onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null); const graphRef = useRef<any>();
  const [size,setSize] = useState({width:window.innerWidth,height:window.innerHeight});
  const graphData = useMemo(() => ({ nodes:data.nodes.map((n) => ({...n})) as Atlas3DNode[], links:data.edges.map((e) => ({source:e.source,target:e.target,label:e.label||e.relation,relation:e.relation})) as Atlas3DLink[] }), [data]);
  useEffect(() => { if (!containerRef.current) return; const observer = new ResizeObserver(([entry]) => setSize({width:Math.round(entry.contentRect.width),height:Math.round(entry.contentRect.height)})); observer.observe(containerRef.current); return () => observer.disconnect(); }, []);
  function focusCamera(node: Atlas3DNode) { const distance=115; const length=Math.hypot(node.x||0,node.y||0,node.z||0)||1; const ratio=1+distance/length; graphRef.current?.cameraPosition({x:(node.x||0)*ratio,y:(node.y||0)*ratio,z:(node.z||0)*ratio},{x:node.x||0,y:node.y||0,z:node.z||0},900); }
  useEffect(() => { if(!selectedId) return; const timer=window.setTimeout(() => { const node=graphData.nodes.find((item) => item.id===selectedId); if(node && Number.isFinite(node.x)) focusCamera(node); },60); return () => window.clearTimeout(timer); },[selectedId,graphData]);
  const nodeColor = (node: NodeObject) => { const n=node as Atlas3DNode; if (favoriteIds.has(n.id)) return "#ffd166"; if (focusIds.size && !focusIds.has(n.id)) return "#151b28"; return CATEGORY_COLORS[n.category] || "#8fa3c7"; };
  const linkColor = (link: object) => { const l=link as Atlas3DLink; if (focusIds.size && !(focusIds.has(idOf(l.source))&&focusIds.has(idOf(l.target)))) return "#0d121c"; return "#52617c"; };
  return <div ref={containerRef} className="atlas-graph-3d absolute inset-0 overflow-hidden">
    <ForceGraph3D ref={graphRef} width={size.width} height={size.height} graphData={graphData} backgroundColor="#05070b" showNavInfo={false} controlType="trackball" rendererConfig={{antialias:true,alpha:false,powerPreference:"high-performance"}} nodeId="id" nodeLabel={(node) => `${(node as Atlas3DNode).label} · ${(node as Atlas3DNode).degree} connexions`} nodeColor={nodeColor} nodeVal={(node) => 1.2+Math.log2(2+(node as Atlas3DNode).degree)*.72} nodeRelSize={2.8} nodeOpacity={.94} nodeResolution={8} linkColor={linkColor} linkWidth={.28} linkOpacity={.22} linkLabel={() => ""} linkDirectionalArrowLength={0} warmupTicks={35} cooldownTicks={160} cooldownTime={7000} d3AlphaDecay={.025} d3VelocityDecay={.36} enableNodeDrag={false} onNodeClick={(node) => onSelectNode((node as Atlas3DNode).id)} />
    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_42%,rgba(0,0,0,.5)_100%)]" />
    <div className="absolute bottom-4 right-4 flex flex-col gap-1 rounded-2xl border border-white/10 bg-[#0b101b]/75 p-1.5 shadow-2xl backdrop-blur-xl"><button aria-label="Rapprocher la caméra" className="h-9 w-9 rounded-xl text-lg text-ink-dim hover:bg-white/10" onClick={() => { const camera=graphRef.current?.camera(); if(camera) graphRef.current?.cameraPosition({x:camera.position.x*.72,y:camera.position.y*.72,z:camera.position.z*.72},undefined,250); }}>+</button><button aria-label="Éloigner la caméra" className="h-9 w-9 rounded-xl text-lg text-ink-dim hover:bg-white/10" onClick={() => { const camera=graphRef.current?.camera(); if(camera) graphRef.current?.cameraPosition({x:camera.position.x*1.35,y:camera.position.y*1.35,z:camera.position.z*1.35},undefined,250); }}>−</button><button aria-label="Voir tout l’Atlas" className="h-9 w-9 rounded-xl text-sm text-ink-dim hover:bg-white/10" onClick={() => graphRef.current?.zoomToFit(700,65)}>◎</button></div>
    <p className="pointer-events-none absolute bottom-5 left-1/2 hidden -translate-x-1/2 rounded-full border border-white/10 bg-bg/60 px-3 py-1.5 text-[10px] text-ink-dim backdrop-blur sm:block">Glissez pour tourner · molette pour voyager · clic pour ouvrir</p>
  </div>;
}
