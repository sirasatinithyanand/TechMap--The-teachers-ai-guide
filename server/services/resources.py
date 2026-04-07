import json
import re
from openai import OpenAI
from settings import settings
from services.scraper import serper_resource_search

_groq = OpenAI(
    api_key=settings.GROQ_API_KEY,
    base_url="https://api.groq.com/openai/v1",
)


def _generate_search_queries(lecture_title: str, key_concepts: list[str], course_name: str) -> dict:
    """Generate separate queries for YouTube videos and article/blog resources."""
    prompt = f"""Generate search queries to find pre-lecture prep resources for a university professor.

Lecture: "{lecture_title}"
Course: {course_name}
Key concepts: {", ".join(key_concepts[:5])}

Generate:
- 3 YouTube search queries (site:youtube.com) for clear video explanations or lectures on this topic
- 3 article/blog search queries targeting sites like Medium, Towards Data Science, dev.to, university sites, or well-known tech/science blogs

Rules:
- Queries must be specific to the lecture topic, not generic
- Videos: prefer lecture-style explanations, conference talks, or well-known educators
- Articles: prefer in-depth explainers, tutorials, or conceptual overviews

Return ONLY JSON:
{{"video_queries": ["...", "...", "..."], "article_queries": ["...", "...", "..."]}}"""

    resp = _groq.chat.completions.create(
        model="llama-3.3-70b-versatile",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.3,
    )
    text = resp.choices[0].message.content.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


# Domains that indicate it's a video resource
VIDEO_DOMAINS = {"youtube.com", "youtu.be", "vimeo.com"}

# Domains to skip — not useful for professor prep
SKIP_DOMAINS = {
    "quizlet.com", "chegg.com", "coursehero.com", "reddit.com",
    "pinterest.com", "facebook.com", "twitter.com", "instagram.com",
}


def _is_video(url: str) -> bool:
    return any(d in url for d in VIDEO_DOMAINS)


def _should_skip(url: str) -> bool:
    return any(d in url for d in SKIP_DOMAINS)


def generate_lecture_resources(
    lecture_title: str,
    key_concepts: list[str],
    course_name: str,
    university: str,
) -> list[dict]:
    # Generate targeted queries
    try:
        queries = _generate_search_queries(lecture_title, key_concepts, course_name)
        video_queries = queries.get("video_queries", [])
        article_queries = queries.get("article_queries", [])
    except Exception:
        # Fallback
        video_queries = [
            f"{lecture_title} explained site:youtube.com",
            f"{key_concepts[0] if key_concepts else lecture_title} lecture site:youtube.com",
        ]
        article_queries = [
            f"{lecture_title} in-depth guide",
            f"{key_concepts[0] if key_concepts else lecture_title} tutorial blog",
        ]

    seen_urls: set[str] = set()
    videos: list[dict] = []
    articles: list[dict] = []

    # Collect up to 3 videos
    for query in video_queries[:3]:
        if len(videos) >= 3:
            break
        results = serper_resource_search(query, num=3)
        for r in results:
            url = r.get("url", "")
            title = r.get("title", "")
            if not url or not title or url in seen_urls or _should_skip(url):
                continue
            if _is_video(url):
                seen_urls.add(url)
                videos.append({
                    "title": title,
                    "url": url,
                    "description": r.get("snippet", ""),
                    "resource_type": "video",
                })
            if len(videos) >= 3:
                break

    # Collect up to 3 articles
    for query in article_queries[:3]:
        if len(articles) >= 3:
            break
        results = serper_resource_search(query, num=3)
        for r in results:
            url = r.get("url", "")
            title = r.get("title", "")
            if not url or not title or url in seen_urls or _should_skip(url) or _is_video(url):
                continue
            seen_urls.add(url)
            articles.append({
                "title": title,
                "url": url,
                "description": r.get("snippet", ""),
                "resource_type": "reading",
            })
            if len(articles) >= 3:
                break

    # Interleave: video, article, video, article...
    result = []
    for i in range(max(len(videos), len(articles))):
        if i < len(videos):
            result.append(videos[i])
        if i < len(articles):
            result.append(articles[i])

    return result[:6]
