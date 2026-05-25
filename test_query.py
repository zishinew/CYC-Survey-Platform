import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(dotenv_path=".env.local")
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    res = supabase.table("answers").select("*, response_sessions!inner(survey_id)").limit(1).execute()
    print("Success")
except Exception as e:
    print(f"Error: {e}")
