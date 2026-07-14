from __future__ import annotations

import hashlib
import re
import unicodedata
from collections import Counter, defaultdict
from datetime import UTC, datetime
from math import ceil
from time import monotonic
from typing import Iterable
from urllib.parse import quote

from ..config import SeedSettings
from ..http import CachedHttpClient
from ..models import Evidence, SeedEdge, SeedNode
from .base import DiscoveredEntity


API_URL = "https://www.wikidata.org/w/api.php"
SPARQL_URL = "https://query.wikidata.org/sparql"
HUMAN_QID = "Q5"

# Relations porteuses de sens pour une carte de connaissances. Les autres
# propriétés Wikidata (identifiants de catalogues, maintenance, médias...) ne
# deviennent jamais des arêtes Atlas.
RELATION_POLICY = {
    "P138": (100, "nommé d'après"),
    "P61": (98, "découvert ou inventé par"),
    "P170": (96, "créé par"),
    "P50": (95, "auteur"),
    "P287": (94, "conçu par"),
    "P112": (92, "fondé par"),
    "P178": (90, "développé par"),
    "P800": (86, "œuvre notable"),
    "P101": (82, "domaine de travail"),
    "P737": (80, "influencé par"),
    "P144": (76, "basé sur"),
    "P1269": (72, "facette de"),
    "P2578": (70, "étudie"),
    "P361": (65, "partie de"),
    "P527": (65, "comprend"),
    "P279": (55, "sous-classe de"),
    "P31": (50, "instance de"),
    "P155": (45, "précédé par"),
    "P156": (45, "suivi par"),
    "P460": (40, "équivalent à"),
}

# Seules ces relations sont autorisées à faire entrer une nouvelle entité dans
# le graphe. Les relations taxonomiques restent utiles entre nœuds déjà retenus,
# mais ne doivent pas remplir la carte de classes abstraites.
EXPANSION_RELATIONS = {
    "P138", "P61", "P170", "P50", "P287", "P112", "P178",
    "P800", "P101", "P737",
}


def _chunks(values: list[str], size: int = 50) -> Iterable[list[str]]:
    for index in range(0, len(values), size):
        yield values[index:index + size]


def _localized(entity: dict, field: str, languages: tuple[str, ...]) -> str:
    values = entity.get(field, {})
    for language in languages:
        value = values.get(language, {}).get("value")
        if value:
            return value
    return ""


def _slug(value: str, fallback: str) -> str:
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-z0-9]+", "_", ascii_value.lower()).strip("_")
    return slug or fallback.lower()


def _claim_target(statement: dict) -> str | None:
    if statement.get("rank") == "deprecated":
        return None
    datavalue = statement.get("mainsnak", {}).get("datavalue", {})
    if datavalue.get("type") != "wikibase-entityid":
        return None
    return datavalue.get("value", {}).get("id")


def _wikipedia_url(entity: dict, fallback: str = "") -> str:
    sitelinks = entity.get("sitelinks", {})
    for site, language in (("frwiki", "fr"), ("enwiki", "en")):
        title = sitelinks.get(site, {}).get("title")
        if title:
            return f"https://{language}.wikipedia.org/wiki/{quote(title.replace(' ', '_'), safe='()/,_-')}"
    return fallback


def _is_human(entity: dict) -> bool:
    return any(
        _claim_target(statement) == HUMAN_QID
        for statement in entity.get("claims", {}).get("P31", [])
    )


def _category_for_expansion(entity: dict, languages: tuple[str, ...]) -> str:
    text = " ".join((
        _localized(entity, "labels", languages),
        _localized(entity, "descriptions", languages),
    )).casefold()
    if _is_human(entity):
        return "person"
    if any(word in text for word in ("problem", "problème")):
        return "problem"
    if "conjecture" in text:
        return "conjecture"
    if any(word in text for word in ("theorem", "théorème", "lemma", "lemme")):
        return "theorem"
    if any(word in text for word in ("algorithm", "algorithme", "procedure", "procédure")):
        return "algorithm"
    return "domain"


