# 🏹 Bow and Arrow

**Targeted, AI-Powered Study Roadmaps with Grounded RAG & Time-Boxed Focus Sessions**

[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14.2-black.svg?logo=next.js&logoColor=white)](https://nextjs.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20pgvector-3ECF8E.svg?logo=supabase&logoColor=white)](https://supabase.com)
[![LangChain](https://img.shields.io/badge/LangChain-1.0+-blue.svg?logo=langchain&logoColor=white)](https://www.langchain.com)
[![PyMuPDF](https://img.shields.io/badge/PyMuPDF-fitz-red.svg)](https://pymupdf.readthedocs.io)

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
4. **Natural Language & Voice Command Bar**:
   - Speak or type commands (e.g., *"Mark Dijkstra complete"*, *"Add 15 minutes to BFS"*, *"Expand Tarjan's algorithm"*), parsed and executed by LLM tool callers with fuzzy phonetic matching.
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
│   │   │   └── mindmap.py           # Generation (multipart PDF/prompt) & conversational command endpoints
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
│   │   │   └── storage_service.py   # Vector store adapter for Supabase RPC & batch embeddings
│   │   └── main.py                  # FastAPI application factory, CORS middleware, router registration
│   ├── main.py                      # Uvicorn entrypoint shim
│   └── requirements.txt             # Pinned backend dependencies
└── frontend/
    ├── src/
    │   ├── app/
    │   │   ├── globals.css          # Design system tokens, dark mode palette, custom canvas styling
    │   │   ├── layout.jsx           # Root layout & Bow and Arrow branding metadata
    │   │   └── page.jsx             # Home view wrapped in Supabase AuthGate
    │   ├── components/
    │   │   ├── AuthGate.jsx         # Supabase auth wrapper & session isolation provider
    │   │   ├── mindmap/
    │   │   │   ├── CommandBar.jsx   # Natural language & voice speech recognition command input
    │   │   │   ├── MindMapCanvas.jsx# 2D infinite canvas, viewport pan/zoom, auto-save engine
    │   │   │   ├── MindNode.jsx     # Interactive study card (timers, progress, citation badges)
    │   │   │   └── NodeNotesDialog.jsx # Modal dialog for point-wise topic notes & checkpoints
    │   │   ├── navigation/
    │   │   │   └── Sidebar.jsx      # Multi-map library, roadmap creator, PDF drag-and-drop
    │   │   └── ui/                  # Accessible UI component library (Dialog, Button, Badge, Icons)
    │   └── lib/
    │       ├── api.js               # Authenticated API fetch client with Supabase JWT bearer injection
    │       ├── maps-storage.js      # Supabase cloud persistence layer with beforeunload tab-flush
    │       ├── mindmap-logic.js     # Pure state reducer for drift-free timestamped timers & graph topology
    │       └── supabase.js          # Supabase client singleton & auth token accessor
    └── package.json                 # Next.js 14 frontend dependencies & scripts
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

## 🛠️ Tech Stack

### Frontend
- **Framework**: [Next.js 14](https://nextjs.org) (App Router, React 18, React Server Components where appropriate)
- **Styling**: [Tailwind CSS](https://tailwindcss.com) with tailored dark slate palette, glassmorphism, and radial canvas backgrounds
- **Component Primitives**: [Radix UI](https://www.radix-ui.com/) accessible primitives (`Dialog`, `Checkbox`, `Slot`)
- **Icons**: [Lucide React](https://lucide.dev) & bespoke SVG `ArchersBowIcon`
- **Speech Recognition**: Web Speech API for voice recognition and synthesized audio feedback

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com) 0.110+ (Asynchronous Python 3.11+)
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
2. **Page Count Threshold**: Default document length limit is set to 120 pages (`MAX_PDF_PAGES=120`) to prevent API timeouts and respect free-tier rate limits.
3. **Browser Voice Support**: Voice recognition utilizes the native Web Speech API, which requires browser support (supported in Chrome, Edge, Safari; limited in Firefox).

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

### 2. Backend Setup
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

### 3. Frontend Setup
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
