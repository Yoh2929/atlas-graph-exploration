import api from "./axios";
import type { GraphData } from "../types";


export async function searchNodes(query: string) {
  const { data } = await api.get("/api/search", {
    params: {
      q: query,
      limit: 150,
    },
  });

  return data as GraphData["nodes"];
}
