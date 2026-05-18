from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    password_confirm: str
    verification_code: str


class EmailVerificationRequest(BaseModel):
    email: EmailStr


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    username: str
    stream_key: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class VideoCreate(BaseModel):
    title: str
    description: str = ""


class VideoPresignRequest(BaseModel):
    filename: str
    content_type: str


class VideoPresignResponse(BaseModel):
    upload_url: str
    object_key: str
    video_url: str
    expires_in: int


class VideoCompleteRequest(BaseModel):
    title: str
    description: str = ""
    object_key: str
    content_type: str


class VideoResponse(BaseModel):
    id: int
    title: str
    description: str
    filename: str
    thumbnail_url: str
    video_url: str
    views: int
    user_id: int
    username: str
    created_at: datetime
    like_count: int = 0
    comment_count: int = 0

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content: str
    parent_id: Optional[int] = None


class CommentUpdate(BaseModel):
    content: str


class CommentResponse(BaseModel):
    id: int
    content: str
    user_id: int
    username: str
    video_id: int
    parent_id: Optional[int] = None
    is_edited: bool = False
    like_count: int = 0
    dislike_count: int = 0
    my_reaction: Optional[bool] = None
    replies: list["CommentResponse"] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ReactionRequest(BaseModel):
    is_like: bool


class ReactionResponse(BaseModel):
    like_count: int
    dislike_count: int
    my_reaction: Optional[bool] = None


class LikeResponse(BaseModel):
    liked: bool
    like_count: int


class StreamCreate(BaseModel):
    title: str


class StreamResponse(BaseModel):
    id: int
    title: str
    user_id: int
    username: str
    stream_key: Optional[str] = None
    is_live: bool
    started_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class StreamWebhook(BaseModel):
    stream_key: str
    event: str


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    content: str
    user_id: int
    username: str
    stream_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ReportCreate(BaseModel):
    target_type: str
    target_id: int
    reason: str


class ReportResponse(BaseModel):
    id: int
    target_type: str
    target_id: int
    reason: str
    created_at: datetime

    model_config = {"from_attributes": True}
