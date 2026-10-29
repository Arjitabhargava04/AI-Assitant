# Ai Assistant — Complete Project Documentation

> **Ai Assistant** is a multimodal Heritage & Archaeology assistant. Users can ask
> questions by **text, image, audio, or video** and get expert answers about ancient
> monuments, temples, forts, sculptures, inscriptions, dynasties, and archaeology.
> The system intelligently routes each request between **Google Gemini** and
> **Anthropic Claude**, grounds answers with live web search, can fetch & verify real
> images, speaks answers aloud (TTS), and lets heritage experts **correct** the AI so it
> keeps improving.

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Technology Stack](#2-technology-stack)
3. [High-Level Architecture](#3-high-level-architecture)
4. [Project Folder Structure](#4-project-folder-structure)
5. [How It Works — The Query Pipeline](#5-how-it-works--the-query-pipeline)
6. [The AI Models & API Keys (Accounts)](#6-the-ai-models--api-keys-accounts)
7. [Database Schema](#7-database-schema)
8. [Authentication, Roles & Admin System](#8-authentication-roles--admin-system)
9. [The Corrections System (Expert Tuning)](#9-the-corrections-system-expert-tuning)
10. [Backend API Reference (All Endpoints)](#10-backend-api-reference-all-endpoints)
11. [Frontend Overview](#11-frontend-overview)
12. [Environment Variables](#12-environment-variables)
13. [How To Run The Project](#13-how-to-run-the-project)
14. [Debug Mode](#14-debug-mode)
15. [Glossary / Key Concepts](#15-glossary--key-concepts)

---

## 1. What This Project Does

Ai Assistant is a **domain-restricted expert chatbot**. It only answers questions about
heritage, monuments, and archaeology — and politely refuses everything else.

**Core capabilities:**

| Capability | Description |
|------------|-------------|
| **Multimodal input** | Accepts text, images, audio, and video in any combination |
| **Smart routing** | Picks the best AI model (Gemini or Claude) per request and tone |
| **Live web grounding** | Gemini uses Google Search grounding; Claude uses a web-search tool, so answers stay current and accurate |
| **5 answer tones** | Normal, Concise, Explanatory, Researcher, Formal |
| **Multi-language** | Auto-detects and replies in English, Hindi (Devanagari), or Hinglish |
| **Real image results** | When a user asks to "show images", it searches Google, fetches the images, and Gemini visually verifies each one before showing it |
| **Text-to-Speech** | Any answer can be spoken aloud using Gemini TTS |
| **Streaming answers** | Answers stream token-by-token (live typing effect) |
| **Chat history & projects** | Conversations are saved per user and can be grouped into projects |
| **Expert corrections** | Admins can teach the AI verified facts that override its answers |
| **Anti-hallucination** | Strict prompts: "if unsure, say unsure — never guess" |

---

## 2. Technology Stack

### Backend
| Tech | Version | Purpose |
|------|---------|---------|
| **Python** | 3.11 | Language |
| **FastAPI** | 0.115.0 | Web framework / REST API |
| **Uvicorn** | 0.30.0 | ASGI server |
| **anthropic** (SDK) | 0.40.0 | Claude API client |
| **google-genai** (SDK) | 1.73.1 | Gemini API client (chat, perception, TTS) |
| **PyMySQL** | 1.1.1 | MySQL database driver |
| **PyJWT** | 2.9.0 | JWT auth tokens |
| **bcrypt** | 4.2.0 | Password hashing |
| **aiohttp** | 3.10.0 | Async HTTP (parallel image fetch/verify) |
| **requests** | 2.32.3 | Sync HTTP (Google Vision API) |
| **python-multipart** | 0.0.9 | File upload parsing |
| **python-dotenv** | 1.0.0 | Loads `.env` config |
| **pydantic** | ≥2.1.0 | Request validation models |

### Frontend
| Tech | Version | Purpose |
|------|---------|---------|
| **React** | 19.2 | UI library |
| **React Router DOM** | 7.14 | Client-side routing (`/login`, `/chat`, `/admin`) |
| **Vite** | 8.0 | Build tool / dev server |
| **Tailwind CSS** | 3.4 | Styling (dark/light theme, responsive) |
| **PostCSS + Autoprefixer** | — | CSS processing |
| **ESLint** | 10 | Linting |
| **Nginx** (alpine) | — | Serves built frontend + reverse-proxies `/api` in production |

### Database & Infra
| Tech | Purpose |
|------|---------|
| **MySQL** 8.0 | Stores users, chats, messages, projects, corrections |
| **Docker + Docker Compose** | Containerizes MySQL + backend + frontend |
| **Docker Hub** | Prebuilt images: `vikramaditiyaai/vikramaditiya-backend:v1`, `vikramaditiyaai/vikramaditiya-frontend:v1` |

### External Cloud APIs
| API | Used For |
|-----|----------|
| **Anthropic Claude API** | Deep scholarly answers (Researcher/Formal tones) + web search tool |
| **Google Gemini API** | Direct answers, multimodal perception, AV extraction, TTS, image verification |
| **Google Cloud Vision API** | Reverse image search (identify what's in an uploaded image) |
| **Google Custom Search API** | Fetch real web images when the user asks to see pictures |

---

## 3. High-Level Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER'S BROWSER                                │
│   React 19 + Vite + Tailwind  (Login / Chat / Admin pages)             │
└───────────────────────────────┬──────────────────────────────────────┘
                                 │  HTTPS / REST + JWT
                   (dev: localhost:8000 | prod: Nginx /api → backend)
                                 │
┌────────────────────────────────▼─────────────────────────────────────┐
│                      FASTAPI BACKEND (Python 3.11)                      │
│                                                                        │
│   main.py  ── routes ──►  auth / chats / corrections / admin           │
│                          /query  /query/stream  /speak  /health        │
│                                 │                                       │
│                    api/router.py  (detect input → route)               │
│                                 │                                       │
│                    api/pipeline.py  (orchestrator)                     │
│            ┌────────────────────┼────────────────────┐                 │
│            ▼                    ▼                    ▼                  │
│   llm/gemini_client     llm/claude_client     vision/ + audio/         │
│   (direct + perception) (deep + web search)   (image search, TTS)      │
│                                 │                                       │
│             corrections/injector  (override with verified facts)       │
└──────────────┬─────────────────────────────────────┬─────────────────┘
               │                                      │
        ┌──────▼──────┐                    ┌──────────▼──────────┐
        │  MySQL 8.0  │                    │   External APIs:    │
        │ users/chats │                    │  Claude · Gemini ·  │
        │ messages ·  │                    │  Google Vision ·    │
        │ corrections │                    │  Google Search      │
        └─────────────┘                    └─────────────────────┘
```

---

## 4. Project Folder Structure

```
vikramaditya/
├── docker-compose.yml          # Orchestrates mysql + backend + frontend
├── vikramaditya_backup.sql     # MySQL schema + seed data dump
├── .env                        # Root env (used by docker-compose)
├── README.md                   # Short setup readme
├── DOCUMENTATION.md            # ← this file
│
├── backend/                    # FastAPI application
│   ├── main.py                 # App entry — all top-level endpoints
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container (python:3.11-slim)
│   ├── .env / .env.example     # Backend secrets & config
│   │
│   ├── config/
│   │   └── settings.py         # API keys, model names, tones, limits, DB config
│   │
│   ├── api/
│   │   ├── router.py           # Input-type detection → Route A/B/C
│   │   └── pipeline.py         # Main orchestrator (direct vs deep, streaming)
│   │
│   ├── llm/
│   │   ├── gemini_client.py    # Gemini: direct answer, perception, AV extract, streaming
│   │   ├── claude_client.py    # Claude: deep scholarly answer + web search, streaming
│   │   └── prompts.py          # All system prompts (scope, identity, tone, format)
│   │
│   ├── vision/
│   │   ├── image_search.py     # Google Vision reverse-image search (uploaded image → context)
│   │   └── web_images.py       # Google Custom Search → fetch → Gemini-verify images
│   │
│   ├── audio/
│   │   └── tts.py              # Markdown cleaner + Gemini TTS (→ WAV)
│   │
│   ├── auth/
│   │   ├── routes.py           # /signup /login /me
│   │   ├── middleware.py       # require_auth / require_admin / require_super_admin
│   │   └── utils.py            # bcrypt hashing + JWT encode/decode
│   │
│   ├── chats/
│   │   └── routes.py           # Chats + Projects CRUD
│   │
│   ├── corrections/
│   │   ├── injector.py         # Keyword match → inject verified fact into prompt
│   │   └── routes.py           # Save/list/approve/edit/delete corrections
│   │
│   ├── admin/
│   │   └── routes.py           # Super-admin: manage small-admins, view users/chats
│   │
│   ├── db/
│   │   ├── connection.py       # PyMySQL connection helper
│   │   └── queries.py          # ALL SQL lives here (users, chats, messages, etc.)
│   │
│   └── utils/
│       ├── debug.py            # Colour-coded logger + @timer decorator
│       ├── language.py         # English / Hindi / Hinglish detection
│       └── image_intent.py     # Detect "show me images" + how many
│
└── frontend-react/             # React + Vite SPA
    ├── package.json            # JS dependencies & scripts
    ├── vite.config.js          # Vite config
    ├── tailwind.config.js      # Tailwind theme
    ├── nginx.conf              # Prod: serve SPA + proxy /api → backend
    ├── Dockerfile              # 2-stage: node build → nginx serve
    ├── .env.development        # VITE_API_URL=http://localhost:8000
    ├── .env.production         # VITE_API_URL=/api
    │
    └── src/
        ├── main.jsx            # React entry
        ├── App.jsx             # Router: /login, /chat, /admin
        ├── context/
        │   └── AuthContext.jsx # Global auth state (token, role)
        ├── utils/
        │   ├── api.js          # API base URL, authFetch, token storage, markdown render
        │   └── demoResponses.js# Canned demo answers for guest landing
        ├── pages/
        │   ├── Login.jsx       # Login / signup
        │   ├── UserChat.jsx    # Main chat UI (streaming, TTS, edit/regenerate)
        │   ├── Admin.jsx       # Super/small admin dashboard (corrections + tuning)
        │   ├── ProjectsView.jsx, ProjectDetail.jsx
        └── components/
            ├── Sidebar.jsx          # Chat history + projects
            ├── InputArea.jsx        # Text box + file uploads + tone selector
            ├── MessageBubble.jsx    # Renders answer, TTS button, edit/regenerate, images
            ├── GuestLanding.jsx     # Public landing for non-logged-in users
            ├── DemoBubble.jsx       # Demo conversation bubbles
            └── WipModal.jsx         # "Work in progress" modal
```

---

## 5. How It Works — The Query Pipeline

When a user submits a question, this is the full journey of the request:

### Step 1 — Request arrives (`POST /query` or `POST /query/stream`)
`main.py` receives the multipart form: `text`, `tone`, `chat_id`, and optional
`image` / `audio` / `video` files. The request **requires a valid JWT** (`require_auth`).
It reads the file bytes and builds an `InputPayload`.

### Step 2 — Input detection & routing (`api/router.py`)
The router looks at which inputs are present and picks **one of 3 routes** out of all 16
possible Text/Image/Audio/Video combinations:

| Inputs present | Route | Handled by |
|----------------|-------|------------|
| Text and/or Image only | **Route A** | Gemini directly (image also reverse-searched via Vision) |
| Audio and/or Video only | **Route B** | Gemini directly (native audio/video understanding) |
| Any A/V **+** any T/I (mixed) | **Route C** | Gemini extracts the A/V into text → then re-fed with the image/text |
| Nothing | `empty` | Returns a friendly "please ask something" error |

The payload is also **validated** (size limits: image ≤ 20 MB, audio ≤ 100 MB, video ≤ 500 MB).

### Step 3 — Tone decides the model path (`api/pipeline.py`)
The **tone** controls whether Claude gets involved:

- **Direct path** — tones `normal`, `concise`, `explanatory` → **Gemini answers directly**.
- **Deep path** — tones `researcher`, `formal` (the `DEEP_TONES` set) → **Gemini acts as a
  "perception layer"** (it identifies/transcribes the input and returns structured
  findings) and then **Claude writes the final scholarly answer** using those findings +
  its own web search.

### Step 4 — Image intent detection (`utils/image_intent.py`)
Before any API call, the raw text is scanned (pure Python, zero cost) for keywords like
"show me", "photo", "दिखाओ", "dikhao" to decide whether the user wants images, and how many
(capped at `MAX_IMAGES_SHOWN = 5`).

### Step 5 — Corrections check (`corrections/injector.py`)
The query (and, for images, a short Gemini-generated image summary) is matched against the
database of **approved expert corrections** using keyword overlap:
- **≥ 95% match** → inject the verified fact directly into the system prompt.
- **80–94% match** → ask Claude a quick yes/no "is this relevant?" then inject if yes.
- **< 80%** → ignore.

If a correction is injected, it's prefixed as *"VERIFIED HERITAGE CORRECTION — treat as
absolute ground truth"* so the model can't contradict it. (Audio/video queries skip this check.)

### Step 6 — Run the model(s)

**Direct path (Gemini):**
- For images, a Google **Vision reverse-image search** runs *in parallel* and its findings
  are appended as `[Visual Web Context]`.
- Gemini is called with **Google Search grounding always on**, the tone-specific system
  prompt, recent chat history (last 6 messages), and any correction prefix.

**Deep path (Gemini → Claude):**
- Gemini perception + Vision run in parallel to identify the subject and gather context.
- Claude then runs a **2-pass agentic web search**:
  1. **Trusted pass** — restricted to authoritative heritage domains (ASI, UNESCO,
     British Museum, Met, Britannica, JSTOR, etc.).
  2. **Open pass** — the wider web for any gaps.
  3. **Final synthesis** — Claude writes the complete answer, never revealing its sources.

### Step 7 — Optional image fetching (`vision/web_images.py`)
If image intent was detected, the system:
1. Builds a precise search query from the answer text (Gemini helps shorten it).
2. Calls **Google Custom Search** for image URLs.
3. Fetches the actual image bytes (in parallel via aiohttp).
4. **Gemini visually verifies** each image is genuinely relevant (YES/NO).
5. Returns only the verified URLs (up to the requested count).

### Step 8 — Save & respond
The user message and the AI answer are saved to the `messages` table (linked to the
`chat_id`). The response JSON contains `answer`, `images`, `gemini_summary`, `route`, `tone`.

### Streaming variant (`/query/stream`)
Same logic, but the final answer is **streamed** as newline-delimited JSON chunks
(`{"type":"text","data":"..."}`) so the frontend shows a live typing effect. The full
answer is assembled and saved to the DB once streaming completes.

### Text-to-Speech (`POST /speak`)
When the user clicks "Speak" on a message: the markdown is **stripped clean** (no `##`,
`**`, bullets), then sent to the **Gemini TTS model** (`gemini-2.5-flash-preview-tts`),
which returns raw PCM that's wrapped into a WAV and base64-returned to the browser.

---

## 6. The AI Models & API Keys (Accounts)

The app uses two LLM providers plus two Google APIs. **The API keys come from these
specific accounts** (important for billing / key rotation):

| Service | Model / API | **Key sourced from account** |
|---------|-------------|------------------------------|
| **Gemini** (chat, perception, AV extraction, TTS, image verification) | `gemini-3.1-flash-lite-preview` + `gemini-2.5-flash-preview-tts` | **shreesilktech@gmail.com** |
| **Claude** (deep scholarly answers + web search, Researcher/Formal tones, correction relevance checks) | `claude-sonnet-4-6` | **metaconsolbhopal@gmail.com** |
| **Google Cloud Vision** (reverse image search) | Vision `images:annotate` | Google Cloud project |
| **Google Custom Search** (web images) | Custom Search JSON API + CX engine ID | Google Cloud project |

> ⚠️ **Key management notes**
> - **`GEMINI_API_KEY`** is generated from **shreesilktech@gmail.com** (via
>   [aistudio.google.com/apikey](https://aistudio.google.com/apikey)). The same key powers
>   Gemini chat, perception, image verification, and TTS.
> - **`ANTHROPIC_API_KEY`** is generated from **metaconsolbhopal@gmail.com** (via
>   [console.anthropic.com](https://console.anthropic.com/settings/keys)).
> - These keys are **secrets** — they live only in `.env` files (which are git-ignored) and
>   are injected as environment variables in Docker. Never commit them.
> - If a key is rotated or billing changes, update `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`
>   in `backend/.env` (local) and the root `.env` (Docker), then restart.

**Model configuration** lives in `backend/config/settings.py`:

```python
CLAUDE_MODEL = "claude-sonnet-4-6"               # deep path
GEMINI_MODEL = "gemini-3.1-flash-lite-preview"   # direct + perception
TTS_MODEL    = "gemini-2.5-flash-preview-tts"    # text-to-speech
```

All three can be overridden via environment variables (`CLAUDE_MODEL`, `GEMINI_MODEL`).

---

## 7. Database Schema

MySQL database name: **`vikramaditya`**. Five tables:

### `users`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `email` | varchar(255) UNIQUE | login id |
| `password_hash` | varchar(255) | bcrypt hash |
| `display_name` | varchar(100) | |
| `role` | varchar(20) | `user` \| `small_admin` \| `super_admin` |
| `created_at` | timestamp | |

### `chats`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(36) FK→users | owner |
| `title` | varchar(255) | set from first message |
| `project_id` | varchar(36) | optional group |
| `created_at`, `updated_at` | timestamp | |

### `messages`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `chat_id` | varchar(36) FK→chats | |
| `user_id` | varchar(36) FK→users | |
| `role` | varchar(10) | `user` \| `assistant` |
| `content` | text | the message / answer |
| `gemini_summary` | text | perception summary (for deep path) |
| `input_type` | varchar(10) | `text`/`image`/`audio`/`video`/`mixed` |
| `created_at` | timestamp | |

### `projects`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `user_id` | varchar(36) FK→users | |
| `name` | varchar(255) | |
| `created_at` | timestamp | |

### `corrections`
| Column | Type | Notes |
|--------|------|-------|
| `id` | varchar(36) PK | UUID |
| `gemini_summary` | text | context the correction applies to |
| `correct_answer` | text | the verified fact |
| `question_text` | text | original question |
| `search_words` | text | comma-separated keywords for matching |
| `input_type` | varchar(10) | |
| `submitted_by` | varchar(36) | admin user id |
| `status` | varchar(20) | `pending` \| `approved` |
| `is_active` | tinyint(1) | soft delete flag |
| `created_at` | timestamp | |

> A ready-to-import dump (schema + data) is provided at **`vikramaditya_backup.sql`**.

All SQL is centralized in **`backend/db/queries.py`** — no other file writes SQL directly.

---

## 8. Authentication, Roles & Admin System

### Auth flow
- **Signup** (`POST /auth/signup`): validates email & password (≥6 chars), bcrypt-hashes the
  password, creates the user, returns a JWT.
- **Login** (`POST /auth/login`): verifies the bcrypt hash, returns a JWT.
- **JWT**: HS256, signed with `JWT_SECRET`, contains `user_id`, `email`, `role`. Expires
  after `JWT_EXPIRE_HOURS` (default **8760 h = 1 year**, effectively "permanent login").
- The token is stored in the browser's `localStorage` (`vk_token`) and sent as
  `Authorization: Bearer <token>` on every request via `authFetch`.

### Three roles
| Role | Powers |
|------|--------|
| **user** | Chat, history, projects, TTS |
| **small_admin** | Everything a user can do **+** submit corrections (which start as `pending`) and run tuning sessions |
| **super_admin** | Full control: create/remove small-admins, view all users & chats, approve/reject/edit/delete any correction |

The **super admin** is whoever's email matches `ADMIN_EMAIL` in `.env` — that email is
*always* promoted to `super_admin` on login/signup, regardless of the DB.

Middleware dependencies enforce access:
`require_auth` → `require_admin` (small or super) → `require_super_admin` (super only).

---

## 9. The Corrections System (Expert Tuning)

This is what makes the AI **improve over time**. Heritage experts (admins) can teach the AI.

1. An admin submits a correction: the original question, what the AI should have said
   (`correct_answer`), and context. The backend auto-generates `search_words` (keywords
   with common stop-words removed).
2. If submitted by a **super_admin**, it's `approved` instantly. If by a **small_admin**,
   it's `pending` until a super_admin approves it.
3. On every future query, `injector.py` matches the user's words against each approved
   correction's `search_words` (see [Step 5](#step-5--corrections-check-correctionsinjectorpy)).
4. A matched correction is injected into the system prompt as **absolute ground truth**, so
   the AI's answer is overridden with the verified fact.

Admins manage all of this from the **Admin dashboard** (`/admin`):
approve, edit, deactivate, or hard-delete corrections; view which admin submitted what; and
inspect users' chats.

---

## 10. Backend API Reference (All Endpoints)

Base URL: `http://localhost:8000` (dev) or `/api` proxied through Nginx (prod).
🔒 = requires `Authorization: Bearer <token>`.

### Auth
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/auth/signup` | public | Create account, returns token |
| POST | `/auth/login` | public | Login, returns token |
| GET | `/auth/me` | 🔒 | Current user info + role |

### Core AI
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/query` | 🔒 | Main AI query (multipart: text/tone/chat_id + image/audio/video) |
| POST | `/query/stream` | 🔒 | Streaming version (NDJSON token stream) |
| POST | `/speak` | 🔒 | Text-to-Speech, returns base64 WAV |
| PATCH | `/messages/{message_id}` | 🔒 | Edit a saved message (used by edit/regenerate) |
| GET | `/health` | public | Health check |

### Chats & Projects
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | `/chats` | 🔒 | List my chats (sidebar) |
| POST | `/chats` | 🔒 | Create a chat |
| GET | `/chats/{id}/messages` | 🔒 | Load a chat's messages |
| PATCH | `/chats/{id}/title` | 🔒 | Rename a chat |
| GET | `/chats/all` | 🔒 admin | All users' chats |
| GET | `/chats/projects` | 🔒 | List my projects |
| POST | `/chats/projects` | 🔒 | Create project |
| DELETE | `/chats/projects/{id}` | 🔒 | Delete project |
| PATCH | `/chats/{id}/project` | 🔒 | Assign chat to project |
| GET | `/chats/projects/{id}/chats` | 🔒 | Chats in a project |

### Corrections
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | `/corrections` | 🔒 admin | Submit a correction (super=approved, small=pending) |
| GET | `/corrections` | 🔒 super | All corrections (optional `?submitted_by=`) |
| GET | `/corrections/mine` | 🔒 admin | My own corrections |
| PATCH | `/corrections/{id}/approve` | 🔒 super | Approve a pending correction |
| PATCH | `/corrections/{id}/deactivate` | 🔒 super | Set back to pending |
| PATCH | `/corrections/{id}/update` | 🔒 admin | Edit correction text |
| DELETE | `/corrections/{id}` | 🔒 super | Permanently delete |

### Admin (super only)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/small-admins` | List small admins |
| POST | `/admin/small-admins` | Create a small admin account |
| DELETE | `/admin/small-admins/{id}` | Demote to user |
| GET | `/admin/small-admins/{id}/corrections` | Their corrections |
| GET | `/admin/small-admins/{id}/sessions` | Their tuning sessions |
| GET | `/admin/users` | List all users |
| GET | `/admin/users/{id}/chats` | A user's chats |

---

## 11. Frontend Overview

A single-page React app (Vite). Three routes, guarded by auth role:

| Route | Page | Who |
|-------|------|-----|
| `/login` | `Login.jsx` | logged-out users (logged-in users are redirected) |
| `/chat` | `UserChat.jsx` | regular users **and guests** (guests see a landing/demo) |
| `/admin` | `Admin.jsx` | admins only |

**Key UI features (in `UserChat.jsx` + components):**
- **Streaming answers** with a live typing/blinking-cursor effect (consumes `/query/stream`).
- **Multimodal input** (`InputArea.jsx`): text box + image/audio/video upload + **tone selector**
  (Normal / Concise / Explanatory / Researcher / Formal).
- **Message actions** (`MessageBubble.jsx`): **Speak** (TTS), **copy**, **edit & regenerate**,
  like/dislike, and rendered markdown + verified image results.
- **Sidebar** (`Sidebar.jsx`): chat history grouped by date, projects, new chat.
- **Guest mode** (`GuestLanding.jsx` + `demoResponses.js`): non-logged-in visitors get a
  demo experience with canned responses.
- **Auth state** is held globally in `AuthContext.jsx`; the token lives in `localStorage`.
- **Theme**: dark/light mode via Tailwind.

The **Admin dashboard** (`Admin.jsx`, ~1500 lines) provides the super-admin and small-admin
panels: managing small admins, reviewing/approving corrections, running tuning sessions, and
browsing users' chats.

**Markdown rendering** is done client-side by a small custom renderer in `api.js`
(`renderMarkdown`) — headings, bold, italics, lists, code, line breaks.

### Dev vs Prod API URL
- **Dev**: `.env.development` → `VITE_API_URL=http://localhost:8000` (calls backend directly).
- **Prod**: `.env.production` → `VITE_API_URL=/api`; Nginx (`nginx.conf`) strips `/api` and
  proxies to `http://backend:8000`, with special handling (no buffering, 600s timeout) for the
  streaming endpoint and a 500 MB upload limit.

---

## 12. Environment Variables

### `backend/.env` (local dev) — see `backend/.env.example`
```ini
# ── LLM keys ──
ANTHROPIC_API_KEY=...     # from metaconsolbhopal@gmail.com (console.anthropic.com)
GEMINI_API_KEY=...        # from shreesilktech@gmail.com (aistudio.google.com/apikey)
GOOGLE_VISION_KEY=...     # Google Cloud Vision API key
GOOGLE_SEARCH_KEY=...     # Google Custom Search API key
GOOGLE_SEARCH_CX=...      # Custom Search Engine ID

# ── Models (optional overrides) ──
CLAUDE_MODEL=claude-sonnet-4-6
GEMINI_MODEL=gemini-3.1-flash-lite-preview

# ── Database ──
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=...
DB_NAME=vikramaditya

# ── Auth ──
JWT_SECRET=<long-random-string>
JWT_EXPIRE_HOURS=8760
ADMIN_EMAIL=<super-admin-email>

# ── Debug ──
DEBUG_MODE=true
```

### Root `.env` (used by `docker-compose.yml`)
Same keys plus `DB_ROOT_PASSWORD` (MySQL root password) and the `DB_*` values that are
passed into the MySQL and backend containers. **All secret values are git-ignored.**

---

## 13. How To Run The Project

### Option A — Local development (no Docker)

**1. Database** — have MySQL 8 running locally and import the dump:
```bash
mysql -u root -p -e "CREATE DATABASE vikramaditya;"
mysql -u root -p vikramaditya < vikramaditya_backup.sql
```

**2. Backend**
```bash
cd backend
cp .env.example .env          # then fill in the keys (see section 12)
python -m venv venv
# Windows: venv\Scripts\activate    |    macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
python main.py                # starts at http://localhost:8000
```

**3. Frontend**
```bash
cd frontend-react
npm install
npm run dev                   # Vite dev server (usually http://localhost:5173)
```
Open the printed URL. The frontend talks to the backend at `http://localhost:8000`.

### Option B — Docker Compose (full stack)

The compose file runs **MySQL + backend + frontend** together. It uses prebuilt images
(`vikramaditiyaai/...:v1`) and reads secrets from the **root `.env`**.

```bash
# Fill in the root .env (DB_ROOT_PASSWORD, DB_USER, DB_PASSWORD, DB_NAME,
# GEMINI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_*, JWT_SECRET, ADMIN_EMAIL, DEBUG_MODE)
docker compose up -d
```

Then open **http://localhost:8080** (frontend via Nginx). Internally:
- MySQL is exposed on host port **3307** (container 3306).
- Backend runs on the internal network; the frontend's Nginx proxies `/api` → `backend:8000`.

> To rebuild images from source instead of pulling: build `backend/Dockerfile` and
> `frontend-react/Dockerfile`, push/tag them, or change the `image:` lines to `build:` paths.

### Production build of the frontend (standalone)
```bash
cd frontend-react
npm run build                 # outputs to dist/ (uses .env.production → VITE_API_URL=/api)
```

---

## 14. Debug Mode

Set `DEBUG_MODE=true` in `.env` to get colour-coded, timed logs for **every** pipeline step
(from `utils/debug.py`). Example:

```
10:23:14.521 [ROUTER]   Inputs: [TEXT + IMAGE] | Route → ROUTE_A
10:23:14.522 [GEMINI]   Tone: normal | Lang: english | Parts: 2
10:23:15.891 [GEMINI]   call_gemini_direct completed in 1369ms
10:23:15.892 [PIPELINE] Answer: 842 chars
```

The `@timer(...)` decorator automatically logs how long each model call takes. Set
`DEBUG_MODE=false` in production to silence it.

---

## 15. Glossary / Key Concepts

| Term | Meaning |
|------|---------|
| **Route A / B / C** | The 3 ways the router dispatches inputs (Text-Image / Audio-Video / Mixed) |
| **Direct path** | Gemini answers directly (Normal/Concise/Explanatory tones) |
| **Deep path** | Gemini perceives → Claude writes scholarly answer (Researcher/Formal tones) |
| **Perception layer** | Gemini's job in the deep path: identify/transcribe and return structured findings, **not** the final answer |
| **Grounding** | Live web search Gemini/Claude use to verify facts (never revealed to the user) |
| **Correction** | An expert-verified fact stored in DB that overrides the AI's answer when relevant |
| **Tone** | The style of the answer; also decides whether Claude is used |
| **Identity rules** | Prompt rules forcing the AI to always present as "Ai Assistant" and never mention Claude/Gemini/Google or that it searched |
| **TTS** | Text-to-Speech via Gemini's dedicated TTS model |

---

*Ai Assistant — Heritage & Archaeology Assistant · FastAPI + React + MySQL · powered by
Google Gemini (key: shreesilktech@gmail.com) and Anthropic Claude (key:
metaconsolbhopal@gmail.com).*
