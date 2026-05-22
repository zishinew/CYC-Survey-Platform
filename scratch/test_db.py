import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv(".env.local")
url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
key = os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

supabase: Client = create_client(url, key)

res = supabase.table("surveys").select("*").execute()
print(res)
