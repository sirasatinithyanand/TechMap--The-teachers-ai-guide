import json
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from openai import OpenAI
from settings import settings

_curricullm = OpenAI(
    api_key=settings.CURRICULLM_API_KEY,
    base_url="https://api.curricullm.com/v1",
)

_groq = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)


def _parse_json(text: str) -> dict | list:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())


def _chat(prompt: str) -> str:
    """Try CurricuLLM first, fall back to Groq on any failure."""
    try:
        resp = _curricullm.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return resp.choices[0].message.content
    except Exception:
        resp = _groq.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return resp.choices[0].message.content


def generate_baseline_curriculum(
    university: str, course_name: str, course_code: str | None, grade_level: str | None
) -> dict:
    prompt = f"""Generate the official chapter-by-chapter curriculum for:
University: {university}
Course: {course_name}{f" ({course_code})" if course_code else ""}
Level: {grade_level or "undergraduate"}

This should reflect what {university} actually teaches in this course.
For each chapter provide: number, title, 2-sentence description, 3-5 learning outcomes, list of key topics.

Respond ONLY in JSON:
{{"chapters": [{{"number": 1, "title": "...", "description": "...", "learning_outcomes": ["..."], "topics": ["..."]}}]}}"""
    return _parse_json(_chat(prompt))


def generate_lectures(
    curriculum_chapters: list,
    course_name: str,
    feedback_context: dict | None = None,
) -> list[dict]:
    """Generate all lectures in parallel — 4x faster than sequential."""
    total = len(curriculum_chapters)

    def _build_prompt(i: int, chapter: dict) -> str:
        n = i + 1
        # Use the PREVIOUS curriculum chapter as revision context (no sequential dependency)
        revision_block = ""
        if i > 0:
            prev = curriculum_chapters[i - 1]
            revision_block = f"""
Previous lecture covered: "{prev.get("title")}" — topics: {", ".join(prev.get("topics", [])[:4])}
Start with a 2-3 minute revision segment recapping the key points."""

        feedback_block = ""
        if feedback_context and n > 1:
            feedback_block = f"""
Student feedback from last class: avg rating {feedback_context.get("avg_rating")}/5
Weak areas: {feedback_context.get("weak_topics", "none")} — adjust depth accordingly."""

        return f"""Generate lecture content for Lecture {n} of {total} in "{course_name}".

Chapter: {chapter.get("title")}
Topics: {", ".join(chapter.get("topics", []))}
Learning outcomes: {", ".join(chapter.get("learning_outcomes", []))}
{revision_block}{feedback_block}

Respond ONLY in JSON:
{{"title": "...", "revision_content": {{"from_lecture": {n-1}, "recap_points": ["..."], "weak_areas": []}} or null, "main_content": "...", "key_concepts": ["..."], "learning_outcomes": ["..."]}}"""

    def _generate_one(i: int, chapter: dict) -> tuple[int, dict]:
        prompt = _build_prompt(i, chapter)
        lecture = _parse_json(_chat(prompt))
        lecture["lecture_number"] = i + 1
        # Ensure revision_content is null for lecture 1
        if i == 0:
            lecture["revision_content"] = None
        return i, lecture

    results: list[dict | None] = [None] * total

    # max_workers=4 balances speed vs Groq rate limits (6000 TPM on free tier)
    with ThreadPoolExecutor(max_workers=4) as executor:
        futures = {executor.submit(_generate_one, i, ch): i for i, ch in enumerate(curriculum_chapters)}
        for future in as_completed(futures):
            i, lecture = future.result()
            results[i] = lecture

    return [r for r in results if r is not None]


