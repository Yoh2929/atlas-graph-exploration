import { useEffect, useRef } from "react";
import Graph from "graphology";
import circular from "graphology-layout/circular";
import forceAtlas2 from "graphology-layout-forceatlas2";
import FA2LayoutSupervisor from "graphology-layout-forceatlas2/worker";
import Sigma from "sigma";
import type { EdgeDisplayData, NodeDisplayData } from "sigma/types";
import { CATEGORY_COLORS, EDGE_COLOR, EDGE_COLOR_HIGHLIGHT } from "../constants";
import type { GraphData } from "../types";

export interface NodeAttrs { label: string; category: string; size: number; color: string; x: number; y: number; }
export interface EdgeAttrs { relation: string; label: string; inverseLabel: string; type: string; size: number; }
export type AtlasGraph = Graph<NodeAttrs, EdgeAttrs>;
interface Props { data: GraphData; selectedId: string | null; focusIds?: Set<string>; favoriteIds?: Set<string>; onSelectNode: (id: string) => void; }

export function useSigmaGraph({ data, selectedId, focusIds, favoriteIds, onSelectNode }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null);
  const selectedRef = useRef<string | null>(selectedId); const hoveredRef = useRef<string | null>(null);
  const focusRef = useRef<Set<string>>(focusIds || new Set()); const favoritesRef = useRef<Set<string>>(favoriteIds || new Set());

  useEffect(() => {
    if (!containerRef.current) return;
    const graph: AtlasGraph = new Graph({ type: "directed", multi: false });
    const maxDegree = Math.max(1, ...data.nodes.map((node) => node.degree));
    data.nodes.forEach((node) => graph.mergeNode(node.id, { label: node.label, category: node.category, size: 2.2 + Math.sqrt(node.degree / maxDegree) * 8, color: CATEGORY_COLORS[node.category] || "#91a0b8" }));
    data.edges.forEach((edge, index) => {
      if (!graph.hasNode(edge.source) || !graph.hasNode(edge.target)) return;
      try { graph.mergeEdgeWithKey(`e-${index}`, edge.source, edge.target, { relation: edge.relation, label: edge.label || edge.relation, inverseLabel: edge.inverse_label || edge.label || edge.relation, type: "arrow", size: .65 }); } catch { /* relation dupliquée */ }
    });
    circular.assign(graph, { scale: 180 });
    const renderer = new Sigma(graph, containerRef.current, {
      renderLabels: true, renderEdgeLabels: true, labelFont: "Inter, sans-serif", labelColor: { color: "#f2efe7" },
      labelDensity: .25, labelGridCellSize: 120, labelRenderedSizeThreshold: 7.5, defaultEdgeColor: EDGE_COLOR, zIndex: true,
      nodeReducer(nodeKey, attrs) {
        const focused = focusRef.current.size === 0 || focusRef.current.has(nodeKey); const favorite = favoritesRef.current.has(nodeKey);
        const result: Partial<NodeDisplayData> = { ...attrs, label: attrs.label, zIndex: 1 };
        if (!focused) { result.color = "#20283a"; result.label = ""; result.size = Math.max(1.4, attrs.size * .52); result.zIndex = 0; }
        if (favorite) { result.color = "#ffd166"; result.size = attrs.size * 1.35; result.zIndex = 3; }
        // if (hoveredRef.current === nodeKey || selected === nodeKey) { result.color = "#ffffff"; result.size = attrs.size * (selected === nodeKey ? 2 : 1.5); result.label = attrs.label; result.zIndex = 5; }
        return result;
      },
      edgeReducer(edgeKey, attrs) {
        const [source, target] = graph.extremities(edgeKey);
        const inLens = focusRef.current.size === 0 || (focusRef.current.has(source) && focusRef.current.has(target));
        const result: Partial<EdgeDisplayData> = { size: attrs.size, color: inLens ? EDGE_COLOR : "#151b28", label: "", zIndex: 0 };
        return result;
      },
    });
    renderer.on("clickNode", ({ node }) => onSelectNode(node));
    renderer.on("enterNode", ({ node }) => { hoveredRef.current = node; renderer.refresh(); }); renderer.on("leaveNode", () => { hoveredRef.current = null; renderer.refresh(); });
    const layout = new FA2LayoutSupervisor(graph, { settings: { ...forceAtlas2.inferSettings(graph), barnesHutOptimize: true, gravity: .8, scalingRatio: 18, slowDown: 6, adjustSizes: true } });
    layout.start(); const settle = window.setTimeout(() => layout.stop(), 5200); rendererRef.current = renderer;
    return () => { window.clearTimeout(settle); layout.kill(); renderer.kill(); rendererRef.current = null; };
  }, [data, onSelectNode]);
  useEffect(() => { selectedRef.current = selectedId; rendererRef.current?.refresh(); }, [selectedId]);
  useEffect(() => { focusRef.current = focusIds || new Set(); rendererRef.current?.refresh(); }, [focusIds]);
  useEffect(() => { favoritesRef.current = favoriteIds || new Set(); rendererRef.current?.refresh(); }, [favoriteIds]);
  return { containerRef, rendererRef };
}
