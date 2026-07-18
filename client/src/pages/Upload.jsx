import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import api, { errorMessage } from '../lib/api';
import { formatBytes } from '../lib/format';

const MAX_SIZE_MB = 20;

export default function Upload() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const pickFile = (f) => {
    setError('');
    if (!f) return;
    if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
      return setError('Only PDF files are allowed');
    }
    if (f.size > MAX_SIZE_MB * 1024 * 1024) {
      return setError(`File too large — maximum size is ${MAX_SIZE_MB} MB`);
    }
    setFile(f);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    pickFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    setProgress(0);

    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post('/pdf/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (e.total) setProgress(Math.round((e.loaded / e.total) * 100));
        },
      });
      navigate('/dashboard');
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-base-100">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-3xl font-bold mb-2">Upload a PDF</h1>
        <p className="opacity-60 text-sm mb-8">
          Your document is stored securely and indexed so you can chat with it.
        </p>

        {error && <div className="alert alert-error mb-6"><span>{error}</span></div>}

        {/* Dropzone */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-colors
            ${dragOver ? 'border-primary bg-primary/5' : 'border-base-300 hover:border-primary/50'}`}
        >
          <div className="text-5xl mb-4">{file ? '📄' : '📤'}</div>
          {file ? (
            <>
              <p className="font-semibold">{file.name}</p>
              <p className="text-sm opacity-60 mt-1">{formatBytes(file.size)}</p>
              <button
                className="btn btn-ghost btn-xs mt-3"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
              >
                Choose a different file
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold">Drag &amp; drop your PDF here</p>
              <p className="text-sm opacity-60 mt-1">or click to browse · max {MAX_SIZE_MB} MB</p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,.pdf"
            className="hidden"
            onChange={(e) => pickFile(e.target.files[0])}
          />
        </div>

        {busy && (
          <div className="mt-6">
            <progress className="progress progress-primary w-full" value={progress} max="100" />
            <p className="text-center text-sm opacity-60 mt-2">
              {progress < 100 ? `Uploading… ${progress}%` : 'Processing on server…'}
            </p>
          </div>
        )}

        <button
          className="btn btn-primary w-full mt-8"
          disabled={!file || busy}
          onClick={handleUpload}
        >
          {busy ? <span className="loading loading-spinner loading-sm" /> : 'Upload & Index'}
        </button>

        <div className="alert mt-8 text-sm">
          <span>
            ℹ️ After upload, the PDF is parsed, chunked, embedded and indexed. This takes a
            few seconds — its status on the dashboard flips to <b>ready</b> when you can chat.
          </span>
        </div>
      </main>
    </div>
  );
}
