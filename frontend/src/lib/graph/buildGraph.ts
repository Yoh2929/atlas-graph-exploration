import Graph from "graphology";

import type {
  GraphData
} from "../../types";

import {
  CATEGORY_COLORS
} from "../../constants";


export interface NodeAttrs {
  label:string;
  category:string;
  size:number;
  color:string;
  x:number;
  y:number;
}


export interface EdgeAttrs {
  relation:string;
  size:number;
}


export type AtlasGraph = Graph<
  NodeAttrs,
  EdgeAttrs
>;



export function buildGraph(
  data: GraphData
): AtlasGraph {


  const graph: AtlasGraph = new Graph<NodeAttrs, EdgeAttrs>({
    type:"directed",
    multi:false
  });


  const maxDegree = Math.max(
    1,
    ...data.nodes.map(
      n => n.degree
    )
  );


  data.nodes.forEach(node => {

    graph.mergeNode(
      node.id,
      {
        label:node.label,
        category:node.category,
        size:
          5 +
          (node.degree / maxDegree) * 12,

        color:
          CATEGORY_COLORS[node.category]
          || "#888"
      }
    );

  });



  data.edges.forEach((edge,i)=>{

    if (
      !graph.hasNode(edge.source)
      ||
      !graph.hasNode(edge.target)
    ) {
      return;
    }


    try {

      graph.mergeEdgeWithKey(
        `edge-${i}`,
        edge.source,
        edge.target,
        {
          relation:edge.relation,
          size:1
        }
      );

    } catch {}

  });



  return graph;

}