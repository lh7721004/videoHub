import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function GoLive() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [streamKey, setStreamKey] = useState('');
  const [title, setTitle] = useState('');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }
    api.get('/streams/my-key').then((r) => setStreamKey(r.data.stream_key));
  }, [user]);

  const saveTitle = async (e) => {
    e.preventDefault();
    await api.post('/streams/set-title', { title });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const copy = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  if (!user) return null;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-2">Go Live</h1>
      <p className="text-gray-500 mb-8">Use the stream key below in OBS Studio to start broadcasting.</p>

      <div className="bg-gray-50 rounded-xl p-6 space-y-6">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
            Server (RTMP URL)
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono">
              rtmp://localhost:1935/live
            </code>
            <button
              onClick={() => copy('rtmp://localhost:1935/live', 'server')}
              className="px-4 py-3 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
            >
              {copied === 'server' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
            Stream Key (Your permanent key)
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-white border border-gray-200 rounded-lg px-4 py-3 text-sm font-mono">
              {streamKey || '...'}
            </code>
            <button
              onClick={() => copy(streamKey, 'key')}
              className="px-4 py-3 bg-gray-200 rounded-lg text-sm hover:bg-gray-300"
            >
              {copied === 'key' ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <form onSubmit={saveTitle}>
          <label className="block text-xs font-medium text-gray-500 uppercase mb-2">
            Stream Title (optional)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="My awesome stream"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-red-500"
            />
            <button
              type="submit"
              className="px-4 py-3 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
            >
              {saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-8 bg-blue-50 rounded-xl p-6">
        <h3 className="font-bold text-blue-900 mb-3">OBS Studio Setup</h3>
        <ol className="text-sm text-blue-800 space-y-2 list-decimal list-inside">
          <li>Open OBS Studio → Settings → Stream</li>
          <li>Service: <strong>Custom...</strong></li>
          <li>Server: <strong>rtmp://localhost:1935/live</strong></li>
          <li>Stream Key: <strong>{streamKey}</strong></li>
          <li>Click "Start Streaming" — your stream will appear on the home page automatically!</li>
        </ol>
      </div>

      <div className="mt-6">
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
}
