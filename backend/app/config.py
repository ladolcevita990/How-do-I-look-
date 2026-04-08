from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # Try-on engine: "stub" (local PIL compositor, free) or "replicate" (IDM-VTON).
    tryon_backend: Literal["stub", "replicate"] = "stub"
    replicate_api_token: str = ""

    serpapi_key: str = ""

    # Long-lived session cookie (365 days). Used to scope photos/garments/outfits
    # to a returning browser without requiring a user account.
    session_cookie_secret: str = "dev-change-me-please-dev-change-me-please"
    session_cookie_name: str = "hdil_session"
    session_cookie_secure: bool = False
    session_cookie_max_age: int = 60 * 60 * 24 * 365  # 1 year

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "howdoilook"

    database_url: str = "sqlite:///./data/howdoilook.db"

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
