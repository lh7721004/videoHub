# VideoHub AWS Console Setup Guide

This guide deploys VideoHub with a low-cost MVP architecture:

- Frontend: S3 + CloudFront
- Backend: EC2 + FastAPI
- Database: RDS MySQL
- Video storage: S3
- Video delivery: CloudFront + S3 Origin Access Control
- Email verification: existing Brevo SMTP settings
- Optional live streaming: Amazon IVS

Use `ap-northeast-2` for regional services unless noted. CloudFront certificates in ACM must be created in `us-east-1`.

## 1. Cost Guardrails

Open AWS Console -> Billing and Cost Management -> Budgets -> Create budget.

Recommended settings:

- Budget type: Cost budget
- Period: Monthly
- Amount: 20 USD for the first month, then adjust
- Alerts:
  - 50 percent actual
  - 80 percent actual
  - 100 percent forecasted
- Email recipients: your email

Also enable Cost Anomaly Detection.

Avoid these for the MVP:

- NAT Gateway
- Multi-AZ RDS
- Large EC2 instances
- Always-on MediaConvert or MediaLive workflows
- Long CloudWatch log retention

## 2. RDS MySQL

Open RDS -> Create database.

Settings:

- Engine: MySQL
- Template: Free tier or Dev/Test
- DB instance identifier: `videohub-db`
- Master username: `admin` or another non-root user
- DB instance class: `db.t4g.micro`
- Storage: 20 GiB gp3
- Storage autoscaling: off or low max
- Multi-AZ: off for MVP
- Public access: preferably No if EC2 is in the same VPC
- Initial database name: `videohub`
- Backup retention: 1 to 3 days

Security group:

- Allow inbound MySQL `3306` only from the EC2 backend security group.

Backend environment:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@RDS_ENDPOINT:3306/videohub?charset=utf8mb4
```

Migrate data from local SQLite/MySQL before final cutover, or run the backend once to create tables.

## 3. S3 Video Bucket

Open S3 -> Create bucket.

Settings:

- Bucket name: `videohub-videos-prod`
- Region: `ap-northeast-2`
- Block all public access: On
- Object Ownership: ACLs disabled
- Versioning: Off for MVP
- Default encryption: SSE-S3

CORS configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://app.lkim.me",
      "https://videohub.lkim.me"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3000
  }
]
```

Do not make this bucket public. CloudFront should be the only public read path.

## 4. CloudFront for Video

Open CloudFront -> Create distribution.

Settings:

- Origin domain: select `videohub-videos-prod` S3 bucket
- Origin access: Origin access control settings
- Create a new OAC
- Viewer protocol policy: Redirect HTTP to HTTPS
- Allowed methods: GET, HEAD, OPTIONS
- Cache policy: CachingOptimized
- Alternate domain name: `video.lkim.me`
- Certificate: ACM certificate in `us-east-1`

After creating the distribution, apply the generated bucket policy to the S3 video bucket.

Backend environment:

```env
AWS_REGION=ap-northeast-2
S3_VIDEO_BUCKET=videohub-videos-prod
S3_VIDEO_PREFIX=videos
VIDEO_CDN_BASE_URL=https://video.lkim.me
PRESIGNED_UPLOAD_EXPIRES_SECONDS=900
```

## 5. IAM for Backend EC2

Create IAM role for EC2:

- IAM -> Roles -> Create role
- Trusted entity: AWS service
- Use case: EC2
- Attach least-privilege S3 policy for the video bucket

