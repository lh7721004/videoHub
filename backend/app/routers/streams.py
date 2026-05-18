import uuid
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Stream
from ..schemas import StreamCreate, StreamResponse, StreamWebhook
from ..auth import get_current_user

router = APIRouter(prefix="/api/streams", tags=["streams"])


def _stream_response(stream: Stream) -> dict:
    return {
        "id": stream.id,
        "title": stream.title,
        "user_id": stream.user_id,
        "username": stream.user.username,
        "stream_key": stream.user.stream_key,
        "is_live": stream.is_live,
        "started_at": stream.started_at,
        "created_at": stream.created_at,
    }


@router.post("/set-title")
def set_stream_title(
    data: StreamCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.stream_key:
        user.stream_key = uuid.uuid4().hex[:16]
        db.commit()
        db.refresh(user)
    live = db.query(Stream).filter(
        Stream.user_id == user.id, Stream.is_live == True
    ).first()
    if live:
        live.title = data.title
        db.commit()
    return {"stream_key": user.stream_key, "title": data.title}


@router.get("/my-key")
def get_my_key(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.stream_key:
        user.stream_key = uuid.uuid4().hex[:16]
        db.commit()
        db.refresh(user)
    return {"stream_key": user.stream_key}


@router.get("", response_model=list[StreamResponse])
def list_streams(live_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(Stream)
    if live_only:
        query = query.filter(Stream.is_live == True)
    streams = query.order_by(Stream.created_at.desc()).limit(50).all()
    return [_stream_response(s) for s in streams]


@router.get("/my", response_model=list[StreamResponse])
def my_streams(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    streams = db.query(Stream).filter(Stream.user_id == user.id).order_by(Stream.created_at.desc()).all()
    return [_stream_response(s) for s in streams]


@router.get("/{stream_id}", response_model=StreamResponse)
def get_stream(stream_id: int, db: Session = Depends(get_db)):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    return _stream_response(stream)


@router.post("/webhook")
def stream_webhook(data: StreamWebhook, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.stream_key == data.stream_key).first()
    if not user:
        raise HTTPException(status_code=404, detail="Unknown stream key")
    if data.event == "live":
        existing = db.query(Stream).filter(
            Stream.user_id == user.id, Stream.is_live == True
        ).first()
        if existing:
            existing.started_at = datetime.utcnow()
        else:
            stream = Stream(
                title=f"{user.username}'s Live",
                user_id=user.id,
                is_live=True,
                started_at=datetime.utcnow(),
            )
            db.add(stream)
        db.commit()
    elif data.event == "done":
        live = db.query(Stream).filter(
            Stream.user_id == user.id, Stream.is_live == True
        ).first()
        if live:
            live.is_live = False
            live.ended_at = datetime.utcnow()
            db.commit()
    return {"ok": True}


@router.delete("/{stream_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_stream(
    stream_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    if stream.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your stream")
    db.delete(stream)
    db.commit()
