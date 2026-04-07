from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from models.lectures import Lecture, LectureUpdate
from services.supabase_client import supabase
from services.curricullm import generate_lectures, generate_quiz, prepare_next_lecture
from services.export import build_lectures_zip
from services.resources import generate_lecture_resources

router = APIRouter(tags=["lectures"])


def _get_course(course_id: str) -> dict:
    resp = supabase.table("courses").select("*").eq("id", course_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return resp.data


def _get_final_curriculum(course_id: str) -> dict:
    resp = (
        supabase.table("curricula")
        .select("*")
        .eq("course_id", course_id)
        .eq("is_final", True)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=400, detail="No finalized curriculum. Finalize curriculum first.")
    return resp.data[0]


class GenerateRequest(BaseModel):
    teaching_style: str = "balanced"


@router.post("/courses/{course_id}/lectures/generate")
def generate_all_lectures(course_id: str, body: GenerateRequest = GenerateRequest()):
    course = _get_course(course_id)
    curriculum = _get_final_curriculum(course_id)
    chapters = curriculum["content"].get("chapters", [])

    if not chapters:
        raise HTTPException(status_code=400, detail="Curriculum has no chapters.")

    # Check if lectures already exist and delete them (re-generate)
    supabase.table("lectures").delete().eq("course_id", course_id).execute()

    try:
        lectures_data = generate_lectures(chapters, course["course_name"], teaching_style=body.teaching_style)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CurricuLLM failed: {e}")

    inserted = []
    for lec in lectures_data:
        content = {
            "main_content": lec.get("main_content", ""),
            "learning_outcomes": lec.get("learning_outcomes", []),
            "key_concepts": lec.get("key_concepts", []),
        }
        row = {
            "curriculum_id": curriculum["id"],
            "course_id": course_id,
            "lecture_number": lec["lecture_number"],
            "title": lec.get("title", f"Lecture {lec['lecture_number']}"),
            "content": content,
            "revision_content": lec.get("revision_content"),
            "status": "draft",
        }
        resp = supabase.table("lectures").insert(row).execute()
        inserted.append(resp.data[0])

    return {"generated": len(inserted), "lectures": inserted}


@router.get("/courses/{course_id}/lectures")
def list_lectures(course_id: str):
    resp = (
        supabase.table("lectures")
        .select("*")
        .eq("course_id", course_id)
        .order("lecture_number")
        .execute()
    )
    return resp.data


@router.get("/lectures/{lecture_id}", response_model=Lecture)
def get_lecture(lecture_id: str):
    resp = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return Lecture(**resp.data)


@router.put("/lectures/{lecture_id}", response_model=Lecture)
def update_lecture(lecture_id: str, body: LectureUpdate):
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update.")
    resp = supabase.table("lectures").update(update).eq("id", lecture_id).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return Lecture(**resp.data[0])


@router.post("/lectures/{lecture_id}/quiz/generate")
def generate_lecture_quiz(lecture_id: str):
    lec_resp = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
    if not lec_resp.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    lecture = lec_resp.data

    # Get course name
    course_resp = supabase.table("courses").select("course_name").eq("id", lecture["course_id"]).single().execute()
    course_name = course_resp.data["course_name"] if course_resp.data else "Course"

    try:
        questions = generate_quiz(
            lecture_title=lecture["title"],
            lecture_content=lecture["content"].get("main_content", ""),
            course_name=course_name,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CurricuLLM failed: {e}")

    # Delete existing quiz for this lecture if any
    supabase.table("quizzes").delete().eq("lecture_id", lecture_id).execute()

    resp = supabase.table("quizzes").insert({"lecture_id": lecture_id, "questions": questions}).execute()
    return resp.data[0]


@router.get("/lectures/{lecture_id}/quiz")
def get_quiz(lecture_id: str):
    resp = (
        supabase.table("quizzes")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="No quiz found for this lecture.")
    quiz = resp.data[0]
    # Strip correct answers for students
    student_questions = [
        {k: v for k, v in q.items() if k not in ("correct", "explanation")}
        for q in quiz["questions"]
    ]
    return {"id": quiz["id"], "lecture_id": lecture_id, "questions": student_questions}


@router.post("/lectures/{lecture_id}/next/prepare")
def prepare_next(lecture_id: str):
    lec_resp = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
    if not lec_resp.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    current = lec_resp.data

    # Get next lecture
    next_resp = (
        supabase.table("lectures")
        .select("*")
        .eq("course_id", current["course_id"])
        .eq("lecture_number", current["lecture_number"] + 1)
        .single()
        .execute()
    )
    if not next_resp.data:
        raise HTTPException(status_code=404, detail="No next lecture found.")
    next_lecture = next_resp.data

    # Get feedback summary
    fb_resp = supabase.table("feedback").select("rating, comment").eq("lecture_id", lecture_id).execute()
    ratings = [r["rating"] for r in fb_resp.data if r.get("rating")]
    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    comments = [r["comment"] for r in fb_resp.data if r.get("comment")]
    feedback_summary = {"avg_rating": avg_rating, "comments": comments}

    # Get quiz results
    quiz_resp = supabase.table("quizzes").select("id").eq("lecture_id", lecture_id).limit(1).execute()
    quiz_results = {"avg_score": 0, "question_stats": []}
    if quiz_resp.data:
        quiz_id = quiz_resp.data[0]["id"]
        sub_resp = supabase.table("quiz_responses").select("score").eq("quiz_id", quiz_id).execute()
        scores = [r["score"] for r in sub_resp.data if r.get("score") is not None]
        quiz_results["avg_score"] = sum(scores) / len(scores) if scores else 0

    # Get next chapter from curriculum
    curr_resp = supabase.table("curricula").select("content").eq("id", current["curriculum_id"]).single().execute()
    chapters = curr_resp.data["content"].get("chapters", []) if curr_resp.data else []
    next_chapter = chapters[current["lecture_number"]] if current["lecture_number"] < len(chapters) else {}

    # Get course name
    course_resp = supabase.table("courses").select("course_name").eq("id", current["course_id"]).single().execute()
    course_name = course_resp.data["course_name"] if course_resp.data else "Course"

    try:
        adjusted = prepare_next_lecture(current, feedback_summary, quiz_results, next_chapter, course_name)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CurricuLLM failed: {e}")

    # Update the next lecture content
    new_content = {
        "main_content": adjusted.get("main_content", ""),
        "learning_outcomes": adjusted.get("learning_outcomes", []),
        "key_concepts": adjusted.get("key_concepts", []),
    }
    updated = (
        supabase.table("lectures")
        .update({"content": new_content, "revision_content": adjusted.get("revision_content")})
        .eq("id", next_lecture["id"])
        .execute()
    )
    return updated.data[0]


@router.post("/lectures/{lecture_id}/resources/generate")
def generate_resources(lecture_id: str):
    lec_resp = supabase.table("lectures").select("*").eq("id", lecture_id).single().execute()
    if not lec_resp.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    lecture = lec_resp.data

    course_resp = (
        supabase.table("courses")
        .select("course_name, university_name")
        .eq("id", lecture["course_id"])
        .single()
        .execute()
    )
    course = course_resp.data or {}

    # Delete existing resources for this lecture
    supabase.table("lecture_resources").delete().eq("lecture_id", lecture_id).execute()

    try:
        items = generate_lecture_resources(
            lecture_title=lecture["title"],
            key_concepts=lecture["content"].get("key_concepts", []),
            course_name=course.get("course_name", "Course"),
            university=course.get("university_name", ""),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Resource generation failed: {e}")

    inserted = []
    for item in items:
        row = {
            "lecture_id": lecture_id,
            "title": item.get("title", ""),
            "url": item.get("url"),
            "description": item.get("description", ""),
            "resource_type": item.get("resource_type", "reading"),
        }
        resp = supabase.table("lecture_resources").insert(row).execute()
        inserted.append(resp.data[0])

    return inserted


@router.get("/lectures/{lecture_id}/resources")
def get_resources(lecture_id: str):
    resp = (
        supabase.table("lecture_resources")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("created_at")
        .execute()
    )
    return resp.data or []


class ExportRequest(BaseModel):
    notes: dict[str, str] = {}
    format: str = "txt"


@router.post("/courses/{course_id}/export")
def export_lectures(course_id: str, body: ExportRequest = ExportRequest()):
    course = _get_course(course_id)
    lecs_resp = (
        supabase.table("lectures")
        .select("*")
        .eq("course_id", course_id)
        .order("lecture_number")
        .execute()
    )
    if not lecs_resp.data:
        raise HTTPException(status_code=404, detail="No lectures to export.")

    fmt = body.format if body.format in ("txt", "pdf") else "txt"
    zip_bytes = build_lectures_zip(course["course_name"], lecs_resp.data, notes=body.notes, fmt=fmt)
    safe_name = course["course_name"].replace(" ", "_")
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_lectures_{fmt}.zip"'},
    )
