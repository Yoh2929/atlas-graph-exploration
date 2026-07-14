import { useCallback, useEffect, useState } from "react";

import { fetchGraph } from "../api/graph.api";
import { fetchNeighbors, fetchNode } from "../api/nodes.api";
import type { GraphData } from "../types";

function mergeGraphs(current: GraphData, addition: GraphData): GraphData {
  const includesPageMetadata = addition.total != null;
  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  addition.nodes.forEach((node) => nodes.set(node.id, { ...nodes.get(node.id), ...node }));
  const edges = new Map(
    current.edges.map((edge) => [`${edge.source}|${edge.relation}|${edge.target}`, edge]),
  );
  addition.edges.forEach((edge) => edges.set(`${edge.source}|${edge.relation}|${edge.target}`, edge));
  return {
    ...current,
    ...addition,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    total: includesPageMetadata ? addition.total : current.total,
    loaded: includesPageMetadata ? addition.loaded : current.loaded,
    offset: includesPageMetadata ? addition.offset : current.offset,
    has_more: includesPageMetadata ? addition.has_more : current.has_more,
  };
}

const INITIAL_BATCH = 500;

export function useGraph() {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchGraph(INITIAL_BATCH)
      .then(setGraph)
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger le graphe.");
      })
      .finally(() => setLoading(false));
  }, []);

  const loadPage = useCallback(async (offset: number) => {
    if (loadingMore || offset < 0) return;
    setLoadingMore(true);
    try {
      const nextGraph = await fetchGraph(INITIAL_BATCH, offset);
      setGraph(nextGraph);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore]);

  const nextPage = useCallback(() => {
    if (graph?.has_more) void loadPage((graph.offset ?? 0) + INITIAL_BATCH);
  }, [graph?.has_more, graph?.offset, loadPage]);

  const previousPage = useCallback(() => {
    void loadPage(Math.max(0, (graph?.offset ?? 0) - INITIAL_BATCH));
  }, [graph?.offset, loadPage]);

  const exploreNode = useCallback(async (nodeId: string) => {
    const [node, neighborhood] = await Promise.all([fetchNode(nodeId), fetchNeighbors(nodeId)]);
    setGraph((current) => {
      const focusGraph = { nodes: [node, ...neighborhood.nodes], edges: neighborhood.edges };
      return current ? mergeGraphs(current, focusGraph) : focusGraph;
    });
  }, []);

  return { graph, loading, loadingMore, error, exploreNode, nextPage, previousPage };
}
