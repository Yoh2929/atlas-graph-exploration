from __future__ import annotations

import argparse

from neo4j import GraphDatabase

from app.config import settings as app_settings
from app.graph.repository import ensure_constraints

from .artifacts import write_artifacts
from .config import SeedSettings
from .pipeline import SeedPipeline
from .validation import validate_snapshot
from .writer import publish_snapshot


def run(*, dry_run: bool = False) -> None:
    settings = SeedSettings()
    print("Atlas seed v3 - graphe mathematique relie et source", flush=True)
    node_budget = str(settings.max_nodes) if settings.max_nodes else "illimite"
    edge_budget = str(settings.max_edges) if settings.max_edges else "illimite"
    print(
        f"Budget: {node_budget} noeuds, {edge_budget} relations, "
        f"profondeur Wikipedia {settings.wikipedia_depth}",
        flush=True,
    )
    snapshot = SeedPipeline(settings).build()
    report = validate_snapshot(snapshot, settings)
    artifact_path = write_artifacts(settings.artifact_dir, snapshot, report)
    print(f"Resultat: {len(snapshot.nodes)} noeuds, {len(snapshot.edges)} relations", flush=True)
    print(f"Predicats semantiques: {report.metrics.get('semantic_predicates', 0)}", flush=True)
    print(f"Artefacts: {artifact_path}", flush=True)
    for warning in report.warnings:
        print(f"WARNING: {warning}", flush=True)
    if not report.valid:
        raise RuntimeError("Seed validation failed: " + "; ".join(report.errors))
    if dry_run:
        print("Dry-run termine; Neo4j n'a pas ete modifie", flush=True)
        return

    driver = GraphDatabase.driver(
        app_settings.neo4j_uri,
        auth=(app_settings.neo4j_user, app_settings.neo4j_password),
    )
    try:
        with driver.session() as session:
            ensure_constraints(session)
            publish_snapshot(session, snapshot)
    finally:
        driver.close()
    print(f"Seed {snapshot.run_id} published atomically")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build the Atlas mathematical knowledge graph")
    parser.add_argument("--dry-run", action="store_true", help="build and validate without publishing to Neo4j")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
