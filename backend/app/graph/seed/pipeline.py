from __future__ import annotations

from datetime import UTC, datetime
from time import monotonic

from .config import SeedSettings
from .http import CachedHttpClient
from .models import SeedSnapshot
from .sources import WikidataSource, WikipediaSource


class SeedPipeline:
    def __init__(self, settings: SeedSettings):
        settings.validate()
        self.settings = settings
        self.http = CachedHttpClient(
            settings.cache_dir,
            settings.user_agent,
            settings.request_timeout,
            settings.max_retries,
            settings.cache_ttl_seconds,
            settings.refresh_cache,
        )
        self.wikipedia = WikipediaSource(self.http, settings)
        self.wikidata = WikidataSource(self.http, settings)

    def build(self) -> SeedSnapshot:
        started = datetime.now(UTC)
        timer = monotonic()
        discovery_budget = max(1, int(self.settings.max_nodes * 0.72))
        notable_people_budget = max(1, int(discovery_budget * 0.24))
        wikipedia_budget = max(1, discovery_budget - notable_people_budget)
        print(
            f"[seed 1/4] Decouverte ciblee via Wikipedia ({discovery_budget} sujets, "
            f"{self.settings.max_nodes - discovery_budget} places reservees aux entites reliees)",
            flush=True,
        )
        discovered = self.wikipedia.discover(wikipedia_budget)
        print(
            f"  Selection de {notable_people_budget} mathematiciens majeurs par couverture Wikipedia...",
            flush=True,
        )
        notable_people = self.wikidata.discover_notable_mathematicians(notable_people_budget)
        by_id = {entity.external_id: entity for entity in (*discovered, *notable_people)}
        discovered = list(by_id.values())[:discovery_budget]
        print("[seed 2/4] Enrichissement et relations semantiques via Wikidata", flush=True)
        nodes, edges, wikidata_metrics = self.wikidata.build(discovered)
        print("[seed 3/4] Construction du snapshot reproductible", flush=True)
        run_id = started.strftime("%Y%m%dT%H%M%S%fZ")
        snapshot = SeedSnapshot(
            run_id=run_id,
            created_at=started.isoformat(),
            nodes=nodes,
            edges=edges,
            metadata={
                "pipeline_version": 3,
                "discovery_provider": "wikipedia",
                "knowledge_provider": "wikidata",
                "discovered_entities": len(discovered),
                **wikidata_metrics,
            },
        )
        print(f"[seed 4/4] Build termine en {monotonic() - timer:.1f}s", flush=True)
        return snapshot
