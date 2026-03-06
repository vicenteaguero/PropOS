from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.constants import API_PREFIX, HEALTH_PATH
from app.core.config.settings import settings
from app.core.logging.logger import configure_logging, get_logger
from app.core.middleware.tenant import TenantMiddleware
from app.core.middleware.timing import TimingMiddleware
from app.features.contacts.router import router as contacts_router
from app.features.documents.router import router as documents_router
from app.features.interactions.router import router as interactions_router
from app.features.projects.router import router as projects_router
from app.features.properties.router import router as properties_router
from app.features.users.router import router as users_router
from app.features.notifications.router import router as notifications_router

APP_TITLE = "PropOS API"
APP_DESCRIPTION = "Real estate operations platform"

logger = get_logger("APP")


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncGenerator[None]:
    configure_logging(settings.log_level)
    logger.info("PropOS API started", event_type="start")
    yield


def create_app() -> FastAPI:
    is_production = settings.app_env == "production"
    application = FastAPI(
        title=APP_TITLE,
        description=APP_DESCRIPTION,
        lifespan=lifespan,
        docs_url=None if is_production else "/docs",
        redoc_url=None if is_production else "/redoc",
        openapi_url=None if is_production else "/openapi.json",
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    application.add_middleware(TimingMiddleware)
    application.add_middleware(TenantMiddleware)

    application.include_router(properties_router, prefix=API_PREFIX)
    application.include_router(contacts_router, prefix=API_PREFIX)
    application.include_router(projects_router, prefix=API_PREFIX)
    application.include_router(interactions_router, prefix=API_PREFIX)
    application.include_router(documents_router, prefix=API_PREFIX)
    application.include_router(users_router, prefix=API_PREFIX)
    application.include_router(notifications_router, prefix=API_PREFIX)

    @application.get(HEALTH_PATH)
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    return application


app = create_app()
