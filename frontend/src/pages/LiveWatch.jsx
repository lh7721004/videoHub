import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import Hls from 'hls.js';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import { buildLiveUrl, buildWsUrl } from '../lib/urls';

function ChatMoreMenu({ messageId, user, messageUserId }) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!user || user.id === messageUserId) return null;

  const handleReport = async () => {
    const reason = prompt('신고 사유를 입력해주세요:');
    if (!reason || !reason.trim()) return;
    try {
      await api.post('/reports', { target_type: 'chat_message', target_id: messageId, reason });
      setReported(true);
    } catch (e) {
      if (e.response?.status === 400) alert('이미 신고한 메시지입니다.');
    }
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-400 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[100px]">
          <button
            onClick={handleReport}
            className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-gray-50"
          >
            {reported ? '신고됨' : '신고하기'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function LiveWatch() {
  const { id } = useParams();
  const { user } = useAuth();
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const chatEndRef = useRef(null);
  const wsRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [streamStatus, setStreamStatus] = useState('loading');
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    api.get(`/streams/${id}`).then((r) => setStream(r.data));
  }, [id]);

  // HLS player
  useEffect(() => {
    if (!stream || !videoRef.current) return;

    const hlsUrl = buildLiveUrl(`/${stream.stream_key}/index.m3u8`);

    const tryConnect = () => {
      if (Hls.isSupported()) {
        const hls = new Hls({
          liveDurationInfinity: true,
          liveBackBufferLength: 0,
          maxBufferLength: 5,
          maxMaxBufferLength: 10,
        });
        hlsRef.current = hls;
        hls.loadSource(hlsUrl);
        hls.attachMedia(videoRef.current);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStreamStatus('live');
          videoRef.current.play().catch(() => {});
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            setStreamStatus('waiting');
            hls.destroy();
            setTimeout(tryConnect, 3000);
          }
        });
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        videoRef.current.src = hlsUrl;
        videoRef.current.addEventListener('loadedmetadata', () => {
          setStreamStatus('live');
          videoRef.current.play();
        });
      }
    };

    tryConnect();

    const pollInterval = setInterval(() => {
      api.get(`/streams/${id}`).then((r) => {
        setStream(r.data);
        if (!r.data.is_live && streamStatus === 'live') setStreamStatus('ended');
      });
    }, 5000);

    return () => {
      clearInterval(pollInterval);
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, [stream?.stream_key]);

  // Chat: fetch history + WebSocket
  useEffect(() => {
    api.get(`/streams/${id}/chat`).then((r) => setMessages(r.data));

    const wsUrl = buildWsUrl(`/chat/${id}`);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'chat_message') {
        setMessages((prev) => [...prev, data.message]);
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) wsRef.current = null;
      }, 3000);
    };

    return () => ws.close();
  }, [id]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || !user) return;
    await api.post(`/streams/${id}/chat`, { content: chatInput });
    setChatInput('');
  };

  if (!stream) return <div className="text-center py-20 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex gap-4 flex-col lg:flex-row">
        {/* Video */}
        <div className="flex-1 min-w-0">
          <div className="bg-black rounded-xl overflow-hidden relative">
            <video ref={videoRef} controls className="w-full aspect-video" />
            {streamStatus === 'waiting' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <div className="text-center">
                  <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-white text-lg">Waiting for stream to start...</p>
                  <p className="text-white/50 text-sm mt-1">The streamer hasn't started broadcasting yet</p>
                </div>
              </div>
            )}
            {streamStatus === 'ended' && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                <p className="text-white text-lg">Stream has ended</p>
              </div>
            )}
            {streamStatus === 'live' && (
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-red-600 text-white text-xs font-bold rounded-md uppercase">Live</span>
              </div>
            )}
          </div>

          <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{stream.title}</h1>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{stream.username}</span>
            {stream.is_live && (
              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">LIVE</span>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="w-full lg:w-80 flex flex-col bg-gray-50 rounded-xl border border-gray-200 overflow-hidden lg:h-[calc(56.25vw*0.55+120px)] lg:max-h-[600px] h-96">
          <div className="px-4 py-3 border-b border-gray-200 bg-white">
            <h3 className="font-bold text-sm text-gray-900">Live Chat</h3>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
            {messages.map((m) => (
              <div key={m.id} className="group flex gap-2 py-1 items-start">
                <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">
                  {m.username[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-blue-600">{m.username}</span>
                  <span className="text-sm text-gray-800 ml-1.5 break-words">{m.content}</span>
                </div>
                <ChatMoreMenu messageId={m.id} user={user} messageUserId={m.user_id} />
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {user ? (
            <form onSubmit={sendMessage} className="p-3 border-t border-gray-200 bg-white flex gap-2">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Send a message..."
                maxLength={500}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          ) : (
            <div className="p-3 border-t border-gray-200 bg-white text-center text-sm text-gray-400">
              Log in to chat
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
