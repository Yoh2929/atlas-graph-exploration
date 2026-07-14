import { useEffect, useState } from "react";

import { searchNodes } from "../api/search.api";

import type { GraphNode } from "../types";
import type { Category } from "../types";

export function useSearchNodes(query: string, category?: Category) {

  const [results, setResults] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (query.trim().length < 2 && !category) {
      setResults([]);
      setLoading(false);
      return;
    }

    setResults([]);

    const timeout = setTimeout(async () => {

      setLoading(true);

      try {

        const nodes = await searchNodes(
          query.trim(),
          category,
        );

        if (!cancelled) setResults(nodes);

      } catch {

        if (!cancelled) setResults([]);

      } finally {

        if (!cancelled) setLoading(false);

      }

    }, 250);


    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };

  }, [query, category]);


  return {
    results,
    loading
  };

}
