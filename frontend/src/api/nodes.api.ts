import api from "./axios";
import type { Biography, GraphData, NodeDetail } from "../types";

interface CacheEntry<T> { promise: Promise<T>; expiresAt: number; }
const nodeCache = new Map<string, CacheEntry<NodeDetail>>();
const neighborsCache = new Map<string, CacheEntry<GraphData>>();
const biographyCache = new Map<string, CacheEntry<Biography>>();

function cached<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number, loader: () => Promise<T>) {
  const current = cache.get(key);
  if (current && current.expiresAt > Date.now()) return current.promise;
  const entry: CacheEntry<T> = {
    promise: loader(),
    expiresAt: Date.now() + ttl,
  };
  entry.promise.catch(() => { if (cache.get(key) === entry) cache.delete(key); });
  cache.set(key, entry);
  return entry.promise;
}

export async function fetchNode(id: string): Promise<NodeDetail> {
  return cached(nodeCache, id, 60_000, () => api.get<NodeDetail>(`/api/nodes/${encodeURIComponent(id)}`).then(({ data }) => data));
}


export async function fetchNeighbors(id: string): Promise<GraphData> {
  return cached(neighborsCache, id, 60_000, () => api.get<GraphData>(`/api/nodes/${encodeURIComponent(id)}/neighbors`).then(({ data }) => data));
}


export async function fetchBiography(id: string): Promise<Biography> {
  return cached(biographyCache, id, 15 * 60_000, () => api.get<Biography>(`/api/nodes/${encodeURIComponent(id)}/biography`).then(({ data }) => data));
}
