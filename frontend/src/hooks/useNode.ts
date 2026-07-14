import { useEffect,useState } from "react";

import {
 fetchNode,
 fetchNeighbors
} from "../api/nodes.api";


import type {
 NodeDetail,
 GraphEdge
} from "../types";



export function useNode(nodeId:string){


 const [node,setNode]=useState<NodeDetail|null>(null);
 const [neighbors,setNeighbors]=useState<any[]>([]);
 const [loading,setLoading]=useState(true);
 const [resolvedId,setResolvedId]=useState<string|null>(null);



 useEffect(()=>{

  let cancelled=false;

  setLoading(true);


  Promise.all([
    fetchNode(nodeId),
    fetchNeighbors(nodeId)
  ])
  .then(([detail,graph])=>{

    if(cancelled)return;


    setNode(detail);
    setResolvedId(nodeId);


    const rows = graph.edges.map(
      (edge:GraphEdge)=>{

        const outgoing=edge.source===nodeId;

        const id=outgoing
          ? edge.target
          : edge.source;


        const n=graph.nodes.find(
          x=>x.id===id
        );


        return {
          id,
          label:n?.label ?? id,
          category:n?.category,
          relation:edge.relation,
          relationLabel:edge.label || edge.relation,
          inverseRelationLabel:edge.inverse_label || edge.label || edge.relation,
          displayRelationLabel: outgoing
            ? (edge.label || edge.relation)
            : (edge.inverse_label || edge.label || edge.relation),
          direction:outgoing
            ?"out"
            :"in"
        };

      }
    );


    setNeighbors(rows);

  })
  .finally(()=>{

    if(!cancelled)
      setLoading(false);

  });



 return ()=>{
  cancelled=true;
 };


 },[nodeId]);



 return {
  node: resolvedId === nodeId ? node : null,
  neighbors: resolvedId === nodeId ? neighbors : [],
  loading: loading || resolvedId !== nodeId
 };

}
