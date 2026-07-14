from __future__ import annotations

from collections import Counter
from dataclasses import dataclass, field

from .config import SeedSettings
from .models import SeedSnapshot


@dataclass
class ValidationReport:
    valid: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    metrics: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "metrics": self.metrics,
        }


def validate_snapshot(snapshot: SeedSnapshot, settings: SeedSettings) -> ValidationReport:
    errors: list[str] = []
    warnings: list[str] = []
    node_ids = [node.id for node in snapshot.nodes]
    node_set = set(node_ids)
    duplicate_nodes = [key for key, count in Counter(node_ids).items() if count > 1]
    if duplicate_nodes:
        errors.append(f"Duplicate node ids: {duplicate_nodes[:10]}")
    if settings.max_nodes and len(snapshot.nodes) > settings.max_nodes:
        errors.append(f"Node budget exceeded: {len(snapshot.nodes)} > {settings.max_nodes}")
    if settings.max_edges and len(snapshot.edges) > settings.max_edges:
        errors.append(f"Edge budget exceeded: {len(snapshot.edges)} > {settings.max_edges}")

    dangling = [edge.id for edge in snapshot.edges if edge.source not in node_set or edge.target not in node_set]
    if dangling:
        errors.append(f"Dangling edges: {dangling[:10]}")
    duplicate_edges = [key for key, count in Counter(edge.id for edge in snapshot.edges).items() if count > 1]
    if duplicate_edges:
        errors.append(f"Duplicate edge ids: {duplicate_edges[:10]}")

    qid_labels = [node.id for node in snapshot.nodes if node.label == node.id]
    if qid_labels:
        errors.append(f"Nodes without a usable label: {qid_labels[:10]}")
    without_evidence = [edge.id for edge in snapshot.edges if not edge.evidence]
    if without_evidence:
        errors.append(f"Edges without provenance: {without_evidence[:10]}")

    categories = Counter(node.category for node in snapshot.nodes)
    predicates = Counter(edge.relation for edge in snapshot.edges)
    isolated = node_set - {edge.source for edge in snapshot.edges} - {edge.target for edge in snapshot.edges}
    if snapshot.nodes and len(isolated) / len(snapshot.nodes) > 0.75:
        warnings.append(f"High isolated-node ratio: {len(isolated)}/{len(snapshot.nodes)}")
    expected_minimum = min(50, settings.max_nodes) if settings.max_nodes else 50
    if len(snapshot.nodes) < expected_minimum:
        warnings.append("The resulting corpus is unexpectedly small")

    return ValidationReport(
        valid=not errors,
        errors=errors,
        warnings=warnings,
        metrics={
            "nodes": len(snapshot.nodes),
            "edges": len(snapshot.edges),
            "categories": dict(categories),
            "semantic_predicates": len(predicates),
            "top_predicates": dict(predicates.most_common(20)),
            "isolated_nodes": len(isolated),
        },
    )
