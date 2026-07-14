from __future__ import annotations

import argparse
import json
from pathlib import Path

from neo4j import GraphDatabase

from app.config import settings as app_settings
from app.graph.repository import ensure_constraints


NODE_QUERY = """
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
"""

EDGE_QUERY = """
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
"""


def _json(value: object) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def _latest_snapshot(artifact_dir: Path) -> Path:
    run_id = (artifact_dir / "latest.txt").read_text(encoding="utf-8").strip()
    return artifact_dir / run_id / "snapshot.json"


def _chunks(values: list[dict], size: int):
    for index in range(0, len(values), size):
        yield index, values[index:index + size]


def _node(raw: dict) -> dict:
    properties = raw.get("properties", {})
    return {
        "id": raw["id"],
        "label": raw.get("label", raw["id"]),
        "category": raw.get("category", "domain"),
        "description": raw.get("description", ""),
        "wikidata_url": properties.get("wikidata_url", ""),
        "wikipedia_url": properties.get("wikipedia_url", ""),
        "wikidata_id": properties.get("wikidata_id", ""),
        "wikidata_revision_id": properties.get("wikidata_revision_id", ""),
        "discovered_from": properties.get("discovered_from", ""),
        "evidence_json": _json(raw.get("evidence", [])),
    }


def _edge(raw: dict) -> dict:
    properties = raw.get("properties", {})
    return {
        "id": raw["id"],
        "source": raw["source"],
        "target": raw["target"],
        "relation": raw.get("relation", "related"),
        "label": raw.get("label", raw.get("relation", "related")),
        "wikidata_property_id": properties.get("wikidata_property_id", ""),
        "predicate_description": properties.get("predicate_description", ""),
        "rank": properties.get("rank", "normal"),
        "reference_count": properties.get("reference_count", 0),
        "evidence_json": _json(raw.get("evidence", [])),
    }


def import_snapshot(snapshot_path: Path, batch_size: int = 500) -> None:
    print(f"Lecture du snapshot: {snapshot_path}", flush=True)
    snapshot = json.loads(snapshot_path.read_text(encoding="utf-8"))
    run_id = snapshot["run_id"]
    nodes = [_node(value) for value in snapshot.get("nodes", [])]
    edges = [_edge(value) for value in snapshot.get("edges", [])]
    print(f"Import Aura: {len(nodes)} noeuds, {len(edges)} relations", flush=True)

    driver = GraphDatabase.driver(
        app_settings.neo4j_uri,
        auth=(app_settings.neo4j_user, app_settings.neo4j_password),
    )
    try:
        driver.verify_connectivity()
        with driver.session() as session:
            ensure_constraints(session)
            for index, batch in _chunks(nodes, batch_size):
                session.run(NODE_QUERY, nodes=batch, run_id=run_id).consume()
                print(f"  Noeuds: {min(index + len(batch), len(nodes))}/{len(nodes)}", flush=True)
            for index, batch in _chunks(edges, batch_size):
                session.run(EDGE_QUERY, edges=batch, run_id=run_id).consume()
                print(f"  Relations: {min(index + len(batch), len(edges))}/{len(edges)}", flush=True)

            session.run("""
                MATCH ()-[r:RELATED]->()
                WHERE r.seed_managed = true AND r.seed_run_id <> $run_id
                DELETE r
            """, run_id=run_id).consume()
            session.run("""
                MATCH (n:Concept)
                WHERE n.seed_managed = true AND n.seed_run_id <> $run_id
                DETACH DELETE n
            """, run_id=run_id).consume()
            counts = session.run("""
                CALL () { MATCH (n:Concept) RETURN count(n) AS nodes }
                CALL () { MATCH ()-[r:RELATED]->() RETURN count(r) AS edges }
                RETURN nodes, edges
            """).single()
            print(f"Import termine: {counts['nodes']} noeuds, {counts['edges']} relations", flush=True)
    finally:
        driver.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Publie un snapshot Atlas existant vers Neo4j")
    parser.add_argument("--snapshot", type=Path, help="Chemin du snapshot.json")
    parser.add_argument("--artifact-dir", type=Path, default=Path("seed-artifacts"))
    parser.add_argument("--batch-size", type=int, default=500)
    args = parser.parse_args()
    if args.batch_size < 1:
        parser.error("--batch-size doit etre positif")
    snapshot_path = args.snapshot or _latest_snapshot(args.artifact_dir)
    import_snapshot(snapshot_path, args.batch_size)


if __name__ == "__main__":
    main()
