import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 px-4">
      <div className="card w-full max-w-md bg-base-100 shadow-xl border border-base-300">
        <div className="card-body">
          <Link to="/" className="text-center text-2xl font-bold mb-2">
            <span className="text-primary">📄 DocuChat</span> AI
          </Link>
          <h1 className="text-xl font-semibold text-center">Welcome back</h1>

          {error && (
            <div className="alert alert-error text-sm py-2 mt-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <label className="form-control">
              <span className="label-text mb-1">Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                className="input input-bordered w-full"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                className="input input-bordered w-full"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-primary w-full mt-2">
              {busy ? <span className="loading loading-spinner loading-sm" /> : 'Login'}
            </button>
          </form>

          <p className="text-center text-sm mt-4 opacity-70">
            No account yet?{' '}
            <Link to="/register" className="link link-primary">Create one</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
