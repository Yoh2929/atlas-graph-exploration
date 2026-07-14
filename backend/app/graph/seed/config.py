from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path


@dataclass(frozen=True)
class WikipediaRoot:
    title: str
    category: str


DEFAULT_ROOTS = (
    WikipediaRoot("Category:Mathematics", "domain"),
    WikipediaRoot("Category:Mathematical theorems", "theorem"),
    WikipediaRoot("Category:Conjectures", "conjecture"),
    WikipediaRoot("Category:Mathematical problems", "problem"),
    WikipediaRoot("Category:Algorithms", "algorithm"),
    WikipediaRoot("Category:Mathematicians", "person"),
)

DEFAULT_ANCHORS = (
    WikipediaRoot("Lists of unsolved problems in mathematics", "problem"),
)


def _integer(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def _boolean(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def _roots() -> tuple[WikipediaRoot, ...]:
    raw = os.getenv("ATLAS_SEED_WIKIPEDIA_ROOTS", "").strip()
    if not raw:
        return DEFAULT_ROOTS
    roots = []
    for item in raw.split(";"):
        title, category = item.rsplit("|", 1)
        roots.append(WikipediaRoot(title.strip(), category.strip()))
    return tuple(roots)


def _anchors() -> tuple[WikipediaRoot, ...]:
    raw = os.getenv("ATLAS_SEED_WIKIPEDIA_ANCHORS", "").strip()
    if not raw:
        return DEFAULT_ANCHORS
    anchors = []
    for item in raw.split(";"):
        title, category = item.rsplit("|", 1)
        anchors.append(WikipediaRoot(title.strip(), category.strip()))
    return tuple(anchors)


@dataclass(frozen=True)
class SeedSettings:
    # 0 means unlimited. The traversal remains bounded by its configured
    # Wikipedia depth and by the finite result sets returned by the sources.
    max_nodes: int = field(default_factory=lambda: _integer("ATLAS_SEED_MAX_NODES", 0))
    max_edges: int = field(default_factory=lambda: _integer("ATLAS_SEED_MAX_EDGES", 0))
    wikipedia_depth: int = field(default_factory=lambda: _integer("ATLAS_SEED_WIKIPEDIA_DEPTH", 2))
    wikipedia_language: str = field(default_factory=lambda: os.getenv("ATLAS_SEED_WIKIPEDIA_LANGUAGE", "en"))
    label_languages: tuple[str, ...] = ("fr", "en")
    roots: tuple[WikipediaRoot, ...] = field(default_factory=_roots)
    anchors: tuple[WikipediaRoot, ...] = field(default_factory=_anchors)
    request_timeout: int = field(default_factory=lambda: _integer("ATLAS_SEED_HTTP_TIMEOUT", 30))
    max_retries: int = field(default_factory=lambda: _integer("ATLAS_SEED_HTTP_RETRIES", 5))
    cache_ttl_seconds: int = field(default_factory=lambda: _integer("ATLAS_SEED_CACHE_TTL_SECONDS", 86400))
    refresh_cache: bool = field(default_factory=lambda: _boolean("ATLAS_SEED_REFRESH_CACHE"))
    cache_dir: Path = field(default_factory=lambda: Path(os.getenv("ATLAS_SEED_CACHE_DIR", ".seed-cache")))
    artifact_dir: Path = field(default_factory=lambda: Path(os.getenv("ATLAS_SEED_ARTIFACT_DIR", "seed-artifacts")))
    user_agent: str = field(default_factory=lambda: os.getenv(
        "ATLAS_SEED_USER_AGENT",
        "Atlas-Math-Knowledge/2.0 (https://github.com/atlas; contact: local-development)",
    ))

    def validate(self) -> None:
        if self.max_nodes < 0 or self.max_edges < 0:
            raise ValueError("Seed budgets must be positive, or 0 for unlimited")
        if not 0 <= self.wikipedia_depth <= 6:
            raise ValueError("Wikipedia depth must be between 0 and 6")
        valid_categories = {"domain", "theorem", "conjecture", "problem", "algorithm", "person"}
        unknown = {root.category for root in (*self.roots, *self.anchors)} - valid_categories
        if unknown:
            raise ValueError(f"Unsupported display categories: {sorted(unknown)}")
