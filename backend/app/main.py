from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.constants import API_PREFIX, API_VERSION, HEALTH_PATH
from app.core.config.settings import settings
from app.core.logging.logger import configure_logging, get_logger
from app.core.middleware.tenant import TenantMiddleware
from app.core.middleware.timing import TimingMiddleware
from app.features.analytics.router import router as analytics_router
from app.features.anita.router import router as anita_router
from app.features.anita.tools.executors import register_all_dispatchers
from app.features.campaigns.router import router as campaigns_router
from app.features.contacts.router import router as contacts_router
from app.features.documents.router import public_router as documents_public_router
from app.features.documents.router import router as documents_router
from app.features.interactions.router import router as interactions_router
from app.features.internal_areas.router import router as internal_areas_router
from app.features.notes.router import router as notes_router
from app.features.notifications.router import router as notifications_router
from app.features.opportunities.router import router as opportunities_router
from app.features.organizations.router import router as organizations_router
from app.features.pending.router import router as pending_router
from app.features.places.router import router as places_router
from app.features.projects.router import router as projects_router
from app.features.properties.router import router as properties_router
from app.features.publications.router import router as publications_router
from app.features.tags.router import router as tags_router
from app.features.tasks.router import router as tasks_router
from app.features.transactions.router import router as transactions_router
from app.features.users.router import router as users_router
from app.features.workflows.router import router as workflows_router

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

    versioned_prefix = f"{API_PREFIX}/{API_VERSION}"
    application.include_router(users_router, prefix=versioned_prefix)
    application.include_router(notifications_router, prefix=versioned_prefix)
    application.include_router(properties_router, prefix=versioned_prefix)
    application.include_router(contacts_router, prefix=versioned_prefix)
    application.include_router(internal_areas_router, prefix=versioned_prefix)
    application.include_router(documents_router, prefix=versioned_prefix)
    application.include_router(pending_router, prefix=versioned_prefix)
    application.include_router(interactions_router, prefix=versioned_prefix)
    application.include_router(tasks_router, prefix=versioned_prefix)
    application.include_router(transactions_router, prefix=versioned_prefix)
    application.include_router(organizations_router, prefix=versioned_prefix)
    application.include_router(places_router, prefix=versioned_prefix)
    application.include_router(projects_router, prefix=versioned_prefix)
    application.include_router(opportunities_router, prefix=versioned_prefix)
    application.include_router(campaigns_router, prefix=versioned_prefix)
    application.include_router(publications_router, prefix=versioned_prefix)
    application.include_router(notes_router, prefix=versioned_prefix)
    application.include_router(tags_router, prefix=versioned_prefix)
    application.include_router(workflows_router, prefix=versioned_prefix)
    application.include_router(anita_router, prefix=versioned_prefix)
    application.include_router(analytics_router, prefix=versioned_prefix)
    application.include_router(documents_public_router)

    # Wire pending acceptance dispatchers (Anita propose_* → domain inserts)
    register_all_dispatchers()

    @application.get(HEALTH_PATH)
    async def health_check() -> dict[str, str]:
        return {"status": "healthy"}

    return application


app = create_app()
