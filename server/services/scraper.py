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


def _extract_answer_box(data: dict) -> str:
    """Pull structured text from Serper answer boxes / knowledge panels."""
    parts = []
    if ab := data.get("answerBox"):
        for key in ("answer", "snippet", "snippetHighlighted"):
            val = ab.get(key)
            if isinstance(val, list):
                parts.append(" ".join(val))
            elif val:
                parts.append(str(val))
    if kg := data.get("knowledgeGraph"):
        if desc := kg.get("description"):
            parts.append(desc)
    return "\n".join(parts)


def _build_queries(university: str, course_name: str) -> list[str]:
    """Return a ranked list of search queries to try, most specific first."""
    return [
        f'site:{university.lower().replace(" ", "")}.edu "{course_name}" syllabus weeks topics',
        f'"{university}" "{course_name}" course syllabus weekly topics',
        f'"{university}" "{course_name}" curriculum outline chapters',
        f'{university} {course_name} syllabus',
    ]


def get_university_curriculum(university: str, course_name: str) -> dict:
    """
    Pipeline:
    1. Try multiple targeted queries; use Serper snippets + answer boxes → Groq
    2. Scrape up to 4 URLs from best query result
    3. Groq knowledge fallback (always works)
    """
    best_data: dict = {}
    best_snippets = ""

    for query in _build_queries(university, course_name):
        try:
            data = _serper(query, num=6)
            organics = data.get("organic", [])

            # Collect answer box / knowledge panel text
            answer_box_text = _extract_answer_box(data)

            snippet_parts = []
            if answer_box_text:
                snippet_parts.append(answer_box_text)
            snippet_parts += [
                f"{r.get('title', '')}: {r.get('snippet', '')}"
                for r in organics if r.get("snippet")
            ]
            snippets_text = "\n\n".join(snippet_parts)

            if snippets_text and len(snippets_text) > len(best_snippets):
                best_snippets = snippets_text
                best_data = data

            if snippets_text:
                result = _extract_with_groq(snippets_text, university, course_name)
                if len(result.get("chapters", [])) >= 4:
                    return result
        except Exception:
            continue

    # Step 2: Scrape up to 4 URLs from the best query result
    try:
        urls = [r["link"] for r in best_data.get("organic", [])][:4]
        for url in urls:
            try:
                text = _fetch_and_clean(url)
                if len(text) > 600:
                    result = _extract_with_groq(text, university, course_name)
                    if len(result.get("chapters", [])) >= 3:
                        return result
            except Exception:
                continue
    except Exception:
        pass

    # Step 3: If we got some snippets but not enough chapters, try extraction one more time
    if best_snippets:
        try:
            result = _extract_with_groq(best_snippets, university, course_name)
            if result.get("chapters"):
                return result
        except Exception:
            pass

    # Step 4: LLM knowledge fallback — always returns something
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
