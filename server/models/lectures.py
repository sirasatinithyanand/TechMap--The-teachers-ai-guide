from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class LectureContent(BaseModel):
    main_content: str
    learning_outcomes: list[str] = []
    key_concepts: list[str] = []


class RevisionContent(BaseModel):
    from_lecture: int
    recap_points: list[str] = []
    weak_areas: list[str] = []


class LectureUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[dict[str, Any]] = None
    status: Optional[str] = None


class Lecture(BaseModel):
    id: str
    curriculum_id: str
    course_id: str
    lecture_number: int
    title: str
    content: dict[str, Any]
    revision_content: Optional[dict[str, Any]] = None
    status: str
    created_at: datetime
