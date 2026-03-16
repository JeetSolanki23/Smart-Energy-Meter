from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import ORJSONResponse
from prometheus_fastapi_instrumentator import Instrumentator

import app.models
from app.api.api_v1 import api_router
from app.core.config import get_settings
from app.core.logging import setup_logging
from app.db.base import Base
from app.db.session import engine

settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title=settings.APP_NAME,
    debug=settings.DEBUG,
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
)

Instrumentator().instrument(app).expose(app)
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "healthy"}