Example policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject"
      ],
      "Resource": "arn:aws:s3:::videohub-videos-prod/videos/*"
    }
  ]
}
```

Attach this role to the backend EC2 instance. Prefer IAM role credentials over static AWS keys.

## 6. S3 Frontend Bucket

Open S3 -> Create bucket.

Settings:

- Bucket name: `videohub-frontend-prod`
- Block all public access: On
- Object Ownership: ACLs disabled
- Default encryption: SSE-S3

Build and upload:

```bash
cd frontend
npm run build
aws s3 sync dist/ s3://videohub-frontend-prod --delete
```

## 7. CloudFront for Frontend

Open CloudFront -> Create distribution.

Settings:

- Origin: `videohub-frontend-prod` S3 bucket
- Origin access: OAC
- Viewer protocol policy: Redirect HTTP to HTTPS
- Allowed methods: GET, HEAD, OPTIONS
- Default root object: `index.html`
- Alternate domain name: `app.lkim.me`
- Certificate: ACM certificate in `us-east-1`

Custom error responses for React Router:

- 403 -> `/index.html`, response code 200
- 404 -> `/index.html`, response code 200

## 8. EC2 Backend

Open EC2 -> Launch instance.

Settings:

- Name: `videohub-backend`
- AMI: Ubuntu 22.04 LTS
- Instance type: `t3.micro`
- Storage: 20 GiB gp3
- IAM role: backend S3 role from section 5
- Security group:
  - SSH 22 from your IP only
  - HTTP 80 from anywhere
  - HTTPS 443 from anywhere
  - Do not expose port 8300 publicly if using Nginx

Install runtime:

```bash
sudo apt update
sudo apt install -y python3-venv python3-pip nginx
```

Backend env file should include:

```env
DATABASE_URL=mysql+pymysql://USER:PASSWORD@RDS_ENDPOINT:3306/videohub?charset=utf8mb4
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=lkim@lkim.me
SMTP_DISPLAY_NAME=lkim
SMTP_USE_TLS=true
MAX_VERIFICATION_EMAILS_PER_HOUR=100
AWS_REGION=ap-northeast-2
S3_VIDEO_BUCKET=videohub-videos-prod
S3_VIDEO_PREFIX=videos
VIDEO_CDN_BASE_URL=https://video.lkim.me
PRESIGNED_UPLOAD_EXPIRES_SECONDS=900
```

Run backend:

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8300
```

For production, run this with systemd.

## 9. Nginx for API

Create `/etc/nginx/sites-available/videohub-api`:

```nginx
server {
    listen 80;
    server_name api.lkim.me;

    client_max_body_size 10m;

    location / {
        proxy_pass http://127.0.0.1:8300;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /ws/ {
        proxy_pass http://127.0.0.1:8300;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

Enable:

```bash
sudo ln -s /etc/nginx/sites-available/videohub-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Add HTTPS with Certbot or use an ALB + ACM if you accept the extra cost.

## 10. Route 53

Open Route 53 -> Hosted zones -> `lkim.me`.

Records:

- `app.lkim.me` -> CloudFront frontend distribution alias
- `video.lkim.me` -> CloudFront video distribution alias
- `api.lkim.me` -> EC2 Elastic IP or ALB

Use Elastic IP for EC2 so the API DNS target does not change after restart.

## 11. Frontend Runtime Configuration

For split domains:

```text
https://videohub.lkim.me      -> frontend
https://api.videohub.lkim.me  -> backend
```

Create `frontend/.env.production` before building:

```env
VITE_API_BASE_URL=https://api.videohub.lkim.me/api
VITE_WS_BASE_URL=wss://api.videohub.lkim.me/ws
VITE_LIVE_BASE_URL=https://api.videohub.lkim.me/live
```

Then build:

```bash
cd frontend
npm run build
```

If you later route `/api/*` and `/ws/*` through the same CloudFront distribution as the frontend, you can remove these production env values and use relative paths again.

## 12. Email Verification

VideoHub uses SMTP for signup verification.

Current expected env:

```env
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_FROM=lkim@lkim.me
SMTP_DISPLAY_NAME=lkim
SMTP_USE_TLS=true
MAX_VERIFICATION_EMAILS_PER_HOUR=100
```

Cost controls:

- Keep `MAX_VERIFICATION_EMAILS_PER_HOUR` low at first.
- Add CloudWatch alarm on backend 4xx/5xx if using ALB later.
- Use Brevo dashboard sending limits.

## 13. Optional Amazon IVS

For live streaming, prefer Amazon IVS instead of running your own RTMP server on EC2.

Console:

- Amazon IVS -> Create channel
- Channel type: Basic for MVP
- Recording: Off initially
- Save:
  - Ingest server
  - Stream key
  - Playback URL

Security:

- Stream key should only be visible to the broadcaster.
- Playback URL can be stored for viewers.

Cost control:

- Do not leave streams running.
- Test with one channel and short sessions.

## 14. CloudWatch Logs

For MVP:

- Keep log groups retention at 7 days.
- Do not ingest verbose request bodies.
- Add alarms later for EC2 CPU, RDS CPU, and RDS free storage.

## 15. Deployment Checklist

- [ ] AWS Budget created
- [ ] RDS `videohub` created
- [ ] S3 video bucket created and private
- [ ] S3 video CORS configured
- [ ] CloudFront video distribution created with OAC
- [ ] EC2 IAM role can put objects into S3 video bucket
- [ ] Backend env has S3 and RDS settings
- [ ] Backend health check works
- [ ] Frontend build uploaded to S3
- [ ] CloudFront frontend has SPA error responses
- [ ] Route 53 records created
- [ ] Signup email test works
- [ ] Video upload test works
- [ ] Video playback uses `https://video.lkim.me/...`
