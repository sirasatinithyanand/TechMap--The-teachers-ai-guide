from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime


class Chapter(BaseModel):
    number: int
    title: str
    description: Optional[str] = None
    learning_outcomes: list[str] = []
    topics: list[str] = []


class CurriculumContent(BaseModel):
    chapters: list[Chapter]


class InspireRequest(BaseModel):
    source_university: str
    source_course: Optional[str] = None
    content_snapshot: CurriculumContent


class CurriculumUpdate(BaseModel):
    content: CurriculumContent


class Curriculum(BaseModel):
    id: str
    course_id: str
    version: int
    content: dict[str, Any]
    is_final: bool
    source: str
    created_at: datetime
