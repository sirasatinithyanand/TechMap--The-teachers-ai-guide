# TeachMap — AI-Powered Curriculum Personalization Platform

## Project Overview
TeachMap helps professors build personalized curricula by pulling a baseline from CurricuLLM, exploring what any university in the world teaches (live-scraped via Gemini + Google Search grounding on a world map), uploading their own materials, and iterating until satisfied. From the finalized curriculum, lecture-by-lecture content is generated. Students interact via anonymous Q&A forums, auto-generated quizzes, and feedback forms. Feedback loops back into the next lecture's content.

## Tech Stack
- **Frontend**: Next.js 14 (App Router, TypeScript, Tailwind CSS)
- **Backend**: FastAPI (Python 3.11+), located in `server/`
- **Database**: Supabase (PostgreSQL)
- **AI — Curriculum**: CurricuLLM API (curriculum-aligned, OpenAI-compatible)
- **AI — NLP + Scraping**: Google Gemini (sentence parsing, file extraction, university curriculum extraction from scraped HTML)
- **Search**: Serper API (Google Search JSON results for university course pages)
- **Maps**: Mapbox GL JS (world map, geocoding, university pins)
- **Storage**: Supabase Storage (file uploads, zip exports)

## Monorepo Structure
```
teachmap/
├── client/          # Next.js frontend
│   ├── app/         # App Router pages
│   ├── components/
│   └── .env.local
├── server/          # FastAPI backend (Python package)
│   ├── main.py      # FastAPI app entry point
│   ├── routers/     # One file per domain (courses, curriculum, lectures, students)
│   ├── services/    # AI clients, Supabase client, scraping logic
│   ├── models/      # Pydantic schemas
│   └── .env
├── supabase/        # DB migrations
├── CLAUDE.md
├── DESIGN.md
└── README.md
```

## Environment Variables

### Client (`client/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Server (`server/.env`)
```
CURRICULLM_API_KEY=
GEMINI_API_KEY=
SERPER_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
MAPBOX_TOKEN=
PORT=3001
```

## Key Architecture Decisions
1. **CurricuLLM is OpenAI-compatible** — use `openai` Python SDK, change `base_url` to `https://api.curricullm.com/v1`
2. **No auth for MVP** — single professor assumed. No login screens.
3. **Student pages are shareable links** — `/s/[courseId]/lecture/[num]/forum` etc. No login needed.
4. **All LLM calls go through FastAPI** — frontend never calls AI directly.
5. **No static university database** — universities are discovered live via Mapbox Geocoding (lat/lng for pin) + Serper API (finds course page URL) + httpx scrape + Gemini (extracts structured curriculum from HTML). The world map is a key differentiator.
6. **Simple forum** — anonymous POST + GET + upvote. No realtime, no polling.
7. **Zip export** — all lecture content packaged as a downloadable zip from `GET /api/courses/{id}/export`.

## Development Commands
```bash
# Frontend
cd client && npm install && npm run dev  # runs on :3000

# Backend
cd server && pip install -r requirements.txt && uvicorn main:app --reload --port 3001

# Database
# Run migrations via Supabase dashboard or CLI
```

## Build Priority (3-Day Sprint)

### Day 1: Core Flow
- **Backend**: FastAPI scaffold in `server/`, Supabase tables, `/api/courses/parse` (Gemini), `/api/courses` (CRUD), `/api/courses/{id}/curriculum/baseline` (CurricuLLM)
- **Frontend**: Next.js scaffold, landing page (`/`), confirmation page (`/confirm`), curriculum builder shell (`/course/[id]/curriculum`)

### Day 2: Map + Curriculum + Lectures
- **Backend**: `GET /api/universities/search` (Gemini grounded scraping), inspire/upload/finalize endpoints, `POST /api/courses/{id}/lectures/generate`
- **Frontend**: Mapbox world map in curriculum sidebar, scrape results panel, "Pull Inspiration", file upload, curriculum editor, lecture list + detail views

### Day 3: Student Features + Dashboard + Export
- **Backend**: Forum, quiz, feedback, feedback-loop, zip export endpoints
- **Frontend**: Student pages (`/s/...`), professor dashboard, export button

## CurricuLLM Integration Pattern
```python
from openai import OpenAI

curricullm = OpenAI(
    api_key=settings.CURRICULLM_API_KEY,
    base_url="https://api.curricullm.com/v1"
)

response = curricullm.chat.completions.create(
    model="gpt-4o",  # use standard model names — CurricuLLM is OpenAI-compatible
    messages=[{"role": "user", "content": prompt}]
)
```

## Gemini Integration Pattern
```python
import google.generativeai as genai

genai.configure(api_key=settings.GEMINI_API_KEY)
model = genai.GenerativeModel("gemini-1.5-flash")
response = model.generate_content(prompt)
```

## University Scraping Pipeline
```
1. Professor types university name in search bar (curriculum builder page)
2. Frontend: Mapbox Geocoding API → lat/lng → drop pin on world map
3. On pin click: GET /api/universities/search?uni=MIT&course=databases
4. Backend:
   a. Serper API: POST https://google.serper.dev/search
      query: '"{university}" "{course_name}" syllabus OR curriculum site:{uni_domain}'
      → returns top 5 organic result URLs
   b. httpx: fetch the top result HTML (timeout 8s)
   c. BeautifulSoup: strip boilerplate, extract body text (~4000 chars)
   d. Gemini: "Extract chapter/week structure from this course page as JSON"
      → returns {"chapters": [{number, title, description, topics}]}
5. Frontend: show outline in side panel with "Pull Inspiration" button
6. POST /api/courses/{id}/curriculum/inspire → merge into working curriculum
```

### Serper API call pattern
```python
import httpx

async def serper_search(query: str) -> list[str]:
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://google.serper.dev/search",
            headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": 5}
        )
    return [r["link"] for r in resp.json().get("organic", [])]
```
