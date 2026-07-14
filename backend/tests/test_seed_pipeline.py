import unittest
from pathlib import Path

from app.graph.relations import canonicalize_relation, inverse_relation_label
from app.graph.seed.config import SeedSettings, WikipediaRoot
from app.graph.seed.models import Evidence, SeedEdge, SeedNode, SeedSnapshot
from app.graph.seed.sources.base import DiscoveredEntity
from app.graph.seed.sources.wikidata import WikidataSource
from app.graph.seed.validation import validate_snapshot
from app.graph.seed.writer import serialize_edges, serialize_nodes


class FakeClient:
    def __init__(self, entities):
        self.entities = entities

    def get_json(self, url, params, namespace, refresh=False):
        ids = params.get("ids", "").split("|")
        return {"entities": {entity_id: self.entities[entity_id] for entity_id in ids if entity_id in self.entities}}


def claim(target, statement_id="s1", rank="normal"):
    return {
        "id": statement_id,
        "rank": rank,
        "mainsnak": {"datavalue": {"type": "wikibase-entityid", "value": {"id": target}}},
        "references": [{}],
    }


def external_id(value):
    return {
        "rank": "normal",
        "mainsnak": {"datavalue": {"type": "string", "value": value}},
    }


class WikidataSourceTests(unittest.TestCase):
    def test_semantic_relation_expands_to_linked_person_without_catalog_ids(self):
        entities = {
            "Q1": {
                "id": "Q1", "lastrevid": 10,
                "labels": {"en": {"value": "A theorem"}},
                "descriptions": {"en": {"value": "test theorem"}},
                "claims": {"P138": [claim("Q2")], "P6366": [external_id("ABC")]},
                "sitelinks": {"enwiki": {"title": "A theorem"}},
            },
            "Q2": {
                "id": "Q2", "lastrevid": 11,
                "labels": {"en": {"value": "A person"}},
                "descriptions": {}, "claims": {"P31": [claim("Q5")]},
                "sitelinks": {"enwiki": {"title": "A person"}},
            },
            "P138": {
                "id": "P138", "datatype": "wikibase-item",
                "labels": {"en": {"value": "named after"}}, "descriptions": {}, "claims": {},
            },
        }
        settings = SeedSettings(
            max_nodes=10, max_edges=10, wikipedia_depth=1,
            roots=(WikipediaRoot("Category:Math", "domain"),),
            cache_dir=Path("unused"), artifact_dir=Path("unused"),
        )
        source = WikidataSource(FakeClient(entities), settings)
        nodes, edges, metrics = source.build([
            DiscoveredEntity("Q1", "A theorem", "theorem", "https://wiki/Q1"),
        ])
        self.assertEqual(edges[0].relation, "p138_named_after")
        self.assertEqual(edges[0].properties["wikidata_property_id"], "P138")
        self.assertEqual(next(node for node in nodes if node.id == "Q2").category, "person")
        self.assertNotIn("external_links", nodes[0].properties)
        self.assertEqual(metrics["related_people_added"], 1)


class ValidationAndWriterTests(unittest.TestCase):
    def test_valid_snapshot_serializes_nested_provenance_for_neo4j(self):
        evidence = Evidence("wikidata", "Q1", "https://wikidata/Q1", "2026-01-01T00:00:00Z")
        snapshot = SeedSnapshot(
            "run", "2026-01-01T00:00:00Z",
            [
                SeedNode("Q1", "One", "theorem", properties={"external_links": []}, evidence=[evidence]),
                SeedNode("Q2", "Two", "person", evidence=[evidence]),
            ],
            [SeedEdge("edge", "Q1", "Q2", "related", "related", evidence=[evidence])],
        )
        settings = SeedSettings(max_nodes=10, max_edges=10)
        report = validate_snapshot(snapshot, settings)
        self.assertTrue(report.valid)
        self.assertIn("evidence_json", serialize_nodes(snapshot)[0])
        self.assertIn("evidence_json", serialize_edges(snapshot)[0])

    def test_dangling_edges_fail_validation(self):
        evidence = Evidence("wikidata", "Q1", "url", "now")
        snapshot = SeedSnapshot(
            "run", "now", [SeedNode("Q1", "One", "theorem")],
            [SeedEdge("edge", "Q1", "Q404", "related", "related", evidence=[evidence])],
        )
        report = validate_snapshot(snapshot, SeedSettings(max_nodes=10, max_edges=10))
        self.assertFalse(report.valid)
        self.assertTrue(any("Dangling" in error for error in report.errors))


class RelationshipPresentationTests(unittest.TestCase):
    def test_influenced_by_has_a_semantic_inverse(self):
        self.assertEqual(inverse_relation_label("P737", "influencé par"), "a influencé")
        self.assertEqual(
            canonicalize_relation("Einstein", "Riemann", "P737", "influencé par", "a influencé"),
            ("Riemann", "Einstein", "a influencé", "influencé par"),
        )

    def test_unknown_relation_never_reuses_a_misleading_direction(self):
        self.assertIn("relation inverse", inverse_relation_label("", "lié à"))


if __name__ == "__main__":
    unittest.main()
