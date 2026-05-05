from pydantic_settings import BaseSettings, SettingsConfigDict


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

    # Anita AI assistant
    anita_provider: str = "groq"
    anita_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    anita_fallback_provider: str = "groq"
    cerebras_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    openai_api_key: str = ""
    anita_transcribe_provider: str = "groq"
    anita_daily_budget_usd: float = 0.50
    anita_max_tool_calls_per_turn: int = 8
    anita_turn_timeout_seconds: int = 45
    anita_strict_json_retry: int = 2
    # Window during which a fresh inbound (WhatsApp) or page mount (web) reuses
    # the most recent session instead of starting a new one. Avoids fragmenting
    # a single conversation across dozens of tiny sessions.
    anita_session_inactivity_hours: int = 4

    # Kapso (WhatsApp BSP)
    kapso_api_key: str = ""
    kapso_webhook_secret: str = ""
    kapso_phone_number_id: str = ""
    kapso_base_url: str = "https://api.kapso.ai/meta/whatsapp/v18.0"
    kapso_default_template_lang: str = "es"

    # Client Agent (B2C AI for inbound WhatsApp from external contacts)
    client_agent_provider: str = "groq"
    client_agent_model: str = "meta-llama/llama-4-scout-17b-16e-instruct"
    client_agent_max_history: int = 12
    client_agent_business_name: str = "PropOS"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
