import re
import unicodedata
from typing import Optional

from neo4j import Session
from app.graph.relations import canonicalize_relation, inverse_relation_label


VALID_CATEGORIES = {"problem", "theorem", "conjecture", "algorithm", "domain", "person"}

NODE_FIELDS = """
    n.id AS id,
    n.label AS label,
    n.category AS category,
    coalesce(n.description, '') AS description,
    n.wikidata_url AS wikidata_url,
    n.wikipedia_url AS wikipedia_url,
    n.wikidata_id AS wikidata_id,
    n.wikidata_revision_id AS wikidata_revision_id,
    n.discovered_from AS discovered_from
"""


def format_properties(row):
    wikipedia_url = row.get("wikipedia_url") or ""
    wikidata_url = row.get("wikidata_url") or ""
    sources = []
    if wikipedia_url:
        sources.append({"provider": "Wikipedia", "url": wikipedia_url, "primary": True})
    if wikidata_url:
        sources.append({"provider": "Wikidata", "url": wikidata_url, "primary": False})
    return {
        "wikidata_url": wikidata_url,
        "wikipedia_url": wikipedia_url,
        "wikidata_id": row.get("wikidata_id") or "",
        "wikidata_revision_id": row.get("wikidata_revision_id") or "",
        "discovered_from": row.get("discovered_from") or "",
        "sources": sources,
    }


def _format_node(row: dict) -> dict:
    row["properties"] = format_properties(row)
    for key in ("wikidata_url", "wikipedia_url", "wikidata_id", "wikidata_revision_id", "discovered_from"):
        row.pop(key, None)
    return row


def format_edge(row):
    property_id = row.get("wikidata_property_id") or ""
    label = row.get("label") or row["relation"]
    source, target = row["source"], row["target"]
    inverse_label = row.get("inverse_label") or inverse_relation_label(property_id, label)
    # Les propriétés passives sont exposées dans leur sens causal naturel.
    source, target, label, inverse_label = canonicalize_relation(
        source, target, property_id, label, inverse_label,
    )
    return {
        "source": source,
        "target": target,
        "relation": row["relation"],
        "label": label,
        "inverse_label": inverse_label,
        "properties": {
            "wikidata_property_id": property_id,
            "predicate_description": row.get("predicate_description") or "",
            "rank": row.get("rank") or "normal",
            "reference_count": row.get("reference_count") or 0,
        },
    }


def slugify(text: str) -> str:
    text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^\w\s-]", "", text).strip().lower()
    return re.sub(r"[\s_]+", "-", text)


def get_full_graph(session: Session, limit: int = 500, offset: int = 0):
    total = session.run("MATCH (n:Concept) RETURN count(n) AS total").single()["total"]
    nodes_query = f"""
        MATCH (n:Concept)
        OPTIONAL MATCH (n)-[r:RELATED]-()
        WITH n, count(r) AS degree
        RETURN {NODE_FIELDS}, degree
        ORDER BY degree DESC, toLower(n.label), n.id
        SKIP $offset
        LIMIT $limit
    """
    nodes = [_format_node(dict(row)) for row in session.run(nodes_query, limit=limit, offset=offset)]
    node_ids = [node["id"] for node in nodes]

    # Les relations sont maintenant contraintes au sous-graphe retourné. Le
    # frontend ne reçoit plus d'arêtes orphelines qu'il devrait jeter.
    edges_query = """
        MATCH (a:Concept)-[r:RELATED]->(b:Concept)
        WHERE a.id IN $node_ids AND b.id IN $node_ids
        RETURN a.id AS source, b.id AS target, r.type AS relation, r.label AS label,
               r.wikidata_property_id AS wikidata_property_id,
               r.predicate_description AS predicate_description,
               r.rank AS rank, r.reference_count AS reference_count
        ORDER BY r.reference_count DESC, r.label
    """
    edges = [
        format_edge(dict(row))
        for row in session.run(edges_query, node_ids=node_ids)
    ]
    loaded = len(nodes)
    return {
        "nodes": nodes,
        "edges": edges,
        "total": total,
        "loaded": loaded,
        "offset": offset,
        "has_more": offset + loaded < total,
    }


