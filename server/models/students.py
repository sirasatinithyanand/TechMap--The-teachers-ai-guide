from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class QuestionCreate(BaseModel):
    question_text: str


class Question(BaseModel):
    id: str
    lecture_id: str
    question_text: str
    upvotes: int
    created_at: datetime


class FeedbackCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None


class Feedback(BaseModel):
    id: str
    lecture_id: str
    rating: int
    comment: Optional[str] = None
    submitted_at: datetime


class FeedbackSummary(BaseModel):
    avg_rating: float
    total_responses: int
    comments: list[str]


class QuizSubmission(BaseModel):
    answers: list[Any]


class QuizResult(BaseModel):
    quiz_id: str
    total_submissions: int
    avg_score: float
    question_stats: list[dict[str, Any]]
