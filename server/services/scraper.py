import httpx
from bs4 import BeautifulSoup
from openai import OpenAI
from settings import settings

SERPER_URL = "https://google.serper.dev/search"

_groq = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)


def _serper(query: str, num: int = 5) -> dict:
    with httpx.Client(timeout=10) as client:
        resp = client.post(
            SERPER_URL,
            headers={"X-API-KEY": settings.SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": num},
        )
        resp.raise_for_status()
    return resp.json()


def _fetch_and_clean(url: str) -> str:
    with httpx.Client(timeout=8, follow_redirects=True) as client:
        resp = client.get(url, headers={"User-Agent": "Mozilla/5.0"})
        resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "lxml")
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    return " ".join(soup.get_text(separator=" ").split())


def _extract_with_groq(context: str, university: str, course: str) -> dict:
    import json, re
    prompt = f"""Extract the chapter or week-by-week curriculum structure for "{course}" at "{university}" from the text below.

Text:
{context[:5000]}

Return ONLY valid JSON:
{{"university": "{university}", "course": "{course}", "chapters": [{{"number": 1, "title": "...", "description": "...", "topics": ["..."]}}]}}

If no clear structure is found, return: {{"university": "{university}", "course": "{course}", "chapters": []}}"""

    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    text = resp.choices[0].message.content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def _knowledge_fallback(university: str, course: str) -> dict:
    """Ask Groq what it knows about this university's course from training data."""
    import json, re
    prompt = f"""Based on your knowledge, what is the typical chapter-by-chapter curriculum for "{course}" at {university}?

Return ONLY valid JSON with at least 6 chapters:
{{"university": "{university}", "course": "{course}", "chapters": [{{"number": 1, "title": "...", "description": "...", "topics": ["..."]}}]}}"""

    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.2,
    )
    text = resp.choices[0].message.content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


def get_university_curriculum(university: str, course_name: str) -> dict:
    """
    Pipeline (most reliable to least):
    1. Serper snippets → Groq extraction   (fast, no scraping)
    2. Scrape top URL → Groq extraction    (for pages with rich HTML)
    3. Groq knowledge fallback             (always works)
    """
    query = f'"{university}" "{course_name}" syllabus OR curriculum OR "course outline"'

    # Step 1: Use Serper snippets directly — no scraping needed for most courses
    try:
        data = _serper(query)
        organics = data.get("organic", [])
        snippets_text = "\n\n".join(
            f"{r.get('title', '')}: {r.get('snippet', '')}"
            for r in organics if r.get("snippet")
        )
        if snippets_text:
            result = _extract_with_groq(snippets_text, university, course_name)
            if len(result.get("chapters", [])) >= 3:
                return result
    except Exception:
        pass

    # Step 2: Try scraping the top 2 URLs (handles pages with detailed syllabi)
    try:
        urls = [r["link"] for r in data.get("organic", [])][:2]
        for url in urls:
            try:
                text = _fetch_and_clean(url)
                if len(text) > 400:
                    result = _extract_with_groq(text, university, course_name)
                    if len(result.get("chapters", [])) >= 3:
                        return result
            except Exception:
                continue
    except Exception:
        pass

    # Step 3: LLM knowledge fallback — always returns something
    try:
        return _knowledge_fallback(university, course_name)
    except Exception:
        return {"university": university, "course": course_name, "chapters": []}


def serper_resource_search(query: str, num: int = 4) -> list[dict]:
    """Search for learning resources, returns list of {title, url, snippet}."""
    try:
        data = _serper(query, num=num)
        return [
            {"title": r.get("title", ""), "url": r.get("link", ""), "snippet": r.get("snippet", "")}
            for r in data.get("organic", [])
            if r.get("link")
        ]
    except Exception:
        return []
