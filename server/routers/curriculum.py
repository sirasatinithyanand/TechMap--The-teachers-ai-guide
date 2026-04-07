import io
from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from models.curriculum import Curriculum, CurriculumUpdate, InspireRequest
from services.supabase_client import supabase
from services.curricullm import generate_baseline_curriculum, blend_curricula
from services.scraper import get_university_curriculum
from services.gemini import extract_file_content

router = APIRouter(tags=["curriculum"])


def _get_course(course_id: str) -> dict:
    resp = supabase.table("courses").select("*").eq("id", course_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return resp.data


def _get_latest_curriculum(course_id: str) -> dict | None:
    resp = (
        supabase.table("curricula")
        .select("*")
        .eq("course_id", course_id)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    return resp.data[0] if resp.data else None


@router.post("/courses/{course_id}/curriculum/baseline", response_model=Curriculum)
def baseline_curriculum(course_id: str):
    course = _get_course(course_id)
    try:
        content = generate_baseline_curriculum(
            university=course["university_name"],
            course_name=course["course_name"],
            course_code=course.get("course_code"),
            grade_level=course.get("grade_level"),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CurricuLLM failed: {e}")

    # Check if a baseline already exists; if so, increment version
    existing = _get_latest_curriculum(course_id)
    version = (existing["version"] + 1) if existing else 1

    resp = (
        supabase.table("curricula")
        .insert(
            {
                "course_id": course_id,
                "version": version,
                "content": content,
                "is_final": False,
                "source": "baseline",
            }
        )
        .execute()
    )
    return Curriculum(**resp.data[0])


@router.get("/universities/search")
def search_university(uni: str, course: str):
    """Scrape any university worldwide for their course curriculum."""
    result = get_university_curriculum(university=uni, course_name=course)
    return result


@router.post("/courses/{course_id}/curriculum/inspire")
def save_inspiration(course_id: str, body: InspireRequest):
    _get_course(course_id)
    curr = _get_latest_curriculum(course_id)
    if not curr:
        raise HTTPException(status_code=404, detail="No curriculum found. Generate baseline first.")

    supabase.table("curriculum_inspirations").insert(
        {
            "curriculum_id": curr["id"],
            "source_university": body.source_university,
            "source_course": body.source_course,
            "content_snapshot": body.content_snapshot.model_dump(),
        }
    ).execute()
    return {"status": "saved"}


class BlendRequest(BaseModel):
    inspired_university: str
    inspired_chapters: list[dict]


@router.post("/courses/{course_id}/curriculum/blend")
def blend_curriculum(course_id: str, body: BlendRequest):
    """AI-blend the current curriculum with chapters from an inspiration university."""
    course = _get_course(course_id)
    curr = _get_latest_curriculum(course_id)
    if not curr:
        raise HTTPException(status_code=404, detail="No curriculum found. Generate baseline first.")

    base_chapters = curr["content"].get("chapters", [])
    if not base_chapters:
        raise HTTPException(status_code=400, detail="Current curriculum has no chapters.")

    try:
        blended = blend_curricula(
            base_chapters=base_chapters,
            inspired_chapters=body.inspired_chapters,
            course_name=course["course_name"],
            base_university=course["university_name"],
            inspired_university=body.inspired_university,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Blend failed: {e}")

    return {"chapters": blended.get("chapters", [])}


@router.post("/courses/{course_id}/files/upload")
def upload_file(course_id: str, file: UploadFile = File(...)):
    _get_course(course_id)
    raw_bytes = file.file.read()

    # Extract text
    file_text = ""
    if file.content_type == "application/pdf" or file.filename.endswith(".pdf"):
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(raw_bytes))
        file_text = " ".join(page.extract_text() or "" for page in reader.pages)
    else:
        file_text = raw_bytes.decode("utf-8", errors="ignore")

    # Upload to Supabase Storage
    storage_path = f"{course_id}/{file.filename}"
    supabase.storage.from_("course-files").upload(
        storage_path, raw_bytes, {"content-type": file.content_type or "application/octet-stream"}
    )

    # Extract structure with Gemini
    course = _get_course(course_id)
    try:
        processed = extract_file_content(file_text, course["course_name"])
    except Exception:
        processed = {}

    resp = (
        supabase.table("uploaded_files")
        .insert(
            {
                "course_id": course_id,
                "file_name": file.filename,
                "file_path": storage_path,
                "file_type": file.content_type,
                "processed_content": processed,
            }
        )
        .execute()
    )
    return {"file_id": resp.data[0]["id"], "extracted_chapters": processed.get("chapters", [])}


@router.put("/courses/{course_id}/curriculum", response_model=Curriculum)
def update_curriculum(course_id: str, body: CurriculumUpdate):
    curr = _get_latest_curriculum(course_id)
    if not curr:
        raise HTTPException(status_code=404, detail="No curriculum found.")
    if curr["is_final"]:
        raise HTTPException(status_code=400, detail="Curriculum is finalized and cannot be edited.")

    resp = (
        supabase.table("curricula")
        .update({"content": body.content.model_dump(), "source": "modified"})
        .eq("id", curr["id"])
        .execute()
    )
    return Curriculum(**resp.data[0])


@router.post("/courses/{course_id}/curriculum/finalize", response_model=Curriculum)
def finalize_curriculum(course_id: str):
    curr = _get_latest_curriculum(course_id)
    if not curr:
        raise HTTPException(status_code=404, detail="No curriculum found.")

    resp = (
        supabase.table("curricula")
        .update({"is_final": True})
        .eq("id", curr["id"])
        .execute()
    )
    # Mark course as active
    supabase.table("courses").update({"status": "active"}).eq("id", course_id).execute()
    return Curriculum(**resp.data[0])
