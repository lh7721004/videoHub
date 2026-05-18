import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function formatViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K views`;
  return `${n} views`;
}

export default function VideoCard({ video }) {
  const videoRef = useRef(null);
  const [hovering, setHovering] = useState(false);
  const timerRef = useRef(null);

  const handleEnter = () => {
    timerRef.current = setTimeout(() => {
      setHovering(true);
      videoRef.current?.play().catch(() => {});
    }, 500);
  };

  const handleLeave = () => {
    clearTimeout(timerRef.current);
    setHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <Link
      to={`/videos/${video.id}`}
      className="group block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden mb-3 relative shadow-sm group-hover:shadow-lg transition-shadow">
        <video
          ref={videoRef}
          src={video.video_url || `/uploads/${video.filename}`}
          className="w-full h-full object-cover"
          preload="metadata"
          muted
          loop
          playsInline
        />
        {hovering && (
          <div className="absolute inset-0 ring-2 ring-blue-500 rounded-xl pointer-events-none" />
        )}
      </div>
      <div className="flex gap-3">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
          {video.username[0].toUpperCase()}
        </div>
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 line-clamp-2 text-sm leading-snug group-hover:text-blue-600 transition-colors">
            {video.title}
          </h3>
          <p className="text-xs text-gray-500 mt-1">{video.username}</p>
          <p className="text-xs text-gray-500">
            {formatViews(video.views)} · {timeAgo(video.created_at)}
          </p>
        </div>
      </div>
    </Link>
  );
}
