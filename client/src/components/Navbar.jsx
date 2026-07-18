import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/** Top navigation bar for authenticated pages. */
export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="navbar bg-base-200/80 backdrop-blur sticky top-0 z-30 border-b border-base-300">
      <div className="flex-1">
        <Link to="/dashboard" className="btn btn-ghost text-xl font-bold">
          <span className="text-primary">📄 DocuChat</span> AI
        </Link>
      </div>
      <div className="flex-none gap-1 hidden sm:flex">
        <NavLink to="/dashboard" className={({ isActive }) => `btn btn-ghost btn-sm ${isActive ? 'btn-active' : ''}`}>
          Dashboard
        </NavLink>
        <NavLink to="/upload" className={({ isActive }) => `btn btn-ghost btn-sm ${isActive ? 'btn-active' : ''}`}>
          Upload
        </NavLink>
        <NavLink to="/chat" className={({ isActive }) => `btn btn-ghost btn-sm ${isActive ? 'btn-active' : ''}`}>
          Chat
        </NavLink>
      </div>
      <div className="flex-none">
        <div className="dropdown dropdown-end">
          <label tabIndex={0} className="btn btn-ghost btn-circle avatar placeholder">
            <div className="bg-primary text-primary-content rounded-full w-9">
              <span className="text-sm font-bold">
                {user?.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
          </label>
          <ul tabIndex={0} className="dropdown-content menu bg-base-200 rounded-box z-40 mt-3 w-52 p-2 shadow-lg border border-base-300">
            <li className="menu-title truncate">{user?.email}</li>
            <li><Link to="/dashboard">Dashboard</Link></li>
            <li><Link to="/upload">Upload PDF</Link></li>
            <li><Link to="/chat">Chat</Link></li>
            <li><Link to="/profile">Profile</Link></li>
            <li><Link to="/settings">Settings</Link></li>
            <li><button onClick={handleLogout} className="text-error">Logout</button></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
