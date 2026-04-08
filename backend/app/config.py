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
    # Set to True in any production deploy — required for cross-site cookies.
    session_cookie_secure: bool = False
    # "lax" for same-origin dev, "none" for cross-origin prod (Vercel + Render).
    session_cookie_samesite: Literal["lax", "none", "strict"] = "lax"
    session_cookie_max_age: int = 60 * 60 * 24 * 365  # 1 year

    # ---- Storage ----
    # "local" = write to a directory on disk, served via /api/files/{key}.
    # "s3"    = talk to an S3-compatible API (MinIO, AWS S3, Cloudflare R2).
    storage_backend: Literal["local", "s3"] = "local"
    local_storage_dir: str = "./data/files"

    s3_endpoint_url: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket_name: str = "howdoilook"

    database_url: str = "sqlite:///./data/howdoilook.db"

    backend_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:3000"
    # Comma-separated list of additional CORS origins (e.g. preview URLs).
    cors_extra_origins: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}

    @property
    def cors_allowed_origins(self) -> list[str]:
        origins = {self.frontend_url, "http://localhost:3000"}
        for o in self.cors_extra_origins.split(","):
            o = o.strip()
            if o:
                origins.add(o)
        return sorted(origins)


settings = Settings()
