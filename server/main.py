from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import courses, curriculum, lectures, students

app = FastAPI(title="TeachMap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(courses.router, prefix="/api")
app.include_router(curriculum.router, prefix="/api")
app.include_router(lectures.router, prefix="/api")
app.include_router(students.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}
