import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

try:
    res = supabase.table("surveys").select("*, response_sessions(count)").execute()
    print(res)
except Exception as e:
    print("ERROR:", e)
