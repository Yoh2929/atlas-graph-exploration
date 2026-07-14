import { useEffect, useState } from "react";

import { searchNodes } from "../api/search.api";

import type { GraphNode } from "../types";

export function useSearchNodes(query: string) {

  const [results, setResults] = useState<GraphNode[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timeout = setTimeout(async () => {

      setLoading(true);

      try {

        const nodes = await searchNodes(
          query.trim()
        );

        setResults(nodes);

      } catch {

        setResults([]);

      } finally {

        setLoading(false);

      }

    }, 250);


    return () => clearTimeout(timeout);

  }, [query]);


  return {
    results,
    loading
  };

}