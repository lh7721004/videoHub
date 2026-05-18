import os
import uuid
from pathlib import Path

import boto3
from botocore.config import Config


AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
S3_VIDEO_BUCKET = os.getenv("S3_VIDEO_BUCKET", "")
S3_VIDEO_PREFIX = os.getenv("S3_VIDEO_PREFIX", "videos")
VIDEO_CDN_BASE_URL = os.getenv("VIDEO_CDN_BASE_URL", "").rstrip("/")
PRESIGNED_UPLOAD_EXPIRES_SECONDS = int(os.getenv("PRESIGNED_UPLOAD_EXPIRES_SECONDS", "900"))


def s3_enabled() -> bool:
    return bool(S3_VIDEO_BUCKET and VIDEO_CDN_BASE_URL)


def build_video_object_key(user_id: int, filename: str) -> str:
    suffix = Path(filename or "video.mp4").suffix.lower() or ".mp4"
    return f"{S3_VIDEO_PREFIX.strip('/')}/{user_id}/{uuid.uuid4().hex}{suffix}"


def build_video_url(object_key: str) -> str:
    if object_key.startswith("http://") or object_key.startswith("https://"):
        return object_key
    if s3_enabled():
        return f"{VIDEO_CDN_BASE_URL}/{object_key.lstrip('/')}"
    return ""


def create_presigned_upload_url(object_key: str, content_type: str) -> str:
    client = boto3.client(
        "s3",
        region_name=AWS_REGION,
        config=Config(signature_version="s3v4"),
    )
    return client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": S3_VIDEO_BUCKET,
            "Key": object_key,
            "ContentType": content_type,
        },
        ExpiresIn=PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    )


def object_exists(object_key: str) -> bool:
    client = boto3.client("s3", region_name=AWS_REGION)
    try:
        client.head_object(Bucket=S3_VIDEO_BUCKET, Key=object_key)
        return True
    except Exception:
        return False
