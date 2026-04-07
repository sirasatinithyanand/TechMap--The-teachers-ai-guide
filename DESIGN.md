# TeachMap — Design Document

## User Flows

### Flow 1: Course Setup
```
Professor enters sentence ("I teach COMP1511 at UNSW for first years")
  → POST /api/courses/parse (Gemini extracts fields)
  → Frontend shows confirmation card: {university, course, grade}
  → Professor confirms → POST /api/courses (saves to DB)
  → Redirect to curriculum builder
```

### Flow 2: Curriculum Building
```
On course creation → auto-fetch baseline curriculum
  → POST /api/courses/{id}/curriculum/baseline (CurricuLLM)
  → Professor sees chapter-by-chapter baseline

Professor explores world map (Mapbox)
  → Searches any university worldwide by name
  → Mapbox Geocoding API pins the university on the map
  → Professor clicks pin
  → GET /api/universities/search?uni=MIT&course=databases
  → Backend: Gemini (Google Search grounding) scrapes that uni's syllabus
     for the relevant course and returns chapter-level structure
  → Professor sees the scraped curriculum outline
  → Clicks "Pull Inspiration" → merges into their working curriculum
  → POST /api/courses/{id}/curriculum/inspire

Professor uploads files (PDFs, slides)
  → POST /api/courses/{id}/files/upload
  → Backend extracts content with Gemini, stores in Supabase Storage

Professor edits curriculum until satisfied
  → PUT /api/courses/{id}/curriculum (saves draft)
  → POST /api/courses/{id}/curriculum/finalize (locks it)
```

### Flow 3: Lecture Generation
```
On finalize → POST /api/courses/{id}/lectures/generate
  → CurricuLLM generates N lectures from finalized curriculum
  → Each lecture: title, main_content, key_concepts, learning_outcomes
  → Lecture 2+ includes a revision segment recapping previous lecture
  → Lecture N+ (if feedback exists) adjusts depth/pacing from quiz scores + feedback

Professor views lectures → GET /api/courses/{id}/lectures
Professor exports all → GET /api/courses/{id}/export (zip download of all lecture content)
```

### Flow 4: Student Interaction
```
Professor shares link: /s/{course_id}/lecture/{num}/forum
  → Students post anonymous questions (text only, no auth)
  → Students upvote questions
  → Simple forum — no realtime, no polling

Professor triggers quiz: POST /api/lectures/{id}/quiz/generate
  → CurricuLLM auto-generates from lecture content
  → Professor shares link: /s/{course_id}/lecture/{num}/quiz
  → Students take quiz, submit answers

After class → /s/{course_id}/lecture/{num}/feedback
  → Students rate (1-5) + optional comment
```

### Flow 5: Feedback Loop
```
Professor views dashboard → /course/{id}/dashboard
  → Sees: quiz scores (aggregated), feedback summary, top questions
  → Clicks "Prepare Next Lecture"
  → POST /api/lectures/{id}/next/prepare
  → Takes feedback + quiz results → CurricuLLM adjusts next lecture
  → Adds targeted revision of weak areas from current lecture
```

---

## University Scraping Pipeline

The map is a key differentiator — professors can search **any university in the world**.

### How it works
1. Professor types a university name into the search bar
2. **Mapbox Geocoding API** resolves it to lat/lng → pin drops on world map
3. On pin click, backend runs the **curriculum scraping pipeline**:
   - **Serper API** (Google Search JSON) → query: `"{university}" "{course_name}" syllabus OR curriculum` → returns top 5 URLs
   - **httpx** → fetch top result HTML (async, 8s timeout)
   - **BeautifulSoup** → strip nav/footer/boilerplate, extract body text
   - **Gemini** → parse the text into structured JSON: `[{number, title, description, topics}]`
4. Professor sees the curriculum outline in a side panel
5. "Pull Inspiration" merges selected chapters into their working curriculum

### Why this pipeline
- Serper gives reliable Google Search results as clean JSON — no scraping Google's HTML
- httpx is async so it doesn't block FastAPI
- Gemini handles the messy structure-extraction from arbitrary university page layouts

### Fallback
If Serper returns no relevant URLs or the page is behind a login, surface an empty state with a file upload CTA.

---

## Database Schema

```sql
-- Professors (minimal for MVP, no auth)
CREATE TABLE professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Courses
CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id UUID REFERENCES professors(id),
    university_name TEXT NOT NULL,
    course_name TEXT NOT NULL,
    course_code TEXT,
    grade_level TEXT,
    raw_input TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Curricula (versioned)
CREATE TABLE curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    content JSONB NOT NULL,
    -- content: {"chapters": [{"number": 1, "title": "...", "description": "...", "learning_outcomes": ["..."], "topics": ["..."]}]}
    is_final BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'baseline' CHECK (source IN ('baseline', 'modified')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Tracks which external curricula inspired the final version
CREATE TABLE curriculum_inspirations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID REFERENCES curricula(id) ON DELETE CASCADE,
    source_university TEXT NOT NULL,
    source_course TEXT,
    content_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Uploaded files
CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    processed_content JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Lectures (generated from finalized curriculum)
CREATE TABLE lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID REFERENCES curricula(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lecture_number INT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    -- content: {"main_content": "...", "learning_outcomes": ["..."], "key_concepts": ["..."]}
    revision_content JSONB,
    -- revision: {"from_lecture": 2, "recap_points": ["..."], "weak_areas": ["..."]}
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Anonymous forum questions
CREATE TABLE forum_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Auto-generated quizzes
CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    -- questions: [{"q": "...", "type": "mcq", "options": ["A","B","C","D"], "correct": "B", "explanation": "..."}]
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Quiz submissions
CREATE TABLE quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score FLOAT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- Post-lecture feedback
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);
```

