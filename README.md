# VidFlow

VidFlow is a YouTube-style video platform MVP built with React, FastAPI, MySQL, S3-ready video uploads, comments, likes, search, live-stream metadata, and WebSocket chat.

## Stack

- Frontend: React, Vite, Tailwind CSS
- Backend: FastAPI, SQLAlchemy, MySQL
- Video storage: Local fallback in development, S3 presigned upload support for AWS
- Email: SMTP-based signup verification
- Streaming: Local HLS/RTMP service for development, Amazon IVS recommended for AWS

## Local Development

Backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8300
```

Frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server is configured to use port `5300` and proxy API requests to backend port `8300`.

For a split-domain deployment such as `https://videohub.lkim.me` for frontend and `https://api.videohub.lkim.me` for backend, copy `frontend/.env.production.example` to `frontend/.env.production` before building.

## Environment

Use `backend/.env.example` as the template. Never commit `backend/.env`; it contains database and SMTP secrets.

Important settings:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@HOST:3306/videohub?charset=utf8mb4
SECRET_KEY=replace-with-a-long-random-secret
SMTP_HOST=smtp-relay.brevo.com
SMTP_FROM=lkim@lkim.me
S3_VIDEO_BUCKET=videohub-videos-prod
VIDEO_CDN_BASE_URL=https://video.example.com
```

## AWS Deployment

See [docs/aws-console-setup.md](docs/aws-console-setup.md) for the AWS Console setup guide, including:

- Budgets and cost guardrails
- RDS MySQL
- S3 video bucket
- CloudFront with Origin Access Control
- EC2 backend
- Route 53
- SMTP email verification
- Optional Amazon IVS live streaming

## Safety Notes

- Keep `.env`, database files, uploaded videos, and build outputs out of Git.
- Use S3 presigned uploads in production so large video files do not pass through the backend server.
- Keep signup email verification rate limits enabled before public deployment.
