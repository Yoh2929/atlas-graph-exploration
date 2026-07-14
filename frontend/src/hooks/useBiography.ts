import { useEffect, useState } from "react";

import { fetchBiography } from "../api/nodes.api";
import type { Biography } from "../types";

export function useBiography(nodeId: string) {
  const [biography, setBiography] = useState<Biography | null>(null);
  const [loading, setLoading] = useState(true);
  const [resolvedId, setResolvedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setBiography(null);
    setLoading(true);
    fetchBiography(nodeId)
      .then((value) => { if (!cancelled) { setBiography(value); setResolvedId(nodeId); } })
      .catch(() => { if (!cancelled) { setBiography(null); setResolvedId(nodeId); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [nodeId]);

  return {
    biography: resolvedId === nodeId ? biography : null,
    loading: loading || resolvedId !== nodeId,
  };
}
