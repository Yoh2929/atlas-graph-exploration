from __future__ import annotations

import json

from .models import SeedSnapshot


def _json(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def serialize_nodes(snapshot: SeedSnapshot) -> list[dict]:
    result = []
    for node in snapshot.nodes:
        properties = node.properties
        result.append({
            "id": node.id,
            "label": node.label,
            "category": node.category,
            "description": node.description,
            "wikidata_url": properties.get("wikidata_url", ""),
            "wikipedia_url": properties.get("wikipedia_url", ""),
            "wikidata_id": properties.get("wikidata_id", ""),
            "wikidata_revision_id": properties.get("wikidata_revision_id", ""),
            "discovered_from": properties.get("discovered_from", ""),
            "evidence_json": _json([item.__dict__ for item in node.evidence]),
        })
    return result


def serialize_edges(snapshot: SeedSnapshot) -> list[dict]:
    result = []
    for edge in snapshot.edges:
        result.append({
            "id": edge.id,
            "source": edge.source,
            "target": edge.target,
            "relation": edge.relation,
            "label": edge.label,
            "wikidata_property_id": edge.properties.get("wikidata_property_id", ""),
            "predicate_description": edge.properties.get("predicate_description", ""),
            "rank": edge.properties.get("rank", "normal"),
            "reference_count": edge.properties.get("reference_count", 0),
            "evidence_json": _json([item.__dict__ for item in edge.evidence]),
        })
    return result


def _publish(tx, snapshot: SeedSnapshot) -> None:
    nodes = serialize_nodes(snapshot)
    edges = serialize_edges(snapshot)
    tx.run("""
        UNWIND $nodes AS node
        MERGE (n:Concept {id: node.id})
        SET n.label = node.label,
            n.category = node.category,
            n.description = node.description,
            n.wikidata_url = node.wikidata_url,
            n.wikipedia_url = node.wikipedia_url,
            n.wikidata_id = node.wikidata_id,
            n.wikidata_revision_id = node.wikidata_revision_id,
            n.discovered_from = node.discovered_from,
            n.evidence_json = node.evidence_json,
            n.seed_managed = true,
            n.seed_run_id = $run_id
        REMOVE n.external_links_json
    """, nodes=nodes, run_id=snapshot.run_id).consume()
    tx.run("""
        UNWIND $edges AS edge
        MATCH (a:Concept {id: edge.source})
        MATCH (b:Concept {id: edge.target})
        MERGE (a)-[r:RELATED {key: edge.id}]->(b)
        SET r.type = edge.relation,
            r.label = edge.label,
            r.wikidata_property_id = edge.wikidata_property_id,
            r.predicate_description = edge.predicate_description,
            r.rank = edge.rank,
            r.reference_count = edge.reference_count,
            r.evidence_json = edge.evidence_json,
            r.seed_managed = true,
            r.seed_run_id = $run_id
    """, edges=edges, run_id=snapshot.run_id).consume()
    tx.run("""
        MATCH ()-[r:RELATED]->()
        WHERE r.seed_managed = true AND r.seed_run_id <> $run_id
        DELETE r
    """, run_id=snapshot.run_id).consume()
    tx.run("""
        MATCH (n:Concept)
        WHERE n.seed_managed = true AND n.seed_run_id <> $run_id
        DETACH DELETE n
    """, run_id=snapshot.run_id).consume()


def publish_snapshot(session, snapshot: SeedSnapshot) -> None:
    session.execute_write(_publish, snapshot)
