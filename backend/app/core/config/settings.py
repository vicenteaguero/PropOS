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

    model_config = SettingsConfigDict(env_file=".env")


settings = Settings()
