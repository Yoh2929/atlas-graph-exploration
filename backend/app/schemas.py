from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, EmailStr, Field


# ---------- Graphe ----------
class NodeOut(BaseModel):
    id: str
    label: str
    category: str
    description: Optional[str] = ""
    degree: int = 0
    properties: dict = {}


class EdgeOut(BaseModel):
    source: str
    target: str
    relation: str
    label: str = ""
    inverse_label: str = ""
    properties: dict = {}


class GraphOut(BaseModel):
    nodes: List[NodeOut]
    edges: List[EdgeOut]
    total: Optional[int] = None
    loaded: Optional[int] = None
    offset: int = 0
    has_more: bool = False


class NodeDetailOut(NodeOut):
    properties: dict = {}


class BiographyOut(BaseModel):
    title: str
    extract: str = ""
    image_url: str = ""
    image_original_url: str = ""
    wikipedia_url: str = ""
    language: str = ""


class NodeCreate(BaseModel):
    label: str
    category: str
    description: Optional[str] = ""


class RelationCreate(BaseModel):
    source_id: str
    target_id: str
    relation: str


# ---------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=72)
    display_name: Optional[str] = Field(default=None, max_length=64)


class UserUpdate(BaseModel):
    display_name: str = Field(min_length=1, max_length=64)


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=10, max_length=72)


class UserOut(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


# ---------- Favoris / commentaires ----------
class FavoriteOut(BaseModel):
    id: str
    node_id: str
    created_at: datetime

    class Config:
        from_attributes = True


class CommentCreate(BaseModel):
    node_id: str
    content: str = Field(min_length=1, max_length=2000)


class CommentOut(BaseModel):
    id: str
    node_id: str
    content: str
    created_at: datetime
    user_id: str

    class Config:
        from_attributes = True
