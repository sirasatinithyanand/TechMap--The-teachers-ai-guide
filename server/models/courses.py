from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ParseRequest(BaseModel):
    sentence: str


class ParsedCourse(BaseModel):
    university_name: str
    course_name: str
    course_code: Optional[str] = None
    grade_level: Optional[str] = None


class CourseCreate(BaseModel):
    professor_name: str = "Professor"
    university_name: str
    course_name: str
    course_code: Optional[str] = None
    grade_level: Optional[str] = None
    raw_input: Optional[str] = None


class Course(BaseModel):
    id: str
    professor_id: str
    university_name: str
    course_name: str
    course_code: Optional[str] = None
    grade_level: Optional[str] = None
    raw_input: Optional[str] = None
    status: str
    created_at: datetime
