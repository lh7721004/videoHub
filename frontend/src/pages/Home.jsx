import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import VideoCard from '../components/VideoCard';

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [liveStreams, setLiveStreams] = useState([]);

  useEffect(() => {
    api.get('/videos').then((r) => setVideos(r.data));
    api.get('/streams?live_only=true').then((r) => setLiveStreams(r.data));
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {liveStreams.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
            Live Now
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {liveStreams.map((s) => (
              <Link
                key={s.id}
                to={`/live/${s.id}`}
                className="group block bg-gray-900 rounded-xl overflow-hidden"
              >
                <div className="aspect-video flex items-center justify-center relative">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:scale-110 transition">
                      <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                    <p className="text-white/70 text-sm">Watch Live</p>
                  </div>
                  <span className="absolute top-3 left-3 px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded">
                    LIVE
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-white font-medium text-sm truncate">{s.title}</h3>
                  <p className="text-gray-400 text-xs mt-1">{s.username}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {videos.length > 0 && (
        <h2 className="text-lg font-bold mb-4">Videos</h2>
      )}

      {videos.length === 0 && liveStreams.length === 0 ? (
        <p className="text-center text-gray-400 mt-20">No videos yet. Upload one!</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} />
          ))}
        </div>
      )}
    </div>
  );
}
