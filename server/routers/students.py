import logging
from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)
from models.students import (
    QuestionCreate, Question,
    FeedbackCreate, FeedbackSummary,
    QuizSubmission, QuizResult,
)
from services.supabase_client import supabase
from services.curricullm import answer_student_question

router = APIRouter(tags=["students"])


# --- Forum ---

def _generate_and_post_ai_reply(question_id: str, question_text: str, lecture_id: str):
    """Background task: call CurricuLLM and post the AI reply."""
    try:
        # Fetch lecture info for context
        lec_resp = supabase.table("lectures").select("title, content, course_id").eq("id", lecture_id).single().execute()
        if not lec_resp.data:
            return
        lecture = lec_resp.data
        course_resp = supabase.table("courses").select("course_name").eq("id", lecture["course_id"]).single().execute()
        course_name = course_resp.data["course_name"] if course_resp.data else "Course"

        ai_answer = answer_student_question(
            question=question_text,
            lecture_title=lecture["title"],
            lecture_content=lecture["content"].get("main_content", ""),
            course_name=course_name,
        )

        # Try with is_ai column first; fall back if column doesn't exist yet
        try:
            supabase.table("forum_replies").insert({
                "question_id": question_id,
                "reply_text": ai_answer,
                "is_professor": False,
                "is_ai": True,
            }).execute()
        except Exception:
            supabase.table("forum_replies").insert({
                "question_id": question_id,
                "reply_text": ai_answer,
                "is_professor": False,
            }).execute()
    except Exception as e:
        logger.error("AI Q&A background task failed: %s", e, exc_info=True)


@router.post("/lectures/{lecture_id}/questions", response_model=Question)
def post_question(lecture_id: str, body: QuestionCreate, background_tasks: BackgroundTasks):
    resp = (
        supabase.table("forum_questions")
        .insert({"lecture_id": lecture_id, "question_text": body.question_text, "upvotes": 0, "escalated_to_prof": False})
        .execute()
    )
    question = resp.data[0]
    background_tasks.add_task(
        _generate_and_post_ai_reply,
        question_id=question["id"],
        question_text=body.question_text,
        lecture_id=lecture_id,
    )
    return Question(**question)


@router.get("/lectures/{lecture_id}/questions")
def list_questions(lecture_id: str):
    resp = (
        supabase.table("forum_questions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("upvotes", desc=True)
        .execute()
    )
    return resp.data


@router.post("/questions/{question_id}/upvote")
def upvote_question(question_id: str):
    resp = supabase.rpc("increment_upvotes", {"question_id": question_id}).execute()
    if not resp.data:
        q = supabase.table("forum_questions").select("upvotes").eq("id", question_id).single().execute()
        if not q.data:
            raise HTTPException(status_code=404, detail="Question not found")
        new_count = q.data["upvotes"] + 1
        supabase.table("forum_questions").update({"upvotes": new_count}).eq("id", question_id).execute()
        return {"upvotes": new_count}
    return resp.data


@router.post("/questions/{question_id}/escalate")
def escalate_question(question_id: str):
    resp = (
        supabase.table("forum_questions")
        .update({"escalated_to_prof": True})
        .eq("id", question_id)
        .execute()
    )
    if not resp.data:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"escalated": True}


class ReplyCreate(BaseModel):
    reply_text: str
    is_professor: bool = False


@router.post("/questions/{question_id}/replies")
def post_reply(question_id: str, body: ReplyCreate):
    resp = (
        supabase.table("forum_replies")
        .insert({
            "question_id": question_id,
            "reply_text": body.reply_text,
            "is_professor": body.is_professor,
        })
        .execute()
    )
    return resp.data[0]


@router.get("/questions/{question_id}/replies")
def get_replies(question_id: str):
    resp = (
        supabase.table("forum_replies")
        .select("*")
        .eq("question_id", question_id)
        .order("created_at")
        .execute()
    )
    return resp.data or []


# --- Quiz ---

@router.post("/quizzes/{quiz_id}/submit")
def submit_quiz(quiz_id: str, body: QuizSubmission):
    quiz_resp = supabase.table("quizzes").select("questions").eq("id", quiz_id).single().execute()
    if not quiz_resp.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    questions = quiz_resp.data["questions"]
    correct_count = 0
    review = []

    for i, q in enumerate(questions):
        if i >= len(body.answers):
            break
        student_ans = body.answers[i]
        correct_ans = q.get("correct", "")
        is_correct = q.get("type") == "mcq" and student_ans == correct_ans
        if is_correct:
            correct_count += 1
        review.append({
            "question": q.get("q"),
            "your_answer": student_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "explanation": q.get("explanation", ""),
            "options": q.get("options", []),
        })

    mcq_count = sum(1 for q in questions if q.get("type") == "mcq")
    score = (correct_count / mcq_count) if mcq_count else 0

    resp = (
        supabase.table("quiz_responses")
        .insert({"quiz_id": quiz_id, "answers": body.answers, "score": score})
        .execute()
    )
    return {
        "submission_id": resp.data[0]["id"],
        "score": score,
        "correct": correct_count,
        "total_mcq": mcq_count,
        "review": review,
    }


@router.get("/quizzes/{quiz_id}/results", response_model=QuizResult)
def quiz_results(quiz_id: str):
    quiz_resp = supabase.table("quizzes").select("questions, lecture_id").eq("id", quiz_id).single().execute()
    if not quiz_resp.data:
        raise HTTPException(status_code=404, detail="Quiz not found")

    subs_resp = supabase.table("quiz_responses").select("answers, score").eq("quiz_id", quiz_id).execute()
    submissions = subs_resp.data or []
    scores = [s["score"] for s in submissions if s.get("score") is not None]
    avg_score = sum(scores) / len(scores) if scores else 0

    questions = quiz_resp.data["questions"]
    question_stats = []
    for i, q in enumerate(questions):
        if q.get("type") != "mcq":
            continue
        correct_answers = sum(
            1 for s in submissions
            if i < len(s.get("answers", [])) and s["answers"][i] == q.get("correct")
        )
        question_stats.append({
            "question": q.get("q"),
            "correct_count": correct_answers,
            "total": len(submissions),
            "avg_correct": correct_answers / len(submissions) if submissions else 0,
        })

    return QuizResult(
        quiz_id=quiz_id,
        total_submissions=len(submissions),
        avg_score=avg_score,
        question_stats=question_stats,
    )


# --- Feedback ---

@router.post("/lectures/{lecture_id}/feedback")
def submit_feedback(lecture_id: str, body: FeedbackCreate):
    if not (1 <= body.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5.")
    resp = (
        supabase.table("feedback")
        .insert({"lecture_id": lecture_id, "rating": body.rating, "comment": body.comment})
        .execute()
    )
    return {"id": resp.data[0]["id"]}


@router.get("/lectures/{lecture_id}/feedback/summary", response_model=FeedbackSummary)
def feedback_summary(lecture_id: str):
    resp = supabase.table("feedback").select("rating, comment").eq("lecture_id", lecture_id).execute()
    rows = resp.data or []
    ratings = [r["rating"] for r in rows if r.get("rating")]
    comments = [r["comment"] for r in rows if r.get("comment")]
    avg = sum(ratings) / len(ratings) if ratings else 0
    return FeedbackSummary(avg_rating=round(avg, 2), total_responses=len(rows), comments=comments)
