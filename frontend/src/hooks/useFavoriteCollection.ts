import { useCallback, useEffect, useState } from "react";
import { addFavorite, listFavorites, removeFavorite } from "../api/favorites.api";

export function useFavoriteCollection(enabled: boolean) {
  const [ids, setIds] = useState<Set<string>>(new Set());
  const load = useCallback(async () => { if (!enabled) return setIds(new Set()); try { setIds(new Set((await listFavorites()).map((f) => f.node_id))); } catch { setIds(new Set()); } }, [enabled]);
  useEffect(() => { void load(); }, [load]);
  const toggle = useCallback(async (nodeId: string) => {
    if (!enabled) return false;
    const removing = ids.has(nodeId); setIds((current) => { const next = new Set(current); removing ? next.delete(nodeId) : next.add(nodeId); return next; });
    try { removing ? await removeFavorite(nodeId) : await addFavorite(nodeId); return !removing; }
    catch (error) { await load(); throw error; }
  }, [enabled, ids, load]);
  return { ids, toggle, reload: load };
}