def generate_quiz(lecture_title: str, lecture_content: str, course_name: str) -> list[dict]:
    prompt = f"""Generate 6 multiple-choice quiz questions for university students.

Course: {course_name}
Lecture: "{lecture_title}"
Content: {lecture_content[:2000]}

Requirements:
- ALL questions must be MCQ with exactly 4 options labelled A, B, C, D
- Mix: 2 recall questions, 2 understanding questions, 2 application/scenario questions
- The "correct" field must be the exact option text (not the label A/B/C/D)
- Write a clear 1-sentence explanation for each correct answer
- Make distractors plausible, not obviously wrong
- Questions must be directly based on the lecture content above

Respond ONLY as a JSON array:
[{{"q": "Question text?", "type": "mcq", "options": ["Option A", "Option B", "Option C", "Option D"], "correct": "Option B", "explanation": "Because..."}}]"""
    return _parse_json(_chat(prompt))


def blend_curricula(
    base_chapters: list,
    inspired_chapters: list,
    course_name: str,
    base_university: str,
    inspired_university: str,
) -> dict:
    prompt = f"""You are designing a personalized university curriculum by blending two sources.

Course: "{course_name}"

SOURCE A — {base_university} (primary, {len(base_chapters)} chapters):
{json.dumps([{"number": c.get("number"), "title": c.get("title"), "topics": c.get("topics", [])} for c in base_chapters], indent=2)}

SOURCE B — {inspired_university} (inspiration, {len(inspired_chapters)} chapters):
{json.dumps([{"number": c.get("number"), "title": c.get("title"), "topics": c.get("topics", [])} for c in inspired_chapters], indent=2)}

Task: Create a NEW blended curriculum that:
1. Keeps EXACTLY {len(base_chapters)} chapters (same count as Source A)
2. Preserves the core structure and ordering from Source A
3. Enriches each chapter by incorporating unique topics, angles, or depth from Source B where relevant
4. Gives each chapter a fresh title that reflects the blend
5. Merges learning outcomes and topics — do not just copy one source

For each chapter: number, title, description (2 sentences), learning_outcomes (3-5 items), topics (4-7 items).

Respond ONLY in JSON:
{{"chapters": [{{"number": 1, "title": "...", "description": "...", "learning_outcomes": ["..."], "topics": ["..."]}}]}}"""
    return _parse_json(_chat(prompt))


def answer_student_question(
    question: str,
    lecture_title: str,
    lecture_content: str,
    course_name: str,
) -> str:
    prompt = f"""You are a helpful AI teaching assistant for the course "{course_name}".

A student has asked the following question during or after the lecture "{lecture_title}":

Student question: {question}

Lecture content (for context):
{lecture_content[:3000]}

Answer the student's question clearly and helpfully. Be concise (2-4 sentences for simple questions, up to a short paragraph for complex ones). Use plain language suitable for a student. If the question is outside the lecture scope, acknowledge it and suggest they ask the professor."""
    return _chat(prompt)


def prepare_next_lecture(
    current_lecture: dict,
    feedback_summary: dict,
    quiz_results: dict,
    next_chapter: dict,
    course_name: str,
) -> dict:
    weak_topics = [
        stat["question"]
        for stat in quiz_results.get("question_stats", [])
        if stat.get("avg_correct", 1) < 0.6
    ]

    prompt = f"""Prepare the next lecture for "{course_name}" based on student performance.

Current lecture: {current_lecture.get("title")}
Next chapter: {next_chapter.get("title")}
Topics: {", ".join(next_chapter.get("topics", []))}

Student feedback:
- Average rating: {feedback_summary.get("avg_rating", "N/A")}/5
- Comments: {"; ".join(feedback_summary.get("comments", [])[:3])}

Quiz performance:
- Average score: {quiz_results.get("avg_score", "N/A")}
- Weak areas: {", ".join(weak_topics) if weak_topics else "none"}

Generate an adjusted lecture that opens with revision of weak areas and adjusts pacing based on feedback.

Respond ONLY in JSON:
{{"title": "...", "revision_content": {{"from_lecture": 0, "recap_points": ["..."], "weak_areas": ["..."]}}, "main_content": "...", "key_concepts": ["..."], "learning_outcomes": ["..."]}}"""
    return _parse_json(_chat(prompt))
