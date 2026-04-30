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
    anita_provider: str = "cerebras"  # cerebras | anthropic | openai | groq
    anita_model: str = "llama-3.3-70b"
    anita_fallback_provider: str = "groq"
    cerebras_api_key: str = ""
    anthropic_api_key: str = ""
    groq_api_key: str = ""
    openai_api_key: str = ""
    anita_transcribe_provider: str = "groq"  # groq | openai
    anita_daily_budget_usd: float = 0.50
    anita_max_tool_calls_per_turn: int = 8
    anita_turn_timeout_seconds: int = 45
    anita_strict_json_retry: int = 2

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
