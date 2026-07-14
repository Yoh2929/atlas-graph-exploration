from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Any


@dataclass(frozen=True)
class Evidence:
    provider: str
    source_id: str
    source_url: str
    retrieved_at: str
    revision_id: str = ""


@dataclass
class SeedNode:
    id: str
    label: str
    category: str
    description: str = ""
    properties: dict[str, Any] = field(default_factory=dict)
    evidence: list[Evidence] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["evidence"] = [asdict(item) for item in self.evidence]
        return value


@dataclass
class SeedEdge:
    id: str
    source: str
    target: str
    relation: str
    label: str
    properties: dict[str, Any] = field(default_factory=dict)
    evidence: list[Evidence] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        value = asdict(self)
        value["evidence"] = [asdict(item) for item in self.evidence]
        return value


@dataclass
class SeedSnapshot:
    run_id: str
    created_at: str
    nodes: list[SeedNode]
    edges: list[SeedEdge]
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "run_id": self.run_id,
            "created_at": self.created_at,
            "nodes": [node.to_dict() for node in self.nodes],
            "edges": [edge.to_dict() for edge in self.edges],
            "metadata": self.metadata,
        }
