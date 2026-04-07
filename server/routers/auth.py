import hashlib
import os
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services.supabase_client import supabase

router = APIRouter(tags=["auth"])


def _hash_password(password: str) -> str:
    salt = os.urandom(16).hex()
    h = hashlib.sha256(f"{salt}{password}".encode()).hexdigest()
    return f"{salt}:{h}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt, h = stored.split(":", 1)
        return hashlib.sha256(f"{salt}{password}".encode()).hexdigest() == h
    except Exception:
        return False


class AuthRequest(BaseModel):
    name: str
    password: str


@router.post("/auth/register")
def register(body: AuthRequest):
    name = body.name.strip()
    if not name or not body.password:
        raise HTTPException(status_code=400, detail="Name and password are required.")

    # Check if name already taken
    existing = supabase.table("professors").select("id").eq("name", name).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=409, detail="A professor with that name already exists. Please log in.")

    password_hash = _hash_password(body.password)
    resp = supabase.table("professors").insert({"name": name, "password_hash": password_hash}).execute()
    prof = resp.data[0]
    return {"professor_id": prof["id"], "name": prof["name"]}


@router.post("/auth/login")
def login(body: AuthRequest):
    name = body.name.strip()
    resp = supabase.table("professors").select("id, name, password_hash").eq("name", name).limit(1).execute()
    if not resp.data:
        raise HTTPException(status_code=401, detail="Professor not found. Please register first.")

    prof = resp.data[0]
    if not prof.get("password_hash"):
        # Legacy professor with no password — set the password now
        password_hash = _hash_password(body.password)
        supabase.table("professors").update({"password_hash": password_hash}).eq("id", prof["id"]).execute()
        return {"professor_id": prof["id"], "name": prof["name"]}

    if not _verify_password(body.password, prof["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password.")

    return {"professor_id": prof["id"], "name": prof["name"]}


@router.get("/professors/{professor_id}/courses")
def get_professor_courses(professor_id: str):
    resp = (
        supabase.table("courses")
        .select("*")
        .eq("professor_id", professor_id)
        .order("created_at", desc=True)
        .execute()
    )
    return resp.data or []
