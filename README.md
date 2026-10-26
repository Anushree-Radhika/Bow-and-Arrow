# 🏹 Bow and Arrow

**Targeted, AI-Powered Study Roadmaps with Grounded RAG & Time-Boxed Focus Sessions**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20pgvector-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)
[![LangChain](https://img.shields.io/badge/LangChain-1.0+-blue.svg?logo=langchain&logoColor=white)](https://www.langchain.com)
[![PyMuPDF](https://img.shields.io/badge/PyMuPDF-fitz-red.svg)](https://pymupdf.readthedocs.io)
[![Groq Whisper](https://img.shields.io/badge/Groq-Whisper--large--v3--turbo-f55036.svg)](https://groq.com)

---

## 📌 Problem Statement

Modern learners, students, and engineers face severe **cognitive overload** when tackling complex subjects:
- **Massive, Dense Materials**: Textbooks, technical documentation, and academic whitepapers spanning 500+ pages are intimidating and encourage passive skimming rather than active retention.
- **Unstructured Study Paths**: Learners struggle to break broad topics (e.g., *"Distributed Systems"* or *"Graph Algorithms"*) into a logical sequence of foundational prerequisites and sub-concepts.
- **Procrastination & Burnout**: Studying without concrete boundaries leads to fatigue. Open-ended learning lacks the urgency and focus provided by structured time-boxing (e.g., Pomodoro technique).
- **Fragmented Progress & State Loss**: Notes, timers, and progress are scattered across multiple tools, or lost completely when closing a browser tab.

---

## 🎯 The Solution: Bow and Arrow

**Bow and Arrow** transforms unstructured learning into an active, targeted study journey:

1. **Dual-Engine Roadmap Generation**:
   - **Grounded Engine**: Upload dense course PDFs or lecture notes. The backend extracts, chunks, embeds, and indexes the material, building a curriculum directly rooted in the source documents with exact page citations.
   - **Curriculum Engine**: Enter any topic prompt (e.g., *"Advanced Dynamic Programming"*), and the AI synthesizes a structured, acyclic 3-tier study tree.
2. **Time-Boxed Focus Blocks**:
   - Every node on the roadmap is instantiated with a dedicated countdown timer (default 30 minutes).
   - Only one topic runs at a time to enforce deep focus. Completed topics are checked off, with progress metrics updated in real time.
3. **Interactive 2D Infinite Canvas**:
   - Eraser-style canvas with 2D pan, zoom, visual dependency edges, and collapsible control panels.
   - Per-node **Checkpoints & Notes Store** using interactive modal dialogs for active recall.
4. **Hands-Free Voice Agent (Whisper via Groq)**:
   - Speak commands (e.g., *"Mark Dijkstra complete"*, *"Add 15 minutes to BFS"*, *"Expand Tarjan's algorithm"*), transcribed via **Whisper Large v3 Turbo (hosted on Groq LPUs)** with dynamic roadmap vocabulary priming and executed by structured LLM tool callers.
5. **Zero Local Storage Fragility — 100% Supabase Cloud Storage**:
   - Every roadmap, node state, timer tick, note, and progress metric is saved directly to **Supabase PostgreSQL** with multi-tenant **Row-Level Security (RLS)**. No data is lost when closing tabs, and sessions sync seamlessly across any device or browser.

---

## 📂 Project Directory Structure

```
organizer/
├── supabase/
│   └── migrations/
│       ├── 0001_knowledge.sql       # Vector database schema, pgvector, HNSW index, match_user_knowledge RPC
│       └── 0002_study_maps.sql      # Multi-tenant study_maps table with Row-Level Security (RLS)
├── backend/
│   ├── app/
│   │   ├── api/v1/
│   │   │   ├── health.py            # API health checks & dependency statuses
│   │   │   ├── maps.py              # Authenticated REST endpoints for study roadmap CRUD
│   │   │   └── mindmap.py           # Generation (multipart PDF/prompt), Whisper transcribe & command endpoints
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic v2 application settings & environment bindings
│   │   │   └── security.py          # Supabase JWT authentication & session verification
│   │   ├── models/
│   │   │   ├── command.py           # Command parsing schemas (COMPLETE, ADD_TIME, RESTART, EXPAND)
│   │   │   └── mindmap.py           # Graph topology schemas (MapNode, GenMap, GenerateOut)
│   │   ├── services/
│   │   │   ├── ai/
│   │   │   │   ├── base.py          # AI interface & L2 vector normalization utilities
│   │   │   │   ├── gemini.py        # Google GenAI text-embedding-004 & multi-model fallback cascade
│   │   │   │   ├── groq.py          # Free-tier fast Groq LLaMA fallback provider
│   │   │   │   ├── openrouter.py    # Multi-provider OpenRouter fallback
│   │   │   │   └── offline.py       # Deterministic emergency offline curriculum synthesizer
│   │   │   ├── map_storage_service.py # Pure Supabase PostgREST map persistence service
│   │   │   ├── mindmap_service.py   # RAG pipeline orchestration, topology repair & command executor
│   │   │   ├── pdf_service.py       # PyMuPdfReader & LangChain RecursiveCharacterTextSplitter
│   │   │   ├── storage_service.py   # Vector store adapter for Supabase RPC & batch embeddings
│   │   │   └── voice_service.py     # Groq Whisper-large-v3-turbo transcription engine with context priming
│   │   └── main.py                  # FastAPI application factory, CORS middleware, router registration
│   ├── Dockerfile                   # Production Python 3.11 container image
│   ├── main.py                      # Uvicorn entrypoint shim
│   └── requirements.txt             # Pinned backend dependencies
├── frontend/
│   ├── Dockerfile                   # Multi-stage production Next.js 14 container
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css          # Design system tokens, dark mode palette, custom canvas styling
│   │   │   ├── layout.jsx           # Root layout & Bow and Arrow branding metadata
│   │   │   └── page.jsx             # Home view wrapped in Supabase AuthGate
│   │   ├── components/
│   │   │   ├── AuthGate.jsx         # Supabase auth wrapper & session isolation provider
│   │   │   ├── mindmap/
│   │   │   │   ├── CommandBar.jsx   # MediaRecorder voice input with Whisper transcription & recording states
│   │   │   │   ├── MindMapCanvas.jsx# 2D infinite canvas, viewport pan/zoom, auto-save engine
│   │   │   │   ├── MindNode.jsx     # Interactive study card (timers, progress, citation badges)
│   │   │   │   └── NodeNotesDialog.jsx # Modal dialog for point-wise topic notes & checkpoints
│   │   │   ├── navigation/
│   │   │   │   └── Sidebar.jsx      # Multi-map library, roadmap creator, PDF drag-and-drop
│   │   │   └── ui/                  # Accessible UI component library (Dialog, Button, Badge, Icons)
│   │   └── lib/
│   │       ├── api.js               # Authenticated API client with transcribeVoice & Supabase JWT injection
│   │       ├── maps-storage.js      # Supabase cloud persistence layer with beforeunload tab-flush
│   │       ├── mindmap-logic.js     # Pure state reducer for drift-free timestamped timers & graph topology
│   │       └── supabase.js          # Supabase client singleton & auth token accessor
│   └── package.json                 # Next.js 14 frontend dependencies & scripts
├── k8s/                             # Production Kubernetes (K3s) manifests
│   ├── namespace.yaml               # Dedicated mindmaps namespace
│   ├── secrets.example.yaml         # Kubernetes Secrets template (Supabase, Gemini, Groq)
│   ├── backend.yaml                 # FastAPI deployment & ClusterIP service (with health probes)
│   ├── frontend.yaml                # Next.js deployment & ClusterIP service
│   └── ingress.yaml                 # NGINX Ingress controller routing (/api & /) with TLS
└── docker-compose.yml               # Local multi-container orchestration (FastAPI + Next.js)
```

---

## 🧠 Traditional RAG Pipeline & LangChain Architecture

Bow and Arrow implements an **authentic, traditional RAG pipeline**:

```
[ Upload PDF Documents ]
          │
          ▼
1. INGESTION (PyMuPdfReader)
   • C-level native parsing via PyMuPDF (fitz)
   • Password decryption validation & page boundary extraction
          │
          ▼
2. CHUNKING & METADATA ENRICHMENT (LangChain)
   • RecursiveCharacterTextSplitter with sentence terminators: ["\n\n", "\n", ". ", "? ", "! ", " "]
   • 800-character target chunks with 120-character sliding overlap
   • Chunks NEVER cross page boundaries (preserves 100% exact page citations)
   • LangChain Document wrapping with rich metadata:
     {"source": "book.pdf", "page": 42, "chunk_index": 7, "char_count": 780, "word_count": 128}
          │
          ▼
3. ASYMMETRIC EMBEDDINGS (Google GenAI)
   • 768-dimensional float vectors via text-embedding-004
   • Documents embedded with task_type="RETRIEVAL_DOCUMENT"
   • User query embedded with task_type="RETRIEVAL_QUERY"
   • Vectors L2 unit-normalized: ||v|| = 1.0 (enables dot-product cosine similarity)
          │
          ▼
4. VECTOR DATABASE PERSISTENCE (Supabase pgvector)
   • Embeddings inserted into public.knowledge_chunks with folder & user tags
   • Indexed with Hierarchical Navigable Small World (HNSW) cosine metric index:
     USING hnsw (embedding extensions.vector_cosine_ops)
   • Multi-tenant security enforced via PostgreSQL Row-Level Security (RLS)
          │
          ▼
5. RETRIEVAL & GROUNDING
   • SQL RPC match_user_knowledge executes sub-millisecond cosine distance (<=>)
   • Top-K passages selected and sorted in chronological reading order
   • Labeled context blocks injected into prompt: [n] (Source Title p.Page)
          │
          ▼
6. AUGMENTED GENERATION & GRAPH REPAIR
   • LLM constrained to GenMap Pydantic JSON schema
   • Model links topics to source references (sourceRefs: [1, 3])
   • Post-processing breaks circular loops, caps depth at 3 levels, balances tree
```

---

## 🎙️ Voice Agentic Capabilities & Command System

Bow and Arrow incorporates a hands-free, bidirectional voice agent that allows learners to control study sessions, manipulate the canvas graph, query knowledge, and manage time-boxing purely through spoken natural language.

### Supported Voice Agentic Actions

The system supports **5 core voice agentic actions**, orchestrated via structured LLM decisions and client-side graph mutations:

| # | Action Type | Intent | Example Voice Commands | State & Graph Behavior |
|---|---|---|---|---|
| **1** | `ADD_TIME` | **Timer Extension** | *"Add 20 mins to this node"*<br>*"Give me 15 more minutes on Dijkstra"*<br>*"Add 1 hour to Dynamic Programming"*<br>*"Extend by 10 minutes"* | • Parses natural language time units into seconds (clamped between 60s and 8 hours)<br>• Increments `remainingSeconds` and `totalSeconds`<br>• Real-time countdown clock updates on node card<br>• Automatically syncs to Supabase |
| **2** | `COMPLETE` | **Milestone Checkoff** | *"Tarjan completed"*<br>*"I'm done with BFS"*<br>*"Mark Dijkstra as done"*<br>*"Finish this node"* | • Sets target node status to `completed`<br>• Halts active countdown interval timer<br>• Visually styles card with emerald completion badge<br>• Updates study progress percentage and persists state |
| **3** | `RESTART` | **Timer Scratch Reset** | *"Restart BFS"*<br>*"Reset Dijkstra timer"*<br>*"Start over on Graph Traversals"*<br>*"Reset this node"* | • Reverts `remainingSeconds` back to `totalSeconds` (or default 30 min)<br>• Resets node status to `idle`<br>• Clears any expired alarm states |
| **4** | `EXPAND` | **Sub-topic Decomposition (RAG)** | *"Expand Tarjan"*<br>*"Go deeper on DFS"*<br>*"Break down Dijkstra into subtopics"*<br>*"Elaborate on this node"* | • Queries the vector store (`pgvector`) for contextual passages matching the topic<br>• Generates 3 to 6 concrete sub-topics grounded in source notes<br>• Attaches children under the parent node on the canvas<br>• Prevents duplicates and preserves acyclic tree structure |
| **5** | `GENERATE_NEW_MAP` | **Autonomous Roadmap Synthesis** | *"Build a roadmap for Distributed Systems"*<br>*"Create a study map on Quantum Computing"*<br>*"Generate a guide for Operating Systems"* | • Extracts study topic into generative prompt<br>• Retrieves relevant user notes if a folder is active<br>• Synthesizes complete 3-tier hierarchical curriculum<br>• Automatically provisions new map ID, sets pan/zoom, and saves to database |

---

### Intelligent Voice Subsystems

#### 1. Context-Aware "This Node" Resolution
When a learner issues relative voice commands such as *"add 20 mins to this node"* or *"I'm done with this node"*, the agent does not require you to name the topic explicitly:
- The frontend serializes the runtime state of all active nodes (`id`, `title`, `status`, `remainingSeconds`).
- The backend identifies the currently `running` or active node and resolves it as the `targetNodeId`.
- If no node is currently running or multiple nodes are ambiguous, the agent responds with conversational voice guidance: *"How much time should I add? For example, 'add 30 minutes to Dijkstra'."*

#### 2. Phonetic Typo Tolerance & Fuzzy Matching
Voice-to-text engines often mishear complex technical algorithms, medical terms, and mathematical names (e.g., *"tarzan"* for *"Tarjan"*, *"die extra"* for *"Dijkstra"*, *"cruskal"* for *"Kruskal"*).
- The backend implements a fuzzy phonetic matching fallback via Python's `difflib.SequenceMatcher`:
- Stop words (`"the"`, `"and"`, `"add"`, `"algorithm"`, `"problems"`) are stripped.
- Topic titles and spoken words are compared against candidate node tokens with a similarity threshold (`ratio >= 0.8`).
- Allows seamless hands-free control even with imperfect speech recognition transcripts.

#### 3. Closed-Loop Bidirectional Voice Feedback with Groq Whisper & Prompt Priming
- **Speech-to-Text (STT) via Groq Whisper-large-v3-turbo**: Audio is recorded using the standard browser `MediaRecorder` API (`audio/webm`) and dispatched to the `/api/mindmap/transcribe` endpoint. Transcription is executed using Groq's high-speed inference of the open-source **`whisper-large-v3-turbo`** model (sub-250ms latency using `GROQ_API_KEY`).
- **Active Vocabulary Priming**: The active roadmap topic titles (e.g., *"Dijkstra"*, *"Tarjan"*, *"Bellman-Ford"*, *"BFS"*) are dynamically injected as Whisper's prompt context, achieving near-perfect recognition accuracy even with fast speech or accented pronunciation.
- **Universal Browser Compatibility**: By relying on standard `navigator.mediaDevices` audio streams rather than vendor-locked Web Speech engines, voice controls work across **all modern browsers** including Firefox, Chrome, Safari, and Edge.
- **Text-to-Speech (TTS)**: When commands are initiated via voice (`spoken = true`), the response from the LLM is spoken back through the browser's `window.speechSynthesis` (e.g., *"Added 20 minutes to Dijkstra."* or *"Added 4 sub-topics under Tarjan."*), providing audio confirmation without requiring the learner to look at the screen.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org) (App Router, React 18, React Server Components where appropriate)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) with tailored dark slate palette, glassmorphism, and radial canvas backgrounds
- **Component Primitives**: [Radix UI](https://www.radix-ui.com/) accessible primitives (`Dialog`, `Checkbox`, `Slot`)
- **Icons**: [Lucide React](https://lucide.dev) & bespoke SVG `ArchersBowIcon`
- **Audio Capture & Speech**: Standard `MediaRecorder` API for cross-browser microphone streaming & Web Speech Synthesis for spoken feedback

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com) 0.110+ (Asynchronous Python 3.11+)
- **Voice Transcription**: [Groq Cloud](https://groq.com) (`whisper-large-v3-turbo` open-source model on Groq LPUs for <250ms latency)
- **Document Ingestion**: [PyMuPDF](https://pymupdf.readthedocs.io) (`fitz` 2.0+)
- **RAG & Chunking**: [LangChain Core](https://python.langchain.com) & `langchain-text-splitters`
- **Data Validation**: [Pydantic v2](https://docs.pydantic.dev/) for strict DTO schemas and JSON validation
- **HTTP Client**: [HTTPX](https://www.python-httpx.org/) with connection pooling and timeouts

### AI & Multi-Provider Fallback Cascade
1. **Primary**: [Google Gemini](https://ai.google.dev/) (`gemini-3.5-flash-lite`, `gemini-3.5-flash`, `gemini-embedding-001`)
2. **First Fallback**: [Groq](https://groq.com) (`llama-3.3-70b-versatile`)
3. **Second Fallback**: [OpenRouter](https://openrouter.ai)
4. **Third Fallback**: Deterministic offline curriculum generator (guarantees zero 503 failures)

### Database & Authentication
- **Database**: [Supabase](https://supabase.com) (PostgreSQL 15+ with `pgvector` extension)
- **Vector Search**: HNSW (Hierarchical Navigable Small World) index with cosine distance operators
- **Security**: PostgreSQL Row-Level Security (RLS) guaranteeing multi-tenant isolation (`auth.uid() = user_id`)
- **Auth**: Supabase Auth (Email/Password with JWT verification and token cache)

---

## 👥 Target Audience

- **University & College Students**: Transforming 600-page engineering, medical, or law textbooks into organized, bite-sized study blocks.
- **Software Engineers & Interview Prep**: Breaking massive interview curricula (System Design, LeetCode, Concurrency) into time-boxed milestone trees.
- **Researchers & Academics**: Extracting hierarchical reading roadmaps from complex research papers with page-level citations.
- **Self-Directed Learners**: Anyone who wants to conquer a new skill without getting lost in open-ended tutorial hell.

---

## ⚠️ Limitations & Future Roadmap

### Current Limitations
1. **Scanned PDFs Without OCR**: PyMuPDF extracts selectable vector text. Scanned document images without embedded OCR text layers must be processed through OCR before upload.
2. **Page Count Threshold**: Default document length limit is configured to 400 pages (`MAX_PDF_PAGES=400`).
3. **Microphone Permissions**: Hands-free voice features require granting standard browser microphone access.

### Future Roadmap
- [ ] **On-Device OCR**: Integration of OCR engine (PaddleOCR / Tesseract) for scanned document image parsing.
- [ ] **Spaced Repetition Integration**: Automatic export of roadmap topic notes directly into Anki flashcard decks.
- [ ] **Collaborative Study Rooms**: Real-time multi-user study sessions over WebSockets.
- [ ] **Multi-Format Ingestion**: Support for EPUB, Markdown, and YouTube lecture transcripts.

---

## 🚀 Getting Started

### 1. Database Setup (Supabase)
In your [Supabase Dashboard](https://supabase.com/dashboard/project/_/sql), open the **SQL Editor** and run the two migration files in order:
1. `supabase/migrations/0001_knowledge.sql` (Enables `pgvector`, sets up `knowledge_chunks`, and installs `match_user_knowledge` RPC)
2. `supabase/migrations/0002_study_maps.sql` (Creates `study_maps` table with Row-Level Security policies)

---

### 🐳 Option A: Quickstart with Docker Compose (Recommended)

Run both the FastAPI backend and Next.js frontend with a single command:

```bash
# 1. Configure environment variables
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local

# 2. Build and start containers
docker compose up --build
```

* **Frontend**: [http://localhost:3000](http://localhost:3000)
* **Backend API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

To stop the containers:
```bash
docker compose down
```

---

### 💻 Option B: Manual Local Setup

#### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your SUPABASE_URL, SUPABASE_ANON_KEY, and GEMINI_API_KEY

# Start backend server
uvicorn main:app --reload --port 8000
```
Interactive API documentation will be available at `http://localhost:8000/docs`.

#### 2. Frontend Setup
```bash
cd frontend

# Install packages
npm install

# Configure environment
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, and NEXT_PUBLIC_API_URL

# Start development server
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

```bash
# Frontend Unit & Logic Tests (node test runner)
cd frontend
npm test

# Production Build Validation
npm run build
```

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
