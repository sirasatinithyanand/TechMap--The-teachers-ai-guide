from supabase import create_client, Client
from settings import settings


def _make_client() -> Client:
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)


supabase: Client = _make_client()
