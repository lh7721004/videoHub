from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Stream, ChatMessage
from ..schemas import ChatMessageCreate, ChatMessageResponse
from ..auth import get_current_user
from ..ws import chat_manager

router = APIRouter(prefix="/api/streams/{stream_id}/chat", tags=["chat"])


def _chat_response(msg: ChatMessage) -> dict:
    return {
        "id": msg.id,
        "content": msg.content,
        "user_id": msg.user_id,
        "username": msg.user.username,
        "stream_id": msg.stream_id,
        "created_at": msg.created_at,
    }


@router.get("", response_model=list[ChatMessageResponse])
def get_chat_messages(stream_id: int, db: Session = Depends(get_db)):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.stream_id == stream_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(100)
        .all()
    )
    return [_chat_response(m) for m in reversed(messages)]


@router.post("", response_model=ChatMessageResponse, status_code=201)
async def send_chat_message(
    stream_id: int,
    data: ChatMessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stream = db.query(Stream).filter(Stream.id == stream_id).first()
    if not stream:
        raise HTTPException(status_code=404, detail="Stream not found")
    msg = ChatMessage(content=data.content, user_id=user.id, stream_id=stream_id)
    db.add(msg)
    db.commit()
    db.refresh(msg)
    resp = _chat_response(msg)
    await chat_manager.broadcast(stream_id, {"type": "chat_message", "message": resp})
    return resp
