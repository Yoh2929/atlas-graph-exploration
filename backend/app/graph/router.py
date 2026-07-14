from typing import Optional

import requests

from fastapi import APIRouter, Depends, HTTPException, Query
from neo4j import Session as Neo4jSession
from sqlalchemy.orm import Session as PgSession

from app.database import get_neo4j_session, get_db
from app.models import Favorite, User
from app.schemas import (
    BiographyOut, GraphOut, NodeDetailOut, NodeOut, NodeCreate, RelationCreate, FavoriteOut,
)
from app.auth.utils import get_current_user
from app.graph import repository as repo
from app.graph.wikipedia import fetch_wikipedia_biography

router = APIRouter(prefix="/api", tags=["graph"])


@router.get("/graph", response_model=GraphOut)
def get_graph(limit: Optional[int] = Query(None, ge=1, le=20000), session: Neo4jSession = Depends(get_neo4j_session)):
    data = repo.get_full_graph(session, limit=limit)
    return data


@router.get("/nodes/{node_id}", response_model=NodeDetailOut)
def get_node(node_id: str, session: Neo4jSession = Depends(get_neo4j_session)):
    node = repo.get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Nœud introuvable")
    return node


@router.get("/nodes/{node_id}/neighbors", response_model=GraphOut)
def get_neighbors(node_id: str, session: Neo4jSession = Depends(get_neo4j_session)):
    return repo.get_neighbors(session, node_id)


@router.get("/nodes/{node_id}/biography", response_model=BiographyOut)
def get_biography(node_id: str, session: Neo4jSession = Depends(get_neo4j_session)):
    node = repo.get_node(session, node_id)
    if node is None:
        raise HTTPException(status_code=404, detail="Nœud introuvable")
    wikipedia_url = node.get("properties", {}).get("wikipedia_url", "")
    if not wikipedia_url:
        return BiographyOut(title=node["label"], extract=node.get("description", ""))
    try:
        return BiographyOut(**fetch_wikipedia_biography(wikipedia_url))
    except requests.RequestException:
        return BiographyOut(
            title=node["label"],
            extract=node.get("description", ""),
            wikipedia_url=wikipedia_url,
        )


@router.get("/search", response_model=list[NodeOut])
def search(
    q: str = Query(min_length=1, max_length=180),
    limit: int = Query(100, ge=1, le=500),
    session: Neo4jSession = Depends(get_neo4j_session),
):
    return repo.search_nodes(session, q, limit=limit)


@router.post("/nodes", response_model=NodeOut)
def create_node(
    payload: NodeCreate,
    session: Neo4jSession = Depends(get_neo4j_session),
    current_user: User = Depends(get_current_user),
):
    try:
        return repo.create_node(session, payload.label, payload.category, payload.description or "")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/relations")
def create_relation(
    payload: RelationCreate,
    session: Neo4jSession = Depends(get_neo4j_session),
    current_user: User = Depends(get_current_user),
):
    try:
        return repo.create_relationship(session, payload.source_id, payload.target_id, payload.relation)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


# ---------- Favoris ----------
@router.post("/favorites/{node_id}", response_model=FavoriteOut)
def add_favorite(node_id: str, db: PgSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(Favorite).filter(
        Favorite.user_id == current_user.id, Favorite.node_id == node_id
    ).first()
    if existing:
        return existing
    fav = Favorite(user_id=current_user.id, node_id=node_id)
    db.add(fav)
    db.commit()
    db.refresh(fav)
    return fav


@router.delete("/favorites/{node_id}", status_code=204)
def remove_favorite(node_id: str, db: PgSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(Favorite).filter(
        Favorite.user_id == current_user.id, Favorite.node_id == node_id
    ).delete()
    db.commit()
    return None


@router.get("/favorites", response_model=list[FavoriteOut])
def list_favorites(db: PgSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    return db.query(Favorite).filter(Favorite.user_id == current_user.id).all()
