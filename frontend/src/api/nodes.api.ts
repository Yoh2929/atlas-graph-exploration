import api from "./axios";
import type { Biography, GraphData, NodeDetail } from "../types";

const nodeCache = new Map<string, Promise<NodeDetail>>();
const neighborsCache = new Map<string, Promise<GraphData>>();
const biographyCache = new Map<string, Promise<Biography>>();

export async function fetchNode(id: string): Promise<NodeDetail> {
  if (!nodeCache.has(id)) nodeCache.set(id, api.get<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`).then(({ data }) => data).catch((error) => { nodeCache.delete(id); throw error; }));
  return nodeCache.get(id)!;
}


export async function fetchNeighbors(id: string): Promise<GraphData> {
  if (!neighborsCache.has(id)) neighborsCache.set(id, api.get<GraphData>(`/api/nodes/${encodeURIComponent(id)}/neighbors`).then(({ data }) => data).catch((error) => { neighborsCache.delete(id); throw error; }));
  return neighborsCache.get(id)!;
}


export async function fetchBiography(id: string): Promise<Biography> {
  if (!biographyCache.has(id)) biographyCache.set(id, api.get<Biography>(`/api/nodes/${encodeURIComponent(id)}/biography`).then(({ data }) => data).catch((error) => { biographyCache.delete(id); throw error; }));
  return biographyCache.get(id)!;
}
