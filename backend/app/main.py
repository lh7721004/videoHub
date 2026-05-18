from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pathlib import Path

from .database import engine, Base
from .routers import auth, videos, comments, likes, streams, chat, reports
from .ws import manager, chat_manager

Base.metadata.create_all(bind=engine)

app = FastAPI(title="VidFlow API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5300", "https://videohub.lkim.me"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

app.include_router(auth.router)
app.include_router(videos.router)
app.include_router(comments.router)
app.include_router(likes.router)
app.include_router(streams.router)
app.include_router(chat.router)
app.include_router(reports.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.websocket("/ws/comments/{video_id}")
async def ws_comments(websocket: WebSocket, video_id: int):
    await manager.connect(video_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(video_id, websocket)


@app.websocket("/ws/chat/{stream_id}")
async def ws_chat(websocket: WebSocket, stream_id: int):
    await chat_manager.connect(stream_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        chat_manager.disconnect(stream_id, websocket)
