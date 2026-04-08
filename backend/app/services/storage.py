import io
from typing import BinaryIO

import boto3
from botocore.exceptions import ClientError

from app.config import settings


def get_s3_client():
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
    )


def ensure_bucket():
    s3 = get_s3_client()
    try:
        s3.head_bucket(Bucket=settings.s3_bucket_name)
    except ClientError:
        s3.create_bucket(Bucket=settings.s3_bucket_name)


def upload_file(key: str, data: BinaryIO | bytes, content_type: str = "image/jpeg") -> str:
    s3 = get_s3_client()
    if isinstance(data, bytes):
        data = io.BytesIO(data)
    s3.upload_fileobj(
        data,
        settings.s3_bucket_name,
        key,
        ExtraArgs={"ContentType": content_type},
    )
    return f"{settings.s3_endpoint_url}/{settings.s3_bucket_name}/{key}"


def download_file(key: str) -> bytes:
    s3 = get_s3_client()
    response = s3.get_object(Bucket=settings.s3_bucket_name, Key=key)
    return response["Body"].read()


def get_presigned_url(key: str, expires_in: int = 3600) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_bucket_name, "Key": key},
        ExpiresIn=expires_in,
    )
