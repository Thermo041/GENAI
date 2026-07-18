# 📄 DocuChat AI — Production-Ready AI PDF Chatbot (RAG)

Chat with your PDF documents using Retrieval-Augmented Generation. Upload PDFs, ask questions in plain English, and get **grounded, cited answers** — never hallucinations.

Built with **React · Node.js · MongoDB Atlas · AWS S3 · Qdrant Cloud · LangChain · Hugging Face embeddings · Groq**, deployable to **Render** as a single service.

---

## ✨ Features

- 🔐 **Full JWT authentication** — register, login, protected routes, bcrypt hashing, token expiry
- 📤 **PDF upload** — drag & drop, type + magic-byte validation, configurable size limit
- ☁️ **AWS S3 storage** — binaries in S3, only metadata in MongoDB
- 🧠 **RAG pipeline** — extract → clean → chunk (configurable size/overlap) → embed → index
- 🔎 **Qdrant vector search** — per-user isolation via payload filters, top-K retrieval
- 💬 **Streaming chat UI** — SSE token streaming, typing indicator, markdown, code blocks with copy buttons, source citations with page numbers, auto-scroll, mobile responsive
- 🗂 **Chat scope** — chat with one PDF or across your entire library
- 📚 **Chat history** — continue, rename, and delete conversations
- 🚫 **No hallucinations** — answers only from retrieved context; says *"I couldn't find that information in your uploaded documents."* otherwise
- 🛡 **Security** — Helmet, CORS, rate limiting (per-route), input validation, centralized error handling
- ⚡ **Performance** — parallel async ops, paginated + indexed Mongo queries, debounced search, lazy-loaded routes, background PDF ingestion

---

## 🏗 Architecture

```
┌─────────────┐        ┌──────────────────────────────────────────┐
│   React     │  HTTPS │              Express API                 │
│ Vite + Daisy│ ─────► │  auth / pdf / chat  (JWT + rate limits)  │
└─────────────┘  SSE ◄─┤                                          │
                       └──────┬──────────┬──────────┬─────────────┘
                              │          │          │
                    ┌─────────▼──┐  ┌────▼─────┐  ┌─▼──────────────┐
                    │  MongoDB   │  │  AWS S3  │  │  RAG pipeline  │
                    │  Atlas     │  │  (PDFs)  │  │  (LangChain)   │
                    │ users/pdfs │  └──────────┘  │                │
                    │ chats/msgs │                │ HF embeddings  │
                    └────────────┘                │      ↓         │
                                                  │ Qdrant Cloud   │
                                                  │      ↓         │
                                                  │  Groq LLM      │
                                                  └────────────────┘
```

**Upload flow:** PDF → S3 → metadata in MongoDB → extract text per page → clean → chunk (overlapping) → HF embeddings (`bge-small-en-v1.5`, local ONNX) → Qdrant with `{userId, pdfId, pageNumber, chunkIndex, filename}` payload.

**Chat flow:** question → embed query → Qdrant similarity search (filtered by user, optionally by PDF) → top-K chunks → strict grounded prompt → Groq (`llama-3.3-70b-versatile`) → streamed answer + deduplicated source citations.

---

## 📁 Project Structure

