#  AI Assistant

## Project Structure

```
vikramaditya/
├── backend/
│   ├── main.py              ← FastAPI app — all endpoints
│   ├── requirements.txt     ← Python dependencies
│   ├── .env.example         ← Copy to .env and add your API keys
│   ├── api/
│   │   ├── router.py        ← Input detection + routing logic (16 combinations → 3 routes)
│   │   └── pipeline.py      ← Main orchestrator — connects everything
│   ├── llm/
│   │   ├── prompts.py       ← All system prompts (tone-aware)
│   │   ├── claude_client.py ← Claude Sonnet 4.6 — text + image + web search
│   │   └── gemini_client.py ← Gemini 3 Flash — audio + video + Google Search
│   ├── audio/
│   │   └── tts.py           ← Markdown cleaner + Gemini TTS
│   ├── config/
│   │   └── settings.py      ← API keys, model names, limits
│   └── utils/
│       └── debug.py         ← Colour-coded debug logger with @timer decorator
└── frontend/
    └── index.html           ← Full UI — dark/light mode, tone selector, all input types
```

## Setup

### 1. Clone and setup backend

```bash
cd backend
cp .env.example .env
# Add your API keys to .env
pip install -r requirements.txt
```

### 2. Add API Keys to .env

```
ANTHROPIC_API_KEY=your_key_here   # from console.anthropic.com/settings/keys
GEMINI_API_KEY=your_key_here      # from aistudio.google.com/apikey
DEBUG_MODE=true
```

### 3. Run backend

```bash
cd backend
python main.py
# Server starts at http://localhost:8000
```

### 4. Open frontend

Just open `frontend/index.html` in your browser. No build step needed.

---

## How It Works

### Routing — all 16 input combinations → 3 routes

| Inputs          | Route   | Who answers        |
|-----------------|---------|--------------------|
| Text / Image    | Route A | Claude only        |
| Audio / Video   | Route B | Gemini only        |
| Mixed (any AV + TI) | Route C | Gemini → Claude |

### Tones

| Tone        | Description                                     |
|-------------|-------------------------------------------------|
| Normal      | Clear, engaging for general audience            |
| Researcher  | Scholarly depth, iconographic analysis          |
| Concise     | Brief bullet points only                        |
| Explanatory | Step-by-step as if teaching a student           |
| Formal      | Academic language for documentation             |

### Anti-hallucination

- Claude has web search tool always enabled
- Gemini has Google Search grounding always on
- System prompt instructs: "If unsure, say unsure — never guess"
- Both models refuse all non-heritage topics

### Audio Output

User answer → markdown cleaner strips ##, **, -, → → clean text → Gemini TTS → natural speech

---

## Debug Mode

Set `DEBUG_MODE=true` in `.env` to see colour-coded logs for every pipeline step:

```
10:23:14.521 [ROUTER]   Inputs: [TEXT + IMAGE] | Route → ROUTE_A
10:23:14.522 [CLAUDE]   Starting call_claude...
10:23:15.891 [CLAUDE]   call_claude completed in 1369ms
10:23:15.892 [PIPELINE] Answer generated — 842 chars
```
