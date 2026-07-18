import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api, { errorMessage } from '../lib/api';
import { formatBytes, formatDate, debounce } from '../lib/format';

const statusBadge = {
  ready: 'badge-success',
  processing: 'badge-warning',
  failed: 'badge-error',
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [pdfs, setPdfs] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);

  const fetchPdfs = useCallback(async (page = 1, q = '') => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/pdf', { params: { page, limit: 12, search: q } });
      setPdfs(res.data.pdfs);
      setPagination(res.data.pagination);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPdfs();
  }, [fetchPdfs]);

  // Poll while any PDF is still processing so status flips live
  useEffect(() => {
    if (!pdfs.some((p) => p.status === 'processing')) return;
    const t = setInterval(() => fetchPdfs(pagination.page, search), 4000);
    return () => clearInterval(t);
  }, [pdfs, pagination.page, search, fetchPdfs]);

  // Debounced server-side search
  const debouncedSearch = useMemo(
    () => debounce((q) => fetchPdfs(1, q), 350),
    [fetchPdfs]
  );

  const handleSearch = (e) => {
    setSearch(e.target.value);
    debouncedSearch(e.target.value);
  };

  const handleDelete = async (pdf) => {
    if (!window.confirm(`Delete "${pdf.originalName}" and all of its chats?`)) return;
    setDeleting(pdf._id);
    try {
      await api.delete(`/pdf/${pdf._id}`);
      fetchPdfs(pagination.page, search);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Your Documents</h1>
            <p className="opacity-60 text-sm mt-1">
              {pagination.total} PDF{pagination.total === 1 ? '' : 's'} uploaded
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/chat" className="btn btn-outline">💬 Chat with all</Link>
            <Link to="/upload" className="btn btn-primary">+ Upload PDF</Link>
          </div>
        </div>

        {/* Search */}
        <label className="input input-bordered flex items-center gap-2 mb-6 max-w-md">
          <svg className="w-4 h-4 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            type="text"
            className="grow"
            placeholder="Search your PDFs..."
            value={search}
            onChange={handleSearch}
          />
        </label>

        {error && <div className="alert alert-error mb-6"><span>{error}</span></div>}

        {loading ? (
          <div className="flex justify-center py-24">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        ) : pdfs.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-base-300 rounded-2xl">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold">No PDFs {search ? 'match your search' : 'yet'}</h2>
            {!search && (
              <>
                <p className="opacity-60 mt-2">Upload your first document to start chatting with it.</p>
                <Link to="/upload" className="btn btn-primary mt-6">Upload a PDF</Link>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pdfs.map((pdf) => (
                <div key={pdf._id} className="card bg-base-200 border border-base-300 hover:border-primary/40 transition-colors animate-fade-in">
                  <div className="card-body p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-semibold truncate flex-1" title={pdf.originalName}>
                        📄 {pdf.originalName}
                      </h2>
                      <span className={`badge badge-sm ${statusBadge[pdf.status]}`}>
                        {pdf.status === 'processing' && (
                          <span className="loading loading-spinner loading-xs mr-1" />
                        )}
                        {pdf.status}
                      </span>
                    </div>
                    <div className="text-xs opacity-60 space-y-0.5 mt-1">
                      <p>Uploaded {formatDate(pdf.createdAt)} · {formatBytes(pdf.size)}</p>
                      {pdf.status === 'ready' && (
                        <p>{pdf.pageCount} pages · {pdf.chunkCount} chunks indexed</p>
                      )}
                      {pdf.status === 'failed' && (
                        <p className="text-error">{pdf.processingError}</p>
                      )}
                    </div>
                    <div className="card-actions justify-end mt-3">
                      <button
                        className="btn btn-ghost btn-sm text-error"
                        disabled={deleting === pdf._id}
                        onClick={() => handleDelete(pdf)}
                      >
                        {deleting === pdf._id ? (
                          <span className="loading loading-spinner loading-xs" />
                        ) : (
                          'Delete'
                        )}
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={pdf.status !== 'ready'}
                        onClick={() => navigate('/chat', { state: { pdfId: pdf._id, pdfName: pdf.originalName } })}
                      >
                        Open Chat
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="join flex justify-center mt-8">
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    className={`join-item btn btn-sm ${p === pagination.page ? 'btn-primary' : ''}`}
                    onClick={() => fetchPdfs(p, search)}
                  >
                    {p}
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
