const NodeMediaServer = require('node-media-server');
const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8300';
const MEDIA_DIR = path.join(__dirname, 'media');
const FFMPEG_PATH = '/opt/homebrew/bin/ffmpeg';
const HLS_PORT = 8888;

const ffmpegProcesses = new Map();

// Express HLS server
const hlsApp = express();
hlsApp.use(cors());
hlsApp.use('/live', express.static(path.join(MEDIA_DIR, 'live'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.m3u8')) res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    if (filePath.endsWith('.ts')) res.setHeader('Content-Type', 'video/mp2t');
    res.setHeader('Cache-Control', 'no-cache');
  },
}));
hlsApp.listen(HLS_PORT, () => console.log(`[hls] HTTP server on port ${HLS_PORT}`));

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60,
  },
};

const nms = new NodeMediaServer(config);

function notifyBackend(event, streamKey) {
  const data = JSON.stringify({ stream_key: streamKey, event });
  const req = http.request(
    `${BACKEND_URL}/api/streams/webhook`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': data.length },
    },
    (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => console.log(`[webhook] ${event} ${streamKey} -> ${res.statusCode}`));
    }
  );
  req.on('error', (e) => console.log(`[webhook] error: ${e.message}`));
  req.write(data);
  req.end();
}

function startHlsTranscode(streamKey) {
  const outDir = path.join(MEDIA_DIR, 'live', streamKey);
  fs.mkdirSync(outDir, { recursive: true });

  const args = [
    '-i', `rtmp://127.0.0.1:1935/live/${streamKey}`,
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '3',
    '-hls_flags', 'delete_segments',
    '-hls_segment_filename', path.join(outDir, '%03d.ts'),
    path.join(outDir, 'index.m3u8'),
  ];

  console.log(`[hls] Starting transcode for ${streamKey}`);
  const proc = spawn(FFMPEG_PATH, args, { stdio: ['ignore', 'ignore', 'pipe'] });

  proc.stderr.on('data', (data) => {
    const msg = data.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      console.log(`[hls] ffmpeg: ${msg.trim()}`);
    }
  });

  proc.on('close', (code) => {
    console.log(`[hls] ffmpeg exited with code ${code} for ${streamKey}`);
    ffmpegProcesses.delete(streamKey);
  });

  ffmpegProcesses.set(streamKey, proc);
}

function stopHlsTranscode(streamKey) {
  const proc = ffmpegProcesses.get(streamKey);
  if (proc) {
    console.log(`[hls] Stopping transcode for ${streamKey}`);
    proc.kill('SIGTERM');
    ffmpegProcesses.delete(streamKey);
  }
}

nms.on('prePublish', (session) => {
  const streamKey = session.streamName || session.streamPath?.split('/').pop();
  console.log(`[stream] prePublish: ${streamKey}`);
  if (streamKey) {
    notifyBackend('live', streamKey);
    setTimeout(() => startHlsTranscode(streamKey), 1000);
  }
});

nms.on('donePublish', (session) => {
  const streamKey = session.streamName || session.streamPath?.split('/').pop();
  console.log(`[stream] donePublish: ${streamKey}`);
  if (streamKey) {
    stopHlsTranscode(streamKey);
    notifyBackend('done', streamKey);
  }
});

nms.run();

console.log(`
============================================
  RTMP Streaming Server Started
============================================
  RTMP URL : rtmp://0.0.0.0:1935/live
  HLS URL  : http://0.0.0.0:${HLS_PORT}/live/{key}/index.m3u8
============================================
  OBS Settings:
    Server   : rtmp://<your-server>:1935/live
    Stream Key: (from VideoHub app)
============================================
`);
