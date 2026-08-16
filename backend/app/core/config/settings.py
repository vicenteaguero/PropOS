import os

from pydantic_settings import BaseSettings, SettingsConfigDict

# Env vars from before the anita -> agent rename. `extra="ignore"` means a
# leftover ANITA_* is silently dropped and the field falls back to its default,
# which is exactly how Cloud Run ran on code defaults for months while
# cloudrun-env.yaml still shipped ANITA_*. Fail the boot instead: on Cloud Run a
# revision that cannot start never receives traffic, so the previous one keeps
# serving.
_RETIRED_ENV_PREFIXES = ("ANITA_",)


class Settings(BaseSettings):
    supabase_url: str
    supabase_anon_key: str
    supabase_service_role_key: str
    app_env: str = "development"
    log_level: str = "debug"
    allowed_origins: list[str] = ["http://localhost:5173", "https://prop-os-delta.vercel.app"]
    vapid_private_key: str = ""
    vapid_public_key: str = ""
    vapid_contact_email: str = "admin@propos.app"

    # Agent AI assistant
    agent_provider: str = "groq"
    agent_model: str = "llama-3.3-70b-versatile"
    agent_fallback_provider: str = "groq"
    cerebras_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    openai_api_key: str = ""
    agent_transcribe_provider: str = "groq"
    agent_daily_budget_usd: float = 0.50
    agent_max_tool_calls_per_turn: int = 8
    agent_turn_timeout_seconds: int = 45
    agent_strict_json_retry: int = 2
    # Window during which a fresh inbound (WhatsApp) or page mount (web) reuses
    # the most recent session instead of starting a new one. Avoids fragmenting
    # a single conversation across dozens of tiny sessions.
    agent_session_inactivity_hours: int = 4
    # Per-user daily turn cap (0 = disabled). Protects shared Groq free-tier
    # quota from a single noisy user. Counts user-role agent_messages in the
    # rolling 24h via the agent_user_turns_today RPC.
    agent_turns_per_user_per_day: int = 50

    # Kapso (WhatsApp BSP)
    kapso_api_key: str = ""
    kapso_webhook_secret: str = ""
    kapso_phone_number_id: str = ""
    kapso_base_url: str = "https://api.kapso.ai/meta/whatsapp/v18.0"
    kapso_default_template_lang: str = "es"

    # Client Agent (B2C AI for inbound WhatsApp from external contacts)
    client_agent_provider: str = "groq"
    client_agent_model: str = "llama-3.3-70b-versatile"
    client_agent_max_history: int = 12
    client_agent_business_name: str = "PropOS"

    # Resend (transactional email)
    resend_api_key: str = ""
    resend_from_email: str = "PropOS <no-reply@propos.dev>"
    app_base_url: str = "https://prop-os-delta.vercel.app"

    # Internal cron endpoints (Cloud Scheduler → POST /internal/jobs/*).
    # Shared-secret header gate; Cloud Run scales to zero so no in-process
    # scheduler. Empty value disables the endpoints (returns 503).
    internal_jobs_secret: str = ""

    # Email sync (single Titan mailbox in v0.1.0; creds via env/secrets only).
    email_sync_enabled: bool = False
    email_imap_host: str = "imap.titan.email"
    email_imap_port: int = 993
    email_imap_user: str = ""
    email_imap_password: str = ""
    # Tenant that owns the synced mailbox.
    email_sync_tenant_id: str = ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


def _reject_retired_env() -> None:
    """Refuse to boot when a retired env var is still set.

    `extra="ignore"` cannot be tightened to "forbid" because the `.env` file
    carries deploy-only keys (GCP_*, SUPABASE_DB_PASSWORD, VITE_*) that are not
    settings fields. So the check is explicit instead of structural.
    """
    stale = sorted(k for k in os.environ if k.startswith(_RETIRED_ENV_PREFIXES))
    if stale:
        raise RuntimeError(
            f"Retired env vars still set: {', '.join(stale)}. "
            "They were renamed ANITA_* -> AGENT_* and are now ignored, which silently "
            "reverts the agent to code defaults. Remove them (see config/docker/cloudrun-env.yaml)."
        )


_reject_retired_env()

settings = Settings()
