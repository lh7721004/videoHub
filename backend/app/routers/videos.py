import mimetypes
import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Form, status
from fastapi.responses import StreamingResponse
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Video, VideoLike, Comment
from ..schemas import VideoCompleteRequest, VideoPresignRequest, VideoPresignResponse, VideoResponse
from ..storage import (
    PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    S3_VIDEO_PREFIX,
    build_video_object_key,
    build_video_url,
    create_presigned_upload_url,
    object_exists,
    s3_enabled,
)
from ..auth import get_current_user, get_optional_user

router = APIRouter(prefix="/api/videos", tags=["videos"])

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


def _video_response(video: Video, db: Session) -> dict:
    like_count = db.query(func.count(VideoLike.id)).filter(VideoLike.video_id == video.id).scalar()
    comment_count = db.query(func.count(Comment.id)).filter(Comment.video_id == video.id).scalar()
    return {
        "id": video.id,
        "title": video.title,
        "description": video.description,
        "filename": video.filename,
        "thumbnail_url": video.thumbnail_url,
        "video_url": build_video_url(video.filename) or f"/api/videos/{video.id}/stream",
        "views": video.views,
        "user_id": video.user_id,
        "username": video.user.username,
        "created_at": video.created_at,
        "like_count": like_count,
        "comment_count": comment_count,
    }


@router.post("/presign", response_model=VideoPresignResponse)
def presign_video_upload(
    data: VideoPresignRequest,
    user: User = Depends(get_current_user),
):
    if not s3_enabled():
        raise HTTPException(status_code=503, detail="S3 video upload is not configured")
    if not data.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    object_key = build_video_object_key(user.id, data.filename)
    upload_url = create_presigned_upload_url(object_key, data.content_type)
    return VideoPresignResponse(
        upload_url=upload_url,
        object_key=object_key,
        video_url=build_video_url(object_key),
        expires_in=PRESIGNED_UPLOAD_EXPIRES_SECONDS,
    )


@router.post("/complete", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
def complete_video_upload(
    data: VideoCompleteRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not s3_enabled():
        raise HTTPException(status_code=503, detail="S3 video upload is not configured")
    if not data.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")
    expected_prefix = f"{S3_VIDEO_PREFIX.strip('/')}/{user.id}/"
    if not data.object_key.startswith(expected_prefix):
        raise HTTPException(status_code=400, detail="Invalid uploaded object")
    if not object_exists(data.object_key):
        raise HTTPException(status_code=400, detail="Uploaded video object was not found")

    video = Video(
        title=data.title,
        description=data.description,
        filename=data.object_key,
        thumbnail_url="",
        user_id=user.id,
    )
    db.add(video)
    db.commit()
    db.refresh(video)
    return _video_response(video, db)


@router.post("", response_model=VideoResponse, status_code=status.HTTP_201_CREATED)
async def upload_video(
    title: str = Form(...),
    description: str = Form(""),
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="File must be a video")

    ext = os.path.splitext(file.filename or "video.mp4")[1]
    filename = f"{uuid.uuid4()}{ext}"
    filepath = UPLOAD_DIR / filename

    with open(filepath, "wb") as f:
        content = await file.read()
        f.write(content)

    video = Video(title=title, description=description, filename=filename, user_id=user.id)
    db.add(video)
    db.commit()
    db.refresh(video)
    return _video_response(video, db)


@router.get("", response_model=list[VideoResponse])
def list_videos(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    videos = db.query(Video).order_by(Video.created_at.desc()).offset(skip).limit(limit).all()
    return [_video_response(v, db) for v in videos]


@router.get("/search", response_model=list[VideoResponse])
def search_videos(keyword: str = "", db: Session = Depends(get_db)):
    query = db.query(Video)
    if keyword:
        pattern = f"%{keyword}%"
        query = query.filter(Video.title.ilike(pattern) | Video.description.ilike(pattern))
    videos = query.order_by(Video.created_at.desc()).limit(50).all()
    return [_video_response(v, db) for v in videos]


@router.get("/{video_id}", response_model=VideoResponse)
def get_video(video_id: int, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    video.views += 1
    db.commit()
    db.refresh(video)
    return _video_response(video, db)


CHUNK_SIZE = 1024 * 1024  # 1MB


@router.get("/{video_id}/stream")
def stream_video(video_id: int, request: Request, db: Session = Depends(get_db)):
    video = db.query(Video).filter(Video.id == video_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")

    filepath = UPLOAD_DIR / video.filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = filepath.stat().st_size
    content_type = mimetypes.guess_type(str(filepath))[0] or "video/mp4"

    range_header = request.headers.get("range")
    if range_header:
        range_spec = range_header.replace("bytes=", "")
        parts = range_spec.split("-")
        start = int(parts[0])
        end = int(parts[1]) if parts[1] else min(start + CHUNK_SIZE - 1, file_size - 1)
        end = min(end, file_size - 1)
        content_length = end - start + 1

        def iter_chunk():
            with open(filepath, "rb") as f:
                f.seek(start)
                remaining = content_length
                while remaining > 0:
                    chunk = f.read(min(CHUNK_SIZE, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return StreamingResponse(
            iter_chunk(),
            status_code=206,
            media_type=content_type,
            headers={
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Accept-Ranges": "bytes",
                "Content-Length": str(content_length),
            },
        )

    def iter_file():
        with open(filepath, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                yield chunk

    return StreamingResponse(
        iter_file(),
        media_type=content_type,
        headers={
            "Accept-Ranges": "bytes",
            "Content-Length": str(file_size),
        },
    )
