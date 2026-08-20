import os
from contextlib import asynccontextmanager
from collections.abc import AsyncGenerator
from datetime import UTC, datetime, timedelta
from typing import Any

import anyio
from fastapi import FastAPI, Header, Response
from fastapi.middleware.cors import CORSMiddleware

from app.core.config.constants import API_PREFIX, API_VERSION, HEALTH_PATH
from app.core.config.settings import settings
from app.core.logging.logger import configure_logging, get_logger
from app.core.middleware.dev_schema import DevSchemaMiddleware
from app.core.middleware.tenant import TenantMiddleware
from app.core.middleware.timing import TimingMiddleware
from app.features.ads.router import router as ads_router
from app.features.analytics.router import router as analytics_router
from app.features.agent.router import router as agent_router
from app.features.agent.tools.executors import register_all_dispatchers
from app.features.channels.phones_api import router as user_phones_router
from app.features.channels.router_api import router as client_chat_router
from app.features.integrations.kapso.webhook import router as kapso_webhook_router
from app.features.campaigns.router import router as campaigns_router
from app.features.compliance.router import admin_router as compliance_admin_router
from app.features.compliance.router import router as compliance_router
from app.features.contacts.router import router as contacts_router
from app.features.visitor_invitations.router import admin_router as visitor_invitations_admin_router
from app.features.visitor_invitations.router import public_router as visitor_invitations_public_router
from app.features.documents.router import public_router as documents_public_router
from app.features.documents.router import router as documents_router
from app.features.interactions.router import router as interactions_router
from app.features.email_sync.router import router as email_sync_router
from app.features.events.router import router as events_router
from app.features.finance.router import router as finance_router
from app.features.imports.router import router as imports_router
from app.features.internal_areas.router import router as internal_areas_router
from app.features.jobs.router import router as jobs_router
from app.features.reminders.router import router as reminders_router
from app.features.notes.router import router as notes_router
from app.features.data_health.router import router as data_health_router
from app.features.search.router import router as search_router
from app.features.notifications.router import router as notifications_router
from app.features.opportunities.router import router as opportunities_router
from app.features.organizations.router import router as organizations_router
from app.features.pending.router import router as pending_router
from app.features.places.router import router as places_router
from app.features.projects.router import router as projects_router
from app.features.properties.router import router as properties_router
from app.features.publications.router import router as publications_router
from app.features.taggings.router import router as taggings_router
from app.features.tags.router import router as tags_router
from app.features.tasks.router import router as tasks_router
from app.features.grants.router import admin_router as grants_admin_router
from app.features.grants.router import router as grants_router
from app.features.memberships.router import admin_router as memberships_admin_router
from app.features.memberships.router import router as memberships_router
from app.features.sharing.router import router as sharing_router
from app.features.tenants.router import admin_router as tenants_admin_router
from app.features.tenants.router import router as tenants_router
from app.features.transactions.router import router as transactions_router
from app.features.uf.router import router as uf_router
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


# Secrets without which the API cannot serve a single business request. Missing
# any of these makes /health/ready answer 503, because the revision is running
# but useless. Read lazily so a secret rotated at runtime is picked up.
_CORE_SECRETS = {
    "SUPABASE_URL": lambda: settings.supabase_url,
    "SUPABASE_ANON_KEY": lambda: settings.supabase_anon_key,
    "SUPABASE_SERVICE_ROLE_KEY": lambda: settings.supabase_service_role_key,
}

# Features that stay dark until their secret is provisioned. Reported, never
# fatal — cloudbuild.yaml mounts only the secrets that exist, by design, so an
# unprovisioned integration is the expected state and not a broken deploy.
_OPTIONAL_INTEGRATIONS = {
    "agent_llm": lambda: settings.groq_api_key,
    # Not a Settings field: the SQL tools read this straight from the env.
    "agent_readonly_sql": lambda: os.environ.get("AGENT_READONLY_DB_URL", ""),
    "push_notifications": lambda: settings.vapid_private_key,
    "whatsapp_kapso": lambda: settings.kapso_api_key,
    "transactional_email": lambda: settings.resend_api_key,
    "internal_jobs": lambda: settings.internal_jobs_secret,
    "email_sync": lambda: settings.email_imap_password if settings.email_sync_enabled else "",
}

