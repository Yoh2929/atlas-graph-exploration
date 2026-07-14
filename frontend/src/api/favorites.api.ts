import api from "./axios";


export async function addFavorite(nodeId: string) {
  const { data } = await api.post(
    `/api/favorites/${encodeURIComponent(nodeId)}`
  );

  return data;
}



export async function removeFavorite(nodeId: string) {
  await api.delete(
    `/api/favorites/${encodeURIComponent(nodeId)}`
  );
}



export async function listFavorites() {
  const { data } = await api.get("/api/favorites");

  return data as {
    id: string;
    node_id: string;
    created_at: string;
  }[];
}