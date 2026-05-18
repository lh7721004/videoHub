import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { buildApiUrl } from '../lib/urls';
import CommentSection from '../components/CommentSection';

function formatViews(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatDate(str) {
  return new Date(str).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const rounded = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(rounded / 3600);
  const minutes = Math.floor((rounded % 3600) / 60);
  const secs = String(rounded % 60).padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${secs}`;
  }

  return `${minutes}:${secs}`;
}

export default function VideoDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const [video, setVideo] = useState(null);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [descOpen, setDescOpen] = useState(false);
  const [isTheater, setIsTheater] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    api.get(`/videos/${id}`).then((r) => {
      setVideo(r.data);
      setLikeCount(r.data.like_count);
    });
    if (user) {
      api.get(`/videos/${id}/like`).then((r) => {
        setLiked(r.data.liked);
        setLikeCount(r.data.like_count);
      }).catch(() => {});
    }
  }, [id, user]);

  const updateBuffered = () => {
    const player = videoRef.current;
    if (!player || !player.duration || player.buffered.length === 0) return;
    const end = player.buffered.end(player.buffered.length - 1);
    setBufferedPercent(Math.min(100, (end / player.duration) * 100));
  };

  const handleLoadedMetadata = () => {
    const player = videoRef.current;
    if (!player) return;
    setDuration(player.duration || 0);
    setVolume(player.volume);
    setIsMuted(player.muted);
    updateBuffered();
  };

  const handleTimeUpdate = () => {
    const player = videoRef.current;
    if (!player) return;
    setCurrentTime(player.currentTime);
    updateBuffered();
  };

  const togglePlay = () => {
    const player = videoRef.current;
    if (!player) return;

    if (player.paused) {
      player.play().catch(() => {});
    } else {
      player.pause();
    }
  };

  const handleSeek = (event) => {
    const player = videoRef.current;
    const nextTime = Number(event.target.value);
    if (!player) return;

    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolume = (event) => {
    const player = videoRef.current;
    const nextVolume = Number(event.target.value);
    if (!player) return;

    player.volume = nextVolume;
    player.muted = nextVolume === 0;
    setVolume(nextVolume);
    setIsMuted(nextVolume === 0);
  };

  const toggleMute = () => {
    const player = videoRef.current;
    if (!player) return;

    const nextMuted = !player.muted;
    player.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const toggleFullscreen = () => {
    const playerWrap = videoRef.current?.parentElement;
    if (!playerWrap) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      playerWrap.requestFullscreen?.();
    }
  };

  const toggleLike = async () => {
    if (!user) return alert('Please login first');
    if (liked) {
      const { data } = await api.delete(`/videos/${id}/like`);
      setLiked(data.liked);
      setLikeCount(data.like_count);
    } else {
      const { data } = await api.post(`/videos/${id}/like`);
      setLiked(data.liked);
      setLikeCount(data.like_count);
    }
  };

  if (!video) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  const progressPercent = duration ? (currentTime / duration) * 100 : 0;
  const volumePercent = (isMuted ? 0 : volume) * 100;

  return (
    <div className={isTheater ? 'w-full' : 'max-w-5xl mx-auto px-4 py-6'}>
      {/* Player */}
      <div className={`bg-black overflow-hidden ${isTheater ? 'w-full' : 'rounded-xl'}`}>
        <div className="relative group bg-black">
          <video
            ref={videoRef}
            src={video.video_url || buildApiUrl(`/videos/${video.id}/stream`)}
            autoPlay
            onLoadedMetadata={handleLoadedMetadata}
            onTimeUpdate={handleTimeUpdate}
            onProgress={updateBuffered}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onClick={togglePlay}
            className={`w-full ${isTheater ? 'max-h-[85vh]' : 'max-h-[70vh]'} mx-auto`}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-4 pt-16 opacity-100 transition-opacity duration-200 sm:px-5">
            <div className="pointer-events-auto">
              <div className="relative h-5">
                <div className="absolute left-0 right-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/20">
                  <div
                    className="h-full rounded-full bg-white/25"
                    style={{ width: `${bufferedPercent}%` }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 0}
                  step="0.1"
                  value={currentTime}
                  onChange={handleSeek}
                  className="video-progress absolute inset-x-0 top-1/2 w-full -translate-y-1/2"
                  style={{ '--progress': `${progressPercent}%` }}
                  aria-label="Seek video"
                />
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-white">
                <div className="flex min-w-0 items-center gap-3">
                  <button
                    onClick={togglePlay}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-gray-950 shadow-lg shadow-black/30 transition hover:scale-105"
                    aria-label={isPlaying ? 'Pause' : 'Play'}
                  >
                    {isPlaying ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M7 5h3.5v14H7V5Zm6.5 0H17v14h-3.5V5Z" />
                      </svg>
                    ) : (
                      <svg className="ml-0.5 h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                        <path d="M8 5v14l11-7L8 5Z" />
                      </svg>
                    )}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={toggleMute}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                      aria-label={isMuted || volume === 0 ? 'Unmute' : 'Mute'}
                    >
                      {isMuted || volume === 0 ? (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 9v6h4l5 4V5L8 9H4Zm13 1 4 4m0-4-4 4" />
                        </svg>
                      ) : (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M4 9v6h4l5 4V5L8 9H4Zm12 1.5a4 4 0 0 1 0 3M18.5 8a7 7 0 0 1 0 8" />
                        </svg>
                      )}
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={isMuted ? 0 : volume}
                      onChange={handleVolume}
                      className="video-volume hidden w-20 sm:block"
                      style={{ '--volume': `${volumePercent}%` }}
                      aria-label="Volume"
                    />
                  </div>

                  <div className="truncate text-xs font-medium tabular-nums text-white/90 sm:text-sm">
                    {formatTime(currentTime)} <span className="text-white/45">/</span> {formatTime(duration)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setIsTheater(!isTheater)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                    title={isTheater ? 'Exit theater mode' : 'Theater mode'}
                    aria-label={isTheater ? 'Exit theater mode' : 'Theater mode'}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      {isTheater ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={toggleFullscreen}
                    className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
                    aria-label="Fullscreen"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8 3H5a2 2 0 0 0-2 2v3m13-5h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3m13 5h3a2 2 0 0 0 2-2v-3" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
          {/* Theater mode toggle */}
          <button
            onClick={() => setIsTheater(!isTheater)}
            className="absolute top-3 right-3 hidden w-9 h-9 bg-black/60 hover:bg-black/80 rounded-lg items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            title={isTheater ? 'Exit theater mode' : 'Theater mode'}
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {isTheater ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div className={isTheater ? 'max-w-5xl mx-auto px-4 py-4' : 'mt-4'}>
        {/* Title */}
        <h1 className="text-xl font-bold text-gray-900 leading-snug">{video.title}</h1>

        {/* Info bar */}
        <div className="flex items-center justify-between mt-3 flex-wrap gap-3">
          {/* Channel info */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-sm font-bold text-white">
              {video.username[0].toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{video.username}</p>
              <p className="text-xs text-gray-500">
                {formatViews(video.views)} views · {formatDate(video.created_at)}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleLike}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                liked
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <svg className="w-5 h-5" fill={liked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              </svg>
              {likeCount}
            </button>
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert('Link copied!');
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
          </div>
        </div>

        {/* Description */}
        {video.description && (
          <div
            className="mt-4 bg-gray-50 hover:bg-gray-100 rounded-xl p-4 cursor-pointer transition"
            onClick={() => setDescOpen(!descOpen)}
          >
            <div className={`text-sm text-gray-700 whitespace-pre-wrap ${descOpen ? '' : 'line-clamp-2'}`}>
              {video.description}
            </div>
            {video.description.length > 100 && (
              <button className="text-sm font-medium text-gray-900 mt-2">
                {descOpen ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        {/* Comments */}
        <div className="mt-6">
          <CommentSection videoId={id} />
        </div>
      </div>
    </div>
  );
}
