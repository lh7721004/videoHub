from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Video, VideoLike
from ..schemas import LikeResponse
from ..auth import get_current_user

router = APIRouter(prefix="/api/videos/{video_id}/like", tags=["likes"])


def _like_count(video_id: int, db: Session) -> int:
    return db.query(func.count(VideoLike.id)).filter(VideoLike.video_id == video_id).scalar()


@router.post("", response_model=LikeResponse)
def like_video(
    video_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Video).filter(Video.id == video_id).first():
        raise HTTPException(status_code=404, detail="Video not found")
    existing = db.query(VideoLike).filter(
        VideoLike.user_id == user.id, VideoLike.video_id == video_id
    ).first()
    if existing:
        return LikeResponse(liked=True, like_count=_like_count(video_id, db))
    like = VideoLike(user_id=user.id, video_id=video_id)
    db.add(like)
    db.commit()
    return LikeResponse(liked=True, like_count=_like_count(video_id, db))


@router.delete("", response_model=LikeResponse)
def unlike_video(
    video_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    like = db.query(VideoLike).filter(
        VideoLike.user_id == user.id, VideoLike.video_id == video_id
    ).first()
    if like:
        db.delete(like)
        db.commit()
    return LikeResponse(liked=False, like_count=_like_count(video_id, db))


@router.get("", response_model=LikeResponse)
def get_like_status(
    video_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    liked = db.query(VideoLike).filter(
        VideoLike.user_id == user.id, VideoLike.video_id == video_id
    ).first() is not None
    return LikeResponse(liked=liked, like_count=_like_count(video_id, db))
