import { useState, useRef, useEffect } from 'react';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';

function MoreMenu({ items }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600"
      >
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <circle cx="10" cy="4" r="1.5" />
          <circle cx="10" cy="10" r="1.5" />
          <circle cx="10" cy="16" r="1.5" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-10 min-w-[120px]">
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => { setOpen(false); item.onClick(); }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${item.danger ? 'text-red-600' : 'text-gray-700'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CommentItem({ comment, videoId, onDelete, onUpdate, depth = 0 }) {
  const { user } = useAuth();
  const [showReply, setShowReply] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(comment.content);
  const [likes, setLikes] = useState(comment.like_count);
  const [dislikes, setDislikes] = useState(comment.dislike_count);
  const [myReaction, setMyReaction] = useState(comment.my_reaction);
  const [replies, setReplies] = useState(comment.replies || []);
  const [collapsed, setCollapsed] = useState(false);
  const [reported, setReported] = useState(false);

  const react = async (isLike) => {
    if (!user) return;
    const { data } = await api.post(
      `/videos/${videoId}/comments/${comment.id}/reaction`,
      { is_like: isLike }
    );
    setLikes(data.like_count);
    setDislikes(data.dislike_count);
    setMyReaction(data.my_reaction);
  };

  const submitReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    const { data } = await api.post(`/videos/${videoId}/comments`, {
      content: replyText,
      parent_id: comment.id,
    });
    setReplies([...replies, data]);
    setReplyText('');
    setShowReply(false);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editText.trim()) return;
    const { data } = await api.put(`/videos/${videoId}/comments/${comment.id}`, {
      content: editText,
    });
    onUpdate(data);
    setEditing(false);
  };

  const handleDelete = async () => {
    await api.delete(`/videos/${videoId}/comments/${comment.id}`);
    onDelete(comment.id);
  };

  const handleReport = async () => {
    const reason = prompt('신고 사유를 입력해주세요:');
    if (!reason || !reason.trim()) return;
    try {
      await api.post('/reports', { target_type: 'comment', target_id: comment.id, reason });
      setReported(true);
    } catch (e) {
      if (e.response?.status === 400) alert('이미 신고한 댓글입니다.');
    }
  };

  const menuItems = [];
  if (user && user.id === comment.user_id) {
    menuItems.push({ label: '수정', onClick: () => { setEditing(true); setEditText(comment.content); } });
    menuItems.push({ label: '삭제', onClick: handleDelete, danger: true });
  }
  if (user && user.id !== comment.user_id) {
    menuItems.push({ label: reported ? '신고됨' : '신고하기', onClick: handleReport, danger: !reported });
  }

  return (
    <div className={depth > 0 ? 'ml-10 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="flex items-start gap-3 py-3">
        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0">
          {comment.username[0].toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900">{comment.username}</span>
            <span className="text-xs text-gray-400">
              {new Date(comment.created_at).toLocaleDateString()}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-gray-400 italic">(edited)</span>
            )}
          </div>

          {editing ? (
            <form onSubmit={submitEdit} className="mt-2">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:border-blue-500"
              />
              <div className="flex gap-2 mt-2">
                <button type="submit" className="text-xs text-blue-600 font-medium">Save</button>
                <button type="button" onClick={() => setEditing(false)} className="text-xs text-gray-500">Cancel</button>
              </div>
            </form>
          ) : (
            <p className="text-sm text-gray-700 mt-1">{comment.content}</p>
          )}

          <div className="flex items-center gap-4 mt-2">
            <button
              onClick={() => react(true)}
              className={`flex items-center gap-1 text-xs ${myReaction === true ? 'text-blue-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-3.5 h-3.5" fill={myReaction === true ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
              </svg>
              {likes > 0 && likes}
            </button>
            <button
              onClick={() => react(false)}
              className={`flex items-center gap-1 text-xs ${myReaction === false ? 'text-red-600 font-medium' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <svg className="w-3.5 h-3.5" fill={myReaction === false ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
              </svg>
              {dislikes > 0 && dislikes}
            </button>
            {user && depth < 2 && (
              <button onClick={() => setShowReply(!showReply)} className="text-xs text-gray-500 hover:text-gray-700 font-medium">
                Reply
              </button>
            )}
          </div>

          {showReply && (
            <form onSubmit={submitReply} className="flex gap-2 mt-3">
              <input
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-full text-sm outline-none focus:border-blue-500"
                autoFocus
              />
              <button type="submit" disabled={!replyText.trim()} className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-xs font-medium hover:bg-blue-700 disabled:opacity-50">
                Reply
              </button>
              <button type="button" onClick={() => setShowReply(false)} className="px-3 py-1.5 text-xs text-gray-500">
                Cancel
              </button>
            </form>
          )}
        </div>

        {user && menuItems.length > 0 && <MoreMenu items={menuItems} />}
      </div>

      {replies.length > 0 && (
        <div>
          {replies.length > 1 && (
            <button onClick={() => setCollapsed(!collapsed)} className="ml-11 text-xs text-blue-600 font-medium mb-1">
              {collapsed ? `Show ${replies.length} replies` : `Hide ${replies.length} replies`}
            </button>
          )}
          {!collapsed && replies.map((r) => (
            <CommentItem
              key={r.id}
              comment={r}
              videoId={videoId}
              depth={depth + 1}
              onDelete={(id) => setReplies(replies.filter((x) => x.id !== id))}
              onUpdate={(updated) => setReplies(replies.map((x) => x.id === updated.id ? { ...x, ...updated } : x))}
            />
          ))}
        </div>
      )}
    </div>
  );
}
