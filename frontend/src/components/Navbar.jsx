import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../lib/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (keyword.trim()) navigate(`/search?q=${encodeURIComponent(keyword.trim())}`);
  };

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center gap-4">
        <Link to="/" className="text-xl font-bold text-red-600 shrink-0">
          VideoHub
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
          <div className="flex">
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder="Search videos..."
              className="w-full px-4 py-2 border border-gray-300 rounded-l-full outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="px-5 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-full hover:bg-gray-200"
            >
              Search
            </button>
          </div>
        </form>

        <div className="flex items-center gap-3 shrink-0">
          {user ? (
            <>
              <Link
                to="/go-live"
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Go Live
              </Link>
              <Link
                to="/upload"
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900"
              >
                Upload
              </Link>
              <span className="text-sm text-gray-600">{user.username}</span>
              <button
                onClick={logout}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Logout
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
