import { useEffect, useState, useRef } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';
import CommentItem from './CommentItem';

export default function CommentSection({ videoId }) {
  const { user } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const wsRef = useRef(null);

  const fetchComments = () => {
    api.get(`/videos/${videoId}/comments`).then((r) => setComments(r.data));
  };

  useEffect(() => {
    fetchComments();
  }, [videoId]);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.location.host;
    const wsUrl = `${protocol}//${wsHost}/ws/comments/${videoId}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'new_comment') {
        const c = data.comment;
        if (c.parent_id) {
          setComments((prev) =>
            prev.map((p) =>
              p.id === c.parent_id
                ? { ...p, replies: [...(p.replies || []), c] }
                : p
            )
          );
        } else {
          setComments((prev) => [c, ...prev]);
        }
      } else if (data.type === 'update_comment') {
        const c = data.comment;
        setComments((prev) =>
          prev.map((p) =>
            p.id === c.id
              ? { ...p, content: c.content, is_edited: c.is_edited }
              : {
                  ...p,
                  replies: (p.replies || []).map((r) =>
                    r.id === c.id ? { ...r, content: c.content, is_edited: c.is_edited } : r
                  ),
                }
          )
        );
      } else if (data.type === 'delete_comment') {
        const id = data.comment_id;
        setComments((prev) =>
          prev
            .filter((p) => p.id !== id)
            .map((p) => ({
              ...p,
              replies: (p.replies || []).filter((r) => r.id !== id),
            }))
        );
      }
    };

    ws.onclose = () => {
      setTimeout(() => {
        if (wsRef.current === ws) {
          wsRef.current = null;
        }
      }, 3000);
    };

    return () => ws.close();
  }, [videoId]);

  const postComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim() || !user) return;
    await api.post(`/videos/${videoId}/comments`, { content: newComment });
    setNewComment('');
  };

  const totalCount = comments.reduce(
    (acc, c) => acc + 1 + (c.replies?.length || 0),
    0
  );

  return (
    <div className="mb-6">
      <h2 className="text-lg font-bold mb-4">{totalCount} Comments</h2>

      {user && (
        <form onSubmit={postComment} className="flex gap-2 mb-6">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
            {user.username[0].toUpperCase()}
          </div>
          <input
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-full outline-none focus:border-blue-500 text-sm"
          />
          <button
            type="submit"
            disabled={!newComment.trim()}
            className="px-5 py-2 bg-blue-600 text-white rounded-full text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            Post
          </button>
        </form>
      )}

      <div>
        {comments.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            videoId={videoId}
            onDelete={(id) => setComments(comments.filter((x) => x.id !== id))}
            onUpdate={(updated) =>
              setComments(comments.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)))
            }
          />
        ))}
      </div>
    </div>
  );
}
