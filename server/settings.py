from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    CURRICULLM_API_KEY: str
    GROQ_API_KEY: str
    SERPER_API_KEY: str
    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    MAPBOX_TOKEN: str
    PORT: int = 3001

    model_config = {"env_file": ".env"}


settings = Settings()