def get_node(session: Session, node_id: str) -> Optional[dict]:
    query = f"""
        MATCH (n:Concept {{id: $node_id}})
        OPTIONAL MATCH (n)-[r:RELATED]-()
        WITH n, count(r) AS degree
        RETURN {NODE_FIELDS}, degree
    """
    result = session.run(query, node_id=node_id).single()
    return _format_node(dict(result)) if result else None


def get_neighbors(session: Session, node_id: str):
    query = """
        MATCH (n:Concept {id: $node_id})-[r:RELATED]-(m:Concept)
        RETURN m.id AS id, m.label AS label, m.category AS category,
               coalesce(m.description, '') AS description,
               m.wikidata_url AS wikidata_url, m.wikipedia_url AS wikipedia_url,
               m.wikidata_id AS wikidata_id, m.wikidata_revision_id AS wikidata_revision_id,
               m.discovered_from AS discovered_from,
               r.type AS relation, r.label AS relation_label,
               r.wikidata_property_id AS wikidata_property_id,
               r.predicate_description AS predicate_description,
               r.rank AS rank, r.reference_count AS reference_count,
               startNode(r).id AS source, endNode(r).id AS target
        ORDER BY m.category = 'person' DESC, m.label
    """
    rows = [dict(row) for row in session.run(query, node_id=node_id)]
    nodes = {}
    for row in rows:
        nodes[row["id"]] = _format_node({
            "id": row["id"], "label": row["label"], "category": row["category"],
            "description": row["description"], "degree": 0,
            "wikidata_url": row.get("wikidata_url"), "wikipedia_url": row.get("wikipedia_url"),
            "wikidata_id": row.get("wikidata_id"),
            "wikidata_revision_id": row.get("wikidata_revision_id"),
            "discovered_from": row.get("discovered_from"),
        })
    edges = [format_edge({**row, "label": row.get("relation_label")}) for row in rows]
    return {"nodes": list(nodes.values()), "edges": edges}


def search_nodes(session: Session, q: str, category: Optional[str] = None, limit: int = 100):
    query = f"""
        MATCH (n:Concept)
        WHERE ($q = ''
           OR toLower(n.label) CONTAINS toLower($q)
           OR toLower(coalesce(n.description, '')) CONTAINS toLower($q))
          AND ($category IS NULL OR n.category = $category)
        OPTIONAL MATCH (n)-[r:RELATED]-()
        WITH n, count(r) AS degree,
             CASE
               WHEN toLower(n.label) = toLower($q) THEN 4
               WHEN toLower(n.label) STARTS WITH toLower($q) THEN 3
               WHEN toLower(n.label) CONTAINS toLower($q) THEN 2
               ELSE 1
             END AS relevance
        RETURN {NODE_FIELDS}, degree
        ORDER BY relevance DESC, degree DESC, n.label
        LIMIT $limit
    """
    return [
        _format_node(dict(row))
        for row in session.run(query, q=q, category=category, limit=limit)
    ]


def create_node(session: Session, label: str, category: str, description: str = ""):
    if category not in VALID_CATEGORIES:
        raise ValueError("Catégorie invalide")
    query = f"""
        MERGE (n:Concept {{id: $id}})
        SET n.label = $label, n.category = $category, n.description = $description
        RETURN {NODE_FIELDS}, 0 AS degree
    """
    row = session.run(
        query, id=slugify(label), label=label, category=category, description=description
    ).single()
    return _format_node(dict(row))


def create_relationship(session: Session, source_id: str, target_id: str, relation: str):
    result = session.run("""
        MATCH (a:Concept {id: $source_id}), (b:Concept {id: $target_id})
        MERGE (a)-[r:RELATED {type: $relation}]->(b)
        RETURN a.id AS source, b.id AS target, r.type AS relation
    """, source_id=source_id, target_id=target_id, relation=relation).single()
    if result is None:
        raise ValueError("Nœud source ou cible introuvable")
    return dict(result)


def ensure_constraints(session: Session):
    session.run("""
        CREATE CONSTRAINT concept_id_unique IF NOT EXISTS
        FOR (n:Concept) REQUIRE n.id IS UNIQUE
    """)
