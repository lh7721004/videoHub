from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User, Video, Comment, CommentReaction
from ..schemas import CommentCreate, CommentUpdate, CommentResponse, ReactionRequest, ReactionResponse
from ..auth import get_current_user, get_optional_user
from ..ws import manager

router = APIRouter(prefix="/api/videos/{video_id}/comments", tags=["comments"])


def _reaction_counts(comment_id: int, db: Session):
    likes = db.query(func.count(CommentReaction.id)).filter(
        CommentReaction.comment_id == comment_id, CommentReaction.is_like == True
    ).scalar()
    dislikes = db.query(func.count(CommentReaction.id)).filter(
        CommentReaction.comment_id == comment_id, CommentReaction.is_like == False
    ).scalar()
    return likes, dislikes


def _comment_response(comment: Comment, db: Session, current_user_id: Optional[int] = None) -> dict:
    likes, dislikes = _reaction_counts(comment.id, db)
    my_reaction = None
    if current_user_id:
        r = db.query(CommentReaction).filter(
            CommentReaction.comment_id == comment.id,
            CommentReaction.user_id == current_user_id,
        ).first()
        if r:
            my_reaction = r.is_like

    replies_data = []
    for reply in sorted(comment.replies, key=lambda r: r.created_at):
        replies_data.append(_comment_response(reply, db, current_user_id))

    return {
        "id": comment.id,
        "content": comment.content,
        "user_id": comment.user_id,
        "username": comment.user.username,
        "video_id": comment.video_id,
        "parent_id": comment.parent_id,
        "is_edited": comment.is_edited,
        "like_count": likes,
        "dislike_count": dislikes,
        "my_reaction": my_reaction,
        "replies": replies_data,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


@router.post("", response_model=CommentResponse, status_code=status.HTTP_201_CREATED)
async def create_comment(
    video_id: int,
    data: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not db.query(Video).filter(Video.id == video_id).first():
        raise HTTPException(status_code=404, detail="Video not found")
    if data.parent_id:
        parent = db.query(Comment).filter(
            Comment.id == data.parent_id, Comment.video_id == video_id
        ).first()
        if not parent:
            raise HTTPException(status_code=404, detail="Parent comment not found")
    comment = Comment(
        content=data.content, user_id=user.id, video_id=video_id, parent_id=data.parent_id
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    resp = _comment_response(comment, db, user.id)
    await manager.broadcast(video_id, {"type": "new_comment", "comment": resp})
    return resp


@router.get("", response_model=list[CommentResponse])
def list_comments(
    video_id: int,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    comments = (
        db.query(Comment)
        .filter(Comment.video_id == video_id, Comment.parent_id == None)
        .order_by(Comment.created_at.desc())
        .all()
    )
    uid = user.id if user else None
    return [_comment_response(c, db, uid) for c in comments]


@router.put("/{comment_id}", response_model=CommentResponse)
async def update_comment(
    video_id: int,
    comment_id: int,
    data: CommentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.video_id == video_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    comment.content = data.content
    comment.is_edited = True
    db.commit()
    db.refresh(comment)
    resp = _comment_response(comment, db, user.id)
    await manager.broadcast(video_id, {"type": "update_comment", "comment": resp})
    return resp


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    video_id: int,
    comment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.video_id == video_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != user.id:
        raise HTTPException(status_code=403, detail="Not your comment")
    db.delete(comment)
    db.commit()
    await manager.broadcast(video_id, {"type": "delete_comment", "comment_id": comment_id})


@router.post("/{comment_id}/reaction", response_model=ReactionResponse)
def react_comment(
    video_id: int,
    comment_id: int,
    data: ReactionRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    comment = db.query(Comment).filter(Comment.id == comment_id, Comment.video_id == video_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    existing = db.query(CommentReaction).filter(
        CommentReaction.user_id == user.id, CommentReaction.comment_id == comment_id
    ).first()
    if existing:
        if existing.is_like == data.is_like:
            db.delete(existing)
        else:
            existing.is_like = data.is_like
    else:
        db.add(CommentReaction(user_id=user.id, comment_id=comment_id, is_like=data.is_like))
    db.commit()

    likes, dislikes = _reaction_counts(comment_id, db)
    r = db.query(CommentReaction).filter(
        CommentReaction.user_id == user.id, CommentReaction.comment_id == comment_id
    ).first()
    return ReactionResponse(like_count=likes, dislike_count=dislikes, my_reaction=r.is_like if r else None)
