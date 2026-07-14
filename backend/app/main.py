from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import Base, engine, close_neo4j_driver, get_neo4j_session, _driver
from app.graph.repository import ensure_constraints
from app.auth.router import router as auth_router
from app.graph.router import router as graph_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Tables Postgres
    Base.metadata.create_all(bind=engine)
    # Contraintes Neo4j
    with _driver.session() as session:
        ensure_constraints(session)
    yield
    close_neo4j_driver()


app = FastAPI(
    title="Atlas — moteur de connaissances mathématiques",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(graph_router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
