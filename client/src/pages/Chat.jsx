import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import ChatMessage from '../components/ChatMessage';
import TypingIndicator from '../components/TypingIndicator';
import api, { errorMessage } from '../lib/api';
import { streamChat } from '../lib/streamChat';

export default function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  // pdfId passed from the dashboard "Open Chat" button (new chat scoped to one PDF)
  const scopedPdf = location.state || {};

  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChat, setActiveChat] = useState(null);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [waiting, setWaiting] = useState(false); // before first token
  const [error, setError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');

  const bottomRef = useRef(null);
  const abortRef = useRef(null);
  const renameBusyRef = useRef(false);

  /* ---------- data loading ---------- */

  const loadChats = useCallback(async () => {
    try {
      const res = await api.get('/chat');
      setChats(res.data.chats);
    } catch {
      /* sidebar list is non-critical */
    }
  }, []);

  useEffect(() => {
    loadChats();
  }, [loadChats]);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setActiveChat(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/chat/${chatId}`);
        if (cancelled) return;
        setActiveChat(res.data.chat);
        setMessages(
          res.data.messages.map((m) => ({
            role: m.role,
            content: m.content,
            sources: m.sources,
          }))
        );
      } catch (err) {
        if (!cancelled) {
          setError(errorMessage(err));
          navigate('/chat', { replace: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chatId, navigate]);

  /* ---------- auto-scroll ---------- */

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, waiting]);

  /* ---------- send / stream ---------- */

  const handleSend = async (e) => {
    e?.preventDefault();
    const question = input.trim();
    if (!question || streaming) return;

    setError('');
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: question }]);
    setStreaming(true);
    setWaiting(true);

    let newChatId = null;
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat({
        question,
        chatId: chatId || undefined,
        pdfId: !chatId ? scopedPdf.pdfId : undefined,
        signal: controller.signal,
        handlers: {
          meta: ({ chatId: id }) => {
            newChatId = id;
          },
          token: ({ token }) => {
            setWaiting(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last.streaming) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + token },
                ];
              }
              return [...prev, { role: 'assistant', content: token, streaming: true }];
            });
          },
          sources: ({ sources }) => {
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant') {
                return [...prev.slice(0, -1), { ...last, sources }];
              }
              return prev;
            });
          },
          error: ({ message }) => setError(message),
        },
      });
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setStreaming(false);
      setWaiting(false);
      abortRef.current = null;
      // Finalize the streaming bubble
      setMessages((prev) =>
        prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
      );
      loadChats();
      // Don't yank the user back if they aborted (new chat / switched away)
      if (newChatId && !chatId && !controller.signal.aborted) {
        navigate(`/chat/${newChatId}`, { replace: true });
      }
    }
  };

  // Abort in-flight stream when leaving the page
  useEffect(() => () => abortRef.current?.abort(), []);

  /* ---------- chat management ---------- */

  /**
   * Start a fresh chat. Works even when already on /chat (where a <Link>
   * would be a no-op): aborts any in-flight stream and resets all state.
   */
  const handleNewChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setActiveChat(null);
    setInput('');
    setError('');
    setStreaming(false);
    setWaiting(false);
    setSidebarOpen(false);
    // Clear both the :chatId param and any pdf scope in location.state
    navigate('/chat', { state: null });
  };

  /** Open an existing chat — abort any stream still running in the old one. */
  const handleSelectChat = (id) => {
    if (id === chatId) {
      setSidebarOpen(false);
      return;
    }
    abortRef.current?.abort();
    navigate(`/chat/${id}`);
    setSidebarOpen(false);
  };

  const handleDeleteChat = async (chat) => {
    if (!window.confirm(`Delete chat "${chat.title}"?`)) return;
    try {
      if (chat._id === chatId) abortRef.current?.abort();
      await api.delete(`/chat/${chat._id}`);
      if (chat._id === chatId) {
        setMessages([]);
        setActiveChat(null);
        navigate('/chat', { state: null });
      }
      loadChats();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  const handleRename = async (chat) => {
    // Ref guard: Enter fires keydown AND the resulting blur — run once.
    // (State isn't reliable here: the blur handler still sees the old closure.)
    if (renameBusyRef.current) return;
    renameBusyRef.current = true;
    const title = renameValue.trim();
    setRenaming(null);
    try {
      if (title && title !== chat.title) {
        await api.patch(`/chat/${chat._id}`, { title });
        loadChats();
        if (chat._id === chatId) setActiveChat((c) => ({ ...c, title }));
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      renameBusyRef.current = false;
    }
  };

  /* ---------- render ---------- */

  const chatScopeLabel = activeChat?.pdf
    ? activeChat.pdf.originalName
    : scopedPdf.pdfName || 'All documents';

  return (
    <div className="h-screen flex flex-col bg-base-100">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside
          className={`${
            sidebarOpen ? 'flex' : 'hidden'
          } md:flex flex-col w-72 shrink-0 border-r border-base-300 bg-base-200/50
          absolute md:static inset-y-0 top-16 z-20 bg-base-100 md:bg-transparent`}
        >
          <div className="p-3">
            <button onClick={handleNewChat} className="btn btn-primary btn-sm w-full">
              + New chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto chat-scroll px-2 pb-4 space-y-1">
            {chats.length === 0 && (
              <p className="text-center text-sm opacity-50 mt-8">No chats yet</p>
            )}
            {chats.map((chat) => (
              <div
                key={chat._id}
                className={`group flex items-center gap-1 rounded-lg px-2 py-1.5 cursor-pointer text-sm
                  ${chat._id === chatId ? 'bg-primary/15 border border-primary/30' : 'hover:bg-base-300'}`}
              >
                {renaming === chat._id ? (
                  <input
                    autoFocus
                    className="input input-xs input-bordered flex-1"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRename(chat)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(chat);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                  />
                ) : (
                  <button
                    className="flex-1 text-left truncate"
                    title={chat.title}
                    onClick={() => handleSelectChat(chat._id)}
                  >
                    <span className="truncate block">{chat.title}</span>
                    <span className="text-xs opacity-50 truncate block">
                      {chat.pdf ? `📄 ${chat.pdf.originalName}` : '🗂 All documents'}
                    </span>
                  </button>
                )}
                {/* Always visible on touch devices; hover-revealed on desktop */}
                <div className="flex gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                  <button
                    className="btn btn-ghost btn-xs"
                    title="Rename"
                    onClick={() => {
                      setRenaming(chat._id);
                      setRenameValue(chat.title);
                    }}
                  >
                    ✏️
                  </button>
                  <button
                    className="btn btn-ghost btn-xs text-error"
                    title="Delete"
                    onClick={() => handleDeleteChat(chat)}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Main chat area */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-2 border-b border-base-300 px-4 py-2">
            <button
              className="btn btn-ghost btn-sm md:hidden"
              onClick={() => setSidebarOpen((v) => !v)}
            >
              ☰
            </button>
            <div className="min-w-0">
              <p className="font-semibold truncate">{activeChat?.title || 'New chat'}</p>
              <p className="text-xs opacity-60 truncate">Scope: {chatScopeLabel}</p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto chat-scroll px-4 py-6">
            <div className="max-w-3xl mx-auto">
              {messages.length === 0 && !waiting && (
                <div className="text-center py-20 opacity-60">
                  <div className="text-5xl mb-4">💬</div>
                  <h2 className="text-lg font-semibold">Ask anything about your documents</h2>
                  <p className="text-sm mt-2">
                    {scopedPdf.pdfName
                      ? `This chat is scoped to "${scopedPdf.pdfName}".`
                      : 'Answers come only from your uploaded PDFs, with page citations.'}
                  </p>
                </div>
              )}

              {messages.map((m, i) => (
                <ChatMessage
                  key={i}
                  role={m.role}
                  content={m.content}
                  sources={m.sources}
                  streaming={m.streaming}
                />
              ))}

              {waiting && <TypingIndicator />}
              <div ref={bottomRef} />
            </div>
          </div>

          {/* Error bar */}
          {error && (
            <div className="px-4 pb-2">
              <div className="alert alert-error py-2 text-sm max-w-3xl mx-auto">
                <span>{error}</span>
                <button className="btn btn-ghost btn-xs" onClick={() => setError('')}>✕</button>
              </div>
            </div>
          )}

          {/* Composer */}
          <form onSubmit={handleSend} className="border-t border-base-300 p-3">
            <div className="max-w-3xl mx-auto flex gap-2">
              <textarea
                className="textarea textarea-bordered flex-1 resize-none min-h-[2.5rem] max-h-32"
                rows={1}
                placeholder="Ask a question about your documents..."
                value={input}
                maxLength={2000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
              />
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!input.trim() || streaming}
              >
                {streaming ? <span className="loading loading-spinner loading-sm" /> : 'Send'}
              </button>
            </div>
            <p className="text-center text-xs opacity-40 mt-2">
              Answers are generated only from your uploaded PDFs.
            </p>
          </form>
        </main>
      </div>
    </div>
  );
}
