import api from "./axios";
import type { Category, GraphData } from "../types";


export async function searchNodes(query: string, category?: Category) {
  const { data } = await api.get("/api/search", {
    params: {
      q: query,
      category,
      limit: 150,
    },
  });

  return data as GraphData["nodes"];
}
