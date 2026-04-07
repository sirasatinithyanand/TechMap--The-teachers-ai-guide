from fastapi import APIRouter, HTTPException
from models.courses import ParseRequest, ParsedCourse, CourseCreate, Course
from services.supabase_client import supabase
from services.gemini import parse_course_sentence

router = APIRouter(tags=["courses"])


@router.post("/courses/parse", response_model=ParsedCourse)
def parse_course(body: ParseRequest):
    try:
        result = parse_course_sentence(body.sentence)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini parse failed: {e}")
    return ParsedCourse(**result)


@router.post("/courses", response_model=Course)
def create_course(body: CourseCreate):
    # Find or create professor
    prof_resp = (
        supabase.table("professors")
        .select("id")
        .eq("name", body.professor_name)
        .limit(1)
        .execute()
    )
    if prof_resp.data:
        professor_id = prof_resp.data[0]["id"]
    else:
        new_prof = (
            supabase.table("professors")
            .insert({"name": body.professor_name})
            .execute()
        )
        professor_id = new_prof.data[0]["id"]

    course_data = {
        "professor_id": professor_id,
        "university_name": body.university_name,
        "course_name": body.course_name,
        "course_code": body.course_code,
        "grade_level": body.grade_level,
        "raw_input": body.raw_input,
        "status": "draft",
    }
    resp = supabase.table("courses").insert(course_data).execute()
    return Course(**resp.data[0])


@router.get("/courses/{course_id}", response_model=Course)
def get_course(course_id: str):
    resp = supabase.table("courses").select("*").eq("id", course_id).single().execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return Course(**resp.data)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: str):
    """Delete a course and all associated data (cascades via FK constraints)."""
    resp = supabase.table("courses").select("id").eq("id", course_id).limit(1).execute()
    if not resp.data:
        raise HTTPException(status_code=404, detail="Course not found")
    supabase.table("courses").delete().eq("id", course_id).execute()
    return None