```
├── client/                  # React (Vite) frontend
│   └── src/
│       ├── components/      # Navbar, ChatMessage, TypingIndicator, ProtectedRoute
│       ├── context/         # AuthContext (JWT session)
│       ├── lib/             # axios instance, SSE stream parser, formatters
│       └── pages/           # Landing, Login, Register, Dashboard, Upload, Chat, Profile, Settings, 404
├── server/                  # Express backend (MVC)
│   └── src/
│       ├── config/          # env validation, MongoDB connection
│       ├── controllers/     # auth, pdf, chat
│       ├── langchain/       # embeddings, qdrantStore, pdfProcessor, ragChain
│       ├── middleware/      # auth (JWT), upload (multer), rate limits, validation, errors
│       ├── models/          # User, Pdf, Chat, Message
│       ├── routes/          # /api/auth, /api/pdf, /api/chat
│       ├── services/        # s3Service, pdfIngestService
│       └── utils/           # ApiError, asyncHandler, jwt
├── render.yaml              # Render blueprint
└── package.json             # Root build/start scripts
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js ≥ 18
- Accounts: [MongoDB Atlas](https://cloud.mongodb.com), [Qdrant Cloud](https://cloud.qdrant.io), [AWS S3](https://aws.amazon.com/s3/), [Groq](https://console.groq.com)

### 1. Clone & install

```bash
git clone <your-repo-url>
cd ai-pdf-chatbot
npm install --prefix server
npm install --prefix client
```

### 2. Configure environment

```bash
cp server/.env.example server/.env
# fill in every value (see table below)
```

| Variable | Description |
|---|---|
| `PORT` | API port (default `5000`) |
| `NODE_ENV` | `development` / `production` |
| `CLIENT_URL` | Frontend origin for CORS |
| `MONGODB_URI` | Atlas connection string (include a DB name) |
| `JWT_SECRET` | Long random string |
| `JWT_EXPIRES_IN` | e.g. `7d` |
| `GROQ_API_KEY` | Groq console API key |
| `GROQ_MODEL` | Default `llama-3.3-70b-versatile` |
| `QDRANT_URL` | Qdrant Cloud cluster endpoint |
| `QDRANT_API_KEY` | Qdrant Cloud API key |
| `QDRANT_COLLECTION` | Default `pdf_chunks` |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | IAM credentials with S3 access |
| `AWS_REGION` / `AWS_BUCKET_NAME` | Bucket location + name |
| `EMBEDDING_MODEL` | `Xenova/bge-small-en-v1.5` (default, ONNX build of BAAI/bge-small-en-v1.5) or `Xenova/all-MiniLM-L6-v2` |
| `MAX_FILE_SIZE_MB` | Upload limit (default `20`) |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunking config (default `1000` / `200`) |
| `TOP_K` | Retrieved chunks per question (default `5`) |

### 3. Run in development

```bash
# Terminal 1 — API on :5000
npm run dev:server

# Terminal 2 — client on :5173 (proxies /api to :5000)
npm run dev:client
```

Open http://localhost:5173.

> **First upload note:** the embedding model (~34 MB ONNX) downloads and caches on first use — the first upload takes a little longer.

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/api/auth/register` | Create account → JWT |
| `POST` | `/api/auth/login` | Login → JWT |
| `GET` | `/api/auth/me` | Current user (protected) |
| `POST` | `/api/pdf/upload` | Upload PDF (multipart, field `file`) |
| `GET` | `/api/pdf?search=&page=&limit=` | List PDFs (paginated + search) |
| `GET` | `/api/pdf/:id` | PDF metadata |
| `DELETE` | `/api/pdf/:id` | Delete PDF + vectors + chats |
| `POST` | `/api/chat` | Ask a question (SSE stream) |
| `GET` | `/api/chat` | List chats |
| `GET` | `/api/chat/:id` | Chat + messages |
| `PATCH` | `/api/chat/:id` | Rename chat |
| `DELETE` | `/api/chat/:id` | Delete chat |
| `GET` | `/api/health` | Health check (Render) |

---

## ☁️ Deployment (Render)

1. Push the repo to GitHub.
2. On Render: **New → Blueprint** and select the repo — `render.yaml` provisions everything.
3. Fill the `sync: false` environment variables (Mongo, Groq, Qdrant, AWS) in the Render dashboard.
4. Set `CLIENT_URL` to your Render URL (e.g. `https://ai-pdf-chatbot.onrender.com`).
5. Deploy — the build compiles the React client and the Express server serves it, so one service runs the entire app. Health checks hit `/api/health`.

---

## 📸 Screenshots

| Page | Screenshot |
|---|---|
| Landing | _placeholder_ |
| Dashboard | _placeholder_ |
| Upload | _placeholder_ |
| Chat (streaming + citations) | _placeholder_ |

---

## 🔮 Future Improvements

- OCR fallback (Tesseract) for scanned/image PDFs
- Refresh tokens + httpOnly cookie sessions
- Reranking (e.g. cross-encoder) after vector retrieval
- Hybrid search (BM25 + dense vectors) in Qdrant
- Multi-file uploads and folder organization
- Share chats via public links
- Usage quotas per user + admin dashboard
- Websocket transport for chat, presigned S3 download links

---

## 📄 License

MIT — free to use for learning and portfolios.