# A readiness probe must not become the slowest thing in the deploy. Both DB
# probes run in a worker thread (the Supabase client is synchronous) under a
# hard deadline, so a hung database answers 503 instead of hanging the request.
_PROBE_TIMEOUT_SECONDS = 5
_JOB_STALE_AFTER = timedelta(minutes=15)


async def _probe_database() -> tuple[bool, str | None]:
    """One trivial read through PostgREST. Proves URL, key and project are live."""
    from app.core.supabase.client import get_supabase_client

    def _query() -> None:
        get_supabase_client().table("tenants").select("id").limit(1).execute()

    try:
        with anyio.fail_after(_PROBE_TIMEOUT_SECONDS):
            await anyio.to_thread.run_sync(_query)
    except TimeoutError:
        return False, f"no response within {_PROBE_TIMEOUT_SECONDS}s"
    except Exception as exc:  # noqa: BLE001 - any failure means "not ready"
        return False, type(exc).__name__
    return True, None


async def _probe_jobs() -> dict[str, Any]:
    """Cheap staleness signal for the Cloud Scheduler jobs.

    There is no job-run table, so this infers liveness from the work itself: a
    reminder still PENDING long after it was due means nothing is draining the
    queue. Advisory only — it never fails the readiness check, because the
    scheduler jobs are part of the production cutover, not of this revision.
    """
    from app.core.supabase.client import get_supabase_client

    cutoff = (datetime.now(UTC) - _JOB_STALE_AFTER).isoformat()

    def _query() -> dict[str, Any]:
        client = get_supabase_client()
        overdue = (
            # tenant-safe: readiness probe counts across all tenants by design
            client.table("reminders")
            .select("id", count="exact")
            .eq("status", "PENDING")
            .lt("remind_at", cutoff)
            .is_("deleted_at", "null")
            .limit(1)
            .execute()
        )
        return {
            "reminders_overdue": overdue.count or 0,
            "status": "stale" if (overdue.count or 0) > 0 else "ok",
        }

    try:
        with anyio.fail_after(_PROBE_TIMEOUT_SECONDS):
            return await anyio.to_thread.run_sync(_query)
    except Exception:  # noqa: BLE001 - advisory signal, never fatal
        return {"status": "unknown"}


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
    # Development only: lets the frontend flip between `public` and the
    # `propos_test` mirror per request instead of restarting the API.
    if settings.app_env == "development":
        application.add_middleware(DevSchemaMiddleware)

    versioned_prefix = f"{API_PREFIX}/{API_VERSION}"
    application.include_router(users_router, prefix=versioned_prefix)
    application.include_router(tenants_router, prefix=versioned_prefix)
    application.include_router(memberships_router, prefix=versioned_prefix)
    application.include_router(memberships_admin_router, prefix=versioned_prefix)
    application.include_router(grants_router, prefix=versioned_prefix)
    application.include_router(grants_admin_router, prefix=versioned_prefix)
    application.include_router(sharing_router, prefix=versioned_prefix)
    application.include_router(tenants_admin_router, prefix=versioned_prefix)
    application.include_router(uf_router, prefix=versioned_prefix)
    application.include_router(notifications_router, prefix=versioned_prefix)
    application.include_router(properties_router, prefix=versioned_prefix)
    application.include_router(contacts_router, prefix=versioned_prefix)
    application.include_router(compliance_router, prefix=versioned_prefix)
    application.include_router(compliance_admin_router, prefix=versioned_prefix)
    application.include_router(visitor_invitations_admin_router, prefix=versioned_prefix)
    application.include_router(visitor_invitations_public_router, prefix=versioned_prefix)
    application.include_router(internal_areas_router, prefix=versioned_prefix)
    application.include_router(documents_router, prefix=versioned_prefix)
    application.include_router(pending_router, prefix=versioned_prefix)
    application.include_router(interactions_router, prefix=versioned_prefix)
    application.include_router(tasks_router, prefix=versioned_prefix)
    application.include_router(events_router, prefix=versioned_prefix)
    application.include_router(reminders_router, prefix=versioned_prefix)
    application.include_router(email_sync_router, prefix=versioned_prefix)
    application.include_router(finance_router, prefix=versioned_prefix)
    application.include_router(imports_router, prefix=versioned_prefix)
    application.include_router(transactions_router, prefix=versioned_prefix)
    application.include_router(organizations_router, prefix=versioned_prefix)
    application.include_router(places_router, prefix=versioned_prefix)
    application.include_router(projects_router, prefix=versioned_prefix)
    application.include_router(opportunities_router, prefix=versioned_prefix)
    application.include_router(campaigns_router, prefix=versioned_prefix)
    application.include_router(ads_router, prefix=versioned_prefix)
    application.include_router(publications_router, prefix=versioned_prefix)
    application.include_router(notes_router, prefix=versioned_prefix)
    application.include_router(search_router, prefix=versioned_prefix)
    application.include_router(data_health_router, prefix=versioned_prefix)
    application.include_router(tags_router, prefix=versioned_prefix)
    application.include_router(taggings_router, prefix=versioned_prefix)
    application.include_router(workflows_router, prefix=versioned_prefix)
    application.include_router(agent_router, prefix=versioned_prefix)
    application.include_router(analytics_router, prefix=versioned_prefix)
    application.include_router(client_chat_router, prefix=versioned_prefix)
    application.include_router(user_phones_router, prefix=versioned_prefix)
    application.include_router(jobs_router, prefix=versioned_prefix)
    application.include_router(documents_public_router)
    # Public webhook (no JWT). Mounted under versioned prefix; HMAC-verified.
    application.include_router(kapso_webhook_router, prefix=versioned_prefix)

    # Wire pending acceptance dispatchers (Agent propose_* → domain inserts)
    register_all_dispatchers()

    @application.get(HEALTH_PATH)
    async def health_check() -> dict[str, str]:
        """Liveness. Deliberately touches nothing: it answers "the process is
        up", which is all a restart policy needs. Readiness lives below."""
        return {"status": "healthy"}

    @application.get(f"{HEALTH_PATH}/ready")
    async def readiness_check(
        response: Response,
        x_internal_key: str | None = Header(default=None),
    ) -> dict[str, Any]:
        """Readiness: does this revision actually work?

        `/health` cannot fail for any reason short of a dead process, yet
        `make deploy-verify` and the keepalive workflow both treated it as proof
        of life — so a rotated Supabase key, a paused free-tier project or an
        unmounted secret all stayed green. This checks the dependencies instead
        and answers 503 when a core one is broken, which is what those two
        callers now poll.

        Optional integrations never fail the check: they are switched off on
        purpose until their secret is provisioned. They surface in `detail`,
        which needs the internal key outside development so a public endpoint
        does not enumerate the deployment's wiring.
        """
        checks: dict[str, Any] = {}
        detail: dict[str, Any] = {}

        db_ok, db_error = await _probe_database()
        checks["database"] = "ok" if db_ok else "error"
        if db_error:
            detail["database_error"] = db_error

        missing = [name for name, value in _CORE_SECRETS.items() if not value()]
        checks["secrets"] = "ok" if not missing else "missing"
        detail["missing_secrets"] = missing

        detail["integrations"] = {name: "on" if value() else "off" for name, value in _OPTIONAL_INTEGRATIONS.items()}
        detail["jobs"] = await _probe_jobs() if db_ok else {"status": "unknown"}

        ready = db_ok and not missing
        checks_status = "ready" if ready else "not_ready"
        if not ready:
            response.status_code = 503

        body: dict[str, Any] = {"status": checks_status, "checks": checks}
        if settings.app_env != "production" or (
            settings.internal_jobs_secret and x_internal_key == settings.internal_jobs_secret
        ):
            body["detail"] = detail
        return body

    return application


app = create_app()
