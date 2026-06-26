"""Semantic menu search (RAG retrieval) for the order agent.

Pipeline: prefilter orderable items in SQL → embed query + candidates (Ollama
bge-m3) → cosine similarity → hybrid rerank (small boost on literal name match)
→ top-k. Candidate embeddings are cached in Redis (keyed by model + text hash),
so only new/changed items are embedded. If embeddings are disabled or the
embedding endpoint is unreachable, it falls back to keyword search.
"""

import hashlib
import json
import logging
import math
import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from features.ai_order_agent import crud
from infra.cache.base import CacheRepository
from infra.llm import get_embedding_client
from settings.config.app_config import settings

logger = logging.getLogger(__name__)

_EMBED_TTL_SECONDS = 7 * 86_400


def _item_text(item: dict) -> str:
    return f"{item['name']}. {item.get('description') or ''}".strip()


def _cache_key(model: str, text: str) -> str:
    digest = hashlib.sha1(text.encode("utf-8")).hexdigest()
    return f"emb:menuitem:{model}:{digest}"


def _cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


async def semantic_search(
    session: AsyncSession,
    cache: CacheRepository,
    *,
    query: str | None,
    max_price: int | None = None,
    restaurant_id: uuid.UUID | None = None,
    limit: int = 15,
) -> list[dict]:
    cfg = settings.llm
    if not cfg.embeddings_enabled or not query or not query.strip():
        return await crud.search_menu_items(
            session, query=query, max_price=max_price, restaurant_id=restaurant_id, limit=limit
        )

    try:
        candidates = await crud.list_orderable_items(
            session,
            max_price=max_price,
            restaurant_id=restaurant_id,
            limit=cfg.embedding_candidate_limit,
        )
        if not candidates:
            return []

        client = get_embedding_client()
        model = client.model

        query_embedding = (await client.embed([query]))[0]

        misses: list[dict] = []
        for item in candidates:
            text = _item_text(item)
            item["_text"] = text
            item["_key"] = _cache_key(model, text)
            cached = await cache.get(item["_key"])
            item["_embedding"] = json.loads(cached) if cached else None
            if item["_embedding"] is None:
                misses.append(item)

        if misses:
            fresh = await client.embed([item["_text"] for item in misses])
            for item, embedding in zip(misses, fresh):
                item["_embedding"] = embedding
                await cache.set(item["_key"], json.dumps(embedding), ttl=_EMBED_TTL_SECONDS)

        query_lower = query.lower()
        scored: list[tuple[float, dict]] = []
        for item in candidates:
            score = _cosine(query_embedding, item["_embedding"])
            if query_lower in (item["name"] or "").lower():
                score += 0.05
            scored.append((score, item))

        scored.sort(key=lambda pair: pair[0], reverse=True)
        top = [item for _, item in scored[:limit]]
        for item in top:
            for key in ("_text", "_key", "_embedding"):
                item.pop(key, None)
        return top
    except Exception:
        logger.warning("Semantic search failed, falling back to keyword search", exc_info=True)
        return await crud.search_menu_items(
            session, query=query, max_price=max_price, restaurant_id=restaurant_id, limit=limit
        )
