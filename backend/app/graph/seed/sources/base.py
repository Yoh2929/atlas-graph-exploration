from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(frozen=True)
class DiscoveredEntity:
    external_id: str
    title: str
    category: str
    source_url: str


class DiscoverySource(Protocol):
    def discover(self) -> list[DiscoveredEntity]: ...
