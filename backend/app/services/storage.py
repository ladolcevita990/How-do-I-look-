"""Storage abstraction.

Two backends:

- ``local`` — files are written under ``settings.local_storage_dir`` and served
  by FastAPI via ``/api/files/{key}``. This is the default and is what we use
  on Render (with a persistent disk mounted at the storage dir).

- ``s3`` — talks to an S3-compatible API (MinIO, AWS S3, Cloudflare R2). Used
  by ``docker compose up`` for local dev and available as a production option.

The public API (``upload_file``, ``download_file``, ``ensure_bucket``) is
identical across both backends so callers never need to care which is active.
"""

from __future__ import annotations

import io
from pathlib import Path
from typing import BinaryIO

from app.config import settings


def _is_s3() -> bool:
    return settings.storage_backend == "s3"


# ---------------------------------------------------------------------------
# Local filesystem backend
# ---------------------------------------------------------------------------


def _local_root() -> Path:
    root = Path(settings.local_storage_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _local_path(key: str) -> Path:
    # Guard against path traversal — keys are internal but be defensive anyway.
    safe_key = key.lstrip("/").replace("..", "_")
    path = (_local_root() / safe_key).resolve()
    if not str(path).startswith(str(_local_root())):
        raise ValueError(f"Invalid storage key: {key}")
    return path


# ---------------------------------------------------------------------------
# S3 backend (lazy import so boto3 isn't required when running local mode)
# ---------------------------------------------------------------------------


def _get_s3_client():
    import boto3  # noqa: WPS433 — intentional lazy import

    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def ensure_bucket() -> None:
    """Make sure the storage destination exists."""
    if _is_s3():
        from botocore.exceptions import ClientError  # noqa: WPS433

        s3 = _get_s3_client()
        try:
            s3.head_bucket(Bucket=settings.s3_bucket_name)
        except ClientError:
            s3.create_bucket(Bucket=settings.s3_bucket_name)
    else:
        _local_root()  # just ensures the directory exists


def upload_file(
    key: str,
    data: BinaryIO | bytes,
    content_type: str = "image/jpeg",
) -> str:
    """Write ``data`` to ``key`` and return a URL the frontend can fetch.

    For both backends the returned URL is relative to the backend (e.g.
    ``/api/files/photos/abc.jpg``) — the frontend prefixes it with the API
    base URL. That keeps client code identical across deploy modes.
    """
    if _is_s3():
        if isinstance(data, bytes):
            data = io.BytesIO(data)
        _get_s3_client().upload_fileobj(
            data,
            settings.s3_bucket_name,
            key,
            ExtraArgs={"ContentType": content_type},
        )
    else:
        path = _local_path(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        if isinstance(data, (bytes, bytearray)):
            path.write_bytes(bytes(data))
        else:
            data.seek(0)
            path.write_bytes(data.read())
    return f"/api/files/{key}"


def download_file(key: str) -> bytes:
    if _is_s3():
        s3 = _get_s3_client()
        response = s3.get_object(Bucket=settings.s3_bucket_name, Key=key)
        return response["Body"].read()
    path = _local_path(key)
    if not path.exists():
        raise FileNotFoundError(key)
    return path.read_bytes()


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    """Kept for parity with the old S3-only API.

    In local mode we just return the same public URL ``upload_file`` returned.
    """
    if _is_s3():
        s3 = _get_s3_client()
        return s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": settings.s3_bucket_name, "Key": key},
            ExpiresIn=expires_in,
        )
    return f"/api/files/{key}"


# Eagerly create the local storage directory so tests and dev don't trip over
# a missing dir before the first upload.
if not _is_s3():
    try:
        _local_root()
    except OSError:
        # Non-fatal — the first upload will try again and surface a real error.
        pass
