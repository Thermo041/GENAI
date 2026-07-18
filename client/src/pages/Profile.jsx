import Navbar from '../components/Navbar';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-8">Profile</h1>

        <div className="card bg-base-200 border border-base-300">
          <div className="card-body items-center text-center">
            <div className="avatar placeholder mb-2">
              <div className="bg-primary text-primary-content rounded-full w-24">
                <span className="text-4xl font-bold">
                  {user?.name?.charAt(0)?.toUpperCase()}
                </span>
              </div>
            </div>
            <h2 className="text-2xl font-bold">{user?.name}</h2>
            <p className="opacity-60">{user?.email}</p>
            <div className="badge badge-outline mt-2">
              Member since {user?.createdAt ? formatDate(user.createdAt) : '—'}
            </div>
          </div>
        </div>

        <div className="card bg-base-200 border border-base-300 mt-6">
          <div className="card-body">
            <h3 className="font-semibold">Account details</h3>
            <div className="divider my-1" />
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="opacity-60">Name</dt>
                <dd className="font-medium">{user?.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">Email</dt>
                <dd className="font-medium">{user?.email}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="opacity-60">User ID</dt>
                <dd className="font-mono text-xs">{user?._id}</dd>
              </div>
            </dl>
          </div>
        </div>
      </main>
    </div>
  );
}
