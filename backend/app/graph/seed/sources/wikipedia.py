from __future__ import annotations

from collections import deque
from math import ceil
from time import monotonic
from urllib.parse import quote

from ..config import SeedSettings, WikipediaRoot
from ..http import CachedHttpClient
from .base import DiscoveredEntity


CATEGORY_PRIORITY = {
    "domain": 0,
    "theorem": 1,
    "problem": 2,
    "algorithm": 3,
    "conjecture": 4,
    "person": 5,
}


class WikipediaSource:
    def __init__(self, client: CachedHttpClient, settings: SeedSettings):
        self.client = client
        self.settings = settings
        self.api_url = f"https://{settings.wikipedia_language}.wikipedia.org/w/api.php"

    def _category_members(self, category: str) -> list[dict]:
        members: list[dict] = []
        continuation: str | None = None
        while True:
            params = {
                "action": "query",
                "list": "categorymembers",
                "cmtitle": category,
                "cmnamespace": "0|14",
                "cmtype": "page|subcat",
                "cmlimit": "max",
                "format": "json",
                "formatversion": 2,
            }
            if continuation:
                params["cmcontinue"] = continuation
            data = self.client.get_json(self.api_url, params, "wikipedia-categories")
            members.extend(data.get("query", {}).get("categorymembers", []))
            continuation = data.get("continue", {}).get("cmcontinue")
            if not continuation:
                return members

    def _page_links(self, title: str) -> list[str]:
        links: list[str] = []
        continuation: str | None = None
        while True:
            params = {
                "action": "query",
                "titles": title,
                "prop": "links",
                "plnamespace": 0,
                "pllimit": "max",
                "redirects": 1,
                "format": "json",
                "formatversion": 2,
            }
            if continuation:
                params["plcontinue"] = continuation
            data = self.client.get_json(self.api_url, params, "wikipedia-links")
            for page in data.get("query", {}).get("pages", []):
                links.extend(item["title"] for item in page.get("links", []) if item.get("title"))
            continuation = data.get("continue", {}).get("plcontinue")
            if not continuation:
                return links

    def _crawl_anchor(self, anchor: WikipediaRoot, budget: int) -> dict[str, str]:
        pages: dict[str, str] = {}
        queue = deque([(anchor.title, 0)])
        visited = set()
        while queue and len(pages) < budget:
            title, depth = queue.popleft()
            if title in visited:
                continue
            visited.add(title)
            for linked_title in self._page_links(title):
                normalized = linked_title.casefold()
                is_index = normalized.startswith(("list of ", "lists of ", "index of "))
                if is_index and depth < 1:
                    queue.append((linked_title, depth + 1))
                elif not is_index:
                    pages[linked_title] = anchor.category
                if len(pages) >= budget:
                    break
        return pages

    def _crawl_root(self, root: WikipediaRoot, budget: int) -> dict[str, str]:
        pages: dict[str, str] = {}
        queue = deque([(root.title, 0)])
        visited = set()
        per_category_budget = max(10, budget // 20)
        while queue and len(pages) < budget:
            category, depth = queue.popleft()
            if category in visited:
                continue
            visited.add(category)
            if len(visited) == 1 or len(visited) % 10 == 0:
                print(
                    f"    {root.category}: {len(visited)} categories visitees, {len(pages)}/{budget} pages",
                    flush=True,
                )
            pages_from_category = 0
            for member in self._category_members(category):
                namespace = member.get("ns")
                title = member.get("title", "")
                if namespace == 0:
                    if pages_from_category < per_category_budget:
                        pages[title] = root.category
                        pages_from_category += 1
                elif namespace == 14 and depth < min(
                    self.settings.wikipedia_depth,
                    1 if root.category == "domain" else self.settings.wikipedia_depth,
                ):
                    queue.append((title, depth + 1))
                if len(pages) >= budget:
                    break
        return pages

    def _qids_for_titles(self, titles: list[str]) -> dict[str, str]:
        result: dict[str, str] = {}
        total_batches = max(1, ceil(len(titles) / 50))
        for index in range(0, len(titles), 50):
            batch = titles[index:index + 50]
            batch_number = index // 50 + 1
            print(f"    resolution QID: lot {batch_number}/{total_batches} ({len(batch)} pages)", flush=True)
            data = self.client.get_json(self.api_url, {
                "action": "query",
                "titles": "|".join(batch),
                "prop": "pageprops",
                "ppprop": "wikibase_item",
                "redirects": 1,
                "format": "json",
                "formatversion": 2,
            }, "wikipedia-pageprops")
            for page in data.get("query", {}).get("pages", []):
                qid = page.get("pageprops", {}).get("wikibase_item")
                if qid:
                    result[page.get("title", "")] = qid
            for redirect in data.get("query", {}).get("redirects", []):
                target = redirect.get("to")
                if target in result:
                    result[redirect.get("from", "")] = result[target]
        return result

    def discover(self, budget: int | None = None) -> list[DiscoveredEntity]:
        started = monotonic()
        budget = budget or self.settings.max_nodes
        anchor_budget = min(budget // 3, max(0, budget - len(self.settings.roots)))
        category_budget = budget - anchor_budget
        per_root = max(1, category_budget // len(self.settings.roots))
        title_categories: dict[str, str] = {}
        for root_index, root in enumerate(self.settings.roots, start=1):
            root_started = monotonic()
            print(
                f"  [{root_index}/{len(self.settings.roots)}] {root.title} -> {root.category} (budget {per_root})",
                flush=True,
            )
            root_pages = self._crawl_root(root, per_root)
            print(f"    termine: {len(root_pages)} pages en {monotonic() - root_started:.1f}s", flush=True)
            for title, category in root_pages.items():
                current = title_categories.get(title)
                if current is None or CATEGORY_PRIORITY[category] > CATEGORY_PRIORITY[current]:
                    title_categories[title] = category

        if self.settings.anchors and anchor_budget:
            per_anchor = max(1, anchor_budget // len(self.settings.anchors))
            print(f"  Parcours de {len(self.settings.anchors)} pages-index fiables...", flush=True)
            for anchor in self.settings.anchors:
                anchor_pages = self._crawl_anchor(anchor, per_anchor)
                print(f"    {anchor.title}: {len(anchor_pages)} articles relies", flush=True)
                for title, category in anchor_pages.items():
                    current = title_categories.get(title)
                    if current is None or CATEGORY_PRIORITY[category] > CATEGORY_PRIORITY[current]:
                        title_categories[title] = category

        print(f"  Resolution de {len(title_categories)} pages Wikipedia en QID...", flush=True)
        qids = self._qids_for_titles(list(title_categories))
        by_qid: dict[str, DiscoveredEntity] = {}
        for title, category in title_categories.items():
            qid = qids.get(title)
            if not qid:
                continue
            entity = DiscoveredEntity(
                external_id=qid,
                title=title,
                category=category,
                source_url=f"https://{self.settings.wikipedia_language}.wikipedia.org/wiki/{quote(title.replace(' ', '_'))}",
            )
            previous = by_qid.get(qid)
            if previous is None or CATEGORY_PRIORITY[category] > CATEGORY_PRIORITY[previous.category]:
                by_qid[qid] = entity
            if len(by_qid) >= budget:
                break
        print(
            f"  Wikipedia termine: {len(by_qid)} entites uniques en {monotonic() - started:.1f}s",
            flush=True,
        )
        return list(by_qid.values())
