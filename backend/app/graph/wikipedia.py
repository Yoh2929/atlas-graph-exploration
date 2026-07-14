from __future__ import annotations

from functools import lru_cache
from urllib.parse import unquote, urlparse

import requests


@lru_cache(maxsize=512)
def fetch_wikipedia_biography(wikipedia_url: str) -> dict:
    parsed = urlparse(wikipedia_url)
    language = parsed.hostname.split(".")[0] if parsed.hostname else "fr"
    title = unquote(parsed.path.removeprefix("/wiki/")).replace("_", " ")
    if not title:
        return {"title": "", "extract": "", "image_url": "", "image_original_url": "", "wikipedia_url": wikipedia_url, "language": language}

    response = requests.get(
        f"https://{language}.wikipedia.org/w/api.php",
        params={
            "action": "query",
            "prop": "extracts|pageimages",
            "titles": title,
            "exintro": 1,
            "explaintext": 1,
            "redirects": 1,
            "piprop": "thumbnail|original",
            "pithumbsize": 900,
            "format": "json",
            "formatversion": 2,
        },
        headers={"User-Agent": "Atlas-Math-Knowledge/3.0"},
        timeout=12,
    )
    response.raise_for_status()
    pages = response.json().get("query", {}).get("pages", [])
    page = pages[0] if pages else {}
    return {
        "title": page.get("title", title),
        "extract": page.get("extract", ""),
        "image_url": page.get("thumbnail", {}).get("source", ""),
        "image_original_url": page.get("original", {}).get("source", ""),
        "wikipedia_url": wikipedia_url,
        "language": language,
    }