class WikidataSource:
    def __init__(self, client: CachedHttpClient, settings: SeedSettings):
        self.client = client
        self.settings = settings

    def discover_notable_mathematicians(self, limit: int | None) -> list[DiscoveredEntity]:
        # Le nombre de sitelinks est un signal Wikimedia transparent et
        # reproductible de couverture encyclopédique, pas une liste éditée à
        # la main dans Atlas.
        result = []
        page_size = min(limit, 1000) if limit is not None else 1000
        offset = 0
        while limit is None or len(result) < limit:
            requested = min(page_size, limit - len(result)) if limit is not None else page_size
            query = f"""
            SELECT DISTINCT ?person ?personLabel ?article ?sitelinks WHERE {{
              ?person wdt:P106 wd:Q170790;
                      wikibase:sitelinks ?sitelinks.
              ?article schema:about ?person;
                       schema:isPartOf <https://en.wikipedia.org/>.
              SERVICE wikibase:label {{ bd:serviceParam wikibase:language "fr,en". }}
            }}
            ORDER BY DESC(?sitelinks) ?person
            LIMIT {requested}
            OFFSET {offset}
            """
            data = self.client.get_json(
                SPARQL_URL,
                {"query": query, "format": "json"},
                "wikidata-notable-mathematicians",
            )
            bindings = data.get("results", {}).get("bindings", [])
            for binding in bindings:
                entity_url = binding.get("person", {}).get("value", "")
                qid = entity_url.rsplit("/", 1)[-1]
                article = binding.get("article", {}).get("value", "")
                if qid.startswith("Q") and article:
                    result.append(DiscoveredEntity(
                        external_id=qid,
                        title=binding.get("personLabel", {}).get("value", qid),
                        category="person",
                        source_url=article,
                    ))
            if len(bindings) < requested:
                break
            offset += requested
            print(f"  Wikidata/Wikipedia: {len(result)} mathematiciens charges...", flush=True)
        print(f"  Wikidata/Wikipedia: {len(result)} mathematiciens majeurs retenus", flush=True)
        return result

    def entities(self, ids: list[str], properties: str = "info|labels|descriptions|claims|sitelinks") -> dict[str, dict]:
        result: dict[str, dict] = {}
        unique_ids = list(dict.fromkeys(ids))
        total_batches = max(1, ceil(len(unique_ids) / 50))
        for batch_number, batch in enumerate(_chunks(unique_ids), start=1):
            print(f"    Wikidata: lot {batch_number}/{total_batches} ({len(batch)} identifiants)", flush=True)
            data = self.client.get_json(API_URL, {
                "action": "wbgetentities",
                "ids": "|".join(batch),
                "props": properties,
                "languages": "|".join(self.settings.label_languages),
                "languagefallback": 1,
                "sitefilter": "frwiki|enwiki",
                "maxlag": 5,
                "format": "json",
            }, "wikidata-entities")
            for entity_id, entity in data.get("entities", {}).items():
                if not entity.get("missing"):
                    result[entity_id] = entity
        return result

    def _property_metadata(self, property_ids: list[str]) -> dict[str, dict]:
        entities = self.entities(property_ids, "info|labels|descriptions")
        return {
            pid: {
                "label": _localized(entity, "labels", self.settings.label_languages)
                or RELATION_POLICY.get(pid, (0, pid))[1],
                "description": _localized(entity, "descriptions", self.settings.label_languages),
            }
            for pid, entity in entities.items()
        }

    def _expansion_candidates(self, entities: dict[str, dict], existing_ids: set[str]) -> list[str]:
        score = Counter()
        occurrences = Counter()
        for entity in entities.values():
            for property_id in EXPANSION_RELATIONS:
                priority = RELATION_POLICY[property_id][0]
                for statement in entity.get("claims", {}).get(property_id, []):
                    target_id = _claim_target(statement)
                    if not target_id or target_id in existing_ids:
                        continue
                    score[target_id] = max(score[target_id], priority)
                    occurrences[target_id] += 1
        return sorted(score, key=lambda qid: (-score[qid], -occurrences[qid], qid))

    def _reverse_eponym_candidates(self, person_ids: list[str], budget: int | None) -> list[str]:
        if not person_ids or budget == 0:
            return []
        by_person: dict[str, list[tuple[int, str]]] = defaultdict(list)
        for person_batch in _chunks(person_ids, 100):
            values = " ".join(f"wd:{qid}" for qid in person_batch)
            page_size = 5000 if budget is None else max(200, min(5000, budget * 8))
            offset = 0
            while True:
                query = f"""
                SELECT DISTINCT ?item ?person ?sitelinks WHERE {{
                  VALUES ?person {{ {values} }}
                  ?item wdt:P138 ?person;
                        wikibase:sitelinks ?sitelinks.
                  ?article schema:about ?item;
                           schema:isPartOf <https://en.wikipedia.org/>.
                }}
                ORDER BY ?person DESC(?sitelinks) ?item
                LIMIT {page_size}
                OFFSET {offset}
                """
                data = self.client.get_json(
                    SPARQL_URL,
                    {"query": query, "format": "json"},
                    "wikidata-reverse-eponyms",
                )
                bindings = data.get("results", {}).get("bindings", [])
                for binding in bindings:
                    qid = binding.get("item", {}).get("value", "").rsplit("/", 1)[-1]
                    person_id = binding.get("person", {}).get("value", "").rsplit("/", 1)[-1]
                    sitelinks = int(binding.get("sitelinks", {}).get("value", "0"))
                    if qid.startswith("Q") and person_id.startswith("Q"):
                        by_person[person_id].append((sitelinks, qid))
                if budget is not None or len(bindings) < page_size:
                    break
                offset += page_size

        # Tourniquet : les concepts de Newton ou Euler ne doivent pas absorber
        # tout le budget au détriment de Hilbert, Fourier ou Noether.
        result: list[str] = []
        ranked = {
            person_id: [qid for _, qid in sorted(items, reverse=True)]
            for person_id, items in by_person.items()
        }
        depth = 0
        target = budget * 3 if budget is not None else None
        while target is None or len(result) < target:
            added = False
            for person_id in person_ids:
                items = ranked.get(person_id, [])
                if depth < len(items):
                    result.append(items[depth])
                    added = True
            if not added:
                break
            depth += 1
        print(f"  Eponymes inverses: {len(result)} concepts candidats pour {len(by_person)} personnes", flush=True)
        return list(dict.fromkeys(result))

    def _make_node(
        self,
        qid: str,
        entity: dict,
        category: str,
        discovered_from: str,
        now: str,
    ) -> SeedNode:
        wikipedia_url = _wikipedia_url(entity, discovered_from)
        return SeedNode(
            id=qid,
            label=_localized(entity, "labels", self.settings.label_languages) or qid,
            category="person" if _is_human(entity) else category,
            description=_localized(entity, "descriptions", self.settings.label_languages),
            properties={
                "wikidata_id": qid,
                "wikidata_url": f"https://www.wikidata.org/wiki/{qid}",
                "wikipedia_url": wikipedia_url,
                "wikidata_revision_id": str(entity.get("lastrevid", "")),
                "discovered_from": discovered_from,
            },
            evidence=[Evidence(
                provider="wikidata",
                source_id=qid,
                source_url=f"https://www.wikidata.org/wiki/{qid}",
                retrieved_at=now,
                revision_id=str(entity.get("lastrevid", "")),
            )],
        )

    def build(self, discovered: list[DiscoveredEntity]) -> tuple[list[SeedNode], list[SeedEdge], dict]:
        started = monotonic()
        now = datetime.now(UTC).isoformat()
        discovered_by_id = {item.external_id: item for item in discovered}
        print(f"  Chargement de {len(discovered_by_id)} entites Wikidata...", flush=True)
        entities = self.entities(list(discovered_by_id))
        rejected_non_people = {
            qid for qid, entity in entities.items()
            if discovered_by_id[qid].category == "person" and not _is_human(entity)
        }
        for qid in rejected_non_people:
            entities.pop(qid, None)
            discovered_by_id.pop(qid, None)
        if rejected_non_people:
            print(f"  Filtre personnes: {len(rejected_non_people)} pages-index/ecarts retires", flush=True)

        expansion_budget = (
            max(0, self.settings.max_nodes - len(entities))
            if self.settings.max_nodes else None
        )
        reverse_candidates = self._reverse_eponym_candidates(
            [qid for qid, entity in entities.items() if _is_human(entity)],
            expansion_budget,
        )
        accepted_expansions: list[str] = []
        first_wave_limit = (
            max(1, int(expansion_budget * 0.70))
            if expansion_budget is not None and expansion_budget > 0 else expansion_budget
        )

        def accept_wave(limit: int | None) -> None:
            remaining = limit - len(accepted_expansions) if limit is not None else None
            if remaining is not None and remaining <= 0:
                return
            outgoing = self._expansion_candidates(entities, set(entities))
            candidates = [qid for qid in reverse_candidates if qid not in entities]
            candidates.extend(qid for qid in outgoing if qid not in candidates)
            pool = candidates if remaining is None else candidates[:max(remaining * 4, 50)]
            loaded = self.entities(pool) if pool else {}
            # À priorité de relation égale, les personnes passent avant les
            # concepts intermédiaires : c'est le cœur de la navigation Atlas.
            ordered = sorted(pool, key=lambda qid: (not _is_human(loaded.get(qid, {})), pool.index(qid)))
            for qid in ordered:
                entity = loaded.get(qid)
                if (
                    entity and _wikipedia_url(entity)
                    and (limit is None or len(accepted_expansions) < limit)
                ):
                    entities[qid] = entity
                    accepted_expansions.append(qid)

        accept_wave(first_wave_limit)
        # Une seconde vague permet par exemple FFT -> transformée de Fourier
        # -> Joseph Fourier, sans exploration générale incontrôlée.
        accept_wave(expansion_budget)

        print(
            f"  Expansion semantique: {len(accepted_expansions)} entites reliees ajoutees "
            f"({sum(_is_human(entities[qid]) for qid in accepted_expansions)} personnes)",
            flush=True,
        )

        nodes: list[SeedNode] = []
        for qid, entity in entities.items():
            discovery = discovered_by_id.get(qid)
            if discovery:
                category = discovery.category
                source_url = discovery.source_url
            else:
                category = _category_for_expansion(entity, self.settings.label_languages)
                source_url = _wikipedia_url(entity)
            nodes.append(self._make_node(qid, entity, category, source_url, now))

        valid_ids = {node.id for node in nodes}
        property_ids: set[str] = set()
        raw_edges: list[tuple[str, str, str, dict]] = []
        for source_id, entity in entities.items():
            for property_id in RELATION_POLICY:
                for statement in entity.get("claims", {}).get(property_id, []):
                    target_id = _claim_target(statement)
                    if not target_id or target_id not in valid_ids or target_id == source_id:
                        continue
                    property_ids.add(property_id)
                    raw_edges.append((source_id, target_id, property_id, statement))

        print(f"  Chargement de {len(property_ids)} predicats semantiques utiles...", flush=True)
        metadata = self._property_metadata(sorted(property_ids)) if property_ids else {}
        edges: list[SeedEdge] = []
        seen = set()
        for source_id, target_id, property_id, statement in raw_edges:
            fallback_label = RELATION_POLICY[property_id][1]
            relation_meta = metadata.get(property_id, {"label": fallback_label, "description": ""})
            edge_key = f"{source_id}|{property_id}|{target_id}"
            edge_id = hashlib.sha256(edge_key.encode("utf-8")).hexdigest()[:24]
            if edge_id in seen:
                continue
            seen.add(edge_id)
            edges.append(SeedEdge(
                id=edge_id,
                source=source_id,
                target=target_id,
                relation=f"{property_id.lower()}_{_slug(relation_meta['label'], property_id)}",
                label=relation_meta["label"],
                properties={
                    "wikidata_property_id": property_id,
                    "predicate_description": relation_meta["description"],
                    "rank": statement.get("rank", "normal"),
                    "reference_count": len(statement.get("references", [])),
                },
                evidence=[Evidence(
                    provider="wikidata",
                    source_id=f"{source_id}${statement.get('id', property_id)}",
                    source_url=f"https://www.wikidata.org/wiki/{source_id}#{property_id}",
                    retrieved_at=now,
                    revision_id=str(entities[source_id].get("lastrevid", "")),
                )],
            ))
            if self.settings.max_edges and len(edges) >= self.settings.max_edges:
                break

        print(
            f"  Wikidata termine: {len(nodes)} noeuds, {len(edges)} relations fiables, "
            f"{len(property_ids)} predicats, {monotonic() - started:.1f}s",
            flush=True,
        )
        return nodes, edges, {
            "wikidata_entities_requested": len(discovered_by_id),
            "wikidata_entities_loaded": len(nodes),
            "related_entities_added": len(accepted_expansions),
            "related_people_added": sum(_is_human(entities[qid]) for qid in accepted_expansions),
            "semantic_predicates": len(property_ids),
        }
