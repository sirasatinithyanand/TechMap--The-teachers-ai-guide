import json
import re
from openai import OpenAI
from settings import settings

_client = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)
MODEL = "llama-3.3-70b-versatile"


def _generate(prompt: str) -> str:
    response = _client.chat.completions.create(
        model=MODEL,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    return response.choices[0].message.content


def _parse_json(text: str) -> dict | list:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text.strip())


def parse_course_sentence(sentence: str) -> dict:
    prompt = f"""You are an assistant that extracts course information from a professor's sentence.

Extract these four fields:
- university_name: the name of the university (always a string, never null)
- course_name: the subject or course name (always a string, never null — infer from context if not explicit)
- course_code: the course code like "COMP1511" if mentioned, otherwise the empty string ""
- grade_level: e.g. "first year undergraduate", "postgraduate" if mentioned, otherwise the empty string ""

Input: "{sentence}"

Rules:
- Every field must be a string. Never use null or omit a field.
- If university is unclear, use "Unknown University".
- If course name is unclear, infer the subject from the sentence.

Respond ONLY with a valid JSON object, no explanation:
{{"university_name": "...", "course_name": "...", "course_code": "...", "grade_level": "..."}}"""
    result = _parse_json(_generate(prompt))
    # Guarantee no nulls reach Pydantic
    return {
        "university_name": result.get("university_name") or "Unknown University",
        "course_name": result.get("course_name") or sentence.strip(),
        "course_code": result.get("course_code") or None,
        "grade_level": result.get("grade_level") or None,
    }


def extract_curriculum_from_html(scraped_text: str, university: str, course: str) -> dict:
    prompt = f"""The following is raw text scraped from a university course page for "{course}" at "{university}".
Extract the chapter or week-by-week curriculum structure.

Raw page text:
{scraped_text[:4000]}

Return ONLY in JSON:
{{"university": "...", "course": "...", "chapters": [{{"number": 1, "title": "...", "description": "...", "topics": ["..."]}}]}}

If no clear curriculum structure is present, return: {{"chapters": []}}"""
    return _parse_json(_generate(prompt))


def extract_file_content(file_text: str, course_name: str) -> dict:
    prompt = f"""Extract structured curriculum topics from this uploaded course material for "{course_name}".
Identify chapters, weeks, or major topic sections.

Content:
{file_text[:5000]}

Return ONLY in JSON:
{{"chapters": [{{"number": 1, "title": "...", "description": "...", "topics": ["..."]}}]}}"""
    return _parse_json(_generate(prompt))
