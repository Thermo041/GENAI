import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'night'
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-8">Settings</h1>

        <div className="card bg-base-200 border border-base-300">
          <div className="card-body">
            <h3 className="font-semibold">Appearance</h3>
            <div className="divider my-1" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm opacity-60">Switch between dark and light mode</p>
              </div>
              <select
                className="select select-bordered select-sm"
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
              >
                <option value="night">Dark (Night)</option>
                <option value="winter">Light (Winter)</option>
              </select>
            </div>
          </div>
        </div>

        <div className="card bg-base-200 border border-base-300 mt-6">
          <div className="card-body">
            <h3 className="font-semibold">Chat</h3>
            <div className="divider my-1" />
            <p className="text-sm opacity-70">
              Answers are generated only from your uploaded documents. If information is
              not found, the assistant says so instead of guessing.
            </p>
          </div>
        </div>

        <div className="card bg-base-200 border border-error/40 mt-6">
          <div className="card-body">
            <h3 className="font-semibold text-error">Session</h3>
            <div className="divider my-1" />
            <div className="flex items-center justify-between">
              <p className="text-sm opacity-70">Sign out of this device</p>
              <button className="btn btn-error btn-outline btn-sm" onClick={handleLogout}>
                Logout
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
