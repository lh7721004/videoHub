import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../lib/api';
import { useAuth } from '../lib/AuthContext';

export default function Signup() {
  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    password_confirm: '',
    verification_code: '',
  });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const requestCode = async () => {
    setError('');
    setMessage('');
    if (!form.email) {
      setError('Enter your email first');
      return;
    }

    setSendingCode(true);
    try {
      await api.post('/auth/email-verification', { email: form.email });
      setMessage('Verification code sent. Check your email.');
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to send verification code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    if (form.password !== form.password_confirm) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/auth/signup', form);
      login(data.access_token);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.detail || 'Signup failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">Join VideoHub</h1>
        {error && <p className="text-red-500 text-sm text-center mb-4">{error}</p>}
        {message && <p className="text-green-600 text-sm text-center mb-4">{message}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              className="min-w-0 flex-1 px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
            />
            <button
              type="button"
              onClick={requestCode}
              disabled={sendingCode}
              className="shrink-0 px-4 py-3 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
            >
              {sendingCode ? 'Sending' : 'Send Code'}
            </button>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            placeholder="Email verification code"
            value={form.verification_code}
            onChange={(e) => setForm({ ...form, verification_code: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Password"
            minLength={8}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
          />
          <input
            type="password"
            placeholder="Confirm password"
            minLength={8}
            value={form.password_confirm}
            onChange={(e) => setForm({ ...form, password_confirm: e.target.value })}
            required
            className="w-full px-4 py-3 border border-gray-300 rounded-lg outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-600 hover:underline">
            Login
          </Link>
        </p>
      </div>
    </div>
  );
}
