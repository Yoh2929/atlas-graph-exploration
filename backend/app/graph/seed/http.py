from __future__ import annotations

import hashlib
import json
import random
import time
from pathlib import Path
from typing import Any

class CachedHttpClient:
    def __init__(self, cache_dir: Path, user_agent: str, timeout: int, max_retries: int,
                 cache_ttl_seconds: int = 86400, refresh_cache: bool = False):
        import requests

        self.requests = requests
        self.cache_dir = cache_dir
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.timeout = timeout
        self.max_retries = max_retries
        self.cache_ttl_seconds = cache_ttl_seconds
        self.refresh_cache = refresh_cache
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip, deflate",
            "Accept": "application/json",
        })

    def get_json(self, url: str, params: dict[str, Any], namespace: str, refresh: bool | None = None) -> dict:
        key = json.dumps([url, sorted(params.items())], ensure_ascii=True, separators=(",", ":"))
        digest = hashlib.sha256(key.encode("utf-8")).hexdigest()
        path = self.cache_dir / namespace / f"{digest}.json"
        should_refresh = self.refresh_cache if refresh is None else refresh
        cache_is_fresh = path.exists() and (
            self.cache_ttl_seconds < 0
            or time.time() - path.stat().st_mtime <= self.cache_ttl_seconds
        )
        if cache_is_fresh and not should_refresh:
            return json.loads(path.read_text(encoding="utf-8"))

        last_error: Exception | None = None
        for attempt in range(self.max_retries):
            try:
                response = self.session.get(url, params=params, timeout=self.timeout)
                if response.status_code == 429:
                    delay = float(response.headers.get("Retry-After", 2 ** attempt))
                    time.sleep(min(delay, 60))
                    continue
                response.raise_for_status()
                payload = response.json()
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                return payload
            except (self.requests.RequestException, ValueError) as exc:
                last_error = exc
                if attempt + 1 < self.max_retries:
                    time.sleep(min(30, (2 ** attempt) + random.random()))
        if last_error is None:
            raise RuntimeError("HTTP request failed without an exception")
        raise last_error
