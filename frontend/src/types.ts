export type Category = "problem" | "theorem" | "conjecture" | "algorithm" | "domain" | "person";

export const CATEGORY_LABELS: Record<Category, string> = {
  problem: "Problème",
  theorem: "Théorème",
  conjecture: "Conjecture",
  algorithm: "Algorithme",
  domain: "Domaine",
  person: "Personnalité",
};

export const RELATION_LABELS: Record<string, string> = {
  depends_on: "dépend de",
  generalizes: "généralise",
  solves: "résout",
  equivalent_to: "est équivalent à",
  uses: "utilise",
  inspired_by: "a été inspiré par",
  special_case_of: "est un cas particulier de",
};

export interface SourceLink {
  provider: string;
  url: string;
  primary?: boolean;
}

export interface GraphNode {
  id: string;
  label: string;
  category: Category;
  description: string;
  degree: number;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relation: string;
  label?: string;
  inverse_label?: string;
  properties?: Record<string, unknown>;
}

export interface Biography {
  title: string;
  extract: string;
  image_url: string;
  image_original_url: string;
  wikipedia_url: string;
  language: string;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface NodeDetail extends GraphNode {
  properties: Record<string, unknown>;
}

export interface User {
  id: string;
  email: string;
  display_name?: string | null;
}
