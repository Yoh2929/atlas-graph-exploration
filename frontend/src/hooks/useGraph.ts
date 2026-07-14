import { useCallback, useEffect, useState } from "react";

import { fetchGraph } from "../api/graph.api";
import { fetchNeighbors, fetchNode } from "../api/nodes.api";
import type { GraphData } from "../types";

function mergeGraphs(current: GraphData, addition: GraphData): GraphData {
  const nodes = new Map(current.nodes.map((node) => [node.id, node]));
  addition.nodes.forEach((node) => nodes.set(node.id, { ...nodes.get(node.id), ...node }));
  const edges = new Map(
    current.edges.map((edge) => [`${edge.source}|${edge.relation}|${edge.target}`, edge]),
  );
  addition.edges.forEach((edge) => edges.set(`${edge.source}|${edge.relation}|${edge.target}`, edge));
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

export function useGraph(limit?: number) {
  const [graph, setGraph] = useState<GraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchGraph(limit)
      .then(setGraph)
      .catch((err) => {
        console.error(err);
        setError("Impossible de charger le graphe.");
      })
      .finally(() => setLoading(false));
  }, [limit]);

  const exploreNode = useCallback(async (nodeId: string) => {
    const [node, neighborhood] = await Promise.all([fetchNode(nodeId), fetchNeighbors(nodeId)]);
    setGraph((current) => {
      const focusGraph = { nodes: [node, ...neighborhood.nodes], edges: neighborhood.edges };
      return current ? mergeGraphs(current, focusGraph) : focusGraph;
    });
  }, []);

  return { graph, loading, error, exploreNode };
}