Note: No static `universities` table — universities are discovered live via Mapbox Geocoding + Gemini scraping.

---

## API Routes

### Course Setup
| Method | Path | Description | AI |
|--------|------|-------------|-----|
| POST | `/api/courses/parse` | Extract university, course, grade from sentence | Gemini |
| POST | `/api/courses` | Create course after confirmation | — |
| GET | `/api/courses/{id}` | Get course details | — |

### Curriculum
| Method | Path | Description | AI |
|--------|------|-------------|-----|
| POST | `/api/courses/{id}/curriculum/baseline` | Fetch curriculum aligned to professor's university | CurricuLLM |
| GET | `/api/universities/search` | Search any uni worldwide + scrape curriculum | Gemini (grounded) |
| POST | `/api/courses/{id}/curriculum/inspire` | Save inspiration from another uni | — |
| POST | `/api/courses/{id}/files/upload` | Upload + extract file content | Gemini |
| PUT | `/api/courses/{id}/curriculum` | Update curriculum draft | — |
| POST | `/api/courses/{id}/curriculum/finalize` | Lock curriculum | — |

### Lectures
| Method | Path | Description | AI |
|--------|------|-------------|-----|
| POST | `/api/courses/{id}/lectures/generate` | Generate all lectures | CurricuLLM |
| GET | `/api/courses/{id}/lectures` | List lectures | — |
| GET | `/api/lectures/{id}` | Get single lecture | — |
| PUT | `/api/lectures/{id}` | Edit lecture | — |
| POST | `/api/lectures/{id}/regenerate` | Regenerate with feedback | CurricuLLM |
| GET | `/api/courses/{id}/export` | Download zip of all lectures | — |

### Student Features
| Method | Path | Description | AI |
|--------|------|-------------|-----|
| POST | `/api/lectures/{id}/questions` | Post anonymous question | — |
| GET | `/api/lectures/{id}/questions` | List questions (ordered by upvotes) | — |
| POST | `/api/questions/{id}/upvote` | Upvote question | — |
| POST | `/api/lectures/{id}/quiz/generate` | Auto-generate quiz | CurricuLLM |
| GET | `/api/lectures/{id}/quiz` | Get quiz | — |
| POST | `/api/quizzes/{id}/submit` | Submit quiz answers | — |
| GET | `/api/quizzes/{id}/results` | Aggregated results | — |
| POST | `/api/lectures/{id}/feedback` | Submit feedback | — |
| GET | `/api/lectures/{id}/feedback/summary` | Aggregated feedback | — |

### Feedback Loop
| Method | Path | Description | AI |
|--------|------|-------------|-----|
| POST | `/api/lectures/{id}/next/prepare` | Generate next lecture adjustments | CurricuLLM |

---

## Frontend Routes

### Professor Pages
| Route | Purpose |
|-------|---------|
| `/` | Landing — professor types sentence |
| `/confirm` | Confirm extracted course info |
| `/course/[id]/curriculum` | Curriculum builder — left: chapter editor, right: world map + search |
| `/course/[id]/lectures` | Lecture list + export button |
| `/course/[id]/lectures/[num]` | Single lecture view |
| `/course/[id]/dashboard` | Quiz scores, feedback summary, top questions, "Prepare Next Lecture" |

### Student Pages (shareable, no auth)
| Route | Purpose |
|-------|---------|
| `/s/[courseId]/lecture/[num]/forum` | Anonymous Q&A forum |
| `/s/[courseId]/lecture/[num]/quiz` | Take quiz |
| `/s/[courseId]/lecture/[num]/feedback` | Submit feedback |

---

## LLM Prompt Patterns

### Course Parsing (Gemini)
```
Extract the following from this professor's description:
- university_name
- course_name
- course_code (if mentioned)
- grade_level (e.g., "first year undergraduate", "postgraduate")

Input: "{raw_sentence}"

Respond ONLY in JSON: {"university_name": "...", "course_name": "...", "course_code": "...", "grade_level": "..."}
```

### Baseline Curriculum (CurricuLLM)
```
Generate a chapter-by-chapter curriculum for:
University: {university}
Course: {course_name} ({course_code})
Level: {grade_level}

For each chapter: number, title, 2-sentence description, 3-5 learning outcomes, list of key topics.
Align with the official curriculum approach at {university}.

Respond ONLY in JSON: {"chapters": [...]}
```

### University Curriculum Scraping (Gemini — parses scraped HTML)
```
The following is raw text scraped from a university course page for "{course_name}" at "{university_name}".
Extract the chapter or week-by-week curriculum structure.

Raw page text:
{scraped_text}

Return ONLY in JSON:
{"university": "...", "course": "...", "chapters": [{"number": 1, "title": "...", "description": "...", "topics": ["..."]}]}

If no clear curriculum structure is present, return: {"chapters": []}
```

### Lecture Generation (CurricuLLM)
```
Generate lecture content for Lecture {n} of {total} in "{course_name}".

Chapter: {chapter_title}
Topics: {topics}
Learning outcomes: {outcomes}

{if n > 1}
Previous lecture covered: {prev_lecture_summary}
Include a 3-5 minute revision segment covering key points and any weak areas from last class.
{endif}

{if has_feedback}
Student feedback from last class:
- Average rating: {avg_rating}/5
- Common concerns: {concerns}
- Weak quiz areas: {weak_topics}
Adjust depth and pacing accordingly.
{endif}

Respond in JSON: {title, revision_content (if applicable), main_content, key_concepts, learning_outcomes}
```

### Quiz Generation (CurricuLLM)
```
Generate a 5-question quiz for:
Course: {course_name}
Lecture: {lecture_title}
Content summary: {lecture_content_summary}

Mix MCQ (4 options) and short answer.
Respond ONLY in JSON array.
```
