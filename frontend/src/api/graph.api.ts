import api from "./axios";
import type { GraphData } from "../types";

export async function fetchGraph(limit = 500, offset = 0): Promise<GraphData> {
  const { data } = await api.get<GraphData>("/api/graph", {
    params: { limit, offset },
  });

  return data;
}
