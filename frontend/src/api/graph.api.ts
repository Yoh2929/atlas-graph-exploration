import api from "./axios";
import type { GraphData } from "../types";

export async function fetchGraph(limit?: number): Promise<GraphData> {
  const { data } = await api.get<GraphData>("/api/graph", {
    params: limit ? { limit } : undefined,
  });

  return data;
}
