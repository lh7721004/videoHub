import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function Upload() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  if (!user) {
    navigate('/login');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setUploading(true);
    setProgress(0);
    try {
      const { data: presign } = await api.post('/videos/presign', {
        filename: file.name,
        content_type: file.type || 'video/mp4',
      });

      await axios.put(presign.upload_url, file, {
        headers: { 'Content-Type': file.type || 'video/mp4' },
        onUploadProgress: (p) => {
          if (p.total) setProgress(Math.round((p.loaded / p.total) * 90));
        },
      });

      setProgress(95);
      const { data } = await api.post('/videos/complete', {
        title,
        description,
        object_key: presign.object_key,
        content_type: file.type || 'video/mp4',
      });
      setProgress(100);
      navigate(`/videos/${data.id}`);
    } catch (err) {
      alert(err.response?.data?.detail || 'Upload failed');
    }
    setUploading(false);
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">Upload Video</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="text"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
        />
        <textarea
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500 resize-none"
        />
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
          {file ? (
            <div>
              <p className="text-sm text-gray-700">{file.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </p>
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-xs text-red-500 mt-2"
              >
                Remove
              </button>
            </div>
          ) : (
            <label className="cursor-pointer">
              <p className="text-gray-400 mb-2">Click to select a video file</p>
              <input
                type="file"
                accept="video/*"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
              />
              <span className="px-4 py-2 bg-gray-100 rounded-lg text-sm text-gray-600 hover:bg-gray-200">
                Choose File
              </span>
            </label>
          )}
        </div>
        {uploading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}
        <button
          type="submit"
          disabled={uploading || !file}
          className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
        >
          {uploading ? `Uploading ${progress}%...` : 'Upload'}
        </button>
      </form>
    </div>
  );
}
