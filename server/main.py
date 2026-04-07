from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from routers import courses, curriculum, lectures, students, auth
import httpx
import services.supabase_client as _sb_module

app = FastAPI(title="TeachMap API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(courses.router, prefix="/api")
app.include_router(curriculum.router, prefix="/api")
app.include_router(lectures.router, prefix="/api")
app.include_router(students.router, prefix="/api")


@app.exception_handler(httpx.RemoteProtocolError)
async def supabase_disconnect_handler(request: Request, exc: httpx.RemoteProtocolError):
    # Supabase dropped the keep-alive connection — recreate the client and ask client to retry
    _sb_module.supabase = _sb_module._make_client()
    return JSONResponse(status_code=503, content={"detail": "Database connection reset, please retry."})


@app.get("/health")
def health():
    return {"status": "ok"}
