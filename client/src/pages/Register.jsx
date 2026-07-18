import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../lib/api';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (form.password.length < 8) {
      return setError('Password must be at least 8 characters');
    }
    if (form.password !== form.confirm) {
      return setError('Passwords do not match');
    }

    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
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
          <h1 className="text-xl font-semibold text-center">Create your account</h1>

          {error && (
            <div className="alert alert-error text-sm py-2 mt-2">
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <label className="form-control">
              <span className="label-text mb-1">Name</span>
              <input
                type="text"
                required
                maxLength={80}
                autoComplete="name"
                className="input input-bordered w-full"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
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
                minLength={8}
                autoComplete="new-password"
                className="input input-bordered w-full"
                placeholder="Min. 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </label>
            <label className="form-control">
              <span className="label-text mb-1">Confirm password</span>
              <input
                type="password"
                required
                autoComplete="new-password"
                className="input input-bordered w-full"
                placeholder="Repeat password"
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              />
            </label>
            <button type="submit" disabled={busy} className="btn btn-primary w-full mt-2">
              {busy ? <span className="loading loading-spinner loading-sm" /> : 'Create account'}
            </button>
          </form>

          <p className="text-center text-sm mt-4 opacity-70">
            Already have an account?{' '}
            <Link to="/login" className="link link-primary">Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
